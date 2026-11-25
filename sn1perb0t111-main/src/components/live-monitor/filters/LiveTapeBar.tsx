import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bookmark,
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Save as SaveIcon,
  Undo2,
  ArrowLeft,
  ListFilter,
  ClipboardList,
  Clock,
  Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  MonitorFilters,
  defaultMonitorFilters,
  countActiveFilters,
  WEAPON_CATEGORIES,
  RARITIES,
  ITEM_CATEGORIES,
  WEAR_TIERS,
  WearTier,
} from "./monitorFilterTypes";
import {
  MonitorPreset,
  loadCustomPresets,
  saveCustomPresets,
} from "./monitorPresets";


const CONFIG_EMOJIS = [
  "📋", "🎯", "🔥", "💎", "⚡", "🚀", "💰", "🎮", "🎲", "🏆",
  "⭐", "💥", "🗡️", "🛡️", "💣", "🌟", "✨", "🌈",
  "🔷", "🔶", "🟢", "🔴", "🟣", "🟡", "🟠", "⚪", "⚫", "🟤",
  "❤️", "💙", "💚", "💜", "🧡", "💛", "🖤", "🤍",
  "🐉", "🦅", "🦁", "🐺", "🦊", "🐍", "🦈", "🦋",
  "👑", "🎩", "🎨", "🎵", "🌙", "☀️", "🔮", "💀", "🤖", "👽",
];


export type ViewMode = "grid" | "table";

interface Props {
  filters: MonitorFilters;
  onFiltersChange: (filters: MonitorFilters) => void;
  view?: ViewMode;
  onViewChange?: (v: ViewMode) => void;
  onBackToScanner?: () => void;
}

const ACTIVE_PRESET_KEY = "live-scanner-active-preset";

const cloneFilters = (f: MonitorFilters): MonitorFilters => ({
  ...f,
  hiddenWeaponTypes: new Set(f.hiddenWeaponTypes),
  hiddenRarities: new Set(f.hiddenRarities),
  hiddenCategories: new Set(f.hiddenCategories),
  hiddenWearTiers: new Set(f.hiddenWearTiers),
  keywords: [...f.keywords],
});

// Find the parent weapon category for a weapon type
const weaponCatOf = (type: string): string => {
  const cat = WEAPON_CATEGORIES.find(c => c.types.includes(type));
  return cat?.label ?? "Weapon";
};

// Mirror of CATEGORY_META in WeaponsFilterSection — keep colors in sync
const WEAPON_CAT_COLOR: Record<string, string> = {
  Knives:  "#fbbf24",
  Gloves:  "#a855f7",
  Rifles:  "#ef4444",
  Pistols: "#3b82f6",
  SMGs:    "#22c55e",
  Heavy:   "#f97316",
};
const weaponColorOf = (type: string): string =>
  WEAPON_CAT_COLOR[weaponCatOf(type)] ?? "#ef4444";

export type ChipSection =
  | "price"
  | "weapons"
  | "rarity"
  | "wear"
  | "stickers"
  | "keywords"
  | "discount";

interface Chip {
  key: string;
  group: string;
  label: string;
  color: string;
  section: ChipSection;
  onRemove: () => void;
}

