import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const AppUpdater = () => {
    const [updateState, setUpdateState] = useState('idle'); // idle, checking, available, downloading, downloaded, error
    const [updateInfo, setUpdateInfo] = useState(null);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Only run in Electron
        if (!window.electron?.appUpdater) return;

        const { appUpdater } = window.electron;

        // Setup event listeners
        appUpdater.onChecking(() => {
            setUpdateState('checking');
        });

        appUpdater.onAvailable((info) => {
            setUpdateState('available');
            setUpdateInfo(info);
        });

        appUpdater.onNotAvailable(() => {
            setUpdateState('idle');
        });

        appUpdater.onError((err) => {
            setUpdateState('error');
            setError(err);
        });

        appUpdater.onDownloadProgress((progress) => {
            setUpdateState('downloading');
            setDownloadProgress(progress.percent);
        });

        appUpdater.onDownloaded((info) => {
            setUpdateState('downloaded');
            setUpdateInfo(info);
        });

        // Cleanup
        return () => {
            // Note: electron IPC doesn't have removeListener in this setup
            // Events will be cleaned up when component unmounts
        };
    }, []);

    const handleDownload = async () => {
        try {
            await window.electron.appUpdater.downloadUpdate();
        } catch (err) {
            setError(err.message);
            setUpdateState('error');
        }
    };

    const handleInstall = () => {
        window.electron.appUpdater.installUpdate();
    };

    const handleDismiss = () => {
        setUpdateState('idle');
    };

    // Don't render anything if no update needed
    if (updateState === 'idle' || updateState === 'checking') {
        return null;
    }

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -50 }}
                className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[9999] w-full max-w-2xl px-4"
            >
                <div className="bg-gradient-to-r from-cyan-900/95 to-blue-900/95 backdrop-blur-md border border-cyan-500/50 shadow-2xl shadow-cyan-500/20">
                    <div className="p-6">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center">
                                    <svg className="w-6 h-6 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">APPLICATION UPDATE</h3>
                                    <p className="text-xs text-cyan-400 font-mono">
                                        {updateState === 'available' && 'New version available'}
                                        {updateState === 'downloading' && 'Downloading update...'}
                                        {updateState === 'downloaded' && 'Update ready to install'}
                                        {updateState === 'error' && 'Update error'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleDismiss}
                                className="text-cyan-500/50 hover:text-cyan-500 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Content based on state */}
                        {updateState === 'available' && updateInfo && (
                            <div className="space-y-4">
                                <div className="bg-black/30 border border-cyan-900/50 p-4">
                                    <p className="text-sm text-cyan-100 mb-2">
                                        <span className="font-bold text-white">Version {updateInfo.version}</span> is available
                                    </p>
                                    {updateInfo.releaseNotes && (
                                        <p className="text-xs text-cyan-400/70 font-mono">
                                            {updateInfo.releaseNotes}
                                        </p>
                                    )}
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={handleDownload}
                                        className="flex-1 px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-sm tracking-wider transition-all transform hover:scale-105"
                                    >
                                        DOWNLOAD UPDATE
                                    </button>
                                    <button
                                        onClick={handleDismiss}
                                        className="px-6 py-3 border border-cyan-500/50 text-cyan-500 hover:bg-cyan-500/10 font-bold text-sm tracking-wider transition-all"
                                    >
                                        LATER
                                    </button>
                                </div>
                            </div>
                        )}

                        {updateState === 'downloading' && (
                            <div className="space-y-3">
                                <div className="flex justify-between text-xs text-cyan-400 font-bold">
                                    <span>DOWNLOADING...</span>
                                    <span>{downloadProgress.toFixed(1)}%</span>
                                </div>
                                <div className="h-2 bg-cyan-900/20 w-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${downloadProgress}%` }}
                                        transition={{ duration: 0.3 }}
                                        className="h-full bg-cyan-500 relative"
                                    >
                                        <div className="absolute inset-0 bg-white/20 animate-[shimmer_1s_infinite]"></div>
                                    </motion.div>
                                </div>
                            </div>
                        )}

                        {updateState === 'downloaded' && (
                            <div className="space-y-4">
                                <div className="bg-cyan-500/10 border border-cyan-500/30 p-4 flex items-center gap-3">
                                    <svg className="w-6 h-6 text-cyan-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="current Color">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <p className="text-sm text-cyan-100">
                                        Update downloaded successfully! Restart the app to install.
                                    </p>
                                </div>
                                <button
                                    onClick={handleInstall}
                                    className="w-full px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-sm tracking-wider transition-all transform hover:scale-105"
                                >
                                    RESTART & INSTALL NOW
                                </button>
                            </div>
                        )}

                        {updateState === 'error' && (
                            <div className="bg-red-500/10 border border-red-500/30 p-4">
                                <p className="text-sm text-red-400">
                                    Error: {error || 'Failed to check for updates'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default AppUpdater;
