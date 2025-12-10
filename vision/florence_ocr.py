"""
TarkovTracker - Florence-2 OCR Engine (LIGHT SPEED MODE)
=========================================================
Pure OCR-based item recognition using Microsoft Florence-2-large.
Reads the shortName text directly from items for 100% accuracy.

Hardware: RTX 5070 Ti (16GB VRAM) + CUDA 12.8
Speed Target: < 50ms per scan

Author: TarkovTracker Team
Date: December 2025
"""

# Disable TensorFlow to avoid NumPy 2.x conflicts
import os
os.environ['USE_TF'] = '0'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

import json
import time
import logging
import re
from pathlib import Path
from typing import Dict, Optional, Tuple

import torch
from PIL import Image

# Screen capture
try:
    import mss
    MSS_AVAILABLE = True
except ImportError:
    MSS_AVAILABLE = False

# Fuzzy matching
try:
    from rapidfuzz import process, fuzz
    RAPIDFUZZ_AVAILABLE = True
except ImportError:
    RAPIDFUZZ_AVAILABLE = False

# Florence-2
try:
    from transformers import AutoProcessor, AutoModelForCausalLM
    FLORENCE_AVAILABLE = True
except ImportError:
    FLORENCE_AVAILABLE = False

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============================================================================
# CONFIGURATION
# ============================================================================

# Model settings - Using Florence-2-base for faster inference (~40% faster than large)
MODEL_ID = "microsoft/Florence-2-base"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
DTYPE = torch.float16 if DEVICE == "cuda" else torch.float32

# Capture settings - Narrow rectangle for single item shortName only
CAPTURE_WIDTH = 70    # Narrow width to capture only one item name
CAPTURE_HEIGHT = 30   # Just one line of text height

# Matching settings
FUZZY_THRESHOLD = 75  # Minimum fuzzy match score (0-100)

# Manual fixes for common OCR misreads (OCR output -> correct shortName key)
MANUAL_FIXES = {
    "gpowder": "gunpowder",
    "6powder": "gunpowder",
    "xeno": "xeno",
    "multitool": "multi-tool",
    "rnultitool": "multi-tool",
    "firesteel": "firesteel",
    "fircsteel": "firesteel",
}

# Database paths
DB_PATH = Path(__file__).parent / "shortnames.json"
FULL_DB_PATH = Path(__file__).parent / "items_full.json"

# Debug folder for captured images
DEBUG_FOLDER = Path(__file__).parent / "debug_captures"


# ============================================================================
# FLORENCE-2 OCR ENGINE
# ============================================================================

