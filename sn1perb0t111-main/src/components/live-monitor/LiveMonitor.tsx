import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Activity, RefreshCw, Filter, SlidersHorizontal, Clock, Settings2, Eye, EyeOff, DollarSign, Pause, Play, Maximize2, Minimize2, Lock, LockOpen, History, LayoutGrid, ChevronDown, ChevronUp, Layers, Search, Volume2, VolumeX, X, Columns3, MousePointer2, Pencil, Plus, Star
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useBotStatus } from "@/contexts/BotStatusContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Settings as SettingsIcon, Image as ImageIcon, ImagePlus } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { MonitorItem, WatchlistItem, WatchlistFilters, defaultWatchlistFilters, serverTimeOffset, updateServerTimeOffset } from "./monitorTypes";
import { MonitorItemCard, BuyState, updateLowestPriceCache, registerItemScreenshot, purgeExpiredScreenshots, clearLoadedManualScreenshots } from "./MonitorItemCard";
import { MonitorStatusBar } from "./MonitorStatusBar";
import { WatchlistView } from "./WatchlistView";
import { MonitorSettingsTab, MonitorFilters, defaultMonitorFilters } from "./MonitorSettingsTab";
import { loadFilters as loadMonitorFilters } from "./filters/monitorPresets";
import { loadConfigs, findCfgMatch, CfgMatch } from "./cfgMatcher";
import { fetchAllConfigs } from "../targets/TargetConfigManager";
import { useSoundSettings } from "@/contexts/SoundSettingsContext";
import { CHARMS_SET } from "./filters/charmsList";
import { cn } from "@/lib/utils";

import { SkinOverlay, loadOverlays, findOverlayMatch, OverlayMatch } from "./overlays/overlayTypes";
import { OverlaysShell, OverlayWorkspaceTab, OverlayCommandBar, OverlayMode, PanelMode, OverlayConfigActions } from "./overlays/OverlaysShell";
import { Frame as FrameIcon } from "lucide-react";
import { LiveTapeBar } from "./filters/LiveTapeBar";

interface LiveMonitorProps {
  sidebarVisible?: boolean;
  onToggleSidebar?: () => void;
}

const STEAM_IMAGE_BASE = "https://community.akamai.steamstatic.com/economy/image/";

const parseNum = (val: unknown, fallback = 0): number => {
  const n = typeof val === "number" ? val : Number(val);
  return Number.isFinite(n) ? n : fallback;
};
const normalizeSteamImageUrl = (iconUrl?: string | null): string => {
  if (!iconUrl || typeof iconUrl !== "string") return "";
  const trimmed = iconUrl.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:") || trimmed.startsWith("/")) {
    return trimmed;
  }
  return `${STEAM_IMAGE_BASE}${trimmed}`;
};

const mapRarity = (rarityName?: string, typeName?: string): MonitorItem["rarity"] => {
  const r = (rarityName || "").toLowerCase();
  const typeLower = (typeName || "").toLowerCase();
  const isStickerType = typeLower === "sticker" || r.includes("sticker");
  const isCharmType = typeLower === "charm" || r.includes("charm");
  const isCollectibleType = typeLower === "collectible" || r.includes("collectible");

  // Agents
  if (r.includes("master")) return "master";
  if (r.includes("superior")) return "superior";
  if (r.includes("exceptional")) return "exceptional";
  if (r.includes("distinguished")) return "distinguished";

  // Check custom item categories before fallback to weapon rarities since names overlap
  if (r.includes("contraband")) {
    if (isStickerType) return "contraband-sticker";
    if (isCollectibleType) return "contraband-collectible";
    return "contraband";
  }

  if (r.includes("extraordinary")) {
    if (isCharmType) return "extraordinary-charm";
    if (isCollectibleType) return "extraordinary-collectible";
    if (isStickerType) return "extraordinary-sticker";
    return "extraordinary";
  }

  if (r.includes("exotic")) {
    if (isCharmType) return "exotic-charm";
    if (isCollectibleType) return "exotic-collectible";
    return "exotic";
  }

  if (r.includes("remarkable")) {
    if (isCharmType) return "remarkable-charm";
    if (isCollectibleType) return "remarkable-collectible";
    return "remarkable";
  }

  if (r.includes("high grade")) {
    if (isCharmType) return "high-grade-charm";
    if (isCollectibleType) return "high-grade-collectible";
    return "high-grade";
  }

  // Standard weapon rarities
  if (r.includes("covert")) return "covert";
  if (r.includes("classified")) return "classified";
  if (r.includes("restricted")) return "restricted";
  if (r.includes("mil") || r.includes("agent quality")) return "mil-spec";
  if (r.includes("industrial")) return "industrial";
  if (r.includes("consumer") || r.includes("base grade")) return "consumer";

  return "mil-spec";
};

const splitWeaponAndSkin = (itemName: string): { weaponType: string; skinName: string } => {
  const cleanPrefixes = (str: string) => {
    return str
      .replace(/[\u2605\u2606\u2b50]/g, "")
      .replace(/StatTrak™?/gi, "")
      .replace(/Souvenir/gi, "")
      .trim();
  };

  if (!itemName.includes("|")) {
    const cleaned = cleanPrefixes(itemName).replace(/\s*\(.+\)\s*$/, "").trim();
    return { weaponType: cleaned, skinName: cleaned };
  }
  const [weapon, ...rest] = itemName.split("|");
  const cleanedWeapon = cleanPrefixes(weapon);
  const skinRaw = rest.join("|").trim();
  const skinName = skinRaw.replace(/\s*\(.+\)\s*$/, "").trim() || skinRaw;
  return { weaponType: cleanedWeapon, skinName };
};

const listedAgoFromIso = (value?: string): string => {
  if (!value) return "just now";
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return "just now";
  const diff = Math.max(0, Math.floor(((Date.now() + serverTimeOffset) - ts) / 1000));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
};

