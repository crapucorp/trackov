"""Test script to verify debug image saving works"""
import cv2
import numpy as np
from pathlib import Path
import time

# Create test image
test_img = np.zeros((100, 300, 3), dtype=np.uint8)
cv2.putText(test_img, "TEST IMAGE", (50, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)

# Get debug directory
debug_dir = Path(__file__).parent.parent / "debug_images"
print(f"Debug directory: {debug_dir}")
print(f"Debug directory exists: {debug_dir.exists()}")

# Create directory
debug_dir.mkdir(exist_ok=True)
print(f"After mkdir - exists: {debug_dir.exists()}")

# Try to save
timestamp = int(time.time() * 1000)
test_file = debug_dir / f"test_{timestamp}.png"
print(f"Attempting to save to: {test_file}")

result = cv2.imwrite(str(test_file), test_img)
print(f"cv2.imwrite result: {result}")
print(f"File exists after save: {test_file.exists()}")

if test_file.exists():
    print(f"✅ SUCCESS! File size: {test_file.stat().st_size} bytes")
else:
    print("❌ FAILED - file was not created")

# List all files in debug_images
print(f"\nFiles in debug_images:")
for f in debug_dir.iterdir():
    print(f"  - {f.name}")
