import asyncio
import logging
import time
import datetime
import yaml
import os
import requests
from database.database import init_db, get_db
from database.models import SalesHistory
from modules.scanner import AsyncScanner
from modules.analyzer import Analyzer
from modules.notifier import TelegramNotifier
from modules.market_data import fetch_market_data, init_market_data_client, fetch_market_data_async

from utils.logger import logger
from database.database import init_db, get_db
from database.models import SalesHistory
from modules.scanner import AsyncScanner
from modules.analyzer import Analyzer
from modules.notifier import notifier as tg_notifier
from modules.status_tracker import status_tracker

# Интеграция уведомлений с веб-интерфейсом
from utils.log_notification_parser import NotificationLogHandler

# Load configuration
def load_config():
    with open("config/settings.yaml", 'r') as f:
        return yaml.safe_load(f)

settings = load_config()

# Initialize modules
init_db()
analyzer = Analyzer()

# Добавляем обработчик уведомлений для веб-интерфейса
# Это позволит отправлять уведомления из логов бота на сайт
web_notification_handler = NotificationLogHandler(
    api_url="http://localhost:8000/api/notifications"
)
logger.addHandler(web_notification_handler)

# Initialize Telegram Notifier with credentials
tg_notifier.setup(
    settings['bot'].get('telegram_bot_token'),
    settings['bot'].get('telegram_chat_id'),
    settings['bot'].get('telegram_target_bot_token')
)

# Initialize Market Data Client with persistent sessions
# Fallback to old proxy list if 'accounts' not present
market_data_config = settings.get('market_data', {})
market_data_accounts = market_data_config.get('accounts', [])

if not market_data_accounts and market_data_config.get('proxies'):
    # Migration fallback: Use scanner/global key with separate proxies
    global_key = settings.get('scanner', {}).get('api_key')
    market_data_accounts = [{
        'api_key': global_key,
        'proxy': p
    } for p in market_data_config.get('proxies', [])]

init_market_data_client(market_data_accounts)

# Cache to prevent concurrent tasks from processing the same ID
processed_cache = set()
cache_lock = asyncio.Lock()
WEB_NOTIFICATION_API_URL = os.getenv("WEB_NOTIFICATION_API_URL", "http://localhost:8000/api/notifications")




class MergedTarget:
    def __init__(self, config_name, targets):
        self.config_name = config_name
        # Merge display flags (if ANY target has it enabled, show it)
        self.playside_blue_enabled = any(getattr(t, 'playside_blue_enabled', False) for t in targets)
        self.backside_blue_enabled = any(getattr(t, 'backside_blue_enabled', False) for t in targets)
        self.fade_enabled = any(getattr(t, 'fade_enabled', False) for t in targets)
        self.charm_pattern_enabled = any(getattr(t, 'charm_pattern_enabled', False) for t in targets)
        
        # Use scalar values from the first target (or prioritization logic?)
        # For simple consistent display, using the first one is safe for now.
        first = targets[0]
        self.charm_pattern_strict = getattr(first, 'charm_pattern_strict', True)
        self.charms = getattr(first, 'charms', []) or []


FILTER_LABELS = {
    "item_name": "Item Name",
    "price": "Price",
    "float": "Float",
    "playside_blue": "Playside Blue %",
    "backside_blue": "Backside Blue %",
    "fade": "Fade %",
    "float_rank": "Float Rank",
    "phase": "Phase",
    "paint_seed": "Paint Seed",
    "charm_pattern": "Charm Pattern",
    "charms": "Charms",
    "matched_sticker_indices": "Stickers",
}


def _extract_passed_filters(result: dict) -> list:
    filters = []
    matched_filters = result.get("matched_filters", {}) or {}

    for key in matched_filters.keys():
        filters.append(FILTER_LABELS.get(key, key.replace("_", " ").title()))

    if result.get("check_zero_price"):
        filters.append("Zero Price")
    if result.get("check_discount_overpay"):
        filters.append("Discount/Overpay")
    if result.get("check_stickers_price_percent"):
        filters.append("Stickers %")
    if result.get("check_charm_profit"):
        filters.append("Charm Profit")

    # Keep order, remove duplicates
    unique_filters = list(dict.fromkeys(filters))
    return unique_filters


