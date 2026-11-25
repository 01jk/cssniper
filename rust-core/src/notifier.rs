use std::collections::HashMap;
use chrono::{DateTime, Utc};
use serde_json::Value;

use crate::api_models::Listing;
use crate::market_data::MarketDataResult;
use crate::models::TargetSkin;

// ─────────────────────────────────────────────────────────────────────────────
// TelegramNotifier
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct TelegramNotifier {
    /// Primary bot token (used for general notifications)
    token: Option<String>,
    /// Secondary "target" bot token (used for listing notifications)
    target_token: Option<String>,
    /// One or more chat IDs to send messages to
    chat_ids: Vec<String>,
    /// HTTP client shared across all calls
    client: reqwest::Client,
}

impl TelegramNotifier {
    /// Create a new notifier.  All three parameters are optional — if missing,
    /// the notifier operates in "mock" mode and only logs messages.
    pub fn new(
        token: Option<String>,
        chat_id: Option<String>,
        target_token: Option<String>,
    ) -> Self {
        let chat_ids = Self::parse_chat_ids(chat_id.as_deref());

        match &token {
            Some(t) => tracing::info!(
                "[Notifier] Main bot initialized (token: {}...). Chat IDs: {:?}",
                &t[..t.len().min(10)],
                chat_ids
            ),
            None => tracing::warn!("[Notifier] No telegram_bot_token configured — notifications disabled."),
        }
        if chat_ids.is_empty() {
            tracing::warn!("[Notifier] telegram_chat_id is empty — no recipients configured.");
        }
        if target_token.is_some() {
            tracing::info!("[Notifier] Target bot initialized (separate token).");
        }

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .unwrap_or_default();

        Self { token, target_token, chat_ids, client }
    }

    /// Parse a single string that may contain comma-separated chat IDs,
    /// optionally wrapped in brackets/quotes (Python list notation).
    fn parse_chat_ids(input: Option<&str>) -> Vec<String> {
        let Some(raw) = input else { return vec![] };
        let cleaned = raw
            .replace('[', "")
            .replace(']', "")
            .replace('\'', "")
            .replace('"', "");
        if cleaned.contains(',') {
            cleaned
                .split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect()
        } else {
            let trimmed = cleaned.trim().to_string();
            if trimmed.is_empty() { vec![] } else { vec![trimmed] }
        }
    }

    // ─── Low-level send helpers ──────────────────────────────────────────────

    /// Send `text` via `token` to all configured chat IDs using JSON body.
    async fn send_via(&self, token: &str, text: &str) -> usize {
        let mut ok = 0usize;
        for cid in &self.chat_ids {
            let url = format!("https://api.telegram.org/bot{}/sendMessage", token);
            let body = serde_json::json!({
                "chat_id": cid,
                "text": text,
                "parse_mode": "Markdown",
                "disable_web_page_preview": true
            });
            tracing::debug!("[Notifier] Sending to chat_id={}", cid);
            match self.client
                .post(&url)
                .header("Content-Type", "application/json")
                .json(&body)
                .send()
                .await
            {
                Ok(resp) if resp.status().is_success() => {
                    ok += 1;
                }
                Ok(resp) => {
                    let status = resp.status();
                    let body_text = resp.text().await.unwrap_or_default();
                    tracing::error!(
                        "[Notifier] Failed to send to {}: HTTP {} — {}",
                        cid, status, body_text
                    );
                }
                Err(e) => {
                    tracing::error!("[Notifier] Network error sending to {}: {}", cid, e);
                }
            }
        }
        ok
    }

    // ─── Public API (mirrors Python) ─────────────────────────────────────────

    /// Send a message using the **main** bot.
    pub async fn send_message(&self, message: &str) {
        let Some(token) = &self.token else {
            tracing::warn!("[Notifier] send_message skipped — no token configured.");
            return;
        };
        if self.chat_ids.is_empty() {
            tracing::warn!("[Notifier] send_message skipped — no chat_ids configured.");
            return;
        }
        tracing::info!("[Notifier] Sending message to {} chat(s)...", self.chat_ids.len());
        let ok = self.send_via(token, message).await;
        tracing::info!("[Notifier] Message delivered to {}/{} chats.", ok, self.chat_ids.len());
    }

