"""
FastAPI server for scanner service - PURE OCR MODE
===================================================
Only Florence-2 OCR engine - all other AI engines disabled.
"""

import sys
import os

# Disable TensorFlow to avoid NumPy conflicts
os.environ['USE_TF'] = '0'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

# FIX: Add current directory to Python path for embedded Python in production
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import uvicorn
import logging
import asyncio
import json
import time
import threading
from pathlib import Path


# Filter out noisy scroll/check endpoint from logs
class EndpointFilter(logging.Filter):
    def filter(self, record):
        # Filter out /scroll/check requests from access logs
        if hasattr(record, 'getMessage'):
            msg = record.getMessage()
            if '/scroll/check' in msg:
                return False
        return True

# Apply filter to uvicorn access logger
logging.getLogger("uvicorn.access").addFilter(EndpointFilter())


# Try to import price fetching (optional)
try:
    from tarkov_api import get_item_prices, _fetch_from_tarkov_dev
    PRICE_FETCH_AVAILABLE = True
except Exception as e:
    print(f"[WARNING] Price fetching not available: {e}")
    get_item_prices = None
    _fetch_from_tarkov_dev = None
    PRICE_FETCH_AVAILABLE = False

# Google Sheet price loader (synced with Tarkov Market every hour)
try:
    import gsheet_prices
    GSHEET_AVAILABLE = True
    print("[OK] Google Sheet price module loaded")
except Exception as e:
    print(f"[WARNING] Google Sheet prices not available: {e}")
    gsheet_prices = None
    GSHEET_AVAILABLE = False

# Price refresh settings
PRICE_REFRESH_INTERVAL = 600  # 10 minutes in seconds
last_price_refresh = 0
price_refresh_running = False  # Flag to prevent concurrent refreshes

# Try to import Florence-2 OCR Engine (THE ONLY ENGINE)
try:
    from florence_ocr import FlorenceOCREngine
    FLORENCE_OCR_AVAILABLE = True
    print("[OK] Florence-2 OCR module loaded")
except Exception as e:
    print(f'[WARNING] Florence-2 OCR not available: {e}')
    print(f'           Install with: pip install transformers torch rapidfuzz mss')
    FlorenceOCREngine = None
    FLORENCE_OCR_AVAILABLE = False

# Try to import Gear Scanner (F3 zone scanning)
try:
    from gear_scanner import get_gear_scanner
    GEAR_SCANNER_AVAILABLE = True
    print("[OK] Gear Scanner module loaded")
