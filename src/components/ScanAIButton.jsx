import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const ScanAIButton = ({ onToggle }) => {
    const [isActive, setIsActive] = useState(false);
    const [status, setStatus] = useState('stopped'); // stopped, starting, initializing, ready, error
    const [serverStatus, setServerStatus] = useState(null);

    useEffect(() => {
        // Listen for server status updates
        const handleServerStatus = (event, data) => {
            setServerStatus(data);
            if (data.running) {
                // Check if server is ready
                if (data.ready) {
                    setStatus('ready');
                } else {
                    setStatus('initializing');
                }
            } else if (data.error) {
                setStatus('error');
            }
        };

        window.electron?.ipcRenderer.on('sota-server-status', handleServerStatus);

        return () => {
            window.electron?.ipcRenderer.removeListener('sota-server-status', handleServerStatus);
        };
    }, []);

    const handleClick = async () => {
        if (!isActive) {
            // Start the AI scanner
            console.log('🔘 SCAN AI button clicked - starting scanner...');
            setStatus('starting');
            setIsActive(true);

            console.log('📡 Calling window.electron.startSOTAScanner()...');
            const result = await window.electron?.startSOTAScanner();
            console.log('📥 Result from startSOTAScanner:', result);

            if (result?.success) {
                console.log('✅ SOTA scanner started successfully');
                setStatus('initializing'); // Will be updated to 'ready' when server is ready
                onToggle?.(true);
            } else {
                console.error('❌ Failed to start SOTA scanner:', result?.error);
                setStatus('error');
                setIsActive(false);
            }
        } else {
            // Stop the AI scanner
            await window.electron?.stopSOTAScanner();
            setIsActive(false);
            setStatus('stopped');
            onToggle?.(false);
        }
    };

    const getStatusColor = () => {
        switch (status) {
            case 'ready': return '#00ff88'; // Green when ready
            case 'initializing': return '#ffaa00'; // Orange when initializing
            case 'starting': return '#ffaa00'; // Orange when starting
            case 'error': return '#ff4444'; // Red on error
            default: return '#666'; // Grey when stopped
        }
    };

    const getStatusText = () => {
        switch (status) {
            case 'ready': return 'AI READY';
            case 'initializing': return 'INITIALIZING...';
            case 'starting': return 'STARTING...';
            case 'error': return 'ERROR';
            default: return 'STOPPED';
        }
    };

    return (
        <motion.button
            onClick={handleClick}
            disabled={status === 'starting'}
            className="scan-ai-button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{
                background: isActive
                    ? `linear-gradient(135deg, ${getStatusColor()} 0%, ${getStatusColor()}88 100%)`
                    : 'linear-gradient(135deg, #1a1f2e 0%, #0f1419 100%)',
                border: `2px solid ${getStatusColor()}`,
                padding: '12px 24px',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: status === 'starting' ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                boxShadow: isActive ? `0 0 20px ${getStatusColor()}44` : 'none',
                transition: 'all 0.3s ease'
            }}
        >
            <div
                style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: getStatusColor(),
                    boxShadow: `0 0 10px ${getStatusColor()}`,
                    animation: status === 'starting' || (status === 'running' && !serverStatus?.ready)
                        ? 'pulse 1.5s infinite'
                        : 'none'
                }}
            />
            <span>
                {isActive ? getStatusText() : 'SCAN AI'}
            </span>
            {isActive && serverStatus?.ready && (
                <span style={{ fontSize: '11px', opacity: 0.7 }}>
                    (Shift+F6)
                </span>
            )}
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(1.2); }
                }
            `}</style>
        </motion.button>
    );
};

export default ScanAIButton;
