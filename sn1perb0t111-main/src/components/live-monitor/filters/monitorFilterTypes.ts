// Monitor Filters — Blacklist philosophy.
// Everything listed/enabled here REMOVES items from the scanner stream.

export type WearTier = 'fn' | 'mw' | 'ft' | 'ww' | 'bs';

export interface MonitorFilters {
  // Core blacklists
  hiddenWeaponTypes: Set<string>;
  hiddenRarities: Set<string>;
  hiddenCategories: Set<string>; // stattrak, souvenir, stickered, no-stickers, charm, no-charm, agents, cases, stickers, patches

  // Price
  isFixedPrice: boolean;
  priceMin: string;
  priceMax: string;
  fixedPricePending: string;
  fixedPriceConfirmed: boolean;
  rangePriceFromPending: string;
  rangePriceToPending: string;
  rangePriceConfirmed: boolean;

  // Float / Wear
  hiddenWearTiers: Set<WearTier>;
  floatMinEnabled: boolean;
  floatMaxEnabled: boolean;
  floatMin: string; // "0.00" - "1.00"
  floatMax: string;

  // Stickers / Charm presence (block on TRUE)
  blockStickerHolo: boolean;
  blockStickerFoil: boolean;
  blockStickerGold: boolean;
  blockStickerPaper: boolean;

  // Keywords block / allow
  keywordMode: 'block' | 'allow';
  keywords: string[];

  // Discount / Overpay
  discountEnabled: boolean;
  discountMin: string; // negative = overpay
  discountMax: string;
}

export const defaultMonitorFilters: MonitorFilters = {
  hiddenWeaponTypes: new Set(),
  hiddenRarities: new Set(),
  hiddenCategories: new Set(),
  isFixedPrice: false,
  priceMin: '',
  priceMax: '',
  fixedPricePending: '',
  fixedPriceConfirmed: false,
  rangePriceFromPending: '',
  rangePriceToPending: '',
  rangePriceConfirmed: false,
  hiddenWearTiers: new Set(),
  floatMinEnabled: false,
  floatMaxEnabled: false,
  floatMin: '',
  floatMax: '',
  blockStickerHolo: false,
  blockStickerFoil: false,
  blockStickerGold: false,
  blockStickerPaper: false,
  keywordMode: 'block',
  keywords: [],
  discountEnabled: false,
  discountMin: '',
  discountMax: '',
};

// ----- Reference data -----

export const WEAPON_CATEGORIES: { label: string; types: string[] }[] = [
  { label: "Knives", types: ["Karambit", "M9 Bayonet", "Butterfly Knife", "Bowie Knife", "Bayonet", "Flip Knife", "Gut Knife", "Huntsman Knife", "Falchion Knife", "Shadow Daggers", "Navaja Knife", "Stiletto Knife", "Talon Knife", "Ursus Knife", "Classic Knife", "Paracord Knife", "Survival Knife", "Nomad Knife", "Skeleton Knife", "Kukri Knife"] },
  { label: "Gloves", types: ["Bloodhound Gloves", "Driver Gloves", "Hand Wraps", "Moto Gloves", "Specialist Gloves", "Sport Gloves", "Hydra Gloves", "Broken Fang Gloves"] },
  { label: "Rifles", types: ["AK-47", "M4A4", "M4A1-S", "FAMAS", "Galil AR", "AUG", "SG 553", "AWP", "SSG 08", "SCAR-20", "G3SG1"] },
  { label: "Pistols", types: ["USP-S", "P2000", "Glock-18", "P250", "Five-SeveN", "Tec-9", "CZ75-Auto", "Desert Eagle", "R8 Revolver", "Dual Berettas", "Zeus x27"] },
  { label: "SMGs", types: ["MP5-SD", "MP7", "MP9", "MAC-10", "UMP-45", "P90", "PP-Bizon"] },
  { label: "Heavy", types: ["Nova", "XM1014", "MAG-7", "Sawed-Off", "M249", "Negev"] },
];

export const RARITIES: { value: string; label: string; color: string }[] = [
  { value: "consumer", label: "Consumer", color: "#b0c3d9" },
  { value: "industrial", label: "Industrial", color: "#5e98d9" },
  { value: "mil-spec", label: "Mil-Spec", color: "#4b69ff" },
  { value: "restricted", label: "Restricted", color: "#8847ff" },
  { value: "classified", label: "Classified", color: "#d32ce6" },
  { value: "covert", label: "Covert", color: "#eb4b4b" },
  { value: "contraband", label: "Contraband", color: "#e4ae33" },
];

export const ITEM_CATEGORIES = [
  // Special variants
  { value: "stattrak", label: "StatTrak™", color: "#f97316" },
  { value: "souvenir", label: "Souvenir", color: "#eab308" },
  // Attachments
  { value: "stickers", label: "Stickers", color: "#7c93b5" },
  { value: "charms", label: "Charms", color: "#7c93b5" },
  { value: "patches", label: "Patches", color: "#7c93b5" },
  // Item types
  { value: "agents", label: "Agents", color: "#7c93b5" },
  { value: "containers", label: "Containers", color: "#7c93b5" },
  { value: "cases", label: "Cases", color: "#7c93b5" },
  { value: "music-kits", label: "Music Kits", color: "#7c93b5" },
  { value: "collectibles", label: "Collectibles", color: "#7c93b5" },
];

export const WEAR_TIERS: { value: WearTier; label: string; range: string; color: string }[] = [
  { value: 'fn', label: 'FN', range: '0.00–0.07', color: '#22c55e' },
  { value: 'mw', label: 'MW', range: '0.07–0.15', color: '#84cc16' },
  { value: 'ft', label: 'FT', range: '0.15–0.38', color: '#eab308' },
  { value: 'ww', label: 'WW', range: '0.38–0.45', color: '#f97316' },
  { value: 'bs', label: 'BS', range: '0.45–1.00', color: '#ef4444' },
];

// ----- Counters / helpers -----

export const countActiveFilters = (f: MonitorFilters): number => {
  let n = 0;
  n += f.hiddenWeaponTypes.size;
  n += f.hiddenRarities.size;
  n += f.hiddenCategories.size;
  n += f.hiddenWearTiers.size;
  if (f.rangePriceConfirmed || f.fixedPriceConfirmed) n += 1;
  if (f.floatMinEnabled || f.floatMaxEnabled) n += 1;
  if (f.blockStickerHolo) n += 1;
  if (f.blockStickerFoil) n += 1;
  if (f.blockStickerGold) n += 1;
  if (f.blockStickerPaper) n += 1;
  if (f.keywords.length > 0) n += 1;
  if (f.discountEnabled) n += 1;
  return n;
};

// Wear tier from float
export const getWearTier = (float: number): WearTier => {
  if (float < 0.07) return 'fn';
  if (float < 0.15) return 'mw';
  if (float < 0.38) return 'ft';
  if (float < 0.45) return 'ww';
  return 'bs';
};
