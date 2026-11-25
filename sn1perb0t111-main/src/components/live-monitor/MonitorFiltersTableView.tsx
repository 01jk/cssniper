import { useEffect, useMemo, useRef, useState } from "react";
import {
  DollarSign,
  Crosshair,
  Gem,
  Layers,
  Sparkles,
  Type,
  Percent,
  Activity,
  Search,
  Power,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MonitorFilters } from "./filters/monitorFilterTypes";

import { PriceFilterSection } from "./filters/sections/PriceFilterSection";
import { WeaponsFilterSection } from "./filters/sections/WeaponsFilterSection";
import { RarityCategoryFilterSection } from "./filters/sections/RarityCategoryFilterSection";
import { FloatWearFilterSection } from "./filters/sections/FloatWearFilterSection";
import { StickersCharmFilterSection } from "./filters/sections/StickersCharmFilterSection";
import { KeywordsFilterSection } from "./filters/sections/KeywordsFilterSection";
import { DiscountOverpayFilterSection } from "./filters/sections/DiscountOverpayFilterSection";

interface Props {
  filters: MonitorFilters;
  onFiltersChange: (filters: MonitorFilters) => void;
}

type RowKey = "price" | "weapons" | "rarity" | "wear" | "stickers" | "keywords" | "discount";

interface RowDef {
  key: RowKey;
  icon: typeof DollarSign;
  code: string;
  name: string;
  hotkey: string;
}

const ROWS: RowDef[] = [
  { key: "price",    icon: DollarSign, code: "PRC", name: "PRICE.RANGE",   hotkey: "1" },
  { key: "weapons",  icon: Crosshair,  code: "WPN", name: "WEAPON.TYPES",  hotkey: "2" },
  { key: "rarity",   icon: Gem,        code: "RAR", name: "RARITY.CATEG",  hotkey: "3" },
  { key: "wear",     icon: Layers,     code: "FLT", name: "FLOAT.WEAR",    hotkey: "4" },
  { key: "stickers", icon: Sparkles,   code: "STK", name: "STICKERS.CHRM", hotkey: "5" },
  { key: "keywords", icon: Type,       code: "KEY", name: "NAME.KEYWORDS", hotkey: "6" },
  { key: "discount", icon: Percent,    code: "DSC", name: "DISCOUNT.PCT",  hotkey: "7" },
];

const countFor = (k: RowKey, f: MonitorFilters): number => {
  switch (k) {
    case "price":    return (f.rangePriceConfirmed || f.fixedPriceConfirmed) ? 1 : 0;
    case "weapons":  return f.hiddenWeaponTypes.size;
    case "rarity":   return f.hiddenRarities.size + f.hiddenCategories.size;
    case "wear":     return f.hiddenWearTiers.size + ((f.floatMinEnabled || f.floatMaxEnabled) ? 1 : 0);
    case "stickers": return [f.blockStickerHolo, f.blockStickerFoil, f.blockStickerGold, f.blockStickerPaper].filter(Boolean).length;
    case "keywords": return f.keywords.length;
    case "discount": return f.discountEnabled ? 1 : 0;
  }
};

