"""
TarkovTracker - Gear Zone Scanner (F3)
======================================
Scans the entire Loadout zone (Vest, Pockets, Backpack) and detects all items.
Uses Florence-2 OCR_WITH_REGION for direct text+location detection.

Zone: Center-left of screen (between character model and stash)
Trigger: F3 key
"""

import os
os.environ['USE_TF'] = '0'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

import json
import time
import logging
import re
import cv2
import numpy as np
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass

import torch
from PIL import Image

# Screen capture
try:
    import mss
    MSS_AVAILABLE = True
except ImportError:
    MSS_AVAILABLE = False

# Screen size
try:
    import pyautogui
    PYAUTOGUI_AVAILABLE = True
except ImportError:
    PYAUTOGUI_AVAILABLE = False

# Fuzzy matching
try:
    from rapidfuzz import process, fuzz
    RAPIDFUZZ_AVAILABLE = True
except ImportError:
    RAPIDFUZZ_AVAILABLE = False

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============================================================================
# CONFIGURATION
# ============================================================================

# ROI Zone - Relative percentages for gear area (works on any resolution)
ROI_LEFT_PCT = 0.32    # Start after character model (expanded left)
ROI_TOP_PCT = 0.10     # Below top menu (expanded up)
ROI_WIDTH_PCT = 0.33   # Stop before stash (expanded right)
ROI_HEIGHT_PCT = 0.75  # Stop BEFORE hotbar (expanded down)

# Fuzzy matching
FUZZY_THRESHOLD = 82   # Lowered to catch more items with OCR variations

# Manual OCR fixes
MANUAL_FIXES = {
    "gpowder": "gunpowder",
    "6powder": "gunpowder",
    "xeno": "xeno",
    "multitool": "multi-tool",
    "rnultitool": "multi-tool",
    "firesteel": "firesteel",
    "fircsteel": "firesteel",
}

# BLACKLIST - UI text to ignore (not items)
IGNORED_TEXTS = {
    "special slots",
    "pockets",
    "poches",
    "tactical rig",
    "backpack",
    "sac a dos",
    "sac à dos",
    "armband",
    "brassard",
    "scabbard",
    "fourreau",
    "holster",
    "on sling",
    "on back",
    "headwear",
    "earpiece",
    "eyewear",
    "face cover",
    "body armor",
    "armure",
    "rig",
    "melee",
    "primary",
    "secondary",
    "pistol",
    "usec",
    "arena",
    "gamma",
    "spear",
    "spec",
    "key tool",
    "injector",
    "m48 kukri",
    # User-requested blacklist additions
    "takedown",
    "ms2000",
    "surv12",
    "keytool",
    "injectors",
    "injector",
    "goldenstars",
    "goldenstar",
    "grizzly",
    "keys",
    "key",
    "tool",
    "key tool",
    "luxury",
}

# Database paths
DB_PATH = Path(__file__).parent / "shortnames.json"
DEBUG_FOLDER = Path(__file__).parent / "debug_captures"


@dataclass
class DetectedItem:
    """Represents a detected item with its position and data."""
    abs_x: int
    abs_y: int
    abs_width: int
    abs_height: int
    item_id: str
    name: str
    short_name: str
    ocr_text: str
    match_score: int
    avg24h_price: int      # Flea avg 24h (priority)
    flea_price: int        # Current flea price
    trader_price: int      # Best trader price
    trader_name: str       # Best trader name
    roi_x: int
    roi_y: int
    slots: int             # Number of inventory slots (width * height)


