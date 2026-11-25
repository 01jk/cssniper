use axum::{
    routing::{get, post, put, delete, patch},
    Router,
    response::{IntoResponse, sse::{Event, Sse}},
    Json,
    extract::{State, Path as AxumPath, Query},
    http::StatusCode,
    middleware::{self, Next},
    response::Response,
    http::Request,
};
use tower_http::cors::{CorsLayer, Any};
use tower_http::services::{ServeDir, ServeFile};
use chrono::{DateTime, Utc};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, Ordering};
use std::convert::Infallible;
use sqlx::SqlitePool;
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;
use tokio_stream::wrappers::BroadcastStream;
use futures::stream::{Stream, StreamExt};
use rand::Rng;

use crate::models::{TargetConfig, TargetSkin};

#[derive(Clone, Serialize, Deserialize)]
struct TokenInfo {
    username: String,
    expires_at: DateTime<Utc>,
}

fn load_sessions_from_file() -> HashMap<String, TokenInfo> {
    let path = crate::config::get_sessions_path();
    let content = match std::fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return HashMap::new(),
    };
    let map: HashMap<String, TokenInfo> = match serde_json::from_str(&content) {
        Ok(m) => m,
        Err(_) => return HashMap::new(),
    };
    // Filter out expired sessions on load (Disabled temporarily)
    // let now = Utc::now();
    // map.into_iter().filter(|(_, info)| info.expires_at > now).collect()
    map
}

fn save_sessions_to_file(sessions: &HashMap<String, TokenInfo>) {
    let path = crate::config::get_sessions_path();
    if let Ok(json) = serde_json::to_string(sessions) {
        let _ = std::fs::write(path, json);
    }
}

struct AppState {
    db: SqlitePool,
    scanner_running: Arc<AtomicBool>,
    scanner_abort: Mutex<Option<tokio::task::AbortHandle>>,
    scanner_started_at: Mutex<Option<DateTime<Utc>>>,
    live_stats: Arc<Mutex<LiveStats>>,
    /// Live account statuses — written by scanner, served via /api/accounts/status
    account_statuses: Arc<Mutex<serde_json::Value>>,
    active_sessions: Mutex<HashMap<String, TokenInfo>>,
    manual_sniper_clients: Mutex<HashMap<String, (reqwest::Client, String)>>,
}

#[derive(Serialize, Clone)]
pub struct LiveStats {
    pub connection_csfloat: bool,
    pub connection_steam: bool,
    pub latency: i32,
    pub scanned_total: usize,
    pub scanned_per_min: i32,
    pub matches_found: usize,
    pub buy_attempts: usize,
    pub successful_buys: usize,
    pub failed_buys: usize,
    pub avg_speed: i32,
    pub last_matched_processing_ms: Option<i32>,
}

fn load_last_processing_from_log() -> Option<i32> {
    let log_path = std::path::PathBuf::from("../logs/cssniper.log");
    if let Ok(content) = std::fs::read_to_string(&log_path) {
        for line in content.lines().rev() {
            if line.contains("MATCH:") && line.contains("processing=") {
                if let Some(pos) = line.find("processing=") {
                    let rest = &line[pos + "processing=".len()..];
                    let ms_str: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
                    if let Ok(ms) = ms_str.parse::<i32>() {
                        return Some(ms);
                    }
                }
            }
        }
    }
    None
}

impl Default for LiveStats {
    fn default() -> Self {
        let last_proc = load_last_processing_from_log();
        Self {
            connection_csfloat: true,
            connection_steam: true,
            latency: 50,
            scanned_total: 0,
            scanned_per_min: 0,
            matches_found: 0,
            buy_attempts: 0,
            successful_buys: 0,
            failed_buys: 0,
            avg_speed: 0,
            last_matched_processing_ms: last_proc,
        }
    }
}

static LOG_BUFFER: std::sync::OnceLock<Mutex<Vec<String>>> = std::sync::OnceLock::new();

// ─── Web Notification Store ───────────────────────────────────────────────────

#[derive(Serialize, Clone, Debug)]
pub struct WebNotification {
    pub id: String,
    #[serde(rename = "type")]
    pub notification_type: String,
    pub source: String,
    pub title: String,
    pub message: String,
    pub timestamp: String,
    pub read: bool,
    pub data: Option<serde_json::Value>,
}

static NOTIFICATION_STORE: std::sync::OnceLock<Mutex<Vec<WebNotification>>> =
    std::sync::OnceLock::new();

fn notif_store() -> &'static Mutex<Vec<WebNotification>> {
    NOTIFICATION_STORE.get_or_init(|| Mutex::new(Vec::with_capacity(200)))
}

/// Push a new web notification into the in-memory store (max 200 kept).
pub fn push_web_notification(
    notification_type: &str,
    source: &str,
    title: &str,
    message: &str,
    data: Option<serde_json::Value>,
) {
    let id = format!(
        "notif-{}-{:x}",
        Utc::now().timestamp_millis(),
        rand_hex()
    );
    let notif = WebNotification {
        id,
        notification_type: notification_type.to_string(),
        source: source.to_string(),
        title: title.to_string(),
        message: message.to_string(),
        timestamp: Utc::now().to_rfc3339(),
        read: false,
        data,
    };
    let mut store = notif_store().lock().unwrap();
    store.insert(0, notif);
    if store.len() > 200 {
        store.truncate(200);
    }
}

/// Simple 8-char random hex suffix using the current time nanos.
fn rand_hex() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.subsec_nanos() as u64)
        .unwrap_or(0)
}

// ─── Live Feed Store (ALL scanned items, not just matches) ────────────────────

static LIVE_FEED_STORE: std::sync::OnceLock<Mutex<Vec<serde_json::Value>>> =
    std::sync::OnceLock::new();

static LIVE_FEED_TX: std::sync::OnceLock<broadcast::Sender<Vec<serde_json::Value>>> =
    std::sync::OnceLock::new();

fn live_feed_store() -> &'static Mutex<Vec<serde_json::Value>> {
    LIVE_FEED_STORE.get_or_init(|| Mutex::new(Vec::with_capacity(2000)))
}

fn live_feed_tx() -> broadcast::Sender<Vec<serde_json::Value>> {
    LIVE_FEED_TX.get_or_init(|| {
        let (tx, _) = broadcast::channel(100);
        tx
    }).clone()
}

/// Push a batch of raw listings into the live feed (max 500 kept, newest first).
/// Deduplicates by item_id within the buffer.
fn push_live_feed_items(items: Vec<serde_json::Value>) -> usize {
    let mut store = live_feed_store().lock().unwrap();
    // Collect existing IDs for dedup
    let existing_ids: std::collections::HashSet<String> = store
        .iter()
        .filter_map(|v| v.get("item_id").and_then(|id| id.as_str()).map(|s| s.to_string()))
        .collect();
        
    let mut new_items = Vec::new();
    for item in items {
        let item_id = item.get("item_id").and_then(|id| id.as_str()).unwrap_or("");
        if !item_id.is_empty() && existing_ids.contains(item_id) {
            continue; // skip duplicates
        }
        new_items.push(item.clone());
        store.insert(0, item);
    }
    
    if store.len() > 2000 {
        store.truncate(2000);
    }
    
    let added_count = new_items.len();
    if !new_items.is_empty() {
        let _ = live_feed_tx().send(new_items);
    }
    added_count
}

fn filter_label(key: &str) -> String {
    match key {
        "item_name" => "Item Name".to_string(),
        "price" => "Price".to_string(),
        "float" => "Float".to_string(),
        "playside_blue" => "Playside Blue %".to_string(),
        "backside_blue" => "Backside Blue %".to_string(),
        "fade" => "Fade %".to_string(),
        "float_rank" => "Float Rank".to_string(),
        "phase" => "Phase".to_string(),
        "paint_seed" => "Paint Seed".to_string(),
        "charm_pattern" => "Charm Pattern".to_string(),
        "charms" => "Charms".to_string(),
        "matched_sticker_indices" => "Stickers".to_string(),
        _ => key
            .split('_')
            .filter(|part| !part.is_empty())
            .map(|part| {
                let mut chars = part.chars();
                match chars.next() {
                    Some(first) => format!("{}{}", first.to_uppercase(), chars.as_str()),
                    None => String::new(),
                }
            })
            .collect::<Vec<String>>()
            .join(" "),
    }
}

fn extract_passed_filters(result: &crate::analyzer::AnalyzerResult) -> Vec<String> {
    let mut filters: Vec<String> = Vec::new();
    let preferred_order = [
        "item_name",
        "price",
        "float",
        "playside_blue",
        "backside_blue",
        "fade",
        "float_rank",
        "phase",
        "paint_seed",
        "charm_pattern",
        "charms",
        "matched_sticker_indices",
    ];

    for key in preferred_order {
        if result.matched_filters.contains_key(key) {
            let label = filter_label(key);
            if !filters.contains(&label) {
                filters.push(label);
            }
        }
    }

    let mut extra_keys: Vec<&String> = result
        .matched_filters
        .keys()
        .filter(|k| !preferred_order.contains(&k.as_str()))
        .collect();
    extra_keys.sort();

    for key in extra_keys {
        let label = filter_label(key);
        if !filters.contains(&label) {
            filters.push(label);
        }
    }

    if result.check_zero_price {
        let label = "Zero Price".to_string();
        if !filters.contains(&label) {
            filters.push(label);
        }
    }

    if result.check_discount_overpay {
        let label = "Discount/Overpay".to_string();
        if !filters.contains(&label) {
            filters.push(label);
        }
    }

    if result.check_stickers_price_percent {
        let label = "Stickers %".to_string();
        if !filters.contains(&label) {
            filters.push(label);
        }
    }

    if result.check_charm_profit {
        let label = "Charm Profit".to_string();
        if !filters.contains(&label) {
            filters.push(label);
        }
    }

    filters
}

pub fn add_log(msg: &str) {
    tracing::info!("{}", msg);
    
    // Also write to logs/cssniper.log
    use std::io::Write;
    let log_path = std::path::PathBuf::from("../logs/cssniper.log");
    if let Ok(mut file) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
    {
        let ts = Utc::now().format("%Y-%m-%d %H:%M:%S");
        let _ = writeln!(file, "[{}] {}", ts, msg);
    }

    let mut buf = LOG_BUFFER.get_or_init(|| Mutex::new(Vec::with_capacity(100))).lock().unwrap();
    let ts = Utc::now().format("%Y-%m-%d %H:%M:%S");
    buf.push(format!("[{}] {}", ts, msg));
    if buf.len() > 50 {
        buf.remove(0);
    }
}

#[derive(Serialize)]
pub struct ConfigResponse {
    pub name: String,
    pub target_count: usize,
    pub active_count: usize,
    pub is_active: bool,
    pub emoji: Option<String>,
    pub targets: Vec<TargetSkin>,
}

#[derive(Deserialize)]
pub struct OptionsQuery {
    pub include_targets: Option<bool>,
}

fn generate_token() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let bytes: [u8; 32] = rng.gen();
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

fn verify_session(state: &AppState, token: &str) -> bool {
    let mut _sessions = state.active_sessions.lock().unwrap();
    if let Some(_info) = _sessions.get(token) {
        // if _info.expires_at > Utc::now() {
            return true;
        // }
    }
    // let before_len = _sessions.len();
    // _sessions.retain(|_, info| info.expires_at > Utc::now());
    // // Save only if we removed expired sessions
    // if _sessions.len() != before_len {
    //     save_sessions_to_file(&_sessions);
    // }
    false
}

async fn auth_middleware(
    State(state): State<Arc<AppState>>,
    req: Request<axum::body::Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    let path = req.uri().path().to_string();
    let method = req.method().to_string();

    let auth_header = req.headers()
        .get("Authorization")
        .and_then(|h| h.to_str().ok());

    let query_token = req.uri().query().unwrap_or("").split('&').find_map(|s| {
        let mut parts = s.split('=');
        if parts.next() == Some("token") { parts.next() } else { None }
    });

    if let Some(auth_val) = auth_header {
        if auth_val.starts_with("Bearer ") {
            let token = &auth_val["Bearer ".len()..];
            if verify_session(&state, token) {
                return Ok(next.run(req).await);
            }
            tracing::warn!("Auth failed: Token not found or expired for path {} {}", method, path);
        }
    } else if let Some(token) = query_token {
        if verify_session(&state, token) {
            return Ok(next.run(req).await);
        }
        tracing::warn!("Auth failed: Query token not found or expired for path {} {}", method, path);
    } else {
        tracing::warn!("Auth failed: Missing Authorization header for path {} {}", method, path);
    }

    if (path == "/api/notifications" || path == "/api/live-feed") && method == "POST" {
        if let Some(connect_info) = req.extensions().get::<axum::extract::ConnectInfo<std::net::SocketAddr>>() {
            if connect_info.0.ip().is_loopback() {
                let response = next.run(req).await;
                return Ok(response);
            }
        }
    }

    Err(StatusCode::UNAUTHORIZED)
}

#[derive(Deserialize)]
struct LoginRequest {
    username: String,
    password: String,
}

async fn auth_login(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<LoginRequest>,
) -> impl IntoResponse {
    let config_path = crate::config::get_settings_path(None);
    let settings = match crate::config::load_config(&config_path) {
        Ok(s) => s,
        Err(e) => {
            tracing::error!("auth_login: Failed to load config from {:?}: {}", config_path, e);
            crate::config::Settings::default()
        }
    };

    let web_auth = settings.web_auth.unwrap_or_default();
    let expected_username = web_auth.username.unwrap_or_default();
    let expected_password = web_auth.password.unwrap_or_default();

    if !expected_username.is_empty() && !expected_password.is_empty()
        && payload.username == expected_username && payload.password == expected_password
    {
        tracing::info!("auth_login: Login successful for '{}'", payload.username);
        let token = generate_token();
        let expires_at = Utc::now() + chrono::Duration::days(7);
        
        let mut sessions = state.active_sessions.lock().unwrap();
        sessions.insert(token.clone(), TokenInfo {
            username: payload.username.clone(),
            expires_at,
        });
        save_sessions_to_file(&sessions);

        // Save session to SQLite database asynchronously (non-blocking)
        let db_clone = state.db.clone();
        let token_clone = token.clone();
        let username_clone = payload.username;
        let expires_at_str = expires_at.to_rfc3339();
        tokio::spawn(async move {
            let _ = sqlx::query(
                "INSERT OR REPLACE INTO sessions (token, username, expires_at) VALUES (?, ?, ?)"
            )
            .bind(token_clone)
            .bind(username_clone)
            .bind(expires_at_str)
            .execute(&db_clone)
            .await;
        });

        (StatusCode::OK, Json(serde_json::json!({
            "token": token,
            "status": "success"
        })))
    } else {
        // Secure logging to prevent credential leak in logs
        if payload.username == expected_username {
            if expected_password.contains('•') || expected_password.contains("тАв") {
                tracing::warn!(
                    "auth_login: Login failed for '{}'. Warning: The configured password in settings.yaml appears to be corrupted by masked bullet characters (bullet/тАв). Please correct it in config/settings.yaml.",
                    payload.username
                );
            } else {
                tracing::warn!("auth_login: Login failed for '{}'. Incorrect password.", payload.username);
            }
        } else {
            tracing::warn!("auth_login: Login failed. Incorrect username.");
        }
        
        (StatusCode::UNAUTHORIZED, Json(serde_json::json!({
            "error": "Invalid username or password"
        })))
    }
}

async fn auth_logout(
    headers: axum::http::HeaderMap,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let auth_header = headers.get("Authorization").and_then(|h| h.to_str().ok());
    if let Some(auth_val) = auth_header {
        if auth_val.starts_with("Bearer ") {
            let token = &auth_val["Bearer ".len()..];
            let mut sessions = state.active_sessions.lock().unwrap();
            sessions.remove(token);
            save_sessions_to_file(&sessions);

            // Delete session from SQLite database asynchronously
            let db_clone = state.db.clone();
            let token_clone = token.to_string();
            tokio::spawn(async move {
                let _ = sqlx::query("DELETE FROM sessions WHERE token = ?")
                    .bind(token_clone)
                    .execute(&db_clone)
                    .await;
            });
        }
    }
    (StatusCode::OK, Json(serde_json::json!({ "status": "ok" })))
}

async fn auth_status(
    headers: axum::http::HeaderMap,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let auth_header = headers.get("Authorization").and_then(|h| h.to_str().ok());
    if let Some(auth_val) = auth_header {
        if auth_val.starts_with("Bearer ") {
            let token = &auth_val["Bearer ".len()..];
            if verify_session(&state, token) {
                return (StatusCode::OK, Json(serde_json::json!({ "authenticated": true })));
            }
        }
    }
    (StatusCode::OK, Json(serde_json::json!({ "authenticated": false })))
}


#[derive(Deserialize)]
pub struct ScreenshotProxyQuery {
    pub cs2_screenshot_id: String,
    pub side: Option<String>,
}

pub async fn handle_screenshot_proxy(
    Query(query): Query<ScreenshotProxyQuery>,
) -> impl IntoResponse {
    let requested_side = query.side.as_deref().unwrap_or("playside");
    let side = if requested_side == "backside" { "backside" } else { "playside" };
    let cache_dir = std::path::Path::new("cache/screenshots");
    let _ = tokio::fs::create_dir_all(cache_dir).await;

    let cache_png = cache_dir.join(format!("{}_{}.png", query.cs2_screenshot_id, side));
    let cache_webp = cache_dir.join(format!("{}_{}.webp", query.cs2_screenshot_id, side));

    if cache_png.exists() {
        if let Ok(bytes) = tokio::fs::read(&cache_png).await {
            return (
                [
                    (axum::http::header::CONTENT_TYPE, "image/png"),
                    (axum::http::header::CACHE_CONTROL, "public, max-age=86400"),
                ],
                bytes,
            ).into_response();
        }
    }
    if cache_webp.exists() {
        if let Ok(bytes) = tokio::fs::read(&cache_webp).await {
            return (
                [
                    (axum::http::header::CONTENT_TYPE, "image/webp"),
                    (axum::http::header::CACHE_CONTROL, "public, max-age=86400"),
                ],
                bytes,
            ).into_response();
        }
    }

    let client = match reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(10))
        .build() {
            Ok(c) => c,
            Err(_) => reqwest::Client::new(),
        };

    let url = format!("https://csfloat.pics/m/{}/{}.png?v=3", query.cs2_screenshot_id, side);
    match client.get(&url).send().await {
        Ok(resp) if resp.status().is_success() => {
            if let Ok(bytes) = resp.bytes().await {
                let _ = tokio::fs::write(&cache_png, &bytes).await;
                return (
                    [
                        (axum::http::header::CONTENT_TYPE, "image/png"),
                        (axum::http::header::CACHE_CONTROL, "public, max-age=86400"),
                    ],
                    bytes.to_vec(),
                ).into_response();
            }
        }
        _ => {}
    }

    // If backside failed (e.g. gloves/items without backside), fallback to playside
    if side == "backside" {
        let playside_url = format!("https://csfloat.pics/m/{}/playside.png?v=3", query.cs2_screenshot_id);
        if let Ok(resp) = client.get(&playside_url).send().await {
            if resp.status().is_success() {
                if let Ok(bytes) = resp.bytes().await {
                    let _ = tokio::fs::write(&cache_png, &bytes).await;
                    return (
                        [
                            (axum::http::header::CONTENT_TYPE, "image/png"),
                            (axum::http::header::CACHE_CONTROL, "public, max-age=86400"),
                        ],
                        bytes.to_vec(),
                    ).into_response();
                }
            }
        }
    }

    StatusCode::NOT_FOUND.into_response()
}

pub async fn enforce_screenshot_cache_limit() {
    let cache_dir = std::path::Path::new("cache/screenshots");
    if !cache_dir.exists() {
        return;
    }

    let max_bytes: u64 = 4 * 1024 * 1024 * 1024; // 4 GB limit
    let target_bytes: u64 = 3_500_000_000; // 3.5 GB target after purge

    let mut entries = Vec::new();
    let mut total_size: u64 = 0;

    if let Ok(mut dir) = tokio::fs::read_dir(cache_dir).await {
        while let Ok(Some(entry)) = dir.next_entry().await {
            if let Ok(meta) = entry.metadata().await {
                if meta.is_file() {
                    let len = meta.len();
                    total_size += len;
                    let modified = meta.modified().unwrap_or(std::time::SystemTime::UNIX_EPOCH);
                    entries.push((entry.path(), len, modified));
                }
            }
        }
    }

    if total_size > max_bytes {
        tracing::info!("[ScreenshotCache] Cache size {:.2} MB exceeds 4 GB. Purging oldest files...", total_size as f64 / 1_048_576.0);
        entries.sort_by_key(|e| e.2); // Oldest first

        for (path, len, _) in entries {
            if total_size <= target_bytes {
                break;
            }
            if tokio::fs::remove_file(&path).await.is_ok() {
                total_size = total_size.saturating_sub(len);
            }
        }
        tracing::info!("[ScreenshotCache] Cleanup finished. Current size: {:.2} MB", total_size as f64 / 1_048_576.0);
    }
}

pub fn start_screenshot_cache_watcher() {
    tokio::spawn(async move {
        loop {
            enforce_screenshot_cache_limit().await;
            tokio::time::sleep(std::time::Duration::from_secs(300)).await;
        }
    });
}

