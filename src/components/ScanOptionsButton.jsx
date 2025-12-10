import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, ChevronDown, Circle, Tag } from 'lucide-react';

// Default scan options
const DEFAULT_OPTIONS = {
    showGlowOrbs: true,
    showPriceTags: false,
    priceTagStyle: 'colored', // 'colored' or 'badge'
};

// Load options from localStorage
const loadOptions = () => {
    try {
        const saved = localStorage.getItem('scanOptions');
        if (saved) {
            return { ...DEFAULT_OPTIONS, ...JSON.parse(saved) };
        }
    } catch (e) {
        console.error('Failed to load scan options:', e);
    }
    return DEFAULT_OPTIONS;
};

// Save options to localStorage
const saveOptions = (options) => {
    try {
        localStorage.setItem('scanOptions', JSON.stringify(options));
    } catch (e) {
        console.error('Failed to save scan options:', e);
    }
};

const ScanOptionsButton = ({ onOptionsChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState(loadOptions);
    const dropdownRef = useRef(null);

    // Notify parent of options changes
    useEffect(() => {
        onOptionsChange?.(options);
    }, [options, onOptionsChange]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const updateOption = (key, value) => {
        const newOptions = { ...options, [key]: value };
        setOptions(newOptions);
        saveOptions(newOptions);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Main Button */}
            <motion.button
                onClick={() => setIsOpen(!isOpen)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`
                    px-4 py-2.5 flex items-center gap-2
                    bg-gradient-to-r from-slate-800 to-slate-900
                    border border-cyan-500/50 rounded
                    text-cyan-400 font-bold text-sm tracking-wider
                    hover:border-cyan-400 hover:text-cyan-300
                    transition-all duration-200
                    ${isOpen ? 'border-cyan-400 bg-slate-800' : ''}
                `}
            >
                <Settings size={16} />
                <span>SCAN OPTIONS</span>
                <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
            </motion.button>

            {/* Dropdown Panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full left-0 mt-2 z-50 min-w-[280px]"
                    >
                        <div className="bg-slate-900 border border-cyan-500/30 rounded-lg shadow-xl shadow-black/50 overflow-hidden">
                            {/* Header */}
                            <div className="px-4 py-3 bg-slate-800/50 border-b border-cyan-500/20">
                                <h3 className="text-cyan-400 font-bold text-xs tracking-widest uppercase">
                                    F3 Scan Display Options
                                </h3>
                            </div>

                            {/* Options */}
                            <div className="p-4 space-y-4">
                                {/* Glow Orbs Toggle */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Circle size={14} className="text-cyan-400" />
                                        <span className="text-gray-300 text-sm">Color Indicators</span>
                                    </div>
                                    <ToggleSwitch
                                        checked={options.showGlowOrbs}
                                        onChange={(checked) => updateOption('showGlowOrbs', checked)}
                                    />
                                </div>

                                {/* Price Tags Toggle */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Tag size={14} className="text-cyan-400" />
                                        <span className="text-gray-300 text-sm">Price Tags</span>
                                    </div>
                                    <ToggleSwitch
                                        checked={options.showPriceTags}
                                        onChange={(checked) => updateOption('showPriceTags', checked)}
                                    />
                                </div>

                                {/* Price Tag Style (only if price tags enabled) */}
                                <AnimatePresence>
                                    {options.showPriceTags && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="pl-6 space-y-2"
                                        >
                                            <span className="text-gray-500 text-xs uppercase tracking-wider">
                                                Tag Style
                                            </span>
                                            <div className="flex gap-2">
                                                <StyleButton
                                                    label="Colored Text"
                                                    active={options.priceTagStyle === 'colored'}
                                                    onClick={() => updateOption('priceTagStyle', 'colored')}
                                                    preview={
                                                        <span className="text-green-400 font-bold text-xs">850k</span>
                                                    }
                                                />
                                                <StyleButton
                                                    label="Gold Badge"
                                                    active={options.priceTagStyle === 'badge'}
                                                    onClick={() => updateOption('priceTagStyle', 'badge')}
                                                    preview={
                                                        <span className="bg-gradient-to-r from-yellow-400 to-orange-400 text-black font-bold text-xs px-1 rounded">
                                                            850k
                                                        </span>
                                                    }
                                                />
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Footer hint */}
                            <div className="px-4 py-2 bg-slate-800/30 border-t border-cyan-500/10">
                                <p className="text-gray-500 text-xs">
                                    Press <kbd className="bg-slate-700 px-1.5 py-0.5 rounded text-cyan-400">F3</kbd> to scan inventory
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// Toggle Switch Component
const ToggleSwitch = ({ checked, onChange }) => (
    <button
        onClick={() => onChange(!checked)}
        className={`
            relative w-11 h-6 rounded-full transition-colors duration-200
            ${checked ? 'bg-cyan-500' : 'bg-slate-700'}
        `}
    >
        <motion.div
            animate={{ x: checked ? 20 : 2 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-md"
        />
    </button>
);

// Style Selection Button
const StyleButton = ({ label, active, onClick, preview }) => (
    <button
        onClick={onClick}
        className={`
            flex-1 p-2 rounded border transition-all duration-200
            ${active
                ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                : 'bg-slate-800 border-slate-700 text-gray-400 hover:border-slate-600'
            }
        `}
    >
        <div className="flex flex-col items-center gap-1">
            <div className="h-5 flex items-center justify-center">
                {preview}
            </div>
            <span className="text-xs">{label}</span>
        </div>
    </button>
);

export default ScanOptionsButton;
