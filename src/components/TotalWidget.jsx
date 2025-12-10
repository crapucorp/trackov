import React, { useEffect } from 'react';
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';
import { clsx } from 'clsx';

const formatValue = (value) => {
    if (value >= 1000000) return (value / 1000000).toFixed(2) + 'M';
    if (value >= 1000) return (value / 1000).toFixed(0) + 'k';
    return Math.round(value).toString();
};

export const TotalWidget = ({ totalValue, totalTraderValue, isVisible }) => {
    const isHighValue = totalValue > 500000;

    // Animated flea value
    const springFlea = useSpring(0, { stiffness: 50, damping: 15 });
    const displayFlea = useTransform(springFlea, formatValue);

    // Animated trader value
    const springTrader = useSpring(0, { stiffness: 50, damping: 15 });
    const displayTrader = useTransform(springTrader, formatValue);

    useEffect(() => {
        if (isVisible) {
            springFlea.set(totalValue);
            springTrader.set(totalTraderValue || 0);
        } else {
            springFlea.set(0);
            springTrader.set(0);
        }
    }, [totalValue, totalTraderValue, isVisible, springFlea, springTrader]);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ y: -100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -100, opacity: 0 }}
                    className="fixed top-8 left-1/2 -translate-x-1/2 pointer-events-auto cursor-move z-50"
                    drag
                    dragConstraints={{ left: -500, right: 500, top: 0, bottom: 500 }}
                >
                    <div className={clsx(
                        "flex flex-col items-center justify-center px-10 py-4 rounded-xl backdrop-blur-md border shadow-2xl transition-colors duration-500",
                        "bg-[#0c1219]/90 border-cyan-500/30",
                        "font-mono"
                    )}>
                        {/* Flea Market Total */}
                        <div className="text-cyan-500/70 text-[10px] tracking-[0.2em] uppercase mb-1 flex items-center gap-2">
                            <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" />
                            Flea (avg24h)
                            <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" />
                        </div>
                        <motion.div
                            className={clsx(
                                "text-4xl font-bold tracking-tighter",
                                isHighValue ? "text-[#39ff14] drop-shadow-[0_0_15px_rgba(57,255,20,0.6)]" : "text-cyan-400 drop-shadow-[0_0_10px_rgba(0,255,255,0.3)]"
                            )}
                        >
                            ₽ <motion.span>{displayFlea}</motion.span>
                        </motion.div>

                        {/* Trader Total */}
                        <div className="mt-3 pt-3 border-t border-orange-500/30 w-full text-center">
                            <div className="text-orange-500/70 text-[9px] tracking-[0.15em] uppercase mb-1">
                                Trader
                            </div>
                            <motion.div className="text-2xl font-bold text-orange-400 tracking-tighter">
                                ₽ <motion.span>{displayTrader}</motion.span>
                            </motion.div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
