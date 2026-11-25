import { MonitorItem } from './monitorTypes';

// Mirror of Target interface from TargetConfigManager (read-only from localStorage)
interface Target {
  id: number;
  itemName: string;
  minPrice: number;
  maxPrice: number;
  isFixedPrice: boolean;
  minFloat: number;
  maxFloat: number;
  pattern: string;
  paintSeeds?: number[];
  rarity: string;
  statTrak: boolean;
  souvenir: boolean;
  normal: boolean;
  activeNotifications: boolean;
  activeAutopurchase: boolean;
  fadeMin?: number;
  fadeMax?: number;
  stickerOverpayMin?: number;
  stickerOverpayMax?: number;
}

interface Config {
  id: string;
  name: string;
  emoji?: string;
  enabled: boolean;
  targets: Target[];
}

const CONFIGS_STORAGE_KEY = 'target-manager-configs';

export const loadConfigs = (): Config[] => {
  try {
    const stored = localStorage.getItem(CONFIGS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
};

/** Check if a MonitorItem matches a single Target */
const matchesTarget = (item: MonitorItem, target: Target): boolean => {
  // Item name: "*" matches everything, otherwise must contain the target name
  if (target.itemName !== '*') {
    if (!item.name.toLowerCase().includes(target.itemName.toLowerCase())) {
      return false;
    }
  }

  // Price check (skip if both 0)
  if (target.minPrice > 0 || target.maxPrice > 0) {
    if (target.isFixedPrice) {
      if (Math.abs(item.price - target.minPrice) > 0.01) return false;
    } else {
      if (target.minPrice > 0 && item.price < target.minPrice) return false;
      if (target.maxPrice > 0 && item.price > target.maxPrice) return false;
    }
  }

  // Float check (only if target specifies maxFloat > 0)
  if (target.maxFloat > 0) {
    if (item.float < target.minFloat || item.float > target.maxFloat) return false;
  }

  // Rarity check
  if (target.rarity && target.rarity !== '') {
    if (item.rarity !== target.rarity) return false;
  }

  // StatTrak / Souvenir / Normal check
  if (target.statTrak && !target.normal && !target.souvenir) {
    if (!item.isStatTrak) return false;
  }
  if (target.souvenir && !target.normal && !target.statTrak) {
    if (!item.isSouvenir) return false;
  }

  // Paint seed check
  if (target.pattern && target.pattern !== '') {
    const seedNum = parseInt(target.pattern);
    if (!isNaN(seedNum) && item.paintSeed !== seedNum) return false;
  }
  if (target.paintSeeds && target.paintSeeds.length > 0) {
    if (!target.paintSeeds.includes(item.paintSeed)) return false;
  }

  // Fade check
  if (target.fadeMin != null && target.fadeMax != null && item.fadePercent != null) {
    if (item.fadePercent < target.fadeMin || item.fadePercent > target.fadeMax) return false;
  }

  // Sticker overpay check
  if (target.stickerOverpayMin != null && target.stickerOverpayMax != null && item.stickerOverpay != null) {
    if (item.stickerOverpay < target.stickerOverpayMin || item.stickerOverpay > target.stickerOverpayMax) return false;
  }

  return true;
};

export interface CfgMatch {
  configName: string;
  configEmoji?: string;
  targetItemName: string;
  hasNotification: boolean;
  hasAutopurchase: boolean;
}

/** Check a MonitorItem against all enabled configs, return first match or null */
export const findCfgMatch = (item: MonitorItem, configs: Config[]): CfgMatch | null => {
  for (const config of configs) {
    if (!config.enabled) continue;
    for (const target of config.targets) {
      if (matchesTarget(item, target)) {
        return {
          configName: config.name,
          configEmoji: config.emoji,
          targetItemName: target.itemName,
          hasNotification: target.activeNotifications,
          hasAutopurchase: target.activeAutopurchase,
        };
      }
    }
  }
  return null;
};