pub async fn start_server(db: SqlitePool) {
    // Create the sessions table if it doesn't exist to back up tokens reliably
    let _ = sqlx::query(
        "CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            expires_at TEXT NOT NULL
        )"
    )
    .execute(&db)
    .await;

    // Create the purchase_latencies table for statistics if it doesn't exist
    let _ = sqlx::query(
        "CREATE TABLE IF NOT EXISTS purchase_latencies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id TEXT NOT NULL,
            item_name TEXT NOT NULL,
            purchase_type TEXT NOT NULL,
            api_fetch_delay_ms INTEGER NOT NULL,
            analysis_delay_ms INTEGER NOT NULL,
            market_data_delay_ms INTEGER NOT NULL,
            purchase_delay_ms INTEGER NOT NULL,
            total_delay_ms INTEGER NOT NULL,
            detection_delay_ms INTEGER NOT NULL,
            status TEXT NOT NULL,
            timestamp TEXT NOT NULL
        )"
    )
    .execute(&db)
    .await;

    // Ensure target_skins has fire_and_ice columns
    let _ = sqlx::query("ALTER TABLE target_skins ADD COLUMN fire_and_ice_enabled BOOLEAN DEFAULT 0").execute(&db).await;
    let _ = sqlx::query("ALTER TABLE target_skins ADD COLUMN fire_and_ice_tier TEXT").execute(&db).await;

    // Load sessions from the SQLite database
    let mut active_sessions_map = HashMap::new();
    if let Ok(rows) = sqlx::query("SELECT token, username, expires_at FROM sessions")
        .fetch_all(&db)
        .await
    {
        for row in rows {
            use sqlx::Row;
            let token: String = row.get("token");
            let username: String = row.get("username");
            let expires_at_str: String = row.get("expires_at");
            if let Ok(expires_at) = DateTime::parse_from_rfc3339(&expires_at_str) {
                active_sessions_map.insert(token, TokenInfo {
                    username,
                    expires_at: expires_at.with_timezone(&Utc),
                });
            }
        }
    }

    // Merge with legacy sessions.json file if any exist
    let file_sessions = load_sessions_from_file();
    for (token, info) in file_sessions {
        active_sessions_map.entry(token).or_insert(info);
    }

    // Load existing proxy_status.json as the initial state (backward compat)
    let initial_statuses: serde_json::Value = std::fs::read_to_string("../proxy_status.json")
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_else(|| serde_json::json!({ "scanner": {}, "market_data": {}, "auto_buy": {} }));

    let state = Arc::new(AppState {
        db,
        scanner_running: Arc::new(AtomicBool::new(false)),
        scanner_abort: Mutex::new(None),
        scanner_started_at: Mutex::new(None),
        live_stats: Arc::new(Mutex::new(LiveStats::default())),
        account_statuses: Arc::new(Mutex::new(initial_statuses)),
        active_sessions: Mutex::new(active_sessions_map),
        manual_sniper_clients: Mutex::new(HashMap::new()),
    });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let react_frontend_dir = std::path::Path::new("../sn1perb0t111-main/dist");
    let vanilla_frontend_dir = std::path::Path::new("../frontend");
    let frontend_dir = if react_frontend_dir.join("index.html").exists() {
        tracing::info!("Serving React frontend from {:?}", react_frontend_dir);
        react_frontend_dir
    } else {
        tracing::warn!(
            "React frontend dist not found at {:?}, falling back to {:?}",
            react_frontend_dir,
            vanilla_frontend_dir
        );
        vanilla_frontend_dir
    };

    // Serve frontend SPA (supports index.html routing fallback)
    let serve_dir = ServeDir::new(frontend_dir)
        .fallback(ServeFile::new(frontend_dir.join("index.html")));

    // Serve vanilla JS statics
    let serve_static = ServeDir::new(vanilla_frontend_dir);

    let api_routes = Router::new()
        .route("/api/configs", get(get_configs).post(create_config))
        .route("/api/configs/:config_name/targets", get(get_config_targets))
        .route("/api/configs/:config_name/import", post(import_config))
        .route("/api/configs/:config_name", delete(delete_config))
        .route("/api/configs/:config_name/toggle", patch(toggle_config_active))
        .route("/api/history", get(get_history))
        .route("/api/dashboard/stats", get(get_dashboard_stats))
        .route("/api/targets", post(create_target))
        .route("/api/targets/:target_id", put(update_target).delete(delete_target))
        .route("/api/settings", get(get_settings).put(update_settings))
        .route("/api/settings/reveal", post(reveal_secret))
        .route("/api/bot/status", get(get_bot_status))
        .route("/api/bot/start", post(bot_start))
        .route("/api/bot/stop", post(bot_stop))
        .route("/api/ping/csfloat", get(get_ping_csfloat))
        .route("/api/csfloat/balance", get(get_csfloat_balance))
        .route("/api/dashboard/recent-activity", get(get_recent_activity))
        .route("/api/accounts/status", get(get_accounts_status))
        .route("/api/accounts/test", post(test_account))
        .route("/api/accounts/test-all", post(test_all_accounts))
        .route("/api/settings/proxy-pools", get(get_proxy_pools).post(save_proxy_pool))
        .route("/api/live/stats", get(get_live_stats))
        .route("/api/stats/history", get(get_stats_history))
        .route("/api/logs", get(get_logs))
        // Notifications — polled every 2s by NotificationContext
        .route("/api/notifications", get(get_notifications).post(post_notification).delete(delete_all_notifications))
        .route("/api/notifications/:id", delete(delete_notification))
        .route("/api/notifications/:id/read", put(mark_notification_read))
        .route("/api/notifications/read-all", put(mark_all_notifications_read))
        .route("/api/live-monitor/state", get(get_live_monitor_state).post(save_live_monitor_state))
        .route("/api/ui/prefs", get(get_ui_prefs).post(save_ui_prefs))
        .route("/api/live-feed", get(get_live_feed).post(post_live_feed))
        .route("/api/live-feed/stream", get(get_live_feed_stream))
        .route("/api/watchlist/check-market-data", post(check_watchlist_market_data))
        // Skin names list for ItemSearchCombobox
        .route("/api/data/skins", get(get_skin_names))
        .route("/api/data/skins/categorized", get(get_skins_categorized))
        .route("/api/csfloat/highest-bid", get(get_highest_bid_api))
        .route("/api/csfloat/lowest-price", get(get_lowest_price_api))
        .route("/api/csfloat/price-list", get(get_price_list_api))
        .route("/api/csfloat/buy", post(buy_item_api))
        .route("/api/csfloat/buy-order", post(create_buy_order_api))
        .route("/api/csfloat/make-offer", post(make_offer_api))
        .route("/api/csfloat/listings/:id", get(get_listing_detail_api))
        .route("/api/statistics/latencies", get(get_latencies).delete(delete_latencies))
        .route("/api/statistics/test-item", post(test_item_latency))
        .layer(middleware::from_fn_with_state(state.clone(), auth_middleware));

    let app = Router::new()
        .route("/api/auth/login", post(auth_login))
        .route("/api/auth/logout", post(auth_logout))
        .route("/api/auth/status", get(auth_status))
        .route("/api/screenshots/proxy", get(handle_screenshot_proxy))
        .merge(api_routes)
        .nest_service("/static", serve_static)
        .nest_service("/assets", ServeDir::new(frontend_dir.join("assets")))
        .fallback_service(serve_dir)
        .layer(cors)
        .layer(tower_http::trace::TraceLayer::new_for_http())
        .with_state(state);

    // Start background watcher for filled buy orders
    start_buy_order_watcher();
    // Start background watcher for screenshot cache limit (max 4GB)
    start_screenshot_cache_watcher();

    let port = std::env::var("PORT").unwrap_or_else(|_| "8000".to_string());
    let bind_addr = format!("0.0.0.0:{}", port);
    let listener = tokio::net::TcpListener::bind(&bind_addr).await.unwrap();
    tracing::info!("API Server listening on {}", bind_addr);
    axum::serve(listener, app.into_make_service_with_connect_info::<std::net::SocketAddr>()).await.unwrap();
}

// ===========================================
// CONFIGS
// ===========================================

async fn get_configs(
    State(state): State<Arc<AppState>>,
    Query(query): Query<OptionsQuery>,
) -> impl IntoResponse {
    let include_targets = query.include_targets.unwrap_or(false);

    let all_configs = sqlx::query_as::<_, TargetConfig>("SELECT * FROM target_configs")
        .fetch_all(&state.db)
        .await
        .unwrap_or_default();

    let all_targets = sqlx::query_as::<_, TargetSkin>("SELECT * FROM target_skins")
        .fetch_all(&state.db)
        .await
        .unwrap_or_default();

    // Include both persisted configs and legacy config names that only exist in target_skins.
    let mut config_meta: HashMap<String, (bool, Option<String>)> = HashMap::new();
    for config in all_configs {
        config_meta.insert(config.name, (config.is_active, config.emoji));
    }
    for target in &all_targets {
        config_meta
            .entry(target.config_name.clone())
            .or_insert((false, None));
    }

    let mut config_names: Vec<String> = config_meta.keys().cloned().collect();
    config_names.sort();

    let mut result = Vec::new();
    for config_name in config_names {
        let (is_active, emoji) = config_meta
            .get(&config_name)
            .cloned()
            .unwrap_or((false, None));

        let targets: Vec<TargetSkin> = all_targets
            .iter()
            .filter(|t| t.config_name == config_name)
            .cloned()
            .collect();
        let active_targets = targets.iter().filter(|t| t.is_active).count();

        result.push(ConfigResponse {
            name: config_name,
            target_count: targets.len(),
            active_count: if is_active { active_targets } else { 0 },
            is_active,
            emoji,
            targets: if include_targets { targets } else { Vec::new() },
        });
    }

    (StatusCode::OK, Json(result))
}

#[derive(Deserialize)]
struct ConfigCreate {
    name: String,
    emoji: Option<String>,
    enabled: Option<bool>,
}

async fn create_config(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<ConfigCreate>,
) -> impl IntoResponse {
    let is_active = payload.enabled.unwrap_or(true);
    let res = sqlx::query(
        "INSERT OR IGNORE INTO target_configs (name, emoji, is_active) VALUES (?, ?, ?)"
    )
    .bind(&payload.name)
    .bind(&payload.emoji)
    .bind(is_active)
    .execute(&state.db)
    .await;

    match res {
        Ok(_) => (StatusCode::OK, Json(serde_json::json!({"status": "ok"}))),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": "db error"}))),
    }
}

#[derive(Deserialize)]
struct ToggleQuery {
    active: bool,
}

async fn toggle_config_active(
    State(state): State<Arc<AppState>>,
    AxumPath(config_name): AxumPath<String>,
    Query(query): Query<ToggleQuery>,
) -> impl IntoResponse {
    let result = sqlx::query(
        "INSERT INTO target_configs (name, is_active) VALUES (?1, ?2)
         ON CONFLICT(name) DO UPDATE SET is_active=excluded.is_active",
    )
    .bind(&config_name)
    .bind(query.active)
    .execute(&state.db)
    .await;

    match result {
        Ok(_) => {
            add_log(&format!("Config '{}' set to active={}", config_name, query.active));
            (StatusCode::OK, Json(serde_json::json!({"message": format!("Updated {}", config_name)})))
        },
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": e.to_string()}))),
    }
}

async fn delete_config(
    State(state): State<Arc<AppState>>,
    AxumPath(config_name): AxumPath<String>,
) -> impl IntoResponse {
    let _ = sqlx::query("DELETE FROM target_skins WHERE config_name = ?")
        .bind(&config_name)
        .execute(&state.db).await;
        
    let _ = sqlx::query("DELETE FROM target_configs WHERE name = ?")
        .bind(&config_name)
        .execute(&state.db).await;

    (StatusCode::OK, Json(serde_json::json!({"message": "deleted"})))
}

async fn get_config_targets(
    State(state): State<Arc<AppState>>,
    AxumPath(config_name): AxumPath<String>,
) -> impl IntoResponse {
    let targets = sqlx::query_as::<_, TargetSkin>(
        "SELECT * FROM target_skins WHERE config_name = ? ORDER BY id DESC",
    )
    .bind(&config_name)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    (StatusCode::OK, Json(targets))
}

// ===========================================
// TARGETS (CRUD using JSON fallback)
// ===========================================

