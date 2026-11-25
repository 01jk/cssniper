use crate::api_models::ListingResponse;
use crate::config::{Account, ScannerSettings};
use rand::Rng;
use reqwest::{header, Client, Proxy, StatusCode};
use sqlx::SqlitePool;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone)]
pub struct ProxySession {
    pub client: Client,
    pub proxy_url: Option<String>,
    pub api_key: Option<String>,
    pub disabled: bool,
    pub error_count: i32,
    pub backup_ips: Vec<String>,
    pub requests_made: i32,
    pub created_at: Instant,
    pub cooldown_until: Option<Instant>,
    pub original_index: usize,
}

pub struct Scanner {
    pub settings: ScannerSettings,
    pub sessions: Vec<ProxySession>,
    pub current_session_idx: usize,
    pub sniper_client: Option<Client>,
    pub sniper_api_key: Option<String>,
    pub sniper_cooldown_until: Option<Instant>,
    pub current_min_price: i64,
    pub last_min_price_update: Instant,
    pub min_price_update_interval: Duration,
    pub last_scan_duration: f64,
    pub stats_file: PathBuf,
    pub settings_file_path: PathBuf,
    pub db_pool: Option<SqlitePool>,
    pub max_requests_per_session: i32,
    pub max_session_age: Duration,
    pub notifier: Option<crate::notifier::TelegramNotifier>,
    /// Shared account status map — written by scanner, read by API endpoint
    pub account_statuses: Option<Arc<Mutex<serde_json::Value>>>,
}

impl Scanner {
    pub fn new(
        settings: ScannerSettings,
        auto_buy_accounts: Vec<Account>,
        db_pool: Option<SqlitePool>,
        notifier: Option<crate::notifier::TelegramNotifier>,
        account_statuses: Option<Arc<Mutex<serde_json::Value>>>,
    ) -> Result<Self, reqwest::Error> {
        let mut scanner_accounts: Vec<(usize, Account)> = settings
            .accounts
            .iter()
            .enumerate()
            .filter(|(_, acc)| acc.enabled)
            .map(|(idx, acc)| (idx, acc.clone()))
            .collect();

        let mut auto_buy_accounts = auto_buy_accounts
            .into_iter()
            .filter(|acc| acc.enabled)
            .collect::<Vec<_>>();

        // Migration fallback: old single-account scanner config.
        if scanner_accounts.is_empty() {
            if let Some(api_key) = settings.api_key.clone() {
                scanner_accounts = settings
                    .monitoring_proxies
                    .iter()
                    .enumerate()
                    .map(|(idx, proxy)| (idx, Account {
                        api_key: Some(api_key.clone()),
                        proxy: Some(proxy.clone()),
                        backup_ips: Vec::new(),
                        enabled: true,
                    }))
                    .collect();
            }
        }

        // Migration fallback: old sniper proxy placement under scanner.
        if auto_buy_accounts.is_empty() {
            if let Some(sniper_proxy) = settings.sniper_proxy.clone() {
                auto_buy_accounts.push(Account {
                    api_key: settings.api_key.clone(),
                    proxy: Some(sniper_proxy),
                    backup_ips: Vec::new(),
                    enabled: true,
                });
            }
        }

        let request_timeout = Duration::from_secs(settings.request_timeout.unwrap_or(5).max(1) as u64);        let mut sessions = Vec::new();
        for (original_idx, account) in &scanner_accounts {
            let proxy = if settings.use_proxies { account.proxy.clone() } else { None };
            let api_key = account.api_key.clone();
            let client = Self::build_client(proxy.as_deref(), request_timeout)?;
            sessions.push(ProxySession {
                client,
                proxy_url: proxy,
                api_key,
                disabled: false,
                error_count: 0,
                backup_ips: if settings.use_proxies { account.backup_ips.clone() } else { Vec::new() },
                requests_made: 0,
                created_at: Instant::now(),
                cooldown_until: None,
                original_index: *original_idx,
            });
        }
 
        if sessions.is_empty() {
            tracing::warn!("No scanner accounts configured, using direct session fallback");
            let client = Self::build_client(None, request_timeout)?;
            sessions.push(ProxySession {
                client,
                proxy_url: None,
                api_key: settings.api_key.clone(),
                disabled: false,
                error_count: 0,
                backup_ips: Vec::new(),
                requests_made: 0,
                created_at: Instant::now(),
                cooldown_until: None,
                original_index: 0,
            });
        }

        let (sniper_client, sniper_api_key) = if let Some(acc) = auto_buy_accounts.first() {
            (
                Some(Self::build_client(acc.proxy.as_deref(), request_timeout)?),
                acc.api_key.clone(),
            )
        } else {
            (Some(Self::build_client(None, request_timeout)?), settings.api_key.clone())
        };

        let max_requests_per_session = settings.max_requests_per_session.unwrap_or(50).max(1);
        let max_session_age_minutes = settings.max_session_age_minutes.unwrap_or(10).max(1);

        Ok(Self {
            settings,
            sessions,
            current_session_idx: 0,
            sniper_client,
            sniper_api_key,
            sniper_cooldown_until: None,
            current_min_price: 100,
            last_min_price_update: Instant::now() - Duration::from_secs(120),
            min_price_update_interval: Duration::from_secs(60),
            last_scan_duration: 0.0,
            stats_file: PathBuf::from("../bot_stats.json"),
            settings_file_path: crate::config::get_settings_path(None),
            db_pool,
            max_requests_per_session,
            max_session_age: Duration::from_secs((max_session_age_minutes * 60) as u64),
            notifier,
            account_statuses,
        })
    }