def _send_web_match_notification(listing: dict, target_obj, result: dict):
    try:
        item_data = listing.get("item") or {}
        matched_filters = result.get("matched_filters", {}) or {}

        fade_container = item_data.get("fade") if isinstance(item_data.get("fade"), dict) else {}
        blue_container = item_data.get("blue_gem") if isinstance(item_data.get("blue_gem"), dict) else {}

        playside_blue = result.get("playside_blue", item_data.get("playside_blue", blue_container.get("playside_blue", 0.0)))
        backside_blue = result.get("backside_blue", item_data.get("backside_blue", blue_container.get("backside_blue", 0.0)))
        fade_percentage = result.get("fade_percentage", fade_container.get("percentage", item_data.get("fade_percentage", 0.0)))
        fade_rank = result.get("fade_rank", fade_container.get("rank", item_data.get("fade_rank")))

        listing_id = str(listing.get("id", ""))
        item_name = item_data.get("item_name") or "Unknown Skin"
        wear_name = item_data.get("wear_name") or ""
        item_phase = item_data.get("phase") or item_data.get("phase_name")
        full_skin_name = item_name
        if item_phase and str(item_phase).lower() not in full_skin_name.lower():
            full_skin_name = f"{full_skin_name} ({item_phase})"
        if wear_name and str(wear_name).lower() not in full_skin_name.lower():
            full_skin_name = f"{full_skin_name} ({wear_name})"

        passed_filters = _extract_passed_filters(result)
        config_name = getattr(target_obj, "config_name", "Default")
        mode = getattr(target_obj, "mode", "Notify Only")

        message_parts = [full_skin_name]
        if passed_filters:
            message_parts.append(f"Filters: {', '.join(passed_filters)}")

        payload = {
            "type": "autobuy" if mode != "Notify Only" else "success",
            "source": "scanner",
            "title": f"🎯 Match Found [{config_name}]",
            "message": " | ".join(message_parts),
            "data": {
                "skin_name": full_skin_name,
                "item_name": item_name,
                "wear_name": wear_name,
                "phase": item_phase,
                "item_id": listing_id,
                "item_url": f"https://csfloat.com/item/{listing_id}" if listing_id else None,
                "config_name": config_name,
                "mode": mode,
                "filters_passed": passed_filters,
                "matched_filters": matched_filters,
                "price": (listing.get("price", 0) / 100.0) if listing.get("price") else None,
                "float": item_data.get("float_value"),
                "pattern": item_data.get("paint_seed") or item_data.get("pattern") or result.get("pattern"),
                "paint_seed": item_data.get("paint_seed"),
                "rarity_name": item_data.get("rarity_name") or getattr(target_obj, "rarity_name", None),
                "blue_gem_tier": result.get("blue_gem_tier"),
                "playside_blue": playside_blue,
                "backside_blue": backside_blue,
                "blue_gem": {
                    "playside_blue": playside_blue,
                    "backside_blue": backside_blue,
                },
                "fade_percentage": fade_percentage,
                "fade_rank": fade_rank,
                "fade": {
                    "percentage": fade_percentage,
                    "rank": fade_rank,
                },
                "stickers": item_data.get("stickers") or result.get("matched_stickers") or [],
                "charms": item_data.get("charms") or result.get("matched_charms") or [],
            }
        }

        response = requests.post(WEB_NOTIFICATION_API_URL, json=payload, timeout=5)
        if response.status_code != 200:
            logger.error(f"Failed to send web match notification: {response.status_code} {response.text}")
    except Exception as e:
        logger.error(f"Failed to send web match notification: {e}")