const summaryFor = (k: RowKey, f: MonitorFilters): string => {
  switch (k) {
    case "price": {
      if (f.fixedPriceConfirmed && f.fixedPricePending) return `EQ $${f.fixedPricePending}`;
      if (f.rangePriceConfirmed) {
        const a = f.rangePriceFromPending || "0";
        const b = f.rangePriceToPending || "INF";
        return `${a}..${b}`;
      }
      return "<unset>";
    }
    case "weapons":
      return f.hiddenWeaponTypes.size ? `BLOCK x${f.hiddenWeaponTypes.size}` : "<unset>";
    case "rarity": {
      const parts: string[] = [];
      if (f.hiddenRarities.size)   parts.push(`RAR.${f.hiddenRarities.size}`);
      if (f.hiddenCategories.size) parts.push(`CAT.${f.hiddenCategories.size}`);
      return parts.length ? parts.join("+") : "<unset>";
    }
    case "wear": {
      const parts: string[] = [];
      if (f.hiddenWearTiers.size) parts.push([...f.hiddenWearTiers].map(t => t.toUpperCase()).join("|"));
      if (f.floatMinEnabled || f.floatMaxEnabled) {
        const a = f.floatMinEnabled ? f.floatMin || "0" : "0";
        const b = f.floatMaxEnabled ? f.floatMax || "1" : "1";
        parts.push(`F:${a}->${b}`);
      }
      return parts.length ? parts.join(" ") : "<unset>";
    }
    case "stickers": {
      const list = [
        f.blockStickerHolo  && "HOL",
        f.blockStickerFoil  && "FOI",
        f.blockStickerGold  && "GLD",
        f.blockStickerPaper && "PAP",
      ].filter(Boolean) as string[];
      return list.length ? list.join("|") : "<unset>";
    }
    case "keywords":
      return f.keywords.length
        ? `${f.keywordMode === "block" ? "BLK" : "ALW"} x${f.keywords.length}`
        : "<unset>";
    case "discount": {
      if (!f.discountEnabled) return "<unset>";
      const a = f.discountMin || "-INF";
      const b = f.discountMax || "+INF";
      return `${a}%..${b}%`;
    }
  }
};

const sectionHeaderFor = (k: RowKey) => {
  switch (k) {
    case "price":    return { title: "Price Range",       hint: "Block items outside acceptable market value bounds." };
    case "weapons":  return { title: "Weapon Types",      hint: "Exclude entire weapon categories from scanner stream." };
    case "rarity":   return { title: "Rarity & Category", hint: "Filter by rarity tier and item attribute groups." };
    case "wear":     return { title: "Float & Wear",      hint: "Reject by wear tier and exact float value bounds." };
    case "stickers": return { title: "Stickers / Charm",  hint: "Block items containing specific sticker types." };
    case "keywords": return { title: "Name Keywords",     hint: "Allow / block items by substring match in name." };
    case "discount": return { title: "Discount %",        hint: "Acceptable discount/overpay vs market range." };
  }
};

const DetailPanel = ({ rowKey, filters, onFiltersChange }: { rowKey: RowKey } & Props) => {
  switch (rowKey) {
    case "price":    return <PriceFilterSection filters={filters} onFiltersChange={onFiltersChange} />;
    case "weapons":  return <WeaponsFilterSection filters={filters} onFiltersChange={onFiltersChange} />;
    case "rarity":   return <RarityCategoryFilterSection filters={filters} onFiltersChange={onFiltersChange} />;
    case "wear":     return <FloatWearFilterSection filters={filters} onFiltersChange={onFiltersChange} />;
    case "stickers": return <StickersCharmFilterSection filters={filters} onFiltersChange={onFiltersChange} />;
    case "keywords": return <KeywordsFilterSection filters={filters} onFiltersChange={onFiltersChange} />;
    case "discount": return <DiscountOverpayFilterSection filters={filters} onFiltersChange={onFiltersChange} />;
  }
};

/* ============================================================
   Bloomberg Terminal-style Monitor Filters
   - Amber/green-on-black palette
   - Monospace everything
   - Master (left index) + Detail (right editor)
   - Live tape ticker on top
   - Hotkey navigation 1..7
   ============================================================ */