    fn update_status(&self, idx: usize, status_code: u16, error: Option<&str>) {
        let Some(statuses) = &self.account_statuses else { return; };
        let original_index = self.sessions.get(idx).map(|s| s.original_index).unwrap_or(idx);
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
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
        }

        let entry = serde_json::json!({
            "status_code": status_code,
            "error": error.unwrap_or(""),
            "last_updated": now,
            "cooldown_until": cooldown_until,
        });
        if let Ok(mut guard) = statuses.lock() {
            if guard.get("scanner").is_none() || !guard["scanner"].is_object() {
                guard["scanner"] = serde_json::json!({});
            }
            guard["scanner"][original_index.to_string()] = entry;
        }
    }

    fn build_client(proxy_url: Option<&str>, timeout: Duration) -> Result<Client, reqwest::Error> {
        let mut headers = header::HeaderMap::new();
        headers.insert(header::ACCEPT, header::HeaderValue::from_static("application/json"));
        headers.insert(
            header::ACCEPT_ENCODING,
            header::HeaderValue::from_static("gzip, deflate, br"),
        );
        headers.insert(header::CONNECTION, header::HeaderValue::from_static("keep-alive"));
        headers.insert(header::REFERER, header::HeaderValue::from_static("https://csfloat.com/"));
        headers.insert(header::ORIGIN, header::HeaderValue::from_static("https://csfloat.com"));
        headers.insert(header::CACHE_CONTROL, header::HeaderValue::from_static("no-cache, no-store, must-revalidate"));
        headers.insert(header::PRAGMA, header::HeaderValue::from_static("no-cache"));

        let mut builder = Client::builder()
            .timeout(timeout)
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .default_headers(headers);
        if let Some(proxy_url) = proxy_url {
            if !proxy_url.trim().is_empty() {
                let normalized = crate::config::normalize_proxy(proxy_url);
                builder = builder.proxy(Proxy::all(&normalized)?);
            }
        }
        builder.build()
    }

    fn session_available(&self, idx: usize) -> bool {
        let session = &self.sessions[idx];
        if session.disabled {
            return false;
        }
        if let Some(cooldown_until) = session.cooldown_until {
            return Instant::now() >= cooldown_until;
        }
        true
    }

    fn next_available_session_index(&mut self) -> Option<usize> {
        if self.sessions.is_empty() {
            return None;
        }
        let total = self.sessions.len();
        for offset in 0..total {
            let idx = (self.current_session_idx + offset) % total;
            if self.session_available(idx) {
                self.current_session_idx = (idx + 1) % total;
                return Some(idx);
            }
        }
        None
    }

    fn should_recycle_session(&self, idx: usize) -> bool {
        let session = &self.sessions[idx];
        session.requests_made >= self.max_requests_per_session
            || session.created_at.elapsed() >= self.max_session_age
    }

    fn recycle_session(&mut self, idx: usize) {
        let proxy = if self.settings.use_proxies { self.sessions[idx].proxy_url.clone() } else { None };
        let timeout = Duration::from_secs(self.settings.request_timeout.unwrap_or(5).max(1) as u64);
        match Self::build_client(proxy.as_deref(), timeout) {
            Ok(client) => {
                self.sessions[idx].client = client;
                self.sessions[idx].requests_made = 0;
                self.sessions[idx].created_at = Instant::now();
                tracing::info!("Session recycled for scanner account {}", idx + 1);
            }
            Err(e) => {
                self.sessions[idx].cooldown_until = Some(Instant::now() + Duration::from_secs(30));
                tracing::error!("Failed to recycle scanner session {}: {}", idx + 1, e);
            }
        }
    }

    async fn update_dynamic_min_price(&mut self) {
        if self.last_min_price_update.elapsed() < self.min_price_update_interval {
            return;
        }

        let Some(pool) = &self.db_pool else {
            self.last_min_price_update = Instant::now();
            return;
        };

        let row = sqlx::query_scalar::<_, Option<f64>>(
            "
            SELECT MIN(ts.min_price)
            FROM target_skins ts
            JOIN target_configs tc ON tc.name = ts.config_name
            WHERE ts.is_active = 1
              AND tc.is_active = 1
              AND ts.min_price > 0
            ",
        )
        .fetch_one(pool)
        .await;

        match row {
            Ok(Some(min_price)) => {
                self.current_min_price = (min_price * 100.0) as i64;
                tracing::info!(
                    "[DYNAMIC MIN PRICE] Updated to ${:.2} ({} cents)",
                    min_price,
                    self.current_min_price
                );
            }
            Ok(None) => {
                self.current_min_price = 100;
            }
            Err(e) => {
                tracing::error!("[DYNAMIC MIN PRICE] Failed to update min price: {}", e);
                self.current_min_price = 100;
            }
        }

        self.last_min_price_update = Instant::now();
    }

    fn get_cache_busting_url(base_url: &str) -> String {
        let ts_millis = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0);
        let rnd = rand::thread_rng().gen_range(1..=999_999);
        let sep = if base_url.contains('?') { '&' } else { '?' };
        format!("{}{}_={}&v={}", base_url, sep, ts_millis, rnd)
    }

    fn persist_scan_stats(&self) {
        let payload = serde_json::json!({
            "last_scan_duration": self.last_scan_duration,
        });
        if let Ok(text) = serde_json::to_string(&payload) {
            let _ = std::fs::write(&self.stats_file, text);
        }
    }

    fn update_settings_proxy(&self, idx: usize, new_proxy: &str, rotated_backup: &[String]) -> Result<(), String> {
        let raw = std::fs::read_to_string(&self.settings_file_path).map_err(|e| e.to_string())?;
        let mut root: serde_yaml::Value = serde_yaml::from_str(&raw).map_err(|e| e.to_string())?;

        let accounts = root
            .get_mut("scanner")
            .and_then(|v| v.get_mut("accounts"))
            .and_then(|v| v.as_sequence_mut())
            .ok_or_else(|| "scanner.accounts not found in settings.yaml".to_string())?;

        let account = accounts
            .get_mut(idx)
            .ok_or_else(|| format!("scanner.accounts[{}] not found", idx))?;

        account["proxy"] = serde_yaml::Value::String(new_proxy.to_string());
        account["backup_ips"] = serde_yaml::to_value(rotated_backup).map_err(|e| e.to_string())?;

        let updated = serde_yaml::to_string(&root).map_err(|e| e.to_string())?;
        std::fs::write(&self.settings_file_path, updated).map_err(|e| e.to_string())?;

        Ok(())
    }

    fn handle_timeout_error(&mut self, idx: usize) {
        let timeout = Duration::from_secs(self.settings.request_timeout.unwrap_or(5).max(1) as u64);

        self.sessions[idx].error_count += 1;
        if self.sessions[idx].backup_ips.is_empty() {
            self.sessions[idx].disabled = true;
            self.sessions[idx].cooldown_until = Some(Instant::now() + Duration::from_secs(300));
            tracing::error!(
                "Proxy #{} disabled: no backup IPs configured",
                idx + 1
            );
            if let Some(notifier) = &self.notifier {
                let n = notifier.clone();
                let proxy_idx = idx + 1;
                tokio::spawn(async move {
                    n.send_message(&format!("⚠️ *PROXY ERROR ALERT* ⚠️\n\n🔌 *Proxy:* #{}\n❌ *Error Type:* No Backup IPs\n📝 *Details:* Proxy disabled - no backup IPs available", proxy_idx)).await;
                });
            }
            return;
        }

        let old_proxy = self.sessions[idx].proxy_url.clone().unwrap_or_default();
        let backup_ip = self.sessions[idx].backup_ips.remove(0);
        self.sessions[idx].backup_ips.push(backup_ip.clone());

        match Self::build_client(Some(&backup_ip), timeout) {
            Ok(client) => {
                self.sessions[idx].client = client;
                self.sessions[idx].proxy_url = Some(backup_ip.clone());
                self.sessions[idx].error_count = 0;
                self.sessions[idx].cooldown_until = None;
                self.sessions[idx].disabled = false;

                if let Err(e) = self.update_settings_proxy(idx, &backup_ip, &self.sessions[idx].backup_ips) {
                    tracing::error!("Failed to persist proxy rotation: {}", e);
                }

                tracing::info!(
                    "[PROXY ROTATION] Proxy #{} rotated successfully from {} to {}",
                    idx + 1,
                    old_proxy,
                    self.sessions[idx].proxy_url.clone().unwrap_or_default()
                );
                
                if let Some(notifier) = &self.notifier {
                    let n = notifier.clone();
                    let proxy_idx = idx + 1;
                    let remaining = self.sessions[idx].backup_ips.len();
                    tokio::spawn(async move {
                        n.send_message(&format!("🔄 *PROXY ROTATED* 🔄\n\n🔌 *Proxy:* #{}\n✅ *Status:* Session recreated successfully\n📊 *Backup IPs remaining:* {}", proxy_idx, remaining)).await;
                    });
                }
            }
            Err(e) => {
                self.sessions[idx].disabled = true;
                self.sessions[idx].cooldown_until = Some(Instant::now() + Duration::from_secs(300));
                tracing::error!("Failed to rotate proxy #{}: {}", idx + 1, e);
            }
        }
    }

    pub async fn fetch_recent_listings(
        &mut self,
    ) -> Result<ListingResponse, Box<dyn std::error::Error + Send + Sync>> {
        self.update_dynamic_min_price().await;

        let idx = self
            .next_available_session_index()
            .ok_or_else(|| "No scanner accounts available (all cooldown/disabled)".to_string())?;

        if self.should_recycle_session(idx) {
            self.recycle_session(idx);
        }

        self.sessions[idx].requests_made += 1;

        let session = self.sessions[idx].clone();
        let base_url = format!(
            "https://csfloat.com/api/v1/listings?limit=50&sort_by=most_recent&type_name=Skin"
        );
        let url = Self::get_cache_busting_url(&base_url);

        let mut request = session.client.get(url);
        if let Some(api_key) = &session.api_key {
            if !api_key.is_empty() {
                request = request.header("Authorization", api_key);
            }
        }

        let start = Instant::now();
        let response = request.send().await;
        self.last_scan_duration = start.elapsed().as_secs_f64();
        self.persist_scan_stats();

        match response {
            Ok(resp) if resp.status() == StatusCode::OK => {
                self.update_status(idx, 200, None);
                let data: ListingResponse = resp.json().await?;
                let fetched_len = data.data.as_ref().map(|d| d.len()).unwrap_or(0);
                tracing::debug!("Scanner fetched {} items from CSFloat API (min_price: {} cents)", fetched_len, self.current_min_price);
                Ok(data)
            }
            Ok(resp) if resp.status() == StatusCode::TOO_MANY_REQUESTS => {
                let wait_secs = resp
                    .headers()
                    .get("Retry-After")
                    .and_then(|v| v.to_str().ok())
                    .and_then(|s| s.parse::<u64>().ok())
                    .unwrap_or(60);
                tracing::warn!("🚫 Account #{} Rate limited. Cooling {}s", idx + 1, wait_secs);
                self.update_status(idx, 429, Some(&format!("Rate limited, cooldown {}s", wait_secs)));
                self.sessions[idx].cooldown_until = Some(Instant::now() + Duration::from_secs(wait_secs));
                let proxy_idx = idx + 1;
                crate::api_server::push_web_notification(
                    "warning",
                    "scanner",
                    "🚫 RATE LIMIT 🚫",
                    &format!("🔌 Account: #{} | ⏳ Cooldown: {}s | 📝 Details: CSFloat API 429 Too Many Requests", proxy_idx, wait_secs),
                    Some(serde_json::json!({
                        "account_index": idx,
                        "account_type": "scanner",
                        "status_code": 429,
                        "cooldown_secs": wait_secs
                    })),
                );
                if let Some(notifier) = &self.notifier {
                    let n = notifier.clone();
                    tokio::spawn(async move {
                        n.send_message(&format!(
                            "🚫 *RATE LIMIT* 🚫\n\n🔌 *Account:* #{}\n⏳ *Cooldown:* {}s\n📝 *Details:* CSFloat API 429 Too Many Requests",
                            proxy_idx, wait_secs
                        )).await;
                    });
                }
                Err("Rate limit".into())
            }
            Ok(resp) => {
                let code = resp.status().as_u16();
                let err_msg = format!("HTTP {}", code);
                self.update_status(idx, code, Some(&err_msg));
                self.sessions[idx].cooldown_until = Some(Instant::now() + Duration::from_secs(5));
                Err(err_msg.into())
            }
            Err(e) => {
                let err_text = e.to_string();
                let err_lower = err_text.to_lowercase();
                if err_lower.contains("timed out")
                    || err_lower.contains("connection reset")
                    || err_lower.contains("connection closed")
                {
                    self.update_status(idx, 0, Some(&err_text));
                    if self.settings.use_proxies {
                        self.handle_timeout_error(idx);
                    } else {
                        let delay_secs = self.settings.curl_28_delay.unwrap_or(5.0);
                        self.sessions[idx].cooldown_until = Some(Instant::now() + Duration::from_secs_f64(delay_secs));
                    }
                } else if err_lower.contains("tunnelunsuccessful") {
                    self.update_status(idx, 0, Some("Proxy tunnel rejected"));
                    self.sessions[idx].disabled = true;
                    tracing::error!("Proxy #{} rejected the tunnel connection (e.g. 402 Payment Required or 403). Please check your proxy provider's balance.", idx + 1);
                    self.sessions[idx].cooldown_until = Some(Instant::now() + Duration::from_secs(300));
                    
                    if let Some(notifier) = &self.notifier {
                        let n = notifier.clone();
                        let proxy_idx = idx + 1;
                        tokio::spawn(async move {
                            n.send_message(&format!("⚠️ *PROXY ERROR ALERT* ⚠️\n\n🔌 *Proxy:* #{}\n❌ *Error Type:* Tunnel Unsuccessful\n📝 *Details:* Proxy rejected the tunnel connection. Check your proxy provider's balance.", proxy_idx)).await;
                        });
                    }
                } else {
                    self.update_status(idx, 0, Some(&err_text));
                    self.sessions[idx].cooldown_until = Some(Instant::now() + Duration::from_secs(5));
                }
                Err(Box::new(e))
            }
        }
    }

    pub async fn keep_warm_once(&mut self) {
        if let Some(cooldown_until) = self.sniper_cooldown_until {
            if Instant::now() < cooldown_until {
                return;
            }
        }

        let Some(client) = &self.sniper_client else {
            return;
        };

        let mut req = client.get("https://csfloat.com/api/v1/listings?limit=1");
        if let Some(api_key) = &self.sniper_api_key {
            if !api_key.is_empty() {
                req = req.header("Authorization", api_key);
            }
        }

        match req.send().await {
            Ok(resp) if resp.status() == StatusCode::TOO_MANY_REQUESTS => {
                let wait_secs = resp
                    .headers()
                    .get("Retry-After")
                    .and_then(|v| v.to_str().ok())
                    .and_then(|s| s.parse::<u64>().ok())
                    .unwrap_or(120);
                self.sniper_cooldown_until = Some(Instant::now() + Duration::from_secs(wait_secs));
            }
            Ok(_) => {}
            Err(e) => {
                tracing::warn!("Sniper keep-warm failed: {}", e);
            }
        }
    }

    pub async fn buy_item(&self, listing_id: &str, total_price: i32) -> Result<serde_json::Value, String> {
        let Some(client) = &self.sniper_client else {
            return Err("Sniper client not initialized".to_string());
        };

        let url = "https://csfloat.com/api/v1/listings/buy";
        let body = serde_json::json!({
            "total_price": total_price,
            "contract_ids": vec![listing_id.to_string()]
        });

        let mut req = client.post(url).json(&body);
        if let Some(api_key) = &self.sniper_api_key {
            if !api_key.is_empty() {
                req = req.header("Authorization", api_key);
            }
        }

        match req.send().await {
            Ok(resp) => {
                let status = resp.status();
                let text = resp.text().await.unwrap_or_default();
                if status.is_success() {
                    let json = serde_json::from_str::<serde_json::Value>(&text)
                        .unwrap_or_else(|_| serde_json::json!({ "status": "success" }));
                    Ok(json)
                } else {
                    let err_msg = if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                        json.get("error")
                            .and_then(|v| v.as_str())
                            .or_else(|| json.get("message").and_then(|v| v.as_str()))
                            .map(|s| s.to_string())
                            .unwrap_or_else(|| format!("HTTP {} - {}", status, text))
                    } else {
                        format!("HTTP {} - {}", status, text)
                    };
                    Err(err_msg)
                }
            }
            Err(e) => Err(format!("Network error: {}", e)),
        }
    }
}
