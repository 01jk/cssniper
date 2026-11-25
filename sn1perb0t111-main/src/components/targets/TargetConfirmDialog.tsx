import { useState, useEffect, useRef, useCallback } from "react";
import { 
  Check, X, Package, FolderOpen, Minus, Plus, 
  DollarSign, Sparkles, Tag, 
  Layers, Gem, Target, Percent, Star, Zap, ChevronDown, ChevronUp
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ActiveFilter } from "@/components/filters/ActiveFiltersPanel";
import { StickerFilter } from "@/components/filters/StickersCharmsTab";
import { FireIceVisual } from "@/components/filters/FireIceVisual";
import { BlueGemVisual } from "@/components/filters/BlueGemVisual";
import { cn } from "@/lib/utils";

// FilterData interface
interface FilterData {
  priceFrom: string;
  priceTo: string;
  isFixedPrice: boolean;
  fixedPriceConfirmed: boolean;
  fixedPricePending: string;
  rangePriceConfirmed: boolean;
  rangePriceFromPending: string;
  rangePriceToPending: string;
  wearMin: string;
  wearMax: string;
  activeWear: string[];
  fadeMin: string;
  fadeMax: string;
  blueMin: string;
  blueMax: string;
  blueGemEnabled: boolean;
  blueGemPercent: number;
  basePriceEnabled: boolean;
  basePricePercent: number;
  spStickerEnabled: boolean;
  spStickerPercentMin: number;
  spStickerPercentMax: number;
  stickersPricePercentEnabled?: boolean;
  stickersPricePercentMin?: string;
  stickersPricePercentMax?: string;
  customFilterEnabled: boolean;
  discountOverpayMin: number;
  discountOverpayMax: number;
  floatRankGold: boolean;
  floatRankSilver: boolean;
  floatRankBronze: boolean;
  fireAndIceEnabled?: boolean;
  fireAndIceTier?: '1st' | '2nd' | '3rd' | null;
  blueGemTier?: '1st' | '2nd' | '3rd' | null;
  statTrak: boolean;
  souvenir: boolean;
  highlight: boolean;
  normal: boolean;
  rarity: string;
  paintSeedMin: string;
  paintSeedMax: string;
  paintSeeds?: number[];
  stickers: StickerFilter[];
  selectedCharm?: string;
  charmPatternMin?: string;
  charmPatternMax?: string;
  selectedItem?: string;
  selectedItemType?: string;
  activePatternFilter?: 'fade' | 'blueGem' | null;
}

interface TargetConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: ActiveFilter[];
  filterData?: FilterData;
  onConfirm: (modifiedFilterData: FilterData) => void;
  onFilterRemove?: (filterId: string) => void;
  isUpdate?: boolean;
}

// Rarity config
const RARITY_CONFIG: Record<string, { label: string; color: string }> = {
  consumer: { label: "Consumer Grade", color: "#b0c3d9" },
  industrial: { label: "Industrial Grade", color: "#5e98d9" },
  milspec: { label: "Mil-Spec", color: "#4b69ff" },
  restricted: { label: "Restricted", color: "#8847ff" },
  classified: { label: "Classified", color: "#d32ce6" },
  covert: { label: "Covert", color: "#eb4b4b" },
  contraband: { label: "Contraband", color: "#e4ae33" },
};

// Wear colors
const getWearColor = (float: number): string => {
  if (float <= 0.07) return "#22a350";
  if (float <= 0.15) return "#7cb518";
  if (float <= 0.38) return "#b8c800";
  if (float <= 0.45) return "#e67e22";
  return "#a63232";
};

// Sticker overpay color
const getOverpayColor = (percent: number): string => {
  if (percent <= 25) {
    const t = percent / 25;
    const h = 142 - t * 62;
    return `hsl(${h}, 75%, 45%)`;
  } else if (percent <= 50) {
    const t = (percent - 25) / 25;
    const h = 80 - t * 35;
    return `hsl(${h}, 80%, 48%)`;
  } else if (percent <= 75) {
    const t = (percent - 50) / 25;
    const h = 45 - t * 20;
    return `hsl(${h}, 85%, 50%)`;
  } else {
    const t = (percent - 75) / 25;
    const h = 25 - t * 25;
    return `hsl(${h}, 80%, 48%)`;
  }
};

// Generate overpay gradient
const getOverpayGradientStyles = (minPercent: number, maxPercent: number) => {
  const minColor = getOverpayColor(minPercent);
  const maxColor = getOverpayColor(maxPercent);
  const midPercent = (minPercent + maxPercent) / 2;
  const midColor = getOverpayColor(midPercent);
  
  const minColorBg = minColor.replace(')', ', 0.2)').replace('hsl', 'hsla');
  const midColorBg = midColor.replace(')', ', 0.2)').replace('hsl', 'hsla');
  const maxColorBg = maxColor.replace(')', ', 0.25)').replace('hsl', 'hsla');
  
  return {
    bg: `linear-gradient(90deg, ${minColorBg} 0%, ${midColorBg} 50%, ${maxColorBg} 100%)`,
    textGradient: `linear-gradient(90deg, ${minColor}, ${midColor}, ${maxColor})`
  };
};

// Generate wear gradient
const getWearGradientStyles = (minFloat: number, maxFloat: number) => {
  const minColor = getWearColor(minFloat);
  const maxColor = getWearColor(maxFloat);
  const midFloat = (minFloat + maxFloat) / 2;
  const midColor = getWearColor(midFloat);
  
  return {
    bg: `linear-gradient(90deg, ${minColor}33 0%, ${midColor}33 50%, ${maxColor}33 100%)`,
    border: `linear-gradient(90deg, ${minColor}, ${midColor}, ${maxColor}) 1`,
    textGradient: `linear-gradient(90deg, ${minColor}, ${midColor}, ${maxColor})`
  };
};

const WEAR_TYPE_COLORS: Record<string, string> = {
  FN: "#22c55e",
  MW: "#a3e635",
  FT: "#facc15",
  WW: "#fb923c",
  BS: "#ef4444",
};

// Sticker type detection
const detectStickerType = (name: string): 'holo' | 'foil' | 'gold' | 'paper' => {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('(holo)')) return 'holo';
  if (lowerName.includes('(foil)')) return 'foil';
  if (lowerName.includes('(gold)')) return 'gold';
  return 'paper';
};

// Sticker type styling (matching buttons)
const getStickerTypeStyle = (type: 'holo' | 'foil' | 'gold' | 'paper') => {
  switch (type) {
    case 'holo':
      return {
        background: 'linear-gradient(135deg, rgba(147,51,234,0.2) 0%, rgba(168,85,247,0.25) 50%, rgba(192,132,252,0.2) 100%)',
        borderColor: '#a855f7',
        textColor: 'text-purple-400',
        badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-400/50',
        label: 'Holo',
        shimmerClass: 'holo-shimmer'
      };
    case 'foil':
      return {
        background: 'linear-gradient(135deg, rgba(148,163,184,0.2) 0%, rgba(203,213,225,0.25) 50%, rgba(148,163,184,0.2) 100%)',
        borderColor: '#94a3b8',
        textColor: 'text-slate-300',
        badgeClass: 'bg-slate-400/20 text-slate-200 border-slate-300/50',
        label: 'Foil',
        shimmerClass: 'foil-shimmer'
      };
    case 'gold':
      return {
        background: 'linear-gradient(135deg, rgba(234,179,8,0.2) 0%, rgba(250,204,21,0.25) 50%, rgba(234,179,8,0.2) 100%)',
        borderColor: '#eab308',
        textColor: 'text-yellow-400',
        badgeClass: 'bg-yellow-500/20 text-yellow-300 border-yellow-400/50',
        label: 'Gold',
        shimmerClass: 'gold-shimmer'
      };
    default:
      return {
        background: 'linear-gradient(135deg, rgba(100,116,139,0.15) 0%, rgba(148,163,184,0.2) 50%, rgba(100,116,139,0.15) 100%)',
        borderColor: '#64748b',
        textColor: 'text-slate-400',
        badgeClass: 'bg-slate-500/20 text-slate-300 border-slate-400/50',
        label: 'Paper',
        shimmerClass: ''
      };
  }
};

// Filter chip component with proper styling
interface FilterChipProps {
  children: React.ReactNode;
  onRemove?: () => void;
  className?: string;
  style?: React.CSSProperties;
  /** Color for the remove X — matches the theme/text next to it */
  xColor?: string;
}

