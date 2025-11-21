import { fetchVersionInfo, fetchDataFile } from './firebaseConfig';

/**
 * Get current app version from downloaded data or default
 * @returns {Promise<string>} Current version
 */
export async function getCurrentVersion() {
    // Try to get version from Electron (AppData)
    if (window.electron && window.electron.loadUpdateData) {
        const result = await window.electron.loadUpdateData();
        if (result.success && result.version) {
            console.log('📌 Current version from AppData:', result.version);
            return result.version;
        }
    }

    //Try localStorage (web fallback)
    const storedVersion = localStorage.getItem('tarkovtracker_data_version');
    if (storedVersion) {
        console.log('📌 Current version from localStorage:', storedVersion);
        return storedVersion;
    }

    // Default to bundled version
    console.log('📌 Using bundled version: 1.0.0');
    return '1.0.0';
}

/**
 * Compare two version strings
 * @param {string} current - Current version (e.g., "1.0.0")
 * @param {string} latest - Latest version (e.g., "1.0.1")
 * @returns {boolean} True if latest is newer than current
 */
export function isNewerVersion(current, latest) {
    const currentParts = current.split('.').map(Number);
    const latestParts = latest.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
        if (latestParts[i] > currentParts[i]) return true;
        if (latestParts[i] < currentParts[i]) return false;
    }

    return false; // Versions are equal
}

/**
 * Check if an update is available
 * @returns {Promise<Object>} Update information or null if no update
 */
export async function checkForUpdates() {
    try {
        const currentVersion = await getCurrentVersion();
        console.log('🔍 Checking for updates... Current version:', currentVersion);

        // Fetch version info from Firebase
        const result = await fetchVersionInfo();

        if (!result.success) {
            console.warn('Could not check for updates:', result.error);
            return { available: false, error: result.error };
        }

        const latestVersion = result.data.version;
        console.log('📦 Latest version available:', latestVersion);

        // Compare versions
        if (isNewerVersion(currentVersion, latestVersion)) {
            console.log('✨ Update available!');
            return {
                available: true,
                currentVersion,
                latestVersion,
                changelog: result.data.changelog,
                files: result.data.files,
                releaseDate: result.data.releaseDate
            };
        }

        console.log('✅ App is up to date');
        return { available: false };

    } catch (error) {
        console.error('Error checking for updates:', error);
        return { available: false, error: error.message };
    }
}

/**
 * Download and save update files
 * @param {Object} updateInfo - Update information from checkForUpdates
 * @param {Function} onProgress - Progress callback (0-100)
 * @returns {Promise<Object>} Download result
 */
export async function downloadUpdate(updateInfo, onProgress = null) {
    try {
        console.log('📥 Starting download of version', updateInfo.latestVersion);

        const files = updateInfo.files;
        const totalFiles = Object.keys(files).length;
        let downloadedFiles = 0;

        const downloadedData = {};

        // Download tasks.json
        if (onProgress) onProgress(Math.round((downloadedFiles / totalFiles) * 50));
        console.log('Downloading tasks...');
        const tasksResult = await fetchDataFile(files.tasks);
        if (!tasksResult.success) {
            throw new Error(`Failed to download tasks: ${tasksResult.error}`);
        }
        downloadedData.tasks = tasksResult.data;
        downloadedFiles++;

        // Download hideout.json
        if (onProgress) onProgress(Math.round((downloadedFiles / totalFiles) * 50) + 50);
        console.log('Downloading hideout...');
        const hideoutResult = await fetchDataFile(files.hideout);
        if (!hideoutResult.success) {
            throw new Error(`Failed to download hideout: ${hideoutResult.error}`);
        }
        downloadedData.hideout = hideoutResult.data;
        downloadedFiles++;

        // Save to localStorage (in Electron, this will be handled by IPC)
        if (window.electron && window.electron.saveUpdateData) {
            // Electron environment - save to AppData
            const saveResult = await window.electron.saveUpdateData(downloadedData, updateInfo.latestVersion);
            if (!saveResult.success) {
                throw new Error('Failed to save update data');
            }
        } else {
            // Web environment - save to localStorage
            localStorage.setItem('tarkovtracker_tasks_data', JSON.stringify(downloadedData.tasks));
            localStorage.setItem('tarkovtracker_hideout_data', JSON.stringify(downloadedData.hideout));
            localStorage.setItem('tarkovtracker_data_version', updateInfo.latestVersion);
        }

        if (onProgress) onProgress(100);
        console.log('✅ Download complete!');

        return {
            success: true,
            version: updateInfo.latestVersion,
            message: 'Update downloaded successfully. Restart app to apply.'
        };

    } catch (error) {
        console.error('Download failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Load data from downloaded updates or bundled files
 * @returns {Promise<Object>} Tasks and hideout data
 */
export async function loadAppData() {
    try {
        // Check if we have downloaded data
        if (window.electron && window.electron.loadUpdateData) {
            // Electron - try to load from AppData
            const result = await window.electron.loadUpdateData();
            if (result.success && result.data) {
                console.log('📦 Loading data from AppData (version:', result.version, ')');
                return {
                    tasks: result.data.tasks,
                    hideout: result.data.hideout,
                    version: result.version,
                    source: 'downloaded'
                };
            }
        } else {
            // Web - try localStorage
            const tasksData = localStorage.getItem('tarkovtracker_tasks_data');
            const hideoutData = localStorage.getItem('tarkovtracker_hideout_data');
            const version = localStorage.getItem('tarkovtracker_data_version');

            if (tasksData && hideoutData) {
                console.log('📦 Loading data from localStorage (version:', version, ')');
                return {
                    tasks: JSON.parse(tasksData),
                    hideout: JSON.parse(hideoutData),
                    version: version || '1.0.0',
                    source: 'downloaded'
                };
            }
        }

        // Fallback to bundled data
        console.log('📦 Loading bundled data');
        const tasks = await import('../data/tasks.json');
        const hideout = await import('../data/hideout.json');

        return {
            tasks: tasks.default || tasks,
            hideout: hideout.default || hideout,
            version: '1.0.0',
            source: 'bundled'
        };

    } catch (error) {
        console.error('Error loading app data:', error);
        // Always fallback to bundled data on error
        const tasks = await import('../data/tasks.json');
        const hideout = await import('../data/hideout.json');

        return {
            tasks: tasks.default || tasks,
            hideout: hideout.default || hideout,
            version: '1.0.0',
            source: 'bundled'
        };
    }
}
