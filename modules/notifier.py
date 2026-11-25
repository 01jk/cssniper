import telebot
from utils.logger import logger
import os
import datetime

class TelegramNotifier:
    def __init__(self, token=None, chat_id=None, target_token=None):
        self.token = token or os.getenv("TELEGRAM_BOT_TOKEN")
        self.target_token = target_token or os.getenv("TELEGRAM_TARGET_BOT_TOKEN")
        cid_input = chat_id or os.getenv("TELEGRAM_CHAT_ID")
        self.chat_ids = self._parse_chat_ids(cid_input)
        self.bot = None
        self.target_bot = None
        self.request_timeout = 5  # 5 seconds timeout for Telegram API
        
        # Don't initialize here - wait for setup() to be called with real credentials
        if self.token:
            try:
                self.bot = telebot.TeleBot(self.token)
                logger.info(f"Telegram bot initialized. Targets: {len(self.chat_ids)}")
            except Exception as e:
                logger.error(f"Failed to initialize Telegram bot: {e}")
        
        if self.target_token:
            try:
                self.target_bot = telebot.TeleBot(self.target_token)
                logger.info(f"Telegram target bot initialized.")
            except Exception as e:
                logger.error(f"Failed to initialize Telegram target bot: {e}")

    def _parse_chat_ids(self, input_val):
        if not input_val:
            return []
        if isinstance(input_val, list):
            return [str(x).strip() for x in input_val]
        if isinstance(input_val, (str, int)):
            # Robust string parsing: remove brackets and quotes
            s_val = str(input_val).replace('[', '').replace(']', '').replace("'", '').replace('"', '')
            if ',' in s_val:
                return [x.strip() for x in s_val.split(',') if x.strip()]
            return [s_val.strip()]
        return []

    def setup(self, token, chat_id, target_token=None):
        self.token = token
        self.target_token = target_token
        self.chat_ids = self._parse_chat_ids(chat_id)
        self.request_timeout = 5  # 5 seconds timeout for Telegram API
        if self.token:
            try:
                self.bot = telebot.TeleBot(self.token)
                logger.info(f"Telegram bot re-initialized. Targets: {len(self.chat_ids)}")
            except Exception as e:
                logger.error(f"Failed to re-initialize Telegram bot: {e}")
        
        if self.target_token:
            try:
                self.target_bot = telebot.TeleBot(self.target_token)
                logger.info(f"Telegram target bot re-initialized.")
            except Exception as e:
                logger.error(f"Failed to re-initialize Telegram target bot: {e}")

    def send_message(self, message):
        if not self.bot or not self.chat_ids:
            logger.debug(f"Mock Notification: {message}")
            return
        
        success_count = 0
        for cid in self.chat_ids:
            try:
                self.bot.send_message(cid, message, parse_mode='Markdown', timeout=self.request_timeout)
                success_count += 1
            except Exception as e:
                logger.error(f"Failed to send Telegram message to {cid}: {e}")
        
        if success_count > 0:
            logger.info(f"Notification sent to {success_count}/{len(self.chat_ids)} chats.")

    def send_target_message(self, message):
        """Sends a message using the target bot if configured, otherwise falls back to main bot."""
        bot_to_use = self.target_bot if self.target_bot else self.bot
        
        if not bot_to_use or not self.chat_ids:
            logger.debug(f"Mock Target Notification: {message}")
            return
        
        success_count = 0
        for cid in self.chat_ids:
            try:
                bot_to_use.send_message(cid, message, parse_mode='Markdown', timeout=self.request_timeout)
                success_count += 1
            except Exception as e:
                bot_name = "Target Bot" if self.target_bot else "Main Bot (Fallback)"
                logger.error(f"Failed to send Telegram message to {cid} using {bot_name}: {e}")
        
        if success_count > 0:
            logger.info(f"Target Notification sent to {success_count}/{len(self.chat_ids)} chats.")

    def send_listing_notification(self, listing, target_skin, **kwargs):
        """
        Format and send a notification about a found listing.
        """
        matched_filters = kwargs.get('matched_filters', {})
        blue_gem_tier = kwargs.get('blue_gem_tier')
        listing_float_rank = kwargs.get('listing_float_rank')
        listing_float_rank_value = kwargs.get('listing_float_rank_value')
        zero_price = kwargs.get('zero_price', False)
        market_data = kwargs.get('market_data')
        stickers_price_percent = kwargs.get('stickers_price_percent')
        discount_overpay_triggered = kwargs.get('discount_overpay_triggered', False)
        bo_discount_overpay_percent = kwargs.get('bo_discount_overpay_percent')
        bo_discount_overpay_dollars = kwargs.get('bo_discount_overpay_dollars')
        stickers_percent_triggered = kwargs.get('stickers_percent_triggered', False)
        charm_profit_triggered = kwargs.get('charm_profit_triggered', False)
        charm_profit_percent = kwargs.get('charm_profit_percent', 0.0)
        charm_profit_dollars = kwargs.get('charm_profit_dollars', 0.0)

        item_data = listing.get('item', {})
        item_name = item_data.get('item_name', 'Unknown')
        wear_name = item_data.get('wear_name', '')
        price = listing.get('price', 0) / 100.0
        float_val = item_data.get('float_value', 0)
        paint_seed = item_data.get('paint_seed', 'N/A')
        phase = item_data.get('phase') or item_data.get('phase_name')
        if phase:
            item_name = f"{item_name} ({phase})"
        
        # Extract blue percentage data
        playside_blue = item_data.get('playside_blue', 0.0)
        backside_blue = item_data.get('backside_blue', 0.0)
        
        # Check nested blue_gem object if top-level is 0
        if playside_blue == 0.0 and 'blue_gem' in item_data:
            blue_gem_data = item_data.get('blue_gem', {})
            playside_blue = blue_gem_data.get('playside_blue', 0.0)
            backside_blue = blue_gem_data.get('backside_blue', 0.0)
        
        # Extract fade percentage data
        fade_percentage = 0.0
        fade_container = item_data.get('fade', {})
        if isinstance(fade_container, dict):
            fade_percentage = fade_container.get('percentage', 0.0)
        
        # Time logic
        created_at_str = listing.get('created_at')
        time_msg = ""
        if created_at_str:
            try:
                # Handle various ISO formats
                clean_date = created_at_str.replace('Z', '+00:00')
                
                # Try parsing with microseconds first
                try:
                    created_at = datetime.datetime.fromisoformat(clean_date)
                except ValueError:
                    # Fallback: add microseconds if missing
                    if '.' not in clean_date and '+' in clean_date:
                        clean_date = clean_date.replace('+', '.000+')
                        created_at = datetime.datetime.fromisoformat(clean_date)
                    else:
                        raise
                
                # If no timezone info, assume it's UTC
                if created_at.tzinfo is None:
                    created_at = created_at.replace(tzinfo=datetime.timezone.utc)
                
                # Always use UTC for comparison
                now = datetime.datetime.now(datetime.timezone.utc)
                diff = now - created_at
                # Format: HH:MM:SS.mmm (+delay.mmm s)
                time_str = created_at.strftime("%H:%M:%S.%f")[:-3]
                delay_str = f"(+{diff.total_seconds():.3f}s)"

                time_msg = f"`{time_str} {delay_str}`"
                logger.debug(f"[TIME] Parsed created_at: {created_at_str} -> UTC: {created_at}, delay: {diff.total_seconds():.3f}s")
            except Exception as e:
                logger.warning(f"[TIME] Failed to parse created_at '{created_at_str}': {e}")
                time_msg = f"`{created_at_str} (err)`"
        else:
            logger.debug(f"[TIME] No created_at in listing data")
            time_msg = f"`no data`"
        
        # Header logic
        cfg_name = getattr(target_skin, "config_name", "Default")
        cfg_emoji = getattr(target_skin, "config_emoji", None)
        cfg_display = f"{cfg_emoji} {cfg_name}" if cfg_emoji else cfg_name

        # Skin Checkmark
        skin_check = " ✅" if matched_filters.get('item_name') else ""
        
        # Float rank display labels
        float_rank_labels = {
            'gold_highest_float': ('🥇', 'GOLD FLOAT RANK'),
            'gold_lowest_float': ('🥇', 'GOLD FLOAT RANK'),
            'silver_highest_float': ('🥈', 'SILVER FLOAT RANK'),
            'silver_lowest_float': ('🥈', 'SILVER FLOAT RANK'),
            'bronze_highest_float': ('🥉', 'BRONZE FLOAT RANK'),
            'bronze_lowest_float': ('🥉', 'BRONZE FLOAT RANK'),
        }
        
        header = f"🎯 *FOUND LOT!* [{cfg_display}] 🎯"
        if (playside_blue > 0 or backside_blue > 0) and blue_gem_tier:
            header = f"💎 *TIER {blue_gem_tier} ({playside_blue:.2f}%/{backside_blue:.2f}%)* [{cfg_display}] 💎"
        elif blue_gem_tier:
            header = f"💎 *TIER {blue_gem_tier} LOT* [{cfg_display}] 💎"
        elif listing_float_rank and listing_float_rank in float_rank_labels:
            rank_emoji, rank_label = float_rank_labels[listing_float_rank]
            if listing_float_rank_value is not None:
                header = f"{rank_emoji} *{rank_label}! #{listing_float_rank_value}* [{cfg_display}] {rank_emoji}"
            else:
                header = f"{rank_emoji} *{rank_label}!* [{cfg_display}] {rank_emoji}"
        elif zero_price:
            header = f"🎯 *0.0% LOT!* [{cfg_display}] 🎯"

        # Market data (real-time buy orders and price list)
        market_data_msg = ""
        # Base price logic (CSFloat uses reference price, falls back to highest buy order)
        listing_ref = listing.get('reference', listing.get('Reference', {}))
        
        api_base_price = (listing_ref.get('base_price', 0) / 100.0) if listing_ref.get('base_price') else 0
        api_predicted_price = (listing_ref.get('predicted_price', 0) / 100.0) if listing_ref.get('predicted_price') else 0
        fallback_predicted = market_data.get('highest_buy_order', {}).get('price', 0) if market_data else 0
        
        # We use predicted_price for calculating real discount/overpay (as CSFloat UI does)
        base_price_to_use = api_predicted_price if api_predicted_price > 0 else (api_base_price if api_base_price > 0 else fallback_predicted)

        if market_data or base_price_to_use > 0:
            buy_order = market_data.get('highest_buy_order') if market_data else None
            lowest_price = market_data.get('lowest_market_price') if market_data else None
            
            # Use base_price_to_use for standard discount/overpay calculations
            if base_price_to_use > 0:
                # Calculate profit (listing price - predicted price = discount/savings)
                profit_dollars = price - base_price_to_use

                # Calculate profit percentage relative to true market value
                profit_percent = (profit_dollars / base_price_to_use) * 100

                # Use dynamic emoji (+ or -) instead of 💰
                emoji_sign = "➕" if profit_dollars >= 0 else "➖"
                
                # Format with +/- sign for text
                sign = "+" if profit_dollars >= 0 else ""

                if profit_dollars < 0:
                    discount_overpay_label = f"{emoji_sign} *Discount:*"
                elif profit_dollars > 0:
                    discount_overpay_label = f"{emoji_sign} *Overpay:*"
                else:
                    discount_overpay_label = f"{emoji_sign} *Discount/Overpay:*"

                market_data_msg += f"{discount_overpay_label} `{sign}${profit_dollars:.2f}` ({sign}{profit_percent:.1f}%)\n"
                
            # If the user-defined filter for Buy Order Discount/Overpay triggered, add its specific line
            if discount_overpay_triggered and bo_discount_overpay_percent is not None and bo_discount_overpay_dollars is not None:
                sign_bo = "+" if bo_discount_overpay_dollars >= 0 else ""
                
                if bo_discount_overpay_dollars < 0:
                    bo_label = "📈 *Discount %:*"
                elif bo_discount_overpay_dollars > 0:
                    bo_label = "📈 *Overpay %:*"
                else:
                    bo_label = "📈 *Discount/Overpay %:*"
                    
                market_data_msg += f"{bo_label} `{sign_bo}${bo_discount_overpay_dollars:.2f}` ({sign_bo}{bo_discount_overpay_percent:.1f}%) ✅\n"

            if lowest_price:
                market_data_msg += f"📉 *Lowest Market Price:* `${lowest_price:.2f}`\n"
            
            # Determine buy order price from min_offer_price (API root)
            buy_order_price = (listing.get('min_offer_price', 0) / 100.0) if listing.get('min_offer_price') else 0
            
            if buy_order_price > 0:
                market_data_msg += f"📊 *Highest Buy Order:* `${buy_order_price:.2f}`"
            elif buy_order and buy_order.get('count', 0) > 0:
                buy_order_price_fallback = buy_order['price']
                market_data_msg += f"📊 *Highest Buy Order:* `${buy_order_price_fallback:.2f}`"
            elif market_data_msg.endswith('\n'):
                market_data_msg = market_data_msg[:-1]  # Strip trailing newline if no buy order


        # Sticker logic
        stickers_msg = ""
        listing_stickers = item_data.get('stickers', [])
        if listing_stickers:
            # Stickers percentage in header
            stickers_header = "\n✨ *Stickers*"
            if stickers_price_percent is not None:
                sign = "+" if stickers_price_percent >= 0 else ""
                stickers_header += f" (SP {sign}{stickers_price_percent:.1f}%)"
            stickers_header += ":"
            if stickers_percent_triggered:
                stickers_header += " ✅"
            stickers_msg = stickers_header
            for index, s in enumerate(listing_stickers):
                s_name = s.get('name', 'Unknown Sticker')
                # Market quantity from reference
                ref = s.get('reference', {})
                qty = ref.get('quantity', '?')
                s_price = ref.get('price', 0) / 100.0

                # Position logic
                x = s.get('offset_x')
                y = s.get('offset_y')

                is_custom = x is not None and y is not None

                # Wear logic
                wear = s.get('wear')
                if wear is None:
                    wear_str = "0%"
                else:
                    wear_str = f"{wear*100:.0f}%"

                # Slot number (0-indexed in API, display as 1-indexed)
                slot = s.get('slot', '?')
                if slot != '?':
                    slot_display = str(slot + 1)
                else:
                    slot_display = '?'

                if is_custom:
                    slot_display = "5"

                # Checkmark logic for stickers
                sticker_check = ""
                if 'matched_sticker_indices' in matched_filters:
                    if index in matched_filters['matched_sticker_indices']:
                        sticker_check = " ✅"

                # New format: Slot | Wear% | Price \n Name
                # Strip "Sticker | " prefix for display only (s_name is kept for checkmark logic)
                s_name_display = s_name.removeprefix("Sticker | ")
                stickers_msg += f"\n\n• Slot {slot_display} | {wear_str} | ${s_price:.2f}{sticker_check}\n{s_name_display}"

        # Rarity logic with emoji
        rarity_msg = ""
        rarity = item_data.get('rarity_name', '').lower()
        if rarity:
            rarity_map = {
                'contraband': '🟡',
                'covert': '🔴',
                'classified': '🩷',
                'restricted': '🟣',
                'milspec': '🔵',
                'mil-spec grade': '🔵',
                'industrial': '🩵',
                'industrial grade': '🩵',
                'consumer': '⚪️',
                'consumer grade': '⚪️',
                'extraordinary': '🔴',
                'remarkable': '🩷',
                'exotic': '🟣',
                'high grade': '🔵',
                'base grade': '⚪️',
                'agent quality': '🔵',
            }
            rarity_msg = rarity_map.get(rarity, '💫')  # Только эмодзи для Skin

        # Seed Checkmark
        seed_check = " ✅" if matched_filters.get('paint_seed') else ""

        # Build blue percentage lines if enabled AND if item has blue gem data
        blue_lines = ""
        if playside_blue > 0 or backside_blue > 0:
            blue_check = " ✅" if (matched_filters.get('playside_blue') or matched_filters.get('backside_blue')) else ""
            blue_lines = f"\n🔵 *Blue:* `{playside_blue:.2f}%/{backside_blue:.2f}%`{blue_check}"

        # Build fade percentage line if enabled
        rank = -1
        if isinstance(fade_container, dict):
             rank = fade_container.get('rank', -1)
        
        fade_line = ""
        if fade_percentage > 0:
            rank_str = f" (Rank: {rank})" if rank > 0 else ""
            fade_check = " ✅" if matched_filters.get('fade') else ""
            fade_line = f"\n🌅 *Fade:* `{fade_percentage:.1f}%`{rank_str}{fade_check}"

        # Build charm pattern filter line if enabled
        charm_pattern_filter_line = ""
        if matched_filters.get('charm_pattern'):
            charm_pattern_filter_line = f"\n🧸 *Charm Pattern Filter:* `{getattr(target_skin, 'charm_pattern_min', 0)} - {getattr(target_skin, 'charm_pattern_max', 100000)}` ({'Strict' if getattr(target_skin, 'charm_pattern_strict', True) else 'Soft'}) ✅"

        stattrak_check = " ✅" if matched_filters.get('is_stattrak') else ""
        souvenir_check = " ✅" if matched_filters.get('is_souvenir') else ""

        price_check = " ✅" if matched_filters.get('price') else ""

        charms_msg = ""
        listing_keychains = item_data.get('keychains', [])
        if listing_keychains:
            charm_profit_msg = ""
            # Ensure charm profit is always displayed if charms are present
            display_profit_pct = charm_profit_percent if charm_profit_percent is not None else 0.0
            display_profit_dollars = charm_profit_dollars if charm_profit_dollars is not None else 0.0
            profit_check = " ✅" if charm_profit_triggered else ""
            
            charm_profit_msg = f"\n🧸 *Charm Profit:* `{display_profit_pct:.1f}% (${display_profit_dollars:.2f})`{profit_check}"
            
            charms_msg = f"{charm_profit_msg}"
            for k in listing_keychains:
                k_name = k.get('name', 'Unknown Charm')
                
                # Checkmark logic for individual charm
                k_check = ""
                # 1. If 'charms' filter matched and this specific charm is in the target list
                target_charms = getattr(target_skin, 'charms', []) or []
                if matched_filters.get('charms') and k_name in target_charms:
                    k_check = " ✅"
                
                # 2. If 'charm_pattern' filter matched and this charm's pattern is in range
                pattern = k.get('pattern')
                if matched_filters.get('charm_pattern'):
                    p_min = getattr(target_skin, 'charm_pattern_min', 0)
                    p_max = getattr(target_skin, 'charm_pattern_max', 100000)
                    if pattern is not None and (p_min <= pattern <= p_max):
                        k_check = " ✅"

                ref = k.get('reference', {})
                qty = ref.get('quantity', '?')
                k_price = ref.get('price', 0) / 100.0

                # Pattern information
                pattern_str = f"`{pattern}`" if pattern is not None else "No Pattern"

                # Collection name
                collection = k.get('collection')
                collection_str = f"\n{collection}" if collection else ""

                charms_msg += f"\n\n• Pattern: {pattern_str} | ${k_price:.2f}{k_check}\n{k_name}{collection_str}"

        # Build extras section (stickers, charms, time) with proper spacing
        extras_parts = []
        if stickers_msg:
            extras_parts.append(stickers_msg)
        if charms_msg:
            extras_parts.append(charms_msg)

        extras_str = "\n".join(extras_parts)
        if extras_str:
            extras_str += "\n\n"

        msg = (
            f"{header}\n\n"
            f"🔗 [Link to Item](https://csfloat.com/item/{listing.get('id')})\n\n"
            f"{rarity_msg} `{item_name}`{skin_check}\n"
            f"🏷️ *Wear:* `{wear_name}`\n"
            f"📊 *Float:* `{float_val}`\n"
            f"🎨 *Seed:* `{paint_seed}`{seed_check}{blue_lines}{fade_line}\n\n"
            f"💰 *Price:* `${price:.2f}`{price_check}\n"
            f"{market_data_msg}\n\n"
            f"⭐ *StatTrak:* {'❌ No' if not item_data.get('is_stattrak', False) else '✅ Yes'}{stattrak_check}\n"
            f"🏆 *Souvenir:* {'❌ No' if not item_data.get('is_souvenir', False) else '✅ Yes'}{souvenir_check}\n"
            f"{extras_str}"
            f"🕒 *Time:* {time_msg}"
        )
        self.send_target_message(msg)

    def send_queue_change_notification(self, queue_name, action, item_count=None):
        """
        Send notification about queue changes (start, stop, switch).
        
        Args:
            queue_name (str): Name of the queue
            action (str): Action type ('start', 'stop', 'switch', 'pause', 'resume')
            item_count (int, optional): Number of items in queue
        """
        action_emojis = {
            'start': '🚀',
            'stop': '🛑', 
            'switch': '🔄',
            'pause': '⏸️',
            'resume': '▶️'
        }
        
        emoji = action_emojis.get(action, '📋')
        
        msg = f"{emoji} *Queue {action.title()}*: `{queue_name}`"
        
        if item_count is not None:
            msg += f"\n📊 *Items in queue*: `{item_count}`"
        
        self.send_message(msg)

# Global instance
notifier = TelegramNotifier()