// Since there are 50+ columns in target_skins, and writing a perfect Rust mapping 
// with exact defaults inline is error-prone, we serialize the HTTP JSON and route it to SQLite.
async fn create_target(
    State(state): State<Arc<AppState>>,
    Json(mut payload): Json<serde_json::Value>,
) -> impl IntoResponse {
    // Add defaults handled by Python Pydantic
    if payload.get("min_float").is_none() { payload["min_float"] = serde_json::json!(0.0); }
    if payload.get("max_float").is_none() { payload["max_float"] = serde_json::json!(1.0); }
    if payload.get("is_active").is_none() { payload["is_active"] = serde_json::json!(true); }
    if payload.get("config_name").is_none() { payload["config_name"] = serde_json::json!("Default"); }
    if payload.get("mode").is_none() { payload["mode"] = serde_json::json!("Notify Only"); }
    if payload.get("markup_pct").is_none() { payload["markup_pct"] = serde_json::json!(0.0); }
    if payload.get("markup_mult").is_none() { payload["markup_mult"] = serde_json::json!(1.0); }
    if payload.get("notifications_enabled").is_none() { payload["notifications_enabled"] = serde_json::json!(true); }

    // Convert arrays to strings for SQLite JSON columns if needed
    let stickers_str = payload.get("stickers").map(|v| v.to_string());
    let charms_str = payload.get("charms").map(|v| v.to_string());

    let res = sqlx::query("INSERT Into target_skins (
        item_name, min_price, max_price, min_float, max_float, config_name, mode,
        is_active, markup_pct, markup_mult, stickers, charms, description, paint_seed,
        notifications_enabled, blue_gem_tier, fire_and_ice_enabled, fire_and_ice_tier
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(payload.get("item_name").and_then(|v| v.as_str()).unwrap_or(""))
    .bind(payload.get("min_price").and_then(|v| v.as_f64()).unwrap_or(0.0))
    .bind(payload.get("max_price").and_then(|v| v.as_f64()).unwrap_or(0.0))
    .bind(payload.get("min_float").and_then(|v| v.as_f64()).unwrap_or(0.0))
    .bind(payload.get("max_float").and_then(|v| v.as_f64()).unwrap_or(1.0))
    .bind(payload.get("config_name").and_then(|v| v.as_str()).unwrap_or("Default"))
    .bind(payload.get("mode").and_then(|v| v.as_str()).unwrap_or("Notify Only"))
    .bind(payload.get("is_active").and_then(|v| v.as_bool()).unwrap_or(true))
    .bind(payload.get("markup_pct").and_then(|v| v.as_f64()).unwrap_or(0.0))
    .bind(payload.get("markup_mult").and_then(|v| v.as_f64()).unwrap_or(1.0))
    .bind(stickers_str)
    .bind(charms_str)
    .bind(payload.get("description").and_then(|v| v.as_str()))
    .bind(payload.get("paint_seed").and_then(|v| v.as_str()))
    .bind(payload.get("notifications_enabled").and_then(|v| v.as_bool()).unwrap_or(true))
    .bind(payload.get("blue_gem_tier").and_then(|v| v.as_i64()))
    .bind(payload.get("fire_and_ice_enabled").and_then(|v| v.as_bool()).unwrap_or(false))
    .bind(payload.get("fire_and_ice_tier").and_then(|v| v.as_str()))
    .execute(&state.db)
    .await;

    match res {
        Ok(info) => {
            let mut p = payload.clone();
            p["id"] = serde_json::json!(info.last_insert_rowid());
            (StatusCode::OK, Json(p))
        },
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": format!("db error: {}", e)}))),
    }
}

#[derive(Deserialize)]
struct ImportPayload {
    targets: Vec<serde_json::Value>,
}

async fn import_config(
    State(state): State<Arc<AppState>>,
    AxumPath(config_name): AxumPath<String>,
    Json(payload): Json<ImportPayload>,
) -> impl IntoResponse {
    let mut created_targets = Vec::new();

    for mut target_payload in payload.targets {
        if target_payload.get("min_float").is_none() { target_payload["min_float"] = serde_json::json!(0.0); }
        if target_payload.get("max_float").is_none() { target_payload["max_float"] = serde_json::json!(1.0); }
        if target_payload.get("is_active").is_none() { target_payload["is_active"] = serde_json::json!(true); }
        
        target_payload["config_name"] = serde_json::json!(&config_name);
        
        if target_payload.get("mode").is_none() { target_payload["mode"] = serde_json::json!("Notify Only"); }
        if target_payload.get("markup_pct").is_none() { target_payload["markup_pct"] = serde_json::json!(0.0); }
        if target_payload.get("markup_mult").is_none() { target_payload["markup_mult"] = serde_json::json!(1.0); }
        if target_payload.get("notifications_enabled").is_none() { target_payload["notifications_enabled"] = serde_json::json!(true); }

        let stickers_str = target_payload.get("stickers").map(|v| v.to_string());
        let charms_str = target_payload.get("charms").map(|v| v.to_string());

        let res = sqlx::query("INSERT Into target_skins (
            item_name, min_price, max_price, min_float, max_float, config_name, mode,
            is_active, markup_pct, markup_mult, stickers, charms, description, paint_seed,
            notifications_enabled, blue_gem_tier, fire_and_ice_enabled, fire_and_ice_tier
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(target_payload.get("item_name").and_then(|v| v.as_str()).unwrap_or(""))
        .bind(target_payload.get("min_price").and_then(|v| v.as_f64()).unwrap_or(0.0))
        .bind(target_payload.get("max_price").and_then(|v| v.as_f64()).unwrap_or(0.0))
        .bind(target_payload.get("min_float").and_then(|v| v.as_f64()).unwrap_or(0.0))
        .bind(target_payload.get("max_float").and_then(|v| v.as_f64()).unwrap_or(1.0))
        .bind(&config_name)
        .bind(target_payload.get("mode").and_then(|v| v.as_str()).unwrap_or("Notify Only"))
        .bind(target_payload.get("is_active").and_then(|v| v.as_bool()).unwrap_or(true))
        .bind(target_payload.get("markup_pct").and_then(|v| v.as_f64()).unwrap_or(0.0))
        .bind(target_payload.get("markup_mult").and_then(|v| v.as_f64()).unwrap_or(1.0))
        .bind(stickers_str)
        .bind(charms_str)
        .bind(target_payload.get("description").and_then(|v| v.as_str()))
        .bind(target_payload.get("paint_seed").and_then(|v| v.as_str()))
        .bind(target_payload.get("notifications_enabled").and_then(|v| v.as_bool()).unwrap_or(true))
        .bind(target_payload.get("blue_gem_tier").and_then(|v| v.as_i64()))
        .bind(target_payload.get("fire_and_ice_enabled").and_then(|v| v.as_bool()).unwrap_or(false))
        .bind(target_payload.get("fire_and_ice_tier").and_then(|v| v.as_str()))
        .execute(&state.db)
        .await;

        match res {
            Ok(info) => {
                target_payload["id"] = serde_json::json!(info.last_insert_rowid());
                created_targets.push(target_payload);
            },
            Err(e) => {
                tracing::error!("Failed to import target: {}", e);
            }
        }
    }

    (StatusCode::OK, Json(serde_json::json!({ "targets": created_targets })))
}

async fn update_target(
    State(state): State<Arc<AppState>>,
    AxumPath(target_id): AxumPath<i64>,
    Json(payload): Json<serde_json::Value>,
) -> impl IntoResponse {
    let mut qb: sqlx::QueryBuilder<sqlx::Sqlite> = sqlx::QueryBuilder::new("UPDATE target_skins SET ");
    let mut pushed = false;
    
    // Dynamically update fields that are present
    let obj = match payload.as_object() {
        Some(o) => o,
        None => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": "payload must be object"}))),
    };

    for (k, v) in obj {
        if k == "id" { continue; } // Don't update ID

        if pushed { qb.push(", "); }
        qb.push(k).push(" = ");
        
        if v.is_string() { qb.push_bind(v.as_str().unwrap()); }
        else if v.is_f64() { qb.push_bind(v.as_f64().unwrap()); }
        else if v.is_i64() { qb.push_bind(v.as_i64().unwrap()); }
        else if v.is_boolean() { qb.push_bind(v.as_bool().unwrap()); }
        else if v.is_null() { qb.push("NULL"); }
        else { qb.push_bind(v.to_string()); } // JSON objects stringified
        
        pushed = true;
    }

    if pushed {
        qb.push(" WHERE id = ").push_bind(target_id);
        let res = qb.build().execute(&state.db).await;
        if res.is_err() {
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": "Update failed"})));
        }
    }
    
    (StatusCode::OK, Json(serde_json::json!({"id": target_id})))
}

async fn delete_target(
    State(state): State<Arc<AppState>>,
    AxumPath(target_id): AxumPath<i64>,
) -> impl IntoResponse {
    let _ = sqlx::query("DELETE FROM target_skins WHERE id = ?")
        .bind(target_id)
        .execute(&state.db).await;

    (StatusCode::OK, Json(serde_json::json!({"message": "deleted"})))
}


// ===========================================
// HISTORY & DASHBOARD
// ===========================================

#[derive(Deserialize)]
struct HistoryQuery {
    limit: Option<i64>,
}

async fn get_history(State(state): State<Arc<AppState>>, Query(q): Query<HistoryQuery>) -> impl IntoResponse {
    let lim = q.limit.unwrap_or(1000);
    let rows = sqlx::query(
        "SELECT id, asset_id, item_name, wear_name, price, float_value, paint_seed, stickers, purchased, timestamp, sell_price, profit, markup_pct, markup_mult FROM sales_history ORDER BY timestamp DESC LIMIT ?"
    )
    .bind(lim)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let history: Vec<serde_json::Value> = rows.iter().map(|r| {
        use sqlx::Row;
        // float_value must not be null — History.tsx will crash in getFloatWear(null)
        let float_value: f64 = r.try_get::<Option<f64>, _>("float_value").unwrap_or(None).unwrap_or(0.0);
        // stickers: frontend does stickers.join(",") — must be array
        let stickers: Vec<serde_json::Value> = vec![];
        serde_json::json!({
            "id": r.try_get::<i64, _>("id").unwrap_or(0),
            "asset_id": r.try_get::<String, _>("asset_id").unwrap_or_default(),
            "item_name": r.try_get::<String, _>("item_name").unwrap_or_default(),
            "wear_name": r.try_get::<Option<String>, _>("wear_name").unwrap_or(None).unwrap_or_default(),
            "price": r.try_get::<f64, _>("price").unwrap_or(0.0),
            "float_value": float_value,
            "paint_seed": r.try_get::<Option<i64>, _>("paint_seed").unwrap_or(None),
            "stickers": stickers,
            "purchased": r.try_get::<bool, _>("purchased").unwrap_or(false),
            "timestamp": r.try_get::<Option<String>, _>("timestamp").unwrap_or(None).unwrap_or_default(),
            "sell_price": r.try_get::<Option<f64>, _>("sell_price").unwrap_or(None),
            "profit": r.try_get::<Option<f64>, _>("profit").unwrap_or(None),
            "markup_pct": r.try_get::<Option<f64>, _>("markup_pct").unwrap_or(None),
            "markup_mult": r.try_get::<Option<f64>, _>("markup_mult").unwrap_or(None)
        })
    }).collect();
        
    (StatusCode::OK, Json(serde_json::to_value(history).unwrap()))
}


async fn get_dashboard_stats(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let total_targets: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM target_skins")
        .fetch_one(&state.db)
        .await
        .unwrap_or((0,));
        
    let active_targets: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM target_skins WHERE is_active = 1")
        .fetch_one(&state.db)
        .await
        .unwrap_or((0,));

    let response = serde_json::json!({
        "items_found_24h": 0,
        "items_bought_24h": 0,
        "total_targets": total_targets.0,
        "active_targets": active_targets.0
    });

    (StatusCode::OK, Json(response))
}

// ===========================================
// SETTINGS
// ===========================================

#[derive(Deserialize)]
struct SettingsQuery {
    profile: Option<String>,
}

fn resolve_settings_file(profile: Option<&String>) -> std::path::PathBuf {
    crate::config::get_settings_path(profile.map(|s| s.as_str()))
}

/// Mask a secret string: show only last 4 chars, prefix with bullets.
/// Empty / short strings → "••••••••".
fn mask_key(key: &str) -> String {
    let trimmed = key.trim();
    let len = trimmed.chars().count();
    if len <= 4 {
        return "•".repeat(8);
    }
    let last4: String = trimmed.chars().rev().take(4).collect::<String>().chars().rev().collect();
    let bullets = "•".repeat(len - 4);
    format!("{}{}", bullets, last4)
}

/// Returns true if the value looks like a mask we emitted (contains a bullet character).
fn is_masked(value: &str) -> bool {
    value.contains('•')
}

/// Deep-clone settings replacing all secret fields with masks.
fn mask_settings(settings: &crate::config::Settings) -> serde_json::Value {
    let mut v = serde_json::to_value(settings).unwrap_or_default();

    // Helper: mask api_key inside an accounts array
    let mask_accounts = |accounts: &mut serde_json::Value| {
        if let Some(arr) = accounts.as_array_mut() {
            for acc in arr.iter_mut() {
                if let Some(key) = acc.get("api_key").and_then(|k| k.as_str()) {
                    if !key.is_empty() {
                        acc["api_key"] = serde_json::Value::String(mask_key(key));
                    }
                }
            }
        }
    };

    // scanner.api_key (legacy top-level key)
    if let Some(scanner) = v.get_mut("scanner") {
        if let Some(key) = scanner.get("api_key").and_then(|k| k.as_str()) {
            if !key.is_empty() {
                scanner["api_key"] = serde_json::Value::String(mask_key(key));
            }
        }
        if let Some(accounts) = scanner.get_mut("accounts") {
            mask_accounts(accounts);
        }
    }

    // auto_buy.accounts
    if let Some(auto_buy) = v.get_mut("auto_buy") {
        if let Some(accounts) = auto_buy.get_mut("accounts") {
            mask_accounts(accounts);
        }
    }

    // market_data.accounts
    if let Some(market_data) = v.get_mut("market_data") {
        if let Some(accounts) = market_data.get_mut("accounts") {
            mask_accounts(accounts);
        }
    }

    // bot tokens
    if let Some(bot) = v.get_mut("bot") {
        for field in &["telegram_bot_token", "telegram_target_bot_token"] {
            if let Some(key) = bot.get(*field).and_then(|k| k.as_str()) {
                if !key.is_empty() {
                    bot[*field] = serde_json::Value::String(mask_key(key));
                }
            }
        }
    }

    // web_auth password / secret_key
    if let Some(web_auth) = v.get_mut("web_auth") {
        for field in &["password", "secret_key"] {
            if let Some(key) = web_auth.get(*field).and_then(|k| k.as_str()) {
                if !key.is_empty() {
                    web_auth[*field] = serde_json::Value::String(mask_key(key));
                }
            }
        }
    }

    v
}

/// Merge incoming (possibly masked) payload with the real settings on disk.
/// Any field that looks like a mask is replaced by the real value from disk.
fn merge_masked_settings(
    payload: crate::config::Settings,
    disk: &crate::config::Settings,
) -> crate::config::Settings {
    // Serialize both, work at JSON level, then deserialize back.
    let mut incoming = serde_json::to_value(&payload).unwrap_or_default();
    let disk_val = serde_json::to_value(disk).unwrap_or_default();

    fn restore_if_masked(incoming: &mut serde_json::Value, disk: &serde_json::Value, field: &str) {
        if let Some(v) = incoming.get(field).and_then(|v| v.as_str()) {
            if is_masked(v) {
                if let Some(real) = disk.get(field) {
                    incoming[field] = real.clone();
                }
            }
        }
    }

    fn restore_accounts(incoming: &mut serde_json::Value, disk: &serde_json::Value) {
        if let (Some(inc_arr), Some(disk_arr)) = (incoming.as_array_mut(), disk.as_array()) {
            for (i, acc) in inc_arr.iter_mut().enumerate() {
                if let Some(v) = acc.get("api_key").and_then(|v| v.as_str()) {
                    if is_masked(v) {
                        let suffix: String = v.chars().filter(|&c| c != '•').collect();
                        let mut matched_key: Option<serde_json::Value> = None;

                        if !suffix.is_empty() {
                            let incoming_proxy = acc.get("proxy").and_then(|p| p.as_str()).unwrap_or("");
                            let mut candidates = Vec::new();
                            for disk_acc in disk_arr.iter() {
                                if let Some(disk_key) = disk_acc.get("api_key").and_then(|k| k.as_str()) {
                                    if disk_key.ends_with(&suffix) {
                                        candidates.push(disk_acc);
                                    }
                                }
                            }

                            if candidates.len() == 1 {
                                matched_key = candidates[0].get("api_key").cloned();
                            } else if candidates.len() > 1 {
                                for cand in &candidates {
                                    let cand_proxy = cand.get("proxy").and_then(|p| p.as_str()).unwrap_or("");
                                    if cand_proxy == incoming_proxy {
                                        matched_key = cand.get("api_key").cloned();
                                        break;
                                    }
                                }
                                if matched_key.is_none() {
                                    matched_key = candidates[0].get("api_key").cloned();
                                }
                            }
                        }

                        // Fallback to index matching if no match found
                        if matched_key.is_none() {
                            if let Some(real) = disk_arr.get(i).and_then(|d| d.get("api_key")) {
                                matched_key = Some(real.clone());
                            }
                        }

                        if let Some(real_key) = matched_key {
                            acc["api_key"] = real_key;
                        }
                    }
                }
            }
        }
    }

    // scanner
    if let (Some(inc_sc), Some(disk_sc)) = (incoming.get_mut("scanner"), disk_val.get("scanner")) {
        restore_if_masked(inc_sc, disk_sc, "api_key");
        if let (Some(inc_acc), Some(disk_acc)) = (inc_sc.get_mut("accounts"), disk_sc.get("accounts")) {
            restore_accounts(inc_acc, disk_acc);
        }
    }
    // auto_buy
    if let (Some(inc_ab), Some(disk_ab)) = (incoming.get_mut("auto_buy"), disk_val.get("auto_buy")) {
        if let (Some(inc_acc), Some(disk_acc)) = (inc_ab.get_mut("accounts"), disk_ab.get("accounts")) {
            restore_accounts(inc_acc, disk_acc);
        }
    }
    // market_data
    if let (Some(inc_md), Some(disk_md)) = (incoming.get_mut("market_data"), disk_val.get("market_data")) {
        if let (Some(inc_acc), Some(disk_acc)) = (inc_md.get_mut("accounts"), disk_md.get("accounts")) {
            restore_accounts(inc_acc, disk_acc);
        }
    }
    // bot tokens
    if let (Some(inc_bot), Some(disk_bot)) = (incoming.get_mut("bot"), disk_val.get("bot")) {
        for field in &["telegram_bot_token", "telegram_target_bot_token"] {
            restore_if_masked(inc_bot, disk_bot, field);
        }
    }
    // web_auth
    if let (Some(inc_wa), Some(disk_wa)) = (incoming.get_mut("web_auth"), disk_val.get("web_auth")) {
        for field in &["password", "secret_key"] {
            restore_if_masked(inc_wa, disk_wa, field);
        }
    }

    match serde_json::from_value::<crate::config::Settings>(incoming.clone()) {
        Ok(s) => s,
        Err(e) => {
            tracing::error!("Failed to deserialize merged settings: {}. Fallback to unmodified payload.", e);
            add_log(&format!("❌ Deserialization error in merge_masked_settings: {}", e));
            payload
        }
    }
}

async fn get_settings(Query(query): Query<SettingsQuery>) -> impl IntoResponse {
    let path = resolve_settings_file(query.profile.as_ref());
    if let Ok(settings) = crate::config::load_config(&path) {
        (StatusCode::OK, Json(mask_settings(&settings)))
    } else {
        (StatusCode::OK, Json(serde_json::json!({
            "bot": {},
            "scanner": {},
            "market_data": {},
            "auto_buy": {}
        })))
    }
}

async fn update_settings(
    State(state): State<Arc<AppState>>,
    Query(query): Query<SettingsQuery>,
    Json(payload): Json<crate::config::Settings>,
) -> impl IntoResponse {
    let path = resolve_settings_file(query.profile.as_ref());
    
    let abs_path = std::fs::canonicalize(&path)
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_else(|_| format!("{:?} (non-existent or error)", path));
        
    tracing::info!("update_settings: Saving settings to path={:?}, resolved abs_path={}", path, abs_path);
    add_log(&format!("💾 Saving settings via API to: {}", abs_path));

    // Merge: restore any masked secrets from the current disk file
    let mut disk_opt = None;
    let final_settings = if let Ok(disk) = crate::config::load_config(&path) {
        tracing::info!("update_settings: loaded current disk settings for merging");
        let merged = merge_masked_settings(payload, &disk);
        disk_opt = Some(disk);
        merged
    } else {
        tracing::warn!("update_settings: failed to load settings from path={:?} for merging", path);
        payload
    };

    // Log which scanner accounts changed
    if let Some(disk) = disk_opt {
        if let Some(ref new_scanner) = final_settings.scanner {
            let old_accounts = disk.scanner.as_ref().map(|s| &s.accounts);
            if let Some(old_accounts) = old_accounts {
                let new_accounts = &new_scanner.accounts;
                let max_len = std::cmp::max(old_accounts.len(), new_accounts.len());
                for i in 0..max_len {
                    match (old_accounts.get(i), new_accounts.get(i)) {
                        (Some(old_acc), Some(new_acc)) => {
                            if old_acc != new_acc {
                                let mut changes = Vec::new();
                                if old_acc.api_key != new_acc.api_key {
                                    changes.push("api_key");
                                }
                                if old_acc.proxy != new_acc.proxy {
                                    changes.push("proxy");
                                }
                                if old_acc.enabled != new_acc.enabled {
                                    changes.push("enabled");
                                }
                                if old_acc.backup_ips != new_acc.backup_ips {
                                    changes.push("backup_ips");
                                }
                                tracing::info!("Scanner Account #{} changed: {:?}", i, changes);
                            }
                        }
                        (None, Some(_)) => {
                            tracing::info!("Scanner Account #{} added", i);
                        }
                        (Some(_), None) => {
                            tracing::info!("Scanner Account #{} removed", i);
                        }
                        (None, None) => unreachable!(),
                    }
                }
            } else {
                for (i, _) in new_scanner.accounts.iter().enumerate() {
                    tracing::info!("Scanner Account #{} added (initial scanner config)", i);
                }
            }
        }
    } else if let Some(ref scanner) = final_settings.scanner {
        tracing::info!("Initial settings save: scanner accounts count = {}", scanner.accounts.len());
    }

    match crate::config::save_config(&path, &final_settings) {
        Ok(_) => {
            tracing::info!("update_settings: successfully saved to disk");
            add_log("✅ Settings successfully saved to disk.");
            {
                let mut cache = state.manual_sniper_clients.lock().unwrap();
                cache.clear();
            }
            (StatusCode::OK, Json(serde_json::json!({"message": "Settings updated"})))
        },
        Err(e) => {
            tracing::error!("update_settings: failed to save to disk: {}", e);
            add_log(&format!("❌ Failed to save settings to disk: {}", e));
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": e.to_string()})))
        },
    }
}

#[derive(Deserialize)]
struct RevealRequest {
    /// Dot-path to the field, e.g. "scanner.api_key", "scanner.accounts.0.api_key"
    field: String,
    /// Which profile (config-1 / config-2)
    profile: Option<String>,
}

async fn reveal_secret(Json(payload): Json<RevealRequest>) -> impl IntoResponse {
    let path = resolve_settings_file(payload.profile.as_ref());
    let settings = match crate::config::load_config(&path) {
        Ok(s) => s,
        Err(_) => return (StatusCode::NOT_FOUND, Json(serde_json::json!({"error": "Settings not found"}))),
    };
    let val = serde_json::to_value(&settings).unwrap_or_default();

    // Walk dot-path (supports numeric indices for arrays)
    let parts: Vec<&str> = payload.field.split('.').collect();
    let mut cur = &val;
    for part in &parts {
        cur = if let Ok(idx) = part.parse::<usize>() {
            match cur.get(idx) {
                Some(v) => v,
                None => return (StatusCode::NOT_FOUND, Json(serde_json::json!({"error": "Field not found"}))),
            }
        } else {
            match cur.get(*part) {
                Some(v) => v,
                None => return (StatusCode::NOT_FOUND, Json(serde_json::json!({"error": "Field not found"}))),
            }
        };
    }
    (StatusCode::OK, Json(serde_json::json!({ "value": cur })))
}

fn normalize_scanner_config(mut scanner_cfg: crate::config::ScannerSettings) -> crate::config::ScannerSettings {
    if scanner_cfg.api_key.as_deref().unwrap_or("").is_empty() {
        scanner_cfg.api_key = scanner_cfg
            .accounts
            .iter()
            .find(|a| a.enabled && a.api_key.as_deref().unwrap_or("").len() > 3)
            .and_then(|a| a.api_key.clone());
    }

    if scanner_cfg.monitoring_proxies.is_empty() {
        scanner_cfg.monitoring_proxies = scanner_cfg
            .accounts
            .iter()
            .filter(|a| a.enabled)
            .filter_map(|a| a.proxy.clone())
            .filter(|p| !p.trim().is_empty())
            .collect();
    }

    scanner_cfg
}

fn cleanup_finished_scanner_task(state: &AppState) {
    let mut abort_guard = state.scanner_abort.lock().unwrap();
    let is_finished = abort_guard
        .as_ref()
        .map(|h| h.is_finished())
        .unwrap_or(false);

    if is_finished {
        *abort_guard = None;
        state.scanner_running.store(false, Ordering::SeqCst);
        *state.scanner_started_at.lock().unwrap() = None;
    }
}

async fn get_bot_status(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    cleanup_finished_scanner_task(&state);

    let running = state.scanner_running.load(Ordering::SeqCst);
    let started_at_guard = state.scanner_started_at.lock().unwrap();
    let live_stats = state.live_stats.lock().unwrap().clone();

    let start_time = started_at_guard.as_ref().map(|dt| dt.to_rfc3339());
    let uptime_seconds = started_at_guard
        .as_ref()
        .map(|dt| (Utc::now() - *dt).num_seconds())
        .filter(|secs| *secs >= 0);

    // scan_latency in seconds: processing duration of matched target items (or avg_speed)
    let scan_latency_secs = if let Some(last_ms) = live_stats.last_matched_processing_ms {
        last_ms as f64 / 1000.0
    } else if live_stats.avg_speed > 0 {
        live_stats.avg_speed as f64 / 1000.0
    } else {
        0.0
    };

    (StatusCode::OK, Json(serde_json::json!({
        "running": running,
        "pid": serde_json::Value::Null,
        "start_time": start_time,
        "uptime_seconds": uptime_seconds,
        "scan_latency": scan_latency_secs,
        "status": if running { "Running" } else { "Stopped" },
        "uptime": uptime_seconds.unwrap_or(0),
        "active_configs": 0,
        "active_targets": 0,
        "scanner_proxy_count": 0,
        "market_proxy_count": 0,
        "performance": { "cpu_usage": 0.0, "ram_usage_mb": 0.0 },
        "proxy_health": { "scanner": {}, "market_data": {} }
    })))
}

async fn bot_start(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    cleanup_finished_scanner_task(&state);

    if state.scanner_running.load(Ordering::SeqCst) {
        return (StatusCode::OK, Json(serde_json::json!({
            "status": "already_running",
            "message": "Rust scanner is already running"
        })));
    }

    let config_path = crate::config::get_settings_path(None);
    let settings = match crate::config::load_config(&config_path) {
        Ok(s) => s,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "detail": format!("Failed to load settings: {}", e) })),
            );
        }
    };

    let auto_buy_accounts = settings
        .auto_buy
        .as_ref()
        .map(|s| s.accounts.clone())
        .unwrap_or_default();

    let bot_settings = settings.bot.clone();
    let market_settings = settings.market_data.clone();

    let scanner_cfg = match settings.scanner {
        Some(s) => normalize_scanner_config(s),
        None => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "detail": "No scanner config found in settings.yaml" })),
            );
        }
    };

    let notifier = bot_settings.map(|bot| {
        crate::notifier::TelegramNotifier::new(
            bot.telegram_bot_token,
            bot.telegram_chat_id,
            bot.telegram_target_bot_token,
        )
    });

    let scanner_api_key_fallback = scanner_cfg.api_key.clone();
    add_log(&format!("Scanner configured with {} accounts", scanner_cfg.accounts.len()));
    let account_statuses_arc = state.account_statuses.clone();
    let scanner = match crate::scanner::Scanner::new(scanner_cfg, auto_buy_accounts, Some(state.db.clone()), notifier.clone(), Some(account_statuses_arc)) {
        Ok(s) => s,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "detail": format!("Failed to build scanner: {}", e) })),
            );
        }
    };

    let market_accounts = {
        let mut out = Vec::new();
        if let Some(market) = &market_settings {
            let use_market_proxies = market.use_market_proxies;
            for (idx, acc) in market.accounts.iter().enumerate() {
                if !acc.enabled {
                    continue;
                }
                let api_key = acc.api_key.clone().unwrap_or_default();
                out.push(crate::market_data::MarketAccount {
                    api_key,
                    proxy: if use_market_proxies { acc.proxy.clone() } else { None },
                    original_index: idx,
                });
            }

            if out.is_empty() && !market.proxies.is_empty() && use_market_proxies {
                let fallback_key = scanner_api_key_fallback.clone().unwrap_or_default();
                for (idx, proxy) in market.proxies.iter().enumerate() {
                    out.push(crate::market_data::MarketAccount {
                        api_key: fallback_key.clone(),
                        proxy: Some(proxy.clone()),
                        original_index: idx,
                    });
                }
            }
        }
        out
    };

    add_log(&format!("Market data configured with {} accounts", market_accounts.len()));
    let market_data_client = if market_accounts.is_empty() {
        None
    } else {
        match crate::market_data::MarketDataClient::new(market_accounts, notifier.clone(), Some(state.account_statuses.clone())) {
            Ok(client) => Some(std::sync::Arc::new(client)),
            Err(e) => {
                tracing::warn!("Failed to initialize market data client: {}", e);
                None
            }
        }
    };



    if let Some(n) = notifier.clone() {
        tokio::spawn(async move {
            n.send_message("✅ *CSFloat Sniper (Rust Core)*\nScanner started successfully!").await;
        });
    }

    // Web notification: scanner started
    push_web_notification(
        "info",
        "system",
        "✅ Scanner Started",
        "CSFloat Sniper (Rust Core) scanner started successfully.",
        None,
    );

    let running_flag = state.scanner_running.clone();
    let db = state.db.clone();
    let stats_ref = state.live_stats.clone();

    running_flag.store(true, Ordering::SeqCst);
    *state.scanner_started_at.lock().unwrap() = Some(Utc::now());

    let task_handle = tokio::spawn(async move {
        add_log("Rust scanner started loop");

        let mut analyzer = crate::analyzer::Analyzer::new();
        let mut scanner = scanner;
        let mut scan_count = 0u64;
        // Dedup: track listing IDs we've already processed to avoid re-notifying same item every scan
        let mut seen_listing_ids: std::collections::HashMap<String, std::time::Instant> = std::collections::HashMap::new();
        let mut scan_window: std::collections::VecDeque<(std::time::Instant, usize)> = std::collections::VecDeque::new();
        let mut last_keep_warm = std::time::Instant::now();

        loop {
            if !running_flag.load(Ordering::SeqCst) {
                break;
            }

            if last_keep_warm.elapsed() >= std::time::Duration::from_secs(30) {
                scanner.keep_warm_once().await;
                last_keep_warm = std::time::Instant::now();
            }

            if scan_count % 60 == 0 {
                if let Err(e) = analyzer.refresh_knowledge_base(&db).await {
                    add_log(&format!("Failed to refresh targets: {}", e));
                }
            }
            scan_count += 1;

            match scanner.fetch_recent_listings().await {
                Ok(response) => {
                    let api_fetch_delay_ms = (scanner.last_scan_duration * 1000.0) as i64;
                    let scan_receive_time = std::time::Instant::now();
                    let mut cnt = 0;
                    let mut new_scanned = 0;
                    let mut total_matches = 0;
                    if let Some(listings) = response.data {
                        cnt = listings.len();

                        // === LIVE FEED: Push ALL listings before analyzer ===
                        {
                            let feed_items: Vec<serde_json::Value> = listings.iter().map(|listing| {
                                let item_data = listing.item.as_ref();
                                let raw_item_name = item_data
                                    .and_then(|i| i.item_name.clone())
                                    .unwrap_or_else(|| "Unknown".to_string());
                                let wear_name = item_data
                                    .and_then(|i| i.wear_name.clone())
                                    .unwrap_or_default();
                                let item_phase = item_data
                                    .and_then(|i| i.phase.clone().or(i.phase_name.clone()));

                                let mut full_skin_name = raw_item_name.clone();
                                if let Some(phase) = &item_phase {
                                    if !full_skin_name.to_lowercase().contains(&phase.to_lowercase()) {
                                        full_skin_name = format!("{} ({})", full_skin_name, phase);
                                    }
                                }
                                if !wear_name.is_empty()
                                    && !full_skin_name.to_lowercase().contains(&wear_name.to_lowercase())
                                {
                                    full_skin_name = format!("{} ({})", full_skin_name, wear_name);
                                }

                                let stickers_json = item_data
                                    .and_then(|i| i.stickers.clone())
                                    .map(|stickers| serde_json::to_value(stickers).unwrap_or(serde_json::json!([])))
                                    .unwrap_or_else(|| serde_json::json!([]));

                                let charms_json = item_data
                                    .and_then(|i| i.keychains.as_ref())
                                    .map(|charms| {
                                        charms.iter().map(|charm| {
                                            serde_json::json!({
                                                "slot": charm.slot,
                                                "name": charm.name,
                                                "pattern": charm.pattern,
                                                "collection": charm.collection,
                                                "icon_url": charm.icon_url,
                                                "reference": charm.reference,
                                                "price": charm.reference.as_ref()
                                                    .and_then(|r| r.price)
                                                    .map(|cents| cents as f64 / 100.0),
                                            })
                                        }).collect::<Vec<serde_json::Value>>()
                                    })
                                    .map(serde_json::Value::Array)
                                    .unwrap_or_else(|| serde_json::json!([]));

                                let pattern_value = item_data
                                    .and_then(|i| i.paint_seed.map(serde_json::Value::from))
                                    .or_else(|| item_data.and_then(|i| i.pattern.map(serde_json::Value::from)))
                                    .or_else(|| item_data.and_then(|i| i.keychain_pattern.map(serde_json::Value::from)))
                                    .unwrap_or(serde_json::Value::Null);

                                let reference_data = listing.reference.as_ref().or(listing.reference_alt.as_ref());
                                let reference_json = reference_data.map(|r| serde_json::json!({
                                    "base_price": r.base_price,
                                    "predicted_price": r.predicted_price,
                                })).unwrap_or(serde_json::Value::Null);

                                let blue_container = item_data
                                    .and_then(|i| i.blue_gem.as_ref())
                                    .and_then(|v| v.as_object());
                                let fade_container = item_data
                                    .and_then(|i| i.fade.as_ref())
                                    .and_then(|v| v.as_object());

                                serde_json::json!({
                                    "skin_name": full_skin_name,
                                    "item_name": raw_item_name,
                                    "wear_name": wear_name,
                                    "phase": item_phase,
                                    "created_at": listing.created_at,
                                    "item_id": listing.id,
                                    "item_url": if listing.id.is_empty() { serde_json::Value::Null } else { serde_json::Value::String(format!("https://csfloat.com/item/{}", listing.id)) },
                                    "icon_url": item_data.and_then(|i| i.icon_url.clone()),
                                    "cs2_screenshot_id": item_data.and_then(|i| i.cs2_screenshot_id.clone()),
                                    "price": listing.price.map(|p| p as f64 / 100.0),
                                    "min_offer_price": listing.min_offer_price,
                                    "max_offer_discount": listing.max_offer_discount,
                                    "float": item_data.and_then(|i| i.float_value),
                                    "float_value": item_data.and_then(|i| i.float_value),
                                    "is_stattrak": item_data.and_then(|i| i.is_stattrak),
                                    "is_souvenir": item_data.and_then(|i| i.is_souvenir),
                                    "pattern": pattern_value,
                                    "paint_seed": item_data.and_then(|i| i.paint_seed).or_else(|| item_data.and_then(|i| i.keychain_pattern)),
                                    "paint_index": item_data.and_then(|i| i.paint_index),
                                    "rarity_name": item_data.and_then(|i| i.rarity_name.clone()),
                                    "type_name": item_data.and_then(|i| i.type_name.clone()),
                                    "stickers": stickers_json,
                                    "charms": charms_json,
                                    "reference": reference_json,
                                    "blue_gem": {
                                        "tier": blue_container.and_then(|o| o.get("tier")).and_then(|v| v.as_i64()),
                                        "playside_blue": blue_container.and_then(|o| o.get("playside_blue")).and_then(|v| v.as_f64()).unwrap_or(0.0),
                                        "playside_purple": blue_container.and_then(|o| o.get("playside_purple")).and_then(|v| v.as_f64()).unwrap_or(0.0),
                                        "playside_gold": blue_container.and_then(|o| o.get("playside_gold")).and_then(|v| v.as_f64()).unwrap_or(0.0),
                                        "backside_blue": blue_container.and_then(|o| o.get("backside_blue")).and_then(|v| v.as_f64()).unwrap_or(0.0),
                                        "backside_purple": blue_container.and_then(|o| o.get("backside_purple")).and_then(|v| v.as_f64()).unwrap_or(0.0),
                                        "backside_gold": blue_container.and_then(|o| o.get("backside_gold")).and_then(|v| v.as_f64()).unwrap_or(0.0),
                                    },
                                    "fade": {
                                        "percentage": fade_container.and_then(|o| o.get("percentage")).and_then(|v| v.as_f64()).unwrap_or(0.0),
                                        "rank": fade_container.and_then(|o| o.get("rank")).and_then(|v| v.as_i64()),
                                    },
                                    "badges": item_data.and_then(|i| i.badges.clone()),
                                    "float_rank": item_data.and_then(|i| {
                                        let badges = i.badges.as_ref()?;
                                        if badges.iter().any(|b| b.contains("highest_float")) {
                                            i.high_rank
                                        } else if badges.iter().any(|b| b.contains("lowest_float")) {
                                            i.low_rank
                                        } else {
                                            None
                                        }
                                    }),
                                    "type": listing.r#type.clone(),
                                    "timestamp": Utc::now().to_rfc3339(),
                                })
                            }).collect();
                            new_scanned = push_live_feed_items(feed_items);
                        }

                        // Prune expired seen IDs periodically
                        if scan_count % 50 == 0 {
                            seen_listing_ids.retain(|_, t| t.elapsed().as_secs() < 300);
                        }

                        let mut matched_listings = Vec::new();
                        for listing in &listings {
                            // === DEDUP: Skip already-notified listings (within 300s) ===
                            if seen_listing_ids.get(&listing.id).map(|t| t.elapsed().as_secs() < 300).unwrap_or(false) {
                                continue;
                            }

                            let analysis_start = std::time::Instant::now();
                            let results = analyzer.check_listing(listing);
                            let analysis_delay_ms = analysis_start.elapsed().as_millis() as i64;
                            if results.is_empty() {
                                continue;
                            }
                            matched_listings.push((listing.clone(), results, analysis_delay_ms));
                        }

                        // === MARKET DATA: Fetch sequentially for all matched listings ===
                        let market_data_start = std::time::Instant::now();
                        let mut market_data_map = std::collections::HashMap::new();
                        if let Some(client) = &market_data_client {
                            for (listing, _, _) in &matched_listings {
                                let listing_id = listing.id.clone();
                                let hash_name = listing.item.as_ref()
                                    .and_then(|i| i.market_hash_name.clone())
                                    .unwrap_or_default();
                                
                                if hash_name.is_empty() {
                                    market_data_map.insert(listing_id, crate::market_data::MarketDataResult { highest_buy_order: None, lowest_market_price: None });
                                } else {
                                    if client.is_rate_limited() {
                                        tracing::warn!("Skipping market data fetch for listing {} because all market accounts are rate limited", listing_id);
                                        break;
                                    }
                                    let res = client.fetch_market_data_async(&listing_id, &hash_name).await;
                                    market_data_map.insert(listing_id, res);
                                }
                            }
                        }
                        let market_data_delay_ms = if market_data_client.is_some() {
                            market_data_start.elapsed().as_millis() as i64
                        } else {
                            0
                        };

                        for (listing, results, analysis_delay_ms) in matched_listings {
                            total_matches += results.len();

                            // Mark seen BEFORE processing to avoid re-entry on fast re-scans
                            seen_listing_ids.insert(listing.id.clone(), std::time::Instant::now());

                            let listing_price = listing.price.unwrap_or(0) as f64 / 100.0;
                            let market_data = market_data_map.get(&listing.id);

                            // Calculate listing age ONCE per listing
                            let listing_age_secs: f64 = listing.created_at.as_deref()
                                .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
                                .map(|dt| {
                                    let now = chrono::Utc::now();
                                    let created = dt.with_timezone(&chrono::Utc);
                                    (now - created).num_milliseconds() as f64 / 1000.0
                                })
                                .unwrap_or(0.0);

                            let item_name = listing
                                .item
                                .as_ref()
                                .and_then(|i| i.item_name.as_deref())
                                .unwrap_or("Unknown");

                            for mut result in results {
                                let target = analyzer.targets.iter().find(|t| t.id == result.target_id);
                                let Some(target) = target else {
                                    continue;
                                };

                                let mut passes_dynamic_checks = true;

                                // Zero-price dynamic check.
                                if result.check_zero_price {
                                    let reference = listing.reference.as_ref().or(listing.reference_alt.as_ref());
                                    let api_predicted = reference
                                        .and_then(|r| r.predicted_price)
                                        .map(|v| v as f64 / 100.0)
                                        .unwrap_or(0.0);
                                    let api_base = reference
                                        .and_then(|r| r.base_price)
                                        .map(|v| v as f64 / 100.0)
                                        .unwrap_or(0.0);
                                    let fallback_predicted = market_data
                                        .as_ref()
                                        .and_then(|m| m.highest_buy_order.as_ref())
                                        .map(|b| b.price)
                                        .unwrap_or(0.0);

                                    let base_price = if api_predicted > 0.0 {
                                        api_predicted
                                    } else if api_base > 0.0 {
                                        api_base
                                    } else {
                                        fallback_predicted
                                    };

                                    if base_price == 0.0 || (listing_price - base_price).abs() >= 0.01 {
                                        passes_dynamic_checks = false;
                                    }
                                }

                                // Buy-order discount/overpay dynamic check.
                                if passes_dynamic_checks && result.check_discount_overpay {
                                    let buy_order_price = market_data
                                        .as_ref()
                                        .and_then(|m| m.highest_buy_order.as_ref())
                                        .map(|b| b.price)
                                        .unwrap_or(0.0);

                                    if buy_order_price <= 0.0 || listing_price <= 0.0 {
                                        passes_dynamic_checks = false;
                                    } else {
                                        let diff_dollars = listing_price - buy_order_price;
                                        let diff_percent = (diff_dollars / buy_order_price) * 100.0;
                                        let min_v = target.discount_overpay_min.unwrap_or(f64::NEG_INFINITY);
                                        let max_v = target.discount_overpay_max.unwrap_or(f64::INFINITY);
                                        if !(min_v <= diff_percent && diff_percent <= max_v) {
                                            passes_dynamic_checks = false;
                                        }
                                    }
                                }

                                // Charm-profit calculation and dynamic check.
                                let has_charms = listing
                                    .item
                                    .as_ref()
                                    .and_then(|i| i.keychains.as_ref())
                                    .map(|k| !k.is_empty())
                                    .unwrap_or(false);

                                if has_charms && listing_price > 0.0 {
                                    let reference_price = if target.charm_profit_use_lowest_price {
                                        market_data.as_ref().and_then(|m| m.lowest_market_price).unwrap_or(0.0)
                                    } else {
                                        market_data
                                            .as_ref()
                                            .and_then(|m| m.highest_buy_order.as_ref())
                                            .map(|b| b.price)
                                            .unwrap_or(0.0)
                                    };

                                    if reference_price > 0.0 {
                                        let charm_profit_dollars = reference_price + result.charms_total_price - listing_price;
                                        let charm_profit_percent = (charm_profit_dollars / listing_price) * 100.0;

                                        result.matched_filters.insert("charm_profit_percent".to_string(), serde_json::Value::from(charm_profit_percent));
                                        result.matched_filters.insert("charm_profit_dollars".to_string(), serde_json::Value::from(charm_profit_dollars));

                                        if passes_dynamic_checks && result.check_charm_profit {
                                            if charm_profit_percent < target.charm_profit_min
                                                || charm_profit_percent > target.charm_profit_max
                                            {
                                                passes_dynamic_checks = false;
                                            } else {
                                                result.matched_filters.insert("charm_profit".to_string(), serde_json::Value::Bool(true));
                                            }
                                        }
                                    } else if passes_dynamic_checks && result.check_charm_profit {
                                        passes_dynamic_checks = false;
                                    }
                                } else if passes_dynamic_checks && result.check_charm_profit {
                                    passes_dynamic_checks = false;
                                }

                                if !passes_dynamic_checks {
                                    continue;
                                }

                                let processing_ms = scan_receive_time.elapsed().as_millis();

                                add_log(&format!(
                                    "MATCH: {} | action={} | reason={} | listing_age={:.1}s | processing={}ms",
                                    item_name, result.action, result.reason,
                                    listing_age_secs, processing_ms
                                ));

                                tracing::info!(
                                    "MATCH: {} | action={} | listing_age={:.1}s | processing={}ms",
                                    item_name, result.action, listing_age_secs, processing_ms
                                );

                                {
                                    let mut s = stats_ref.lock().unwrap();
                                    s.matches_found += 1;
                                    let proc_ms = processing_ms as i32;
                                    s.last_matched_processing_ms = Some(proc_ms);
                                }

                                // === WEB NOTIFICATION (in-memory store for React SPA) ===
                                {
                                    let item_data = listing.item.as_ref();
                                    let raw_item_name = item_data
                                        .and_then(|i| i.item_name.clone())
                                        .unwrap_or_else(|| "Unknown Skin".to_string());
                                    let wear_name = item_data
                                        .and_then(|i| i.wear_name.clone())
                                        .unwrap_or_default();
                                    let item_phase = item_data
                                        .and_then(|i| i.phase.clone().or(i.phase_name.clone()));

                                    let mut full_skin_name = raw_item_name.clone();
                                    if let Some(phase) = &item_phase {
                                        if !full_skin_name.to_lowercase().contains(&phase.to_lowercase()) {
                                            full_skin_name = format!("{} ({})", full_skin_name, phase);
                                        }
                                    }
                                    if !wear_name.is_empty()
                                        && !full_skin_name.to_lowercase().contains(&wear_name.to_lowercase())
                                    {
                                        full_skin_name = format!("{} ({})", full_skin_name, wear_name);
                                    }

                                    let blue_container = item_data
                                        .and_then(|i| i.blue_gem.as_ref())
                                        .and_then(|v| v.as_object());
                                    let fade_container = item_data
                                        .and_then(|i| i.fade.as_ref())
                                        .and_then(|v| v.as_object());

                                    let playside_blue = if result.playside_blue > 0.0 {
                                        result.playside_blue
                                    } else {
                                        blue_container
                                            .and_then(|o| o.get("playside_blue"))
                                            .and_then(|v| v.as_f64())
                                            .unwrap_or(0.0)
                                    };
                                    let backside_blue = blue_container
                                        .and_then(|o| o.get("backside_blue"))
                                        .and_then(|v| v.as_f64())
                                        .unwrap_or(0.0);
                                    let fade_percentage = fade_container
                                        .and_then(|o| o.get("percentage"))
                                        .and_then(|v| v.as_f64())
                                        .unwrap_or(0.0);
                                    let fade_rank = fade_container
                                        .and_then(|o| o.get("rank"))
                                        .and_then(|v| v.as_i64());

                                    let listing_id = listing.id.clone();
                                    let config_name = target.config_name.clone();
                                    let mode = target.mode.clone();
                                    let passed_filters = extract_passed_filters(&result);

                                    let mut message_parts = vec![full_skin_name.clone()];
                                    if !passed_filters.is_empty() {
                                        message_parts.push(format!("Filters: {}", passed_filters.join(", ")));
                                    }

                                    let stickers_json = item_data
                                        .and_then(|i| i.stickers.clone())
                                        .map(|stickers| serde_json::to_value(stickers).unwrap_or(serde_json::json!([])))
                                        .unwrap_or_else(|| serde_json::json!([]));

                                    let charms_json = item_data
                                        .and_then(|i| i.keychains.as_ref())
                                        .map(|charms| {
                                            charms
                                                .iter()
                                                .map(|charm| {
                                                    serde_json::json!({
                                                        "slot": charm.slot,
                                                        "name": charm.name,
                                                        "pattern": charm.pattern,
                                                        "collection": charm.collection,
                                                        "icon_url": charm.icon_url,
                                                        "reference": charm.reference,
                                                        "price": charm
                                                            .reference
                                                            .as_ref()
                                                            .and_then(|r| r.price)
                                                            .map(|cents| cents as f64 / 100.0),
                                                    })
                                                })
                                                .collect::<Vec<serde_json::Value>>()
                                        })
                                        .map(serde_json::Value::Array)
                                        .unwrap_or_else(|| serde_json::json!([]));

                                    let pattern_value = item_data
                                        .and_then(|i| i.paint_seed.map(serde_json::Value::from))
                                        .or_else(|| item_data.and_then(|i| i.pattern.map(serde_json::Value::from)))
                                        .or_else(|| item_data.and_then(|i| i.keychain_pattern.map(serde_json::Value::from)))
                                        .unwrap_or(serde_json::Value::Null);

                                    let notif_type = if mode != "Notify Only" { "autobuy" } else { "success" };
                                    let notif_source = "scanner";
                                    let title = format!("🎯 Match Found [{}]", config_name);
                                    let msg = message_parts.join(" | ");
                                    let reference_data = listing.reference.as_ref().or(listing.reference_alt.as_ref());
                                    let reference_json = reference_data.map(|r| serde_json::json!({
                                        "base_price": r.base_price,
                                        "predicted_price": r.predicted_price,
                                    })).unwrap_or(serde_json::Value::Null);

                                    let notif_data = serde_json::json!({
                                        "skin_name": full_skin_name,
                                        "item_name": raw_item_name,
                                        "wear_name": wear_name,
                                        "phase": item_phase,
                                        "created_at": listing.created_at,
                                        "item_id": listing_id,
                                        "item_url": if listing.id.is_empty() { serde_json::Value::Null } else { serde_json::Value::String(format!("https://csfloat.com/item/{}", listing.id)) },
                                        "icon_url": item_data.and_then(|i| i.icon_url.clone()),
                                        "cs2_screenshot_id": item_data.and_then(|i| i.cs2_screenshot_id.clone()),
                                        "price": listing.price.map(|p| p as f64 / 100.0),
                                        "min_offer_price": listing.min_offer_price,
                                        "max_offer_discount": listing.max_offer_discount,
                                        "config_name": config_name,
                                        "mode": mode,
                                        "filters_passed": passed_filters,
                                        "matched_filters": result.matched_filters.clone(),
                                        "float": item_data.and_then(|i| i.float_value),
                                        "float_value": item_data.and_then(|i| i.float_value),
                                        "is_stattrak": item_data.and_then(|i| i.is_stattrak),
                                        "is_souvenir": item_data.and_then(|i| i.is_souvenir),
                                        "pattern": pattern_value,
                                        "paint_seed": item_data.and_then(|i| i.paint_seed).or_else(|| item_data.and_then(|i| i.keychain_pattern)),
                                        "paint_index": item_data.and_then(|i| i.paint_index),
                                        "rarity_name": item_data.and_then(|i| i.rarity_name.clone()).or_else(|| target.rarity_name.clone()),
                                        "blue_gem_tier": result.blue_gem_tier,
                                        "playside_blue": playside_blue,
                                        "backside_blue": backside_blue,
                                        "blue_gem": {
                                            "tier": result.blue_gem_tier,
                                            "playside_blue": playside_blue,
                                            "backside_blue": backside_blue,
                                        },
                                        "fade_percentage": fade_percentage,
                                        "fade_rank": fade_rank,
                                        "fade": {
                                            "percentage": fade_percentage,
                                            "rank": fade_rank,
                                        },
                                        "stickers": stickers_json,
                                        "stickers_price_percent": result.stickers_price_percent,
                                        "charms": charms_json,
                                        "reference": reference_json,
                                        "action": result.action.clone(),
                                        "reason": result.reason.clone(),
                                    });
                                    push_web_notification(notif_type, notif_source, &title, &msg, Some(notif_data));
                                }

                                // === PARALLEL NOTIFICATIONS: Fire and forget (Only if NOT buy action) ===
                                if result.action != "buy" {
                                    if target.notifications_enabled {
                                        if let Some(notifier) = &notifier {
                                            let n = notifier.clone();
                                            let listing_clone = listing.clone();
                                            let target_clone = target.clone();
                                            let market_data_clone = market_data.cloned();
                                            let matched_filters_clone = result.matched_filters.clone();
                                            let item_name_str = item_name.to_string();
                                            let listing_age = listing_age_secs;
                                            let float_rank_clone = result.float_rank.clone();
                                            tokio::spawn(async move {
                                                let notify_start = std::time::Instant::now();
                                                n.send_listing_notification(
                                                    &listing_clone,
                                                    &target_clone,
                                                    market_data_clone.as_ref(),
                                                    &matched_filters_clone,
                                                    result.blue_gem_tier,
                                                    float_rank_clone.as_deref(),
                                                    result.stickers_price_percent,
                                                    None,
                                                ).await;
                                                tracing::info!(
                                                    "[Notifier] Notification sent | item={} | listing_age={:.1}s | notify_time={}ms",
                                                    item_name_str, listing_age, notify_start.elapsed().as_millis()
                                                );
                                            });
                                        }
                                    }

                                    let price = listing.price.unwrap_or(0) as f64 / 100.0;
                                    let float_value = listing.item.as_ref().and_then(|i| i.float_value);
                                    let _ = sqlx::query(
                                        "INSERT OR IGNORE INTO sales_history (asset_id, item_name, price, float_value, purchased) VALUES (?, ?, ?, ?, ?)"
                                    )
                                    .bind(&listing.id)
                                    .bind(item_name)
                                    .bind(price)
                                    .bind(float_value)
                                    .bind(false)
                                    .execute(&db)
                                    .await;
                                } else {
                                    // === ASYNCHRONOUS AUTO-BUY ===
                                    let client = scanner.sniper_client.clone();
                                    let api_key = scanner.sniper_api_key.clone();
                                    let listing_id = listing.id.clone();
                                    let total_price = listing.price.unwrap_or(0) as i32;
                                    let item_name_str = item_name.to_string();
                                    let config_name = target.config_name.clone();
                                    let stats_ref_clone = stats_ref.clone();
                                    let db_clone = db.clone();
                                    let notifier_clone = notifier.clone();
                                    let listing_clone = listing.clone();
                                    let target_clone = target.clone();
                                    let market_data_clone = market_data.cloned();
                                    let matched_filters_clone = result.matched_filters.clone();
                                    let blue_gem_tier = result.blue_gem_tier;
                                    let float_rank_clone = result.float_rank.clone();
                                    let stickers_price_percent = result.stickers_price_percent;

                                    tokio::spawn(async move {
                                        // Update buy attempts stats
                                        {
                                            let mut st = stats_ref_clone.lock().unwrap();
                                            st.buy_attempts += 1;
                                        }

                                        let buy_req_start = std::time::Instant::now();
                                        let res = if let Some(client) = client {
                                            let url = "https://csfloat.com/api/v1/listings/buy";
                                            let body = serde_json::json!({
                                                "total_price": total_price,
                                                "contract_ids": vec![listing_id.clone()]
                                            });

                                            let mut req = client.post(url).json(&body);
                                            if let Some(key) = &api_key {
                                                if !key.is_empty() {
                                                    req = req.header("Authorization", key);
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
                                                Err(e) => Err(format!("Network error: {}", e))
                                            }
                                        } else {
                                            Err("Sniper client not initialized".to_string())
                                        };
                                        let purchase_delay_ms = buy_req_start.elapsed().as_millis() as i64;
                                        let total_delay_ms = api_fetch_delay_ms + analysis_delay_ms + market_data_delay_ms + purchase_delay_ms;
                                        let detection_delay_ms = (listing_age_secs * 1000.0) as i64;

                                        match res {
                                            Ok(_) => {
                                                tracing::info!("AUTO-BUY SUCCESS: item={}, listing_id={}, price={}", item_name_str, listing_id, total_price);
                                                add_log(&format!("✅ AUTO-BUY SUCCESS: {} (ID: {}) for ${:.2}", item_name_str, listing_id, total_price as f64 / 100.0));

                                                {
                                                    let mut st = stats_ref_clone.lock().unwrap();
                                                    st.successful_buys += 1;
                                                    st.avg_speed = total_delay_ms as i32;
                                                }

                                                let float_val = listing_clone.item.as_ref().and_then(|i| i.float_value);
                                                push_web_notification(
                                                    "autobuy",
                                                    "autobuy",
                                                    "✅ Purchase Successful!",
                                                    &format!("{} bought for ${:.2}", item_name_str, total_price as f64 / 100.0),
                                                    Some(serde_json::json!({
                                                        "item_id": listing_id,
                                                        "price": total_price as f64 / 100.0,
                                                        "float": float_val,
                                                    })),
                                                );

                                                // Send target bot listing notification (purchase_mode = Some("auto"))
                                                if target_clone.notifications_enabled {
                                                    if let Some(n) = &notifier_clone {
                                                        n.send_listing_notification(
                                                            &listing_clone,
                                                            &target_clone,
                                                            market_data_clone.as_ref(),
                                                            &matched_filters_clone,
                                                            blue_gem_tier,
                                                            float_rank_clone.as_deref(),
                                                            stickers_price_percent,
                                                            Some("auto")
                                                        ).await;
                                                    }
                                                }

                                                // Record to sales_history
                                                let _ = sqlx::query(
                                                    "INSERT OR IGNORE INTO sales_history (asset_id, item_name, price, float_value, purchased) VALUES (?, ?, ?, ?, ?)"
                                                )
                                                .bind(&listing_id)
                                                .bind(&item_name_str)
                                                .bind(total_price as f64 / 100.0)
                                                .bind(listing_clone.item.as_ref().and_then(|i| i.float_value))
                                                .bind(true)
                                                .execute(&db_clone)
                                                .await;

                                                // Record latency to DB
                                                let _ = sqlx::query(
                                                    "INSERT INTO purchase_latencies 
                                                     (item_id, item_name, purchase_type, api_fetch_delay_ms, analysis_delay_ms, 
                                                      market_data_delay_ms, purchase_delay_ms, total_delay_ms, detection_delay_ms, status, timestamp) 
                                                     VALUES (?, ?, 'auto', ?, ?, ?, ?, ?, ?, 'success', ?)"
                                                )
                                                .bind(&listing_id)
                                                .bind(&item_name_str)
                                                .bind(api_fetch_delay_ms)
                                                .bind(analysis_delay_ms)
                                                .bind(market_data_delay_ms)
                                                .bind(purchase_delay_ms)
                                                .bind(total_delay_ms)
                                                .bind(detection_delay_ms)
                                                .bind(chrono::Utc::now().to_rfc3339())
                                                .execute(&db_clone)
                                                .await;
                                            }
                                            Err(err_reason) => {
                                                tracing::error!("AUTO-BUY FAILED: item={}, listing_id={}, reason={}", item_name_str, listing_id, err_reason);
                                                add_log(&format!("❌ AUTO-BUY FAILED: {} (ID: {}) | Reason: {}", item_name_str, listing_id, err_reason));

                                                {
                                                    let mut st = stats_ref_clone.lock().unwrap();
                                                    st.failed_buys += 1;
                                                }

                                                push_web_notification(
                                                    "error",
                                                    "autobuy",
                                                    "❌ Purchase Failed",
                                                    &format!("Failed to buy {}: {}", item_name_str, err_reason),
                                                    Some(serde_json::json!({
                                                        "item_id": listing_id,
                                                        "price": total_price as f64 / 100.0,
                                                        "error": err_reason,
                                                    })),
                                                );

                                                // Send main (technical) bot failure message
                                                if let Some(n) = &notifier_clone {
                                                    let alert_msg = format!(
                                                        "⚠️ *AUTO-BUY FAILED* ⚠️\n\n🎯 *Target Config:* {}\n📦 *Item:* {}\n💰 *Price:* `${:.2}`\n❌ *Reason:* {}",
                                                        config_name,
                                                        item_name_str,
                                                        total_price as f64 / 100.0,
                                                        err_reason
                                                    );
                                                    n.send_message(&alert_msg).await;
                                                }

                                                // Record to sales_history
                                                let _ = sqlx::query(
                                                    "INSERT OR IGNORE INTO sales_history (asset_id, item_name, price, float_value, purchased) VALUES (?, ?, ?, ?, ?)"
                                                )
                                                .bind(&listing_id)
                                                .bind(&item_name_str)
                                                .bind(total_price as f64 / 100.0)
                                                .bind(listing_clone.item.as_ref().and_then(|i| i.float_value))
                                                .bind(false)
                                                .execute(&db_clone)
                                                .await;

                                                // Record latency to DB
                                                let _ = sqlx::query(
                                                    "INSERT INTO purchase_latencies 
                                                     (item_id, item_name, purchase_type, api_fetch_delay_ms, analysis_delay_ms, 
                                                      market_data_delay_ms, purchase_delay_ms, total_delay_ms, detection_delay_ms, status, timestamp) 
                                                     VALUES (?, ?, 'auto', ?, ?, ?, ?, ?, ?, ?, ?)"
                                                )
                                                .bind(&listing_id)
                                                .bind(&item_name_str)
                                                .bind(api_fetch_delay_ms)
                                                .bind(analysis_delay_ms)
                                                .bind(market_data_delay_ms)
                                                .bind(purchase_delay_ms)
                                                .bind(total_delay_ms)
                                                .bind(detection_delay_ms)
                                                .bind(&err_reason)
                                                .bind(chrono::Utc::now().to_rfc3339())
                                                .execute(&db_clone)
                                                .await;
                                            }
                                        }
                                    });
                                }
                            } // end target loop
                        } // end listings loop
                    }
                    let now_i = std::time::Instant::now();
                    scan_window.push_back((now_i, new_scanned));
                    while let Some(&(t, _)) = scan_window.front() {
                        if now_i.duration_since(t).as_secs() >= 60 {
                            scan_window.pop_front();
                        } else {
                            break;
                        }
                    }
                    let per_min: usize = scan_window.iter().map(|(_, c)| *c).sum();

                    let (scanned_total, matches_found, successful_buys, failed_buys) = {
                        let mut st = stats_ref.lock().unwrap();
                        st.scanned_total += new_scanned;
                        st.scanned_per_min = per_min as i32;
                        (st.scanned_total, st.matches_found, st.successful_buys, st.failed_buys)
                    };
                    push_stats_history(scanned_total, matches_found, successful_buys, failed_buys);
                    if scan_count % 5 == 0 || total_matches > 0 {
                        tracing::info!(
                            "[Scanner] Scan #{}: {} listings, {} analyzer matches, {} targets loaded",
                            scan_count, cnt, total_matches, analyzer.targets.len()
                        );
                    }
                }
                Err(e) => {
                    let err_msg = format!("Scanner Error: {:?}", e);
                    add_log(&err_msg);
                    std::thread::yield_now();
                    tracing::warn!("{}", err_msg);
                }
            }

            let delay = if let (Some(min), Some(max)) = (scanner.settings.poll_interval_min, scanner.settings.poll_interval_max) {
                if min > 0.0 && max >= min {
                    let mut rng = rand::thread_rng();
                    rng.gen_range(min..=max)
                } else {
                    scanner.settings.base_delay.unwrap_or(0.7)
                }
            } else {
                scanner.settings.base_delay.unwrap_or(0.7)
            };
            tokio::time::sleep(std::time::Duration::from_secs_f64(delay)).await;
        }

        tracing::info!("Rust scanner loop exited");
    });

    *state.scanner_abort.lock().unwrap() = Some(task_handle.abort_handle());

    (StatusCode::OK, Json(serde_json::json!({
        "status": "ok",
        "message": "Rust scanner started"
    })))
}