async def process_listing_callback(listings):
    """Callback for processing new listings (Async)."""
    import time
    start_time = time.time()
    
    if isinstance(listings, dict):
        items = listings.get('data', [])
        if items is None:
             items = []
        if not items:
            return
        listings = items
        
    for listing in listings:
        if not isinstance(listing, dict):
            continue
            
        # Only process items that are immediately available for purchase
        if listing.get('type') != 'buy_now':
            continue
            
        asset_id = str(listing.get('id', ''))
        
        # 1. Quick In-Memory Deduplication (Prevents race conditions between 5 loops)
        item_start = time.time()
        async with cache_lock:
            if asset_id in processed_cache:
                continue
            processed_cache.add(asset_id)
            if len(processed_cache) > 500:
                # Basic cleanup: clear if too large
                processed_cache.clear()

        # 2. Analyze
        # Now returns a list of results
        results = analyzer.check_listing(listing)
        
        if not results:
            continue

        # Filter for valid actions
        valid_results = [r for r in results if r.get('action') in ['notify', 'buy']]
        
        if not valid_results:
            continue
            
        should_buy = any(r['action'] == 'buy' for r in valid_results)
        
        # Select primary result for history logging (prioritize buy)
        primary_result = next((r for r in valid_results if r['action'] == 'buy'), valid_results[0])
        
        # Fire-and-forget: save to database in background without blocking
        db_start = time.time()
        asyncio.create_task(
            asyncio.to_thread(_check_and_save_history, listing, primary_result)
        )
        logger.debug(f"[TIMING] DB task created in {(time.time() - db_start)*1000:.1f}ms")
        
        # Note: In-memory cache (lines 92-98) already prevents concurrent duplicates
        # Database save is for historical tracking, notification proceeds immediately
        
        # Fetch real-time market data (buy orders + price list)
        market_data = None
        market_start = time.time()
        try:
            market_hash_name = (listing.get('item') or {}).get('market_hash_name')
            if market_hash_name:
                market_data = await fetch_market_data_async(
                    listing_id=listing.get('id'),
                    market_hash_name=market_hash_name
                )
        except Exception as e:
            logger.error(f"Failed to fetch market data: {e}")
        market_time = time.time() - market_start
        logger.debug(f"[TIMING] Market data fetch took {market_time*1000:.1f}ms")

        # Collect all passing results for aggregation
        passed_configs = []  # List of (target_obj, result_dict, stickers_price_percent, is_zero_price)

        for result in valid_results:
            target_obj = result.get('target')
            cfg_name = getattr(target_obj, 'config_name', 'Default')
            
            logger.info(f"CHECKING TARGET [{cfg_name}] for {(listing.get('item') or {}).get('item_name', 'Unknown')}")

            # Check zero price filter if enabled for THIS target
            is_zero_price = False
            
            # Base price logic (CSFloat uses reference price, falls back to highest buy order)
            listing_ref_data = (listing.get('reference') or listing.get('Reference') or {})
            api_predicted_price = (listing_ref_data.get('predicted_price', 0) / 100.0) if listing_ref_data.get('predicted_price') else 0
            api_base_price = (listing_ref_data.get('base_price', 0) / 100.0) if listing_ref_data.get('base_price') else 0
            fallback_predicted = (market_data.get('highest_buy_order') or {}).get('price', 0) if market_data else 0
            
            base_price = api_predicted_price if api_predicted_price > 0 else (api_base_price if api_base_price > 0 else fallback_predicted)

            if result.get('check_zero_price'):
                if base_price == 0:
                    continue

                listing_price = listing.get('price', 0) / 100.0

                if abs(listing_price - base_price) < 0.01:  # Allow for small floating point differences
                    is_zero_price = True
                else:
                    continue

            # Check Discount/Overpay filter if enabled (using Highest Buy Order)
            if result.get('check_discount_overpay'):
                # Use Highest Buy Order for this filter
                buy_order_price = (market_data.get('highest_buy_order') or {}).get('price', 0) if market_data else 0
                
                listing_price = listing.get('price', 0) / 100.0

                if buy_order_price > 0 and listing_price > 0:
                    # Calculate discount/overpay % from buy order
                    # Positive = Overpay (listing price > buy order)
                    # Negative = Discount (listing price < buy order)
                    profit_dollars = listing_price - buy_order_price
                    bo_diff_percent = (profit_dollars / buy_order_price) * 100

                    # Check if within range
                    min_val = target_obj.discount_overpay_min if target_obj.discount_overpay_min is not None else -float('inf')
                    max_val = target_obj.discount_overpay_max if target_obj.discount_overpay_max is not None else float('inf')

                    if not (min_val <= bo_diff_percent <= max_val):
                        continue
                        
                    # Store calculated percentage for notification
                    result['bo_discount_overpay_percent'] = bo_diff_percent
                    result['bo_discount_overpay_dollars'] = profit_dollars
                else:
                    # Reject if no buy order data but filter is enabled
                    continue

            # Calculate Charm Profit ALWAYS if applicable
            # Determine reference price based on lowest market price setting
            use_lowest_price = getattr(target_obj, 'charm_profit_use_lowest_price', False)
            if use_lowest_price:
                reference_price = (market_data.get('lowest_market_price') or 0) if market_data else 0
            else:
                # Use Highest Buy Order instead of lowest market price
                reference_price = (market_data.get('highest_buy_order') or {}).get('price', 0) if market_data else 0
            
            listing_price = listing.get('price', 0) / 100.0
            charms_total_price = result.get('charms_total_price', 0.0)

            if reference_price > 0 and listing_price > 0 and listing.get('item', {}).get('keychains'):
                charm_profit_dollars = reference_price + charms_total_price - listing_price
                charm_profit_percent = (charm_profit_dollars / listing_price) * 100
                result['charm_profit_percent'] = charm_profit_percent
                result['charm_profit_dollars'] = charm_profit_dollars

            # Charm Profit Filter
            if result.get('check_charm_profit'):
                if 'charm_profit_percent' in result:
                    min_profit = getattr(target_obj, 'charm_profit_min', -100.0)
                    max_profit = getattr(target_obj, 'charm_profit_max', 100.0)
                    
                    if not (min_profit <= result['charm_profit_percent'] <= max_profit):
                        logger.info(f"CHARM PROFIT FILTER REJECT: {(listing.get('item') or {}).get('item_name', 'Unknown')} - profit {result['charm_profit_percent']:.1f}% not in [{min_profit}, {max_profit}]")
                        continue
                else:
                    # No buy order data or item has no keychains
                    logger.info(f"CHARM PROFIT FILTER REJECT (no data): {(listing.get('item') or {}).get('item_name', 'Unknown')}")
                    continue
            # SP% filter is now checked in analyzer.py

            # If we passed all dynamic checks, add to passed results
            passed_configs.append({
                'target': target_obj,
                'result': result,
                'sp': result.get('stickers_price_percent'),
                'zero': is_zero_price
            })
            logger.info(f"TARGET PASSED: [{cfg_name}] for {(listing.get('item') or {}).get('item_name', 'Unknown')}")

        # If we have matches, send ONE notification using the MOST SPECIFIC match
        if passed_configs:
            # Score each matching target to find the "closest similarity" (most specific)
            for pc in passed_configs:
                target_obj = pc['target']
                score = 0
                # Specific item name instead of wildcard
                if target_obj.item_name and target_obj.item_name != '*':
                    score += 100
                # Filter by stickers
                if target_obj.stickers:
                    score += 50
                # Filter by charms
                if target_obj.charms:
                    score += 50
                # Filter by specific paint seed
                if target_obj.paint_seed:
                    score += 40
                # Filter by overpay
                if pc['result'].get('check_discount_overpay'):
                    score += 30
                # Filter by stickers price percent
                if pc['result'].get('check_stickers_price_percent'):
                    score += 30
                # Filter by charm profit
                if pc['result'].get('check_charm_profit'):
                    score += 30
                # Filter by blue gem / fade
                if getattr(target_obj, 'playside_blue_enabled', False) or getattr(target_obj, 'backside_blue_enabled', False):
                    score += 20
                if getattr(target_obj, 'fade_enabled', False):
                    score += 20
                # Strict float filters
                if target_obj.min_float > 0.0 or target_obj.max_float < 1.0:
                    score += 10
                    
                pc['score'] = score
                
            # Sort by score descending
            passed_configs.sort(key=lambda x: x['score'], reverse=True)
            
            # Pick the best match
            best_match = passed_configs[0]
            best_target = best_match['target']
            best_config_name = getattr(best_target, 'config_name', 'Default')

            # We create a MergedTarget with just the best target to preserve its display flags
            merged_target = MergedTarget(best_config_name, [best_target])

            # Determine properties from the BEST match
            agg_blue_gem_tier = best_match['result'].get('blue_gem_tier')
            agg_float_rank = best_match['result'].get('listing_float_rank')
            agg_float_rank_value = best_match['result'].get('listing_float_rank_value')
            agg_zero_price = best_match['zero']
            agg_sp = best_match['sp']
            agg_playside_blue = best_match['result'].get('playside_blue', 0.0)

            # Checkmarks based ONLY on the best match's triggers
            agg_discount_overpay = best_match['result'].get('check_discount_overpay', False)
            agg_bo_discount_overpay_percent = best_match['result'].get('bo_discount_overpay_percent')
            agg_bo_discount_overpay_dollars = best_match['result'].get('bo_discount_overpay_dollars')
            agg_sp_filter = best_match['result'].get('check_stickers_price_percent', False)
            agg_charm_profit_triggered = best_match['result'].get('check_charm_profit', False)
            agg_charm_profit_percent = best_match['result'].get('charm_profit_percent', None)
            agg_charm_profit_dollars = best_match['result'].get('charm_profit_dollars', None)

            logger.info(f"TARGET MATCH [{best_config_name}] (Score: {best_match['score']}): Sending notification.")
            
            # Calculate delay from item creation time
            created_at_str = listing.get('created_at', '')
            delay_from_creation = "N/A"
            if created_at_str:
                try:
                    created_at = datetime.datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
                    now = datetime.datetime.now(datetime.timezone.utc)
                    delay_seconds = (now - created_at).total_seconds()
                    delay_from_creation = f"{delay_seconds:.1f}s"
                except Exception:
                    delay_from_creation = "parse_error"
            
            matched_filters = best_match['result'].get('matched_filters', {})

            # Send structured web notification with exact skin + passed filters
            asyncio.create_task(
                asyncio.to_thread(
                    _send_web_match_notification,
                    listing,
                    best_target,
                    best_match['result']
                )
            )
            
            # Fire-and-forget: send notification without blocking
            tg_start = time.time()
            asyncio.create_task(
                asyncio.to_thread(
                    _send_tg_notification_with_timing,
                    tg_start,
                    listing,
                    merged_target,
                    blue_gem_tier=agg_blue_gem_tier,
                    listing_float_rank=agg_float_rank,
                    listing_float_rank_value=agg_float_rank_value,
                    zero_price=agg_zero_price,
                    discount_overpay_triggered=agg_discount_overpay,
                    bo_discount_overpay_percent=agg_bo_discount_overpay_percent,
                    bo_discount_overpay_dollars=agg_bo_discount_overpay_dollars,
                    stickers_percent_triggered=agg_sp_filter,
                    charm_profit_triggered=agg_charm_profit_triggered,
                    charm_profit_percent=agg_charm_profit_percent,
                    charm_profit_dollars=agg_charm_profit_dollars,
                    market_data=market_data,
                    stickers_price_percent=agg_sp,
                    matched_filters=matched_filters
                )
            )
            
            total_time = time.time() - item_start
            logger.info(f"[TIMING] Total item processing took {total_time*1000:.1f}ms (asset: {asset_id}, created_at: {created_at_str}, delay_from_creation: {delay_from_creation})")

        # If buy action, use the warm sniper session
        if should_buy and scanner:
            await scanner.buy_item(asset_id)

