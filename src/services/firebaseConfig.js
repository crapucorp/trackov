import { initializeApp } from 'firebase/app';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAY26xpSQG5CGKuHKk94p6JGV_vyP-CfGY",
    authDomain: "tarkovtracker-6abe2.firebaseapp.com",
    projectId: "tarkovtracker-6abe2",
    storageBucket: "tarkovtracker-6abe2.firebasestorage.app",
    messagingSenderId: "284323599144",
    appId: "1:284323599144:web:6978e9c60d7d9fb5f3b61d",
    measurementId: "G-7V0YD1LL9E"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

/**
 * Fetch version.json from Firebase Storage
 * @returns {Promise<Object>} Version information
 */
export async function fetchVersionInfo() {
    try {
        const versionRef = ref(storage, 'version.json');
        const url = await getDownloadURL(versionRef);

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const versionInfo = await response.json();
        return { success: true, data: versionInfo };
    } catch (error) {
        console.error('Error fetching version info:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Fetch a data file from Firebase Storage
 * @param {string} filePath - Path to file in Firebase Storage
 * @returns {Promise<Object>} File data
 */
export async function fetchDataFile(filePath) {
    try {
        const fileRef = ref(storage, filePath);
        const url = await getDownloadURL(fileRef);

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return { success: true, data };
    } catch (error) {
        console.error(`Error fetching ${filePath}:`, error);
        return { success: false, error: error.message };
    }
}

export { storage };
