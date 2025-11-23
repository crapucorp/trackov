"""
Tarkov.dev API service for fetching real-time item prices
"""

import requests
import json
import time
from typing import Optional, Dict

TARKOV_DEV_API = "https://api.tarkov.dev/graphql"

# Cache for API results (item_id -> {prices, timestamp})
_price_cache = {}
CACHE_TTL = 300  # 5 minutes cache (matches API update frequency)

def get_item_prices(item_id: str, item_name: str = None) -> Optional[Dict]:
    """
    Fetch item prices from tarkov.dev API with caching
    Uses item ID for fast, accurate lookup
    Returns dict with fleaMarket, therapist, and mechanic prices
    """
    
    # Check cache first
    if item_id in _price_cache:
        cached = _price_cache[item_id]
        age = time.time() - cached['timestamp']
        if age < CACHE_TTL:
            print(f"   💾 Using cached prices ({int(age)}s old)")
            return cached['prices']
    
    # GraphQL query using item ID (faster and more accurate)
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
    
    try:
        response = requests.post(
            TARKOV_DEV_API,
            json={
                "query": query,
                "variables": {"id": item_id}
            },
            timeout=5
        )
        
        if response.status_code != 200:
            print(f"   ⚠️ API error: {response.status_code}")
            return None
        
        data = response.json()
        
        if not data.get('data') or not data['data'].get('item'):
            print(f"   ⚠️ Item not found in API (ID: {item_id})")
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
        
        # Cache the result
        _price_cache[item_id] = {
            'prices': prices,
            'timestamp': time.time()
        }
        
        return prices
        
    except requests.exceptions.Timeout:
        print("   ⚠️ API timeout")
        return None
    except Exception as e:
        print(f"   ⚠️ API error: {e}")
        return None
