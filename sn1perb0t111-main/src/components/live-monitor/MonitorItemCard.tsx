import { Eye, EyeOff, Clock, Pin, ShoppingCart, ExternalLink, Plus, Minus, ImagePlus, Sliders, Loader2, AlertTriangle, HandCoins, Send, ChevronUp, ChevronDown, X, Check, Camera, Images, Search, ZoomIn, ZoomOut, Calculator, RotateCcw, Gavel, Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { MonitorItem, StickerInfo, CharmInfo, getRarityBgStyle, getWearLabel, getPhaseColor, serverTimeOffset } from "./monitorTypes";
import { useState, useRef, useEffect, memo } from "react";
import { CfgMatch } from "./cfgMatcher";
import { OverlayMatch } from "./overlays/overlayTypes";
import { toast } from "sonner";
import { CHARMS_SET } from "./filters/charmsList";
import { getFloatRange, boundaryTier, wearBracketEdge } from "@/data/floatRanges";
import goldFloatBadgeImg from "@/assets/badges/gold_float.png";
import silverFloatBadgeImg from "@/assets/badges/silver_float.png";
import bronzeFloatBadgeImg from "@/assets/badges/bronze_float.png";
import chTier1BadgeImg from "@/assets/badges/ch_tier_1_anim.webp";
import chTier2BadgeImg from "@/assets/badges/ch_tier_2.png";
import chTier3BadgeImg from "@/assets/badges/ch_tier_3.png";
import fiMax1BadgeImg from "@/assets/badges/fi_max_1.png";
import fiMax2BadgeImg from "@/assets/badges/fi_max_2.png";
import fiMax3BadgeImg from "@/assets/badges/fi_max_3.png";

const PURGED_STORAGE_KEY = 'live-scanner-purged-screenshots';
const ACTIVE_STORAGE_KEY = 'live-scanner-active-screenshots';

const loadPurgedFromStorage = (): Set<string> => {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(PURGED_STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return new Set(arr);
      }
    }
  } catch { }
  return new Set();
};

const savePurgedToStorage = (set: Set<string>) => {
  if (typeof window === 'undefined') return;
  try {
    const entries = Array.from(set);
    // Keep last 2000 purged IDs
    const sliced = entries.slice(-2000);
    localStorage.setItem(PURGED_STORAGE_KEY, JSON.stringify(sliced));
  } catch { }
};

const loadActiveFromStorage = (): Map<string, { genAt: number; cs2ScreenshotId?: string }> => {
  const map = new Map<string, { genAt: number; cs2ScreenshotId?: string }>();
  if (typeof window === 'undefined') return map;
  try {
    const raw = localStorage.getItem(ACTIVE_STORAGE_KEY);
    if (raw) {
      const entries = JSON.parse(raw);
      if (Array.isArray(entries)) {
        entries.forEach(([id, val]: [string, any]) => {
          if (id && val && typeof val.genAt === 'number') {
            map.set(id, val);
          }
        });
      }
    }
  } catch { }
  return map;
};

const saveActiveToStorage = (map: Map<string, { genAt: number; cs2ScreenshotId?: string }>) => {
  if (typeof window === 'undefined') return;
  try {
    const entries = Array.from(map.entries());
    const sliced = entries.slice(-1000);
    localStorage.setItem(ACTIVE_STORAGE_KEY, JSON.stringify(sliced));
  } catch { }
};

const activeGeneratedScreenshots = loadActiveFromStorage();
const purgedScreenshotItems = loadPurgedFromStorage();
const loadedImagesCache = new Set<string>();
const loadedManualScreenshots = new Set<string>();

let globalScreenshotTtlMinutes = 2;
let globalScreenshotCleanupTimer: ReturnType<typeof setInterval> | null = null;

export const setGlobalScreenshotTtlMinutes = (ttlMinutes: number) => {
  globalScreenshotTtlMinutes = ttlMinutes;
};

export const getScreenshotProxyUrl = (cs2ScreenshotId: string, side: 'playside' | 'backside' = 'playside') => {
  return `/api/screenshots/proxy?cs2_screenshot_id=${cs2ScreenshotId}&side=${side}`;
};

export const purgeItemScreenshotCache = (itemId: string, cs2ScreenshotId?: string) => {
  activeGeneratedScreenshots.delete(itemId);
  saveActiveToStorage(activeGeneratedScreenshots);

  loadedManualScreenshots.delete(itemId);
  purgedScreenshotItems.add(itemId);
  savePurgedToStorage(purgedScreenshotItems);

  if (cs2ScreenshotId) {
    loadedImagesCache.delete(getScreenshotProxyUrl(cs2ScreenshotId, 'playside'));
    loadedImagesCache.delete(getScreenshotProxyUrl(cs2ScreenshotId, 'backside'));
  }
};

export const clearLoadedManualScreenshots = () => {
  loadedManualScreenshots.clear();
};

export const registerItemScreenshot = (itemId: string, cs2ScreenshotId?: string, genAt?: number) => {
  if (!cs2ScreenshotId || purgedScreenshotItems.has(itemId)) return;
  if (!activeGeneratedScreenshots.has(itemId)) {
    activeGeneratedScreenshots.set(itemId, {
      genAt: genAt || Date.now(),
      cs2ScreenshotId
    });
    saveActiveToStorage(activeGeneratedScreenshots);
    const playsideUrl = getScreenshotProxyUrl(cs2ScreenshotId, 'playside');
    loadedImagesCache.add(playsideUrl);
  }
};

export const purgeExpiredScreenshots = (ttlMinutes: number) => {
  if (ttlMinutes <= 0) return; // 0 = Unlimited
  const ttlMs = ttlMinutes * 60 * 1000;
  const now = Date.now();
  activeGeneratedScreenshots.forEach((entry, itemId) => {
    if (now - entry.genAt >= ttlMs) {
      purgeItemScreenshotCache(itemId, entry.cs2ScreenshotId);
    }
  });
};

// Global periodic cleanup worker for all generated screenshots (including off-screen/unmounted items)
if (typeof window !== 'undefined' && !globalScreenshotCleanupTimer) {
  globalScreenshotCleanupTimer = setInterval(() => {
    purgeExpiredScreenshots(globalScreenshotTtlMinutes);
  }, 2000);
}

const getSPColor = (sp: number): string => {
  const clamped = Math.max(-100, Math.min(100, sp));
  if (clamped <= 0.9) {
    return `hsl(220, 9%, 55%)`;
  }
  if (clamped <= 25) {
    return `hsl(120, 80%, 50%)`;
  }
  if (clamped <= 50) {
    return `hsl(55, 95%, 55%)`;
  }
  if (clamped <= 80) {
    const t = (clamped - 50) / 30;
    const hue = 55 - t * 30;
    return `hsl(${hue}, 90%, 52%)`;
  }
  const t = Math.min(1, (clamped - 80) / 20);
  const hue = 25 - t * 25;
  return `hsl(${hue}, 85%, ${52 - t * 12}%)`;
};

export type BuyState = 'idle' | 'confirm' | 'buying' | 'bought' | 'sold' | 'error';

const formatElapsed = (ms: number): { text: string; underMinute: boolean } => {
  if (ms < 0) ms = 0;
  const totalS = Math.floor(ms / 1000);
  const msPart = Math.floor(ms % 1000);
  if (totalS < 60) {
    return { text: `${totalS}.${msPart.toString().padStart(3, '0')}`, underMinute: true };
  }
  const m = Math.floor(totalS / 60);
  const remS = totalS % 60;
  if (m < 60) return { text: `${m}m ${remS.toString().padStart(2, '0')}s`, underMinute: false };
  const h = Math.floor(m / 60);
  const remM = m % 60;
  if (h < 24) return { text: `${h}h ${remM.toString().padStart(2, '0')}m`, underMinute: false };
  const d = Math.floor(h / 24);
  const remH = h % 24;
  return { text: `${d}d ${remH.toString().padStart(2, '0')}h`, underMinute: false };
};

const getElapsedColor = (ms: number): string => {
  if (ms >= 60_000) return 'hsl(0, 0%, 92%)';
  const t = Math.max(0, Math.min(1, ms / 60_000));
  const hue = 140 - 140 * t;
  const sat = 75 + 15 * t;
  const light = 55 - 5 * t;
  return `hsl(${hue.toFixed(1)}, ${sat.toFixed(1)}%, ${light.toFixed(1)}%)`;
};

const cap10k = (val: number): number => Math.abs(val) > 10000 ? (val >= 0 ? 9999 : -9999) : val;


const useTicker = (intervalMs: number = 1000) => {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
};

