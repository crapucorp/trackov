const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
    // File system operations
    saveProgress: (data) => ipcRenderer.invoke('save-progress', data),
    loadProgress: () => ipcRenderer.invoke('load-progress'),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    getDocumentsPath: () => ipcRenderer.invoke('get-documents-path'),
    getLoadingState: () => ipcRenderer.invoke('get-loading-state'),

    // Update data operations (Firebase)
    saveUpdateData: (data, version) => ipcRenderer.invoke('save-update-data', data, version),
    loadUpdateData: () => ipcRenderer.invoke('load-update-data'),

    // Keybind settings
    updateKeybinds: (keybinds) => ipcRenderer.invoke('update-keybinds', keybinds),
    getKeybinds: () => ipcRenderer.invoke('get-keybinds'),

    // Check if running in Electron
    isElectron: true,

    // App updater (electron-updater)
    appUpdater: {
        checkForUpdates: () => ipcRenderer.invoke('check-for-app-updates'),
        downloadUpdate: () => ipcRenderer.invoke('download-app-update'),
        installUpdate: () => ipcRenderer.invoke('install-app-update'),

        // Event listeners
        onChecking: (callback) => ipcRenderer.on('app-update-checking', callback),
        onAvailable: (callback) => ipcRenderer.on('app-update-available', (event, info) => callback(info)),
        onNotAvailable: (callback) => ipcRenderer.on('app-update-not-available', callback),
        onError: (callback) => ipcRenderer.on('app-update-error', (event, error) => callback(error)),
        onDownloadProgress: (callback) => ipcRenderer.on('app-update-download-progress', (event, progress) => callback(progress)),
        onDownloaded: (callback) => ipcRenderer.on('app-update-downloaded', (event, info) => callback(info)),
    },

    // GitHub updater (for portable version)
    githubUpdater: {
        checkForUpdates: () => ipcRenderer.invoke('check-github-updates'),
        downloadUpdate: () => ipcRenderer.invoke('download-github-update'),
    },

    // Smart Scan feature
    scan: {
        start: () => ipcRenderer.invoke('scan:start'),
        toggleOverlay: (show) => ipcRenderer.invoke('overlay:toggle', show),
        clearOverlay: () => ipcRenderer.invoke('overlay:clear'),
        clearScan: () => ipcRenderer.invoke('scan:clear'),
        updateHoverOverlay: (data) => ipcRenderer.invoke('update-hover-overlay', data),
        setHoverActive: (active) => ipcRenderer.invoke('hover:set-active', active), // NEW
        onScanResults: (callback) => ipcRenderer.on('scan:results', callback),
        onScanStarted: (callback) => ipcRenderer.on('scan:started', callback),
        onHoverUpdate: (callback) => ipcRenderer.on('hover-update', callback),
    },

    // Generic IPC renderer for custom events
    ipcRenderer: {
        on: (channel, callback) => {
            ipcRenderer.on(channel, (event, ...args) => callback(event, ...args));
        },
        removeListener: (channel, callback) => {
            ipcRenderer.removeListener(channel, callback);
        }
    }
});

// Separate API for overlay window (simplified)
contextBridge.exposeInMainWorld('electronAPI', {
    onScanStarted: (callback) => ipcRenderer.on('scan:started', callback),
    onScanResults: (callback) => ipcRenderer.on('scan:results', (event, matches) => callback(matches)),
    onHoverUpdate: (callback) => ipcRenderer.on('hover-update', (event, data) => callback(data)),
    onHoverStateChanged: (callback) => ipcRenderer.on('hover:active-state', (event, active) => callback(active)),
    onGearScanStart: (callback) => ipcRenderer.on('gear-scan-start', () => callback()),
    onGearScanResult: (callback) => ipcRenderer.on('gear-scan-result', (event, data) => callback(data)),
    onScrollHide: (callback) => ipcRenderer.on('scroll-hide', () => callback()),
    onItemHover: (callback) => ipcRenderer.on('item-hover', (event, index) => callback(index)),
    updateHoverOverlay: (data) => ipcRenderer.invoke('update-hover-overlay', data),
    toggleOverlay: (show) => ipcRenderer.invoke('overlay:toggle', show),
    setInteractive: (interactive) => ipcRenderer.invoke('overlay:set-interactive', interactive)
});
