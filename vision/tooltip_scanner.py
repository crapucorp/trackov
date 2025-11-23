"""
Tooltip Scanner - Reads item name from tooltip text (like RatScanner)
Much more reliable than icon matching!
"""

import cv2
import numpy as np
from pathlib import Path
import mss
import time
import json
import pytesseract

class TooltipScanner:
    def __init__(self):
        # Load items database
        items_path = Path(__file__).parent / "tarkov_items.json"
        with open(items_path, 'r', encoding='utf-8') as f:
            self.items = json.load(f)
        
        # Create list of all item names for fuzzy matching
        self.item_names_dict = {}
        for item in self.items:
            self.item_names_dict[item['name'].lower()] = item
            self.item_names_dict[item['shortName'].lower()] = item
        
        print(f"✅ Loaded {len(self.items)} items for tooltip scanning")
        
        # Tesseract config
        import platform
        project_root = Path(__file__).parent.parent
        portable_tesseract = project_root / "tesseract-portable" / "tesseract.exe"
        
        if portable_tesseract.exists():
            pytesseract.pytesseract.tesseract_cmd = str(portable_tesseract)
            print(f"✅ Using portable Tesseract")
    
    def scan_at_position(self, x, y):
        """Scan tooltip text at cursor position"""
        print(f"🔍 Scanning tooltip at ({x}, {y})")
        
        # Tooltip appears TOP-RIGHT of cursor in Tarkov
        # Starts ~10px right, ~27px above cursor
        # Tooltip size: ~160px wide, ~20px tall
        tooltip_offset_x = 10    # Start 10px to the right
        tooltip_offset_y = -27   # Start 27px above cursor (fine-tuned)
        
        with mss.mss() as sct:
            monitor = {
                "top": y + tooltip_offset_y,      # Above cursor
                "left": x + tooltip_offset_x,     # Right of cursor  
                "width": 200,                      # Tooltip width (increased for full text)
                "height": 20                       # Tooltip height (single line)
            }
            
            screenshot = sct.grab(monitor)
            img = np.array(screenshot)
            img = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
        
        # Save debug
        debug_dir = Path(__file__).parent.parent / "debug_images"
        debug_dir.mkdir(exist_ok=True)
        timestamp = int(time.time() * 1000)
        cv2.imwrite(str(debug_dir / f"tooltip_{timestamp}.png"), img)
        
        # Preprocess for OCR
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Invert (white text → black text)
        inverted = cv2.bitwise_not(gray)
        
        # Upscale 3x for better OCR
        upscaled = cv2.resize(inverted, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC)
        
        # Enhance contrast
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        enhanced = clahe.apply(upscaled)
        
        # Apply threshold
        _, binary = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        cv2.imwrite(str(debug_dir / f"tooltip_proc_{timestamp}.png"), binary)
        
        # Try multiple OCR configs
        configs = [
            r'--oem 3 --psm 7',  # Single line
            r'--oem 3 --psm 13', # Raw line
            r'--oem 1 --psm 7',  # Legacy engine
        ]
        
        best_text = ""
        for config in configs:
            text = pytesseract.image_to_string(binary, config=config).strip()
            if len(text) > len(best_text):
                best_text = text
        
        text = best_text
        
        print(f"   📝 OCR text: '{text}'")
        print(f"   📏 Text length: {len(text)} characters")
        
        if not text:
            print("   ⚠️ No text detected by OCR")
            return None
        
        # Fuzzy match against item names
        from fuzzywuzzy import process
        all_names = list(self.item_names_dict.keys())
        
        # Get top 5 matches for debugging
        top_matches = process.extract(text.lower(), all_names, limit=5)
        print(f"   🔍 Top 5 matches:")
        for match_name, score in top_matches:
            print(f"      - {match_name}: {score}%")
        
        best_match = top_matches[0] if top_matches else None
        
        if best_match and best_match[1] >= 50:  # Lower threshold to 50%
            item_data = self.item_names_dict[best_match[0]]
            print(f"   ✅ Matched: {item_data['name']} ({best_match[1]}%)")
            print(f"   💰 Price: {item_data.get('avg24hPrice', 0)}₽")
            return {
                **item_data,
                'confidence': best_match[1],
                'ocr_text': text
            }
        
        print(f"   ❌ No good match for '{text}' (best: {best_match[1]}%)")
        return None
