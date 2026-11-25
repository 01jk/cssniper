import { useEffect, useRef, useState } from "react";
import {
  SlidersHorizontal,
  EyeOff,
  DollarSign,
  Crosshair,
  Gem,
  Layers,
  Sparkles,
  Ban,
  Percent,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

import {
  MonitorFilters,
  defaultMonitorFilters,
} from "./filters/monitorFilterTypes";
import { saveFilters } from "./filters/monitorPresets";

import { PriceFilterSection } from "./filters/sections/PriceFilterSection";
import { WeaponsFilterSection } from "./filters/sections/WeaponsFilterSection";
import { RarityCategoryFilterSection } from "./filters/sections/RarityCategoryFilterSection";
import { FloatWearFilterSection } from "./filters/sections/FloatWearFilterSection";
import { StickersCharmFilterSection } from "./filters/sections/StickersCharmFilterSection";
import { KeywordsFilterSection } from "./filters/sections/KeywordsFilterSection";
import { DiscountOverpayFilterSection } from "./filters/sections/DiscountOverpayFilterSection";
import { MonitorFiltersTableView } from "./MonitorFiltersTableView";
import { LiveTapeBar, ViewMode } from "./filters/LiveTapeBar";

const VIEW_KEY = "monitor-filters-view-mode";

// Re-export for backward compatibility with LiveMonitor.tsx
export type { MonitorFilters } from "./filters/monitorFilterTypes";
export { defaultMonitorFilters } from "./filters/monitorFilterTypes";

interface Props {
  filters: MonitorFilters;
  onFiltersChange: (filters: MonitorFilters) => void;
}

/* ---------- Shared building blocks ---------- */

interface PanelProps {
  icon: typeof SlidersHorizontal;
  title: string;
  hint?: string;
  count: number;
  className?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

const Panel = ({ icon: Icon, title, hint, count, className, action, children }: PanelProps) => {
  const code = title.split(" ")[0].toUpperCase();
  return (
    <section
      className={cn(
        "group relative flex flex-col min-h-0 rounded overflow-hidden font-mono",
        "bg-black border border-border/60",
        "shadow-[inset_0_1px_0_0_hsl(var(--primary))]",
        className,
      )}
    >
      {/* Bloomberg-style terminal header */}
      <header className="flex items-center justify-between gap-2 px-2.5 h-8 border-b border-border/60 bg-gradient-to-r from-primary/10 via-black to-black shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-3.5 w-3.5 text-primary shrink-0" strokeWidth={2.25} />
          <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-primary truncate">
            {title}
          </span>
          {hint && (
            <span className="text-[9.5px] text-muted-foreground/50 truncate hidden xl:inline italic">
              — {hint}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {action}
          <span
            className={cn(
              "inline-flex items-center gap-1 px-1.5 h-5 rounded border text-[9.5px] font-bold tabular-nums leading-none",
              count > 0
                ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
                : "border-border/60 bg-black/40 text-muted-foreground/50",
            )}
          >
            <span
              className={cn(
                "inline-block h-1 w-1 rounded-full",
                count > 0 ? "bg-emerald-400 shadow-[0_0_4px_hsl(142_76%_50%)]" : "bg-border/60",
              )}
            />
            {String(count)}
          </span>
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto p-3 scrollbar-thin">
        <div className="font-sans text-foreground h-full">{children}</div>
      </div>
    </section>
  );
};

interface CollapsibleProps {
  icon: typeof SlidersHorizontal;
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const CollapsiblePanel = ({ icon: Icon, title, count, open, onToggle, children }: CollapsibleProps) => {
  return (
    <section
      className={cn(
        "rounded overflow-hidden border transition-all font-mono bg-black flex flex-col",
        "shadow-[inset_0_1px_0_0_hsl(var(--primary)/0.08)]",
        open
          ? "absolute inset-0 z-30 border-primary/60 shadow-[0_8px_32px_-8px_hsl(var(--primary)/0.5)]"
          : "relative border-border/60 flex-none",
      )}
    >
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-2 px-2.5 h-8 shrink-0 text-left transition-colors bg-gradient-to-r from-primary/10 via-black to-black",
          open ? "border-b border-border/60" : "hover:from-primary/15",
        )}
      >
        <Icon
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-colors",
            open ? "text-primary" : "text-muted-foreground/70",
          )}
          strokeWidth={2.25}
        />
        <span
          className={cn(
            "text-[11px] font-bold uppercase tracking-[0.15em] truncate",
            open ? "text-primary" : "text-foreground/80",
          )}
        >
          {title}
        </span>
        <span
          className={cn(
            "ml-auto inline-flex items-center gap-1 px-1.5 h-5 rounded border text-[9.5px] font-bold tabular-nums leading-none",
            count > 0
              ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
              : "border-border/60 bg-black/40 text-muted-foreground/50",
          )}
        >
          <span
            className={cn(
              "inline-block h-1 w-1 rounded-full",
              count > 0 ? "bg-emerald-400 shadow-[0_0_4px_hsl(142_76%_50%)]" : "bg-border/60",
            )}
          />
          {String(count)}
        </span>
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform shrink-0",
            open ? "rotate-180 text-primary" : "text-muted-foreground/60",
          )}
        />
      </button>
      {open && (
        <div className="border-t border-border/40 flex-1 min-h-0 overflow-y-auto p-3 scrollbar-thin">
          <div className="font-sans text-foreground">{children}</div>
        </div>
      )}
    </section>
  );
};

