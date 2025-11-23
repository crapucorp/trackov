/**
 * Debug logger that sends logs to renderer process
 */

let mainWindow = null;

function setWindow(window) {
    mainWindow = window;
}

function log(level, ...args) {
    const message = args.join(' ');
    console.log(`[${level}]`, message);

    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('debug-log', {
            level,
            message,
            timestamp: new Date().toISOString()
        });
    }
}

module.exports = {
    setWindow,
    info: (...args) => log('INFO', ...args),
    error: (...args) => log('ERROR', ...args),
    warn: (...args) => log('WARN', ...args),
    success: (...args) => log('SUCCESS', ...args)
};
