import React, { useEffect } from 'react';
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';
import { clsx } from 'clsx';
import { Box, X } from 'lucide-react';

const formatPrice = (price) => {
    if (!price) return '0';
    return new Intl.NumberFormat('en-US').format(Math.round(price));
};

// Rarity colors based on PRICE PER SLOT (matching ItemHighlight.jsx)
const getRarityStyle = (pricePerSlot) => {
    if (pricePerSlot >= 100000) {
        // LEGENDARY - Gold (100k+/slot)
        return {
            border: 'border-[#FFD700]',
            text: 'text-[#FFD700]',
            bg: 'bg-[#FFD700]/10',
            glow: 'shadow-[0_0_10px_rgba(255,215,0,0.3)]',
        };
    }
    if (pricePerSlot >= 50000) {
        // EPIC - Purple/Magenta (50k+/slot)
        return {
            border: 'border-[#FF00FF]',
            text: 'text-[#FF00FF]',
            bg: 'bg-[#FF00FF]/10',
            glow: 'shadow-[0_0_10px_rgba(255,0,255,0.3)]',
        };
    }
    if (pricePerSlot >= 25000) {
        // RARE - Cyan (25k+/slot)
        return {
            border: 'border-[#00FFFF]',
            text: 'text-[#00FFFF]',
            bg: 'bg-[#00FFFF]/10',
            glow: 'shadow-[0_0_10px_rgba(0,255,255,0.3)]',
        };
    }
    if (pricePerSlot >= 15000) {
        // UNCOMMON - Green (15k+/slot)
        return {
            border: 'border-[#39FF14]',
            text: 'text-[#39FF14]',
            bg: 'bg-[#39FF14]/10',
            glow: 'shadow-[0_0_10px_rgba(57,255,20,0.3)]',
        };
    }
    if (pricePerSlot >= 8000) {
        // COMMON - White (8k+/slot)
        return {
            border: 'border-white/50',
            text: 'text-white',
            bg: 'bg-white/5',
            glow: '',
        };
    }
    // TRASH - Gray (<8k/slot)
    return {
        border: 'border-gray-600',
        text: 'text-gray-400',
        bg: 'bg-gray-500/5',
        glow: '',
    };
};