interface MonitorItemCardProps {
  item: MonitorItem;
  isWatchlisted: boolean;
  onToggleWatchlist: (item: MonitorItem) => void;
  cfgMatch?: CfgMatch | null;
  overlayMatch?: OverlayMatch | null;
  isPinned?: boolean;
  isFrozen?: boolean;
  onPin?: () => void;
  onMouseEnter?: (e?: React.MouseEvent<HTMLDivElement>) => void;
  onMouseOver?: (e?: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave?: (e?: React.MouseEvent<HTMLDivElement>) => void;
  buyLocked?: boolean;
  initialBuyState?: BuyState;
  onBuyStateChange?: (state: BuyState) => void;
  showInGameImages?: boolean;
  showScreenshots?: boolean;
  screenshotMode?: 'auto' | 'manual';
  screenshotTtlMinutes?: number;
  density?: number;
  imageScale?: number;
  rarityColorHeight?: number;
  onUpdateItem?: (itemId: string, updates: Partial<MonitorItem>) => void;
  priceDiffRef?: 'ask' | 'bid';
  includeCharmPrice?: boolean;
}


const isCharmItem = (item: MonitorItem): boolean => {
  const nameLower = item.name.toLowerCase();
  const typeLower = (item.weaponType || "").toLowerCase();
  const typeNameLower = (item.typeName || "").toLowerCase();
  if (typeNameLower === 'charm' || typeLower === 'charm' || nameLower.startsWith('charm |') || nameLower.startsWith('souvenir charm |')) {
    return true;
  }
  const cleanWpn = typeLower.replace(/^(charm|souvenir charm)\s*\|\s*/, '').trim();
  const cleanName = nameLower.replace(/^(charm|souvenir charm)\s*\|\s*/, '').trim();
  if (CHARMS_SET.has(cleanWpn) || CHARMS_SET.has(cleanName)) {
    return true;
  }
  return false;
};

const isStandaloneItem = (item: MonitorItem): boolean => {
  const nameLower = item.name.toLowerCase();
  const typeLower = (item.weaponType || "").toLowerCase();
  const typeNameLower = (item.typeName || "").toLowerCase();

  // If it's a charm, it is always standalone!
  if (isCharmItem(item)) {
    return true;
  }

  // Knives and gloves are never standalone, even if float is 0 (vanilla knives)
  if (
    typeLower.includes("knife") ||
    nameLower.includes("knife") ||
    typeLower.includes("gloves") ||
    nameLower.includes("gloves") ||
    typeLower.includes("wraps") ||
    nameLower.includes("wraps")
  ) {
    return false;
  }

  // If item has a valid wear name, it is a weapon/knife/glove, not standalone
  const wear = (item.wear || "").toLowerCase();
  if (wear && wear !== "unknown" && wear !== "") {
    const validWears = ["factory new", "minimal wear", "field-tested", "well-worn", "battle-scarred"];
    if (validWears.includes(wear)) {
      return false;
    }
  }

  if (
    typeNameLower === 'sticker' ||
    typeNameLower === 'charm' ||
    typeNameLower === 'agent' ||
    typeNameLower === 'container' ||
    typeNameLower === 'music kit' ||
    typeNameLower === 'patch' ||
    typeNameLower === 'collectible' ||
    typeLower === 'sticker' ||
    typeLower === 'charm' ||
    typeLower === 'agent' ||
    typeLower === 'case' ||
    typeLower === 'capsule' ||
    typeLower === 'music kit' ||
    typeLower === 'patch' ||
    typeLower === 'pin' ||
    typeLower === 'key' ||
    typeLower === 'tool' ||
    typeLower === 'graffiti'
  ) {
    return true;
  }

  if (
    nameLower.startsWith('sticker |') ||
    nameLower.startsWith('charm |') ||
    nameLower.startsWith('patch |') ||
    nameLower.startsWith('music kit |') ||
    nameLower.startsWith('sealed graffiti |') ||
    (nameLower.includes(' case') && !nameLower.includes('|')) ||
    (nameLower.endsWith(' case') && !nameLower.includes('|')) ||
    nameLower.includes('capsule') ||
    nameLower.includes('music kit') ||
    nameLower.includes('pin |')
  ) {
    return true;
  }

  // Agents check
  const agentRarities = ['distinguished', 'exceptional', 'superior', 'master'];
  const isNoWearItem = item.float === 0 && (item.wear === 'Unknown' || item.wear === '' || !item.wear);
  if (isNoWearItem && (
    agentRarities.some(r => nameLower.includes(r)) ||
    nameLower.includes('| sabre') || nameLower.includes('| elite crew') ||
    nameLower.includes('| swat') || nameLower.includes('| seal frogman') ||
    nameLower.includes('| sas') || nameLower.includes('| ksk') ||
    nameLower.includes('| gign') || nameLower.includes('| fbi')
  )) {
    return true;
  }

  return false;
};

const isCharm = (item: MonitorItem): boolean => {
  if (isCharmItem(item)) {
    return true;
  }
  if (isStandaloneItem(item) && item.paintSeed != null && item.paintSeed > 0) {
    return true;
  }
  return false;
};

const isAgentItem = (item: MonitorItem): boolean => {
  const nameLower = item.name.toLowerCase();
  const typeNameLower = (item.typeName || "").toLowerCase();
  if (typeNameLower === 'agent') {
    return true;
  }
  const agentRarities = ['distinguished', 'exceptional', 'superior', 'master'];
  const isNoWearItem = item.float === 0 && (item.wear === 'Unknown' || item.wear === '' || !item.wear);
  return isNoWearItem && (
    agentRarities.some(r => nameLower.includes(r)) ||
    nameLower.includes('| sabre') || nameLower.includes('| elite crew') ||
    nameLower.includes('| swat') || nameLower.includes('| seal frogman') ||
    nameLower.includes('| sas') || nameLower.includes('| ksk') ||
    nameLower.includes('| gign') || nameLower.includes('| fbi')
  );
};

const StickerKawaiiBadge = ({ className = "" }: { className?: string }) => (
  <Sliders className={className} strokeWidth={2.5} aria-hidden="true" />
);

const getStickerWearColor = (wearPct: number): string => {
  const w = Math.max(0, Math.min(100, wearPct));
  if (w <= 25) {
    const t = w / 25;
    const hue = 130 - t * 70;
    return `hsl(${hue}, 85%, 55%)`;
  }
  if (w <= 60) {
    const t = (w - 25) / 35;
    const hue = 60 - t * 35;
    return `hsl(${hue}, 90%, 55%)`;
  }
  const t = (w - 60) / 40;
  const hue = 25 - t * 25;
  return `hsl(${hue}, 90%, ${55 - t * 8}%)`;
};

const StickerIcon = ({ sticker }: { sticker: StickerInfo }) => {
  const hasCustom = !!sticker.customPlace;
  const wearPct = Math.round(sticker.wear * 100);
  const wearColor = getStickerWearColor(wearPct);
  const [open, setOpen] = useState(false);
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <div
            onPointerEnter={() => setOpen(true)}
            onPointerLeave={() => setOpen(false)}
            className="group/sticker relative h-[34px] w-[34px] flex items-center justify-center cursor-pointer overflow-visible"
          >
            <img
              src={sticker.imageUrl}
              alt={sticker.name}
              style={{ filter: `grayscale(${Math.min(1, wearPct / 100)}) brightness(${1 - Math.min(0.55, wearPct / 180)})` }}
              className="h-[34px] w-[34px] object-contain transition-all duration-200 group-hover/sticker:scale-[2.2] group-hover/sticker:!filter-none group-hover/sticker:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]"
            />
            {hasCustom && (
              <StickerKawaiiBadge className="absolute top-[1px] right-[1px] h-[7.6px] w-[7.6px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] pointer-events-none z-10 transition-opacity duration-150 group-hover/sticker:opacity-0" />
            )}
            {wearPct > 0 && (
              <span
                style={{ color: wearColor, textShadow: '0 1px 2px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,0.9)' }}
                className="absolute bottom-[-1px] right-[0px] text-[8.5px] font-bold font-mono leading-none tabular-nums pointer-events-none z-10 transition-opacity duration-150 group-hover/sticker:opacity-0"
              >
                {wearPct}%
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="center"
          className="pointer-events-none p-0 border border-border/60 bg-popover/95 backdrop-blur-md shadow-[0_8px_24px_-4px_rgba(0,0,0,0.6)] rounded-md overflow-hidden w-[234px] origin-top scale-90"
        >
          <div className="flex gap-2.5 p-2.5 border-b border-border/50 bg-gradient-to-b from-primary/[0.08] to-transparent">
            <div className="shrink-0 h-12 w-12 rounded bg-background/60 border border-border/60 flex items-center justify-center p-1">
              <img src={sticker.imageUrl} alt="" className="max-h-full max-w-full object-contain" />
            </div>
            <div className="min-w-0 flex-1 flex flex-col justify-between">
              <p className="text-[12px] font-semibold text-foreground leading-tight tracking-tight line-clamp-2">{sticker.name}</p>
              <div className="flex items-center gap-1 mt-1 flex-nowrap">
                <span className="shrink-0 px-2 py-[3px] rounded-sm bg-muted/60 text-[11.5px] font-mono font-semibold uppercase tracking-wider text-foreground">Slot {sticker.slot}</span>
                <span
                  style={{ color: wearColor, borderColor: wearColor, backgroundColor: `${wearColor}1F` }}
                  className="shrink-0 px-2 py-[3px] rounded-sm border text-[11.5px] font-mono font-semibold uppercase tracking-wider tabular-nums"
                >{(sticker.wear * 100).toFixed(0)}%</span>
                {hasCustom && (
                  <span className="shrink-0 px-1.5 py-[2px] rounded-sm bg-primary/20 border border-primary/40 text-[10px] font-mono font-bold uppercase tracking-wider text-primary">Custom</span>
                )}
              </div>
            </div>
          </div>

          {hasCustom && (
            <div className="px-2.5 py-2 border-b border-border/50 bg-primary/[0.05]">
              <div className="grid grid-cols-3 gap-1.5">
                {([['X', sticker.customPlace!.x], ['Y', sticker.customPlace!.y], ['R', sticker.customPlace!.r]] as const).map(([k, v]) => (
                  <div key={k} className="flex flex-col items-center justify-center rounded-sm bg-background/60 border border-primary/25 py-1 leading-none">
                    <span className="text-[8px] font-mono font-bold uppercase tracking-widest text-primary/70">{k}</span>
                    <span className="text-[11px] font-mono font-bold text-primary mt-1 tabular-nums">
                      {k === 'R' ? Math.round(v) : v.toFixed(4)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="px-2.5 py-2 space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Reference</span>
              <span className="text-[12px] font-mono font-bold text-emerald-400 tabular-nums">${sticker.referencePrice.toFixed(2)}</span>
            </div>
            {sticker.globalListings != null && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Listings</span>
                <span className="text-[12px] font-mono font-bold text-foreground tabular-nums">{sticker.globalListings.toLocaleString()}</span>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const FLOAT_RANK_MAP: Record<string, { url: string; label: string; color: string; glow: string; defaultRank: string }> = {
  gold_highest_float: { url: goldFloatBadgeImg, label: 'Gold Highest Float', color: '#f5c542', glow: 'rgba(245,197,66,0.5)', defaultRank: '1' },
  gold_lowest_float: { url: goldFloatBadgeImg, label: 'Gold Lowest Float', color: '#f5c542', glow: 'rgba(245,197,66,0.5)', defaultRank: '1' },
  silver_highest_float: { url: silverFloatBadgeImg, label: 'Silver Highest Float', color: '#c8cdd4', glow: 'rgba(200,205,212,0.4)', defaultRank: '2/3' },
  silver_lowest_float: { url: silverFloatBadgeImg, label: 'Silver Lowest Float', color: '#c8cdd4', glow: 'rgba(200,205,212,0.4)', defaultRank: '2/3' },
  bronze_highest_float: { url: bronzeFloatBadgeImg, label: 'Bronze Highest Float', color: '#cd7f32', glow: 'rgba(205,127,50,0.45)', defaultRank: '4/5' },
  bronze_lowest_float: { url: bronzeFloatBadgeImg, label: 'Bronze Lowest Float', color: '#cd7f32', glow: 'rgba(205,127,50,0.45)', defaultRank: '4/5' },
};

const FloatRankBadgeTooltip = ({ badges, highRank, stackMode }: { badges?: string[]; highRank?: number; stackMode?: boolean }) => {
  const [open, setOpen] = useState(false);
  if (!badges || badges.length === 0) return null;
  const rankBadge = badges.find(b => b in FLOAT_RANK_MAP);
  if (!rankBadge) return null;
  const { url, label, color, glow, defaultRank } = FLOAT_RANK_MAP[rankBadge];

  const rankToShow = highRank != null ? `#${highRank}` : `#${defaultRank}`;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <div
            className={`${stackMode ? '' : 'absolute top-0.5 left-0.5 z-20 '}select-none cursor-help transition-transform duration-150 ease-out hover:scale-[1.12] origin-top-left`}
            style={{ overflow: 'visible' }}
          >
            <div style={{ borderRadius: '8px', overflow: 'hidden', boxShadow: `0 2px 8px ${glow}, 0 0 0 1.5px ${color}66`, display: 'inline-block' }}>
              <img src={url} alt={rankBadge} style={{ height: '32px', width: '32px', objectFit: 'cover', display: 'block' }} />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="bottom" align="center" sideOffset={2}
          onPointerEnter={() => setOpen(false)}
          className="px-2 py-1.5 rounded-md border bg-background/95 backdrop-blur-sm pointer-events-none"
          style={{ borderColor: `${color}55` }}
        >
          <div className="text-[11.5px] font-semibold leading-tight" style={{ color }}>{label}</div>
          <div className="text-[10.5px] leading-tight mt-0.5 text-muted-foreground">
            Rank <span className="font-bold tabular-nums" style={{ color }}>{rankToShow}</span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const FadeBadgeTooltip = ({ fadePercent, rank, bg, flowDuration, sheenDuration, badges, stackMode }: {
  fadePercent: number;
  rank: number;
  bg: string;
  flowDuration: string;
  sheenDuration: string;
  badges?: string[];
  stackMode?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <div
            className={`${stackMode ? '' : 'absolute top-1 left-1 z-20 '}rounded-[4px] px-[7px] py-[2px] flex items-center leading-none cursor-help shadow-[0_2px_6px_-2px_rgba(0,0,0,0.6)] ring-1 ring-black/30 transition-transform duration-150 ease-out hover:scale-[1.17] origin-top-left overflow-hidden`}
            style={{
              background: bg,
              backgroundSize: '320% 100%',
              animation: `fadeBadgeFlow ${flowDuration}s linear infinite`,
            }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'linear-gradient(115deg, transparent 0%, transparent 38%, rgba(255,255,255,0.55) 50%, transparent 62%, transparent 100%)',
                backgroundSize: '220% 100%',
                animation: `fadeBadgeSheen ${sheenDuration}s linear infinite`,
                mixBlendMode: 'overlay',
              }}
            />
            <span className="relative text-[12px] font-extrabold text-white leading-none drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.7)] tabular-nums tracking-tight flex items-center">
              <span>{fadePercent.toFixed(1)}%</span>
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="center"
          sideOffset={2}
          onPointerEnter={() => setOpen(false)}
          className="px-2 py-1.5 rounded-md border border-border/60 bg-background/95 backdrop-blur-sm"
        >
          <div className="text-[11.5px] font-semibold text-foreground leading-tight">
            Fade: <span className="tabular-nums">{fadePercent.toFixed(5)}%</span>
          </div>
          {(() => {
            const rankColor =
              rank === 1
                ? '#f5c542'
                : rank <= 3
                  ? '#c8cdd4'
                  : rank <= 5
                    ? '#cd7f32'
                    : undefined;
            return (
              <div
                className="text-[11px] leading-tight mt-0.5 transition-colors"
                style={{
                  color: rankColor ?? 'hsl(var(--muted-foreground))',
                  textShadow: rankColor ? `0 0 6px ${rankColor}55` : undefined,
                  fontWeight: rankColor ? 700 : 500,
                }}
              >
                Rank <span className="tabular-nums">#{rank}</span>
              </div>
            );
          })()}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const BlueGemTierBadgeTooltip = ({ badges, stackMode }: { badges?: string[]; stackMode?: boolean }) => {
  const [open, setOpen] = useState(false);
  if (!badges || badges.length === 0) return null;
  const tierBadge = badges.find(b => b.startsWith('blue_gem_'));
  if (!tierBadge) return null;
  const tierNumber = parseInt(tierBadge.replace('blue_gem_', ''), 10);

  const tierBadgeMap: Record<string, string> = {
    blue_gem_1: chTier1BadgeImg,
    blue_gem_2: chTier2BadgeImg,
    blue_gem_3: chTier3BadgeImg,
    blue_gem_4: chTier3BadgeImg,
  };
  const url = tierBadgeMap[tierBadge];
  if (!url) return null;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <div
            className={`${stackMode ? '' : 'absolute top-0.5 left-0.5 z-20 '}select-none cursor-help transition-transform duration-150 ease-out hover:scale-[1.12] origin-top-left`}
            style={{ overflow: 'visible' }}
          >
            <img
              src={url}
              alt={tierBadge}
              style={{
                height: '30px',
                width: 'auto',
                objectFit: 'contain',
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.7))',
                display: 'block'
              }}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="bottom" align="center" sideOffset={2}
          onPointerEnter={() => setOpen(false)}
          className="px-2 py-1.5 rounded-md border border-cyan-500/40 bg-background/95 backdrop-blur-sm pointer-events-none"
        >
          <div className="text-[11.5px] font-semibold text-cyan-400 leading-tight">Case Hardened Blue Gem</div>
          <div className="text-[10.5px] leading-tight mt-0.5 text-muted-foreground">
            Tier <span className="font-bold text-cyan-300">#{tierNumber}</span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const BlueGemPercentTooltip = ({ item, stackMode }: { item: MonitorItem; stackMode?: boolean }) => {
  const [open, setOpen] = useState(false);
  const bluePercent = item.bluePercent ?? item.blueGemPlaysideBlue;
  if (bluePercent === null || bluePercent === undefined) return null;

  const flowDuration = (8.0 - Math.min(1, bluePercent / 100) * 3.5).toFixed(2);
  const sheenDuration = (5.5 - Math.min(1, bluePercent / 100) * 2.0).toFixed(2);
  const bg =
    'linear-gradient(115deg, ' +
    '#1d8fd1 0%, #2aa5e0 12%, #38bdf8 24%, #7dd3fc 36%, #bae6fd 44%, #eaf8ff 50%, ' +
    '#bae6fd 56%, #7dd3fc 64%, #38bdf8 76%, #2aa5e0 88%, #1d8fd1 100%)';
  const sparkleSheenDuration = (Number(sheenDuration) * 1.4).toFixed(2);

  const playside = {
    blue: item.blueGemPlaysideBlue ?? bluePercent,
    purple: item.blueGemPlaysidePurple ?? 0,
    gold: item.blueGemPlaysideGold ?? (100 - (item.blueGemPlaysideBlue ?? bluePercent) - (item.blueGemPlaysidePurple ?? 0))
  };
  playside.gold = Math.max(0, playside.gold);

  const backside = {
    blue: item.blueGemBacksideBlue ?? 0,
    purple: item.blueGemBacksidePurple ?? 0,
    gold: item.blueGemBacksideGold ?? (100 - (item.blueGemBacksideBlue ?? 0) - (item.blueGemBacksidePurple ?? 0))
  };
  backside.gold = Math.max(0, backside.gold);

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <div
            className={`${stackMode ? '' : 'absolute top-1 left-1 z-20 '}select-none cursor-help transition-transform duration-150 ease-out hover:scale-[1.17] origin-top-left`}
            style={{ overflow: 'visible' }}
          >
            <div
              className="rounded-[4px] flex items-center leading-none ring-1 ring-cyan-200/50 overflow-hidden"
              style={{
                background: bg,
                backgroundSize: '320% 100%',
                animation: `fadeBadgeFlow ${flowDuration}s linear infinite`,
                boxShadow: '0 1px 4px -1px rgba(14,165,233,0.45), 0 0 10px rgba(125,211,252,0.55)',
                padding: '3px 9px',
                position: 'relative',
                zIndex: 30,
              }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'linear-gradient(115deg, transparent 0%, transparent 38%, rgba(255,255,255,0.85) 50%, transparent 62%, transparent 100%)',
                  backgroundSize: '220% 100%',
                  animation: `fadeBadgeSheen ${sheenDuration}s linear infinite`,
                  mixBlendMode: 'screen',
                }}
              />
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 18% 30%, rgba(255,255,255,0.95) 0 1px, transparent 1.6px), ' +
                    'radial-gradient(circle at 72% 65%, rgba(255,255,255,0.85) 0 1px, transparent 1.6px), ' +
                    'radial-gradient(circle at 50% 20%, rgba(255,255,255,0.9) 0 0.8px, transparent 1.3px), ' +
                    'radial-gradient(circle at 88% 35%, rgba(255,255,255,0.8) 0 0.8px, transparent 1.3px), ' +
                    'radial-gradient(circle at 30% 78%, rgba(255,255,255,0.85) 0 0.8px, transparent 1.3px)',
                  animation: `blueGemTwinkle ${sparkleSheenDuration}s ease-in-out infinite`,
                  mixBlendMode: 'screen',
                }}
              />
              <span className="relative text-[14px] font-extrabold text-white leading-none drop-shadow-[0_1px_1.5px_rgba(8,47,73,0.85)] tabular-nums tracking-tight">
                {bluePercent.toFixed(1)}%
              </span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="center"
          sideOffset={2}
          onPointerEnter={() => setOpen(false)}
          className="p-2 rounded-md border border-cyan-400/40 bg-background/95 backdrop-blur-md text-xs font-mono min-w-[150px]"
        >
          <div className="border-b border-border/50 pb-0.5 text-cyan-400 font-bold uppercase tracking-wider text-[10px]">Blue Gem Percentages</div>

          <div className="space-y-0.5 mt-1">
            <div className="text-foreground font-semibold text-[10.5px] tracking-tight">Playside:</div>
            <div className="flex flex-row items-center gap-x-2.5 text-[10px] text-muted-foreground">
              <div>Blue: <span className="text-cyan-300 font-bold">{playside.blue.toFixed(1)}%</span></div>
              <div>Purple: <span className="text-purple-300 font-bold">{playside.purple.toFixed(1)}%</span></div>
              <div>Gold: <span className="text-amber-300 font-bold">{playside.gold.toFixed(1)}%</span></div>
            </div>
          </div>

          <div className="space-y-0.5 pt-1 mt-1 border-t border-border/20">
            <div className="text-foreground font-semibold text-[10.5px] tracking-tight">Backside:</div>
            <div className="flex flex-row items-center gap-x-2.5 text-[10px] text-muted-foreground">
              <div>Blue: <span className="text-cyan-300 font-bold">{backside.blue.toFixed(1)}%</span></div>
              <div>Purple: <span className="text-purple-300 font-bold">{backside.purple.toFixed(1)}%</span></div>
              <div>Gold: <span className="text-amber-300 font-bold">{backside.gold.toFixed(1)}%</span></div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const MARBLE_FADE_BADGE_MAP: Record<string, { url: string; label: string; color: string; glow: string }> = {
  fi_max_1: { url: fiMax1BadgeImg, label: 'Fire & Ice Max 1', color: '#ff3e3e', glow: 'rgba(255,62,62,0.45)' },
  fi_max_2: { url: fiMax2BadgeImg, label: 'Fire & Ice Max 2', color: '#ff5c3e', glow: 'rgba(255,92,62,0.45)' },
  fi_max_3: { url: fiMax3BadgeImg, label: 'Fire & Ice Max 3', color: '#ff7a3e', glow: 'rgba(255,122,62,0.4)' },
};

const MarbleFadeBadgeTooltip = ({ badges, stackMode }: { badges?: string[]; stackMode?: boolean }) => {
  const [open, setOpen] = useState(false);
  if (!badges || badges.length === 0) return null;
  const mfBadge = badges.find(b => b in MARBLE_FADE_BADGE_MAP);
  if (!mfBadge) return null;
  const { url, label, color, glow } = MARBLE_FADE_BADGE_MAP[mfBadge];
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <div
            className={`${stackMode ? '' : 'absolute top-0.5 left-0.5 z-20 '}select-none cursor-help transition-transform duration-150 ease-out hover:scale-[1.12] origin-top-left`}
            style={{ overflow: 'visible' }}
          >
            <div style={{ borderRadius: '8px', overflow: 'hidden', boxShadow: `0 2px 8px ${glow}, 0 0 0 1.5px ${color}66`, display: 'inline-block' }}>
              <img src={url} alt={mfBadge} style={{ height: '32px', width: 'auto', objectFit: 'contain', display: 'block' }} />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="bottom" align="center" sideOffset={2}
          onPointerEnter={() => setOpen(false)}
          className="px-2 py-1.5 rounded-md border bg-background/95 backdrop-blur-sm pointer-events-none"
          style={{ borderColor: `${color}55` }}
        >
          <div className="text-[11.5px] font-semibold leading-tight" style={{ color }}>{label}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Fire & Ice Badge</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const AmberFadeBadgeTooltip = ({ amberFadePercent, badges }: { amberFadePercent: number; badges?: string[] }) => {
  const [open, setOpen] = useState(false);
  const fp = Math.max(80, Math.min(100, amberFadePercent));
  const flowDuration = (8.0 - ((fp - 80) / 20) * 3.5).toFixed(2);
  const sheenDuration = (6.0 - ((fp - 80) / 20) * 2.0).toFixed(2);
  const bg =
    'linear-gradient(115deg, ' +
    '#7a2a05 0%, #b8480c 12%, #e07016 24%, #f59e1b 36%, #fbc02d 44%, #ffe082 50%, ' +
    '#fbc02d 56%, #f59e1b 64%, #e07016 76%, #b8480c 88%, #7a2a05 100%)';
  const rank = Math.max(1, Math.round((100 - fp) * 450 + 1));
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <div
            className="absolute top-1 left-1 z-20 rounded-[4px] px-[7px] py-[2px] flex items-center leading-none cursor-help ring-1 ring-amber-900/50 transition-transform duration-150 ease-out hover:scale-[1.17] origin-top-left overflow-hidden"
            style={{
              background: bg,
              backgroundSize: '320% 100%',
              animation: `fadeBadgeFlow ${flowDuration}s linear infinite`,
              boxShadow: '0 1px 4px -1px rgba(180,60,8,0.55), 0 0 10px rgba(251,192,45,0.45)',
            }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'linear-gradient(115deg, transparent 0%, transparent 38%, rgba(255,240,200,0.75) 50%, transparent 62%, transparent 100%)',
                backgroundSize: '220% 100%',
                animation: `fadeBadgeSheen ${sheenDuration}s linear infinite`,
                mixBlendMode: 'overlay',
              }}
            />
            <span className="relative text-[12px] font-extrabold text-white leading-none drop-shadow-[0_1px_1.5px_rgba(60,18,2,0.9)] tabular-nums tracking-tight flex items-center">
              <span>{amberFadePercent.toFixed(1)}%</span>
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="center"
          sideOffset={2}
          onPointerEnter={() => setOpen(false)}
          className="px-2 py-1.5 rounded-md border border-amber-500/40 bg-background/95 backdrop-blur-sm pointer-events-none"
        >
          <div className="text-[11.5px] font-semibold leading-tight bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(90deg,#b8480c,#f59e1b,#fbc02d)' }}>
            Amber Fade: <span className="tabular-nums">{amberFadePercent.toFixed(3)}%</span>
          </div>
          <div className="text-[10.5px] leading-tight mt-0.5 text-muted-foreground">
            Rank <span className="tabular-nums font-semibold text-foreground">#{rank}</span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const CharmPatternDots = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <circle cx="9.40" cy="2.99" r="0.85" /><circle cx="12.00" cy="2.99" r="0.85" /><circle cx="14.60" cy="2.99" r="0.85" /><circle cx="5.50" cy="5.25" r="0.85" /><circle cx="8.10" cy="5.25" r="0.85" /><circle cx="10.70" cy="5.25" r="0.85" /><circle cx="13.30" cy="5.25" r="0.85" /><circle cx="15.90" cy="5.25" r="0.85" /><circle cx="18.50" cy="5.25" r="0.85" /><circle cx="4.20" cy="7.50" r="0.85" /><circle cx="6.80" cy="7.50" r="0.85" /><circle cx="9.40" cy="7.50" r="0.85" /><circle cx="12.00" cy="7.50" r="0.85" /><circle cx="14.60" cy="7.50" r="0.85" /><circle cx="17.20" cy="7.50" r="0.85" /><circle cx="19.80" cy="7.50" r="0.85" /><circle cx="2.90" cy="9.75" r="0.85" /><circle cx="5.50" cy="9.75" r="0.85" /><circle cx="8.10" cy="9.75" r="0.85" /><circle cx="10.70" cy="9.75" r="0.85" /><circle cx="13.30" cy="9.75" r="0.85" /><circle cx="15.90" cy="9.75" r="0.85" /><circle cx="18.50" cy="9.75" r="0.85" /><circle cx="21.10" cy="9.75" r="0.85" /><circle cx="4.20" cy="12.00" r="0.85" /><circle cx="6.80" cy="12.00" r="0.85" /><circle cx="9.40" cy="12.00" r="0.85" /><circle cx="12.00" cy="12.00" r="0.85" /><circle cx="14.60" cy="12.00" r="0.85" /><circle cx="17.20" cy="12.00" r="0.85" /><circle cx="19.80" cy="12.00" r="0.85" /><circle cx="2.90" cy="14.25" r="0.85" /><circle cx="5.50" cy="14.25" r="0.85" /><circle cx="8.10" cy="14.25" r="0.85" /><circle cx="10.70" cy="14.25" r="0.85" /><circle cx="13.30" cy="14.25" r="0.85" /><circle cx="15.90" cy="14.25" r="0.85" /><circle cx="18.50" cy="14.25" r="0.85" /><circle cx="21.10" cy="14.25" r="0.85" /><circle cx="4.20" cy="16.50" r="0.85" /><circle cx="6.80" cy="16.50" r="0.85" /><circle cx="9.40" cy="16.50" r="0.85" /><circle cx="12.00" cy="16.50" r="0.85" /><circle cx="14.60" cy="16.50" r="0.85" /><circle cx="17.20" cy="16.50" r="0.85" /><circle cx="19.80" cy="16.50" r="0.85" /><circle cx="5.50" cy="18.75" r="0.85" /><circle cx="8.10" cy="18.75" r="0.85" /><circle cx="10.70" cy="18.75" r="0.85" /><circle cx="13.30" cy="18.75" r="0.85" /><circle cx="15.90" cy="18.75" r="0.85" /><circle cx="18.50" cy="18.75" r="0.85" /><circle cx="9.40" cy="21.01" r="0.85" /><circle cx="12.00" cy="21.01" r="0.85" /><circle cx="14.60" cy="21.01" r="0.85" />
  </svg>
);

const CharmIcon = ({ charm }: { charm: CharmInfo }) => {
  const [open, setOpen] = useState(false);
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <div
            onPointerEnter={() => setOpen(true)}
            onPointerLeave={() => setOpen(false)}
            className="group relative h-[37px] w-[37px] flex items-center justify-center cursor-pointer -mb-[3px] mt-[3px] transition-transform duration-200 origin-bottom-left hover:scale-[1.6] hover:drop-shadow-[0_0_8px_rgba(168,85,247,0.5)] animate-in fade-in duration-200"
          >
            <CharmPatternDots className="absolute top-[1px] left-[1px] h-[8px] w-[8px] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] pointer-events-none z-10" />
            <img src={charm.imageUrl} alt={charm.name} className="h-[37px] w-[37px] object-contain" />
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="center"
          className="pointer-events-none p-0 border border-border/60 bg-popover/95 backdrop-blur-md shadow-[0_8px_24px_-4px_rgba(0,0,0,0.6)] rounded-md overflow-hidden w-[190px] origin-top scale-90"
        >
          <div className="flex gap-2.5 p-2.5 border-b border-border/50 bg-gradient-to-b from-purple-500/[0.10] to-transparent">
            <div className="shrink-0 h-12 w-12 rounded bg-background/60 border border-border/60 flex items-center justify-center p-1">
              <img src={charm.imageUrl} alt="" className="max-h-full max-w-full object-contain" />
            </div>
            <div className="min-w-0 flex-1 flex flex-col justify-between">
              <p className="text-[12px] font-semibold text-foreground leading-tight tracking-tight line-clamp-2">{charm.name.replace('Charm | ', '')}</p>
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                <span className="px-2 py-1 rounded bg-purple-500/30 border border-purple-500/60 text-[13px] font-mono font-black uppercase tracking-wider text-purple-200 tabular-nums shadow-[0_0_8px_rgba(168,85,247,0.35)]">#{charm.pattern}</span>
              </div>
            </div>
          </div>
          <div className="px-2.5 py-2 space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Reference</span>
              <span className="text-[12px] font-mono font-bold text-emerald-400 tabular-nums">${charm.referencePrice.toFixed(2)}</span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const BuyOverlay = ({
  price,
  priceChange,
  priceChangePercent,
  onBuy,
  locked,
  currentState,
  errorReason,
  onStateChange,
  refPrice,
  refType,
  isAuction,
}: {
  price: number;
  priceChange: number;
  priceChangePercent: number;
  onBuy: () => void;
  locked?: boolean;
  currentState: BuyState;
  errorReason?: string | null;
  onStateChange?: (state: BuyState) => void;
  refPrice?: number | null;
  refType?: 'ask' | 'bid';
  isAuction?: boolean;
}) => {
  const positive = priceChange >= 0;

  useEffect(() => {
    if (currentState === 'confirm') {
      const timer = setTimeout(() => {
        onStateChange?.('idle');
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [currentState]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentState === 'bought' || currentState === 'sold' || currentState === 'buying') {
      return;
    }
    if (currentState === 'error') {
      onStateChange?.('idle');
      return;
    }
    if (!locked) {
      onBuy();
    } else {
      if (currentState === 'confirm') {
        onBuy();
      } else {
        onStateChange?.('confirm');
      }
    }
  };

  let containerClass = "absolute inset-0 z-10 flex flex-col items-center justify-center gap-0.5 text-center transition-all duration-150 backdrop-blur-sm rounded ";
  if (currentState === 'sold') {
    containerClass += 'opacity-100 bg-background/80 ring-1 ring-destructive/60';
  } else if (currentState === 'bought') {
    containerClass += 'opacity-100 bg-gradient-to-b from-accent/30 via-accent/50 to-accent/30 ring-1 ring-accent/50';
  } else if (currentState === 'buying' || currentState === 'confirm' || currentState === 'error') {
    containerClass += 'opacity-100 bg-background/80';
  } else {
    containerClass += locked
      ? 'opacity-0 bg-background/70 hover:opacity-100 hover:bg-background/80 active:scale-[0.97]'
      : 'opacity-0 group-hover/buy:opacity-100 bg-background/70 hover:bg-background/80 active:scale-[0.97]';

    if (refPrice !== null && refPrice !== undefined && !isAuction) {
      if (refType === 'bid') {
        containerClass += ' border border-amber-500/50 shadow-[inset_0_0_6px_rgba(245,158,11,0.1),0_0_8px_rgba(245,158,11,0.25)]';
      }
    }
  }

  return (
    <button onClick={handleClick} className={containerClass}>
      {(() => {
        if (currentState === 'sold') {
          return (
            <div className="flex flex-col items-center justify-center animate-in fade-in duration-300">
              <span className="text-[10px] font-semibold text-destructive uppercase tracking-[0.15em] leading-none mb-0.5">Sold for</span>
              <span className="text-[15px] font-bold text-destructive font-mono leading-tight tracking-tight">${price.toFixed(2)}</span>
            </div>
          );
        }
        if (currentState === 'bought') {
          return (
            <div className="flex items-center gap-1.5 animate-in zoom-in-75 fade-in duration-300">
              <ShoppingCart className="h-4 w-4 text-accent animate-in spin-in-180 duration-500 drop-shadow-[0_0_4px_hsl(var(--accent)/0.6)]" />
              <span className="text-sm font-bold text-accent tracking-wider uppercase drop-shadow-[0_0_6px_hsl(var(--accent)/0.4)]">Bought!</span>
            </div>
          );
        }
        if (currentState === 'buying') {
          return (
            <div className="flex flex-col items-center justify-center gap-1 animate-in fade-in duration-300">
              <Loader2 className="h-5 w-5 text-primary animate-spin" />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Buying...</span>
            </div>
          );
        }
        if (currentState === 'error') {
          return (
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex flex-col items-center justify-center gap-0.5 animate-in zoom-in-95 duration-200 text-rose-500 cursor-help">
                    <AlertTriangle className="h-5 w-5 text-rose-500 animate-bounce" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Failed</span>
                    <span className="text-[9px] text-muted-foreground underline decoration-dotted">Click to close</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-[200px] text-center p-2 bg-background border border-border/80 rounded shadow-md text-rose-400 text-[11px] font-semibold leading-normal">
                  {errorReason || 'Unknown error occurred'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        }
        if (currentState === 'confirm') {
          return (
            <>
              <span className="text-[10px] font-semibold text-destructive uppercase tracking-widest animate-pulse">Click again to confirm</span>
              <span className="text-lg font-bold text-foreground font-mono leading-none">${price.toFixed(2)}</span>
            </>
          );
        }

        // Idle state
        let isProfitPositive = false;
        let profitPercent = 0;
        let displayDiffText = "";
        let isGreen = false;

        if (refPrice !== null && refPrice !== undefined) {
          if (refType === 'bid') {
            const profitAmount = cap10k(refPrice - price);
            profitPercent = price > 0 ? cap10k(((refPrice - price) / price) * 100) : 0;
            isProfitPositive = profitAmount >= 0;
            displayDiffText = `${isProfitPositive ? '+' : ''}${profitAmount.toFixed(2)}$ (${profitPercent.toFixed(1)}%)`;
            isGreen = isProfitPositive;
          } else {
            const diffAmount = cap10k(price - refPrice);
            const diffPercent = refPrice > 0 ? cap10k(((price - refPrice) / refPrice) * 100) : 0;
            const isOverpay = diffAmount >= 0;
            displayDiffText = `${isOverpay ? '+' : ''}${diffAmount.toFixed(2)}$ (${diffPercent.toFixed(1)}%)`;
            isGreen = !isOverpay;
          }
        }

        return (
          <>
            {isAuction ? (
              <span className="text-[10px] font-semibold uppercase tracking-widest text-violet-300 drop-shadow-[0_0_6px_rgba(139,92,246,0.6)]">
                Bid Now
              </span>
            ) : (
              <span className={`text-[10px] font-semibold uppercase tracking-widest ${locked ? 'text-muted-foreground' : 'text-primary drop-shadow-[0_0_6px_hsl(var(--primary)/0.6)]'}`}>
                {locked ? 'Buy Now' : 'Instant Buy'}
              </span>
            )}
            <span className={`text-lg font-bold font-mono leading-none ${isAuction ? 'text-violet-200' : 'text-foreground'}`}>${price.toFixed(2)}</span>
            {!isAuction && (
              refPrice !== null && refPrice !== undefined ? (
                <span className={`text-[11px] font-mono font-bold leading-none ${isGreen ? 'text-emerald-400' : 'text-rose-500'}`}>
                  {displayDiffText}
                </span>
              ) : (
                <span className={`text-[11px] font-mono font-bold leading-none ${positive ? 'text-accent' : 'text-destructive'}`}>
                  {positive ? '+' : ''}{cap10k(priceChange).toFixed(2)}$ ({cap10k(priceChangePercent).toFixed(1)}%)
                </span>
              )
            )}
          </>
        );
      })()}
    </button>
  );
};

const getMarketHashName = (item: MonitorItem): string => {
  const prefix = `${item.isStatTrak ? 'StatTrak™ ' : ''}${item.isSouvenir ? 'Souvenir ' : ''}`;

  let name = item.name;
  const typeNameLower = (item.typeName || "").toLowerCase();
  const typeLower = (item.weaponType || "").toLowerCase();

  const isCharmType = typeNameLower === 'charm' || typeLower === 'charm' || name.toLowerCase().startsWith('charm |') || name.toLowerCase().startsWith('souvenir charm |');
  const isStickerType = typeNameLower === 'sticker' || typeLower === 'sticker' || name.toLowerCase().startsWith('sticker |');

  if (isCharmType && !name.toLowerCase().startsWith('charm |') && !name.toLowerCase().startsWith('souvenir charm |')) {
    name = `Charm | ${name}`;
  } else if (isStickerType && !name.toLowerCase().startsWith('sticker |')) {
    name = `Sticker | ${name}`;
  }

  return isStandaloneItem(item)
    ? `${prefix}${name}`
    : `${prefix}${name} (${item.wear})`;
};

const askPriceCache = new Map<string, { price: number; timestamp: number; expireMs: number }>();
const pendingAskPromises = new Map<string, Promise<number | null>>();
let activePriceListPromise: Promise<boolean> | null = null;

export const updateLowestPriceCache = () => {
  if (activePriceListPromise) return activePriceListPromise;

  activePriceListPromise = (async () => {
    try {
      const res = await fetch('/api/csfloat/price-list');
      if (res.ok) {
        const data = await res.json();
        if (data && data.prices) {
          const timestamp = Date.now();
          const expireMs = 120_000 + Math.random() * 60_000;
          console.log(`[AskPrice Cache Manager] Bulk updating cache for ${Object.keys(data.prices).length} items (TTL: ${(expireMs / 1000).toFixed(0)}s)`);
          for (const [name, price] of Object.entries(data.prices)) {
            if (typeof price === 'number') {
              askPriceCache.set(name, {
                price,
                timestamp,
                expireMs
              });
            }
          }
          return true;
        }
      } else {
        console.error("[AskPrice Cache Manager] Failed to bulk fetch price list:", res.status);
      }
    } catch (err) {
      console.error("[AskPrice Cache Manager] Error bulk fetching price list:", err);
    } finally {
      activePriceListPromise = null;
    }
    return false;
  })();

  return activePriceListPromise;
};

const isScreenshotEligible = (item: MonitorItem) => {
  const typeNameLower = (item.typeName || "").toLowerCase();
  const nameLower = item.name.toLowerCase();
  const isNoWearItem = item.float === 0 && (item.wear === 'Unknown' || item.wear === '');
  const isCase = (nameLower.includes(' case') || nameLower.endsWith(' case')) && !nameLower.includes('|');
  const isCapsule = typeNameLower === 'container' || (
    (
      nameLower.includes('capsule') ||
      nameLower.includes('package') ||
      nameLower.includes('pack') ||
      nameLower.includes('gift')
    ) && (
      (item.weaponType || "").toLowerCase().includes('capsule') ||
      (item.weaponType || "").toLowerCase().includes('package') ||
      (item.weaponType || "").toLowerCase().includes('pack') ||
      (item.weaponType || "").toLowerCase().includes('gift')
    )
  );
  const agentRarities = ['distinguished', 'exceptional', 'superior', 'master'];
  const isAgent = typeNameLower === 'agent' || (isNoWearItem && !isCase && !isCapsule && (
    agentRarities.some(r => nameLower.includes(r)) ||
    nameLower.includes('| sabre') || nameLower.includes('| elite crew') ||
    nameLower.includes('| swat') || nameLower.includes('| seal frogman') ||
    nameLower.includes('| sas') || nameLower.includes('| ksk') ||
    nameLower.includes('| gign') || nameLower.includes('| fbi')
  ));

  const isMusicKit = typeNameLower === 'music kit' ||
    nameLower.startsWith('music kit') ||
    nameLower.includes('music kit') ||
    (item.weaponType || "").toLowerCase() === 'music kit';
  const isPatch = nameLower.startsWith('patch |') || typeNameLower === 'patch';
  const isPinCoin = nameLower.includes(' pin') || nameLower.endsWith(' pin') || nameLower.endsWith(' coin') || nameLower.endsWith(' token') || typeNameLower === 'collectible';
  const isCollectible = isPinCoin || isPatch;

  const isCharmItem = typeNameLower === 'charm' ||
    (item.weaponType || "").toLowerCase() === 'charm' ||
    nameLower.startsWith('charm |') ||
    nameLower.startsWith('souvenir charm |') ||
    (isNoWearItem && !isCase && !isCapsule && !isAgent && !isMusicKit && !isCollectible);

  const isStickerCollectible = typeNameLower === 'sticker' ||
    (item.weaponType || "").toLowerCase() === 'sticker' ||
    (isNoWearItem && !isCase && !isCapsule && !isAgent && !isCharmItem && !isMusicKit && !isCollectible && (nameLower.includes('sticker') || nameLower.includes('|')));

  if (isCase || isCapsule || isAgent || isMusicKit || isCollectible || isCharmItem || isStickerCollectible) {
    return false;
  }
  return true;
};

/**
 * Wear bar clipped to the skin's own float range: the full 0–1 gradient is
 * scaled up so that only [min…max] fills the track. The position marker lives
 * outside the clipping layer so it can overhang the bar and stay easy to spot.
 */
const FloatRangeBar = ({ float, paintIndex }: { float: number; paintIndex?: number }) => {
  const [open, setOpen] = useState(false); // follows the bar's own hover only
  const [fMin, fMax] = getFloatRange(paintIndex);
  const span = Math.max(0.0001, fMax - fMin);
  const markerPct = Math.min(100, Math.max(0, ((float - fMin) / span) * 100));
  const fmt = (v: number) => (Number.isInteger(v) ? String(v) : String(+v.toFixed(2)));

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <div
            className="relative h-[7px] cursor-help"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
          >
            {/* Clipping layer. Uses clip-path rather than overflow-hidden on purpose */}
            <div
              className="absolute inset-0 rounded-full"
              style={{ clipPath: "inset(0 round 9999px)", overflow: "hidden" }}
            >
              <div
                className="absolute inset-y-0 wear-gradient"
                style={{ width: `${100 / span}%`, left: `${(-fMin / span) * 100}%` }}
              />
            </div>
            {/* marker */}
            <div
              className="absolute top-1/2 h-[14px] w-[3px] min-w-[3px] max-w-[3px] shrink-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white ring-1 ring-black/60 shadow-[0_0_6px_rgba(255,255,255,0.85)] z-10"
              style={{ left: `${markerPct}%` }}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-[11px] text-center max-w-[190px] pointer-events-none">
          Represents the float range of the skin{" "}
          <span className="font-mono font-semibold text-primary">({fmt(fMin)}-{fmt(fMax)})</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const MonitorItemCardComponent = ({ item, isWatchlisted, onToggleWatchlist, cfgMatch, overlayMatch, isPinned, isFrozen = false, onPin, onMouseEnter, onMouseOver, onMouseLeave, buyLocked, initialBuyState, onBuyStateChange, showInGameImages = true, showScreenshots = true, screenshotMode = 'auto', screenshotTtlMinutes = 2, density = 8, imageScale = 100, rarityColorHeight = 2, onUpdateItem, priceDiffRef = 'ask', includeCharmPrice = true }: MonitorItemCardProps) => {
  const [isBackside, setIsBackside] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [viewerBackside, setViewerBackside] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const dragStartOffset = useRef({ x: 0, y: 0 });

  const [localPriceDiffRef, setLocalPriceDiffRef] = useState<'ask' | 'bid' | null>(null);
  const currentRef = localPriceDiffRef || priceDiffRef || 'ask';

  useEffect(() => {
    setGlobalScreenshotTtlMinutes(screenshotTtlMinutes);
  }, [screenshotTtlMinutes]);

  useEffect(() => {
    setLocalPriceDiffRef(null);
  }, [item.id]);



  // Bid button hold / long-press logic (0.5s) with smooth progress animation
  const [isHoldingBid, setIsHoldingBid] = useState(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);

  const startBidHold = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    isLongPressRef.current = false;
    // Holding for calculation toggle is ONLY allowed when global calculation mode is Ask
    if (priceDiffRef !== 'ask') {
      return;
    }
    setIsHoldingBid(true);

    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setIsHoldingBid(false);
      setLocalPriceDiffRef((prev) => (prev === 'bid' ? 'ask' : 'bid'));
      toast.success(currentRef === 'bid' ? "Switched to Ask calculation" : "Switched to Bid calculation", { duration: 1500 });
    }, 500);
  };

  const endBidHold = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setIsHoldingBid(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isZoomed) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    dragStartOffset.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const newX = e.clientX - dragStartOffset.current.x;
    const newY = e.clientY - dragStartOffset.current.y;
    setPanOffset({ x: newX, y: newY });
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setIsDragging(false);

    // If the mouse barely moved, count it as a click to zoom out
    const dx = Math.abs(e.clientX - dragStartPos.current.x);
    const dy = Math.abs(e.clientY - dragStartPos.current.y);
    if (dx < 5 && dy < 5) {
      setIsZoomed(false);
      setPanOffset({ x: 0, y: 0 });
    }
  };

  const screenshotContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [loadingScreenshot, setLoadingScreenshot] = useState(false);
  const [screenshotError, setScreenshotError] = useState(false);
  const [showManualScreenshot, setShowManualScreenshot] = useState(() => {
    return !purgedScreenshotItems.has(item.id) && (
      screenshotMode === 'auto' ? Boolean(item.cs2ScreenshotId) : loadedManualScreenshots.has(item.id)
    );
  });
  const [screenshotLoadedAt, setScreenshotLoadedAt] = useState<number | null>(() => {
    if (!item.cs2ScreenshotId || purgedScreenshotItems.has(item.id)) {
      return null;
    }
    const entry = activeGeneratedScreenshots.get(item.id);
    if (entry?.genAt) {
      return entry.genAt;
    }
    if (screenshotMode === 'auto') {
      const genAt = Date.now();
      activeGeneratedScreenshots.set(item.id, { genAt, cs2ScreenshotId: item.cs2ScreenshotId });
      return genAt;
    }
    return null;
  });
  const [isScreenshotExpired, setIsScreenshotExpired] = useState(() => {
    if (purgedScreenshotItems.has(item.id)) return true;
    if (screenshotTtlMinutes <= 0) return false; // Unlimited
    const entry = activeGeneratedScreenshots.get(item.id);
    if (!entry) return !item.cs2ScreenshotId;
    const ttlMs = screenshotTtlMinutes * 60 * 1000;
    return Date.now() - entry.genAt >= ttlMs;
  });

  useEffect(() => {
    const checkExpiration = () => {
      if (!item.cs2ScreenshotId || purgedScreenshotItems.has(item.id)) {
        setIsScreenshotExpired(true);
        setScreenshotLoadedAt(null);
        return;
      }

      let entry = activeGeneratedScreenshots.get(item.id);
      if (!entry && screenshotMode === 'auto') {
        const genAt = Date.now();
        entry = { genAt, cs2ScreenshotId: item.cs2ScreenshotId };
        activeGeneratedScreenshots.set(item.id, entry);
        saveActiveToStorage(activeGeneratedScreenshots);
        const playsideUrl = getScreenshotProxyUrl(item.cs2ScreenshotId, 'playside');
        loadedImagesCache.add(playsideUrl);
      }

      if (!entry) {
        setIsScreenshotExpired(false);
        setScreenshotLoadedAt(null);
        return;
      }

      if (screenshotTtlMinutes <= 0) {
        setIsScreenshotExpired(false);
        setScreenshotLoadedAt(entry.genAt);
        return;
      }

      const ttlMs = screenshotTtlMinutes * 60 * 1000;
      const elapsed = Date.now() - entry.genAt;
      if (elapsed >= ttlMs) {
        purgeItemScreenshotCache(item.id, item.cs2ScreenshotId);
        setIsScreenshotExpired(true);
        setScreenshotLoadedAt(null);
        setShowManualScreenshot(false);
      } else {
        setIsScreenshotExpired(false);
        setScreenshotLoadedAt(entry.genAt);
      }
    };

    checkExpiration();
  }, [item.id, item.cs2ScreenshotId, screenshotTtlMinutes]);

  const isScreenshotActive = Boolean(
    showScreenshots &&
    isScreenshotEligible(item) &&
    item.cs2ScreenshotId &&
    !screenshotError &&
    !isScreenshotExpired &&
    (screenshotMode === 'auto' || loadedManualScreenshots.has(item.id))
  );

  const [screenshotLoaded, setScreenshotLoaded] = useState(() => {
    if (item.cs2ScreenshotId && activeGeneratedScreenshots.has(item.id)) {
      const playsideUrl = getScreenshotProxyUrl(item.cs2ScreenshotId, 'playside');
      return loadedImagesCache.has(playsideUrl);
    }
    return false;
  });
  const [imageLoading, setImageLoading] = useState(() => {
    if (isScreenshotActive) {
      const playsideUrl = getScreenshotProxyUrl(item.cs2ScreenshotId!, 'playside');
      return !loadedImagesCache.has(playsideUrl);
    }
    return item.imageUrl ? !loadedImagesCache.has(item.imageUrl) : true;
  });

  useEffect(() => {
    const playsideUrl = item.cs2ScreenshotId ? getScreenshotProxyUrl(item.cs2ScreenshotId, 'playside') : '';
    const hasSteamLoaded = item.imageUrl ? loadedImagesCache.has(item.imageUrl) : false;
    const hasScreenshotLoaded = playsideUrl ? loadedImagesCache.has(playsideUrl) : false;

    setShowManualScreenshot(isScreenshotActive);
    setScreenshotError(false);
    setScreenshotLoaded(hasScreenshotLoaded);

    if (isScreenshotActive) {
      setImageLoading(!hasScreenshotLoaded);
    } else {
      setImageLoading(!hasSteamLoaded);
    }
  }, [item.imageUrl, item.cs2ScreenshotId, item.id, showScreenshots, screenshotMode, isScreenshotActive]);

  const handleGenerateScreenshot = async (e?: React.MouseEvent, isManual = false) => {
    const isUserManual = Boolean(e) || isManual;
    if (e) e.stopPropagation();
    if (loadingScreenshot) return;
    setLoadingScreenshot(true);
    try {
      const activeProfile = localStorage.getItem("sniper-bot-settings-active-profile") || undefined;
      let screenshotId = item.cs2ScreenshotId;
      if (!screenshotId) {
        let url = `/api/csfloat/listings/${item.id}`;
        if (activeProfile) {
          url += `?profile=${activeProfile}`;
        }
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          screenshotId = data.cs2_screenshot_id;
          if (screenshotId) {
            onUpdateItem?.(item.id, { cs2ScreenshotId: screenshotId });
          }
        }
      }

      if (screenshotId) {
        const playsideUrl = getScreenshotProxyUrl(screenshotId, 'playside');

        const preloadImage = (src: string) => {
          return new Promise<void>((resolve) => {
            const img = new window.Image();
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = src;
          });
        };

        await preloadImage(playsideUrl);

        purgedScreenshotItems.delete(item.id);
        savePurgedToStorage(purgedScreenshotItems);
        loadedImagesCache.add(playsideUrl);
        loadedManualScreenshots.add(item.id);
        const now = Date.now();
        activeGeneratedScreenshots.set(item.id, { genAt: now, cs2ScreenshotId: screenshotId });
        saveActiveToStorage(activeGeneratedScreenshots);

        setShowManualScreenshot(true);
        setScreenshotLoadedAt(now);
        setIsScreenshotExpired(false);
        if (isUserManual) {
          import('sonner').then(({ toast }) => {
            toast.success("Screenshot loaded successfully!");
          });
        }
      } else {
        if (isUserManual) {
          import('sonner').then(({ toast }) => {
            toast.error("Screenshot not generated by CSFloat yet. Try again later.");
          });
        }
      }
    } catch (err) {
      console.error("Failed to fetch screenshot ID", err);
      if (isUserManual) {
        import('sonner').then(({ toast }) => {
          toast.error("Error occurred while fetching screenshot.");
        });
      }
    } finally {
      setLoadingScreenshot(false);
    }
  };

  // Auto-fetch screenshot in 'auto' mode if item doesn't have cs2ScreenshotId yet
  const hasAutoFetchedRef = useRef(false);
  useEffect(() => {
    if (
      showScreenshots &&
      screenshotMode === 'auto' &&
      isScreenshotEligible(item) &&
      !item.cs2ScreenshotId &&
      !loadingScreenshot &&
      !screenshotError &&
      !hasAutoFetchedRef.current &&
      !purgedScreenshotItems.has(item.id)
    ) {
      hasAutoFetchedRef.current = true;
      handleGenerateScreenshot();
    }
  }, [item.id, item.cs2ScreenshotId, showScreenshots, screenshotMode, screenshotError, loadingScreenshot]);

  const handleReloadScreenshot = (e: React.MouseEvent) => {
    handleGenerateScreenshot(e);
  };

  useEffect(() => {
    const element = screenshotContainerRef.current;
    if (!element) return;
    const handleWheelEvent = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsBackside(prev => !prev);
    };
    element.addEventListener('wheel', handleWheelEvent, { passive: false });
    return () => {
      element.removeEventListener('wheel', handleWheelEvent);
    };
  }, [showScreenshots, item.cs2ScreenshotId]);

  const isCountingDown = !item.hasRealBid && item.bidFetchAt && item.bidFetchAt > Date.now();
  const elapsedMs = item.listedAt ? (Date.now() + serverTimeOffset) - item.listedAt : 0;
  useTicker((item.listedAt && elapsedMs < 60_000) || isCountingDown ? 50 : 1000);
  const elapsed = item.listedAt ? formatElapsed((Date.now() + serverTimeOffset) - item.listedAt) : null;
  const elapsedColor = item.listedAt ? getElapsedColor((Date.now() + serverTimeOffset) - item.listedAt) : undefined;
  const floatPercent = Math.min(item.float * 100, 100);
  const wearLabel = getWearLabel(item.float);

  const isAmberFade = item.name.toLowerCase().includes('amber fade');
  const isNormalFade = item.name.toLowerCase().includes('fade') && !isAmberFade;

  const fadePercent = isNormalFade ? (item.fadePercent && item.fadePercent > 0 ? item.fadePercent : undefined) : undefined;
  const amberFadePercent = isAmberFade ? (item.fadePercent && item.fadePercent > 0 ? item.fadePercent : item.amberFadePercent) : item.amberFadePercent;
  const bluePercent = item.bluePercent ?? item.blueGemPlaysideBlue;

  // Pre-compute fade badge data so it can be used outside the overflow-hidden IIFE
  const fadeBadgeData = (fadePercent != null && fadePercent > 0 && !overlayMatch) ? (() => {
    const fp = Math.max(80, Math.min(100, fadePercent));
    const tWin = 0.30 + 0.70 * ((fp - 80) / 20);
    const FCOLORS: Array<[number, string]> = [
      [0, 'rgb(221,172,128)'],
      [15, 'rgb(229,144,59)'],
      [30, 'rgb(224,117,88)'],
      [50, 'rgb(187,0,122)'],
      [75, 'rgb(200,60,150)'],
      [100, 'rgb(180,50,130)'],
    ];
    const stops: Array<[number, string]> = [];
    for (let i = 0; i < FCOLORS.length; i++) {
      const [s, c] = FCOLORS[i];
      const pos = s / tWin;
      if (pos <= 100) {
        stops.push([pos, c]);
      } else {
        const [ps, pc] = FCOLORS[i - 1];
        const prevPos = ps / tWin;
        const k = (100 - prevPos) / (pos - prevPos);
        const parsePc = (str: string) => str.match(/\d+/g)!.map(Number);
        const [r1, g1, b1] = parsePc(pc);
        const [r2, g2, b2] = parsePc(c);
        const r = Math.round(r1 + (r2 - r1) * k);
        const g = Math.round(g1 + (g2 - g1) * k);
        const b = Math.round(b1 + (b2 - b1) * k);
        stops.push([100, `rgb(${r},${g},${b})`]);
        break;
      }
    }
    const flowStops: string[] = [];
    stops.forEach(([p, c]) => flowStops.push(`${c} ${(p / 2).toFixed(2)}%`));
    for (let i = stops.length - 2; i >= 0; i--) {
      const [p, c] = stops[i];
      flowStops.push(`${c} ${(100 - p / 2).toFixed(2)}%`);
    }
    return {
      bg: `linear-gradient(115deg, ${flowStops.join(', ')})`,
      flowDuration: (8.0 - ((fp - 80) / 20) * 3.5).toFixed(2),
      sheenDuration: (6.0 - ((fp - 80) / 20) * 2.0).toFixed(2),
      rank: item.fadeRank ?? Math.max(1, Math.round((100 - fp) * 450 + 1)),
    };
  })() : null;

  const getFloatColor = (f: number): string => {
    const WHITE = 'hsl(0, 0%, 96%)';
    const CYAN = 'hsl(175, 75%, 55%)';
    const RED = 'hsl(0, 53%, 58%)';
    const GREEN = 'hsl(140, 80%, 55%)';
    const ULTRA_RED = 'hsl(0, 95%, 55%)';

    const [min, max] = getFloatRange(item.paintIndex);
    const lo = boundaryTier(f - min, min, false);   // zeros trailing the low edge
    const hi = boundaryTier(max - f, max, true);    // nines running up to the high edge

    if (lo >= hi) {
      if (lo >= 2) return GREEN;   // 0.0600… on a 0.06 floor, 0.000x on an open floor
      if (lo >= 1) return CYAN;    // 0.060…              0.00x
    } else {
      if (hi >= 2) return ULTRA_RED; // 0.799 / 0.7999 against a 0.8 ceiling
      if (hi >= 1) return RED;       // 0.79
    }

    if (f < 0.07) {
      if (f < 0.001) return GREEN;
      if (f < 0.01) return CYAN;
      if (f >= 0.06) return RED;
      return WHITE;
    }
    if (f < 0.15) {
      if (f < 0.09) return CYAN;
      if (f >= 0.14) return RED;
      return WHITE;
    }
    if (f < 0.38) {
      if (f < 0.19) return CYAN;
      if (f >= 0.31) return RED;
      return WHITE;
    }
    if (f < 0.45) {
      if (f < 0.40) return CYAN;
      if (f >= 0.44) return RED;
      return WHITE;
    }
    if (f >= 0.999) return ULTRA_RED;
    if (f >= 0.91) return RED;
    if (f < 0.50) return CYAN;
    return WHITE;
  };
  const floatColor = getFloatColor(item.float);
  const pricePositive = item.priceChange >= 0;
  const rarityStyle = getRarityBgStyle(item.rarity);
  const isSold = item.isSold === true;
  const [buyState, setBuyState] = useState<BuyState>(initialBuyState || 'idle');
  const [buyError, setBuyError] = useState<string | null>(null);
  const [bidPriceVal, setBidPriceVal] = useState<number | null>(
    item.hasRealBid ? item.bidPrice : null
  );
  const [prevBidPriceVal, setPrevBidPriceVal] = useState<number | null>(null);
  const [askPriceVal, setAskPriceVal] = useState<number | null>(
    item.hasRealAsk ? item.askPrice : null
  );
  const [prevAskPriceVal, setPrevAskPriceVal] = useState<number | null>(null);
  const [loadingBid, setLoadingBid] = useState(item.loadingBid || false);
  const [loadingAsk, setLoadingAsk] = useState(false);

  const [offerMode, setOfferMode] = useState(false);
  const [offerEditing, setOfferEditing] = useState(false);
  const [offerPrice, setOfferPrice] = useState<string>("");
  const [offerSent, setOfferSent] = useState(false);
  const [offerSending, setOfferSending] = useState(false);
  const [offerDirty, setOfferDirty] = useState(false);
  const [offerStepPct, setOfferStepPct] = useState<string>('0.5');
  const [offerStepEditing, setOfferStepEditing] = useState(false);
  const [stepperHover, setStepperHover] = useState(false);
  const [sendHover, setSendHover] = useState(false);
  const offerInputRef = useRef<HTMLInputElement>(null);
  const offerStepInputRef = useRef<HTMLInputElement>(null);

  const minBuyOrder = item.minOfferPrice && item.minOfferPrice > 0 ? item.minOfferPrice : (bidPriceVal !== null && bidPriceVal > 0 ? bidPriceVal : Math.max(0.01, +(item.price * 0.7).toFixed(2)));
  const maxBuyOrder = item.price;

  useEffect(() => {
    if (offerEditing && offerInputRef.current) {
      offerInputRef.current.focus();
      offerInputRef.current.select();
    }
  }, [offerEditing]);

  useEffect(() => {
    if (offerStepEditing && offerStepInputRef.current) {
      offerStepInputRef.current.focus();
      offerStepInputRef.current.select();
    }
  }, [offerStepEditing]);

  useEffect(() => {
    setLoadingBid(item.loadingBid || false);
  }, [item.loadingBid]);

  useEffect(() => {
    setPrevBidPriceVal(null);
    setBidPriceVal(item.hasRealBid ? item.bidPrice : null);
  }, [item.id, item.hasRealBid, item.bidPrice]);

  useEffect(() => {
    if (isSold) return;

    const nameWithWear = getMarketHashName(item);
    const cached = askPriceCache.get(nameWithWear);
    if (cached && Date.now() - cached.timestamp < cached.expireMs) {
      setAskPriceVal(cached.price);
      if (!item.hasRealAsk || item.askPrice !== cached.price) {
        onUpdateItem?.(item.id, { askPrice: cached.price, hasRealAsk: true });
      }
    }
  }, [item.id]);

  useEffect(() => {
    setPrevAskPriceVal(null);
    if (item.hasRealAsk) {
      setAskPriceVal(item.askPrice);
    } else {
      const nameWithWear = getMarketHashName(item);
      const cached = askPriceCache.get(nameWithWear);
      if (cached && Date.now() - cached.timestamp < cached.expireMs) {
        setAskPriceVal(cached.price);
      } else {
        setAskPriceVal(null);
      }
    }
  }, [item.id, item.hasRealAsk, item.askPrice]);

  const fetchBidPrice = async () => {
    setLoadingBid(true);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    try {
      const res = await fetch(`/api/csfloat/highest-bid?listing_id=${item.id}`, {
        signal: abortControllerRef.current?.signal
      });
      if (res.ok) {
        const data = await res.json();
        if (bidPriceVal !== null && bidPriceVal !== data.price) {
          setPrevBidPriceVal(bidPriceVal);
        }
        setBidPriceVal(data.price);
        onUpdateItem?.(item.id, { bidPrice: data.price, hasRealBid: true });
      } else {
        toast.error("Failed to load bid price");
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error(err);
        toast.error("Error loading bid price");
      }
    } finally {
      setLoadingBid(false);
    }
  };

  const handleBidClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLongPressRef.current) {
      isLongPressRef.current = false;
      return;
    }
    if (!loadingBid && (bidPriceVal === null || elapsedMs >= 300_000)) {
      fetchBidPrice();
    }
  };

  const fetchAskPrice = async (bypassCache = false, isBackground = false) => {
    const nameWithWear = getMarketHashName(item);

    if (!bypassCache) {
      const cached = askPriceCache.get(nameWithWear);
      if (cached && Date.now() - cached.timestamp < cached.expireMs) {
        const ageSec = Math.floor((Date.now() - cached.timestamp) / 1000);
        console.log(`[AskPrice] Cache Hit for: "${nameWithWear}". Price: $${cached.price} (Age: ${ageSec}s)`);
        if (askPriceVal !== null && askPriceVal !== cached.price) {
          setPrevAskPriceVal(askPriceVal);
        }
        setAskPriceVal(cached.price);
        onUpdateItem?.(item.id, { askPrice: cached.price, hasRealAsk: true });
        return;
      }

      // If a bulk price list fetch is running, wait for it!
      if (activePriceListPromise) {
        console.log(`[AskPrice] Awaiting active bulk price list fetch for: "${nameWithWear}"`);
        if (!isBackground) setLoadingAsk(true);
        try {
          await activePriceListPromise;
          const newCached = askPriceCache.get(nameWithWear);
          if (newCached && Date.now() - newCached.timestamp < newCached.expireMs) {
            console.log(`[AskPrice] Cache Hit (post-bulk) for: "${nameWithWear}". Price: $${newCached.price}`);
            if (askPriceVal !== null && askPriceVal !== newCached.price) {
              setPrevAskPriceVal(askPriceVal);
            }
            setAskPriceVal(newCached.price);
            onUpdateItem?.(item.id, { askPrice: newCached.price, hasRealAsk: true });
            return;
          }
        } catch (err) {
          console.error("Error awaiting bulk price list fetch", err);
        } finally {
          if (!isBackground) setLoadingAsk(false);
        }
      }

      if (pendingAskPromises.has(nameWithWear)) {
        console.log(`[AskPrice] Re-using pending request for: "${nameWithWear}"`);
        if (!isBackground) setLoadingAsk(true);
        try {
          const price = await pendingAskPromises.get(nameWithWear);
          if (price !== null && price !== undefined) {
            if (askPriceVal !== null && askPriceVal !== price) {
              setPrevAskPriceVal(askPriceVal);
            }
            setAskPriceVal(price);
            onUpdateItem?.(item.id, { askPrice: price, hasRealAsk: true });
          }
        } catch (err) {
          console.error("Error awaiting pending ask price fetch", err);
        } finally {
          if (!isBackground) setLoadingAsk(false);
        }
        return;
      }
    }

    // Add jitter (stagger delay) before making a network request
    if (!bypassCache) {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 800));
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    console.log(`[AskPrice] Fetching from API for: "${nameWithWear}"`);
    if (!isBackground) setLoadingAsk(true);
    const fetchPromise = (async () => {
      try {
        const res = await fetch(`/api/csfloat/lowest-price?market_hash_name=${encodeURIComponent(nameWithWear)}`, {
          signal: abortControllerRef.current?.signal
        });
        if (res.ok) {
          const data = await res.json();
          const price = data.price;
          if (typeof price === 'number') {
            const expireMs = 60_000 + Math.random() * 120_000;
            console.log(`[AskPrice] Cache Updated for: "${nameWithWear}". Price: $${price} (TTL: ${(expireMs / 1000).toFixed(0)}s)`);
            askPriceCache.set(nameWithWear, {
              price,
              timestamp: Date.now(),
              expireMs
            });
            return price;
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error("Error fetching ask price", err);
        }
      }
      return null;
    })();

    pendingAskPromises.set(nameWithWear, fetchPromise);

    try {
      const price = await fetchPromise;
      if (price !== null) {
        if (askPriceVal !== null && askPriceVal !== price) {
          setPrevAskPriceVal(askPriceVal);
        }
        setAskPriceVal(price);
        onUpdateItem?.(item.id, { askPrice: price, hasRealAsk: true });
      } else if (!bypassCache) {
        const expiredEntry = askPriceCache.get(nameWithWear);
        if (expiredEntry) {
          console.log(`[AskPrice] Failed to fetch. Falling back to expired cache entry for: "${nameWithWear}". Price: $${expiredEntry.price}`);
          if (askPriceVal !== null && askPriceVal !== expiredEntry.price) {
            setPrevAskPriceVal(askPriceVal);
          }
          setAskPriceVal(expiredEntry.price);
          onUpdateItem?.(item.id, { askPrice: expiredEntry.price, hasRealAsk: true });
        }
      }
    } finally {
      pendingAskPromises.delete(nameWithWear);
      if (!isBackground) setLoadingAsk(false);
    }
  };

  useEffect(() => {
    if (initialBuyState) {
      setBuyState(initialBuyState);
    }
  }, [initialBuyState]);

  const iconBtnSize = density <= 7 ? { btn: 'h-7 w-7', icon: 'h-3.5 w-3.5' }
    : density <= 9 ? { btn: 'h-6 w-6', icon: 'h-3 w-3' }
      : { btn: 'h-5 w-5', icon: 'h-2.5 w-2.5' };

  const scale = Math.max(0.72, Math.min(1.22, 8 / density));
  const px = (n: number) => `${+(n * scale).toFixed(2)}px`;
  const bidAskFontSize = px(11);

  const handleBuyStateChange = (state: BuyState) => {
    setBuyState(state);
    onBuyStateChange?.(state);
  };

  const handleBuy = async () => {
    setBuyState('buying');
    setBuyError(null);
    console.log(`[Buy] Initiating manual purchase for item ${item.id} (${item.name}) at price $${item.price}`);
    try {
      const activeProfile = localStorage.getItem("sniper-bot-settings-active-profile") || undefined;
      const response = await fetch('/api/csfloat/buy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          listing_id: item.id,
          total_price: Math.round(item.price * 100),
          item_name: getMarketHashName(item),
          profile: activeProfile,
          listed_at: item.listedAt || Date.now(),
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const errMsg = errJson.error || `HTTP ${response.status} ${response.statusText}`;
        throw new Error(errMsg);
      }

      console.log(`[Buy] Purchase successful for item ${item.id}`);
      toast.success(`Successfully bought ${item.name}!`);
      setBuyState('bought');
      onBuyStateChange?.('bought');

      setTimeout(() => {
        setBuyState('sold');
        onBuyStateChange?.('sold');
      }, 3000);

    } catch (err: any) {
      const errMsg = err.message || 'Unknown error';
      console.error(`[Buy] Purchase failed for item ${item.id}:`, err);
      toast.error(`Failed to buy ${item.name}: ${errMsg}`);
      setBuyState('error');
      setBuyError(errMsg);
      onBuyStateChange?.('error');
    }
  };

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return (
    <div
      className={`bg-card rounded-lg border border-border/50 ${isSold ? 'brightness-[0.45]' : ''} ${isPinned ? 'z-10' : 'hover:border-border'} transition-all group relative overflow-hidden cursor-pointer flex flex-col`}
      onClick={isSold ? undefined : onPin}
      onMouseEnter={onMouseEnter}
      onMouseOver={onMouseOver}
      onMouseLeave={onMouseLeave}
    >
      {isPinned && (
        <div className="pointer-events-none absolute inset-0 z-40 rounded-lg pinned-border-anim" />
      )}
      {/* Hover-freeze highlight — icy teal, distinct from the yellow pinned frame */}
      {isFrozen && !isPinned && (
        <>
          <div className="pointer-events-none absolute inset-0 z-40 rounded-lg frozen-border-anim" />
          <div className="pointer-events-none absolute inset-0 z-[39] rounded-lg frozen-glow" />
          <div className="absolute top-0 right-0 z-50 bg-gradient-to-r from-teal-400 to-cyan-300 text-background rounded-tr-lg rounded-bl-md pl-1.5 pr-2 py-0.5 flex items-center gap-1 shadow-[0_2px_10px_hsl(174_72%_56%/0.7)] leading-none animate-in fade-in slide-in-from-top-1 duration-200">
            <Snowflake className="h-2.5 w-2.5 frozen-flake" />
            <span className="text-[9px] font-bold uppercase tracking-wide">Frozen</span>
          </div>
        </>
      )}
      {isPinned && (
        <div className="absolute top-0 right-0 z-50 bg-cs-yellow text-background rounded-tr-lg rounded-bl-md pl-1.5 pr-2 py-0.5 flex items-center gap-1 shadow-[0_2px_8px_hsl(var(--cs-yellow)/0.6)] leading-none">
          <Pin className="h-2.5 w-2.5 fill-current" />
          <span className="text-[9px] font-bold uppercase tracking-wide">Pinned</span>
        </div>
      )}
      <div className="relative z-10 px-3 pt-2.5 pb-1 min-h-[42px] bg-background/40">
        <a
          href={`https://csfloat.com/search?market_hash_name=${encodeURIComponent(`${item.isStatTrak ? 'StatTrak™ ' : ''}${item.isSouvenir ? 'Souvenir ' : ''}${item.name}`)}&sort_by=lowest_price`}
          target="_blank"
          rel="noopener noreferrer"
          className="block font-semibold text-foreground leading-tight truncate cursor-pointer hover:text-primary transition-colors"
          style={{ fontSize: px(12) }}
          title={`Open on CSFloat: ${item.isStatTrak ? 'StatTrak™ ' : ''}${item.isSouvenir ? 'Souvenir ' : ''}${item.name}`}
          onClick={(e) => e.stopPropagation()}
        >
          {item.isStatTrak && <span className="text-cs-orange">StatTrak™ </span>}
          {item.isSouvenir && <span className="text-cs-yellow">Souvenir </span>}
          {item.name}
        </a>
        <div className="flex items-center justify-between" style={{ fontSize: px(10) }}>
          {isStandaloneItem(item) ? (
            <div className="flex items-center gap-1.5 h-4">
            </div>
          ) : (
            <p className="text-muted-foreground flex items-center gap-1.5">
              <span>{wearLabel}</span>
              {item.phase && (
                <span className="font-semibold font-mono" style={{ color: getPhaseColor(item.name, item.phase) }}>({item.phase})</span>
              )}
            </p>
          )}
          <div className="flex items-center gap-1 font-mono tabular-nums" title={item.listedAt ? new Date(item.listedAt).toLocaleString() : undefined} style={{ color: elapsedColor }}>
            <Clock className="h-2.5 w-2.5" />
            {elapsed ? (
              <span className="font-semibold" style={{ textShadow: elapsed.underMinute ? `0 0 6px ${elapsedColor}55` : undefined }}>{elapsed.text}</span>
            ) : <span className="text-muted-foreground">{item.listedAgo}</span>}
          </div>
        </div>
      </div>

      {(() => {
        const BASE_H = rarityColorHeight;
        return (
          <div className="relative mx-2 flex flex-col rounded" style={{ zIndex: 0 }}>
            <div className="relative flex items-end justify-center animate-in fade-in duration-300 overflow-hidden rounded" style={{ height: BASE_H, background: rarityStyle.background }}>
              {(() => {
                return (
                  <>
                    {showInGameImages && item.imageUrl && (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        onLoad={() => {
                          if (item.imageUrl) {
                            loadedImagesCache.add(item.imageUrl);
                          }
                        }}
                        className={`absolute inset-0 w-full h-full object-contain p-1 pointer-events-none transition-opacity duration-300 z-0 ${(isScreenshotActive && screenshotLoaded) ? 'opacity-0' : 'opacity-100'}`}
                        style={{
                          transform: `scale(${imageScale / 100})`,
                          transformOrigin: 'center',
                        }}
                        draggable={false}
                      />
                    )}

                    {isScreenshotActive && (
                      <div
                        ref={screenshotContainerRef}
                        className="absolute inset-0 w-full h-full cursor-ns-resize select-none z-10"
                      >
                        <img
                          src={getScreenshotProxyUrl(item.cs2ScreenshotId!, 'playside')}
                          alt={`${item.name} playside`}
                          decoding="async"
                          onLoad={() => {
                            const playsideUrl = getScreenshotProxyUrl(item.cs2ScreenshotId!, 'playside');
                            loadedImagesCache.add(playsideUrl);
                            setImageLoading(false);
                            setScreenshotLoaded(true);
                          }}
                          onError={() => {
                            setImageLoading(false);
                            setScreenshotError(true);
                          }}
                          className={`absolute inset-0 w-full h-full object-contain p-1 transition-opacity duration-300 ${(!isBackside && screenshotLoaded) ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                          style={{
                            transform: `scale(${imageScale / 100})`,
                            transformOrigin: 'center',
                          }}
                          draggable={false}
                        />
                        <img
                          src={getScreenshotProxyUrl(item.cs2ScreenshotId!, 'backside')}
                          alt={`${item.name} backside`}
                          decoding="async"
                          onLoad={() => {
                            const backsideUrl = getScreenshotProxyUrl(item.cs2ScreenshotId!, 'backside');
                            loadedImagesCache.add(backsideUrl);
                            setImageLoading(false);
                            setScreenshotLoaded(true);
                          }}
                          onError={() => {
                            setImageLoading(false);
                            setScreenshotError(true);
                          }}
                          className={`absolute inset-0 w-full h-full object-contain p-1 transition-opacity duration-300 ${(isBackside && screenshotLoaded) ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                          style={{
                            transform: `scale(${imageScale / 100})`,
                            transformOrigin: 'center',
                          }}
                          draggable={false}
                        />
                      </div>
                    )}
                  </>
                );
              })()}

              {imageLoading && !item.imageUrl && (
                <div className="absolute inset-0 bg-muted/20 animate-pulse rounded z-20" />
              )}

              {isCharm(item) && item.paintSeed != null && item.paintSeed > 0 && (
                <div className="absolute top-1 left-1 z-20 rounded bg-black/60 backdrop-blur-sm border border-white/10 px-2 py-0.5 text-[12px] font-mono font-bold text-white shadow-[0_1px_3px_rgba(0,0,0,0.5)] transition-transform duration-200 hover:scale-[1.25] origin-top-left cursor-pointer">
                  #{item.paintSeed}
                </div>
              )}

              {overlayMatch && overlayMatch.tier.imageDataUrl && (
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="absolute top-1 left-1 z-20 pointer-events-auto">
                        <div className="relative h-5 w-5 shrink-0">
                          <img src={overlayMatch.tier.imageDataUrl} alt={overlayMatch.tier.note || overlayMatch.tier.name} className="h-5 w-5 object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]" />
                          {overlayMatch.tier.overlayNumber != null && (
                            <span className="absolute inset-0 flex items-center justify-center font-extrabold text-[10px] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]" style={{ WebkitTextStroke: '0.5px rgba(0,0,0,0.5)', fontSize: `${10 * (1 + (overlayMatch.tier.overlaySize ?? 0) / 100)}px`, color: overlayMatch.tier.overlayColor ?? '#ffffff', transform: `translate(${(overlayMatch.tier.overlayOffsetX ?? 0) * 0.8}px, ${(overlayMatch.tier.overlayOffsetY ?? 0) * 0.8}px)` }}>{overlayMatch.tier.overlayNumber}</span>
                          )}
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" align="center" className="text-xs text-center">
                      {overlayMatch.tier.note && <p className="font-semibold">{overlayMatch.tier.note}</p>}
                      <p className="text-muted-foreground text-[11.5px]">{overlayMatch.tier.name}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {/* FadeBadgeTooltip moved outside overflow-hidden — rendered on outer wrapper */}

              {amberFadePercent != null && amberFadePercent > 0 && (fadePercent == null || fadePercent <= 0) && !overlayMatch && (
                <AmberFadeBadgeTooltip amberFadePercent={amberFadePercent} badges={item.badges} />
              )}

              <div className="absolute top-1 right-1 flex flex-col gap-1 z-30" style={{ overflow: 'visible' }}>
                <TooltipProvider delayDuration={1000}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`${iconBtnSize.btn} rounded-full transition-all hover:ring-1 hover:shadow-[0_0_8px_hsl(var(--primary)/0.45)] ${isWatchlisted ? 'bg-primary/80 hover:bg-primary/60 hover:ring-primary' : 'bg-background/60 hover:bg-background hover:ring-primary/60'}`}
                        onClick={(e) => { e.stopPropagation(); onToggleWatchlist(item); }}
                      >
                        {isWatchlisted ? <EyeOff className={`${iconBtnSize.icon} text-primary-foreground`} /> : <Eye className={`${iconBtnSize.icon} text-muted-foreground`} />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="text-xs !zoom-in-100 data-[state=closed]:!zoom-out-100 slide-in-from-right-1">
                      {isWatchlisted ? 'Remove from Watchlist' : 'Add to Watchlist'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider delayDuration={1000}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`${iconBtnSize.btn} rounded-full bg-background/60 hover:bg-background hover:ring-1 hover:ring-primary/60 hover:shadow-[0_0_8px_hsl(var(--primary)/0.45)] transition-all`}
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`https://csfloat.com/item/${item.id}`, '_blank');
                        }}
                      >
                        <ExternalLink className={`${iconBtnSize.icon} text-muted-foreground`} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="text-xs !zoom-in-100 data-[state=closed]:!zoom-out-100 slide-in-from-right-1">
                      Open on CSFloat
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {showScreenshots && isScreenshotEligible(item) && (
                  <TooltipProvider delayDuration={1000}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={isScreenshotActive ? "Open screenshot gallery" : "Generate image"}
                          className={`${iconBtnSize.btn} rounded-full bg-background/60 hover:bg-background hover:ring-primary/60 transition-all hover:ring-1 hover:shadow-[0_0_8px_hsl(var(--primary)/0.45)]`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isScreenshotActive) {
                              setViewerBackside(false);
                              setIsViewerOpen(true);
                            } else {
                              handleGenerateScreenshot(e, true);
                            }
                          }}
                          disabled={loadingScreenshot}
                        >
                          {loadingScreenshot ? (
                            <Loader2 className={`${iconBtnSize.icon} text-muted-foreground animate-spin`} />
                          ) : isScreenshotActive ? (
                            <Images className={`${iconBtnSize.icon} text-muted-foreground`} />
                          ) : (
                            <ImagePlus className={`${iconBtnSize.icon} text-muted-foreground`} />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="text-xs !zoom-in-100 data-[state=closed]:!zoom-out-100 slide-in-from-right-1">
                        {isScreenshotActive ? "Open screenshot gallery" : "Generate image"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {((item.minOfferPrice !== undefined && item.minOfferPrice > 0) || (item.maxOfferDiscount !== undefined && item.maxOfferDiscount > 0)) && (
                  <TooltipProvider delayDuration={1000}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`${iconBtnSize.btn} rounded-full transition-all hover:ring-1 hover:shadow-[0_0_8px_hsl(45_95%_55%/0.5)] ${offerMode ? 'bg-cs-yellow/80 hover:bg-cs-yellow/60 hover:ring-cs-yellow' : 'bg-background/60 hover:bg-background hover:ring-cs-yellow/60'}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOfferMode((m) => {
                              const next = !m;
                              setOfferPrice(minBuyOrder.toFixed(2));
                              setOfferSent(false);
                              setOfferSending(false);
                              setOfferEditing(false);
                              setOfferDirty(false);
                              setOfferStepEditing(false);
                              setOfferStepPct('0.5');
                              return next;
                            });
                          }}
                        >
                          <HandCoins className={`${iconBtnSize.icon} ${offerMode ? 'text-background' : 'text-muted-foreground'}`} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="text-xs !zoom-in-100 data-[state=closed]:!zoom-out-100 slide-in-from-right-1">
                        {offerMode ? 'Close Offer Menu' : 'Make an Offer'}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>

              <div className="absolute bottom-[1px] left-[1px] flex flex-col items-start gap-0.5 z-20 hover:z-30 pointer-events-none">
                {item.charm && (
                  <div className="pointer-events-auto relative z-40">
                    <CharmIcon charm={item.charm} />
                  </div>
                )}
                {item.stickers && item.stickers.length > 0 && (() => {
                  const sp = item.stickerOverpay ?? 0;
                  const spColor = getSPColor(sp);
                  const totalStickerValue = item.stickers.reduce((sum, s) => sum + (s.referencePrice ?? 0), 0);
                  const isAgent = isAgentItem(item);
                  return (
                    <div className="flex flex-col items-start gap-0.5 pointer-events-none">
                      {!item.isSouvenir && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              onClick={(e) => e.stopPropagation()}
                              className="sp-badge group/sp ml-[5px] mb-[3px] pointer-events-auto rounded-sm px-1 py-[1px] flex items-center leading-none bg-card/95 backdrop-blur-sm border shadow-[0_1px_3px_rgba(0,0,0,0.5)] cursor-pointer whitespace-nowrap overflow-hidden transition-transform duration-150 hover:scale-110 active:scale-95"
                              style={{ borderColor: spColor, ['--sp-color' as any]: spColor }}
                            >
                              <span className="relative z-10 text-[9px] font-bold font-mono tracking-tight whitespace-nowrap transition-[text-shadow] duration-200 group-hover/sp:[text-shadow:0_0_6px_var(--sp-color)]" style={{ color: spColor }}>
                                {sp > 1000 ? `$${totalStickerValue.toFixed(2)}` : `${Math.max(0, sp).toFixed(1)}% ${isAgent ? 'PP' : 'SP'}`}
                              </span>
                              <span
                                aria-hidden
                                className="pointer-events-none absolute inset-0 -translate-x-full group-hover/sp:translate-x-full transition-transform duration-700 ease-out"
                                style={{ background: `linear-gradient(110deg, transparent 30%, ${spColor}55 50%, transparent 70%)` }}
                              />
                              <span
                                aria-hidden
                                className="pointer-events-none absolute inset-0 rounded-sm opacity-0 group-hover/sp:opacity-100 group-hover/sp:animate-pulse"
                                style={{ boxShadow: `0 0 0 1px ${spColor}, 0 0 8px ${spColor}99` }}
                              />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            side="top"
                            align="start"
                            sideOffset={6}
                            onClick={(e) => e.stopPropagation()}
                            className="w-[220px] p-0 border border-border/60 bg-popover/95 backdrop-blur-md shadow-[0_8px_24px_-4px_rgba(0,0,0,0.6)] rounded-md overflow-hidden"
                          >
                            <div
                              className="px-2.5 py-2 border-b border-border/50 flex items-center justify-between"
                              style={{ background: `linear-gradient(180deg, ${spColor}1f 0%, transparent 100%)` }}
                            >
                              <div className="flex flex-col leading-none">
                                <span className="text-[9px] font-mono font-bold uppercase tracking-[0.15em] text-muted-foreground">{isAgent ? 'Patch Price' : 'Sticker Price'}</span>
                                <span className="mt-1 text-[15px] font-bold font-mono tabular-nums" style={{ color: spColor }}>
                                  {Math.max(0, sp).toFixed(1)}%
                                </span>
                              </div>
                              <span
                                className="px-2 py-[3px] rounded-sm text-[12px] font-mono font-bold uppercase tracking-wider tabular-nums"
                                style={{ backgroundColor: 'hsl(142 70% 45% / 0.12)', color: 'hsl(142 70% 55%)', border: '1px solid hsl(142 70% 45% / 0.4)' }}
                              >
                                ${totalStickerValue.toFixed(2)}
                              </span>
                            </div>

                            <div className="px-2.5 pt-2">
                              <div className="relative h-[6px] w-full rounded-full bg-muted/40 overflow-visible">
                                <div
                                  className="absolute inset-y-0 left-0 rounded-full transition-all"
                                  style={{ width: `${Math.max(0, Math.min(100, sp))}%`, background: `linear-gradient(90deg, ${spColor}aa, ${spColor})`, boxShadow: `0 0 6px ${spColor}88` }}
                                />
                                {[0, 50, 100].map((t) => (
                                  <span
                                    key={t}
                                    aria-hidden
                                    className="absolute top-1/2 -translate-y-1/2 h-[8px] w-[1px] bg-muted-foreground/40"
                                    style={{ left: `${t}%`, transform: `translate(-50%, -50%)` }}
                                  />
                                ))}
                                <span
                                  aria-hidden
                                  className="absolute top-1/2 h-[10px] w-[10px] rounded-full border-2 border-background"
                                  style={{
                                    left: `${Math.max(0, Math.min(100, sp))}%`,
                                    transform: 'translate(-50%, -50%)',
                                    backgroundColor: spColor,
                                    boxShadow: `0 0 8px ${spColor}`,
                                  }}
                                />
                              </div>
                              <div className="mt-1 flex justify-between text-[8px] font-mono uppercase tracking-wider text-muted-foreground/70">
                                <span>0%</span><span>50%</span><span>100%</span>
                              </div>
                            </div>

                            <div className="px-2.5 py-2 space-y-1">
                              {item.stickers.map((s, i) => (
                                <div key={i} className="flex items-center gap-2 rounded-sm px-1 py-1 hover:bg-muted/30 transition-colors">
                                  <div className="shrink-0 h-7 w-7 rounded bg-background/60 border border-border/50 flex items-center justify-center p-0.5">
                                    <img src={s.imageUrl} alt="" className="max-h-full max-w-full object-contain" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[10px] font-medium text-foreground leading-tight truncate">{s.name}</p>
                                    <p className="text-[9px] font-mono text-muted-foreground tabular-nums">Slot {s.slot} · {(s.wear * 100).toFixed(0)}% wear</p>
                                  </div>
                                  <span className="text-[10px] font-mono font-bold text-emerald-400 tabular-nums shrink-0">${s.referencePrice.toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                      <div className="flex flex-nowrap items-end gap-0 pointer-events-auto [&>*+*]:-ml-[1px]">
                        {item.stickers.map((sticker, i) => (
                          <StickerIcon key={i} sticker={sticker} />
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
            <div style={{ height: '2px', backgroundColor: rarityStyle.stripe }} />
            {!overlayMatch && (
              <div className="absolute top-0.5 left-0.5 z-20 flex flex-col gap-1" style={{ overflow: 'visible' }}>
                {((item.badges && item.badges.some(b => b.startsWith('blue_gem_'))) || bluePercent != null) && (
                  <div className="flex flex-row items-center gap-1 shrink-0" style={{ overflow: 'visible' }}>
                    {item.badges && item.badges.some(b => b.startsWith('blue_gem_')) && (
                      <BlueGemTierBadgeTooltip badges={item.badges} stackMode />
                    )}
                    {bluePercent != null && (
                      <BlueGemPercentTooltip item={item} stackMode />
                    )}
                  </div>
                )}
                {item.badges && item.badges.some(b => b.startsWith('fi_max_')) && (
                  <MarbleFadeBadgeTooltip badges={item.badges} stackMode />
                )}
                {fadeBadgeData && (
                  <FadeBadgeTooltip
                    fadePercent={fadePercent!}
                    rank={fadeBadgeData.rank}
                    bg={fadeBadgeData.bg}
                    flowDuration={fadeBadgeData.flowDuration}
                    sheenDuration={fadeBadgeData.sheenDuration}
                    badges={item.badges}
                    stackMode
                  />
                )}
                {item.badges && item.badges.some(b => b.includes('float')) && (
                  <FloatRankBadgeTooltip badges={item.badges} highRank={item.floatRank} stackMode />
                )}
              </div>
            )}
          </div>
        );
      })()}

      <div className="px-2 pt-2">
        {isSold ? (
          <div className="relative rounded-md overflow-hidden border border-destructive/60 bg-background/80 backdrop-blur-sm shadow-[inset_0_0_6px_rgba(239,68,68,0.15)]">
            <div className="flex h-[58px] flex-col items-center justify-center px-2 py-2">
              <span className="text-[10px] font-semibold text-destructive uppercase tracking-[0.15em] leading-none mb-0.5">Sold for</span>
              <span className="text-[15px] font-bold text-destructive font-mono leading-tight tracking-tight">${item.soldPrice?.toFixed(2)}</span>
            </div>
          </div>
        ) : (() => {
          const hasRefLoaded = currentRef === 'bid' ? (bidPriceVal !== null) : (askPriceVal !== null);
          const refPriceVal = currentRef === 'bid' ? bidPriceVal : askPriceVal;

          const charmPrice = (includeCharmPrice && item.charm) ? item.charm.referencePrice : 0;
          const effectiveRefPriceVal = refPriceVal !== null ? refPriceVal + charmPrice : null;

          const isUp = item.priceChange > 0 && Math.abs(item.priceChangePercent) >= 0.05;
          const isFlat = Math.abs(item.priceChangePercent) < 0.05;
          const steamColor = isUp ? 'hsl(0, 84%, 60%)' : isFlat ? 'hsl(220, 9%, 55%)' : 'hsl(142, 71%, 45%)';
          const SteamIcon = isUp ? Plus : Minus;

          const trendBorderDefault = 'border border-muted-foreground/40 bg-gradient-to-b from-secondary/80 to-secondary/40 shadow-[inset_0_0_6px_rgba(148,163,184,0.15)]';
          const trendBgDefault = 'radial-gradient(ellipse 55% 100% at 0% 50%, hsla(220, 9%, 55%, 0.12), transparent 65%)';

          const rawDiffAmount = hasRefLoaded && effectiveRefPriceVal !== null ? item.price - effectiveRefPriceVal : 0;
          const rawDiffPercent = hasRefLoaded && effectiveRefPriceVal !== null && effectiveRefPriceVal > 0 ? (rawDiffAmount / effectiveRefPriceVal) * 100 : 0;
          const diffAmount = cap10k(rawDiffAmount);
          const diffPercent = cap10k(rawDiffPercent);
          const isOverpay = diffAmount >= 0;

          const refColor = isOverpay ? 'hsl(0, 84%, 60%)' : 'hsl(142, 71%, 45%)';
          const sign = isOverpay ? '+' : '';

          const trendBorderRef = isOverpay
            ? 'border border-destructive/50 bg-gradient-to-b from-secondary/80 to-secondary/40 shadow-[inset_0_0_6px_rgba(239,68,68,0.18)]'
            : 'border border-accent/50 bg-gradient-to-b from-secondary/80 to-secondary/40 shadow-[inset_0_0_6px_rgba(34,197,94,0.18)]';
          const trendBgRef = isOverpay
            ? 'radial-gradient(ellipse 55% 100% at 0% 50%, hsla(0, 84%, 60%, 0.16), transparent 65%)'
            : 'radial-gradient(ellipse 55% 100% at 0% 50%, hsla(142, 71%, 45%, 0.16), transparent 65%)';

          // Auctions get their own violet identity so they read apart from fixed-price listings
          const isAuction = item.type === 'auction';
          const trendBorderAuction = 'border border-violet-500/55 bg-gradient-to-b from-secondary/80 to-secondary/40 shadow-[inset_0_0_6px_rgba(139,92,246,0.2)]';
          const trendBgAuction = 'radial-gradient(ellipse 55% 100% at 0% 50%, hsla(258, 90%, 66%, 0.16), transparent 65%)';

          const borderClass = isAuction ? trendBorderAuction : hasRefLoaded ? trendBorderRef : trendBorderDefault;
          const bgStyle = isAuction ? trendBgAuction : hasRefLoaded ? trendBgRef : trendBgDefault;

          return offerMode ? (
            (() => {
              const parsed = parseFloat(offerPrice);
              const validNum = isFinite(parsed) && parsed > 0;
              const diffPct = validNum ? ((parsed - item.price) / item.price) * 100 : 0;
              const sentPrice = validNum ? parsed : 0;
              const parsedForValid = parseFloat(offerPrice);
              const offerValid = isFinite(parsedForValid) && parsedForValid > 0 && parsedForValid >= minBuyOrder && parsedForValid <= maxBuyOrder;
              const invalidPrice = validNum && (parsed < minBuyOrder || parsed > maxBuyOrder);
              const editDisabled = stepperHover || sendHover;
              const sendOffer = async () => {
                if (offerSending || offerSent) return;
                const p = parseFloat(offerPrice);
                const valid = isFinite(p) && p > 0;
                if (!valid) {
                  setOfferEditing(true);
                  return;
                }
                if (p < minBuyOrder || p > maxBuyOrder) {
                  setOfferEditing(true);
                  return;
                }
                setOfferPrice(p.toFixed(2));
                setOfferEditing(false);
                setOfferSending(true);

                try {
                  const activeProfile = localStorage.getItem("sniper-bot-settings-active-profile") || undefined;
                  const response = await fetch('/api/csfloat/make-offer', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      listing_id: item.id,
                      price: Math.round(p * 100),
                      profile: activeProfile,
                    }),
                  });

                  if (!response.ok) {
                    const errJson = await response.json().catch(() => ({}));
                    const errMsg = errJson.error || `HTTP ${response.status} ${response.statusText}`;
                    throw new Error(errMsg);
                  }

                  toast.success(`Offer placed: $${p.toFixed(2)}`, { description: item.name });
                  setOfferSent(true);
                } catch (err: any) {
                  const errMsg = err.message || 'Unknown error';
                  console.error(`[MakeOffer] Failed for item ${item.id}:`, err);
                  toast.error(`Failed to make offer: ${errMsg}`);
                } finally {
                  setOfferSending(false);
                }
              };
              return (
                <div
                  className="w-full relative rounded-[6px] transition-all duration-300"
                  style={{
                    padding: '1.5px',
                    background: offerValid
                      ? 'hsl(var(--cs-yellow))'
                      : 'hsla(var(--cs-yellow), 0.45)',
                    boxShadow: offerValid
                      ? '0 0 10px hsla(var(--cs-yellow), 0.4)'
                      : '0 0 6px hsla(var(--cs-yellow), 0.2)',
                  }}
                >
                  <div
                    className={`group/offer relative rounded-md flex items-stretch h-[55px] overflow-hidden transition-all duration-300 ${offerSent ? 'bg-card shadow-[inset_0_0_10px_hsl(var(--cs-yellow)/0.14),inset_0_0_2px_hsl(var(--cs-yellow)/0.40)]' : `bg-card ${editDisabled ? 'cursor-default' : 'cursor-pointer'} shadow-[inset_0_0_6px_hsl(var(--cs-yellow)/0.12),inset_0_0_2px_hsl(var(--cs-yellow)/0.25)] hover:shadow-[inset_0_0_9px_hsl(var(--cs-yellow)/0.18),inset_0_0_3px_hsl(var(--cs-yellow)/0.35)]`}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (offerSent || offerSending || editDisabled) return;
                      if (!offerEditing) {
                        setOfferEditing(true);
                        setOfferSent(false);
                      } else {
                        const p = parseFloat(offerPrice);
                        if (isFinite(p) && p > 0) {
                          setOfferPrice(p.toFixed(2));
                        } else {
                          setOfferPrice(minBuyOrder.toFixed(2));
                        }
                        setOfferEditing(false);
                      }
                    }}
                  >
                    {offerSent ? (
                      <div className="flex-1 min-w-0 flex flex-col items-center justify-center px-2 gap-0.5 relative overflow-hidden">
                        <div className="absolute inset-0 pointer-events-none offer-success-shine" />
                        <span className="relative z-10 text-[9px] font-bold text-cs-yellow uppercase tracking-[0.18em] drop-shadow-[0_0_6px_hsl(var(--cs-yellow)/0.55)]">OFFER PLACED</span>
                        <span className="relative z-10 text-white font-bold font-mono tracking-tight leading-none tabular-nums" style={{ fontSize: px(16) }}>${sentPrice.toFixed(2)}</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0 flex flex-col items-center justify-center px-2.5 py-1 gap-0.5 text-center rounded-md transition-all">
                          <span className="text-[8px] font-bold uppercase tracking-[0.12em] leading-none text-cs-yellow">
                            {(() => {
                              const isAtMinOffer = validNum && Math.abs(parsed - minBuyOrder) < 0.001;
                              return isAtMinOffer ? 'MIN OFFER' : (offerEditing || offerDirty ? 'YOUR OFFER' : 'MIN OFFER');
                            })()}
                          </span>
                          <div className="flex items-baseline justify-center gap-1 min-w-0">
                            {(() => {
                              const priceColor = invalidPrice ? 'text-red-500' : 'text-white';
                              const dollarColor = offerEditing ? 'text-muted-foreground' : priceColor;
                              return (
                                <>
                                  <span className={`${dollarColor} font-bold font-mono leading-none`} style={{ fontSize: px(14) }}>$</span>
                                  {offerEditing ? (
                                    <span className="inline-flex items-baseline rounded-[4px] border border-cs-yellow/30 bg-muted/25 px-[10px] py-[2px] shadow-[inset_0_0_6px_rgba(0,0,0,0.25)] shrink-0 min-w-[80px] justify-center">
                                      <input
                                        ref={offerInputRef}
                                        type="text"
                                        inputMode="decimal"
                                        value={offerPrice}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          e.currentTarget.select();
                                        }}
                                        onChange={(e) => {
                                          let v = e.target.value.replace(/[^0-9.]/g, '');
                                          const parts = v.split('.');
                                          if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('');
                                          const intPart = parts[0]?.slice(0, 6) ?? '';
                                          const decPart = parts[1] ? '.' + parts[1].slice(0, 2) : v.includes('.') && parts.length === 1 ? '.' : '';
                                          v = intPart + decPart;
                                          setOfferPrice(v);
                                          setOfferDirty(true);
                                          setOfferSent(false);
                                        }}
                                        onFocus={(e) => e.currentTarget.select()}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            sendOffer();
                                          }
                                          if (e.key === 'Escape') {
                                            setOfferPrice(minBuyOrder.toFixed(2));
                                            setOfferEditing(false);
                                          }
                                        }}
                                        className={`min-w-0 border-0 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 bg-transparent ${priceColor} font-bold font-mono tracking-tight leading-none tabular-nums p-0 text-center placeholder:text-white/40 caret-cs-yellow`}
                                        style={{ fontSize: px(16), width: `${Math.max(offerPrice.length, minBuyOrder.toFixed(2).length, 3) + 1.2}ch` }}
                                        placeholder={minBuyOrder.toFixed(2)}
                                      />
                                    </span>
                                  ) : (
                                    <span
                                      className={`${priceColor} font-bold font-mono tracking-tight leading-none tabular-nums whitespace-nowrap text-center inline-flex items-baseline gap-1`}
                                      style={{ fontSize: px(16) }}
                                    >
                                      {validNum ? parsed.toFixed(2) : minBuyOrder.toFixed(2)}
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                          <span
                            className="font-mono tabular-nums leading-none font-semibold text-center relative"
                            style={{
                              fontSize: px(8.5),
                              color: !validNum
                                ? 'hsl(var(--muted-foreground))'
                                : invalidPrice
                                  ? 'hsl(0, 84%, 60%)'
                                  : diffPct >= 0
                                    ? 'hsl(142, 71%, 45%)'
                                    : 'hsl(0, 84%, 60%)',
                            }}
                          >
                            {!validNum
                              ? 'enter price'
                              : parsed < minBuyOrder
                                ? `below min $${minBuyOrder.toFixed(2)}`
                                : parsed > maxBuyOrder
                                  ? `above max $${maxBuyOrder.toFixed(2)}`
                                  : offerEditing
                                    ? 'type price, click send'
                                    : editDisabled
                                      ? `${diffPct >= 0 ? '+' : ''}${diffPct.toFixed(1)}% vs market`
                                      : (
                                        <>
                                          <span className="group-hover/offer:opacity-0 transition-opacity">
                                            {`${diffPct >= 0 ? '+' : ''}${diffPct.toFixed(1)}% vs market`}
                                          </span>
                                          <span className="absolute inset-0 flex items-center justify-center gap-1 opacity-0 group-hover/offer:opacity-100 transition-opacity text-cs-yellow uppercase tracking-[0.14em]" style={{ fontSize: px(8) }}>
                                            click to edit price
                                          </span>
                                        </>
                                      )}
                          </span>
                        </div>
                        {!offerEditing && !offerSent && !offerSending && (() => {
                          const isAtMinOffer = validNum && Math.abs(parsed - minBuyOrder) < 0.001;
                          const applyStep = (dir: 1 | -1) => {
                            const p = parseFloat(offerPrice);
                            const pct = parseFloat(offerStepPct);
                            if (!isFinite(p) || p <= 0 || !isFinite(pct) || pct <= 0) return;
                            const next = Math.max(minBuyOrder, Math.min(maxBuyOrder, +(p * (1 + dir * pct / 100)).toFixed(2)));
                            setOfferPrice(next.toFixed(2));
                            setOfferDirty(true);
                            setOfferSent(false);
                          };
                          return (
                            <div
                              className="shrink-0 w-7 self-stretch flex flex-col items-stretch justify-between border-l border-cs-yellow/25 bg-background/40"
                              onClick={(e) => e.stopPropagation()}
                              onMouseEnter={() => setStepperHover(true)}
                              onMouseLeave={() => setStepperHover(false)}
                            >
                              <button
                                type="button"
                                title={`+${offerStepPct || '0.5'}%`}
                                onClick={(e) => { e.stopPropagation(); applyStep(1); }}
                                className="flex-1 flex items-center justify-center text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
                              >
                                <ChevronUp className="h-3 w-3" strokeWidth={3} />
                              </button>
                              <div className="h-[16px] flex items-center justify-center border-y border-cs-yellow/20 bg-background/60">
                                {offerStepEditing ? (
                                  <input
                                    ref={offerStepInputRef}
                                    autoFocus
                                    type="text"
                                    inputMode="decimal"
                                    value={offerStepPct}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.currentTarget.select();
                                    }}
                                    onFocus={(e) => e.currentTarget.select()}
                                    onChange={(e) => {
                                      let v = e.target.value.replace(/[^0-9.]/g, '');
                                      const parts = v.split('.');
                                      if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('');
                                      v = v.slice(0, 4);
                                      const n = parseFloat(v);
                                      if (isFinite(n) && n > 90) v = '90';
                                      setOfferStepPct(v);
                                    }}
                                    onBlur={() => {
                                      const n = parseFloat(offerStepPct);
                                      if (!isFinite(n) || n <= 0) setOfferStepPct('0.5');
                                      else if (n > 90) setOfferStepPct('90');
                                      setOfferStepEditing(false);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === 'Escape') {
                                        (e.currentTarget as HTMLInputElement).blur();
                                      }
                                    }}
                                    className="w-full h-full bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-center text-[9px] font-mono font-bold text-cs-yellow tabular-nums p-0"
                                  />
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setOfferStepEditing(true); }}
                                    title="Click to change step %"
                                    className="w-full h-full flex items-center justify-center text-[9px] font-mono font-bold text-cs-yellow tabular-nums leading-none hover:bg-cs-yellow/10 transition-colors"
                                  >
                                    {offerStepPct || '0.5'}%
                                  </button>
                                )}
                              </div>
                              <button
                                type="button"
                                disabled={isAtMinOffer}
                                title={isAtMinOffer ? 'Already at minimum buy order' : `-${offerStepPct || '0.5'}%`}
                                onClick={(e) => { e.stopPropagation(); if (!isAtMinOffer) applyStep(-1); }}
                                className={`flex-1 flex items-center justify-center transition-colors ${isAtMinOffer ? 'text-gray-500 cursor-not-allowed' : 'text-red-400 hover:text-red-300 hover:bg-red-500/10'}`}
                              >
                                <ChevronDown className="h-3 w-3" strokeWidth={3} />
                              </button>
                            </div>
                          );
                        })()}
                        <div
                          className="shrink-0 w-9 self-stretch flex items-center justify-center"
                          onMouseEnter={() => setSendHover(true)}
                          onMouseLeave={() => setSendHover(false)}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            disabled={offerSending || !offerValid}
                            title={offerValid ? 'Make an offer' : (offerDirty ? 'Price out of range' : 'Type a price')}
                            className={`w-full h-full flex items-center justify-center transition-all duration-200 border-l ${offerValid
                              ? 'bg-gradient-to-b from-cs-yellow via-amber-300 to-cs-yellow text-background border-cs-yellow/50 shadow-[inset_0_0_14px_rgba(255,255,255,0.5),inset_0_0_3px_rgba(255,255,255,0.25)] hover:brightness-110 cursor-pointer'
                              : 'bg-transparent text-cs-yellow/45 border-cs-yellow/25 cursor-not-allowed'
                              }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!offerValid) return;
                              sendOffer();
                            }}
                          >
                            <Send className={`h-3.5 w-3.5 ${offerValid ? 'drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]' : 'opacity-70'} ${offerSending ? 'animate-[offerPlaneFly_0.5s_ease-in-out_forwards]' : ''}`} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })()
          ) : (
            <div className={`relative rounded-md overflow-hidden group/buy ${buyState === 'sold'
              ? 'border border-destructive/60 bg-muted/50 shadow-[inset_0_0_6px_rgba(239,68,68,0.2)]'
              : buyState === 'bought'
                ? 'border border-accent/60 bg-accent/20 shadow-[inset_0_0_6px_rgba(34,197,94,0.2)]'
                : buyState === 'confirm'
                  ? 'border border-cs-yellow/60 bg-cs-yellow/10 shadow-[inset_0_0_6px_rgba(234,179,8,0.2)]'
                  : borderClass
              } transition-[border-color,background-color] duration-300 relative overflow-hidden`}
              style={{
                backgroundImage: bgStyle,
              }}>
              <div className={`grid ${hasRefLoaded || isAuction ? 'grid-cols-[32px_1fr_48px]' : 'grid-cols-[32px_1fr]'} items-center gap-1 h-[55px] px-2 relative`}>
                {(() => {
                  const hideUnderlay = buyState !== 'idle';
                  const plusOpacity = hideUnderlay ? 'opacity-0' : 'opacity-100';
                  const sideOpacity = hideUnderlay ? 'opacity-0' : (buyLocked ? 'opacity-100' : 'group-hover/buy:opacity-0 transition-opacity duration-200');

                  return (
                    <>
                      <div className={`flex items-center justify-start relative z-30 ${plusOpacity} peer/trend`}>
                        <div
                          id={`steam-price-indicator-${item.id}`}
                          className="flex items-center justify-center rounded-full cursor-pointer animate-in fade-in duration-200"
                          style={{
                            width: px(20),
                            height: px(20),
                            background: 'hsl(220, 13%, 14%)',
                            border: `1.5px solid ${steamColor}`,
                            boxShadow: `0 0 6px ${steamColor}66, inset 0 0 2px ${steamColor}33`,
                          }}
                        >
                          <SteamIcon
                            style={{ width: px(12), height: px(12), color: steamColor, display: 'block' }}
                            strokeWidth={3.5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </div>
                      </div>
                      <div className={`flex flex-col items-center justify-center min-w-0 leading-none relative ${sideOpacity} peer-hover/trend:opacity-0 transition-opacity duration-200`}>
                        {isAuction ? (
                          <span className="font-bold text-violet-300 uppercase tracking-[0.14em] mb-1 whitespace-nowrap" style={{ fontSize: px(9) }}>
                            Auction
                          </span>
                        ) : (
                          <span className="font-semibold text-muted-foreground/70 uppercase tracking-[0.12em] mb-1 whitespace-nowrap" style={{ fontSize: px(9) }}>Market Price</span>
                        )}
                        <span className={`font-bold font-mono tracking-tight whitespace-nowrap ${isAuction ? 'text-violet-200' : 'text-foreground'}`} style={{ fontSize: px(17) }}>${item.price.toFixed(2)}</span>
                      </div>
                    </>
                  );
                })()}
                {hasRefLoaded && !isAuction && (() => {
                  const hideUnderlay = buyState !== 'idle';
                  const sideOpacity = hideUnderlay ? 'opacity-0' : (buyLocked ? 'opacity-100' : 'group-hover/buy:opacity-0 transition-opacity duration-200');
                  return (
                    <div className={`flex flex-col items-end justify-center leading-none gap-[2px] ${sideOpacity} peer-hover/trend:opacity-0 transition-opacity duration-200`}>
                      <span className="font-bold font-mono tabular-nums" style={{ color: refColor, fontSize: px(11) }}>
                        {sign}{Math.abs(diffPercent).toFixed(1)}%
                      </span>
                      <span className="font-semibold font-mono tabular-nums opacity-80" style={{ color: refColor, fontSize: px(10) }}>
                        {sign}{Math.abs(diffAmount).toFixed(2)}$
                      </span>
                    </div>
                  );
                })()}
                {isAuction && (
                  <div className="w-[48px]" />
                )}
                {buyState === 'idle' && (
                  <div className="pointer-events-none absolute inset-0 z-30 bg-black/75 backdrop-blur-[2px] opacity-0 peer-hover/trend:opacity-100 transition-opacity duration-200" />
                )}
                {buyState === 'idle' && (() => {
                  const isUp = item.priceChange > 0 && Math.abs(item.priceChangePercent) >= 0.05;
                  const cappedTrendPercent = cap10k(item.priceChangePercent);
                  return (
                    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center opacity-0 scale-90 peer-hover/trend:opacity-100 peer-hover/trend:scale-100 transition-all duration-200 ease-out">
                      <span className="font-bold font-mono tabular-nums whitespace-nowrap" style={{ color: steamColor, fontSize: px(16) }}>
                        {isUp ? '+' : ''}{Math.abs(cappedTrendPercent) >= 100 ? Math.round(cappedTrendPercent) : cappedTrendPercent.toFixed(1)}%
                      </span>
                    </div>
                  );
                })()}
              </div>
              <BuyOverlay price={item.price} priceChange={item.priceChange} priceChangePercent={item.priceChangePercent} onBuy={handleBuy} locked={buyLocked} onStateChange={handleBuyStateChange} currentState={buyState} errorReason={buyError} refPrice={effectiveRefPriceVal} refType={currentRef} isAuction={isAuction} />
            </div>
          );
        })()}
      </div>

      <div className="px-2 pt-1.5">
        <div className="grid grid-cols-2 gap-1 font-mono h-[22px]" style={{ fontSize: bidAskFontSize }}>
          <TooltipProvider delayDuration={150} disableHoverableContent={true}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={`rounded flex items-center justify-center font-semibold whitespace-nowrap bg-gradient-to-b from-secondary/80 to-secondary/40 relative overflow-hidden transition-all select-none ${(bidPriceVal === null || elapsedMs >= 300_000) && !loadingBid
                    ? 'cursor-pointer hover:brightness-110 active:scale-[0.98]'
                    : 'cursor-pointer'
                    }`}
                  style={{
                    color: 'hsl(39, 100%, 50%)',
                    borderWidth: 1,
                    borderStyle: 'solid',
                    borderColor: localPriceDiffRef === 'bid' ? 'hsla(39, 100%, 50%, 0.90)' : 'hsla(39, 100%, 50%, 0.40)',
                    boxShadow: localPriceDiffRef === 'bid' ? '0 0 8px hsla(39, 100%, 50%, 0.4)' : undefined,
                    backgroundImage: 'radial-gradient(ellipse 55% 100% at 50% 50%, hsla(39, 100%, 50%, 0.112), transparent 65%)'
                  }}
                  onMouseDown={startBidHold}
                  onMouseUp={endBidHold}
                  onMouseLeave={endBidHold}
                  onTouchStart={startBidHold}
                  onTouchEnd={endBidHold}
                  onClick={handleBidClick}
                >
                  {priceDiffRef === 'ask' && isHoldingBid && (
                    <div
                      className="absolute left-0 top-0 bottom-0 bg-amber-500/45 pointer-events-none z-0"
                      style={{ animation: 'bidHoldFill 500ms linear forwards' }}
                    />
                  )}
                  <span className="relative z-10 flex items-center justify-center w-full h-full">
                    {loadingBid ? (
                      <Loader2 className="animate-spin h-3.5 w-3.5" />
                    ) : bidPriceVal === null ? (
                      item.bidFetchPaused && item.bidFetchRemaining !== undefined ? (
                        <span className="flex items-center gap-1 opacity-60">
                          Bid {(item.bidFetchRemaining / 1000).toFixed(2)}s
                        </span>
                      ) : item.bidFetchAt && item.bidFetchAt > Date.now() ? (
                        <span className="flex items-center gap-1">
                          Bid {Math.max(0, (item.bidFetchAt - Date.now()) / 1000).toFixed(2)}s
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">Bid <Eye className="h-3 w-3" /></span>
                      )
                    ) : (
                      <span className="flex items-center gap-1.5 px-1.5">
                        <span className="flex items-center gap-0.5">
                          Bid {bidPriceVal.toFixed(2)}$
                          {prevBidPriceVal !== null && prevBidPriceVal !== bidPriceVal && (
                            <span className={bidPriceVal > prevBidPriceVal ? "text-emerald-400" : "text-rose-400"}>
                              {bidPriceVal > prevBidPriceVal ? "▲" : "▼"}
                            </span>
                          )}
                        </span>
                        {localPriceDiffRef === 'bid' && (
                          <span title="Calculating diff by Bid" className="inline-flex items-center">
                            <Calculator className="h-2.5 w-2.5 text-amber-300 animate-pulse" />
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" align="center" className="text-xs p-2 border border-border bg-popover text-foreground z-50 pointer-events-none">
                {loadingBid ? (
                  <span>Loading highest buy order (Bid)...</span>
                ) : bidPriceVal === null ? (
                  <div className="flex flex-col gap-0.5 leading-none">
                    <span>Click to load highest buy order (Bid)</span>
                    {priceDiffRef === 'ask' && (
                      <span className="text-[9px] text-amber-300 font-medium mt-0.5">Hold 0.5s to calculate by Bid</span>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-0.5 leading-none">
                    <span className="font-semibold text-yellow-500">Highest Bid: ${bidPriceVal.toFixed(2)}</span>
                    {prevBidPriceVal !== null && (
                      <span className="text-[10px] text-muted-foreground mt-1">
                        Previous: ${prevBidPriceVal.toFixed(2)}{" "}
                        <span className={bidPriceVal > prevBidPriceVal ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                          ({bidPriceVal > prevBidPriceVal ? "+" : ""}{(bidPriceVal - prevBidPriceVal).toFixed(2)}$)
                        </span>
                      </span>
                    )}
                    {priceDiffRef === 'ask' ? (
                      <span className="text-[9px] text-amber-300 font-medium mt-1">
                        Click to refresh Bid | Hold 0.5s to toggle Ask/Bid calculation
                      </span>
                    ) : (
                      <span className="text-[9px] text-muted-foreground font-medium mt-1">
                        Click to refresh Bid
                      </span>
                    )}
                  </div>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {(() => {
            const nameWithWear = getMarketHashName(item);
            const cacheEntry = askPriceCache.get(nameWithWear);
            const isCached = cacheEntry && cacheEntry.price === askPriceVal;
            const ageSeconds = cacheEntry ? Math.floor((Date.now() - cacheEntry.timestamp) / 1000) : 0;
            const remainingSeconds = cacheEntry ? Math.round((cacheEntry.expireMs - (Date.now() - cacheEntry.timestamp)) / 1000) : 0;

            return (
              <TooltipProvider delayDuration={150} disableHoverableContent={true}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={`rounded flex items-center justify-center font-semibold whitespace-nowrap bg-gradient-to-b from-secondary/80 to-secondary/40 relative overflow-hidden transition-all ${(askPriceVal === null || elapsedMs >= 300_000) && !loadingAsk
                        ? 'cursor-pointer hover:brightness-110 active:scale-[0.98]'
                        : 'cursor-default'
                        }`}
                      style={{ color: 'hsl(80, 70%, 50%)', borderWidth: 1, borderStyle: 'solid', borderColor: 'hsla(80, 70%, 50%, 0.40)', backgroundImage: 'radial-gradient(ellipse 55% 100% at 50% 50%, hsla(80, 70%, 50%, 0.112), transparent 65%)' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!loadingAsk) {
                          if (elapsedMs >= 300_000) {
                            fetchAskPrice(true);
                          } else if (askPriceVal === null) {
                            fetchAskPrice();
                          }
                        }
                      }}
                    >
                      {loadingAsk ? (
                        <Loader2 className="animate-spin h-3.5 w-3.5" />
                      ) : askPriceVal === null ? (
                        <span className="flex items-center gap-1">Ask <Eye className="h-3 w-3" /></span>
                      ) : (
                        <span className="flex items-center gap-0.5">
                          Ask {askPriceVal.toFixed(2)}$
                          {prevAskPriceVal !== null && prevAskPriceVal !== askPriceVal && (
                            <span className={askPriceVal < prevAskPriceVal ? "text-emerald-400" : "text-rose-400"}>
                              {askPriceVal < prevAskPriceVal ? "▼" : "▲"}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" align="center" className="text-xs p-2 border border-border bg-popover text-foreground z-50 pointer-events-none">
                    {loadingAsk ? (
                      <span>Loading lowest market price...</span>
                    ) : askPriceVal === null ? (
                      <span>Click to load lowest market price (Ask)</span>
                    ) : (
                      <div className="flex flex-col gap-0.5 leading-none">
                        <span className="font-semibold text-emerald-400">Ask price: ${askPriceVal.toFixed(2)}</span>
                        {prevAskPriceVal !== null && (
                          <span className="text-[10px] text-muted-foreground mt-1">
                            Previous: ${prevAskPriceVal.toFixed(2)}{" "}
                            <span className={askPriceVal < prevAskPriceVal ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                              ({askPriceVal > prevAskPriceVal ? "+" : ""}{(askPriceVal - prevAskPriceVal).toFixed(2)}$)
                            </span>
                          </span>
                        )}
                        {isCached && (
                          <>
                            <span className="text-[10px] text-muted-foreground mt-1">Loaded from Cache</span>
                            <span className="text-[9px] text-muted-foreground font-mono">Cached {ageSeconds}s ago · expires in {remainingSeconds}s</span>
                          </>
                        )}
                        {elapsedMs >= 300_000 && (
                          <span className="text-[9px] text-yellow-400 font-semibold mt-1">Click to refresh (5m elapsed)</span>
                        )}
                      </div>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })()}
        </div>
      </div>

      {isStandaloneItem(item) ? (
        <div className="h-[17px] bg-background/40" />
      ) : (
        <div className="px-3 pt-[7px] pb-[5px] bg-background/40">
          <FloatRangeBar float={item.float} paintIndex={item.paintIndex} />
        </div>
      )}

      {isStandaloneItem(item) ? (
        <div className="h-[22px] bg-background/40" />
      ) : (
        <div className="px-3 flex items-center justify-between bg-background/40" style={{ fontSize: px(11.52) }}>
          <span
            className="font-mono cursor-pointer transition-colors px-1.5 py-0.5 -ml-1.5 rounded flex items-center gap-1"
            style={{ color: floatColor }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'hsl(var(--primary))'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = floatColor; }}
            onClick={(e) => {
              e.stopPropagation();
              const fullName = `${item.isStatTrak ? 'StatTrak™ ' : ''}${item.isSouvenir ? 'Souvenir ' : ''}${item.name}`;
              const f = item.float.toFixed(12).replace(/0+$/, '').replace(/\.$/, '');
              const url = `https://csfloat.com/db?name=${encodeURIComponent(fullName)}&min=${f}&max=${f}`;
              window.open(url, '_blank');
            }}
            title="Open in CSFloat Database with this exact float"
          >
            <span>{item.float.toFixed(13).slice(0, 16)}</span>
          </span>
          <span
            className="font-mono text-foreground cursor-pointer hover:text-primary transition-colors px-1.5 py-0.5 -mr-1.5 rounded"
            onClick={(e) => {
              e.stopPropagation();
              const query = `${item.name}`;
              window.open(`https://csfloat.com/search?market_hash_name=${encodeURIComponent(query)}&paint_seed=${item.paintSeed}`, '_blank');
            }}
            title="Open on CSFloat"
          >
            {item.paintSeed}
          </span>
        </div>
      )}

      {/* Screenshot Viewer Dialog */}
      {item.cs2ScreenshotId && (
        <div onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}>
          <Dialog
            open={isViewerOpen}
            onOpenChange={(open) => {
              setIsViewerOpen(open);
              if (!open) {
                setIsZoomed(false);
                setViewerBackside(false);
                setPanOffset({ x: 0, y: 0 });
              }
            }}
          >
            <DialogContent
              className="max-w-[95vw] md:max-w-4xl lg:max-w-5xl bg-[#12131a]/95 border-neutral-800 backdrop-blur-md p-0 overflow-hidden text-neutral-200 select-none gap-0"
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
            >
              {/* Top Side Selector Tabs */}
              <div className="flex w-full border-b border-neutral-800 bg-[#16171f]">
                <button
                  type="button"
                  className={`w-1/2 text-center py-3 text-sm font-semibold transition-all ${!viewerBackside
                      ? "bg-[#20222e] text-white"
                      : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/20"
                    }`}
                  onClick={() => {
                    setViewerBackside(false);
                    setIsZoomed(false);
                    setPanOffset({ x: 0, y: 0 });
                  }}
                >
                  Front Side
                </button>
                <button
                  type="button"
                  className={`w-1/2 text-center py-3 text-sm font-semibold transition-all ${viewerBackside
                      ? "bg-[#20222e] text-white"
                      : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/20"
                    }`}
                  onClick={() => {
                    setViewerBackside(true);
                    setIsZoomed(false);
                    setPanOffset({ x: 0, y: 0 });
                  }}
                >
                  Back Side
                </button>
              </div>

              {/* Interactive Image Area */}
              <div
                className="relative aspect-video w-full bg-[#0b0c10] flex items-center justify-center p-4 group select-none overflow-hidden"
                style={{ cursor: isZoomed ? (isDragging ? "grabbing" : "grab") : "zoom-in" }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => setIsDragging(false)}
                onClick={() => {
                  if (!isZoomed) {
                    setIsZoomed(true);
                  }
                }}
              >
                {/* Front Side Image */}
                <img
                  src={getScreenshotProxyUrl(item.cs2ScreenshotId!, 'playside')}
                  alt={`${item.name} Front Side`}
                  decoding="async"
                  className={`transition-opacity duration-200 ${isZoomed
                      ? "max-h-none max-w-none w-[180%] h-auto absolute"
                      : "max-h-[65vh] max-w-full object-contain"
                    } ${!viewerBackside ? "opacity-100" : "opacity-0 absolute pointer-events-none"
                    }`}
                  style={{
                    transform: isZoomed ? `translate(${panOffset.x}px, ${panOffset.y}px)` : undefined,
                  }}
                  draggable={false}
                />

                {/* Back Side Image */}
                <img
                  src={getScreenshotProxyUrl(item.cs2ScreenshotId!, 'backside')}
                  alt={`${item.name} Back Side`}
                  decoding="async"
                  className={`transition-opacity duration-200 ${isZoomed
                      ? "max-h-none max-w-none w-[180%] h-auto absolute"
                      : "max-h-[65vh] max-w-full object-contain"
                    } ${viewerBackside ? "opacity-100" : "opacity-0 absolute pointer-events-none"
                    }`}
                  style={{
                    transform: isZoomed ? `translate(${panOffset.x}px, ${panOffset.y}px)` : undefined,
                  }}
                  draggable={false}
                />

                {/* Zoom Indicator Button */}
                <button
                  type="button"
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 hover:bg-black/80 border border-neutral-800/80 p-2 rounded-lg text-white transition-all active:scale-95 z-20 cursor-pointer flex items-center justify-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsZoomed((prev) => {
                      const next = !prev;
                      if (!next) {
                        setPanOffset({ x: 0, y: 0 });
                      }
                      return next;
                    });
                  }}
                >
                  {isZoomed ? (
                    <ZoomOut className="h-5 w-5 text-neutral-300" />
                  ) : (
                    <ZoomIn className="h-5 w-5 text-neutral-300" />
                  )}
                </button>

                {/* Disclaimer */}
                <div className="absolute bottom-4 left-4 text-[11px] text-neutral-500 font-medium pointer-events-none">
                  May not be representative of latest CS2 version
                </div>

                {/* Help tip */}
                <div className="absolute bottom-4 right-4 bg-black/60 border border-neutral-800/80 px-2 py-1 rounded text-[10px] text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                  {isZoomed ? "Drag to pan, click to zoom out" : "Click image to toggle zoom"}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      <div className="pb-2.5 bg-background/40" />
    </div>
  );
};

export const MonitorItemCard = memo(MonitorItemCardComponent, (prev, next) => {
  return prev.item.id === next.item.id &&
    prev.item.price === next.item.price &&
    prev.item.isSold === next.item.isSold &&
    prev.item.bidPrice === next.item.bidPrice &&
    prev.item.askPrice === next.item.askPrice &&
    prev.item.hasRealBid === next.item.hasRealBid &&
    prev.item.hasRealAsk === next.item.hasRealAsk &&
    prev.item.bidFetchAt === next.item.bidFetchAt &&
    prev.item.loadingBid === next.item.loadingBid &&
    prev.item.bidFetchRemaining === next.item.bidFetchRemaining &&
    prev.item.bidFetchPaused === next.item.bidFetchPaused &&
    prev.item.cs2ScreenshotId === next.item.cs2ScreenshotId &&
    prev.isWatchlisted === next.isWatchlisted &&
    prev.showInGameImages === next.showInGameImages &&
    prev.showScreenshots === next.showScreenshots &&
    prev.screenshotMode === next.screenshotMode &&
    prev.density === next.density &&
    prev.imageScale === next.imageScale &&
    prev.rarityColorHeight === next.rarityColorHeight &&
    prev.isPinned === next.isPinned &&
    prev.isFrozen === next.isFrozen &&
    prev.buyLocked === next.buyLocked &&
    prev.initialBuyState === next.initialBuyState &&
    prev.cfgMatch === next.cfgMatch &&
    prev.overlayMatch === next.overlayMatch &&
    prev.priceDiffRef === next.priceDiffRef &&
    prev.includeCharmPrice === next.includeCharmPrice;
});