class FlorenceOCREngine:
    """
    Ultra-fast OCR engine using Microsoft Florence-2-large.

    Reads item shortNames directly from the screen and matches
    them against the Tarkov database for instant identification.
    """

    def __init__(self):
        """Initialize the Florence-2 OCR engine."""
        self.model = None
        self.processor = None
        self.shortnames_db = {}
        self.items_db = {}
        self.shortname_keys = []

        # Statistics
        self.stats = {
            'total_scans': 0,
            'successful_matches': 0,
            'failed_matches': 0,
            'avg_scan_time_ms': 0,
            'avg_ocr_time_ms': 0,
            'avg_match_time_ms': 0
        }

        # Create debug folder for captured images
        DEBUG_FOLDER.mkdir(exist_ok=True)
        self.scan_counter = 0

        # Load model and database
        self._load_model()
        self._load_database()

    def _load_model(self):
        """Load Florence-2 model onto GPU."""
        if not FLORENCE_AVAILABLE:
            raise ImportError("transformers not installed. Run: pip install transformers")

        logger.info(f"[Florence-2] Loading {MODEL_ID} on {DEVICE}...")
        start_time = time.time()

        try:
            # Load processor
            self.processor = AutoProcessor.from_pretrained(
                MODEL_ID,
                trust_remote_code=True
            )

            # Load model with float16 for speed
            # Disable SDPA to avoid compatibility issues
            self.model = AutoModelForCausalLM.from_pretrained(
                MODEL_ID,
                torch_dtype=DTYPE,
                trust_remote_code=True,
                attn_implementation="eager"  # Disable SDPA
            ).to(DEVICE)

            # Set to eval mode
            self.model.eval()

            elapsed = time.time() - start_time
            logger.info(f"[Florence-2] Model loaded in {elapsed:.1f}s")

            if DEVICE == "cuda":
                vram = torch.cuda.memory_allocated() / 1024**3
                logger.info(f"[Florence-2] VRAM usage: {vram:.2f} GB")

        except Exception as e:
            logger.error(f"[Florence-2] Failed to load model: {e}")
            raise

    def _load_database(self):
        """Load shortnames database for matching."""
        logger.info("[Florence-2] Loading shortnames database...")

        if not DB_PATH.exists():
            raise FileNotFoundError(f"Database not found: {DB_PATH}. Run build_db.py first.")

        with open(DB_PATH, 'r', encoding='utf-8') as f:
            self.shortnames_db = json.load(f)

        self.shortname_keys = list(self.shortnames_db.keys())

        # Also load full database for price info
        if FULL_DB_PATH.exists():
            with open(FULL_DB_PATH, 'r', encoding='utf-8') as f:
                self.items_db = json.load(f)

        logger.info(f"[Florence-2] Loaded {len(self.shortnames_db)} shortnames")

    def _capture_text_region(self, x: int, y: int) -> Optional[Image.Image]:
        """
        Capture the text region above the item.

        Args:
            x: Cursor X position
            y: Cursor Y position

        Returns:
            PIL Image of the text region or None if capture fails
        """
        if not MSS_AVAILABLE:
            raise ImportError("mss not installed. Run: pip install mss")

        try:
            # Narrow capture zone - centered exactly on cursor position
            capture_left = int(x - (CAPTURE_WIDTH / 2))   # Center horizontally on cursor
            capture_top = int(y - (CAPTURE_HEIGHT / 2))   # Center vertically on cursor

            # Ensure positive coordinates
            capture_left = max(0, capture_left)
            capture_top = max(0, capture_top)

            print(f"[DEBUG CAPTURE] Region: left={capture_left}, top={capture_top}, {CAPTURE_WIDTH}x{CAPTURE_HEIGHT}")

            with mss.mss() as sct:
                monitor = {
                    "left": capture_left,
                    "top": capture_top,
                    "width": CAPTURE_WIDTH,
                    "height": CAPTURE_HEIGHT
                }
                screenshot = sct.grab(monitor)

                if screenshot is None or screenshot.size[0] == 0 or screenshot.size[1] == 0:
                    logger.error("[Florence-2] Screenshot is empty or invalid")
                    return None

                return Image.frombytes('RGB', screenshot.size, screenshot.rgb)
        except Exception as e:
            logger.error(f"[Florence-2] Capture error: {e}")
            return None

    def _run_ocr(self, image: Image.Image) -> str:
        """
        Run Florence-2 OCR on the image.

        Args:
            image: PIL Image to process

        Returns:
            Extracted text string
        """
        # Prepare inputs with OCR prompt
        prompt = "<OCR>"

        inputs = self.processor(
            text=prompt,
            images=image,
            return_tensors="pt"
        ).to(DEVICE, DTYPE)

        # Generate with no grad for speed
        with torch.no_grad():
            generated_ids = self.model.generate(
                input_ids=inputs["input_ids"],
                pixel_values=inputs["pixel_values"],
                max_new_tokens=50,
                num_beams=1,  # Greedy decoding for speed
                do_sample=False,
                use_cache=False  # Required for Florence-2 compatibility
            )

        # Decode output
        generated_text = self.processor.batch_decode(
            generated_ids,
            skip_special_tokens=True
        )[0]

        # Clean up the output (remove prompt echo if present)
        if generated_text.startswith(prompt):
            generated_text = generated_text[len(prompt):]

        return generated_text.strip()

    def _normalize_text(self, text: str) -> str:
        """Normalize text for matching - keep only alphanumeric and hyphen."""
        # Lowercase and strip
        normalized = text.lower().strip()
        # Keep only a-z, 0-9, and hyphen (for items like "multi-tool")
        normalized = re.sub(r'[^a-z0-9\-]', '', normalized)
        return normalized

    def _fuzzy_match_single(self, text: str) -> Optional[Tuple[str, int]]:
        """
        Fuzzy match a single line of text.

        Args:
            text: Single line of text to match

        Returns:
            Tuple of (matched_key, score) or None
        """
        normalized = self._normalize_text(text)

        if not normalized:
            return None

        # Check manual fixes first (alias mapping)
        if normalized in MANUAL_FIXES:
            fixed = MANUAL_FIXES[normalized]
            print(f"[DEBUG MATCH] Alias applied: '{normalized}' -> '{fixed}'")
            normalized = fixed

        # Check exact match in database
        if normalized in self.shortnames_db:
            return (normalized, 100)

        if not RAPIDFUZZ_AVAILABLE:
            return None

        # Use rapidfuzz for fuzzy matching
        result = process.extractOne(
            normalized,
            self.shortname_keys,
            scorer=fuzz.ratio,
            score_cutoff=FUZZY_THRESHOLD
        )

        if result:
            matched_key, score, _ = result
            return (matched_key, score)

        return None

    def _fuzzy_match(self, ocr_text: str) -> Optional[Tuple[str, int]]:
        """
        Find the best matching shortname using Best Line Match strategy.

        If OCR returns multiple lines (shadow + real text), test each line
        separately and return the best match.

        Args:
            ocr_text: Text extracted by OCR (may contain newlines)

        Returns:
            Tuple of (matched_key, score) or None
        """
        # Split into lines if multiline
        lines = ocr_text.split('\n') if '\n' in ocr_text else [ocr_text]

        best_match = None
        best_score = 0

        for line in lines:
            line = line.strip()
            if not line:
                continue

            normalized = self._normalize_text(line)
            print(f"[DEBUG MATCH] Testing line: '{line}' -> normalized: '{normalized}'")

            result = self._fuzzy_match_single(line)

            if result:
                matched_key, score = result
                print(f"[DEBUG MATCH] Line '{normalized}' matched '{matched_key}' with score {score}")

                if score > best_score:
                    best_score = score
                    best_match = (matched_key, score)

        if best_match:
            print(f"[DEBUG MATCH] Best match: '{best_match[0]}' with score {best_match[1]}")

        return best_match

    def scan_at_cursor(self, x: int, y: int) -> Optional[Dict]:
        """
        Scan for item at cursor position using OCR.

        Args:
            x: Cursor X position
            y: Cursor Y position

        Returns:
            Dict with item info or None
        """
        start_time = time.time()
        self.stats['total_scans'] += 1

        try:
            # STEP 1: Capture text region
            image = self._capture_text_region(x, y)

            if image is None:
                logger.warning("[Florence-2] Failed to capture screen region")
                self.stats['failed_matches'] += 1
                return None

            # STEP 2: Run OCR
            ocr_start = time.time()
            ocr_text = self._run_ocr(image)
            ocr_time = (time.time() - ocr_start) * 1000

            # Debug: Show exactly what OCR read (raw and cleaned)
            clean_text = ocr_text.strip().lower() if ocr_text else ""
            print(f"[DEBUG OCR] RAW: '{ocr_text}' | CLEAN: '{clean_text}'")

            # Save debug image
            self.scan_counter += 1
            timestamp = time.strftime("%Y%m%d_%H%M%S")
            debug_filename = f"scan_{self.scan_counter:04d}_{timestamp}_x{x}_y{y}.png"
            debug_path = DEBUG_FOLDER / debug_filename
            image.save(debug_path)
            logger.info(f"[Florence-2] Debug image saved: {debug_path}")

            logger.info(f"[Florence-2] OCR result: '{ocr_text}' ({ocr_time:.1f}ms)")

            if not ocr_text:
                self.stats['failed_matches'] += 1
                return None

            # STEP 3: Fuzzy match against database
            match_start = time.time()
            match_result = self._fuzzy_match(ocr_text)
            match_time = (time.time() - match_start) * 1000

            if not match_result:
                logger.info(f"[Florence-2] No match found for '{ocr_text}'")
                self.stats['failed_matches'] += 1
                return None

            matched_key, score = match_result
            item_data = self.shortnames_db[matched_key]

            # Calculate total time
            total_time = (time.time() - start_time) * 1000

            # Update stats
            self.stats['successful_matches'] += 1
            n = self.stats['successful_matches']
            self.stats['avg_scan_time_ms'] = (
                (self.stats['avg_scan_time_ms'] * (n - 1) + total_time) / n
            )
            self.stats['avg_ocr_time_ms'] = (
                (self.stats['avg_ocr_time_ms'] * (n - 1) + ocr_time) / n
            )
            self.stats['avg_match_time_ms'] = (
                (self.stats['avg_match_time_ms'] * (n - 1) + match_time) / n
            )

            logger.info(
                f"[Florence-2] Match: {item_data['shortName']} "
                f"(score: {score}, time: {total_time:.1f}ms)"
            )

            # Build result
            return {
                'id': item_data['id'],
                'name': item_data['name'],
                'shortName': item_data['shortName'],
                'ocr_text': ocr_text,
                'match_score': score,
                'basePrice': item_data.get('basePrice', 0),
                'avg24hPrice': item_data.get('avg24hPrice', 0),
                'sellFor': item_data.get('sellFor', {}),
                'scan_time_ms': total_time,
                'ocr_time_ms': ocr_time,
                'match_time_ms': match_time
            }

        except Exception as e:
            logger.error(f"[Florence-2] Scan error: {e}")
            self.stats['failed_matches'] += 1
            return None

    def get_stats(self) -> Dict:
        """Get engine statistics."""
        return {
            **self.stats,
            'model': MODEL_ID,
            'device': DEVICE,
            'dtype': str(DTYPE),
            'database_size': len(self.shortnames_db)
        }


# ============================================================================
# MAIN - Testing
# ============================================================================

if __name__ == "__main__":
    print("=" * 60)
    print("TarkovTracker - Florence-2 OCR Engine (LIGHT SPEED)")
    print("=" * 60)

    try:
        engine = FlorenceOCREngine()
        print(f"\n[OK] Engine ready with {len(engine.shortnames_db)} shortnames")

        print("\nMove your mouse over an item and press Enter to scan...")

        import pyautogui

        while True:
            input("\nPress Enter to scan at cursor position...")
            x, y = pyautogui.position()
            print(f"Scanning at ({x}, {y})...")

            result = engine.scan_at_cursor(x, y)

            if result:
                print(f"\n[FOUND] {result['name']}")
                print(f"   ShortName: {result['shortName']}")
                print(f"   OCR Text: '{result['ocr_text']}'")
                print(f"   Match Score: {result['match_score']}%")
                print(f"   Price: {result['avg24hPrice']} RUB")
                print(f"   Scan Time: {result['scan_time_ms']:.1f}ms")
            else:
                print("[NOT FOUND] No item detected")

    except KeyboardInterrupt:
        print("\n\nExiting...")
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