const buildChips = (
  f: MonitorFilters,
  set: (next: MonitorFilters) => void
): Chip[] => {
  const chips: Chip[] = [];
  const upd = (mut: (n: MonitorFilters) => void) => {
    const n = cloneFilters(f);
    mut(n);
    set(n);
  };

  // Price
  if (f.fixedPriceConfirmed && f.fixedPricePending) {
    chips.push({
      key: "price-fixed",
      section: "price",
      group: "PRICE",
      label: `=$${f.fixedPricePending}`,
      color: "#22d3ee",
      onRemove: () =>
        upd(n => {
          n.fixedPriceConfirmed = false;
          n.fixedPricePending = "";
        }),
    });
  }
  if (f.rangePriceConfirmed) {
    const lo = f.rangePriceFromPending || "0";
    const hi = f.rangePriceToPending || "∞";
    chips.push({
      key: "price-range",
      section: "price",
      group: "PRICE",
      label: `$${lo}–$${hi}`,
      color: "#22d3ee",
      onRemove: () =>
        upd(n => {
          n.rangePriceConfirmed = false;
          n.rangePriceFromPending = "";
          n.rangePriceToPending = "";
        }),
    });
  }

  // Weapons
  f.hiddenWeaponTypes.forEach(t => {
    chips.push({
      key: `wpn-${t}`,
      section: "weapons",
      group: weaponCatOf(t).toUpperCase(),
      label: t,
      color: weaponColorOf(t),
      onRemove: () =>
        upd(n => {
          n.hiddenWeaponTypes.delete(t);
        }),
    });
  });

  // Rarities
  f.hiddenRarities.forEach(r => {
    const meta = RARITIES.find(x => x.value === r);
    chips.push({
      key: `rar-${r}`,
      section: "rarity",
      group: "RARITY",
      label: meta?.label ?? r,
      color: meta?.color ?? "#a855f7",
      onRemove: () =>
        upd(n => {
          n.hiddenRarities.delete(r);
        }),
    });
  });

  // Categories
  f.hiddenCategories.forEach(c => {
    const meta = ITEM_CATEGORIES.find(x => x.value === c);
    chips.push({
      key: `cat-${c}`,
      section: "rarity",
      group: "CATEGORY",
      label: meta?.label ?? c,
      color: meta?.color ?? "#a855f7",
      onRemove: () =>
        upd(n => {
          n.hiddenCategories.delete(c);
        }),
    });
  });

  // Wear tiers
  f.hiddenWearTiers.forEach(w => {
    const meta = WEAR_TIERS.find(x => x.value === w);
    chips.push({
      key: `wear-${w}`,
      section: "wear",
      group: "WEAR",
      label: meta?.label ?? w,
      color: meta?.color ?? "#eab308",
      onRemove: () =>
        upd(n => {
          n.hiddenWearTiers.delete(w as WearTier);
        }),
    });
  });

  // Float
  if (f.floatMinEnabled || f.floatMaxEnabled) {
    const lo = f.floatMinEnabled ? f.floatMin || "0.00" : "0.00";
    const hi = f.floatMaxEnabled ? f.floatMax || "1.00" : "1.00";
    chips.push({
      key: "float",
      section: "wear",
      group: "FLOAT",
      label: `${lo}–${hi}`,
      color: "#84cc16",
      onRemove: () =>
        upd(n => {
          n.floatMinEnabled = false;
          n.floatMaxEnabled = false;
        }),
    });
  }

  // Sticker types
  const stk: { k: keyof MonitorFilters; l: string; c: string }[] = [
    { k: "blockStickerHolo", l: "Holo", c: "#22d3ee" },
    { k: "blockStickerFoil", l: "Foil", c: "#a78bfa" },
    { k: "blockStickerGold", l: "Gold", c: "#fbbf24" },
    { k: "blockStickerPaper", l: "Paper", c: "#94a3b8" },
  ];
  stk.forEach(s => {
    if (f[s.k]) {
      chips.push({
        key: `stk-${s.k}`,
      section: "stickers",
        group: "STICKER",
        label: s.l,
        color: s.c,
        onRemove: () =>
          upd(n => {
            (n as any)[s.k] = false;
          }),
      });
    }
  });

  // Keywords
  f.keywords.forEach(k => {
    chips.push({
      key: `kw-${k}`,
      section: "keywords",
      group: f.keywordMode === "block" ? "BLOCK" : "ALLOW",
      label: k,
      color: f.keywordMode === "block" ? "#f43f5e" : "#10b981",
      onRemove: () =>
        upd(n => {
          n.keywords = n.keywords.filter(x => x !== k);
        }),
    });
  });

  // Discount
  if (f.discountEnabled) {
    const lo = f.discountMin || "0";
    const hi = f.discountMax || "0";
    const isSame = lo === hi;
    chips.push({
      key: "discount",
      section: "discount",
      group: "DISC",
      label: isSame ? `${lo}%` : `${lo}%/${hi}%`,
      color: "#f59e0b",
      onRemove: () =>
        upd(n => {
          n.discountEnabled = false;
        }),
    });
  }

  return chips;
};

/** Live Tape — top operational bar:
 *  LEFT  : horizontally-scrollable strip of active filter chips (click X to remove)
 *  RIGHT : revert-to-saved button + config selector + clock
 */