/* ---------- Main component ---------- */

export const MonitorSettingsTab = ({ filters, onFiltersChange }: Props) => {
  const [activeTab, setActiveTab] = useState<"stickers" | "keywords" | "discount">("stickers");
  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "grid";
    return (localStorage.getItem(VIEW_KEY) as ViewMode) || "grid";
  });

  // Highlight — pinpoint the exact filter item clicked from the active-filters popover
  useEffect(() => {
    const onHighlight = (e: Event) => {
      const detail = (e as CustomEvent).detail as { section?: string; chipKey?: string };
      const section = detail?.section;
      const chipKey = detail?.chipKey;
      // Switch advanced tab if needed (so the target element is rendered)
      if (section === "stickers" || section === "keywords" || section === "discount") {
        setActiveTab(section);
      }
      if (!chipKey) return;
      // Wait for tab switch + render before locating the element
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const els = document.querySelectorAll<HTMLElement>(
          `[data-filter-key="${CSS.escape(chipKey)}"]`
        );
        els.forEach(el => {
          el.classList.remove("filter-item-flash");
          void el.offsetWidth; // force reflow to restart animation
          el.classList.add("filter-item-flash");
          try {
            el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
          } catch {}
          window.setTimeout(() => el.classList.remove("filter-item-flash"), 1500);
        });
      }));
    };
    window.addEventListener("monitor-filter-highlight", onHighlight);
    return () => window.removeEventListener("monitor-filter-highlight", onHighlight);
  }, []);

  // Persist filters whenever they change
  useEffect(() => {
    saveFilters(filters);
  }, [filters]);

  // Persist view mode
  useEffect(() => {
    localStorage.setItem(VIEW_KEY, view);
  }, [view]);

  const counts = {
    price: filters.rangePriceConfirmed || filters.fixedPriceConfirmed ? 1 : 0,
    weapons: filters.hiddenWeaponTypes.size,
    rarity: filters.hiddenRarities.size + filters.hiddenCategories.size,
    wear:
      filters.hiddenWearTiers.size +
      (filters.floatMinEnabled || filters.floatMaxEnabled ? 1 : 0),
    stickers: [
      filters.blockStickerHolo,
      filters.blockStickerFoil,
      filters.blockStickerGold,
      filters.blockStickerPaper,
    ].filter(Boolean).length,
    keywords: filters.keywords.length > 0 ? 1 : 0,
    discount: filters.discountEnabled ? 1 : 0,
  };


  const resetBtnClass =
    "h-5 px-1.5 rounded border border-destructive/50 bg-destructive/15 text-[9.5px] font-bold uppercase tracking-wider text-destructive hover:bg-destructive/25 hover:border-destructive transition-colors";

  const ResetBtn = ({ onClick }: { onClick: () => void }) => (
    <button onClick={onClick} className={resetBtnClass}>Reset</button>
  );

  return (
    <div className="h-[calc(100vh-70px)] flex flex-col gap-2.5 pr-3 pb-1 min-h-0">
      {/* LiveTapeBar moved up into LiveMonitor toolbar slot when filters tab is open */}


      {view === "table" ? (
        /* ============= TABLE VIEW (B) — Trading Cockpit dense table ============= */
        <div className="flex-1 min-h-0">
          <MonitorFiltersTableView filters={filters} onFiltersChange={onFiltersChange} />
        </div>
      ) : (
        /* ============= GRID VIEW (A) — workstation layout ============= */
        <div className="flex-1 min-h-0 grid grid-cols-12 grid-rows-[260px_1fr] gap-2">
        {/* Row 1 — Price + Float & Wear + Advanced */}
        <Panel
          icon={DollarSign}
          title="Price Range"
          hint="market value"
          count={counts.price}
          className={"col-span-5"}
          action={
            counts.price > 0 ? (
              <ResetBtn onClick={() => onFiltersChange({ ...filters, fixedPricePending: '', fixedPriceConfirmed: false, rangePriceFromPending: '', rangePriceToPending: '', rangePriceConfirmed: false })} />
            ) : undefined
          }
        >
          <PriceFilterSection filters={filters} onFiltersChange={onFiltersChange} />
        </Panel>

        <Panel
          icon={Layers}
          title="Float & Wear"
          hint="condition"
          count={counts.wear}
          className={"col-span-4"}
          action={
            counts.wear > 0 ? (
              <ResetBtn onClick={() => onFiltersChange({ ...filters, hiddenWearTiers: new Set(), floatMinEnabled: false, floatMaxEnabled: false, floatMin: '', floatMax: '' })} />
            ) : undefined
          }
        >
          <FloatWearFilterSection filters={filters} onFiltersChange={onFiltersChange} />
        </Panel>

        <aside className="relative col-span-3 row-span-1 flex flex-col min-h-0 rounded overflow-hidden font-mono bg-black border border-border/60 shadow-[inset_0_1px_0_0_hsl(var(--primary)/0.08)]">
          <header className="flex items-center justify-between gap-2 px-2.5 h-8 border-b border-border/60 bg-gradient-to-r from-primary/10 via-black to-black shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <SlidersHorizontal className="h-3.5 w-3.5 text-primary shrink-0" strokeWidth={2.25} />
              <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-primary truncate">
                Advanced
              </span>
              <span className="text-[9.5px] text-muted-foreground/50 truncate hidden xl:inline italic">
                — market edge
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {(counts.stickers + counts.keywords + counts.discount) > 0 && (
                <ResetBtn
                  onClick={() => onFiltersChange({
                    ...filters,
                    blockStickerHolo: false,
                    blockStickerFoil: false,
                    blockStickerGold: false,
                    blockStickerPaper: false,
                    keywords: [],
                    discountEnabled: false,
                    discountMin: '',
                    discountMax: '',
                  })}
                />
              )}
            </div>
          </header>

          {/* Segmented tab bar */}
          <div role="tablist" className="grid grid-cols-3 border-b border-border/60 bg-black/60 shrink-0">
            {([
              { key: "stickers", label: "Stickers", icon: Sparkles, count: counts.stickers },
              { key: "keywords", label: "Blocklist", icon: Ban, count: counts.keywords },
              { key: "discount", label: "Discount", icon: Percent, count: counts.discount },
            ] as const).map(({ key, label, icon: TabIcon, count }) => {
              const active = activeTab === key;
              return (
                <button
                  key={key}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(key)}
                  className={cn(
                    "relative flex items-center justify-center gap-1.5 h-8 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors border-r border-border/40 last:border-r-0",
                    active
                      ? "text-primary bg-primary/10 shadow-[inset_0_-2px_0_0_hsl(var(--primary))]"
                      : "text-muted-foreground/70 hover:text-foreground hover:bg-primary/5",
                  )}
                >
                  <TabIcon className="h-3 w-3" strokeWidth={2.25} />
                  <span>{label}</span>
                  {count > 0 && (
                    <span className="ml-0.5 inline-flex items-center justify-center h-3.5 min-w-[14px] px-1 rounded-sm bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-[8.5px] tabular-nums leading-none">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active section content */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3 scrollbar-thin font-sans text-foreground">
            {activeTab === "stickers" && (
              <StickersCharmFilterSection filters={filters} onFiltersChange={onFiltersChange} />
            )}
            {activeTab === "keywords" && (
              <KeywordsFilterSection filters={filters} onFiltersChange={onFiltersChange} />
            )}
            {activeTab === "discount" && (
              <DiscountOverpayFilterSection filters={filters} onFiltersChange={onFiltersChange} />
            )}
          </div>
        </aside>

        {/* Row 2 — Rarity + Weapons */}
        <Panel
          icon={Gem}
          title="Rarity & Category"
          hint="tier · attributes"
          count={counts.rarity}
          className={"col-span-5"}
          action={
            counts.rarity > 0 ? (
              <ResetBtn onClick={() => onFiltersChange({ ...filters, hiddenRarities: new Set(), hiddenCategories: new Set() })} />
            ) : undefined
          }
        >
          <RarityCategoryFilterSection filters={filters} onFiltersChange={onFiltersChange} />
        </Panel>

        <Panel
          icon={Crosshair}
          title="Weapon Types"
          hint="by category"
          count={counts.weapons}
          className={"col-span-7"}
          action={
            counts.weapons > 0 ? (
              <ResetBtn onClick={() => onFiltersChange({ ...filters, hiddenWeaponTypes: new Set() })} />
            ) : undefined
          }
        >
          <WeaponsFilterSection filters={filters} onFiltersChange={onFiltersChange} />
        </Panel>
      </div>
      )}
    </div>
  );
};