except Exception as e:
    print(f'[WARNING] Gear Scanner not available: {e}')
    get_gear_scanner = None
    GEAR_SCANNER_AVAILABLE = False

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Lifespan context manager
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load Florence-2 OCR at startup - NOT lazy loading"""
    global florence_ocr, gear_scanner

    logger.info("[OK] Starting Kappa Scanner API (PURE OCR MODE)...")

    # Load Florence-2 OCR at startup (user wants it pre-loaded)
    if FLORENCE_OCR_AVAILABLE:
        try:
            logger.info("[*] Loading Florence-2 OCR Engine at startup...")
            florence_ocr = FlorenceOCREngine()
            logger.info("[OK] Florence-2 OCR Engine ready! (LIGHT SPEED MODE)")
        except Exception as e:
            logger.error(f"[ERROR] Florence-2 OCR failed to load: {e}")
            florence_ocr = None
    else:
        logger.warning("[WARNING] Florence-2 OCR not available - install dependencies")

    # Initialize Gear Scanner with Florence engine
    if GEAR_SCANNER_AVAILABLE and florence_ocr is not None:
        try:
            logger.info("[*] Initializing Gear Scanner...")
            gear_scanner = get_gear_scanner(florence_ocr)
            logger.info("[OK] Gear Scanner ready! (F3)")
        except Exception as e:
            logger.error(f"[ERROR] Gear Scanner failed to initialize: {e}")
            gear_scanner = None

    # Load Google Sheet prices at startup
    if GSHEET_AVAILABLE:
        try:
            logger.info("[*] Loading prices from Google Sheet...")
            gsheet_prices.init()
            logger.info("[OK] Google Sheet prices loaded!")
        except Exception as e:
            logger.error(f"[ERROR] Google Sheet prices failed to load: {e}")

    yield

app = FastAPI(title="Kappa Scanner API - Pure OCR", lifespan=lifespan)

# Allow CORS for Electron app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize basic scanner

# Florence-2 OCR Engine - will be loaded at startup
florence_ocr = None

# Gear Scanner - will be initialized after Florence-2 is loaded
gear_scanner = None

# ============================================
# SCROLL DETECTION (hide overlay on scroll)
# ============================================
# Simple scroll detection - hides overlay labels when user scrolls

try:
    from pynput import mouse
    PYNPUT_AVAILABLE = True
except ImportError:
    PYNPUT_AVAILABLE = False

scroll_state = {
    "is_listening": False,
    "scroll_detected": False,
    "last_scroll_time": 0
}
scroll_lock = threading.Lock()
scroll_listener = None


def on_scroll_event(x, y, dx, dy):
    """Callback when scroll is detected"""
    global scroll_state
    with scroll_lock:
        scroll_state["scroll_detected"] = True
        scroll_state["last_scroll_time"] = time.time()


def start_scroll_detection():
    """Start listening for scroll events"""
    global scroll_listener, scroll_state

    if not PYNPUT_AVAILABLE:
        logger.warning("[Scroll] pynput not available")
        return False

    if scroll_listener is not None:
        return True

    with scroll_lock:
        scroll_state["scroll_detected"] = False
        scroll_state["is_listening"] = True

    scroll_listener = mouse.Listener(on_scroll=on_scroll_event)
    scroll_listener.start()
    logger.info("[Scroll] Detection started")
    return True


def stop_scroll_detection():
    """Stop listening for scroll events"""
    global scroll_listener, scroll_state

    if scroll_listener is not None:
        scroll_listener.stop()
        scroll_listener = None

    with scroll_lock:
        scroll_state["is_listening"] = False
        scroll_state["scroll_detected"] = False

    logger.info("[Scroll] Detection stopped")


def check_scroll_detected() -> dict:
    """Check if scroll was detected and reset flag"""
    global scroll_state
    with scroll_lock:
        detected = scroll_state["scroll_detected"]
        if detected:
            scroll_state["scroll_detected"] = False  # Reset after reading
        return {
            "scroll_detected": detected,
            "is_listening": scroll_state["is_listening"]
        }


class ScanIconRequest(BaseModel):
    x: int
    y: int


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "Kappa Scanner API - Pure OCR Mode",
        "status": "running",
        "florence_ocr": FLORENCE_OCR_AVAILABLE
    }


@app.post("/scan-ocr")
async def scan_ocr(request: ScanIconRequest):
    """
    Florence-2 OCR Engine - LIGHT SPEED MODE (THE ONLY SCAN METHOD)

    Features:
    - Pure OCR-based recognition (reads shortName text directly)
    - Florence-2-large model on GPU (float16)
    - RapidFuzz fuzzy matching
    - 100% accuracy on readable text
    """
    global florence_ocr
    if florence_ocr is None:
        raise HTTPException(
            status_code=503,
            detail="Florence-2 OCR not available. Install: pip install transformers torch rapidfuzz mss"
        )

    try:
        logger.info(f"[Florence-2] Scanning at position ({request.x}, {request.y})")

        # Scan with Florence-2 OCR
        result = florence_ocr.scan_at_cursor(request.x, request.y)

        if result:
            logger.info(
                f"[Florence-2] Found: {result['shortName']} "
                f"(OCR: '{result['ocr_text']}', score: {result['match_score']}, time: {result['scan_time_ms']:.1f}ms)"
            )

            item_id = result['id']
            item_name = result['name']
            short_name = result['shortName']

            # Try to get prices from Google Sheet (synced with Tarkov Market hourly)
            market_data = None
            if GSHEET_AVAILABLE and gsheet_prices:
                market_data = gsheet_prices.get_price(item_name)

            if market_data:
                # Use Google Sheet data (synced with Tarkov Market)
                flea_price = market_data.get('price', 0) or market_data.get('avg24hPrice', 0) or 0
                best_trader_name = market_data.get('traderName', 'N/A') or 'N/A'
                best_trader_price = market_data.get('traderPrice', 0) or 0
                icon_url = f"https://assets.tarkov.dev/{item_id}-icon.webp"

                # Get slots from result (shortnames.json has dimensions)
                width = result.get('width', 1) or 1
                height = result.get('height', 1) or 1
                slots = width * height

                logger.info(f"[GSheet] Flea: {flea_price}, Trader: {best_trader_name} ({best_trader_price})")

                return {
                    "success": True,
                    "method": "florence_ocr",
                    "item": {
                        "id": item_id,
                        "name": item_name,
                        "shortName": short_name,
                        "price": flea_price,
                        "confidence": result['match_score'],
                        "ocr_text": result['ocr_text'],
                        "scan_time_ms": result['scan_time_ms'],
                        "ocr_time_ms": result.get('ocr_time_ms', 0),
                        "fleaPrice": flea_price,
                        "fleaMinPrice": flea_price,
                        "iconUrl": icon_url,
                        "width": width,
                        "height": height,
                        "slots": slots,
                        "sellFor": [
                            {"vendor": best_trader_name, "price": best_trader_price}
                        ]
                    }
                }
            else:
                # Fallback to static data from database
                icon_url = f"https://assets.tarkov.dev/{item_id}-icon.webp"
                width = result.get('width', 1) or 1
                height = result.get('height', 1) or 1

                return {
                    "success": True,
                    "method": "florence_ocr",
                    "item": {
                        "id": item_id,
                        "name": item_name,
                        "shortName": short_name,
                        "price": result.get('avg24hPrice', 0) or 0,
                        "confidence": result['match_score'],
                        "ocr_text": result['ocr_text'],
                        "scan_time_ms": result['scan_time_ms'],
                        "ocr_time_ms": result.get('ocr_time_ms', 0),
                        "fleaPrice": result.get('avg24hPrice', 0) or 0,
                        "fleaMinPrice": result.get('avg24hPrice', 0) or 0,
                        "iconUrl": icon_url,
                        "width": width,
                        "height": height,
                        "slots": width * height,
                        "sellFor": [
                            {"vendor": k.capitalize(), "price": v}
                            for k, v in result.get('sellFor', {}).items()
                        ]
                    }
                }
        else:
            logger.info("[Florence-2] No item found")
            return {"success": False, "item": None}

    except Exception as e:
        logger.error(f"[Florence-2] Scan error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/ocr/stats")
async def get_ocr_stats():
    """Get Florence-2 OCR engine statistics"""
    global florence_ocr
    if florence_ocr is None:
        raise HTTPException(
            status_code=503,
            detail="Florence-2 OCR not available"
        )

    stats = florence_ocr.get_stats()
    return {
        "engine": "Florence-2 OCR (LIGHT SPEED MODE)",
        "status": "ready",
        "statistics": stats
    }


@app.post("/scan-gear")
async def scan_gear():
    """
    Gear Zone Scanner (F3) - Scans entire Loadout area.

    Detects all items in Vest, Pockets, and Backpack zones.
    Returns absolute screen coordinates for overlay drawing.

    Returns:
        success: bool
        items: List of detected items with absolute coordinates
        total_value: Sum of all item prices
        item_count: Number of items detected
        roi: Region of Interest used for scanning
    """
    global gear_scanner

    if gear_scanner is None:
        raise HTTPException(
            status_code=503,
            detail="Gear Scanner not available. Florence-2 OCR may not be loaded."
        )

    try:
        logger.info("[GearScanner] Scan requested via API...")
        result = gear_scanner.scan_gear_zone()

        # Add prices from Google Sheet if available (same as F4)
        if GSHEET_AVAILABLE and gsheet_prices and result.get('items'):
            total_value = 0
            total_trader_value = 0
            for item in result['items']:
                price_data = gsheet_prices.get_price(item['name'])
                if price_data:
                    # Use Google Sheet prices (synced with Tarkov Market hourly)
                    flea_price = price_data.get('price', 0) or price_data.get('avg24hPrice', 0) or 0
                    trader_price = price_data.get('traderPrice', 0) or 0
                    trader_name = price_data.get('traderName', '') or 'N/A'

                    # Update all price fields to match F4 behavior
                    item['price'] = flea_price
                    item['fleaPrice'] = flea_price
                    item['avg24hPrice'] = flea_price
                    item['traderPrice'] = trader_price
                    item['traderName'] = trader_name

                    total_value += flea_price
                    total_trader_value += trader_price
                else:
                    # Fallback to existing prices from shortnames.json
                    total_value += item.get('fleaPrice', 0) or item.get('avg24hPrice', 0) or 0
                    total_trader_value += item.get('traderPrice', 0) or 0

            result['total_value'] = total_value
            result['total_trader_value'] = total_trader_value

        # Group identical items for panel (x2, x3, x4, etc.)
        # Keep raw items for overlay display
        if result.get('items'):
            # Store raw items for overlay (individual display)
            raw_items = result['items']

            # Create grouped items for left panel
            grouped_items = {}
            for item in raw_items:
                item_name = item.get('name', '')
                if item_name in grouped_items:
                    # Increment quantity
                    grouped_items[item_name]['quantity'] += 1
                    # Update total price for this stack
                    unit_price = item.get('avg24hPrice', 0) or item.get('price', 0) or 0
                    grouped_items[item_name]['totalPrice'] = grouped_items[item_name]['quantity'] * unit_price
                else:
                    # First occurrence - copy item and add quantity
                    grouped_item = item.copy()
                    grouped_item['quantity'] = 1
                    grouped_item['totalPrice'] = item.get('avg24hPrice', 0) or item.get('price', 0) or 0
                    grouped_items[item_name] = grouped_item

            # items = raw items for overlay (each item separate)
            # groupedItems = stacked items for left panel (x2, x3, etc.)
            result['items'] = raw_items
            result['groupedItems'] = list(grouped_items.values())
            result['item_count'] = len(raw_items)
            result['unique_item_count'] = len(grouped_items)

        return result

    except Exception as e:
        logger.error(f"[GearScanner] Scan error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


def _do_price_refresh_background():
    """Background thread function for price refresh - does NOT block the main server"""
    global last_price_refresh, price_refresh_running, florence_ocr

    if price_refresh_running:
        logger.info("[PRICES] Refresh already running, skipping...")
        return

    price_refresh_running = True

    try:
        logger.info("[PRICES] Background refresh started...")
        start_time = time.time()

        db_path = Path(__file__).parent / "shortnames.json"
        if not db_path.exists():
            logger.error("[PRICES] shortnames.json not found")
            return

        with open(db_path, 'r', encoding='utf-8') as f:
            shortnames_db = json.load(f)

        updated_count = 0
        failed_count = 0

        for shortname, item_data in shortnames_db.items():
            item_id = item_data.get('id')
            if not item_id:
                continue

            try:
                # Use shorter timeout to not block too long
                prices = _fetch_from_tarkov_dev(item_id, timeout=2)
                if prices:
                    if prices.get('fleaMarket'):
                        item_data['avg24hPrice'] = prices['fleaMarket']
                    if 'sellFor' not in item_data:
                        item_data['sellFor'] = {}
                    if prices.get('therapist'):
                        item_data['sellFor']['therapist'] = prices['therapist']
                    if prices.get('mechanic'):
                        item_data['sellFor']['mechanic'] = prices['mechanic']
                    updated_count += 1
                else:
                    failed_count += 1

                # Small delay to avoid rate limiting
                time.sleep(0.05)

            except Exception as e:
                # Silent fail - don't spam logs
                failed_count += 1

        # Save updated database
        with open(db_path, 'w', encoding='utf-8') as f:
            json.dump(shortnames_db, f, indent=2, ensure_ascii=False)

        # Reload database in Florence OCR engine if available
        if florence_ocr:
            florence_ocr._load_database()

        elapsed = time.time() - start_time
        last_price_refresh = time.time()

        logger.info(f"[PRICES] Background refresh done: {updated_count} updated, {failed_count} failed ({elapsed:.1f}s)")

    except Exception as e:
        logger.error(f"[PRICES] Background refresh error: {e}")
    finally:
        price_refresh_running = False


@app.post("/refresh-prices")
async def refresh_prices():
    """
    Trigger price refresh in background thread - returns immediately
    Does NOT block the scan endpoint
    """
    global price_refresh_running

    if not PRICE_FETCH_AVAILABLE or _fetch_from_tarkov_dev is None:
        raise HTTPException(
            status_code=503,
            detail="Price fetching not available"
        )

    if price_refresh_running:
        return {
            "success": False,
            "message": "Price refresh already in progress",
            "running": True
        }

    # Start background thread - returns immediately
    thread = threading.Thread(target=_do_price_refresh_background, daemon=True)
    thread.start()

    return {
        "success": True,
        "message": "Price refresh started in background",
        "running": True
    }


@app.get("/prices/status")
async def get_prices_status():
    """Get Google Sheet price status"""
    if GSHEET_AVAILABLE and gsheet_prices:
        stats = gsheet_prices.get_stats()
        return {
            "source": "google_sheet",
            "available": True,
            "loaded": stats.get("loaded", False),
            "item_count": stats.get("item_count", 0),
            "last_refresh_timestamp": stats.get("last_refresh", 0),
            "age_seconds": round(stats.get("age_seconds", -1), 1),
            "refresh_interval_seconds": stats.get("refresh_interval", 3600)
        }
    else:
        return {
            "source": "google_sheet",
            "available": False,
            "loaded": False,
            "item_count": 0
        }


# ============================================
# SCROLL DETECTION ENDPOINTS (hide overlay on scroll)
# ============================================

@app.post("/scroll/start")
async def start_scroll_listening():
    """Start listening for scroll events"""
    success = start_scroll_detection()
    return {"success": success, "is_listening": scroll_state["is_listening"]}


@app.post("/scroll/stop")
async def stop_scroll_listening():
    """Stop listening for scroll events"""
    stop_scroll_detection()
    return {"success": True, "is_listening": False}


@app.get("/scroll/check", include_in_schema=False)
async def check_scroll():
    """Check if scroll was detected (resets flag after reading) - No logging"""
    result = check_scroll_detected()
    return result


if __name__ == "__main__":
    print("=" * 60)
    print("TarkovTracker Scanner API - PURE OCR MODE")
    print("=" * 60)
    print()
    print("Endpoints:")
    print("  GET  /              - Health check")
    print("  POST /scan-ocr      - Florence-2 OCR scan (F4)")
    print("  POST /scan-gear     - Gear Zone scan (F3)")
    print("  GET  /ocr/stats     - OCR engine statistics")
    print("  GET  /prices/status - Google Sheet price status")
    print()
    print("Prices: Google Sheet (synced hourly with Tarkov Market)")
    print()
    uvicorn.run(app, host="127.0.0.1", port=8765, log_level="info")
