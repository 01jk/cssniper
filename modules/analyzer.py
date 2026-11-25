from database.database import get_db
from database.models import TargetSkin, StickerTier
from utils.logger import logger

class Analyzer:
    def __init__(self):
        # We can implement caching here for targets to avoid DB hits on every listing
        self.targets = []
        self.sticker_tiers = {} 
        self.refresh_knowledge_base()

    def refresh_knowledge_base(self):
        """Reload targets and sticker tiers from DB"""
        from database.models import TargetConfig
        db = next(get_db())
        try:
            # Load active configs
            active_configs = db.query(TargetConfig).filter(TargetConfig.is_active == True).all()
            active_config_names = [c.name for c in active_configs]
            
            # Load active targets that belong to active configs
            self.targets = db.query(TargetSkin).filter(
                TargetSkin.is_active == True,
                TargetSkin.config_name.in_(active_config_names)
            ).all()

            # Attach emojis to the loaded targets
            for t in self.targets:
                config = next((c for c in active_configs if c.name == t.config_name), None)
                if config and config.emoji:
                    t.config_emoji = config.emoji
                else:
                    t.config_emoji = None
            
            target_list = [f"{t.item_name} ({t.config_name})" for t in self.targets]
            logger.info(f"Loaded {len(self.targets)} active targets from active configs: {target_list}")
            
            # Load sticker collections for expanding generic filters
            import json, os
            self.sticker_collections = {}
            mapping_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'scripts', 'temp_sticker_mapping.json')
            if os.path.exists(mapping_path):
                with open(mapping_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    mapping = data.get('mapping', {})
                    for coll_name, types in mapping.items():
                        all_stickers = []
                        for type_list in types.values():
                            all_stickers.extend(type_list)
                        self.sticker_collections[coll_name] = all_stickers
                logger.info(f"Loaded {len(self.sticker_collections)} sticker collections for analyzer")
        except Exception as e:
            logger.error(f"Error reloading generic knowledge base: {e}")
        finally:
            db.close()

    def check_listing(self, listing):
        """
        Analyzes a single listing against all targets.
        Returns a LIST of dictionaries with 'action', 'target', 'reason', etc.
        """
        item_data = listing.get('item') or {}
        type_name = item_data.get('type_name', '')
        
        # Only process skins (ignore containers, stickers, etc.)
        if type_name != "Skin":
            return []

        item_name = item_data.get('item_name')
        price = listing.get('price', 0) / 100.0 # Convert cents to dollars
        float_value = item_data.get('float_value', 1.0)
        
        # 1. Detect Blue Gem Tier from listing
        badges = item_data.get('badges', [])
        listing_blue_gem_tier = None
        if "blue_gem_1" in badges: listing_blue_gem_tier = 1
        elif "blue_gem_2" in badges: listing_blue_gem_tier = 2
        elif "blue_gem_3" in badges: listing_blue_gem_tier = 3
        elif "blue_gem_4" in badges: listing_blue_gem_tier = 4

        # Detect Float Rank badge
        listing_float_rank = None
        if "gold_highest_float" in badges: listing_float_rank = "gold_highest_float"
        elif "gold_lowest_float" in badges: listing_float_rank = "gold_lowest_float"
        elif "silver_highest_float" in badges: listing_float_rank = "silver_highest_float"
        elif "silver_lowest_float" in badges: listing_float_rank = "silver_lowest_float"
        elif "bronze_highest_float" in badges: listing_float_rank = "bronze_highest_float"
        elif "bronze_lowest_float" in badges: listing_float_rank = "bronze_lowest_float"

        float_rank_value = item_data.get('high_rank') or item_data.get('low_rank')

        listing_phase = item_data.get('phase') or item_data.get('phase_name')

        item_paint_seed = item_data.get('paint_seed')
        
        # Extract blue percentage data from listing
        playside_blue = 0.0
        backside_blue = 0.0
        bg_container = item_data.get('blue_gem', {})
        if isinstance(bg_container, dict):
            playside_blue = bg_container.get('playside_blue', 0.0)
            backside_blue = bg_container.get('backside_blue', 0.0)
        
        # Extract fade percentage data from listing
        fade_percentage = 0.0
        fade_container = item_data.get('fade', {})
        if isinstance(fade_container, dict):
            fade_percentage = fade_container.get('percentage', 0.0)
            
        # Calculate SP% for the listing once
        sp_percent = None
        stickers_total_price = 0.0
        listing_stickers = item_data.get('stickers', [])
        
        if listing_stickers:
            reference_data = listing.get('reference', listing.get('Reference', {}))
            base_skin_price = reference_data.get('predicted_price', reference_data.get('base_price', 0))
            if base_skin_price > 0:
                base_skin_price = base_skin_price / 100.0
            
            for sticker in listing_stickers:
                ref = sticker.get('reference') or {}
                sticker_price_cents = ref.get('price', 0)
                stickers_total_price += sticker_price_cents / 100.0
                
            if stickers_total_price > 0 and base_skin_price > 0:
                sp_percent = ((price - base_skin_price) / stickers_total_price) * 100

        # Calculate charms total price once
        charms_total_price = 0.0
        listing_charms = item_data.get('keychains', [])
        if listing_charms:
            for charm in listing_charms:
                ref = charm.get('reference') or {}
                charm_price_cents = ref.get('price', 0)
                charms_total_price += charm_price_cents / 100.0

        results = []

        # 2. Check against ALL specific targets
        for target in self.targets:
            matched_filters = {}
            # Match strictly, or match if target is a generic weapon name (e.g. "AWP")
            is_match = False
            if target.item_name == "*":
                is_match = True
            elif target.item_name == item_name:
                is_match = True
            elif item_name.startswith(f"{target.item_name} |") or item_name.startswith(f"{target.item_name} ("):
                is_match = True
                
            if is_match:
                if target.item_name != '*':
                    matched_filters['item_name'] = True
                # Basic constraints
                if price < target.min_price:
                    continue
                if target.max_price != -1 and price > target.max_price:
                    continue
                
                # If they set a max price filter, track that it matched
                if target.max_price != -1:
                    matched_filters['price'] = True
                    
                if float_value < target.min_float or float_value > target.max_float:
                    continue
                
                if target.min_float > 0.0 or target.max_float < 1.0:
                    matched_filters['float'] = True
                
                # Strict Blue Gem Container Check matches Fade logic
                playside_slider_active = hasattr(target, 'playside_blue_min') and hasattr(target, 'playside_blue_max') and (target.playside_blue_min > 0.0 or target.playside_blue_max < 100.0)
                playside_blue_filter_enabled = (hasattr(target, 'playside_blue_enabled') and target.playside_blue_enabled) or playside_slider_active
                
                backside_slider_active = hasattr(target, 'backside_blue_min') and hasattr(target, 'backside_blue_max') and (target.backside_blue_min > 0.0 or target.backside_blue_max < 100.0)
                backside_blue_filter_enabled = (hasattr(target, 'backside_blue_enabled') and target.backside_blue_enabled) or backside_slider_active
                
                if playside_blue_filter_enabled or backside_blue_filter_enabled:
                    # Check if item has blue_gem data, if not, skip this target
                    bg_container = item_data.get('blue_gem')
                    if not bg_container or not isinstance(bg_container, dict):
                        # If filter is enabled but no blue gem data, skip this target
                        continue
                    
                    # Additional check: ensure blue gem values are greater than 0
                    # Important: some "regular" blue gems can have percentages without blue_gem_n badge.
                    playside_blue_val = float(bg_container.get('playside_blue', 0.0) or 0.0)
                    backside_blue_val = float(bg_container.get('backside_blue', 0.0) or 0.0)
                    
                    # If both sides are 0, this item doesn't have blue gem, skip it
                    if playside_blue_val <= 0 and backside_blue_val <= 0:
                        continue

                # Playside Blue Percentage Filter
                if playside_blue_filter_enabled:
                    bg_playside = float(item_data['blue_gem'].get('playside_blue', 0.0) or 0.0)
                    if bg_playside <= 0:
                        continue
                    
                    if hasattr(target, 'playside_blue_min') and hasattr(target, 'playside_blue_max'):
                        if bg_playside < target.playside_blue_min or bg_playside > target.playside_blue_max:
                            continue
                    matched_filters['playside_blue'] = True

                # Backside Blue Percentage Filter
                if backside_blue_filter_enabled:
                    bg_backside = float(item_data['blue_gem'].get('backside_blue', 0.0) or 0.0)
                    if bg_backside <= 0:
                        continue
                        
                    if hasattr(target, 'backside_blue_min') and hasattr(target, 'backside_blue_max'):
                        if bg_backside < target.backside_blue_min or bg_backside > target.backside_blue_max:
                            continue
                    matched_filters['backside_blue'] = True
                
                # Fade Percentage Filter
                if hasattr(target, 'fade_enabled') and target.fade_enabled:
                    # Strict check: must have 'fade' container
                    fade_container = item_data.get('fade')
                    if not fade_container or not isinstance(fade_container, dict):
                        continue
                        
                    fade_pct = item_data['fade'].get('percentage', 0.0)
                    if fade_pct <= 0:
                        continue
                        
                    if hasattr(target, 'fade_min') and hasattr(target, 'fade_max'):
                        if target.fade_min is not None and target.fade_max is not None:
                            if fade_pct < target.fade_min or fade_pct > target.fade_max:
                                continue
                    matched_filters['fade'] = True
                
                # Blue Gem Tier Match
                if target.blue_gem_tier is not None:
                    if target.blue_gem_tier == 0: 
                        if listing_blue_gem_tier is not None:
                            continue
                    elif target.blue_gem_tier == 4: 
                        if listing_blue_gem_tier is None:
                            continue
                    else: 
                        if listing_blue_gem_tier != target.blue_gem_tier:
                            continue

                # Float Rank Badge Filter
                if getattr(target, 'float_rank', None):
                    tr = target.float_rank
                    matched = False
                    if tr in ["gold_highest_float", "gold_lowest_float"] and listing_float_rank in ["gold_highest_float", "gold_lowest_float"]:
                        matched = (float_rank_value == 1)
                    elif tr in ["silver_highest_float", "silver_lowest_float"] and listing_float_rank in ["silver_highest_float", "silver_lowest_float"]:
                        matched = (float_rank_value in [2, 3])
                    elif tr in ["bronze_highest_float", "bronze_lowest_float"] and listing_float_rank in ["bronze_highest_float", "bronze_lowest_float"]:
                        matched = (float_rank_value in [4, 5])
                    
                    if not matched:
                        continue
                    
                    matched_filters['float_rank'] = listing_float_rank

                # Phase Filter
                if getattr(target, 'phase', None):
                    if not listing_phase or listing_phase.lower() != target.phase.lower():
                        continue
                    matched_filters['phase'] = target.phase

                # StatTrak Filter
                if target.is_stattrak is not None:
                    listing_is_stattrak = item_data.get('is_stattrak', False)
                    if target.is_stattrak != listing_is_stattrak:
                        continue

                # Souvenir Filter
                if hasattr(target, 'is_souvenir') and target.is_souvenir is not None:
                    listing_is_souvenir = item_data.get('is_souvenir', False)
                    if target.is_souvenir != listing_is_souvenir:
                        continue

                # Normal Filter
                if hasattr(target, 'is_normal') and target.is_normal is not None:
                    listing_is_stattrak = item_data.get('is_stattrak', False)
                    listing_is_souvenir = item_data.get('is_souvenir', False)
                    listing_is_normal = not listing_is_stattrak and not listing_is_souvenir
                    if target.is_normal != listing_is_normal:
                        continue

                # Paint Seed Match
                if target.paint_seed:
                    target_seeds = [s.strip() for s in str(target.paint_seed).split(',') if s.strip()]
                    if str(item_paint_seed) not in target_seeds:
                        continue
                    matched_filters['paint_seed'] = True

                # Stickers Price Percentage Filter (SP%)
                check_stickers_price_percent = False
                sp_min = 0
                sp_max = 100

                # Check if SP% filter is enabled
                if hasattr(target, 'stickers_price_percent_enabled') and target.stickers_price_percent_enabled:
                    check_stickers_price_percent = True
                    sp_min = float(getattr(target, 'stickers_price_percent_min', 0))
                    sp_max = float(getattr(target, 'stickers_price_percent_max', 100))

                if check_stickers_price_percent:
                    if not listing_stickers:
                        # Block items without stickers when SP% filter is enabled with strict range
                        if sp_min <= 0 and sp_max >= 100:
                            pass # Allow items without stickers if range is 0-100%
                        else:
                            logger.info(f"SP% FILTER REJECT (NO STICKERS): {item_name} - range {sp_min}-{sp_max}%")
                            continue

                    if listing_stickers:
                        if sp_percent is not None:
                            if not (sp_min <= sp_percent <= sp_max):
                                logger.info(f"SP% FILTER REJECT: {item_name} - SP% {sp_percent:.2f}% not in {sp_min}-{sp_max}%")
                                continue
                        else:
                            # Can't calculate SP% without base price or stickers price
                            logger.warning(f"SP% CALC FAILED: Can't calculate SP% for {item_name}")
                            continue

                # Charm Pattern Filter
                if hasattr(target, 'charm_pattern_enabled') and target.charm_pattern_enabled:
                    if hasattr(target, 'charm_pattern_min') and hasattr(target, 'charm_pattern_max'):
                        listing_charms = item_data.get('keychains', [])
                        if not listing_charms:
                            continue
                        
                        strict_mode = getattr(target, 'charm_pattern_strict', True)
                        all_charms_valid = True
                        for charm in listing_charms:
                            pattern = charm.get('pattern')
                            if pattern is None:
                                if strict_mode:
                                    all_charms_valid = False
                                    break
                                else:
                                    continue
                            
                            if not (target.charm_pattern_min <= pattern <= target.charm_pattern_max):
                                all_charms_valid = False
                                break
                        
                        if not all_charms_valid:
                            continue
                        
                        matched_filters['charm_pattern'] = True

                # Global Sticker Wear Filter (applies if enabled and no specific stickers required)
                if not target.stickers and hasattr(target, 'sp_sticker_enabled') and target.sp_sticker_enabled:
                    listing_stickers = item_data.get('stickers', [])
                    if not listing_stickers:
                        continue
                        
                    sp_min = getattr(target, 'sp_sticker_percent_min', 0)
                    sp_max = getattr(target, 'sp_sticker_percent_max', 100)
                    
                    any_in_range = False
                    for index, ls in enumerate(listing_stickers):
                        ls_wear = ls.get('wear', 0.0)
                        ls_wear_pct = round(ls_wear * 100)
                        if sp_min <= ls_wear_pct <= sp_max:
                            any_in_range = True
                            # Remove unconditional checkmark assignment to avoid Bug 2.
                            # It previously was putting ✅ on all stickers in default 0-100% range.
                            
                    if not any_in_range:
                        logger.debug(f"[STICKER_WEAR] No sticker on {item_name} is within global range {sp_min}-{sp_max}%")
                        continue

                # Stickers Match (Match ALL)
                if target.stickers:
                    listing_stickers = item_data.get('stickers', [])
                    listing_sticker_names = [s.get('name') for s in listing_stickers]
                    
                    # Debug logging for sticker matching
                    logger.debug(f"[STICKER_MATCH] Target stickers: {target.stickers}")
                    logger.debug(f"[STICKER_MATCH] Listing stickers: {listing_sticker_names}")
                    
                    match_all = True
                    for req_sticker in target.stickers:
                        slot = "any"
                        wear_min = getattr(target, 'sp_sticker_percent_min', 0) if getattr(target, 'sp_sticker_enabled', False) else 0
                        wear_max = getattr(target, 'sp_sticker_percent_max', 100) if getattr(target, 'sp_sticker_enabled', False) else 100
                        
                        if isinstance(req_sticker, dict):
                            slot = req_sticker.get('slot', 'any')
                            name = req_sticker.get('name')
                            # Check both camelCase (from frontend JSON) and snake_case for wear boundaries
                            wear_min = req_sticker.get('wearMin', req_sticker.get('wear_min', wear_min))
                            wear_max = req_sticker.get('wearMax', req_sticker.get('wear_max', wear_max))
                        else:
                            name = req_sticker
                            
                        found = False
                        
                        # Helper to check if a listing sticker matches the criteria
                        def check_ls(ls):
                            if slot != "any" and slot is not None and ls.get('slot') != slot:
                                return False
                            ls_wear_pct = round(ls.get('wear', 0.0) * 100)
                            if not (wear_min <= ls_wear_pct <= wear_max):
                                logger.debug(f"[STICKER_WEAR] {ls.get('name')} wear={ls_wear_pct}% not in {wear_min}-{wear_max}%")
                                return False
                            return True

                        if name in getattr(self, 'sticker_collections', {}):
                            allowed_stickers = self.sticker_collections[name]
                            logger.debug(f"[STICKER_MATCH] Collection '{name}' has {len(allowed_stickers)} stickers")
                            for index, ls in enumerate(listing_stickers):
                                if ls.get('name') in allowed_stickers and check_ls(ls):
                                    found = True
                                    logger.debug(f"[STICKER_MATCH] Found collection sticker within wear limits: {ls.get('name')}")
                                    matched_filters.setdefault('matched_sticker_indices', []).append(index)
                        else:
                            # Exact sticker match
                            for index, ls in enumerate(listing_stickers):
                                if ls.get('name') == name and check_ls(ls):
                                    found = True
                                    logger.debug(f"[STICKER_MATCH] Found exact sticker within wear limits: {ls.get('name')}")
                                    matched_filters.setdefault('matched_sticker_indices', []).append(index)
                                    
                        if not found:
                            logger.debug(f"[STICKER_MATCH] NOT FOUND or OUT OF WEAR RANGE: {req_sticker}")
                            match_all = False
                            break
                            
                    if not match_all:
                        logger.debug(f"[STICKER_MATCH] Overall match FAILED for target {target.item_name}")
                        continue                
                # Charms Match (Match ALL)
                if target.charms:
                    listing_charms = [c.get('name') for c in item_data.get('keychains', [])]
                    match_all_charms = True
                    for req_charm in target.charms:
                        if req_charm not in listing_charms:
                            match_all_charms = False
                            break
                    if not match_all_charms:
                        continue
                    matched_filters['charms'] = True

                # Charm Profit Filter
                check_charm_profit = False
                if hasattr(target, 'charm_profit_enabled') and target.charm_profit_enabled:
                    if not listing_charms:
                        continue  # Reject items without charms
                    # Flag for main.py to check market data
                    check_charm_profit = True

                # Rarity Filter
                if target.rarity_name:
                    listing_rarity = item_data.get('rarity_name', '').lower()
                    target_rarity = target.rarity_name.lower()
                    if listing_rarity != target_rarity:
                        continue

                # Zero Price Filter check trigger
                # We'll need to fetch market data, handled in main.py
                
                check_discount_overpay = False
                if hasattr(target, 'discount_overpay_min') and hasattr(target, 'discount_overpay_max'):
                    # A discount overpay filter is active if min != 0 or max != 0
                    if target.discount_overpay_min or target.discount_overpay_max:
                        check_discount_overpay = True
                
                # Check if SP filter is enabled and should be applied
                check_stickers_price_percent = False
                if hasattr(target, 'stickers_price_percent_enabled') and target.stickers_price_percent_enabled:
                    # Enable check regardless of sticker price (handle 0/no stickers in main.py)
                    check_stickers_price_percent = True
                
                # Construct result
                reason = f"Matched target {target.item_name}"
                if listing_blue_gem_tier:
                    reason = f"TIER {listing_blue_gem_tier} BLUE GEM FOUND!"
                elif listing_float_rank:
                    rank_labels = {
                        'gold_highest_float': 'GOLD FLOAT RANK',
                        'gold_lowest_float': 'GOLD FLOAT RANK',
                        'silver_highest_float': 'SILVER FLOAT RANK',
                        'silver_lowest_float': 'SILVER FLOAT RANK',
                        'bronze_highest_float': 'BRONZE FLOAT RANK',
                        'bronze_lowest_float': 'BRONZE FLOAT RANK'
                    }
                    reason = f"{rank_labels.get(listing_float_rank, 'FLOAT RANK')} FOUND!"

                results.append({
                    "action": "notify" if target.mode == "Notify Only" else "buy",
                    "target": target,
                    "reason": reason,
                    "blue_gem_tier": listing_blue_gem_tier,
                    "listing_float_rank": listing_float_rank,
                    "listing_float_rank_value": float_rank_value,
                    "check_zero_price": target.zero_price_filter,
                    "check_discount_overpay": check_discount_overpay,
                    "check_stickers_price_percent": check_stickers_price_percent,
                    "check_charm_profit": check_charm_profit,
                    "stickers_total_price": stickers_total_price,
                    "charms_total_price": charms_total_price,
                    "playside_blue": playside_blue,
                    "stickers_price_percent": sp_percent,
                    "matched_filters": matched_filters
                })

        return results
