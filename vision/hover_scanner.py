"""
Hover Scanner - Real-time item detection via mouse tracking and OCR
Detects when mouse is stationary for 2+ seconds, captures tooltip zone, reads item name via OCR
"""

import time
import threading
from pathlib import Path
from typing import Optional, Dict, Tuple
import json
import cv2
import numpy as np
import pytesseract
from PIL import Image
from pynput import mouse
from fuzzywuzzy import process
import mss

class HoverScanner:
    def __init__(self, items_db_path: str = "tarkov_items.json"):
        self.items_db_path = Path(__file__).parent / items_db_path
        self.items: list = []
        self.item_names: list = []
        
        # Mouse tracking state
        self.current_pos: Tuple[int, int] = (0, 0)
        self.last_move_time: float = time.time()
        self.is_running: bool = False
        self.hover_delay: float = 2.0  # seconds
        
        #OCR scanner state
        self.last_scan_result: Optional[Dict] = None
        self.scan_cache: Dict[Tuple[int, int], Dict] = {}  # Cache results by position
        
        # Threading
        self.mouse_listener = None
        self.scanner_thread = None
        
        # Load items database
        self.load_items()
        
        # Tesseract config
        pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
        
    def load_items(self):
        """Load Tarkov items database for fuzzy matching"""
        try:
            with open(self.items_db_path, 'r', encoding='utf-8') as f:
                self.items = json.load(f)
            
            # Extract all possible names for matching
            self.item_names = []
            for item in self.items:
                self.item_names.append(item['shortName'])
                self.item_names.append(item['name'])
            
            print(f"✅ Loaded {len(self.items)} items for OCR matching")
        except Exception as e:
            print(f"❌ Error loading items database: {e}")
            self.items = []
            self.item_names = []
    
    def on_move(self, x, y):
        """Mouse move callback"""
        if abs(x - self.current_pos[0]) > 5 or abs(y - self.current_pos[1]) > 5:
            self.current_pos = (x, y)
            self.last_move_time = time.time()
    
    def capture_tooltip_zone(self) -> Optional[np.ndarray]:
        """Capture screen zone where item tooltip appears (above cursor)"""
        x, y = self.current_pos
        
        # Capture zone: 400x100px above cursor
        with mss.mss() as sct:
            monitor = {
                "top": max(0, y - 120),
                "left": max(0, x - 200),
                "width": 400,
                "height": 100
            }
            
            screenshot = sct.grab(monitor)
            img = np.array(screenshot)
            img = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
            
            return img
    
    def preprocess_for_ocr(self, img: np.ndarray) -> np.ndarray:
        """Preprocess image for better OCR accuracy"""
        # Upscale 2.5x for small text
        img = cv2.resize(img, None, fx=2.5, fy=2.5, interpolation=cv2.INTER_CUBIC)
        
        # Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Apply threshold
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        return thresh
    
    def perform_ocr(self, img: np.ndarray) -> str:
        """Extract text from image using Tesseract"""
        # Preprocess
        processed = self.preprocess_for_ocr(img)
        
        # OCR with whitelist config
        config = '--oem 3 --psm 7 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0-9-() '
        
        try:
            text = pytesseract.image_to_string(processed, config=config)
            return text.strip()
        except Exception as e:
            print(f"❌ OCR error: {e}")
            return ""
    
    def fuzzy_match_item(self, ocr_text: str, threshold: int = 70) -> Optional[Dict]:
        """Find best matching item from database using fuzzy matching"""
        if not ocr_text or not self.item_names:
            return None
        
        # Find best match
        match = process.extractOne(ocr_text, self.item_names)
        
        if match and match[1] >= threshold:
            matched_name = match[0]
            
            # Find full item data
            for item in self.items:
                if item['shortName'] == matched_name or item['name'] == matched_name:
                    return {
                        'id': item['id'],
                        'name': item['name'],
                        'shortName': item['shortName'],
                        'price': item.get('avg24hPrice', 0),
                        'width': item['width'],
                        'height': item['height'],
                        'confidence': match[1],
                        'ocr_text': ocr_text
                    }
        
        return None
    
    def scan_current_position(self):
        """Scan current mouse position for item"""
        # Check cache first
        cache_key = (self.current_pos[0] // 50, self.current_pos[1] // 50)  # Grid cache
        if cache_key in self.scan_cache:
            self.last_scan_result = self.scan_cache[cache_key]
            return
        
        # Capture and OCR
        img = self.capture_tooltip_zone()
        if img is None:
            return
        
        ocr_text = self.perform_ocr(img)
        if not ocr_text:
            self.last_scan_result = None
            return
        
        # Fuzzy match
        item = self.fuzzy_match_item(ocr_text)
        
        if item:
            print(f"🔍 Detected: {item['shortName']} ({item['confidence']}% confidence)")
            self.last_scan_result = item
            self.scan_cache[cache_key] = item
        else:
            self.last_scan_result = None
    
    def scanner_loop(self):
        """Main scanner loop - scans when mouse is stationary"""
        while self.is_running:
            time_since_move = time.time() - self.last_move_time
            
            if time_since_move >= self.hover_delay:
                # Mouse has been stationary for 2+ seconds
                self.scan_current_position()
                time.sleep(0.5)  # Wait before next scan
            else:
                time.sleep(0.1)  # Check frequently
    
    def start(self):
        """Start hover scanning"""
        if self.is_running:
            return
        
        print("🚀 Starting hover scanner...")
        self.is_running = True
        
        # Start mouse listener
        self.mouse_listener = mouse.Listener(on_move=self.on_move)
        self.mouse_listener.start()
        
        # Start scanner thread
        self.scanner_thread = threading.Thread(target=self.scanner_loop, daemon=True)
        self.scanner_thread.start()
        
        print("✅ Hover scanner active")
    
    def stop(self):
        """Stop hover scanning"""
        if not self.is_running:
            return
        
        print("🛑 Stopping hover scanner...")
        self.is_running = False
        
        if self.mouse_listener:
            self.mouse_listener.stop()
        
        # Clear cache
        self.scan_cache.clear()
        self.last_scan_result = None
        
        print("✅ Hover scanner stopped")
    
    def get_result(self) -> Optional[Dict]:
        """Get last scan result"""
        return self.last_scan_result