def _check_and_save_history(listing, result):
    """Thread-safe database check and save."""
    import time
    db_start = time.time()
    db = next(get_db())
    try:
        asset_id = str(listing.get('id', ''))
        exists = db.query(SalesHistory).filter(SalesHistory.asset_id == asset_id).first()
        if exists:
            return False

        item_data = listing.get('item', {})
        target_obj = result.get('target')
        
        history = SalesHistory(
            item_name=item_data.get('item_name', 'Unknown'),
            wear_name=item_data.get('wear_name', 'Unknown'),
            price=listing.get('price', 0) / 100.0,
            float_value=item_data.get('float_value', 0.0),
            paint_seed=item_data.get('paint_seed'),
            stickers=item_data.get('stickers', []),
            asset_id=asset_id,
            purchased=(result['action'] == 'buy'),
            markup_pct=target_obj.markup_pct if target_obj else None,
            markup_mult=target_obj.markup_mult if target_obj else None,
            timestamp=datetime.datetime.now(datetime.timezone.utc)
        )
        db.add(history)
        db.commit()
        db_time = time.time() - db_start
        logger.debug(f"[TIMING] DB save completed in {db_time*1000:.1f}ms (asset: {asset_id})")
        return True
    except Exception as e:
        logger.error(f"Error saving to history: {e}")
        return False
    finally:
        db.close()

