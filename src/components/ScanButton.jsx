import React, { useState } from 'react';
import { motion } from 'framer-motion';

const ScanButton = ({ onScanComplete }) => {
    const [scanning, setScanning] = useState(false);
    const [overlayVisible, setOverlayVisible] = useState(false);

    const handleScan = async () => {
        if (scanning) return;

        // Immediate visual feedback
        setScanning(true);
        console.log('🚀 Scan initiated...');

        try {
            // Trigger scan via Electron IPC
            const result = await window.electron.scan.start();

            if (result.success) {
                console.log(`✅ Scan complete: ${result.matches.length} items found in ${result.scanTime}ms`);

                // Show overlay
                await window.electron.scan.toggleOverlay(true);
                setOverlayVisible(true);

                // Auto-hide overlay after 15 seconds
                setTimeout(async () => {
                    await window.electron.scan.toggleOverlay(false);
                    setOverlayVisible(false);
                }, 15000);

                if (onScanComplete) {
                    onScanComplete(result.matches);
                }
            } else {
                console.error('❌ Scan failed:', result.error);
            }
        } catch (error) {
            console.error('❌ Scan error:', error);
        } finally {
            setScanning(false);
        }
    };

    const handleToggleOverlay = async () => {
        const newState = !overlayVisible;
        await window.electron.scan.toggleOverlay(newState);
        setOverlayVisible(newState);
    };

    const handleClearOverlay = async () => {
        await window.electron.scan.clearOverlay();
        await window.electron.scan.toggleOverlay(false);
        setOverlayVisible(false);
    };

    return (
        <div className="flex items-center gap-2">
            {/* Main SCAN button */}
            <motion.button
                onClick={handleScan}
                disabled={scanning}
                whileHover={{ scale: scanning ? 1 : 1.05 }}
                whileTap={{ scale: scanning ? 1 : 0.95 }}
                className={`
                    px-6 py-3 bg-cyan-500 text-black font-bold tracking-widest
                    transition-all relative overflow-hidden group
                    ${scanning ? 'opacity-50 cursor-not-allowed' : 'hover:bg-cyan-400'}
                `}
            >
                {scanning ? (
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                        <span>SCANNING...</span>
                    </div>
                ) : (
                    <span>🔍 SMART SCAN</span>
                )}

                {/* Shimmer effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            </motion.button>

            {/* Toggle Overlay button (when scan complete) */}
            {overlayVisible && (
                <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={handleToggleOverlay}
                    className="px-4 py-3 bg-cyan-900/50 border border-cyan-500/50 text-cyan-400 text-xs font-bold tracking-wider hover:bg-cyan-900 transition-colors"
                >
                    {overlayVisible ? '👁️ HIDE' : '👁️ SHOW'}
                </motion.button>
            )}

            {/* Clear button */}
            {overlayVisible && (
                <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={handleClearOverlay}
                    className="px-4 py-3 bg-red-900/50 border border-red-500/50 text-red-400 text-xs font-bold tracking-wider hover:bg-red-900 transition-colors"
                >
                    ✖ CLEAR
                </motion.button>
            )}
        </div>
    );
};

export default ScanButton;
