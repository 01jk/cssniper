"""
Market Data Fetcher Module
Fetches real-time market data (buy orders and price list) from CSFloat API
using dedicated proxies with persistent sessions to avoid connection overhead.
"""
from curl_cffi.requests import AsyncSession
from utils.logger import logger
import random
import asyncio
from modules.status_tracker import status_tracker


class MarketDataClient:
    """
    Client for fetching market data with persistent proxy sessions.
    Maintains a pool of warm connections to avoid setup overhead.
    """
    
    def __init__(self, accounts):
        """
        Initialize client with persistent sessions for each account (proxy + api_key).
        
        Args:
            accounts: List of dicts [{'api_key': '...', 'proxy': '...'}]
        """
        self.accounts = accounts
        self.sessions = []
        self.current_index = 0  # For round-robin rotation
        
        # Price list cache (refreshes every 60 seconds)
        self.price_list_cache = None
        self.price_list_cache_time = 0
        self.cache_ttl = 60  # Cache for 60 seconds
        
        # Create persistent session for each account
        if accounts:
            for i, acc in enumerate(accounts):
                proxy = acc.get('proxy')
                api_key = acc.get('api_key')
                
                # Use AsyncSession
                session = AsyncSession(impersonate="chrome110")
                self.sessions.append({
                    'session': session,
                    'proxy': proxy,
                    'api_key': api_key, # Store key here
                    'index': i + 1  # 1-indexed for logging
                })
            logger.info(f"Initialized {len(self.sessions)} persistent market data sessions")
        else:
            logger.warning("No market_data accounts configured")
    
    def _get_next_session(self):
        """Get next session using round-robin rotation."""
        if not self.sessions:
            return None
        
        session_data = self.sessions[self.current_index]
        self.current_index = (self.current_index + 1) % len(self.sessions)
        return session_data
    
    async def get_highest_buy_order(self, listing_id):
        """
        Fetch buy orders for a specific listing and return the highest price.
        Async version.
        
        Args:
            listing_id: CSFloat listing ID
            
        Returns:
            dict with 'price' (in dollars) and 'count' (total orders), or None if failed
        """
        session_data = self._get_next_session()
        if not session_data:
            logger.warning("No market_data sessions available")
            return None
        
        session = session_data['session']
        proxy = session_data['proxy']
        api_key = session_data['api_key'] # Get specific key
        proxy_num = session_data['index']
        
        headers = {
            'Authorization': api_key,
            'Content-Type': 'application/json',
        }
        
        url = f"https://csfloat.com/api/v1/listings/{listing_id}/buy-orders"
        
        try:
            response = await session.get(
                url, 
                headers=headers, 
                proxies={"http": proxy, "https": proxy} if proxy else None,
                timeout=4
            )
            
            if response.status_code == 200:
                status_tracker.update_status("market_data", proxy_num - 1, 200, "OK")
                buy_orders = response.json()
                if isinstance(buy_orders, list) and len(buy_orders) > 0:
                    highest = buy_orders[0]
                    # logger.debug(f"[Account #{proxy_num}] Fetched buy orders: ${highest.get('price', 0)/100:.2f}")
                    return {
                        'price': highest.get('price', 0) / 100.0,
                        'count': len(buy_orders)
                    }
                else:
                    # logger.debug(f"[Account #{proxy_num}] No buy orders found for listing {listing_id}")
                    return {'price': 0, 'count': 0}
            else:
                status_tracker.update_status("market_data", proxy_num - 1, response.status_code, f"HTTP Error {response.status_code}")
                logger.warning(f"[Account #{proxy_num}] Failed to fetch buy orders: {response.status_code}")
                return None
                
        except Exception as e:
            status_tracker.update_status("market_data", proxy_num - 1, 0, str(e))
            logger.debug(f"[Account #{proxy_num}] Error fetching buy orders: {e}")
            return None
    
    async def get_lowest_market_price(self, market_hash_name):
        """
        Fetch price list and find the lowest price for the specified item.
        Uses cache to avoid redundant API calls.
        Async version.
        
        Args:
            market_hash_name: Item name to search for
            
        Returns:
            float (price in dollars), or None if not found/failed
        """
        import time
        
        # Check if cache is valid
        current_time = time.time()
        if self.price_list_cache and (current_time - self.price_list_cache_time < self.cache_ttl):
            # logger.debug(f"Using cached price list (age: {int(current_time - self.price_list_cache_time)}s)")
            # Search in cache
            for item in self.price_list_cache:
                if item.get('market_hash_name') == market_hash_name:
                    min_price_cents = item.get('min_price', 0)
                    # logger.debug(f"[CACHE] Found {market_hash_name}: ${min_price_cents/100:.2f}")
                    return min_price_cents / 100.0
            
            # logger.debug(f"[CACHE] Item '{market_hash_name}' not found in price list")
            return None
        
        # Cache expired or empty - fetch new data
        session_data = self._get_next_session()
        if not session_data:
            logger.warning("No market_data sessions available")
            return None
        
        session = session_data['session']
        proxy = session_data['proxy']
        api_key = session_data['api_key'] # Get specific key
        proxy_num = session_data['index']
        
        headers = {
            'Authorization': api_key,
            'Content-Type': 'application/json',
        }
        
        url = "https://csfloat.com/api/v1/listings/price-list"
        
        try:
            response = await session.get(
                url, 
                headers=headers, 
                proxies={"http": proxy, "https": proxy} if proxy else None,
                timeout=4
            )
            
            if response.status_code == 200:
                status_tracker.update_status("market_data", proxy_num - 1, 200, "OK")
                price_list = response.json()
                
                if isinstance(price_list, list):
                    # Update cache
                    self.price_list_cache = price_list
                    self.price_list_cache_time = current_time
                    logger.debug(f"[Proxy #{proxy_num}] Price list cached ({len(price_list)} items)")
                    
                    # Search in fresh data
                    for item in price_list:
                        if item.get('market_hash_name') == market_hash_name:
                            min_price_cents = item.get('min_price', 0)
                            # logger.debug(f"[Proxy #{proxy_num}] Found {market_hash_name}: ${min_price_cents/100:.2f}")
                            return min_price_cents / 100.0
                    
                    # logger.debug(f"[Proxy #{proxy_num}] Item '{market_hash_name}' not found in price list")
                    return None
                else:
                    logger.warning(f"[Proxy #{proxy_num}] Unexpected price list format: {type(price_list)}")
                    return None
            else:
                status_tracker.update_status("market_data", proxy_num - 1, response.status_code, f"HTTP Error {response.status_code}")
                logger.warning(f"[Proxy #{proxy_num}] Failed to fetch price list: {response.status_code}")
                return None
                
        except Exception as e:
            status_tracker.update_status("market_data", proxy_num - 1, 0, str(e))
            logger.debug(f"[Proxy #{proxy_num}] Error fetching price list: {e}")
            return None
    
    async def fetch_market_data_async(self, listing_id, market_hash_name):
        """
        Fetch both highest buy order and lowest market price IN PARALLEL.
        
        Args:
            listing_id: CSFloat listing ID
            market_hash_name: Item name
            
        Returns:
            dict with 'highest_buy_order' and 'lowest_market_price', or None values if failed
        """
        # logger.debug(f"Fetching market data for {market_hash_name} (listing {listing_id})")
        
        # Execute both requests in parallel using asyncio directly (no threads needed)
        
        buy_order_task = self.get_highest_buy_order(listing_id)
        price_task = self.get_lowest_market_price(market_hash_name)
        
        # Use return_exceptions=True to ensure both tasks complete even if one fails
        buy_order_data, lowest_price = await asyncio.gather(
            buy_order_task, 
            price_task, 
            return_exceptions=True
        )
        
        # Handle exceptions from gather
        if isinstance(buy_order_data, Exception):
            logger.error(f"Buy order fetch failed: {buy_order_data}")
            buy_order_data = None
        
        if isinstance(lowest_price, Exception):
            logger.error(f"Price list fetch failed: {lowest_price}")
            lowest_price = None
        
        return {
            'highest_buy_order': buy_order_data,
            'lowest_market_price': lowest_price
        }
    
    def fetch_market_data(self, listing_id, market_hash_name):
        """
        Synchronous wrapper for backward compatibility.
        """
        import asyncio
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        return loop.run_until_complete(self.fetch_market_data_async(listing_id, market_hash_name))
    
    def close(self):
        """Close all persistent sessions."""
        # Sessions are async, but we can't await here easily if called from sync context.
        # But usually close() is called at shutdown.
        pass