    /// Send a message using the **target** bot (falls back to main bot).
    pub async fn send_target_message(&self, message: &str) {
        let token = self.target_token.as_ref().or(self.token.as_ref());
        let Some(token) = token else {
            tracing::warn!("[Notifier] send_target_message skipped — no token configured.");
            return;
        };
        if self.chat_ids.is_empty() {
            tracing::warn!("[Notifier] send_target_message skipped — no chat_ids configured.");
            return;
        }
        tracing::info!("[Notifier] Sending target message to {} chat(s)...", self.chat_ids.len());
        let ok = self.send_via(token, message).await;
        tracing::info!("[Notifier] Target message delivered to {}/{} chats.", ok, self.chat_ids.len());
    }

    // ─── Listing notification ─────────────────────────────────────────────────

    /// Port of `send_listing_notification` from Python notifier.py.
    pub async fn send_listing_notification(
        &self,
        listing: &Listing,
        target: &TargetSkin,
        market_data: Option<&MarketDataResult>,
        matched_filters: &HashMap<String, Value>,
        blue_gem_tier: Option<i64>,
        listing_float_rank: Option<&str>,
        stickers_price_percent: Option<f64>,
        purchase_mode: Option<&str>,
    ) {
        let item_data = match &listing.item {
            Some(d) => d,
            None => return,
        };

        // ── Basic fields ───────────────────────────────────────────────────
        let mut item_name = item_data
            .item_name
            .as_deref()
            .unwrap_or("Unknown")
            .to_string();
        let wear_name = item_data.wear_name.as_deref().unwrap_or("").to_string();
        let price = listing.price.unwrap_or(0) as f64 / 100.0;
        let float_val = item_data.float_value.unwrap_or(0.0);
        let paint_seed = item_data
            .paint_seed
            .or(item_data.keychain_pattern)
            .map(|s| s.to_string())
            .unwrap_or_else(|| "N/A".to_string());

        // Phase suffix
        if let Some(phase) = item_data
            .phase
            .as_deref()
            .or(item_data.phase_name.as_deref())
        {
            item_name = format!("{} ({})", item_name, phase);
        }

        // ── Blue gem percentages ───────────────────────────────────────────
        let (playside_blue, backside_blue) = extract_blue(&item_data.blue_gem);

        // ── Fade percentage ────────────────────────────────────────────────
        let (fade_percentage, fade_rank) = extract_fade(&item_data.fade);

        // ── Timing ────────────────────────────────────────────────────────
        let time_msg = format_time(listing.created_at.as_deref());

        // ── Config header decorators ───────────────────────────────────────
        let cfg_name = &target.config_name;
        let cfg_display = cfg_name.as_str();

        // ── Skin checkmark ─────────────────────────────────────────────────
        let skin_check = if matched_filters.contains_key("item_name") { " ✅" } else { "" };

        // ── Float rank labels ──────────────────────────────────────────────
        let float_rank_labels: HashMap<&str, (&str, &str)> = [
            ("gold_highest_float",   ("🥇", "GOLD FLOAT RANK")),
            ("gold_lowest_float",    ("🥇", "GOLD FLOAT RANK")),
            ("silver_highest_float", ("🥈", "SILVER FLOAT RANK")),
            ("silver_lowest_float",  ("🥈", "SILVER FLOAT RANK")),
            ("bronze_highest_float", ("🥉", "BRONZE FLOAT RANK")),
            ("bronze_lowest_float",  ("🥉", "BRONZE FLOAT RANK")),
        ]
        .into();

        // ── Header ────────────────────────────────────────────────────────
        let float_rank_value: Option<i64> = item_data.high_rank.or(item_data.low_rank);

        let badges = item_data.badges.as_ref().map(|b| b.as_slice()).unwrap_or(&[]);
        let listing_fire_ice_tier = if badges.contains(&"fi_max_1".to_string()) { Some(1) }
        else if badges.contains(&"fi_max_2".to_string()) { Some(2) }
        else if badges.contains(&"fi_max_3".to_string()) { Some(3) }
        else { None };

        let header = if let Some(fi_tier) = listing_fire_ice_tier {
            let label = if purchase_mode.is_some() { "AUTO-BOUGHT FIRE & ICE TIER" } else { "FIRE & ICE TIER" };
            format!("🔥❄️ *{} {} LOT* [{}] 🔥❄️", label, fi_tier, cfg_display)
        } else if (playside_blue > 0.0 || backside_blue > 0.0) && blue_gem_tier.is_some() {
            let label = if purchase_mode.is_some() { "AUTO-BOUGHT TIER" } else { "TIER" };
            format!(
                "💎 *{} {} ({:.2}%/{:.2}%)* [{}] 💎",
                label,
                blue_gem_tier.unwrap(),
                playside_blue,
                backside_blue,
                cfg_display
            )
        } else if let Some(tier) = blue_gem_tier {
            let label = if purchase_mode.is_some() { "AUTO-BOUGHT TIER" } else { "TIER" };
            format!("💎 *{} {} LOT* [{}] 💎", label, tier, cfg_display)
        } else if let Some(rank) = listing_float_rank {
            if let Some((emoji, label)) = float_rank_labels.get(rank) {
                let action_label = if purchase_mode.is_some() { "AUTO-BOUGHT" } else { label };
                if let Some(rank_val) = float_rank_value {
                    format!("{} *{}! #{}* [{}] {}", emoji, action_label, rank_val, cfg_display, emoji)
                } else {
                    format!("{} *{}!* [{}] {}", emoji, action_label, cfg_display, emoji)
                }
            } else {
                let label = if purchase_mode.is_some() { "AUTO-BOUGHT LOT!" } else { "FOUND LOT!" };
                format!("🎯 *{}* [{}] 🎯", label, cfg_display)
            }
        } else {
            let label = if purchase_mode.is_some() { "AUTO-BOUGHT LOT!" } else { "FOUND LOT!" };
            format!("🎯 *{}* [{}] 🎯", label, cfg_display)
        };

        // ── Market data block ─────────────────────────────────────────────
        let reference = listing.reference.as_ref().or(listing.reference_alt.as_ref());
        let api_base_price = reference
            .and_then(|r| r.base_price)
            .map(|v| v as f64 / 100.0)
            .unwrap_or(0.0);
        let api_predicted_price = reference
            .and_then(|r| r.predicted_price)
            .map(|v| v as f64 / 100.0)
            .unwrap_or(0.0);
        let fallback_predicted = market_data
            .and_then(|m| m.highest_buy_order.as_ref())
            .map(|b| b.price)
            .unwrap_or(0.0);

        let base_price_to_use = if api_predicted_price > 0.0 {
            api_predicted_price
        } else if api_base_price > 0.0 {
            api_base_price
        } else {
            fallback_predicted
        };

        let mut market_data_msg = String::new();

        if market_data.is_some() || base_price_to_use > 0.0 {
            let lowest_price = market_data.and_then(|m| m.lowest_market_price);

            if base_price_to_use > 0.0 {
                let profit_dollars = price - base_price_to_use;
                let profit_percent = (profit_dollars / base_price_to_use) * 100.0;
                let emoji_sign = if profit_dollars >= 0.0 { "➕" } else { "➖" };
                let sign = if profit_dollars >= 0.0 { "+" } else { "" };
                let label = if profit_dollars < 0.0 {
                    format!("{} *Discount:*", emoji_sign)
                } else if profit_dollars > 0.0 {
                    format!("{} *Overpay:*", emoji_sign)
                } else {
                    format!("{} *Discount/Overpay:*", emoji_sign)
                };
                market_data_msg.push_str(&format!(
                    "{} `{}{:.2}$` ({}{:.1}%)\n",
                    label, sign, profit_dollars, sign, profit_percent
                ));
            }

            if let Some(low_p) = lowest_price {
                market_data_msg.push_str(&format!("📉 *Lowest Market Price:* `${:.2}`\n", low_p));
            }

            let buy_order_price = listing
                .min_offer_price
                .filter(|&v| v > 0)
                .map(|v| v as f64 / 100.0);

            let buy_order_fallback = market_data
                .and_then(|m| m.highest_buy_order.as_ref())
                .filter(|b| b.count > 0)
                .map(|b| b.price);

            if let Some(bop) = buy_order_price {
                market_data_msg.push_str(&format!("📊 *Highest Buy Order:* `${:.2}`", bop));
            } else if let Some(bop) = buy_order_fallback {
                market_data_msg.push_str(&format!("📊 *Highest Buy Order:* `${:.2}`", bop));
            } else if market_data_msg.ends_with('\n') {
                market_data_msg.pop(); // strip trailing newline if no buy order
            }
        }

        // ── Stickers block ────────────────────────────────────────────────
        let stickers_msg = build_stickers_msg(
            item_data.stickers.as_deref(),
            stickers_price_percent,
            matched_filters,
        );

        // ── Charms block ──────────────────────────────────────────────────
        let charms_msg = build_charms_msg(
            item_data.keychains.as_deref(),
            matched_filters,
        );

        // ── Rarity emoji ──────────────────────────────────────────────────
        let rarity_msg = rarity_emoji(item_data.rarity_name.as_deref().unwrap_or(""));

        // ── Seed checkmark ────────────────────────────────────────────────
        let seed_check = if matched_filters.contains_key("paint_seed") { " ✅" } else { "" };

        // ── Blue percentage lines ─────────────────────────────────────────
        let blue_lines = if playside_blue > 0.0 || backside_blue > 0.0 {
            let blue_check = if matched_filters.contains_key("playside_blue")
                || matched_filters.contains_key("backside_blue")
            {
                " ✅"
            } else {
                ""
            };
            format!(
                "\n🔵 *Blue:* `{:.2}%/{:.2}%`{}",
                playside_blue, backside_blue, blue_check
            )
        } else {
            String::new()
        };

        // ── Fade line ─────────────────────────────────────────────────────
        let fade_line = if fade_percentage > 0.0 {
            let rank_str = if fade_rank > 0 {
                format!(" (Rank: {})", fade_rank)
            } else {
                String::new()
            };
            let fade_check = if matched_filters.contains_key("fade") { " ✅" } else { "" };
            format!("\n🌅 *Fade:* `{:.1}%`{}{}", fade_percentage, rank_str, fade_check)
        } else {
            String::new()
        };

        // ── StatTrak / Souvenir checks ─────────────────────────────────────
        let stattrak_check = if matched_filters.contains_key("is_stattrak") { " ✅" } else { "" };
        let souvenir_check = if matched_filters.contains_key("is_souvenir") { " ✅" } else { "" };

        // ── Price checkmark ───────────────────────────────────────────────
        let price_check = if matched_filters.contains_key("price") { " ✅" } else { "" };

        // ── Extras string (stickers + charms) ────────────────────────────
        let mut extras_parts = Vec::new();
        if !stickers_msg.is_empty() {
            extras_parts.push(stickers_msg);
        }
        if !charms_msg.is_empty() {
            extras_parts.push(charms_msg);
        }
        let extras_str = if !extras_parts.is_empty() {
            format!("{}\n\n", extras_parts.join("\n"))
        } else {
            String::new()
        };

        let is_stattrak = item_data.is_stattrak.unwrap_or(false);
        let is_souvenir = item_data.is_souvenir.unwrap_or(false);

        let prefix = if purchase_mode.is_some() { "✅ " } else { "" };
        let msg = format!(
            "{}{}\n\n\
             🔗 [Link to Item](https://csfloat.com/item/{})\n\n\
             {} `{}`{}\n\
             🏷️ *Wear:* `{}`\n\
             📊 *Float:* `{}`\n\
             🎨 *Seed:* `{}`{}{}{}\n\n\
             💰 *Price:* `${:.2}`{}\n\
             {}\n\n\
             ⭐ *StatTrak:* {}{}\n\
             🏆 *Souvenir:* {}{}\n\
             {}\
             🕒 *Time:* {}",
            prefix,
            header,
            listing.id,
            rarity_msg,
            item_name,
            skin_check,
            wear_name,
            float_val,
            paint_seed,
            seed_check,
            blue_lines,
            fade_line,
            price,
            price_check,
            market_data_msg,
            if is_stattrak { "✅ Yes" } else { "❌ No" },
            stattrak_check,
            if is_souvenir { "✅ Yes" } else { "❌ No" },
            souvenir_check,
            extras_str,
            time_msg,
        );

        self.send_target_message(&msg).await;
    }