async fn bot_stop(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    cleanup_finished_scanner_task(&state);

    state.scanner_running.store(false, Ordering::SeqCst);
    let handle = state.scanner_abort.lock().unwrap().take();
    *state.scanner_started_at.lock().unwrap() = None;

    push_web_notification(
        "warning",
        "system",
        "🛑 Scanner Stopped",
        "CSFloat Sniper scanner has been stopped.",
        None,
    );

    match handle {
        Some(h) => {
            h.abort();
            (StatusCode::OK, Json(serde_json::json!({ "status": "ok", "message": "Rust scanner stopped" })))
        },
        None => {
            (StatusCode::OK, Json(serde_json::json!({ "status": "ok", "message": "Scanner was not running" })))
        }
    }
}

async fn get_ping_csfloat() -> impl IntoResponse {
    let start_time = std::time::Instant::now();
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .unwrap_or(reqwest::Client::new());
    let latency_ms;
    let ok;
    let status;

    let res = client
        .get("https://csfloat.com/api/v1/listings?limit=1")
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await;

    match res {
        Ok(r) => {
            latency_ms = start_time.elapsed().as_millis() as i32;
            status = r.status().as_u16();
            ok = status == 200 || status == 403 || status == 429 || status == 401;
        }
        Err(_) => {
            ok = false;
            status = 0;
            latency_ms = 0;
        }
    }

    (StatusCode::OK, Json(serde_json::json!({
        "results": [ {
            "name": "CSFloat API",
            "url": "https://csfloat.com/api/v1/listings?limit=1",
            "latency_ms": latency_ms,
            "status": status,
            "ok": ok
        } ]
    })))
}

