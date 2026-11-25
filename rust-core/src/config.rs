use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Settings {
    pub analysis: Option<AnalysisSettings>,
    pub auto_buy: Option<AutoBuySettings>,
    pub bot: Option<BotSettings>,
    pub market_data: Option<MarketDataSettings>,
    pub scanner: Option<ScannerSettings>,
    pub web_auth: Option<WebAuthSettings>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct WebAuthSettings {
    pub username: Option<String>,
    pub password: Option<String>,
    pub secret_key: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisSettings {
    pub market_price_source: Option<String>,
    pub max_spend_hourly: Option<f64>,
    pub min_balance: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Account {
    pub api_key: Option<String>,
    #[serde(default)]
    pub backup_ips: Vec<String>,
    #[serde(default = "default_true")]
    pub enabled: bool,
    pub proxy: Option<String>,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoBuySettings {
    #[serde(default)]
    pub accounts: Vec<Account>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BotSettings {
    pub telegram_bot_token: Option<String>,
    pub telegram_chat_id: Option<String>,
    pub telegram_target_bot_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketDataSettings {
    #[serde(default)]
    pub accounts: Vec<Account>,
    #[serde(default)]
    pub proxies: Vec<String>,
    #[serde(default)]
    pub use_market_proxies: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueDef {
    pub end_index: i32,
    pub name: String,
    pub start_index: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueConfig {
    pub check_interval: Option<i32>,
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub queues: HashMap<String, QueueDef>,
    pub rate_limit_threshold: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ScannerSettings {
    #[serde(default)]
    pub accounts: Vec<Account>,
    pub api_key: Option<String>,
    pub base_delay: Option<f64>,
    pub curl_28_delay: Option<f64>,
    pub max_requests_per_session: Option<i32>,
    pub max_session_age_minutes: Option<i32>,
    #[serde(default)]
    pub monitoring_proxies: Vec<String>,
    pub poll_interval_max: Option<f64>,
    pub poll_interval_min: Option<f64>,
    pub pre_delay_max: Option<f64>,
    pub pre_delay_min: Option<f64>,
    #[serde(default)]
    pub proxy_rotation_enabled: bool,
    pub queue_config: Option<QueueConfig>,
    pub request_timeout: Option<i32>,
    pub sniper_proxy: Option<String>,
    #[serde(default = "default_true")]
    pub use_proxies: bool,
    pub buy_order_check_interval: Option<i32>,
    pub buy_order_notif_states: Option<Vec<String>>,
}

pub fn get_settings_path(profile: Option<&str>) -> std::path::PathBuf {
    if let Ok(env_path) = std::env::var("CONFIG_PATH") {
        if profile.unwrap_or("config-1") == "config-2" {
            let mut path = std::path::PathBuf::from(env_path);
            let file_name = path.file_name().and_then(|f| f.to_str()).unwrap_or("settings.yaml");
            if file_name == "settings.yaml" {
                path.set_file_name("settings.config2.yaml");
            } else {
                if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                    let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("");
                    path.set_file_name(format!("{}.config2.{}", stem, ext));
                } else {
                    path.set_file_name(format!("{}.config2", file_name));
                }
            }
            return path;
        } else {
            return std::path::PathBuf::from(env_path);
        }
    }
    
    let p = profile.unwrap_or("config-1");
    if p == "config-2" {
        std::path::PathBuf::from("../config/settings.config2.yaml")
    } else {
        std::path::PathBuf::from("../config/settings.yaml")
    }
}

pub fn get_sessions_path() -> std::path::PathBuf {
    if let Ok(env_path) = std::env::var("CONFIG_PATH") {
        let path = std::path::PathBuf::from(env_path);
        if let Some(parent) = path.parent() {
            return parent.join("sessions.json");
        }
    }
    std::path::PathBuf::from("../sessions.json")
}


pub fn normalize_proxy(proxy_str: &str) -> String {
    let proxy_str = proxy_str.trim();
    if proxy_str.is_empty() {
        return String::new();
    }
    
    // Check if it has a scheme.
    let (scheme, rest) = if let Some(pos) = proxy_str.find("://") {
        (&proxy_str[..pos], &proxy_str[pos + 3..])
    } else {
        ("http", proxy_str)
    };
    
    // Splitting rest by ":"
    let parts: Vec<&str> = rest.split(':').collect();
    if parts.len() >= 4 {
        // Format: host:port:user:pass
        let host = parts[0];
        let port = parts[1];
        let user = parts[2];
        let pass = parts[3..].join(":");
        format!("{}://{}:{}@{}:{}", scheme, user, pass, host, port)
    } else {
        // Keep it as is (either scheme://host:port, scheme://user:pass@host:port, or host:port)
        proxy_str.to_string()
    }
}

pub fn load_config<P: AsRef<Path>>(path: P) -> Result<Settings, Box<dyn std::error::Error>> {
    let file_content = fs::read_to_string(path)?;
    let settings: Settings = serde_yaml::from_str(&file_content)?;
    Ok(settings)
}

pub fn save_config<P: AsRef<Path>>(path: P, settings: &Settings) -> Result<(), Box<dyn std::error::Error>> {
    let file_content = serde_yaml::to_string(settings)?;
    fs::write(path, file_content)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_proxy() {
        assert_eq!(
            normalize_proxy("socks5://anotherproxy.net:9090:user:pass"),
            "socks5://user:pass@anotherproxy.net:9090"
        );
        assert_eq!(
            normalize_proxy("socks5://192.168.1.50:2222:user:pass:extra"),
            "socks5://user:pass:extra@192.168.1.50:2222"
        );
        assert_eq!(
            normalize_proxy("socks5://user:pass@proxy.example.com:443"),
            "socks5://user:pass@proxy.example.com:443"
        );
        assert_eq!(
            normalize_proxy("my-custom-proxy.org:80:user:pass"),
            "http://user:pass@my-custom-proxy.org:80"
        );
        assert_eq!(
            normalize_proxy("12.34.56.78:12345"),
            "12.34.56.78:12345"
        );
    }
}
