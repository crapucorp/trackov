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

    // Handler: Start scan
    ipcMain.handle('scan:start', async () => {
        try {
            console.log('🔵 IPC: scan:start received');

            // Show overlay immediately (no loading indicator)
            if (overlayWindow && !overlayWindow.isDestroyed()) {
                overlayWindow.show();
                overlayWindow.focus();
                console.log('👁️ Showing overlay');
            }

            // Call Python scanner service
            const response = await fetch(`${SCANNER_API_URL}/scan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                throw new Error(`Scanner API returned ${response.status}`);
            }

            const data = await response.json();
            console.log(`✅ Scan complete in ${data.scan_time_ms.toFixed(0)}ms: ${data.matches.length} items found`);

            if (overlayWindow && !overlayWindow.isDestroyed()) {
                // Send results to overlay
                overlayWindow.webContents.send('scan:results', data.matches);
                console.log(`📤 Sent ${data.matches.length} matches to overlay`);
            } else {
                console.error('❌ Overlay window not available!');
            }

            return { success: true, matches: data.matches, scanTime: data.scan_time_ms };
        } catch (error) {
            console.error('❌ Scan error:', error);

            // Hide overlay on error
            if (overlayWindow && !overlayWindow.isDestroyed()) {
                overlayWindow.hide();
            }

            return { success: false, error: error.message };
        }
    });

    // Handler: Toggle overlay visibility
    ipcMain.handle('overlay:toggle', async (event, show) => {
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

    // Handle hover scanner updates
    ipcMain.handle('update-hover-overlay', (event, data) => {
        if (overlayWindow && !overlayWindow.isDestroyed()) {
            overlayWindow.webContents.send('hover-update', data);

            // Ensure overlay is visible and click-through
            if (data) {
                overlayWindow.showInactive();
                overlayWindow.setIgnoreMouseEvents(true, { forward: true });
            }
        }
    });

    // Handler: Set Hover Mode Active (Controls border and window visibility)
    ipcMain.handle('hover:set-active', (event, active) => {
        if (overlayWindow && !overlayWindow.isDestroyed()) {
            if (active) {
                overlayWindow.showInactive(); // Show without taking focus
                overlayWindow.setIgnoreMouseEvents(true, { forward: true }); // Click-through
            } else {
                // Only hide if we want to completely clear everything
                overlayWindow.hide();
            }
            // Tell the overlay renderer to show/hide the blue border
            overlayWindow.webContents.send('hover:active-state', active);
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