async fn get_csfloat_balance() -> impl IntoResponse {
    let config_path = crate::config::get_settings_path(None);
    let settings = match crate::config::load_config(&config_path) {
        Ok(s) => s,
        Err(e) => {
            tracing::error!("get_csfloat_balance: Failed to load config from {:?}: {}", config_path, e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": format!("Settings file load error: {}", e)})));
        }
    };

    let mut api_key = None;
    if let Some(auto_buy) = &settings.auto_buy {
        if let Some(acc) = auto_buy.accounts.first() {
            api_key = acc.api_key.clone();
        }
    }
    if api_key.is_none() || api_key.as_deref().unwrap_or("").is_empty() {
        if let Some(scanner) = &settings.scanner {
            if let Some(acc) = scanner.accounts.first() {
                api_key = acc.api_key.clone();
            }
            if api_key.is_none() || api_key.as_deref().unwrap_or("").is_empty() {
                api_key = scanner.api_key.clone();
            }
        }
    }

    let key = match api_key {
        Some(k) if !k.is_empty() => k,
        _ => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"detail": "API Key not configured in any account"}))),
    };

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .unwrap_or(reqwest::Client::new());
    let res = client.get("https://csfloat.com/api/v1/me")
        .header("Authorization", key)
        .header("Content-Type", "application/json")
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await;

    match res {
        Ok(r) if r.status() == 200 => {
            let data: serde_json::Value = r.json().await.unwrap_or(serde_json::json!({}));
            let balance = data.get("user")
                .and_then(|u| u.get("balance"))
                .and_then(|b| b.as_f64())
                .unwrap_or(0.0);
            (StatusCode::OK, Json(serde_json::json!({
                "balance": balance,
                "currency": "USD"
            })))
        }
        Ok(r) => (StatusCode::from_u16(r.status().as_u16()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR), Json(serde_json::json!({"detail": "Failed to fetch balance"}))),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))),
    }
}

async fn get_recent_activity(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let rows = sqlx::query(
        "SELECT item_name, price, float_value, purchased, timestamp FROM sales_history ORDER BY timestamp DESC LIMIT 20"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let items: Vec<serde_json::Value> = rows.iter().map(|r| {
        use sqlx::Row;
        let purchased: bool = r.try_get::<bool, _>("purchased").unwrap_or(false);
        let status = if purchased { "Bought" } else { "Ignored" };
        serde_json::json!({
            "item_name": r.try_get::<String, _>("item_name").unwrap_or_default(),
            "price": r.try_get::<f64, _>("price").unwrap_or(0.0),
            "float_value": r.try_get::<Option<f64>, _>("float_value").unwrap_or(None),
            "status": status,
            "timestamp": r.try_get::<Option<String>, _>("timestamp").unwrap_or(None)
        })
    }).collect();

    (StatusCode::OK, Json(serde_json::json!({ "items": items })))
}

async fn get_accounts_status(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let guard = state.account_statuses.lock().unwrap();
    (StatusCode::OK, Json(guard.clone()))
}

#[derive(Deserialize)]
struct ProxyPoolsQuery {
    profile: Option<String>,
}

async fn get_proxy_pools(Query(query): Query<ProxyPoolsQuery>) -> impl IntoResponse {
    let path = resolve_settings_file(query.profile.as_ref());
    let settings = match crate::config::load_config(&path) {
        Ok(s) => s,
        Err(_) => return (StatusCode::OK, Json(serde_json::json!({ "accounts": [] }))),
    };

    let mut accounts: Vec<serde_json::Value> = Vec::new();

    let add_accounts = |accounts: &mut Vec<serde_json::Value>, accs: &[crate::config::Account], account_type: &str| {
        for (i, acc) in accs.iter().enumerate() {
            accounts.push(serde_json::json!({
                "account_type": account_type,
                "index": i,
                "api_key": acc.api_key.as_deref().unwrap_or("").chars().take(10).collect::<String>() + "...",
                "current_proxy": acc.proxy.as_deref().unwrap_or(""),
                "backup_ips": acc.backup_ips,
                "enabled": acc.enabled
            }));
        }
    };

    if let Some(scanner) = &settings.scanner {
        add_accounts(&mut accounts, &scanner.accounts, "scanner");
    }
    if let Some(market) = &settings.market_data {
        add_accounts(&mut accounts, &market.accounts, "market_data");
    }
    if let Some(auto_buy) = &settings.auto_buy {
        add_accounts(&mut accounts, &auto_buy.accounts, "auto_buy");
    }

    (StatusCode::OK, Json(serde_json::json!({ "accounts": accounts })))
}


#[derive(Deserialize)]
struct AccountTestQuery {
    account_type: String,
    index: usize,
}

/// Live-test a single account (make a CSFloat /me request with its key + proxy) and record the status.
async fn test_account(State(state): State<Arc<AppState>>, Query(q): Query<AccountTestQuery>) -> impl IntoResponse {
    let settings = match crate::config::load_config(&crate::config::get_settings_path(None)) {
        Ok(s) => s,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "detail": e.to_string() }))),
    };
    let account = match q.account_type.as_str() {
        "scanner" => settings.scanner.as_ref().and_then(|s| s.accounts.get(q.index)).cloned(),
        "market_data" => settings.market_data.as_ref().and_then(|s| s.accounts.get(q.index)).cloned(),
        "auto_buy" => settings.auto_buy.as_ref().and_then(|s| s.accounts.get(q.index)).cloned(),
        _ => None,
    };
    let account = match account {
        Some(a) => a,
        None => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "detail": "account not found" }))),
    };
    if !account.enabled {
        let now = chrono::Utc::now().timestamp_millis();
        let mut guard = state.account_statuses.lock().unwrap();
        if !guard.get(q.account_type.as_str()).map(|g| g.is_object()).unwrap_or(false) {
            guard[q.account_type.as_str()] = serde_json::json!({});
        }
        guard[q.account_type.as_str()][q.index.to_string().as_str()] =
            serde_json::json!({ "status_code": 0, "error": "disabled", "last_updated": now, "enabled": false });
        return (StatusCode::OK, Json(serde_json::json!({ "status_code": 0, "enabled": false })));
    }
    let key = account.api_key.clone().unwrap_or_default();
    if key.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "detail": "no api key" })));
    }

    let mut builder = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    if let Some(p) = account.proxy.as_ref() {
        if !p.is_empty() {
            if let Ok(proxy) = reqwest::Proxy::all(&crate::config::normalize_proxy(p)) {
                builder = builder.proxy(proxy);
            }
        }
    }
    let client = builder.build().unwrap_or_else(|_| reqwest::Client::new());
    let code: u16 = match client.get("https://csfloat.com/api/v1/me").header("Authorization", &key).send().await {
        Ok(r) => r.status().as_u16(),
        Err(_) => 503,
    };

    {
        let now = chrono::Utc::now().timestamp_millis();
        let mut guard = state.account_statuses.lock().unwrap();
        if !guard.get(q.account_type.as_str()).map(|g| g.is_object()).unwrap_or(false) {
            guard[q.account_type.as_str()] = serde_json::json!({});
        }
        guard[q.account_type.as_str()][q.index.to_string().as_str()] =
            serde_json::json!({ "status_code": code, "error": "", "last_updated": now, "enabled": true });
    }

    if code == 429 {
        let title = if q.account_type == "market_data" { "🚫 RATE LIMIT (Market Data) 🚫" } else { "🚫 RATE LIMIT 🚫" };
        push_web_notification(
            "warning",
            &q.account_type,
            title,
            &format!("🔌 Account: #{} | ⏳ Cooldown: 60s | 📝 Details: CSFloat API 429 Too Many Requests (Account Test)", q.index + 1),
            Some(serde_json::json!({
                "account_index": q.index,
                "account_type": q.account_type,
                "status_code": 429,
                "cooldown_secs": 60
            })),
        );
    }

    (StatusCode::OK, Json(serde_json::json!({ "status_code": code, "enabled": true })))
}

/// Live-test every configured enabled account concurrently and record their statuses.
async fn test_all_accounts(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let settings = match crate::config::load_config(&crate::config::get_settings_path(None)) {
        Ok(s) => s,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "detail": e.to_string() }))),
    };
    let mut jobs: Vec<(&'static str, usize, String, Option<String>)> = Vec::new();
    let mut disabled_jobs: Vec<(&'static str, usize)> = Vec::new();

    let collect = |group: &'static str, accounts: &Vec<crate::config::Account>, jobs: &mut Vec<(&'static str, usize, String, Option<String>)>, disabled: &mut Vec<(&'static str, usize)>| {
        for (i, a) in accounts.iter().enumerate() {
            if !a.enabled {
                disabled.push((group, i));
            } else if let Some(k) = &a.api_key {
                if !k.is_empty() {
                    jobs.push((group, i, k.clone(), a.proxy.clone()));
                } else {
                    disabled.push((group, i));
                }
            } else {
                disabled.push((group, i));
            }
        }
    };
    if let Some(s) = &settings.scanner { collect("scanner", &s.accounts, &mut jobs, &mut disabled_jobs); }
    if let Some(s) = &settings.market_data { collect("market_data", &s.accounts, &mut jobs, &mut disabled_jobs); }
    if let Some(s) = &settings.auto_buy { collect("auto_buy", &s.accounts, &mut jobs, &mut disabled_jobs); }

    let futs = jobs.into_iter().map(|(group, i, key, proxy)| async move {
        let mut b = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
        if let Some(p) = &proxy {
            if !p.is_empty() {
                if let Ok(px) = reqwest::Proxy::all(&crate::config::normalize_proxy(p)) { b = b.proxy(px); }
            }
        }
        let client = b.build().unwrap_or_else(|_| reqwest::Client::new());
        let code: u16 = match client.get("https://csfloat.com/api/v1/me").header("Authorization", &key).send().await {
            Ok(r) => r.status().as_u16(),
            Err(_) => 503,
        };
        (group, i, code)
    });

    let results = futures::future::join_all(futs).await;
    let now = chrono::Utc::now().timestamp_millis();
    {
        let mut guard = state.account_statuses.lock().unwrap();
        for (group, i, code) in results {
            if !guard.get(group).map(|g| g.is_object()).unwrap_or(false) {
                guard[group] = serde_json::json!({});
            }
            guard[group][i.to_string().as_str()] =
                serde_json::json!({ "status_code": code, "error": "", "last_updated": now, "enabled": true });

            if code == 429 {
                let title = if group == "market_data" { "🚫 RATE LIMIT (Market Data) 🚫" } else { "🚫 RATE LIMIT 🚫" };
                push_web_notification(
                    "warning",
                    group,
                    title,
                    &format!("🔌 Account: #{} | ⏳ Cooldown: 60s | 📝 Details: CSFloat API 429 Too Many Requests", i + 1),
                    Some(serde_json::json!({
                        "account_index": i,
                        "account_type": group,
                        "status_code": 429,
                        "cooldown_secs": 60
                    })),
                );
            }
        }
        for (group, i) in disabled_jobs {
            if !guard.get(group).map(|g| g.is_object()).unwrap_or(false) {
                guard[group] = serde_json::json!({});
            }
            guard[group][i.to_string().as_str()] =
                serde_json::json!({ "status_code": 0, "error": "disabled", "last_updated": now, "enabled": false });
        }
    }

    (StatusCode::OK, Json(serde_json::json!({ "status": "ok" })))
}

async fn get_live_stats(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let stats = state.live_stats.lock().unwrap().clone();
    (StatusCode::OK, Json(serde_json::json!(stats)))
}

static STATS_HISTORY: std::sync::OnceLock<Mutex<std::collections::VecDeque<serde_json::Value>>> =
    std::sync::OnceLock::new();

fn stats_history() -> &'static Mutex<std::collections::VecDeque<serde_json::Value>> {
    STATS_HISTORY.get_or_init(|| Mutex::new(std::collections::VecDeque::with_capacity(3700)))
}

fn push_stats_history(scanned: usize, matches: usize, buys: usize, failed: usize) {
    let t = chrono::Utc::now().timestamp_millis();
    let mut h = stats_history().lock().unwrap();
    h.push_back(serde_json::json!({ "t": t, "scanned": scanned, "matches": matches, "buys": buys, "failed": failed }));
    while h.len() > 3600 {
        h.pop_front();
    }
}

async fn get_stats_history() -> impl IntoResponse {
    let samples: Vec<serde_json::Value> = stats_history().lock().unwrap().iter().cloned().collect();
    (StatusCode::OK, Json(serde_json::json!({ "samples": samples })))
}

async fn get_logs() -> impl IntoResponse {
    let logs = if let Some(mtx) = LOG_BUFFER.get() {
        mtx.lock().unwrap().clone()
    } else {
        vec![]
    };
    (StatusCode::OK, Json(serde_json::json!({ "logs": logs })))
}

// ===========================================
// NOTIFICATIONS — real in-memory store
// ===========================================

#[derive(Deserialize)]
struct NotifQuery {
    limit: Option<usize>,
}

async fn get_notifications(Query(q): Query<NotifQuery>) -> impl IntoResponse {
    let limit = q.limit.unwrap_or(100);
    let store = notif_store().lock().unwrap();
    let slice: Vec<WebNotification> = store.iter().take(limit).cloned().collect();
    (StatusCode::OK, Json(serde_json::to_value(slice).unwrap()))
}

async fn post_notification(
    Json(payload): Json<serde_json::Value>,
) -> impl IntoResponse {
    let notif_type = payload.get("type").and_then(|v| v.as_str()).unwrap_or("info");
    let source    = payload.get("source").and_then(|v| v.as_str()).unwrap_or("system");
    let title     = payload.get("title").and_then(|v| v.as_str()).unwrap_or("");
    let message   = payload.get("message").and_then(|v| v.as_str()).unwrap_or("");
    let data      = payload.get("data").cloned();
    push_web_notification(notif_type, source, title, message, data);
    (StatusCode::OK, Json(serde_json::json!({ "status": "ok" })))
}

async fn delete_all_notifications() -> impl IntoResponse {
    notif_store().lock().unwrap().clear();
    (StatusCode::OK, Json(serde_json::json!({ "status": "ok" })))
}

async fn delete_notification(
    AxumPath(id): AxumPath<String>,
) -> impl IntoResponse {
    notif_store().lock().unwrap().retain(|n| n.id != id);
    (StatusCode::OK, Json(serde_json::json!({ "status": "ok" })))
}

async fn mark_notification_read(
    AxumPath(id): AxumPath<String>,
) -> impl IntoResponse {
    let mut store = notif_store().lock().unwrap();
    if let Some(n) = store.iter_mut().find(|n| n.id == id) {
        n.read = true;
    }
    (StatusCode::OK, Json(serde_json::json!({ "status": "ok" })))
}

async fn mark_all_notifications_read() -> impl IntoResponse {
    let mut store = notif_store().lock().unwrap();
    for n in store.iter_mut() {
        n.read = true;
    }
    (StatusCode::OK, Json(serde_json::json!({ "status": "ok" })))
}

// ===========================================
// LIVE FEED — all scanned items (not just matches)
// ===========================================

#[derive(Deserialize)]
struct LiveFeedQuery {
    limit: Option<usize>,
}

async fn get_live_feed(Query(q): Query<LiveFeedQuery>) -> impl IntoResponse {
    let limit = q.limit.unwrap_or(200);
    let store = live_feed_store().lock().unwrap();
    let slice: Vec<serde_json::Value> = store.iter().take(limit).cloned().collect();
    (StatusCode::OK, Json(slice))
}

async fn post_live_feed(
    Json(payload): Json<serde_json::Value>,
) -> impl IntoResponse {
    let items = if let Some(arr) = payload.as_array() {
        arr.clone()
    } else {
        vec![payload]
    };
    push_live_feed_items(items);
    (StatusCode::OK, Json(serde_json::json!({ "status": "ok" })))
}

async fn get_live_feed_stream() -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let rx = live_feed_tx().subscribe();
    let stream = BroadcastStream::new(rx).filter_map(|res| async move {
        match res {
            Ok(items) => {
                if let Ok(json) = serde_json::to_string(&items) {
                    Some(Ok(Event::default().data(json)))
                } else {
                    None
                }
            }
            Err(_) => None,
        }
    });

    Sse::new(stream).keep_alive(axum::response::sse::KeepAlive::new())
}

fn live_monitor_state_file() -> std::path::PathBuf {
    std::path::PathBuf::from("../data/live_monitor_state.json")
}

fn default_live_monitor_state() -> serde_json::Value {
    serde_json::json!({
        "items": [],
        "watchlist": [],
        "soldItems": []
    })
}

async fn get_live_monitor_state() -> impl IntoResponse {
    let path = live_monitor_state_file();
    let state = std::fs::read_to_string(&path)
        .ok()
        .and_then(|raw| serde_json::from_str::<serde_json::Value>(&raw).ok())
        .unwrap_or_else(default_live_monitor_state);

    (StatusCode::OK, Json(state))
}

async fn save_live_monitor_state(
    Json(payload): Json<serde_json::Value>,
) -> impl IntoResponse {
    if !payload.is_object() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Payload must be a JSON object" })),
        );
    }

    let path = live_monitor_state_file();
    if let Some(parent) = path.parent() {
        if let Err(e) = std::fs::create_dir_all(parent) {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": format!("Failed to create data directory: {}", e) })),
            );
        }
    }

    let to_save = serde_json::json!({
        "items": payload.get("items").cloned().unwrap_or_else(|| serde_json::json!([])),
        "watchlist": payload.get("watchlist").cloned().unwrap_or_else(|| serde_json::json!([])),
        "soldItems": payload.get("soldItems").cloned().unwrap_or_else(|| serde_json::json!([])),
        "updatedAt": Utc::now().to_rfc3339(),
    });

    let serialized = match serde_json::to_string_pretty(&to_save) {
        Ok(s) => s,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": format!("Failed to serialize state: {}", e) })),
            )
        }
    };

    match std::fs::write(&path, serialized) {
        Ok(_) => (StatusCode::OK, Json(serde_json::json!({ "status": "ok" }))),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": format!("Failed to persist live monitor state: {}", e) })),
        ),
    }
}

#[derive(Deserialize)]
struct WatchlistMarketCheckItem {
    id: String,
    market_hash_name: Option<String>,
    name: Option<String>,
    old_listing_price: Option<f64>,
    new_listing_price: Option<f64>,
}

#[derive(Deserialize)]
struct WatchlistMarketCheckPayload {
    items: Vec<WatchlistMarketCheckItem>,
    profile: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Default)]
struct StoredWatchlistMarketItem {
    id: String,
    name: Option<String>,
    market_hash_name: Option<String>,
    old_listing_price: Option<f64>,
    #[serde(alias = "listing_price")]
    new_listing_price: Option<f64>,
    highest_buy_order: Option<f64>,
    lowest_market_price: Option<f64>,
    checked_at: String,
}

fn watchlist_market_state_file() -> std::path::PathBuf {
    std::path::PathBuf::from("../data/watchlist_market_state.json")
}

fn load_watchlist_market_state() -> HashMap<String, StoredWatchlistMarketItem> {
    let path = watchlist_market_state_file();
    std::fs::read_to_string(&path)
        .ok()
        .and_then(|raw| serde_json::from_str::<HashMap<String, StoredWatchlistMarketItem>>(&raw).ok())
        .unwrap_or_default()
}

fn save_watchlist_market_state(state: &HashMap<String, StoredWatchlistMarketItem>) -> Result<(), String> {
    let path = watchlist_market_state_file();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let raw = serde_json::to_string_pretty(state).map_err(|e| e.to_string())?;
    std::fs::write(path, raw).map_err(|e| e.to_string())
}