    // ─── Queue notifications ─────────────────────────────────────────────────

    /// Notify about queue lifecycle events (start / stop / switch / pause / resume).
    pub async fn send_queue_change_notification(
        &self,
        queue_name: &str,
        action: &str,
        item_count: Option<usize>,
    ) {
        let emoji = match action {
            "start"  => "🚀",
            "stop"   => "🛑",
            "switch" => "🔄",
            "pause"  => "⏸️",
            "resume" => "▶️",
            _        => "📋",
        };

        let action_title = {
            let mut c = action.chars();
            match c.next() {
                Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
                None => String::new(),
            }
        };

        let mut msg = format!("{} *Queue {}*: `{}`", emoji, action_title, queue_name);
        if let Some(cnt) = item_count {
            msg.push_str(&format!("\n📊 *Items in queue*: `{}`", cnt));
        }
        self.send_message(&msg).await;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — pure functions, no `self` needed
// ─────────────────────────────────────────────────────────────────────────────

/// Extract `(playside_blue, backside_blue)` from the JSON blue_gem field.
fn extract_blue(blue_gem: &Option<serde_json::Value>) -> (f64, f64) {
    if let Some(obj) = blue_gem.as_ref().and_then(|v| v.as_object()) {
        let p = obj.get("playside_blue").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let b = obj.get("backside_blue").and_then(|v| v.as_f64()).unwrap_or(0.0);
        return (p, b);
    }
    (0.0, 0.0)
}

/// Extract `(fade_percentage, fade_rank)` from the JSON fade field.
fn extract_fade(fade: &Option<serde_json::Value>) -> (f64, i64) {
    if let Some(obj) = fade.as_ref().and_then(|v| v.as_object()) {
        let pct = obj.get("percentage").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let rank = obj.get("rank").and_then(|v| v.as_i64()).unwrap_or(-1);
        return (pct, rank);
    }
    (0.0, -1)
}

/// Format the `created_at` timestamp into `HH:MM:SS.mmm (+delay.mmms)`.
fn format_time(created_at: Option<&str>) -> String {
    let Some(raw) = created_at else {
        tracing::debug!("[TIME] No created_at in listing data");
        return "`no data`".to_string();
    };

    let cleaned = raw.replace('Z', "+00:00");
    match cleaned.parse::<DateTime<Utc>>() {
        Ok(dt) => {
            let now = Utc::now();
            let diff = now.signed_duration_since(dt);
            let delay_secs = diff.num_milliseconds() as f64 / 1000.0;
            let time_str = dt.format("%H:%M:%S%.3f").to_string();
            // Trim to 3 decimal places: "HH:MM:SS.mmm"
            let time_str = if time_str.len() > 12 { &time_str[..12] } else { &time_str };
            tracing::debug!(
                "[TIME] Parsed created_at: {} -> UTC: {}, delay: {:.3}s",
                raw, dt, delay_secs
            );
            format!("`{} (+{:.3}s)`", time_str, delay_secs)
        }
        Err(e) => {
            tracing::warn!("[TIME] Failed to parse created_at '{}': {}", raw, e);
            format!("`{} (err)`", raw)
        }
    }
}

/// Build the stickers section of the notification message.
fn build_stickers_msg(
    stickers: Option<&[crate::api_models::StickerData]>,
    stickers_price_percent: Option<f64>,
    matched_filters: &HashMap<String, Value>,
) -> String {
    let stickers = match stickers {
        Some(s) if !s.is_empty() => s,
        _ => return String::new(),
    };

    let stickers_percent_triggered = matched_filters
        .get("stickers_price_percent")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    let mut header = "\n✨ *Stickers*".to_string();
    if let Some(sp) = stickers_price_percent {
        let sign = if sp >= 0.0 { "+" } else { "" };
        header.push_str(&format!(" (SP {}{:.1}%)", sign, sp));
    }
    header.push(':');
    if stickers_percent_triggered {
        header.push_str(" ✅");
    }

    let mut msg = header;

    let matched_indices: Vec<i64> = matched_filters
        .get("matched_sticker_indices")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_i64()).collect())
        .unwrap_or_default();

