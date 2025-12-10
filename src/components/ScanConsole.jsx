import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ScanConsole = ({ isVisible }) => {
    const [logs, setLogs] = useState([]);
    const [isMinimized, setIsMinimized] = useState(false);
    const consoleRef = useRef(null);

    useEffect(() => {
        // Listen for scan results
        const handleScanResult = (event, data) => {
            const timestamp = new Date().toLocaleTimeString();

            if (data.found) {
                const item = data.item || {};
                const log = {
                    id: Date.now() + Math.random(),
                    timestamp,
                    type: 'success',
                    message: `✓ ITEM DETECTED`,
                    details: {
                        name: item.name || 'Unknown',
                        shortName: item.shortName || '',
                        price: item.marketPrice || item.bestSell?.price || 0,
                        pricePerSlot: item.pricePerSlot || 0,
                        confidence: data.confidence ? `${(data.confidence * 100).toFixed(1)}%` : 'N/A'
                    }
                };
                setLogs(prev => [log, ...prev].slice(0, 50)); // Keep last 50 logs
            } else {
                const log = {
                    id: Date.now() + Math.random(),
                    timestamp,
                    type: 'warning',
                    message: `⚠ NO ITEM DETECTED`,
                    details: { reason: data.error || 'No highlight found' }
                };
                setLogs(prev => [log, ...prev].slice(0, 50));
            }
        };

        // Listen for server logs
        const handleServerLog = (event, data) => {
            const timestamp = new Date().toLocaleTimeString();
            const log = {
                id: Date.now() + Math.random(),
                timestamp,
                type: data.level || 'info',
                message: data.message,
                details: data.details || null
            };
            setLogs(prev => [log, ...prev].slice(0, 50));
        };

        window.electron?.ipcRenderer.on('sota-scan-result', handleScanResult);
        window.electron?.ipcRenderer.on('sota-server-log', handleServerLog);

        return () => {
            window.electron?.ipcRenderer.removeListener('sota-scan-result', handleScanResult);
            window.electron?.ipcRenderer.removeListener('sota-server-log', handleServerLog);
        };
    }, []);

    // Auto-scroll to top when new logs arrive
    useEffect(() => {
        if (consoleRef.current && !isMinimized) {
            consoleRef.current.scrollTop = 0;
        }
    }, [logs, isMinimized]);

    if (!isVisible) return null;

    const formatPrice = (price) => {
        if (!price) return '0 ₽';
        return `${price.toLocaleString()} ₽`;
    };

    const getLogColor = (type) => {
        switch (type) {
            case 'success': return '#00ff88';
            case 'warning': return '#ffaa00';
            case 'error': return '#ff4444';
            default: return '#00aaff';
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            style={{
                position: 'fixed',
                bottom: '20px',
                right: '20px',
                width: '450px',
                maxHeight: isMinimized ? '50px' : '500px',
                background: 'rgba(10, 15, 20, 0.98)',
                border: '2px solid #00ff8844',
                borderRadius: '12px',
                boxShadow: '0 8px 32px rgba(0, 255, 136, 0.2)',
                overflow: 'hidden',
                backdropFilter: 'blur(10px)',
                zIndex: 9999,
                fontFamily: 'monospace'
            }}
        >
            {/* Header */}
            <div
                style={{
                    background: 'linear-gradient(135deg, #0a0f14 0%, #1a1f2e 100%)',
                    borderBottom: '1px solid #00ff8844',
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer'
                }}
                onClick={() => setIsMinimized(!isMinimized)}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                        style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: '#00ff88',
                            boxShadow: '0 0 10px #00ff88',
                            animation: 'pulse 1.5s infinite'
                        }}
                    />
                    <span style={{ color: '#00ff88', fontSize: '13px', fontWeight: 'bold' }}>
                        SCAN AI CONSOLE
                    </span>
                    <span style={{ color: '#666', fontSize: '11px' }}>
                        ({logs.length} logs)
                    </span>
                </div>
                <div style={{ color: '#00ff88', fontSize: '16px' }}>
                    {isMinimized ? '▲' : '▼'}
                </div>
            </div>

            {/* Console Content */}
            {!isMinimized && (
                <div
                    ref={consoleRef}
                    style={{
                        maxHeight: '440px',
                        overflowY: 'auto',
                        padding: '12px',
                        fontSize: '12px',
                        color: '#aaa'
                    }}
                >
                    {logs.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666' }}>
                            <div style={{ fontSize: '14px', marginBottom: '8px' }}>
                                🎯 Prêt à scanner
                            </div>
                            <div style={{ fontSize: '11px' }}>
                                Placez votre souris sur un item et appuyez sur Shift+F6
                            </div>
                        </div>
                    ) : (
                        <AnimatePresence>
                            {logs.map((log, index) => (
                                <motion.div
                                    key={log.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    transition={{ delay: index * 0.05 }}
                                    style={{
                                        marginBottom: '12px',
                                        padding: '10px',
                                        background: 'rgba(26, 31, 46, 0.5)',
                                        borderLeft: `3px solid ${getLogColor(log.type)}`,
                                        borderRadius: '4px'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                        <span style={{ color: getLogColor(log.type), fontWeight: 'bold' }}>
                                            {log.message}
                                        </span>
                                        <span style={{ color: '#666', fontSize: '10px' }}>
                                            {log.timestamp}
                                        </span>
                                    </div>

                                    {log.details && (
                                        <div style={{ marginTop: '6px', paddingLeft: '8px', fontSize: '11px' }}>
                                            {log.details.name && (
                                                <div style={{ color: '#fff', marginBottom: '4px', fontSize: '13px' }}>
                                                    📦 {log.details.name}
                                                    {log.details.shortName && (
                                                        <span style={{ color: '#888', marginLeft: '8px' }}>
                                                            ({log.details.shortName})
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            {log.details.price !== undefined && (
                                                <div style={{ color: '#00ff88', marginBottom: '2px' }}>
                                                    💰 Prix: {formatPrice(log.details.price)}
                                                </div>
                                            )}
                                            {log.details.pricePerSlot !== undefined && log.details.pricePerSlot > 0 && (
                                                <div style={{ color: '#00aaff', marginBottom: '2px' }}>
                                                    📊 Prix/slot: {formatPrice(log.details.pricePerSlot)}
                                                </div>
                                            )}
                                            {log.details.confidence && (
                                                <div style={{ color: '#ffaa00' }}>
                                                    🎯 Confiance: {log.details.confidence}
                                                </div>
                                            )}
                                            {log.details.reason && (
                                                <div style={{ color: '#ff8844' }}>
                                                    ❌ {log.details.reason}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    )}
                </div>
            )}

            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(1.2); }
                }
            `}</style>
        </motion.div>
    );
};

export default ScanConsole;