async fn check_watchlist_market_data(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<WatchlistMarketCheckPayload>,
) -> impl IntoResponse {
    if payload.items.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "No watchlist items provided" })),
        );
    }

    let settings_path = resolve_settings_file(payload.profile.as_ref());
    let settings = match crate::config::load_config(&settings_path) {
        Ok(s) => s,
        Err(e) => {
            let msg = format!("Failed to load settings: {}", e);
            push_web_notification("error", "market_data", "Watchlist check failed", &msg, None);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": msg })),
            );
        }
    };

    let market_accounts: Vec<crate::market_data::MarketAccount> = settings
        .market_data
        .as_ref()
        .map(|market| {
            let use_market_proxies = market.use_market_proxies;
            market
                .accounts
                .iter()
                .enumerate()
                .filter(|(_, acc)| acc.enabled)
                .filter_map(|(idx, acc)| {
                    let key = acc.api_key.clone()?.trim().to_string();
                    if key.is_empty() {
                        return None;
                    }
                    Some(crate::market_data::MarketAccount {
                        api_key: key,
                        proxy: if use_market_proxies { acc.proxy.clone() } else { None },
                        original_index: idx,
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    if market_accounts.is_empty() {
        let msg = "No enabled market_data accounts with API keys".to_string();
        push_web_notification("warning", "market_data", "Watchlist check skipped", &msg, None);
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": msg })),
        );
    }

    let config_path = crate::config::get_settings_path(None);
    let settings = match crate::config::load_config(&config_path) {
        Ok(s) => s,
        Err(e) => {
            tracing::error!("check_watchlist_market_data: Failed to load config from {:?}: {}", config_path, e);
            crate::config::Settings::default()
        }
    };
    let bot_settings = settings.bot.clone();
    let notifier = bot_settings.map(|bot| {
        crate::notifier::TelegramNotifier::new(
            bot.telegram_bot_token,
            bot.telegram_chat_id,
            bot.telegram_target_bot_token,
        )
    });

    let client = match crate::market_data::MarketDataClient::new(market_accounts, notifier, Some(state.account_statuses.clone())) {
        Ok(c) => c,
        Err(e) => {
            let msg = format!("Failed to initialize market data client: {}", e);
            push_web_notification("error", "market_data", "Watchlist check failed", &msg, None);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": msg })),
            );
        }
    };

    let mut persisted_state = load_watchlist_market_state();
    let mut next_state: HashMap<String, StoredWatchlistMarketItem> = HashMap::new();

    let mut results: Vec<serde_json::Value> = Vec::with_capacity(payload.items.len());
    let mut changes: Vec<serde_json::Value> = Vec::new();
    let mut with_data_count = 0usize;

    for item in payload.items.iter().take(200) {
        let listing_id = item.id.trim();
        if listing_id.is_empty() {
            continue;
        }

        let prev_item = persisted_state.remove(listing_id);

        let listing_price = client.get_listing_price(listing_id).await;
        let highest_buy_order = client.get_highest_buy_order(listing_id).await;
        let market_hash_name = item
            .market_hash_name
            .as_deref()
            .filter(|v| !v.trim().is_empty())
            .or(item.name.as_deref())
            .unwrap_or("")
            .trim()
            .to_string();

        let lowest_market_price = if market_hash_name.is_empty() {
            None
        } else {
            client.get_lowest_market_price(&market_hash_name).await
        };

        let highest_buy_order_price = highest_buy_order.as_ref().map(|v| v.price);

        if listing_price.is_some() || highest_buy_order.is_some() || lowest_market_price.is_some() {
            with_data_count += 1;
        }

        let item_name = item
            .name
            .as_deref()
            .filter(|v| !v.trim().is_empty())
            .unwrap_or_else(|| if market_hash_name.is_empty() { "Unknown" } else { &market_hash_name })
            .to_string();

        let payload_old_listing_price = item.old_listing_price.filter(|p| *p > 0.0);
        let payload_new_listing_price = item.new_listing_price.filter(|p| *p > 0.0);
        let prev_old_listing_price = prev_item.as_ref().and_then(|p| p.old_listing_price);
        let prev_new_listing_price = prev_item.as_ref().and_then(|p| p.new_listing_price);

        let old_listing_price = prev_old_listing_price
            .or(payload_old_listing_price)
            .or(prev_new_listing_price)
            .or(listing_price);
        let new_listing_price = listing_price.or(payload_new_listing_price).or(prev_new_listing_price);

        if let Some(prev) = prev_item.as_ref() {
            if let (Some(old_price), Some(new_price)) = (prev.new_listing_price, new_listing_price) {
                let delta = new_price - old_price;
                if delta.abs() >= 0.0001 {
                    let direction = if delta > 0.0 { "up" } else { "down" };
                    let delta_percent = if old_price > 0.0 { (delta / old_price) * 100.0 } else { 0.0 };

                    changes.push(serde_json::json!({
                        "item_id": listing_id,
                        "item_name": item_name,
                        "old_price": old_price,
                        "new_price": new_price,
                        "delta": delta,
                        "delta_percent": delta_percent,
                        "direction": direction,
                    }));

                    let arrow = if delta > 0.0 { "↑" } else { "↓" };
                    let title = format!("Watchlist change: {}", item_name);
                    let message = format!(
                        "Price {} ${:.2} → ${:.2} ({:+.2}, {:+.2}%)",
                        arrow,
                        old_price,
                        new_price,
                        delta,
                        delta_percent
                    );

                    push_web_notification(
                        if delta > 0.0 { "warning" } else { "success" },
                        "market_data",
                        &title,
                        &message,
                        Some(serde_json::json!({
                            "change_type": "watchlist_market_price_change",
                            "item_id": listing_id,
                            "item_name": item_name,
                            "old_price": old_price,
                            "new_price": new_price,
                            "delta": delta,
                            "delta_percent": delta_percent,
                            "direction": direction,
                        })),
                    );
                }
            }
        }

        next_state.insert(
            listing_id.to_string(),
            StoredWatchlistMarketItem {
                id: listing_id.to_string(),
                name: item.name.clone(),
                market_hash_name: if market_hash_name.is_empty() { None } else { Some(market_hash_name.clone()) },
                old_listing_price,
                new_listing_price,
                highest_buy_order: highest_buy_order_price,
                lowest_market_price,
                checked_at: Utc::now().to_rfc3339(),
            },
        );

        let prev_listing_price = prev_new_listing_price;
        let prev_lowest = prev_item.as_ref().and_then(|p| p.lowest_market_price);

        results.push(serde_json::json!({
            "id": listing_id,
            "name": item.name,
            "market_hash_name": if market_hash_name.is_empty() { serde_json::Value::Null } else { serde_json::Value::String(market_hash_name) },
            "old_listing_price": old_listing_price,
            "new_listing_price": new_listing_price,
            "highest_buy_order": highest_buy_order,
            "lowest_market_price": lowest_market_price,
            "prev_lowest_market_price": prev_lowest,
            "prev_listing_price": prev_listing_price,
            "checked_at": Utc::now().to_rfc3339(),
        }));
    }

    if let Err(e) = save_watchlist_market_state(&next_state) {
        push_web_notification(
            "error",
            "market_data",
            "Watchlist state save failed",
            &format!("Failed to save watchlist market state: {}", e),
            None,
        );
    }

    let checked_count = results.len();
    let message = format!(
        "Checked {} watchlist items via Market Data accounts. {} returned market data. {} change(s) detected.",
        checked_count,
        with_data_count,
        changes.len()
    );

    push_web_notification(
        if with_data_count > 0 { "success" } else { "warning" },
        "market_data",
        "Watchlist market data check",
        &message,
        Some(serde_json::json!({
            "checked": checked_count,
            "with_data": with_data_count,
            "changes": changes,
            "results": results,
        })),
    );

    (
        StatusCode::OK,
        Json(serde_json::json!({
            "checked": checked_count,
            "with_data": with_data_count,
            "changes": changes,
            "results": results,
        })),
    )
}

fn categorize_weapon(weapon: &str) -> String {
    let weapon_lower = weapon.to_lowercase();
    let pistols = ["glock-18", "usp-s", "p250", "five-seven", "tec-9", "cz75-auto", "desert eagle", "r8 revolver", "p2000"];
    if pistols.iter().any(|p| weapon_lower.contains(p)) { return "Pistols".to_string(); }
    
    let smgs = ["mac-10", "mp9", "mp7", "mp5-sd", "ump-45", "p90", "bizon"];
    if smgs.iter().any(|s| weapon_lower.contains(s)) { return "SMGs".to_string(); }
    
    let rifles = ["galil ar", "famas", "ak-47", "m4a4", "m4a1-s", "ssg 08", "aug", "sg 553"];
    if rifles.iter().any(|r| weapon_lower.contains(r)) { return "Rifles".to_string(); }
    
    let sniper_rifles = ["awp", "ssg 08", "g3sg1", "scar-20"];
    if sniper_rifles.iter().any(|s| weapon_lower.contains(s)) { return "Sniper Rifles".to_string(); }
    
    let shotguns_and_mgs = ["nova", "xm1014", "mag-7", "m249", "negev", "sawed-off"];
    if shotguns_and_mgs.iter().any(|s| weapon_lower.contains(s)) { return "Heavy".to_string(); }
    
    let knives = ["karambit", "butterfly knife", "m9 bayonet", "bayonet", "skeleton knife", "talos", "nomad knife", "survival knife", "paracord knife", "ursus knife", "stiletto knife", "navaja knife", "classic knife", "huntsman knife", "falchion knife", "bowie knife", "shadow daggers", "gut knife", "flip knife", "kukri knife"];
    if knives.iter().any(|k| weapon_lower.contains(k)) { return "Knives".to_string(); }
    
    if weapon_lower.contains("glove") || weapon_lower.contains("hand wraps") || weapon_lower.contains("bloodhound") {
        return "Gloves".to_string();
    }
    
    if weapon_lower.contains("agent") || weapon_lower.contains(" | ") { // Basic agent check
        let agents = ["sir bloody", "special agent", "slingshot", "number K"];
        if agents.iter().any(|a| weapon_lower.contains(a)) {
            return "Agents".to_string();
        }
    }
    
    if weapon_lower.contains("sticker") { return "Stickers".to_string(); }
    if weapon_lower.contains("patch") { return "Patches".to_string(); }
    if weapon_lower.contains("pin") { return "Pins".to_string(); }
    if weapon_lower.contains("charm") { return "Charms".to_string(); }
    
    "Rifles".to_string() // Default to rifles instead of Others to prevent 'Others' category from appearing
}

async fn get_skins_categorized() -> impl IntoResponse {
    let mut skins_by_category: HashMap<String, HashMap<String, Vec<String>>> = HashMap::new();
    
    // Parse standard skin names
    let path = std::path::PathBuf::from("../clean_skin_names.txt");
    if let Ok(content) = std::fs::read_to_string(&path) {
        for line in content.lines() {
            let line = line.trim();
            if let Some(idx) = line.find('|') {
                let weapon = line[..idx].trim().to_string();
                let skin_name = line[idx+1..].trim().to_string();
                
                let category = categorize_weapon(&weapon);
                if category != "Others" {
                    skins_by_category
                        .entry(category)
                        .or_default()
                        .entry(weapon)
                        .or_default()
                        .push(skin_name);
                }
            }
        }
    }

    // Also include agents, gloves, charms, etc.
    let mut parse_files = |file: &str, default_cat: &str, default_weapon: &str| {
        if let Ok(content) = std::fs::read_to_string(&std::path::PathBuf::from(file)) {
            for line in content.lines() {
                let line = line.trim();
                let weapon = if let Some(idx) = line.find('|') {
                    line[..idx].trim().to_string()
                } else {
                    default_weapon.to_string()
                };
                let skin_name = if let Some(idx) = line.find('|') {
                    line[idx+1..].trim().to_string()
                } else {
                    line.to_string()
                };
                
                skins_by_category
                    .entry(default_cat.to_string())
                    .or_default()
                    .entry(weapon)
                    .or_default()
                    .push(skin_name);
            }
        }
    };
    
    parse_files("../parsed_agents_h1.txt", "Agents", "Agent");
    parse_files("../parsed_gloves_h1.txt", "Gloves", "Glove");
    parse_files("../parsed_charms.txt", "Charms", "Charm");
    parse_files("../parsed_stickers.txt", "Stickers", "Sticker");

    (StatusCode::OK, Json(serde_json::to_value(skins_by_category).unwrap()))
}

async fn get_skin_names() -> impl IntoResponse {
    let files = vec![
        "../clean_skin_names.txt",
        "../parsed_agents_h1.txt",
        "../parsed_charms.txt",
        "../parsed_stickers.txt",
        "../parsed_gloves_h1.txt",
    ];

    let mut all_names = std::collections::HashSet::new();

    for file_path in files {
        let path = std::path::PathBuf::from(file_path);
        if let Ok(content) = std::fs::read_to_string(&path) {
            for line in content.lines() {
                let trimmed = line.trim();
                if !trimmed.is_empty() {
                    all_names.insert(trimmed.to_string());
                }
            }
        }
    }

    let mut names: Vec<String> = all_names.into_iter().collect();
    names.sort();

    (StatusCode::OK, Json(serde_json::to_value(names).unwrap()))
}

#[derive(Deserialize)]
struct SaveProxyPoolPayload {
    account_type: String,
    account_index: usize,
    backup_ips: Vec<String>,
}

async fn save_proxy_pool(
    Query(query): Query<ProxyPoolsQuery>,
    Json(payload): Json<SaveProxyPoolPayload>,
) -> impl IntoResponse {
    let path = resolve_settings_file(query.profile.as_ref());
    let mut settings = match crate::config::load_config(&path) {
        Ok(s) => s,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": e.to_string() }))),
    };

    let accounts = match payload.account_type.as_str() {
        "scanner" => settings.scanner.as_mut().map(|s| &mut s.accounts),
        "market_data" => settings.market_data.as_mut().map(|m| &mut m.accounts),
        "auto_buy" => settings.auto_buy.as_mut().map(|a| &mut a.accounts),
        _ => None,
    };

    if let Some(accs) = accounts {
        if let Some(acc) = accs.get_mut(payload.account_index) {
            acc.backup_ips = payload.backup_ips.clone();
        }
    }

    match crate::config::save_config(&path, &settings) {
        Ok(_) => (StatusCode::OK, Json(serde_json::json!({
            "status": "ok",
            "backup_count": payload.backup_ips.len()
        }))),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": e.to_string() }))),
    }
}

static MARKET_DATA_INDEX: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);

fn get_market_client(profile: Option<&String>, account_statuses: Option<Arc<Mutex<serde_json::Value>>>) -> Result<crate::market_data::MarketDataClient, String> {
    let settings_path = resolve_settings_file(profile);
    let settings = crate::config::load_config(&settings_path).map_err(|e| e.to_string())?;
    
    let use_market_proxies = settings
        .market_data
        .as_ref()
        .map(|m| m.use_market_proxies)
        .unwrap_or(true);

    let mut market_accounts: Vec<crate::market_data::MarketAccount> = settings
        .market_data
        .as_ref()
        .map(|market| {
            market
                .accounts
                .iter()
                .enumerate()
                .filter(|(_, acc)| acc.enabled)
                .filter_map(|(idx, acc)| {
                    let key = acc.api_key.clone()?.trim().to_string();
                    if key.is_empty() {
                        return None;
                    }
                    Some(crate::market_data::MarketAccount {
                        api_key: key,
                        proxy: if use_market_proxies { acc.proxy.clone() } else { None },
                        original_index: idx,
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    if market_accounts.is_empty() {
        if let Some(scanner) = &settings.scanner {
            for (idx, acc) in scanner.accounts.iter().enumerate() {
                if acc.enabled {
                    if let Some(key) = &acc.api_key {
                        if !key.trim().is_empty() {
                            market_accounts.push(crate::market_data::MarketAccount {
                                api_key: key.trim().to_string(),
                                proxy: if use_market_proxies { acc.proxy.clone() } else { None },
                                original_index: idx,
                            });
                        }
                    }
                }
            }
            if market_accounts.is_empty() {
                if let Some(key) = &scanner.api_key {
                    if !key.trim().is_empty() {
                        market_accounts.push(crate::market_data::MarketAccount {
                            api_key: key.trim().to_string(),
                            proxy: None,
                            original_index: 0,
                        });
                    }
                }
            }
        }
    }

    if market_accounts.is_empty() {
        return Err("No enabled market_data or scanner accounts with API keys".to_string());
    }

    let client = crate::market_data::MarketDataClient::new(market_accounts, None, account_statuses).map_err(|e| e.to_string())?;
    let idx = MARKET_DATA_INDEX.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
    client.current_index.store(idx % client.sessions.len(), std::sync::atomic::Ordering::SeqCst);
    Ok(client)
}

#[derive(Deserialize)]
struct HighestBidQuery {
    listing_id: String,
    profile: Option<String>,
}

async fn get_highest_bid_api(
    State(state): State<Arc<AppState>>,
    Query(query): Query<HighestBidQuery>,
) -> impl IntoResponse {
    let client = match get_market_client(query.profile.as_ref(), Some(state.account_statuses.clone())) {
        Ok(c) => c,
        Err(e) => return (StatusCode::TOO_MANY_REQUESTS, Json(serde_json::json!({ "error": e }))),
    };

    match client.get_highest_buy_order(&query.listing_id).await {
        Some(info) => {
            // Update live_feed_store and broadcast bid update to all connected SSE clients
            let mut store = live_feed_store().lock().unwrap();
            let mut found_item = None;
            for item in store.iter_mut() {
                let id_match = item.get("item_id").and_then(|v| v.as_str()) == Some(&query.listing_id)
                    || item.get("id").and_then(|v| v.as_str()) == Some(&query.listing_id);
                if id_match {
                    if let Some(obj) = item.as_object_mut() {
                        obj.insert("bid_price".to_string(), serde_json::json!(info.price));
                        obj.insert("bidPrice".to_string(), serde_json::json!(info.price));
                        obj.insert("hasRealBid".to_string(), serde_json::json!(true));
                        obj.insert("has_real_bid".to_string(), serde_json::json!(true));
                    }
                    found_item = Some(item.clone());
                    break;
                }
            }

            let broadcast_payload = serde_json::json!({
                "id": query.listing_id,
                "item_id": query.listing_id,
                "bid_price": info.price,
                "bidPrice": info.price,
                "hasRealBid": true,
                "has_real_bid": true
            });

            let _ = live_feed_tx().send(vec![broadcast_payload]);

            (StatusCode::OK, Json(serde_json::json!({
                "price": info.price,
                "count": info.count
            })))
        },
        None => (StatusCode::NOT_FOUND, Json(serde_json::json!({ "error": "Failed to fetch buy orders" }))),
    }
}

#[derive(Deserialize)]
struct LowestPriceQuery {
    market_hash_name: String,
    profile: Option<String>,
}

async fn get_lowest_price_api(
    State(state): State<Arc<AppState>>,
    Query(query): Query<LowestPriceQuery>,
) -> impl IntoResponse {
    let client = match get_market_client(query.profile.as_ref(), Some(state.account_statuses.clone())) {
        Ok(c) => c,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": e }))),
    };

    match client.get_lowest_market_price(&query.market_hash_name).await {
        Some(price) => (StatusCode::OK, Json(serde_json::json!({
            "price": price
        }))),
        None => (StatusCode::NOT_FOUND, Json(serde_json::json!({ "error": "Item not found in price list" }))),
    }
}

#[derive(Deserialize)]
struct ListingDetailQuery {
    profile: Option<String>,
}

async fn get_listing_detail_api(
    State(state): State<Arc<AppState>>,
    AxumPath(listing_id): AxumPath<String>,
    Query(query): Query<ListingDetailQuery>,
) -> impl IntoResponse {
    let client = match get_market_client(query.profile.as_ref(), Some(state.account_statuses.clone())) {
        Ok(c) => c,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": e }))),
    };

    let session = match client.get_next_session() {
        Some(s) => s,
        None => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "No market/scanner sessions available" }))),
    };

    let url = format!("https://csfloat.com/api/v1/listings/{}", listing_id);
    let resp_res = session.client
        .get(&url)
        .header("Authorization", &session.api_key)
        .header("Content-Type", "application/json")
        .send()
        .await;

    let resp = match resp_res {
        Ok(r) => r,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": e.to_string() }))),
    };

    if resp.status().as_u16() != 200 {
        return (
            StatusCode::from_u16(resp.status().as_u16()).unwrap_or(StatusCode::BAD_REQUEST),
            Json(serde_json::json!({ "error": format!("CSFloat API returned status {}", resp.status()) }))
        );
    }

    let body: serde_json::Value = match resp.json().await {
        Ok(b) => b,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": e.to_string() }))),
    };

    let cs2_screenshot_id = body.get("listing")
        .and_then(|l| l.get("item"))
        .and_then(|i| i.get("cs2_screenshot_id"))
        .or_else(|| body.get("item").and_then(|i| i.get("cs2_screenshot_id")))
        .and_then(|id| id.as_str())
        .map(|s| s.to_string());

    if let Some(ref screenshot_id) = cs2_screenshot_id {
        if !screenshot_id.is_empty() {
            let mut store = live_feed_store().lock().unwrap();
            if let Some(item) = store.iter_mut().find(|i| i.get("item_id").and_then(|id| id.as_str()) == Some(&listing_id)) {
                if let Some(obj) = item.as_object_mut() {
                    obj.insert("cs2_screenshot_id".to_string(), serde_json::Value::String(screenshot_id.clone()));
                }
            }
        }
    }

    (StatusCode::OK, Json(serde_json::json!({
        "cs2_screenshot_id": cs2_screenshot_id
    })))
}

#[derive(Deserialize)]
struct PriceListQuery {
    profile: Option<String>,
}

async fn get_price_list_api(
    State(state): State<Arc<AppState>>,
    Query(query): Query<PriceListQuery>,
) -> impl IntoResponse {
    let client = match get_market_client(query.profile.as_ref(), Some(state.account_statuses.clone())) {
        Ok(c) => c,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": e }))),
    };

    match client.get_price_list().await {
        Some(list) => {
            let mut map = std::collections::HashMap::new();
            for item in list {
                if let (Some(name), Some(min_price)) = (item.market_hash_name, item.min_price) {
                    map.insert(name, min_price as f64 / 100.0);
                }
            }
            (StatusCode::OK, Json(serde_json::json!({ "prices": map })))
        }
        None => (StatusCode::NOT_FOUND, Json(serde_json::json!({ "error": "Could not fetch price list" }))),
    }
}

#[derive(Deserialize)]
struct BuyItemPayload {
    listing_id: String,
    total_price: i32,
    item_name: Option<String>,
    profile: Option<String>,
    listed_at: Option<i64>,
}

#[derive(Deserialize)]
struct CreateBuyOrderPayload {
    market_hash_name: String,
    max_price: i32,
    quantity: i32,
    profile: Option<String>,
}

#[derive(Deserialize)]
struct MakeOfferPayload {
    listing_id: String,
    price: i32,
    profile: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PurchaseLatency {
    pub id: i64,
    pub item_id: String,
    pub item_name: String,
    pub purchase_type: String, // "auto" or "manual"
    pub api_fetch_delay_ms: i64,
    pub analysis_delay_ms: i64,
    pub market_data_delay_ms: i64,
    pub purchase_delay_ms: i64,
    pub total_delay_ms: i64,
    pub detection_delay_ms: i64,
    pub status: String, // "success" or error message
    pub timestamp: String,
}

#[derive(Deserialize)]
pub struct TestItemPayload {
    pub listing: serde_json::Value,
    pub profile: Option<String>,
}

fn get_sniper_client(profile: Option<&str>) -> Result<(reqwest::Client, String), String> {
    let settings_path = crate::config::get_settings_path(profile);
    let settings = crate::config::load_config(&settings_path).map_err(|e| e.to_string())?;

    let auto_buy_accounts = settings
        .auto_buy
        .as_ref()
        .map(|s| s.accounts.clone())
        .unwrap_or_default();

    let request_timeout = settings
        .scanner
        .as_ref()
        .and_then(|s| s.request_timeout)
        .unwrap_or(5)
        .max(1);
    let timeout = std::time::Duration::from_secs(request_timeout as u64);

    let (proxy_url, api_key) = if let Some(acc) = auto_buy_accounts.iter().find(|a| a.enabled) {
        (acc.proxy.clone(), acc.api_key.clone())
    } else {
        let key = settings.scanner.as_ref().and_then(|s| s.api_key.clone());
        let proxy = settings.scanner.as_ref().and_then(|s| s.sniper_proxy.clone());
        (proxy, key)
    };

    let api_key = api_key.ok_or_else(|| "Sniper API key not configured".to_string())?;

    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(reqwest::header::ACCEPT, reqwest::header::HeaderValue::from_static("application/json"));
    headers.insert(
        reqwest::header::ACCEPT_ENCODING,
        reqwest::header::HeaderValue::from_static("gzip, deflate, br"),
    );
    headers.insert(reqwest::header::CONNECTION, reqwest::header::HeaderValue::from_static("keep-alive"));
    headers.insert(reqwest::header::REFERER, reqwest::header::HeaderValue::from_static("https://csfloat.com/"));
    headers.insert(reqwest::header::ORIGIN, reqwest::header::HeaderValue::from_static("https://csfloat.com"));
    headers.insert(reqwest::header::CACHE_CONTROL, reqwest::header::HeaderValue::from_static("no-cache, no-store, must-revalidate"));
    headers.insert(reqwest::header::PRAGMA, reqwest::header::HeaderValue::from_static("no-cache"));

    let mut builder = reqwest::Client::builder()
        .timeout(timeout)
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .default_headers(headers);

    let use_proxies = settings.scanner.as_ref().map(|s| s.use_proxies).unwrap_or(true);
    if use_proxies {
        if let Some(proxy_url) = proxy_url {
            if !proxy_url.trim().is_empty() {
                let normalized = crate::config::normalize_proxy(&proxy_url);
                let proxy = reqwest::Proxy::all(&normalized).map_err(|e| e.to_string())?;
                builder = builder.proxy(proxy);
            }
        }
    }

    let client = builder.build().map_err(|e| e.to_string())?;
    Ok((client, api_key))
}

async fn buy_item_api(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<BuyItemPayload>,
) -> (StatusCode, Json<serde_json::Value>) {
    tracing::info!("MANUAL BUY REQUEST: listing_id={}, price={}", payload.listing_id, payload.total_price);
    
    let profile_key = payload.profile.clone().unwrap_or_default();
    let client_res = {
        let mut cache = state.manual_sniper_clients.lock().unwrap();
        if let Some(entry) = cache.get(&profile_key) {
            Ok(entry.clone())
        } else {
            match get_sniper_client(payload.profile.as_deref()) {
                Ok(entry) => {
                    cache.insert(profile_key, entry.clone());
                    Ok(entry)
                }
                Err(e) => Err(e),
            }
        }
    };

    let (client, api_key) = match client_res {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("MANUAL BUY FAILED: get_sniper_client error: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": e })));
        }
    };

    let url = "https://csfloat.com/api/v1/listings/buy";
    let body = serde_json::json!({
        "total_price": payload.total_price,
        "contract_ids": vec![payload.listing_id.clone()]
    });

    let mut req = client.post(url).json(&body);
    if !api_key.is_empty() {
        req = req.header("Authorization", &api_key);
    }

    let buy_req_start = std::time::Instant::now();
    match req.send().await {
        Ok(resp) => {
            let purchase_delay_ms = buy_req_start.elapsed().as_millis() as i64;
            let now_ms = chrono::Utc::now().timestamp_millis();
            let detection_delay_ms = payload.listed_at.map(|la| (now_ms - la).max(0)).unwrap_or(purchase_delay_ms);

            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            if status.is_success() {
                tracing::info!("MANUAL BUY SUCCESS: listing_id={}", payload.listing_id);
                let item_desc = payload.item_name.clone().unwrap_or_else(|| "Unknown Item".to_string());
                push_web_notification(
                    "autobuy",
                    "autobuy",
                    "✅ Manual Purchase Successful!",
                    &format!("{} bought manually for ${:.2}", item_desc, payload.total_price as f64 / 100.0),
                    Some(serde_json::json!({
                        "item_id": payload.listing_id,
                        "price": payload.total_price as f64 / 100.0,
                    })),
                );

                // Record success latency to DB
                let db_clone = state.db.clone();
                let listing_id = payload.listing_id.clone();
                let item_desc_clone = item_desc.clone();
                tokio::spawn(async move {
                    let _ = sqlx::query(
                        "INSERT INTO purchase_latencies 
                         (item_id, item_name, purchase_type, api_fetch_delay_ms, analysis_delay_ms, 
                          market_data_delay_ms, purchase_delay_ms, total_delay_ms, detection_delay_ms, status, timestamp) 
                         VALUES (?, ?, 'manual', 0, 0, 0, ?, ?, ?, 'success', ?)"
                    )
                    .bind(listing_id)
                    .bind(item_desc_clone)
                    .bind(purchase_delay_ms)
                    .bind(purchase_delay_ms)
                    .bind(detection_delay_ms)
                    .bind(chrono::Utc::now().to_rfc3339())
                    .execute(&db_clone)
                    .await;
                });

                (StatusCode::OK, Json(serde_json::json!({ "status": "success", "message": "Purchase successful" })))
            } else {
                let err_reason = if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                    json.get("error")
                        .and_then(|v| v.as_str())
                        .or_else(|| json.get("message").and_then(|v| v.as_str()))
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| format!("HTTP {} - {}", status, text))
                } else {
                    format!("HTTP {} - {}", status, text)
                };

                tracing::error!("MANUAL BUY FAILED: listing_id={}, reason={}", payload.listing_id, err_reason);
                let item_desc = payload.item_name.clone().unwrap_or_else(|| "Unknown Item".to_string());
                push_web_notification(
                    "error",
                    "autobuy",
                    "❌ Manual Purchase Failed",
                    &format!("Failed to manually buy {}: {}", item_desc, err_reason),
                    Some(serde_json::json!({
                        "item_id": payload.listing_id,
                        "price": payload.total_price as f64 / 100.0,
                        "error": err_reason,
                    })),
                );

                // Record failure latency to DB
                let db_clone = state.db.clone();
                let listing_id = payload.listing_id.clone();
                let item_desc_clone = item_desc.clone();
                let err_reason_db = err_reason.clone();
                tokio::spawn(async move {
                    let _ = sqlx::query(
                        "INSERT INTO purchase_latencies 
                         (item_id, item_name, purchase_type, api_fetch_delay_ms, analysis_delay_ms, 
                          market_data_delay_ms, purchase_delay_ms, total_delay_ms, detection_delay_ms, status, timestamp) 
                         VALUES (?, ?, 'manual', 0, 0, 0, ?, ?, ?, ?, ?)"
                    )
                    .bind(listing_id)
                    .bind(item_desc_clone)
                    .bind(purchase_delay_ms)
                    .bind(purchase_delay_ms)
                    .bind(detection_delay_ms)
                    .bind(err_reason_db)
                    .bind(chrono::Utc::now().to_rfc3339())
                    .execute(&db_clone)
                    .await;
                });

                // Send Telegram Notification about failed manual buy to tech/main bot in the background
                let settings_path = crate::config::get_settings_path(payload.profile.as_deref());
                if let Ok(settings) = crate::config::load_config(&settings_path) {
                    if let Some(bot) = settings.bot.as_ref() {
                        let bot_token = bot.telegram_bot_token.clone();
                        let chat_id = bot.telegram_chat_id.clone();
                        let target_bot_token = bot.telegram_target_bot_token.clone();
                        let item_desc = payload.item_name.clone().unwrap_or_else(|| "Unknown Item".to_string());
                        let total_price = payload.total_price;
                        let err_reason_clone = err_reason.clone();
                        
                        tokio::spawn(async move {
                            let notifier = crate::notifier::TelegramNotifier::new(
                                bot_token,
                                chat_id,
                                target_bot_token,
                            );
                            let alert_msg = format!(
                                "⚠️ *MANUAL BUY FAILED* ⚠️\n\n📦 *Item:* {}\n💰 *Price:* `${:.2}`\n❌ *Reason:* {}",
                                item_desc,
                                total_price as f64 / 100.0,
                                err_reason_clone
                            );
                            notifier.send_message(&alert_msg).await;
                        });
                    }
                }

                let axum_status = StatusCode::from_u16(status.as_u16())
                    .unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
                (axum_status, Json(serde_json::json!({ "error": err_reason })))
            }
        }
        Err(e) => {
            let purchase_delay_ms = buy_req_start.elapsed().as_millis() as i64;
            let now_ms = chrono::Utc::now().timestamp_millis();
            let detection_delay_ms = payload.listed_at.map(|la| (now_ms - la).max(0)).unwrap_or(purchase_delay_ms);

            let err_reason = format!("Network error: {}", e);
            tracing::error!("MANUAL BUY ERROR: listing_id={}, reason={}", payload.listing_id, err_reason);
            let item_desc = payload.item_name.clone().unwrap_or_else(|| "Unknown Item".to_string());
            push_web_notification(
                "error",
                "autobuy",
                "❌ Manual Purchase Failed",
                &format!("Failed to manually buy {}: {}", item_desc, err_reason),
                Some(serde_json::json!({
                    "item_id": payload.listing_id,
                    "price": payload.total_price as f64 / 100.0,
                    "error": err_reason,
                })),
            );

            // Record network error latency to DB
            let db_clone = state.db.clone();
            let listing_id = payload.listing_id.clone();
            let item_desc_clone = item_desc.clone();
            let err_reason_db = err_reason.clone();
            tokio::spawn(async move {
                let _ = sqlx::query(
                    "INSERT INTO purchase_latencies 
                     (item_id, item_name, purchase_type, api_fetch_delay_ms, analysis_delay_ms, 
                      market_data_delay_ms, purchase_delay_ms, total_delay_ms, detection_delay_ms, status, timestamp) 
                     VALUES (?, ?, 'manual', 0, 0, 0, ?, ?, ?, ?, ?)"
                )
                .bind(listing_id)
                .bind(item_desc_clone)
                .bind(purchase_delay_ms)
                .bind(purchase_delay_ms)
                .bind(detection_delay_ms)
                .bind(err_reason_db)
                .bind(chrono::Utc::now().to_rfc3339())
                .execute(&db_clone)
                .await;
            });

            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": err_reason })))
        }
    }
}