export const ResultPanel = ({ items, groupedItems, totalValue, isVisible, onClose, isInteractive }) => {
    // Use groupedItems for display (with x2, x3, etc.), fallback to items
    const displayItems = groupedItems || items;

    // Sort items by price (using the most accurate price available)
    const sortedItems = [...displayItems].sort((a, b) => {
        const priceA = a.price || a.avg24hPrice || 0;
        const priceB = b.price || b.avg24hPrice || 0;
        return priceB - priceA;
    });

    // Jackpot Animation
    const springValue = useSpring(0, { stiffness: 40, damping: 15, mass: 1 });
    const displayValue = useTransform(springValue, (current) => formatPrice(current));

    useEffect(() => {
        if (isVisible) {
            springValue.set(totalValue);
        } else {
            springValue.set(0);
        }
    }, [totalValue, isVisible, springValue]);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ x: -100, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -100, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 120, damping: 20 }}
                    className="fixed top-24 left-12 w-[400px] pointer-events-auto font-sans"
                >
                    {/* Main Container with "Tech" Border */}
                    <div className="relative bg-[#0a0f14]/95 border border-cyan-500/30 rounded-lg overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-xl">

                        {/* Header Section */}
                        <div className="relative p-6 border-b border-cyan-500/20 bg-gradient-to-b from-cyan-900/10 to-transparent">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50" />

                            {/* Close Button */}
                            <button
                                onClick={onClose}
                                className="absolute top-3 right-3 w-8 h-8 rounded-md flex items-center justify-center bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/40 hover:text-red-300 transition-all z-10"
                                title="Fermer (TAB)"
                            >
                                <X size={18} />
                            </button>

                            <div className="flex flex-col items-center justify-center gap-1">
                                <span className="text-cyan-500/60 text-xs font-bold tracking-[0.2em] uppercase">Total Estimated Value</span>
                                <motion.div
                                    className="text-5xl font-bold text-[#39ff14] drop-shadow-[0_0_15px_rgba(57,255,20,0.4)] tracking-tight"
                                >
                                    <motion.span>{displayValue}</motion.span> <span className="text-2xl align-top opacity-80">₽</span>
                                </motion.div>
                            </div>

                            {/* Decorative corners */}
                            <div className="absolute top-2 left-2 w-2 h-2 border-t border-l border-cyan-500/50" />
                        </div>

                        {/* Items List */}
                        <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar">
                            {sortedItems.map((item, index) => {
                                // Priority: item.price (live/gsheet) > item.avg24hPrice (static db)
                                const unitPrice = item.price || item.avg24hPrice || 0;
                                const slots = item.slots || 1;
                                const pricePerSlot = Math.round(unitPrice / slots);
                                const quantity = item.quantity || 1;
                                const totalPrice = item.totalPrice || unitPrice * quantity;
                                const rarity = getRarityStyle(pricePerSlot);
                                const iconUrl = item.id ? `https://assets.tarkov.dev/${item.id}-icon.webp` : null;

                                return (
                                    <motion.div
                                        key={index}
                                        initial={{ x: -20, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        transition={{ delay: index * 0.05 }}
                                        className={clsx(
                                            "relative flex items-center gap-4 p-3 rounded border transition-all duration-300 group hover:bg-white/5",
                                            rarity.border,
                                            rarity.bg,
                                            rarity.glow
                                        )}
                                    >
                                        {/* Icon */}
                                        <div className={clsx(
                                            "flex items-center justify-center w-12 h-12 rounded bg-black/40 border border-white/10 overflow-hidden shrink-0",
                                            rarity.text
                                        )}>
                                            {iconUrl ? (
                                                <img src={iconUrl} alt={item.shortName} className="w-full h-full object-contain" />
                                            ) : (
                                                <Box size={24} strokeWidth={1.5} />
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-baseline justify-between">
                                                <h4 className="text-gray-100 font-bold text-sm truncate pr-2">
                                                    {item.name}
                                                    {/* Quantity badge x2, x3, etc. */}
                                                    {quantity > 1 && (
                                                        <span className="ml-2 text-xs font-bold text-cyan-400 bg-cyan-500/20 px-1.5 py-0.5 rounded">
                                                            x{quantity}
                                                        </span>
                                                    )}
                                                </h4>
                                                <span className={clsx("font-mono font-bold text-sm whitespace-nowrap", rarity.text)}>
                                                    {formatPrice(quantity > 1 ? totalPrice : unitPrice)} ₽
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between mt-1">
                                                <span className="text-gray-500 text-[10px] uppercase tracking-wider">
                                                    {item.shortName}
                                                    {quantity > 1 && (
                                                        <span className="text-gray-600 ml-2">({formatPrice(unitPrice)}₽ each)</span>
                                                    )}
                                                </span>
                                                <span className="text-gray-600 text-[10px]">
                                                    {slots}s • {formatPrice(pricePerSlot)}₽/s
                                                </span>
                                            </div>
                                        </div>

                                        {/* Hover Glow Effect */}
                                        <div className={clsx(
                                            "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded",
                                            "shadow-[inset_0_0_20px_rgba(255,255,255,0.05)]"
                                        )} />
                                    </motion.div>
                                );
                            })}
                        </div>

                        {/* Footer */}
                        <div className="p-3 bg-black/60 border-t border-cyan-500/20 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className={clsx(
                                    "w-2 h-2 rounded-full animate-pulse",
                                    isInteractive ? "bg-cyan-400 shadow-[0_0_10px_#00ffff]" : "bg-[#39ff14] shadow-[0_0_10px_#39ff14]"
                                )} />
                                <span className={clsx(
                                    "text-xs font-bold tracking-wider",
                                    isInteractive ? "text-cyan-400" : "text-[#39ff14]"
                                )}>
                                    {isInteractive ? "MODE INTERACTIF" : "SYSTEM READY"}
                                </span>
                            </div>
                            <span className="text-gray-500 text-[10px] tracking-wider">
                                {isInteractive ? "Scroll activé" : "Clic ↖ pour scroll"}
                            </span>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
