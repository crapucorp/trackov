"""
Icon Recognition Scanner - Prototype with Golden Rooster
Uses template matching to identify items by their icon instead of OCR
"""

import cv2
import numpy as np
from pathlib import Path
from pynput import keyboard
import mss
import time
import json

class IconScanner:
    def __init__(self):
        # Load golden rooster template (exact reference from user)
        template_path = Path(__file__).parent.parent / "assets" / "item-icons" / "golden_rooster_ref.png"
        self.template = cv2.imread(str(template_path))
        
        if self.template is None:
            print(f"❌ Failed to load template: {template_path}")
            return
        
        # Convert template to grayscale for matching
        self.template_gray = cv2.cvtColor(self.template, cv2.COLOR_BGR2GRAY)
        self.template_h, self.template_w = self.template_gray.shape
        
        print(f"✅ Loaded template: {template_path}")
        print(f"   Size: {self.template_w}x{self.template_h}")
        
        # Load item data
        items_path = Path(__file__).parent / "tarkov_items.json"
        with open(items_path, 'r', encoding='utf-8') as f:
            items = json.load(f)
        
        # Find golden rooster
        self.rooster_data = None
        for item in items:
            if item['id'] == '5bc9bc53d4351e00367fbcee':
                self.rooster_data = item
                break
        
        print(f"✅ Item data: {self.rooster_data['name']} - {self.rooster_data['avg24hPrice']}₽")
        
        # Keyboard tracking
        self.is_running = False
        self.keyboard_listener = None
        self.last_scan_result = None
    
    def on_press(self, key):
        """Detect F5 key press"""
        try:
            if key == keyboard.Key.f5:
                print("🔍 F5 pressed - scanning for icon...")
                self.scan_for_icon()
        except AttributeError:
            pass
    
    def capture_screen_around_cursor(self, size=150):
        """Capture smaller screen area around cursor for better precision"""
        # Get current mouse position using pynput
        from pynput.mouse import Controller
        mouse_controller = Controller()
        x, y = mouse_controller.position
        half_size = size // 2
        
        with mss.mss() as sct:
            monitor = {
                "top": max(0, y - half_size),
                "left": max(0, x - half_size),
                "width": size,
                "height": size
            }
            
            screenshot = sct.grab(monitor)
            img = np.array(screenshot)
            img = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
            return img
    
    def extract_icon_from_gray_background(self, img):
        """Extract icon by detecting gray background (hovered item in Tarkov)"""
        # Convert to HSV for better color detection
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        
        # Define range for gray background (Tarkov's hover background)
        # Gray is low saturation
        lower_gray = np.array([0, 0, 60])    # Low saturation, medium-high value
        upper_gray = np.array([180, 50, 150])  # Any hue, low saturation
        
        # Create mask for gray areas
        gray_mask = cv2.inRange(hsv, lower_gray, upper_gray)
        
        # Find the largest gray region (the hovered item background)
        contours, _ = cv2.findContours(gray_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if contours:
            # Get largest contour (the item background)
            largest_contour = max(contours, key=cv2.contourArea)
            x, y, w, h = cv2.boundingRect(largest_contour)
            
            # Extract icon region with small padding
            padding = 5
            x = max(0, x - padding)
            y = max(0, y - padding)
            w = min(img.shape[1] - x, w + 2*padding)
            h = min(img.shape[0] - y, h + 2*padding)
            
            icon_region = img[y:y+h, x:x+w]
            return icon_region if icon_region.size > 0 else img
        
        return img
    
    def capture_screen_at_position(self, x, y, size=150):
        """Capture screen area around given position"""
        half_size = size // 2
        
        with mss.mss() as sct:
            monitor = {
                "top": max(0, y - half_size),
                "left": max(0, x - half_size),
                "width": size,
                "height": size
            }
            
            screenshot = sct.grab(monitor)
            img = np.array(screenshot)
            img = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
            return img
    
    def scan_at_position(self, x, y):
        """Scan for icon at specific cursor position (called from Electron)"""
        print(f"🔍 Scanning at position ({x}, {y})")
        
        # Capture larger area (200x200) to ensure we get the full icon
        img = self.capture_screen_at_position(x, y, size=200)
        
        # Save debug image
        debug_dir = Path(__file__).parent.parent / "debug_images"
        debug_dir.mkdir(exist_ok=True)
        timestamp = int(time.time() * 1000)
        cv2.imwrite(str(debug_dir / f"icon_scan_{timestamp}.png"), img)
        
        # Convert to grayscale
        img_gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Template matching - search for template in the captured image
        result = cv2.matchTemplate(img_gray, self.template_gray, cv2.TM_CCOEFF_NORMED)
        min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(result)
        
        print(f"   📊 Match confidence: {max_val * 100:.1f}%")
        print(f"   📍 Match location: {max_loc}")
        
        # Threshold 70% for good match
        if max_val >= 0.70:
            print(f"✅ FOUND Golden Rooster!")
            print(f"   Confidence: {max_val * 100:.1f}%")
            print(f"   Price: {self.rooster_data['avg24hPrice']}₽")
            
            # Draw match on debug image
            cv2.rectangle(img, max_loc, (max_loc[0] + self.template_w, max_loc[1] + self.template_h), (0, 255, 0), 2)
            cv2.imwrite(str(debug_dir / f"icon_match_{timestamp}.png"), img)
            
            return {
                **self.rooster_data,
                'confidence': int(max_val * 100)
            }
        else:
            print(f"❌ No match found (best: {max_val * 100:.1f}%)")
            return None
    
    def scan_for_icon(self):
        """Scan captured area for golden rooster icon"""
        # Capture screen (smaller area now)
        img = self.capture_screen_around_cursor(size=150)
        
        # Save debug image
        debug_dir = Path(__file__).parent.parent / "debug_images"
        debug_dir.mkdir(exist_ok=True)
        timestamp = int(time.time() * 1000)
        cv2.imwrite(str(debug_dir / f"icon_scan_{timestamp}.png"), img)
        
        # Extract icon from gray background
        icon_img = self.extract_icon_from_gray_background(img)
        cv2.imwrite(str(debug_dir / f"icon_extracted_{timestamp}.png"), icon_img)
        
        # Convert to grayscale
        img_gray = cv2.cvtColor(icon_img, cv2.COLOR_BGR2GRAY)
        
        # Template matching with multiple scales
        best_match = None
        best_val = 0
        best_scale = 1.0
        
        # Try different scales
        for scale in [0.5, 0.75, 1.0, 1.25, 1.5, 2.0]:
            # Resize template
            scaled_template = cv2.resize(
                self.template_gray,
                None,
                fx=scale,
                fy=scale,
                interpolation=cv2.INTER_CUBIC
            )
            
            # Skip if template is larger than image
            if scaled_template.shape[0] > img_gray.shape[0] or scaled_template.shape[1] > img_gray.shape[1]:
                continue
            
            # Template matching
            result = cv2.matchTemplate(img_gray, scaled_template, cv2.TM_CCOEFF_NORMED)
            min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(result)
            
            if max_val > best_val:
                best_val = max_val
                best_match = max_loc
                best_scale = scale
        
        # Threshold raised to 70% for better precision
        if best_val >= 0.70:
            print(f"✅ FOUND Golden Rooster!")
            print(f"   Confidence: {best_val * 100:.1f}%")
            print(f"   Scale: {best_scale}x")
            print(f"   Price: {self.rooster_data['avg24hPrice']}₽")
            
            self.last_scan_result = {
                **self.rooster_data,
                'confidence': int(best_val * 100),
                'scale': best_scale
            }
            
            # Draw match on debug image
            scaled_w = int(self.template_w * best_scale)
            scaled_h = int(self.template_h * best_scale)
            cv2.rectangle(icon_img, best_match, (best_match[0] + scaled_w, best_match[1] + scaled_h), (0, 255, 0), 2)
            cv2.imwrite(str(debug_dir / f"icon_match_{timestamp}.png"), icon_img)
        else:
            print(f"❌ No match found (best: {best_val * 100:.1f}%)")
            self.last_scan_result = None
    
    def start(self):
        """Start icon scanner"""
        if self.is_running:
            return
        
        print("🚀 Starting Icon Scanner...")
        print("   Press F5 to scan for Golden Rooster")
        self.is_running = True
        
        self.keyboard_listener = keyboard.Listener(on_press=self.on_press)
        self.keyboard_listener.start()
        
        print("✅ Icon scanner active - Press F5 to scan")
    
    def stop(self):
        """Stop icon scanner"""
        if not self.is_running:
            return
        
        print("🛑 Stopping scanner...")
        self.is_running = False
        
        if self.keyboard_listener:
            self.keyboard_listener.stop()
        
        self.last_scan_result = None
        print("✅ Scanner stopped")
    
    def get_result(self):
        """Get last scan result"""
        return self.last_scan_result

# Test standalone
if __name__ == "__main__":
    scanner = IconScanner()
    scanner.start()
    
    try:
        print("\nPress Ctrl+C to stop...")
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        scanner.stop()
        print("\n✅ Test complete")
