use crate::api_models::Listing;
use crate::models::TargetSkin;
use serde_json::Value;
use std::collections::HashMap;
use std::fs;

#[derive(Debug, Clone)]
pub struct AnalyzerResult {
    pub action: String,
    pub target_id: i64,
    pub reason: String,
    pub blue_gem_tier: Option<i64>,
    pub float_rank: Option<String>,
    pub float_rank_value: Option<i64>,
    pub check_zero_price: bool,
    pub check_discount_overpay: bool,
    pub check_stickers_price_percent: bool,
    pub check_charm_profit: bool,
    pub stickers_total_price: f64,
    pub charms_total_price: f64,
    pub playside_blue: f64,
    pub stickers_price_percent: Option<f64>,
    pub matched_filters: HashMap<String, Value>,
}

pub struct Analyzer {
    pub targets: Vec<TargetSkin>,
    pub sticker_collections: HashMap<String, Vec<String>>,
}

impl Analyzer {
    pub fn new() -> Self {
        Self {
            targets: Vec::new(),
            sticker_collections: HashMap::new(),
        }
    }

    pub async fn refresh_knowledge_base(&mut self, pool: &sqlx::SqlitePool) -> Result<(), sqlx::Error> {
        let active_configs = crate::database::query_active_configs(pool).await?;
        let active_config_names: Vec<String> = active_configs.iter().map(|c| c.name.clone()).collect();
        
        self.targets = crate::database::query_active_targets(pool, &active_config_names).await?;
        
        let target_list: Vec<String> = self.targets.iter()
            .map(|t| format!("{} ({})", t.item_name, t.config_name))
            .collect();
            
        tracing::info!("Loaded {} active targets from active configs: {:?}", self.targets.len(), target_list);
        
        self.sticker_collections.clear();
        let mapping_path = "../scripts/temp_sticker_mapping.json";
        if let Ok(raw) = fs::read_to_string(mapping_path) {
            if let Ok(parsed) = serde_json::from_str::<Value>(&raw) {
                if let Some(mapping) = parsed.get("mapping").and_then(|v| v.as_object()) {
                    for (collection_name, grouped_types) in mapping {
                        let mut all_stickers = Vec::new();
                        if let Some(group_obj) = grouped_types.as_object() {
                            for (_, sticker_list) in group_obj {
                                if let Some(arr) = sticker_list.as_array() {
                                    for sticker_name in arr {
                                        if let Some(s) = sticker_name.as_str() {
                                            all_stickers.push(s.to_string());
                                        }
                                    }
                                }
                            }
                        }
                        self.sticker_collections
                            .insert(collection_name.clone(), all_stickers);
                    }
                }
            }
        }

        tracing::info!(
            "Loaded {} sticker collections for analyzer",
            self.sticker_collections.len()
        );
        
        Ok(())
    }

