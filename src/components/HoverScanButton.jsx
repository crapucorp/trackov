import React, { useState, useEffect, useRef } from 'react';

export default function HoverScanButton() {
    const [isScanning, setIsScanning] = useState(false);
    const [itemInfo, setItemInfo] = useState(null);
    const mousePosRef = useRef({ x: 0, y: 0 });

    useEffect(() => {
        let pollInterval;

        if (isScanning) {
            // Poll for hover scan results every 150ms (Faster for instant feel)
            pollInterval = setInterval(async () => {
                try {
                    const response = await fetch('http://127.0.0.1:8765/hover/status');
                    const data = await response.json();

                    if (data.result) {
                        setItemInfo(data.result);
                        // Send to overlay
                        if (window.electronAPI && window.electronAPI.updateHoverOverlay) {
                            window.electronAPI.updateHoverOverlay({
                                item: data.result,
                                mouse: { x: mousePosRef.current.x, y: mousePosRef.current.y }
                            });
                        }
                    } else {
                        setItemInfo(null);
                        if (window.electronAPI && window.electronAPI.updateHoverOverlay) {
                            window.electronAPI.updateHoverOverlay(null);
                        }
                    }
                } catch (error) {
                    console.error('Error polling hover status:', error);
                }
            }, 150);

            // Track mouse position for tooltip
            const handleMouseMove = (e) => {
                // Update ref for polling loop
                mousePosRef.current = { x: e.screenX, y: e.screenY };
            };
            window.addEventListener('mousemove', handleMouseMove);

            return () => {
                clearInterval(pollInterval);
                window.removeEventListener('mousemove', handleMouseMove);
                // Clear overlay on unmount/stop
                if (window.electronAPI && window.electronAPI.updateHoverOverlay) {
                    window.electronAPI.updateHoverOverlay(null);
                }
            };
        }
    }, [isScanning]);

    const toggleScan = async () => {
        try {
            if (isScanning) {
                // Stop scanning
                await fetch('http://127.0.0.1:8765/hover/stop', { method: 'POST' });
                setIsScanning(false);
                setItemInfo(null);

                // Update Overlay State
                if (window.electron && window.electron.scan) {
                    if (window.electron.scan.setHoverActive) {
                        await window.electron.scan.setHoverActive(false);
                    }
                    if (window.electron.scan.updateHoverOverlay) {
                        await window.electron.scan.updateHoverOverlay(null);
                    }
                }
                console.log('Hover scan stopped');
            } else {
                // Start scanning
                await fetch('http://127.0.0.1:8765/hover/start', { method: 'POST' });
                setIsScanning(true);

                // Update Overlay State (Show Border)
                if (window.electron && window.electron.scan && window.electron.scan.setHoverActive) {
                    await window.electron.scan.setHoverActive(true);
                }
                console.log('Hover scan started');
            }
        } catch (error) {
            console.error('Error toggling hover scan:', error);
        }
    };

    return (
        <>
            <button
                onClick={toggleScan}
                title={isScanning ? "Scanner Active - Ctrl+Shift+Click on items to scan" : "Enable Quick Scan"}
                className={`px-4 py-2 rounded-lg font-semibold transition-all duration-300 ${isScanning
                    ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-lg shadow-cyan-500/50'
                    : 'bg-slate-700 text-white hover:bg-slate-600'
                    }`}
            >
                {isScanning ? '⚡ QUICK SCAN ON' : '🔍 QUICK SCAN'}
            </button>

            {/* Tooltip is now handled by the Overlay Window */}
        </>
    );
}