const FilterChip = ({ children, onRemove, className, style, xColor }: FilterChipProps) => (
  <div
    className={cn(
      "relative flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-xs group transition-all border overflow-hidden w-full min-h-[38px]",
      onRemove ? "pr-8" : "",
      className
    )}
    style={style}
  >
    <div className="flex items-center justify-center gap-1.5 min-w-0 max-w-full">
      {children}
    </div>
    {onRemove && (
      <button
        onClick={onRemove}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-current/20 opacity-80 hover:opacity-100 transition-all shrink-0"
        style={xColor ? { color: xColor } : undefined}
      >
        <X className="h-3 w-3" />
      </button>
    )}
  </div>
);

// Section header
const SectionHeader = ({ icon, title, count }: { icon: React.ReactNode; title: string; count?: number }) => (
  <div className="flex items-center gap-2 mb-2 px-1">
    <span className="text-muted-foreground">{icon}</span>
    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{title}</span>
    {count !== undefined && count > 0 && (
      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
        {count}
      </span>
    )}
  </div>
);

// Paint Seeds Collapsible component
interface PaintSeedsCollapsibleProps {
  paintSeeds: number[];
  isSingle: boolean;
  onRemove: () => void;
}

const PaintSeedsCollapsible = ({ paintSeeds, isSingle, onRemove }: PaintSeedsCollapsibleProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // For single seed, just show the chip without expand functionality
  if (isSingle) {
    return (
      <FilterChip
        onRemove={onRemove}
        style={{
          background: 'linear-gradient(135deg, rgba(20,184,166,0.2) 0%, rgba(45,212,191,0.25) 50%, rgba(20,184,166,0.2) 100%)',
          borderImage: 'linear-gradient(135deg, #14b8a6, #2dd4bf, #14b8a6) 1'
        }}
      >
        <FolderOpen className="h-3.5 w-3.5 text-teal-400 shrink-0" />
        <span className="opacity-80 bg-gradient-to-r from-teal-400 to-teal-300 bg-clip-text text-transparent">Pattern:</span>
        <span className="font-semibold font-mono bg-gradient-to-r from-teal-300 via-teal-400 to-teal-300 bg-clip-text text-transparent">
          #{paintSeeds[0]}
        </span>
      </FilterChip>
    );
  }
  
  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div 
        className="flex items-center justify-between gap-1.5 px-2.5 py-2 rounded-lg text-xs group transition-all border relative overflow-hidden w-full min-h-[38px] cursor-pointer"
        style={{
          background: 'linear-gradient(135deg, rgba(20,184,166,0.2) 0%, rgba(45,212,191,0.25) 50%, rgba(20,184,166,0.2) 100%)',
          borderImage: 'linear-gradient(135deg, #14b8a6, #2dd4bf, #14b8a6) 1'
        }}
      >
        <CollapsibleTrigger asChild>
          <div className="flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity">
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex shrink-0">
                    <FolderOpen className="h-3.5 w-3.5 text-teal-400" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" align="start" className="max-w-[280px]">
                  <div className="text-xs space-y-1">
                    <div className="text-teal-400 font-medium mb-1.5">Paint Seeds ({paintSeeds.length}):</div>
                    <div className="flex flex-wrap gap-1">
                      {paintSeeds.slice(0, 20).map((seed) => (
                        <span key={seed} className="font-mono text-teal-300 px-1 py-0.5 rounded bg-teal-500/20">#{seed}</span>
                      ))}
                      {paintSeeds.length > 20 && (
                        <span className="text-muted-foreground">+{paintSeeds.length - 20} more</span>
                      )}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <span className="opacity-80 bg-gradient-to-r from-teal-400 to-teal-300 bg-clip-text text-transparent">Patterns:</span>
            <span className="font-semibold bg-gradient-to-r from-teal-300 via-teal-400 to-teal-300 bg-clip-text text-transparent">
              {paintSeeds.length} seeds
            </span>
            {isExpanded ? (
              <ChevronUp className="h-3 w-3 text-teal-400 ml-1" />
            ) : (
              <ChevronDown className="h-3 w-3 text-teal-400 ml-1" />
            )}
          </div>
        </CollapsibleTrigger>
        <button
          onClick={onRemove}
          className="p-0.5 rounded hover:bg-destructive/20 opacity-60 hover:opacity-100 hover:text-destructive transition-all shrink-0"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <CollapsibleContent>
        <div 
          className="mt-1 p-2 rounded-lg border overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(20,184,166,0.1) 0%, rgba(45,212,191,0.15) 50%, rgba(20,184,166,0.1) 100%)',
            borderColor: 'rgba(20,184,166,0.3)'
          }}
        >
          <div className="flex flex-wrap gap-1 max-h-[120px] overflow-y-auto custom-scrollbar">
            {paintSeeds.map((seed) => (
              <span 
                key={seed} 
                className="font-mono text-xs px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30"
              >
                #{seed}
              </span>
            ))}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export const TargetConfirmDialog = ({
  open,
  onOpenChange,
  filters,
  filterData,
  onConfirm,
  onFilterRemove,
  isUpdate = false,
}: TargetConfirmDialogProps) => {
  const [localFilterData, setLocalFilterData] = useState<FilterData | undefined>(filterData);
  const [stickersExpanded, setStickersExpanded] = useState(false);
  useEffect(() => {
    if (open && filterData) {
      setLocalFilterData({ ...filterData });
    }
  }, [open, filterData]);

  const data = localFilterData || filterData;
  const hasData = data !== undefined;

  const getConfirmedFilterData = useCallback(() => {
    if (!localFilterData) return undefined;

    const nextData = { ...localFilterData } as FilterData;
    const fireIceFilter = filters.find(filter => {
      const marker = `${filter.id} ${filter.type} ${filter.label} ${filter.value ?? ''}`.toLowerCase();
      return marker.includes('fireandice') || marker.includes('fire & ice') || marker.includes('fire ice') || marker.includes('f&i') || marker.includes('f & i');
    });

    if (fireIceFilter) {
      nextData.fireAndIceEnabled = true;
      nextData.fireAndIceTier = (fireIceFilter.value === '1st' || fireIceFilter.value === '2nd' || fireIceFilter.value === '3rd')
        ? fireIceFilter.value
        : null;
    } else {
      nextData.fireAndIceEnabled = false;
      nextData.fireAndIceTier = null;
    }

    const blueGemFilter = filters.find(filter => {
      const marker = `${filter.id} ${filter.type} ${filter.label}`.toLowerCase();
      return marker.includes('bluegem') || marker.includes('blue gem');
    });

    if (blueGemFilter) {
      nextData.blueGemEnabled = true;
      nextData.blueGemTier = (blueGemFilter.value === '1st' || blueGemFilter.value === '2nd' || blueGemFilter.value === '3rd')
        ? blueGemFilter.value
        : null;
    } else {
      nextData.blueGemEnabled = false;
      nextData.blueGemTier = null;
    }

    return nextData;
  }, [filters, localFilterData]);

  const handleRemoveFilter = (filterId: string) => {
    if (!localFilterData) return;
    
    const newData = { ...localFilterData };
    
    switch (filterId) {
      case "item": (newData as any).selectedItem = ""; break;
      case "price":
        newData.priceFrom = "10";
        newData.priceTo = "100000";
        newData.isFixedPrice = false;
        newData.fixedPriceConfirmed = false;
        newData.rangePriceConfirmed = false;
        break;
      case "wear": newData.wearMin = "0"; newData.wearMax = "1"; break;
      case "fade": newData.fadeMin = "80"; newData.fadeMax = "100"; break;
      case "blue": newData.blueMin = "0"; newData.blueMax = "100"; break;
      case "paintSeeds": newData.paintSeeds = []; break;
      case "paintSeed": 
        newData.paintSeedMin = "0"; 
        newData.paintSeedMax = "1000"; 
        break;
      case "customFilter": newData.customFilterEnabled = false; break;
      case "blueGem":
        newData.blueGemEnabled = false;
        (newData as any).blueGemTier = null;
        try {
          localStorage.setItem('target-manager-blue-gem-filter-state', JSON.stringify({ enabled: false, tier: null, updatedAt: Date.now() }));
        } catch {
          // ignore storage failures
        }
        break;
      case "stickersPricePercent":
      case "spSticker":
        newData.spStickerEnabled = false;
        newData.spStickerPercentMin = 0;
        newData.spStickerPercentMax = 100;
        if (newData.stickersPricePercentEnabled !== undefined) {
          newData.stickersPricePercentEnabled = false;
          newData.stickersPricePercentMin = "0";
          newData.stickersPricePercentMax = "100";
        }
        break;
      case "discount": newData.discountOverpayMin = 0; newData.discountOverpayMax = 0; break;
      case "statTrak": newData.statTrak = false; break;
      case "souvenir": newData.souvenir = false; break;
      case "highlight": newData.highlight = false; break;
      case "floatRankGold": newData.floatRankGold = false; break;
      case "floatRankSilver": newData.floatRankSilver = false; break;
      case "floatRankBronze": newData.floatRankBronze = false; break;
      case "fireAndIce":
        newData.fireAndIceEnabled = false;
        newData.fireAndIceTier = null;
        try {
          localStorage.setItem('target-manager-fire-ice-filter-state', JSON.stringify({ enabled: false, tier: null, updatedAt: Date.now() }));
        } catch {
          // ignore storage failures
        }
        break;
      case "rarity": newData.rarity = ""; break;
      case "charm": (newData as any).selectedCharm = ""; break;
      case "wearType": newData.activeWear = []; break;
      default:
        if (filterId.startsWith("wearType-")) {
          const wear = filterId.replace("wearType-", "");
          newData.activeWear = newData.activeWear.filter(w => w !== wear);
        }
        if (filterId.startsWith("sticker-")) {
          const index = parseInt(filterId.replace("sticker-", ""));
          newData.stickers = newData.stickers.map((s, i) => 
            i === index ? { name: "", slot: "any", isWhole: true, price: 0 } : s
          );
        }
        break;
    }
    
    setLocalFilterData(newData);
    onFilterRemove?.(filterId);
  };

  // Build all filter chips
  const buildChips = () => {
    if (!data) return { item: null, pricing: [], wear: [], patterns: [], stickers: [], special: [] };
    
    const sections = {
      item: null as React.ReactNode,
      pricing: [] as React.ReactNode[],
      wear: [] as React.ReactNode[],
      patterns: [] as React.ReactNode[],
      stickers: [] as React.ReactNode[],
      special: [] as React.ReactNode[],
    };

    // Item - cyan gradient (matching Active Filters)
    const selectedItem = data.selectedItem || "";
    if (selectedItem) {
      sections.item = (
        <FilterChip
          key="item"
          onRemove={() => handleRemoveFilter("item")}
          style={{
            background: 'linear-gradient(90deg, rgba(6,182,212,0.15) 0%, rgba(34,211,238,0.2) 50%, rgba(6,182,212,0.15) 100%)',
            borderImage: 'linear-gradient(90deg, #06b6d4, #22d3ee, #06b6d4) 1'
          }}
        >
          <Target className="h-3.5 w-3.5 text-cyan-400" />
          <span className="font-medium bg-gradient-to-r from-cyan-400 via-cyan-300 to-cyan-400 bg-clip-text text-transparent">
            {selectedItem}
          </span>
        </FilterChip>
      );
    }

    // Price - emerald to gold shimmer
    // Only show price if confirmed (explicitly set by user)
    const hasPriceSet = data.fixedPriceConfirmed || data.rangePriceConfirmed;
    if (hasPriceSet && data.priceFrom !== "") {
      const priceValue = data.isFixedPrice ? `$${data.priceFrom}` : `$${data.priceFrom} — $${data.priceTo}`;
      sections.pricing.push(
        <FilterChip
          key="price"
          onRemove={() => handleRemoveFilter("price")}
          style={{
            background: 'linear-gradient(90deg, rgba(16,185,129,0.2) 0%, rgba(52,211,153,0.2) 25%, rgba(234,179,8,0.2) 50%, rgba(251,191,36,0.25) 75%, rgba(16,185,129,0.2) 100%)',
            borderImage: 'linear-gradient(90deg, #10b981, #34d399, #eab308, #fbbf24, #10b981) 1'
          }}
        >
          <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
          <span className="opacity-70 bg-gradient-to-r from-emerald-400 via-yellow-400 to-emerald-400 bg-clip-text text-transparent">
            {data.isFixedPrice ? 'Fixed:' : 'Range:'}
          </span>
          <span className="font-medium bg-gradient-to-r from-emerald-400 via-yellow-400 to-emerald-400 bg-clip-text text-transparent">
            {priceValue}
          </span>
        </FilterChip>
      );
    }

    // Discount/Overpay
    const isDiscountModified = data.discountOverpayMin !== 0 || data.discountOverpayMax !== 0;
    if (isDiscountModified) {
      const minVal = data.discountOverpayMin;
      const maxVal = data.discountOverpayMax;
      const minColor = minVal < 0 ? 'hsl(142, 70%, 45%)' : minVal > 0 ? 'hsl(0, 75%, 50%)' : 'hsl(var(--muted-foreground))';
      const maxColor = maxVal < 0 ? 'hsl(142, 70%, 45%)' : maxVal > 0 ? 'hsl(0, 75%, 50%)' : 'hsl(var(--muted-foreground))';
      
      sections.pricing.push(
        <FilterChip
          key="discount"
          onRemove={() => handleRemoveFilter("discount")}
          style={{
            background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.2) 0%, rgba(34, 197, 94, 0.2) 100%)',
            borderColor: 'rgba(150, 150, 150, 0.3)'
          }}
        >
          <div className="flex items-center gap-0.5" style={{ color: maxColor }}>
            {maxVal >= 0 ? <Plus className="h-3.5 w-3.5" strokeWidth={3} /> : <Minus className="h-3.5 w-3.5" strokeWidth={3} />}
            <span className="font-bold">{Math.abs(maxVal).toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-0.5" style={{ color: minColor }}>
            {minVal <= 0 ? <Minus className="h-3.5 w-3.5" strokeWidth={3} /> : <Plus className="h-3.5 w-3.5" strokeWidth={3} />}
            <span className="font-bold">{Math.abs(minVal).toFixed(1)}%</span>
          </div>
        </FilterChip>
      );
    }

    // Wear range - dynamic gradient
    const isWearModified = data.wearMin !== "0" || data.wearMax !== "1";
    if (isWearModified) {
      const wearStyles = getWearGradientStyles(parseFloat(data.wearMin), parseFloat(data.wearMax));
      sections.wear.push(
        <FilterChip
          key="wear"
          onRemove={() => handleRemoveFilter("wear")}
          style={{
            background: wearStyles.bg,
            borderImage: wearStyles.border
          }}
        >
          <span className="opacity-70 bg-clip-text text-transparent" style={{ backgroundImage: wearStyles.textGradient }}>
            Float:
          </span>
          <span className="font-medium bg-clip-text text-transparent" style={{ backgroundImage: wearStyles.textGradient }}>
            {data.wearMin} — {data.wearMax}
          </span>
        </FilterChip>
      );
    }

    // Wear types
    data.activeWear.forEach(wear => {
      const color = WEAR_TYPE_COLORS[wear];
      sections.wear.push(
        <FilterChip
          key={`wearType-${wear}`}
          onRemove={() => handleRemoveFilter(`wearType-${wear}`)}
          style={{
            backgroundColor: `${color}20`,
            borderColor: `${color}50`,
            color: color
          }}
        >
          <span className="font-bold">{wear}</span>
        </FilterChip>
      );
    });

    // Fade - animated gradient with shimmer
    const isFadeModified = data.fadeMin !== "80" || data.fadeMax !== "100";
    if (isFadeModified) {
      sections.patterns.push(
        <FilterChip
          key="fade"
          onRemove={() => handleRemoveFilter("fade")}
          className="fade-chip-shimmer"
          style={{
            background: 'linear-gradient(90deg, rgba(202,138,4,0.15) 0%, rgba(234,88,12,0.18) 15%, rgba(234,88,12,0.2) 30%, rgba(244,63,94,0.2) 50%, rgba(217,70,239,0.18) 70%, rgba(168,85,247,0.18) 85%, rgba(139,92,246,0.15) 100%)',
            borderImage: 'linear-gradient(90deg, hsl(45,70%,50%), hsl(35,75%,55%), hsl(25,80%,55%), hsl(350,70%,60%), hsl(330,65%,55%), hsl(300,60%,50%), hsl(280,55%,45%)) 1'
          }}
        >
          <span 
            className="opacity-80 font-medium bg-clip-text text-transparent"
            style={{ 
              backgroundImage: 'linear-gradient(90deg, hsl(45,70%,50%), hsl(35,75%,55%), hsl(25,80%,55%), hsl(350,70%,60%), hsl(330,65%,55%), hsl(300,60%,50%), hsl(280,55%,45%))',
              backgroundSize: '200% 100%',
              animation: 'fade-text-shimmer 3s ease-in-out infinite'
            }}
          >
            Fade:
          </span>
          <span 
            className="font-medium bg-clip-text text-transparent"
            style={{ 
              backgroundImage: 'linear-gradient(90deg, hsl(45,70%,50%), hsl(35,75%,55%), hsl(25,80%,55%), hsl(350,70%,60%), hsl(330,65%,55%), hsl(300,60%,50%), hsl(280,55%,45%))',
              backgroundSize: '200% 100%',
              animation: 'fade-text-shimmer 3s ease-in-out infinite'
            }}
          >
            {data.fadeMin}% — {data.fadeMax}%
          </span>
        </FilterChip>
      );
    }

    // Blue % - ice blue gradient with sparkle
    const isBlueModified = data.blueMin !== "0" || data.blueMax !== "100";
    if (isBlueModified) {
      sections.patterns.push(
        <FilterChip
          key="blue"
          onRemove={() => handleRemoveFilter("blue")}
          className="blue-gem-chip-sparkle"
          style={{
            background: 'linear-gradient(90deg, rgba(14,116,144,0.15) 0%, rgba(6,182,212,0.18) 25%, rgba(34,211,238,0.2) 50%, rgba(103,232,249,0.18) 75%, rgba(207,250,254,0.15) 100%)',
            borderImage: 'linear-gradient(90deg, #0e7490, #06b6d4, #22d3ee, #67e8f9, #cffafe) 1'
          }}
        >
          <Gem className="h-3.5 w-3.5 text-cyan-400" />
          <span 
            className="opacity-80 font-medium bg-clip-text text-transparent"
            style={{ backgroundImage: 'linear-gradient(90deg, #0e7490, #06b6d4, #22d3ee, #67e8f9, #cffafe)' }}
          >
            Blue:
          </span>
          <span 
            className="font-medium bg-clip-text text-transparent"
            style={{ backgroundImage: 'linear-gradient(90deg, #0e7490, #06b6d4, #22d3ee, #67e8f9, #cffafe)' }}
          >
            {data.blueMin}% — {data.blueMax}%
          </span>
        </FilterChip>
      );
    }

    // Paint Seeds - show single seed directly or "Patterns: X seeds" for multiple
    const paintSeeds = data.paintSeeds || [];
    if (paintSeeds.length > 0) {
      const isSingle = paintSeeds.length === 1;
      
      sections.patterns.push(
        <PaintSeedsCollapsible 
          key="paintSeeds"
          paintSeeds={paintSeeds}
          isSingle={isSingle}
          onRemove={() => handleRemoveFilter("paintSeeds")}
        />
      );
    }

    // 0.0% Filter - metallic silver
    if (data.customFilterEnabled) {
      sections.patterns.push(
        <FilterChip
          key="customFilter"
          onRemove={() => handleRemoveFilter("customFilter")}
          className="metallic-shimmer"
          style={{
            background: 'linear-gradient(135deg, rgba(113,113,122,0.25) 0%, rgba(161,161,170,0.2) 25%, rgba(212,212,216,0.15) 50%, rgba(161,161,170,0.2) 75%, rgba(113,113,122,0.25) 100%)',
            borderImage: 'linear-gradient(135deg, #71717a, #a1a1aa, #d4d4d8, #a1a1aa, #71717a) 1'
          }}
        >
          <Percent className="h-3.5 w-3.5 text-zinc-400" />
          <span className="font-medium bg-gradient-to-r from-zinc-400 via-zinc-300 to-zinc-400 bg-clip-text text-transparent">0.0%</span>
        </FilterChip>
      );
    }

    // Blue Gem Filter — matches CustomFilterTab selected button (icy crystal sticker)
    if (data.blueGemEnabled) {
      sections.patterns.push(
        <div key="blueGem" className="flex w-full">
          <BlueGemVisual
            tier={data.blueGemTier ?? null}
            extra={`${data.blueGemPercent.toFixed(1)}%`}
            size="main"
            className="w-full"
            onRemove={() => handleRemoveFilter("blueGem")}
          />
        </div>
      );
    }

    // Fire & Ice — matches CustomFilterTab main button visual
    if (data.fireAndIceEnabled) {
      sections.patterns.push(
        <div key="fireAndIce" className="flex w-full">
          <FireIceVisual
            tier={data.fireAndIceTier ?? null}
            size="main"
            className="w-full"
            onRemove={() => handleRemoveFilter("fireAndIce")}
          />
        </div>
      );
    }


    // Sticker % - dynamic overpay gradient (show if enabled OR if values differ from defaults)
    const stickersPriceMinVal = data.stickersPricePercentMin !== undefined ? parseFloat(data.stickersPricePercentMin || "0") : 0;
    const stickersPriceMaxVal = data.stickersPricePercentMax !== undefined ? parseFloat(data.stickersPricePercentMax || "100") : 100;

    const isStickerPercentModified = data.spStickerEnabled || 
      data.spStickerPercentMin !== 0 || data.spStickerPercentMax !== 100 ||
      data.stickersPricePercentEnabled ||
      stickersPriceMinVal !== 0 || stickersPriceMaxVal !== 100;
    
    if (isStickerPercentModified) {
      const isSp = (data.spStickerPercentMin !== 0 || data.spStickerPercentMax !== 100);
      const minVal = isSp ? data.spStickerPercentMin : stickersPriceMinVal;
      const maxVal = isSp ? data.spStickerPercentMax : stickersPriceMaxVal;

      const overpayStyles = getOverpayGradientStyles(minVal, maxVal);
      const avgPercent = (minVal + maxVal) / 2;
      const avgColor = getOverpayColor(avgPercent);
      
      sections.patterns.push(
        <FilterChip
          key="stickersPricePercent"
          onRemove={() => handleRemoveFilter("stickersPricePercent")}
          style={{
            background: overpayStyles.bg,
            borderColor: `${avgColor}50`
          }}
        >
          <Percent className="h-3.5 w-3.5" style={{ color: avgColor }} />
          <span className="opacity-70 bg-clip-text text-transparent" style={{ backgroundImage: overpayStyles.textGradient }}>
            {isSp ? "SP%:" : "Sticker Price:"}
          </span>
          <span className="font-medium bg-clip-text text-transparent" style={{ backgroundImage: overpayStyles.textGradient }}>
            {minVal.toFixed(1)}% — {maxVal.toFixed(1)}%
          </span>
        </FilterChip>
      );
    }

    // Stickers - store data for collapsible section (not as chips in the main flow)
    // We'll render them separately in the UI
    const activeStickers = data.stickers.filter(s => s.name.trim());
    // Don't add to sections.stickers - we'll handle stickers separately in the UI

    // Charm - purple gradient
    const selectedCharm = data.selectedCharm || "";
    if (selectedCharm) {
      const charmName = selectedCharm.replace(/^Charm \| /, '');
      const charmPatternMin = data.charmPatternMin || "1";
      const charmPatternMax = data.charmPatternMax || "100000";
      const hasPattern = charmPatternMin !== "1" || charmPatternMax !== "100000";
      
      sections.stickers.push(
        <FilterChip
          key="charm"
          onRemove={() => handleRemoveFilter("charm")}
          style={{
            backgroundColor: 'rgba(168, 85, 247, 0.2)',
            borderColor: 'rgba(168, 85, 247, 0.5)',
            color: '#a855f7'
          }}
        >
          <span className="font-medium">{charmName}</span>
          {hasPattern && (
            <span className="text-[10px] opacity-70">#{charmPatternMin}-{charmPatternMax}</span>
          )}
        </FilterChip>
      );
    }

    // StatTrak - orange with glow
    if (data.statTrak) {
      sections.special.push(
        <FilterChip
          key="statTrak"
          onRemove={() => handleRemoveFilter("statTrak")}
          style={{
            backgroundColor: 'rgba(207, 106, 50, 0.2)',
            borderColor: 'rgba(207, 106, 50, 0.5)',
            color: '#cf6a32'
          }}
        >
          <Zap className="h-3.5 w-3.5" />
          <span className="font-semibold">StatTrak™</span>
        </FilterChip>
      );
    }

    // Souvenir - golden shimmer
    if (data.souvenir) {
      sections.special.push(
        <FilterChip
          key="souvenir"
          onRemove={() => handleRemoveFilter("souvenir")}
          className="souvenir-shimmer"
          style={{
            background: 'linear-gradient(135deg, rgba(216,208,96,0.15) 0%, rgba(200,192,80,0.2) 25%, rgba(224,216,104,0.25) 50%, rgba(200,192,80,0.2) 75%, rgba(216,208,96,0.15) 100%)',
            borderImage: 'linear-gradient(135deg, #d8d060, #c8c050, #e4dc70, #c8c050, #d8d060) 1'
          }}
        >
          <Star className="h-3.5 w-3.5" style={{ color: '#d8d060' }} />
          <span 
            className="font-semibold bg-clip-text text-transparent"
            style={{ 
              backgroundImage: 'linear-gradient(90deg, #d8d060, #c8c050, #e4dc70, #c8c050, #d8d060)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 2s linear infinite'
            }}
          >
            Souvenir
          </span>
        </FilterChip>
      );
    }

    // Highlight - amber
    if (data.highlight) {
      sections.special.push(
        <FilterChip
          key="highlight"
          onRemove={() => handleRemoveFilter("highlight")}
          style={{
            backgroundColor: 'rgba(251, 191, 36, 0.15)',
            borderColor: 'rgba(251, 191, 36, 0.4)',
            color: '#fbbf24'
          }}
        >
          <Star className="h-3.5 w-3.5" />
          <span className="font-medium">Highlight</span>
        </FilterChip>
      );
    }

    // Float Rank - metallic chips
    const floatRanks: { key: string; rank: string; label: string; bg: string; border: string; textGradient: string; shineClass: string }[] = [];
    if (data.floatRankGold) floatRanks.push({ key: 'floatRankGold', rank: 'gold', label: 'ƒ #1', bg: 'linear-gradient(135deg, hsl(43 80% 25%) 0%, hsl(45 85% 35%) 25%, hsl(48 90% 45%) 50%, hsl(45 85% 35%) 75%, hsl(43 80% 25%) 100%)', border: '#eab308', textGradient: 'linear-gradient(180deg, hsl(48 95% 75%), hsl(43 90% 55%), hsl(38 85% 40%))', shineClass: 'float-rank-shine-gold' });
    if (data.floatRankSilver) floatRanks.push({ key: 'floatRankSilver', rank: 'silver', label: 'ƒ #2-3', bg: 'linear-gradient(135deg, hsl(220 10% 30%) 0%, hsl(220 12% 45%) 25%, hsl(220 15% 55%) 50%, hsl(220 12% 45%) 75%, hsl(220 10% 30%) 100%)', border: '#a1a1aa', textGradient: 'linear-gradient(180deg, hsl(220 15% 80%), hsl(220 12% 60%), hsl(220 10% 45%))', shineClass: 'float-rank-shine-silver' });
    if (data.floatRankBronze) floatRanks.push({ key: 'floatRankBronze', rank: 'bronze', label: 'ƒ #4-5', bg: 'linear-gradient(135deg, hsl(25 70% 22%) 0%, hsl(28 75% 32%) 25%, hsl(30 80% 40%) 50%, hsl(28 75% 32%) 75%, hsl(25 70% 22%) 100%)', border: '#b45309', textGradient: 'linear-gradient(180deg, hsl(30 80% 65%), hsl(25 75% 45%), hsl(20 70% 30%))', shineClass: 'float-rank-shine-bronze' });
    
    floatRanks.forEach(fr => {
      sections.special.push(
        <FilterChip
          key={fr.key}
          onRemove={() => handleRemoveFilter(fr.key)}
          className={fr.shineClass}
          style={{
            background: fr.bg,
            borderColor: `${fr.border}80`,
          }}
        >
          <span 
            className="font-black text-sm bg-clip-text text-transparent"
            style={{ backgroundImage: fr.textGradient }}
          >
            {fr.label}
          </span>
        </FilterChip>
      );
    });

    if (data.rarity) {
      const rarityConfig = RARITY_CONFIG[data.rarity];
      if (rarityConfig) {
        sections.special.push(
          <FilterChip
            key="rarity"
            onRemove={() => handleRemoveFilter("rarity")}
            style={{
              backgroundColor: `${rarityConfig.color}20`,
              borderColor: `${rarityConfig.color}50`,
              color: rarityConfig.color
            }}
          >
            <Layers className="h-3.5 w-3.5" />
            <span className="font-medium">{rarityConfig.label}</span>
          </FilterChip>
        );
      }
    }

    return sections;
  };

  const sections = hasData ? buildChips() : { item: null, pricing: [], wear: [], patterns: [], stickers: [], special: [] };
  
  // Get active stickers for the collapsible section
  const activeStickers = hasData && data ? data.stickers.filter(s => s.name.trim()) : [];
  const stickerCount = activeStickers.length;
  
  const totalFilters = filters.length;
  const hasFilters = totalFilters > 0;

  // Fallback for old behavior
  if (!hasData) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-card border-border max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Check className="h-5 w-5 text-accent" />
              {isUpdate ? 'Confirm Update' : 'Confirm Target'}
            </DialogTitle>
          </DialogHeader>

          <div className="py-4 flex-1 min-h-0 overflow-hidden">
            {filters.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground mb-4">
                  Review filters before adding to target list:
                </p>
                <ScrollArea className="h-[calc(100%-2rem)] max-h-[400px]">
                  <div className="flex flex-wrap gap-2 pr-4">
                    {filters.map((filter) => (
                      <div
                        key={filter.id}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-secondary/20 border-border text-sm"
                      >
                        <span className="font-medium">{filter.label}</span>
                        {filter.value && (
                          <span className="text-muted-foreground">{filter.value}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            ) : (
              <div className="text-center py-8">
                <div className="text-muted-foreground text-sm">No filters selected.</div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              <X className="h-4 w-4 mr-2" />Cancel
            </Button>
            <Button 
              onClick={() => {
                const confirmedData = getConfirmedFilterData();
                if (confirmedData) {
                  onConfirm(confirmedData);
                }
              }} 
              disabled={filters.length === 0} 
              className="flex-1 bg-accent hover:bg-accent/90"
            >
              <Check className="h-4 w-4 mr-2" />{isUpdate ? 'Update' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[85vh] flex flex-col overflow-hidden [&>button]:hidden">
        <DialogHeader className="shrink-0 pb-3 border-b border-border">
          <DialogTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-accent/20">
              <Target className="h-5 w-5 text-accent" />
            </div>
            {isUpdate ? 'Update Target' : 'Confirm Target'}
            <span className="ml-auto text-xs px-2 py-1 rounded-full bg-primary/20 text-primary font-medium">
              {totalFilters} filter{totalFilters !== 1 ? 's' : ''}
            </span>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 -mx-6 px-6">
          <div className="py-4 space-y-3">
            {hasFilters ? (
              <>
                {/* Synced with Active Filters: render exactly what's provided via `filters` with matching styles */}
                {(() => {
                  const visibleCount = filters.filter(f => f.type !== "sticker" && f.type !== "stickersStack").length;
                  const gridCols = visibleCount <= 1 ? "grid-cols-1" : "grid-cols-2";
                  return (
                <div className={cn("grid gap-2 auto-rows-fr", gridCols)}>
                  {filters.map((filter) => {
                    // Price chip - emerald to gold shimmer
                    if (filter.type === "price") {
                      return (
                        <div key={filter.id} className="flex">
                          <FilterChip
                            onRemove={() => handleRemoveFilter(filter.id)}
                            xColor="#10b981"
                            style={{
                              background: 'linear-gradient(90deg, rgba(16,185,129,0.2) 0%, rgba(52,211,153,0.2) 25%, rgba(234,179,8,0.2) 50%, rgba(251,191,36,0.25) 75%, rgba(16,185,129,0.2) 100%)',
                              borderImage: 'linear-gradient(90deg, #10b981, #34d399, #eab308, #fbbf24, #10b981) 1'
                            }}
                          >
                            <DollarSign className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                            <span className="opacity-70 bg-gradient-to-r from-emerald-400 via-yellow-400 to-emerald-400 bg-clip-text text-transparent truncate">{filter.label}:</span>
                            <span className="font-medium bg-gradient-to-r from-emerald-400 via-yellow-400 to-emerald-400 bg-clip-text text-transparent truncate">{filter.value}</span>
                          </FilterChip>
                        </div>
                      );
                    }
                    
                    // Wear chip - dynamic gradient
                    if (filter.type === "wear") {
                      const wearStyles = getWearGradientStyles(parseFloat(filter.value.split(" - ")[0] || "0"), parseFloat(filter.value.split(" - ")[1] || "1"));
                      return (
                        <div key={filter.id} className="flex">
                          <FilterChip
                            onRemove={() => handleRemoveFilter(filter.id)}
                            xColor={getWearColor((parseFloat(filter.value.split(" - ")[0]) + parseFloat(filter.value.split(" - ")[1])) / 2)}
                            style={{
                              background: wearStyles.bg,
                              borderImage: wearStyles.border
                          }}
                        >
                          <span className="opacity-70 bg-clip-text text-transparent truncate" style={{ backgroundImage: wearStyles.textGradient }}>{filter.label}:</span>
                          <span className="font-medium bg-clip-text text-transparent truncate" style={{ backgroundImage: wearStyles.textGradient }}>{filter.value}</span>
                        </FilterChip>
                        </div>
                      );
                    }
                    
                    // Wear type chips (FN, MW, etc.)
                    if (filter.type === "wearType") {
                      const wears = filter.value.split(", ");
                      return (
                        <div key={filter.id} className="flex">
                          <FilterChip
                            onRemove={() => handleRemoveFilter(filter.id)}
                            xColor="hsl(var(--muted-foreground))"
                            className="bg-secondary/30 border-border"
                          >
                            <div className="flex items-center gap-1">
                              {wears.map((wear) => {
                                const color = WEAR_TYPE_COLORS[wear];
                                return (
                                  <span key={wear} className="font-bold text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: `${color}30`, color }}>
                                    {wear}
                                  </span>
                                );
                              })}
                            </div>
                          </FilterChip>
                        </div>
                      );
                    }
                    
                    // Fade chip - rainbow shimmer
                    if (filter.type === "fade") {
                      return (
                        <div key={filter.id} className="flex">
                          <FilterChip
                            onRemove={() => handleRemoveFilter(filter.id)}
                            xColor="#d946ef"
                            className="fade-chip-shimmer"
                            style={{
                              background: 'linear-gradient(90deg, rgba(202,138,4,0.15) 0%, rgba(234,88,12,0.18) 15%, rgba(234,88,12,0.2) 30%, rgba(244,63,94,0.2) 50%, rgba(217,70,239,0.18) 70%, rgba(168,85,247,0.18) 85%, rgba(139,92,246,0.15) 100%)',
                            borderImage: 'linear-gradient(90deg, hsl(45,70%,50%), hsl(35,75%,55%), hsl(25,80%,55%), hsl(350,70%,60%), hsl(330,65%,55%), hsl(300,60%,50%), hsl(280,55%,45%)) 1'
                          }}
                        >
                          <span 
                            className="opacity-80 font-medium bg-clip-text text-transparent truncate"
                            style={{ 
                              backgroundImage: 'linear-gradient(90deg, hsl(45,70%,50%), hsl(35,75%,55%), hsl(25,80%,55%), hsl(350,70%,60%), hsl(330,65%,55%), hsl(300,60%,50%), hsl(280,55%,45%))',
                              backgroundSize: '200% 100%',
                              animation: 'fade-text-shimmer 3s ease-in-out infinite'
                            }}
                          >{filter.label}:</span>
                            <span 
                              className="font-medium bg-clip-text text-transparent truncate"
                              style={{ 
                                backgroundImage: 'linear-gradient(90deg, hsl(45,70%,50%), hsl(35,75%,55%), hsl(25,80%,55%), hsl(350,70%,60%), hsl(330,65%,55%), hsl(300,60%,50%), hsl(280,55%,45%))',
                                backgroundSize: '200% 100%',
                                animation: 'fade-text-shimmer 3s ease-in-out infinite'
                              }}
                            >{filter.value}</span>
                          </FilterChip>
                        </div>
                      );
                    }
                    
                    // Blue % chip — use Blue Gem visual icon + label + percent (matches Active Filters)
                    if (filter.type === "blue") {
                      return (
                        <div key={filter.id} className="flex w-full">
                          <BlueGemVisual
                            showLabel
                            extra={filter.value}
                            size="main"
                            className="w-full"
                            onRemove={() => handleRemoveFilter(filter.id)}
                          />
                        </div>
                      );
                    }
                    
                    // Blue Gem filter chip — matches CustomFilterTab selected button
                    if (filter.type === "blueGem") {
                      const rawTier = filter.value === '1st' || filter.value === '2nd' || filter.value === '3rd'
                        ? (filter.value as '1st' | '2nd' | '3rd')
                        : null;
                      const extra = rawTier ? undefined : (filter.value && filter.value !== 'Any' ? filter.value : undefined);
                      return (
                        <div key={filter.id} className="flex w-full">
                          <BlueGemVisual
                            tier={rawTier}
                            extra={extra}
                            size="main"
                            className="w-full"
                            onRemove={() => handleRemoveFilter(filter.id)}
                          />
                        </div>
                      );
                    }
                    
                    // Paint seed chip
                    if (filter.type === "paintSeed") {
                      return (
                        <div key={filter.id} className="flex">
                          <FilterChip
                            onRemove={() => handleRemoveFilter(filter.id)}
                            xColor="#2dd4bf"
                            style={{
                              background: 'linear-gradient(135deg, rgba(20,184,166,0.2) 0%, rgba(45,212,191,0.25) 50%, rgba(20,184,166,0.2) 100%)',
                              borderImage: 'linear-gradient(135deg, #14b8a6, #2dd4bf, #14b8a6) 1'
                            }}
                          >
                            <FolderOpen className="h-3.5 w-3.5 text-teal-400 shrink-0" />
                            <span className="opacity-80 bg-gradient-to-r from-teal-400 to-teal-300 bg-clip-text text-transparent truncate">{filter.label}:</span>
                            <span className="font-semibold font-mono bg-gradient-to-r from-teal-300 via-teal-400 to-teal-300 bg-clip-text text-transparent truncate">{filter.value}</span>
                          </FilterChip>
                        </div>
                      );
                    }
                    
                    // Custom filter (0.0%) chip
                    if (filter.type === "custom" && filter.label === "0.0%") {
                      return (
                        <div key={filter.id} className="flex">
                          <FilterChip
                            onRemove={() => handleRemoveFilter(filter.id)}
                            xColor="#a1a1aa"
                            className="metallic-shimmer"
                            style={{
                              background: 'linear-gradient(135deg, rgba(113,113,122,0.25) 0%, rgba(161,161,170,0.2) 25%, rgba(212,212,216,0.15) 50%, rgba(161,161,170,0.2) 75%, rgba(113,113,122,0.25) 100%)',
                              borderImage: 'linear-gradient(135deg, #71717a, #a1a1aa, #d4d4d8, #a1a1aa, #71717a) 1'
                            }}
                          >
                            {/* Metallic circle icon with minus */}
                            <div 
                              className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                              style={{
                                background: 'linear-gradient(135deg, #71717a 0%, #a1a1aa 30%, #d4d4d8 50%, #a1a1aa 70%, #71717a 100%)',
                                boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.3), 0 1px 2px rgba(0,0,0,0.3)'
                              }}
                            >
                              <Minus className="h-2.5 w-2.5 text-zinc-800" strokeWidth={3} />
                            </div>
                            <span className="font-medium bg-gradient-to-r from-zinc-400 via-zinc-300 to-zinc-400 bg-clip-text text-transparent">{filter.label}</span>
                          </FilterChip>
                        </div>
                      );
                    }
                    
                    // Sticker % chip - dynamic overpay gradient
                    if (filter.type === "spSticker") {
                      const overpayStyles = getOverpayGradientStyles(0, 100);
                      const match = filter.value.match(/(\d+(?:\.\d+)?)%\s*-\s*(\d+(?:\.\d+)?)%/);
                      if (match) {
                        const minP = parseFloat(match[1]);
                        const maxP = parseFloat(match[2]);
                        const styles = getOverpayGradientStyles(minP, maxP);
                        const avgColor = getOverpayColor((minP + maxP) / 2);
                        return (
                          <div key={filter.id} className="flex">
                            <FilterChip
                              onRemove={() => handleRemoveFilter(filter.id)}
                              xColor={avgColor}
                              style={{
                                background: styles.bg,
                                borderColor: `${avgColor}50`
                              }}
                            >
                              <Percent className="h-3.5 w-3.5 shrink-0" style={{ color: avgColor }} />
                              <span className="opacity-70 bg-clip-text text-transparent truncate" style={{ backgroundImage: styles.textGradient }}>{filter.label}:</span>
                              <span className="font-medium bg-clip-text text-transparent truncate" style={{ backgroundImage: styles.textGradient }}>{filter.value}</span>
                            </FilterChip>
                          </div>
                        );
                      }
                    }
                    
                    // Discount/Overpay chip
                    if (filter.type === "discountOverpay") {
                      const [minStr, maxStr] = filter.value.split('|');
                      const minVal = parseFloat(minStr) || 0;
                      const maxVal = parseFloat(maxStr) || 0;
                      
                      // Single value when both are equal
                      if (minVal === maxVal) {
                        const color = minVal < 0 ? 'hsl(142, 70%, 45%)' : minVal > 0 ? 'hsl(0, 75%, 50%)' : 'hsl(var(--muted-foreground))';
                        return (
                          <div key={filter.id} className="flex">
                            <FilterChip
                              onRemove={() => handleRemoveFilter(filter.id)}
                              xColor={color}
                              style={{
                                background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.2) 0%, rgba(34, 197, 94, 0.2) 100%)',
                                borderColor: 'rgba(150, 150, 150, 0.3)'
                              }}
                            >
                              <div className="flex items-center gap-0.5" style={{ color }}>
                                {minVal >= 0 ? <Plus className="h-3.5 w-3.5" strokeWidth={3} /> : <Minus className="h-3.5 w-3.5" strokeWidth={3} />}
                                <span className="font-bold">{Math.abs(minVal).toFixed(1)}%</span>
                              </div>
                            </FilterChip>
                          </div>
                        );
                      }
                      
                      const minColor = minVal < 0 ? 'hsl(142, 70%, 45%)' : minVal > 0 ? 'hsl(0, 75%, 50%)' : 'hsl(var(--muted-foreground))';
                      const maxColor = maxVal < 0 ? 'hsl(142, 70%, 45%)' : maxVal > 0 ? 'hsl(0, 75%, 50%)' : 'hsl(var(--muted-foreground))';
                      return (
                        <div key={filter.id} className="flex">
                          <FilterChip
                            onRemove={() => handleRemoveFilter(filter.id)}
                            xColor={maxColor}
                            style={{
                              background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.2) 0%, rgba(34, 197, 94, 0.2) 100%)',
                              borderColor: 'rgba(150, 150, 150, 0.3)'
                            }}
                          >
                            <div className="flex items-center gap-0.5" style={{ color: maxColor }}>
                              {maxVal >= 0 ? <Plus className="h-3.5 w-3.5" strokeWidth={3} /> : <Minus className="h-3.5 w-3.5" strokeWidth={3} />}
                              <span className="font-bold">{Math.abs(maxVal).toFixed(1)}%</span>
                            </div>
                            <div className="flex items-center gap-0.5" style={{ color: minColor }}>
                              {minVal <= 0 ? <Minus className="h-3.5 w-3.5" strokeWidth={3} /> : <Plus className="h-3.5 w-3.5" strokeWidth={3} />}
                              <span className="font-bold">{Math.abs(minVal).toFixed(1)}%</span>
                            </div>
                          </FilterChip>
                        </div>
                      );
                    }
                    
                    // Special filters (StatTrak, Souvenir, etc.)
                    if (filter.type === "special") {
                      if (filter.label === "StatTrak™") {
                        return (
                          <div key={filter.id} className="flex">
                            <FilterChip
                              onRemove={() => handleRemoveFilter(filter.id)}
                              xColor="#cf6a32"
                              style={{
                                backgroundColor: 'rgba(207, 106, 50, 0.2)',
                                borderColor: 'rgba(207, 106, 50, 0.5)',
                                color: '#cf6a32'
                              }}
                            >
                              <Zap className="h-3.5 w-3.5 shrink-0" />
                              <span className="font-semibold">{filter.label}</span>
                            </FilterChip>
                          </div>
                        );
                      }
                      if (filter.label === "Souvenir") {
                        return (
                          <div key={filter.id} className="flex">
                            <FilterChip
                              onRemove={() => handleRemoveFilter(filter.id)}
                              xColor="#d8d060"
                              className="souvenir-shimmer"
                              style={{
                                background: 'linear-gradient(135deg, rgba(216,208,96,0.15) 0%, rgba(200,192,80,0.2) 25%, rgba(224,216,104,0.25) 50%, rgba(200,192,80,0.2) 75%, rgba(216,208,96,0.15) 100%)',
                                borderImage: 'linear-gradient(135deg, #d8d060, #c8c050, #e4dc70, #c8c050, #d8d060) 1'
                              }}
                            >
                              <Star className="h-3.5 w-3.5 shrink-0" style={{ color: '#d8d060' }} />
                              <span className="font-semibold bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(90deg, #d8d060, #c8c050, #e4dc70, #c8c050, #d8d060)' }}>{filter.label}</span>
                            </FilterChip>
                          </div>
                        );
                      }
                      if (filter.label === "Highlight") {
                        return (
                          <div key={filter.id} className="flex">
                            <FilterChip
                              onRemove={() => handleRemoveFilter(filter.id)}
                              xColor="#fbbf24"
                              style={{
                                backgroundColor: 'rgba(251, 191, 36, 0.15)',
                                borderColor: 'rgba(251, 191, 36, 0.4)',
                                color: '#fbbf24'
                              }}
                            >
                              <Star className="h-3.5 w-3.5 shrink-0" />
                              <span className="font-medium">{filter.label}</span>
                            </FilterChip>
                          </div>
                        );
                      }
                    }
                    
                    // Float Rank - metallic chip
                    if (filter.type === "floatRank") {
                      const rankConfigs: Record<string, { label: string; bg: string; border: string; textGradient: string; shineClass: string }> = {
                        gold: { label: 'ƒ #1', bg: 'linear-gradient(135deg, hsl(43 80% 25%) 0%, hsl(45 85% 35%) 25%, hsl(48 90% 45%) 50%, hsl(45 85% 35%) 75%, hsl(43 80% 25%) 100%)', border: '#eab308', textGradient: 'linear-gradient(180deg, hsl(48 95% 75%), hsl(43 90% 55%), hsl(38 85% 40%))', shineClass: 'float-rank-shine-gold' },
                        silver: { label: 'ƒ #2-3', bg: 'linear-gradient(135deg, hsl(220 10% 30%) 0%, hsl(220 12% 45%) 25%, hsl(220 15% 55%) 50%, hsl(220 12% 45%) 75%, hsl(220 10% 30%) 100%)', border: '#a1a1aa', textGradient: 'linear-gradient(180deg, hsl(220 15% 80%), hsl(220 12% 60%), hsl(220 10% 45%))', shineClass: 'float-rank-shine-silver' },
                        bronze: { label: 'ƒ #4-5', bg: 'linear-gradient(135deg, hsl(25 70% 22%) 0%, hsl(28 75% 32%) 25%, hsl(30 80% 40%) 50%, hsl(28 75% 32%) 75%, hsl(25 70% 22%) 100%)', border: '#b45309', textGradient: 'linear-gradient(180deg, hsl(30 80% 65%), hsl(25 75% 45%), hsl(20 70% 30%))', shineClass: 'float-rank-shine-bronze' },
                      };
                      const rc = rankConfigs[filter.value];
                      if (rc) {
                        return (
                          <div key={filter.id} className="flex">
                            <FilterChip
                              onRemove={() => handleRemoveFilter(filter.id)}
                              xColor={rc.border}
                              className={rc.shineClass}
                              style={{
                                background: rc.bg,
                                borderColor: `${rc.border}80`,
                              }}
                            >
                              <span 
                                className="font-black text-sm bg-clip-text text-transparent"
                                style={{ backgroundImage: rc.textGradient }}
                              >
                                {rc.label}
                              </span>
                            </FilterChip>
                          </div>
                        );
                      }
                    }
                    
                    // Rarity chip
                    if (filter.type === "rarity") {
                      const rarityConfig = RARITY_CONFIG[filter.value.toLowerCase().replace(/\s+/g, '')] || 
                        RARITY_CONFIG[Object.keys(RARITY_CONFIG).find(k => RARITY_CONFIG[k].label === filter.value) || ''];
                      if (rarityConfig) {
                        return (
                          <div key={filter.id} className="flex">
                            <FilterChip
                              onRemove={() => handleRemoveFilter(filter.id)}
                              xColor={rarityConfig.color}
                              style={{
                                backgroundColor: `${rarityConfig.color}20`,
                                borderColor: `${rarityConfig.color}50`,
                                color: rarityConfig.color
                              }}
                            >
                              <Layers className="h-3.5 w-3.5 shrink-0" />
                              <span className="font-medium">{rarityConfig.label}</span>
                            </FilterChip>
                          </div>
                        );
                      }
                    }
                    
                    // Item chip - cyan gradient
                    if (filter.type === "item") {
                      return (
                        <div key={filter.id} className="flex">
                          <FilterChip
                            onRemove={() => handleRemoveFilter(filter.id)}
                            xColor="#22d3ee"
                            style={{
                              background: 'linear-gradient(90deg, rgba(6,182,212,0.15) 0%, rgba(34,211,238,0.2) 50%, rgba(6,182,212,0.15) 100%)',
                              borderImage: 'linear-gradient(90deg, #06b6d4, #22d3ee, #06b6d4) 1'
                            }}
                          >
                            <Target className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                            <span className="font-medium bg-gradient-to-r from-cyan-400 via-cyan-300 to-cyan-400 bg-clip-text text-transparent truncate">{filter.value}</span>
                          </FilterChip>
                        </div>
                      );
                    }
                    
                    // Sticker chip - purple
                    if (filter.type === "sticker") {
                      // Skip individual sticker chips - they'll be rendered in the collapsible section
                      return null;
                    }
                    
                    // Stickers Stack - skip, rendered in collapsible section below
                    if (filter.type === "stickersStack") {
                      return null;
                    }
                    
                    // Charm chip - purple
                    if (filter.type === "charm" || filter.type === "charmPattern") {
                      return (
                        <div key={filter.id} className="flex">
                          <FilterChip
                            onRemove={() => handleRemoveFilter(filter.id)}
                            xColor="#a855f7"
                            style={{
                              backgroundColor: 'rgba(168, 85, 247, 0.2)',
                              borderColor: 'rgba(168, 85, 247, 0.5)',
                            color: '#a855f7'
                          }}
                        >
                          <span className="font-medium truncate">{filter.value || filter.label}</span>
                        </FilterChip>
                        </div>
                      );
                    }

                    // Fire & Ice chip - colorful main-button style
                    if (filter.type === "fireAndIce") {
                      const tier = (filter.value === '1st' || filter.value === '2nd' || filter.value === '3rd')
                        ? filter.value as '1st' | '2nd' | '3rd'
                        : null;
                      return (
                        <div key={filter.id} className="flex w-full">
                          <FireIceVisual
                            tier={tier}
                            size="main"
                            className="w-full"
                            onRemove={() => handleRemoveFilter(filter.id)}
                          />
                        </div>
                      );
                    }

                    // Default fallback chip
                    return (
                      <div key={filter.id} className="flex">
                        <FilterChip
                          onRemove={() => handleRemoveFilter(filter.id)}
                          xColor="hsl(var(--muted-foreground))"
                          className="bg-secondary/20 border-border"
                        >
                          <span className={cn("font-medium truncate", filter.value ? "opacity-70" : "")}>
                            {filter.label}
                          </span>
                          {filter.value ? (
                            <span className="font-medium text-muted-foreground truncate">
                              {filter.value}
                            </span>
                          ) : null}
                        </FilterChip>
                      </div>
                    );
                  })}
                </div>
                  );
                })()}
                
                {/* Stickers Collapsible Section - Purple themed full-width */}
                {(() => {
                  // Find stickersStack filter and parse the JSON value
                  const stickersStackFilter = filters.find(f => f.type === "stickersStack");
                  if (!stickersStackFilter) return null;
                  
                  interface StickerItem {
                    name: string;
                    slot: string;
                    isWhole: boolean;
                    wearMin?: number;
                    wearMax?: number;
                  }
                  
                  let stickers: StickerItem[] = [];
                  try {
                    stickers = JSON.parse(stickersStackFilter.value);
                  } catch {
                    return null;
                  }
                  
                  if (stickers.length === 0) return null;
                  
                  return (
                    <Collapsible open={stickersExpanded} onOpenChange={setStickersExpanded} className="mt-3">
                      <CollapsibleTrigger asChild>
                        <button
                          className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all border"
                          style={{
                            background: 'linear-gradient(135deg, rgba(147,51,234,0.15) 0%, rgba(168,85,247,0.2) 50%, rgba(139,92,246,0.15) 100%)',
                            borderColor: 'rgba(168,85,247,0.4)'
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-purple-400" />
                            <span className="font-semibold text-purple-300 text-sm">Stickers</span>
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-500/30 text-purple-300 font-medium">
                              {stickers.length}
                            </span>
                          </div>
                          <ChevronDown 
                            className={cn(
                              "h-4 w-4 text-purple-400 transition-transform duration-200",
                              stickersExpanded && "rotate-180"
                            )} 
                          />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2 space-y-1.5">
                        {stickers.map((sticker, index) => {
                          const stickerName = sticker.name;
                          const stickerType = detectStickerType(stickerName);
                          const typeStyle = getStickerTypeStyle(stickerType);
                          const actualSlot = sticker.slot || 'any';
                          const isWhole = sticker.isWhole !== false;
                          
                          return (
                            <div
                              key={`sticker-${index}-${stickerName}`}
                              className="flex items-center justify-between px-3 py-2 rounded-lg border transition-all"
                              style={{
                                background: typeStyle.background,
                                borderColor: typeStyle.borderColor
                              }}
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className={cn("font-medium text-sm truncate", typeStyle.textColor)}>
                                  {stickerName}
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-1.5 shrink-0">
                                {/* Slot badge */}
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-300 font-medium border border-slate-600/50">
                                  {actualSlot === 'any' ? 'Any' : actualSlot === '5' ? 'Slot 5' : `Slot ${actualSlot}`}
                                </span>
                                
                                {/* Type badge with shimmer */}
                                <span className={cn(
                                  "text-[10px] px-1.5 py-0.5 rounded font-medium border",
                                  typeStyle.badgeClass,
                                  typeStyle.shimmerClass
                                )}>
                                  {typeStyle.label}
                                </span>
                                
                                {(() => {
                                  const wMin = sticker.wearMin ?? 100;
                                  const wMax = sticker.wearMax ?? 100;
                                  const is100 = wMin === 100 && wMax === 100;
                                  const is0 = wMin === 0 && wMax === 0;
                                  const wearLabel = is100 ? '100%' : is0 ? '0%' : wMin === wMax ? `${wMin}%` : `${wMin}–${wMax}%`;
                                  return is100 ? (
                                    <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium border border-emerald-500/30">
                                      <Check className="h-2.5 w-2.5" />
                                      100%
                                    </span>
                                  ) : is0 ? (
                                    <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-medium border border-red-500/30">
                                      <X className="h-2.5 w-2.5" />
                                      0%
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-[hsl(var(--cs-purple)/0.2)] text-[hsl(var(--cs-purple))] font-medium border border-[hsl(var(--cs-purple)/0.3)]">
                                      {wearLabel}
                                    </span>
                                  );
                                })()}
                                
                                {/* Remove button */}
                                <button
                                  onClick={() => handleRemoveFilter(`sticker-${index}`)}
                                  className="p-0.5 rounded hover:bg-destructive/20 opacity-60 hover:opacity-100 hover:text-destructive transition-all ml-1"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })()}
              </>
            ) : (
              <div className="text-center py-12">
                <Package className="h-16 w-16 mx-auto text-muted-foreground/20 mb-4" />
                <div className="text-muted-foreground text-sm font-medium">No filters selected</div>
                <div className="text-muted-foreground/60 text-xs mt-1">Add at least one filter to create a target.</div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-2 pt-3 border-t border-border">
          <Button 
            variant="destructive" 
            onClick={() => onOpenChange(false)} 
            className={hasFilters ? "flex-1" : "w-full"}
          >
            Cancel
          </Button>
          {hasFilters && (
            <Button
              className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold shadow-lg shadow-accent/25 hover:shadow-accent/40 transition-all relative overflow-hidden"
              onClick={() => {
                const confirmedData = getConfirmedFilterData();
                if (confirmedData) {
                  onConfirm(confirmedData);
                }
              }}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                <Check className="h-4 w-4" />
                {isUpdate ? 'Update Target' : 'Create Target'}
              </span>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