export const MonitorFiltersTableView = ({ filters, onFiltersChange }: Props) => {
  const [active, setActive] = useState<RowKey>("price");
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Hotkeys 1..7 + "/" focuses search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      const idx = parseInt(e.key, 10);
      if (!isNaN(idx) && idx >= 1 && idx <= ROWS.length) {
        setActive(ROWS[idx - 1].key);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const rows = useMemo(() => {
    if (!query.trim()) return ROWS;
    const q = query.toLowerCase();
    return ROWS.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.code.toLowerCase().includes(q)
    );
  }, [query]);

  const totalActive = useMemo(
    () => ROWS.reduce((acc, r) => acc + (countFor(r.key, filters) > 0 ? 1 : 0), 0),
    [filters]
  );

  const activeRow = ROWS.find(r => r.key === active)!;
  const activeMeta = sectionHeaderFor(active);
  const activeCount = countFor(active, filters);


  return (
    <div className="flex flex-col h-full min-h-0 font-mono text-foreground">
      {/* Tape ticker moved to LiveTapeBar above (shared between Grid & Table views) */}

      {/* ============= Main grid: master + detail ============= */}
      <div className="flex-1 min-h-0 grid grid-cols-[300px_1fr] gap-1.5 overflow-hidden">
        {/* ---------- LEFT: Section index ---------- */}
        <div className="flex flex-col min-h-0 rounded border border-amber-500/20 bg-black overflow-hidden">
          {/* Search */}
          <div className="flex items-center gap-1.5 h-7 px-2 border-b border-amber-500/20 bg-black/60 shrink-0">
            <Search className="h-3 w-3 text-amber-500/60" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="filter sections... (/)"
              className="flex-1 bg-transparent outline-none text-[10.5px] text-amber-200 placeholder:text-amber-500/30 font-mono"
            />
            <span className="text-[9px] text-amber-500/50 tabular-nums">
              {rows.length}/{ROWS.length}
            </span>
          </div>

          {/* Column header */}
          <div className="grid grid-cols-[18px_42px_1fr_38px_18px] items-center gap-1.5 h-5 px-2 border-b border-amber-500/20 bg-black/40 text-[9px] uppercase tracking-[0.15em] text-amber-500/60 shrink-0">
            <span>·</span>
            <span>code</span>
            <span>section</span>
            <span className="text-right">cnt</span>
            <span className="text-center">k</span>
          </div>

          {/* Section list */}
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
            {rows.map((r) => {
              const count = countFor(r.key, filters);
              const isActive = r.key === active;
              const isOn = count > 0;
              return (
                <button
                  key={r.key}
                  onClick={() => setActive(r.key)}
                  className={cn(
                    "w-full grid grid-cols-[18px_42px_1fr_38px_18px] items-center gap-1.5 h-8 px-2 text-left transition-colors border-l-2",
                    isActive
                      ? "bg-amber-500/10 border-l-amber-400"
                      : "border-l-transparent hover:bg-amber-500/5"
                  )}
                >
                  {/* On/off indicator */}
                  <span className={cn(
                    "inline-block h-1.5 w-1.5 rounded-full",
                    isOn ? "bg-emerald-400 shadow-[0_0_6px_hsl(142_76%_50%)]" : "bg-amber-500/20"
                  )} />

                  {/* Code */}
                  <span className={cn(
                    "text-[10px] font-bold tracking-wider tabular-nums",
                    isActive ? "text-amber-300" : isOn ? "text-emerald-400" : "text-amber-500/60"
                  )}>
                    {r.code}
                  </span>

                  {/* Name */}
                  <span className={cn(
                    "text-[10.5px] truncate",
                    isActive ? "text-amber-100" : "text-amber-200/70"
                  )}>
                    {r.name}
                  </span>

                  {/* Count */}
                  <span className={cn(
                    "text-right text-[10px] font-bold tabular-nums",
                    isOn ? "text-emerald-400" : "text-amber-500/30"
                  )}>
                    {String(count)}
                  </span>

                  {/* Hotkey */}
                  <span className={cn(
                    "text-center text-[9px] font-bold rounded border px-1 py-0",
                    isActive
                      ? "border-amber-400/60 text-amber-300 bg-amber-500/10"
                      : "border-amber-500/20 text-amber-500/50"
                  )}>
                    {r.hotkey}
                  </span>
                </button>
              );
            })}

            {rows.length === 0 && (
              <div className="px-2 py-4 text-[10px] text-amber-500/50 italic">
                &gt; no sections match "{query}"
              </div>
            )}
          </div>

          {/* Index footer — global stats */}
          <div className="border-t border-amber-500/20 bg-black/60 shrink-0 p-2 space-y-1">
            <div className="flex items-center justify-between text-[9px] tracking-wider">
              <span className="text-amber-500/60">SECTIONS.ON</span>
              <span className={cn("font-bold tabular-nums", totalActive > 0 ? "text-emerald-400" : "text-amber-500/40")}>
                {totalActive}/{ROWS.length}
              </span>
            </div>
            <div className="h-1 rounded bg-amber-500/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-all"
                style={{ width: `${(totalActive / ROWS.length) * 100}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[9px] tracking-wider pt-0.5">
              <span className="text-amber-500/60 flex items-center gap-1">
                <Power className="h-2.5 w-2.5" /> MODE
              </span>
              <span className="font-bold text-rose-400">BLACKLIST</span>
            </div>
          </div>
        </div>

        {/* ---------- RIGHT: Detail editor ---------- */}
        <div className="flex flex-col min-h-0 rounded border border-amber-500/20 bg-black overflow-hidden">
          {/* Detail header */}
          <div className="flex items-center justify-between gap-3 h-9 px-3 border-b border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-black to-black shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <activeRow.icon className="h-3.5 w-3.5 text-amber-400 shrink-0" strokeWidth={2.25} />
              <span className="text-[10px] font-bold tracking-[0.2em] text-amber-300">
                {activeRow.code}
              </span>
              <ArrowRight className="h-3 w-3 text-amber-500/50 shrink-0" />
              <span className="text-[12px] font-bold text-amber-100 truncate">
                {activeMeta.title}
              </span>
              <span className="text-[10px] text-amber-500/50 truncate hidden lg:inline">
                — {activeMeta.hint}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[9px] uppercase tracking-[0.15em] text-amber-500/60">status</span>
              <span className={cn(
                "px-2 py-0.5 rounded border text-[10px] font-bold tabular-nums",
                activeCount > 0
                  ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
                  : "border-amber-500/30 bg-amber-500/5 text-amber-500/60"
              )}>
                {activeCount > 0 ? `ACTIVE · ${activeCount}` : "INACTIVE"}
              </span>
            </div>
          </div>

          {/* Address line — terminal feel */}
          <div className="flex items-center gap-2 h-5 px-3 border-b border-amber-500/10 bg-black/60 shrink-0 text-[9.5px]">
            <span className="text-amber-500/50">monitor</span>
            <span className="text-amber-500/30">/</span>
            <span className="text-amber-500/50">filters</span>
            <span className="text-amber-500/30">/</span>
            <span className="text-amber-300 font-bold">{activeRow.code.toLowerCase()}</span>
            <span className="text-amber-500/30 ml-auto">summary:</span>
            <span className="text-emerald-400 font-bold">{summaryFor(active, filters)}</span>
          </div>

          {/* Detail body */}
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-4">
            <div className="font-sans">
              <DetailPanel rowKey={active} filters={filters} onFiltersChange={onFiltersChange} />
            </div>
          </div>

          {/* Detail footer — keyboard hint */}
          <div className="flex items-center justify-between gap-3 h-6 px-3 border-t border-amber-500/20 bg-black/60 shrink-0 text-[9px] tracking-[0.15em] text-amber-500/60">
            <div className="flex items-center gap-3">
              <span><kbd className="px-1 rounded bg-amber-500/10 text-amber-300 font-bold">1-7</kbd> jump section</span>
              <span><kbd className="px-1 rounded bg-amber-500/10 text-amber-300 font-bold">/</kbd> search</span>
            </div>
            
          </div>
        </div>
      </div>

      {/* Local keyframes for the tape */}
      <style>{`
        @keyframes scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
