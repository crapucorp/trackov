import React from 'react';
import { motion } from 'framer-motion';

const Hexagon = ({ item, isFound, onClick, index }) => {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ delay: index * 0.02 }}
            onClick={onClick}
            className="relative w-32 h-36 m-2 cursor-pointer group"
            style={{
                marginTop: index % 2 === 1 ? '2rem' : '0', // Simple staggering attempt, might need grid logic
            }}
        >
            {/* Main Hexagon Shape */}
            <div
                className={`
          absolute inset-0 hexagon-clip transition-all duration-300
          ${isFound
                        ? 'bg-amber-500/20 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                        : 'bg-gray-900/80 border-gray-700 hover:bg-gray-800'
                    }
        `}
            >
                {/* Border Stroke (Simulated via inset shadow or pseudo-element if needed, but using bg for now) */}
                <div className="absolute inset-[1px] hexagon-clip bg-[#0a0a0a] flex flex-col items-center justify-center p-2 z-10">

                    {/* Image */}
                    <div className="relative w-16 h-16 mb-1 z-20">
                        <img
                            src={item.iconLink}
                            alt={item.name}
                            className={`
                w-full h-full object-contain transition-all duration-500
                ${isFound ? 'grayscale-0 drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]' : 'grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100'}
              `}
                        />
                    </div>

                    {/* Status Light */}
                    <div className={`
            w-12 h-1 rounded-full mb-1 transition-colors duration-300
            ${isFound ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,1)]' : 'bg-gray-800 group-hover:bg-amber-900'}
          `}></div>

                    {/* Short Name */}
                    <span className={`
            text-[10px] font-bold uppercase tracking-wider transition-colors duration-300
            ${isFound ? 'text-amber-500' : 'text-gray-600 group-hover:text-amber-200'}
          `}>
                        {item.shortName}
                    </span>

                </div>

                {/* Active Glow Border Effect */}
                {isFound && (
                    <div className="absolute inset-0 bg-amber-500 hexagon-clip animate-pulse z-0"></div>
                )}
            </div>

            {/* Holographic Tooltip (On Hover) */}
            <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 bg-black/90 border border-amber-500/50 p-3 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 backdrop-blur-md">
                <h4 className="text-amber-400 text-xs font-bold uppercase tracking-widest border-b border-amber-900/50 pb-1 mb-1">{item.name}</h4>
                <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                    <span>STATUS:</span>
                    <span className={isFound ? "text-green-400" : "text-red-400"}>{isFound ? "CONNECTED" : "OFFLINE"}</span>
                </div>
                <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-amber-500/50 to-transparent"></div>
            </div>

        </motion.div>
    );
};

export default Hexagon;
