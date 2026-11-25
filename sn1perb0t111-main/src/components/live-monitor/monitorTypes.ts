export interface StickerCustomPlace {
  x: number;
  y: number;
  r: number;
}

export interface StickerInfo {
  name: string;
  imageUrl: string;
  wear: number;
  slot: number;
  referencePrice: number;
  globalListings: number;
  offsetX?: number;
  offsetY?: number;
  customPlace?: StickerCustomPlace;
}

export interface CharmInfo {
  name: string;
  imageUrl: string;
  pattern: number;
  referencePrice: number;
}

export interface MonitorItem {
  id: string;
  name: string;
  weaponType: string;
  skinName: string;
  typeName?: string;
  wear: string;
  isStatTrak: boolean;
  isSouvenir: boolean;
  phase?: string;
  rarity: 'consumer' | 'industrial' | 'mil-spec' | 'restricted' | 'classified' | 'covert' | 'contraband' | 'extraordinary'
    // Agents
    | 'distinguished' | 'exceptional' | 'superior' | 'master'
    // Stickers
    | 'high-grade' | 'remarkable' | 'exotic' | 'extraordinary-sticker' | 'contraband-sticker'
    // Charms
    | 'high-grade-charm' | 'remarkable-charm' | 'exotic-charm' | 'extraordinary-charm'
    // Collectibles / Pins
    | 'high-grade-collectible' | 'remarkable-collectible' | 'exotic-collectible' | 'extraordinary-collectible' | 'contraband-collectible';
  price: number;
  priceChange: number;
  priceChangePercent: number;
  bidPrice: number;
  askPrice: number;
  float: number;
  paintSeed: number;
  paintIndex?: number;
  listedAgo: string;
  listedAt?: number;
  isOnline: boolean;
  stickerOverpay?: number;
  fadePercent?: number;
  fadeRank?: number;
  blueGemTier?: number;
  blueGemPlaysideBlue?: number;
  blueGemPlaysidePurple?: number;
  blueGemPlaysideGold?: number;
  blueGemBacksideBlue?: number;
  blueGemBacksidePurple?: number;
  blueGemBacksideGold?: number;
  bluePercent?: number;
  amberFadePercent?: number;
  imageUrl: string;
  stickers?: StickerInfo[];
  charm?: CharmInfo;
  isSold?: boolean;
  soldPrice?: number;
  badges?: string[];
  type?: string;
  floatRank?: number;
  hasRealBid?: boolean;
  hasRealAsk?: boolean;
  bidFetchAt?: number;
  loadingBid?: boolean;
  bidFetchFailed?: boolean;
  bidFetchRemaining?: number;
  bidFetchPaused?: boolean;
  loadingAsk?: boolean;
  cs2ScreenshotId?: string;
  minOfferPrice?: number;
  maxOfferDiscount?: number;
  configName?: string;
  configEmoji?: string;
}

export interface WatchlistItem extends MonitorItem {
  addedAt: Date;
  trackFilters: WatchlistFilters;
  oldListingPrice?: number;
  newListingPrice?: number;
  lastMarketCheckAt?: string;
}

export interface WatchlistFilters {
  priceDropBelow: number | null;
  priceDropPercent: number | null;
  floatBelow: number | null;
  notifyTelegram: boolean;
  notifyOnPriceChange: boolean;
  notifyOnSimilarListing: boolean;
  notes: string;
}

export const defaultWatchlistFilters: WatchlistFilters = {
  priceDropBelow: null,
  priceDropPercent: null,
  floatBelow: null,
  notifyTelegram: true,
  notifyOnPriceChange: true,
  notifyOnSimilarListing: false,
  notes: '',
};

export const getRarityColor = (rarity: MonitorItem['rarity']): string => {
  switch (rarity) {
    case 'consumer': return 'border-b-gray-400';
    case 'industrial': return 'border-b-sky-300';
    case 'mil-spec': return 'border-b-blue-500';
    case 'restricted': return 'border-b-purple-500';
    case 'classified': return 'border-b-pink-500';
    case 'covert': return 'border-b-red-500';
    case 'contraband': return 'border-b-orange-500';
    case 'extraordinary': return 'border-b-yellow-400';
    // Agents
    case 'distinguished': return 'border-b-[#4b69ff]';
    case 'exceptional': return 'border-b-[#8847ff]';
    case 'superior': return 'border-b-[#d32ce6]';
    case 'master': return 'border-b-[#eb4b4b]';
    // Stickers
    case 'high-grade': return 'border-b-[#4b69ff]';
    case 'remarkable': return 'border-b-[#8847ff]';
    case 'exotic': return 'border-b-[#d32ce6]';
    case 'extraordinary-sticker': return 'border-b-[#eb4b4b]';
    case 'contraband-sticker': return 'border-b-[#e4ae39]';
    // Charms
    case 'high-grade-charm': return 'border-b-[#4b69ff]';
    case 'remarkable-charm': return 'border-b-[#8847ff]';
    case 'exotic-charm': return 'border-b-[#d32ce6]';
    case 'extraordinary-charm': return 'border-b-[#eb4b4b]';
    // Collectibles / Pins
    case 'high-grade-collectible': return 'border-b-[#4b69ff]';
    case 'remarkable-collectible': return 'border-b-[#8847ff]';
    case 'exotic-collectible': return 'border-b-[#d32ce6]';
    case 'extraordinary-collectible': return 'border-b-[#eb4b4b]';
    case 'contraband-collectible': return 'border-b-[#e4ae39]';
    default: return 'border-b-border';
  }
};