    for (index, s) in stickers.iter().enumerate() {
        let s_name = s.name.as_deref().unwrap_or("Unknown Sticker");
        let s_name_display = s_name.strip_prefix("Sticker | ").unwrap_or(s_name);

        let s_price = s
            .reference
            .as_ref()
            .and_then(|r| r.price)
            .map(|p| p as f64 / 100.0)
            .unwrap_or(0.0);

        let wear = s.wear.unwrap_or(0.0);
        let wear_str = format!("{:.0}%", wear * 100.0);

        // Slot display (1-indexed; custom stickers → slot 5)
        let is_custom = s.offset_x.is_some() && s.offset_y.is_some();
        let slot_display = if is_custom {
            "5".to_string()
        } else {
            s.slot
                .map(|sl| (sl + 1).to_string())
                .unwrap_or_else(|| "?".to_string())
        };

        let sticker_check = if matched_indices.contains(&(index as i64)) { " ✅" } else { "" };

        msg.push_str(&format!(
            "\n\n• Slot {} | {} | ${:.2}{}\n{}",
            slot_display, wear_str, s_price, sticker_check, s_name_display
        ));
    }

    msg
}

/// Build the charms section of the notification message.
fn build_charms_msg(
    keychains: Option<&[crate::api_models::CharmData]>,
    matched_filters: &HashMap<String, Value>,
) -> String {
    let keychains = match keychains {
        Some(k) if !k.is_empty() => k,
        _ => return String::new(),
    };

    let charm_profit_triggered = matched_filters
        .get("charm_profit")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    // charm_profit_{percent,dollars} are stored as floats in matched_filters when set
    let charm_profit_percent = matched_filters
        .get("charm_profit_percent")
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0);
    let charm_profit_dollars = matched_filters
        .get("charm_profit_dollars")
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0);

    let profit_check = if charm_profit_triggered { " ✅" } else { "" };
    let mut msg = format!(
        "\n🧸 *Charm Profit:* `{:.1}% (${:.2})`{}",
        charm_profit_percent, charm_profit_dollars, profit_check
    );

    let charms_filter_matched = matched_filters
        .get("charms")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let charm_pattern_matched = matched_filters
        .get("charm_pattern")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    for k in keychains {
        let k_name = k.name.as_deref().unwrap_or("Unknown Charm");
        let k_price = k
            .reference
            .as_ref()
            .and_then(|r| r.price)
            .map(|p| p as f64 / 100.0)
            .unwrap_or(0.0);
        let pattern = k.pattern;

        let k_check = if charms_filter_matched {
            " ✅"
        } else if charm_pattern_matched {
            " ✅"
        } else {
            ""
        };

        let pattern_str = pattern
            .map(|p| format!("`{}`", p))
            .unwrap_or_else(|| "No Pattern".to_string());

        let collection_str = k
            .collection
            .as_deref()
            .map(|c| format!("\n{}", c))
            .unwrap_or_default();

        msg.push_str(&format!(
            "\n\n• Pattern: {} | ${:.2}{}\n{}{}",
            pattern_str, k_price, k_check, k_name, collection_str
        ));
    }

    msg
}

/// Map rarity name to its emoji (identical to Python mapping).
fn rarity_emoji(rarity: &str) -> &'static str {
    match rarity.to_lowercase().as_str() {
        "contraband"       => "🟡",
        "covert"           => "🔴",
        "classified"       => "🩷",
        "restricted"       => "🟣",
        "milspec"          => "🔵",
        "mil-spec grade"   => "🔵",
        "industrial"       => "🩵",
        "industrial grade" => "🩵",
        "consumer"         => "⚪️",
        "consumer grade"   => "⚪️",
        "extraordinary"    => "🔴",
        "remarkable"       => "🩷",
        "exotic"           => "🟣",
        "high grade"       => "🔵",
        "base grade"       => "⚪️",
        "agent quality"    => "🔵",
        _                  => "💫",
    }
}
