export interface WatchlistEntry {
  id: string;
  name: string;
  market_hash_name: string;
  icon_url: string;
  price_usd: number;
  prev_price_usd: number;
  delta_percent: number;
  float_value: number;
  float_min: number;
  float_max: number;
  paint_seed: number;
  status: 'active' | 'paused';
  rarity: string;
  is_stattrak: boolean;
  is_souvenir: boolean;
  wear: string;
  added_at: string;
  last_updated: string;
}

export interface WatchlistSettings {
  threshold_percent: number;
  refresh_rate: number; // seconds
  sound_enabled: boolean;
  sound_volume: number;
  telegram_token: string;
}

export const defaultWatchlistSettings: WatchlistSettings = {
  threshold_percent: 5,
  refresh_rate: 1,
  sound_enabled: true,
  sound_volume: 50,
  telegram_token: '',
};

export interface PriceAlert {
  id: string;
  item_id: string;
  item_name: string;
  old_price: number;
  new_price: number;
  delta: number;
  delta_percent: number;
  float_value?: number;
  direction?: "up" | "down";
  change_type?: "market_price";
  timestamp: Date;
}
