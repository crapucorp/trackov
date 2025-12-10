const { app, BrowserWindow, ipcMain, globalShortcut, screen } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const { spawn } = require('child_process');

// Smart Scan imports
const { createOverlayWindow, getOverlayWindow, setOverlayInteractive, startMouseTracking, stopMouseTracking, setItemBoxes, clearItemBoxes } = require('./overlayWindow');
const { registerScanHandlers, setOverlayWindow } = require('./ipc-handlers');

// Path to user's Documents folder
const DOCUMENTS_PATH = path.join(os.homedir(), 'Documents', 'TarkovTracker');
const PROGRESS_FILE = path.join(DOCUMENTS_PATH, 'progress.json');
const KEYBINDS_FILE = path.join(DOCUMENTS_PATH, 'keybinds.json');

// Default keybinds
const DEFAULT_KEYBINDS = {
    gearScan: 'F3',
    ocrScan: 'F4',
};

let loadingState = {
    isLoading: true,
    progress: 0,
    message: 'Initializing...'
};
let mainWindow;
let scannerProcess = null; // Python scanner service process
let popupWindow = null; // Popup overlay for scan results
let currentKeybinds = { ...DEFAULT_KEYBINDS }; // Current keybind configuration

// Create the main application window
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        backgroundColor: '#0a0f14',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, '../assets/icon.png'),
        titleBarStyle: 'default',
        autoHideMenuBar: true
    });

    // Load the loading screen first
    mainWindow.loadFile(path.join(__dirname, '../loading.html'));

    // DevTools disabled for production
    // mainWindow.webContents.openDevTools();

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Ensure Documents/TarkovTracker folder exists
async function ensureDocumentsFolder() {
    try {
        await fs.mkdir(DOCUMENTS_PATH, { recursive: true });
        console.log('Documents folder created/verified:', DOCUMENTS_PATH);
    } catch (error) {
        console.error('Error creating documents folder:', error);
    }
}

