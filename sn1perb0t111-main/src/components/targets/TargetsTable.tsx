import { useState } from "react";
import { Bell, ShoppingCart, Trash2, ChevronDown, FolderInput, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { getPhaseColor } from "../live-monitor/monitorTypes";

interface StickerEntry {
  name: string;
  wear?: string;
  slot?: number;
  tier?: number;
}

interface Target {
  id: number;
  itemName: string;
  orderPrice: number;
  // Filters
  minFloat?: number;
  maxFloat?: number;
  special?: ('StatTrak' | 'Souvenir' | 'Normal')[];
  rarity?: string;
  // Discount / Overpay (-100 to +100)
  discountOverpayMin?: number;
  discountOverpayMax?: number;
  // Stickers (up to 5)
  stickers?: StickerEntry[];
  stickersMinPercent?: number;
  stickersMaxPercent?: number;
  // Sticker Overpay
  stickerOverpayMin?: number;
  stickerOverpayMax?: number;
  // Patterns
  blueGemMin?: number;
  blueGemMax?: number;
  fadeMin?: number;
  fadeMax?: number;
  seeds?: string;
  paintSeeds?: number[]; // Array of paint seeds
  // Custom
  zeroFloatEnabled?: boolean;
  customFilters?: string;
  blueGemEnabled?: boolean;
  fadeEnabled?: boolean;
  charmProfitEnabled?: boolean;
  charmProfitMin?: string;
  charmProfitMax?: string;
  // Actions state
  notifyEnabled: boolean;
  autoBuyEnabled: boolean;
  // Extra property to hold floatRank data for TargetsTable display
  floatRankGold?: boolean;
  floatRankSilver?: boolean;
  floatRankBronze?: boolean;
  phase?: string;
}

const initialTargets: Target[] = [
  {
    id: 1,
    itemName: "AK-47 | Case Hardened",
    orderPrice: 450,
    minFloat: 0.01,
    maxFloat: 0.15,
    special: ['StatTrak'],
    rarity: 'Classified',
    discountOverpayMin: -15,
    discountOverpayMax: 25,
    stickers: [
      { name: "Titan (Holo)", tier: 1, slot: 1 },
      { name: "iBP (Holo)", tier: 1, slot: 2 },
    ],
    stickersMinPercent: 5,
    stickersMaxPercent: 15,
    stickerOverpayMin: 5,
    stickerOverpayMax: 35,
    blueGemMin: 70,
    blueGemMax: 100,
    zeroFloatEnabled: true,
    blueGemEnabled: true,
    notifyEnabled: true,
    autoBuyEnabled: false,
  },
  {
    id: 2,
    itemName: "*",
    orderPrice: 600,
    minFloat: 0,
    maxFloat: 1,
    notifyEnabled: true,
    autoBuyEnabled: true,
  },
  {
    id: 3,
    itemName: "AWP | Dragon Lore",
    orderPrice: 8500,
    minFloat: 0,
    maxFloat: 0.07,
    special: ['Souvenir'],
    rarity: 'Covert',
    discountOverpayMin: -50,
    discountOverpayMax: -10,
    stickers: [
      { name: "Fnatic (Gold)", tier: 2, slot: 1 },
      { name: "Olofmeister", tier: 3, slot: 2 },
      { name: "MLG Columbus", tier: 4, slot: 3 },
      { name: "MVP", tier: 4, slot: 4 },
    ],
    stickerOverpayMin: 0,
    stickerOverpayMax: 15,
    notifyEnabled: true,
    autoBuyEnabled: false,
  },
  {
    id: 4,
    itemName: "Karambit | Fade",
    orderPrice: 1200,
    minFloat: 0,
    maxFloat: 0.03,
    discountOverpayMin: 10,
    discountOverpayMax: 80,
    fadeMin: 95,
    fadeMax: 100,
    notifyEnabled: true,
    autoBuyEnabled: true,
  },
  {
    id: 5,
    itemName: "M4A1-S | Printstream",
    orderPrice: 180,
    minFloat: 0,
    maxFloat: 0.25,
    special: ['Normal', 'StatTrak'],
    discountOverpayMin: -30,
    discountOverpayMax: 40,
    stickers: [
      { name: "Navi", tier: 3, slot: 1 },
    ],
    stickerOverpayMin: 20,
    stickerOverpayMax: 80,
    zeroFloatEnabled: true,
    notifyEnabled: true,
    autoBuyEnabled: false,
  },
];

export const TargetsTable = () => {
  const [targets, setTargets] = useState<Target[]>(initialTargets);

  const configs = ["Config 1", "Config 2", "Config 3", "Config 4", "Config 5"];

  const toggleNotify = (id: number) => {
    setTargets(targets.map(t => t.id === id ? { ...t, notifyEnabled: !t.notifyEnabled } : t));
  };

  const toggleAutoBuy = (id: number) => {
    setTargets(targets.map(t => t.id === id ? { ...t, autoBuyEnabled: !t.autoBuyEnabled } : t));
  };

  const deleteTarget = (id: number) => {
    setTargets(targets.filter(t => t.id !== id));
  };

  const moveToConfig = (targetId: number, configName: string) => {
    console.log(`Moving target ${targetId} to ${configName}`);
  };

  // Compact Float display
  const FloatCell = ({ min, max }: { min?: number; max?: number }) => {
    if (min === undefined && max === undefined) return <span className="text-muted-foreground/50 text-center">—</span>;
    return (
      <span className="text-xs font-mono">
        <span className="text-emerald-400">{min?.toFixed(4) ?? '0'}</span>
        <span className="text-muted-foreground mx-0.5">-</span>
        <span className="text-orange-400">{max?.toFixed(4) ?? '1'}</span>
      </span>
    );
  };


  // Compact Stickers display - shows count with tooltip for details
  const StickersCell = ({
    stickers,
    minPercent,
    maxPercent,
    charmProfitEnabled,
    charmProfitMin,
    charmProfitMax
  }: {
    stickers?: StickerEntry[];
    minPercent?: number;
    maxPercent?: number;
    charmProfitEnabled?: boolean;
    charmProfitMin?: string;
    charmProfitMax?: string;
  }) => {
    // Determine if we have any stickers or charms
    const hasStickers = stickers && stickers.length > 0;
    const hasCharmProfit = charmProfitEnabled && charmProfitMin !== undefined && charmProfitMax !== undefined;

    if (!hasStickers && !hasCharmProfit) return <span className="text-muted-foreground/50 text-center">—</span>;

    return (
      <div className="flex flex-col gap-1 items-start">
        {/* Stickers Row */}
        {hasStickers && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 cursor-help">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-purple-500/50 text-purple-400 bg-purple-500/10">
                  {stickers.length}x
                </Badge>
                {(minPercent !== undefined || maxPercent !== undefined) && (
                  <span className="text-[9px] text-muted-foreground">
                    {minPercent ?? 0}-{maxPercent ?? 100}%
                  </span>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[250px]">
              <div className="text-xs space-y-1">
                {stickers.map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    {/* Wear percentage */}
                    {s.wear && (
                      <span className="text-cyan-400 font-mono text-[10px]">{s.wear}</span>
                    )}
                    {/* Slot number - show 0 if not selected, otherwise show slot number */}
                    <span className="text-purple-400 font-mono w-4 text-center">
                      {s.slot ? s.slot : '0'}
                    </span>
                    <span className="truncate">{s.name}</span>
                    {s.tier && <Badge variant="outline" className="text-[8px] px-0.5 py-0 h-3">T{s.tier}</Badge>}
                  </div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Charm Profit Row */}
        {hasCharmProfit && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-violet-400/50 text-violet-400 bg-violet-500/10 cursor-help">
                CP:{charmProfitMin}%-{charmProfitMax === "10000" ? "∞" : `${charmProfitMax}%`}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top">
              Charm Profit: {charmProfitMin}% to {charmProfitMax === "10000" ? "Infinity" : `${charmProfitMax}%`}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    );
  };

  // Get overpay color based on percentage (teal to red gradient)
  const getOverpayColor = (percent: number): string => {
    if (percent <= 10) return `hsl(165 55% 32%)`; // Dark teal
    if (percent <= 25) return `hsl(130 75% 40%)`; // Green
    if (percent <= 35) return `hsl(90 80% 42%)`; // Lime
    if (percent <= 50) return `hsl(60 85% 45%)`; // Yellow-green
    if (percent <= 65) return `hsl(40 90% 45%)`; // Yellow-orange
    if (percent <= 85) return `hsl(20 85% 45%)`; // Orange-red
    return `hsl(5 75% 40%)`; // Red
  };

  // Mini Sticker Overpay slider display
  const StickerOverpayCell = ({ min, max }: { min?: number; max?: number }) => {
    if (min === undefined && max === undefined) return <span className="text-muted-foreground/50 text-center">—</span>;

    const minVal = min ?? 0;
    const maxVal = max ?? 100;

    return (
      <div className="w-full space-y-0.5">
        {/* Mini gradient track with range indicator */}
        <div className="relative h-1.5 w-full rounded-full sticker-overpay-gradient opacity-90">
          {/* Range indicator overlay */}
          <div
            className="absolute top-0 h-full bg-white/25 rounded-full border border-white/40"
            style={{
              left: `${minVal}%`,
              width: `${maxVal - minVal}%`
            }}
          />
          {/* Min thumb marker */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-1.5 h-2.5 rounded-sm border border-black/30"
            style={{
              left: `${minVal}%`,
              transform: 'translateX(-50%) translateY(-50%)',
              backgroundColor: getOverpayColor(minVal)
            }}
          />
          {/* Max thumb marker */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-1.5 h-2.5 rounded-sm border border-black/30"
            style={{
              left: `${maxVal}%`,
              transform: 'translateX(-50%) translateY(-50%)',
              backgroundColor: getOverpayColor(maxVal)
            }}
          />
        </div>
        {/* Labels */}
        <div className="flex justify-between text-[8px] font-mono">
          <span style={{ color: getOverpayColor(minVal) }}>{minVal}%</span>
          <span style={{ color: getOverpayColor(maxVal) }}>{maxVal}%</span>
        </div>
      </div>
    );
  };

  // Paint Seed display - supports both single seed and array of seeds
  const PaintSeedCell = ({ seeds, paintSeeds }: { seeds?: string; paintSeeds?: number[] }) => {
    // If paintSeeds array exists and has values, use it
    if (paintSeeds && paintSeeds.length > 0) {
      if (paintSeeds.length === 1) {
        return (
          <span
            className="text-xs font-mono font-medium"
            style={{ color: '#4b69ff' }}
          >
            #{paintSeeds[0]}
          </span>
        );
      }

      // Multiple seeds - show count with tooltip
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="flex items-center gap-1 cursor-help text-xs font-mono font-medium"
              style={{ color: '#4b69ff' }}
            >
              <span>{paintSeeds.length}x</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[200px]">
            <div className="text-xs space-y-0.5">
              <div className="text-muted-foreground mb-1">Paint Seeds:</div>
              <div className="flex flex-wrap gap-1">
                {paintSeeds.slice(0, 20).map((seed) => (
                  <span key={seed} style={{ color: '#4b69ff' }}>#{seed}</span>
                ))}
                {paintSeeds.length > 20 && (
                  <span className="text-muted-foreground">+{paintSeeds.length - 20} more</span>
                )}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      );
    }

    // Fallback to legacy single seed string
    if (!seeds || seeds === "0") return <span className="text-muted-foreground/50 text-center">—</span>;

    return (
      <span
        className="text-xs font-mono font-medium"
        style={{ color: '#4b69ff' }}
      >
        #{seeds}
      </span>
    );
  };

  // Mini Patterns display with Fade and Blue Gem sliders
  const PatternsCell = ({ blueGemMin, blueGemMax, fadeMin, fadeMax }: {
    blueGemMin?: number;
    blueGemMax?: number;
    fadeMin?: number;
    fadeMax?: number;
  }) => {
    // Check if values deviate from defaults or are explicitly set in a meaningful way
    const hasBlueGem = (blueGemMin !== undefined || blueGemMax !== undefined) && (blueGemMin !== 0 || blueGemMax !== 100);
    // Fixed: Fade default is 0-100, not 80-100 now.
    const hasFade = (fadeMin !== undefined || fadeMax !== undefined) && (fadeMin !== 0 || fadeMax !== 100);

    if (hasFade) {
      return (
        <div className="space-y-1.5 py-1">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm fade-gradient shrink-0" />
              <span className="text-[9px] text-muted-foreground">Fade %</span>
            </div>
            <div className="relative h-1.5 w-full rounded-full fade-gradient opacity-80">
              {/* Range indicator */}
              <div
                className="absolute top-0 h-full bg-white/30 rounded-full"
                style={{
                  left: `${(fadeMin ?? 0)}%`,
                  width: `${(fadeMax ?? 100) - (fadeMin ?? 0)}%`
                }}
              />
            </div>
            <div className="flex justify-between text-[8px] text-muted-foreground/70">
              <span>{fadeMin ?? 0}%</span>
              <span>{fadeMax ?? 100}%</span>
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
              <div className="w-3 h-3 rounded-sm blue-gradient shrink-0" />
              <span className="text-[9px] text-muted-foreground">Blue Gem %</span>
            </div>
            <div className="relative h-1.5 w-full rounded-full blue-gradient opacity-80">
              {/* Range indicator */}
              <div
                className="absolute top-0 h-full bg-white/30 rounded-full"
                style={{
                  left: `${blueGemMin ?? 0}%`,
                  width: `${(blueGemMax ?? 100) - (blueGemMin ?? 0)}%`
                }}
              />
            </div>
            <div className="flex justify-between text-[8px] text-muted-foreground/70">
              <span>{blueGemMin ?? 0}%</span>
              <span>{blueGemMax ?? 100}%</span>
            </div>
          </div>
        </div>
      );
    }

    return <span className="text-muted-foreground/50">—</span>;
  };

  // Custom filters indicators
  const CustomCell = ({
    zeroFloat,
    blueGem,
    blueGemTier,
    floatRankGold,
    floatRankSilver,
    floatRankBronze,
    phase,
    special,
    fireAndIce,
    fireAndIceTier
  }: {
    zeroFloat?: boolean;
    blueGem?: boolean;
    blueGemTier?: '1st' | '2nd' | '3rd' | null;
    floatRankGold?: boolean;
    floatRankSilver?: boolean;
    floatRankBronze?: boolean;
    phase?: string;
    special?: ("StatTrak" | "Souvenir" | "Normal")[];
    fireAndIce?: boolean;
    fireAndIceTier?: '1st' | '2nd' | '3rd' | null;
  }) => {
    // If no special is set, default to Normal
    const displaySpecial = (!special || special.length === 0) ? ['Normal'] : special;

    return (
      <div className="flex gap-1 flex-wrap max-w-[80px]">
        {displaySpecial.map((s) => (
          <Badge
            key={s}
            variant="outline"
            className={cn(
              "text-[9px] px-1 py-0 h-4",
              s === 'StatTrak' && "border-orange-500/50 text-orange-400 bg-orange-500/10",
              s === 'Souvenir' && "border-yellow-500/50 text-yellow-400 bg-yellow-500/10",
              s === 'Normal' && "border-zinc-400/50 text-zinc-400 bg-zinc-400/10"
            )}
          >
            {s === 'StatTrak' ? 'ST' : s === 'Souvenir' ? 'SV' : 'NRM'}
          </Badge>
        ))}

        {zeroFloat && (
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-zinc-400/50 text-zinc-400 bg-zinc-500/10">
                0.0%
              </Badge>
            </TooltipTrigger>
            <TooltipContent>0.0% Filter Enabled</TooltipContent>
          </Tooltip>
        )}

        {/* Float Ranks between 0.0% and BG */}
        {floatRankGold && (
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-[#eab308]/50 text-[#eab308] bg-[#eab308]/10 flex items-center gap-0.5">
                <span className="font-serif italic text-[8px] opacity-70">ƒ</span>#1
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Float Rank #1 (Gold)</TooltipContent>
          </Tooltip>
        )}
        {floatRankSilver && (
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-[#a1a1aa]/50 text-[#a1a1aa] bg-[#a1a1aa]/10 flex items-center gap-0.5">
                <span className="font-serif italic text-[8px] opacity-70">ƒ</span>#2-3
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Float Rank #2-3 (Silver)</TooltipContent>
          </Tooltip>
        )}
        {floatRankBronze && (
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-[#b45309]/50 text-[#b45309] bg-[#b45309]/10 flex items-center gap-0.5">
                <span className="font-serif italic text-[8px] opacity-70">ƒ</span>#4-5
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Float Rank #4-5 (Bronze)</TooltipContent>
          </Tooltip>
        )}

        {blueGem && (
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-sky-400/50 text-sky-400 bg-sky-500/10 flex items-center gap-0.5">
                <span>BG</span>
                {blueGemTier && <span className="font-black">{blueGemTier.charAt(0)}</span>}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Blue Gem{blueGemTier ? ` — ${blueGemTier}` : ' Analysis Enabled'}</TooltipContent>
          </Tooltip>
        )}

        {fireAndIce && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="relative inline-flex items-center justify-center h-4 w-4 rounded-[3px] overflow-hidden fire-ice-shimmer border border-transparent text-[9px] font-bold leading-none text-white cursor-default"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(13,31,74,0.95) 0%, rgba(34,20,82,0.9) 35%, rgba(88,21,21,0.92) 65%, rgba(139,25,25,0.9) 100%) padding-box, linear-gradient(135deg, #2563eb, #7c3aed, #dc2626, #991b1b) border-box',
                  backgroundClip: 'padding-box, border-box',
                  backgroundOrigin: 'padding-box, border-box',
                  textShadow: '0 0 3px rgba(0,0,0,0.7)',
                }}
              >
                {fireAndIceTier ? fireAndIceTier.charAt(0) : (
                  <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="2.5,6.5 5,9 9.5,3.5" />
                  </svg>
                )}
              </span>
            </TooltipTrigger>
            <TooltipContent>Fire &amp; Ice{fireAndIceTier ? ` — ${fireAndIceTier}` : ''}</TooltipContent>
          </Tooltip>
        )}
      </div>
    );
  };

  const DiscountOverpayCell = ({ min, max }: { min?: number; max?: number }) => {
    const hasFilter = min !== undefined && max !== undefined && (min !== 0 || max !== 0);
    const overpayVal = max ?? 0;
    const discountVal = min ?? 0;

    return (
      <div
        className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-md ${!hasFilter ? 'opacity-30' : ''}`}
        style={{
          background: 'linear-gradient(180deg, rgba(239, 68, 68, 0.15) 0%, rgba(34, 197, 94, 0.15) 100%)',
          border: '1px solid rgba(100, 100, 100, 0.3)'
        }}
      >
        {/* Overpay (max) - top */}
        <div className={`flex items-center gap-0.5 ${hasFilter && overpayVal === 0 ? 'opacity-30' : ''}`}>
          {overpayVal >= 0 ? (
            <Plus className="h-2.5 w-2.5" style={{ color: 'hsl(0 75% 50%)', strokeWidth: 3 }} />
          ) : (
            <Minus className="h-2.5 w-2.5" style={{ color: 'hsl(142 70% 45%)', strokeWidth: 3 }} />
          )}
          <span
            className="text-[10px] font-mono font-medium"
            style={{ color: overpayVal >= 0 ? 'hsl(0 75% 55%)' : 'hsl(142 70% 50%)' }}
          >
            {Math.abs(overpayVal)}%
          </span>
        </div>
        {/* Discount (min) - bottom */}
        <div className={`flex items-center gap-0.5 ${hasFilter && discountVal === 0 ? 'opacity-30' : ''}`}>
          {discountVal >= 0 ? (
            <Plus className="h-2.5 w-2.5" style={{ color: 'hsl(0 75% 50%)', strokeWidth: 3 }} />
          ) : (
            <Minus className="h-2.5 w-2.5" style={{ color: 'hsl(142 70% 45%)', strokeWidth: 3 }} />
          )}
          <span
            className="text-[10px] font-mono font-medium"
            style={{ color: discountVal >= 0 ? 'hsl(0 75% 55%)' : 'hsl(142 70% 50%)' }}
          >
            {Math.abs(discountVal)}%
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <h1 className="text-2xl font-bold text-foreground mb-2">Target Skins Manager</h1>
        <p className="text-sm text-muted-foreground">
          Manage your target filters. Hover over cells for details.
        </p>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/30 hover:bg-secondary/30">
                <TableHead className="w-[200px] text-xs">Item Name</TableHead>
                <TableHead className="w-[90px] text-xs">Price</TableHead>
                <TableHead className="w-[80px] text-xs">Disc/Over</TableHead>
                <TableHead className="w-[70px] text-xs">Paint Seed</TableHead>
                <TableHead className="w-[140px] text-xs">Patterns</TableHead>
                <TableHead className="w-[100px] text-xs">Float</TableHead>
                <TableHead className="w-[100px] text-xs">Stickers</TableHead>
                <TableHead className="w-[90px] text-xs">Overpay</TableHead>
                <TableHead className="w-[80px] text-xs">Custom</TableHead>
                <TableHead className="w-[140px] text-xs text-center">ACTIONS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {targets.map((target) => (
                <TableRow key={target.id} className="hover:bg-muted/30">
                  {/* Item Name */}
                  <TableCell className="font-medium text-sm">
                    <span className={target.itemName === '*' ? 'text-accent' : ''}>
                      {target.itemName}
                      {target.phase && target.phase !== "0" && (
                        <span className="ml-1 font-normal font-mono text-xs" style={{ color: getPhaseColor(target.itemName, target.phase) }}>
                          ({target.phase.replace("Phase ", "P")})
                        </span>
                      )}
                    </span>
                  </TableCell>

                  {/* Order Price */}
                  <TableCell>
                    <span className="text-sm font-mono text-emerald-400">
                      ${target.orderPrice.toLocaleString()}
                    </span>
                  </TableCell>

                  {/* Discount/Overpay */}
                  <TableCell>
                    <DiscountOverpayCell min={target.discountOverpayMin} max={target.discountOverpayMax} />
                  </TableCell>

                  {/* Paint Seed */}
                  <TableCell>
                    <PaintSeedCell seeds={target.seeds} paintSeeds={target.paintSeeds} />
                  </TableCell>

                  {/* Patterns - Fade & Blue Gem mini sliders */}
                  <TableCell>
                    <PatternsCell
                      blueGemMin={target.blueGemMin}
                      blueGemMax={target.blueGemMax}
                      fadeMin={target.fadeMin}
                      fadeMax={target.fadeMax}
                    />
                  </TableCell>

                  {/* Float Range */}
                  <TableCell>
                    <FloatCell min={target.minFloat} max={target.maxFloat} />
                  </TableCell>

                  {/* Stickers & Charms */}
                  <TableCell>
                    <StickersCell
                      stickers={target.stickers}
                      minPercent={target.stickersMinPercent}
                      maxPercent={target.stickersMaxPercent}
                      charmProfitEnabled={target.charmProfitEnabled}
                      charmProfitMin={target.charmProfitMin}
                      charmProfitMax={target.charmProfitMax}
                    />
                  </TableCell>

                  {/* Sticker Overpay */}
                  <TableCell>
                    <StickerOverpayCell
                      min={target.stickerOverpayMin}
                      max={target.stickerOverpayMax}
                    />
                  </TableCell>

                  {/* Custom */}
                  <TableCell>
                    <CustomCell
                      zeroFloat={target.zeroFloatEnabled}
                      blueGem={target.blueGemEnabled}
                      blueGemTier={target.blueGemTier}
                      floatRankGold={target.floatRankGold}
                      floatRankSilver={target.floatRankSilver}
                      floatRankBronze={target.floatRankBronze}
                      phase={target.phase}
                      special={target.special}
                      fireAndIce={target.fireAndIceEnabled}
                      fireAndIceTier={target.fireAndIceTier}
                    />
                  </TableCell>

                  {/* Actions - 4 buttons as shown in screenshot */}
                  <TableCell>
                    <div className="flex items-center justify-center gap-2">
                      {/* Notify Toggle */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <Checkbox
                              checked={target.notifyEnabled}
                              onCheckedChange={() => toggleNotify(target.id)}
                              className={cn(
                                "h-5 w-5 border-2",
                                target.notifyEnabled
                                  ? "border-primary data-[state=checked]:bg-primary"
                                  : "border-muted-foreground/50"
                              )}
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>Notify</TooltipContent>
                      </Tooltip>

                      {/* Auto Buy Toggle */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <Checkbox
                              checked={target.autoBuyEnabled}
                              onCheckedChange={() => toggleAutoBuy(target.id)}
                              className={cn(
                                "h-5 w-5 border-2",
                                target.autoBuyEnabled
                                  ? "border-emerald-500 data-[state=checked]:bg-emerald-500"
                                  : "border-muted-foreground/50"
                              )}
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>Auto Buy</TooltipContent>
                      </Tooltip>

                      {/* Move to Config */}
                      <DropdownMenu>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-primary/70 hover:text-primary hover:bg-primary/10"
                              >
                                <FolderInput className="h-4 w-4" />
                                <ChevronDown className="h-2.5 w-2.5 ml-0.5" />
                              </Button>
                            </DropdownMenuTrigger>
                          </TooltipTrigger>
                          <TooltipContent>Move to Config</TooltipContent>
                        </Tooltip>
                        <DropdownMenuContent align="end" className="bg-popover border-border">
                          {configs.map((config) => (
                            <DropdownMenuItem
                              key={config}
                              onClick={() => moveToConfig(target.id, config)}
                              className="cursor-pointer text-xs"
                            >
                              {config}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Delete */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                            onClick={() => deleteTarget(target.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};
