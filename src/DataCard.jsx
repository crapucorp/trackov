import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const DataCard = ({ item, index, count = 0, onUpdateCount }) => {
    const required = item.count || 1;
    const isCompleted = count >= required;
    const progressPercent = Math.min((count / required) * 100, 100);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2, delay: index * 0.02 }}
            className={`
        relative group flex flex-col
        bg-[#0c1219] border transition-all duration-300 overflow-hidden
        ${isCompleted
                    ? 'border-cyan-500 shadow-[0_0_15px_rgba(6_182_212_0.3)]'
                    : 'border-cyan-900/30 hover:border-cyan-500/50'
                }
      `}
        >
            {/* Scanline Effect (Active on Hover or Completed) */}
            <div className={`
        absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent
        translate-y-[-100%] transition-transform duration-1000
        ${isCompleted ? 'animate-[scan_3s_infinite_linear]' : 'group-hover:translate-y-[100%]'}
      `} />

            {/* Header: Name & Wiki Link */}
            <div className="p-3 flex justify-between items-start gap-2 relative z-10 bg-[#0c1219]/80 backdrop-blur-sm">
                <div className="min-w-0">
                    <h3 className={`
            font-bold text-sm truncate transition-colors
            ${isCompleted ? 'text-cyan-400' : 'text-gray-300 group-hover:text-cyan-200'}
          `}>
                        {item.shortName}
                    </h3>
                    <p className="text-[10px] text-gray-500 uppercase truncate tracking-wider">
                        {item.name}
                    </p>
                </div>

                <a
                    href={item.wikiLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-900 hover:text-cyan-400 transition-colors p-1"
                    title="Open Wiki"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                </a>
            </div>

            {/* Image Area */}
            <div className="flex-1 flex items-center justify-center p-4 relative min-h-[100px]">
                {/* Background Grid */}
                <div className="absolute inset-0 opacity-10"
                    style={{ backgroundImage: 'radial-gradient(circle, #06b6d4 1px, transparent 1px)', backgroundSize: '10px 10px' }}>
                </div>

                <motion.img
                    src={item.iconLink}
                    alt={item.name}
                    className="w-16 h-16 object-contain relative z-10 drop-shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    transition={{ type: "spring", stiffness: 300 }}
                />

                {/* Completed Checkmark Overlay */}
                <AnimatePresence>
                    {isCompleted && (
                        <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            className="absolute inset-0 flex items-center justify-center bg-[#0c1219]/60 backdrop-blur-[1px] z-20"
                        >
                            <motion.div
                                initial={{ rotate: -45, scale: 0.5 }}
                                animate={{ rotate: 0, scale: 1 }}
                                className="w-12 h-12 border-2 border-cyan-500 rounded-full flex items-center justify-center bg-cyan-500/20 shadow-[0_0_20px_rgba(6_182_212_0.5)]"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-6 h-6 text-cyan-400">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Footer: Controls & Progress */}
            <div className="p-3 bg-[#080c11] border-t border-cyan-900/30 relative z-30">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-cyan-700 tracking-widest">QTY</span>
                    <div className="flex items-center gap-3 font-mono text-sm">
                        <button
                            onClick={(e) => { e.stopPropagation(); onUpdateCount(item.id, -1); }}
                            className="w-6 h-6 flex items-center justify-center text-cyan-600 hover:text-cyan-300 hover:bg-cyan-900/30 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            disabled={count <= 0}
                        >
                            -
                        </button>
                        <span className={`font-bold w-8 text-center ${isCompleted ? 'text-cyan-400' : 'text-gray-400'}`}>
                            {count}/{required}
                        </span>
                        <button
                            onClick={(e) => { e.stopPropagation(); onUpdateCount(item.id, 1); }}
                            className="w-6 h-6 flex items-center justify-center text-cyan-600 hover:text-cyan-300 hover:bg-cyan-900/30 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            disabled={count >= required}
                        >
                            +
                        </button>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ duration: 0.5, ease: "circOut" }}
                        className={`h-full ${isCompleted ? 'bg-cyan-400 shadow-[0_0_10px_rgba(6_182_212_0.5)]' : 'bg-cyan-700'}`}
                    />
                </div>
            </div>
        </motion.div>
    );
};

export default DataCard;