// IPC Handlers
ipcMain.handle('save-progress', async (event, progressData) => {
    try {
        await ensureDocumentsFolder();
        await fs.writeFile(PROGRESS_FILE, JSON.stringify(progressData, null, 2), 'utf-8');
        console.log('Progress saved to:', PROGRESS_FILE);
        return { success: true };
    } catch (error) {
        console.error('Error saving progress:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('load-progress', async () => {
    try {
        const data = await fs.readFile(PROGRESS_FILE, 'utf-8');
        console.log('Progress loaded from:', PROGRESS_FILE);
        return { success: true, data: JSON.parse(data) };
    } catch (error) {
        if (error.code === 'ENOENT') {
            // File doesn't exist yet, return empty object
            console.log('No progress file found, starting fresh');
            return { success: true, data: {} };
        }
        console.error('Error loading progress:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

ipcMain.handle('get-documents-path', () => {
    return DOCUMENTS_PATH;
});

// Handler for getting current loading state
ipcMain.handle('get-loading-state', () => {
    return loadingState;
});

// ============================================
// KEYBIND CONFIGURATION
// ============================================

// Load keybinds from file
async function loadKeybinds() {
    try {
        const data = await fs.readFile(KEYBINDS_FILE, 'utf-8');
        const saved = JSON.parse(data);
        currentKeybinds = { ...DEFAULT_KEYBINDS, ...saved };
        console.log('Keybinds loaded:', currentKeybinds);
    } catch (e) {
        if (e.code !== 'ENOENT') {
            console.error('Failed to load keybinds:', e);
        }
        currentKeybinds = { ...DEFAULT_KEYBINDS };
    }
    return currentKeybinds;
}

// Save keybinds to file
async function saveKeybinds(keybinds) {
    try {
        await ensureDocumentsFolder();
        await fs.writeFile(KEYBINDS_FILE, JSON.stringify(keybinds, null, 2), 'utf-8');
        console.log('Keybinds saved:', keybinds);
    } catch (e) {
        console.error('Failed to save keybinds:', e);
    }
}

// Handler for getting keybinds
ipcMain.handle('get-keybinds', async () => {
    return currentKeybinds;
});

// Handler for updating keybinds
ipcMain.handle('update-keybinds', async (event, keybinds) => {
    try {
        const oldKeybinds = { ...currentKeybinds };
        currentKeybinds = { ...DEFAULT_KEYBINDS, ...keybinds };
        await saveKeybinds(currentKeybinds);

        // Re-register shortcuts with new keybinds (function is set in whenReady)
        if (global.registerAllShortcuts) {
            global.registerAllShortcuts(oldKeybinds);
        }

        return { success: true };
    } catch (e) {
        console.error('Failed to update keybinds:', e);
        return { success: false, error: e.message };
    }
});

// Handler for toggling overlay interactive mode
ipcMain.handle('overlay:set-interactive', (event, interactive) => {
    setOverlayInteractive(interactive);
    return true;
});

// Handler for saving update data
ipcMain.handle('save-update-data', async (event, data, version) => {
    try {
        const dataFolder = path.join(DOCUMENTS_PATH, 'data');
        await fs.mkdir(dataFolder, { recursive: true });

        // Save tasks data
        const tasksFile = path.join(dataFolder, 'tasks.json');
        await fs.writeFile(tasksFile, JSON.stringify(data.tasks, null, 2), 'utf-8');

        // Save hideout data
        const hideoutFile = path.join(dataFolder, 'hideout.json');
        await fs.writeFile(hideoutFile, JSON.stringify(data.hideout, null, 2), 'utf-8');

        // Save version info
        const versionFile = path.join(dataFolder, 'version.txt');
        await fs.writeFile(versionFile, version, 'utf-8');

        console.log(`Update data saved (version ${version})`);
        return { success: true };
    } catch (error) {
        console.error('Error saving update data:', error);
        return { success: false, error: error.message };
    }
});

// Handler for loading update data
ipcMain.handle('load-update-data', async () => {
    try {
        const dataFolder = path.join(DOCUMENTS_PATH, 'data');

        // Check if data exists
        const tasksFile = path.join(dataFolder, 'tasks.json');
        const hideoutFile = path.join(dataFolder, 'hideout.json');
        const versionFile = path.join(dataFolder, 'version.txt');

        try {
            await fs.access(tasksFile);
            await fs.access(hideoutFile);
        } catch {
            // Files don't exist
            return { success: false, error: 'No update data found' };
        }

        // Load data
        const tasksData = await fs.readFile(tasksFile, 'utf-8');
        const hideoutData = await fs.readFile(hideoutFile, 'utf-8');

        let version = '1.0.0';
        try {
            version = await fs.readFile(versionFile, 'utf-8');
        } catch {
            // Version file doesn't exist
        }

        console.log(`Update data loaded (version ${version})`);
        return {
            success: true,
            data: {
                tasks: JSON.parse(tasksData),
                hideout: JSON.parse(hideoutData)
            },
            version: version.trim()
        };
    } catch (error) {
        console.error('Error loading update data:', error);
        return { success: false, error: error.message };
    }
});


// ============================================
// AUTO-UPDATER CONFIGURATION
// ============================================

// Configure auto-updater
autoUpdater.autoDownload = false; // Don't auto-download, ask user first
autoUpdater.autoInstallOnAppQuit = true; // Install when app closes

// Auto-updater event listeners
autoUpdater.on('checking-for-update', () => {
    console.log('🔍 Checking for application updates...');
    if (mainWindow) {
        mainWindow.webContents.send('app-update-checking');
    }
});

autoUpdater.on('update-available', (info) => {
    console.log('✨ App update available:', info.version);
    if (mainWindow) {
        mainWindow.webContents.send('app-update-available', info);
    }
});

autoUpdater.on('update-not-available', (info) => {
    console.log('✅ App is up to date');
    if (mainWindow) {
        mainWindow.webContents.send('app-update-not-available');
    }
});

autoUpdater.on('error', (err) => {
    console.error('❌ Error in auto-updater:', err);
    if (mainWindow) {
        mainWindow.webContents.send('app-update-error', err.message);
    }
});

autoUpdater.on('download-progress', (progressObj) => {
    const message = `Downloaded ${progressObj.percent.toFixed(2)}%`;
    console.log(message);
    if (mainWindow) {
        mainWindow.webContents.send('app-update-download-progress', progressObj);
    }
});

autoUpdater.on('update-downloaded', (info) => {
    console.log('✅ Update downloaded, will install on quit');
    if (mainWindow) {
        mainWindow.webContents.send('app-update-downloaded', info);
    }
});

// IPC handlers for auto-updater
ipcMain.handle('check-for-app-updates', async () => {
    try {
        const result = await autoUpdater.checkForUpdates();
        return { success: true, updateInfo: result?.updateInfo };
    } catch (error) {
        console.error('Error checking for updates:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('download-app-update', async () => {
    try {
        await autoUpdater.downloadUpdate();
        return { success: true };
    } catch (error) {
        console.error('Error downloading update:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('install-app-update', () => {
    autoUpdater.quitAndInstall(false, true);
});

// ============================================
// GITHUB UPDATE SYSTEM (For Portable Version)
// ============================================

const https = require('https');
const GITHUB_REPO = 'crapucorp/trackov';
const GITHUB_RAW_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/main`;

/**
 * Fetch JSON from URL
 */
function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

/**
 * Check for updates from GitHub
 */
ipcMain.handle('check-github-updates', async () => {
    try {
        const localPackage = require('../package.json');
        const localVersion = localPackage.version;

        // Fetch remote package.json
        const remotePackage = await fetchJSON(`${GITHUB_RAW_URL}/package.json`);
        const remoteVersion = remotePackage.version;

        console.log(`📦 Local version: ${localVersion}, Remote version: ${remoteVersion}`);

        const hasUpdate = remoteVersion !== localVersion;

        return {
            success: true,
            hasUpdate,
            localVersion,
            remoteVersion,
            updateInfo: hasUpdate ? { version: remoteVersion } : null
        };
    } catch (error) {
        console.error('Error checking GitHub updates:', error);
        return { success: false, error: error.message };
    }
});

/**
 * Download update from GitHub (runs UPDATE.bat)
 */
ipcMain.handle('download-github-update', async () => {
    try {
        const { exec } = require('child_process');
        const updateScript = path.join(__dirname, '..', 'UPDATE.bat');

        // Check if UPDATE.bat exists
        try {
            await fs.access(updateScript);
        } catch {
            return { success: false, error: 'UPDATE.bat not found' };
        }

        // Run update script
        return new Promise((resolve) => {
            exec(`start cmd /c "${updateScript}"`, { cwd: path.join(__dirname, '..') }, (error) => {
                if (error) {
                    resolve({ success: false, error: error.message });
                } else {
                    resolve({ success: true, message: 'Update script started' });
                }
            });
        });
    } catch (error) {
        console.error('Error running update:', error);
        return { success: false, error: error.message };
    }
});


// ============================================
// SCANNER SERVICE MANAGEMENT
// ============================================

/**
 * Kill any existing Python scanner processes
 */
async function killExistingPythonProcesses() {
    console.log('ðŸ§¹ Cleaning up existing Python processes...');

    try {
        if (process.platform === 'win32') {
            // Kill Python processes using port 8765
            const { execSync } = require('child_process');

            try {
                // Find PID using port 8765
                const netstatOutput = execSync('netstat -ano | findstr :8765', { encoding: 'utf-8' });
                const lines = netstatOutput.split('\n').filter(line => line.includes('LISTENING'));

                for (const line of lines) {
                    const parts = line.trim().split(/\s+/);
                    const pid = parts[parts.length - 1];

                    if (pid && !isNaN(pid)) {
                        console.log(`   Killing process ${pid} on port 8765...`);
                        execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
                    }
                }
            } catch (e) {
                // No process found on port 8765, which is fine
                console.log('   No existing processes found on port 8765');
            }

            // Also kill any scanner_api.py processes
            try {
                execSync('taskkill /F /IM python.exe /FI "WINDOWTITLE eq api_server*"', { stdio: 'ignore' });
            } catch (e) {
                // Process not found, which is fine
            }
        } else {
            // macOS/Linux
            const { execSync } = require('child_process');
            try {
                execSync('lsof -ti:8765 | xargs kill -9', { stdio: 'ignore' });
            } catch (e) {
                // No process found, which is fine
            }
        }

        // Wait a bit for processes to fully terminate
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('âœ… Cleanup complete');

    } catch (error) {
        console.log('âš ï¸ Cleanup error (non-critical):', error.message);
    }
}
/**
 * Start the Python scanner service
 */
async function startScannerService() {
    // Kill any existing Python processes first
    await killExistingPythonProcesses();

    // Determine Python path based on environment
    const isDev = process.env.NODE_ENV === 'development';
    let pythonExe;
    let pythonScript;
    let workingDir;

    if (isDev) {
        // Development: use system Python and local paths
        pythonExe = process.platform === 'win32' ? 'python' : 'python3';
        pythonScript = path.join(__dirname, '../vision/scanner_api.py');
        workingDir = path.join(__dirname, '../vision');
        console.log('🔧 Development mode: Using system Python');
    } else {
        // Production: use bundled Python and resources paths
        pythonExe = path.join(process.resourcesPath, 'python-embed', 'python.exe');
        pythonScript = path.join(process.resourcesPath, 'vision', 'scanner_api.py');
        workingDir = path.join(process.resourcesPath, 'vision');
        console.log('📦 Production mode: Using bundled Python');
        console.log(`   Python path: ${pythonExe}`);
    }

    console.log('🚀 Starting Python scanner service...');
    console.log(`   Script: ${pythonScript}`);

    try {
        scannerProcess = spawn(pythonExe, [pythonScript], {
            cwd: workingDir,
            stdio: ['ignore', 'pipe', 'pipe'],
            env: {
                ...process.env,
                PYTHONIOENCODING: 'utf-8',
                PYTHONPATH: workingDir  // Add working dir to Python path
            }
        });

        // Log output
        scannerProcess.stdout.on('data', (data) => {
            console.log(`[Scanner] ${data.toString().trim()}`);
        });

        scannerProcess.stderr.on('data', (data) => {
            console.error(`[Scanner ERROR] ${data.toString().trim()}`);
        });

        scannerProcess.on('error', (error) => {
            console.error('❌ Failed to start scanner service:', error);
            scannerProcess = null;
        });

        scannerProcess.on('exit', (code) => {
            console.log(`⚠️ Scanner service exited with code ${code}`);
            scannerProcess = null;
        });

        // Wait for service to be ready
        await waitForService();
        console.log('✅ Scanner service ready');

        // Notify renderer that scanner is ready
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('scanner-ready');

            // Redirect to React app
            const isDev = process.env.NODE_ENV === 'development';
            if (isDev) {
                mainWindow.loadURL('http://localhost:5173');
            } else {
                mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
            }
        }

    } catch (error) {
        console.error('❌ Error starting scanner service:', error);
    }
}

/**
 * Wait for scanner service to be available
 */
async function waitForService(maxRetries = 600) {
    // 600 retries * 500ms = 300 seconds (Blackwell engine needs ~100 seconds to load embeddings)
    const SCANNER_URL = 'http://127.0.0.1:8765';

    console.log('⏳ Waiting for scanner service to initialize (Blackwell engine: ~100 seconds)...');

    // Send initial loading progress
    loadingState = { isLoading: true, progress: 0, message: 'Starting scanner service...' };
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('scanner-loading-progress', loadingState);
    }

    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(SCANNER_URL);
            if (response.ok) {
                // Send 100% progress before returning
                loadingState = { isLoading: false, progress: 100, message: 'Scanner service ready!' };
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('scanner-loading-progress', loadingState);
                }
                return true;
            }
        } catch (e) {
            // Service not ready yet
        }

        // Calculate progress (0-90% during waiting, reserve 90-100% for final checks)
        const progress = Math.min(90, Math.floor((i / maxRetries) * 90));

        // Send progress update every 2 seconds
        if (i % 4 === 0) {
            loadingState = {
                isLoading: true,
                progress: progress,
                message: `Loading scanner engines... (${Math.floor(i / 2)}s elapsed)`
            };
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('scanner-loading-progress', loadingState);
            }
        }

        // Log progress every 5 seconds
        if (i > 0 && i % 10 === 0) {
            console.log(`⏳ Still waiting... (${i / 2} seconds elapsed)`);
        }

        await new Promise(resolve => setTimeout(resolve, 500));
    }

    throw new Error('Scanner service failed to start after 300 seconds');
}

// Mouse tracking for popup auto-close
let popupMouseTracker = null;
let popupInitialPos = null;

/**
 * Show popup overlay with scan result near cursor
 */
function showPopup(x, y, itemData) {
    // Close existing popup if any
    if (popupWindow && !popupWindow.isDestroyed()) {
        popupWindow.close();
    }

    // Clear any existing mouse tracker
    if (popupMouseTracker) {
        clearInterval(popupMouseTracker);
        popupMouseTracker = null;
    }

    const POPUP_WIDTH = 300;
    const POPUP_HEIGHT = 160;
    const OFFSET = 15;

    // Get screen bounds to prevent popup from going off-screen
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.bounds;

    // Calculate position - keep popup on screen
    let popupX = x + OFFSET;
    let popupY = y + OFFSET;

    // If popup would go off right edge, position it to the left of cursor
    if (popupX + POPUP_WIDTH > screenWidth) {
        popupX = x - POPUP_WIDTH - OFFSET;
    }

    // If popup would go off bottom edge, position it above cursor
    if (popupY + POPUP_HEIGHT > screenHeight) {
        popupY = y - POPUP_HEIGHT - OFFSET;
    }

    // Ensure popup stays within screen bounds
    popupX = Math.max(0, Math.min(popupX, screenWidth - POPUP_WIDTH));
    popupY = Math.max(0, Math.min(popupY, screenHeight - POPUP_HEIGHT));

    // Create popup window - focusable: false prevents stealing focus from game
    popupWindow = new BrowserWindow({
        width: POPUP_WIDTH,
        height: POPUP_HEIGHT,
        x: popupX,
        y: popupY,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        focusable: false,  // IMPORTANT: Don't steal focus from game
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // Set always on top with highest level
    popupWindow.setAlwaysOnTop(true, 'screen-saver', 1);

    // Load popup HTML
    popupWindow.loadFile(path.join(__dirname, 'overlay-popup.html'));

    // Send data to popup
    popupWindow.webContents.on('did-finish-load', () => {
        popupWindow.webContents.send('show-result', itemData);

        // Start mouse tracking AFTER popup is shown
        popupInitialPos = screen.getCursorScreenPoint();
        const MOVE_THRESHOLD = 30; // pixels - close popup if mouse moves more than this

        popupMouseTracker = setInterval(() => {
            if (!popupWindow || popupWindow.isDestroyed()) {
                clearInterval(popupMouseTracker);
                popupMouseTracker = null;
                return;
            }

            const currentPos = screen.getCursorScreenPoint();
            const dx = Math.abs(currentPos.x - popupInitialPos.x);
            const dy = Math.abs(currentPos.y - popupInitialPos.y);

            if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
                console.log('[Popup] Mouse moved - closing popup');
                popupWindow.close();
                clearInterval(popupMouseTracker);
                popupMouseTracker = null;
            }
        }, 50); // Check every 50ms
    });

    // Handle close request from popup
    ipcMain.once('close-popup', () => {
        if (popupMouseTracker) {
            clearInterval(popupMouseTracker);
            popupMouseTracker = null;
        }
        if (popupWindow && !popupWindow.isDestroyed()) {
            popupWindow.close();
        }
    });
}

/**
 * Stop the Python scanner service
 */
function stopScannerService() {
    if (scannerProcess) {
        console.log('🛑 Stopping scanner service...');
        scannerProcess.kill();
        scannerProcess = null;
    }
}


// App lifecycle
app.whenReady().then(async () => {
    await ensureDocumentsFolder();

    // Load keybinds configuration
    await loadKeybinds();

    createWindow();

    // Create overlay window for Smart Scan feature
    const overlay = createOverlayWindow();
    setOverlayWindow(overlay);

    // Register scan IPC handlers WITH the windows
    registerScanHandlers(mainWindow, overlay);
    console.log('✅ Smart Scan feature initialized');

    // Start Python scanner service
    await startScannerService();

    // ============================================
    // SHORTCUT REGISTRATION FUNCTION
    // ============================================
    // This function registers all shortcuts using currentKeybinds
    // Called on startup and when keybinds are changed

    function registerAllShortcuts(oldKeybinds = null) {
        // Unregister old shortcuts if provided
        if (oldKeybinds) {
            if (oldKeybinds.ocrScan) {
                globalShortcut.unregister(oldKeybinds.ocrScan);
            }
            if (oldKeybinds.gearScan) {
                globalShortcut.unregister(oldKeybinds.gearScan);
            }
        }

        // Register OCR scan shortcut
        if (currentKeybinds.ocrScan) {
            const retOCR = globalShortcut.register(currentKeybinds.ocrScan, ocrScanHandler);
            if (!retOCR) {
                console.log(`Failed to register ${currentKeybinds.ocrScan} shortcut (OCR Scan)`);
            } else {
                console.log(`${currentKeybinds.ocrScan} shortcut registered - OCR Scan`);
            }
        }

        // Register Gear scan shortcut
        if (currentKeybinds.gearScan) {
            const retGear = globalShortcut.register(currentKeybinds.gearScan, gearScanHandler);
            if (!retGear) {
                console.log(`Failed to register ${currentKeybinds.gearScan} shortcut (Gear Scan)`);
            } else {
                console.log(`${currentKeybinds.gearScan} shortcut registered - Gear Scan`);
            }
        }
    }

    // Make registerAllShortcuts available globally for IPC handler
    global.registerAllShortcuts = registerAllShortcuts;

    // ============================================
    // OCR SCAN HANDLER (default: F4)
    // ============================================
    async function ocrScanHandler() {
        console.log(`${currentKeybinds.ocrScan} pressed - Florence-2 OCR scan...`);

        // Get cursor position
        const cursorPos = screen.getCursorScreenPoint();
        console.log(`   Cursor at: (${cursorPos.x}, ${cursorPos.y})`);

        try {
            // Call Python API to scan with Florence-2 OCR at cursor position
            const response = await fetch('http://127.0.0.1:8765/scan-ocr', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ x: cursorPos.x, y: cursorPos.y })
            });

            const result = await response.json();
            console.log('Florence-2 OCR scan result:', result);

            // Show result in overlay popup
            if (result.success && result.item) {
                console.log(
                    `[Florence-2] Found: ${result.item.name} - ${result.item.price} RUB ` +
                    `(OCR: "${result.item.ocr_text}", ${result.item.scan_time_ms.toFixed(1)}ms)`
                );
                showPopup(cursorPos.x, cursorPos.y, result.item);
            } else {
                console.log('[Florence-2] No item found');
            }
        } catch (error) {
            console.error('[Florence-2] Scan error:', error);
        }
    }

    // ============================================
    // GEAR ZONE SCANNER (default: F3) with SCROLL AUTO-RESCAN
    // ============================================
    // Scans the entire Loadout area (Vest, Pockets, Backpack)
    // On scroll: fade out → wait 2s → auto re-scan

    let scrollListener = null;
    let rescanTimeout = null;

    async function startScrollListener(overlayWin) {
        try {
            await fetch('http://127.0.0.1:8765/scroll/start', { method: 'POST' });
            console.log('[Scroll] Listener started');
        } catch (e) {
            console.error('[Scroll] Failed to start:', e.message);
        }
    }

    async function stopScrollListener() {
        try {
            await fetch('http://127.0.0.1:8765/scroll/stop', { method: 'POST' });
            if (rescanTimeout) {
                clearTimeout(rescanTimeout);
                rescanTimeout = null;
            }
            console.log('[Scroll] Listener stopped');
        } catch (e) {
            console.error('[Scroll] Failed to stop:', e.message);
        }
    }

    // Function to do the gear scan
    async function doGearScan(overlayWin, isRescan = false) {
        try {
            const response = await fetch('http://127.0.0.1:8765/scan-gear', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const result = await response.json();

            if (result.success) {
                if (!isRescan) {
                    console.log(`[GearScanner] ${result.item_count} items detected`);
                    console.log(`[GearScanner] Total Value: ${result.total_value.toLocaleString()} Roubles`);
                    console.log(`[GearScanner] Scan time: ${result.scan_time_ms.toFixed(0)}ms`);
                } else {
                    console.log(`[GearScanner] Re-scan: ${result.item_count} items`);
                }

                // Store item boxes for hover tracking
                if (result.items && result.items.length > 0) {
                    setItemBoxes(result.items);
                }

                if (overlayWin && !overlayWin.isDestroyed()) {
                    overlayWin.webContents.send('gear-scan-result', result);
                }

                if (!isRescan && mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('gear-scan-result', result);
                }

                return true;
            }
            return false;
        } catch (error) {
            console.error('[GearScanner] Scan error:', error);
            return false;
        }
    }

    // Check for scroll and trigger fade + rescan
    function startScrollPolling(overlayWin) {
        if (scrollListener) return;

        scrollListener = setInterval(async () => {
            if (!overlayWin || overlayWin.isDestroyed() || !overlayWin.isVisible()) {
                return;
            }

            try {
                const response = await fetch('http://127.0.0.1:8765/scroll/check');
                const data = await response.json();

                if (data.scroll_detected) {
                    // Fade out labels
                    overlayWin.webContents.send('scroll-hide');

                    // Clear previous rescan timer
                    if (rescanTimeout) {
                        clearTimeout(rescanTimeout);
                    }

                    // Schedule rescan in 0.5 seconds
                    rescanTimeout = setTimeout(async () => {
                        console.log('[Scroll] 0.5s elapsed - re-scanning...');
                        await doGearScan(overlayWin, true);
                    }, 500);
                }
            } catch (e) {
                // Silent fail
            }
        }, 50);
    }

    function stopScrollPolling() {
        if (scrollListener) {
            clearInterval(scrollListener);
            scrollListener = null;
        }
        if (rescanTimeout) {
            clearTimeout(rescanTimeout);
            rescanTimeout = null;
        }
    }

    // Gear Scan Handler (default: F3)
    async function gearScanHandler() {
        console.log(`${currentKeybinds.gearScan} pressed - Gear Zone Scan...`);

        const overlayWin = getOverlayWindow();

        if (overlayWin && !overlayWin.isDestroyed()) {
            overlayWin.show();

            // Notify overlay that scan is starting
            overlayWin.webContents.send('gear-scan-start');

            const success = await doGearScan(overlayWin, false);

            if (success) {
                // Start mouse tracking for the toggle button
                startMouseTracking();

                // Start scroll detection
                await startScrollListener(overlayWin);
                startScrollPolling(overlayWin);

                // Register TAB to close overlay
                globalShortcut.register('Tab', async () => {
                    console.log('TAB pressed - Hiding overlay');
                    overlayWin.hide();
                    overlayWin.webContents.send('gear-scan-result', { success: false });
                    stopMouseTracking();
                    stopScrollPolling();
                    await stopScrollListener();
                    setOverlayInteractive(false);
                    clearItemBoxes(); // Clear hover tracking
                    globalShortcut.unregister('Tab');
                });
            }
        }
    }

    // Register all shortcuts on startup
    registerAllShortcuts();
    console.log('✅ Keybinds registered:', currentKeybinds);

    // ============================================
    // PRICE AUTO-REFRESH (Google Sheet - every 30 minutes)
    // ============================================
    const PRICE_REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes in ms

    async function refreshGSheetPrices() {
        try {
            console.log('[PRICES] Refreshing Google Sheet prices...');
            const response = await fetch('http://127.0.0.1:8765/prices/status');
            const status = await response.json();
            console.log(`[PRICES] Google Sheet: ${status.item_count} items, age: ${Math.round(status.age_seconds / 60)}min`);
        } catch (error) {
            console.error('[PRICES] Price status check error:', error.message);
        }
    }

    // Initial price check after 30 seconds
    setTimeout(() => {
        refreshGSheetPrices();
    }, 30000);

    // Schedule recurring price status check every 30 minutes
    setInterval(() => {
        refreshGSheetPrices();
    }, PRICE_REFRESH_INTERVAL);

    console.log('[PRICES] Auto-refresh enabled (Google Sheet, every 30 minutes)');

    // Auto-update disabled - User must manually check via button in UI
    // (Removed automatic update check on startup)

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    stopScannerService(); // Clean up scanner service
    globalShortcut.unregisterAll(); // Clean up shortcuts
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    stopScannerService(); // Ensure cleanup on quit
    globalShortcut.unregisterAll(); // Ensure shortcuts cleanup
});
