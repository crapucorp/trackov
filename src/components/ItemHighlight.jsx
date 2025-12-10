import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Get tier styling based on PRICE PER SLOT
 * 4 tiers: S (Meta), A (High), B (Mid), C (Trash)
 */
const getTierStyle = (pricePerSlot) => {
    if (pricePerSlot > 100000) {
        // TIER S - Meta (Gold)
        return {
            tier: 'S',
            hasPulse: true,
            hasGlowOrb: true,
            showPriceTag: true,
            orbColor: '#FFD700',
            orbGlow: '0 0 10px #FFD700, 0 0 20px #FFD700, 0 0 30px #FFD700',
            labelBg: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            labelColor: '#FFD700',
            labelGlow: '0 0 8px #FFD700',
        };
    }
    if (pricePerSlot > 30000) {
        // TIER A - High (Neon Green)
        return {
            tier: 'A',
            hasPulse: false,
            hasGlowOrb: true,
            showPriceTag: true,
            orbColor: '#39FF14',
            orbGlow: '0 0 8px #39FF14, 0 0 16px #39FF14',
            labelBg: 'linear-gradient(135deg, #0a1a0a 0%, #0d2818 100%)',
            labelColor: '#39FF14',
            labelGlow: '0 0 8px #39FF14',
        };
    }
    if (pricePerSlot > 10000) {
        // TIER B - Mid (Cyan Blue)
        return {
            tier: 'B',
            hasPulse: false,
            hasGlowOrb: true,
            showPriceTag: true,
            orbColor: '#00BFFF',
            orbGlow: '0 0 6px #00BFFF',
            labelBg: 'linear-gradient(135deg, #0a1a1a 0%, #0d1828 100%)',
            labelColor: '#00BFFF',
            labelGlow: '0 0 6px #00BFFF',
        };
    }
    // TIER C - Trash (Gray) - No indicators
    return {
        tier: 'C',
        hasPulse: false,
        hasGlowOrb: false,
        showPriceTag: false,
        orbColor: '#666666',
        orbGlow: 'none',
        labelBg: 'rgba(20, 20, 20, 0.9)',
        labelColor: '#888888',
        labelGlow: 'none',
    };
};

/**
 * Glow Orb - Colored indicator dot in corner
 */
const GlowOrb = ({ color, glow, hasPulse }) => (
    <motion.div
        animate={hasPulse ? {
            scale: [1, 1.3, 1],
            boxShadow: [glow, glow.replace(/\d+px/g, m => parseInt(m) * 2 + 'px'), glow],
        } : {}}
        transition={hasPulse ? {
            duration: 1.2,
            repeat: Infinity,
            ease: 'easeInOut',
        } : {}}
        style={{
            position: 'absolute',
            top: -4,
            left: -4,
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: color,
            boxShadow: glow,
            zIndex: 20,
        }}
    />
);

/**
 * Price Tag - Colored text style
 */
const ColoredPriceTag = ({ price, tierStyle }) => {
    const formatPrice = (p) => {
        if (p >= 1000000) return (p / 1000000).toFixed(1) + 'M';
        if (p >= 1000) return Math.round(p / 1000) + 'k';
        return p.toString();
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
                position: 'absolute',
                top: -8,
                right: -8,
                background: 'rgba(0, 0, 0, 0.8)',
                padding: '2px 4px',
                borderRadius: 3,
                zIndex: 10,
                pointerEvents: 'none',
            }}
        >
            <span style={{
                fontFamily: 'Consolas, Monaco, monospace',
                fontSize: 9,
                fontWeight: 700,
                color: tierStyle.labelColor,
                textShadow: tierStyle.labelGlow !== 'none' ? tierStyle.labelGlow : 'none',
            }}>
                {formatPrice(price)}
            </span>
        </motion.div>
    );
};

/**
 * Price Tag - Gold badge style
 */
const BadgePriceTag = ({ price }) => {
    const formatPrice = (p) => {
        if (p >= 1000000) return (p / 1000000).toFixed(1) + 'M';
        if (p >= 1000) return Math.round(p / 1000) + 'k';
        return p.toString();
    };

    return (
        <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            style={{
                position: 'absolute',
                top: -8,
                right: -8,
                background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                color: '#000',
                fontWeight: 800,
                fontFamily: 'Consolas, Monaco, monospace',
                fontSize: 8,
                padding: '2px 4px',
                borderRadius: 3,
                boxShadow: '0 2px 8px rgba(255, 215, 0, 0.6)',
                pointerEvents: 'none',
                zIndex: 10,
            }}
        >
            {formatPrice(price)}
        </motion.div>
    );
};

