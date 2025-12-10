import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

const formatPrice = (price) => {
    if (!price) return '0';
    if (price >= 1000000) return (price / 1000000).toFixed(1) + 'M';
    if (price >= 1000) return (price / 1000).toFixed(0) + 'k';
    return price.toString();
};

export const SidePanel = ({ items, isVisible }) => {
    // Sort by avg24hPrice (priority flea price)
    const sortedItems = [...items].sort((a, b) => (b.avg24hPrice || 0) - (a.avg24hPrice || 0));

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ x: -50, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -50, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="fixed top-1/2 -translate-y-1/2 left-8 w-72 max-h-[70vh] overflow-hidden pointer-events-auto z-50"
                >
                    <div className="flex flex-col gap-1">
                        {/* Header */}
                        <div className="flex items-center justify-between px-3 py-2 bg-black/90 border-l-4 border-cyan-500 mb-2 shadow-lg backdrop-blur-sm">
                            <span className="text-cyan-400 font-bold text-sm tracking-widest">DETECTED</span>
                            <span className="text-cyan-600 text-xs font-mono">{items.length}</span>
                        </div>

                        {/* List */}
                        <div className="flex flex-col gap-1 overflow-y-auto pr-2 scrollbar-hide max-h-[55vh]">
                            {sortedItems.map((item, index) => {
                                const avg24h = item.avg24hPrice || 0;
                                const fleaPrice = item.fleaPrice || 0;
                                const traderPrice = item.traderPrice || 0;
                                const traderName = item.traderName || '';
                                const isHighValue = avg24h > 100000;

                                return (
                                    <motion.div
                                        key={index}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.03 }}
                                        className={clsx(
                                            "flex flex-col px-3 py-2 bg-black/80 backdrop-blur-sm border-l-2 transition-all hover:bg-white/5",
                                            isHighValue ? "border-purple-500" : "border-gray-700"
                                        )}
                                    >
                                        {/* Item name */}
                                        <span className={clsx(
                                            "text-xs font-bold truncate mb-1",
                                            isHighValue ? "text-purple-300" : "text-gray-200"
                                        )}>
                                            {item.shortName}
                                        </span>

                                        {/* Prices row */}
                                        <div className="flex flex-col gap-0.5 text-[10px] font-mono">
                                            {/* Avg 24h (priority) */}
                                            <div className="flex justify-between">
                                                <span className="text-cyan-600">avg24h:</span>
                                                <span className={clsx(
                                                    "font-bold",
                                                    avg24h > 500000 ? "text-[#39ff14]" : "text-cyan-400"
                                                )}>
                                                    ₽{formatPrice(avg24h)}
                                                </span>
                                            </div>

                                            {/* Current flea price */}
                                            {fleaPrice > 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">flea:</span>
                                                    <span className="text-gray-400">₽{formatPrice(fleaPrice)}</span>
                                                </div>
                                            )}

                                            {/* Trader price */}
                                            {traderPrice > 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-orange-600 truncate max-w-[80px]">
                                                        {traderName || 'trader'}:
                                                    </span>
                                                    <span className="text-orange-400">₽{formatPrice(traderPrice)}</span>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
