use reqwest::{Client, Proxy};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

#[derive(Debug, Clone)]
pub struct MarketAccount {
    pub api_key: String,
    pub proxy: Option<String>,
    pub original_index: usize,
}

#[derive(Clone)]
pub struct MarketDataSession {
    pub client: Client,
    pub proxy_url: Option<String>,
    pub api_key: String,
    pub index: usize,
    pub original_index: usize,
    pub cooldown_until: Arc<Mutex<Option<Instant>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuyOrderInfo {
    pub price: f64,
    pub count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketDataResult {
    pub highest_buy_order: Option<BuyOrderInfo>,
    pub lowest_market_price: Option<f64>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PriceListItem {
    pub market_hash_name: Option<String>,
    pub min_price: Option<i64>,
}

struct GlobalPriceListCache {
    items: Vec<PriceListItem>,
    fetched_at: Instant,
}

static GLOBAL_PRICE_LIST_CACHE: Mutex<Option<GlobalPriceListCache>> = Mutex::new(None);

pub struct MarketDataClient {
    pub sessions: Vec<MarketDataSession>,
    pub current_index: std::sync::atomic::AtomicUsize,
    pub cache_ttl: Duration,
    pub notifier: Option<crate::notifier::TelegramNotifier>,
    pub account_statuses: Option<Arc<Mutex<serde_json::Value>>>,
}

impl MarketDataClient {
    pub fn new(
        accounts: Vec<MarketAccount>,
        notifier: Option<crate::notifier::TelegramNotifier>,
        account_statuses: Option<Arc<Mutex<serde_json::Value>>>,
    ) -> Result<Self, reqwest::Error> {
        let mut sessions = Vec::new();

        for (idx, acc) in accounts.into_iter().enumerate() {
            let mut builder = Client::builder()
                .timeout(Duration::from_secs(4))
                .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
                
            if let Some(proxy_url) = &acc.proxy {
                if !proxy_url.is_empty() {
                    let normalized = crate::config::normalize_proxy(proxy_url);
                    let proxy = Proxy::all(&normalized)?;
                    builder = builder.proxy(proxy);
                }
            }

            let client = builder.build()?;
            sessions.push(MarketDataSession {
                client,
                proxy_url: acc.proxy,
                api_key: acc.api_key,
                index: idx + 1,
                original_index: acc.original_index,
                cooldown_until: Arc::new(Mutex::new(None)),
            });
        }

        if sessions.is_empty() {
            tracing::warn!("No market_data accounts configured");
        }

        Ok(Self {
            sessions,
            current_index: std::sync::atomic::AtomicUsize::new(0),
            cache_ttl: Duration::from_secs(60),
            notifier,
            account_statuses,
        })
    }

    fn is_session_on_cooldown(&self, session: &MarketDataSession) -> bool {
        if let Ok(guard) = session.cooldown_until.lock() {
            if let Some(until) = *guard {
                if Instant::now() < until {
                    return true;
                }
            }
        }

        if let Some(statuses) = &self.account_statuses {
            if let Ok(guard) = statuses.lock() {
                if let Some(market_data) = guard.get("market_data") {
                    if let Some(entry) = market_data.get(session.original_index.to_string()) {
                        if let Some(cooldown_until) = entry.get("cooldown_until").and_then(|v| v.as_f64()) {
                            let now = std::time::SystemTime::now()
                                .duration_since(std::time::UNIX_EPOCH)
                                .map(|d| d.as_secs_f64())
                                .unwrap_or(0.0);
                            if now < cooldown_until {
                                return true;
                            }
                        }
                    }
                }
            }
        }

        false
    }

    pub fn is_rate_limited(&self) -> bool {
        if self.sessions.is_empty() {
            return true;
        }
        self.sessions.iter().all(|session| self.is_session_on_cooldown(session))
    }

    fn update_status(&self, original_index: usize, status_code: u16, error: Option<&str>) {
        let Some(statuses) = &self.account_statuses else { return; };
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs_f64())
            .unwrap_or(0.0);

        let mut cooldown_until = 0.0;
        if status_code == 429 {
            if let Some(err_str) = error {
                if let Some(pos) = err_str.find("cooldown ") {
                    let rest = &err_str[pos + 9..];
                    if let Some(s_pos) = rest.find('s') {
                        if let Ok(wait_secs) = rest[..s_pos].parse::<u64>() {
                            cooldown_until = now + wait_secs as f64;
                        }
                    }
                }
            }
            if cooldown_until == 0.0 {
                cooldown_until = now + 60.0;
            }
        } else if status_code == 0 {
            cooldown_until = now + 5.0;
        }

        let entry = serde_json::json!({
            "status_code": status_code,
            "error": error.unwrap_or(""),
            "last_updated": now,
            "cooldown_until": cooldown_until,
        });
        if let Ok(mut guard) = statuses.lock() {
            if guard.get("market_data").is_none() || !guard["market_data"].is_object() {
                guard["market_data"] = serde_json::json!({});
            }
            guard["market_data"][original_index.to_string()] = entry;
        }
    }

    pub fn get_next_session(&self) -> Option<MarketDataSession> {
        if self.sessions.is_empty() {
            return None;
        }
        let start_idx = self.current_index.fetch_add(1, std::sync::atomic::Ordering::Relaxed) % self.sessions.len();
        
        for i in 0..self.sessions.len() {
            let idx = (start_idx + i) % self.sessions.len();
            let session = &self.sessions[idx];
            if self.is_session_on_cooldown(session) {
                continue;
            }
            return Some(session.clone());
        }
        
        None
    }

    pub async fn get_highest_buy_order(&self, listing_id: &str) -> Option<BuyOrderInfo> {
        let session = self.get_next_session()?;
        let url = format!("https://csfloat.com/api/v1/listings/{}/buy-orders", listing_id);
        
        let resp_res = session.client
            .get(&url)
            .header("Authorization", &session.api_key)
            .header("Content-Type", "application/json")
            .send()
            .await;

        let resp = match resp_res {
            Ok(r) => r,
            Err(e) => {
                let err_text = e.to_string();
                self.update_status(session.original_index, 0, Some(&err_text));
                if let Ok(mut guard) = session.cooldown_until.lock() {
                    *guard = Some(Instant::now() + Duration::from_secs(5));
                }
                return None;
            }
        };
            
        if resp.status().as_u16() == 200 {
            self.update_status(session.original_index, 200, None);
            let data: Vec<serde_json::Value> = resp.json().await.ok()?;
            let count = data.len() as i32;
            if count > 0 {
                let price = data[0].get("price").and_then(|v| v.as_i64()).unwrap_or(0) as f64 / 100.0;
                return Some(BuyOrderInfo { price, count });
            } else {
                return Some(BuyOrderInfo {
                    price: 0.0,
                    count: 0,
                });
            }
        } else {
            let status = resp.status().as_u16();
            tracing::warn!(
                "[Account #{}] Failed to fetch buy orders: {}",
                session.index,
                status
            );
            if status == 429 {
                let wait_secs = 3600; // 1 hour cooldown for market data 429 errors
                if let Ok(mut guard) = session.cooldown_until.lock() {
                    *guard = Some(Instant::now() + Duration::from_secs(wait_secs));
                }
                self.update_status(session.original_index, 429, Some(&format!("Rate limited, cooldown {}s", wait_secs)));
                crate::api_server::push_web_notification(
                    "warning",
                    "market_data",
                    "🚫 RATE LIMIT (Market Data) 🚫",
                    &format!("🔌 Account: #{} | ⏳ Cooldown: {}s | 📝 Details: CSFloat API 429 Too Many Requests (Buy Orders)", session.index, wait_secs),
                    Some(serde_json::json!({
                        "account_index": session.original_index,
                        "account_type": "market_data",
                        "status_code": 429,
                        "cooldown_secs": wait_secs
                    })),
                );
                if let Some(n) = &self.notifier {
                    let n_clone = n.clone();
                    let session_idx = session.index;
                    tokio::spawn(async move {
                        n_clone.send_message(&format!(
                            "🚫 *RATE LIMIT (Market Data)* 🚫\n\n🔌 *Account:* #{}\n⏳ *Cooldown:* {}s\n📝 *Details:* CSFloat API 429 Too Many Requests (Buy Orders)",
                            session_idx, wait_secs
                        )).await;
                    });
                }
            } else {
                self.update_status(session.original_index, status, Some(&format!("HTTP {}", status)));
                if let Some(n) = &self.notifier {
                    let _ = n.send_message(&format!("⚠️ *Market Data Error*\nFailed to fetch buy orders.\nAccount: #{}\nStatus Code: `{}`", session.index, status)).await;
                }
            }
        }
        
        None
    }

    pub async fn get_lowest_market_price(&self, market_hash_name: &str) -> Option<f64> {
        if let Ok(lock) = GLOBAL_PRICE_LIST_CACHE.lock() {
            if let Some(cache) = &*lock {
                if cache.fetched_at.elapsed() < self.cache_ttl {
                    for item in &cache.items {
                        if item.market_hash_name.as_deref() == Some(market_hash_name) {
                            return Some(item.min_price.unwrap_or(0) as f64 / 100.0);
                        }
                    }
                    return None;
                }
            }
        }

        let session = self.get_next_session()?;
        let url = "https://csfloat.com/api/v1/listings/price-list";

        let resp_res = session.client
            .get(url)
            .header("Authorization", &session.api_key)
            .header("Content-Type", "application/json")
            .send()
            .await;

        let resp = match resp_res {
            Ok(r) => r,
            Err(e) => {
                let err_text = e.to_string();
                self.update_status(session.original_index, 0, Some(&err_text));
                if let Ok(mut guard) = session.cooldown_until.lock() {
                    *guard = Some(Instant::now() + Duration::from_secs(5));
                }
                return None;
            }
        };

        if resp.status().as_u16() == 200 {
            self.update_status(session.original_index, 200, None);
            let price_list: Vec<PriceListItem> = resp.json().await.ok()?;
            
            let min_price = price_list.iter()
                .find(|item| item.market_hash_name.as_deref() == Some(market_hash_name))
                .and_then(|item| item.min_price)
                .map(|p| p as f64 / 100.0);

            if let Ok(mut lock) = GLOBAL_PRICE_LIST_CACHE.lock() {
                *lock = Some(GlobalPriceListCache {
                    items: price_list,
                    fetched_at: Instant::now(),
                });
            }

            return min_price;
        } else {
            let status = resp.status().as_u16();
            tracing::warn!(
                "[Account #{}] Failed to fetch price list: {}",
                session.index,
                status
            );
            if status == 429 {
                let wait_secs = 3600; // 1 hour cooldown for market data 429 errors
                if let Ok(mut guard) = session.cooldown_until.lock() {
                    *guard = Some(Instant::now() + Duration::from_secs(wait_secs));
                }
                self.update_status(session.original_index, 429, Some(&format!("Rate limited, cooldown {}s", wait_secs)));
                crate::api_server::push_web_notification(
                    "warning",
                    "market_data",
                    "🚫 RATE LIMIT (Market Data) 🚫",
                    &format!("🔌 Account: #{} | ⏳ Cooldown: {}s | 📝 Details: CSFloat API 429 Too Many Requests (Price List)", session.index, wait_secs),
                    Some(serde_json::json!({
                        "account_index": session.original_index,
                        "account_type": "market_data",
                        "status_code": 429,
                        "cooldown_secs": wait_secs
                    })),
                );
                if let Some(n) = &self.notifier {
                    let n_clone = n.clone();
                    let session_idx = session.index;
                    tokio::spawn(async move {
                        n_clone.send_message(&format!(
                            "🚫 *RATE LIMIT (Market Data)* 🚫\n\n🔌 *Account:* #{}\n⏳ *Cooldown:* {}s\n📝 *Details:* CSFloat API 429 Too Many Requests (Price List)",
                            session_idx, wait_secs
                        )).await;
                    });
                }
            } else {
                self.update_status(session.original_index, status, Some(&format!("HTTP {}", status)));
                if let Some(n) = &self.notifier {
                    let _ = n.send_message(&format!("⚠️ *Market Data Error*\nFailed to fetch price list.\nAccount: #{}\nStatus Code: `{}`", session.index, status)).await;
                }
            }
        }

        None
    }

    pub async fn get_price_list(&self) -> Option<Vec<PriceListItem>> {
        if let Ok(lock) = GLOBAL_PRICE_LIST_CACHE.lock() {
            if let Some(cache) = &*lock {
                if cache.fetched_at.elapsed() < self.cache_ttl {
                    return Some(cache.items.clone());
                }
            }
        }

        let session = self.get_next_session()?;
        let url = "https://csfloat.com/api/v1/listings/price-list";

        let resp_res = session.client
            .get(url)
            .header("Authorization", &session.api_key)
            .header("Content-Type", "application/json")
            .send()
            .await;

        let resp = match resp_res {
            Ok(r) => r,
            Err(e) => {
                let err_text = e.to_string();
                self.update_status(session.original_index, 0, Some(&err_text));
                if let Ok(mut guard) = session.cooldown_until.lock() {
                    *guard = Some(Instant::now() + Duration::from_secs(5));
                }
                return None;
            }
        };

        if resp.status().as_u16() == 200 {
            self.update_status(session.original_index, 200, None);
            let price_list: Vec<PriceListItem> = resp.json().await.ok()?;

            if let Ok(mut lock) = GLOBAL_PRICE_LIST_CACHE.lock() {
                *lock = Some(GlobalPriceListCache {
                    items: price_list.clone(),
                    fetched_at: Instant::now(),
                });
            }

            return Some(price_list);
        } else {
            let status = resp.status().as_u16();
            tracing::warn!(
                "[Account #{}] Failed to fetch price list: {}",
                session.index,
                status
            );
            if status == 429 {
                let wait_secs = 3600; // 1 hour cooldown for market data 429 errors
                if let Ok(mut guard) = session.cooldown_until.lock() {
                    *guard = Some(Instant::now() + Duration::from_secs(wait_secs));
                }
                self.update_status(session.original_index, 429, Some(&format!("Rate limited, cooldown {}s", wait_secs)));
                crate::api_server::push_web_notification(
                    "warning",
                    "market_data",
                    "🚫 RATE LIMIT (Market Data) 🚫",
                    &format!("🔌 Account: #{} | ⏳ Cooldown: {}s | 📝 Details: CSFloat API 429 Too Many Requests (Price List)", session.index, wait_secs),
                    Some(serde_json::json!({
                        "account_index": session.original_index,
                        "account_type": "market_data",
                        "status_code": 429,
                        "cooldown_secs": wait_secs
                    })),
                );
                if let Some(n) = &self.notifier {
                    let n_clone = n.clone();
                    let session_idx = session.index;
                    tokio::spawn(async move {
                        n_clone.send_message(&format!(
                            "🚫 *RATE LIMIT (Market Data)* 🚫\n\n🔌 *Account:* #{}\n⏳ *Cooldown:* {}s\n📝 *Details:* CSFloat API 429 Too Many Requests (Price List)",
                            session_idx, wait_secs
                        )).await;
                    });
                }
            } else {
                self.update_status(session.original_index, status, Some(&format!("HTTP {}", status)));
                if let Some(n) = &self.notifier {
                    let _ = n.send_message(&format!("⚠️ *Market Data Error*\nFailed to fetch price list.\nAccount: #{}\nStatus Code: `{}`", session.index, status)).await;
                }
            }
        }

        None
    }

    pub async fn get_listing_price(&self, listing_id: &str) -> Option<f64> {
        let session = self.get_next_session()?;
        let url = format!("https://csfloat.com/api/v1/listings/{}", listing_id);

        let resp_res = session.client
            .get(&url)
            .header("Authorization", &session.api_key)
            .header("Content-Type", "application/json")
            .send()
            .await;

        let resp = match resp_res {
            Ok(r) => r,
            Err(e) => {
                let err_text = e.to_string();
                self.update_status(session.original_index, 0, Some(&err_text));
                if let Ok(mut guard) = session.cooldown_until.lock() {
                    *guard = Some(Instant::now() + Duration::from_secs(5));
                }
                return None;
            }
        };

        if resp.status().as_u16() != 200 {
            let status = resp.status().as_u16();
            tracing::warn!(
                "[Account #{}] Failed to fetch listing {}: {}",
                session.index,
                listing_id,
                status
            );
            if status == 429 {
                let wait_secs = 3600; // 1 hour cooldown for market data 429 errors
                if let Ok(mut guard) = session.cooldown_until.lock() {
                    *guard = Some(Instant::now() + Duration::from_secs(wait_secs));
                }
                self.update_status(session.original_index, 429, Some(&format!("Rate limited, cooldown {}s", wait_secs)));
                crate::api_server::push_web_notification(
                    "warning",
                    "market_data",
                    "🚫 RATE LIMIT (Market Data) 🚫",
                    &format!("🔌 Account: #{} | ⏳ Cooldown: {}s | 📝 Details: CSFloat API 429 Too Many Requests (Listing Price)", session.index, wait_secs),
                    Some(serde_json::json!({
                        "account_index": session.original_index,
                        "account_type": "market_data",
                        "status_code": 429,
                        "cooldown_secs": wait_secs
                    })),
                );
                if let Some(n) = &self.notifier {
                    let n_clone = n.clone();
                    let session_idx = session.index;
                    tokio::spawn(async move {
                        n_clone.send_message(&format!(
                            "🚫 *RATE LIMIT (Market Data)* 🚫\n\n🔌 *Account:* #{}\n⏳ *Cooldown:* {}s\n📝 *Details:* CSFloat API 429 Too Many Requests (Listing Price)",
                            session_idx, wait_secs
                        )).await;
                    });
                }
            } else {
                self.update_status(session.original_index, status, Some(&format!("HTTP {}", status)));
                if let Some(n) = &self.notifier {
                    let _ = n.send_message(&format!("⚠️ *Market Data Error*\nFailed to fetch listing `{}`.\nAccount: #{}\nStatus Code: `{}`", listing_id, session.index, status)).await;
                }
            }
            return None;
        }

        let body: serde_json::Value = resp.json().await.ok()?;
        let raw_price = body
            .get("price")
            .or_else(|| body.get("data").and_then(|v| v.get("price")))
            .or_else(|| body.get("listing").and_then(|v| v.get("price")));

        // CSFloat API returns prices in cents (integer), always divide by 100
        if let Some(v) = raw_price {
            if let Some(n) = v.as_i64() {
                self.update_status(session.original_index, 200, None);
                return Some(n as f64 / 100.0);
            }
            if let Some(n) = v.as_f64() {
                self.update_status(session.original_index, 200, None);
                // If already a float < 1000, assume it's already in dollars (legacy)
                return Some(if n >= 1000.0 { n / 100.0 } else { n });
            }
            if let Some(s) = v.as_str() {
                if let Ok(n) = s.parse::<f64>() {
                    self.update_status(session.original_index, 200, None);
                    return Some(if n >= 1000.0 { n / 100.0 } else { n });
                }
            }
        }

        None
    }

    pub async fn fetch_market_data_async(
        &self,
        listing_id: &str,
        market_hash_name: &str,
    ) -> MarketDataResult {
        // Each call fetches session round-robin state.
        let buy_order_data = self.get_highest_buy_order(listing_id).await;
        let lowest_price = self.get_lowest_market_price(market_hash_name).await;

        MarketDataResult {
            highest_buy_order: buy_order_data,
            lowest_market_price: lowest_price,
        }
    }
}
