import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { ResultPanel } from './components/ResultPanel';
import { ItemHighlight } from './components/ItemHighlight';
import { AnimatePresence, motion } from 'framer-motion';
import { MousePointer2, MousePointerClick } from 'lucide-react';

// Animated dots component
const AnimatedDots = () => {
    const [dots, setDots] = useState('');

    useEffect(() => {
        const interval = setInterval(() => {
            setDots(prev => prev.length >= 3 ? '' : prev + '.');
        }, 400);
        return () => clearInterval(interval);
    }, []);

    return <span className="inline-block w-6 text-left">{dots}</span>;
};

// Default display options
const DEFAULT_DISPLAY_OPTIONS = {
    showGlowOrbs: true,
    showPriceTags: false,
    priceTagStyle: 'colored',
};

// Load display options from localStorage
const loadDisplayOptions = () => {
    try {
        const saved = localStorage.getItem('scanOptions');
        if (saved) {
            return { ...DEFAULT_DISPLAY_OPTIONS, ...JSON.parse(saved) };
        }
    } catch (e) {
        console.error('Failed to load scan options:', e);
    }
    return DEFAULT_DISPLAY_OPTIONS;
};

const Overlay = () => {
    const [scanData, setScanData] = useState(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isInteractive, setIsInteractive] = useState(false);
    const [showItems, setShowItems] = useState(true); // For fade out on scroll
    const [isScanning, setIsScanning] = useState(false); // Scan in progress indicator
    const [hoveredItemIndex, setHoveredItemIndex] = useState(-1); // Track hovered item from Electron
    const [displayOptions, setDisplayOptions] = useState(loadDisplayOptions);

    // Clear overlay function
    const clearOverlay = useCallback(() => {
        setIsVisible(false);
        setScanData(null);
        setIsInteractive(false);
        setShowItems(true); // Reset for next scan
        setHoveredItemIndex(-1); // Reset hover state
        // Reset Electron window to click-through
        if (window.electronAPI?.setInteractive) {
            window.electronAPI.setInteractive(false);
        }
    }, []);

    // Toggle interaction mode (full panel interactivity)
    const toggleInteractive = useCallback(() => {
        const newValue = !isInteractive;
        setIsInteractive(newValue);
        // Tell Electron to enable/disable mouse events on the window
        if (window.electronAPI?.setInteractive) {
            window.electronAPI.setInteractive(newValue);
        }
    }, [isInteractive]);

    useEffect(() => {
        // Check if running in Electron
        if (window.electronAPI) {
            console.log("Overlay: Listening for gear-scan-result");

            // Listen for scan start signal
            const handleScanStart = () => {
                console.log("Overlay: Scan started");
                setIsScanning(true);
                // Reload display options in case user changed them
                setDisplayOptions(loadDisplayOptions());
            };

            const handleScanResult = (data) => {
                console.log("Overlay: Received data", data);
                setIsScanning(false); // Hide scanning indicator
                if (data && data.success) {
                    setScanData(data);
                    setIsVisible(true);
                    setShowItems(true); // Show items on new scan
                    // NO AUTO HIDE - User request
                } else if (data && data.success === false) {
                    // Explicit close signal
                    setIsVisible(false);
                    setShowItems(true);
                }
            };

            // Listen for scroll hide signal (fade out items)
            const handleScrollHide = () => {
                console.log("Overlay: Scroll detected - hiding items");
                setShowItems(false);
            };

            // Listen for item hover events from Electron mouse tracking
            const handleItemHover = (index) => {
                setHoveredItemIndex(index);
            };

            window.electronAPI.onGearScanStart(handleScanStart);
            window.electronAPI.onGearScanResult(handleScanResult);
            window.electronAPI.onScrollHide(handleScrollHide);
            window.electronAPI.onItemHover(handleItemHover);

        } else {
            // Dev mode / Browser mock
            console.log("Overlay: Dev mode, triggering mock data in 1s");
            setTimeout(() => {
                setScanData({
                    items: [
                        { id: "5c0e722886f7740458316a57", name: "Green Keycard", shortName: "Green", avg24hPrice: 1200000, price: 1200000, box: [300, 200, 60, 60], score: 100 },
                        { id: "5c0530ee86f774697952d952", name: "Injectors Case", shortName: "Injectors", avg24hPrice: 560000, price: 560000, box: [120, 500, 50, 50], score: 98 },
                        { id: "5d03794386f77420415576f5", name: "Surv12 Kit", shortName: "Surv12", avg24hPrice: 520000, price: 520000, box: [500, 400, 40, 40], score: 95 },
                        { id: "5c12688486f77426843c7d32", name: "Paracord", shortName: "Paracord", avg24hPrice: 200000, price: 200000, box: [600, 300, 40, 40], score: 99 }
                    ],
                    total_value: 2283144,
                    success: true
                });
                setIsVisible(true);
            }, 1000);
        }
    }, []);

    // Interaction Listeners (TAB only)
    // Note: The main process handles the global shortcut for TAB when the window is focused/overlay is active.
    // But we also add a listener here just in case the window has focus.
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Tab') {
                console.log("TAB pressed (Renderer) - clearing overlay");
                clearOverlay();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [clearOverlay]);

    // Calculate best items per slot size (for "Best Xs" indicator)
    const itemsWithBest = useMemo(() => {
        const items = scanData?.items || [];
        if (items.length === 0) return [];

        // Group by slot size and find best price per slot for each size
        const bestBySlots = {};
        items.forEach(item => {
            const slots = item.slots ?? 1;
            const price = item.avg24hPrice ?? item.avg24h_price ?? item.price ?? 0;
            const pricePerSlot = price / slots;

            if (!bestBySlots[slots] || pricePerSlot > bestBySlots[slots].pricePerSlot) {
                bestBySlots[slots] = { pricePerSlot, itemId: item.id || item.item_id };
            }
        });

        // Mark items that are best for their slot size
        return items.map(item => {
            const slots = item.slots ?? 1;
            const itemId = item.id || item.item_id;
            const isBest = bestBySlots[slots]?.itemId === itemId;
            return { ...item, isBestForSlots: isBest };
        });
    }, [scanData?.items]);

    return (
        <div className={`w-screen h-screen overflow-hidden bg-transparent font-sans ${isInteractive ? 'pointer-events-auto' : 'pointer-events-none'}`}>

            {/* Scan in progress indicator */}
            <AnimatePresence>
                {isScanning && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.2 }}
                        className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999]"
                    >
                        <div className="bg-black/80 backdrop-blur-sm px-4 py-2 rounded-lg border border-cyan-500/50 shadow-[0_0_20px_rgba(0,255,255,0.2)]">
                            <span className="text-cyan-400 text-sm font-mono">
                                Scan in progress<AnimatedDots />
                            </span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Toggle Interaction Button - Top Left Corner */}
            <AnimatePresence>
                {isVisible && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        onClick={toggleInteractive}
                        className={`fixed top-4 left-4 z-[9999] pointer-events-auto w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 border-2 ${
                            isInteractive
                                ? 'bg-cyan-500 border-cyan-400 text-black shadow-[0_0_20px_rgba(0,255,255,0.6)]'
                                : 'bg-black/80 border-gray-600 text-gray-400 hover:border-cyan-500 hover:text-cyan-400'
                        }`}
                        title={isInteractive ? "Désactiver interaction" : "Activer interaction (scroll, clic)"}
                    >
                        {isInteractive ? <MousePointerClick size={20} /> : <MousePointer2 size={20} />}
                    </motion.button>
                )}
            </AnimatePresence>

            <ResultPanel
                items={scanData?.items || []}
                groupedItems={scanData?.groupedItems || null}
                totalValue={scanData?.total_value || 0}
                isVisible={isVisible}
                onClose={clearOverlay}
                isInteractive={isInteractive}
            />

            <AnimatePresence>
                {isVisible && showItems && itemsWithBest.map((item, index) => (
                    <ItemHighlight
                        key={index}
                        item={item}
                        isHovered={hoveredItemIndex === index}
                        displayOptions={displayOptions}
                    />
                ))}
            </AnimatePresence>
        </div>
    );
};

export default Overlay;