class GearScanner:
    """
    Scans the gear zone using Florence-2 OCR_WITH_REGION.
    Directly detects text + bounding boxes in a single inference.
    """

    def __init__(self, florence_engine=None):
        """
        Initialize the gear scanner.

        Args:
            florence_engine: Existing FlorenceOCREngine instance
        """
        self.florence = florence_engine
        self.shortnames_db = {}
        self.shortname_keys = []

        # Load database
        self._load_database()

        # Create debug folder
        DEBUG_FOLDER.mkdir(exist_ok=True)
        self.scan_counter = 0

        logger.info("[GearScanner] Initialized (Florence-2 OCR_WITH_REGION mode)")

    def set_florence_engine(self, engine):
        """Set the Florence-2 OCR engine."""
        self.florence = engine
        logger.info("[GearScanner] Florence-2 engine attached")

    def _load_database(self):
        """Load shortnames database."""
        if not DB_PATH.exists():
            logger.warning(f"[GearScanner] Database not found: {DB_PATH}")
            return

        with open(DB_PATH, 'r', encoding='utf-8') as f:
            self.shortnames_db = json.load(f)

        self.shortname_keys = list(self.shortnames_db.keys())
        logger.info(f"[GearScanner] Loaded {len(self.shortnames_db)} shortnames")

    def _get_screen_size(self) -> Tuple[int, int]:
        """Get screen dimensions."""
        if PYAUTOGUI_AVAILABLE:
            return pyautogui.size()
        else:
            with mss.mss() as sct:
                monitor = sct.monitors[1]
                return monitor['width'], monitor['height']

    def _calculate_roi(self) -> Dict:
        """Calculate the ROI for the gear zone."""
        screen_w, screen_h = self._get_screen_size()

        roi_left = int(screen_w * ROI_LEFT_PCT)
        roi_top = int(screen_h * ROI_TOP_PCT)
        roi_width = int(screen_w * ROI_WIDTH_PCT)
        roi_height = int(screen_h * ROI_HEIGHT_PCT)

        logger.info(f"[GearScanner] Screen: {screen_w}x{screen_h}")
        logger.info(f"[GearScanner] ROI: left={roi_left}, top={roi_top}, {roi_width}x{roi_height}")

        return {
            "left": roi_left,
            "top": roi_top,
            "width": roi_width,
            "height": roi_height
        }

    def _capture_roi(self, roi: Dict) -> Optional[Image.Image]:
        """Capture the gear zone as PIL Image."""
        if not MSS_AVAILABLE:
            raise ImportError("mss not installed")

        try:
            with mss.mss() as sct:
                screenshot = sct.grab(roi)
                if screenshot is None:
                    return None

                # Convert to PIL Image (RGB)
                img = Image.frombytes('RGB', screenshot.size, screenshot.rgb)
                return img
        except Exception as e:
            logger.error(f"[GearScanner] Capture error: {e}")
            return None

    def _run_ocr_with_region(self, image: Image.Image) -> Dict:
        """
        Run Florence-2 OCR_WITH_REGION on the full image.
        Returns text labels with their bounding boxes.
        """
        if self.florence is None:
            logger.error("[GearScanner] Florence engine not set!")
            return {}

        try:
            # Prepare inputs with OCR_WITH_REGION task
            task = "<OCR_WITH_REGION>"

            inputs = self.florence.processor(
                text=task,
                images=image,
                return_tensors="pt"
            ).to(self.florence.model.device, self.florence.model.dtype)

            # Generate with no grad (optimized settings)
            with torch.no_grad():
                generated_ids = self.florence.model.generate(
                    input_ids=inputs["input_ids"],
                    pixel_values=inputs["pixel_values"],
                    max_new_tokens=2048,  # Increased to handle many items
                    num_beams=1,
                    do_sample=False,
                    use_cache=False
                )

            # Decode output
            generated_text = self.florence.processor.batch_decode(
                generated_ids,
                skip_special_tokens=False
            )[0]

            # Post-process to get structured output
            result = self.florence.processor.post_process_generation(
                generated_text,
                task=task,
                image_size=(image.width, image.height)
            )

            return result

        except Exception as e:
            logger.error(f"[GearScanner] OCR_WITH_REGION error: {e}")
            return {}

    def _normalize_text(self, text: str) -> str:
        """Normalize text for matching."""
        normalized = text.lower().strip()
        normalized = re.sub(r'[^a-z0-9\-]', '', normalized)
        return normalized

    def _is_blacklisted(self, text: str) -> bool:
        """Check if text is UI element (not an item)."""
        text_lower = text.lower().strip()
        for ignored in IGNORED_TEXTS:
            if ignored in text_lower:
                return True
        return False

    def _fuzzy_match(self, ocr_text: str) -> Optional[Tuple[str, int]]:
        """Fuzzy match OCR text against database."""
        if not ocr_text or len(ocr_text) < 2:
            return None

        # Check blacklist
        if self._is_blacklisted(ocr_text):
            return None

        normalized = self._normalize_text(ocr_text)
        if not normalized or len(normalized) < 2:
            return None

        # Check manual fixes
        if normalized in MANUAL_FIXES:
            normalized = MANUAL_FIXES[normalized]

        # Exact match
        if normalized in self.shortnames_db:
            return (normalized, 100)

        # Fuzzy match
        if RAPIDFUZZ_AVAILABLE:
            result = process.extractOne(
                normalized,
                self.shortname_keys,
                scorer=fuzz.ratio,
                score_cutoff=FUZZY_THRESHOLD
            )
            if result:
                matched_key, score, _ = result

                # SECURITY: Short names (< 3 chars) require perfect match
                if len(matched_key) < 3 and score < 100:
                    return None

                # Also check if matched result is blacklisted
                if self._is_blacklisted(matched_key):
                    return None

                return (matched_key, score)

        return None

    def scan_gear_zone(self) -> Dict:
        """
        Scan the entire gear zone using Florence-2 OCR_WITH_REGION.
        Single inference to detect all text + locations.

        Returns:
            Dict with success, items, total_value, etc.
        """
        start_time = time.time()
        self.scan_counter += 1

        logger.info("[GearScanner] === Starting Gear Zone Scan (OCR_WITH_REGION) ===")

        # STEP 1: Calculate ROI
        roi = self._calculate_roi()

        # STEP 2: Capture the zone
        capture_start = time.time()
        image = self._capture_roi(roi)
        capture_time = (time.time() - capture_start) * 1000

        if image is None:
            logger.error("[GearScanner] Failed to capture screen")
            return {
                "success": False,
                "items": [],
                "total_value": 0,
                "scan_time_ms": (time.time() - start_time) * 1000,
                "item_count": 0,
                "error": "Capture failed"
            }

        # Debug image saving disabled for performance
        # Uncomment below to enable debug captures:
        # timestamp = time.strftime("%Y%m%d_%H%M%S")
        # debug_roi_path = DEBUG_FOLDER / f"gear_scan_{self.scan_counter:04d}_{timestamp}_roi.png"
        # image.save(str(debug_roi_path))
        # logger.info(f"[GearScanner] ROI saved: {debug_roi_path}")

        # STEP 3: Run Florence-2 OCR_WITH_REGION (single inference)
        ocr_start = time.time()
        result = self._run_ocr_with_region(image)
        ocr_time = (time.time() - ocr_start) * 1000

        logger.info(f"[GearScanner] OCR_WITH_REGION completed in {ocr_time:.0f}ms")

        # STEP 4: Parse results
        detected_items = []
        total_value = 0

        if '<OCR_WITH_REGION>' in result:
            prediction = result['<OCR_WITH_REGION>']
            quad_boxes = prediction.get('quad_boxes', [])
            labels = prediction.get('labels', [])

            logger.info(f"[GearScanner] Florence detected {len(labels)} text regions")

            for i, (box, text) in enumerate(zip(quad_boxes, labels)):
                clean_text = text.strip()

                # Skip short noise
                if len(clean_text) < 2:
                    continue

                # Convert quad_box to rect
                # box is [x1, y1, x2, y2, x3, y3, x4, y4]
                if len(box) >= 8:
                    x_coords = [box[0], box[2], box[4], box[6]]
                    y_coords = [box[1], box[3], box[5], box[7]]
                elif len(box) >= 4:
                    # Sometimes it's just [x1, y1, x2, y2]
                    x_coords = [box[0], box[2]]
                    y_coords = [box[1], box[3]]
                else:
                    continue

                x = int(min(x_coords))
                y = int(min(y_coords))
                w = int(max(x_coords) - x)
                h = int(max(y_coords) - y)

                # Handle compound texts (e.g., "Gold Chain" = 1 item, "Sdiary Gold Chain" = 2 items)
                if ' ' in clean_text:
                    # Smart split: try to combine adjacent words into items
                    words = clean_text.split()
                    texts_to_match = []
                    i = 0

                    while i < len(words):
                        word = words[i]
                        if len(word) < 2:
                            i += 1
                            continue

                        # Try matching this word alone first
                        if self._fuzzy_match(word):
                            texts_to_match.append(word)
                            i += 1
                        else:
                            # Try combining with next word(s)
                            found_combined = False
                            for j in range(i + 1, min(i + 3, len(words) + 1)):  # Try up to 2 words ahead
                                combined = ''.join(words[i:j + 1])
                                if self._fuzzy_match(combined):
                                    texts_to_match.append(combined)
                                    logger.info(f"[GearScanner] COMBINED: '{' '.join(words[i:j + 1])}' -> '{combined}'")
                                    i = j + 1
                                    found_combined = True
                                    break

                            if not found_combined:
                                # No match found, add word as-is (will be rejected later)
                                texts_to_match.append(word)
                                i += 1

                    if len(texts_to_match) > 1:
                        logger.info(f"[GearScanner] PARSED: '{clean_text}' -> {texts_to_match}")
                else:
                    texts_to_match = [clean_text]

                # Calculate item width for split texts (to offset positions)
                num_items = len(texts_to_match)
                item_width = w // num_items if num_items > 1 else w
                item_index = 0

                for text_part in texts_to_match:
                    match_result = self._fuzzy_match(text_part)

                    if not match_result:
                        # Log rejected
                        if not self._is_blacklisted(text_part) and len(text_part) >= 3:
                            logger.info(f"[GearScanner] REJECTED: '{text_part}' (no match >= {FUZZY_THRESHOLD})")
                        item_index += 1
                        continue

                    matched_key, score = match_result
                    item_data = self.shortnames_db[matched_key]

                    # Extract prices
                    avg24h_price = item_data.get('avg24hPrice', 0) or 0

                    # Get flea market price from sellFor
                    sell_for = item_data.get('sellFor', {})
                    flea_price = sell_for.get('flea market', 0) or item_data.get('basePrice', 0) or 0

                    # Find best trader price (excluding fence and flea market)
                    trader_price = 0
                    trader_name = ""
                    for trader, price in sell_for.items():
                        if trader.lower() not in ['fence', 'flea market'] and price and price > trader_price:
                            trader_price = price
                            trader_name = trader.capitalize()

                    # Use avg24h for total value calculation
                    total_value += avg24h_price

                    # Calculate inventory slots (width * height)
                    item_slots = (item_data.get('width', 1) or 1) * (item_data.get('height', 1) or 1)

                    # Absolute screen coordinates - offset for split items
                    x_offset = item_index * item_width if num_items > 1 else 0
                    abs_x = roi['left'] + x + x_offset
                    abs_y = roi['top'] + y

                    detected_item = DetectedItem(
                        abs_x=abs_x,
                        abs_y=abs_y,
                        abs_width=item_width,
                        abs_height=h,
                        item_id=item_data['id'],
                        name=item_data['name'],
                        short_name=item_data['shortName'],
                        ocr_text=text_part,
                        match_score=score,
                        avg24h_price=avg24h_price,
                        flea_price=flea_price,
                        trader_price=trader_price,
                        trader_name=trader_name,
                        roi_x=x + x_offset,
                        roi_y=y,
                        slots=item_slots
                    )
                    detected_items.append(detected_item)
                    item_index += 1

                    logger.info(f"[GearScanner] Item {len(detected_items)}: {item_data['shortName']} "
                               f"(OCR: '{text_part}', score: {score}, slots: {item_slots}, avg24h: {avg24h_price:,}, trader: {trader_price:,})")

            # Debug boxes image saving disabled for performance
            # Uncomment below to enable debug captures:
            # timestamp = time.strftime("%Y%m%d_%H%M%S")
            # debug_boxes_path = DEBUG_FOLDER / f"gear_scan_{self.scan_counter:04d}_{timestamp}_boxes.png"
            # cv2.imwrite(str(debug_boxes_path), debug_img)
            # logger.info(f"[GearScanner] Boxes saved: {debug_boxes_path}")

        # Calculate total time
        total_time = (time.time() - start_time) * 1000

        # Log summary
        logger.info(f"[GearScanner] === Scan Complete ===")
        logger.info(f"[GearScanner] {len(detected_items)} items detected in Gear")
        logger.info(f"[GearScanner] Total Value: {total_value:,} Roubles")
        logger.info(f"[GearScanner] Timing: capture={capture_time:.0f}ms, "
                   f"ocr={ocr_time:.0f}ms, total={total_time:.0f}ms")

        # Print console summary
        print(f"\n{'='*50}")
        print(f"GEAR SCAN RESULT (OCR_WITH_REGION)")
        print(f"{'='*50}")
        print(f"Items detected: {len(detected_items)}")
        print(f"Total Value: {total_value:,} Roubles")
        print(f"Scan time: {total_time:.0f}ms")
        print(f"{'='*50}\n")

        # Calculate total trader value
        total_trader_value = sum(item.trader_price for item in detected_items)

        return {
            "success": True,
            "items": [
                {
                    "abs_x": item.abs_x,
                    "abs_y": item.abs_y,
                    "abs_width": item.abs_width,
                    "abs_height": item.abs_height,
                    "id": item.item_id,
                    "name": item.name,
                    "shortName": item.short_name,
                    "ocr_text": item.ocr_text,
                    "match_score": item.match_score,
                    "avg24hPrice": item.avg24h_price,
                    "fleaPrice": item.flea_price,
                    "traderPrice": item.trader_price,
                    "traderName": item.trader_name,
                    "roi_x": item.roi_x,
                    "roi_y": item.roi_y,
                    "slots": item.slots
                }
                for item in detected_items
            ],
            "total_value": total_value,
            "total_trader_value": total_trader_value,
            "scan_time_ms": total_time,
            "item_count": len(detected_items),
            "roi": roi
        }


# Global instance
gear_scanner = None


def get_gear_scanner(florence_engine=None) -> GearScanner:
    """Get or create the gear scanner instance."""
    global gear_scanner

    if gear_scanner is None:
        gear_scanner = GearScanner(florence_engine)
    elif florence_engine is not None and gear_scanner.florence is None:
        gear_scanner.set_florence_engine(florence_engine)

    return gear_scanner