/**
 * Tactical Tooltip - Appears on hover (full details)
 */
const TacticalTooltip = ({ item, pricePerSlot, tierStyle }) => {
    const formatPrice = (p) => {
        if (p >= 1000000) return (p / 1000000).toFixed(1) + 'M';
        if (p >= 1000) return Math.round(p / 1000) + 'k';
        return p.toString();
    };

    const shortName = item?.shortName || item?.short_name || item?.name?.slice(0, 15) || 'Unknown';
    const totalPrice = item?.avg24hPrice ?? item?.avg24h_price ?? item?.price ?? 0;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 3 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            style={{
                position: 'absolute',
                bottom: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                marginBottom: 8,
                padding: '6px 10px',
                background: tierStyle.labelBg,
                borderRadius: 4,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.8)',
                whiteSpace: 'nowrap',
                zIndex: 1000,
                pointerEvents: 'none',
            }}
        >
            {/* Item Name */}
            <div style={{
                fontFamily: 'Consolas, Monaco, monospace',
                fontSize: 11,
                fontWeight: 700,
                color: tierStyle.labelColor,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: 3,
                textShadow: tierStyle.labelGlow !== 'none' ? tierStyle.labelGlow : 'none',
            }}>
                {shortName}
            </div>

            {/* Price Line */}
            <div style={{
                fontFamily: 'Consolas, Monaco, monospace',
                fontSize: 10,
                color: '#CCCCCC',
                display: 'flex',
                gap: 8,
                justifyContent: 'center',
            }}>
                <span>
                    <span style={{ color: '#888' }}>TOT:</span>{' '}
                    <span style={{ color: '#FFF', fontWeight: 600 }}>{formatPrice(totalPrice)}₽</span>
                </span>
                <span style={{ color: '#444' }}>|</span>
                <span>
                    <span style={{ color: '#888' }}>SLOT:</span>{' '}
                    <span style={{ color: tierStyle.labelColor, fontWeight: 600 }}>{formatPrice(pricePerSlot)}₽</span>
                </span>
            </div>

            {/* Tooltip Arrow */}
            <div style={{
                position: 'absolute',
                bottom: -5,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 0,
                height: 0,
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderTop: '5px solid rgba(30, 30, 40, 0.95)',
            }} />
        </motion.div>
    );
};

/**
 * ItemHighlight - Minimal overlay with configurable indicators
 * Props:
 *   - displayOptions: { showGlowOrbs, showPriceTags, priceTagStyle }
 */
export const ItemHighlight = ({
    box,
    item,
    isHovered = false,
    displayOptions = { showGlowOrbs: true, showPriceTags: false, priceTagStyle: 'colored' }
}) => {
    // Handle all possible prop formats from gear_scanner
    const x = box?.x ?? item?.abs_x ?? item?.x ?? 0;
    const y = box?.y ?? item?.abs_y ?? item?.y ?? 0;
    const width = box?.width ?? item?.abs_width ?? item?.width ?? 64;
    const height = box?.height ?? item?.abs_height ?? item?.height ?? 64;

    // Use unit price (avg24hPrice), not total
    const price = item?.avg24hPrice ?? item?.avg24h_price ?? item?.price ?? 0;
    const slots = item?.slots ?? 1;

    // Calculate price per slot
    const pricePerSlot = Math.round(price / slots);

    // Get tier styling
    const tierStyle = getTierStyle(pricePerSlot);

    // Check display options
    const showOrb = displayOptions.showGlowOrbs && tierStyle.hasGlowOrb;
    const showTag = displayOptions.showPriceTags && tierStyle.showPriceTag && !isHovered;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
                position: 'absolute',
                left: x,
                top: y,
                width: width,
                height: height,
                pointerEvents: 'none',
            }}
        >
            {/* Glow Orb Indicator */}
            {showOrb && (
                <GlowOrb
                    color={tierStyle.orbColor}
                    glow={tierStyle.orbGlow}
                    hasPulse={tierStyle.hasPulse}
                />
            )}

            {/* Price Tag */}
            {showTag && (
                displayOptions.priceTagStyle === 'badge'
                    ? <BadgePriceTag price={price} />
                    : <ColoredPriceTag price={price} tierStyle={tierStyle} />
            )}

            {/* Hover Tooltip (full details) */}
            <AnimatePresence>
                {isHovered && (
                    <TacticalTooltip
                        item={item}
                        pricePerSlot={pricePerSlot}
                        tierStyle={tierStyle}
                    />
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default ItemHighlight;
