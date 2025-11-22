// IPC Handlers for Smart Scan Feature
const { ipcMain } = require('electron');

let overlayWindow = null;
const SCANNER_API_URL = 'http://127.0.0.1:8765';

function setOverlayWindow(window) {
    overlayWindow = window;
    console.log('✅ Overlay window reference set');
}

function registerScanHandlers(mainWindow, ovWindow) {
    // Set references
    overlayWindow = ovWindow;
    console.log(`🎭 Overlay toggle requested: ${show ? 'SHOW' : 'HIDE'}`);

    if (!overlayWindow || overlayWindow.isDestroyed()) {
        console.error('❌ Overlay window not available');
        return { success: false, error: 'Overlay window not available' };
    }

    try {
        if (show) {
            overlayWindow.show();
            overlayWindow.focus();
            console.log('👁️ Overlay shown and focused');
        } else {
            overlayWindow.hide();
            console.log('🙈 Overlay hidden');
        }
        return { success: true };
    } catch (error) {
        console.error('❌ Overlay toggle error:', error);
        return { success: false, error: error.message };
    }
});

// Handler: Clear overlay highlights
ipcMain.handle('overlay:clear', async () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('scan:results', []);
        return { success: true };
    }
    return { success: false, error: 'Overlay not available' };
});

console.log('✅ Scan IPC handlers registered');
}

module.exports = { registerScanHandlers, setOverlayWindow };
