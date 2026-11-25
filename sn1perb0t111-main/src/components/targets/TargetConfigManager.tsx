import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import {
  Plus,
  Trash2,
  ChevronDown,
  ArrowUpDown,
  Bell,
  Target,
  ShoppingCart,
  Edit2,
  Settings,
  Check,
  X,
  FolderInput,
  FolderOpen,
  Power,
  Eraser,
  GripVertical,
  Download,
  Upload,
  PowerOff,
  ChevronUp,
  Globe,
  BellOff,
  ShoppingBag,
  MousePointerClick,
  ClipboardList,
  Search,
  Copy,
  Clock,
  MessageSquare,
  ClipboardCopy,
  Pin,
  Pencil
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TargetFilterPanel, FilterData } from "./TargetFilterPanel";
import { EditModeProvider, useEditMode, FilterSection } from "./EditModeContext";
import { cn } from "@/lib/utils";
import { getPhaseColor } from "../live-monitor/monitorTypes";

const getOverpayColor = (percent: number): string => {
  const p = Math.max(0, Math.min(100, percent));
  if (p <= 0) {
    return 'hsl(142 70% 48%)';
  } else if (p <= 25) {
    const t = p / 25;
    return `hsl(${142 - t * 45} ${70 + t * 5}% ${48 + t * 2}%)`;
  } else if (p <= 50) {
    const t = (p - 25) / 25;
    return `hsl(${97 - t * 47} ${75 + t * 15}% ${50 + t * 5}%)`;
  } else if (p <= 75) {
    const t = (p - 50) / 25;
    return `hsl(${50 - t * 25} ${90 - t * 5}% ${55 - t * 2}%)`;
  } else {
    const t = (p - 75) / 25;
    return `hsl(${25 - t * 25} 85% ${53 + t * 5}%)`;
  }
};
// Available emojis for config icons
const CONFIG_EMOJIS = [
  "🎯", "🔥", "💎", "⚡", "🚀", "💰", "🎮", "🎲", "🏆", "⭐",
  "💥", "🔫", "🗡️", "🛡️", "💣", "🎪", "🌟", "✨", "💫", "🌈",
  "🔷", "🔶", "🟢", "🔴", "🟣", "🟡", "🟠", "⚪", "⚫", "🟤",
  "❤️", "💙", "💚", "💜", "🧡", "💛", "🖤", "🤍", "💗", "💝",
  "🐉", "🦅", "🦁", "🐺", "🦊", "🐍", "🦈", "🐋", "🦋", "🐝",
  "👑", "🎩", "🎭", "🎨", "🎬", "🎧", "🎵", "🎸", "🎹", "🎺",
  "🌙", "☀️", "🌊", "🔮", "💀", "👻", "🤖", "👽", "🛸", "🌍",
];

interface StickerInfo {
  name: string;
  slot: number | "any";
  isWhole: boolean;
  wearMin?: number;
  wearMax?: number;
}

interface CharmInfo {
  name: string;
  patternMin?: number;
  patternMax?: number;
}

interface Target {
  id: number;
  createdAt?: number;
  description?: string;
  itemName: string;
  minPrice: number;
  maxPrice: number;
  isFixedPrice: boolean;
  minFloat: number;
  maxFloat: number;
  seeds: string;
  pattern: string; // Paint Seed number
  paintSeeds?: number[]; // Array of paint seeds for multi-select
  stickers: StickerInfo[];
  stickersRaw: string; // For backward compatibility
  charms: string;
  charmInfo?: CharmInfo; // New structured charm data
  rarity: string;
  statTrak: boolean;
  souvenir: boolean;
  normal: boolean;
  blueGem: string;
  customFilters: string;
  activeNotifications: boolean;
  activeAutopurchase: boolean;
  isAnyPrice?: boolean;
  // Pattern filters for Fade and Blue Gem
  fadeMin?: number;
  fadeMax?: number;
  blueGemMin?: number;
  blueGemMax?: number;
  // Sticker Overpay
  stickerOverpayMin?: number;
  stickerOverpayMax?: number;
  spStickerEnabled?: boolean;
  // Sticker Price Percentage (New)
  stickersPricePercentEnabled?: boolean;
  stickersPricePercentMin?: number;
  stickersPricePercentMax?: number;
  // Discount / Overpay (-100 to +100)
  discountOverpayMin?: number;
  discountOverpayMax?: number;
  // Custom Filter Tab Checkboxes
  customFilterEnabled?: boolean;
  blueGemEnabled?: boolean;
  fadeEnabled?: boolean;
  // Float Rank
  floatRankGold?: boolean;
  floatRankSilver?: boolean;
  floatRankBronze?: boolean;
  phase?: string;
  charmProfitEnabled?: boolean;
  charmProfitMin?: string;
  charmProfitMax?: string;
  charmProfitUseLowestPrice?: boolean;
  // F&I and Blue Gem Tiers
  fireAndIce?: string;
  fireAndIceEnabled?: boolean;
  fireAndIceTier?: '1st' | '2nd' | '3rd' | null;
  blueGemTier?: '1st' | '2nd' | '3rd' | null;
}

interface Config {
  id: string;
  name: string;
  emoji?: string;
  enabled: boolean;
  targets: Target[];
}

const normalizeFireIceTier = (tier?: Target['fireAndIceTier'] | string | null) => {
  if (!tier) return null;
  const cleanTier = String(tier).trim().toLowerCase();
  if (cleanTier.includes('1')) return '1st' as const;
  if (cleanTier.includes('2')) return '2nd' as const;
  if (cleanTier.includes('3')) return '3rd' as const;
  return null;
};

const hasFireIceFilter = (target: Target) => {
  if (target.fireAndIceEnabled) return true;
  if (normalizeFireIceTier(target.fireAndIceTier)) return true;
  const legacyVal = target.fireAndIce;
  if (legacyVal && legacyVal !== "0" && legacyVal !== "None") return true;
  return false;
};

const getLegacyFireIceTier = (target: Target) => {
  const val = target.fireAndIceTier || target.fireAndIce || (target as any).fire_and_ice_tier;
  return normalizeFireIceTier(val);
};

const normalizeFireIceTarget = (target: Target) => {
  const normalizedTier = normalizeFireIceTier(target.fireAndIceTier) ?? getLegacyFireIceTier(target);
  const fireIceEnabled = !!target.fireAndIceEnabled || !!normalizedTier || (target.fireAndIce !== undefined && target.fireAndIce !== "0" && target.fireAndIce !== "None");
  const changed = target.fireAndIceEnabled !== fireIceEnabled || target.fireAndIceTier !== normalizedTier;

  return {
    ...target,
    fireAndIceEnabled: fireIceEnabled,
    fireAndIceTier: normalizedTier,
    changed,
  };
};

