"""Test script to verify F6 hotkey detection"""
import keyboard
import time

print("🧪 Testing F6 hotkey detection...")
print("Press F6 to test (Ctrl+C to exit)")

def on_f6():
    print("✅ F6 DETECTED!")

# Register F6 hotkey
keyboard.on_press_key('f6', lambda _: on_f6())

print("✅ F6 listener registered")
print("Waiting for F6 press...")

# Keep script running
try:
    keyboard.wait()  # Wait forever
except KeyboardInterrupt:
    print("\n❌ Test stopped")
    keyboard.unhook_all()