export const getRarityBgStyle = (rarity: MonitorItem['rarity']): { background: string; stripe: string } => {
  const colors: Record<string, [string, string]> = {
    // Weapons / default
    'consumer':            ['156,163,175', '156,163,175'],
    'industrial':          ['125,211,252', '56,189,248'],
    'mil-spec':            ['96,165,250',  '59,130,246'],
    'restricted':          ['192,132,252', '168,85,247'],
    'classified':          ['244,114,182', '236,72,153'],
    'covert':              ['248,113,113', '239,68,68'],
    'contraband':          ['251,146,60',  '249,115,22'],
    'extraordinary':       ['253,224,71',  '250,204,21'],
    // Agents
    'distinguished':       ['75,105,255',  '75,105,255'],
    'exceptional':         ['136,71,255',  '136,71,255'],
    'superior':            ['211,44,230',  '211,44,230'],
    'master':              ['235,75,75',   '235,75,75'],
    // Stickers
    'high-grade':          ['75,105,255',  '75,105,255'],
    'remarkable':          ['136,71,255',  '136,71,255'],
    'exotic':              ['211,44,230',  '211,44,230'],
    'extraordinary-sticker': ['235,75,75', '235,75,75'],
    'contraband-sticker':  ['228,174,57',  '228,174,57'],
    // Charms
    'high-grade-charm':    ['75,105,255',  '75,105,255'],
    'remarkable-charm':    ['136,71,255',  '136,71,255'],
    'exotic-charm':        ['211,44,230',  '211,44,230'],
    'extraordinary-charm': ['235,75,75',   '235,75,75'],
    // Collectibles / Pins
    'high-grade-collectible':    ['75,105,255',  '75,105,255'],
    'remarkable-collectible':    ['136,71,255',  '136,71,255'],
    'exotic-collectible':        ['211,44,230',  '211,44,230'],
    'extraordinary-collectible': ['235,75,75',   '235,75,75'],
    'contraband-collectible':    ['228,174,57',  '228,174,57'],
  };
  const [light, solid] = colors[rarity] || ['128,128,128', '128,128,128'];
  return {
    background: `linear-gradient(to bottom, rgba(${light},0.08) 0%, rgba(${light},0.18) 60%, rgba(${solid},0.35) 100%)`,
    stripe: `rgb(${solid})`,
  };
};

export const getWearLabel = (float: number): string => {
  if (float < 0.07) return 'Factory New';
  if (float < 0.15) return 'Minimal Wear';
  if (float < 0.38) return 'Field-Tested';
  if (float < 0.45) return 'Well-Worn';
  return 'Battle-Scarred';
};

export const getWearShort = (float: number): string => {
  if (float < 0.07) return 'FN';
  if (float < 0.15) return 'MW';
  if (float < 0.38) return 'FT';
  if (float < 0.45) return 'WW';
  return 'BS';
};

export const getPhaseColor = (itemName: string, phase: string): string => {
  const nameLower = itemName.toLowerCase();
  const phaseLower = phase.trim().toLowerCase();

  if (nameLower.includes("gamma")) {
    if (phaseLower.includes("phase 1") || phaseLower === "p1" || phaseLower === "1") return "#20f3de";
    if (phaseLower.includes("phase 2") || phaseLower === "p2" || phaseLower === "2") return "#0fb35a";
    if (phaseLower.includes("phase 3") || phaseLower === "p3" || phaseLower === "3") return "#0ef1b5";
    if (phaseLower.includes("phase 4") || phaseLower === "p4" || phaseLower === "4") return "#30d860";
    if (phaseLower.includes("emerald")) return "#20e858";
  } else {
    // Doppler
    if (phaseLower.includes("phase 1") || phaseLower === "p1" || phaseLower === "1") return "#9d6fff";
    if (phaseLower.includes("phase 2") || phaseLower === "p2" || phaseLower === "2") return "#ff70b0";
    if (phaseLower.includes("phase 3") || phaseLower === "p3" || phaseLower === "3") return "#1164a2";
    if (phaseLower.includes("phase 4") || phaseLower === "p4" || phaseLower === "4") return "#0c38ac";
    if (phaseLower.includes("ruby")) return "#ff5050";
    if (phaseLower.includes("sapphire")) return "#007fff";
    if (phaseLower.includes("black pearl") || phaseLower.includes("blackpearl")) return "#7070a8";
  }

  return "#38bdf8"; // fallback sky-400 equivalent
};

export let serverTimeOffset = 0;

export const updateServerTimeOffset = (serverTime: number) => {
  serverTimeOffset = serverTime - Date.now();
};

