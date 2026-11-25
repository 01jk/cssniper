mod config;
mod database;
mod models;
mod api_models;
mod analyzer;
mod scanner;
mod market_data;
mod notifier;
mod api_server;

use std::path::Path;
use crate::api_server::start_server;
use crate::database::get_db_pool;
use tracing_subscriber::fmt::writer::MakeWriterExt;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Write to stderr AND to a log file to avoid pipe broken errors
    let log_dir = std::path::Path::new("..");
    let file_appender = tracing_appender::rolling::never(log_dir, "rust_core.log");
    let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);
    tracing_subscriber::fmt()
        .with_writer(std::io::stdout.and(non_blocking))
        .with_ansi(false)
        .init();
    let _guard = _guard; // keep guard alive for process lifetime

    tracing::info!("Starting CSFloat Sniper (Rust Core)");

    // Auto-initialize CONFIG_PATH settings files from default Git configuration if they do not exist
    if std::env::var("CONFIG_PATH").is_ok() {
        let path_1 = config::get_settings_path(None);
        if !path_1.exists() {
            let default_1 = std::path::Path::new("../config/settings.yaml");
            if default_1.exists() {
                tracing::info!("Initializing settings file {:?} from {:?}", path_1, default_1);
                if let Some(parent) = path_1.parent() {
                    let _ = std::fs::create_dir_all(parent);
                }
                if let Err(e) = std::fs::copy(default_1, &path_1) {
                    tracing::error!("Failed to copy default settings to custom path: {}", e);
                }
            }
        }

        let path_2 = config::get_settings_path(Some("config-2"));
        if !path_2.exists() {
            let default_2 = std::path::Path::new("../config/settings.config2.yaml");
            if default_2.exists() {
                tracing::info!("Initializing settings file {:?} from {:?}", path_2, default_2);
                if let Some(parent) = path_2.parent() {
                    let _ = std::fs::create_dir_all(parent);
                }
                if let Err(e) = std::fs::copy(default_2, &path_2) {
                    tracing::error!("Failed to copy default settings.config2 to custom path: {}", e);
                }
            }
        }
    }

    let config_path = config::get_settings_path(None);
    tracing::info!("Loading config from {:?}", config_path);
    let _settings = match config::load_config(&config_path) {
        Ok(s) => {
            tracing::info!("Successfully loaded config from {:?}", config_path);
            s
        }
        Err(e) => {
            tracing::error!("Failed to load config from {:?}: {}", config_path, e);
            config::Settings::default()
        }
    };

    let db_path = if let Ok(env_path) = std::env::var("CONFIG_PATH") {
        let path = Path::new(&env_path);
        if let Some(parent) = path.parent() {
            let p = parent.join("cssniper.db");
            if !p.exists() {
                let default_db = std::path::Path::new("../cssniper.db");
                if default_db.exists() {
                    tracing::info!("Initializing database file {:?} from {:?}", p, default_db);
                    let _ = std::fs::create_dir_all(parent);
                    if let Err(e) = std::fs::copy(default_db, &p) {
                        tracing::error!("Failed to copy default database to custom path: {}", e);
                    }
                } else {
                    tracing::warn!("Default database not found at {:?}", default_db);
                }
            }
            p
        } else {
            std::path::PathBuf::from("../cssniper.db")
        }
    } else {
        std::path::PathBuf::from("../cssniper.db")
    };
    let pool = get_db_pool(&db_path).await?;
    tracing::info!("Connected to database at {:?}", db_path);

    // Start API server in background
    let api_pool = pool.clone();
    tokio::spawn(async move {
        start_server(api_pool).await;
    });

    tracing::info!("API Server running. Core migration is standing by.");
    
    // Prevent exit
    tokio::signal::ctrl_c().await?;
    tracing::info!("Shutting down...");

    Ok(())
}
