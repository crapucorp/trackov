// IPC Handlers for Smart Scan Feature
const { ipcMain } = require('electron');
const { scanner } = require('../vision/scanner');

let overlayWindow = null;

function setOverlayWindow(window) {
    overlayWindow = window;
    console.log('✅ Overlay window reference set');
}

function registerScanHandlers(mainWindow, ovWindow) {
    // Set references
    scanner.mainWindow = mainWindow;
    overlayWindow = ovWindow;

    // Handler: Start scan
    ipcMain.handle('scan:start', async () => {
        try {
            console.log('🔵 IPC: scan:start received');
            const results = await scanner.scanScreen();

            if (overlayWindow && !overlayWindow.isDestroyed()) {
                overlayWindow.webContents.send('scan:results', results);
                console.log(`📤 Sent ${results.length} matches to overlay`);
            }

            return { success: true, matches: results };
        } catch (error) {
            console.error('❌ Scan error:', error);
            return { success: false, error: error.message };
        }
    });

    // Handler: Toggle overlay visibility
    ipcMain.handle('overlay:toggle', async (event, show) => {
        if (!overlayWindow || overlayWindow.isDestroyed()) {
            return { success: false, error: 'Overlay window not available' };
        }

        try {
            if (show) {
                overlayWindow.show();
                console.log('👁️ Overlay shown');
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
