use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListingResponse {
    pub data: Option<Vec<Listing>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Listing {
    pub id: String,
    pub created_at: Option<String>,
    pub r#type: Option<String>,
    pub price: Option<i64>, // In cents
    pub min_offer_price: Option<i64>,
    pub max_offer_discount: Option<i64>,
    pub state: Option<String>,
    pub item: Option<ItemData>,
    pub reference: Option<ReferenceData>,
    #[serde(alias = "Reference")]
    pub reference_alt: Option<ReferenceData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ItemData {
    pub cs2_screenshot_id: Option<String>,
    pub asset_id: Option<String>,
    pub def_index: Option<i64>,
    pub paint_index: Option<i64>,
    pub paint_seed: Option<i64>,
    pub float_value: Option<f64>,
    pub item_name: Option<String>,
    pub market_hash_name: Option<String>,
    pub icon_url: Option<String>,
    pub wear_name: Option<String>,
    pub phase: Option<String>,
    pub phase_name: Option<String>,
    pub type_name: Option<String>,
    pub is_stattrak: Option<bool>,
    pub is_souvenir: Option<bool>,
    pub rarity_name: Option<String>,
    pub high_rank: Option<i64>,
    pub low_rank: Option<i64>,
    pub pattern: Option<i64>,
    pub keychain_pattern: Option<i64>,
    
    // Stickers
    pub stickers: Option<Vec<StickerData>>,
    
    // Charms
    pub keychains: Option<Vec<CharmData>>,
    
    // Extracted tags like blue gem
    pub blue_gem: Option<serde_json::Value>,
    pub fade: Option<serde_json::Value>,
    
    pub badges: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StickerData {
    pub slot: Option<i64>,
    pub name: Option<String>,
    pub wear: Option<f64>,
    pub offset_x: Option<f64>,
    pub offset_y: Option<f64>,
    pub rotation: Option<f64>,
    pub icon_url: Option<String>,
    pub reference: Option<ReferenceData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharmData {
    pub slot: Option<i64>,
    pub name: Option<String>,
    pub pattern: Option<i64>,
    pub collection: Option<String>,
    pub reference: Option<ReferenceData>,
    pub icon_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReferenceData {
    pub price: Option<i64>,
    pub quantity: Option<i64>,
    pub predicted_price: Option<i64>,
    pub base_price: Option<i64>,
}
