// Overlay Window Configuration
// Creates a transparent, click-through, always-on-top overlay window

const { BrowserWindow, screen } = require('electron');
const path = require('path');

let overlayWindow = null;

/**
 * Create the transparent overlay window
 * @returns {BrowserWindow} The created overlay window
 */
function createOverlayWindow() {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
        console.log('⚠️ Overlay window already exists');
        return overlayWindow;
    }

    // Get primary display dimensions
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.bounds;

    console.log(`📐 Screen size: ${width}x${height}`);

    overlayWindow = new BrowserWindow({
        width,
        height,
        x: 0,
        y: 0,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        closable: true,
        focusable: false,
        show: false, // Start hidden
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // Make window click-through
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });

    // Set always on top level
    overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1);

    // Load the overlay HTML
    const overlayPath = path.join(__dirname, '../src/overlay.html');
    overlayWindow.loadFile(overlayPath);

    // Development: Open DevTools
    if (process.env.NODE_ENV === 'development') {
        overlayWindow.webContents.openDevTools({ mode: 'detach' });
    }

    overlayWindow.on('closed', () => {
        overlayWindow = null;
        console.log('🗑️ Overlay window closed');
    });

    console.log('✅ Overlay window created');
    return overlayWindow;
}

/**
 * Get the existing overlay window
 * @returns {BrowserWindow|null}
 */
function getOverlayWindow() {
    return overlayWindow;
}

/**
 * Destroy the overlay window
 */
function destroyOverlayWindow() {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.close();
        overlayWindow = null;
        console.log('🗑️ Overlay window destroyed');
    }
}

module.exports = { createOverlayWindow, getOverlayWindow, destroyOverlayWindow };
