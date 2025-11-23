"""
Tarkov.dev API service for fetching real-time item prices
"""

import requests
import json
import time
from typing import Optional, Dict

TARKOV_DEV_API = "https://api.tarkov.dev/graphql"

# Cache for API results (item_name -> {prices, timestamp})
_price_cache = {}
CACHE_TTL = 300  # 5 minutes cache

def get_item_prices(item_name: str) -> Optional[Dict]:
    """
    Fetch item prices from tarkov.dev API with caching
    Returns dict with fleaMarket, therapist, and mechanic prices
    """
    
    # Check cache first
    if item_name in _price_cache:
        cached = _price_cache[item_name]
        age = time.time() - cached['timestamp']
        if age < CACHE_TTL:
            print(f"   💾 Using cached prices ({int(age)}s old)")
            return cached['prices']
    
    # GraphQL query to search items (more flexible than exact name match)
    query = """
    query SearchItems($name: String!) {
        items(name: $name) {
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
                "variables": {"name": item_name}
            },
            timeout=5
        )
        
        if response.status_code != 200:
            print(f"   ⚠️ API error: {response.status_code}")
            return None
        
        data = response.json()
        
        if not data.get('data') or not data['data'].get('items') or len(data['data']['items']) == 0:
            print(f"   ⚠️ No items found in API for '{item_name}'")
            return None
        
        # Take first result (best match)
        item = data['data']['items'][0]
        
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
        _price_cache[item_name] = {
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
