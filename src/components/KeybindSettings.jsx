import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard, X, RotateCcw } from 'lucide-react';

// Default keybinds
const DEFAULT_KEYBINDS = {
    gearScan: 'F3',
    ocrScan: 'F4',
};

// Load keybinds from localStorage
const loadKeybinds = () => {
    try {
        const saved = localStorage.getItem('keybinds');
        if (saved) {
            return { ...DEFAULT_KEYBINDS, ...JSON.parse(saved) };
        }
    } catch (e) {
        console.error('Failed to load keybinds:', e);
    }
    return DEFAULT_KEYBINDS;
};

// Save keybinds to localStorage
const saveKeybinds = (keybinds) => {
    try {
        localStorage.setItem('keybinds', JSON.stringify(keybinds));
    } catch (e) {
        console.error('Failed to save keybinds:', e);
    }
};

// Format key for display
const formatKey = (key) => {
    if (!key) return 'None';
    return key.replace('Key', '').replace('Digit', '');
};

const KeybindSettings = ({ isOpen, onClose }) => {
    const [keybinds, setKeybinds] = useState(loadKeybinds);
    const [listening, setListening] = useState(null); // Which keybind we're listening for
    const [error, setError] = useState(null);

    // Handle key press when listening
    const handleKeyDown = useCallback((e) => {
        if (!listening) return;

        e.preventDefault();
        e.stopPropagation();

        // Get the key
        let key = e.key;

        // Normalize key names
        if (key === ' ') key = 'Space';
        if (key.length === 1) key = key.toUpperCase();

        // Handle special keys
        if (e.code.startsWith('F') && e.code.length <= 3) {
            key = e.code; // F1-F12
        }

        // Check for modifier combinations
        let combo = '';
        if (e.ctrlKey) combo += 'Ctrl+';
        if (e.shiftKey) combo += 'Shift+';
        if (e.altKey) combo += 'Alt+';

        // Don't allow just modifiers
        if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
            return;
        }

        const finalKey = combo + key;

        // Check if already used by another action
        const otherAction = Object.entries(keybinds).find(
            ([action, k]) => action !== listening && k === finalKey
        );

        if (otherAction) {
            setError(`"${finalKey}" is already used for ${otherAction[0] === 'gearScan' ? 'Gear Scan' : 'OCR Scan'}`);
            return;
        }

        // Update keybind
        const newKeybinds = { ...keybinds, [listening]: finalKey };
        setKeybinds(newKeybinds);
        saveKeybinds(newKeybinds);
        setListening(null);
        setError(null);

        // Notify Electron to update shortcuts
        if (window.electron?.updateKeybinds) {
            window.electron.updateKeybinds(newKeybinds);
        }
    }, [listening, keybinds]);

    // Add/remove key listener
    useEffect(() => {
        if (listening) {
            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }
    }, [listening, handleKeyDown]);

    // Reset to defaults
    const resetToDefaults = () => {
        setKeybinds(DEFAULT_KEYBINDS);
        saveKeybinds(DEFAULT_KEYBINDS);
        setError(null);

        // Notify Electron
        if (window.electron?.updateKeybinds) {
            window.electron.updateKeybinds(DEFAULT_KEYBINDS);
        }
    };

    // Cancel listening on escape
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                if (listening) {
                    setListening(null);
                    setError(null);
                } else {
                    onClose();
                }
            }
        };

        if (isOpen) {
            window.addEventListener('keydown', handleEscape);
            return () => window.removeEventListener('keydown', handleEscape);
        }
    }, [isOpen, listening, onClose]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center"
                onClick={(e) => e.target === e.currentTarget && onClose()}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-slate-900 border border-cyan-500/30 rounded-lg shadow-2xl w-full max-w-md overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 bg-slate-800/50 border-b border-cyan-500/20">
                        <div className="flex items-center gap-3">
                            <Keyboard className="text-cyan-400" size={20} />
                            <h2 className="text-white font-bold text-lg">Keybind Settings</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-4">
                        {/* Gear Scan (F3) */}
                        <KeybindRow
                            label="Gear Scan"
                            description="Scan inventory items"
                            currentKey={keybinds.gearScan}
                            isListening={listening === 'gearScan'}
                            onStartListening={() => {
                                setListening('gearScan');
                                setError(null);
                            }}
                            onClear={() => {
                                const newKeybinds = { ...keybinds, gearScan: '' };
                                setKeybinds(newKeybinds);
                                saveKeybinds(newKeybinds);
                                if (window.electron?.updateKeybinds) {
                                    window.electron.updateKeybinds(newKeybinds);
                                }
                            }}
                        />

                        {/* OCR Scan (F4) */}
                        <KeybindRow
                            label="OCR Scan"
                            description="Quick scan at cursor"
                            currentKey={keybinds.ocrScan}
                            isListening={listening === 'ocrScan'}
                            onStartListening={() => {
                                setListening('ocrScan');
                                setError(null);
                            }}
                            onClear={() => {
                                const newKeybinds = { ...keybinds, ocrScan: '' };
                                setKeybinds(newKeybinds);
                                saveKeybinds(newKeybinds);
                                if (window.electron?.updateKeybinds) {
                                    window.electron.updateKeybinds(newKeybinds);
                                }
                            }}
                        />

                        {/* Error message */}
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded px-3 py-2"
                            >
                                {error}
                            </motion.div>
                        )}

                        {/* Listening indicator */}
                        {listening && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-cyan-400 text-sm text-center py-2"
                            >
                                Press any key or combination...
                                <span className="text-gray-500 block text-xs mt-1">
                                    (ESC to cancel)
                                </span>
                            </motion.div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 bg-slate-800/30 border-t border-cyan-500/10 flex justify-between">
                        <button
                            onClick={resetToDefaults}
                            className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors"
                        >
                            <RotateCcw size={14} />
                            Reset to Defaults
                        </button>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-cyan-500 text-black font-bold text-sm rounded hover:bg-cyan-400 transition-colors"
                        >
                            Done
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

// Individual keybind row
const KeybindRow = ({ label, description, currentKey, isListening, onStartListening, onClear }) => (
    <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
        <div>
            <div className="text-white font-medium">{label}</div>
            <div className="text-gray-500 text-xs">{description}</div>
        </div>
        <div className="flex items-center gap-2">
            <button
                onClick={onStartListening}
                className={`
                    min-w-[80px] px-3 py-2 rounded font-mono text-sm font-bold
                    transition-all duration-200
                    ${isListening
                        ? 'bg-cyan-500 text-black animate-pulse'
                        : 'bg-slate-700 text-white hover:bg-slate-600 border border-slate-600'
                    }
                `}
            >
                {isListening ? '...' : formatKey(currentKey) || 'None'}
            </button>
            {currentKey && !isListening && (
                <button
                    onClick={onClear}
                    className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                    title="Clear keybind"
                >
                    <X size={14} />
                </button>
            )}
        </div>
    </div>
);

export default KeybindSettings;
