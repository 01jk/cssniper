export interface PatternTier {
  id: string;
  name: string;
  note?: string; // short description / note
  imageDataUrl: string; // base64 data URL from uploaded PNG/SVG
  paintSeeds: number[];
  overlayNumber?: number | null;
  overlaySize?: number; // -20 to +20 percent
  overlayColor?: string; // hex color
  overlayOffsetX?: number; // px offset
  overlayOffsetY?: number; // px offset
  overlayFontFamily?: string; // CSS font-family for the number
}

export interface SkinOverlay {
  id: string;
  skinName: string; // e.g. "AK-47 | Case Hardened"
  tiers: PatternTier[];
  enabled: boolean;
}

const STORAGE_KEY = 'live-scanner-overlays';

export const loadOverlays = (): SkinOverlay[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SkinOverlay[];
  } catch {
    return [];
  }
};

export const saveOverlays = (overlays: SkinOverlay[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overlays));
};

export interface OverlayMatch {
  tier: PatternTier;
  skinOverlay: SkinOverlay;
}

/**
 * Check if a monitor item matches any overlay config.
 * Returns the first matching tier or null.
 */
export const findOverlayMatch = (
  itemName: string,
  paintSeed: number,
  overlays: SkinOverlay[]
): OverlayMatch | null => {
  for (const overlay of overlays) {
    if (!overlay.enabled) continue;
    // Match by skin name (case-insensitive, partial match)
    const normalizedItem = itemName.toLowerCase();
    const normalizedSkin = overlay.skinName.toLowerCase();
    if (!normalizedItem.includes(normalizedSkin) && !normalizedSkin.includes(normalizedItem)) continue;
    
    for (const tier of overlay.tiers) {
      if (tier.paintSeeds.includes(paintSeed)) {
        return { tier, skinOverlay: overlay };
      }
    }
  }
  return null;
};