    pub fn check_listing(&self, listing: &Listing) -> Vec<AnalyzerResult> {
        let item_data = match &listing.item {
            Some(i) => i,
            None => return vec![],
        };
        
        let type_name = item_data.type_name.as_deref().unwrap_or("");
        if type_name != "Skin" {
            return vec![];
        }

        let item_name = item_data.item_name.as_deref().unwrap_or("");
        let price = listing.price.unwrap_or(0) as f64 / 100.0;
        let float_value = item_data.float_value.unwrap_or(1.0);
        
        // Extract Blue Gem Tier
        let badges = item_data.badges.as_ref().map(|b| b.as_slice()).unwrap_or(&[]);
        let listing_blue_gem_tier = if badges.contains(&"blue_gem_1".to_string()) { Some(1) }
        else if badges.contains(&"blue_gem_2".to_string()) { Some(2) }
        else if badges.contains(&"blue_gem_3".to_string()) { Some(3) }
        else if badges.contains(&"blue_gem_4".to_string()) { Some(4) }
        else { None };

        // Extract Fire & Ice Tier
        let listing_fire_ice_tier = if badges.contains(&"fi_max_1".to_string()) { Some(1) }
        else if badges.contains(&"fi_max_2".to_string()) { Some(2) }
        else if badges.contains(&"fi_max_3".to_string()) { Some(3) }
        else { None };

        // Float Ranks
        let listing_float_rank = if badges.contains(&"gold_highest_float".to_string()) { Some("gold_highest_float".to_string()) }
        else if badges.contains(&"gold_lowest_float".to_string()) { Some("gold_lowest_float".to_string()) }
        else if badges.contains(&"silver_highest_float".to_string()) { Some("silver_highest_float".to_string()) }
        else if badges.contains(&"silver_lowest_float".to_string()) { Some("silver_lowest_float".to_string()) }
        else if badges.contains(&"bronze_highest_float".to_string()) { Some("bronze_highest_float".to_string()) }
        else if badges.contains(&"bronze_lowest_float".to_string()) { Some("bronze_lowest_float".to_string()) }
        else { None };

        let float_rank_value = item_data.high_rank.or(item_data.low_rank);
        let listing_phase = item_data.phase.as_deref().or(item_data.phase_name.as_deref());
        let item_paint_seed = item_data.paint_seed.or(item_data.keychain_pattern);

        let mut playside_blue = 0.0;
        let mut backside_blue = 0.0;
        if let Some(blue_gem) = &item_data.blue_gem {
            if let Some(obj) = blue_gem.as_object() {
                playside_blue = obj.get("playside_blue").and_then(|v| v.as_f64()).unwrap_or(0.0);
                backside_blue = obj.get("backside_blue").and_then(|v| v.as_f64()).unwrap_or(0.0);
            }
        }

        let mut fade_percentage = 0.0;
        if let Some(fade) = &item_data.fade {
            if let Some(obj) = fade.as_object() {
                fade_percentage = obj.get("percentage").and_then(|v| v.as_f64()).unwrap_or(0.0);
            }
        }

        let mut sp_percent: Option<f64> = None;
        let mut stickers_total_price = 0.0;
        let listing_stickers = item_data.stickers.as_ref().map(|s| s.as_slice()).unwrap_or(&[]);

        if !listing_stickers.is_empty() {
            let reference_data = listing.reference.as_ref().or(listing.reference_alt.as_ref());
            let mut base_skin_price = 0.0;
            if let Some(r) = reference_data {
                let cents = r.predicted_price.unwrap_or(r.base_price.unwrap_or(0));
                if cents > 0 { base_skin_price = cents as f64 / 100.0; }
            }

            for sticker in listing_stickers {
                if let Some(r) = &sticker.reference {
                    let cents = r.price.unwrap_or(0);
                    stickers_total_price += cents as f64 / 100.0;
                }
            }

            if stickers_total_price > 0.0 && base_skin_price > 0.0 {
                sp_percent = Some(((price - base_skin_price) / stickers_total_price) * 100.0);
            }
        }

        let mut charms_total_price = 0.0;
        let listing_charms = item_data.keychains.as_ref().map(|c| c.as_slice()).unwrap_or(&[]);
        if !listing_charms.is_empty() {
            for charm in listing_charms {
                if let Some(r) = &charm.reference {
                    let cents = r.price.unwrap_or(0);
                    charms_total_price += cents as f64 / 100.0;
                }
            }
        }

        // One-time diagnostics: log first listing's filter results
        static DIAG_DONE: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
        let do_diag = !DIAG_DONE.load(std::sync::atomic::Ordering::Relaxed);
        if do_diag {
            DIAG_DONE.store(true, std::sync::atomic::Ordering::Relaxed);
            tracing::info!("[Analyzer DIAG] First listing: item='{}' type='{}' price={:.2} float={:.4}",
                item_name, item_data.type_name.as_deref().unwrap_or("?"), price, float_value);
        }

        let mut results = Vec::new();

        for target in &self.targets {
            let mut matched_filters = HashMap::new();
            
            let is_match = if target.item_name == "*" {
                true
            } else if target.item_name == item_name {
                true
            } else if item_name.starts_with(&format!("{} |", target.item_name)) || item_name.starts_with(&format!("{} (", target.item_name)) {
                true
            } else {
                false
            };

            if !is_match {
                if do_diag { tracing::debug!("[Analyzer DIAG] target={} SKIP: name mismatch (item='{}')", target.id, item_name); }
                continue;
            }


            if target.item_name != "*" {
                matched_filters.insert("item_name".to_string(), Value::Bool(true));
            }

            if price < target.min_price { continue; }
            if target.max_price != -1.0 && price > target.max_price { continue; }

            if target.max_price != -1.0 {
                matched_filters.insert("price".to_string(), Value::Bool(true));
            }

            if float_value < target.min_float || float_value > target.max_float { continue; }
            if target.min_float > 0.0 || target.max_float < 1.0 {
                matched_filters.insert("float".to_string(), Value::Bool(true));
            }

            // Blue Gem / Fade Filters
            let playside_slider_active = target.playside_blue_min > 0.0 || target.playside_blue_max < 100.0;
            let playside_blue_filter_enabled = target.playside_blue_enabled || playside_slider_active;
            
            let backside_slider_active = target.backside_blue_min > 0.0 || target.backside_blue_max < 100.0;
            let backside_blue_filter_enabled = target.backside_blue_enabled || backside_slider_active;

            if playside_blue_filter_enabled || backside_blue_filter_enabled {
                if item_data.blue_gem.is_none() || (playside_blue <= 0.0 && backside_blue <= 0.0) {
                    continue;
                }
            }

            if playside_blue_filter_enabled {
                if playside_blue <= 0.0 { continue; }
                if playside_blue < target.playside_blue_min || playside_blue > target.playside_blue_max { continue; }
                matched_filters.insert("playside_blue".to_string(), Value::Bool(true));
            }

            if backside_blue_filter_enabled {
                if backside_blue <= 0.0 { continue; }
                if backside_blue < target.backside_blue_min || backside_blue > target.backside_blue_max { continue; }
                matched_filters.insert("backside_blue".to_string(), Value::Bool(true));
            }

            if target.fade_enabled {
                if item_data.fade.is_none() || fade_percentage <= 0.0 { continue; }
                if let (Some(min), Some(max)) = (target.fade_min, target.fade_max) {
                    if fade_percentage < min || fade_percentage > max { continue; }
                }
                matched_filters.insert("fade".to_string(), Value::Bool(true));
            }

            // Blue Gem Tier
            if let Some(target_tier) = target.blue_gem_tier {
                if target_tier == 0 {
                    if listing_blue_gem_tier.is_some() { continue; }
                } else if target_tier == 4 {
                    if listing_blue_gem_tier.is_none() { continue; }
                } else if listing_blue_gem_tier != Some(target_tier) {
                    continue;
                }
            }

            // Fire & Ice Filter
            if target.fire_and_ice_enabled {
                if let Some(ref target_tier) = target.fire_and_ice_tier {
                    let expected_tier = match target_tier.as_str() {
                        "1st" => Some(1),
                        "2nd" => Some(2),
                        "3rd" => Some(3),
                        _ => None,
                    };
                    if expected_tier.is_some() && listing_fire_ice_tier != expected_tier {
                        continue;
                    }
                    if expected_tier.is_none() && listing_fire_ice_tier.is_none() {
                        continue;
                    }
                } else if listing_fire_ice_tier.is_none() {
                    continue;
                }
                matched_filters.insert("fire_and_ice".to_string(), Value::Bool(true));
            }

            // Float Rank
            if let Some(ref tr) = target.float_rank {
                if !tr.is_empty() {
                    let mut matched = false;
                    if (tr == "gold_highest_float" || tr == "gold_lowest_float") &&
                       (listing_float_rank.as_deref() == Some("gold_highest_float") || listing_float_rank.as_deref() == Some("gold_lowest_float")) {
                        matched = float_rank_value == Some(1);
                    } else if (tr == "silver_highest_float" || tr == "silver_lowest_float") &&
                       (listing_float_rank.as_deref() == Some("silver_highest_float") || listing_float_rank.as_deref() == Some("silver_lowest_float")) {
                        matched = vec![Some(2), Some(3)].contains(&float_rank_value);
                    } else if (tr == "bronze_highest_float" || tr == "bronze_lowest_float") &&
                       (listing_float_rank.as_deref() == Some("bronze_highest_float") || listing_float_rank.as_deref() == Some("bronze_lowest_float")) {
                        matched = vec![Some(4), Some(5)].contains(&float_rank_value);
                    }
                    if !matched { continue; }
                    matched_filters.insert("float_rank".to_string(), Value::String(listing_float_rank.clone().unwrap_or_default()));
                }
            }

            // Phase
            if let Some(ref tp) = target.phase {
                if !tp.is_empty() {
                    if listing_phase.map(|s| s.to_lowercase()) != Some(tp.to_lowercase()) { continue; }
                    matched_filters.insert("phase".to_string(), Value::String(tp.clone()));
                }
            }

            // Statuses
            if let Some(target_st) = target.is_stattrak {
                if target_st != item_data.is_stattrak.unwrap_or(false) { continue; }
            }
            if let Some(target_sv) = target.is_souvenir {
                if target_sv != item_data.is_souvenir.unwrap_or(false) { continue; }
            }
            if let Some(target_norm) = target.is_normal {
                let listing_is_norm = !item_data.is_stattrak.unwrap_or(false) && !item_data.is_souvenir.unwrap_or(false);
                if target_norm != listing_is_norm { continue; }
            }

            // Paint Seed
            if let Some(ref ts) = target.paint_seed {
                let target_seeds: Vec<&str> = ts.split(',').map(|s| s.trim()).filter(|s| !s.is_empty()).collect();
                let seed_str = item_paint_seed.map(|s| s.to_string()).unwrap_or_default();
                if !target_seeds.contains(&seed_str.as_str()) { continue; }
                matched_filters.insert("paint_seed".to_string(), Value::Bool(true));
            }

            // SP% Filter
            let check_sp = target.stickers_price_percent_enabled;
            if check_sp {
                let sp_min = target.stickers_price_percent_min;
                let sp_max = target.stickers_price_percent_max;

                if listing_stickers.is_empty() {
                    if sp_min > 0.0 || sp_max < 100.0 { continue; }
                } else if let Some(sp) = sp_percent {
                    if sp < sp_min || sp > sp_max { continue; }
                } else {
                    continue; // Calculation failed
                }
            }

            // Charm Pattern
            if target.charm_pattern_enabled {
                if listing_charms.is_empty() { continue; }
                let mut all_valid = true;
                for c in listing_charms {
                    match c.pattern {
                        Some(p) => {
                            if p < target.charm_pattern_min || p > target.charm_pattern_max {
                                all_valid = false;
                                break;
                            }
                        }
                        None => {
                            if target.charm_pattern_strict {
                                all_valid = false;
                                break;
                            }
                        }
                    }
                }
                if !all_valid { continue; }
                matched_filters.insert("charm_pattern".to_string(), Value::Bool(true));
            }

            // Target Stickers Definition parsing
            let mut target_stickers: Vec<Value> = Vec::new();
            if let Some(ref s_val) = target.stickers {
                target_stickers = s_val.as_ref().clone();
            }

            // Global Wear Filter (if no specific stickers demanded)
            if target_stickers.is_empty() && target.sp_sticker_enabled {
                if listing_stickers.is_empty() { continue; }
                let sp_min = target.sp_sticker_percent_min;
                let sp_max = target.sp_sticker_percent_max;
                let mut any_in_range = false;

                for ls in listing_stickers {
                    let wear_pct = (ls.wear.unwrap_or(0.0) * 100.0).round();
                    if wear_pct >= sp_min && wear_pct <= sp_max {
                        any_in_range = true;
                    }
                }
                if !any_in_range { continue; }
            }

            // Specific Stickers Match
            if !target_stickers.is_empty() {
                let mut match_all = true;
                for req_s in &target_stickers {
                    let mut req_name = "".to_string();
                    let mut req_slot: Option<i64> = None;
                    let mut wear_min: f64 = if target.sp_sticker_enabled { target.sp_sticker_percent_min } else { 0.0 };
                    let mut wear_max: f64 = if target.sp_sticker_enabled { target.sp_sticker_percent_max } else { 100.0 };

                    if let Some(obj) = req_s.as_object() {
                        req_name = obj.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        req_slot = obj.get("slot").and_then(|v| {
                            if v.as_str() == Some("any") { None }
                            else { v.as_i64() }
                        });
                        if let Some(wm) = obj.get("wearMin").or(obj.get("wear_min")).and_then(|v| v.as_f64()) {
                            wear_min = wm;
                        }
                        if let Some(wm) = obj.get("wearMax").or(obj.get("wear_max")).and_then(|v| v.as_f64()) {
                            wear_max = wm;
                        }
                    } else if let Some(s) = req_s.as_str() {
                        req_name = s.to_string();
                    }

                    let mut found = false;
                    let check_ls = |ls: &&crate::api_models::StickerData| -> bool {
                        if req_slot.is_some() && ls.slot != req_slot { return false; }
                        let wear_pct = (ls.wear.unwrap_or(0.0) * 100.0).round();
                        if wear_pct < wear_min || wear_pct > wear_max { return false; }
                        true
                    };

                    if let Some(allowed) = self.sticker_collections.get(&req_name) {
                        for (i, ls) in listing_stickers.iter().enumerate() {
                            let ls_name = ls.name.as_deref().unwrap_or("");
                            if allowed.iter().any(|a| a == ls_name) && check_ls(&ls) {
                                found = true;
                                let arr = matched_filters
                                    .entry("matched_sticker_indices".to_string())
                                    .or_insert(Value::Array(Vec::new()));
                                if let Value::Array(v) = arr {
                                    v.push(Value::from(i as i64));
                                }
                            }
                        }
                    } else {
                        for (i, ls) in listing_stickers.iter().enumerate() {
                            let ls_name = ls.name.as_deref().unwrap_or("");
                            if ls_name == req_name && check_ls(&ls) {
                                found = true;
                                let arr = matched_filters
                                    .entry("matched_sticker_indices".to_string())
                                    .or_insert(Value::Array(Vec::new()));
                                if let Value::Array(v) = arr {
                                    v.push(Value::from(i as i64));
                                }
                            }
                        }
                    }

                    if !found {
                        match_all = false;
                        break;
                    }
                }
                if !match_all { continue; }
            }

            // Charms
            let mut target_charms = Vec::new();
            if let Some(ref c_val) = target.charms {
                for v in c_val.as_ref() {
                    target_charms.push(v.to_string());
                }
            }

            if !target_charms.is_empty() {
                let listing_charm_names: Vec<&str> = listing_charms.iter().filter_map(|c| c.name.as_deref()).collect();
                let mut match_all = true;
                for req_c in target_charms {
                    if !listing_charm_names.iter().any(|&c| c == req_c.as_str()) {
                        match_all = false;
                        break;
                    }
                }
                if !match_all { continue; }
                matched_filters.insert("charms".to_string(), Value::Bool(true));
            }

            if target.charm_profit_enabled && listing_charms.is_empty() {
                continue;
            }

            // Rarity
            if let Some(ref tr) = target.rarity_name {
                if !tr.is_empty() {  // empty string == no filter (matches Python's `if target.rarity_name:`)
                    if item_data.rarity_name.as_deref().unwrap_or("").to_lowercase() != tr.to_lowercase() {
                        continue;
                    }
                }
            }

            let mut reason = format!("Matched target {}", target.item_name);
            if let Some(bg_tier) = listing_blue_gem_tier {
                reason = format!("TIER {} BLUE GEM FOUND!", bg_tier);
            } else if let Some(ref rank) = listing_float_rank {
                let rank_label = match rank.as_str() {
                    "gold_highest_float" | "gold_lowest_float" => "GOLD FLOAT RANK",
                    "silver_highest_float" | "silver_lowest_float" => "SILVER FLOAT RANK",
                    "bronze_highest_float" | "bronze_lowest_float" => "BRONZE FLOAT RANK",
                    _ => "FLOAT RANK",
                };
                reason = format!("{} FOUND!", rank_label);
            }

            let discount_overpay_min = target.discount_overpay_min.unwrap_or(0.0);
            let discount_overpay_max = target.discount_overpay_max.unwrap_or(0.0);
            let check_discount_overpay = discount_overpay_min != 0.0 || discount_overpay_max != 0.0;

            results.push(AnalyzerResult {
                action: if target.mode == "Notify Only" { "notify".to_string() } else { "buy".to_string() },
                target_id: target.id,
                reason,
                blue_gem_tier: listing_blue_gem_tier,
                float_rank: listing_float_rank.clone(),
                float_rank_value,
                check_zero_price: target.zero_price_filter,
                check_discount_overpay,
                check_stickers_price_percent: target.stickers_price_percent_enabled,
                check_charm_profit: target.charm_profit_enabled,
                stickers_total_price,
                charms_total_price,
                playside_blue,
                stickers_price_percent: sp_percent,
                matched_filters,
            });
        }

        results
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::api_models::{Listing, ItemData};

    #[test]
    fn test_float_rank_matching() {
        let mut analyzer = Analyzer::new();
        
        let target = TargetSkin {
            id: 1,
            item_name: "*".to_string(),
            min_price: 0.0,
            max_price: -1.0,
            min_float: 0.0,
            max_float: 1.0,
            paint_seed: None,
            stickers: None,
            charms: None,
            blue_gem_tier: None,
            mode: "Notify Only".to_string(),
            markup_pct: 0.0,
            markup_mult: 0.0,
            is_active: true,
            is_stattrak: None,
            is_souvenir: None,
            is_normal: None,
            rarity_name: None,
            zero_price_filter: false,
            playside_blue_enabled: false,
            playside_blue_min: 0.0,
            playside_blue_max: 100.0,
            backside_blue_enabled: false,
            backside_blue_min: 0.0,
            backside_blue_max: 100.0,
            sp_sticker_enabled: false,
            sp_sticker_percent_min: 0.0,
            sp_sticker_percent_max: 100.0,
            stickers_price_percent_enabled: false,
            stickers_price_percent_min: 0.0,
            stickers_price_percent_max: 100.0,
            charm_pattern_enabled: false,
            charm_pattern_min: 0,
            charm_pattern_max: 100000,
            charm_pattern_strict: false,
            charm_profit_enabled: false,
            charm_profit_min: 0.0,
            charm_profit_max: 100.0,
            charm_profit_use_lowest_price: false,
            discount_overpay_min: None,
            discount_overpay_max: None,
            fade_enabled: false,
            fade_min: None,
            fade_max: None,
            float_rank: Some("gold_highest_float".to_string()),
            phase: None,
            config_name: "Float".to_string(),
            description: None,
            notifications_enabled: true,
        };
        analyzer.targets.push(target);

        // Listing with gold lowest float rank
        let listing = Listing {
            id: "123".to_string(),
            created_at: None,
            r#type: Some("buy_now".to_string()),
            price: Some(1000),
            min_offer_price: None,
            state: Some("listed".to_string()),
            item: Some(ItemData {
                cs2_screenshot_id: None,
                asset_id: Some("123".to_string()),
                def_index: Some(1),
                paint_index: Some(1),
                paint_seed: Some(1),
                float_value: Some(0.999),
                item_name: Some("USP-S | Cortex".to_string()),
                market_hash_name: Some("USP-S | Cortex (Battle-Scarred)".to_string()),
                icon_url: None,
                wear_name: Some("Battle-Scarred".to_string()),
                phase: None,
                phase_name: None,
                type_name: Some("Skin".to_string()),
                is_stattrak: Some(false),
                is_souvenir: Some(false),
                rarity_name: Some("Classified".to_string()),
                high_rank: None,
                low_rank: Some(1),
                pattern: None,
                keychain_pattern: None,
                stickers: None,
                keychains: None,
                blue_gem: None,
                fade: None,
                badges: Some(vec!["gold_lowest_float".to_string()]),
            }),
            reference: None,
            reference_alt: None,
        };

        let results = analyzer.check_listing(&listing);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].float_rank, Some("gold_lowest_float".to_string()));
    }
}
