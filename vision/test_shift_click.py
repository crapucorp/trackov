"""
Test simple pour vérifier si Shift+Click fonctionne
Lance ce script et fais Shift+Click n'importe où sur l'écran
"""
from pynput import mouse
import ctypes

def on_click(x, y, button, pressed):
    if pressed and button == mouse.Button.left:
        VK_SHIFT = 0x10
        shift_state = ctypes.windll.user32.GetAsyncKeyState(VK_SHIFT)
        
        if shift_state & 0x8000:
            print(f"✅ Shift+Click détecté à ({x}, {y})")
        else:
            print(f"❌ Click normal à ({x}, {y}) - Shift pas pressé")

print("🧪 Test Shift+Click")
print("Fais Shift+Click n'importe où sur l'écran...")
print("Ctrl+C pour arrêter\n")

listener = mouse.Listener(on_click=on_click)
listener.start()

try:
    listener.join()
except KeyboardInterrupt:
    print("\n✅ Test terminé")
    listener.stop()
