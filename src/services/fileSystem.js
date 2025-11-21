// File System service for Electron
// Replaces localStorage with local file system persistence

/**
 * Check if running in Electron environment
 */
export const isElectron = () => {
    return typeof window !== 'undefined' && window.electron && window.electron.isElectron;
};

/**
 * Save user progress to local Documents folder
 * @param {Object} itemCounts - User's item counts { [itemId]: count }
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const saveProgress = async (itemCounts) => {
    if (!isElectron()) {
        // Fallback to localStorage if not in Electron
        localStorage.setItem('terragroup_item_counts', JSON.stringify(itemCounts));
        return { success: true };
    }

    try {
        const result = await window.electron.saveProgress(itemCounts);
        return result;
    } catch (error) {
        console.error('Error saving progress:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Load user progress from local Documents folder
 * @returns {Promise<{success: boolean, data?: Object,  error?: string}>}
 */
export const loadProgress = async () => {
    if (!isElectron()) {
        // Fallback to localStorage if not in Electron
        const saved = localStorage.getItem('terragroup_item_counts');
        return {
            success: true,
            data: saved ? JSON.parse(saved) : {}
        };
    }

    try {
        const result = await window.electron.loadProgress();
        return result;
    } catch (error) {
        console.error('Error loading progress:', error);
        return { success: false, error: error.message, data: {} };
    }
};

/**
 * Get app version
 * @returns {Promise<string>}
 */
export const getAppVersion = async () => {
    if (!isElectron()) {
        return '1.0.0 (Web)';
    }

    try {
        return await window.electron.getAppVersion();
    } catch (error) {
        return '1.0.0';
    }
};

/**
 * Get Documents folder path
 * @returns {Promise<string>}
 */
export const getDocumentsPath = async () => {
    if (!isElectron()) {
        return 'Browser LocalStorage';
    }

    try {
        return await window.electron.getDocumentsPath();
    } catch (error) {
        return 'Unknown';
    }
};
