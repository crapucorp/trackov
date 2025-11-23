"""
Tarkov.dev API service for fetching real-time item prices
Supports multiple API sources with fallback logic
"""

import requests
import json
import time
import os
from typing import Optional, Dict
from urllib.parse import quote
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

# API endpoints
TARKOV_DEV_API = "https://api.tarkov.dev/graphql"
TARKOV_MARKET_API = "https://api.tarkov-market.app/api/v1/item"

# Tarkov Market API key (Pro subscription) - loaded from .env
TARKOV_MARKET_KEY = os.getenv('TARKOV_MARKET_API_KEY')

# Cache for API results (item_id -> {prices, timestamp, source})
_price_cache = {}
CACHE_TTL = 300  # 5 minutes cache

def get_item_prices(item_id: str, item_name: str = None) -> Optional[Dict]:
    """
    Fetch item prices with multi-API fallback
    Priority: Tarkov Market (real-time) → tarkov.dev → static data
    Returns dict with fleaMarket, therapist, and mechanic prices
    """
    
    # Check cache first
    if item_id in _price_cache:
        cached = _price_cache[item_id]
        age = time.time() - cached['timestamp']
        if age < CACHE_TTL:
            print(f"   💾 Using cached prices ({int(age)}s old, source: {cached.get('source', 'unknown')})")
            return cached['prices']
    
    # Try Tarkov Market first (real-time, Pro subscription)
    if TARKOV_MARKET_KEY and item_name:
        try:
            print(f"   🔍 Trying Tarkov Market API...")
            prices = _fetch_from_tarkov_market(item_name, timeout=3)
            if prices:
                _cache_prices(item_id, prices, 'Tarkov Market')
                return prices
        except Exception as e:
            print(f"   ⚠️ Tarkov Market error: {e}")
    
    # Fallback to tarkov.dev (free, GraphQL)
    try:
        print(f"   🔍 Trying tarkov.dev API...")
        prices = _fetch_from_tarkov_dev(item_id, timeout=3)
        if prices:
            _cache_prices(item_id, prices, 'tarkov.dev')
            return prices
    except Exception as e:
        print(f"   ⚠️ tarkov.dev error: {e}")
    
    # All APIs failed - return None (will use static data)
    print("   📦 All APIs unavailable, using static data")
    return None

def _cache_prices(item_id: str, prices: Dict, source: str):
    """Cache prices with source info"""
    _price_cache[item_id] = {
        'prices': prices,
        'timestamp': time.time(),
        'source': source
    }

def _fetch_from_tarkov_market(item_name: str, timeout: int) -> Optional[Dict]:
    """Fetch from Tarkov Market API (real-time prices)"""
    
    # URL encode the item name
    encoded_name = quote(item_name)
    url = f"{TARKOV_MARKET_API}?q={encoded_name}"
    
    response = requests.get(
        url,
        headers={"x-api-key": TARKOV_MARKET_KEY},
        timeout=timeout
    )
    
    if response.status_code != 200:
        print(f"   ⚠️ Tarkov Market API error: {response.status_code}")
        return None
    
    data = response.json()
    
    if not data or len(data) == 0:
        print(f"   ⚠️ Item not found in Tarkov Market")
        return None
    
    # Take first result
    item = data[0]
    
    # Extract prices
    prices = {
        'fleaMarket': item.get('price') or item.get('avg24hPrice'),
        'therapist': None,
        'mechanic': None
    }
    
    # Tarkov Market returns best trader price
    trader_name = item.get('traderName')
    trader_price = item.get('traderPrice')
    
    if trader_name and trader_price:
        if trader_name == 'Therapist':
            prices['therapist'] = trader_price
        elif trader_name == 'Mechanic':
            prices['mechanic'] = trader_price
    
    print(f"   💰 Prices from Tarkov Market ({item.get('name')}):")
    print(f"      Flea: {prices['fleaMarket']}₽")
    print(f"      Best Trader ({trader_name}): {trader_price}₽")
    
    return prices

def _fetch_from_tarkov_dev(item_id: str, timeout: int) -> Optional[Dict]:
    """Fetch from tarkov.dev API (GraphQL)"""
    
    query = """
    query GetItemById($id: ID!) {
        item(id: $id) {
            id
            name
            avg24hPrice
            sellFor {
                vendor {
                    name
                }
                priceRUB
            }
        }
    }
    """
    
    response = requests.post(
        TARKOV_DEV_API,
        json={
            "query": query,
            "variables": {"id": item_id}
        },
        timeout=timeout
    )
    
    if response.status_code != 200:
        print(f"   ⚠️ tarkov.dev API error: {response.status_code}")
        return None
    
    data = response.json()
    
    if not data.get('data') or not data['data'].get('item'):
        print(f"   ⚠️ Item not found in tarkov.dev")
        return None
    
    item = data['data']['item']
    
    # Extract prices
    prices = {
        'fleaMarket': item.get('avg24hPrice'),
        'therapist': None,
        'mechanic': None
    }
    
    # Find vendor prices
    for sell in item.get('sellFor', []):
        vendor_name = sell.get('vendor', {}).get('name')
        price = sell.get('priceRUB')
        
        if vendor_name == 'Therapist':
            prices['therapist'] = price
        elif vendor_name == 'Mechanic':
            prices['mechanic'] = price
    
    print(f"   💰 Prices from tarkov.dev ({item.get('name')}):")
    print(f"      Flea: {prices['fleaMarket']}₽")
    print(f"      Therapist: {prices['therapist']}₽")
    print(f"      Mechanic: {prices['mechanic']}₽")
    
    return prices
