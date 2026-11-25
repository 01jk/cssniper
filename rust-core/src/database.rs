use sqlx::{sqlite::{SqlitePoolOptions, SqliteConnectOptions, SqliteJournalMode}, SqlitePool};
use std::path::Path;

pub async fn get_db_pool(db_path: &Path) -> Result<SqlitePool, sqlx::Error> {
    let connection_options = SqliteConnectOptions::new()
        .filename(db_path)
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal);
    
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(connection_options)
        .await?;
        
    Ok(pool)
}

pub async fn query_active_configs(pool: &SqlitePool) -> Result<Vec<crate::models::TargetConfig>, sqlx::Error> {
    let configs = sqlx::query_as::<_, crate::models::TargetConfig>(
        "SELECT * FROM target_configs WHERE is_active = 1"
    )
    .fetch_all(pool)
    .await?;
    
    Ok(configs)
}

pub async fn query_active_targets(pool: &SqlitePool, active_config_names: &[String]) -> Result<Vec<crate::models::TargetSkin>, sqlx::Error> {
    if active_config_names.is_empty() {
        return Ok(Vec::new());
    }

    // Workaround since sqlx doesn't fully support IN clause with dynamic array in sqlite out of the box nicely
    // we can construct the query dynamically or just fetch all active and filter in memory since sqlite is local and fast
    let query_str = format!(
        "SELECT * FROM target_skins WHERE is_active = 1 AND config_name IN ({})",
        active_config_names.iter().map(|_| "?").collect::<Vec<_>>().join(", ")
    );

    let mut query = sqlx::query_as::<_, crate::models::TargetSkin>(&query_str);
    for name in active_config_names {
        query = query.bind(name);
    }
    
    let targets = query.fetch_all(pool).await?;
    
    Ok(targets)
}
