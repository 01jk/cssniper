import asyncio
import random
import time
import logging
import yaml
import os
import json
from curl_cffi.requests import AsyncSession
from typing import List, Optional, Callable, Dict
from modules.queue_manager import QueueManager
from modules.status_tracker import status_tracker

logger = logging.getLogger("CSSniper")

class AsyncScanner:
    def __init__(self, settings: dict):
        self.settings = settings
        
        # New Multi-Account Structure
        # Expected format: [{'api_key': '...', 'proxy': '...', 'enabled': True/False}, ...]
        all_scanner_accounts = settings.get('scanner', {}).get('accounts', [])
        all_auto_buy_accounts = settings.get('auto_buy', {}).get('accounts', [])
        
        # Filter to only enabled accounts (enabled is True or not set - defaults to enabled)
        self.scanner_accounts = [acc for acc in all_scanner_accounts if acc.get('enabled', True) is not False]
        self.auto_buy_accounts = [acc for acc in all_auto_buy_accounts if acc.get('enabled', True) is not False]
        
        # Log how many accounts were filtered out
        filtered_scanner = len(all_scanner_accounts) - len(self.scanner_accounts)
        filtered_autobuy = len(all_auto_buy_accounts) - len(self.auto_buy_accounts)
        if filtered_scanner > 0:
            logger.info(f"Filtered out {filtered_scanner} disabled scanner accounts")
        if filtered_autobuy > 0:
            logger.info(f"Filtered out {filtered_autobuy} disabled auto-buy accounts")
        
        # Fallback for migration/safety if old config exists
        if not self.scanner_accounts and settings.get('scanner', {}).get('api_key'):
             # Migrate old single-account style temporarily in memory
            self.scanner_accounts = [{
                'api_key': settings.get('scanner', {}).get('api_key'),
                'proxy': p,
                'enabled': True
            } for p in settings.get('scanner', {}).get('monitoring_proxies', [])]

        if not self.auto_buy_accounts and settings.get('scanner', {}).get('sniper_proxy'):
             self.auto_buy_accounts = [{
                'api_key': settings.get('scanner', {}).get('api_key'),
                'proxy': settings.get('scanner', {}).get('sniper_proxy'),
                'enabled': True
            }]
            
        self.poll_min = settings.get('scanner', {}).get('poll_interval_min', 0.5)
        self.poll_max = settings.get('scanner', {}).get('poll_interval_max', 2.0)
        self.pre_min = settings.get('scanner', {}).get('pre_delay_min', 0.2)
        self.pre_max = settings.get('scanner', {}).get('pre_delay_max', 0.8)
        self.request_timeout = settings.get('scanner', {}).get('request_timeout', 5)
        
        self.monitoring_sessions: List[AsyncSession] = []
        self.monitoring_cooldowns: List[float] = [] # Timestamps when proxy becomes available
        self.sniper_session: Optional[AsyncSession] = None
        self.sniper_cooldown = 0
        
        self.callback: Optional[Callable] = None
        self.is_running = False
        self.tasks = []
        
        # Queue management system
        self.queue_manager = QueueManager(settings) if settings.get('scanner', {}).get('queue_config', {}).get('enabled', False) else None
        
        # Track notified errors to avoid spam (proxy_idx -> set of error types)
        self.notified_errors = {}
        
        # Session recycling settings
        self.max_requests_per_session = settings.get('scanner', {}).get('max_requests_per_session', 50)
        self.max_session_age_minutes = settings.get('scanner', {}).get('max_session_age_minutes', 10)
        
        # Track session statistics for each worker
        self.session_request_counts: List[int] = []  # Request count per session
        self.session_created_times: List[float] = []  # Creation timestamp per session
        self.session_recycling_locks: List[asyncio.Lock] = []  # Locks for safe recycling
        
        # Proxy rotation system
        self.proxy_backup_pools: Dict[int, List[str]] = {}  # idx -> list of backup IPs
        self.proxy_disabled: List[bool] = []  # Track temporarily disabled proxies
        self.proxy_error_counts: Dict[int, int] = {}  # Count consecutive errors per proxy
        self.settings_file_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config", "settings.yaml")
        
        # Load backup IP pools from settings
        for i, account in enumerate(self.scanner_accounts):
            self.proxy_backup_pools[i] = account.get('backup_ips', [])
            logger.info(f"Scanner Account {i+1}: {len(self.proxy_backup_pools[i])} backup IPs loaded")
        
        # Dynamic min price tracking
        self.current_min_price = 100  # Default fallback (100 cents = $1)
        self.last_min_price_update = 0
        self.min_price_update_interval = 60  # Update every 60 seconds
        self.last_scan_duration = 0.0  # Last successful scan time in seconds
        self.stats_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), "bot_stats.json")

    async def _update_dynamic_min_price(self):
        """Update the minimum price based on active targets."""
        try:
            from database.database import get_db
            from database.models import TargetSkin
            
            # Get database session
            db = next(get_db())
            
            # Query active targets and find the minimum min_price
            active_targets = db.query(TargetSkin).filter(
                TargetSkin.is_active == True,
                TargetSkin.min_price > 0  # Only consider targets with positive min_price
            ).all()
            
            if active_targets:
                # Find the lowest min_price among all active targets
                lowest_price = min(target.min_price for target in active_targets)
                # Convert to cents (multiply by 100)
                self.current_min_price = int(lowest_price * 100)
                logger.info(f"💰 [DYNAMIC MIN PRICE] Updated to ${lowest_price:.2f} ({self.current_min_price} cents) based on {len(active_targets)} active targets")
            else:
                # No active targets, use safe default
                self.current_min_price = 100  # $1 in cents
                logger.info(f"💰 [DYNAMIC MIN PRICE] No active targets found, using default ${self.current_min_price/100:.2f}")
                
            self.last_min_price_update = time.time()
            
        except Exception as e:
            logger.error(f"❌ [DYNAMIC MIN PRICE] Failed to update min price: {e}")
            # Use safe default on error
            self.current_min_price = 100
        finally:
            try:
                db.close()
            except:
                pass
    
    async def _get_cache_busting_url(self, base_url: str) -> str:
        """Generate URL with cache-busting parameters."""
        import time
        
        # Add cache-busting parameters
        timestamp = int(time.time() * 1000)  # Current timestamp in milliseconds
        random_value = random.randint(1, 999999)  # Random number for additional uniqueness
        
        # Build URL with parameters
        separator = "&" if "?" in base_url else "?"
        url_with_cache = f"{base_url}{separator}_={timestamp}&v={random_value}"
        
        return url_with_cache
    
    async def _should_recycle_session(self, idx: int) -> bool:
        """Check if session needs recycling based on request count or age."""
        request_count = self.session_request_counts[idx]
        session_age = time.time() - self.session_created_times[idx]
        max_age_seconds = self.max_session_age_minutes * 60
        
        return request_count >= self.max_requests_per_session or session_age >= max_age_seconds
    
    async def _recycle_session(self, idx: int):
        """Recycle a single session in the background."""
        async with self.session_recycling_locks[idx]:
            if not await self._should_recycle_session(idx):
                return  # Another worker already recycled it
            
            logger.info(f"🔄 [SESSION RECYCLING] Starting session recycling for Proxy #{idx+1}")
            logger.info(f"📊 [SESSION RECYCLING] Request count: {self.session_request_counts[idx]}, Age: {(time.time() - self.session_created_times[idx])/60:.1f}min")
            
            try:
                # Close old session
                await self.monitoring_sessions[idx].close()
                
                # Create new session
                account = self.scanner_accounts[idx]
                new_session = await self._create_session(
                    account.get('proxy'), 
                    account.get('api_key')
                )
                self.monitoring_sessions[idx] = new_session
                
                # Reset counters
                self.session_request_counts[idx] = 0
                self.session_created_times[idx] = time.time()
                
                logger.info(f"✅ [SESSION RECYCLING] Session recycled successfully for Proxy #{idx+1}")
                
            except Exception as e:
                logger.error(f"❌ [SESSION RECYCLING] Failed to recycle session for Proxy #{idx+1}: {e}")
                # Mark proxy as temporarily disabled if recycling fails
                self.monitoring_cooldowns[idx] = time.time() + 30
    
    async def _create_session(self, proxy: Optional[str] = None, api_key: Optional[str] = None) -> AsyncSession:
        """Create a curl_cffi AsyncSession with Chrome impersonation."""
        session = AsyncSession(impersonate="chrome120")
        session.headers.update({
            "Authorization": api_key if api_key else "",
            "Accept": "application/json",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Referer": "https://csfloat.com/",
            "Origin": "https://csfloat.com",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        })
        if proxy:
            session.proxies = {"http": proxy, "https": proxy}
        return session

    async def initialize(self):
        """Initialize sessions (proxied or direct)."""
        logger.info(f"Initializing Multi-Account System...")
        
        # Initialize monitoring sessions (Scanner Mode)
        if self.scanner_accounts:
            for i, account in enumerate(self.scanner_accounts):
                proxy = account.get('proxy')
                api_key = account.get('api_key')
                if proxy:
                    session = await self._create_session(proxy, api_key)
                    self.monitoring_sessions.append(session)
                    self.monitoring_cooldowns.append(0)
                    logger.info(f"Scanner Session {i+1} initialized (Proxy: {proxy.split('@')[-1]})")
                else:
                    logger.warning(f"Scanner Account {i+1} missing proxy! Initializing direct.")
                    session = await self._create_session(None, api_key)
                    self.monitoring_sessions.append(session)
                    self.monitoring_cooldowns.append(0)
                
                # Initialize proxy rotation tracking
                self.proxy_disabled.append(False)
                self.proxy_error_counts[i] = 0
                
                # Initialize session tracking
                self.session_request_counts.append(0)
                self.session_created_times.append(time.time())
                self.session_recycling_locks.append(asyncio.Lock())
        else:
             logger.warning("No Scanner Accounts configured!")

        # Initialize sniping session (Auto Buy Mode)
        # For now, we just pick the FIRST configured auto-buy account
        if self.auto_buy_accounts:
            account = self.auto_buy_accounts[0]
            proxy = account.get('proxy')
            api_key = account.get('api_key')
            
            self.sniper_session = await self._create_session(proxy, api_key)
            if proxy:
                logger.info(f"Sniper Session initialized (Proxy: {proxy.split('@')[-1]})")
            else:
                logger.info(f"Sniper Session initialized (Direct connection)")
        else:
            logger.warning("No Auto-Buy Accounts configured! Sniping may fail.")
            # Fallback to direct connection without key if none provided? Or just don't init?
            # Creating a session anyway to avoid crashing, but it won't be able to buy without auth
            self.sniper_session = await self._create_session()

    async def _keep_warm(self):
        """Background task to keep the sniper session warm."""
        logger.info("Sniper Keep-Warm task started.")
        while self.is_running:
            if time.time() < self.sniper_cooldown:
                await asyncio.sleep(5)
                continue

            try:
                # Lightweight ping to keep connection alive
                url = "https://csfloat.com/api/v1/listings?limit=1"
                resp = await self.sniper_session.get(url, timeout=10)
                if resp.status_code == 200:
                    status_tracker.update_status("auto_buy", 0, 200, "OK")
                    logger.debug("Sniper session warm-up successful.")
                elif resp.status_code == 429:
                    wait_time = float(resp.headers.get("Retry-After", 120))
                    status_tracker.update_status("auto_buy", 0, 429, "Rate limited")
                    logger.warning(f"Sniper session warm-up hit 429. Backing off for {wait_time}s")
                    self.sniper_cooldown = time.time() + wait_time
                else:
                    status_tracker.update_status("auto_buy", 0, resp.status_code, f"HTTP Error {resp.status_code}")
                    logger.warning(f"Sniper session warm-up returned status {resp.status_code}")
            except Exception as e:
                status_tracker.update_status("auto_buy", 0, 0, str(e))
                logger.error(f"Error in sniper warm-up: {e}")
            
            await asyncio.sleep(30) # Ping every 30s as requested

    async def _handle_timeout_error(self, idx: int):
        """Handle timeout error by rotating to backup IP."""
        logger.warning(f"🔄 [PROXY ROTATION] Starting rotation procedure for Proxy #{idx+1}")
        
        # Increment error count
        self.proxy_error_counts[idx] = self.proxy_error_counts.get(idx, 0) + 1
        logger.info(f"📊 [PROXY ROTATION] Proxy #{idx+1} error count: {self.proxy_error_counts[idx]}")
        
        # Check if we have backup IPs
        if not self.proxy_backup_pools.get(idx):
            logger.error(f"❌ [PROXY ROTATION] Proxy #{idx+1} has no backup IPs configured! Disabling proxy.")
            self.proxy_disabled[idx] = True
            self.monitoring_cooldowns[idx] = time.time() + 300  # 5 min cooldown
            self._send_proxy_error_notification(idx + 1, "No Backup IPs", "Proxy disabled - no backup IPs available")
            return
        
        # Get next backup IP (rotate through the pool)
        backup_ip = self.proxy_backup_pools[idx][0]
        logger.info(f"🔄 [PROXY ROTATION] Selected backup IP for Proxy #{idx+1}: {backup_ip.split('@')[-1]}")
        
        # Close current session
        try:
            logger.info(f"🔒 [PROXY ROTATION] Closing session for Proxy #{idx+1}...")
            await self.monitoring_sessions[idx].close()
            logger.info(f"✅ [PROXY ROTATION] Session closed successfully for Proxy #{idx+1}")
        except Exception as e:
            logger.warning(f"⚠️ [PROXY ROTATION] Error closing session for Proxy #{idx+1}: {e}")
        
        # Update settings.yaml with new IP
        try:
            logger.info(f"💾 [PROXY ROTATION] Updating settings.yaml for Proxy #{idx+1}...")
            with open(self.settings_file_path, 'r', encoding='utf-8') as f:
                settings = yaml.safe_load(f)
            
            old_proxy = settings['scanner']['accounts'][idx]['proxy']
            settings['scanner']['accounts'][idx]['proxy'] = backup_ip
            
            # Rotate backup IPs (move used IP to end of list)
            self.proxy_backup_pools[idx].append(self.proxy_backup_pools[idx].pop(0))
            settings['scanner']['accounts'][idx]['backup_ips'] = self.proxy_backup_pools[idx]
            
            with open(self.settings_file_path, 'w', encoding='utf-8') as f:
                yaml.safe_dump(settings, f, default_flow_style=False, allow_unicode=True)
            
            logger.info(f"✅ [PROXY ROTATION] Settings updated for Proxy #{idx+1}")
            logger.info(f"📝 [PROXY ROTATION] Old IP: {old_proxy.split('@')[-1]}")
            logger.info(f"📝 [PROXY ROTATION] New IP: {backup_ip.split('@')[-1]}")
        except Exception as e:
            logger.error(f"❌ [PROXY ROTATION] Failed to update settings for Proxy #{idx+1}: {e}")
            self.proxy_disabled[idx] = True
            return
        
        # Create new session with backup IP
        try:
            logger.info(f"🔌 [PROXY ROTATION] Creating new session for Proxy #{idx+1}...")
            api_key = self.scanner_accounts[idx].get('api_key')
            new_session = await self._create_session(backup_ip, api_key)
            self.monitoring_sessions[idx] = new_session
            logger.info(f"✅ [PROXY ROTATION] New session created for Proxy #{idx+1}")
        except Exception as e:
            logger.error(f"❌ [PROXY ROTATION] Failed to create new session for Proxy #{idx+1}: {e}")
            self.proxy_disabled[idx] = True
            return
        
        # Reset error count and cooldown
        self.proxy_error_counts[idx] = 0
        self.monitoring_cooldowns[idx] = 0
        logger.info(f"✅ [PROXY ROTATION] Proxy #{idx+1} rotation completed successfully!")
        
        # Send notification
        try:
            from modules.notifier import notifier
            message = f"""🔄 *PROXY ROTATED* 🔄

🔌 *Proxy:* #{idx+1}
📝 *Old IP:* `{old_proxy.split('@')[-1]}`
🆕 *New IP:* `{backup_ip.split('@')[-1]}`
✅ *Status:* Session recreated successfully
📊 *Backup IPs remaining:* {len(self.proxy_backup_pools[idx])}
"""
            notifier.send_message(message)
            logger.info(f"📱 [PROXY ROTATION] Notification sent for Proxy #{idx+1}")
        except Exception as e:
            logger.error(f"❌ [PROXY ROTATION] Failed to send notification: {e}")
    
    async def _process_scan(self, idx: int) -> bool:
        """Process a single scan for a specific account index."""
        try:
            # Skip if rate limited or on cooldown
            if time.time() < self.monitoring_cooldowns[idx]:
                return False

            session = self.monitoring_sessions[idx]
            if session is None:
                # Try to recreate session if missing
                try:
                    account = self.scanner_accounts[idx]
                    self.monitoring_sessions[idx] = await self._create_session(
                        account.get('proxy'),
                        account.get('api_key')
                    )
                    session = self.monitoring_sessions[idx]
                except Exception as e:
                    logger.error(f"❌ [SCANNER] Failed to recreate session {idx}: {e}")
                    self.monitoring_cooldowns[idx] = time.time() + 60
                    return False

            # Base URL
            base_url = "https://csfloat.com/api/v1/listings?limit=30&sort_by=most_recent&type_name=Skin"
            
            # Update dynamic min price (only doing this check on account 0 to avoid redundant checks)
            if idx == 0 and time.time() - self.last_min_price_update > self.min_price_update_interval:
                asyncio.create_task(self._update_dynamic_min_price())

            # Increment request counter
            self.session_request_counts[idx] += 1

            # Build URL
            url_with_params = f"{base_url}&min_price={self.current_min_price}"
            url = await self._get_cache_busting_url(url_with_params)

            # Make request
            start_req = time.time()
            response = await session.get(url, timeout=self.request_timeout)
            self.last_scan_duration = time.time() - start_req

            # Write stats to file for the API to read
            try:
                with open(self.stats_file, 'w') as f:
                    json.dump({"last_scan_duration": self.last_scan_duration}, f)
            except:
                pass

            if response.status_code == 200:
                data = response.json()
                status_tracker.update_status("scanner", idx, 200, "OK")
                if self.callback:
                    if asyncio.iscoroutinefunction(self.callback):
                        await self.callback(data)
                    else:
                        self.callback(data)

                # Session recycling check
                if await self._should_recycle_session(idx):
                    asyncio.create_task(self._recycle_session(idx))
                
                return True

            elif response.status_code == 429:
                wait_time = float(response.headers.get("Retry-After", 60))
                logger.warning(f"🚫 [SCANNER] Account {idx+1} Rate limited. Cooling {wait_time}s")
                status_tracker.update_status("scanner", idx, 429, "Rate limited")
                self.monitoring_cooldowns[idx] = time.time() + wait_time

                if self.queue_manager:
                    self.queue_manager.mark_rate_limit(idx, wait_time)
                return False

            else:
                logger.error(f"❌ [SCANNER] Account {idx+1} Error {response.status_code}")
                status_tracker.update_status("scanner", idx, response.status_code, f"HTTP Error {response.status_code}")
                self.monitoring_cooldowns[idx] = time.time() + 5
                return False

        except Exception as e:
            error_str = str(e).lower()
            logger.error(f"❌ [SCANNER] Account {idx+1} Error: {e}")

            if "28" in error_str or "timed out" in error_str:
                logger.warning(f"🚫 [SCANNER] Account {idx+1} Timeout. Rotating...")
                status_tracker.update_status("scanner", idx, 0, "Timeout")
                await self._handle_timeout_error(idx)
            elif "56" in error_str or "connection reset" in error_str:
                logger.warning(f"🚫 [SCANNER] Account {idx+1} Connection reset. Rotating...")
                status_tracker.update_status("scanner", idx, 0, "Connection Reset")
                await self._handle_timeout_error(idx)
            elif "(7)" in error_str or "connection closed" in error_str:
                logger.warning(f"⚠️ [SCANNER] Account {idx+1} Connection closed. Recreating...")
                status_tracker.update_status("scanner", idx, 0, "Connection Closed")
                try:
                    await self.monitoring_sessions[idx].close()
                except:
                    pass
                try:
                    account = self.scanner_accounts[idx]
                    self.monitoring_sessions[idx] = await self._create_session(
                        account.get('proxy'),
                        account.get('api_key')
                    )
                    self.monitoring_cooldowns[idx] = time.time() + 2
                except:
                    self.monitoring_cooldowns[idx] = time.time() + 30
            else:
                status_tracker.update_status("scanner", idx, 0, str(e))
                self.monitoring_cooldowns[idx] = time.time() + 5
            
            return False

    async def _sequential_worker_loop(self):
        """
        SEQUENTIAL WORKER LOOP
        Iterates through available accounts one by one.
        """
        logger.info("🚀 [SEQUENTIAL] Started sequential scanner loop")
        
        while self.is_running:
            try:
                # Determine which accounts to use
                if self.queue_manager:
                    active_accounts = self.queue_manager.get_active_accounts()
                    available_indices = [acc.index for acc in active_accounts]
                else:
                    # If no queue manager, use all non-disabled accounts
                    available_indices = [i for i, disabled in enumerate(self.proxy_disabled) if not disabled]
                
                if not available_indices:
                    logger.warning("⚠️ [SEQUENTIAL] No accounts available! Waiting 5s...")
                    await asyncio.sleep(5)
                    continue

                # Calculate delay to maintain overall rate
                # Target: avg_poll_interval between requests PER ACCOUNT
                # So if we have N accounts, we can do N requests in avg_poll_interval
                # Delay between ANY request = avg_poll_interval / N
                
                avg_interval = (self.poll_min + self.poll_max) / 2
                num_accounts = len(available_indices)
                inter_request_delay = avg_interval / num_accounts if num_accounts > 0 else 1.0
                
                # Ensure we don't go too fast (e.g. keep at least 200ms between requests)
                inter_request_delay = max(0.2, inter_request_delay)

                # Iterate through accounts
                for idx in available_indices:
                    if not self.is_running:
                        break
                        
                    # Process scan for this account
                    # We don't await the result logic here (it's inside _process_scan), 
                    # but we DO await the function itself to ensure sequential execution.
                    await self._process_scan(idx)
                    
                    # Wait calculated delay before next account
                    await asyncio.sleep(inter_request_delay)
                    
            except Exception as e:
                logger.error(f"❌ [SEQUENTIAL] Loop error: {e}")
                await asyncio.sleep(1)

        logger.info("🛑 [SEQUENTIAL] Stopped")

    async def start(self):
        """Start all tasks."""
        self.is_running = True
        await self.initialize()

        # Start queue monitoring if enabled
        if self.queue_manager:
            self.tasks.append(asyncio.create_task(self.queue_manager.start_queue_monitoring()))

        # Start keep-warm for sniping
        self.tasks.append(asyncio.create_task(self._keep_warm()))

        # Start SEQUENTIAL loop
        if self.monitoring_sessions:
            self.tasks.append(asyncio.create_task(self._sequential_worker_loop()))
        else:
            logger.error("No monitoring proxies available to start scanning!")

    async def stop(self):
        """Stop all tasks and close sessions."""
        self.is_running = False
        for task in self.tasks:
            task.cancel()
            
        for s in self.monitoring_sessions:
            await s.close()
            
        if self.sniper_session:
            await self.sniper_session.close()
            
        logger.info("Async Scanner stopped.")
    
    def _send_proxy_error_notification(self, proxy_num, error_type, details):
        """Send Telegram notification about proxy error (one-time only)."""
        try:
            from modules.notifier import notifier
            message = f"""⚠️ *PROXY ERROR ALERT* ⚠️

🔌 *Proxy:* #{proxy_num}
❌ *Error Type:* {error_type}
📝 *Details:* `{details}`

This notification is sent once per error type.
"""
            notifier.send_message(message)
        except Exception as e:
            logger.error(f"Failed to send proxy error notification: {e}")

    async def buy_item(self, listing_id: str) -> bool:
        """Execute a buy request using the warm sniper session."""
        if not self.sniper_session:
            return False
            
        url = f"https://csfloat.com/api/v1/listings/{listing_id}/buy"
        logger.info(f"EXECUTE BUY: {listing_id} using sniper session")
        
        try:
            # Note: Buying might require POST, check CSFloat API docs if available.
            # Usually it's a POST with empty body or specific params.
            response = await self.sniper_session.post(url, timeout=5)
            if response.status_code in [200, 201]:
                status_tracker.update_status("auto_buy", 0, response.status_code, "Buy Success")
                logger.info(f"BUY SUCCESS: {listing_id}")
                return True
            else:
                status_tracker.update_status("auto_buy", 0, response.status_code, f"Buy Failed: {response.text}")
                logger.error(f"BUY FAILED: {listing_id} Status {response.status_code}: {response.text}")
                return False
        except Exception as e:
            status_tracker.update_status("auto_buy", 0, 0, f"Error: {e}")
            logger.error(f"BUY CRITICAL ERROR: {e}")
            return False