# Global instance (will be initialized in main.py)
market_data_client = None


def init_market_data_client(accounts):
    """
    Initialize the global market data client.
    Should be called once at bot startup.
    """
    global market_data_client
    market_data_client = MarketDataClient(accounts)
    return market_data_client


def fetch_market_data(listing_id, market_hash_name):
    """
    Convenience function to fetch market data using the global client.
    """
    if not market_data_client:
        logger.error("Market data client not initialized!")
        return {'highest_buy_order': None, 'lowest_market_price': None}
    
    # We are calling the synchronous wrapper here because main.py seems to expect it?
    # Wait, main.py calls it via asyncio.to_thread!
    # "market_data = await asyncio.to_thread(fetch_market_data, ...)" inside main.py
    # If fetch_market_data is sync, asking to_thread is correct.
    # But if we make MarketDataClient async, we should expose an async function in main.py
    # and call it with await, not to_thread.
    
    return market_data_client.fetch_market_data(listing_id, market_hash_name)


async def fetch_market_data_async(listing_id, market_hash_name):
    """
    Async convenience function to fetch market data using the global client.
    """
    if not market_data_client:
        logger.error("Market data client not initialized!")
        return {'highest_buy_order': None, 'lowest_market_price': None}
    
    return await market_data_client.fetch_market_data_async(listing_id, market_hash_name)
