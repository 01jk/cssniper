import { MonitorFilters, defaultMonitorFilters, WearTier } from "./monitorFilterTypes";

export interface MonitorPreset {
  id: string;
  name: string;
  emoji?: string;
  filters: MonitorFilters;
  builtIn?: boolean;
}

const STORAGE_KEY = 'live-scanner-monitor-filters';
const PRESETS_KEY = 'live-scanner-monitor-presets';

// ---- Serialization (Set is not JSON-safe) ----
const serialize = (f: MonitorFilters) => ({
  ...f,
  hiddenWeaponTypes: Array.from(f.hiddenWeaponTypes),
  hiddenRarities: Array.from(f.hiddenRarities),
  hiddenCategories: Array.from(f.hiddenCategories),
  hiddenWearTiers: Array.from(f.hiddenWearTiers),
});

const deserialize = (raw: any): MonitorFilters => ({
  ...defaultMonitorFilters,
  ...raw,
  hiddenWeaponTypes: new Set(raw.hiddenWeaponTypes ?? []),
  hiddenRarities: new Set(raw.hiddenRarities ?? []),
  hiddenCategories: new Set(raw.hiddenCategories ?? []),
  hiddenWearTiers: new Set<WearTier>((raw.hiddenWearTiers ?? []) as WearTier[]),
  keywords: Array.isArray(raw.keywords) ? raw.keywords : [],
});

export const loadFilters = (): MonitorFilters => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultMonitorFilters;
    return deserialize(JSON.parse(raw));
  } catch {
    return defaultMonitorFilters;
  }
};

export const saveFilters = (f: MonitorFilters) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize(f)));
  } catch {}
};

// ---- Built-in quick presets ----
export const BUILT_IN_PRESETS: MonitorPreset[] = [
  {
    id: 'builtin-knives-only',
    name: '🔪 Knives Only',
    builtIn: true,
    filters: {
      ...defaultMonitorFilters,
      hiddenWeaponTypes: new Set([
        // hide everything that is NOT a knife by listing all non-knife weapons
        "AK-47", "M4A4", "M4A1-S", "FAMAS", "Galil AR", "AUG", "SG 553", "AWP", "SSG 08", "SCAR-20", "G3SG1",
        "USP-S", "P2000", "Glock-18", "P250", "Five-SeveN", "Tec-9", "CZ75-Auto", "Desert Eagle", "R8 Revolver", "Dual Berettas", "Zeus x27",
        "MP5-SD", "MP7", "MP9", "MAC-10", "UMP-45", "P90", "PP-Bizon",
        "Nova", "XM1014", "MAG-7", "Sawed-Off", "M249", "Negev",
        "Bloodhound Gloves", "Driver Gloves", "Hand Wraps", "Moto Gloves", "Specialist Gloves", "Sport Gloves", "Hydra Gloves", "Broken Fang Gloves",
      ]),
      hiddenCategories: new Set(['agents', 'cases']),
    },
  },
  {
    id: 'builtin-cheap',
    name: '💰 Cheap (<$50)',
    builtIn: true,
    filters: {
      ...defaultMonitorFilters,
      priceMin: '0',
      priceMax: '50',
      rangePriceFromPending: '0',
      rangePriceToPending: '50',
      rangePriceConfirmed: true,
    },
  },
  {
    id: 'builtin-high-tier',
    name: '💎 High-tier Covert+',
    builtIn: true,
    filters: {
      ...defaultMonitorFilters,
      hiddenRarities: new Set(['consumer', 'industrial', 'mil-spec', 'restricted', 'classified']),
    },
  },
  {
    id: 'builtin-clean',
    name: '🧼 Clean (no stickers/charm)',
    builtIn: true,
    filters: {
      ...defaultMonitorFilters,
      hiddenCategories: new Set(['stickered', 'charm']),
    },
  },
];

export const loadCustomPresets = (): MonitorPreset[] => {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Array<{ id: string; name: string; emoji?: string; filters: any }>;
    return arr.map(p => ({ id: p.id, name: p.name, emoji: p.emoji, filters: deserialize(p.filters) }));
  } catch {
    return [];
  }
};

export const saveCustomPresets = (presets: MonitorPreset[]) => {
  try {
    localStorage.setItem(
      PRESETS_KEY,
      JSON.stringify(presets.filter(p => !p.builtIn).map(p => ({ id: p.id, name: p.name, emoji: p.emoji, filters: serialize(p.filters) })))
    );
  } catch {}
};