/* Quick ranges for the toolbar price filter (empty string = open-ended) */
type PricePreset = { min: string; max: string };
const DEFAULT_PRICE_PRESETS: PricePreset[] = [
  { min: "", max: "10" },
  { min: "10", max: "50" },
  { min: "50", max: "200" },
  { min: "200", max: "1000" },
  { min: "1000", max: "" },
];
const fmtMoney = (v: string) => {
  const n = parseFloat(v);
  if (isNaN(n)) return "";
  return n >= 1000 ? `${+(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(n);
};
const presetLabel = (p: PricePreset) => {
  const lo = fmtMoney(p.min), hi = fmtMoney(p.max);
  if (!lo && !hi) return "Any";
  if (!lo) return `< $${hi}`;
  if (!hi) return `$${lo}+`;
  return `$${lo}–${hi}`;
};

const parseWatchlistDate = (value: unknown): Date => {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
};

const LazyCardWrapper = ({ children, forceVisible, isNewlyArrived }: { children: React.ReactNode; forceVisible?: boolean; isNewlyArrived?: boolean }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { rootMargin: "300px 0px" }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, []);

  const shouldRender = (isVisible && !isNewlyArrived) || forceVisible;

  return (
    <div ref={ref} className="w-full h-full">
      {shouldRender ? children : (
        <div className="h-full w-full rounded-xl border border-border/10 bg-card/5 animate-pulse flex items-center justify-center select-none">
          <span className="text-[10px] font-mono text-muted-foreground/30 uppercase tracking-widest">Loading</span>
        </div>
      )}
    </div>
  );
};

interface CustomDurationPopoverContentProps {
  screenshotTtlMinutes: number;
  setScreenshotTtlMinutes: (ttl: number) => void;
}

const CustomDurationPopoverContent = ({
  screenshotTtlMinutes,
  setScreenshotTtlMinutes,
}: CustomDurationPopoverContentProps) => {
  const [unit, setUnit] = useState<'m' | 'h'>('m');
  const [inputValue, setInputValue] = useState<string>(() => {
    if ([1, 2, 5, 0].includes(screenshotTtlMinutes)) return '';
    return screenshotTtlMinutes ? String(screenshotTtlMinutes) : '';
  });

  const handleInputChange = (rawVal: string, currentUnit: 'm' | 'h') => {
    setInputValue(rawVal);
    let num = parseFloat(rawVal);
    if (!isNaN(num) && num > 0) {
      if (currentUnit === 'h') num = num * 60;
      const finalMins = Math.min(1440, Math.max(1, Math.round(num)));
      setScreenshotTtlMinutes(finalMins);
    }
  };

  const handleUnitToggle = (newUnit: 'm' | 'h') => {
    if (newUnit === unit) return;
    setUnit(newUnit);
    let num = parseFloat(inputValue);
    if (!isNaN(num) && num > 0) {
      let nextMins = num;
      if (newUnit === 'h') {
        const hrs = Math.max(1, Math.min(24, Math.round(num / 60) || 1));
        setInputValue(String(hrs));
        nextMins = hrs * 60;
      } else {
        const mins = Math.max(1, Math.min(1440, Math.round(num * 60)));
        setInputValue(String(mins));
        nextMins = mins;
      }
      setScreenshotTtlMinutes(nextMins);
    }
  };

  return (
    <div className="w-56 p-3 bg-popover/95 backdrop-blur-md border border-violet-500/30 shadow-2xl z-50 rounded-lg space-y-3 text-xs">
      <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
        <div className="flex items-center gap-1.5 font-semibold text-foreground">
          <Clock className="h-3.5 w-3.5 text-violet-400" />
          <span>Custom Screenshot Duration</span>
        </div>
      </div>

      {/* Unlimited Option */}
      <button
        type="button"
        onClick={() => {
          setInputValue('');
          setScreenshotTtlMinutes(0);
        }}
        className={`w-full py-1.5 px-2.5 rounded-md font-semibold text-xs transition-all flex items-center justify-between border ${screenshotTtlMinutes === 0
            ? 'bg-violet-500/25 text-violet-300 border-violet-500/60 shadow-[0_0_10px_rgba(139,92,246,0.2)]'
            : 'bg-secondary/40 border-border/40 hover:bg-secondary/70 text-muted-foreground hover:text-foreground'
          }`}
      >
        <span>Unlimited Lifetime</span>
        <span className="font-mono text-sm font-bold">∞</span>
      </button>

      {/* Custom Duration Input */}
      <div className="space-y-2 pt-1 border-t border-border/40">
        <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Exact Value</label>

        {/* Unit Selector Segmented Control */}
        <div className="grid grid-cols-2 gap-1 bg-black/40 p-1 rounded-lg border border-border/40">
          <button
            type="button"
            onClick={() => handleUnitToggle('m')}
            className={`py-1 text-[10px] font-mono font-bold rounded-md transition-all text-center cursor-pointer ${unit === 'm'
                ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              }`}
          >
            Minutes
          </button>
          <button
            type="button"
            onClick={() => handleUnitToggle('h')}
            className={`py-1 text-[10px] font-mono font-bold rounded-md transition-all text-center cursor-pointer ${unit === 'h'
                ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              }`}
          >
            Hours
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            min={1}
            max={unit === 'h' ? 24 : 1440}
            placeholder={unit === 'h' ? "1-24 (hours)" : "1-1440 (mins)"}
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value, unit)}
            className="h-8 text-xs bg-background/80 font-mono w-full"
          />
        </div>
        <p className="text-[9.5px] text-muted-foreground text-right font-mono">
          Max: 24h (1440m)
        </p>
      </div>
    </div>
  );
};

export const LiveMonitor = ({ sidebarVisible = true, onToggleSidebar }: LiveMonitorProps) => {
  const { botStatus, toggleBot, isToggling } = useBotStatus();
  const isBotRunning = botStatus.isRunning;

  const [isScannerPlaying, setIsScannerPlaying] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('live-scanner-playing');
      return saved !== 'false';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('live-scanner-playing', String(isScannerPlaying));
    } catch { }
  }, [isScannerPlaying]);

  const [maxItems, setMaxItems] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('live-scanner-max-items');
      const parsed = saved ? parseInt(saved, 10) : 200;
      return Number.isFinite(parsed) ? Math.max(50, Math.min(1500, parsed)) : 200;
    } catch {
      return 200;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('live-scanner-max-items', String(maxItems));
    } catch { }
  }, [maxItems]);

  const [items, setItems] = useState<MonitorItem[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(() => {
    try {
      const saved = localStorage.getItem('live-scanner-watchlist');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map((w: any) => ({
          ...w,
          addedAt: new Date(w.addedAt),
          oldListingPrice: parseNum(w?.oldListingPrice, parseNum(w?.price, 0)),
          newListingPrice: parseNum(w?.newListingPrice, parseNum(w?.price, 0)),
          lastMarketCheckAt: typeof w?.lastMarketCheckAt === "string" ? w.lastMarketCheckAt : undefined,
        }));
      }
    } catch { }
    return [];
  });

  useEffect(() => {
    try { localStorage.setItem('live-scanner-watchlist', JSON.stringify(watchlist)); } catch { }
  }, [watchlist]);

  // Periodically fetch and update the bulk lowest prices cache (independent of bot run status)
  useEffect(() => {
    updateLowestPriceCache();
    const intervalId = setInterval(() => {
      updateLowestPriceCache();
    }, 120_000);
    return () => clearInterval(intervalId);
  }, []);

  const [refreshInterval, setRefreshInterval] = useState<string>(() => {
    try {
      const slotsRaw = localStorage.getItem('live-scanner-speed-slots');
      const activeRaw = localStorage.getItem('live-scanner-active-slot');
      if (slotsRaw) {
        const slots = JSON.parse(slotsRaw);
        const idx = activeRaw != null ? parseInt(activeRaw, 10) || 0 : 0;
        const slot = slots[Math.min(idx, slots.length - 1)];
        if (slot) {
          return slot.mode === 'fixed' ? slot.fixed : `${slot.rangeMin}-${slot.rangeMax}`;
        }
      }
    } catch { }
    return "1";
  });

  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const refreshLogRef = useRef<{ t: number; items: MonitorItem[] }[]>([]);
  const sessionStartRef = useRef<number>(Date.now());
  const [cardsPerMinute, setCardsPerMinute] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [sortBy, setSortBy] = useState<string>("newest");
  const [activeTab, setActiveTab] = useState("all");
  const [monitorFilters, setMonitorFilters] = useState<MonitorFilters>(() => {
    try {
      return loadMonitorFilters();
    } catch {
      return defaultMonitorFilters;
    }
  });

  const [pinnedItemId, setPinnedItemId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('live-monitor-pinned-id');
    } catch {
      return null;
    }
  });
  const [buyLocked, setBuyLocked] = useState(true);
  const [buyStates, setBuyStates] = useState<Record<string, BuyState>>({});
  const [showSold, setShowSold] = useState(false);
  const [soldItems, setSoldItems] = useState<MonitorItem[]>([]);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [gridColumns, setGridColumns] = useState(8);
  const [gridRows, setGridRows] = useState(3);
  const [imageScale, setImageScale] = useState<number>(() => {
    try { const v = parseInt(localStorage.getItem('live-scanner-image-scale') || '100'); return Number.isFinite(v) ? Math.max(50, Math.min(200, v)) : 100; } catch { return 100; }
  });
  useEffect(() => { try { localStorage.setItem('live-scanner-image-scale', String(imageScale)); } catch { } }, [imageScale]);

  const [rarityColorHeight, setRarityColorHeight] = useState<number>(() => {
    try {
      const v = parseInt(localStorage.getItem('live-scanner-rarity-bg-height-v2') || '116');
      return Number.isFinite(v) ? Math.max(80, Math.min(180, v)) : 116;
    } catch {
      return 116;
    }
  });
  useEffect(() => {
    try { localStorage.setItem('live-scanner-rarity-bg-height-v2', String(rarityColorHeight)); } catch { }
  }, [rarityColorHeight]);

  const [toolbarHidden, setToolbarHidden] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [newlyArrivedIds, setNewlyArrivedIds] = useState<Set<string>>(new Set());

  /* Hover-freeze: while the cursor rests on a card the rendered feed is held still
     (the underlying feed keeps running), so the card stays put under the pointer.
     On mouse-out the grid snaps back to wherever the feed has moved to by then. */
  const [hoverFreeze, setHoverFreeze] = useState(() => {
    try { return localStorage.getItem('live-monitor-hover-freeze') === 'true'; } catch { return false; }
  });
  const [frozenCardId, setFrozenCardId] = useState<string | null>(null);
  const isHoverFrozen = hoverFreeze && frozenCardId !== null;
  /** Slot the hovered card occupied when it was frozen. */
  const frozenSlotRef = useRef<{ id: string; index: number; item: MonitorItem } | null>(null);

  const freezeCard = useCallback((item: MonitorItem, index: number) => {
    if (!hoverFreeze) return;
    // Do NOT overwrite if this item is already frozen — position must stay locked
    if (frozenSlotRef.current?.id === item.id) return;
    frozenSlotRef.current = { id: item.id, index, item };
    setFrozenCardId(item.id);
  }, [hoverFreeze]);

  const unfreezeCard = useCallback(() => {
    frozenSlotRef.current = null;
    setFrozenCardId(null);
  }, []);

  // Card-level mouseleave intentionally removed:
  // Unfreeze fires only from handleGridMouseLeave (mouse leaves entire grid).
  // Per-card mouseleave caused spurious releases during React DOM reconciliation
  // (new SSE items updating neighbors), Radix portal overlays, and double-fire
  // from nested div + MonitorItemCard root div sharing the same handler.
  const handleGridMouseOver = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!hoverFreeze || !frozenSlotRef.current) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;

    const isOverCardOrPopup = !!target.closest(
      '[data-monitor-card], [role="tooltip"], [data-radix-popper-content-wrapper], [role="dialog"]'
    );
    if (!isOverCardOrPopup) {
      unfreezeCard();
    }
  };

  const handleGridMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!hoverFreeze || !frozenSlotRef.current) return;

    const rect = e.currentTarget.getBoundingClientRect();
    if (
      e.clientX >= rect.left && e.clientX <= rect.right &&
      e.clientY >= rect.top && e.clientY <= rect.bottom
    ) {
      return;
    }

    unfreezeCard();
  };

  const toggleHoverFreeze = () => {
    setHoverFreeze(v => {
      const next = !v;
      try { localStorage.setItem('live-monitor-hover-freeze', String(next)); } catch { /* ignore */ }
      if (!next) unfreezeCard();
      return next;
    });
  };

  useEffect(() => {
    if (!hoverFreeze) {
      unfreezeCard();
    }
  }, [hoverFreeze, unfreezeCard]);

  /* Price range filter — works alongside search (both narrow the same feed). */
  const [priceMin, setPriceMin] = useState<string>(() => {
    try { return localStorage.getItem('live-monitor-price-min') || ""; } catch { return ""; }
  });
  const [priceMax, setPriceMax] = useState<string>(() => {
    try { return localStorage.getItem('live-monitor-price-max') || ""; } catch { return ""; }
  });
  const updatePriceMin = (v: string) => { setPriceMin(v); try { localStorage.setItem('live-monitor-price-min', v); } catch { /* ignore */ } };
  const updatePriceMax = (v: string) => { setPriceMax(v); try { localStorage.setItem('live-monitor-price-max', v); } catch { /* ignore */ } };
  const priceFilterActive = priceMin.trim() !== "" || priceMax.trim() !== "";

  /* Customisable quick ranges for the price filter */
  const [pricePresets, setPricePresets] = useState<PricePreset[]>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('live-monitor-price-presets') || "");
      if (Array.isArray(raw) && raw.every((p) => typeof p?.min === 'string' && typeof p?.max === 'string')) return raw;
    } catch { /* defaults */ }
    return DEFAULT_PRICE_PRESETS;
  });
  const savePricePresets = (next: PricePreset[]) => {
    setPricePresets(next);
    try { localStorage.setItem('live-monitor-price-presets', JSON.stringify(next)); } catch { /* ignore */ }
  };
  const [editingPresets, setEditingPresets] = useState(false);

  /* Matches-only: show just the listings that hit one of your target configs */
  const [matchesOnly, setMatchesOnly] = useState(() => {
    try { return localStorage.getItem('live-monitor-matches-only') === 'true'; } catch { return false; }
  });
  const toggleMatchesOnly = () => setMatchesOnly(v => {
    const next = !v;
    try { localStorage.setItem('live-monitor-matches-only', String(next)); } catch { /* ignore */ }
    return next;
  });

  const { settings: soundSettings, setEnabled: setSoundEnabledGlobal } = useSoundSettings();
  const soundEnabled = soundSettings.enabled;
  const setSoundEnabled = (next: boolean | ((v: boolean) => boolean)) => {
    const value = typeof next === 'function' ? (next as (v: boolean) => boolean)(soundEnabled) : next;
    setSoundEnabledGlobal(value);
  };

  const [overlays, setOverlays] = useState<SkinOverlay[]>(() => loadOverlays());
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('icons');
  const [overlayPanelMode, setOverlayPanelMode] = useState<PanelMode>('browse');
  const [overlaySearchQuery, setOverlaySearchQuery] = useState("");
  const overlayActionsRef = useRef<OverlayConfigActions | null>(null);

  const [showInGameImages, setShowInGameImages] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('live-scanner-show-ingame-images');
      return saved === null ? true : saved === 'true';
    } catch { return true; }
  });
  const [showScreenshots, setShowScreenshots] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('live-scanner-show-screenshots');
      return saved === null ? true : saved === 'true';
    } catch { return true; }
  });
  const [screenshotMode, setScreenshotMode] = useState<'auto' | 'manual'>(() => {
    try {
      const saved = localStorage.getItem('live-scanner-screenshot-mode');
      return (saved === 'auto' || saved === 'manual') ? saved : 'auto';
    } catch { return 'auto'; }
  });
  const [screenshotTtlMinutes, setScreenshotTtlMinutes] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('live-scanner-screenshot-ttl');
      const parsed = saved ? parseFloat(saved) : 2;
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 2;
    } catch { return 2; }
  });

  useEffect(() => {
    try { localStorage.setItem('live-scanner-show-ingame-images', String(showInGameImages)); } catch { }
  }, [showInGameImages]);

  useEffect(() => {
    try { localStorage.setItem('live-scanner-show-screenshots', String(showScreenshots)); } catch { }
  }, [showScreenshots]);

  useEffect(() => {
    try { localStorage.setItem('live-scanner-screenshot-mode', screenshotMode); } catch { }
  }, [screenshotMode]);

  useEffect(() => {
    try { localStorage.setItem('live-scanner-screenshot-ttl', String(screenshotTtlMinutes)); } catch { }
  }, [screenshotTtlMinutes]);

  useEffect(() => {
    if (screenshotTtlMinutes <= 0) return;
    const interval = setInterval(() => {
      purgeExpiredScreenshots(screenshotTtlMinutes);
    }, 2000);
    return () => clearInterval(interval);
  }, [screenshotTtlMinutes]);

  const activeProfile = useMemo(() => {
    try {
      return localStorage.getItem("sniper-bot-settings-active-profile") || "config-1";
    } catch {
      return "config-1";
    }
  }, []);

  const [bidFetchIntervalNormal, setBidFetchIntervalNormal] = useState<number>(() => {
    try {
      const profile = localStorage.getItem("sniper-bot-settings-active-profile") || "config-1";
      const saved = localStorage.getItem(`${profile}-live-scanner-bid-fetch-interval-normal`);
      const parsed = saved ? parseInt(saved, 10) : 30;
      return Number.isFinite(parsed) ? Math.max(0, Math.min(90, parsed)) : 30;
    } catch {
      return 30;
    }
  });
  const bidFetchIntervalNormalRef = useRef(bidFetchIntervalNormal);
  useEffect(() => {
    bidFetchIntervalNormalRef.current = bidFetchIntervalNormal;
  }, [bidFetchIntervalNormal]);

  const [bidFetchHiddenEnabled, setBidFetchHiddenEnabled] = useState<boolean>(() => {
    try {
      const profile = localStorage.getItem("sniper-bot-settings-active-profile") || "config-1";
      const saved = localStorage.getItem(`${profile}-live-scanner-bid-fetch-hidden-enabled`);
      return saved !== 'false';
    } catch {
      return true;
    }
  });

  const [bidFetchIntervalHidden, setBidFetchIntervalHidden] = useState<number>(() => {
    try {
      const profile = localStorage.getItem("sniper-bot-settings-active-profile") || "config-1";
      const saved = localStorage.getItem(`${profile}-live-scanner-bid-fetch-interval-hidden`);
      const parsed = saved ? parseInt(saved, 10) : 120;
      return Number.isFinite(parsed) ? Math.max(90, Math.min(300, parsed)) : 120;
    } catch {
      return 120;
    }
  });

  const [bidFetchMode, setBidFetchMode] = useState<'independent' | 'queue'>(() => {
    try {
      const profile = localStorage.getItem("sniper-bot-settings-active-profile") || "config-1";
      const saved = localStorage.getItem(`${profile}-live-scanner-bid-fetch-mode`);
      return (saved === 'queue') ? 'queue' : 'independent';
    } catch {
      return 'independent';
    }
  });

  const [priceDiffRef, setPriceDiffRef] = useState<'ask' | 'bid'>(() => {
    try {
      const profile = localStorage.getItem("sniper-bot-settings-active-profile") || "config-1";
      const saved = localStorage.getItem(`${profile}-live-scanner-price-diff-ref`);
      return (saved === 'bid') ? 'bid' : 'ask';
    } catch {
      return 'ask';
    }
  });

  const [includeCharmPrice, setIncludeCharmPrice] = useState<boolean>(() => {
    try {
      const profile = localStorage.getItem("sniper-bot-settings-active-profile") || "config-1";
      const saved = localStorage.getItem(`${profile}-live-scanner-include-charm-price`);
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try { localStorage.setItem(`${activeProfile}-live-scanner-price-diff-ref`, priceDiffRef); } catch { }
  }, [priceDiffRef, activeProfile]);

  useEffect(() => {
    try { localStorage.setItem(`${activeProfile}-live-scanner-include-charm-price`, String(includeCharmPrice)); } catch { }
  }, [includeCharmPrice, activeProfile]);

  useEffect(() => {
    try { localStorage.setItem(`${activeProfile}-live-scanner-bid-fetch-interval-normal`, String(bidFetchIntervalNormal)); } catch { }
  }, [bidFetchIntervalNormal, activeProfile]);

  useEffect(() => {
    try { localStorage.setItem(`${activeProfile}-live-scanner-bid-fetch-hidden-enabled`, String(bidFetchHiddenEnabled)); } catch { }
  }, [bidFetchHiddenEnabled, activeProfile]);

  useEffect(() => {
    try { localStorage.setItem(`${activeProfile}-live-scanner-bid-fetch-interval-hidden`, String(bidFetchIntervalHidden)); } catch { }
  }, [bidFetchIntervalHidden, activeProfile]);

  useEffect(() => {
    try { localStorage.setItem(`${activeProfile}-live-scanner-bid-fetch-mode`, bidFetchMode); } catch { }
  }, [bidFetchMode, activeProfile]);


  const pinnedItemRef = useRef<MonitorItem | null>(null);
  const isPinnedItemRefInitialized = useRef(false);
  if (!isPinnedItemRefInitialized.current) {
    try {
      const saved = localStorage.getItem('live-monitor-pinned-item');
      if (saved) {
        pinnedItemRef.current = JSON.parse(saved);
      }
    } catch { }
    isPinnedItemRefInitialized.current = true;
  }
  const seenNotifIdsRef = useRef<Set<string>>(new Set());
  const gridScrollRef = useRef<HTMLDivElement | null>(null);
  const gridContainerRef = useRef<HTMLDivElement | null>(null);
  const CARD_HEIGHT = 300 + (rarityColorHeight - 116);
  const GRID_GAP = 12;
  const [maxRowsByViewport, setMaxRowsByViewport] = useState(gridRows);
  const hasLoadedServerStateRef = useRef(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const prevItemsRef = useRef<Set<string>>(new Set());
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    const loadServerState = async () => {
      try {
        const res = await fetch('/api/live-monitor/state', { cache: 'no-store' });
        if (!res.ok) {
          hasInitializedRef.current = true;
          return;
        }
        const serverDate = res.headers.get('Date');
        if (serverDate) {
          updateServerTimeOffset(new Date(serverDate).getTime());
        }
        const payload = await res.json();

        if (Array.isArray(payload?.items)) {
          const sanitizedItems = (payload.items as MonitorItem[]).map(item => ({
            ...item,
            bidFetchAt: undefined,
            bidFetchRemaining: undefined,
            bidFetchPaused: undefined,
            loadingBid: false,
            loadingAsk: false,
          }));
          setItems(sanitizedItems);
          prevItemsRef.current = new Set(payload.items.map((i: any) => i.id));
          hasInitializedRef.current = true;
        } else {
          hasInitializedRef.current = true;
        }
        if (Array.isArray(payload?.watchlist)) {
          setWatchlist(
            payload.watchlist.map((w: any) => ({
              ...w,
              addedAt: parseWatchlistDate(w?.addedAt),
              trackFilters: { ...defaultWatchlistFilters, ...(w?.trackFilters || {}) },
              oldListingPrice: parseNum(w?.oldListingPrice, parseNum(w?.price, 0)),
              newListingPrice: parseNum(w?.newListingPrice, parseNum(w?.price, 0)),
              lastMarketCheckAt: typeof w?.lastMarketCheckAt === "string" ? w.lastMarketCheckAt : undefined,
            }))
          );
        }
        if (Array.isArray(payload?.soldItems)) {
          setSoldItems(payload.soldItems as MonitorItem[]);
        }
      } catch {
        // Keep localStorage fallback silently.
        hasInitializedRef.current = true;
      } finally {
        hasLoadedServerStateRef.current = true;
        setIsInitialized(true);
        hasInitializedRef.current = true;
      }
    };

    loadServerState();
  }, []);

  useEffect(() => {
    if (!hasLoadedServerStateRef.current) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      const sanitizedItems = items.map(item => {
        const { bidFetchAt, bidFetchRemaining, bidFetchPaused, loadingBid, loadingAsk, ...rest } = item;
        return rest;
      });
      fetch('/api/live-monitor/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: sanitizedItems, watchlist, soldItems }),
        signal: controller.signal,
      }).catch(() => { });
    }, 400);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [items, watchlist, soldItems]);

  useEffect(() => {
    const el = gridContainerRef.current;
    if (!el) return;
    const update = () => {
      const h = el.clientHeight;
      if (h > 0) {
        const fit = Math.max(1, Math.floor((h + GRID_GAP) / (CARD_HEIGHT + GRID_GAP)));
        setMaxRowsByViewport(fit);
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeTab]);

  const effectiveRows = Math.min(gridRows, maxRowsByViewport);
  const scrollHeight = effectiveRows * CARD_HEIGHT + (effectiveRows - 1) * GRID_GAP;

  const [configs, setConfigs] = useState<any[]>([]);
  useEffect(() => {
    let alive = true;
    const load = () => {
      fetchAllConfigs()
        .then((c) => { if (alive) setConfigs(c); })
        .catch(() => { /* keep last known */ });
    };
    load();
    const onChanged = () => load();
    window.addEventListener("targets:changed", onChanged);
    const iv = setInterval(load, 60_000);
    return () => {
      alive = false;
      window.removeEventListener("targets:changed", onChanged);
      clearInterval(iv);
    };
  }, []);

  const itemMatches = useMemo(() => {
    const map = new Map<string, CfgMatch>();
    items.forEach(item => {
      if (item.configName) {
        map.set(item.id, {
          configName: item.configName,
          configEmoji: item.configEmoji,
          targetItemName: item.name,
          hasNotification: true,
          hasAutopurchase: false,
        });
      }
    });
    return map;
  }, [items]);

  const overlayMatches = useMemo(() => {
    const map = new Map<string, OverlayMatch>();
    items.forEach(item => {
      const match = findOverlayMatch(item.name, item.paintSeed, overlays);
      if (match) map.set(item.id, match);
    });
    return map;
  }, [items, overlays]);

  const playNotificationSound = useCallback(() => {
    if (!soundSettings.enabled || soundSettings.volume === 0) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const vol = soundSettings.volume / 100;

      [0, 0.12].forEach((offset, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(i === 0 ? 880 : 1320, ctx.currentTime + offset);
        gain.gain.setValueAtTime(0, ctx.currentTime + offset);
        gain.gain.linearRampToValueAtTime(0.18 * vol, ctx.currentTime + offset + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + offset);
        osc.stop(ctx.currentTime + offset + 0.12);
      });
    } catch { }
  }, [soundSettings]);

  const mapFeedItemToMonitorItem = useCallback((data: Record<string, any>): MonitorItem | null => {
    const rawItemName = String(data.skin_name || data.item_name || "").trim();
    if (!rawItemName) return null;

    const wearName = String(data.wear_name || "").trim();
    let fullName = rawItemName.replace(/\s*\((factory new|minimal wear|field-tested|well-worn|battle-scarred)\)\s*$/i, "").trim();

    let phase = data.phase ? String(data.phase) : undefined;
    if (!phase) {
      const phaseMatch = fullName.match(/\((Phase\s+\d+|Emerald|Ruby|Sapphire|Black Pearl)\)/i);
      if (phaseMatch) {
        phase = phaseMatch[1];
      }
    }
    if (phase) {
      fullName = fullName.replace(new RegExp(`\\s*\\(${phase.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\)`, 'i'), '').trim();
    }

    const { weaponType, skinName } = splitWeaponAndSkin(rawItemName);
    const price = parseNum(data.price, 0);

    const refData = data.reference || data.Reference || data.reference_alt || {};
    const basePriceCents = parseNum(refData.predicted_price ?? refData.base_price ?? data.item?.reference?.predicted_price ?? data.item?.reference?.base_price, 0);
    const fallbackBasePrice = parseNum(data.base_price ?? data.predicted_price ?? data.reference_price, 0);
    const basePrice = basePriceCents > 0 ? basePriceCents / 100 : fallbackBasePrice;

    const priceChange = basePrice > 0 ? price - basePrice : 0;
    const priceChangePercent = basePrice > 0 ? (priceChange / basePrice) * 100 : 0;

    const stickersRaw = Array.isArray(data.stickers) ? data.stickers : [];
    const stickers = stickersRaw.map((st: any, idx: number) => {
      const rawSlot = parseNum(st?.slot, idx);
      const referencePrice = parseNum(st?.reference?.price, 0) > 0
        ? parseNum(st?.reference?.price, 0) / 100
        : parseNum(st?.price, 0);
      const offsetX = st?.offset_x != null ? parseNum(st.offset_x, 0) : undefined;
      const offsetY = st?.offset_y != null ? parseNum(st.offset_y, 0) : undefined;
      const rotation = st?.rotation != null ? parseNum(st.rotation, 0) : undefined;
      const customPlace = (offsetX !== undefined && offsetY !== undefined)
        ? { x: offsetX, y: offsetY, r: rotation ?? 0 }
        : undefined;
      return {
        name: String(st?.name || "Sticker"),
        imageUrl: normalizeSteamImageUrl(st?.icon_url),
        wear: parseNum(st?.wear, 0),
        slot: rawSlot >= 0 && rawSlot <= 4 ? rawSlot + 1 : rawSlot,
        referencePrice,
        globalListings: parseNum(st?.reference?.quantity, 0),
        offsetX,
        offsetY,
        customPlace,
      };
    }).filter((st: any) => st.imageUrl);

    const charmsRaw = Array.isArray(data.charms) ? data.charms : (Array.isArray(data.keychains) ? data.keychains : (Array.isArray(data.item?.keychains) ? data.item.keychains : []));
    const charm = charmsRaw.length > 0
      ? {
        name: String(charmsRaw[0]?.name || "Charm"),
        imageUrl: normalizeSteamImageUrl(charmsRaw[0]?.icon_url || charmsRaw[0]?.iconUrl) || "/placeholder.svg",
        pattern: parseNum(charmsRaw[0]?.pattern, 0),
        referencePrice: parseNum(charmsRaw[0]?.reference?.price ?? charmsRaw[0]?.price, 0) / 100,
      }
      : undefined;

    const blueGemTier = parseNum(data.blue_gem?.tier ?? data.item?.blue_gem?.tier, 0);
    const blueGemPlaysideBlue = parseNum(data.blue_gem?.playside_blue ?? data.item?.blue_gem?.playside_blue, 0);
    const blueGemBacksideBlue = parseNum(data.blue_gem?.backside_blue ?? data.item?.blue_gem?.backside_blue, 0);
    const fadeRank = parseNum(data.fade?.rank ?? data.item?.fade?.rank, 0);

    const iconUrl = normalizeSteamImageUrl(data.icon_url || data.item?.icon_url);
    const isBought = String(data.action || "").toLowerCase() === "buy" || data.notification_type === "autobuy";

    let computedSP = parseNum(data.stickers_price_percent ?? data.stickers_price_percentage, 0);
    if (computedSP === 0 && stickers.length > 0) {
      const stickersTotalPrice = stickers.reduce((acc, st) => acc + (st.referencePrice || 0), 0);
      if (stickersTotalPrice > 0 && basePrice > 0) {
        computedSP = ((price - basePrice) / stickersTotalPrice) * 100;
      }
    }

    return {
      id: String(data.item_id || data.id || ""),
      name: fullName,
      weaponType,
      skinName,
      typeName: data.type_name ? String(data.type_name) : undefined,
      wear: wearName || "Unknown",
      isStatTrak: Boolean(data.is_stattrak) || rawItemName.toLowerCase().includes("stattrak"),
      isSouvenir: Boolean(data.is_souvenir) || rawItemName.toLowerCase().includes("souvenir"),
      phase,
      rarity: mapRarity(String(data.rarity_name || ""), data.type_name ? String(data.type_name) : undefined),
      price,
      priceChange,
      priceChangePercent,
      bidPrice: data.hasRealBid || data.has_real_bid || data.bidPrice != null || data.bid_price != null
        ? parseNum(data.bidPrice ?? data.bid_price ?? data.min_offer_price, 0)
        : null,
      hasRealBid: Boolean(data.hasRealBid || data.has_real_bid),
      askPrice: parseNum(data.ask_price, price > 0 ? price * 1.03 : 0),
      float: parseNum(data.float ?? data.float_value, 0),
      paintSeed: parseNum(data.paint_seed ?? data.pattern, 0),
      paintIndex: parseNum(data.paint_index ?? data.paintIndex ?? data.item?.paint_index ?? data.item?.paintIndex, 0) || undefined,
      listedAgo: listedAgoFromIso(String(data.created_at || data.timestamp || "")),
      listedAt: data.created_at ? new Date(data.created_at).getTime() : (data.timestamp ? new Date(data.timestamp).getTime() : Date.now()),
      isOnline: true,
      stickerOverpay: parseFloat(computedSP.toFixed(2)),
      fadePercent: parseNum(data.fade_percentage ?? data.fade?.percentage, 0),
      fadeRank: fadeRank > 0 ? fadeRank : undefined,
      blueGemTier: blueGemTier > 0 ? blueGemTier : undefined,
      blueGemPlaysideBlue: blueGemPlaysideBlue > 0 ? blueGemPlaysideBlue : undefined,
      blueGemPlaysidePurple: parseNum(data.blue_gem?.playside_purple ?? data.item?.blue_gem?.playside_purple, 0) || undefined,
      blueGemPlaysideGold: parseNum(data.blue_gem?.playside_gold ?? data.item?.blue_gem?.playside_gold, 0) || undefined,
      blueGemBacksideBlue: blueGemBacksideBlue > 0 ? blueGemBacksideBlue : undefined,
      blueGemBacksidePurple: parseNum(data.blue_gem?.backside_purple ?? data.item?.blue_gem?.backside_purple, 0) || undefined,
      blueGemBacksideGold: parseNum(data.blue_gem?.backside_gold ?? data.item?.blue_gem?.backside_gold, 0) || undefined,
      imageUrl: iconUrl,
      stickers: stickers.length > 0 ? stickers : undefined,
      charm,
      isSold: isBought,
      soldPrice: isBought ? price : undefined,
      badges: Array.isArray(data.badges) ? data.badges : (Array.isArray(data.item?.badges) ? data.item.badges : undefined),
      type: data.type ? String(data.type) : undefined,
      floatRank: parseNum(data.high_rank ?? data.item?.high_rank ?? data.low_rank ?? data.item?.low_rank ?? data.float_rank, 0) || undefined,
      cs2ScreenshotId: data.cs2_screenshot_id ? String(data.cs2_screenshot_id) : (data.item?.cs2_screenshot_id ? String(data.item.cs2_screenshot_id) : undefined),
      configName: data.config_name ? String(data.config_name) : (data.configName ? String(data.configName) : undefined),
      configEmoji: data.config_emoji ? String(data.config_emoji) : (data.configEmoji ? String(data.configEmoji) : undefined),
      minOfferPrice: (() => {
        const rawMin = data.min_offer_price ?? data.minOfferPrice ?? data.item?.min_offer_price;
        if (rawMin != null) {
          const num = parseNum(rawMin, 0);
          if (num > 0) {
            return num > price ? parseFloat((num / 100).toFixed(2)) : parseFloat(num.toFixed(2));
          }
        }
        const rawDisc = data.max_offer_discount ?? data.maxOfferDiscount ?? data.item?.max_offer_discount;
        if (rawDisc != null && price > 0) {
          const disc = parseNum(rawDisc, 0);
          if (disc > 0) {
            const pct = disc > 100 ? disc / 10000 : disc / 100;
            return parseFloat((price * (1 - pct)).toFixed(2));
          }
        }
        return undefined;
      })(),
      maxOfferDiscount: (() => {
        const rawDisc = data.max_offer_discount ?? data.maxOfferDiscount ?? data.item?.max_offer_discount;
        if (rawDisc != null) {
          return parseNum(rawDisc, 0);
        }
        const rawMin = data.min_offer_price ?? data.minOfferPrice ?? data.item?.min_offer_price;
        if (rawMin != null && price > 0) {
          const num = parseNum(rawMin, 0);
          const minUSD = num > price ? num / 100 : num;
          if (minUSD > 0 && minUSD < price) {
            return Math.round(((price - minUSD) / price) * 10000);
          }
        }
        return undefined;
      })(),
    };
  }, []);

  const fetchLiveItems = useCallback(async () => {
    try {
      const res = await fetch(`/api/live-feed?limit=1500&_ts=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) return;
      const serverDate = res.headers.get('Date');
      if (serverDate) {
        updateServerTimeOffset(new Date(serverDate).getTime());
      }

      const payload = await res.json();
      if (!Array.isArray(payload)) return;

      const parsed = (payload as Record<string, any>[])
        .map(mapFeedItemToMonitorItem)
        .filter((item): item is MonitorItem => item !== null);

      const deduped = Array.from(new Map(parsed.map((item) => [item.id, item])).values());
      const latestItems = deduped.slice(0, 1500);

      let hasNew = false;
      const seen = seenNotifIdsRef.current;
      for (const item of latestItems) {
        if (item.id && !seen.has(item.id)) {
          seen.add(item.id);
          hasNew = true;
        }
      }
      if (seen.size > 1000) {
        const keep = new Set(latestItems.slice(0, 300).map((i) => i.id));
        seenNotifIdsRef.current = keep;
      }

      setItems((prev) => {
        if (latestItems.length === 0 && prev.length > 0) return prev;

        const prevMap = new Map(prev.map(i => [i.id, i]));
        const mergedItems = latestItems.map(item => {
          const existing = prevMap.get(item.id);
          if (existing) {
            return {
              ...item,
              bidFetchAt: existing.bidFetchAt,
              bidPrice: existing.bidPrice,
              hasRealBid: existing.hasRealBid,
              loadingBid: existing.loadingBid,
              askPrice: existing.askPrice,
              hasRealAsk: existing.hasRealAsk,
              loadingAsk: existing.loadingAsk,
              bidFetchRemaining: existing.bidFetchRemaining,
              bidFetchPaused: existing.bidFetchPaused,
            };
          }
          return item;
        });

        if (!pinnedItemRef.current) return mergedItems;

        const pinned = mergedItems.find((i) => i.id === pinnedItemRef.current?.id);
        if (pinned) {
          pinnedItemRef.current = pinned;
          try {
            localStorage.setItem('live-monitor-pinned-item', JSON.stringify(pinned));
          } catch { }
          return mergedItems;
        }

        return [pinnedItemRef.current, ...mergedItems.filter((i) => i.id !== pinnedItemRef.current?.id)].slice(0, 1500);
      });
      setLastRefresh(new Date());

      if (hasNew && latestItems.length > 0) {
        playNotificationSound();
      }
    } catch (e) {
      console.error("Failed to fetch live monitor feed", e);
    }
  }, [mapFeedItemToMonitorItem, playNotificationSound]);

  // Sync with actual backend feed on initialization or tab change
  useEffect(() => {
    if (!isInitialized) return;
    if (activeTab === "watchlist") return;

    fetchLiveItems();
  }, [isInitialized, activeTab, fetchLiveItems]);

  const handleUpdateItem = useCallback((itemId: string, updates: Partial<MonitorItem>) => {
    setItems(prev => {
      const idx = prev.findIndex(i => i.id === itemId);
      if (idx === -1) return prev;
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...updates };
      return copy;
    });

    if (updates.hasRealBid || updates.isSold) {
      const oldTimeoutId = activeTimeoutsRef.current.get(itemId);
      if (oldTimeoutId) {
        window.clearTimeout(oldTimeoutId);
        activeTimeoutsRef.current.delete(itemId);
      }
    }

    if (pinnedItemRef.current && pinnedItemRef.current.id === itemId) {
      pinnedItemRef.current = { ...pinnedItemRef.current, ...updates };
      try {
        localStorage.setItem('live-monitor-pinned-item', JSON.stringify(pinnedItemRef.current));
      } catch { }
    }
  }, []);

  const autoFetchBidPrice = useCallback(async (itemId: string) => {
    handleUpdateItem(itemId, { loadingBid: true, bidFetchAt: undefined });
    try {
      const res = await fetch(`/api/csfloat/highest-bid?listing_id=${itemId}`);
      if (res.ok) {
        const data = await res.json();
        handleUpdateItem(itemId, { bidPrice: data.price, hasRealBid: true, loadingBid: false, bidFetchFailed: false });
      } else {
        // On error/429: do NOT set a timer. Leave as Eye icon.
        handleUpdateItem(itemId, { loadingBid: false, bidFetchAt: undefined, bidFetchFailed: true });
      }
    } catch (err) {
      console.error(`Auto-fetch bid failed for ${itemId}`, err);
      // On error/429: do NOT set a timer. Leave as Eye icon.
      handleUpdateItem(itemId, { loadingBid: false, bidFetchAt: undefined, bidFetchFailed: true });
    }
  }, [handleUpdateItem]);



  // SSE Live Feed connection
  useEffect(() => {
    if (!isInitialized) return;
    if (activeTab === "watchlist") return;
    if (!isScannerPlaying || !isBotRunning) return;

    const token = localStorage.getItem("auth_token");
    let eventSource: EventSource | null = null;
    let url = `/api/live-feed/stream`;

    if (token) {
      url += `?token=${token}`;
    }

    try {
      eventSource = new EventSource(url);

      eventSource.onmessage = (event) => {
        try {
          if (event.data === "keep-alive") return;

          const payload = JSON.parse(event.data);
          if (!Array.isArray(payload)) return;

          const parsed = (payload as Record<string, any>[])
            .map(mapFeedItemToMonitorItem)
            .filter((item): item is MonitorItem => item !== null);

          const seen = seenNotifIdsRef.current;
          const newItemsToPush: MonitorItem[] = [];
          const bidUpdatesMap = new Map<string, { bidPrice: number; hasRealBid: boolean }>();

          for (const item of parsed) {
            if (item.id) {
              if (item.hasRealBid && item.bidPrice !== null) {
                bidUpdatesMap.set(item.id, { bidPrice: item.bidPrice, hasRealBid: true });
              }
              if (!seen.has(item.id)) {
                seen.add(item.id);
                newItemsToPush.push(item);
              }
            }
          }

          if (newItemsToPush.length === 0 && bidUpdatesMap.size === 0) return;

          if (newItemsToPush.length > 0) {
            const newIds = newItemsToPush.map((i) => i.id).filter(Boolean);
            if (newIds.length > 0) {
              setNewlyArrivedIds((prev) => {
                const next = new Set(prev);
                newIds.forEach((id) => next.add(id));
                return next;
              });
              setTimeout(() => {
                setNewlyArrivedIds((prev) => {
                  const next = new Set(prev);
                  newIds.forEach((id) => next.delete(id));
                  return next;
                });
              }, 50);
            }
          }

          if (seen.size > 1000) {
            const keep = new Set([...Array.from(seen)].slice(-300));
            seenNotifIdsRef.current = keep;
          }

          setItems((prev) => {
            const prevMap = new Map(prev.map(i => [i.id, i]));

            // Real-time bid synchronization: apply incoming bid updates to existing items
            bidUpdatesMap.forEach((bidData, itemId) => {
              const existing = prevMap.get(itemId);
              if (existing) {
                prevMap.set(itemId, {
                  ...existing,
                  bidPrice: bidData.bidPrice,
                  hasRealBid: true,
                  loadingBid: false,
                  bidFetchAt: undefined,
                  bidFetchRemaining: undefined,
                  bidFetchPaused: undefined,
                });
                const oldTimeoutId = activeTimeoutsRef.current.get(itemId);
                if (oldTimeoutId) {
                  window.clearTimeout(oldTimeoutId);
                  activeTimeoutsRef.current.delete(itemId);
                }
              }
            });

            if (newItemsToPush.length === 0) {
              return Array.from(prevMap.values());
            }

            // Log rate activity
            const now = Date.now();
            refreshLogRef.current.push({ t: now, items: newItemsToPush });

            const mergedNewItems = newItemsToPush.map(item => {
              const existing = prevMap.get(item.id);
              if (existing) {
                const hasRealBid = item.hasRealBid || existing.hasRealBid;
                return {
                  ...item,
                  bidFetchAt: hasRealBid ? undefined : existing.bidFetchAt,
                  bidPrice: item.hasRealBid ? item.bidPrice : existing.bidPrice,
                  hasRealBid: hasRealBid,
                  loadingBid: false,
                  askPrice: item.hasRealAsk ? item.askPrice : existing.askPrice,
                  hasRealAsk: item.hasRealAsk || existing.hasRealAsk,
                  loadingAsk: false,
                  bidFetchRemaining: hasRealBid ? undefined : existing.bidFetchRemaining,
                  bidFetchPaused: hasRealBid ? undefined : existing.bidFetchPaused,
                };
              }
              return item;
            });

            const seenIds = new Set<string>();
            const latestItems: MonitorItem[] = [];

            for (const item of mergedNewItems) {
              if (!seenIds.has(item.id)) {
                seenIds.add(item.id);
                latestItems.push(item);
              }
            }
            for (const item of prevMap.values()) {
              if (!seenIds.has(item.id)) {
                seenIds.add(item.id);
                latestItems.push(item);
              }
            }

            const finalItems = latestItems.slice(0, 1500);

            if (!pinnedItemRef.current) return finalItems;
            const pinned = finalItems.find((i) => i.id === pinnedItemRef.current?.id);
            if (pinned) {
              pinnedItemRef.current = pinned;
              try {
                localStorage.setItem('live-monitor-pinned-item', JSON.stringify(pinned));
              } catch { }
              return finalItems;
            }
            return [pinnedItemRef.current, ...finalItems.filter((i) => i.id !== pinnedItemRef.current?.id)].slice(0, 1500);
          });

          setLastRefresh(new Date());

          if (newItemsToPush.length > 0) {
            playNotificationSound();
          }
        } catch (err) {
          console.error("Error parsing SSE data", err);
        }
      };

      eventSource.onerror = (err) => {
        console.error("SSE connection error", err);
      };
    } catch (e) {
      console.error("SSE error", e);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [fetchLiveItems, isInitialized, activeTab, mapFeedItemToMonitorItem, playNotificationSound, isScannerPlaying, isBotRunning]);



  // Watchlist handlers
  const isWatchlisted = useCallback((id: string) => watchlist.some(w => w.id === id), [watchlist]);

  const toggleWatchlist = useCallback((item: MonitorItem) => {
    if (isWatchlisted(item.id)) {
      setWatchlist(prev => prev.filter(w => w.id !== item.id));
    } else {
      setWatchlist(prev => [...prev, {
        ...item,
        addedAt: new Date(),
        trackFilters: { ...defaultWatchlistFilters },
        oldListingPrice: item.price,
        newListingPrice: item.price,
      }]);
    }
  }, [isWatchlisted]);

  const syncWatchlistListingPrices = useCallback((updates: Array<{ id: string; oldListingPrice: number; newListingPrice: number; lastMarketCheckAt: string }>) => {
    if (updates.length === 0) return;
    const byId = new Map(updates.map((u) => [u.id, u]));
    setWatchlist((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        const update = byId.get(item.id);
        if (!update) return item;

        const oldListingPrice = Number.isFinite(update.oldListingPrice) && update.oldListingPrice > 0
          ? update.oldListingPrice
          : (item.oldListingPrice ?? item.price);
        const newListingPrice = Number.isFinite(update.newListingPrice) && update.newListingPrice > 0
          ? update.newListingPrice
          : (item.newListingPrice ?? item.price);

        if (
          item.oldListingPrice === oldListingPrice &&
          item.newListingPrice === newListingPrice &&
          item.price === newListingPrice &&
          item.lastMarketCheckAt === update.lastMarketCheckAt
        ) {
          return item;
        }

        changed = true;
        const base = oldListingPrice > 0 ? oldListingPrice : newListingPrice;
        const priceChange = newListingPrice - base;
        const priceChangePercent = base > 0 ? (priceChange / base) * 100 : 0;

        return {
          ...item,
          oldListingPrice,
          newListingPrice,
          price: newListingPrice,
          priceChange,
          priceChangePercent,
          lastMarketCheckAt: update.lastMarketCheckAt,
        };
      });

      return changed ? next : prev;
    });
  }, []);

  const removeFromWatchlist = useCallback((id: string) => {
    setWatchlist(prev => prev.filter(w => w.id !== id));
  }, []);

  const updateWatchlistFilters = useCallback((id: string, filters: Partial<WatchlistFilters>) => {
    setWatchlist(prev => prev.map(w => w.id === id ? { ...w, trackFilters: { ...w.trackFilters, ...filters } } : w));
  }, []);

  const normalizeWpn = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const hiddenNormalizedWeapons = new Set(
    Array.from(monitorFilters.hiddenWeaponTypes).map(normalizeWpn)
  );

  // Filtering — Blacklist semantics: each true rule REMOVES the item
  const checkItemFilters = useCallback((item: MonitorItem, ignoreSearch = false) => {
    if (!ignoreSearch && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      if (!item.name.toLowerCase().includes(q)) return false;
    }
    const f = monitorFilters;

    if (hiddenNormalizedWeapons.size > 0) {
      const itemWpnNormalized = normalizeWpn(item.weaponType);
      if (hiddenNormalizedWeapons.has(itemWpnNormalized)) return false;
    }
    if (f.hiddenRarities.has(item.rarity)) return false;

    if (f.hiddenCategories.has('stattrak') && item.isStatTrak) return false;
    if (f.hiddenCategories.has('souvenir') && item.isSouvenir) return false;
    const hasStickers = !!(item.stickers && item.stickers.length > 0);
    if (f.hiddenCategories.has('stickered') && hasStickers) return false;
    if (f.hiddenCategories.has('no-stickers') && !hasStickers) return false;
    const hasCharm = !!item.charm;
    if (f.hiddenCategories.has('charm') && hasCharm) return false;
    if (f.hiddenCategories.has('no-charm') && !hasCharm) return false;

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

    const cleanWpn = (item.weaponType || "").toLowerCase().replace(/^(charm|souvenir charm)\s*\|\s*/, '').trim();
    const cleanName = nameLower.replace(/^(charm|souvenir charm)\s*\|\s*/, '').trim();
    const isCharmItem = typeNameLower === 'charm' ||
      (item.weaponType || "").toLowerCase() === 'charm' ||
      nameLower.startsWith('charm |') ||
      nameLower.startsWith('souvenir charm |') ||
      CHARMS_SET.has(cleanWpn) ||
      CHARMS_SET.has(cleanName) ||
      (isNoWearItem && !isCase && !isCapsule && !isAgent && !isMusicKit && !isCollectible && item.paintSeed != null && item.paintSeed > 0);

    const isStickerCollectible = typeNameLower === 'sticker' ||
      (item.weaponType || "").toLowerCase() === 'sticker' ||
      (isNoWearItem && !isCase && !isCapsule && !isAgent && !isCharmItem && !isMusicKit && !isCollectible && nameLower.includes('sticker'));

    if (f.hiddenCategories.has('agents') && isAgent) return false;
    if (f.hiddenCategories.has('cases') && isCase) return false;
    if (f.hiddenCategories.has('containers') && isCapsule) return false;
    if (f.hiddenCategories.has('music-kits') && isMusicKit) return false;
    if (f.hiddenCategories.has('collectibles') && isCollectible) return false;
    if (f.hiddenCategories.has('patches') && isPatch) return false;
    if (f.hiddenCategories.has('stickers') && isStickerCollectible) return false;
    if (f.hiddenCategories.has('charms') && isCharmItem) return false;

    if (f.fixedPriceConfirmed || f.rangePriceConfirmed) {
      const minPrice = f.priceMin ? parseFloat(f.priceMin) : null;
      const maxPrice = f.priceMax ? parseFloat(f.priceMax) : null;
      if (minPrice !== null && !isNaN(minPrice) && item.price < minPrice) return false;
      if (maxPrice !== null && !isNaN(maxPrice) && item.price > maxPrice) return false;
    }

    if (f.hiddenWearTiers.size > 0) {
      const fl = item.float;
      const tier = fl < 0.07 ? 'fn' : fl < 0.15 ? 'mw' : fl < 0.38 ? 'ft' : fl < 0.45 ? 'ww' : 'bs';
      if (f.hiddenWearTiers.has(tier as any)) return false;
    }
    if (f.floatMinEnabled) {
      const v = parseFloat(f.floatMin);
      if (!isNaN(v) && item.float < v) return false;
    }
    if (f.floatMaxEnabled) {
      const v = parseFloat(f.floatMax);
      if (!isNaN(v) && item.float > v) return false;
    }

    if (item.stickers && item.stickers.length > 0) {
      for (const s of item.stickers) {
        const n = s.name.toLowerCase();
        if (f.blockStickerHolo && n.includes('holo')) return false;
        if (f.blockStickerFoil && n.includes('foil')) return false;
        if (f.blockStickerGold && n.includes('gold')) return false;
        if (f.blockStickerPaper && !n.includes('holo') && !n.includes('foil') && !n.includes('gold')) return false;
      }
    }

    if (f.keywords.length > 0) {
      const name = item.name.toLowerCase();
      const matchesAny = f.keywords.some(k => name.includes(k.toLowerCase()));
      if (f.keywordMode === 'block' && matchesAny) return false;
      if (f.keywordMode === 'allow' && !matchesAny) return false;
    }

    if (f.discountEnabled) {
      const pct = item.priceChangePercent;
      const minV = f.discountMin !== '' ? parseFloat(f.discountMin) : null;
      const maxV = f.discountMax !== '' ? parseFloat(f.discountMax) : null;
      if (minV !== null && !isNaN(minV) && pct < minV) return false;
      if (maxV !== null && !isNaN(maxV) && pct > maxV) return false;
    }

    if (priceMin.trim() !== '') {
      const minVal = parseFloat(priceMin);
      if (!isNaN(minVal) && item.price < minVal) return false;
    }
    if (priceMax.trim() !== '') {
      const maxVal = parseFloat(priceMax);
      if (!isNaN(maxVal) && item.price > maxVal) return false;
    }

    return true;
  }, [searchQuery, monitorFilters, hiddenNormalizedWeapons, priceMin, priceMax]);

  const filteredItems = useMemo(() => {
    const base = items.filter(item => checkItemFilters(item, false));
    return matchesOnly ? base.filter(item => Boolean(item.configName)) : base;
  }, [items, checkItemFilters, matchesOnly]);

  const sortedItems = useMemo(() => {
    if (sortBy === 'newest') return filteredItems;
    return [...filteredItems].sort((a, b) => {
      switch (sortBy) {
        case 'price-asc': return a.price - b.price;
        case 'price-desc': return b.price - a.price;
        case 'float-asc': return a.float - b.float;
        case 'float-desc': return b.float - a.float;
        default: return 0;
      }
    });
  }, [filteredItems, sortBy]);

  useEffect(() => {
    unfreezeCard();
  }, [sortBy, searchQuery, monitorFilters, priceMin, priceMax, matchesOnly, activeTab, unfreezeCard]);

  const displayedItems = useMemo(() => {
    const hasPinned = pinnedItemId && sortedItems.some(i => i.id === pinnedItemId);
    const baseLimit = hasPinned ? maxItems - 1 : maxItems;
    const unpinned = sortedItems.filter(i => i.id !== pinnedItemId);

    const slot = frozenSlotRef.current;
    if (!hoverFreeze || !frozenCardId || !slot) {
      return unpinned.slice(0, baseLimit);
    }

    // Single item hover freeze:
    // Lock the single hovered item (slot.id) at slot.index, while live items continue streaming into all other slots.
    const currentItem = items.find(i => i.id === slot.id) ?? slot.item;
    const rest = unpinned.filter(i => i.id !== slot.id);

    const targetIndex = Math.min(slot.index, Math.max(0, baseLimit - 1));
    const itemsBefore = rest.slice(0, targetIndex);
    const itemsAfterNeeded = Math.max(0, baseLimit - 1 - itemsBefore.length);
    const itemsAfter = rest.slice(targetIndex, targetIndex + itemsAfterNeeded);

    return [...itemsBefore, currentItem, ...itemsAfter];
  }, [sortedItems, pinnedItemId, maxItems, hoverFreeze, frozenCardId, items]);

  useEffect(() => {
    if (showScreenshots && screenshotMode === 'auto') {
      displayedItems.forEach((item) => {
        if (item.cs2ScreenshotId) {
          registerItemScreenshot(item.id, item.cs2ScreenshotId, Date.now());
        }
      });
    }
  }, [displayedItems, showScreenshots, screenshotMode]);

  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Telemetry cards per minute calculations
  useEffect(() => {
    const compute = () => {
      const now = Date.now();
      refreshLogRef.current = refreshLogRef.current.filter(e => now - e.t <= 60_000);
      let matchingCount = 0;
      for (const entry of refreshLogRef.current) {
        const matching = entry.items.filter(item => checkItemFilters(item, false));
        matchingCount += matching.length;
      }
      setCardsPerMinute(isBotRunning && isScannerPlaying ? matchingCount : 0);
      if (isBotRunning && isScannerPlaying) {
        const elapsed = Math.floor((now - sessionStartRef.current) / 1000);
        setElapsedSeconds(elapsed);
      } else {
        setElapsedSeconds(0);
      }
    };
    compute();
    const id = setInterval(compute, 1000);
    return () => clearInterval(id);
  }, [isBotRunning, isScannerPlaying, checkItemFilters]);

  useEffect(() => {
    if (!isBotRunning || !isScannerPlaying) {
      refreshLogRef.current = [];
      sessionStartRef.current = Date.now();
      setCardsPerMinute(0);
      setElapsedSeconds(0);
    } else {
      sessionStartRef.current = Date.now();
    }
  }, [isBotRunning, isScannerPlaying]);

  const activeTimeoutsRef = useRef<Map<string, number>>(new Map());
  const nextAvailableFetchTimeRef = useRef<number>(Date.now());

  const prevSettingsRef = useRef({
    normal: bidFetchIntervalNormal,
    hidden: bidFetchIntervalHidden,
    hiddenEnabled: bidFetchHiddenEnabled,
    mode: bidFetchMode
  });

  useEffect(() => {
    const prev = prevSettingsRef.current;
    if (
      prev.normal !== bidFetchIntervalNormal ||
      prev.hidden !== bidFetchIntervalHidden ||
      prev.hiddenEnabled !== bidFetchHiddenEnabled ||
      prev.mode !== bidFetchMode
    ) {
      // Clear timeouts on settings changes to reschedule immediately
      activeTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      activeTimeoutsRef.current.clear();
      prevItemsRef.current.clear(); // Force reschedule of all pending items
      nextAvailableFetchTimeRef.current = Date.now();

      prevSettingsRef.current = {
        normal: bidFetchIntervalNormal,
        hidden: bidFetchIntervalHidden,
        hiddenEnabled: bidFetchHiddenEnabled,
        mode: bidFetchMode
      };
    }
  }, [bidFetchIntervalNormal, bidFetchIntervalHidden, bidFetchHiddenEnabled, bidFetchMode]);

  // Clean up all timeouts on unmount
  useEffect(() => {
    return () => {
      activeTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      activeTimeoutsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!hasInitializedRef.current) {
      return;
    }

    // Clean up timeouts for items that are no longer present in the feed
    const currentIds = new Set(items.map(i => i.id));
    activeTimeoutsRef.current.forEach((timeoutId, id) => {
      if (!currentIds.has(id)) {
        window.clearTimeout(timeoutId);
        activeTimeoutsRef.current.delete(id);
      }
    });

    // Restore / Reschedule active timers for queue and independent modes
    const filteredIds = new Set(items.filter(item => checkItemFilters(item, true)).map(i => i.id));
    const newItems = items.filter(item => !prevItemsRef.current.has(item.id));

    if (bidFetchMode === 'queue') {
      // 1. First, restore timeouts for any items that already have bidFetchAt but no active timeout
      items.forEach(item => {
        if (item.bidFetchAt !== undefined && !activeTimeoutsRef.current.has(item.id)) {
          if (item.hasRealBid || item.isSold || item.loadingBid) return;
          const isDisplayed = filteredIds.has(item.id);
          if (!isDisplayed && !bidFetchHiddenEnabled) return;

          const delay = Math.max(0, item.bidFetchAt - Date.now());
          const timeoutId = window.setTimeout(async () => {
            activeTimeoutsRef.current.delete(item.id);
            const currentItem = itemsRef.current.find(i => i.id === item.id);
            if (currentItem && !currentItem.hasRealBid && !currentItem.isSold && !currentItem.loadingBid) {
              autoFetchBidPrice(item.id);
            }
          }, delay);
          activeTimeoutsRef.current.set(item.id, timeoutId);
        }
      });

      // 2. Identify items that need to be scheduled (are new, unscheduled, or paused)
      const newQueueItems = items.filter(item => {
        if (item.hasRealBid || item.isSold || item.loadingBid || item.bidFetchFailed) return false;
        const isDisplayed = filteredIds.has(item.id);
        if (!isDisplayed && !bidFetchHiddenEnabled) return false;

        const hasTime = item.bidFetchAt !== undefined;
        const hasTimeout = activeTimeoutsRef.current.has(item.id);
        const isPaused = item.bidFetchPaused === true;

        return (!hasTime && !hasTimeout) || isPaused;
      });

      if (newQueueItems.length > 0) {
        // Sort new queue items oldest first (index descending in items array)
        const itemsOrderMap = new Map(items.map((item, idx) => [item.id, idx]));
        newQueueItems.sort((a, b) => {
          const idxA = itemsOrderMap.get(a.id) ?? 0;
          const idxB = itemsOrderMap.get(b.id) ?? 0;
          return idxB - idxA;
        });

        // Use nextAvailableFetchTimeRef to track the end of the queue, ignoring any past queues or independent item schedules.
        let lastScheduledTime = Math.max(Date.now(), nextAvailableFetchTimeRef.current);

        const updates: Record<string, Partial<MonitorItem>> = {};

        newQueueItems.forEach(item => {
          const isDisplayed = filteredIds.has(item.id);
          const delay = isDisplayed ? bidFetchIntervalNormal : (bidFetchIntervalNormal === 0 ? 0 : bidFetchIntervalHidden);

          const targetTime = delay === 0 ? Date.now() : lastScheduledTime + delay * 1000;
          updates[item.id] = {
            bidFetchAt: targetTime,
            bidFetchPaused: undefined,
            bidFetchRemaining: undefined
          };
          if (delay > 0) {
            lastScheduledTime = targetTime;
          }
        });

        // Update the next available fetch time for the queue
        nextAvailableFetchTimeRef.current = lastScheduledTime;

        // Set timeouts for the new scheduled items
        newQueueItems.forEach(item => {
          const upd = updates[item.id];
          if (!upd || !upd.bidFetchAt) return;
          const targetTime = upd.bidFetchAt;

          const oldTimeoutId = activeTimeoutsRef.current.get(item.id);
          if (oldTimeoutId) {
            window.clearTimeout(oldTimeoutId);
          }

          const timeoutId = window.setTimeout(async () => {
            activeTimeoutsRef.current.delete(item.id);
            const currentItem = itemsRef.current.find(i => i.id === item.id);
            if (currentItem && !currentItem.hasRealBid && !currentItem.isSold && !currentItem.loadingBid) {
              autoFetchBidPrice(item.id);
            }
          }, Math.max(0, targetTime - Date.now()));

          activeTimeoutsRef.current.set(item.id, timeoutId);
        });

        // Apply state updates in a single batch
        setItems(prev => {
          return prev.map(item => {
            if (updates[item.id]) {
              return { ...item, ...updates[item.id] };
            }
            return item;
          });
        });
      }
    } else {
      // Independent Mode
      const updates: Record<string, Partial<MonitorItem>> = {};
      const timeoutsToSet: { id: string; delay: number }[] = [];

      items.forEach((item) => {
        if (item.hasRealBid || item.isSold || item.loadingBid || item.bidFetchFailed) return;
        const isDisplayed = filteredIds.has(item.id);
        if (!isDisplayed && !bidFetchHiddenEnabled) return;

        const hasTime = item.bidFetchAt !== undefined;
        const hasTimeout = activeTimeoutsRef.current.has(item.id);

        if (!hasTime && !hasTimeout) {
          const delay = isDisplayed ? bidFetchIntervalNormal : bidFetchIntervalHidden;
          const targetTime = Date.now() + delay * 1000;

          updates[item.id] = {
            bidFetchAt: targetTime,
            bidFetchPaused: undefined,
            bidFetchRemaining: undefined
          };
          timeoutsToSet.push({ id: item.id, delay: Math.max(0, targetTime - Date.now()) });
        } else if (item.bidFetchPaused) {
          const defaultDelay = (isDisplayed ? bidFetchIntervalNormal : bidFetchIntervalHidden) * 1000;
          const delay = item.bidFetchRemaining ?? defaultDelay;
          const targetTime = Date.now() + delay;

          updates[item.id] = {
            bidFetchAt: targetTime,
            bidFetchPaused: undefined,
            bidFetchRemaining: undefined
          };
          timeoutsToSet.push({ id: item.id, delay: Math.max(0, targetTime - Date.now()) });
        } else if (item.bidFetchAt) {
          if (!activeTimeoutsRef.current.has(item.id)) {
            const delay = Math.max(0, item.bidFetchAt - Date.now());
            timeoutsToSet.push({ id: item.id, delay });
          }
        }
      });

      // Set the timeouts
      timeoutsToSet.forEach(({ id, delay }) => {
        const oldTimeoutId = activeTimeoutsRef.current.get(id);
        if (oldTimeoutId) {
          window.clearTimeout(oldTimeoutId);
        }

        const timeoutId = window.setTimeout(async () => {
          activeTimeoutsRef.current.delete(id);
          const currentItem = itemsRef.current.find(i => i.id === id);
          if (currentItem && !currentItem.hasRealBid && !currentItem.isSold && !currentItem.loadingBid) {
            autoFetchBidPrice(id);
          }
        }, delay);

        activeTimeoutsRef.current.set(id, timeoutId);
      });

      // Apply state updates in a single batch
      if (Object.keys(updates).length > 0) {
        setItems(prev => {
          return prev.map(item => {
            if (updates[item.id]) {
              return { ...item, ...updates[item.id] };
            }
            return item;
          });
        });
      }
    }

    // Update the set of previous item IDs
    prevItemsRef.current = new Set(items.map(i => i.id));
  }, [
    items,
    checkItemFilters,
    isBotRunning,
    isScannerPlaying,
    bidFetchIntervalNormal,
    bidFetchHiddenEnabled,
    bidFetchIntervalHidden,
    bidFetchMode,
    autoFetchBidPrice,
    handleUpdateItem
  ]);

  return (
    <div className={`h-full min-h-0 overflow-hidden relative flex flex-col transition-all duration-300 ease-in-out pb-0 lg:pb-0 ${sidebarVisible ? 'px-4 lg:px-5' : 'px-1.5 lg:px-2'
      } ${toolbarHidden ? 'pt-0 lg:pt-0' : sidebarVisible ? 'pt-1.5 lg:pt-0.5' : 'pt-1 lg:pt-0.5'
      }`}>
      <div className={`mx-auto space-y-2 flex-1 min-h-0 flex flex-col w-full relative transition-all duration-300 ease-in-out ${sidebarVisible ? 'max-w-[1800px]' : 'max-w-[3840px]'
        }`}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col">

          {!toolbarHidden && activeTab === "settings" && (
            <div className="animate-in slide-in-from-top-2 duration-200">
              <LiveTapeBar
                filters={monitorFilters}
                onFiltersChange={setMonitorFilters}
                onBackToScanner={() => setActiveTab("all")}
              />
            </div>
          )}

          {!toolbarHidden && activeTab !== "settings" && (
            <div className="animate-in fade-in slide-in-from-top-1 duration-200 relative">
              {/* Overlays command bar — absolutely positioned to match OverlaysShell left panel width */}
              {activeTab === 'overlays' && overlayMode === 'icons' && (
                <div className="absolute left-0 top-[6.4px] h-[34.2px] w-[35%] min-w-[180px] z-20 pointer-events-auto">
                  <OverlayCommandBar
                    fillWidth
                    panelMode={overlayPanelMode}
                    onPanelModeChange={setOverlayPanelMode}
                    totalCount={overlays.length}
                    enabledCount={overlays.filter(o => o.enabled).length}
                    searchQuery={overlaySearchQuery}
                    onSearchQueryChange={setOverlaySearchQuery}
                    onEnableAll={() => overlayActionsRef.current?.enableAll()}
                    onDisableAll={() => overlayActionsRef.current?.disableAll()}
                    onSort={() => overlayActionsRef.current?.sortAZ()}
                    onCollapseAll={() => overlayActionsRef.current?.collapseAll()}
                    onNewSkin={() => overlayActionsRef.current?.openAddDialog()}
                  />
                </div>
              )}

              <div className="flex items-center h-[42px] 2xl:h-[51.4px] gap-[3px] 2xl:gap-[4.3px] flex-nowrap w-full overflow-hidden">
                {activeTab !== 'overlays' && (
                  <div className="flex items-center gap-[4px] 2xl:gap-[10.7px] mr-[2px] 2xl:mr-[4.3px] shrink-0 h-[30px] 2xl:h-[34.2px] rounded-md border border-border/40 bg-background/40 px-[4px] 2xl:px-[8.6px] leading-none">
                    <Activity
                      className={`h-[18px] 2xl:h-[22.5px] w-[18px] 2xl:w-[22.5px] shrink-0 transition-colors ${isBotRunning && isScannerPlaying
                        ? 'text-accent drop-shadow-[0_0_8px_hsl(var(--accent)/0.8)] animate-pulse'
                        : 'text-destructive drop-shadow-[0_0_8px_hsl(var(--destructive)/0.8)] animate-pulse'
                        }`}
                      strokeWidth={2.6}
                    />
                    <span className={`text-[10px] 2xl:text-[13.3px] font-semibold uppercase tracking-[0.1em] 2xl:tracking-[0.18em] leading-none flex items-center transition-colors ${isBotRunning && isScannerPlaying
                      ? 'text-accent drop-shadow-[0_0_6px_hsl(var(--accent)/0.5)]'
                      : 'text-destructive drop-shadow-[0_0_6px_hsl(var(--destructive)/0.5)]'
                      }`}>Live Scanner</span>
                    <span className="self-stretch w-px bg-border/60 mx-[2px] 2xl:mx-[4.3px]" />
                    <MonitorStatusBar />
                  </div>
                )}

                <TooltipProvider delayDuration={0}>
                  {activeTab === 'overlays' ? (
                    <div className="flex items-center justify-center flex-1 min-w-0 h-[34.2px] pl-[35%] [&>nav]:ml-[13px]">
                      <nav className="flex items-stretch h-[34.2px] gap-[26px] shrink-0">
                        <OverlayWorkspaceTab active={overlayMode === 'icons'} icon={Layers} label="Icons" onClick={() => setOverlayMode('icons')} />
                        <OverlayWorkspaceTab active={overlayMode === 'frame'} icon={FrameIcon} label="Frame" onClick={() => setOverlayMode('frame')} />
                      </nav>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-[2px] 2xl:gap-[4.3px] shrink-0">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => setIsScannerPlaying(prev => !prev)}
                              disabled={!isBotRunning}
                              className={`h-[30px] w-[30px] 2xl:h-[34.2px] 2xl:w-[34.2px] flex items-center justify-center rounded-md border border-border/40 bg-background/40 hover:bg-background/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${isScannerPlaying && isBotRunning ? 'text-accent' : 'text-destructive'
                                }`}
                            >
                              {isScannerPlaying && isBotRunning ? (
                                <Pause className="h-[14px] w-[14px] 2xl:h-[17px] 2xl:w-[17px]" />
                              ) : (
                                <Play className="h-[14px] w-[14px] 2xl:h-[17px] 2xl:w-[17px]" />
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="text-xs">
                            {isScannerPlaying ? 'Pause live scanner' : 'Resume live scanner'}
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => setSoundEnabled(v => !v)}
                              className={`h-[30px] w-[30px] 2xl:h-[34.2px] 2xl:w-[34.2px] flex items-center justify-center rounded-md border border-border/40 bg-background/40 hover:bg-background/60 transition-colors ${soundEnabled ? 'text-fuchsia-300' : 'text-fuchsia-400/60 hover:text-fuchsia-300'
                                }`}
                              aria-label={soundEnabled ? 'Mute sound' : 'Enable sound'}
                            >
                              {soundEnabled ? <Volume2 className="h-[14px] w-[14px] 2xl:h-[17px] 2xl:w-[17px]" strokeWidth={1.8} /> : <VolumeX className="h-[14px] w-[14px] 2xl:h-[17px] 2xl:w-[17px]" strokeWidth={1.8} />}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="text-xs">Sound {soundEnabled ? 'ON' : 'OFF'}</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => { setIsRefreshing(true); fetchLiveItems(); setTimeout(() => setIsRefreshing(false), 500); }}
                              className="h-[30px] w-[30px] 2xl:h-[34.2px] 2xl:w-[34.2px] flex items-center justify-center rounded-md border border-border/40 bg-background/40 text-cyan-400 hover:bg-background/60 hover:text-cyan-300 transition-colors"
                            >
                              <RefreshCw className={`h-[14px] w-[14px] 2xl:h-[17px] 2xl:w-[17px] transition-transform duration-500 ${isRefreshing ? 'animate-spin' : ''}`} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="text-xs">Refresh feed</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => setBuyLocked(prev => !prev)}
                              className={`h-[30px] w-[30px] 2xl:h-[34.2px] 2xl:w-[34.2px] flex items-center justify-center rounded-md border border-border/40 bg-background/40 hover:bg-background/60 transition-colors ${buyLocked ? 'text-destructive' : 'text-accent'
                                }`}
                            >
                              {buyLocked ? <Lock className="h-[14px] w-[14px] 2xl:h-[17px] 2xl:w-[17px]" /> : <LockOpen className="h-[14px] w-[14px] 2xl:h-[17px] 2xl:w-[17px]" />}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="text-xs">{buyLocked ? 'Buy locked' : 'Instant buy'}</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => { setShowSold(prev => { if (!prev) setSoldItems([]); return !prev; }); }}
                              className={`h-[30px] w-[30px] 2xl:h-[34.2px] 2xl:w-[34.2px] flex items-center justify-center rounded-md border border-border/40 bg-background/40 hover:bg-background/60 transition-colors ${showSold ? 'text-amber-300' : 'text-amber-400/70 hover:text-amber-300'
                                }`}
                            >
                              <History className="h-[14px] w-[14px] 2xl:h-[17px] 2xl:w-[17px]" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="text-xs">{showSold ? 'Hide sold' : 'Show sold'}</TooltipContent>
                        </Tooltip>

                        {/* Hover-freeze — hold a card still under the cursor while the feed runs on */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={toggleHoverFreeze}
                              className={`relative h-[30px] w-[30px] 2xl:h-[34.2px] 2xl:w-[34.2px] flex items-center justify-center rounded-md border border-border/40 bg-background/40 hover:bg-background/60 transition-colors ${hoverFreeze ? 'text-teal-300' : 'text-teal-400/60 hover:text-teal-300'
                                }`}
                              aria-label={hoverFreeze ? 'Disable hover freeze' : 'Enable hover freeze'}
                            >
                              <MousePointer2 className="h-[14px] w-[14px] 2xl:h-[17px] 2xl:w-[17px]" strokeWidth={1.9} />
                              {isHoverFrozen && (
                                <span className="absolute -top-[3px] -right-[3px] flex h-[7px] w-[7px]">
                                  <span className="absolute inline-flex h-full w-full rounded-full bg-teal-300 opacity-70 animate-ping" />
                                  <span className="relative inline-flex h-[7px] w-[7px] rounded-full bg-teal-300 shadow-[0_0_6px_hsl(174_72%_56%/0.9)]" />
                                </span>
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="text-xs">
                            {hoverFreeze ? 'Hover freeze ON — cards hold under cursor' : 'Hover freeze OFF'}
                          </TooltipContent>
                        </Tooltip>

                        {/* Matches-only — keep just the listings that hit a target config */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={toggleMatchesOnly}
                              className={`relative h-[30px] w-[30px] 2xl:h-[34.2px] 2xl:w-[34.2px] flex items-center justify-center rounded-md border border-border/40 bg-background/40 hover:bg-background/60 transition-all duration-200 ${matchesOnly ? 'text-fuchsia-300' : 'text-fuchsia-400/60 hover:text-fuchsia-300'
                                }`}
                              aria-label={matchesOnly ? 'Show all listings' : 'Show only target matches'}
                            >
                              <Star className={`h-[14px] w-[14px] 2xl:h-[17px] 2xl:w-[17px] transition-transform duration-300 ${matchesOnly ? 'fill-current scale-110' : ''}`} strokeWidth={1.9} />
                              {matchesOnly && (
                                <span className="absolute -top-[3px] -right-[3px] h-[7px] w-[7px] rounded-full bg-fuchsia-400 shadow-[0_0_6px_hsl(292_84%_61%/0.9)]" />
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="text-xs">
                            {matchesOnly ? 'Matches only — showing target hits' : 'Show only target matches'}
                          </TooltipContent>
                        </Tooltip>

                        {/* Price range filter — narrows the feed alongside search */}
                        <Popover>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <PopoverTrigger asChild>
                                <button
                                  className={`relative h-[30px] w-[30px] 2xl:h-[34.2px] 2xl:w-[34.2px] flex items-center justify-center rounded-md border bg-background/40 hover:bg-background/60 transition-colors ${priceFilterActive
                                    ? 'border-emerald-500/50 text-emerald-300'
                                    : 'border-border/40 text-emerald-400/60 hover:text-emerald-300'
                                    }`}
                                  aria-label="Price filter"
                                >
                                  <DollarSign className="h-[14px] w-[14px] 2xl:h-[17px] 2xl:w-[17px]" strokeWidth={2.1} />
                                  {priceFilterActive && (
                                    <span className="absolute -top-[3px] -right-[3px] h-[7px] w-[7px] rounded-full bg-emerald-400 shadow-[0_0_6px_hsl(160_84%_45%/0.9)]" />
                                  )}
                                </button>
                              </PopoverTrigger>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">
                              {priceFilterActive
                                ? `Price ${priceMin || '0'}–${priceMax || '∞'}`
                                : 'Filter by price'}
                            </TooltipContent>
                          </Tooltip>
                          <PopoverContent align="start" sideOffset={6} className="w-64 p-0 bg-popover/95 backdrop-blur border-border/60 overflow-hidden">
                            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/50 bg-gradient-to-r from-emerald-500/10 to-transparent">
                              <DollarSign className="h-3.5 w-3.5 text-emerald-300" />
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-200">Price Range</span>
                              <div className="ml-auto flex items-center gap-1">
                                <button
                                  onClick={() => { updatePriceMin(""); updatePriceMax(""); }}
                                  disabled={!priceFilterActive}
                                  title="Reset price filter"
                                  className="inline-flex items-center gap-1 h-[22px] px-2 rounded-md border border-border/50 bg-background/40 text-[10px] font-medium text-muted-foreground hover:text-rose-300 hover:border-rose-500/40 hover:bg-rose-500/10 transition-colors disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:text-muted-foreground disabled:hover:border-border/50 disabled:hover:bg-background/40"
                                >
                                  <X className="h-3 w-3" />
                                  Reset
                                </button>
                                <button
                                  onClick={() => setEditingPresets(v => !v)}
                                  title="Edit quick ranges"
                                  className={`h-[22px] w-[22px] inline-flex items-center justify-center rounded-md border transition-colors ${editingPresets
                                    ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                                    : 'border-border/50 bg-background/40 text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                            <div className="p-3 space-y-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 flex items-center h-8 rounded-md border border-border/50 bg-background/50 focus-within:border-emerald-500/50 transition-colors">
                                  <span className="pl-2.5 pr-1 text-[11px] text-muted-foreground">$</span>
                                  <input
                                    type="number" min={0} inputMode="decimal" placeholder="Min"
                                    value={priceMin}
                                    onChange={(e) => updatePriceMin(e.target.value)}
                                    className="w-full h-full bg-transparent pr-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                </div>
                                <span className="text-muted-foreground text-xs">—</span>
                                <div className="flex-1 flex items-center h-8 rounded-md border border-border/50 bg-background/50 focus-within:border-emerald-500/50 transition-colors">
                                  <span className="pl-2.5 pr-1 text-[11px] text-muted-foreground">$</span>
                                  <input
                                    type="number" min={0} inputMode="decimal" placeholder="Max"
                                    value={priceMax}
                                    onChange={(e) => updatePriceMax(e.target.value)}
                                    className="w-full h-full bg-transparent pr-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                </div>
                              </div>
                              {!editingPresets ? (
                                <>
                                  <div className="flex flex-wrap gap-1.5">
                                    {pricePresets.map((p, i) => {
                                      const active = priceMin === p.min && priceMax === p.max;
                                      return (
                                        <button
                                          key={i}
                                          onClick={() => { updatePriceMin(p.min); updatePriceMax(p.max); }}
                                          className={`h-6 px-2 rounded-md border text-[10px] font-mono transition-colors ${active
                                            ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                                            : 'border-border/50 bg-background/40 text-muted-foreground hover:text-foreground hover:border-emerald-500/30'
                                            }`}
                                        >
                                          {presetLabel(p)}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                                    Combines with search — both narrow the live feed.
                                  </p>
                                </>
                              ) : (
                                <div className="space-y-2">
                                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Quick ranges</p>
                                  {pricePresets.map((p, i) => (
                                    <div key={i} className="flex items-center gap-1.5">
                                      <input
                                        type="number" min={0} placeholder="min" value={p.min}
                                        onChange={(e) => savePricePresets(pricePresets.map((x, j) => j === i ? { ...x, min: e.target.value } : x))}
                                        className="w-full h-7 rounded-md border border-border/50 bg-background/50 px-2 text-[11px] font-mono text-foreground placeholder:text-muted-foreground/45 outline-none focus:border-emerald-500/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      />
                                      <span className="text-muted-foreground text-[10px]">—</span>
                                      <input
                                        type="number" min={0} placeholder="max" value={p.max}
                                        onChange={(e) => savePricePresets(pricePresets.map((x, j) => j === i ? { ...x, max: e.target.value } : x))}
                                        className="w-full h-7 rounded-md border border-border/50 bg-background/50 px-2 text-[11px] font-mono text-foreground placeholder:text-muted-foreground/45 outline-none focus:border-emerald-500/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      />
                                      <span className="w-[52px] shrink-0 text-right text-[10px] font-mono text-emerald-300/80">{presetLabel(p)}</span>
                                      <button
                                        onClick={() => savePricePresets(pricePresets.filter((_, j) => j !== i))}
                                        title="Remove"
                                        className="h-6 w-6 shrink-0 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </div>
                                  ))}
                                  <div className="flex items-center justify-between pt-0.5">
                                    <button
                                      onClick={() => savePricePresets(DEFAULT_PRICE_PRESETS)}
                                      className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                      Restore defaults
                                    </button>
                                    {pricePresets.length < 8 && (
                                      <button
                                        onClick={() => savePricePresets([...pricePresets, { min: "", max: "" }])}
                                        className="inline-flex items-center gap-1 h-6 px-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-[10px] hover:bg-emerald-500/20 transition-colors"
                                      >
                                        <Plus className="h-3 w-3" /> Add range
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>

                        <Popover>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <PopoverTrigger asChild>
                                <button
                                  className="h-[30px] w-[30px] 2xl:h-[34.2px] 2xl:w-[34.2px] flex items-center justify-center rounded-md border border-border/40 bg-background/40 text-violet-400/70 hover:text-violet-300 hover:bg-background/60 data-[state=open]:text-violet-300 transition-colors"
                                >
                                  <SettingsIcon className="h-[14px] w-[14px] 2xl:h-[17px] 2xl:w-[17px]" />
                                </button>
                              </PopoverTrigger>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">Scanner settings</TooltipContent>
                          </Tooltip>
                          <PopoverContent align="end" sideOffset={6} className="w-72 max-h-[80vh] flex flex-col p-0 bg-popover/95 backdrop-blur border-border/60 overflow-hidden">
                            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/50 bg-gradient-to-r from-violet-500/10 to-transparent shrink-0">
                              <SettingsIcon className="h-3.5 w-3.5 text-violet-300" />
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-violet-200">Scanner Settings</span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-thin">
                              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-0.5">
                                Skin image settings
                              </div>

                              {/* Toggle 1: Standard Steam Images */}
                              <button
                                onClick={() => setShowInGameImages(prev => !prev)}
                                className={`w-full flex items-start gap-2.5 px-2.5 py-2 rounded-md border text-left transition-all ${showInGameImages
                                    ? 'border-violet-400/60 bg-violet-500/15 shadow-[0_0_10px_rgba(139,92,246,0.18)]'
                                    : 'border-border/50 bg-muted/10 hover:border-violet-500/40 hover:bg-violet-500/5'
                                  }`}
                              >
                                <div className={`mt-0.5 h-4 w-4 rounded-[3px] border flex items-center justify-center shrink-0 transition-colors ${showInGameImages ? 'bg-violet-500 border-violet-400' : 'border-border/70 bg-background/40'
                                  }`}>
                                  {showInGameImages && (
                                    <svg viewBox="0 0 12 12" className="h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="2 6.5 5 9.5 10 3" />
                                    </svg>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <ImageIcon className={`h-3 w-3 ${showInGameImages ? 'text-violet-300' : 'text-muted-foreground'}`} />
                                    <span className={`text-xs font-semibold ${showInGameImages ? 'text-violet-100' : 'text-foreground'}`}>In-game (Steam) images</span>
                                  </div>
                                  <div className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                                    Show standard Steam skin preview images on scanner cards.
                                  </div>
                                </div>
                              </button>

                              {/* Toggle 2: CS2 3D Screenshots */}
                              <div className={`w-full rounded-md border transition-all ${showScreenshots
                                  ? 'border-violet-400/60 bg-violet-500/15 shadow-[0_0_10px_rgba(139,92,246,0.18)] p-2.5 space-y-2'
                                  : 'border-border/50 bg-muted/10 hover:border-violet-500/40 hover:bg-violet-500/5 p-2.5'
                                }`}>
                                <button
                                  onClick={() => setShowScreenshots(prev => !prev)}
                                  className="w-full flex items-start gap-2.5 text-left transition-all"
                                >
                                  <div className={`mt-0.5 h-4 w-4 rounded-[3px] border flex items-center justify-center shrink-0 transition-colors ${showScreenshots ? 'bg-violet-500 border-violet-400' : 'border-border/70 bg-background/40'
                                    }`}>
                                    {showScreenshots && (
                                      <svg viewBox="0 0 12 12" className="h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="2 6.5 5 9.5 10 3" />
                                      </svg>
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                      <ImagePlus className={`h-3 w-3 ${showScreenshots ? 'text-violet-300' : 'text-muted-foreground'}`} />
                                      <span className={`text-xs font-semibold ${showScreenshots ? 'text-violet-100' : 'text-foreground'}`}>CS2 3D Screenshots</span>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                                      Show generated in-game 3D screenshots from CSFloat.
                                    </div>
                                  </div>
                                </button>

                                {showScreenshots && (
                                  <div className="space-y-1 mt-1 animate-in fade-in duration-200">
                                    <div className="flex items-center justify-between bg-black/30 border border-violet-500/20 rounded p-1.5">
                                      <span className="text-[10px] font-medium text-violet-200/90 ml-1">Loading Mode:</span>
                                      <div className="flex gap-1">
                                        {(['auto', 'manual'] as const).map((mode) => (
                                          <button
                                            key={mode}
                                            onClick={() => {
                                              if (mode === 'manual') {
                                                clearLoadedManualScreenshots();
                                              }
                                              setScreenshotMode(mode);
                                            }}
                                            className={`text-[9.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded leading-none transition-all ${screenshotMode === mode
                                                ? 'bg-violet-500 text-white shadow'
                                                : 'text-violet-300/60 hover:text-violet-200 hover:bg-violet-500/10'
                                              }`}
                                          >
                                            {mode === 'auto' ? 'Auto' : 'Manual'}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="flex items-center justify-between bg-black/30 border border-violet-500/20 rounded p-1.5">
                                      <div className="flex items-center gap-1 ml-1">
                                        <Clock className="h-3 w-3 text-violet-400" />
                                        <span className="text-[10px] font-medium text-violet-200/90">Display Duration:</span>
                                      </div>
                                      <div className="flex gap-1 items-center">
                                        {[1, 2, 5].map((ttl) => (
                                          <button
                                            key={ttl}
                                            onClick={() => setScreenshotTtlMinutes(ttl)}
                                            className={`text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded leading-none transition-all ${screenshotTtlMinutes === ttl
                                                ? 'bg-violet-500 text-white shadow'
                                                : 'text-violet-300/60 hover:text-violet-200 hover:bg-violet-500/10'
                                              }`}
                                          >
                                            {ttl}m
                                          </button>
                                        ))}
                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <button
                                              className={`text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded leading-none transition-all flex items-center justify-center max-w-[54px] truncate ${!([1, 2, 5].includes(screenshotTtlMinutes))
                                                  ? 'bg-violet-500 text-white shadow'
                                                  : 'text-violet-300/60 hover:text-violet-200 hover:bg-violet-500/10'
                                                }`}
                                            >
                                              {screenshotTtlMinutes === 0 ? (
                                                <span className="font-mono text-xs font-bold leading-none">∞</span>
                                              ) : ![1, 2, 5].includes(screenshotTtlMinutes) ? (
                                                <span className="truncate">{screenshotTtlMinutes > 999 ? '999m+' : `${screenshotTtlMinutes}m`}</span>
                                              ) : (
                                                'Custom'
                                              )}
                                            </button>
                                          </PopoverTrigger>
                                          <PopoverContent side="top" align="end" className="p-0 border-0 bg-transparent shadow-none z-50">
                                            <CustomDurationPopoverContent
                                              screenshotTtlMinutes={screenshotTtlMinutes}
                                              setScreenshotTtlMinutes={setScreenshotTtlMinutes}
                                            />
                                          </PopoverContent>
                                        </Popover>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="h-px bg-border/50 my-1" />

                              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-0.5 flex items-center gap-1.5">
                                <DollarSign className="h-3.5 w-3.5 text-violet-300" />
                                <span>Buy Order Auto-Fetch</span>
                              </div>

                              <div className="px-0.5 space-y-3">
                                <div className="space-y-1">
                                  <label className="text-[10.5px] text-muted-foreground">Fetch Mode</label>
                                  <Select
                                    value={bidFetchMode}
                                    onValueChange={(v: 'independent' | 'queue') => setBidFetchMode(v)}
                                  >
                                    <SelectTrigger className="h-8 text-[11px] bg-background/40 border-border/40 focus:ring-0 focus:ring-offset-0 text-foreground">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-popover border-border/60">
                                      <SelectItem value="independent" className="text-[11px] focus:bg-violet-500/15 focus:text-violet-200">
                                        Independent (Gradual)
                                      </SelectItem>
                                      <SelectItem value="queue" className="text-[11px] focus:bg-violet-500/15 focus:text-violet-200">
                                        Sequential Queue
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">Displayed Delay</span>
                                    <span className="font-mono font-medium text-violet-300 tabular-nums">{bidFetchIntervalNormal}s</span>
                                  </div>
                                  <Slider
                                    value={[bidFetchIntervalNormal]}
                                    onValueChange={([v]) => setBidFetchIntervalNormal(v)}
                                    min={0}
                                    max={90}
                                    step={1}
                                  />
                                </div>

                                <div className="space-y-2 pt-0.5">
                                  <div className="flex items-center justify-between">
                                    <label htmlFor="bid-fetch-hidden" className="text-[11px] text-muted-foreground flex items-center gap-2 cursor-pointer select-none">
                                      <Checkbox
                                        id="bid-fetch-hidden"
                                        checked={bidFetchHiddenEnabled}
                                        onCheckedChange={(checked) => setBidFetchHiddenEnabled(checked === true)}
                                        className="border-border/60 data-[state=checked]:bg-violet-500 data-[state=checked]:border-violet-400"
                                      />
                                      <span>Fetch Hidden Items</span>
                                    </label>
                                  </div>

                                  <div className={cn("space-y-1.5 transition-all duration-200", !bidFetchHiddenEnabled && "opacity-40 pointer-events-none")}>
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="text-muted-foreground">Hidden Delay</span>
                                      <span className="font-mono font-medium text-violet-300 tabular-nums">{bidFetchIntervalHidden}s</span>
                                    </div>
                                    <Slider
                                      value={[bidFetchIntervalHidden]}
                                      onValueChange={([v]) => setBidFetchIntervalHidden(v)}
                                      min={90}
                                      max={300}
                                      step={5}
                                      disabled={!bidFetchHiddenEnabled}
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="h-px bg-border/50 my-1" />

                              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-0.5 flex items-center gap-1.5">
                                <DollarSign className="h-3.5 w-3.5 text-violet-300" />
                                <span>Buy Button Price Difference</span>
                              </div>

                              <div className="px-0.5 space-y-1.5">
                                <label className="text-[10.5px] text-muted-foreground">Calculate Difference By</label>
                                <Select
                                  value={priceDiffRef}
                                  onValueChange={(v: 'ask' | 'bid') => setPriceDiffRef(v)}
                                >
                                  <SelectTrigger className="h-8 text-[11px] bg-background/40 border-border/40 focus:ring-0 focus:ring-offset-0 text-foreground">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-popover border-border/60">
                                    <SelectItem value="ask" className="text-[11px] focus:bg-violet-500/15 focus:text-violet-200">
                                      Ask Price (Lowest Listing)
                                    </SelectItem>
                                    <SelectItem value="bid" className="text-[11px] focus:bg-violet-500/15 focus:text-violet-200">
                                      Bid Price (Highest Buy Order)
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="px-0.5 space-y-1.5 pt-0.5">
                                <label htmlFor="include-charm-price" className="text-[11px] text-muted-foreground flex items-center gap-2 cursor-pointer select-none">
                                  <Checkbox
                                    id="include-charm-price"
                                    checked={includeCharmPrice}
                                    onCheckedChange={(checked) => setIncludeCharmPrice(checked === true)}
                                    className="border-border/60 data-[state=checked]:bg-violet-500 data-[state=checked]:border-violet-400"
                                  />
                                  <span>Include Charm Price in Diff</span>
                                </label>
                                <p className="text-[9.5px] text-muted-foreground/70 leading-tight">Add the attached charm's value to the Bid/Ask baseline when calculating difference.</p>
                              </div>

                              <div className="h-px bg-border/50 my-1" />

                              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-0.5">
                                Grid layout
                              </div>

                              <div className="px-0.5 space-y-1.5">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground flex items-center gap-1.5"><Columns3 className="h-3 w-3" /> Columns</span>
                                  <span className={`font-mono font-medium tabular-nums ${gridColumns === 8 ? 'text-muted-foreground/70' : 'text-violet-300'}`}>{gridColumns}</span>
                                </div>
                                <Slider value={[gridColumns]} onValueChange={([v]) => setGridColumns(v)} min={5} max={11} step={1} />
                                <p className="text-[9.5px] text-muted-foreground/70 leading-tight">Items per row — fewer = larger cards, more = denser grid.</p>
                              </div>

                              <div className="px-0.5 space-y-1.5 pt-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground flex items-center gap-1.5"><ImageIcon className="h-3 w-3" /> Image Size</span>
                                  <span className={`font-mono font-medium tabular-nums ${imageScale === 100 ? 'text-muted-foreground/70' : 'text-violet-300'}`}>{imageScale}%</span>
                                </div>
                                <Slider value={[imageScale]} onValueChange={([v]) => setImageScale(v)} min={50} max={150} step={5} />
                                <p className="text-[9.5px] text-muted-foreground/70 leading-tight">Background expands upward only — card height stays constant.</p>
                              </div>

                              <div className="px-0.5 space-y-1.5 pt-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground flex items-center gap-1.5"><Layers className="h-3 w-3" /> Rarity Background Height</span>
                                  <span className={`font-mono font-medium tabular-nums ${rarityColorHeight === 116 ? 'text-muted-foreground/70' : 'text-violet-300'}`}>{rarityColorHeight}px</span>
                                </div>
                                <Slider value={[rarityColorHeight]} onValueChange={([v]) => setRarityColorHeight(v)} min={80} max={180} step={1} />
                                <p className="text-[9.5px] text-muted-foreground/70 leading-tight">Adjusts the height of the rarity gradient background container inside the card.</p>
                              </div>

                              <div className="px-0.5 space-y-1.5 pt-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground flex items-center gap-1.5"><Layers className="h-3 w-3" /> Max Items</span>
                                  <span className="font-mono font-medium text-violet-300">{maxItems}</span>
                                </div>
                                <Slider value={[maxItems]} onValueChange={([v]) => setMaxItems(v)} min={50} max={1500} step={50} />
                                <p className="text-[9.5px] text-muted-foreground/70 leading-tight">Maximum number of recent listings to keep in feed.</p>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="flex items-stretch h-[30px] 2xl:h-[34.2px] rounded-md border border-border/40 bg-background/40 overflow-hidden focus-within:border-border/60 transition-colors flex-1 min-w-[100px] max-w-[360px]">
                        <div
                          className={`h-full w-[30px] 2xl:w-[34.2px] flex items-center justify-center border-r border-border/40 ${searchQuery ? 'text-sky-300' : 'text-sky-400/70'
                            }`}
                          aria-hidden="true"
                        >
                          <Search className="h-[14px] w-[14px] 2xl:h-[17px] 2xl:w-[17px]" strokeWidth={1.8} />
                        </div>
                        <div className="relative flex-1">
                          <Input
                            ref={searchInputRef}
                            value={searchQuery}
                            onChange={(e) => {
                              const v = e.target.value
                                .replace(/[<>]/g, "")
                                .replace(/[\x00-\x1F\x7F]/g, "")
                                .replace(/['"`;\\]/g, "")
                                .replace(/--/g, "")
                                .replace(/\/\*/g, "")
                                .replace(/\*\//g, "");
                              setSearchQuery(v.slice(0, 30));
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') setSearchQuery("");
                            }}
                            maxLength={30}
                            placeholder="Search market…"
                            className="h-full w-full pl-[5px] 2xl:pl-[8.6px] pr-[30px] 2xl:pr-[51.3px] text-[10px] 2xl:text-[11.8px] rounded-none border-0 bg-transparent placeholder:text-muted-foreground/50 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-0 text-foreground"
                          />
                          <span className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-[8.5px] 2xl:text-[9.6px] font-medium tabular-nums text-sky-400/70 select-none transition-[right] duration-200 ${searchQuery ? 'right-[20px] 2xl:right-[25.7px]' : 'right-[5px] 2xl:right-[8.6px]'}`}>
                            {searchQuery.length}/30
                          </span>
                          {searchQuery && (
                            <button
                              onClick={() => setSearchQuery("")}
                              className="absolute right-[5px] 2xl:right-[6.4px] top-1/2 -translate-y-1/2 h-[14px] 2xl:h-[17px] w-[14px] 2xl:w-[17px] flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                              aria-label="Clear search"
                            >
                              <X className="h-[11px] 2xl:h-[13px] w-[11px] 2xl:w-[13px]" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center shrink-0 flex-1 min-w-[85px] 2xl:min-w-[110px] max-w-[130px] 2xl:max-w-[150px] h-[30px] 2xl:h-[34.2px]">
                        <TooltipProvider>
                          <Tooltip delayDuration={200}>
                            <TooltipTrigger asChild>
                              <div
                                className="flex items-center justify-between gap-1.5 2xl:gap-2 px-2 2xl:px-2.5 h-full w-full rounded-md bg-background/40 hover:bg-background/60 border border-border/40 hover:border-border/60 transition-colors overflow-hidden cursor-help shadow-xs"
                              >
                                <div className="flex items-end gap-[1.5px] 2xl:gap-[2px] h-[14px] 2xl:h-[16px] flex-1 min-w-0 overflow-hidden py-[1px]">
                                  {[
                                    0.35, 0.5, 0.75, 0.45, 0.85, 0.6, 0.95, 0.7, 0.4, 0.8, 0.55, 0.9, 0.65, 0.5
                                  ].map((h, i) => (
                                    <span
                                      key={i}
                                      className={`flex-1 rounded-[1px] transition-all duration-300 ${isBotRunning && isScannerPlaying
                                          ? 'bg-emerald-400/90 shadow-[0_0_4px_rgba(52,211,153,0.4)]'
                                          : 'bg-muted-foreground/25'
                                        }`}
                                      style={{
                                        height: `${Math.max(h * 100, 20)}%`,
                                        animation: isBotRunning && isScannerPlaying ? `pulse 1.2s ease-in-out ${i * 0.08}s infinite alternate` : 'none',
                                      }}
                                    />
                                  ))}
                                </div>
                                <span className="h-[14px] 2xl:h-[16px] w-px bg-border/50 shrink-0" />
                                <div className="flex items-baseline gap-0.5 shrink-0 pl-0.5">
                                  <span className={`text-[11px] 2xl:text-[13px] font-mono font-bold tabular-nums leading-none transition-colors ${isBotRunning && isScannerPlaying ? 'text-emerald-300 drop-shadow-[0_0_6px_rgba(52,211,153,0.35)]' : 'text-muted-foreground/70'}`}>
                                    {cardsPerMinute >= 10000
                                      ? `${(cardsPerMinute / 1000).toFixed(0)}k`
                                      : cardsPerMinute >= 1000
                                        ? `${(cardsPerMinute / 1000).toFixed(1)}k`
                                        : cardsPerMinute}
                                  </span>
                                  <span className="text-[8.5px] 2xl:text-[9.5px] font-mono font-medium tracking-tight text-muted-foreground/60 leading-none">/m</span>
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="border-border/60 bg-popover/95 backdrop-blur-md p-2 text-[11px] font-medium text-foreground">
                              {isBotRunning && isScannerPlaying ? (
                                elapsedSeconds < 60 ? (
                                  <span>Items found: <span className="text-emerald-400 font-mono font-bold">{cardsPerMinute}</span> in the last <span className="text-sky-400 font-mono font-bold">{elapsedSeconds}</span> sec (accumulating to 1 min)</span>
                                ) : (
                                  <span>Items found: <span className="text-emerald-400 font-mono font-bold">{cardsPerMinute}</span> in the last <span className="text-emerald-400 font-mono font-bold">60</span> sec</span>
                                )
                              ) : (
                                <span>Scanner is stopped</span>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>

                      <div className="flex items-center gap-[4px] 2xl:gap-[8.6px] shrink-0">
                        <Select value={sortBy} onValueChange={setSortBy}>
                          <SelectTrigger className="w-auto h-[30px] 2xl:h-[34.2px] text-[9.5px] 2xl:text-[11.2px] font-semibold uppercase tracking-[0.08em] 2xl:tracking-[0.12em] rounded-md px-[4px] 2xl:px-[6.4px] gap-[3px] 2xl:gap-[6.4px] shrink-0 focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 outline-none ring-0 border-0 !bg-background/40 text-foreground/90 data-[state=open]:!text-primary data-[state=open]:!bg-primary/[0.06] transition-colors [&>svg.lucide-chevron-down]:h-[11px] [&>svg.lucide-chevron-down]:w-[11px] 2xl:[&>svg.lucide-chevron-down]:h-[13px] 2xl:[&>svg.lucide-chevron-down]:w-[13px] [&>svg.lucide-chevron-down]:opacity-60 data-[state=open]:[&>svg.lucide-chevron-down]:rotate-180 data-[state=open]:[&>svg.lucide-chevron-down]:opacity-100 [&>svg.lucide-chevron-down]:transition-transform">
                            <SlidersHorizontal className="h-[11px] w-[11px] 2xl:h-[13px] 2xl:w-[13px] text-primary/80" />
                            <SelectValue placeholder="Sort" />
                          </SelectTrigger>
                          <SelectContent
                            position="popper"
                            align="start"
                            sideOffset={4}
                            style={{ width: 'var(--radix-select-trigger-width)', minWidth: 'var(--radix-select-trigger-width)' }}
                            className="!min-w-0 w-[var(--radix-select-trigger-width)] rounded-lg border border-border/40 bg-background/95 backdrop-blur-xl p-1 shadow-[0_8px_24px_-8px_hsl(var(--background)/0.8),0_0_0_1px_hsl(var(--primary)/0.06)]"
                          >
                            {[
                              { v: 'newest', label: 'Newest' },
                              { v: 'price-asc', label: 'Price ↑' },
                              { v: 'price-desc', label: 'Price ↓' },
                              { v: 'float-asc', label: 'Float ↑' },
                              { v: 'float-desc', label: 'Float ↓' },
                            ].map(({ v, label }) => (
                              <SelectItem
                                key={v}
                                value={v}
                                className="relative pl-3 pr-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/80 rounded-md cursor-pointer focus:bg-primary/[0.08] focus:text-foreground data-[state=checked]:text-primary data-[state=checked]:bg-primary/[0.06] [&>span:first-child]:hidden before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-3 before:w-[2px] before:rounded-r-full before:bg-primary before:opacity-0 data-[state=checked]:before:opacity-100 transition-colors"
                              >
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  <div className="flex items-center h-[30px] 2xl:h-[34.2px] ml-auto shrink-0">
                    <TabsList className="h-[30px] 2xl:h-[34.2px] !bg-background/40 border border-border/40 p-[2px] gap-0 shrink-0 rounded-lg flex">
                      {[
                        { v: 'all', icon: Filter, label: 'All Items' },
                        { v: 'watchlist', icon: Eye, label: 'Watchlist' },
                        { v: 'overlays', icon: Layers, label: 'Overlays' },
                        { v: 'settings', icon: Settings2, label: 'Filters' },
                      ].map(({ v, icon: Icon, label }) => {
                        const active = activeTab === v;
                        return (
                          <TabsTrigger
                            key={v}
                            value={v}
                            className="group relative h-[26px] 2xl:h-[30px] px-[6px] 2xl:px-[10.7px] rounded-md border border-transparent text-[9.5px] 2xl:text-[11.2px] font-semibold uppercase tracking-[0.1em] transition-all duration-200 !bg-background/40 !text-white/85 shadow-none data-[state=active]:!bg-background/40 data-[state=active]:!text-white data-[state=active]:!border-primary/50 data-[state=active]:shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.25),0_0_10px_hsl(var(--primary)/0.15)] hover:!bg-background/40 hover:!text-white"
                          >
                            <span className="inline-flex items-center justify-center gap-1.5">
                              <Icon className={`h-[11px] w-[11px] 2xl:h-[13px] 2xl:w-[13px] transition-transform ${active ? 'scale-110' : 'group-hover:scale-105'}`} strokeWidth={active ? 2.4 : 1.8} />
                              <span>{label}</span>
                            </span>
                          </TabsTrigger>
                        );
                      })}
                    </TabsList>
                  </div>

                  {onToggleSidebar && (
                    <div className="ml-px relative shrink-0">
                      {!sidebarVisible && (
                        <button
                          onClick={() => setToolbarHidden(true)}
                          className="absolute -top-[7px] left-1/2 -translate-x-1/2 h-2 w-5 flex items-center justify-center rounded-t-sm bg-foreground/10 text-foreground hover:bg-foreground/20 transition-colors z-10"
                          title="Hide toolbar"
                        >
                          <ChevronUp className="h-2 w-2" />
                        </button>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => {
                              if (!sidebarVisible) { setToolbarHidden(false); onToggleSidebar(); }
                              else { onToggleSidebar(); }
                            }}
                            className="h-7 w-7 2xl:h-8 2xl:w-8 flex items-center justify-center rounded-md border border-border/40 !bg-background/40 text-muted-foreground hover:text-foreground hover:border-border/70 hover:bg-background/60 transition-all"
                          >
                            {sidebarVisible ? <Maximize2 className="h-3 w-3 2xl:h-3.5 2xl:w-3.5" strokeWidth={2} /> : <Minimize2 className="h-3 w-3 2xl:h-3.5 2xl:w-3.5" strokeWidth={2} />}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">{sidebarVisible ? 'Scanner mode' : 'Exit scanner mode'}</TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                </TooltipProvider>
              </div>
            </div>
          )}

          <TabsContent value="all" className={`!mt-0 flex-1 min-h-0 overflow-hidden ${toolbarHidden ? 'pt-3' : ''}`}>
            <div ref={gridContainerRef} className="h-full">
              <div
                ref={gridScrollRef}
                className="overflow-y-auto pr-1 pb-6 h-full"
                style={{ scrollbarGutter: 'stable' }}
                onMouseOver={hoverFreeze ? handleGridMouseOver : undefined}
                onMouseLeave={hoverFreeze ? handleGridMouseLeave : undefined}
              >
                <div
                  className="grid gap-3 items-start"
                  style={{
                    gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
                    gridAutoRows: `${CARD_HEIGHT}px`,
                  }}
                >
                  {/* Skeleton placeholders while initializing */}
                  {!isInitialized && Array.from({ length: gridColumns * 3 }).map((_, idx) => (
                    <div
                      key={`skeleton-${idx}`}
                      className="bg-card rounded-lg border border-border/30 h-full p-3.5 flex flex-col gap-2 animate-pulse justify-between"
                      style={{ height: CARD_HEIGHT }}
                    >
                      <div className="space-y-2">
                        <div className="h-4 bg-muted/40 rounded w-3/4" />
                        <div className="h-3 bg-muted/20 rounded w-1/2" />
                      </div>
                      <div className="flex-1 bg-muted/10 rounded my-2 min-h-[60px]" />
                      <div className="space-y-3 mt-auto">
                        <div className="h-2 bg-muted/10 rounded-full w-full" />
                        <div className="flex justify-between items-center">
                          <div className="h-4 bg-muted/30 rounded w-1/3" />
                          <div className="h-4 bg-muted/30 rounded w-1/4" />
                        </div>
                      </div>
                    </div>
                  ))}

                  {pinnedItemId && (() => {
                    let pinnedItem = sortedItems.find(i => i.id === pinnedItemId);
                    if (!pinnedItem && pinnedItemRef.current && pinnedItemRef.current.id === pinnedItemId) {
                      pinnedItem = pinnedItemRef.current;
                    }
                    if (!pinnedItem) return null;
                    return (
                      <MonitorItemCard
                        key={`pinned-${pinnedItem.id}`}
                        item={pinnedItem}
                        isWatchlisted={isWatchlisted(pinnedItem.id)}
                        onToggleWatchlist={toggleWatchlist}
                        cfgMatch={itemMatches.get(pinnedItem.id) || null}
                        overlayMatch={overlayMatches.get(pinnedItem.id) || null}
                        showInGameImages={showInGameImages}
                        showScreenshots={showScreenshots}
                        screenshotMode={screenshotMode}
                        screenshotTtlMinutes={screenshotTtlMinutes}
                        density={gridColumns}
                        imageScale={imageScale}
                        rarityColorHeight={rarityColorHeight}
                        isPinned={true}
                        buyLocked={buyLocked}
                        initialBuyState={buyStates[pinnedItem.id]}
                        onBuyStateChange={(state) => setBuyStates(prev => ({ ...prev, [pinnedItem.id]: state }))}
                        onPin={() => {
                          setPinnedItemId(null);
                          pinnedItemRef.current = null;
                          try {
                            localStorage.removeItem('live-monitor-pinned-id');
                            localStorage.removeItem('live-monitor-pinned-item');
                          } catch { }
                        }}
                        onUpdateItem={handleUpdateItem}
                        priceDiffRef={priceDiffRef}
                        includeCharmPrice={includeCharmPrice}
                      />
                    );
                  })()}

                  {showSold && soldItems.map(item => (
                    <LazyCardWrapper key={item.id}>
                      <MonitorItemCard
                        item={item}
                        isWatchlisted={false}
                        onToggleWatchlist={() => { }}
                        cfgMatch={null}
                        showInGameImages={showInGameImages}
                        showScreenshots={showScreenshots}
                        screenshotMode={screenshotMode}
                        screenshotTtlMinutes={screenshotTtlMinutes}
                        density={gridColumns}
                        imageScale={imageScale}
                        rarityColorHeight={rarityColorHeight}
                        isPinned={false}
                        buyLocked={true}
                        onPin={() => { }}
                        priceDiffRef={priceDiffRef}
                        includeCharmPrice={includeCharmPrice}
                      />
                    </LazyCardWrapper>
                  ))}

                  {displayedItems.map((item, idx) => (
                    // key={idx} (not item.id) is intentional: with stable index-keys React
                    // updates content IN PLACE instead of moving DOM nodes when the live
                    // feed reorders items. Moving DOM nodes causes the browser to fire
                    // spurious mouseenter events ("element moved under cursor"), which was
                    // causing the freeze to jump to a wrong card on every SSE update.
                    <LazyCardWrapper key={idx} forceVisible={hoverFreeze && frozenCardId === item.id} isNewlyArrived={newlyArrivedIds.has(item.id)}>
                      <div
                        data-monitor-card
                        className="h-full"
                        onMouseEnter={hoverFreeze ? () => freezeCard(item, idx) : undefined}
                      >
                        <MonitorItemCard
                          item={item}
                          onMouseEnter={hoverFreeze ? () => freezeCard(item, idx) : undefined}
                          isWatchlisted={isWatchlisted(item.id)}
                          onToggleWatchlist={toggleWatchlist}
                          cfgMatch={itemMatches.get(item.id) || null}
                          overlayMatch={overlayMatches.get(item.id) || null}
                          showInGameImages={showInGameImages}
                          showScreenshots={showScreenshots}
                          screenshotMode={screenshotMode}
                          screenshotTtlMinutes={screenshotTtlMinutes}
                          density={gridColumns}
                          imageScale={imageScale}
                          rarityColorHeight={rarityColorHeight}
                          isPinned={false}
                          isFrozen={hoverFreeze && frozenCardId === item.id}
                          buyLocked={buyLocked}
                          initialBuyState={buyStates[item.id]}
                          onBuyStateChange={(state) => setBuyStates(prev => ({ ...prev, [item.id]: state }))}
                          onPin={() => {
                            setPinnedItemId(item.id);
                            pinnedItemRef.current = item;
                            try {
                              localStorage.setItem('live-monitor-pinned-id', item.id);
                              localStorage.setItem('live-monitor-pinned-item', JSON.stringify(item));
                            } catch { }
                            setItems(prev => {
                              const idx = prev.findIndex(i => i.id === item.id);
                              if (idx <= 0) return prev;
                              const copy = [...prev];
                              const [moved] = copy.splice(idx, 1);
                              copy.unshift(moved);
                              return copy;
                            });
                            setTimeout(() => {
                              gridScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                            }, 50);
                          }}
                          onUpdateItem={handleUpdateItem}
                          priceDiffRef={priceDiffRef}
                          includeCharmPrice={includeCharmPrice}
                        />
                      </div>
                    </LazyCardWrapper>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="watchlist" className={`mt-4 ${toolbarHidden ? 'pt-3 mt-0' : ''}`}>
            <WatchlistView
              items={watchlist}
              onRemove={removeFromWatchlist}
              onUpdateFilters={updateWatchlistFilters}
              onListingPricesSync={syncWatchlistListingPrices}
            />
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <MonitorSettingsTab
              filters={monitorFilters}
              onFiltersChange={setMonitorFilters}
            />
          </TabsContent>

          <TabsContent value="overlays" className={`!mt-0 flex-1 min-h-0 overflow-hidden ${toolbarHidden ? 'pt-3 !mt-0' : ''}`}>
            <OverlaysShell
              overlays={overlays}
              onOverlaysChange={setOverlays}
              mode={overlayMode}
              onModeChange={setOverlayMode}
              panelMode={overlayPanelMode}
              onPanelModeChange={setOverlayPanelMode}
              searchQuery={overlaySearchQuery}
              onSearchQueryChange={setOverlaySearchQuery}
              actionsRef={overlayActionsRef}
              headerless
            />
          </TabsContent>
        </Tabs>

        <button
          onClick={() => setToolbarHidden(false)}
          className={`absolute top-0 right-[22px] lg:right-[26px] z-50 h-2.5 w-5 flex items-center justify-center rounded-b-sm bg-background/40 text-muted-foreground hover:text-foreground hover:bg-background/60 border border-t-0 border-border/40 hover:border-border/70 transition-all duration-300 ease-in-out !m-0 ${toolbarHidden ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
          title="Show toolbar"
        >
          <ChevronDown className="h-2 w-2" />
        </button>
      </div>
    </div>
  );
};
