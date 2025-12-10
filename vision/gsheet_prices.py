"""
Google Sheet Price Loader for TarkovTracker
============================================
Loads real-time prices from a Google Sheet that syncs with Tarkov Market API every hour.
"""

import requests
import csv
import io
import time
import logging
import threading
from typing import Optional, Dict
from pathlib import Path

logger = logging.getLogger(__name__)

# Google Sheet configuration
GOOGLE_SHEET_ID = "1ZLXBGhg28K1Rm0FTeTVbDDN1aCogQncZG3tczg_SZbo"
GOOGLE_SHEET_CSV_URL = f"https://docs.google.com/spreadsheets/d/{GOOGLE_SHEET_ID}/export?format=csv"

# Price data cache
_price_data: Dict[str, Dict] = {}
_last_refresh: float = 0
REFRESH_INTERVAL = 3600  # 1 hour in seconds
_refresh_lock = threading.Lock()
_is_loading = False


def _normalize_name(name: str) -> str:
    """Normalize item name for matching"""
    return name.lower().strip()


def load_prices_from_sheet() -> bool:
    """
    Load prices from Google Sheet CSV export.
    Returns True if successful.
    """
    global _price_data, _last_refresh, _is_loading

    if _is_loading:
        logger.info("[GSheet] Already loading, skipping...")
        return False

    with _refresh_lock:
        _is_loading = True

    try:
        logger.info("[GSheet] Fetching prices from Google Sheet...")
        start_time = time.time()

        # Fetch CSV from Google Sheets (allow redirects)
        response = requests.get(
            GOOGLE_SHEET_CSV_URL,
            timeout=30,
            allow_redirects=True,
            headers={'User-Agent': 'TarkovTracker/1.0'}
        )

        if response.status_code != 200:
            logger.error(f"[GSheet] Failed to fetch: HTTP {response.status_code}")
            return False

        # Parse CSV
        csv_content = response.content.decode('utf-8')

        # Debug: log first 200 chars
        logger.info(f"[GSheet] Response length: {len(csv_content)} chars")

        # Skip first row (contains "last update" timestamp, not headers)
        lines = csv_content.split('\n')
        if lines and lines[0].startswith('last update'):
            logger.info(f"[GSheet] {lines[0].strip()}")  # Log the update timestamp
            csv_content = '\n'.join(lines[1:])  # Skip the first row

        reader = csv.DictReader(io.StringIO(csv_content))

        new_data = {}
        count = 0

        for row in reader:
            try:
                name = row.get('name', '').strip()
                if not name:
                    continue

                # Parse prices (handle comma-separated numbers)
                def parse_price(val):
                    if not val:
                        return 0
                    # Remove commas and convert to int
                    try:
                        return int(str(val).replace(',', '').replace(' ', '').strip())
                    except:
                        return 0

                item_data = {
                    'uid': row.get('uid', ''),
                    'name': name,
                    'price': parse_price(row.get('price')),  # Current Flea price
                    'avg24hPrice': parse_price(row.get('avg24hPrice')),
                    'avg7daysPrice': parse_price(row.get('avg7daysPrice')),
                    'traderName': row.get('trader', '').strip(),
                    'traderPrice': parse_price(row.get('buy back price')),
                    'currency': row.get('cur', '₽').strip()
                }

                # Index by normalized name for fast lookup
                key = _normalize_name(name)
                new_data[key] = item_data
                count += 1

            except Exception as e:
                logger.debug(f"[GSheet] Error parsing row: {e}")
                continue

        if count > 0:
            _price_data = new_data
            _last_refresh = time.time()
            elapsed = time.time() - start_time
            logger.info(f"[GSheet] Loaded {count} items in {elapsed:.1f}s")
            return True
        else:
            logger.warning("[GSheet] No items loaded from sheet")
            return False

    except Exception as e:
        logger.error(f"[GSheet] Error loading prices: {e}")
        return False
    finally:
        _is_loading = False


def get_price(item_name: str) -> Optional[Dict]:
    """
    Get price data for an item by name.
    Returns dict with fleaPrice, traderName, traderPrice, slots, etc.
    """
    global _price_data, _last_refresh

    # Auto-refresh if data is stale (older than 1 hour)
    if time.time() - _last_refresh > REFRESH_INTERVAL:
        # Refresh in background thread to not block
        thread = threading.Thread(target=load_prices_from_sheet, daemon=True)
        thread.start()

    if not _price_data:
        return None

    # Try exact match first
    key = _normalize_name(item_name)
    if key in _price_data:
        return _price_data[key]

    # Try partial match (item name contains search term)
    for stored_key, data in _price_data.items():
        if key in stored_key or stored_key in key:
            return data

    return None


def get_price_by_shortname(short_name: str) -> Optional[Dict]:
    """
    Get price data by short name (fuzzy search in item names).
    """
    if not _price_data:
        return None

    search = _normalize_name(short_name)

    # Look for items where the name contains the short name
    for key, data in _price_data.items():
        name_lower = data['name'].lower()
        # Check if short name is at the start or is a significant part
        if name_lower.startswith(search) or f" {search}" in name_lower:
            return data

    return None


def is_loaded() -> bool:
    """Check if price data is loaded"""
    return len(_price_data) > 0


def get_stats() -> Dict:
    """Get statistics about the price data"""
    return {
        "loaded": is_loaded(),
        "item_count": len(_price_data),
        "last_refresh": _last_refresh,
        "age_seconds": time.time() - _last_refresh if _last_refresh > 0 else -1,
        "refresh_interval": REFRESH_INTERVAL
    }


# Auto-load on module import
def init():
    """Initialize price data (call at startup)"""
    logger.info("[GSheet] Initializing price data...")
    success = load_prices_from_sheet()
    if success:
        logger.info(f"[GSheet] Ready with {len(_price_data)} items")
    else:
        logger.warning("[GSheet] Failed to load initial data, will retry on first request")
    return success
