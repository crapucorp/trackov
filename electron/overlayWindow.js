// Overlay Window Configuration
// Creates a transparent, click-through, always-on-top overlay window

const { BrowserWindow, screen } = require('electron');
const path = require('path');

let overlayWindow = null;
let mouseTrackingInterval = null;
let isCurrentlyInteractive = false;
let manualInteractiveMode = false; // User toggled interactive mode

// Item hover tracking
let itemBoxes = []; // Store item bounding boxes for hover detection
let currentHoveredIndex = -1; // Currently hovered item index

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
    // Load the overlay HTML
    const isDev = process.env.NODE_ENV === 'development';

    if (isDev) {
        overlayWindow.loadURL('http://localhost:5173/src/overlay.html');
        console.log('Loading overlay from dev server');
    } else {
        // In production, Vite builds to build/src/overlay.html (preserving structure)
        // or build/overlay.html depending on config. 
        // With input: { overlay: 'src/overlay.html' }, it usually keeps the structure relative to root if it's outside root?
        // Actually, let's try the most likely path.
        const overlayPath = path.join(__dirname, '../build/src/overlay.html');
        overlayWindow.loadFile(overlayPath);
        console.log('Loading overlay from build:', overlayPath);
    }

    // Development: Open DevTools
    // DevTools disabled
    // if (process.env.NODE_ENV === 'development') {
    //     overlayWindow.webContents.openDevTools({ mode: 'detach' });
    // }

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

/**
 * Toggle mouse events on the overlay window
 * @param {boolean} interactive - If true, window accepts mouse events (manual toggle)
 */
function setOverlayInteractive(interactive) {
    manualInteractiveMode = interactive;

    if (overlayWindow && !overlayWindow.isDestroyed()) {
        if (interactive) {
            // Enable mouse events - window becomes clickable
            overlayWindow.setIgnoreMouseEvents(false);
            overlayWindow.setFocusable(true);
            overlayWindow.focus();
            isCurrentlyInteractive = true;
            console.log('🖱️ Overlay: Interactive mode ON (manual)');
        } else {
            // Disable mouse events - window is click-through
            overlayWindow.setIgnoreMouseEvents(true, { forward: true });
            overlayWindow.setFocusable(false);
            isCurrentlyInteractive = false;
            console.log('🖱️ Overlay: Interactive mode OFF (manual)');
        }
    }
}

/**
 * Store item bounding boxes for hover detection
 * @param {Array} items - Array of items with box coordinates
 */
function setItemBoxes(items) {
    itemBoxes = (items || []).map((item, index) => {
        // Handle different box formats
        let x, y, width, height;
        if (item.box && Array.isArray(item.box)) {
            [x, y, width, height] = item.box;
        } else {
            x = item.abs_x ?? item.x ?? 0;
            y = item.abs_y ?? item.y ?? 0;
            width = item.abs_width ?? item.width ?? 64;
            height = item.abs_height ?? item.height ?? 64;
        }
        return { x, y, width, height, index };
    });
    currentHoveredIndex = -1;
    console.log(`🎯 Item boxes set: ${itemBoxes.length} items for hover tracking`);
}

/**
 * Clear item boxes (when overlay hides)
 */
function clearItemBoxes() {
    itemBoxes = [];
    currentHoveredIndex = -1;
}

/**
 * Start mouse tracking for the toggle button zone AND item hover
 * Enables clicks when mouse is in top-left corner (60x60px)
 * Sends hover events when mouse is over item boxes
 */
function startMouseTracking() {
    if (mouseTrackingInterval) return;

    mouseTrackingInterval = setInterval(() => {
        if (!overlayWindow || overlayWindow.isDestroyed() || !overlayWindow.isVisible()) {
            return;
        }

        const cursorPos = screen.getCursorScreenPoint();
        const windowBounds = overlayWindow.getBounds();

        // Check if cursor is in the toggle button zone (top-left 60x60)
        const isInToggleZone = (
            cursorPos.x >= windowBounds.x &&
            cursorPos.x <= windowBounds.x + 60 &&
            cursorPos.y >= windowBounds.y &&
            cursorPos.y <= windowBounds.y + 60
        );

        // Don't interfere if user manually enabled interactive mode
        if (!manualInteractiveMode) {
            if (isInToggleZone && !isCurrentlyInteractive) {
                overlayWindow.setIgnoreMouseEvents(false);
                isCurrentlyInteractive = true;
            } else if (!isInToggleZone && isCurrentlyInteractive && !manualInteractiveMode) {
                overlayWindow.setIgnoreMouseEvents(true, { forward: true });
                isCurrentlyInteractive = false;
            }
        }

        // Item hover detection (relative to screen coordinates)
        let hoveredIndex = -1;
        for (const box of itemBoxes) {
            if (
                cursorPos.x >= box.x &&
                cursorPos.x <= box.x + box.width &&
                cursorPos.y >= box.y &&
                cursorPos.y <= box.y + box.height
            ) {
                hoveredIndex = box.index;
                break;
            }
        }

        // Send hover event only when hovered item changes
        if (hoveredIndex !== currentHoveredIndex) {
            currentHoveredIndex = hoveredIndex;
            if (overlayWindow && !overlayWindow.isDestroyed()) {
                overlayWindow.webContents.send('item-hover', hoveredIndex);
            }
        }
    }, 30); // Check every 30ms for smoother hover

    console.log('🖱️ Mouse tracking started for overlay');
}

/**
 * Stop mouse tracking
 */
function stopMouseTracking() {
    if (mouseTrackingInterval) {
        clearInterval(mouseTrackingInterval);
        mouseTrackingInterval = null;
        console.log('🖱️ Mouse tracking stopped');
    }
}

module.exports = {
    createOverlayWindow,
    getOverlayWindow,
    destroyOverlayWindow,
    setOverlayInteractive,
    startMouseTracking,
    stopMouseTracking,
    setItemBoxes,
    clearItemBoxes
};
