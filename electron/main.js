const { app, BrowserWindow, ipcMain, globalShortcut, screen } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const { spawn } = require('child_process');

// Smart Scan imports
const { createOverlayWindow, getOverlayWindow } = require('./overlayWindow');
const { registerScanHandlers, setOverlayWindow } = require('./ipc-handlers');

// Path to user's Documents folder
const DOCUMENTS_PATH = path.join(os.homedir(), 'Documents', 'TarkovTracker');
const PROGRESS_FILE = path.join(DOCUMENTS_PATH, 'progress.json');

let mainWindow;
let scannerProcess = null; // Python scanner service process
let popupWindow = null; // Popup overlay for scan results

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

    // Load the React app
    const isDev = process.env.NODE_ENV === 'development';

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
    }

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
// SCANNER SERVICE MANAGEMENT
// ============================================

/**
 * Start the Python scanner service
 */
async function startScannerService() {
    const pythonScript = path.join(__dirname, '../vision/api_server.py');
    const pythonExe = process.platform === 'win32' ? 'python' : 'python3';

    console.log('🚀 Starting Python scanner service...');
    console.log(`   Script: ${pythonScript}`);

    try {
        scannerProcess = spawn(pythonExe, [pythonScript], {
            cwd: path.join(__dirname, '../vision'),
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
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

    } catch (error) {
        console.error('❌ Error starting scanner service:', error);
    }
}

/**
 * Wait for scanner service to be available
 */
async function waitForService(maxRetries = 10) {
    const SCANNER_URL = 'http://127.0.0.1:8765';

    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(SCANNER_URL);
            if (response.ok) {
                return true;
            }
        } catch (e) {
            // Service not ready yet
        }
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    throw new Error('Scanner service failed to start');
}

/**
 * Show popup overlay with scan result near cursor
 */
function showPopup(x, y, itemData) {
    // Close existing popup if any
    if (popupWindow && !popupWindow.isDestroyed()) {
        popupWindow.close();
    }

    // Create popup window
    popupWindow = new BrowserWindow({
        width: 300,
        height: 140,  // Increased for more prices
        x: x + 15,  // Offset from cursor
        y: y + 15,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // Load popup HTML
    popupWindow.loadFile(path.join(__dirname, 'overlay-popup.html'));

    // Send data to popup
    popupWindow.webContents.on('did-finish-load', () => {
        popupWindow.webContents.send('show-result', itemData);
    });

    // Handle close request from popup
    ipcMain.once('close-popup', () => {
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
    createWindow();

    // Create overlay window for Smart Scan feature
    const overlay = createOverlayWindow();
    setOverlayWindow(overlay);

    // Register scan IPC handlers WITH the windows
    registerScanHandlers(mainWindow, overlay);
    console.log('✅ Smart Scan feature initialized');

    // Start Python scanner service
    await startScannerService();

    // Register global shortcut for icon scanning (Shift+F5)
    const ret = globalShortcut.register('Shift+F5', async () => {
        console.log('🔍 Shift+F5 pressed - scanning for icon...');

        // Get cursor position
        const cursorPos = screen.getCursorScreenPoint();
        console.log(`   Cursor at: (${cursorPos.x}, ${cursorPos.y})`);

        try {
            // Call Python API to scan icon at cursor position
            const response = await fetch('http://127.0.0.1:8765/scan-icon', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ x: cursorPos.x, y: cursorPos.y })
            });

            const result = await response.json();
            console.log('📊 Scan result:', result);

            // Show result in overlay popup
            if (result.success && result.item) {
                console.log(`✅ Found: ${result.item.name} - ${result.item.price}₽`);
                showPopup(cursorPos.x, cursorPos.y, result.item);
            } else {
                console.log('❌ No item found');
            }
        } catch (error) {
            console.error('❌ Scan error:', error);
        }
    });

    if (!ret) {
        console.log('⚠️ Failed to register Shift+F5 shortcut');
    } else {
        console.log('✅ Shift+F5 shortcut registered - Press Shift+F5 to scan icons');
    }

    // Check for app updates after window is ready (in production only)
    if (process.env.NODE_ENV !== 'development') {
        setTimeout(() => {
            autoUpdater.checkForUpdates().catch(err => {
                console.log('Auto-update check failed:', err.message);
            });
        }, 3000); // Wait 3 seconds after startup
    }

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
