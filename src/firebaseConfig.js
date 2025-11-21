// Firebase Configuration - TarkovTracker
// NOTE: Ces credentials sont publiques et safe à partager car les règles Firebase
// limitent l'accès en lecture seule sur Storage

import { initializeApp } from 'firebase/app';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';

// Firebase Configuration - TarkovTracker
const firebaseConfig = {
    apiKey: "AIzaSyAY65vpSqxPG5CAKuHKk94p6JGV_ywP-CFGY",
    authDomain: "tarkovtracker-6abe2.firebaseapp.com",
    projectId: "tarkovtracker-6abe2",
    storageBucket: "tarkovtracker-6abe2.firebasestorage.app",
    messagingSenderId: "284323599144",
    appId: "1:284323599144:web:6978e9c6Gd7d9fb5f3b61d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

// Helper function to get download URL for a file
export const getStorageFileUrl = async (filePath) => {
    const fileRef = ref(storage, filePath);
    return await getDownloadURL(fileRef);
};

// Fetch JSON data from Firebase Storage
export const fetchFirebaseData = async (fileName) => {
    try {
        const url = await getStorageFileUrl(`data/${fileName}`);
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Failed to fetch ${fileName}: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`Error fetching ${fileName} from Firebase:`, error);
        throw error;
    }
};

// Preload and cache data
export const loadGameData = async () => {
    try {
        const [tasks, hideout] = await Promise.all([
            fetchFirebaseData('tasks.json'),
            fetchFirebaseData('hideout.json')
        ]);

        return { tasks, hideout };
    } catch (error) {
        console.error('Error loading game data:', error);
        throw error;
    }
};

export { storage };