export const LiveTapeBar = ({ filters, onFiltersChange, onBackToScanner }: Props) => {

  // ---------- Configs (presets) ----------
  const [customPresets, setCustomPresets] = useState<MonitorPreset[]>(() => loadCustomPresets());
  const [activeId, setActiveId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(ACTIVE_PRESET_KEY);
  });
  // Hydration guard — ensures we never wipe storage before initial load completes
  const hydratedRef = useRef(false);
  useEffect(() => { hydratedRef.current = true; }, []);

  // Auto-persist presets as a safety net (in addition to manual saves in persistCustom)
  useEffect(() => {
    if (!hydratedRef.current) return;
    saveCustomPresets(customPresets);
  }, [customPresets]);

  // Cross-tab sync: react to changes from other tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "live-scanner-monitor-presets") {
        setCustomPresets(loadCustomPresets());
      }
      if (e.key === ACTIVE_PRESET_KEY) {
        setActiveId(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (activeId) localStorage.setItem(ACTIVE_PRESET_KEY, activeId);
    else localStorage.removeItem(ACTIVE_PRESET_KEY);
  }, [activeId]);

  const activePreset = customPresets.find(p => p.id === activeId) || null;

  const [configsOpen, setConfigsOpen] = useState(false);

  // Create / Rename dialog (shared shape, like TargetConfigManager)
  type DialogMode = null | { type: "create" } | { type: "rename"; id: string };
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [draftName, setDraftName] = useState("");
  const [draftEmoji, setDraftEmoji] = useState("");

  const persistCustom = (next: MonitorPreset[]) => {
    setCustomPresets(next);
    saveCustomPresets(next);
  };

  const applyPreset = (p: MonitorPreset) => {
    onFiltersChange(cloneFilters(p.filters));
    setActiveId(p.id);
    setConfigsOpen(false);
  };

  const openCreate = () => {
    const nextNum = customPresets.length + 1;
    setDraftName(`Config ${nextNum}`);
    setDraftEmoji("");
    setDialogMode({ type: "create" });
  };

  const openRename = (p: MonitorPreset) => {
    setDraftName(p.name);
    setDraftEmoji(p.emoji || "");
    setDialogMode({ type: "rename", id: p.id });
  };

  const closeDialog = () => {
    setDialogMode(null);
    setDraftName("");
    setDraftEmoji("");
  };

  const CONFIG_NAME_MAX = 20;
  const SAVE_COOLDOWN_MS = 700;
  const lastSubmitAt = useRef(0);

  const sanitizeName = (raw: string) =>
    raw
      .replace(/[\u0000-\u001F\u007F\u200B-\u200D\uFEFF]/g, "")
      .replace(/\s+/g, " ")
      .slice(0, CONFIG_NAME_MAX);

  const dialogError = useMemo(() => {
    if (!dialogMode) return null;
    const trimmed = draftName.trim();
    if (trimmed.length === 0) return "Name is required";
    if (trimmed.length > CONFIG_NAME_MAX) return `Max ${CONFIG_NAME_MAX} characters`;
    const dup = customPresets.some(p =>
      (dialogMode.type !== "rename" || p.id !== dialogMode.id) &&
      p.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (dup) return "Name already in use";
    return null;
  }, [draftName, customPresets, dialogMode]);

  const submitDialog = () => {
    if (!dialogMode) return;
    const now = Date.now();
    if (now - lastSubmitAt.current < SAVE_COOLDOWN_MS) return;
    const cleaned = sanitizeName(draftName).trim();
    if (!cleaned || dialogError) return;
    lastSubmitAt.current = now;
    if (dialogMode.type === "create") {
      const cleanFilters = cloneFilters(defaultMonitorFilters);
      const newPreset: MonitorPreset = {
        id: `preset-${Date.now()}`,
        name: cleaned,
        emoji: draftEmoji || undefined,
        filters: cleanFilters,
      };
      persistCustom([...customPresets, newPreset]);
      setActiveId(newPreset.id);
      onFiltersChange(cloneFilters(cleanFilters));
    } else {
      persistCustom(
        customPresets.map(p =>
          p.id === dialogMode.id ? { ...p, name: cleaned, emoji: draftEmoji || undefined } : p
        )
      );
    }
    closeDialog();
  };

  const handleOverwrite = () => {
    if (!activePreset) return;
    const next = customPresets.map(p =>
      p.id === activePreset.id ? { ...p, filters: cloneFilters(filters) } : p
    );
    persistCustom(next);
  };

  const handleDelete = (id: string) => {
    persistCustom(customPresets.filter(p => p.id !== id));
    if (activeId === id) setActiveId(null);
  };


  // ---------- Chips ----------
  const chips = useMemo(() => buildChips(filters, onFiltersChange), [filters, onFiltersChange]);
  const total = countActiveFilters(filters);

  // dirty = active preset exists & current filters diverge.
  // Normalize away "pending" / disabled-but-leftover values so toggling a filter
  // off restores equality even if the underlying input strings linger.
  const canonical = (x: MonitorFilters) => {
    const priceActive = x.rangePriceConfirmed || x.fixedPriceConfirmed;
    const floatActive = x.floatMinEnabled || x.floatMaxEnabled;
    return JSON.stringify({
      hiddenWeaponTypes: [...x.hiddenWeaponTypes].sort(),
      hiddenRarities: [...x.hiddenRarities].sort(),
      hiddenCategories: [...x.hiddenCategories].sort(),
      hiddenWearTiers: [...x.hiddenWearTiers].sort(),
      // Price — only matters when confirmed
      isFixedPrice: priceActive ? x.isFixedPrice : false,
      fixedPriceConfirmed: x.fixedPriceConfirmed,
      fixedPricePending: x.fixedPriceConfirmed ? x.fixedPricePending : '',
      rangePriceConfirmed: x.rangePriceConfirmed,
      rangePriceFromPending: x.rangePriceConfirmed ? x.rangePriceFromPending : '',
      rangePriceToPending: x.rangePriceConfirmed ? x.rangePriceToPending : '',
      priceMin: priceActive ? x.priceMin : '',
      priceMax: priceActive ? x.priceMax : '',
      // Float — only matters when enabled
      floatMinEnabled: x.floatMinEnabled,
      floatMaxEnabled: x.floatMaxEnabled,
      floatMin: floatActive ? x.floatMin : '',
      floatMax: floatActive ? x.floatMax : '',
      // Sticker block flags
      blockStickerHolo: x.blockStickerHolo,
      blockStickerFoil: x.blockStickerFoil,
      blockStickerGold: x.blockStickerGold,
      blockStickerPaper: x.blockStickerPaper,
      // Keywords — mode only matters when there are keywords
      keywords: [...x.keywords].sort(),
      keywordMode: x.keywords.length > 0 ? x.keywordMode : 'block',
      // Discount — only matters when enabled
      discountEnabled: x.discountEnabled,
      discountMin: x.discountEnabled ? x.discountMin : '',
      discountMax: x.discountEnabled ? x.discountMax : '',
    });
  };

  const isDirty = useMemo(() => {
    try {
      const baseline = activePreset ? activePreset.filters : defaultMonitorFilters;
      return canonical(baseline) !== canonical(filters);
    } catch {
      return activePreset ? false : total > 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePreset, filters, total]);

  // ---------- Manual save flash ----------
  const [savedFlash, setSavedFlash] = useState(false);
  const savedFlashTimer = useRef<number | null>(null);
  const flashSaved = () => {
    setSavedFlash(true);
    if (savedFlashTimer.current) window.clearTimeout(savedFlashTimer.current);
    savedFlashTimer.current = window.setTimeout(() => setSavedFlash(false), 1400);
  };
  useEffect(() => () => {
    if (savedFlashTimer.current) window.clearTimeout(savedFlashTimer.current);
  }, []);

  const handleSave = () => {
    if (!activePreset || !isDirty) return;
    setCustomPresets(prev => {
      const next = prev.map(p =>
        p.id === activePreset.id ? { ...p, filters: cloneFilters(filters) } : p
      );
      saveCustomPresets(next);
      return next;
    });
    flashSaved();
  };

  const handleRevert = () => {
    if (activePreset) onFiltersChange(cloneFilters(activePreset.filters));
    else onFiltersChange(defaultMonitorFilters);
  };

  // ---------- Reset double-click-to-confirm ----------
  const DBLCLICK_HINT_MS = 1500;
  const [resetArmed, setResetArmed] = useState(false);
  const resetArmTimer = useRef<number | null>(null);

  const disarmReset = () => {
    if (resetArmTimer.current) {
      window.clearTimeout(resetArmTimer.current);
      resetArmTimer.current = null;
    }
    setResetArmed(false);
  };
  const handleResetClick = () => {
    if (!isDirty) return;
    if (resetArmed) {
      disarmReset();
      handleRevert();
      return;
    }
    setResetArmed(true);
    if (resetArmTimer.current) window.clearTimeout(resetArmTimer.current);
    resetArmTimer.current = window.setTimeout(() => setResetArmed(false), DBLCLICK_HINT_MS);
  };
  useEffect(() => () => disarmReset(), []);
  useEffect(() => {
    if (!isDirty && resetArmed) disarmReset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty]);

  // ---------- Active filters popover ----------
  const [filtersListOpen, setFiltersListOpen] = useState(false);



  return (
    <div className="flex items-stretch gap-[8.6px] h-[42.8px] px-[8.6px] rounded border border-border/60 bg-black/80 shrink-0 overflow-hidden font-mono">
      {/* ===== LEFT: brand ===== */}
      <div className="flex items-center gap-[8.6px] shrink-0">
        <span className="flex items-center gap-[6.4px] text-[11.8px] font-bold uppercase tracking-[0.15em] text-primary">
          <Activity className="h-[17px] w-[17px] animate-pulse" />
          LIVE.TAPE
        </span>
        <span className="h-[21.4px] w-px bg-border/60" />
      </div>

      {/* Chips strip — marquee ticker */}
      <ChipStrip chips={chips} />

      {/* ===== RIGHT — action buttons ===== */}
      <div className="flex items-center gap-[6.4px] shrink-0">

        {/* TELEMETRY POD — unified live throughput + active filters count. */}
        <Popover open={filtersListOpen} onOpenChange={setFiltersListOpen}>
          <div
            className="inline-flex items-stretch h-[32.1px] rounded-[5px] border border-border/60 bg-black/70 overflow-hidden shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)]"
            title="Live throughput · Active filters"
          >
            <StreamRate />
            <PopoverTrigger asChild>
              <button
                disabled={total === 0}
                className={cn(
                  "inline-flex items-center gap-[4.3px] px-[8.6px] text-[10.7px] font-bold tracking-[0.1em] tabular-nums transition-colors",
                  total > 0
                    ? "text-violet-300 hover:bg-violet-500/15"
                    : "text-muted-foreground/50 cursor-not-allowed"
                )}
                title={total > 0 ? "View all active filters" : "No active filters"}
              >
                <ListFilter className="h-[13px] w-[13px] opacity-80" />
                <span>{total}</span>
              </button>
            </PopoverTrigger>
          </div>
          <PopoverContent
            align="end"
            sideOffset={6}
            className="w-[320px] p-0 bg-black border-border/60 font-mono"
          >
            <div className="px-2.5 pt-2 pb-1.5 flex items-center justify-between border-b border-border/40">
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 flex items-center gap-1.5">
                <ListFilter className="h-3 w-3" />
                Active filters
              </span>
              <span className="text-[10px] font-bold tabular-nums text-violet-300">
                {total}
              </span>
            </div>
            <div className="p-2 max-h-[320px] overflow-y-auto scrollbar-thin space-y-1">
              {chips.length === 0 && (
                <div className="px-2 py-3 text-[10px] text-muted-foreground/50 italic text-center">
                  no active filters
                </div>
              )}
              {chips.map(c => (
                <div
                  key={c.key}
                  className="group flex items-center gap-1.5 h-6 pl-1.5 pr-0.5 rounded border bg-black/60 hover:bg-white/5 transition-colors"
                  style={{ borderColor: `${c.color}40` }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      window.dispatchEvent(
                        new CustomEvent("monitor-filter-highlight", {
                          detail: { section: c.section, chipKey: c.key },
                        })
                      );
                      setFiltersListOpen(false);
                    }}
                    className="flex items-center gap-1.5 flex-1 min-w-0 text-left h-full"
                    title="Locate this filter in the panel"
                  >
                    <span
                      className="text-[8.5px] uppercase tracking-[0.15em] font-bold w-[58px] shrink-0 truncate"
                      style={{ color: c.color }}
                    >
                      {c.group}
                    </span>
                    <span className="text-[10.5px] text-foreground/90 flex-1 truncate">
                      {c.label}
                    </span>
                  </button>
                  <button
                    onClick={c.onRemove}
                    className="h-5 w-5 inline-flex items-center justify-center rounded text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 transition-colors"
                    title="Remove filter"
                  >
                    <X className="h-2.5 w-2.5" strokeWidth={2.75} />
                  </button>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* SAVE / REVERT — manual save group when there are unsaved changes on an active preset */}
        {isDirty && activePreset && (
          <div
            className="flex items-stretch h-7 gap-1"
            title={`Unsaved changes in "${activePreset.name}"`}
          >
            <button
              onClick={handleSave}
              className="inline-flex items-center gap-1 px-2 rounded border border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/25 text-[10.5px] font-bold uppercase tracking-wider text-emerald-300 transition-colors"
              title={`Save changes to "${activePreset.name}"`}
            >
              <SaveIcon className="h-3 w-3" />
              Save
            </button>
            <button
              onClick={handleRevert}
              className="inline-flex items-center gap-1 px-2 rounded border border-rose-500/50 bg-rose-500/10 hover:bg-rose-500/25 text-[10.5px] font-bold uppercase tracking-wider text-rose-300 transition-colors"
              title={`Revert to saved "${activePreset.name}"`}
            >
              <Undo2 className="h-3 w-3" />
              Revert
            </button>
          </div>
        )}

        {/* RESET (no active preset) */}
        {isDirty && !activePreset && (
          <button
            onClick={handleResetClick}
            onBlur={disarmReset}
            onMouseLeave={() => { if (resetArmed) disarmReset(); }}
            className={cn(
              "tape-btn tape-btn--danger",
              resetArmed && "animate-pulse ring-2 ring-rose-400/60"
            )}
            title={resetArmed ? "Click again to confirm" : "Double-click to reset all filters"}
          >
            <Undo2 className="h-3 w-3" />
            {resetArmed ? "Confirm?" : "Reset"}
          </button>
        )}

        {/* Saved flash (after manual save) */}
        {savedFlash && (
          <span className="inline-flex items-center gap-1 h-7 px-1.5 rounded border border-emerald-500/40 bg-emerald-500/15 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
            <Check className="h-3 w-3" />
            Saved
          </span>
        )}

        

        {/* 3) CONFIG SELECTOR (cyan/green) */}
        <Popover open={configsOpen} onOpenChange={setConfigsOpen}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "tape-btn min-w-0 max-w-[220px]",
                activePreset ? "tape-btn--success" : "tape-btn--primary"
              )}
              title={
                isDirty && activePreset
                  ? `"${activePreset.name}" — unsaved changes`
                  : "Switch / manage configs"
              }
            >
              {activePreset?.emoji ? (
                <span className="text-[13px] leading-none shrink-0">{activePreset.emoji}</span>
              ) : (
                <Bookmark className="h-[13px] w-[13px] shrink-0" />
              )}
              <span className={cn("truncate", !activePreset && "italic")}>
                {activePreset ? activePreset.name : "Select config"}
              </span>
              {isDirty && activePreset && (
                <span
                  className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_hsl(38_92%_50%)] shrink-0 animate-pulse"
                  title="Unsaved changes"
                />
              )}
              <ChevronDown className="h-[13px] w-[13px] opacity-70 shrink-0" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={6}
            className="w-[340px] p-0 bg-black border-border/60 font-mono"
          >
            {/* Header */}
            <div className="px-2.5 pt-2 pb-1.5 flex items-center justify-between border-b border-border/40">
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 flex items-center gap-1.5">
                <ClipboardList className="h-3 w-3" />
                My configs
                <span className="tabular-nums opacity-60">({customPresets.length})</span>
              </span>
              <button
                onClick={openCreate}
                className="tape-btn tape-btn--primary !h-[25.7px] !px-[8.6px]"
                title="Create a new empty config"
              >
                <Plus className="h-2.5 w-2.5" /> Create config
              </button>
            </div>

            {/* Save state row */}
            {activePreset && (
              <div className="px-2.5 py-1.5 border-b border-border/40 flex items-center justify-between gap-2">
                <span className="text-[10px] text-muted-foreground/80 flex items-center gap-1.5 min-w-0 truncate">
                  {isDirty ? (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                      <span className="truncate">Unsaved changes in “{activePreset.name}”</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-3 w-3 text-emerald-400 shrink-0" />
                      <span className="truncate">“{activePreset.name}” is up to date</span>
                    </>
                  )}
                </span>
                {isDirty && (
                  <button
                    onClick={() => { handleSave(); setConfigsOpen(false); }}
                    className="tape-btn tape-btn--success !h-[25.7px] !px-[8.6px] shrink-0"
                  >
                    <SaveIcon className="h-2.5 w-2.5" /> Save
                  </button>
                )}
              </div>
            )}

            {/* List */}
            <div className="px-1 py-1.5 space-y-0.5 max-h-[300px] overflow-y-auto scrollbar-thin">
              {customPresets.length === 0 ? (
                <div className="px-3 py-6 text-center space-y-2">
                  <ClipboardList className="h-6 w-6 mx-auto text-muted-foreground/30" />
                  <p className="text-[10px] text-muted-foreground/60 italic">
                    No configs yet
                  </p>
                  <button
                    onClick={openCreate}
                    className="tape-btn tape-btn--primary !h-[30px] !px-[12.8px]"
                  >
                    <Plus className="h-3 w-3" /> Create first config
                  </button>
                </div>
              ) : (
                customPresets.map(p => (
                  <div
                    key={p.id}
                    className={cn(
                      "flex items-center gap-1 px-1.5 h-8 rounded text-[11px] transition-colors",
                      activeId === p.id
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "text-foreground hover:bg-primary/10"
                    )}
                  >
                    <button
                      onClick={() => applyPreset(p)}
                      className="flex-1 flex items-center gap-1.5 text-left truncate min-w-0"
                    >
                      <span className="text-[14px] leading-none shrink-0 w-4 text-center">
                        {p.emoji || "📋"}
                      </span>
                      <span className="truncate">{p.name}</span>
                    </button>
                    <button
                      onClick={() => openRename(p)}
                      className="tape-btn tape-btn--info !h-[25.7px] !w-[25.7px] !p-0 justify-center shrink-0"
                      title="Edit name & icon"
                    >
                      <Pencil className="h-2.5 w-2.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="tape-btn tape-btn--danger !h-[25.7px] !w-[25.7px] !p-0 justify-center shrink-0"
                      title="Delete"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* 4) BACK TO SCANNER — blocked while there are unsaved changes */}
        {onBackToScanner && (() => {
          const blocked = isDirty && !!activePreset;
          return (
            <button
              onClick={blocked ? undefined : onBackToScanner}
              aria-disabled={blocked}
              className={cn(
                "tape-btn tape-btn--warning",
                blocked && "!cursor-not-allowed !text-amber-300/40 !border-amber-500/15 !bg-amber-500/[0.03] hover:!bg-amber-500/[0.03]"
              )}
              title={
                blocked
                  ? `Save or revert changes in "${activePreset!.name}" first`
                  : "Back to Live Scanner"
              }
            >
              <ArrowLeft className="h-[13px] w-[13px]" />
              Scanner
            </button>
          );
        })()}
      </div>

      {/* ===== Create / Rename Config dialog ===== */}
      <Dialog open={dialogMode !== null} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent
          className="config-dialog sm:max-w-md bg-black border-border/60 font-mono focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {dialogMode?.type === "create" ? "Create New Config" : "Edit Config"}
            </DialogTitle>
            <DialogDescription>
              {dialogMode?.type === "create"
                ? "Creates a fresh config with empty filters and switches to it."
                : "Update the name and icon for this configuration."}
            </DialogDescription>
          </DialogHeader>

          {/* Preview */}
          <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-3 flex items-center justify-center gap-2 min-w-0">
            <span className="text-2xl leading-none shrink-0">{draftEmoji || "📋"}</span>
            <span className="text-base font-semibold truncate min-w-0 max-w-full">
              {draftName.trim() || "Config name"}
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Name
              </label>
              <span className={cn(
                "text-[10px] font-mono tabular-nums",
                draftName.length >= CONFIG_NAME_MAX ? "text-destructive" : "text-muted-foreground/60"
              )}>
                {draftName.length}/{CONFIG_NAME_MAX}
              </span>
            </div>
            <Input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(sanitizeName(e.target.value))}
              onPaste={(e) => {
                e.preventDefault();
                setDraftName(sanitizeName(e.clipboardData.getData("text")));
              }}
              maxLength={CONFIG_NAME_MAX}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitDialog();
                if (e.key === "Escape") closeDialog();
              }}
              placeholder="Config name"
              className={cn(
                "bg-black/60 border-border/60 font-mono",
                dialogError && draftName.length > 0 && "border-destructive/60"
              )}
            />
            {dialogError && draftName.length > 0 && (
              <p className="text-[10px] text-destructive">{dialogError}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Icon <span className="text-muted-foreground/50 normal-case">(optional)</span>
            </label>
            <div className="grid grid-cols-10 gap-1 p-2 rounded-md border border-border/60 bg-muted/10 max-h-[180px] overflow-y-auto scrollbar-thin">
              {/* No emoji option */}
              <button
                type="button"
                onClick={() => setDraftEmoji("")}
                className={cn(
                  "h-8 w-8 inline-flex items-center justify-center rounded hover:bg-primary/15 transition-colors text-muted-foreground",
                  draftEmoji === "" && "bg-primary/30 ring-2 ring-primary"
                )}
                title="No icon"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              {CONFIG_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setDraftEmoji(emoji)}
                  className={cn(
                    "h-8 w-8 inline-flex items-center justify-center rounded text-lg leading-none hover:bg-primary/15 transition-colors",
                    draftEmoji === emoji && "bg-primary/30 ring-2 ring-primary"
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog}>Cancel</Button>
            <Button onClick={submitDialog} disabled={!!dialogError}>
              {dialogMode?.type === "create" ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

};

/* =====================================================================
   ChipStrip — comfortable horizontal scrolling for tape filter chips
   - vertical wheel → horizontal scroll (with shift fallback)
   - click-and-drag panning (cursor-grab)
   - left/right chevrons appear when overflow exists
   - fade gradients on overflowing edges
   - auto-scrolls to newest chip when chip count grows
   ===================================================================== */
/* =====================================================================
   ChipStrip — subtitles-style ticker.
   - chips stream slowly to the RIGHT (continuous loop, two copies)
   - paused on hover so users can read & click X
   - pure CSS animation; speed scales with chip count for stable cadence
   ===================================================================== */
const Chip = ({ c }: { c: Chip }) => (
  <span
    className="group inline-flex items-center gap-[2.1px] h-[19px] pl-[4.3px] pr-[2.1px] rounded-[3px] border bg-black/70 text-[10.2px] font-semibold whitespace-nowrap shrink-0 leading-none transition-colors hover:bg-black/90"
    style={{
      borderColor: `${c.color}55`,
      color: c.color,
      boxShadow: `inset 0 0 0 1px ${c.color}10, 0 0 4px ${c.color}22`,
    }}
    title={`${c.group}: ${c.label}`}
  >
    <span
      className="text-[8px] uppercase tracking-[0.12em] opacity-70 pr-[2.1px] border-r border-current/20 mr-[2.1px]"
      style={{ color: c.color }}
    >
      {c.group}
    </span>
    <span className="text-foreground/90">{c.label}</span>
    <button
      onClick={c.onRemove}
      className="ml-[2.1px] h-[15px] w-[15px] inline-flex items-center justify-center rounded-[2px] bg-rose-500/15 text-rose-400 hover:bg-rose-500/30 hover:text-rose-300 transition-colors"
      title="Remove filter"
    >
      <X className="h-[8.6px] w-[8.6px]" strokeWidth={2.5} />
    </button>
  </span>
);

const ChipStrip = ({ chips }: { chips: Chip[] }) => {
  const [paused, setPaused] = useState(false);

  if (chips.length === 0) {
    return (
      <div className="flex-1 min-w-0 flex items-center">
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/40 italic">
          no active filters — stream is wide open
        </span>
      </div>
    );
  }

  // Slow, readable cadence: ~3.5s per chip, min 18s
  const duration = Math.max(18, chips.length * 3.5);

  return (
    <div
      className={cn(
        "relative flex-1 min-w-0 flex items-center overflow-hidden",
        paused && "tape-marquee-paused"
      )}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Edge fade masks for clean ticker look */}
      <span className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 z-10 bg-gradient-to-r from-black/95 to-transparent" />
      <span className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 z-10 bg-gradient-to-l from-black/95 to-transparent" />

      <div
        className="tape-marquee-track px-2"
        style={{ ["--tape-marquee-duration" as any]: `${duration}s` }}
      >
        {/* duplicate the chip set so the loop is seamless */}
        {chips.map(c => (
          <Chip key={`a-${c.key}`} c={c} />
        ))}
        {chips.map(c => (
          <Chip key={`b-${c.key}`} c={c} />
        ))}
      </div>
    </div>
  );
};

/* =====================================================================
   TapeClock — live UTC HH:MM:SS readout, styled to match tape strip
   ===================================================================== */
const TapeClock = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mm = String(now.getUTCMinutes()).padStart(2, "0");
  const ss = String(now.getUTCSeconds()).padStart(2, "0");
  return (
    <span
      className="inline-flex items-center gap-[4.3px] h-[32.1px] px-[8.6px] rounded-[3px] border border-border/60 bg-black/70 text-[10.7px] font-bold tracking-[0.1em] text-emerald-300/90 tabular-nums"
      title="Current UTC time"
    >
      <Clock className="h-[13px] w-[13px] opacity-70" />
      <span>{hh}:{mm}<span className="text-emerald-300/50">:{ss}</span></span>
      <span className="text-[8.6px] tracking-[0.18em] text-muted-foreground/60 ml-[2.1px]">UTC</span>
    </span>
  );
};

/* =====================================================================
   StreamRate — synthetic items/min throughput pill (operational marker)
   ===================================================================== */
const StreamRate = () => {
  const [rate, setRate] = useState(142);
  useEffect(() => {
    const id = window.setInterval(() => {
      setRate(r => Math.max(60, Math.min(320, r + Math.round((Math.random() - 0.5) * 28))));
    }, 1500);
    return () => window.clearInterval(id);
  }, []);
  return (
    <span
      className="inline-flex items-center gap-[4.3px] h-full px-[8.6px] text-[10.7px] font-bold tracking-[0.1em] text-cyan-300/90 tabular-nums"
      title="Live items per minute through the tape"
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-70 animate-ping" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" />
      </span>
      <Radio className="h-[13px] w-[13px] opacity-70" />
      <span>{rate}</span>
      <span className="text-[8.6px] tracking-[0.18em] text-muted-foreground/60 ml-[2.1px]">/MIN</span>
    </span>
  );
};