def _send_tg_notification_with_timing(start_time, listing, target_skin, **kwargs):
    """Wrapper to log Telegram send timing."""
    import time
    try:
        tg_notifier.send_listing_notification(listing, target_skin, **kwargs)
        tg_time = time.time() - start_time
        logger.info(f"[TIMING] Telegram notification sent in {tg_time*1000:.1f}ms")
    except Exception as e:
        tg_time = time.time() - start_time
        logger.error(f"[TIMING] Telegram notification FAILED after {tg_time*1000:.1f}ms: {e}")

# Global scanner for callback access (or pass it in)
scanner = None

async def main():
    global scanner
    logger.info("Starting CSFloat Sniper Bot (Asynchronous + 5+1 Proxy)...")
    
    scanner_settings = settings.get('scanner', {})
    scanner = AsyncScanner(settings)
    scanner.callback = process_listing_callback
    
    await scanner.start()
    
    # Start proxy status saving loop
    asyncio.create_task(status_tracker.start_saving_loop())
    
    last_refresh = time.time()
    try:
        while True:
            # Periodic refresh of targets (every 60 seconds)
            if time.time() - last_refresh > 60:
                await asyncio.to_thread(analyzer.refresh_knowledge_base)
                last_refresh = time.time()
                
            await asyncio.sleep(1)
    except (KeyboardInterrupt, asyncio.CancelledError):
        logger.info("Stopping bot...")
    finally:
        await scanner.stop()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
