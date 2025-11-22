"""
Fast Scanner Service for Kappa Item Detection
Uses optimized OpenCV template matching for quasi-instantaneous scanning
"""

import cv2
import numpy as np
import mss
from pathlib import Path
from typing import List, Dict, Tuple
import time
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class FastScanner:
    def __init__(self, templates_dir: str = "../assets/kappa-icons"):
        self.templates_dir = Path(__file__).parent / templates_dir
        self.templates: Dict[str, Dict] = {}
        self.confidence_threshold = 0.80  # Stricter threshold to avoid false positives
        
    def load_templates(self) -> int:
        """Load and process all template images"""
        logger.info(f"📦 Loading templates from: {self.templates_dir}")
        
        if not self.templates_dir.exists():
            logger.error(f"❌ Templates directory not found: {self.templates_dir}")
            return 0
            
        template_files = list(self.templates_dir.glob("*.webp")) + list(self.templates_dir.glob("*.png"))
        
        for template_path in template_files:
            try:
                item_id = template_path.stem
                
                # Read template in grayscale
                img = cv2.imread(str(template_path), cv2.IMREAD_GRAYSCALE)
                if img is None:
                    logger.warning(f"  ⚠️ Could not load {template_path.name}")
                    continue
                
                # Store original size
                h, w = img.shape
                
                self.templates[item_id] = {
                    'image': img,
                    'width': w,
                    'height': h
                }
                
            except Exception as e:
                logger.error(f"  ❌ Failed to load {template_path.name}: {e}")
        
        logger.info(f"✅ Loaded {len(self.templates)} templates")
        return len(self.templates)
    
    def capture_screen(self) -> Tuple[np.ndarray, int, int]:
        """Capture the primary monitor screen"""
        with mss.mss() as sct:
            monitor = sct.monitors[1]  # Primary monitor
            screenshot = sct.grab(monitor)
            
            # Convert to numpy array and then to grayscale
            img = np.array(screenshot)
            img_gray = cv2.cvtColor(img, cv2.COLOR_BGRA2GRAY)
            
            return img_gray, monitor['width'], monitor['height']
    
    def match_template(
        self, 
        screen_img: np.ndarray,
        template_img: np.ndarray,
        scale: float = 1.0
    ) -> Tuple[float, int, int, int, int]:
        """
        Match template at a specific scale
        Returns confidence, x, y, width, height
        """
        # Resize template if needed
        if scale != 1.0:
            w = int(template_img.shape[1] * scale)
            h = int(template_img.shape[0] * scale)
            if w <= 0 or h <= 0:
                return 0.0, 0, 0, 0, 0
            scaled_template = cv2.resize(template_img, (w, h), interpolation=cv2.INTER_AREA)
        else:
            scaled_template = template_img
            w, h = template_img.shape[1], template_img.shape[0]
        
        # Check if template is larger than screen
        if scaled_template.shape[0] > screen_img.shape[0] or scaled_template.shape[1] > screen_img.shape[1]:
            return 0.0, 0, 0, 0, 0
        
        # Perform template matching
        result = cv2.matchTemplate(screen_img, scaled_template, cv2.TM_CCOEFF_NORMED)
        min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(result)
        
        return max_val, max_loc[0], max_loc[1], w, h
    
    def scan(self) -> List[Dict]:
        """Perform a full screen scan for all templates"""
        start_time = time.time()
        
        # Capture screen
        logger.info("📸 Capturing screen...")
        screen_img, screen_w, screen_h = self.capture_screen()
        
        # Resize screen for faster processing (optional optimization)
        max_dimension = 1920
        if screen_w > max_dimension or screen_h > max_dimension:
            scale_factor = max_dimension / max(screen_w, screen_h)
            new_w = int(screen_w * scale_factor)
            new_h = int(screen_h * scale_factor)
            screen_img_scaled = cv2.resize(screen_img, (new_w, new_h), interpolation=cv2.INTER_AREA)
        else:
            screen_img_scaled = screen_img
            scale_factor = 1.0
        
        capture_time = time.time() - start_time
        
        # Match templates
        logger.info(f"🔍 Scanning {len(self.templates)} templates...")
        matches = []
        # 7 scales for better coverage while maintaining speed
        scales = [0.7, 0.85, 0.95, 1.0, 1.05, 1.2, 1.5]
        
        match_start = time.time()
        for item_id, template_data in self.templates.items():
            best_confidence = 0.0
            best_match = None
            
            # Find best match across all scales for THIS template
            for scale in scales:
                confidence, x, y, w, h = self.match_template(
                    screen_img_scaled, 
                    template_data['image'],
                    scale
                )
                
                if confidence > best_confidence:
                    best_confidence = confidence
                    best_match = {
                        'x': int(x / scale_factor),
                        'y': int(y / scale_factor),
                        'width': int(w / scale_factor),
                        'height': int(h / scale_factor)
                    }
                
                # Early stopping if we found a very good match
                if confidence > 0.90:  # Raised threshold for faster exit
                    break
            
            # Only add if confidence is above threshold
            # This ensures we only add ONE match per template (best scale)
            if best_confidence >= self.confidence_threshold and best_match:
                matches.append({
                    'itemId': item_id,
                    'x': best_match['x'],
                    'y': best_match['y'],
                    'width': best_match['width'],
                    'height': best_match['height'],
                    'confidence': float(best_confidence)
                })
        
        match_time = time.time() - match_start
        total_time = time.time() - start_time
        
        # Remove duplicates using better overlap detection
        unique_matches = self.remove_overlapping_detections(matches)
        
        logger.info(f"✅ Scan complete in {total_time*1000:.0f}ms (capture: {capture_time*1000:.0f}ms, match: {match_time*1000:.0f}ms)")
        logger.info(f"📊 Found {len(unique_matches)} unique items ({len(matches)} total before deduplication)")
        
        return unique_matches

    def remove_overlapping_detections(self, matches: List[Dict]) -> List[Dict]:
        """
        Remove overlapping detections using IoU (Intersection over Union)
        Keeps the detection with highest confidence when overlap is detected
        """
        if not matches:
            return []
        
        # Sort by confidence (highest first)
        sorted_matches = sorted(matches, key=lambda x: x['confidence'], reverse=True)
        
        unique = []
        
        for match in sorted_matches:
            # Check if this match overlaps significantly with any already accepted match
            is_duplicate = False
            
            for existing in unique:
                iou = self.calculate_iou(match, existing)
                
                # If IoU > 0.5 (50% overlap), consider it a duplicate - more aggressive
                if iou > 0.5:
                    is_duplicate = True
                    break
            
            if not is_duplicate:
                unique.append(match)
        
        return unique
    
    def calculate_iou(self, box1: Dict, box2: Dict) -> float:
        """
        Calculate Intersection over Union (IoU) between two bounding boxes
        """
        # Get coordinates
        x1_min = box1['x']
        y1_min = box1['y']
        x1_max = box1['x'] + box1['width']
        y1_max = box1['y'] + box1['height']
        
        x2_min = box2['x']
        y2_min = box2['y']
        x2_max = box2['x'] + box2['width']
        y2_max = box2['y'] + box2['height']
        
        # Calculate intersection
        x_inter_min = max(x1_min, x2_min)
        y_inter_min = max(y1_min, y2_min)
        x_inter_max = min(x1_max, x2_max)
        y_inter_max = min(y1_max, y2_max)
        
        if x_inter_max < x_inter_min or y_inter_max < y_inter_min:
            return 0.0  # No intersection
        
        intersection = (x_inter_max - x_inter_min) * (y_inter_max - y_inter_min)
        
        # Calculate union
        area1 = box1['width'] * box1['height']
        area2 = box2['width'] * box2['height']
        union = area1 + area2 - intersection
        
        if union == 0:
            return 0.0
        
        return intersection / union


# Standalone test
if __name__ == "__main__":
    scanner = FastScanner()
    loaded = scanner.load_templates()
    
    if loaded > 0:
        print("\n🚀 Starting test scan...")
        results = scanner.scan()
        
        print(f"\n📋 Results:")
        for match in results:
            print(f"  - {match['itemId']}: {match['confidence']:.2%} at ({match['x']}, {match['y']})")
    else:
        print("❌ No templates loaded")

