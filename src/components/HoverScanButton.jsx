import React, { useState, useEffect } from 'react';

export default function HoverScanButton() {
    const [isScanning, setIsScanning] = useState(false);
    const [itemInfo, setItemInfo] = useState(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    useEffect(() => {
        let pollInterval;

        if (isScanning) {
            // Poll for hover scan results every 500ms
            pollInterval = setInterval(async () => {
                try {
                    const response = await fetch('http://127.0.0.1:8765/hover/status');
                    const data = await response.json();

                    if (data.result) {
                        setItemInfo(data.result);
                    } else {
                        setItemInfo(null);
                    }
                } catch (error) {
                    console.error('Error polling hover status:', error);
                }
            }, 500);

            // Track mouse position for tooltip
            const handleMouseMove = (e) => {
                setMousePos({ x: e.clientX, y: e.clientY });
            };
            window.addEventListener('mousemove', handleMouseMove);

            return () => {
                clearInterval(pollInterval);
                window.removeEventListener('mousemove', handleMouseMove);
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
                console.log('Hover scan stopped');
            } else {
                // Start scanning
                await fetch('http://127.0.0.1:8765/hover/start', { method: 'POST' });
                setIsScanning(true);
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
                className={`px-4 py-2 rounded-lg font-semibold transition-all duration-300 ${isScanning
                        ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-lg shadow-cyan-500/50'
                        : 'bg-slate-700 text-white hover:bg-slate-600'
                    }`}
            >
                {isScanning ? '🎯 HOVER SCAN ON' : '🔍 HOVER SCAN'}
            </button>

            {/* Tooltip overlay */}
            {isScanning && itemInfo && (
                <div
                    className="fixed z-[9999] pointer-events-none"
                    style={{
                        left: `${mousePos.x + 20}px`,
                        top: `${mousePos.y + 20}px`,
                    }}
                >
                    <div className="bg-black/90 backdrop-blur-md border-2 border-cyan-500 rounded-lg p-4 shadow-2xl shadow-cyan-500/50 min-w-[250px]">
                        {/* Item Name */}
                        <div className="text-cyan-400 font-bold text-lg mb-2">
                            {itemInfo.shortName}
                        </div>

                        {/* Full Name */}
                        <div className="text-gray-300 text-sm mb-3">
                            {itemInfo.name}
                        </div>

                        {/* Price Info */}
                        {itemInfo.price > 0 && (
                            <>
                                <div className="border-t border-cyan-500/30 pt-2 mb-2" />
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400 text-sm">Avg Price:</span>
                                    <span className="text-cyan-400 font-bold">
                                        ₽ {itemInfo.price.toLocaleString()}
                                    </span>
                                </div>

                                {/* Price per slot */}
                                {itemInfo.width && itemInfo.height && (
                                    <div className="flex justify-between items-center mt-1">
                                        <span className="text-gray-400 text-sm">Per Slot:</span>
                                        <span className="text-cyan-300 text-sm">
                                            ₽ {Math.round(itemInfo.price / (itemInfo.width * itemInfo.height)).toLocaleString()}
                                        </span>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Confidence */}
                        <div className="border-t border-cyan-500/30 pt-2 mt-2">
                            <div className="text-gray-500 text-xs">
                                Confidence: {itemInfo.confidence}%
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