const FireIceTargetMark = ({ tier }: { tier?: Target['fireAndIceTier'] | string | null }) => {
  const normalizedTier = normalizeFireIceTier(tier);
  const tierNumber = normalizedTier?.charAt(0);

  return (
    <div className="flex items-center gap-1">
      <div
        className="relative h-3.5 w-3.5 rounded-[3px] overflow-hidden border border-transparent flex items-center justify-center shrink-0"
        style={{
          background:
            'linear-gradient(135deg, rgba(12,36,88,0.98) 0%, rgba(41,30,111,0.95) 34%, rgba(126,28,34,0.96) 68%, rgba(202,53,31,0.94) 100%) padding-box, linear-gradient(135deg, #38bdf8 0%, #2563eb 28%, #7c3aed 50%, #ef4444 74%, #fb923c 100%) border-box',
          backgroundClip: 'padding-box, border-box',
          backgroundOrigin: 'padding-box, border-box',
        }}
      >
        <div
          className="absolute inset-0 opacity-85"
          style={{
            background:
              'radial-gradient(circle at 20% 35%, rgba(96,165,250,0.75), transparent 34%), radial-gradient(circle at 78% 60%, rgba(248,113,113,0.72), transparent 38%), linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.22) 48%, transparent 62%)',
          }}
        />
        {tierNumber ? (
          <span className="relative z-10 text-[8px] font-black leading-none text-foreground" style={{ textShadow: '0 0 3px rgba(2,6,23,0.9)' }}>
            {tierNumber}
          </span>
        ) : (
          <Check className="relative z-10 h-2.5 w-2.5 text-foreground" strokeWidth={3} />
        )}
      </div>
      <span
        className="text-[9px] font-semibold"
        style={{
          background: 'linear-gradient(90deg, #60a5fa, #a78bfa, #fb7185, #fb923c)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        F&amp;I
      </span>
    </div>
  );
};

const normalizeBlueGemTier = (tier?: Target['blueGemTier'] | string | null) => {
  if (!tier) return null;
  const cleanTier = String(tier).trim().toLowerCase();
  if (cleanTier.includes('1')) return '1st' as const;
  if (cleanTier.includes('2')) return '2nd' as const;
  if (cleanTier.includes('3')) return '3rd' as const;
  return null;
};

const hasBlueGemFilter = (target: Target) => {
  if (target.blueGemEnabled) return true;
  if (normalizeBlueGemTier(target.blueGemTier)) return true;
  const legacyVal = target.blueGem;
  if (legacyVal && legacyVal !== "0" && legacyVal !== "None") return true;
  return false;
};

const BlueGemTargetMark = ({ tier }: { tier?: Target['blueGemTier'] | string | null }) => {
  const normalizedTier = normalizeBlueGemTier(tier);
  const tierNumber = normalizedTier?.charAt(0);

  return (
    <div className="flex items-center gap-1">
      <div
        className="relative h-3.5 w-3.5 rounded-[3px] overflow-hidden border border-transparent flex items-center justify-center shrink-0"
        style={{
          background:
            'linear-gradient(135deg, rgba(6,182,212,0.95) 0%, rgba(56,189,248,0.9) 35%, rgba(14,165,233,0.9) 70%, rgba(2,132,199,0.95) 100%) padding-box, linear-gradient(135deg, #e0f2fe 0%, #38bdf8 40%, #06b6d4 75%, #0891b2 100%) border-box',
          backgroundClip: 'padding-box, border-box',
          backgroundOrigin: 'padding-box, border-box',
          boxShadow: '0 0 8px rgba(56,189,248,0.4), inset 0 1px 1px rgba(255,255,255,0.4)',
        }}
      >
        <div
          className="absolute inset-0 opacity-90"
          style={{
            background:
              'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.95) 0%, transparent 45%), radial-gradient(circle at 75% 75%, rgba(14,165,233,0.85) 0%, transparent 50%), linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 60%)',
          }}
        />
        {tierNumber ? (
          <span className="relative z-10 text-[8.5px] font-black leading-none text-foreground" style={{ textShadow: '0 0 3px rgba(2,6,23,0.95)' }}>
            {tierNumber}
          </span>
        ) : (
          <Check className="relative z-10 h-2.5 w-2.5 text-foreground" strokeWidth={3} />
        )}
      </div>
      <span
        className="text-[9px] font-bold"
        style={{
          background: 'linear-gradient(90deg, #bae6fd, #38bdf8, #0ea5e9, #0284c7)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          textShadow: '0 0 4px rgba(56,189,248,0.65)',
        }}
      >
        BG
      </span>
    </div>
  );
};

const initialConfigs: Config[] = [
  {
    id: "1",
    name: "Config 1",
    enabled: true,
    targets: [
      { id: 2, itemName: "*", minPrice: 120, maxPrice: 600, isFixedPrice: false, minFloat: 0, maxFloat: 1, seeds: "0", pattern: "", stickers: [], stickersRaw: "0", charms: "0", rarity: "", statTrak: false, souvenir: false, normal: true, blueGem: "0", customFilters: "None", activeNotifications: true, activeAutopurchase: false, stickerOverpayMin: 0, stickerOverpayMax: 100 },
      { id: 4, itemName: "AK-47 | Asiimov", minPrice: 30, maxPrice: 40, isFixedPrice: false, minFloat: 0, maxFloat: 0.4, seeds: "0", pattern: "661", stickers: [{ name: "Titan (Holo)", slot: 1, isWhole: true }, { name: "iBUYPOWER (Holo)", slot: 2, isWhole: false }], stickersRaw: "Titan (Holo), iBUYPOWER (Holo)", charms: "0", charmInfo: { name: "Charm | Hot Rod", patternMin: 100, patternMax: 5000 }, rarity: "covert", statTrak: true, souvenir: false, normal: false, blueGem: "0", customFilters: "None", activeNotifications: true, activeAutopurchase: true, blueGemMin: 70, blueGemMax: 95, stickerOverpayMin: 5, stickerOverpayMax: 35, discountOverpayMin: -15, discountOverpayMax: 25 },
      { id: 5, itemName: "AK-47 | Slate", minPrice: 30, maxPrice: 35, isFixedPrice: false, minFloat: 0.05, maxFloat: 0.2, seeds: "0", pattern: "", stickers: [], stickersRaw: "0", charms: "0", charmInfo: { name: "Charm | Baby Karat CT", patternMin: 1, patternMax: 100 }, rarity: "classified", statTrak: false, souvenir: false, normal: true, blueGem: "0", customFilters: "Enabled", activeNotifications: false, activeAutopurchase: false, stickerOverpayMin: 10, stickerOverpayMax: 50, discountOverpayMin: -50, discountOverpayMax: -10 },
      { id: 6, itemName: "AWP | Atheris", minPrice: 28, maxPrice: 35, isFixedPrice: false, minFloat: 0.05, maxFloat: 0.15, seeds: "0", pattern: "387", stickers: [{ name: "Crown (Foil)", slot: 1, isWhole: true }, { name: "Howling Dawn", slot: 3, isWhole: true }, { name: "Titan (Holo)", slot: 4, isWhole: false }, { name: "Natus Vincere (Holo)", slot: 5, isWhole: true }], stickersRaw: "Crown (Foil), Howling Dawn, Titan (Holo), Natus Vincere (Holo)", charms: "0", rarity: "restricted", statTrak: false, souvenir: true, normal: false, blueGem: "Enabled", customFilters: "None", activeNotifications: true, activeAutopurchase: false, stickerOverpayMin: 0, stickerOverpayMax: 20, discountOverpayMin: 10, discountOverpayMax: 80 },
      { id: 7, itemName: "Karambit | Fade", minPrice: 800, maxPrice: 1200, isFixedPrice: false, minFloat: 0, maxFloat: 0.03, seeds: "0", pattern: "412", stickers: [], stickersRaw: "0", charms: "0", charmInfo: { name: "Charm | Goddess of the Jungle" }, rarity: "covert", statTrak: false, souvenir: false, normal: true, blueGem: "0", customFilters: "None", activeNotifications: true, activeAutopurchase: true, fadeMin: 95, fadeMax: 100, stickerOverpayMin: 20, stickerOverpayMax: 80, discountOverpayMin: -30, discountOverpayMax: 40 },
      { id: 8, itemName: "Glock-18 | Franklin", minPrice: 130, maxPrice: 160, isFixedPrice: false, minFloat: 0.05, maxFloat: 0.35, seeds: "0", pattern: "123", stickers: [], stickersRaw: "0", charms: "0", rarity: "milspec", statTrak: true, souvenir: false, normal: false, blueGem: "0", customFilters: "None", activeNotifications: true, activeAutopurchase: true, stickerOverpayMin: 50, stickerOverpayMax: 100 },
      { id: 11, itemName: "AK-47 | Asiimov", minPrice: 442, maxPrice: 442, isFixedPrice: true, minFloat: 0.07, maxFloat: 0.15, seeds: "0", pattern: "2", stickers: [{ name: "Titan (Holo)", slot: 1, isWhole: true }, { name: "Titan (Holo)", slot: 1, isWhole: true }, { name: "Titan (Holo)", slot: 3, isWhole: true }], stickersRaw: "Titan (Holo) x3", charms: "0", charmInfo: { name: "Charm | Mighty Minerals", patternMin: 500, patternMax: 50000 }, rarity: "covert", statTrak: false, souvenir: false, normal: true, blueGem: "0", customFilters: "None", activeNotifications: true, activeAutopurchase: false, stickerOverpayMin: 15, stickerOverpayMax: 45 },
      { id: 12, itemName: "*", minPrice: 0, maxPrice: 100000, isFixedPrice: false, minFloat: 0, maxFloat: 1, seeds: "0", pattern: "", stickers: [], stickersRaw: "0", charms: "0", rarity: "", statTrak: false, souvenir: false, normal: true, blueGem: "0", customFilters: "None", activeNotifications: true, activeAutopurchase: false, stickerOverpayMin: 0, stickerOverpayMax: 100 },
      { id: 13, itemName: "USP-S | Kill Confirmed", minPrice: 0, maxPrice: 0, isFixedPrice: false, minFloat: 0.01, maxFloat: 0.08, seeds: "0", pattern: "", stickers: [], stickersRaw: "0", charms: "0", rarity: "covert", statTrak: false, souvenir: false, normal: true, blueGem: "0", customFilters: "None", activeNotifications: true, activeAutopurchase: false, stickerOverpayMin: 0, stickerOverpayMax: 100 },
    ]
  },
  {
    id: "2",
    name: "Config 2",
    enabled: false,
    targets: [
      { id: 9, itemName: "*", minPrice: 0, maxPrice: 10000000, isFixedPrice: false, minFloat: 0, maxFloat: 1, seeds: "0", pattern: "", stickers: [], stickersRaw: "0", charms: "0", rarity: "", statTrak: false, souvenir: false, normal: true, blueGem: "0", customFilters: "None", activeNotifications: true, activeAutopurchase: false, stickerOverpayMin: 0, stickerOverpayMax: 100 },
      { id: 10, itemName: "M4A1-S | Stratosphere", minPrice: 239, maxPrice: 239, isFixedPrice: true, minFloat: 0.88, maxFloat: 0.99, seeds: "0", pattern: "555", stickers: [{ name: "Flammable (Foil)", slot: 2, isWhole: true }], stickersRaw: "Flammable (Foil)", charms: "0", rarity: "industrial", statTrak: false, souvenir: false, normal: true, blueGem: "0", customFilters: "None", activeNotifications: false, activeAutopurchase: true, stickerOverpayMin: 25, stickerOverpayMax: 60 },
      { id: 14, itemName: "Desert Eagle | Blaze", minPrice: 0, maxPrice: 0, isFixedPrice: false, minFloat: 0, maxFloat: 0.01, seeds: "0", pattern: "", stickers: [], stickersRaw: "0", charms: "0", rarity: "restricted", statTrak: false, souvenir: false, normal: true, blueGem: "0", customFilters: "None", activeNotifications: true, activeAutopurchase: false, stickerOverpayMin: 0, stickerOverpayMax: 100 },
    ]
  }
];

// Paint Seeds Popover with pagination - Emerald folder style
const SEEDS_PER_PAGE = 20;

const PaintSeedsPopover = ({ seeds }: { seeds: number[] }) => {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(seeds.length / SEEDS_PER_PAGE);
  const currentSeeds = seeds.slice(page * SEEDS_PER_PAGE, (page + 1) * SEEDS_PER_PAGE);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded cursor-pointer hover:opacity-80 transition-all"
          style={{
            background: 'linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(52,211,153,0.25) 50%, rgba(16,185,129,0.2) 100%)',
            border: '1px solid rgba(52,211,153,0.4)'
          }}
        >
          <FolderOpen className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-sm font-mono font-bold text-emerald-300">
            {seeds.length}
          </span>
        </div>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        className="w-[220px] p-3 bg-popover/95 backdrop-blur-sm border-emerald-500/30"
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-400 font-medium">Paint Seeds Pack</span>
            <span className="text-[10px] text-muted-foreground/70">
              {page + 1} / {totalPages}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 min-h-[60px]">
            {currentSeeds.map((seed) => (
              <span
                key={seed}
                className="text-xs font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300"
              >
                #{seed}
              </span>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-1 border-t border-emerald-500/20">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                ← Prev
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
              >
                Next →
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

const CONFIGS_STORAGE_KEY = 'target-manager-configs';
const ACTIVE_CONFIG_KEY = 'target-manager-active-config';

// --- API INTEGRATION START ---
const API_BASE = "/api";

// API Types
interface ApiTarget {
  id: number;
  item_name: string;
  min_price: number;
  max_price: number;
  min_float: number;
  max_float: number;
  stickers: string[] | Record<string, string> | null;
  charms: string[] | null;
  is_stattrak: boolean | null;
  is_souvenir: boolean | null;
  is_normal: boolean | null;
  is_active: boolean;
  config_name: string;
  mode: string;
  markup_pct: number;
  markup_mult: number;
  paint_seed: string | null;
  blue_gem_tier: number | null;
  rarity_name: string | null;
  fire_and_ice_enabled?: boolean;
  fire_and_ice_tier?: string | null;
  zero_price_filter: boolean;
  playside_blue_enabled: boolean;
  playside_blue_min: number;
  playside_blue_max: number;
  sp_sticker_enabled: boolean;
  sp_sticker_percent_min: number;
  sp_sticker_percent_max: number;
  stickers_price_percent_enabled: boolean; // New
  stickers_price_percent_min: number;
  stickers_price_percent_max: number;
  charm_pattern_enabled: boolean;
  charm_pattern_min: number;
  charm_pattern_max: number;
  discount_overpay_min?: number; // Check if API supports this, if not we might lose it or need to add it
  discount_overpay_max?: number;
  fade_enabled: boolean;
  fade_min?: number;
  fade_max?: number;
  float_rank?: string | null; // 'gold_highest_float' | 'silver_highest_float' | 'bronze_highest_float' | null
  phase?: string | null;
  charm_profit_enabled?: boolean;
  charm_profit_min?: number;
  charm_profit_max?: number;
  charm_profit_use_lowest_price?: boolean;
  description?: string;
  created_at?: string;
  notifications_enabled?: boolean;
}

interface ApiConfig {
  name: string;
  target_count: number;
  active_count: number;
  targets?: ApiTarget[];
}

// Mapping Functions
const mapApiTargetToUiTarget = (apiTarget: ApiTarget): Target => {
  // Map stickers
  let stickersUi: StickerInfo[] = [];
  if (Array.isArray(apiTarget.stickers)) {
    stickersUi = apiTarget.stickers.map((s: any, i: number) => {
      if (typeof s === 'string') {
        return { name: s, slot: "any", isWhole: true };
      }
      return {
        name: s.name,
        slot: s.slot !== undefined && s.slot !== null ? s.slot + 1 : "any", // backend 0-indexed to UI 1-indexed
        isWhole: s.isWhole !== undefined ? s.isWhole : true,
        wearMin: s.wear_min !== undefined ? s.wear_min : 100,
        wearMax: s.wear_max !== undefined ? s.wear_max : 100,
      };
    });
  }

  // Map charm
  let charmName = "0";
  let charmInfo: CharmInfo | undefined;
  if ((apiTarget.charms && apiTarget.charms.length > 0) || apiTarget.charm_pattern_enabled) {
    if (apiTarget.charms && apiTarget.charms.length > 0) {
      charmName = apiTarget.charms[0];
    }
    // Always create charmInfo when charm exists or pattern is enabled
    charmInfo = {
      name: charmName,
      ...(apiTarget.charm_pattern_enabled && {
        patternMin: apiTarget.charm_pattern_min,
        patternMax: apiTarget.charm_pattern_max
      })
    };
  }


  // Determine if custom filters are enabled based on actual values
  const hasDiscountOverpay = apiTarget.discount_overpay_min !== null && apiTarget.discount_overpay_min !== undefined &&
    apiTarget.discount_overpay_max !== null && apiTarget.discount_overpay_max !== undefined &&
    (apiTarget.discount_overpay_min !== 0 || apiTarget.discount_overpay_max !== 0);

  return {
    id: apiTarget.id,
    createdAt: apiTarget.created_at ? new Date(apiTarget.created_at).getTime() : Date.now(),
    description: apiTarget.description || "",
    itemName: apiTarget.item_name,
    minPrice: apiTarget.min_price,
    maxPrice: apiTarget.max_price,
    isFixedPrice: apiTarget.min_price === apiTarget.max_price && apiTarget.min_price > 0, // Heuristic
    isAnyPrice: apiTarget.max_price === -1,
    minFloat: apiTarget.min_float,
    maxFloat: apiTarget.max_float,
    seeds: "0", // Legacy?
    // Parse paint seeds from API - always create an array first
    paintSeeds: apiTarget.paint_seed
      ? String(apiTarget.paint_seed).split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n))
      : [],
    // Legacy pattern field - only set for single seed, empty for multiple to avoid conflicts
    pattern: (() => {
      if (!apiTarget.paint_seed) return "";
      const seeds = String(apiTarget.paint_seed).split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n));
      return seeds.length === 1 ? String(seeds[0]) : "";
    })(),
    stickers: stickersUi,
    stickersRaw: stickersUi.map(s => s.name).join(", "),
    charms: charmName,
    charmInfo: charmInfo,
    rarity: apiTarget.rarity_name || "",
    statTrak: apiTarget.is_stattrak || false,
    souvenir: apiTarget.is_souvenir || false,
    normal: apiTarget.is_normal || false,
    blueGem: apiTarget.playside_blue_enabled ? "Enabled" : "0", // Fixed: use playside_blue_enabled
    customFilters: hasDiscountOverpay ? "Enabled" : "None",
    // Custom filter checkboxes from Custom tab
    customFilterEnabled: apiTarget.zero_price_filter || false,
    blueGemEnabled: apiTarget.playside_blue_enabled || false,
    activeNotifications: apiTarget.is_active && (apiTarget.notifications_enabled !== false),
    activeAutopurchase: apiTarget.is_active && (apiTarget.mode === "Auto Buy"),
    // Properly handle null/undefined for optional numeric fields
    fadeMin: apiTarget.fade_min ?? undefined,
    fadeMax: apiTarget.fade_max ?? undefined,
    blueGemMin: apiTarget.playside_blue_min ?? undefined,
    blueGemMax: apiTarget.playside_blue_max ?? undefined,
    stickerOverpayMin: apiTarget.sp_sticker_percent_min ?? undefined,
    stickerOverpayMax: apiTarget.sp_sticker_percent_max ?? undefined,
    spStickerEnabled: apiTarget.sp_sticker_enabled || false,
    // Sticker Price Percent
    stickersPricePercentEnabled: apiTarget.stickers_price_percent_enabled || false,
    stickersPricePercentMin: apiTarget.stickers_price_percent_min ?? 0,
    stickersPricePercentMax: apiTarget.stickers_price_percent_max ?? 100,
    discountOverpayMin: apiTarget.discount_overpay_min ?? undefined,
    discountOverpayMax: apiTarget.discount_overpay_max ?? undefined,
    fadeEnabled: apiTarget.fade_enabled ?? false,
    // Float Rank - read from API float_rank field
    floatRankGold: apiTarget.float_rank === 'gold_highest_float',
    floatRankSilver: apiTarget.float_rank === 'silver_highest_float',
    floatRankBronze: apiTarget.float_rank === 'bronze_highest_float',
    phase: apiTarget.phase || undefined,
    // Charm Profit
    charmProfitEnabled: apiTarget.charm_profit_enabled || false,
    charmProfitMin: apiTarget.charm_profit_min !== undefined ? String(apiTarget.charm_profit_min) : "0",
    charmProfitMax: apiTarget.charm_profit_max !== undefined ? String(apiTarget.charm_profit_max) : "100",
    charmProfitUseLowestPrice: apiTarget.charm_profit_use_lowest_price || false,
    // F&I and Blue Gem Tiers
    fireAndIce: apiTarget.fire_and_ice_enabled ? (apiTarget.fire_and_ice_tier || "Enabled") : "0",
    fireAndIceEnabled: apiTarget.fire_and_ice_enabled || false,
    fireAndIceTier: apiTarget.fire_and_ice_tier as any || null,
    blueGemTier: apiTarget.blue_gem_tier === 1 ? '1st' : apiTarget.blue_gem_tier === 2 ? '2nd' : apiTarget.blue_gem_tier === 3 ? '3rd' : null,
  };
};

const mapUiTargetToApiPayload = (uiTarget: Target, configName: string) => {
  return {
    item_name: uiTarget.itemName,
    description: uiTarget.description,
    min_price: uiTarget.minPrice,
    max_price: uiTarget.maxPrice,
    min_float: uiTarget.minFloat,
    max_float: uiTarget.maxFloat,
    stickers: uiTarget.stickers.map(s => {
      const wearMin = (s as any).wearMin ?? 100;
      const wearMax = (s as any).wearMax ?? 100;
      const isWhole = wearMin === 100 && wearMax === 100;
      if (s.slot === "any") {
        return { name: s.name, isWhole, wear_min: wearMin, wear_max: wearMax };
      }
      return {
        name: s.name,
        slot: (s.slot as number) - 1, // CSFloat uses 0-indexed slots
        isWhole,
        wear_min: wearMin,
        wear_max: wearMax,
      };
    }),
    charms: uiTarget.charms && uiTarget.charms !== "0" ? [uiTarget.charms] : [],
    is_stattrak: (!uiTarget.statTrak && !uiTarget.souvenir && !uiTarget.normal) ? null : uiTarget.statTrak,
    is_souvenir: (!uiTarget.statTrak && !uiTarget.souvenir && !uiTarget.normal) ? null : uiTarget.souvenir,
    is_normal: (!uiTarget.statTrak && !uiTarget.souvenir && !uiTarget.normal) ? null : uiTarget.normal,
    is_active: uiTarget.activeNotifications || uiTarget.activeAutopurchase,
    config_name: configName,
    mode: uiTarget.activeAutopurchase ? "Auto Buy" : "Notify Only",
    notifications_enabled: uiTarget.activeNotifications,
    paint_seed: uiTarget.paintSeeds && uiTarget.paintSeeds.length > 0
      ? uiTarget.paintSeeds.join(",")
      : (uiTarget.pattern ? uiTarget.pattern : null),
    rarity_name: uiTarget.rarity,
    playside_blue_enabled: uiTarget.blueGem === "Enabled" || uiTarget.blueGemEnabled === true,
    playside_blue_min: uiTarget.blueGemMin || 0,
    playside_blue_max: uiTarget.blueGemMax || 100,
    sp_sticker_enabled: uiTarget.spStickerEnabled || false,
    sp_sticker_percent_min: uiTarget.stickerOverpayMin || 0,
    sp_sticker_percent_max: uiTarget.stickerOverpayMax || 100,
    stickers_price_percent_enabled: uiTarget.stickersPricePercentEnabled || false,
    stickers_price_percent_min: uiTarget.stickersPricePercentMin || 0,
    stickers_price_percent_max: uiTarget.stickersPricePercentMax || 100,
    charm_pattern_enabled: uiTarget.charmInfo?.patternMin !== undefined,
    charm_pattern_min: uiTarget.charmInfo?.patternMin || 0,
    charm_pattern_max: uiTarget.charmInfo?.patternMax || 100000,
    charm_pattern_strict: uiTarget.charmInfo?.patternMin !== undefined,
    // Add other mappings as needed
    discount_overpay_min: uiTarget.discountOverpayMin,
    discount_overpay_max: uiTarget.discountOverpayMax,
    fade_min: uiTarget.fadeMin,
    fade_max: uiTarget.fadeMax,
    // Custom filter checkboxes
    zero_price_filter: uiTarget.customFilterEnabled || false,
    fade_enabled: uiTarget.fadeEnabled || false,
    // Float Rank - map boolean flags to single string badge key
    float_rank: uiTarget.floatRankGold
      ? 'gold_highest_float'
      : uiTarget.floatRankSilver
        ? 'silver_highest_float'
        : uiTarget.floatRankBronze
          ? 'bronze_highest_float'
          : null,
    phase: uiTarget.phase || null,
    // Charm Profit
    charm_profit_enabled: uiTarget.charmProfitEnabled || false,
    charm_profit_min: uiTarget.charmProfitMin !== undefined ? Number(uiTarget.charmProfitMin) : 0,
    charm_profit_max: uiTarget.charmProfitMax !== undefined ? Number(uiTarget.charmProfitMax) : 100,
    charm_profit_use_lowest_price: uiTarget.charmProfitUseLowestPrice || false,
    blue_gem_tier: uiTarget.blueGemTier === '1st' ? 1 : uiTarget.blueGemTier === '2nd' ? 2 : uiTarget.blueGemTier === '3rd' ? 3 : null,
    fire_and_ice_enabled: uiTarget.fireAndIceEnabled || false,
    fire_and_ice_tier: uiTarget.fireAndIceTier || null,
  };
};

// API Functions
export const fetchAllConfigs = async (): Promise<Config[]> => {
  try {
    // Optimized fetch with single query including all targets
    const res = await fetch(`${API_BASE}/configs?include_targets=true`);
    if (!res.ok) throw new Error("Failed to fetch configs");
    const apiConfigs: any[] = await res.json(); // Changed to any to accept new schema with is_active

    const fullConfigs: Config[] = apiConfigs.map(apiConf => ({
      id: apiConf.name, // Use name as ID
      name: apiConf.name,
      enabled: apiConf.is_active, // Config enabled state logic derived from TargetConfig table
      emoji: apiConf.emoji || undefined,
      targets: (apiConf.targets || []).map(mapApiTargetToUiTarget)
    }));

    return fullConfigs;
  } catch (e) {
    console.error("API Fetch Error:", e);
    return [];
  }
};

const notifyTargetsChanged = () => {
  try { window.dispatchEvent(new Event("targets:changed")); } catch { /* ignore */ }
};

const createApiTarget = async (target: Target, configName: string) => {
  const payload = mapUiTargetToApiPayload(target, configName);
  const res = await fetch(`${API_BASE}/targets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  notifyTargetsChanged();
  return res.json();
};

const updateApiTarget = async (target: Target, configName: string) => {
  const payload = mapUiTargetToApiPayload(target, configName);

  // Filter out undefined values to prevent sending null to API
  // This ensures backend doesn't overwrite existing values with null
  const cleanPayload = Object.fromEntries(
    Object.entries(payload).filter(([_, value]) => value !== undefined)
  );

  const res = await fetch(`${API_BASE}/targets/${target.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cleanPayload)
  });

  notifyTargetsChanged();
  return res.json();
};

const deleteApiTarget = async (id: number) => {
  await fetch(`${API_BASE}/targets/${id}`, { method: "DELETE" });
  notifyTargetsChanged();
};

const createApiConfig = async (name: string, emoji?: string, enabled: boolean = false) => {
  // Use POST /api/configs to persist config to DB (including empty disabled configs)
  await fetch(`${API_BASE}/configs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, emoji: emoji || null, enabled })
  });
};

const deleteApiConfig = async (name: string) => {
  await fetch(`${API_BASE}/configs/${name}`, { method: "DELETE" });
};

const renameApiConfig = async (oldName: string, newName: string, emoji?: string) => {
  await fetch(`${API_BASE}/configs/rename`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ old_name: oldName, new_name: newName, emoji: emoji })
  });
};
// --- API INTEGRATION END ---

const TargetConfigManagerContent = () => {
  const { 
    isEditMode, 
    setIsEditMode, 
    editingTargetId, 
    setEditingTargetId, 
    navigateToSection,
    setPendingFilterData, 
    setHighlightedSection, 
    onExitEditMode 
  } = useEditMode();

  const handleCancelEditMode = () => {
    setEditingTargetId(null);
    setPendingFilterData(null);
    setHighlightedSection(null);
    setIsEditMode(false);
    if (onExitEditMode) {
      onExitEditMode();
    }
  };

  const [configs, setConfigsInternal] = useState<Config[]>([]);
  const [editingDescriptionId, setEditingDescriptionId] = useState<string | null>(null);
  const [editingDescriptionValue, setEditingDescriptionValue] = useState<string>("");

  // Copy to Config state
  const [pinnedCopyConfigIds, setPinnedCopyConfigIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('pinned-copy-configs');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [copyPopoverOpenId, setCopyPopoverOpenId] = useState<string | null>(null);
  const [copySearchQuery, setCopySearchQuery] = useState("");
  const [copyFlashTargetKey, setCopyFlashTargetKey] = useState<string | null>(null);

  const updateTargetDescription = async (configId: string, targetId: number, description: string) => {
    // Find the target to save first before updating state
    const config = configs.find(c => c.id === configId || c.name === configId);
    const target = config?.targets.find(t => t.id === targetId);
    let apiSuccess = false;

    if (target) {
      try {
        const updatedTarget = { ...target, description };
        // Save to API
        await updateApiTarget(updatedTarget, config!.name);
        apiSuccess = true;
      } catch (e) {
        console.error("Failed to update target description:", e);
      }
    }

    if (apiSuccess) {
      // Optimistic UI Update after confirming we had the target
      setConfigsInternal(prev => prev.map(c => {
        if (c.id === configId || c.name === configId) {
          return {
            ...c,
            targets: c.targets.map(t => t.id === targetId ? { ...t, description } : t)
          };
        }
        return c;
      }));
    }
  };

  const [activeConfigId, setActiveConfigIdInternal] = useState(() => {
    try { return localStorage.getItem(ACTIVE_CONFIG_KEY) || "Default"; } catch { return "Default"; }
  });

  const setActiveConfigId = (id: string) => {
    setActiveConfigIdInternal(id);
    try { localStorage.setItem(ACTIVE_CONFIG_KEY, id); } catch { }
  };

  const saveConfigsToStorage = (cfgs: Config[]) => {
    try {
      const meta = cfgs.map(c => ({ id: c.id, name: c.name, emoji: c.emoji }));
      localStorage.setItem(CONFIGS_STORAGE_KEY, JSON.stringify(meta));
    } catch (e) {
      console.error('Failed to save configs meta', e);
    }
  };

  useEffect(() => {
    // Load from API on mount
    fetchAllConfigs().then(data => {
      let finalConfigs = data;
      try {
        const stored = localStorage.getItem(CONFIGS_STORAGE_KEY);
        if (stored) {
          const metaList = JSON.parse(stored) as { id: string, name: string, emoji?: string }[];

          const apiConfigByIdMap = new Map(data.map(c => [c.id, c]));
          const apiConfigByNameMap = new Map(data.map(c => [c.name, c]));
          const orderedConfigs: Config[] = [];
          const consumedApiIds = new Set<string>();

          metaList.forEach(meta => {
            // Try matching by id first, then fall back to matching by name
            let apiConfig = apiConfigByIdMap.get(meta.id) || apiConfigByNameMap.get(meta.name);
            if (apiConfig) {
              if (!consumedApiIds.has(apiConfig.id)) {
                orderedConfigs.push({
                  ...apiConfig,
                  name: meta.name || apiConfig.name,
                  emoji: meta.emoji ?? apiConfig.emoji,
                });
                consumedApiIds.add(apiConfig.id);
              }
              // else: duplicate localStorage entry for same API config — skip
            }
            // No else: localStorage entries with no API match are stale ghosts — skip
          });

          // Append any API configs not covered by localStorage order
          data.forEach(apiConfig => {
            if (!consumedApiIds.has(apiConfig.id)) {
              orderedConfigs.push(apiConfig);
            }
          });

          finalConfigs = orderedConfigs;
          // Clean up storage if there are deleted configs from outside
          saveConfigsToStorage(finalConfigs);
        }
      } catch (e) {
        console.error('Failed to parse configs meta', e);
      }

      if (finalConfigs.length > 0) {
        setConfigsInternal(finalConfigs);
        // Ensure activeConfigId is valid after loading configs
        const currentConfig = finalConfigs.find(c => c.id === activeConfigId);
        if (!currentConfig) {
          // If current active config doesn't exist, set to first available config
          setActiveConfigId(finalConfigs[0].id);
        }
      } else {
        // Empty state
        setConfigsInternal([]);
        setActiveConfigId("Default");
      }
    });
  }, []);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [renameConfigId, setRenameConfigId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renameEmoji, setRenameEmoji] = useState<string>("");
  const [moveTargetId, setMoveTargetId] = useState<number | null>(null);
  const [draggedConfigId, setDraggedConfigId] = useState<string | null>(null);
  const [dragOverConfigId, setDragOverConfigId] = useState<string | null>(null);
  const [currentFloor, setCurrentFloor] = useState(0);
  const [selectedConfigIds, setSelectedConfigIds] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [isGlobalStatsMode, setIsGlobalStatsMode] = useState(false);
  const [bulkDisableConfirm, setBulkDisableConfirm] = useState<'notify' | 'buy' | null>(null);


  // Duplicate Mode
  const [isDuplicateMode, setIsDuplicateMode] = useState(false);
  const [dupSelectedTargets, setDupSelectedTargets] = useState<Set<number>>(new Set());
  const dupProcessingRef = useRef(false);

  // Search
  const [targetSearch, setTargetSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightedTargetId, setHighlightedTargetId] = useState<number | null>(null);
  const [sortField, setSortField] = useState<'price' | 'float' | 'date' | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const targetRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  // Filter panel is always visible in Target Manager

  // Dynamic elevator system based on actual container width and tab widths
  const [containerWidth, setContainerWidth] = useState(800);

  useEffect(() => {
    const el = document.querySelector('.configs-tabs-container');
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) {
          setContainerWidth(w);
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const floors = useMemo(() => {
    if (configs.length === 0) return [[]];
    
    const result: Config[][] = [[]];
    let currentFloorIndex = 0;
    let currentFloorWidth = 0;
    const gap = 8; // gap-2 is 8px
    
    configs.forEach((config) => {
      const hasEmoji = !!config.emoji;
      const isActive = activeConfigId === config.id;
      const nameLength = config.name.length;
      
      // Estimate width of this config tab:
      // padding: 24px, border: 2px, gap: 8px, grip: 12px, emoji: 16px+8px, edit button: 30px, char average: ~7.8px
      const tabWidth = 24 + 2 + 12 + gap + 
        (hasEmoji ? 16 + gap : 0) + 
        (isActive ? 30 : 0) + 
        (nameLength * 7.8);
        
      const additionalWidth = currentFloorWidth > 0 ? tabWidth + gap : tabWidth;
      
      if (currentFloorWidth > 0 && currentFloorWidth + additionalWidth > containerWidth) {
        result.push([config]);
        currentFloorIndex++;
        currentFloorWidth = tabWidth;
      } else {
        result[currentFloorIndex].push(config);
        currentFloorWidth += additionalWidth;
      }
    });
    
    return result;
  }, [configs, containerWidth, activeConfigId]);

  const totalFloors = floors.length;

  const visibleConfigs = useMemo(() => {
    return floors[currentFloor] || [];
  }, [floors, currentFloor]);

  const lastActiveConfigIdRef = useRef<string | null>(null);

  // Auto-navigate floor when active config changes to make sure it is visible
  useEffect(() => {
    if (activeConfigId && activeConfigId !== lastActiveConfigIdRef.current) {
      lastActiveConfigIdRef.current = activeConfigId;
      const floorIdx = floors.findIndex(floor => floor.some(c => c.id === activeConfigId));
      if (floorIdx !== -1) {
        setCurrentFloor(floorIdx);
      }
    }
  }, [activeConfigId, floors]);

  // Auto-adjust floor when configs are deleted
  if (currentFloor > 0 && currentFloor >= totalFloors) {
    setCurrentFloor(Math.max(0, totalFloors - 1));
  }

  // Save to storage on update
  const setConfigs = (newConfigs: Config[] | ((prev: Config[]) => Config[])) => {
    setConfigsInternal(prev => {
      const updated = typeof newConfigs === 'function' ? newConfigs(prev) : newConfigs;
      saveConfigsToStorage(updated);
      return updated;
    });
  };

  const activeConfig = configs.find(c => c.id === activeConfigId);

  // All targets with config info for global mode
  const allTargetsWithConfig = useMemo(() => {
    return configs.flatMap(config =>
      config.targets.map(target => ({
        ...target,
        configId: config.id,
        configName: config.name,
        configEmoji: config.emoji,
        configEnabled: config.enabled
      }))
    );
  }, [configs]);

  const TABLE_CONFIG_COLORS = [
    { bg: 'rgba(99, 102, 241, 0.08)', border: 'rgba(99, 102, 241, 0.5)' },
    { bg: 'rgba(34, 197, 94, 0.08)', border: 'rgba(34, 197, 94, 0.5)' },
    { bg: 'rgba(234, 179, 8, 0.08)', border: 'rgba(234, 179, 8, 0.5)' },
    { bg: 'rgba(168, 85, 247, 0.08)', border: 'rgba(168, 85, 247, 0.5)' },
    { bg: 'rgba(6, 182, 212, 0.08)', border: 'rgba(6, 182, 212, 0.5)' },
    { bg: 'rgba(244, 63, 94, 0.08)', border: 'rgba(244, 63, 94, 0.5)' },
    { bg: 'rgba(251, 146, 60, 0.08)', border: 'rgba(251, 146, 60, 0.5)' },
    { bg: 'rgba(45, 212, 191, 0.08)', border: 'rgba(45, 212, 191, 0.5)' },
  ] as const;

  const sortedDisplayRows = useMemo(() => {
    const configIndexMap = new Map<string, number>();
    configs.forEach((c, i) => configIndexMap.set(c.id, i));

    const raw = isGlobalStatsMode
      ? allTargetsWithConfig
      : (activeConfig?.targets || []).map(t => ({
        ...t,
        configId: activeConfigId,
        configName: activeConfig?.name || '',
        configEmoji: activeConfig?.emoji,
        configEnabled: activeConfig?.enabled ?? true,
      }));

    const sorted = sortField
      ? [...raw].sort((a, b) => {
        let cmp = 0;
        if (sortField === 'price') cmp = (a.minPrice ?? 0) - (b.minPrice ?? 0);
        else if (sortField === 'float') cmp = (a.minFloat ?? 0) - (b.minFloat ?? 0);
        else if (sortField === 'date') cmp = (a.id ?? 0) - (b.id ?? 0);
        return sortAsc ? cmp : -cmp;
      })
      : raw;

    return sorted.map(target => {
      const targetConfigId = 'configId' in target ? target.configId : activeConfigId;
      const cfgIdx = (configIndexMap.get(targetConfigId) ?? 0) % TABLE_CONFIG_COLORS.length;
      return {
        ...target,
        targetConfigId,
        targetConfigName: 'configName' in target ? target.configName : activeConfig?.name || '',
        targetConfigEmoji: 'configEmoji' in target ? target.configEmoji : activeConfig?.emoji,
        targetConfigEnabled: 'configEnabled' in target ? target.configEnabled : activeConfig?.enabled ?? true,
        cfgColor: isGlobalStatsMode ? TABLE_CONFIG_COLORS[cfgIdx] : null,
      };
    });
  }, [isGlobalStatsMode, allTargetsWithConfig, activeConfig, activeConfigId, sortField, sortAsc, configs]);

  // Smart search results - search across item names, stickers, charms, patterns, price, float, and description
  const searchResults = useMemo(() => {
    if (!targetSearch.trim()) return [];
    const q = targetSearch.toLowerCase();
    const results: { target: Target; configId: string; configName: string; configEmoji?: string }[] = [];
    const searchConfigs = isGlobalStatsMode ? configs : configs.filter(c => c.id === activeConfigId);
    for (const config of searchConfigs) {
      for (const target of config.targets) {
        // Build searchable price string
        const priceStr = target.isFixedPrice
          ? `$${target.minPrice}`
          : `$${target.minPrice} $${target.maxPrice} ${target.minPrice}-${target.maxPrice}`;
        // Build searchable float string
        const floatStr = `${target.minFloat} ${target.maxFloat} ${target.minFloat}-${target.maxFloat}`;
        // Build searchable date string from createdAt
        let dateStr = '';
        if (target.createdAt) {
          const d = new Date(target.createdAt);
          dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toLowerCase();
        }

        const blueGemMatch = target.blueGemEnabled && (
          q.includes('blue') || q.includes('gem') ||
          (target.blueGemTier && (q.includes(target.blueGemTier.toLowerCase()) || q.includes(`tier ${target.blueGemTier.charAt(0)}`)))
        );
        const fireIceMatch = uiTarget => (uiTarget as Target).fireAndIceEnabled && (
          q.includes('fire') || q.includes('ice') ||
          (uiTarget.fireAndIceTier && (q.includes(uiTarget.fireAndIceTier.toLowerCase()) || q.includes(`tier ${uiTarget.fireAndIceTier.charAt(0)}`)))
        );

        if (
          target.itemName.toLowerCase().includes(q) ||
          target.stickersRaw?.toLowerCase().includes(q) ||
          target.charmInfo?.name?.toLowerCase().includes(q) ||
          target.rarity?.toLowerCase().includes(q) ||
          String(target.pattern).includes(q) ||
          (target.paintSeeds && target.paintSeeds.some(s => String(s).includes(q))) ||
          priceStr.toLowerCase().includes(q) ||
          floatStr.includes(q) ||
          dateStr.includes(q) ||
          target.description?.toLowerCase().includes(q) ||
          blueGemMatch ||
          fireIceMatch(target)
        ) {
          results.push({ target, configId: config.id, configName: config.name, configEmoji: config.emoji });
        }
        if (results.length >= 12) break;
      }
      if (results.length >= 12) break;
    }
    return results;
  }, [targetSearch, configs, isGlobalStatsMode, activeConfigId]);

  const handleSearchResultClick = (targetId: number, configId: string) => {
    // Switch to the correct config if needed
    if (configId !== activeConfigId) {
      setActiveConfigId(configId);
    }
    setTargetSearch("");
    setSearchOpen(false);
    setTimeout(() => {
      setHighlightedTargetId(targetId);
      const rowEl = targetRowRefs.current[`${configId}-${targetId}`] || document.getElementById(`target-row-${configId}-${targetId}`);
      if (rowEl) {
        rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      setTimeout(() => setHighlightedTargetId(null), 1600);
    }, 250);
  };

  const handleAddTarget = (filterData: FilterData) => {
    if (!activeConfig) return;

    const stickerInfos: StickerInfo[] = filterData.stickers
      .filter(s => s.name.trim())
      .map((s, idx) => ({
        name: s.name,
        slot: s.slot === "any" ? "any" : parseInt(s.slot),
        isWhole: s.isWhole,
        wearMin: s.wearMin ?? 100,
        wearMax: s.wearMax ?? 100
      }));

    // Check if fade filter is changed from default (80-100)
    const hasFadeFilter = filterData.fadeMin !== "80" || filterData.fadeMax !== "100";
    // Check if blue gem filter is changed from default (0-100)
    const hasBlueGemFilter = filterData.blueMin !== "0" || filterData.blueMax !== "100";
    // Check if sticker overpay filter is changed from default (0-100)
    const hasStickerOverpay = filterData.spStickerPercentMin !== 0 || filterData.spStickerPercentMax !== 100;
    // Check if Sticker Price Percent filter is changed
    const hasStickerPricePercent = filterData.stickersPricePercentMin !== "0" || filterData.stickersPricePercentMax !== "100";
    // Check if discount/overpay filter is changed from default (0, 0)
    const hasDiscountOverpay = filterData.discountOverpayMin !== 0 || filterData.discountOverpayMax !== 0;

    // Check if charm filter is set
    const hasCharm = filterData.selectedCharm && filterData.selectedCharm.trim() !== "";
    const charmPatternMin = parseInt(filterData.charmPatternMin) || 1;
    const charmPatternMax = parseInt(filterData.charmPatternMax) || 100000;
    const hasCharmPattern = charmPatternMin !== 1 || charmPatternMax !== 100000;

    // Determine paint seed value - use paintSeeds array or legacy single value
    const hasPaintSeeds = filterData.paintSeeds && filterData.paintSeeds.length > 0;
    const legacyPattern = filterData.paintSeedMin && filterData.paintSeedMin !== ""
      ? filterData.paintSeedMin
      : "";

    const newTarget: Target = {
      id: Date.now(),
      itemName: filterData.selectedItem && filterData.selectedItem.trim() ? filterData.selectedItem : "*",
      minPrice: filterData.priceFrom ? parseFloat(filterData.priceFrom) : 0,
      maxPrice: filterData.isAnyPrice
        ? -1
        : (filterData.isFixedPrice
          ? (filterData.priceFrom ? parseFloat(filterData.priceFrom) : 0)
          : (filterData.priceTo ? parseFloat(filterData.priceTo) : 100000)),
      isFixedPrice: filterData.isFixedPrice,
      minFloat: parseFloat(filterData.wearMin) || 0,
      maxFloat: parseFloat(filterData.wearMax) || 1,
      seeds: "0",
      pattern: hasPaintSeeds
        ? (filterData.paintSeeds!.length === 1 ? String(filterData.paintSeeds![0]) : "")
        : legacyPattern,
      paintSeeds: hasPaintSeeds ? [...filterData.paintSeeds!] : undefined,
      stickers: stickerInfos,
      stickersRaw: stickerInfos.length > 0 ? stickerInfos.map(s => s.name).join(", ") : "0",
      charms: hasCharm ? filterData.selectedCharm : "0",
      charmInfo: hasCharm || hasCharmPattern ? {
        name: hasCharm ? filterData.selectedCharm : "0",
        patternMin: hasCharmPattern ? charmPatternMin : undefined,
        patternMax: hasCharmPattern ? charmPatternMax : undefined,
      } : undefined,
      rarity: filterData.rarity || "",
      statTrak: filterData.statTrak,
      souvenir: filterData.souvenir,
      // If no special type is explicitly selected, default to normal
      normal: filterData.normal || (!filterData.statTrak && !filterData.souvenir),
      blueGem: filterData.blueGemEnabled ? (filterData.blueGemTier ?? "Enabled") : "0",
      customFilters: filterData.customFilterEnabled ? "Enabled" : "None",
      customFilterEnabled: filterData.customFilterEnabled,
      blueGemEnabled: filterData.blueGemEnabled,
      blueGemTier: filterData.blueGemTier || null,
      fireAndIce: filterData.fireAndIceEnabled ? (filterData.fireAndIceTier ?? "Enabled") : "0",
      fireAndIceEnabled: filterData.fireAndIceEnabled,
      fireAndIceTier: filterData.fireAndIceTier || null,
      activeNotifications: true,
      activeAutopurchase: false,
      fadeEnabled: filterData.fadeFilterEnabled,
      // Add pattern filters from Patterns tab
      fadeMin: hasFadeFilter ? parseFloat(filterData.fadeMin) : undefined,
      fadeMax: hasFadeFilter ? parseFloat(filterData.fadeMax) : undefined,
      blueGemMin: hasBlueGemFilter ? parseFloat(filterData.blueMin) : undefined,
      blueGemMax: hasBlueGemFilter ? parseFloat(filterData.blueMax) : undefined,
      // Always save sticker overpay values (default 0-100 if not changed)
      stickerOverpayMax: filterData.spStickerPercentMax ?? 100,
      spStickerEnabled: filterData.spStickerEnabled,
      // Sticker Price Percent
      stickersPricePercentEnabled: filterData.stickersPricePercentEnabled || false,
      stickersPricePercentMin: parseFloat(filterData.stickersPricePercentMin) || 0,
      stickersPricePercentMax: parseFloat(filterData.stickersPricePercentMax) || 100,
      // Add discount/overpay if changed from default
      discountOverpayMin: hasDiscountOverpay ? filterData.discountOverpayMin : undefined,
      discountOverpayMax: hasDiscountOverpay ? filterData.discountOverpayMax : undefined,
      floatRankGold: filterData.floatRankGold || false,
      floatRankSilver: filterData.floatRankSilver || false,
      floatRankBronze: filterData.floatRankBronze || false,
      phase: filterData.phase,
      // Charm Profit
      charmProfitEnabled: filterData.charmProfitEnabled,
      charmProfitMin: filterData.charmProfitMin,
      charmProfitMax: filterData.charmProfitMax,
    };

    createApiTarget(newTarget, activeConfig.id).then(apiRes => {
      const createdTarget = mapApiTargetToUiTarget(apiRes);
      setConfigs(configs.map(c =>
        c.id === activeConfigId
          ? {
            ...c,
            targets: [...c.targets, createdTarget],
            // Do NOT change enabled state when adding new targets
            enabled: c.enabled
          }
          : c
      ));
    }).catch(e => console.error("Failed to create target", e));
  };

  // Update an existing target with new filter data
  const handleUpdateTarget = (targetId: number, filterData: FilterData) => {
    if (!activeConfig) return;

    // Check if fade filter is changed from default (80-100)
    const hasFadeFilter = filterData.fadeMin !== "80" || filterData.fadeMax !== "100";
    // Check if blue gem filter is changed from default (0-100)
    const hasBlueGemFilter = filterData.blueMin !== "0" || filterData.blueMax !== "100";
    // Check if discount/overpay filter is changed from default (0, 0)
    const hasDiscountOverpay = filterData.discountOverpayMin !== 0 || filterData.discountOverpayMax !== 0;

    // Check if charm filter is set
    const hasCharm = filterData.selectedCharm && filterData.selectedCharm.trim() !== "";
    const charmPatternMin = parseInt(filterData.charmPatternMin) || 1;
    const charmPatternMax = parseInt(filterData.charmPatternMax) || 100000;
    const hasCharmPattern = charmPatternMin !== 1 || charmPatternMax !== 100000;

    // Determine paint seed value
    const hasPaintSeeds = filterData.paintSeeds && filterData.paintSeeds.length > 0;
    const legacyPattern = filterData.paintSeedMin && filterData.paintSeedMin !== ""
      ? filterData.paintSeedMin
      : "";

    const stickerInfos: StickerInfo[] = filterData.stickers
      .filter(s => s.name.trim())
      .map((s, idx) => ({
        name: s.name,
        slot: s.slot === "any" ? "any" : parseInt(s.slot),
        isWhole: s.isWhole,
        wearMin: s.wearMin ?? 100,
        wearMax: s.wearMax ?? 100
      }));

    setConfigs(configs.map(c =>
      c.id === activeConfigId
        ? {
          ...c,
          targets: c.targets.map(t =>
            t.id === targetId
              ? (() => {
                const updatedTarget = {
                  ...t,
                  itemName: filterData.selectedItem && filterData.selectedItem.trim() ? filterData.selectedItem : "*",
                  minPrice: filterData.priceFrom !== "" && filterData.priceFrom !== "Any"
                    ? parseFloat(filterData.priceFrom)
                    : 0,
                  maxPrice: filterData.isAnyPrice
                    ? -1
                    : (filterData.priceTo ? parseFloat(filterData.priceTo) : 100000),
                  isFixedPrice: filterData.isFixedPrice,
                  minFloat: parseFloat(filterData.wearMin) || 0,
                  maxFloat: parseFloat(filterData.wearMax) || 1,
                  pattern: hasPaintSeeds
                    ? (filterData.paintSeeds!.length === 1 ? String(filterData.paintSeeds![0]) : "")
                    : legacyPattern,
                  paintSeeds: hasPaintSeeds ? [...filterData.paintSeeds!] : undefined,
                  stickers: stickerInfos,
                  stickersRaw: stickerInfos.length > 0 ? stickerInfos.map(s => s.name).join(", ") : "0",
                  charms: hasCharm ? filterData.selectedCharm : "0",
                  charmInfo: hasCharm || hasCharmPattern ? {
                    name: hasCharm ? filterData.selectedCharm : "0",
                    patternMin: hasCharmPattern ? charmPatternMin : undefined,
                    patternMax: hasCharmPattern ? charmPatternMax : undefined,
                  } : undefined,
                  rarity: filterData.rarity || "",
                  statTrak: filterData.statTrak,
                  souvenir: filterData.souvenir,
                  normal: filterData.normal,
                  blueGem: filterData.blueGemEnabled ? (filterData.blueGemTier ?? "Enabled") : "0",
                  customFilters: filterData.customFilterEnabled ? "Enabled" : "None",
                  // Update new boolean fields for custom checkboxes
                  customFilterEnabled: filterData.customFilterEnabled,
                  blueGemEnabled: filterData.blueGemEnabled,
                  blueGemTier: filterData.blueGemTier || null,
                  fireAndIce: filterData.fireAndIceEnabled ? (filterData.fireAndIceTier ?? "Enabled") : "0",
                  fireAndIceEnabled: filterData.fireAndIceEnabled,
                  fireAndIceTier: filterData.fireAndIceTier || null,
                  fadeEnabled: filterData.fadeFilterEnabled,
                  // Preserve original values if filter is at default
                  fadeMin: hasFadeFilter ? parseFloat(filterData.fadeMin) : t.fadeMin,
                  fadeMax: hasFadeFilter ? parseFloat(filterData.fadeMax) : t.fadeMax,
                  blueGemMin: hasBlueGemFilter ? parseFloat(filterData.blueMin) : t.blueGemMin,
                  blueGemMax: hasBlueGemFilter ? parseFloat(filterData.blueMax) : t.blueGemMax,
                  stickerOverpayMin: filterData.spStickerPercentMin ?? 0,
                  stickerOverpayMax: filterData.spStickerPercentMax ?? 100,
                  spStickerEnabled: filterData.spStickerEnabled,
                  stickersPricePercentEnabled: filterData.stickersPricePercentEnabled || false,
                  stickersPricePercentMin: parseFloat(filterData.stickersPricePercentMin) || 0,
                  stickersPricePercentMax: parseFloat(filterData.stickersPricePercentMax) || 100,
                  discountOverpayMin: hasDiscountOverpay ? filterData.discountOverpayMin : t.discountOverpayMin,
                  discountOverpayMax: hasDiscountOverpay ? filterData.discountOverpayMax : t.discountOverpayMax,
                  // Float Rank
                  floatRankGold: filterData.floatRankGold || false,
                  floatRankSilver: filterData.floatRankSilver || false,
                  floatRankBronze: filterData.floatRankBronze || false,
                  phase: filterData.phase,
                  // Charm Profit
                  charmProfitEnabled: filterData.charmProfitEnabled,
                  charmProfitMin: filterData.charmProfitMin,
                  charmProfitMax: filterData.charmProfitMax,
                };

                // Call API
                updateApiTarget(updatedTarget, c.id).catch(e => console.error("Update failed", e));

                return updatedTarget;
              })()
              : t
          ),
          enabled: c.enabled
        }
        : c
    ));
    // Note: The above implementation fires API call but updates UI immediately (optimistic).
    // Since we map T -> API payload, it's fine.
  };

  // Convert a target to FilterData for editing
  const targetToFilterData = (target: Target): Partial<FilterData> => {
    // Check if price was explicitly set (not both 0 for range mode)
    const isAnyPrice = target.maxPrice === -1;
    const hasPriceSet = target.isFixedPrice || (target.minPrice !== 0 || target.maxPrice !== 0);

    return {
      selectedItem: target.itemName === "*" ? "" : target.itemName,
      priceFrom: hasPriceSet ? String(target.minPrice) : "",
      priceTo: isAnyPrice ? "Any" : (hasPriceSet ? String(target.maxPrice) : ""),
      isAnyPrice: isAnyPrice,
      isFixedPrice: target.isFixedPrice,
      fixedPriceConfirmed: target.isFixedPrice && hasPriceSet,
      fixedPricePending: target.isFixedPrice && hasPriceSet ? String(target.minPrice) : "",
      rangePriceConfirmed: !target.isFixedPrice && hasPriceSet,
      rangePriceFromPending: hasPriceSet ? String(target.minPrice) : "",
      rangePriceToPending: isAnyPrice ? "Any" : (hasPriceSet ? String(target.maxPrice) : ""),
      wearMin: String(target.minFloat),
      wearMax: String(target.maxFloat),
      fadeMin: target.fadeMin !== undefined ? String(target.fadeMin) : "80",
      fadeMax: target.fadeMax !== undefined ? String(target.fadeMax) : "100",
      blueMin: target.blueGemMin !== undefined ? String(target.blueGemMin) : "0",
      blueMax: target.blueGemMax !== undefined ? String(target.blueGemMax) : "100",
      statTrak: target.statTrak,
      souvenir: target.souvenir,
      normal: target.normal,
      rarity: target.rarity || "",
      paintSeeds: target.paintSeeds,
      paintSeedMin: target.pattern || "",
      spStickerEnabled: target.spStickerEnabled ?? ((target.stickerOverpayMin !== undefined && target.stickerOverpayMin !== 0) ||
        (target.stickerOverpayMax !== undefined && target.stickerOverpayMax !== 100)),
      spStickerPercentMin: target.stickerOverpayMin ?? 0,
      spStickerPercentMax: target.stickerOverpayMax ?? 100,
      stickersPricePercentEnabled: target.stickersPricePercentEnabled || false,
      stickersPricePercentMin: String(target.stickersPricePercentMin ?? 0),
      stickersPricePercentMax: String(target.stickersPricePercentMax ?? 100),
      discountOverpayMin: target.discountOverpayMin ?? 0,
      discountOverpayMax: target.discountOverpayMax ?? 0,
      selectedCharm: target.charmInfo?.name !== "0" && target.charmInfo?.name ? target.charmInfo.name : "",
      charmPatternMin: target.charmInfo?.patternMin !== undefined ? String(target.charmInfo.patternMin) : "1",
      charmPatternMax: target.charmInfo?.patternMax !== undefined ? String(target.charmInfo.patternMax) : "100000",
      blueGemEnabled: !!target.blueGemEnabled || !!target.blueGemTier || (target.blueGem !== undefined && target.blueGem !== "0" && target.blueGem !== "None"),
      blueGemTier: target.blueGemTier || null,
      fireAndIceEnabled: !!target.fireAndIceEnabled || !!target.fireAndIceTier || (target.fireAndIce !== undefined && target.fireAndIce !== "0" && target.fireAndIce !== "None"),
      fireAndIceTier: target.fireAndIceTier || null,
      fadeFilterEnabled: target.fadeEnabled ?? (target.fadeMin !== undefined || target.fadeMax !== undefined),
      customFilterEnabled: target.customFilterEnabled ?? (target.customFilters === "Enabled"),
      // Float Rank
      floatRankGold: target.floatRankGold ?? false,
      floatRankSilver: target.floatRankSilver ?? false,
      floatRankBronze: target.floatRankBronze ?? false,
      phase: target.phase,
      // Charm Profit
      charmProfitEnabled: target.charmProfitEnabled ?? false,
      charmProfitMin: target.charmProfitMin ?? "-100",
      charmProfitMax: target.charmProfitMax ?? "100",
      stickers: target.stickers.length > 0
        ? target.stickers.map(s => ({
          name: s.name,
          slot: String(s.slot) as "any" | "1" | "2" | "3" | "4" | "5",
          isWhole: s.isWhole,
          wearMin: s.wearMin ?? 100,
          wearMax: s.wearMax ?? 100,
          price: 0
        }))
        : [
          { name: "", slot: "any" as const, isWhole: true, wearMin: 100, wearMax: 100, price: 0 },
          { name: "", slot: "any" as const, isWhole: true, wearMin: 100, wearMax: 100, price: 0 },
          { name: "", slot: "any" as const, isWhole: true, wearMin: 100, wearMax: 100, price: 0 },
          { name: "", slot: "any" as const, isWhole: true, wearMin: 100, wearMax: 100, price: 0 },
          { name: "", slot: "any" as const, isWhole: true, wearMin: 100, wearMax: 100, price: 0 },
        ],
    };
  };

  // Handle cell click in edit mode - load target data and navigate to section
  const handleEditCellClick = useCallback((target: Target, section: FilterSection) => {
    if (!isEditMode) return;

    // Load target data into filter panel
    const filterData = targetToFilterData(target);
    setPendingFilterData(filterData);

    // Navigate to the appropriate section with flash animation
    navigateToSection(section, target.id);
  }, [isEditMode, setPendingFilterData, navigateToSection, targetToFilterData]);

  // New config dialog state
  const [isCreateConfigDialogOpen, setIsCreateConfigDialogOpen] = useState(false);
  const [newConfigName, setNewConfigName] = useState("");
  const [newConfigEmoji, setNewConfigEmoji] = useState("");
  const [isCreatingConfig, setIsCreatingConfig] = useState(false);
  // Use ref for immediate synchronous lock - state updates are async and can't prevent rapid clicks
  const isCreatingConfigRef = useRef(false);

  const openCreateConfigDialog = () => {
    setNewConfigName(`Config ${configs.length + 1}`);
    setNewConfigEmoji("");
    setIsCreatingConfig(false);
    isCreatingConfigRef.current = false;
    setIsCreateConfigDialogOpen(true);
  };

  const createConfig = () => {
    // Check ref immediately (synchronous) - this is the key protection
    if (isCreatingConfigRef.current || configs.length >= 100) return;

    // Lock immediately with ref (synchronous)
    isCreatingConfigRef.current = true;
    setIsCreatingConfig(true);

    // Close dialog immediately to prevent further clicks
    setIsCreateConfigDialogOpen(false);

    const trimmedName = newConfigName.trim() || `Config ${configs.length + 1}`;
    const fullName = newConfigEmoji ? `${newConfigEmoji} ${trimmedName}` : trimmedName;

    const newConfig: Config = {
      id: trimmedName, // Use name without emoji as ID to match backend
      name: trimmedName,
      emoji: newConfigEmoji || undefined,
      enabled: false,
      targets: []
    };
    // Save config to DB so it persists after page reload (even when empty and disabled)
    createApiConfig(trimmedName, newConfigEmoji || undefined, false).catch(e =>
      console.error("Failed to create config in DB", e)
    );
    setConfigs([...configs, newConfig]);
    setActiveConfigId(newConfig.id);
    setNewConfigName("");
    setNewConfigEmoji("");

    // Reset after a short delay to allow for re-opening dialog
    setTimeout(() => {
      isCreatingConfigRef.current = false;
      setIsCreatingConfig(false);
    }, 100);
  };

  const deleteConfig = (configId: string) => {
    const newConfigs = configs.filter(c => c.id !== configId);
    setConfigs(newConfigs);
    if (activeConfigId === configId && newConfigs.length > 0) {
      setActiveConfigId(newConfigs[0].id);
    }
  };

  // Delete config dialog state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfigIds, setDeleteConfigIds] = useState<Set<string>>(new Set());
  const [deleteConfirmStep, setDeleteConfirmStep] = useState<'select' | 'confirm'>('select');
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const holdStartRef = useRef<number | null>(null);
  const HOLD_DURATION = 3000; // 3 seconds

  // Hold-to-toggle config enabled state
  const [toggleHoldProgress, setToggleHoldProgress] = useState(0);
  const toggleHoldTimerRef = useRef<NodeJS.Timeout | null>(null);
  const toggleHoldStartRef = useRef<number | null>(null);
  const TOGGLE_HOLD_DURATION = 1000; // 1 second

  const openDeleteDialog = () => {
    // Pre-select current config
    setDeleteConfigIds(new Set([activeConfigId]));
    setDeleteConfirmStep('select');
    setHoldProgress(0);
    setIsDeleteDialogOpen(true);
  };

  const toggleDeleteSelection = (configId: string) => {
    setDeleteConfigIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(configId)) {
        newSet.delete(configId);
      } else {
        newSet.add(configId);
      }
      return newSet;
    });
  };

  const proceedToConfirm = () => {
    setDeleteConfirmStep('confirm');
    setHoldProgress(0);
  };

  const confirmDeleteConfigs = useCallback(async () => {
    // Delete from API
    for (const configId of deleteConfigIds) {
      const config = configs.find(c => c.id === configId);
      if (config) {
        await deleteApiConfig(config.id);
      }
    }

    const newConfigs = configs.filter(c => !deleteConfigIds.has(c.id));
    setConfigs(newConfigs);
    if (deleteConfigIds.has(activeConfigId) && newConfigs.length > 0) {
      setActiveConfigId(newConfigs[0].id);
    }
    setDeleteConfigIds(new Set());
    setDeleteConfirmStep('select');
    setHoldProgress(0);
    setIsDeleteDialogOpen(false);
  }, [configs, deleteConfigIds, activeConfigId, setConfigs]);

  const startHoldDelete = useCallback(() => {
    holdStartRef.current = Date.now();

    const updateProgress = () => {
      if (!holdStartRef.current) return;
      const elapsed = Date.now() - holdStartRef.current;
      const progress = Math.min((elapsed / HOLD_DURATION) * 100, 100);
      setHoldProgress(progress);

      if (progress >= 100) {
        // Trigger delete
        holdStartRef.current = null;
      } else {
        holdTimerRef.current = setTimeout(updateProgress, 16); // ~60fps
      }
    };

    holdTimerRef.current = setTimeout(updateProgress, 16);
  }, []);

  // Effect to trigger delete when progress reaches 100
  useEffect(() => {
    if (holdProgress >= 100) {
      confirmDeleteConfigs();
    }
  }, [holdProgress, confirmDeleteConfigs]);

  const stopHoldDelete = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    holdStartRef.current = null;
    setHoldProgress(0);
  }, []);

  const cancelDelete = () => {
    stopHoldDelete();
    setDeleteConfigIds(new Set());
    setDeleteConfirmStep('select');
    setHoldProgress(0);
    setIsDeleteDialogOpen(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
      }
    };
  }, []);

  const totalTargetsToDelete = configs
    .filter(c => deleteConfigIds.has(c.id))
    .reduce((sum, c) => sum + c.targets.length, 0);

  const toggleConfigSelection = (configId: string) => {
    setSelectedConfigIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(configId)) {
        newSet.delete(configId);
      } else {
        newSet.add(configId);
      }
      return newSet;
    });
  };

  const deleteSelectedConfigs = () => {
    const newConfigs = configs.filter(c => !selectedConfigIds.has(c.id));
    setConfigs(newConfigs);
    if (selectedConfigIds.has(activeConfigId) && newConfigs.length > 0) {
      setActiveConfigId(newConfigs[0].id);
    }
    setSelectedConfigIds(new Set());
    setIsSelectMode(false);
  };

  const cancelSelectMode = () => {
    setSelectedConfigIds(new Set());
    setIsSelectMode(false);
  };

  const executeToggleConfig = useCallback(async () => {
    if (!activeConfigId) return;
    const config = configs.find(c => c.id === activeConfigId);
    if (!config) return;

    const newState = !config.enabled;
    // API Call
    fetch(`${API_BASE}/configs/${encodeURIComponent(config.id)}/toggle?active=${newState}`, { method: 'PATCH' }).catch(console.error);

    setConfigs(prev => prev.map(c =>
      c.id === activeConfigId ? { ...c, enabled: newState } : c
    ));
    // Reset toggle state
    if (toggleHoldTimerRef.current) {
      clearTimeout(toggleHoldTimerRef.current);
      toggleHoldTimerRef.current = null;
    }
    toggleHoldStartRef.current = null;
    setToggleHoldProgress(0);
  }, [activeConfigId, configs]);

  const startHoldToggle = useCallback(() => {
    toggleHoldStartRef.current = Date.now();

    const updateProgress = () => {
      if (!toggleHoldStartRef.current) return;
      const elapsed = Date.now() - toggleHoldStartRef.current;
      const progress = Math.min((elapsed / TOGGLE_HOLD_DURATION) * 100, 100);
      setToggleHoldProgress(progress);

      if (progress >= 100) {
        // Trigger toggle using functionality
        const config = configs.find(c => c.id === activeConfigId);
        if (config) {
          const newState = !config.enabled;
          // API Call
          fetch(`${API_BASE}/configs/${encodeURIComponent(config.id)}/toggle?active=${newState}`, { method: 'PATCH' }).catch(console.error);

          setConfigs(prev => prev.map(c =>
            c.id === activeConfigId ? { ...c, enabled: newState } : c
          ));
        }

        // Reset
        toggleHoldStartRef.current = null;
        setToggleHoldProgress(0);
      } else {
        toggleHoldTimerRef.current = setTimeout(updateProgress, 16); // ~60fps
      }
    };

    toggleHoldTimerRef.current = setTimeout(updateProgress, 16);
  }, [activeConfigId, configs]);

  const stopHoldToggle = useCallback(() => {
    if (toggleHoldTimerRef.current) {
      clearTimeout(toggleHoldTimerRef.current);
      toggleHoldTimerRef.current = null;
    }
    toggleHoldStartRef.current = null;
    setToggleHoldProgress(0);
  }, []);

  const toggleConfigEnabled = (configId: string) => {
    setConfigs(configs.map(c =>
      c.id === configId ? { ...c, enabled: !c.enabled } : c
    ));
  };

  const openRenameDialog = (configId: string) => {
    const config = configs.find(c => c.id === configId);
    if (!config) return;
    setRenameConfigId(configId);
    setRenameName(config.name);
    setRenameEmoji(config.emoji || "");
    setIsRenameDialogOpen(true);
  };

  const saveRename = async () => {
    if (!renameConfigId || !renameName.trim()) return;
    const config = configs.find(c => c.id === renameConfigId);
    if (config) {
      try {
        const newFullName = renameEmoji ? `${renameEmoji} ${renameName.trim()}` : renameName.trim();
        await renameApiConfig(config.id, newFullName, renameEmoji || undefined);

        setConfigs(configs.map(c =>
          c.id === renameConfigId
            ? { ...c, id: newFullName, name: renameName.trim(), emoji: renameEmoji || undefined }
            : c
        ));

        if (activeConfigId === renameConfigId) {
          setActiveConfigId(newFullName);
        }
      } catch (e) {
        console.error("Rename failed", e);
      }
    }
    setIsRenameDialogOpen(false);
    setRenameConfigId(null);
    setRenameName("");
    setRenameEmoji("");
  };

  const cancelRename = () => {
    setIsRenameDialogOpen(false);
    setRenameConfigId(null);
    setRenameName("");
    setRenameEmoji("");
  };

  const deleteTarget = (configId: string, targetId: number) => {
    deleteApiTarget(targetId).then(() => {
      setConfigs(configs.map(c =>
        c.id === configId
          ? {
            ...c,
            targets: c.targets.filter(t => t.id !== targetId),
            enabled: c.enabled
          }
          : c
      ));
    }).catch(e => console.error("Delete target failed", e));
  };

  const clearAllTargets = (configId: string) => {
    const config = configs.find(c => c.id === configId);
    if (!config) return;

    // Call API to delete config (which deletes all targets)
    // Note: The backend treats config deletion as removing all targets for that config name
    deleteApiConfig(config.id)
      .then(() => {
        // Update local state
        setConfigs(configs.map(c =>
          c.id === configId ? { ...c, targets: [], enabled: false } : c
        ));

        // Show success toast
        import('sonner').then(({ toast }) => {
          toast.success('Цели очищены', {
            description: `Все цели из конфигурации "${config.name}" были удалены.`,
            duration: 3000,
          });
        });
      })
      .catch(err => {
        console.error("Failed to clear targets", err);
        // Show error toast
        import('sonner').then(({ toast }) => {
          toast.error('Ошибка', {
            description: 'Не удалось очистить цели. Попробуйте снова.',
            duration: 3000,
          });
        });
      });
  };

  const toggleTargetNotifications = (configId: string, targetId: number) => {
    // Optimistically update UI
    const updatedConfigs = configs.map(c =>
      c.id === configId
        ? {
          ...c,
          targets: c.targets.map(t =>
            t.id === targetId ? { ...t, activeNotifications: !t.activeNotifications } : t
          ),
          enabled: c.enabled
        }
        : c
    );
    setConfigs(updatedConfigs);

    // Persist to API
    const config = configs.find(c => c.id === configId);
    const target = config?.targets.find(t => t.id === targetId);
    if (config && target) {
      const updatedTarget = { ...target, activeNotifications: !target.activeNotifications };
      updateApiTarget(updatedTarget, config.id).catch(e => {
        console.error("Failed to toggle notifications persistence", e);
        // Revert on failure? For now just log.
      });
    }
  };

  const toggleTargetAutopurchase = (configId: string, targetId: number) => {
    // Optimistically update UI
    const updatedConfigs = configs.map(c =>
      c.id === configId
        ? {
          ...c,
          targets: c.targets.map(t =>
            t.id === targetId ? { ...t, activeAutopurchase: !t.activeAutopurchase } : t
          ),
          enabled: c.enabled
        }
        : c
    );
    setConfigs(updatedConfigs);

    // Persist to API
    const config = configs.find(c => c.id === configId);
    const target = config?.targets.find(t => t.id === targetId);
    if (config && target) {
      const updatedTarget = { ...target, activeAutopurchase: !target.activeAutopurchase };
      updateApiTarget(updatedTarget, config.id).catch(e => {
        console.error("Failed to toggle autopurchase persistence", e);
      });
    }
  };

  const moveTargetToConfig = async (fromConfigId: string, targetId: number, toConfigId: string) => {
    const fromConfig = configs.find(c => c.id === fromConfigId);
    const target = fromConfig?.targets.find(t => t.id === targetId);
    const toConfig = configs.find(c => c.id === toConfigId);

    if (!target || !toConfig) return;

    try {
      // Call API to move target
      const res = await fetch(`${API_BASE}/targets/${targetId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_config_name: toConfig.id })
      });

      if (!res.ok) throw new Error("Failed to move target");

      const updatedTargetApi: ApiTarget = await res.json();
      const updatedTarget = mapApiTargetToUiTarget(updatedTargetApi);

      setConfigs(prev => prev.map(c => {
        if (c.id === fromConfigId) {
          const newTargets = c.targets.filter(t => t.id !== targetId);
          return { ...c, targets: newTargets, enabled: c.enabled };
        }
        if (c.id === toConfigId) {
          const newTargets = [...c.targets, updatedTarget];
          return { ...c, targets: newTargets, enabled: c.enabled };
        }
        return c;
      }));

      // Show success toast
      import('sonner').then(({ toast }) => {
        toast.success('Target Moved', {
          description: `Moved "${target.itemName}" to ${toConfig.name}`,
        });
      });

    } catch (e) {
      console.error("Failed to move target", e);
      import('sonner').then(({ toast }) => {
        toast.error('Move Failed', {
          description: 'Could not move target. Please try again.',
        });
      });
    }

    setMoveTargetId(null);
  };

  const togglePinnedCopyConfig = (configId: string) => {
    setPinnedCopyConfigIds(prev => {
      const next = new Set(prev);
      if (next.has(configId)) next.delete(configId);
      else next.add(configId);
      localStorage.setItem('pinned-copy-configs', JSON.stringify([...next]));
      return next;
    });
  };

  const sortedConfigsForCopy = (excludeId: string) => {
    const filtered = configs.filter(c => c.id !== excludeId);
    const pinned = filtered.filter(c => pinnedCopyConfigIds.has(c.id));
    const unpinned = filtered.filter(c => !pinnedCopyConfigIds.has(c.id));
    return [...pinned, ...unpinned];
  };

  const copyTargetToConfig = async (fromConfigId: string, targetId: number, toConfigId: string) => {
    const fromConfig = configs.find(c => c.id === fromConfigId);
    const target = fromConfig?.targets.find(t => t.id === targetId);
    const toConfig = configs.find(c => c.id === toConfigId);

    if (!target || !toConfig) return;

    try {
      const newApiTarget = await createApiTarget(target, toConfig.name);
      const newUiTarget = mapApiTargetToUiTarget(newApiTarget);

      setConfigs(prev => prev.map(c => {
        if (c.id === toConfigId) {
          return { ...c, targets: [...c.targets, newUiTarget], enabled: c.enabled };
        }
        return c;
      }));

      import('sonner').then(({ toast }) => {
        toast.success('Target Copied', {
          description: `Copied "${target.itemName}" to ${toConfig.name}`,
        });
      });
    } catch (e) {
      console.error("Failed to copy target", e);
      import('sonner').then(({ toast }) => {
        toast.error('Copy Failed', {
          description: 'Could not copy target. Please try again.',
        });
      });
    }
  };

  const handleDragStart = (e: React.DragEvent, configId: string) => {
    setDraggedConfigId(configId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, configId: string) => {
    e.preventDefault();
    if (draggedConfigId && draggedConfigId !== configId) {
      setDragOverConfigId(configId);
    }
  };

  const handleDragLeave = () => {
    setDragOverConfigId(null);
  };

  const handleDrop = (e: React.DragEvent, targetConfigId: string) => {
    e.preventDefault();
    if (!draggedConfigId || draggedConfigId === targetConfigId) {
      setDraggedConfigId(null);
      setDragOverConfigId(null);
      return;
    }

    const draggedIndex = configs.findIndex(c => c.id === draggedConfigId);
    const targetIndex = configs.findIndex(c => c.id === targetConfigId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newConfigs = [...configs];
    const [removed] = newConfigs.splice(draggedIndex, 1);
    newConfigs.splice(targetIndex, 0, removed);

    setConfigs(newConfigs);
    setDraggedConfigId(null);
    setDragOverConfigId(null);
  };

  const handleDragEnd = () => {
    setDraggedConfigId(null);
    setDragOverConfigId(null);
  };

  const SortableHeader = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <th className={`px-3 py-3 text-left text-xs font-medium text-muted-foreground/80 uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors ${className}`}>
      <div className="flex items-center gap-1">
        <ArrowUpDown className="h-3 w-3" />
        {children}
      </div>
    </th>
  );

  const getConfigsList = () => configs.map(c => ({ id: c.id, name: c.name }));

  const displayFilterValue = (value: string) =>
    value === "Any" || value === "Any Tier" ? "0" : value;

  return (
    <div className="h-full flex relative">
      {/* Global Overlay for Duplicate Mode - Covers everything except table and floating bar */}
      {isDuplicateMode && (
        <div className="fixed inset-0 z-[100] bg-background/80 cursor-not-allowed" />
      )}

      {/* Left Panel - Filter Panel (always visible) */}
      <div className="relative h-full shrink-0 flex flex-col">
        <TargetFilterPanel
          onAddTarget={handleAddTarget}
          onUpdateTarget={handleUpdateTarget}
        />
        {isEditMode && !editingTargetId && (
          <div className="absolute inset-x-0 top-0 bottom-[80px] bg-black/45 z-20 cursor-not-allowed pointer-events-auto" />
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden pt-12">
        {/* Header with Config Tabs */}
        <div className="py-2.5 px-4 border-b border-border relative">
          {isEditMode && !editingTargetId && (
            <div className="absolute inset-0 bg-black/45 z-40 cursor-not-allowed pointer-events-auto" />
          )}
          {/* Config Tabs - Single row with elevator widget and tabs */}
          <div className="flex items-center gap-3 w-full min-w-0">
            {/* + button with dialog - left */}
            {configs.length < 100 && !isSelectMode && (
              <>
                <div className="group relative shrink-0">
                  <Button
                    variant="outline"
                    className="h-[34px] w-[34px] 2xl:h-[38px] 2xl:w-[38px] border-dashed border-primary/50 hover:border-primary hover:bg-primary/10 text-primary/70 hover:text-primary transition-all p-0"
                    onClick={openCreateConfigDialog}
                  >
                    <Plus className="h-4 w-4 2xl:h-5 2xl:w-5" />
                  </Button>
                  <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-popover border border-border rounded text-xs text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    Create Config ({configs.length}/100)
                  </div>
                </div>

                {/* Create Config Dialog */}
                <AlertDialog open={isCreateConfigDialogOpen} onOpenChange={setIsCreateConfigDialogOpen}>
                  <AlertDialogContent className="bg-card border-border max-w-md">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Create New Config</AlertDialogTitle>
                      <AlertDialogDescription>
                        Enter a name and optionally choose an icon for your configuration.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4 space-y-4">
                      {/* Preview of selected name + emoji */}
                      <div className="flex items-center justify-center gap-2 p-3 bg-secondary/50 rounded-lg border border-border">
                        <span className="text-2xl">{newConfigEmoji || "📋"}</span>
                        <span className="text-lg font-medium text-foreground">
                          {newConfigName.trim() || `Config ${configs.length + 1}`}
                        </span>
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground mb-1.5 block">Name</label>
                        <Input
                          value={newConfigName}
                          onChange={(e) => setNewConfigName(e.target.value.slice(0, 20))}
                          maxLength={20}
                          placeholder="Config name..."
                          className="bg-input border-border"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !isCreatingConfigRef.current) {
                              createConfig();
                            }
                          }}
                        />
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground mb-1.5 block">
                          Icon <span className="text-muted-foreground/50">(optional)</span>
                        </label>
                        <div className="grid grid-cols-10 gap-1 p-2 bg-secondary/30 rounded-lg border border-border max-h-[160px] overflow-y-auto">
                          {/* No emoji option */}
                          <button
                            type="button"
                            onClick={() => setNewConfigEmoji("")}
                            className={`w-7 h-7 flex items-center justify-center rounded hover:bg-primary/20 transition-colors text-xs ${newConfigEmoji === "" ? 'bg-primary/30 ring-2 ring-primary' : ''
                              }`}
                          >
                            <X className="h-3 w-3 text-muted-foreground" />
                          </button>
                          {CONFIG_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => setNewConfigEmoji(emoji)}
                              className={`w-7 h-7 flex items-center justify-center rounded hover:bg-primary/20 transition-colors text-base ${newConfigEmoji === emoji ? 'bg-primary/30 ring-2 ring-primary' : ''
                                }`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="border-border" disabled={isCreatingConfig}>Cancel</AlertDialogCancel>
                      <Button
                        className="bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          createConfig();
                        }}
                        disabled={isCreatingConfig}
                      >
                        {isCreatingConfig ? "Creating..." : "Create"}
                      </Button>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}

            {/* Unified elevator + config counter widget (from NEW TARGET AND FILTER) */}
            <div className="flex items-center shrink-0 rounded-lg border border-border/50 bg-secondary/20 overflow-hidden h-[34px] 2xl:h-[38px]">
              {/* Up/Down arrows stacked vertically on the left */}
              {totalFloors > 1 && (
                <div className="flex flex-col border-r border-border/30 h-full">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCurrentFloor(f => Math.max(0, f - 1))}
                    disabled={currentFloor === 0}
                    className="h-1/2 w-6 2xl:w-7 rounded-none p-0 hover:bg-secondary/50 disabled:opacity-100"
                  >
                    <ChevronUp className={`h-2.5 w-2.5 2xl:h-3 2xl:w-3 ${currentFloor === 0 ? 'text-destructive/40' : 'text-accent'}`} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCurrentFloor(f => Math.min(totalFloors - 1, f + 1))}
                    disabled={currentFloor >= totalFloors - 1}
                    className="h-1/2 w-6 2xl:w-7 rounded-none p-0 hover:bg-secondary/50 disabled:opacity-100 border-t border-border/20"
                  >
                    <ChevronDown className={`h-2.5 w-2.5 2xl:h-3 2xl:w-3 ${currentFloor >= totalFloors - 1 ? 'text-destructive/40' : 'text-accent'}`} />
                  </Button>
                </div>
              )}

              {/* Center: config count with circular progress + floor indicator */}
              <div className="px-2 2xl:px-2.5 flex items-center gap-1.5 2xl:gap-2 h-full">
                {/* Circular progress ring */}
                <div className="relative w-5 h-5 2xl:w-6 2xl:h-6 shrink-0">
                  <svg className="w-5 h-5 2xl:w-6 2xl:h-6 -rotate-90" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" fill="none" stroke="hsl(var(--border))" strokeWidth="2" />
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      fill="none"
                      stroke={configs.length >= 90 ? 'hsl(var(--destructive))' : configs.length >= 50 ? 'hsl(var(--cs-yellow))' : 'hsl(var(--accent))'}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeDasharray={`${(configs.length / 100) * 56.5} 56.5`}
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[7px] 2xl:text-[8px] font-bold text-foreground">
                    {configs.length}
                  </span>
                </div>

                {/* Floor indicator */}
                {totalFloors > 1 && (
                  <div className="flex flex-col items-center leading-none">
                    <span className="text-[9px] 2xl:text-[10px] font-bold text-foreground">{currentFloor + 1}</span>
                    <div className="w-2.5 2xl:w-3 h-px bg-muted-foreground/30" />
                    <span className="text-[9px] 2xl:text-[10px] text-muted-foreground/60">{totalFloors}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Config Tabs - Single row, no wrap */}
            <div className="flex items-center gap-1.5 2xl:gap-2 flex-1 overflow-x-auto scrollbar-none py-0.5 min-w-0 configs-tabs-container">
              {visibleConfigs.map((config) => (
                <div
                  key={config.id}
                  draggable={!isSelectMode}
                  onDragStart={(e) => !isSelectMode && handleDragStart(e, config.id)}
                  onDragOver={(e) => !isSelectMode && handleDragOver(e, config.id)}
                  onDragLeave={!isSelectMode ? handleDragLeave : undefined}
                  onDrop={(e) => !isSelectMode && handleDrop(e, config.id)}
                  onDragEnd={!isSelectMode ? handleDragEnd : undefined}
                  className={`flex items-center gap-1.5 2xl:gap-2 px-2 2xl:px-3 py-1 2xl:py-2 rounded-lg border cursor-pointer shrink-0 transition-all ${isSelectMode && selectedConfigIds.has(config.id) ? 'ring-2 ring-destructive ring-offset-1 ring-offset-background' : ''
                    } ${dragOverConfigId === config.id ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''
                    } ${draggedConfigId === config.id ? 'opacity-50' : ''
                    } ${activeConfigId === config.id
                      ? config.enabled
                        ? 'bg-cs-green/10 border-cs-green text-cs-green shadow-[0_0_8px_rgba(76,175,80,0.4)]'
                        : 'bg-cs-red/10 border-cs-red text-cs-red shadow-[0_0_8px_rgba(239,83,80,0.4)]'
                      : config.enabled
                        ? 'border-cs-green/50 text-cs-green/70 hover:border-cs-green hover:text-cs-green hover:shadow-[0_0_6px_rgba(76,175,80,0.3)]'
                        : 'border-cs-red/50 text-cs-red/70 hover:border-cs-red hover:text-cs-red hover:shadow-[0_0_6px_rgba(239,83,80,0.3)]'
                    }`}
                  onClick={() => {
                    if (isSelectMode) {
                      toggleConfigSelection(config.id);
                    } else {
                      setActiveConfigId(config.id);
                    }
                  }}
                >
                  {isSelectMode ? (
                    <Checkbox
                      checked={selectedConfigIds.has(config.id)}
                      onCheckedChange={() => toggleConfigSelection(config.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-3.5 w-3.5 2xl:h-4 2xl:w-4 shrink-0 border-destructive/50 data-[state=checked]:bg-destructive data-[state=checked]:border-destructive"
                    />
                  ) : (
                    <GripVertical className="h-2.5 w-2.5 2xl:h-3 2xl:w-3 shrink-0 opacity-50 hover:opacity-100 cursor-grab active:cursor-grabbing" />
                  )}
                  {config.emoji && (
                    <span className="text-sm 2xl:text-base leading-none">{config.emoji}</span>
                  )}
                  <span className="text-xs 2xl:text-sm font-medium truncate max-w-[100px] 2xl:max-w-[160px]" title={config.name}>{config.name}</span>
                  {activeConfigId === config.id && !isSelectMode && (
                    <button
                      className={`inline-flex items-center justify-center h-[18px] w-[18px] 2xl:h-[22px] 2xl:w-[22px] rounded-md border transition-all cursor-pointer shrink-0 group/edit ${config.enabled
                          ? 'border-cs-green/40 bg-cs-green/10 hover:bg-cs-green/20 hover:border-cs-green/60 hover:shadow-[0_0_6px_rgba(76,175,80,0.3)]'
                          : 'border-cs-red/40 bg-cs-red/10 hover:bg-cs-red/20 hover:border-cs-red/60 hover:shadow-[0_0_6px_rgba(239,83,80,0.3)]'
                        }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        openRenameDialog(config.id);
                      }}
                    >
                      <Pencil className={`h-[9px] w-[9px] 2xl:h-[11px] 2xl:w-[11px] transition-colors ${config.enabled
                          ? 'text-cs-green/70 group-hover/edit:text-cs-green'
                          : 'text-cs-red/70 group-hover/edit:text-cs-red'
                        }`} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Config Actions */}
        {activeConfig && (
          <div className="px-3 2xl:px-6 py-2 2xl:py-3 border-b border-border flex items-center gap-1.5 2xl:gap-3 flex-nowrap w-full overflow-hidden relative">
            {isEditMode && !editingTargetId && (
              <div className="absolute inset-0 bg-black/45 z-40 cursor-not-allowed pointer-events-auto" />
            )}
            {/* Config Enabled Toggle - Hold 3 seconds to toggle */}
            <div
              className={`relative min-w-[120px] 2xl:min-w-[160px] h-8 2xl:h-9 rounded-lg overflow-hidden cursor-pointer select-none transition-all duration-200 ${activeConfig.enabled
                ? 'border border-accent shadow-[0_0_12px_rgba(76,175,80,0.3)]'
                : 'border border-destructive/50 shadow-[0_0_12px_rgba(239,83,80,0.2)]'
                }`}
              onMouseDown={startHoldToggle}
              onMouseUp={stopHoldToggle}
              onMouseLeave={stopHoldToggle}
              onTouchStart={startHoldToggle}
              onTouchEnd={stopHoldToggle}
            >
              {/* Background */}
              <div className={`absolute inset-0 ${activeConfig.enabled
                ? 'bg-accent/10'
                : 'bg-destructive/10'
                }`} />

              {/* Progress fill - fills from left to right */}
              <div
                className={`absolute inset-0 transition-none ${activeConfig.enabled
                  ? 'bg-destructive/30'
                  : 'bg-accent/30'
                  }`}
                style={{
                  width: `${toggleHoldProgress}%`,
                  transition: toggleHoldProgress === 0 ? 'width 0.15s ease-out' : 'none'
                }}
              />

              {/* Button content */}
              <div className="absolute inset-0 flex items-center justify-center gap-1.5 2xl:gap-2">
                {activeConfig.enabled ? (
                  <>
                    <Power className={`h-3.5 w-3.5 2xl:h-4 2xl:w-4 ${toggleHoldProgress > 50 ? 'text-destructive-foreground' : 'text-accent'} transition-colors`} />
                    <span className={`text-xs 2xl:text-sm font-medium ${toggleHoldProgress > 50 ? 'text-destructive-foreground' : 'text-accent'} transition-colors`}>
                      {toggleHoldProgress >= 100 ? 'Disabling...' : toggleHoldProgress > 0 ? `${((100 - toggleHoldProgress) * 10).toFixed(0)}ms` : 'Config Enabled'}
                    </span>
                  </>
                ) : (
                  <>
                    <PowerOff className={`h-3.5 w-3.5 2xl:h-4 2xl:w-4 ${toggleHoldProgress > 50 ? 'text-accent-foreground' : 'text-destructive'} transition-colors`} />
                    <span className={`text-xs 2xl:text-sm font-medium ${toggleHoldProgress > 50 ? 'text-accent-foreground' : 'text-destructive'} transition-colors`}>
                      {toggleHoldProgress >= 100 ? 'Enabling...' : toggleHoldProgress > 0 ? `${((100 - toggleHoldProgress) * 10).toFixed(0)}ms` : 'Config Disabled'}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Unified Stats Display with Globe Toggle */}
            <div className={`flex items-center gap-0 rounded-lg border text-[10px] 2xl:text-xs transition-all duration-300 ${isGlobalStatsMode
              ? 'border-primary/50 bg-gradient-to-r from-primary/15 via-primary/10 to-primary/5 shadow-[0_0_15px_rgba(99,102,241,0.15)]'
              : 'border-border bg-secondary/30'
              }`}>
              {/* Globe Toggle Switch */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setIsGlobalStatsMode(!isGlobalStatsMode)}
                    className={`relative flex items-center justify-center h-8 w-8 2xl:h-9 2xl:w-10 rounded-l-lg border-r transition-all duration-300 ${isGlobalStatsMode
                      ? 'bg-primary/20 border-primary/30'
                      : 'bg-secondary/50 border-border hover:bg-secondary/80'
                      }`}
                  >
                    <Globe className={`h-3.5 w-3.5 2xl:h-4 2xl:w-4 transition-all duration-300 ${isGlobalStatsMode
                      ? 'text-primary scale-110'
                      : 'text-muted-foreground hover:text-foreground'
                      }`} />
                    {isGlobalStatsMode && (
                      <span className="absolute -top-1 -right-1 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <div className="text-xs">
                    {isGlobalStatsMode ? 'Global mode ON • Click to show current config' : 'Click to show ALL configs stats'}
                  </div>
                </TooltipContent>
              </Tooltip>

              {/* Notify Count with Bulk Off - LEFT */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="flex items-center gap-1 px-1 2xl:px-1.5 py-0.5 2xl:py-1 cursor-pointer rounded hover:bg-amber-500/10 transition-all group"
                    onClick={() => setBulkDisableConfirm('notify')}
                  >
                    <Bell className="h-3 w-3 text-amber-400 group-hover:hidden" />
                    <BellOff className="h-3 w-3 text-amber-400 hidden group-hover:block" />
                    <span className="text-amber-400 font-semibold tabular-nums text-[10px] 2xl:text-xs">
                      {isGlobalStatsMode
                        ? configs.reduce((acc, c) => acc + (c.enabled ? c.targets.filter(t => t.activeNotifications).length : 0), 0)
                        : (activeConfig.enabled ? activeConfig.targets.filter(t => t.activeNotifications).length : 0)
                      }
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <div className="text-xs">
                    <span className="font-medium text-amber-400">
                      {isGlobalStatsMode
                        ? configs.reduce((acc, c) => acc + (c.enabled ? c.targets.filter(t => t.activeNotifications).length : 0), 0)
                        : (activeConfig.enabled ? activeConfig.targets.filter(t => t.activeNotifications).length : 0)
                      }
                    </span> with notify{isGlobalStatsMode ? ' (all configs)' : ''} • Click to disable all
                  </div>
                </TooltipContent>
              </Tooltip>

              <span className={`h-4 w-px ${isGlobalStatsMode ? 'bg-primary/30' : 'bg-border'}`} />

              {/* Total Targets Count */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 px-1 2xl:px-1.5 py-0.5 2xl:py-1 cursor-default rounded hover:bg-secondary/20 transition-all">
                    <Target className="h-3 w-3 text-muted-foreground" />
                    <span className="font-semibold tabular-nums text-[10px] 2xl:text-xs transition-colors text-foreground">
                      {isGlobalStatsMode
                        ? configs.reduce((acc, c) => acc + c.targets.length, 0)
                        : activeConfig.targets.length
                      }
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <div className="text-xs">
                    <span className="font-medium text-foreground">
                      {isGlobalStatsMode
                        ? configs.reduce((acc, c) => acc + c.targets.length, 0)
                        : activeConfig.targets.length
                      }
                    </span> total targets{isGlobalStatsMode ? ' (all configs)' : ''}
                  </div>
                </TooltipContent>
              </Tooltip>

              <span className={`h-4 w-px ${isGlobalStatsMode ? 'bg-primary/30' : 'bg-border'}`} />

              {/* Buy Count with Bulk Off */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="flex items-center gap-1 px-1 2xl:px-1.5 py-0.5 2xl:py-1 cursor-pointer rounded hover:bg-accent/10 transition-all group"
                    onClick={() => setBulkDisableConfirm('buy')}
                  >
                    <ShoppingCart className="h-3 w-3 text-accent group-hover:hidden" />
                    <ShoppingBag className="h-3 w-3 text-accent hidden group-hover:block" />
                    <span className="text-accent font-semibold tabular-nums text-[10px] 2xl:text-xs">
                      {isGlobalStatsMode
                        ? configs.reduce((acc, c) => acc + (c.enabled ? c.targets.filter(t => t.activeAutopurchase).length : 0), 0)
                        : (activeConfig.enabled ? activeConfig.targets.filter(t => t.activeAutopurchase).length : 0)
                      }
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <div className="text-xs">
                    <span className="font-medium text-accent">
                      {isGlobalStatsMode
                        ? configs.reduce((acc, c) => acc + (c.enabled ? c.targets.filter(t => t.activeAutopurchase).length : 0), 0)
                        : (activeConfig.enabled ? activeConfig.targets.filter(t => t.activeAutopurchase).length : 0)
                      }
                    </span> with auto-buy{isGlobalStatsMode ? ' (all configs)' : ''} • Click to disable all
                  </div>
                </TooltipContent>
              </Tooltip>

              <span className={`h-4 w-px ${isGlobalStatsMode ? 'bg-primary/30' : 'bg-border'}`} />

              {/* Integrated Search */}
              <Popover open={searchOpen && searchResults.length > 0} onOpenChange={setSearchOpen}>
                <PopoverTrigger asChild>
                  <div className="relative flex items-center pl-1 pr-1.5 min-w-[110px] 2xl:min-w-[180px] max-w-[260px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/60 pointer-events-none" />
                    <input
                      placeholder={isGlobalStatsMode ? "Search all..." : "Search targets..."}
                      value={targetSearch}
                      onChange={(e) => {
                        setTargetSearch(e.target.value);
                        setSearchOpen(!!e.target.value.trim());
                      }}
                      onFocus={() => {
                        if (targetSearch.trim()) setSearchOpen(true);
                      }}
                      className={`h-8 2xl:h-9 w-full pl-7 2xl:pl-8 pr-6 2xl:pr-7 text-[10px] 2xl:text-xs bg-transparent border-0 outline-none placeholder:text-muted-foreground/40 ${isGlobalStatsMode ? 'placeholder:text-primary/40' : ''
                        }`}
                    />
                    {targetSearch && (
                      <button
                        onClick={() => { setTargetSearch(""); setSearchOpen(false); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 flex items-center justify-center text-muted-foreground/60 hover:text-foreground transition-colors"
                      >
                        <Eraser className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[420px] p-0 bg-popover/95 backdrop-blur-md border-border/50"
                  align="end"
                  sideOffset={4}
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <div className="p-2 border-b border-border/30 flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium px-1">
                      {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${isGlobalStatsMode
                      ? 'bg-primary/20 text-primary'
                      : 'bg-secondary/50 text-muted-foreground'
                      }`}>
                      {isGlobalStatsMode ? '🌐 Global Mode' : `${activeConfig?.emoji || '📁'} ${activeConfig?.name || 'Local'}`}
                    </span>
                  </div>
                  <div className="max-h-[280px] overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/20">
                          <th className="px-2 py-1.5 text-left text-muted-foreground/60 font-medium">Item</th>
                          <th className="px-2 py-1.5 text-center text-muted-foreground/60 font-medium">Price</th>
                          <th className="px-2 py-1.5 text-center text-muted-foreground/60 font-medium">Float</th>
                          <th className="px-1.5 py-1.5 text-center text-muted-foreground/60 font-medium" title="Notify"><Bell className="h-3 w-3 mx-auto" /></th>
                          <th className="px-1.5 py-1.5 text-center text-muted-foreground/60 font-medium" title="Buy"><ShoppingCart className="h-3 w-3 mx-auto" /></th>
                          {isGlobalStatsMode && (
                            <th className="px-2 py-1.5 text-center text-muted-foreground/60 font-medium">Config</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const configIndexMap = new Map<string, number>();
                          let configIdx = 0;
                          for (const r of searchResults) {
                            if (!configIndexMap.has(r.configId)) {
                              configIndexMap.set(r.configId, configIdx++);
                            }
                          }
                          const configColors = [
                            { bg: 'rgba(99, 102, 241, 0.08)', border: 'rgba(99, 102, 241, 0.5)' },   // indigo
                            { bg: 'rgba(34, 197, 94, 0.08)', border: 'rgba(34, 197, 94, 0.5)' },      // green
                            { bg: 'rgba(234, 179, 8, 0.08)', border: 'rgba(234, 179, 8, 0.5)' },      // yellow
                            { bg: 'rgba(168, 85, 247, 0.08)', border: 'rgba(168, 85, 247, 0.5)' },    // purple
                            { bg: 'rgba(6, 182, 212, 0.08)', border: 'rgba(6, 182, 212, 0.5)' },      // cyan
                            { bg: 'rgba(244, 63, 94, 0.08)', border: 'rgba(244, 63, 94, 0.5)' },      // rose
                            { bg: 'rgba(251, 146, 60, 0.08)', border: 'rgba(251, 146, 60, 0.5)' },    // orange
                            { bg: 'rgba(45, 212, 191, 0.08)', border: 'rgba(45, 212, 191, 0.5)' },    // teal
                          ];

                          const HighlightText = ({ text, highlight }: { text: string, highlight: string }) => {
                            if (!highlight.trim()) return <span>{text}</span>;
                            const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
                            return (
                              <span>
                                {parts.map((part, i) =>
                                  part.toLowerCase() === highlight.toLowerCase() ?
                                    <span key={i} className="bg-primary/30 text-primary font-bold">{part}</span> :
                                    <span key={i}>{part}</span>
                                )}
                              </span>
                            );
                          };

                          return searchResults.map((result) => {
                            const cfgColorIdx = (configIndexMap.get(result.configId) ?? 0) % configColors.length;
                            const cfgColor = isGlobalStatsMode ? configColors[cfgColorIdx] : null;

                            return (
                              <tr
                                key={`${result.configId}-${result.target.id}`}
                                onClick={() => handleSearchResultClick(result.target.id, result.configId)}
                                className={`cursor-pointer hover:bg-accent/20 transition-colors border-b border-border/10 last:border-0 ${highlightedTargetId === result.target.id ? 'search-highlight-row' : ''}`}
                                style={{
                                  ...(cfgColor ? { backgroundColor: cfgColor.bg, borderLeft: `3px solid ${cfgColor.border}` } : {}),
                                }}
                              >
                                <td className="px-2 py-1.5 font-medium text-foreground/90 max-w-[160px] truncate">
                                  <span className={result.target.itemName === '*' ? 'text-accent' : ''}>
                                    <HighlightText text={result.target.itemName} highlight={targetSearch} />
                                  </span>
                                </td>
                                <td className="px-2 py-1.5 font-mono text-foreground/70 text-center">
                                  {result.target.isFixedPrice
                                    ? <span className="font-semibold text-accent"><HighlightText text={`$${result.target.minPrice}`} highlight={targetSearch} /></span>
                                    : result.target.minPrice === 0 && result.target.maxPrice === 0
                                      ? '—'
                                      : <span><span className="text-accent"><HighlightText text={`$${result.target.minPrice}`} highlight={targetSearch} /></span><span className="text-muted-foreground/50">-</span><span className="text-destructive"><HighlightText text={`$${result.target.maxPrice}`} highlight={targetSearch} /></span></span>
                                  }
                                </td>
                                <td className="px-2 py-1.5 font-mono text-foreground/70 text-center">
                                  {(() => {
                                    const getSearchFloatColor = (value: number) => {
                                      if (value <= 0.07) return "hsl(160, 84%, 39%)";
                                      if (value <= 0.15) return "hsl(80, 60%, 50%)";
                                      if (value <= 0.37) return "hsl(45, 93%, 58%)";
                                      if (value <= 0.44) return "hsl(25, 95%, 53%)";
                                      return "hsl(347, 77%, 50%)";
                                    };
                                    return (
                                      <span>
                                        <span style={{ color: getSearchFloatColor(result.target.minFloat) }}><HighlightText text={result.target.minFloat.toFixed(2)} highlight={targetSearch} /></span>
                                        <span className="text-muted-foreground/50">-</span>
                                        <span style={{ color: getSearchFloatColor(result.target.maxFloat) }}><HighlightText text={result.target.maxFloat.toFixed(2)} highlight={targetSearch} /></span>
                                      </span>
                                    );
                                  })()}
                                </td>
                                <td className="px-1.5 py-1.5 text-center">
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // Галочки в поиске не работают ни в каком режиме
                                    }}
                                    className="mx-auto flex items-center justify-center h-5 w-5 rounded transition-colors cursor-default opacity-50"
                                  >
                                    {result.target.activeNotifications ? (
                                      <Check className="h-3 w-3 text-accent" />
                                    ) : (
                                      <X className="h-3 w-3 text-muted-foreground/30" />
                                    )}
                                  </div>
                                </td>
                                <td className="px-1.5 py-1.5 text-center">
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // Галочки в поиске не работают ни в каком режиме
                                    }}
                                    className="mx-auto flex items-center justify-center h-5 w-5 rounded transition-colors cursor-default opacity-50"
                                  >
                                    {result.target.activeAutopurchase ? (
                                      <Check className="h-3 w-3 text-accent" />
                                    ) : (
                                      <X className="h-3 w-3 text-muted-foreground/30" />
                                    )}
                                  </div>
                                </td>
                                {isGlobalStatsMode && (
                                  <td className="px-2 py-1.5 text-muted-foreground/70 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      {result.configEmoji && <span className="text-xs">{result.configEmoji}</span>}
                                      <span className="truncate max-w-[60px]">{result.configName}</span>
                                    </div>
                                  </td>
                                )}
                              </tr>
                            );
                          })
                        })()}
                      </tbody>
                    </table>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Sort Targets - Inline Toggle Group (separate from stats/search panel) */}
            <div className="flex items-center h-8 2xl:h-9 rounded-md border border-border bg-secondary/30 overflow-hidden ml-1 2xl:ml-3 shrink-0">
              {([
                { key: 'price', label: '$', icon: '$' },
                { key: 'float', label: 'ƒ', icon: 'ƒ' },
                { key: 'date', label: '⏱', icon: '⏱' },
              ] as const).map((opt, i) => {
                const isActive = sortField === opt.key;
                return (
                  <button
                    key={opt.key}
                    title={`Sort by ${opt.key === 'price' ? 'Price' : opt.key === 'float' ? 'Float' : 'Date'}`}
                    className={`relative flex items-center justify-center w-7 2xl:w-9 h-full text-[10px] 2xl:text-[11px] font-medium transition-colors ${i > 0 ? 'border-l border-border' : ''} ${isActive
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/30'
                      }`}
                    onClick={() => {
                      if (isActive) {
                        if (!sortAsc) {
                          setSortField(null);
                          setSortAsc(true);
                        } else {
                          setSortAsc(false);
                        }
                      } else {
                        setSortField(opt.key);
                        setSortAsc(true);
                      }
                    }}
                  >
                    <span className="text-[17px]">{opt.icon}</span>
                    <span className={`absolute top-1 right-1 text-[9px] leading-none transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`}>
                      {isActive && sortAsc ? '↑' : '↓'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Bulk Disable Confirmation Dialog */}
            <AlertDialog open={bulkDisableConfirm !== null} onOpenChange={(open) => !open && setBulkDisableConfirm(null)}>
              <AlertDialogContent className="sm:max-w-md">
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    {bulkDisableConfirm === 'notify' ? (
                      <>
                        <BellOff className="h-5 w-5 text-amber-400" />
                        Disable All Notifications
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="h-5 w-5 text-accent" />
                        Disable All Auto-Buy
                      </>
                    )}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {bulkDisableConfirm === 'notify' ? (
                      isGlobalStatsMode ? (
                        <>Are you sure you want to disable notifications for <span className="font-bold text-amber-400">{configs.reduce((acc, c) => acc + c.targets.filter(t => t.activeNotifications).length, 0)}</span> targets across <span className="font-bold text-primary">all configurations</span>?</>
                      ) : (
                        <>Are you sure you want to disable notifications for <span className="font-bold text-amber-400">{activeConfig.targets.filter(t => t.activeNotifications).length}</span> targets in <span className="font-bold">{activeConfig.name}</span>?</>
                      )
                    ) : (
                      isGlobalStatsMode ? (
                        <>Are you sure you want to disable auto-buy for <span className="font-bold text-accent">{configs.reduce((acc, c) => acc + c.targets.filter(t => t.activeAutopurchase).length, 0)}</span> targets across <span className="font-bold text-primary">all configurations</span>?</>
                      ) : (
                        <>Are you sure you want to disable auto-buy for <span className="font-bold text-accent">{activeConfig.targets.filter(t => t.activeAutopurchase).length}</span> targets in <span className="font-bold">{activeConfig.name}</span>?</>
                      )
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className={bulkDisableConfirm === 'notify' ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-accent hover:bg-accent/90'}
                    onClick={() => {
                      if (bulkDisableConfirm === 'notify') {
                        if (isGlobalStatsMode) {
                          setConfigs(prev => prev.map(c => ({
                            ...c,
                            targets: c.targets.map(t => ({ ...t, activeNotifications: false }))
                          })));
                        } else {
                          setConfigs(prev => prev.map(c =>
                            c.id === activeConfigId
                              ? { ...c, targets: c.targets.map(t => ({ ...t, activeNotifications: false })) }
                              : c
                          ));
                        }
                      } else {
                        if (isGlobalStatsMode) {
                          setConfigs(prev => prev.map(c => ({
                            ...c,
                            targets: c.targets.map(t => ({ ...t, activeAutopurchase: false }))
                          })));
                        } else {
                          setConfigs(prev => prev.map(c =>
                            c.id === activeConfigId
                              ? { ...c, targets: c.targets.map(t => ({ ...t, activeAutopurchase: false })) }
                              : c
                          ));
                        }
                      }
                      setBulkDisableConfirm(null);
                    }}
                  >
                    Disable All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Edit Mode Toggle Button */}
            <div className={isDuplicateMode ? 'pointer-events-none opacity-30' : ''}>
              <EditModeButton />
            </div>

            {/* Duplicate Config */}
            <Button
              variant="outline"
              size="sm"
              className={`border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 px-2 2xl:px-3 ${isDuplicateMode ? 'border-primary text-primary' : ''}`}
              onClick={() => {
                if (!isDuplicateMode && activeConfig) {
                  setDupSelectedTargets(new Set(activeConfig.targets.map(t => t.id)));
                  setIsDuplicateMode(true);
                }
              }}
              disabled={isDuplicateMode}
            >
              <Copy className="h-3.5 w-3.5 2xl:mr-1.5" />
              <span className="hidden 2xl:inline">Duplicate</span>
            </Button>

            <div className="w-px h-6 bg-border" />

            {/* Import/Export Buttons */}
            <div className={`flex items-center gap-1.5 2xl:gap-2 ${isDuplicateMode ? 'pointer-events-none opacity-30' : ''}`}>
              <Button
                variant="outline"
                size="sm"
                className="border-primary/50 text-primary hover:bg-primary/10 hover:border-primary px-2 2xl:px-3"
                onClick={() => {
                  const dataStr = JSON.stringify(activeConfig, null, 2);
                  const blob = new Blob([dataStr], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${activeConfig.name.replace(/\s+/g, '_')}_config.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <Download className="h-3.5 w-3.5 2xl:mr-1.5" />
                <span className="hidden 2xl:inline">Export</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="border-primary/50 text-primary hover:bg-primary/10 hover:border-primary px-2 2xl:px-3"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.json';
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = async (event) => {
                        try {
                          const imported = JSON.parse(event.target?.result as string);
                          if (imported.targets && Array.isArray(imported.targets)) {
                            const targetsToImport = imported.targets as Target[];
                            // Convert UI targets to API payloads
                            const apiPayloads = targetsToImport.map((t: Target) => mapUiTargetToApiPayload(t, activeConfig.name));

                            // Call API
                            const res = await fetch(`${API_BASE}/configs/${activeConfig.name}/import`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ targets: apiPayloads })
                            });

                            if (!res.ok) throw new Error("Import failed");

                            const result = await res.json();
                            const createdTargets: ApiTarget[] = result.targets;

                            setConfigs(prev => prev.map(c =>
                              c.id === activeConfigId
                                ? { ...c, targets: [...c.targets, ...createdTargets.map(mapApiTargetToUiTarget)] }
                                : c
                            ));

                            import('sonner').then(({ toast }) => {
                              toast.success('Import Successful', {
                                description: `Imported ${createdTargets.length} targets into ${activeConfig.name}`,
                              });
                            });
                          }
                        } catch (err) {
                          console.error('Failed to import config:', err);
                          import('sonner').then(({ toast }) => {
                            toast.error('Import Failed', {
                              description: 'Failed to process import file.',
                            });
                          });
                        }
                      };
                      reader.readAsText(file);
                    }
                  };
                  input.click();
                }}
              >
                <Upload className="h-3.5 w-3.5 2xl:mr-1.5" />
                <span className="hidden 2xl:inline">Import</span>
              </Button>
            </div>

            <div className="w-px h-6 bg-border" />

            {/* Clear All Dialog */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-cs-yellow/50 text-cs-yellow hover:text-cs-yellow hover:bg-cs-yellow/10 hover:border-cs-yellow px-2 2xl:px-3"
                >
                  <Eraser className="h-3.5 w-3.5 2xl:mr-1.5" />
                  <span className="hidden 2xl:inline">Clear All</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-card border-border">
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear All Targets?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove all targets from "{activeConfig.name}". This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-cs-yellow hover:bg-cs-yellow/90 text-background"
                    onClick={() => clearAllTargets(activeConfig.id)}
                  >
                    Clear All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button
              variant="outline"
              size="sm"
              className="border-destructive/50 text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive px-2 2xl:px-3"
              onClick={openDeleteDialog}
            >
              <Trash2 className="h-3.5 w-3.5 2xl:mr-1.5" />
              <span className="hidden 2xl:inline">Delete Config</span>
            </Button>

            {/* Delete Config Dialog */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => !open && cancelDelete()}>
              <AlertDialogContent className="bg-card border-border max-w-md">
                {deleteConfirmStep === 'select' ? (
                  <>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Configurations</AlertDialogTitle>
                      <AlertDialogDescription>
                        Select which configurations to delete.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4 space-y-2 max-h-[300px] overflow-y-auto">
                      {configs.map((config) => (
                        <label
                          key={config.id}
                          className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${deleteConfigIds.has(config.id)
                            ? 'border-destructive/50 bg-destructive/10'
                            : 'border-border hover:border-border/80 hover:bg-secondary/30'
                            }`}
                        >
                          <Checkbox
                            checked={deleteConfigIds.has(config.id)}
                            onCheckedChange={() => toggleDeleteSelection(config.id)}
                            className="h-4 w-4 border-destructive/50 data-[state=checked]:bg-destructive data-[state=checked]:border-destructive"
                          />
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {config.emoji && <span className="text-base">{config.emoji}</span>}
                            <span className="text-sm font-medium truncate">{config.name}</span>
                            {config.id === activeConfigId && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary">current</span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">{config.targets.length} targets</span>
                        </label>
                      ))}
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="border-border" onClick={cancelDelete}>
                        Cancel
                      </AlertDialogCancel>
                      <Button
                        variant="destructive"
                        disabled={deleteConfigIds.size === 0}
                        onClick={proceedToConfirm}
                      >
                        Continue ({deleteConfigIds.size})
                      </Button>
                    </AlertDialogFooter>
                  </>
                ) : (
                  <>
                    <AlertDialogHeader>
                      <div className="flex items-center justify-center mb-4">
                        <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center animate-pulse">
                          <Trash2 className="h-8 w-8 text-destructive" />
                        </div>
                      </div>
                      <AlertDialogTitle className="text-center text-xl">
                        ⚠️ Final Confirmation
                      </AlertDialogTitle>
                      <AlertDialogDescription className="text-center">
                        You are about to permanently delete:
                      </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="py-4 space-y-3">
                      {/* Summary box */}
                      <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Configurations:</span>
                          <span className="text-lg font-bold text-destructive">{deleteConfigIds.size}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Total targets:</span>
                          <span className="text-lg font-bold text-destructive">{totalTargetsToDelete}</span>
                        </div>
                        <div className="pt-2 border-t border-destructive/20">
                          <div className="flex flex-wrap gap-1">
                            {configs.filter(c => deleteConfigIds.has(c.id)).map(c => (
                              <span
                                key={c.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-destructive/20 text-destructive"
                              >
                                {c.emoji && <span>{c.emoji}</span>}
                                {c.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Hold to delete */}
                      <div className="space-y-3">
                        <label className="text-sm text-muted-foreground text-center block">
                          Hold the button for <span className="font-bold text-destructive">3 seconds</span> to confirm deletion
                        </label>

                        <div className="flex justify-center">
                          <button
                            type="button"
                            className="relative w-48 h-14 rounded-lg overflow-hidden border-2 border-destructive/50 bg-destructive/10 cursor-pointer select-none active:scale-[0.98] transition-transform"
                            onMouseDown={startHoldDelete}
                            onMouseUp={stopHoldDelete}
                            onMouseLeave={stopHoldDelete}
                            onTouchStart={startHoldDelete}
                            onTouchEnd={stopHoldDelete}
                          >
                            {/* Progress fill */}
                            <div
                              className="absolute inset-0 bg-destructive transition-none"
                              style={{
                                width: `${holdProgress}%`,
                                transition: holdProgress === 0 ? 'width 0.15s ease-out' : 'none'
                              }}
                            />
                            {/* Button content */}
                            <div className="absolute inset-0 flex items-center justify-center gap-2">
                              <Trash2 className={`h-5 w-5 ${holdProgress > 50 ? 'text-destructive-foreground' : 'text-destructive'} transition-colors`} />
                              <span className={`font-bold ${holdProgress > 50 ? 'text-destructive-foreground' : 'text-destructive'} transition-colors`}>
                                {holdProgress >= 100 ? 'Deleting...' : holdProgress > 0 ? `${Math.ceil((100 - holdProgress) / 33.33)}s` : 'Hold to Delete'}
                              </span>
                            </div>
                            {/* Pulsing border when holding */}
                            {holdProgress > 0 && holdProgress < 100 && (
                              <div className="absolute inset-0 border-2 border-destructive animate-pulse rounded-lg" />
                            )}
                          </button>
                        </div>

                        <p className="text-xs text-muted-foreground/60 text-center">
                          Release to cancel
                        </p>
                      </div>
                    </div>

                    <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                      <Button
                        variant="outline"
                        className="border-border"
                        onClick={() => { stopHoldDelete(); setDeleteConfirmStep('select'); }}
                      >
                        ← Back
                      </Button>
                      <div className="flex-1" />
                      <AlertDialogCancel className="border-border" onClick={cancelDelete}>
                        Cancel
                      </AlertDialogCancel>
                    </AlertDialogFooter>
                  </>
                )}
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {/* Edit Mode Instruction Banner */}
        {isEditMode && !editingTargetId && (
          <div className="mx-6 mt-4 mb-0">
            <div className="relative overflow-hidden rounded-lg border-2 border-primary/50 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 p-4">
              {/* Animated background pulse */}
              <div className="absolute inset-0 bg-primary/5 animate-pulse" />

              <div className="relative flex items-center gap-4">
                {/* Animated icon */}
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center animate-bounce">
                  <MousePointerClick className="h-6 w-6 text-primary" />
                </div>

                {/* Instructions */}
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <span>Edit Mode Active</span>
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-primary/20 text-primary animate-pulse">
                      Click to Edit
                    </span>
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Click on any <span className="text-primary font-medium">highlighted cell</span> in the table below to edit that filter.
                    Changes will be loaded into the filter panel on the left.
                  </p>
                </div>

                {/* Arrow pointing down */}
                <div className="flex-shrink-0 flex flex-col items-center animate-bounce">
                  <ChevronDown className="h-6 w-6 text-primary" />
                  <ChevronDown className="h-6 w-6 text-primary/60 -mt-3" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Duplicate Mode Floating Bar */}
        {isDuplicateMode && activeConfig && (
          <div className="mx-6 mt-2 mb-0 flex items-center justify-between px-4 py-2.5 rounded-lg border border-primary/40 bg-primary/20 backdrop-blur-md relative z-[101] shadow-lg animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2 text-sm">
              <Copy className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">Click targets to deselect them.</span>
              <span className="font-medium text-primary">{dupSelectedTargets.size}/{activeConfig.targets.length}</span>
              <span className="text-muted-foreground">selected</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setIsDuplicateMode(false);
                  setDupSelectedTargets(new Set());
                }}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={dupSelectedTargets.size === 0 || dupProcessingRef.current}
                onClick={async () => {
                  if (dupProcessingRef.current) return;
                  dupProcessingRef.current = true;

                  try {
                    const newNameBase = `${activeConfig.name} Copy`;
                    let newName = newNameBase;
                    let counter = 1;

                    // Find unique name
                    while (configs.some(c => c.name === newName)) {
                      newName = `${newNameBase} ${counter}`;
                      counter++;
                    }

                    // Limit the length as required by server/UI limits
                    newName = newName.slice(0, 20);

                    // 1. Create a new config
                    await createApiConfig(newName);

                    // 2. Fetch all configs to get the newly created one (empty for now)
                    const fetchedConfigs1 = await fetchAllConfigs();
                    setConfigs(fetchedConfigs1); // Intermediate save

                    // Find the target array that we need to copy
                    const targetsToCopy = activeConfig.targets.filter(t => dupSelectedTargets.has(t.id));

                    // 3. Create targets for the new config sequentially (or parallel)
                    const promises = targetsToCopy.map(t => createApiTarget(t, newName));
                    await Promise.allSettled(promises);

                    // 4. Finally fetch configs again
                    const finalConfigs = await fetchAllConfigs();
                    setConfigs(finalConfigs);

                    // Go to the new config
                    const newConfigData = finalConfigs.find(c => c.name === newName);
                    if (newConfigData) {
                      setActiveConfigId(newConfigData.id);
                    }

                    import('sonner').then(({ toast }) => {
                      toast.success('Duplication Successful', {
                        description: `Duplicated ${targetsToCopy.length} targets into ${newName}`,
                      });
                    });

                  } catch (e) {
                    console.error("Duplication failed", e);
                    import('sonner').then(({ toast }) => {
                      toast.error('Duplication Failed', {
                        description: 'Failed to complete duplicating targets.',
                      });
                    });
                  } finally {
                    setIsDuplicateMode(false);
                    setDupSelectedTargets(new Set());
                    setTimeout(() => { dupProcessingRef.current = false; }, 300);
                  }
                }}
              >
                <Copy className="h-3.5 w-3.5 mr-1" />
                Duplicate ({dupSelectedTargets.size})
              </Button>
            </div>
          </div>
        )}

        {/* Table Container */}
        <div className={`flex-1 min-w-0 min-h-0 overflow-auto p-6 ${isDuplicateMode ? 'relative z-[101]' : ''}`}>
          {(isGlobalStatsMode ? allTargetsWithConfig.length > 0 : (activeConfig && activeConfig.targets.length > 0)) ? (
            <div className={`relative rounded-lg border overflow-x-auto ${isDuplicateMode ? 'bg-card/95 border-primary/40 shadow-lg shadow-primary/5' : 'bg-card border-border'}`}>
              {/* Disabled overlay - covers all except action buttons (only in non-global mode, hidden during edit mode) */}
              {!isGlobalStatsMode && activeConfig && !activeConfig.enabled && !isEditMode && (
                <div
                  className="absolute inset-0 z-10 pointer-events-none"
                  style={{
                    background: 'rgba(0,0,0,0.55)'
                  }}
                />
              )}
              <table className="w-full">
                <thead className="bg-secondary/30">
                  <tr>
                    {/* Config column - only in global mode */}
                    {isGlobalStatsMode && (
                      <th className="px-1 py-3 text-left text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wider w-[80px]">Config</th>
                    )}
                    <th className="px-2 py-3 text-center text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wider min-w-[120px]">Item Name</th>
                    <th className="px-2 py-3 text-center text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wider w-[90px]">Price</th>
                    <th className="px-1 py-3 text-center text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wider w-[70px]">Disc/Over</th>
                    <th className="px-2 py-3 text-center text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wider w-[80px]">Rarity</th>
                    <th className="px-2 py-3 text-center text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wider w-[70px]">Paint Seed</th>
                    <th className="px-2 py-3 text-center text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wider w-[120px]">Patterns</th>
                    <th className="px-2 py-3 text-center text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wider w-[100px]">Float</th>
                    <th className="px-1 py-3 text-center text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wider w-[80px]">Charm</th>
                    <th className="px-2 py-3 text-center text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wider w-[160px]">Stickers</th>
                    <th className="px-1 py-3 text-center text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wider w-[50px]">SP %</th>
                    <th className="px-2 py-3 text-center text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wider w-[60px]">Custom</th>
                    <th className="px-2 py-3 text-center text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wider w-[130px]">
                      <div className="flex items-center justify-center gap-3">
                        <Bell className="h-6 w-4" />
                        <ShoppingCart className="h-4 w-4" />
                        <span className="ml-1">ACTIONS</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(() => {
                    const configIndexMap = new Map<string, number>();
                    if (isGlobalStatsMode) {
                      let configIdx = 0;
                      for (const c of configs) {
                        configIndexMap.set(c.id, configIdx++);
                      }
                    }
                    const configColors = [
                      { bg: 'rgba(99, 102, 241, 0.08)', border: 'rgba(99, 102, 241, 0.5)' },   // indigo
                      { bg: 'rgba(34, 197, 94, 0.08)', border: 'rgba(34, 197, 94, 0.5)' },      // green
                      { bg: 'rgba(234, 179, 8, 0.08)', border: 'rgba(234, 179, 8, 0.5)' },      // yellow
                      { bg: 'rgba(168, 85, 247, 0.08)', border: 'rgba(168, 85, 247, 0.5)' },    // purple
                      { bg: 'rgba(6, 182, 212, 0.08)', border: 'rgba(6, 182, 212, 0.5)' },      // cyan
                      { bg: 'rgba(244, 63, 94, 0.08)', border: 'rgba(244, 63, 94, 0.5)' },      // rose
                      { bg: 'rgba(251, 146, 60, 0.08)', border: 'rgba(251, 146, 60, 0.5)' },    // orange
                      { bg: 'rgba(45, 212, 191, 0.08)', border: 'rgba(45, 212, 191, 0.5)' },    // teal
                    ];

                    const raw = isGlobalStatsMode
                      ? allTargetsWithConfig
                      : (activeConfig?.targets || []).map(t => ({
                        ...t,
                        configId: activeConfigId,
                        configName: activeConfig?.name || '',
                        configEmoji: activeConfig?.emoji,
                        configEnabled: activeConfig?.enabled ?? true,
                      }));

                    const filtered = raw;

                    const sorted = sortField
                      ? [...filtered].sort((a, b) => {
                        let cmp = 0;
                        if (sortField === 'price') cmp = (a.minPrice ?? 0) - (b.minPrice ?? 0);
                        else if (sortField === 'float') cmp = (a.minFloat ?? 0) - (b.minFloat ?? 0);
                        else if (sortField === 'date') cmp = (a.id ?? 0) - (b.id ?? 0);
                        return sortAsc ? cmp : -cmp;
                      })
                      : filtered;

                    return <>{sorted.map((target) => {
                      const targetConfigId = 'configId' in target ? target.configId : activeConfigId;
                      const targetConfigName = 'configName' in target ? target.configName : activeConfig?.name || '';
                      const targetConfigEmoji = 'configEmoji' in target ? target.configEmoji : activeConfig?.emoji;
                      const targetConfigEnabled = 'configEnabled' in target ? target.configEnabled : activeConfig?.enabled ?? true;

                      const cfgColorIdx = (configIndexMap.get(targetConfigId) ?? 0) % configColors.length;
                      const cfgColor = isGlobalStatsMode ? configColors[cfgColorIdx] : null;

                      // Float color based on wear gradient
                      const getFloatColor = (value: number) => {
                        if (value <= 0.07) return "hsl(160, 84%, 39%)"; // FN - Green
                        if (value <= 0.15) return "hsl(80, 60%, 50%)"; // MW - Yellow-Green
                        if (value <= 0.37) return "hsl(45, 93%, 58%)"; // FT - Yellow
                        if (value <= 0.44) return "hsl(25, 95%, 53%)"; // WW - Orange
                        return "hsl(347, 77%, 50%)"; // BS - Red
                      };

                      // Rarity color mapping
                      const getRarityColor = (rarity: string) => {
                        const colorMap: Record<string, string> = {
                          contraband: "#e4ae33",
                          covert: "#eb4b4b",
                          classified: "#d32ce6",
                          restricted: "#8847ff",
                          milspec: "#4b69ff",
                          industrial: "#5e98d9",
                          consumer: "#b0c3d9",
                          extraordinary: "#e4ae33",
                          remarkable: "#8847ff",
                          exotic: "#d32ce6",
                          highgrade: "#4b69ff",
                          basegrade: "#b0c3d9",
                        };
                        return colorMap[rarity] || "#888";
                      };

                      const getRarityLabel = (rarity: string) => {
                        const labelMap: Record<string, string> = {
                          contraband: "Contraband",
                          covert: "Covert",
                          classified: "Classified",
                          restricted: "Restricted",
                          milspec: "Mil-Spec",
                          industrial: "Industrial",
                          consumer: "Consumer",
                          extraordinary: "Extraordinary",
                          remarkable: "Remarkable",
                          exotic: "Exotic",
                          highgrade: "High Grade",
                          basegrade: "Base Grade",
                        };
                        return labelMap[rarity] || "Any";
                      };

                      const isDupSelected = isDuplicateMode && dupSelectedTargets.has(target.id);
                      const isDupDeselected = isDuplicateMode && !dupSelectedTargets.has(target.id);

                      return (
                        <tr
                          id={`target-row-${targetConfigId}-${target.id}`}
                          key={`${targetConfigId}-${target.id}`}
                          ref={(el) => { targetRowRefs.current[`${targetConfigId}-${target.id}`] = el; }}
                          className={`table-row-hover ${isEditMode ? 'cursor-pointer' : ''} ${isGlobalStatsMode && !targetConfigEnabled ? '[&>td:not(:last-child)]:opacity-50' : ''} ${highlightedTargetId === target.id ? 'search-highlight-row' : ''} ${isDuplicateMode ? 'cursor-pointer select-none' : ''} ${isDupSelected ? 'bg-primary/15' : ''} ${isDupDeselected ? 'opacity-30' : ''}`}
                          onClick={isDuplicateMode ? (e) => {
                            e.stopPropagation();
                            setDupSelectedTargets(prev => {
                              const next = new Set(prev);
                              if (next.has(target.id)) next.delete(target.id);
                              else next.add(target.id);
                              return next;
                            });
                          } : undefined}
                          style={{
                            ...(isDuplicateMode ? { transition: 'all 0.15s ease', boxShadow: isDupSelected ? 'inset 3px 0 0 0 hsl(var(--primary))' : 'none' } : {}),
                            ...(cfgColor && !isDuplicateMode ? { backgroundColor: cfgColor.bg, borderLeft: `3px solid ${cfgColor.border}` } : {}),
                          }}
                        >
                          {/* Config column - only in global mode */}
                          {isGlobalStatsMode && (
                            <td className="px-2 py-3">
                              <div className="flex items-center gap-1.5">
                                {targetConfigEmoji && <span className="text-sm">{targetConfigEmoji}</span>}
                                <span className={`text-xs font-medium truncate max-w-[70px] ${targetConfigEnabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                                  {targetConfigName}
                                </span>
                                {!targetConfigEnabled && (
                                  <PowerOff className="h-3 w-3 text-muted-foreground/50" />
                                )}
                              </div>
                            </td>
                          )}
                          {/* Item Name: 1.Time 2.Name 3.Note */}
                          <td className="px-3 py-2 text-sm text-foreground font-medium text-left">
                            {/* 1. Creation timestamp - TOP */}
                            {target.createdAt && (
                              <div className="flex items-center justify-start gap-1 mb-0.5" title={new Date(target.createdAt).toLocaleString()}>
                                <Clock className="h-2.5 w-2.5 text-muted-foreground/40" />
                                <span className="text-[9px] text-muted-foreground/50 font-mono">
                                  {new Date(target.createdAt).toLocaleString(undefined, {
                                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                                  })}
                                </span>
                              </div>
                            )}
                            {/* 2. Item Name - MIDDLE */}
                            <div
                              onClick={() => isEditMode && !isGlobalStatsMode && handleEditCellClick(target, 'item')}
                              className={isEditMode && !isGlobalStatsMode ? 'edit-mode-cell text-left' : 'text-left'}
                            >
                              <span className={target.itemName === '*' ? 'text-accent' : ''}>
                                {target.itemName}
                                {target.phase && target.phase !== "0" && (
                                  <span className="ml-1 font-normal font-mono text-xs" style={{ color: getPhaseColor(target.itemName, target.phase) }}>
                                    ({target.phase.replace("Phase ", "P")})
                                  </span>
                                )}
                              </span>
                            </div>
                            {/* 3. Description/Note - BOTTOM */}
                            {(() => {
                              const descKey = `${targetConfigId}-${target.id}`;
                              const isEditing = editingDescriptionId === descKey;
                              const maxLen = 30;
                              return isEditing ? (
                                <div className="flex items-center justify-start gap-1 mt-0.5 h-[16px]">
                                  <Input
                                    autoFocus
                                    value={editingDescriptionValue}
                                    onChange={(e) => setEditingDescriptionValue(e.target.value.slice(0, maxLen))}
                                    maxLength={maxLen}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        updateTargetDescription(targetConfigId, target.id, editingDescriptionValue.trim());
                                        setEditingDescriptionId(null);
                                      }
                                      if (e.key === 'Escape') setEditingDescriptionId(null);
                                    }}
                                    onBlur={() => {
                                      updateTargetDescription(targetConfigId, target.id, editingDescriptionValue.trim());
                                      setEditingDescriptionId(null);
                                    }}
                                    className="h-4 text-[9px] px-1 py-0 bg-secondary/50 border-border/50 w-[120px] focus-visible:ring-1 focus-visible:ring-offset-0"
                                    placeholder="Add note..."
                                  />
                                  <span className="text-[8px] text-muted-foreground/40 tabular-nums whitespace-nowrap">{editingDescriptionValue.length}/{maxLen}</span>
                                </div>
                              ) : (
                                <div
                                  className={`flex items-center justify-start gap-1 mt-0.5 group/desc h-[16px] cursor-pointer`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingDescriptionId(descKey);
                                    setEditingDescriptionValue(target.description || '');
                                  }}
                                  title={target.description || 'Click to add note'}
                                >
                                  <MessageSquare className="h-2.5 w-2.5 shrink-0 text-muted-foreground/40 group-hover/desc:text-muted-foreground transition-colors" />
                                  {target.description ? (
                                    <span className="text-[9px] text-muted-foreground/70 truncate max-w-[110px] group-hover/desc:text-foreground transition-colors">
                                      {target.description}
                                    </span>
                                  ) : (
                                    <span className="text-[9px] text-muted-foreground/30 group-hover/desc:text-muted-foreground/60 transition-colors italic">
                                      note
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </td>

                          {/* Price - Fixed or Range - 15% larger, red on top green on bottom */}
                          <td className="px-3 py-3 text-center">
                            <div
                              onClick={() => isEditMode && handleEditCellClick(target, 'price')}
                              className={isEditMode ? 'edit-mode-cell' : ''}
                            >
                              {/* Show — if no price is set (both 0 and not fixed price) */}
                              {!target.isFixedPrice && target.minPrice === 0 && target.maxPrice === 0 ? (
                                <span className="text-muted-foreground/50">—</span>
                              ) : target.isFixedPrice ? (
                                <span className="text-[16px] font-mono font-semibold text-accent">${target.minPrice}</span>
                              ) : (
                                <div className="flex flex-col items-center font-mono">
                                  <span className="text-[14px] font-semibold text-destructive">
                                    {target.maxPrice === -1 ? 'Any' : `$${target.maxPrice}`}
                                  </span>
                                  <span className="text-[14px] font-semibold text-accent">${target.minPrice}</span>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Discount / Overpay - compact vertical: red (overpay) on top, green (discount) on bottom */}
                          <td className="px-1 py-1 text-center">
                            <div
                              onClick={() => isEditMode && handleEditCellClick(target, 'discountOverpay')}
                              className={isEditMode ? 'edit-mode-cell' : ''}
                            >
                              {(() => {
                                const hasFilter = target.discountOverpayMin !== undefined && target.discountOverpayMax !== undefined &&
                                  (target.discountOverpayMin !== 0 || target.discountOverpayMax !== 0);
                                const overpayVal = target.discountOverpayMax ?? 0;
                                const discountVal = target.discountOverpayMin ?? 0;

                                return (
                                  <div
                                    className={`inline-flex flex-col items-center rounded pl-1 pr-1.5 py-1 ${!hasFilter ? 'opacity-30' : ''}`}
                                    style={{
                                      background: 'linear-gradient(180deg, rgba(239, 68, 68, 0.2) 0%, rgba(34, 197, 94, 0.2) 100%)',
                                      border: '1px solid rgba(100, 100, 100, 0.3)'
                                    }}
                                  >
                                    {/* Overpay (top) - sign and color based on actual value */}
                                    <span
                                      className="text-[12px] font-mono font-semibold leading-tight"
                                      style={{ color: overpayVal >= 0 ? 'hsl(0 75% 55%)' : 'hsl(142 70% 50%)' }}
                                    >
                                      {overpayVal >= 0 ? '+' : '−'}{Math.abs(overpayVal)}%
                                    </span>
                                    {/* Discount (bottom) - sign and color based on actual value */}
                                    <span
                                      className="text-[12px] font-mono font-semibold leading-tight"
                                      style={{ color: discountVal >= 0 ? 'hsl(0 75% 55%)' : 'hsl(142 70% 50%)' }}
                                    >
                                      {discountVal >= 0 ? '+' : '−'}{Math.abs(discountVal)}%
                                    </span>
                                  </div>
                                );
                              })()}
                            </div>
                          </td>

                          {/* Rarity with CS2 colors */}
                          <td className="px-3 py-3 text-center">
                            <div
                              onClick={() => isEditMode && handleEditCellClick(target, 'rarity')}
                              className={isEditMode ? 'edit-mode-cell' : ''}
                            >
                              {target.rarity ? (
                                <span
                                  className="text-xs font-medium"
                                  style={{ color: getRarityColor(target.rarity) }}
                                >
                                  {getRarityLabel(target.rarity)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/50">—</span>
                              )}
                            </div>
                          </td>

                          {/* Paint Seed - supports single pattern or array of patterns */}
                          <td className="px-3 py-3 text-center">
                            <div
                              onClick={() => isEditMode && handleEditCellClick(target, 'paintSeed')}
                              className={isEditMode ? 'edit-mode-cell' : ''}
                            >
                              {target.paintSeeds && target.paintSeeds.length > 0 ? (
                                target.paintSeeds.length === 1 ? (
                                  <span
                                    className="text-xs font-mono font-semibold"
                                    style={{ color: '#4b69ff' }}
                                  >
                                    #{target.paintSeeds[0]}
                                  </span>
                                ) : (
                                  <PaintSeedsPopover seeds={target.paintSeeds} />
                                )
                              ) : target.pattern ? (
                                <span
                                  className="text-xs font-mono font-semibold"
                                  style={{ color: '#4b69ff' }}
                                >
                                  {target.pattern.startsWith('#') ? target.pattern : `#${target.pattern}`}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/50">—</span>
                              )}
                            </div>
                          </td>

                          {/* Patterns - Mini sliders for Fade % and Blue Gem % */}
                          {/* Patterns - Mini sliders for Fade % and Blue Gem % */}
                          <td className="px-3 py-2 text-center">
                            <div
                              onClick={() => isEditMode && handleEditCellClick(target, 'patterns')}
                              className={isEditMode ? 'edit-mode-cell' : ''}
                            >
                              {(() => {
                                // Default to 0-100 range logic
                                // Check if Fade is configured (default min 0 / max 100)
                                const hasFade = (target.fadeMin !== undefined || target.fadeMax !== undefined) &&
                                  (target.fadeMin !== 0 || target.fadeMax !== 100);

                                // Check if Blue Gem is configured
                                const hasBlueGem = (target.blueGemMin !== undefined || target.blueGemMax !== undefined) &&
                                  (target.blueGemMin !== 0 || target.blueGemMax !== 100);

                                if (hasFade) {
                                  return (
                                    <div className="space-y-1.5 py-1">
                                      <div className="space-y-0.5">
                                        <div className="flex items-center gap-1.5">
                                          <div className="w-2.5 h-2.5 rounded-sm fade-gradient shrink-0" />
                                          <span className="text-[9px] text-muted-foreground">Fade %</span>
                                        </div>
                                        <div className="relative h-1 w-full rounded-full fade-gradient opacity-80">
                                          {/* Range indicator 0-100 */}
                                          <div
                                            className="absolute top-0 h-full bg-white/40 rounded-full"
                                            style={{
                                              left: `${(target.fadeMin ?? 0)}%`,
                                              width: `${(target.fadeMax ?? 100) - (target.fadeMin ?? 0)}%`
                                            }}
                                          />
                                        </div>
                                        <div className="flex justify-between text-[8px] text-muted-foreground/70">
                                          <span>{target.fadeMin ?? 0}%</span>
                                          <span>{target.fadeMax ?? 100}%</span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }

                                if (hasBlueGem) {
                                  return (
                                    <div className="space-y-1.5 py-1">
                                      <div className="space-y-0.5">
                                        <div className="flex items-center gap-1.5">
                                          <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: 'linear-gradient(135deg, hsl(200 60% 35%) 0%, hsl(210 80% 55%) 100%)' }} />
                                          <span className="text-[9px] text-muted-foreground">Blue Gem %</span>
                                        </div>
                                        <div className="relative h-1 w-full rounded-full" style={{ background: 'linear-gradient(90deg, hsl(200 60% 35%) 0%, hsl(210 80% 55%) 100%)' }}>
                                          <div
                                            className="absolute top-0 h-full bg-white/40 rounded-full"
                                            style={{
                                              left: `${target.blueGemMin ?? 0}%`,
                                              width: `${(target.blueGemMax ?? 100) - (target.blueGemMin ?? 0)}%`
                                            }}
                                          />
                                        </div>
                                        <div className="flex justify-between text-[8px] text-muted-foreground/70">
                                          <span>{target.blueGemMin ?? 0}%</span>
                                          <span>{target.blueGemMax ?? 100}%</span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }

                                return <span className="text-muted-foreground/50">—</span>;
                              })()}
                            </div>
                          </td>

                          {/* Float Range - Colors based on wear gradient */}
                          <td className="px-3 py-3 text-center">
                            <div
                              onClick={() => isEditMode && handleEditCellClick(target, 'wear')}
                              className={isEditMode ? 'edit-mode-cell' : ''}
                            >
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-xs font-mono font-semibold cursor-help">
                                    <span style={{ color: getFloatColor(target.minFloat) }}>{target.minFloat.toFixed(3)}</span>
                                    <span className="text-muted-foreground mx-1">-</span>
                                    <span style={{ color: getFloatColor(target.maxFloat) }}>{target.maxFloat.toFixed(3)}</span>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="font-mono text-xs">
                                  <div className="flex items-center gap-1">
                                    <span style={{ color: getFloatColor(target.minFloat) }}>{target.minFloat.toFixed(10)}</span>
                                    <span className="text-muted-foreground">—</span>
                                    <span style={{ color: getFloatColor(target.maxFloat) }}>{target.maxFloat.toFixed(10)}</span>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </td>

                          {/* Charms - Compact display with short name + pattern range */}
                          <td className="px-2 py-2 text-center">
                            <div
                              onClick={() => isEditMode && handleEditCellClick(target, 'charm')}
                              className={isEditMode ? 'edit-mode-cell' : ''}
                            >
                              {/* Unified Charm Block for Name, Pattern, and Profit */}
                              {(target.charmInfo?.name || target.charmProfitEnabled) ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div
                                      className="inline-flex flex-col gap-0.5 px-1.5 py-1 rounded cursor-default items-center justify-center max-w-[80px]"
                                      style={{
                                        background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(236, 72, 153, 0.15) 100%)',
                                        border: '1px solid rgba(168, 85, 247, 0.3)'
                                      }}
                                    >
                                      {/* Short charm name - truncated */}
                                      {target.charmInfo?.name && (
                                        <span className="text-[10px] font-medium truncate w-full text-center" style={{ color: 'hsl(280 80% 70%)' }}>
                                          {target.charmInfo.name.replace('Charm | ', '')}
                                        </span>
                                      )}
                                      {/* Pattern range if exists */}
                                      {(target.charmInfo?.patternMin !== undefined || target.charmInfo?.patternMax !== undefined) && (
                                        <span className="text-[9px] font-mono text-muted-foreground mt-0.5">
                                          #{target.charmInfo.patternMin ?? 1}–{target.charmInfo.patternMax ?? '100K'}
                                        </span>
                                      )}
                                      {/* Charm Profit inline */}
                                      {target.charmProfitEnabled && target.charmProfitMin !== undefined && target.charmProfitMax !== undefined && (
                                        <span className="text-[9px] font-medium mt-0.5" style={{ color: 'hsl(280 80% 70%)' }}>
                                          CP:{target.charmProfitMin}%-{target.charmProfitMax === "10000" ? "∞" : `${target.charmProfitMax}%`}
                                        </span>
                                      )}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-[200px]">
                                    <div className="text-xs">
                                      {target.charmInfo?.name && (
                                        <>
                                          <p className="font-medium" style={{ color: 'hsl(280 80% 70%)' }}>{target.charmInfo.name}</p>
                                          {(target.charmInfo.patternMin !== undefined || target.charmInfo.patternMax !== undefined) && (
                                            <p className="text-muted-foreground mt-1">
                                              Pattern: {target.charmInfo.patternMin ?? 1} — {target.charmInfo.patternMax ?? 100000}
                                            </p>
                                          )}
                                        </>
                                      )}
                                      {target.charmProfitEnabled && target.charmProfitMin !== undefined && target.charmProfitMax !== undefined && (
                                        <p className="text-muted-foreground mt-1">
                                          Profit: {target.charmProfitMin}% to {target.charmProfitMax === "10000" ? "Infinity" : `${target.charmProfitMax}%`}
                                        </p>
                                      )}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className="text-muted-foreground/50">—</span>
                              )}
                            </div>
                          </td>

                          {/* Stickers - Mini table with wear, name, slot */}
                          <td className="px-3 py-2 text-left">
                            <div
                              onClick={() => isEditMode && handleEditCellClick(target, 'stickers')}
                              className={isEditMode ? 'edit-mode-cell' : ''}
                            >
                              {target.stickers.length > 0 ? (
                                <div className="flex flex-col gap-0.5 items-start">
                                  {target.stickers.map((sticker, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-center gap-1 text-[10px]"
                                    >
                                      {/* Wear checkbox - 100% indicator */}
                                      <Checkbox
                                        checked={sticker.isWhole}
                                        disabled
                                        className="h-3 w-3 shrink-0 border-cyan-400/50 data-[state=checked]:bg-cyan-400 data-[state=checked]:border-cyan-400"
                                      />
                                      {/* Sticker name - directly next to checkbox */}
                                      <span className="text-primary flex-1 truncate max-w-[120px]">
                                        {sticker.name}
                                      </span>
                                      {/* Slot number */}
                                      <span className="text-muted-foreground font-mono w-10 text-right">
                                        {sticker.slot !== "any" ? `Slot ${sticker.slot}` : ""}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="flex justify-center w-full">
                                  <span className="text-muted-foreground/50">—</span>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Sticker Price Percent - Always show vertical gradient slider, dimmed if default */}
                          <td className="px-2 py-2 text-center">
                            <div
                              onClick={() => isEditMode && handleEditCellClick(target, 'stickersPricePercent')}
                              className={isEditMode ? 'edit-mode-cell' : ''}
                            >
                              {(() => {
                                const minVal = Number(target.stickersPricePercentMin) || 0;
                                const maxVal = Number(target.stickersPricePercentMax) || 100;
                                const isDefault = minVal === 0 && maxVal === 100;

                                return (
                                  <div className={`flex items-center justify-center gap-1 h-[50px] ml-1 transition-opacity ${isDefault ? 'opacity-30' : 'opacity-100'}`}>
                                    {/* Vertical gradient track */}
                                    <div
                                      className="relative w-1.5 h-full rounded-full opacity-90"
                                      style={{
                                        background: 'linear-gradient(to top, hsl(142 70% 48%) 0%, hsl(97 75% 50%) 25%, hsl(50 90% 55%) 50%, hsl(25 85% 53%) 75%, hsl(0 85% 58%) 100%)' // 0% Green to 100% Red gradient
                                      }}
                                    >
                                      {/* Range indicator overlay */}
                                      <div
                                        className="absolute left-0 w-full bg-white/25 rounded-full border border-white/40"
                                        style={{
                                          bottom: `${minVal}%`,
                                          height: `${maxVal - minVal}%`
                                        }}
                                      />
                                      {/* Min thumb marker (bottom) */}
                                      <div
                                        className="absolute left-1/2 -translate-x-1/2 w-2.5 h-1.5 rounded-sm border border-black/30"
                                        style={{
                                          bottom: `${minVal}%`,
                                          transform: 'translateX(-50%) translateY(50%)',
                                          backgroundColor: getOverpayColor(minVal)
                                        }}
                                      />
                                      {/* Max thumb marker (top) */}
                                      <div
                                        className="absolute left-1/2 -translate-x-1/2 w-2.5 h-1.5 rounded-sm border border-black/30"
                                        style={{
                                          bottom: `${maxVal}%`,
                                          transform: 'translateX(-50%) translateY(50%)',
                                          backgroundColor: getOverpayColor(maxVal)
                                        }}
                                      />
                                    </div>
                                    {/* Labels positioned at thumb positions */}
                                    <div className="relative h-full w-8 text-[8px] font-mono font-medium">
                                      {/* Max label - positioned at maxVal% from bottom */}
                                      <span
                                        className="absolute left-0 whitespace-nowrap"
                                        style={{
                                          bottom: `${maxVal}%`,
                                          transform: 'translateY(50%)',
                                          color: getOverpayColor(maxVal)
                                        }}
                                      >
                                        {maxVal}%
                                      </span>
                                      {/* Min label - positioned at minVal% from bottom */}
                                      <span
                                        className="absolute left-0 whitespace-nowrap"
                                        style={{
                                          bottom: `${minVal}%`,
                                          transform: 'translateY(50%)',
                                          color: getOverpayColor(minVal)
                                        }}
                                      >
                                        {minVal}%
                                      </span>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </td>

                          {/* Custom Filters (now includes Special) */}
                          <td className="px-3 py-3 text-left">
                            <div
                              onClick={() => isEditMode && handleEditCellClick(target, 'custom')}
                              className={isEditMode ? 'edit-mode-cell' : ''}
                            >
                              <div className="flex flex-col gap-0.5">
                                {/* 1. Special type badges (top) */}
                                {target.statTrak && (
                                  <div className="flex items-center gap-1">
                                    <Checkbox
                                      checked={true}
                                      disabled
                                      className="h-3 w-3 border-orange-400 data-[state=checked]:bg-orange-400 data-[state=checked]:border-orange-400"
                                    />
                                    <span className="text-[9px] text-orange-400 font-medium">ST™</span>
                                  </div>
                                )}
                                {target.souvenir && (
                                  <div className="flex items-center gap-1">
                                    <Checkbox
                                      checked={true}
                                      disabled
                                      className="h-3 w-3 border-yellow-400 data-[state=checked]:bg-yellow-400 data-[state=checked]:border-yellow-400"
                                    />
                                    <span className="text-[9px] text-yellow-400 font-medium">SV</span>
                                  </div>
                                )}
                                {(target.normal || (!target.statTrak && !target.souvenir)) && (
                                  <div className="flex items-center gap-1">
                                    <Checkbox
                                      checked={true}
                                      disabled
                                      className="h-3 w-3 border-muted-foreground data-[state=checked]:bg-muted-foreground data-[state=checked]:border-muted-foreground pointer-events-none"
                                    />
                                    <span className="text-[9px] text-muted-foreground font-medium">NRM</span>
                                  </div>
                                )}
                                {/* 2. Blue Gem */}
                                {hasBlueGemFilter(target) ? (
                                  <BlueGemTargetMark tier={target.blueGemTier} />
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <Checkbox
                                      checked={false}
                                      disabled
                                      className="h-3 w-3 border-sky-400/50 pointer-events-none"
                                    />
                                    <span
                                      className="text-[9px] font-bold"
                                      style={{
                                        background: 'linear-gradient(90deg, #bae6fd, #38bdf8, #0ea5e9, #0284c7)',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                        backgroundClip: 'text',
                                        textShadow: '0 0 4px rgba(56,189,248,0.65)',
                                      }}
                                    >
                                      BG
                                    </span>
                                  </div>
                                )}
                                {/* 3. Fire & Ice */}
                                {hasFireIceFilter(target) && (
                                  <FireIceTargetMark tier={target.fireAndIceTier} />
                                )}
                                {/* 4. Float Rank (if present) */}
                                {(target.floatRankGold || target.floatRankSilver || target.floatRankBronze) && (
                                  <div className="flex items-center gap-1">
                                    <div
                                      className="h-3 w-3 rounded-sm border flex items-center justify-center shrink-0"
                                      style={{
                                        borderColor: target.floatRankGold ? 'rgba(234,179,8,0.5)' : target.floatRankSilver ? 'rgba(161,161,170,0.5)' : 'rgba(180,83,9,0.5)',
                                        backgroundColor: target.floatRankGold ? '#eab308' : target.floatRankSilver ? '#a1a1aa' : '#b45309',
                                      }}
                                    >
                                      <span className="text-[9px] font-black leading-none text-background flex items-center justify-center mt-px">ƒ</span>
                                    </div>
                                    <span
                                      className="text-[9px]"
                                      style={{
                                        color: target.floatRankGold ? '#eab308' : target.floatRankSilver ? '#a1a1aa' : '#b45309'
                                      }}
                                    >
                                      {target.floatRankGold ? '#1' : target.floatRankSilver ? '#2-3' : '#4-5'}
                                    </span>
                                  </div>
                                )}
                                {/* 5. 0.0% Filter (bottom) */}
                                <div className="flex items-center gap-1">
                                  <Checkbox
                                    checked={target.customFilterEnabled}
                                    disabled
                                    className="h-3 w-3 border-muted-foreground/50 data-[state=checked]:bg-muted-foreground data-[state=checked]:border-muted-foreground pointer-events-none"
                                  />
                                  <span className="text-[9px] text-muted-foreground">0.0%</span>
                                </div>
                              </div>

                            </div>
                          </td>
                          {/* Actions - 4 buttons as on screenshot - always interactive (except in duplicate mode) */}
                          <td className={`px-3 py-3 relative z-20 ${isDuplicateMode ? 'opacity-30 pointer-events-none' : ''}`}>
                            <div className="flex items-center justify-center gap-2">
                              {/* Notify Toggle - Purple/Blue with label below */}
                              <div className="flex flex-col items-center">
                                <Checkbox
                                  checked={target.activeNotifications}
                                  onCheckedChange={() => toggleTargetNotifications(targetConfigId, target.id)}
                                  disabled={false}
                                  className={cn(
                                    "h-5 w-5 border-2 border-primary/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                  )}
                                />
                                <span className="text-[8px] text-muted-foreground mt-0.5">Notify</span>
                              </div>

                              {/* Auto Buy Toggle - Green with label below */}
                              <div className="flex flex-col items-center">
                                <Checkbox
                                  checked={target.activeAutopurchase}
                                  onCheckedChange={() => toggleTargetAutopurchase(targetConfigId, target.id)}
                                  disabled={false}
                                  className={cn(
                                    "h-5 w-5 border-2 border-accent/50 data-[state=checked]:bg-accent data-[state=checked]:border-accent"
                                  )}
                                />
                                <span className="text-[8px] text-muted-foreground mt-0.5">Buy</span>
                              </div>

                              {/* Move (top) + Copy (bottom) vertical stack */}
                              <div className="flex flex-col items-center gap-1">
                                {/* Move to Config */}
                                <Select
                                  value=""
                                  onValueChange={(value) => moveTargetToConfig(targetConfigId, target.id, value)}
                                >
                                  <SelectTrigger className="w-7 h-6 p-0 border-0 bg-transparent hover:bg-primary/20 [&>span>svg]:hidden">
                                    <div className="flex items-center justify-center w-full">
                                      <FolderInput className="h-4 w-4 text-primary/70 hover:text-primary transition-colors" />
                                      <ChevronDown className="h-2.5 w-2.5 text-primary/70 ml-0.5" />
                                    </div>
                                  </SelectTrigger>
                                  <SelectContent className="bg-popover border-border z-50 min-w-[220px]">
                                    <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium border-b border-border mb-1">
                                      Move to config
                                    </div>
                                    {configs.filter(c => c.id !== targetConfigId).map(c => {
                                      const notifyCount = c.enabled ? c.targets.filter(t => t.activeNotifications).length : 0;
                                      const buyCount = c.enabled ? c.targets.filter(t => t.activeAutopurchase).length : 0;
                                      const targetCount = c.targets.length;

                                      return (
                                        <SelectItem
                                          key={c.id}
                                          value={c.id}
                                          className="text-xs py-2 cursor-pointer"
                                        >
                                          <div className="flex items-center justify-between w-full gap-3">
                                            <div className="flex items-center gap-2 min-w-0">
                                              {c.emoji ? (
                                                <span className="text-base shrink-0">{c.emoji}</span>
                                              ) : (
                                                <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${c.enabled ? 'bg-accent/20' : 'bg-muted'}`}>
                                                  <GripVertical className="h-3 w-3 text-muted-foreground" />
                                                </div>
                                              )}
                                              <span className={`font-medium truncate max-w-[100px] ${!c.enabled ? 'text-muted-foreground' : ''}`}>
                                                {c.name}
                                              </span>
                                              {!c.enabled && (
                                                <PowerOff className="h-3 w-3 text-muted-foreground shrink-0" />
                                              )}
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0 text-[10px]">
                                              <span className="text-amber-400 tabular-nums">{notifyCount}</span>
                                              <span className="text-muted-foreground">/</span>
                                              <span className="text-foreground tabular-nums">{targetCount}</span>
                                              <span className="text-muted-foreground">/</span>
                                              <span className="text-accent tabular-nums">{buyCount}</span>
                                            </div>
                                          </div>
                                        </SelectItem>
                                      );
                                    })}
                                  </SelectContent>
                                </Select>

                                {/* Copy to Config - Popover with pin + search */}
                                <Popover
                                  open={copyPopoverOpenId === `${targetConfigId}-${target.id}`}
                                  onOpenChange={(open) => {
                                    setCopyPopoverOpenId(open ? `${targetConfigId}-${target.id}` : null);
                                    if (!open) setCopySearchQuery("");
                                  }}
                                >
                                  <PopoverTrigger asChild>
                                    <button className="w-7 h-6 flex items-center justify-center rounded bg-transparent hover:bg-accent/20 transition-colors">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className="flex items-center justify-center w-full">
                                            <ClipboardCopy className="h-4 w-4 text-accent/70 hover:text-accent transition-colors" />
                                            <div className="w-2.5 ml-0.5" />
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="left" className="text-xs">Copy to config</TooltipContent>
                                      </Tooltip>
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent side="left" align="start" className="w-[260px] p-0 bg-popover border-border z-50">
                                    {/* Search input */}
                                    <div className="px-2 py-1.5 border-b border-border">
                                      <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-secondary/50 border border-border/50">
                                        <Search className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                                        <input
                                          autoFocus
                                          value={copySearchQuery}
                                          onChange={(e) => setCopySearchQuery(e.target.value)}
                                          placeholder="Search configs..."
                                          className="bg-transparent text-xs outline-none w-full text-foreground placeholder:text-muted-foreground/40"
                                        />
                                        {copySearchQuery && (
                                          <button onClick={() => setCopySearchQuery("")} className="text-muted-foreground/40 hover:text-muted-foreground">
                                            <X className="h-3 w-3" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    <div className="max-h-[240px] overflow-y-auto py-1">
                                      {(() => {
                                        const sorted = sortedConfigsForCopy(targetConfigId);
                                        const filtered = copySearchQuery
                                          ? sorted.filter(c => c.name.toLowerCase().includes(copySearchQuery.toLowerCase()))
                                          : sorted;

                                        if (filtered.length === 0) {
                                          return (
                                            <div className="px-3 py-4 text-xs text-muted-foreground/50 text-center">No configs found</div>
                                          );
                                        }

                                        return filtered.map(c => {
                                          const isPinned = pinnedCopyConfigIds.has(c.id);
                                          const notifyCount = c.enabled ? c.targets.filter(t => t.activeNotifications).length : 0;
                                          const buyCount = c.enabled ? c.targets.filter(t => t.activeAutopurchase).length : 0;
                                          const targetCount = c.targets.length;

                                          return (
                                            <div
                                              key={c.id}
                                              className={`flex items-center gap-1 px-1.5 py-1.5 text-xs cursor-pointer hover:bg-accent/20 transition-colors ${isPinned ? 'bg-destructive/10 border-l-2 border-destructive' : 'border-l-2 border-transparent'}`}
                                            >
                                              {/* Pin button - more visible */}
                                              <button
                                                className={`shrink-0 w-6 h-6 flex items-center justify-center rounded transition-all ${isPinned
                                                    ? 'text-destructive bg-destructive/15 hover:bg-destructive/25'
                                                    : 'text-muted-foreground/20 hover:text-destructive hover:bg-destructive/10'
                                                  }`}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  togglePinnedCopyConfig(c.id);
                                                }}
                                                title={isPinned ? 'Unpin' : 'Pin to top'}
                                              >
                                                <Pin className={`h-3.5 w-3.5 ${isPinned ? 'fill-destructive/30' : ''}`} />
                                              </button>
                                              {/* Config row - clickable to copy */}
                                              <div
                                                className="flex items-center justify-between flex-1 min-w-0 gap-2 rounded px-1 py-0.5 hover:bg-accent/10"
                                                onClick={() => {
                                                  copyTargetToConfig(targetConfigId, target.id, c.id);
                                                  // Flash the source row
                                                  const flashKey = `${targetConfigId}-${target.id}`;
                                                  setCopyFlashTargetKey(flashKey);
                                                  setTimeout(() => setCopyFlashTargetKey(null), 800);
                                                  setCopyPopoverOpenId(null);
                                                  setCopySearchQuery("");
                                                }}
                                              >
                                                <div className="flex items-center gap-2 min-w-0">
                                                  {c.emoji ? (
                                                    <span className="text-base shrink-0">{c.emoji}</span>
                                                  ) : (
                                                    <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${c.enabled ? 'bg-accent/20' : 'bg-muted'}`}>
                                                      <GripVertical className="h-3 w-3 text-muted-foreground" />
                                                    </div>
                                                  )}
                                                  <span className={`font-medium truncate max-w-[100px] ${!c.enabled ? 'text-muted-foreground' : ''}`}>
                                                    {c.name}
                                                  </span>
                                                  {!c.enabled && (
                                                    <PowerOff className="h-3 w-3 text-muted-foreground shrink-0" />
                                                  )}
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0 text-[10px]">
                                                  <span className="text-amber-400 tabular-nums">{notifyCount}</span>
                                                  <span className="text-muted-foreground">/</span>
                                                  <span className="text-foreground tabular-nums">{targetCount}</span>
                                                  <span className="text-muted-foreground">/</span>
                                                  <span className="text-accent tabular-nums">{buyCount}</span>
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        });
                                      })()}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              </div>

                              {/* Delete Target - Red trash */}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-all"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-card border-border">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Target?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will remove "{target.itemName}" from {isGlobalStatsMode ? `"${targetConfigName}"` : 'the config'}. This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="border-border bg-secondary hover:bg-secondary/80">Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-lg shadow-destructive/25"
                                      onClick={() => deleteTarget(targetConfigId, target.id)}
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    </>
                  })()}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <FolderOpen className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No Targets</p>
              <p className="text-sm mb-4">Use the filter panel on the left to add targets.</p>
            </div>
          )}
        </div>
      </div>

      {/* Rename Config Dialog */}
      <AlertDialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Rename Configuration</AlertDialogTitle>
            <AlertDialogDescription>
              Change the name and icon of your configuration.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center justify-center py-3 px-4 bg-secondary/50 rounded-lg border border-border">
            <div className="flex items-center gap-2 text-base font-medium">
              {renameEmoji ? (
                <span className="text-lg">{renameEmoji}</span>
              ) : (
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-foreground">{renameName || "Config"}</span>
            </div>
          </div>
          <div className="py-4 space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Name</label>
              <Input
                value={renameName}
                onChange={(e) => setRenameName(e.target.value.slice(0, 20))}
                maxLength={20}
                placeholder="Config name..."
                className="bg-input border-border"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') saveRename(); }}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">
                Icon <span className="text-muted-foreground/50">(optional)</span>
              </label>
              <div className="grid grid-cols-10 gap-1 p-2 bg-secondary/30 rounded-lg border border-border max-h-[160px] overflow-y-auto">
                <button
                  type="button"
                  onClick={() => setRenameEmoji("")}
                  className={`w-7 h-7 flex items-center justify-center rounded hover:bg-primary/20 transition-colors text-xs ${renameEmoji === "" ? 'bg-primary/30 ring-2 ring-primary' : ''
                    }`}
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
                {CONFIG_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setRenameEmoji(emoji)}
                    className={`w-7 h-7 flex items-center justify-center rounded hover:bg-primary/20 transition-colors text-base ${renameEmoji === emoji ? 'bg-primary/30 ring-2 ring-primary' : ''
                      }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border" onClick={cancelRename}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-primary hover:bg-primary/90"
              onClick={saveRename}
              disabled={!renameName.trim()}
            >
              Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// Edit Mode Toggle Button Component
const EditModeButton = () => {
  const { isEditMode, setIsEditMode } = useEditMode();

  const handleToggle = () => {
    if (!isEditMode) {
      setIsEditMode(true);
    }
    // When in edit mode, button is disabled - exit only via Cancel/Update Target
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={isEditMode ? "default" : "outline"}
          size="sm"
          onClick={handleToggle}
          disabled={isEditMode}
          className={`transition-all duration-300 px-2 2xl:px-3 ${isEditMode
            ? 'bg-primary text-primary-foreground shadow-[0_0_15px_rgba(99,102,241,0.4)] opacity-70 cursor-not-allowed'
            : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/50'
            }`}
        >
          <Settings className={`h-3.5 w-3.5 2xl:mr-1.5 transition-transform ${isEditMode ? 'scale-110' : ''}`} />
          <span className="hidden 2xl:inline">{isEditMode ? 'Editing' : 'Edit'}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <div className="text-xs">
          {isEditMode
            ? 'Use Cancel or Update Target in the filter panel to exit'
            : 'Enable edit mode to modify target filters'
          }
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

// Wrapper component that provides EditMode context
export const TargetConfigManager = () => {
  return (
    <EditModeProvider>
      <TargetConfigManagerContent />
    </EditModeProvider>
  );
};