async fn create_buy_order_api(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateBuyOrderPayload>,
) -> (StatusCode, Json<serde_json::Value>) {
    tracing::info!("CREATE BUY ORDER REQUEST: market_hash_name={}, max_price={}, qty={}", payload.market_hash_name, payload.max_price, payload.quantity);

    let profile_key = payload.profile.clone().unwrap_or_default();
    let client_res = {
        let mut cache = state.manual_sniper_clients.lock().unwrap();
        if let Some(entry) = cache.get(&profile_key) {
            Ok(entry.clone())
        } else {
            match get_sniper_client(payload.profile.as_deref()) {
                Ok(entry) => {
                    cache.insert(profile_key, entry.clone());
                    Ok(entry)
                }
                Err(e) => Err(e),
            }
        }
    };

    let (client, api_key) = match client_res {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("CREATE BUY ORDER FAILED: get_sniper_client error: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": e })));
        }
    };

    let url = "https://csfloat.com/api/v1/buy-orders";
    let body = serde_json::json!({
        "market_hash_name": payload.market_hash_name,
        "max_price": payload.max_price,
        "quantity": payload.quantity
    });

    let mut req = client.post(url).json(&body);
    if !api_key.is_empty() {
        req = req.header("Authorization", &api_key);
    }

    match req.send().await {
        Ok(resp) => {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            if status.is_success() {
                tracing::info!("CREATE BUY ORDER SUCCESS: market_hash_name={}", payload.market_hash_name);
                
                push_web_notification(
                    "success",
                    "buy_order",
                    "✅ Buy Order Placed!",
                    &format!("Buy order placed for {} at ${:.2}", payload.market_hash_name, payload.max_price as f64 / 100.0),
                    Some(serde_json::json!({
                        "market_hash_name": payload.market_hash_name,
                        "price": payload.max_price as f64 / 100.0,
                    })),
                );

                // Send Telegram notification if config is present
                let settings_path = crate::config::get_settings_path(payload.profile.as_deref());
                if let Ok(settings) = crate::config::load_config(&settings_path) {
                    if let Some(bot) = settings.bot.as_ref() {
                        let bot_token = bot.telegram_bot_token.clone();
                        let chat_id = bot.telegram_chat_id.clone();
                        let target_bot_token = bot.telegram_target_bot_token.clone();
                        let market_hash_name = payload.market_hash_name.clone();
                        let max_price = payload.max_price;
                        let quantity = payload.quantity;
                        
                        tokio::spawn(async move {
                            let notifier = crate::notifier::TelegramNotifier::new(
                                bot_token,
                                chat_id,
                                target_bot_token,
                            );
                            let alert_msg = format!(
                                "📝 *BUY ORDER PLACED* 📝\n\n\
                                 🔫 `{}`\n\
                                 💰 *Max Price:* `${:.2}`\n\
                                 🔢 *Quantity:* `{}`",
                                market_hash_name,
                                max_price as f64 / 100.0,
                                quantity
                            );
                            notifier.send_target_message(&alert_msg).await;
                        });
                    }
                }

                (StatusCode::OK, Json(serde_json::json!({ "status": "success", "message": "Buy order created successfully" })))
            } else {
                let err_reason = if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                    json.get("error")
                        .and_then(|v| v.as_str())
                        .or_else(|| json.get("message").and_then(|v| v.as_str()))
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| format!("HTTP {} - {}", status, text))
                } else {
                    format!("HTTP {} - {}", status, text)
                };

                tracing::error!("CREATE BUY ORDER FAILED: market_hash_name={}, reason={}", payload.market_hash_name, err_reason);
                let ax_status = StatusCode::from_u16(status.as_u16())
                    .unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
                (ax_status, Json(serde_json::json!({ "error": err_reason })))
            }
        }
        Err(e) => {
            let err_reason = format!("Network error: {}", e);
            tracing::error!("CREATE BUY ORDER ERROR: market_hash_name={}, reason={}", payload.market_hash_name, err_reason);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": err_reason })))
        }
    }
}

async fn make_offer_api(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<MakeOfferPayload>,
) -> (StatusCode, Json<serde_json::Value>) {
    tracing::info!("MAKE OFFER REQUEST: listing_id={}, price={}", payload.listing_id, payload.price);

    let profile_key = payload.profile.clone().unwrap_or_default();
    let client_res = {
        let mut cache = state.manual_sniper_clients.lock().unwrap();
        if let Some(entry) = cache.get(&profile_key) {
            Ok(entry.clone())
        } else {
            match get_sniper_client(payload.profile.as_deref()) {
                Ok(entry) => {
                    cache.insert(profile_key, entry.clone());
                    Ok(entry)
                }
                Err(e) => Err(e),
            }
        }
    };

    let (client, api_key) = match client_res {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("MAKE OFFER FAILED: get_sniper_client error: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": e })));
        }
    };

    let url = "https://csfloat.com/api/v1/offers";
    let body = serde_json::json!({
        "contract_id": payload.listing_id,
        "price": payload.price,
        "cancel_previous_offer": false
    });

    let mut req = client.post(url).json(&body);
    if !api_key.is_empty() {
        req = req.header("Authorization", &api_key);
    }

    match req.send().await {
        Ok(resp) => {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            if status.is_success() {
                tracing::info!("MAKE OFFER SUCCESS: listing_id={}, price={}", payload.listing_id, payload.price);
                
                push_web_notification(
                    "success",
                    "buy_order",
                    "✅ Offer Placed!",
                    &format!("Offer of ${:.2} placed for listing {}", payload.price as f64 / 100.0, payload.listing_id),
                    Some(serde_json::json!({
                        "listing_id": payload.listing_id,
                        "price": payload.price as f64 / 100.0,
                    })),
                );

                let settings_path = crate::config::get_settings_path(payload.profile.as_deref());
                if let Ok(settings) = crate::config::load_config(&settings_path) {
                    if let Some(bot) = settings.bot.as_ref() {
                        let bot_token = bot.telegram_bot_token.clone();
                        let chat_id = bot.telegram_chat_id.clone();
                        let target_bot_token = bot.telegram_target_bot_token.clone();
                        let listing_id = payload.listing_id.clone();
                        let price = payload.price;
                        
                        tokio::spawn(async move {
                            let notifier = crate::notifier::TelegramNotifier::new(
                                bot_token,
                                chat_id,
                                target_bot_token,
                            );
                            let alert_msg = format!(
                                "🤝 *OFFER PLACED* 🤝\n\n\
                                 🆔 `{}`\n\
                                 💰 *Offer Price:* `${:.2}`",
                                listing_id,
                                price as f64 / 100.0
                            );
                            notifier.send_message(&alert_msg).await;
                        });
                    }
                }

                let resp_val: serde_json::Value = serde_json::from_str(&text).unwrap_or_else(|_| {
                    serde_json::json!({ "status": "success", "listing_id": payload.listing_id })
                });
                (StatusCode::OK, Json(resp_val))
            } else {
                tracing::error!("MAKE OFFER FAILED: HTTP {} - {}", status, text);
                let err_reason = serde_json::from_str::<serde_json::Value>(&text)
                    .ok()
                    .and_then(|v| v.get("error").and_then(|e| e.as_str()).map(|s| s.to_string()))
                    .unwrap_or(text);
                let ax_status = StatusCode::from_u16(status.as_u16()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
                (ax_status, Json(serde_json::json!({ "error": err_reason })))
            }
        }
        Err(e) => {
            let err_reason = format!("Request error: {}", e);
            tracing::error!("MAKE OFFER FAILED: {}", err_reason);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": err_reason })))
        }
    }
}

// ===========================================
// STATISTICS & LATENCIES
// ===========================================

async fn get_latencies(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let rows = sqlx::query(
        "SELECT id, item_id, item_name, purchase_type, api_fetch_delay_ms, analysis_delay_ms, 
                market_data_delay_ms, purchase_delay_ms, total_delay_ms, detection_delay_ms, status, timestamp 
         FROM purchase_latencies ORDER BY timestamp DESC"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let latencies: Vec<PurchaseLatency> = rows.iter().map(|r| {
        use sqlx::Row;
        PurchaseLatency {
            id: r.try_get("id").unwrap_or(0),
            item_id: r.try_get("item_id").unwrap_or_default(),
            item_name: r.try_get("item_name").unwrap_or_default(),
            purchase_type: r.try_get("purchase_type").unwrap_or_default(),
            api_fetch_delay_ms: r.try_get("api_fetch_delay_ms").unwrap_or(0),
            analysis_delay_ms: r.try_get("analysis_delay_ms").unwrap_or(0),
            market_data_delay_ms: r.try_get("market_data_delay_ms").unwrap_or(0),
            purchase_delay_ms: r.try_get("purchase_delay_ms").unwrap_or(0),
            total_delay_ms: r.try_get("total_delay_ms").unwrap_or(0),
            detection_delay_ms: r.try_get("detection_delay_ms").unwrap_or(0),
            status: r.try_get("status").unwrap_or_default(),
            timestamp: r.try_get("timestamp").unwrap_or_default(),
        }
    }).collect();

    (StatusCode::OK, Json(latencies))
}

#[derive(Deserialize)]
struct DeleteLatenciesQuery {
    ids: Option<String>,
}

async fn delete_latencies(
    State(state): State<Arc<AppState>>,
    Query(q): Query<DeleteLatenciesQuery>,
) -> impl IntoResponse {
    if let Some(ids_str) = q.ids {
        let ids: Vec<i64> = ids_str
            .split(',')
            .filter_map(|s| s.trim().parse::<i64>().ok())
            .collect();

        if !ids.is_empty() {
            let query_str = format!(
                "DELETE FROM purchase_latencies WHERE id IN ({})",
                ids.iter().map(|_| "?").collect::<Vec<_>>().join(",")
            );
            let mut query = sqlx::query(&query_str);
            for id in ids {
                query = query.bind(id);
            }
            let _ = query.execute(&state.db).await;
            return (StatusCode::OK, Json(serde_json::json!({ "status": "ok", "message": "Selected latencies deleted" })));
        }
    }

    let _ = sqlx::query("DELETE FROM purchase_latencies").execute(&state.db).await;
    (StatusCode::OK, Json(serde_json::json!({ "status": "ok", "message": "All latencies deleted" })))
}

async fn test_item_latency(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<TestItemPayload>,
) -> impl IntoResponse {
    let start_total = std::time::Instant::now();

    let settings_path = crate::config::get_settings_path(payload.profile.as_deref());
    let settings = crate::config::load_config(&settings_path).unwrap_or_default();
    let scanner_cfg = settings.scanner.unwrap_or_default();
    let timeout = std::time::Duration::from_secs(scanner_cfg.request_timeout.unwrap_or(5).max(1) as u64);

    // 1. Network Fetch Delay
    let fetch_start = std::time::Instant::now();
    let scanner_client = reqwest::Client::builder()
        .timeout(timeout)
        .build()
        .unwrap_or_default();
    let _ = scanner_client.get("https://csfloat.com/api/v1/listings?limit=1").send().await;
    let api_fetch_delay_ms = fetch_start.elapsed().as_millis() as i64;

    // 2. Analysis Delay
    let mut analyzer = crate::analyzer::Analyzer::new();
    let _ = analyzer.refresh_knowledge_base(&state.db).await;
    
    let listing_raw = payload.listing.clone();
    let listing: Result<crate::api_models::Listing, _> = serde_json::from_value(listing_raw);
    if let Err(e) = &listing {
        tracing::error!("TEST ITEM LATENCY: Failed to deserialize listing: {}", e);
    }
    
    let analysis_start = std::time::Instant::now();
    let mut matched = false;
    let mut reason = "No matches".to_string();
    if let Ok(l) = &listing {
        let results = analyzer.check_listing(l);
        if !results.is_empty() {
            matched = true;
            reason = results[0].reason.clone();
        }
    }
    let analysis_delay_ms = (analysis_start.elapsed().as_micros() as f64) / 1000.0;

    // 3. Market Data Fetch Delay
    let market_data_start = std::time::Instant::now();
    if let Ok(l) = &listing {
        let hash_name = l.item.as_ref().and_then(|i| i.market_hash_name.clone()).unwrap_or_default();
        if !hash_name.is_empty() {
            let url = format!("https://csfloat.com/api/v1/listings/history?market_hash_name={}", urlencoding::encode(&hash_name));
            let _ = scanner_client.get(&url).send().await;
        }
    }
    let market_data_delay_ms = market_data_start.elapsed().as_millis() as i64;

    // 4. Safe GET status check (simulate buy delay)
    let buy_start = std::time::Instant::now();
    if let Ok(l) = &listing {
        if !l.id.is_empty() {
            let url = format!("https://csfloat.com/api/v1/listings/{}", l.id);
            let _ = scanner_client.get(&url).send().await;
        }
    }
    let purchase_delay_ms = buy_start.elapsed().as_millis() as i64;
    let total_delay_ms = start_total.elapsed().as_millis() as i64;

    (StatusCode::OK, Json(serde_json::json!({
        "api_fetch_delay_ms": api_fetch_delay_ms,
        "analysis_delay_ms": analysis_delay_ms,
        "market_data_delay_ms": market_data_delay_ms,
        "purchase_delay_ms": purchase_delay_ms,
        "total_delay_ms": total_delay_ms,
        "matched": matched,
        "reason": reason
    })))
}

