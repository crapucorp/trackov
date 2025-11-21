import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { downloadUpdate } from '../services/autoUpdate';

const UpdateNotification = ({ updateInfo, onClose, onUpdateApplied }) => {
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [downloadComplete, setDownloadComplete] = useState(false);
    const [error, setError] = useState(null);

    const handleDownload = async () => {
        setIsDownloading(true);
        setError(null);

        try {
            const result = await downloadUpdate(updateInfo, (progress) => {
                setDownloadProgress(progress);
            });

            if (result.success) {
                setDownloadComplete(true);
                setTimeout(() => {
                    if (onUpdateApplied) {
                        onUpdateApplied();
                    }
                }, 2000);
            } else {
                setError(result.error || 'Download failed');
                setIsDownloading(false);
            }
        } catch (err) {
            setError(err.message);
            setIsDownloading(false);
        }
    };

    const handleLater = () => {
        if (onClose) {
            onClose();
        }
    };

    if (!updateInfo || !updateInfo.available) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: -100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -100, opacity: 0 }}
                className="fixed top-0 left-0 right-0 z-50 flex justify-center p-4"
            >
                <div className="w-full max-w-2xl bg-[#0c1219] border border-cyan-500/50 shadow-[0_0_30px_rgba(6_182_212_0.3)] relative overflow-hidden">
                    {/* Animated scanline */}
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/10 to-transparent animate-[scan_3s_infinite_linear] pointer-events-none" />

                    <div className="relative z-10 p-6">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-cyan-500/20 border border-cyan-500 flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-cyan-400">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-cyan-400 tracking-wider">UPDATE AVAILABLE</h3>
                                    <p className="text-xs text-cyan-700 font-mono">
                                        VERSION {updateInfo.currentVersion} → {updateInfo.latestVersion}
                                    </p>
                                </div>
                            </div>

                            {!isDownloading && !downloadComplete && (
                                <button
                                    onClick={handleLater}
                                    className="text-cyan-700 hover:text-cyan-400 transition-colors"
                                    title="Close"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>

                        {/* Changelog */}
                        {updateInfo.changelog && !downloadComplete && (
                            <div className="mb-4 p-3 bg-cyan-900/10 border border-cyan-900/30">
                                <p className="text-xs text-cyan-300 font-mono">{updateInfo.changelog}</p>
                            </div>
                        )}

                        {/* Error Message */}
                        {error && (
                            <div className="mb-4 p-3 bg-red-900/20 border border-red-500/50">
                                <p className="text-xs text-red-400 font-mono">ERROR: {error}</p>
                            </div>
                        )}

                        {/* Download Complete */}
                        {downloadComplete && (
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="text-center py-4"
                            >
                                <div className="inline-flex items-center justify-center w-16 h-16 border-2 border-cyan-500 rounded-full bg-cyan-500/20 mb-3">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-8 h-8 text-cyan-400">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                    </svg>
                                </div>
                                <p className="text-cyan-400 font-bold text-sm mb-1">UPDATE DOWNLOADED</p>
                                <p className="text-cyan-700 text-xs font-mono">Reloading app with new data...</p>
                            </motion.div>
                        )}

                        {/* Progress Bar */}
                        {isDownloading && !downloadComplete && (
                            <div className="mb-4">
                                <div className="flex justify-between text-xs text-cyan-400 mb-2 font-mono">
                                    <span>DOWNLOADING...</span>
                                    <span>{downloadProgress}%</span>
                                </div>
                                <div className="h-2 bg-gray-800 overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${downloadProgress}%` }}
                                        transition={{ duration: 0.3 }}
                                        className="h-full bg-cyan-500 shadow-[0_0_10px_rgba(6_182_212_0.5)]"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Buttons */}
                        {!isDownloading && !downloadComplete && (
                            <div className="flex gap-3">
                                <button
                                    onClick={handleDownload}
                                    className="flex-1 px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-sm tracking-widest transition-all shadow-[0_0_20px_rgba(6_182_212_0.3)] hover:shadow-[0_0_30px_rgba(6_182_212_0.5)]"
                                >
                                    DOWNLOAD UPDATE
                                </button>
                                <button
                                    onClick={handleLater}
                                    className="px-6 py-3 bg-transparent border border-cyan-900 hover:border-cyan-500 text-cyan-500 font-bold text-sm tracking-widest transition-all"
                                >
                                    LATER
                                </button>
                            </div>
                        )}

                        {/* Release Date */}
                        {updateInfo.releaseDate && !downloadComplete && (
                            <p className="text-xs text-cyan-800 text-center mt-3 font-mono">
                                Released: {updateInfo.releaseDate}
                            </p>
                        )}
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default UpdateNotification;