#[derive(serde::Serialize, serde::Deserialize, Default, Clone)]
struct WatcherState {
    last_balances: std::collections::HashMap<String, i64>,
    seen_trades: std::collections::HashMap<String, String>,
    seen_transactions: std::collections::HashSet<String>,
    #[serde(default)]
    seen_offers: std::collections::HashMap<String, String>,
}

fn get_watcher_state_path() -> std::path::PathBuf {
    let settings_path = crate::config::get_settings_path(None);
    if let Some(parent) = settings_path.parent() {
        parent.join("watcher_state.json")
    } else {
        std::path::PathBuf::from("config/watcher_state.json")
    }
}

fn load_watcher_state() -> WatcherState {
    let path = get_watcher_state_path();
    if path.exists() {
        if let Ok(content) = std::fs::read_to_string(&path) {
            if let Ok(state) = serde_json::from_str(&content) {
                return state;
            }
        }
    }
    WatcherState::default()
}

fn save_watcher_state(state: &WatcherState) {
    let path = get_watcher_state_path();
    if let Ok(content) = serde_json::to_string_pretty(state) {
        let _ = std::fs::write(&path, content);
    }
}

pub async fn trigger_trade_alert(
    trade: &serde_json::Value,
    state: &str,
    profile: Option<&str>,
) {
    let contract = trade.get("contract");
    let item = contract.and_then(|c| c.get("item"));
    let market_hash_name = item.and_then(|i| i.get("market_hash_name").and_then(|v| v.as_str())).unwrap_or("Unknown Item");
    
    let price_cents = contract.and_then(|c| c.get("price").and_then(|v| v.as_i64())).unwrap_or(0);
    let price_dollars = price_cents as f64 / 100.0;
    
    let item_id = trade.get("contract_id").and_then(|v| v.as_str()).unwrap_or("");

    let float_value = item.and_then(|i| i.get("float_value"));
    let paint_seed = item.and_then(|i| i.get("paint_seed"));
    let wear_name = item.and_then(|i| i.get("wear_name")).and_then(|v| v.as_str()).unwrap_or("N/A");
    let rarity_name = item.and_then(|i| i.get("rarity_name")).and_then(|v| v.as_str()).unwrap_or("");
    let phase = item.and_then(|i| i.get("phase")).and_then(|v| v.as_str()).unwrap_or("");

    // Set state-specific headers and titles
    let (web_title, tg_header) = match state {
        "queued" => ("⏳ Purchase Queued", "⏳ *PURCHASE QUEUED* ⏳"),
        "pending" => ("⏳ Purchase Pending", "⏳ *PURCHASE PENDING* ⏳"),
        _ => ("🎯 Purchase Confirmed", "🎉 *PURCHASE CONFIRMED!* 🎉"),
    };

    let web_msg = match state {
        "queued" => format!("Purchase queued for {} at ${:.2}", market_hash_name, price_dollars),
        "pending" => format!("Purchase pending confirmation for {} at ${:.2}", market_hash_name, price_dollars),
        _ => format!("Purchase confirmed for {} at ${:.2}", market_hash_name, price_dollars),
    };

    // Push web notification
    push_web_notification(
        "autobuy",
        "buy_order_filled",
        web_title,
        &web_msg,
        Some(serde_json::json!({
            "item_id": item_id,
            "skin_name": market_hash_name,
            "price": price_dollars,
            "float": float_value,
            "pattern": paint_seed,
            "rarity_name": rarity_name,
            "phase": phase,
            "wear_name": wear_name,
            "item_url": format!("https://csfloat.com/item/{}", item_id),
        })),
    );

    // Send Telegram notification if config is present
    let settings_path = crate::config::get_settings_path(profile);
    if let Ok(settings) = crate::config::load_config(&settings_path) {
        if let Some(bot) = settings.bot.as_ref() {
            let bot_token = bot.telegram_bot_token.clone();
            let chat_id = bot.telegram_chat_id.clone();
            let target_bot_token = bot.telegram_target_bot_token.clone();
            let market_hash_name_clone = market_hash_name.to_string();
            let item_id_clone = item_id.to_string();
            let wear_name_clone = wear_name.to_string();
            let tg_header_clone = tg_header.to_string();
            let state_clone = state.to_string();
            
            let float_str = float_value
                .map(|f| {
                    if f.is_f64() {
                        format!("{:.10}", f.as_f64().unwrap()).trim_end_matches('0').trim_end_matches('.').to_string()
                    } else {
                        f.to_string()
                    }
                })
                .unwrap_or_else(|| "N/A".to_string());
                
            let seed_str = paint_seed.map(|s| s.to_string()).unwrap_or_else(|| "N/A".to_string());

            tokio::spawn(async move {
                let notifier = crate::notifier::TelegramNotifier::new(
                    bot_token,
                    chat_id,
                    target_bot_token,
                );
                let alert_msg = format!(
                    "{}\n\n\
                     🔗 [Link to Item](https://csfloat.com/item/{})\n\n\
                     🔫 `{}`\n\
                     🏷️ *Wear:* `{}`\n\
                     📊 *Float:* `{}`\n\
                     🎨 *Seed:* `{}`\n\n\
                     💰 *Price:* `${:.2}`",
                    tg_header_clone,
                    item_id_clone,
                    market_hash_name_clone,
                    wear_name_clone,
                    float_str,
                    seed_str,
                    price_dollars
                );
                if state_clone == "queued" || state_clone == "pending" {
                    notifier.send_message(&alert_msg).await;
                } else {
                    notifier.send_target_message(&alert_msg).await;
                }
            });
        }
    }
}

pub fn start_buy_order_watcher() {
    tokio::spawn(async move {
        tracing::info!("[BuyOrderWatcher] Starting background trade monitor...");
        
        let mut watcher_state = load_watcher_state();
        let mut initialized = !watcher_state.last_balances.is_empty();

        loop {
            let mut sleep_secs = 60; // default once a minute
            let settings_path = crate::config::get_settings_path(None);
            if let Ok(settings) = crate::config::load_config(&settings_path) {
                if let Some(scanner) = settings.scanner.as_ref() {
                    if let Some(interval) = scanner.buy_order_check_interval {
                        if interval > 0 {
                            sleep_secs = interval;
                        }
                    }
                }
            }

            tokio::time::sleep(std::time::Duration::from_secs(sleep_secs as u64)).await;

            let mut state_changed = false;

            for profile in [None, Some("config-2")] {
                let client_res = get_sniper_client(profile);
                let (client, api_key) = match client_res {
                    Ok(c) => c,
                    Err(_) => continue,
                };

                let profile_key = profile.unwrap_or("default").to_string();

                // 1. Check balance first
                let url_me = "https://csfloat.com/api/v1/me";
                let mut req_me = client.get(url_me);
                if !api_key.is_empty() {
                    req_me = req_me.header("Authorization", &api_key);
                }

                let mut current_balance = None;
                if let Ok(resp_me) = req_me.send().await {
                    if resp_me.status() == 200 {
                        if let Ok(me_data) = resp_me.json::<serde_json::Value>().await {
                            if let Some(balance) = me_data.get("user")
                                .and_then(|u| u.get("balance"))
                                .and_then(|b| b.as_i64().or_else(|| b.as_f64().map(|f| f as i64))) 
                            {
                                current_balance = Some(balance);
                            }
                        }
                    }
                }

                let last_bal_opt = watcher_state.last_balances.get(&profile_key).cloned();
                let mut balance_decreased = false;

                if let Some(curr_bal) = current_balance {
                    if let Some(last_bal) = last_bal_opt {
                        if curr_bal != last_bal {
                            // Fetch transaction details for type and reason
                            let mut tx_type_str = "N/A".to_string();
                            let mut tx_reason_str = "N/A".to_string();
                            
                            let url_tx = "https://csfloat.com/api/v1/me/transactions?limit=5";
                            let mut req_tx = client.get(url_tx);
                            if !api_key.is_empty() {
                                req_tx = req_tx.header("Authorization", &api_key);
                            }
                            
                            if let Ok(resp_tx) = req_tx.send().await {
                                if resp_tx.status() == 200 {
                                    if let Ok(tx_data) = resp_tx.json::<serde_json::Value>().await {
                                        if let Some(tx_arr) = tx_data.get("transactions").and_then(|v| v.as_array()) {
                                            if let Some(tx) = tx_arr.first() {
                                                tx_type_str = tx.get("type").and_then(|v| v.as_str()).unwrap_or("N/A").to_string();
                                                tx_reason_str = tx.get("details")
                                                    .and_then(|d| d.get("reason"))
                                                    .and_then(|v| v.as_str())
                                                    .unwrap_or("N/A")
                                                    .to_string();
                                            }
                                        }
                                    }
                                }
                            }

                            let diff = (curr_bal - last_bal) as f64 / 100.0;
                            let sign = if diff >= 0.0 { "+" } else { "" };
                            let title = "💰 Balance Updated";
                            
                            let msg = format!(
                                "Wallet balance changed from ${:.2} to ${:.2} ({}{:.2}). Type: {}, Reason: {}",
                                last_bal as f64 / 100.0,
                                curr_bal as f64 / 100.0,
                                sign,
                                diff,
                                tx_type_str,
                                tx_reason_str
                            );
                            
                            push_web_notification("info", "system", title, &msg, None);
                            
                            let settings_path = crate::config::get_settings_path(profile);
                            if let Ok(settings) = crate::config::load_config(&settings_path) {
                                if let Some(bot) = settings.bot.as_ref() {
                                    let bot_token = bot.telegram_bot_token.clone();
                                    let chat_id = bot.telegram_chat_id.clone();
                                    let target_bot_token = bot.telegram_target_bot_token.clone();
                                    let profile_display = profile.unwrap_or("config-1").to_string();
                                    
                                    let alert_msg = format!(
                                        "💰 *BALANCE UPDATE* 💰\n\n\
                                         🏷️ *Profile:* `{}`\n\
                                         💵 *Old Balance:* `${:.2}`\n\
                                         💵 *New Balance:* `${:.2}`\n\
                                         📊 *Diff:* `{}{:.2}$`\n\
                                         📝 *Type:* `{}`\n\
                                         💬 *Reason:* `{}`",
                                        profile_display,
                                        last_bal as f64 / 100.0,
                                        curr_bal as f64 / 100.0,
                                        sign,
                                        diff,
                                        tx_type_str,
                                        tx_reason_str
                                    );
                                    
                                    tokio::spawn(async move {
                                        let notifier = crate::notifier::TelegramNotifier::new(bot_token, chat_id, target_bot_token);
                                        notifier.send_message(&alert_msg).await;
                                    });
                                }
                            }
                            
                            if curr_bal < last_bal {
                                balance_decreased = true;
                            }
                        }
                    }
                    watcher_state.last_balances.insert(profile_key.clone(), curr_bal);
                    state_changed = true;
                }

                // Pre-populate seen_transactions on startup to prevent old transactions triggering alerts later
                if !initialized {
                    let url_tx = "https://csfloat.com/api/v1/me/transactions?limit=10";
                    let mut req_tx = client.get(url_tx);
                    if !api_key.is_empty() {
                        req_tx = req_tx.header("Authorization", &api_key);
                    }
                    if let Ok(resp_tx) = req_tx.send().await {
                        if resp_tx.status() == 200 {
                            if let Ok(tx_data) = resp_tx.json::<serde_json::Value>().await {
                                if let Some(tx_arr) = tx_data.get("transactions").and_then(|v| v.as_array()) {
                                    for tx in tx_arr {
                                        if let Some(tx_id) = tx.get("id").and_then(|v| v.as_str()) {
                                            if watcher_state.seen_transactions.insert(tx_id.to_string()) {
                                                state_changed = true;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // 2. Fetch transactions if balance decreased and watcher is initialized
                if balance_decreased && initialized {
                    let url_tx = "https://csfloat.com/api/v1/me/transactions?limit=5";
                    let mut req_tx = client.get(url_tx);
                    if !api_key.is_empty() {
                        req_tx = req_tx.header("Authorization", &api_key);
                    }
                    
                    if let Ok(resp_tx) = req_tx.send().await {
                        if resp_tx.status() == 200 {
                            if let Ok(tx_data) = resp_tx.json::<serde_json::Value>().await {
                                if let Some(tx_arr) = tx_data.get("transactions").and_then(|v| v.as_array()) {
                                    for tx in tx_arr {
                                        let tx_id = match tx.get("id").and_then(|v| v.as_str()) {
                                            Some(s) => s.to_string(),
                                            None => continue,
                                        };
                                        
                                        let is_new_tx = watcher_state.seen_transactions.insert(tx_id.clone());
                                        let tx_type = tx.get("type").and_then(|v| v.as_str()).unwrap_or("");
                                        
                                        if is_new_tx {
                                            state_changed = true;
                                            if tx_type == "contract_purchased" {
                                                if let Some(contract_id) = tx.get("details").and_then(|d| d.get("contract_id")).and_then(|v| v.as_str()) {
                                                    let already_notified = watcher_state.seen_trades.values().any(|cid| cid == contract_id);
                                                    if !already_notified {
                                                        tracing::info!("🔍 [BuyOrderWatcher] Debit transaction found with new contract_id: {}. Querying trades list...", contract_id);
                                                        
                                                        let url_trades = "https://csfloat.com/api/v1/me/trades?role=buyer&limit=10";
                                                        let mut req_trades = client.get(url_trades);
                                                        if !api_key.is_empty() {
                                                            req_trades = req_trades.header("Authorization", &api_key);
                                                        }
                                                        
                                                        if let Ok(resp_trades) = req_trades.send().await {
                                                            if resp_trades.status() == 200 {
                                                                if let Ok(trades_payload) = resp_trades.json::<serde_json::Value>().await {
                                                                    if let Some(trades_arr) = trades_payload.get("trades").and_then(|v| v.as_array()) {
                                                                        for trade in trades_arr {
                                                                            let trade_id = match trade.get("id").and_then(|v| v.as_str()) {
                                                                                Some(s) => s.to_string(),
                                                                                None => continue,
                                                                            };
                                                                            
                                                                            let trade_contract_id = trade.get("contract_id").and_then(|v| v.as_str()).unwrap_or("");
                                                                            
                                                                            if trade_contract_id == contract_id {
                                                                                let trade_state = trade.get("state").and_then(|v| v.as_str()).unwrap_or("");
                                                                                if trade_state == "pending" || trade_state == "verified" || trade_state == "completed" || trade_state == "queued" {
                                                                                    watcher_state.seen_trades.insert(trade_id.clone(), trade_state.to_string());
                                                                                    trigger_trade_alert(trade, trade_state, profile).await;
                                                                                }
                                                                                break;
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // 3. Regular Trades poller
                let url_trades = "https://csfloat.com/api/v1/me/trades?role=buyer&limit=10";
                let mut req_trades = client.get(url_trades);
                if !api_key.is_empty() {
                    req_trades = req_trades.header("Authorization", &api_key);
                }

                let resp_trades = match req_trades.send().await {
                    Ok(r) => r,
                    Err(e) => {
                        tracing::debug!("[BuyOrderWatcher] Request error: {}", e);
                        continue;
                    }
                };

                if !resp_trades.status().is_success() {
                    continue;
                }

                let trades_payload: serde_json::Value = match resp_trades.json().await {
                    Ok(j) => j,
                    Err(_) => continue,
                };

                let trades_arr = match trades_payload.get("trades").and_then(|v| v.as_array()) {
                    Some(arr) => arr,
                    None => continue,
                };

                // Read user-configured alert states
                let mut alert_states = vec!["queued".to_string(), "pending".to_string(), "verified".to_string()];
                let settings_path = crate::config::get_settings_path(profile);
                if let Ok(settings) = crate::config::load_config(&settings_path) {
                    if let Some(scanner) = settings.scanner.as_ref() {
                        if let Some(states) = &scanner.buy_order_notif_states {
                            if !states.is_empty() {
                                alert_states = states.clone();
                            }
                        }
                    }
                }

                for trade in trades_arr {
                    let id = match trade.get("id").and_then(|v| v.as_str()) {
                        Some(s) => s.to_string(),
                        None => continue,
                    };

                    let state = trade.get("state").and_then(|v| v.as_str()).unwrap_or("");
                    if state != "pending" && state != "verified" && state != "completed" && state != "queued" {
                        continue;
                    }

                    // Determine if we should trigger an alert
                    let mut trigger_alert = false;
                    let old_state_opt = watcher_state.seen_trades.get(&id).cloned();
                    
                    if let Some(old_state) = old_state_opt {
                        if old_state != state {
                            watcher_state.seen_trades.insert(id.clone(), state.to_string());
                            state_changed = true;
                            if alert_states.contains(&state.to_string()) {
                                trigger_alert = true;
                            }
                        }
                    } else {
                        watcher_state.seen_trades.insert(id.clone(), state.to_string());
                        state_changed = true;
                        if alert_states.contains(&state.to_string()) {
                            trigger_alert = true;
                        }
                    }

                    if trigger_alert && initialized {
                        tracing::info!("🎯 [BuyOrderWatcher] Alert triggered for trade: {}, state: {}", id, state);
                        trigger_trade_alert(trade, state, profile).await;
                    }
                }

                // 4. Offers Timeline poller
                let url_offers = "https://csfloat.com/api/v1/me/offers-timeline?limit=10";
                let mut req_offers = client.get(url_offers);
                if !api_key.is_empty() {
                    req_offers = req_offers.header("Authorization", &api_key);
                }

                if let Ok(resp_offers) = req_offers.send().await {
                    if resp_offers.status().is_success() {
                        if let Ok(offers_json) = resp_offers.json::<serde_json::Value>().await {
                            let offers_arr = if let Some(arr) = offers_json.as_array() {
                                Some(arr.clone())
                            } else if let Some(arr) = offers_json.get("offers").and_then(|v| v.as_array()) {
                                Some(arr.clone())
                            } else if let Some(arr) = offers_json.get("data").and_then(|v| v.as_array()) {
                                Some(arr.clone())
                            } else if let Some(arr) = offers_json.get("events").and_then(|v| v.as_array()) {
                                Some(arr.clone())
                            } else {
                                None
                            };

                            if let Some(arr) = offers_arr {
                                for offer in arr {
                                    let id = match offer.get("id").and_then(|v| v.as_str()) {
                                        Some(s) => s.to_string(),
                                        None => continue,
                                    };

                                    let state = offer.get("state")
                                        .or_else(|| offer.get("status"))
                                        .or_else(|| offer.get("type"))
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("")
                                        .to_lowercase();

                                    let price_cents = offer.get("price")
                                        .and_then(|v| v.as_i64().or_else(|| v.as_f64().map(|f| f as i64)))
                                        .unwrap_or(0);
                                    let price_dollars = price_cents as f64 / 100.0;

                                    let item_name = offer.get("market_hash_name")
                                        .or_else(|| offer.get("item").and_then(|i| i.get("market_hash_name")))
                                        .or_else(|| offer.get("contract").and_then(|c| c.get("item")).and_then(|i| i.get("market_hash_name")))
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("Item")
                                        .to_string();

                                    let old_state_opt = watcher_state.seen_offers.get(&id).cloned();
                                    if old_state_opt.as_deref() != Some(&state) {
                                        watcher_state.seen_offers.insert(id.clone(), state.clone());
                                        state_changed = true;

                                        if initialized {
                                            let profile_display = profile.unwrap_or("config-1").to_string();
                                            let is_accepted = state == "accepted" || state == "approved" || state == "completed" || state == "sold";
                                            let is_declined = state == "declined" || state == "rejected" || state == "expired" || state == "cancelled";

                                            if is_accepted {
                                                tracing::info!("🤝 [BuyOrderWatcher] Offer ACCEPTED for offer {}: {} at ${:.2}", id, item_name, price_dollars);
                                                push_web_notification(
                                                    "success",
                                                    "buy_order",
                                                    "🤝 Offer Accepted!",
                                                    &format!("Your offer of ${:.2} for {} was accepted!", price_dollars, item_name),
                                                    Some(serde_json::json!({
                                                        "offer_id": id,
                                                        "price": price_dollars,
                                                        "market_hash_name": item_name
                                                    })),
                                                );

                                                let settings_path = crate::config::get_settings_path(profile);
                                                if let Ok(settings) = crate::config::load_config(&settings_path) {
                                                    if let Some(bot) = settings.bot.as_ref() {
                                                        let bot_token = bot.telegram_bot_token.clone();
                                                        let chat_id = bot.telegram_chat_id.clone();
                                                        let target_bot_token = bot.telegram_target_bot_token.clone();
                                                        let alert_msg = format!(
                                                            "🤝 *OFFER ACCEPTED* 🤝\n\n\
                                                             🏷️ *Profile:* `{}`\n\
                                                             🔫 `{}`\n\
                                                             💰 *Offer Price:* `${:.2}`",
                                                            profile_display,
                                                            item_name,
                                                            price_dollars
                                                        );
                                                        tokio::spawn(async move {
                                                            let notifier = crate::notifier::TelegramNotifier::new(bot_token, chat_id, target_bot_token);
                                                            notifier.send_message(&alert_msg).await;
                                                        });
                                                    }
                                                }
                                            } else if is_declined {
                                                tracing::info!("❌ [BuyOrderWatcher] Offer DECLINED for offer {}: {} at ${:.2}", id, item_name, price_dollars);
                                                push_web_notification(
                                                    "warning",
                                                    "buy_order",
                                                    "❌ Offer Declined",
                                                    &format!("Your offer of ${:.2} for {} was declined/expired.", price_dollars, item_name),
                                                    Some(serde_json::json!({
                                                        "offer_id": id,
                                                        "price": price_dollars,
                                                        "market_hash_name": item_name
                                                    })),
                                                );

                                                let settings_path = crate::config::get_settings_path(profile);
                                                if let Ok(settings) = crate::config::load_config(&settings_path) {
                                                    if let Some(bot) = settings.bot.as_ref() {
                                                        let bot_token = bot.telegram_bot_token.clone();
                                                        let chat_id = bot.telegram_chat_id.clone();
                                                        let target_bot_token = bot.telegram_target_bot_token.clone();
                                                        let alert_msg = format!(
                                                            "❌ *OFFER DECLINED* ❌\n\n\
                                                             🏷️ *Profile:* `{}`\n\
                                                             🔫 `{}`\n\
                                                             💰 *Offer Price:* `${:.2}`",
                                                            profile_display,
                                                            item_name,
                                                            price_dollars
                                                        );
                                                        tokio::spawn(async move {
                                                            let notifier = crate::notifier::TelegramNotifier::new(bot_token, chat_id, target_bot_token);
                                                            notifier.send_message(&alert_msg).await;
                                                        });
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if state_changed {
                save_watcher_state(&watcher_state);
            }
            initialized = true;
        }
    });
}



fn ui_prefs_file() -> std::path::PathBuf {
    std::path::PathBuf::from("../data/ui_prefs.json")
}

async fn get_ui_prefs() -> impl IntoResponse {
    let prefs = std::fs::read_to_string(ui_prefs_file())
        .ok()
        .and_then(|raw| serde_json::from_str::<serde_json::Value>(&raw).ok())
        .unwrap_or_else(|| serde_json::json!({}));
    (StatusCode::OK, Json(prefs))
}

async fn save_ui_prefs(Json(payload): Json<serde_json::Value>) -> impl IntoResponse {
    if !payload.is_object() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Payload must be a JSON object" })),
        );
    }
    let path = ui_prefs_file();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let mut prefs = std::fs::read_to_string(&path)
        .ok()
        .and_then(|raw| serde_json::from_str::<serde_json::Value>(&raw).ok())
        .unwrap_or_else(|| serde_json::json!({}));
    if let (Some(dest), Some(src)) = (prefs.as_object_mut(), payload.as_object()) {
        for (k, v) in src {
            dest.insert(k.clone(), v.clone());
        }
    } else {
        prefs = payload;
    }
    let _ = std::fs::write(&path, serde_json::to_string_pretty(&prefs).unwrap_or_default());
    (StatusCode::OK, Json(serde_json::json!({ "status": "ok" })))
}
