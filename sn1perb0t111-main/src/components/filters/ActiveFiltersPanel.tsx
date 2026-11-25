import { X, FolderOpen, Minus, Plus, Layers, ChevronDown } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { FireIceVisual } from "./FireIceVisual";
import { BlueGemVisual } from "./BlueGemVisual";

interface StickerStackItem {
  name: string;
  slot: string;
  isWhole: boolean;
  wearMin?: number;
  wearMax?: number;
}

export interface ActiveFilter {
  id: string;
  type: string;
  label: string;
  value: string;
  paintSeeds?: number[]; // For pattern pack tooltip
}

interface ActiveFiltersPanelProps {
  filters: ActiveFilter[];
  onRemoveFilter: (id: string) => void;
  onClearAll: () => void;
  isEditMode?: boolean;
  onCancelEdit?: () => void;
}

// Rarity color mapping (CS2 accurate colors)
const getRarityColor = (value: string): string => {
  const colorMap: Record<string, string> = {
    "Contraband": "bg-[#e4ae33]/20 border-[#e4ae33]/50 text-[#e4ae33]",
    "Covert": "bg-[#eb4b4b]/20 border-[#eb4b4b]/50 text-[#eb4b4b]",
    "Classified": "bg-[#d32ce6]/20 border-[#d32ce6]/50 text-[#d32ce6]",
    "Restricted": "bg-[#8847ff]/20 border-[#8847ff]/50 text-[#8847ff]",
    "Mil-Spec Grade": "bg-[#4b69ff]/20 border-[#4b69ff]/50 text-[#4b69ff]",
    "Industrial Grade": "bg-[#5e98d9]/20 border-[#5e98d9]/50 text-[#5e98d9]",
    "Consumer Grade": "bg-[#b0c3d9]/20 border-[#b0c3d9]/50 text-[#b0c3d9]",
    "Extraordinary": "bg-[#e4ae33]/20 border-[#e4ae33]/50 text-[#e4ae33]",
    "Remarkable": "bg-[#8847ff]/20 border-[#8847ff]/50 text-[#8847ff]",
    "Exotic": "bg-[#d32ce6]/20 border-[#d32ce6]/50 text-[#d32ce6]",
    "High Grade": "bg-[#4b69ff]/20 border-[#4b69ff]/50 text-[#4b69ff]",
    "Base Grade": "bg-[#b0c3d9]/20 border-[#b0c3d9]/50 text-[#b0c3d9]",
    "Agent Quality": "bg-[#4b69ff]/20 border-[#4b69ff]/50 text-[#4b69ff]",
  };
  return colorMap[value] || "";
};

// Special filter color mapping (StatTrak, Souvenir, Normal)
const getSpecialColor = (label: string): string => {
  const colorMap: Record<string, string> = {
    "StatTrak™": "bg-[#cf6a32]/20 border-[#cf6a32]/50 text-[#cf6a32]",
    "Normal": "bg-zinc-500/20 border-zinc-400/50 text-zinc-400",
  };
  return colorMap[label] || "";
};

// Check if filter is Souvenir (needs special gradient treatment)
const isSouvenirFilter = (filter: ActiveFilter): boolean => {
  return filter.type === "special" && filter.label === "Souvenir";
};

// Paint Seed color (blue style matching the pattern theme)
const getPaintSeedColor = (): string => {
  return "bg-[#4b69ff]/20 border-[#4b69ff]/50 text-[#4b69ff]";
};

// Charm color (sparkle purple/pink style)
const getCharmColor = (): string => {
  return "bg-[#a855f7]/20 border-[#a855f7]/50 text-[#a855f7]";
};

// Check if filter is 0.0% custom filter
const isZeroPointFilter = (filter: ActiveFilter): boolean => {
  return filter.type === "custom" && filter.label === "0.0%";
};

// Check if filter is Blue Gem filter
const isBlueGemFilter = (filter: ActiveFilter): boolean => {
  return filter.type === "blueGem" || (filter.type === "custom" && filter.label === "Blue Gem");
};

// Check if filter is Discount/Overpay filter
const isDiscountOverpayFilter = (filter: ActiveFilter): boolean => {
  return filter.type === "discountOverpay";
};

// Check if filter is Float Rank
const isFloatRankFilter = (filter: ActiveFilter): boolean => {
  return filter.type === "floatRank";
};

// Float Rank styles
const getFloatRankStyles = (rank: string) => {
  switch (rank) {
    case 'gold':
      return {
        bg: 'linear-gradient(135deg, hsl(43 80% 25%) 0%, hsl(45 85% 35%) 25%, hsl(48 90% 45%) 50%, hsl(45 85% 35%) 75%, hsl(43 80% 25%) 100%)',
        border: '#eab308',
        textGradient: 'linear-gradient(180deg, hsl(48 95% 75%), hsl(43 90% 55%), hsl(38 85% 40%))',
        label: 'ƒ #1',
        shineClass: 'float-rank-shine-gold',
        xColor: 'hsl(48 90% 70%)',
      };
    case 'silver':
      return {
        bg: 'linear-gradient(135deg, hsl(220 10% 30%) 0%, hsl(220 12% 45%) 25%, hsl(220 15% 55%) 50%, hsl(220 12% 45%) 75%, hsl(220 10% 30%) 100%)',
        border: '#a1a1aa',
        textGradient: 'linear-gradient(180deg, hsl(220 15% 80%), hsl(220 12% 60%), hsl(220 10% 45%))',
        label: 'ƒ #2-3',
        shineClass: 'float-rank-shine-silver',
        xColor: 'hsl(220 15% 75%)',
      };
    case 'bronze':
      return {
        bg: 'linear-gradient(135deg, hsl(25 70% 22%) 0%, hsl(28 75% 32%) 25%, hsl(30 80% 40%) 50%, hsl(28 75% 32%) 75%, hsl(25 70% 22%) 100%)',
        border: '#b45309',
        textGradient: 'linear-gradient(180deg, hsl(30 80% 65%), hsl(25 75% 45%), hsl(20 70% 30%))',
        label: 'ƒ #4-5',
        shineClass: 'float-rank-shine-bronze',
        xColor: 'hsl(30 75% 60%)',
      };
    default:
      return { bg: '', border: '', textGradient: '', label: '', shineClass: '', xColor: '' };
  }
};

// Get wear color based on float value (0-1 scale) - matching the slider segments
const getWearColor = (float: number): string => {
  if (float <= 0.07) return "#22a350"; // Dark Green - Factory New
  if (float <= 0.15) return "#7cb518"; // Lime Green - Minimal Wear
  if (float <= 0.38) return "#b8c800"; // Yellow-Green/Salad - Field-Tested
  if (float <= 0.45) return "#e67e22"; // Orange - Well-Worn
  return "#a63232"; // Dark Red - Battle-Scarred
};

// Get sticker overpay color based on percentage (0% green to 100% red)
const getOverpayColor = (percent: number): string => {
  if (percent <= 25) {
    const t = percent / 25;
    const h = 142 - t * 62;
    const s = 70 + t * 5;
    const l = 40 + t * 5;
    return `hsl(${h}, ${s}%, ${l}%)`;
  } else if (percent <= 50) {
    const t = (percent - 25) / 25;
    const h = 80 - t * 35;
    const s = 75 + t * 15;
    const l = 45 + t * 5;
    return `hsl(${h}, ${s}%, ${l}%)`;
  } else if (percent <= 75) {
    const t = (percent - 50) / 25;
    const h = 45 - t * 20;
    const s = 90 - t * 5;
    return `hsl(${h}, ${s}%, 50%)`;
  } else {
    const t = (percent - 75) / 25;
    const h = 25 - t * 25;
    const s = 85 - t * 15;
    const l = 50 - t * 5;
    return `hsl(${h}, ${s}%, ${l}%)`;
  }
};

// Generate dynamic overpay gradient based on selected range
const getOverpayGradientStyles = (value: string): { bg: string; border: string; textGradient: string } => {
  const match = value.match(/(\d+(?:\.\d+)?)%\s*-\s*(\d+(?:\.\d+)?)%/);
  if (!match) {
    return {
      bg: 'linear-gradient(90deg, rgba(34,197,94,0.2), rgba(239,68,68,0.2))',
      border: 'linear-gradient(90deg, #22c55e, #ef4444) 1',
      textGradient: 'linear-gradient(90deg, #22c55e, #ef4444)'
    };
  }
  
  const minPercent = parseFloat(match[1]);
  const maxPercent = parseFloat(match[2]);
  
  const minColor = getOverpayColor(minPercent);
  const maxColor = getOverpayColor(maxPercent);
  
  // If range is small, use single color with slight variation
  if (Math.abs(maxPercent - minPercent) < 10) {
    const avgPercent = (minPercent + maxPercent) / 2;
    const color = getOverpayColor(avgPercent);
    return {
      bg: `linear-gradient(90deg, ${color.replace(')', ', 0.2)').replace('hsl', 'hsla')}, ${color.replace(')', ', 0.25)').replace('hsl', 'hsla')})`,
      border: `linear-gradient(90deg, ${color}, ${color}) 1`,
      textGradient: `linear-gradient(90deg, ${color}, ${color})`
    };
  }
  
  // Generate intermediate color for smoother gradient
  const midPercent = (minPercent + maxPercent) / 2;
  const midColor = getOverpayColor(midPercent);
  
  // Convert hsl to rgba for background
  const minColorBg = minColor.replace(')', ', 0.2)').replace('hsl', 'hsla');
  const midColorBg = midColor.replace(')', ', 0.2)').replace('hsl', 'hsla');
  const maxColorBg = maxColor.replace(')', ', 0.25)').replace('hsl', 'hsla');
  
  return {
    bg: `linear-gradient(90deg, ${minColorBg} 0%, ${midColorBg} 50%, ${maxColorBg} 100%)`,
    border: `linear-gradient(90deg, ${minColor}, ${midColor}, ${maxColor}) 1`,
    textGradient: `linear-gradient(90deg, ${minColor}, ${midColor}, ${maxColor})`
  };
};

// Generate dynamic wear gradient based on selected range
const getWearGradientStyles = (value: string): { bg: string; border: string; textGradient: string } => {
  const parts = value.split(" - ");
  if (parts.length !== 2) {
    return {
      bg: 'linear-gradient(90deg, rgba(34,197,94,0.2), rgba(239,68,68,0.2))',
      border: 'linear-gradient(90deg, #22c55e, #ef4444) 1',
      textGradient: 'linear-gradient(90deg, #22c55e, #ef4444)'
    };
  }
  
  const minFloat = parseFloat(parts[0]);
  const maxFloat = parseFloat(parts[1]);
  
  const minColor = getWearColor(minFloat);
  const maxColor = getWearColor(maxFloat);
  
  // If range is small, use single color with slight variation
  if (Math.abs(maxFloat - minFloat) < 0.1) {
    const avgFloat = (minFloat + maxFloat) / 2;
    const color = getWearColor(avgFloat);
    return {
      bg: `linear-gradient(90deg, ${color}33, ${color}40)`,
      border: `linear-gradient(90deg, ${color}, ${color}) 1`,
      textGradient: `linear-gradient(90deg, ${color}, ${color})`
    };
  }
  
  // Generate intermediate colors for smoother gradient
  const midFloat = (minFloat + maxFloat) / 2;
  const midColor = getWearColor(midFloat);
  
  return {
    bg: `linear-gradient(90deg, ${minColor}33 0%, ${midColor}33 50%, ${maxColor}33 100%)`,
    border: `linear-gradient(90deg, ${minColor}, ${midColor}, ${maxColor}) 1`,
    textGradient: `linear-gradient(90deg, ${minColor}, ${midColor}, ${maxColor})`
  };
};

export const ActiveFiltersPanel = ({ filters, onRemoveFilter, onClearAll, isEditMode = false, onCancelEdit }: ActiveFiltersPanelProps) => {
  const handleClearOrCancel = () => {
    if (isEditMode && onCancelEdit) {
      onCancelEdit();
    } else {
      onClearAll();
    }
  };

  // Accent color for the chip remove icon — matches the color/theme next to the X
  const getXColor = (filter: ActiveFilter): string => {
    const getRarityTextColor = (value: string): string => {
      const map: Record<string, string> = {
        "Contraband": "#e4ae33",
        "Covert": "#eb4b4b",
        "Classified": "#d32ce6",
        "Restricted": "#8847ff",
        "Mil-Spec Grade": "#4b69ff",
        "Industrial Grade": "#5e98d9",
        "Consumer Grade": "#b0c3d9",
        "Extraordinary": "#e4ae33",
        "Remarkable": "#8847ff",
        "Exotic": "#d32ce6",
        "High Grade": "#4b69ff",
        "Base Grade": "#b0c3d9",
        "Agent Quality": "#4b69ff",
      };
      return map[value] || "hsl(var(--foreground))";
    };

    switch (filter.type) {
      case "rarity":
        return getRarityTextColor(filter.value);
      case "special":
        if (filter.label === "StatTrak™") return "#cf6a32";
        if (filter.label === "Souvenir") return "#d8d060";
        return "#a1a1aa";
      case "paintSeed":
        if (filter.paintSeeds && filter.paintSeeds.length > 1) return "#2dd4bf";
        return "#4b69ff";
      case "charm":
      case "charmPattern":
        return "#c084fc";
      case "item":
        return "#22d3ee";
      case "wear": {
        const parts = filter.value.split(" - ");
        const min = parseFloat(parts[0]) || 0;
        const max = parseFloat(parts[1]) || 0;
        return getWearColor((min + max) / 2);
      }
      case "price":
        return "#10b981";
      case "fade":
        return "#8b5cf6";
      case "blue":
        return "#cffafe";
      case "blueGem":
        return "#38bdf8";
      case "fireAndIce":
        return "#f43f5e";
      case "stickersPricePercent":
      case "spSticker": {
        const min = parseFloat(filter.value.match(/(\d+(?:\.\d+)?)%/)?.[1] || "0");
        const maxMatch = filter.value.match(/(\d+(?:\.\d+)?)%\s*-\s*(\d+(?:\.\d+)?)%/);
        const max = parseFloat(maxMatch?.[2] || "100");
        return getOverpayColor((min + max) / 2);
      }
      case "discountOverpay": {
        const [minStr] = filter.value.split("|");
        const min = parseFloat(minStr) || 0;
        return min < 0 ? "#22c55e" : min > 0 ? "#ef4444" : "hsl(var(--muted-foreground))";
      }
      case "floatRank":
        return getFloatRankStyles(filter.value).xColor;
      case "zeroPoint":
        return "#d4d4d8";
      case "stickersStack":
        return "#64748b";
      default:
        return "hsl(var(--foreground))";
    }
  };

  const FilterRemoveButton = ({
    filter,
    onClick,
    color,
    className,
    style,
  }: {
    filter: ActiveFilter;
    onClick?: (e: React.MouseEvent) => void;
    color?: string;
    className?: string;
    style?: CSSProperties;
  }) => {
    const xColor = color ?? getXColor(filter);
    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onClick) onClick(e);
      else onRemoveFilter(filter.id);
    };
    return (
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "ml-0.5 p-0.5 rounded hover:bg-current/20 opacity-90 hover:opacity-100 transition-colors shrink-0",
          className
        )}
        style={{ color: xColor, ...style }}
        aria-label="Remove"
      >
        <X className="h-3 w-3" />
      </button>
    );
  };


  if (filters.length === 0) {
    return (
      <div className="p-3 bg-secondary/30 rounded-lg border border-border/50">
        <p className="text-xs text-muted-foreground text-center">
          No active filters. Select parameters above.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Active Filters ({filters.length})
        </span>
        <button
          onClick={handleClearOrCancel}
          className={cn(
            "text-xs transition-colors",
            isEditMode 
              ? "text-destructive hover:text-destructive/80 font-medium" 
              : "text-destructive hover:text-destructive/80"
          )}
        >
          {isEditMode ? "Cancel Edit" : "Clear All"}
        </button>
      </div>
      <div
        className="max-h-[180px] overflow-y-auto overflow-x-hidden pr-2"
        style={{ scrollbarGutter: "stable", minHeight: "32px" }}
      >
        <div className="flex flex-wrap gap-1.5">
          {filters.map((filter) => {
            const isRarity = filter.type === "rarity";
            const isSpecial = filter.type === "special";
            const isPaintSeed = filter.type === "paintSeed";
            const isFade = filter.type === "fade";
            const isBlue = filter.type === "blue";
            const isCharm = filter.type === "charm";
            const isCharmPattern = filter.type === "charmPattern";
            const isPrice = filter.type === "price";
            const isWear = filter.type === "wear";
            const isSpSticker = filter.type === "spSticker" || filter.type === "stickersPricePercent";
            const isItem = filter.type === "item";
            const isStickersStack = filter.type === "stickersStack";
            const isDiscountOverpay = isDiscountOverpayFilter(filter);
            const isZeroPoint = isZeroPointFilter(filter);
            const isBlueGem = isBlueGemFilter(filter);
            const isSouvenir = isSouvenirFilter(filter);
            const isFloatRank = isFloatRankFilter(filter);
            const isFireAndIce = filter.type === "fireAndIce";
            const rarityColorClass = isRarity ? getRarityColor(filter.value) : "";
            const specialColorClass = (isSpecial && !isSouvenir) ? getSpecialColor(filter.label) : "";
            const paintSeedColorClass = isPaintSeed ? getPaintSeedColor() : "";
            const charmColorClass = (isCharm || isCharmPattern) ? getCharmColor() : "";
            
            const hasCustomColor = (isRarity && rarityColorClass) || (isSpecial && specialColorClass) || isPaintSeed || isCharm || isCharmPattern || isZeroPoint || isBlueGem || isSpSticker || isSouvenir || isItem || isDiscountOverpay || isStickersStack || isFloatRank || isFireAndIce;
            const colorClass = rarityColorClass || specialColorClass || paintSeedColorClass || charmColorClass;
            
            // Stickers Stack chip - shows all stickers as a compact stack
            if (isStickersStack) {
              let stickers: StickerStackItem[] = [];
              try {
                stickers = JSON.parse(filter.value);
              } catch {
                stickers = [];
              }
              
              // Detect sticker type from name
              const detectStickerType = (name: string): 'holo' | 'foil' | 'gold' | 'paper' => {
                const lowerName = name.toLowerCase();
                if (lowerName.includes('(holo)')) return 'holo';
                if (lowerName.includes('(foil)')) return 'foil';
                if (lowerName.includes('(gold)')) return 'gold';
                return 'paper';
              };
              
              // Detect tier from tournament name
              const detectTier = (name: string): 1 | 2 | 3 | 4 | null => {
                const lowerName = name.toLowerCase();
                // Tier 1 tournaments
                if (lowerName.includes('katowice 2014')) return 1;
                // Tier 2 tournaments
                if (lowerName.includes('katowice 2015') || 
                    lowerName.includes('dreamhack 2014') || 
                    lowerName.includes('cologne 2014')) return 2;
                // Tier 3 tournaments
                if (lowerName.includes('boston 2018') || 
                    lowerName.includes('krakow 2017') || 
                    lowerName.includes('atlanta 2017')) return 3;
                // Tier 4 tournaments
                if (lowerName.includes('cologne 2016') || 
                    lowerName.includes('mlg columbus') || 
                    lowerName.includes('cologne 2015') || 
                    lowerName.includes('cluj-napoca') || 
                    lowerName.includes('london 2018')) return 4;
                return null;
              };
              
              // Get styling based on sticker type
              const getStickerTypeStyle = (type: 'holo' | 'foil' | 'gold' | 'paper') => {
                switch (type) {
                  case 'holo':
                    return {
                      background: 'linear-gradient(135deg, rgba(147,51,234,0.2) 0%, rgba(168,85,247,0.25) 50%, rgba(192,132,252,0.2) 100%)',
                      borderColor: '#a855f7',
                      textGradient: 'from-purple-300 via-violet-400 to-purple-300',
                      badgeBg: 'bg-purple-500/20',
                      badgeText: 'text-purple-400',
                      iconColor: 'text-purple-400'
                    };
                  case 'foil':
                    return {
                      background: 'linear-gradient(135deg, rgba(148,163,184,0.2) 0%, rgba(203,213,225,0.25) 50%, rgba(148,163,184,0.2) 100%)',
                      borderColor: '#94a3b8',
                      textGradient: 'from-slate-300 via-slate-200 to-slate-300',
                      badgeBg: 'bg-slate-500/20',
                      badgeText: 'text-slate-300',
                      iconColor: 'text-slate-300'
                    };
                  case 'gold':
                    return {
                      background: 'linear-gradient(135deg, rgba(234,179,8,0.2) 0%, rgba(250,204,21,0.25) 50%, rgba(234,179,8,0.2) 100%)',
                      borderColor: '#eab308',
                      textGradient: 'from-yellow-300 via-amber-400 to-yellow-300',
                      badgeBg: 'bg-yellow-500/20',
                      badgeText: 'text-yellow-400',
                      iconColor: 'text-yellow-400'
                    };
                  default: // paper - use neutral slate/blue-gray
                    return {
                      background: 'linear-gradient(135deg, rgba(100,116,139,0.15) 0%, rgba(148,163,184,0.2) 50%, rgba(100,116,139,0.15) 100%)',
                      borderColor: '#64748b',
                      textGradient: 'from-slate-300 via-slate-200 to-slate-300',
                      badgeBg: 'bg-slate-500/20',
                      badgeText: 'text-slate-300',
                      iconColor: 'text-slate-400'
                    };
                }
              };
              
              // Get styling based on tier
              const getTierStyle = (tier: 1 | 2 | 3 | 4) => {
                switch (tier) {
                  case 1: // Contraband - Gold
                    return {
                      background: 'linear-gradient(135deg, rgba(228,174,57,0.2) 0%, rgba(251,191,36,0.25) 50%, rgba(228,174,57,0.2) 100%)',
                      borderColor: '#e4ae39',
                      textGradient: 'from-amber-300 via-yellow-400 to-amber-300',
                      badgeBg: 'bg-amber-500/20',
                      badgeText: 'text-amber-400',
                      iconColor: 'text-amber-400'
                    };
                  case 2: // Covert - Red
                    return {
                      background: 'linear-gradient(135deg, rgba(235,75,75,0.2) 0%, rgba(248,113,113,0.25) 50%, rgba(235,75,75,0.2) 100%)',
                      borderColor: '#eb4b4b',
                      textGradient: 'from-red-300 via-red-400 to-red-300',
                      badgeBg: 'bg-red-500/20',
                      badgeText: 'text-red-400',
                      iconColor: 'text-red-400'
                    };
                  case 3: // Classified - Pink
                    return {
                      background: 'linear-gradient(135deg, rgba(211,44,230,0.2) 0%, rgba(232,121,249,0.25) 50%, rgba(211,44,230,0.2) 100%)',
                      borderColor: '#d32ce6',
                      textGradient: 'from-fuchsia-300 via-pink-400 to-fuchsia-300',
                      badgeBg: 'bg-fuchsia-500/20',
                      badgeText: 'text-fuchsia-400',
                      iconColor: 'text-fuchsia-400'
                    };
                  case 4: // Restricted - Purple
                    return {
                      background: 'linear-gradient(135deg, rgba(136,71,255,0.2) 0%, rgba(167,139,250,0.25) 50%, rgba(136,71,255,0.2) 100%)',
                      borderColor: '#8847ff',
                      textGradient: 'from-violet-300 via-purple-400 to-violet-300',
                      badgeBg: 'bg-violet-500/20',
                      badgeText: 'text-violet-400',
                      iconColor: 'text-violet-400'
                    };
                }
              };
              
              // Determine styling - prioritize sticker type, fallback to tier
              const getChipStyle = (name: string) => {
                const stickerType = detectStickerType(name);
                const tier = detectTier(name);
                
                // If sticker has a type (holo/foil/gold), use type styling
                if (stickerType !== 'paper') {
                  return getStickerTypeStyle(stickerType);
                }
                
                // If tier detected (collection), use tier styling
                if (tier) {
                  return getTierStyle(tier);
                }
                
                // Default paper styling
                return getStickerTypeStyle('paper');
              };
              
              // Check if all stickers have the same name
              const uniqueNames = [...new Set(stickers.map(s => s.name))];
              const allSameName = uniqueNames.length === 1 && stickers.length > 0;
              
              // If only one sticker OR all stickers have the same name, show full name with count
              if (stickers.length === 1 || allSameName) {
                const stickerName = stickers[0].name;
                const displayName = stickerName.replace(/^Sticker \| /, '');
                const count = stickers.length;
                const style = getChipStyle(stickerName);
                
                return (
                  <Tooltip key={filter.id} delayDuration={0}>
                    <TooltipTrigger asChild>
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs group transition-colors cursor-default border relative overflow-hidden"
                        style={{
                          background: style.background,
                          borderColor: style.borderColor
                        }}
                      >
                        <span className={`font-medium bg-gradient-to-r ${style.textGradient} bg-clip-text text-transparent`}>
                          {displayName}
                        </span>
                        {count > 1 && (
                          <span className={`${style.badgeText} font-semibold text-[10px] ${style.badgeBg} px-1 py-0.5 rounded`}>
                            x{count}
                          </span>
                        )}
                        <FilterRemoveButton filter={filter} color={style.borderColor} />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      <div className="space-y-1">
                        <div className="font-medium">{stickerName}{count > 1 && ` × ${count}`}</div>
                        <div className="text-muted-foreground space-y-0.5">
                          {stickers.map((s, idx) => {
                            const wMin = s.wearMin ?? 100;
                            const wMax = s.wearMax ?? 100;
                            const is100 = wMin === 100 && wMax === 100;
                            const is0 = wMin === 0 && wMax === 0;
                            const wearLabel = is100 ? '100%' : is0 ? '0%' : wMin === wMax ? `${wMin}%` : `${wMin}–${wMax}%`;
                            return (
                              <div key={idx} className="flex items-center gap-2">
                                <span>{s.slot === "any" ? "Any Slot" : `Slot ${s.slot}`}</span>
                                <span className={is100 ? 'text-emerald-400' : is0 ? 'text-red-400' : 'text-[hsl(var(--cs-purple))]'}>
                                  {wearLabel}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              }
              
              // Multiple different stickers - check if all same type
              const stickerTypes = stickers.map(s => detectStickerType(s.name));
              const uniqueTypes = [...new Set(stickerTypes)];
              const dominantType = uniqueTypes.length === 1 ? uniqueTypes[0] : 'paper';
              const stackStyle = getStickerTypeStyle(dominantType);
              
              // State for popover open (handled by Popover component via data-state)
              
              // Multiple different stickers - show as stack with popover
              // Detect if sticker is a collection (tournament name only, not specific sticker)
              const isCollection = (name: string): boolean => {
                const lowerName = name.toLowerCase();
                // Collection names are short tournament references without player/team names
                const collectionPatterns = [
                  /^katowice 2014$/i, /^katowice 2015$/i, /^dreamhack 2014$/i, /^cologne 2014$/i,
                  /^boston 2018$/i, /^krakow 2017$/i, /^atlanta 2017$/i,
                  /^cologne 2016$/i, /^mlg columbus 2016$/i, /^cologne 2015$/i, /^cluj-napoca 2015$/i, /^london 2018$/i,
                  /^exclusive$/i
                ];
                // Check if name matches collection pattern or is just a tournament name
                const isShortName = name.split(' ').length <= 3 && !name.includes('|');
                const matchesPattern = collectionPatterns.some(p => p.test(name.trim()));
                const containsTournament = lowerName.includes('katowice') || lowerName.includes('dreamhack') || 
                  lowerName.includes('cologne') || lowerName.includes('boston') || lowerName.includes('krakow') ||
                  lowerName.includes('atlanta') || lowerName.includes('mlg') || lowerName.includes('cluj') || 
                  lowerName.includes('london') || lowerName.includes('exclusive');
                return matchesPattern || (isShortName && containsTournament && !name.includes('('));
              };
              
              // Get tier badge style
              const getTierBadgeStyle = (tier: number | null) => {
                switch(tier) {
                  case 1: return { label: 'T1', color: 'text-[#e4ae39] border-[#e4ae39]/50', bg: 'rgba(228,174,57,0.25)' };
                  case 2: return { label: 'T2', color: 'text-[#eb4b4b] border-[#eb4b4b]/50', bg: 'rgba(235,75,75,0.25)' };
                  case 3: return { label: 'T3', color: 'text-[#d32ce6] border-[#d32ce6]/50', bg: 'rgba(211,44,230,0.25)' };
                  case 4: return { label: 'T4', color: 'text-[#8847ff] border-[#8847ff]/50', bg: 'rgba(136,71,255,0.25)' };
                  default: return null;
                }
              };
              
              // Create mini badges for EACH sticker in order (not just unique types)
              const getBadgeStyle = (type: string) => {
                switch(type) {
                  case 'holo': return { label: 'H', color: 'bg-purple-500/30 text-purple-300 border-purple-400/50', bg: '' };
                  case 'foil': return { label: 'F', color: 'bg-slate-400/30 text-slate-200 border-slate-300/50', bg: '' };
                  case 'gold': return { label: 'G', color: 'bg-yellow-500/30 text-yellow-300 border-yellow-400/50', bg: '' };
                  default: return { label: 'P', color: 'bg-slate-500/30 text-slate-300 border-slate-400/50', bg: '' };
                }
              };
              
              // Get badges for each sticker in order - check if collection or specific sticker
              const allBadges = stickers.map(s => {
                if (isCollection(s.name)) {
                  const tier = detectTier(s.name);
                  const tierStyle = getTierBadgeStyle(tier);
                  if (tierStyle) {
                    return { label: tierStyle.label, color: tierStyle.color, bg: tierStyle.bg, isTier: true };
                  }
                }
                return { ...getBadgeStyle(detectStickerType(s.name)), isTier: false };
              });
              const visibleBadges = allBadges.slice(0, 5); // Show max 5 (all sticker slots)
              const hiddenCount = allBadges.length - visibleBadges.length;
              
              return (
                <Popover key={filter.id}>
                  <PopoverTrigger asChild>
                    <span
                      className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs group transition-all cursor-pointer border relative overflow-hidden hover:brightness-110"
                      style={{
                        background: stackStyle.background,
                        borderColor: stackStyle.borderColor
                      }}
                    >
                      {/* Type/Tier badges for each sticker in order */}
                      <div className="flex items-center gap-0.5">
                        {visibleBadges.map((badge, idx) => (
                          <span 
                            key={idx}
                            className={`text-[9px] font-bold w-5 h-4 flex items-center justify-center rounded border ${badge.color}`}
                            style={badge.bg ? { backgroundColor: badge.bg } : undefined}
                          >
                            {badge.label}
                          </span>
                        ))}
                        {hiddenCount > 0 && (
                          <span className="text-[9px] font-medium text-muted-foreground ml-0.5">
                            +{hiddenCount}
                          </span>
                        )}
                      </div>
                      <ChevronDown 
                        className={cn(
                          `h-3.5 w-3.5 ${stackStyle.iconColor} opacity-70 transition-transform duration-300 ease-out`,
                          "group-data-[state=open]:rotate-180"
                        )} 
                      />
                      <FilterRemoveButton filter={filter} color={stackStyle.borderColor} />
                    </span>
                  </PopoverTrigger>
                  <PopoverContent side="top" className="w-auto min-w-[200px] max-w-[340px] p-0 border-border/50 shadow-xl">
                    <div className="text-xs">
                      <div className={`${stackStyle.iconColor} font-semibold px-3 py-2.5 border-b border-border/50 flex items-center gap-2 bg-secondary/30`}>
                        <Layers className="h-3.5 w-3.5" />
                        <span>Selected Stickers</span>
                        <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${stackStyle.badgeBg} ${stackStyle.badgeText}`}>
                          {stickers.length}
                        </span>
                      </div>
                      <div className="p-2 space-y-1.5 max-h-[200px] overflow-y-auto">
                        {stickers.map((s, idx) => {
                          const itemStyle = getChipStyle(s.name);
                          const itemType = detectStickerType(s.name);
                          const typeBadge = (() => {
                            switch(itemType) {
                              case 'holo': return { label: 'Holo', color: 'bg-purple-500/20 text-purple-300' };
                              case 'foil': return { label: 'Foil', color: 'bg-slate-400/20 text-slate-200' };
                              case 'gold': return { label: 'Gold', color: 'bg-yellow-500/20 text-yellow-300' };
                              default: return { label: 'Paper', color: 'bg-slate-500/20 text-slate-400' };
                            }
                          })();
                          
                          return (
                            <div 
                              key={idx} 
                              className="flex items-center gap-2 text-foreground/90 py-1.5 px-2 rounded-md hover:bg-secondary/30 transition-colors"
                              style={{ 
                                background: itemStyle.background,
                                borderLeft: `2px solid ${itemStyle.borderColor}`
                              }}
                            >
                              <span className={`flex-1 bg-gradient-to-r ${itemStyle.textGradient} bg-clip-text text-transparent font-medium`}>
                                {s.name.replace(/^Sticker \| /, '')}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${typeBadge.color}`}>
                                  {typeBadge.label}
                                </span>
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                  {s.slot === "any" ? "Any" : `#${s.slot}`}
                                </span>
                                {(() => {
                                  const wMin = s.wearMin ?? 100;
                                  const wMax = s.wearMax ?? 100;
                                  const is100 = wMin === 100 && wMax === 100;
                                  const is0 = wMin === 0 && wMax === 0;
                                  const wearLabel = is100 ? '100%' : is0 ? '0%' : wMin === wMax ? `${wMin}%` : `${wMin}–${wMax}%`;
                                  return (
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                                      is100 ? 'bg-emerald-500/20 text-emerald-400' : is0 ? 'bg-red-500/20 text-red-400' : 'bg-[hsl(var(--cs-purple)/0.2)] text-[hsl(var(--cs-purple))]'
                                    }`}>{wearLabel}</span>
                                  );
                                })()}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              );
            }
            
            // Item name chip (cyan/teal style for CS2 items)
            if (isItem) {
              return (
                <span
                  key={filter.id}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs group transition-colors border border-transparent relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(90deg, rgba(6,182,212,0.15) 0%, rgba(34,211,238,0.2) 50%, rgba(6,182,212,0.15) 100%)',
                    borderImage: 'linear-gradient(90deg, #06b6d4, #22d3ee, #06b6d4) 1'
                  }}
                >
                  <span className="font-medium bg-gradient-to-r from-cyan-400 via-cyan-300 to-cyan-400 bg-clip-text text-transparent">
                    {filter.value}
                  </span>
                  <FilterRemoveButton filter={filter} />
                </span>
              );
            }
            
            // Souvenir golden shimmer chip (CS2 authentic style - #c8c868)
            if (isSouvenir) {
              return (
                <span
                  key={filter.id}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs group transition-colors border border-transparent relative overflow-hidden souvenir-shimmer"
                  style={{
                    background: 'linear-gradient(135deg, rgba(216,208,96,0.15) 0%, rgba(200,192,80,0.2) 25%, rgba(224,216,104,0.25) 50%, rgba(200,192,80,0.2) 75%, rgba(216,208,96,0.15) 100%)',
                    borderImage: 'linear-gradient(135deg, #d8d060, #c8c050, #e4dc70, #c8c050, #d8d060) 1'
                  }}
                >
                  <span 
                    className="font-medium bg-clip-text text-transparent"
                    style={{ 
                      backgroundImage: 'linear-gradient(90deg, #d8d060, #c8c050, #e4dc70, #c8c050, #d8d060)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 2s linear infinite'
                    }}
                  >
                    {filter.label}
                  </span>
                  <FilterRemoveButton filter={filter} />
                </span>
              );
            }
            
            // Wear/Float gradient chip - dynamic colors based on selected range
            if (isWear) {
              const wearStyles = getWearGradientStyles(filter.value);
              return (
                <span
                  key={filter.id}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs group transition-colors border border-transparent relative overflow-hidden"
                  style={{
                    background: wearStyles.bg,
                    borderImage: wearStyles.border
                  }}
                >
                  <span 
                    className="opacity-70 bg-clip-text text-transparent"
                    style={{ backgroundImage: wearStyles.textGradient }}
                  >
                    {filter.label}:
                  </span>
                  <span 
                    className="font-medium bg-clip-text text-transparent"
                    style={{ backgroundImage: wearStyles.textGradient }}
                  >
                    {filter.value}
                  </span>
                  <FilterRemoveButton filter={filter} />
                </span>
              );
            }
            
            // Price gradient chip (green to gold shimmer like money)
            if (isPrice) {
              return (
                <span
                  key={filter.id}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs group transition-colors border border-transparent relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(90deg, rgba(16,185,129,0.2) 0%, rgba(52,211,153,0.2) 25%, rgba(234,179,8,0.2) 50%, rgba(251,191,36,0.25) 75%, rgba(16,185,129,0.2) 100%)',
                    borderImage: 'linear-gradient(90deg, #10b981, #34d399, #eab308, #fbbf24, #10b981) 1'
                  }}
                >
                  <span className="opacity-70 bg-gradient-to-r from-emerald-400 via-yellow-400 to-emerald-400 bg-clip-text text-transparent">{filter.label}:</span>
                  <span className="font-medium bg-gradient-to-r from-emerald-400 via-yellow-400 to-emerald-400 bg-clip-text text-transparent">{filter.value}</span>
                  <FilterRemoveButton filter={filter} />
                </span>
              );
            }
            
            // Fade gradient chip - matching slider gradient from index.css (.fade-gradient)
            // Colors: Dark Green → Lime Green → Yellow-Green → Orange → Dark Red (like wear gradient but for fade)
            if (isFade) {
              return (
                <span
                  key={filter.id}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs group transition-colors border border-transparent relative overflow-hidden fade-chip-shimmer"
                  style={{
                    // Matching .fade-gradient from index.css: muted yellow → orange → rose → magenta → purple
                    background: 'linear-gradient(90deg, rgba(202,138,4,0.15) 0%, rgba(234,88,12,0.18) 15%, rgba(234,88,12,0.2) 30%, rgba(244,63,94,0.2) 50%, rgba(217,70,239,0.18) 70%, rgba(168,85,247,0.18) 85%, rgba(139,92,246,0.15) 100%)',
                    borderImage: 'linear-gradient(90deg, hsl(45,70%,50%), hsl(35,75%,55%), hsl(25,80%,55%), hsl(350,70%,60%), hsl(330,65%,55%), hsl(300,60%,50%), hsl(280,55%,45%)) 1'
                  }}
                >
                  <span 
                    className="opacity-80 font-medium bg-clip-text text-transparent"
                    style={{ 
                      // Same gradient as .fade-gradient in index.css
                      backgroundImage: 'linear-gradient(90deg, hsl(45,70%,50%), hsl(35,75%,55%), hsl(25,80%,55%), hsl(350,70%,60%), hsl(330,65%,55%), hsl(300,60%,50%), hsl(280,55%,45%))',
                      backgroundSize: '200% 100%',
                      animation: 'fade-text-shimmer 3s ease-in-out infinite'
                    }}
                  >
                    {filter.label}:
                  </span>
                  <span 
                    className="font-medium bg-clip-text text-transparent"
                    style={{ 
                      backgroundImage: 'linear-gradient(90deg, hsl(45,70%,50%), hsl(35,75%,55%), hsl(25,80%,55%), hsl(350,70%,60%), hsl(330,65%,55%), hsl(300,60%,50%), hsl(280,55%,45%))',
                      backgroundSize: '200% 100%',
                      animation: 'fade-text-shimmer 3s ease-in-out infinite'
                    }}
                  >
                    {filter.value}
                  </span>
                  <FilterRemoveButton filter={filter} />
                </span>
              );
            }
            
            // Blue Gem % slider chip — use BG icon visual from custom, with % as extra
            if (isBlue) {
              return (
                <span key={filter.id} className="inline-flex items-center group">
                  <BlueGemVisual
                    showLabel
                    extra={filter.value}
                    size="chip"
                    onRemove={() => onRemoveFilter(filter.id)}
                  />
                </span>
              );
            }
            
            // 0.0% Metallic Gray gradient chip
            if (isZeroPoint) {
              return (
                <span
                  key={filter.id}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs group transition-colors border border-transparent relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, rgba(113,113,122,0.25) 0%, rgba(161,161,170,0.2) 25%, rgba(212,212,216,0.15) 50%, rgba(161,161,170,0.2) 75%, rgba(113,113,122,0.25) 100%)',
                    borderImage: 'linear-gradient(135deg, #71717a, #a1a1aa, #d4d4d8, #a1a1aa, #71717a) 1'
                  }}
                >
                  {/* Metallic circle icon with minus */}
                  <span 
                    className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      background: 'linear-gradient(135deg, #71717a 0%, #a1a1aa 30%, #d4d4d8 50%, #a1a1aa 70%, #71717a 100%)',
                      boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.3), 0 1px 2px rgba(0,0,0,0.3)'
                    }}
                  >
                    <Minus className="h-2.5 w-2.5 text-zinc-800" strokeWidth={3} />
                  </span>
                  <span className="font-medium bg-gradient-to-r from-zinc-400 via-zinc-300 to-zinc-400 bg-clip-text text-transparent">{filter.label}</span>
                  <FilterRemoveButton filter={filter} />
                </span>
              );
            }

            // Float Rank metallic chip
            if (isFloatRank) {
              const rankStyles = getFloatRankStyles(filter.value);
              return (
                <span
                  key={filter.id}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs group transition-colors border relative overflow-hidden ${
                    filter.value === 'gold' ? 'float-rank-shimmer-gold' : filter.value === 'silver' ? 'float-rank-shimmer-silver' : 'float-rank-shimmer-bronze'
                  }`}
                  style={{
                    background: rankStyles.bg,
                    borderColor: `${rankStyles.border}90`,
                    boxShadow: `0 0 8px ${rankStyles.border}40, inset 0 1px 0 rgba(255,255,255,0.15)`,
                  }}
                >
                  <span 
                    className="font-black text-sm bg-clip-text text-transparent relative z-10"
                    style={{ backgroundImage: rankStyles.textGradient }}
                  >
                    {rankStyles.label}
                  </span>
                  <FilterRemoveButton filter={filter} className="relative z-10" />
                </span>
              );
            }
            
            // Blue Gem effect chip (custom filter) — matches CustomFilterTab selected button
            if (isBlueGem) {
              // filter.value may be "1st" / "2nd" / "3rd" / percent / etc.
              const rawTier = filter.value === '1st' || filter.value === '2nd' || filter.value === '3rd'
                ? (filter.value as '1st' | '2nd' | '3rd')
                : null;
              const extra = rawTier ? undefined : (filter.value && filter.value !== 'Any' ? filter.value : undefined);
              return (
                <span key={filter.id} className="inline-flex items-center group">
                  <BlueGemVisual tier={rawTier} extra={extra} size="chip" onRemove={() => onRemoveFilter(filter.id)} />
                </span>
              );
            }

            // Fire & Ice chip — matches CustomFilterTab main button visual
            if (isFireAndIce) {
              const tier = (filter.value && filter.value !== "Any" ? filter.value : null) as '1st' | '2nd' | '3rd' | null;
              return (
                <span key={filter.id} className="inline-flex items-center group">
                  <FireIceVisual tier={tier} size="chip" onRemove={() => onRemoveFilter(filter.id)} />
                </span>
              );
            }

            
            // Discount/Overpay chip - shows range with two values, or single value when both are equal
            if (isDiscountOverpay) {
              // Parse the two values from "min|max" format
              const [minStr, maxStr] = filter.value.split('|');
              const minVal = parseFloat(minStr) || 0;
              const maxVal = parseFloat(maxStr) || 0;
              
              // When both values are the same, show a single compact chip
              if (minVal === maxVal) {
                const color = minVal < 0 ? 'hsl(142, 70%, 45%)' : minVal > 0 ? 'hsl(0, 75%, 50%)' : 'hsl(var(--muted-foreground))';
                return (
                  <span
                    key={filter.id}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs group transition-colors border relative overflow-hidden"
                    style={{
                      background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.2) 0%, rgba(34, 197, 94, 0.2) 100%)',
                      borderColor: 'rgba(150, 150, 150, 0.3)'
                    }}
                  >
                    <span className="flex items-center gap-0.5" style={{ color }}>
                      {minVal >= 0 ? (
                        <Plus className="h-3.5 w-3.5" strokeWidth={3} />
                      ) : (
                        <Minus className="h-3.5 w-3.5" strokeWidth={3} />
                      )}
                      <span className="font-bold text-sm">{Math.abs(minVal).toFixed(1)}%</span>
                    </span>
                    <FilterRemoveButton filter={filter} className="ml-1" />
                  </span>
                );
              }
              
              // Color logic: negative = discount (green), positive = overpay (red)
              // minVal is the lower bound (more discount/less overpay)
              // maxVal is the upper bound (less discount/more overpay)
              const minColor = minVal < 0 ? 'hsl(142, 70%, 45%)' : minVal > 0 ? 'hsl(0, 75%, 50%)' : 'hsl(var(--muted-foreground))';
              const maxColor = maxVal < 0 ? 'hsl(142, 70%, 45%)' : maxVal > 0 ? 'hsl(0, 75%, 50%)' : 'hsl(var(--muted-foreground))';
              
              return (
                <span
                  key={filter.id}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs group transition-colors border relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.2) 0%, rgba(34, 197, 94, 0.2) 100%)',
                    borderColor: 'rgba(150, 150, 150, 0.3)'
                  }}
                >
                  {/* Max value (Overpay/Red) - left side */}
                  <span className="flex items-center gap-0.5" style={{ color: maxColor }}>
                    {maxVal >= 0 ? (
                      <Plus className="h-3.5 w-3.5" strokeWidth={3} />
                    ) : (
                      <Minus className="h-3.5 w-3.5" strokeWidth={3} />
                    )}
                    <span className="font-bold text-sm">{Math.abs(maxVal).toFixed(1)}%</span>
                  </span>
                  
                  {/* Min value (Discount/Green) - right side */}
                  <span className="flex items-center gap-0.5" style={{ color: minColor }}>
                    {minVal <= 0 ? (
                      <Minus className="h-3.5 w-3.5" strokeWidth={3} />
                    ) : (
                      <Plus className="h-3.5 w-3.5" strokeWidth={3} />
                    )}
                    <span className="font-bold text-sm">{Math.abs(minVal).toFixed(1)}%</span>
                  </span>
                  
                  <FilterRemoveButton filter={filter} className="ml-1" />
                </span>
              );
            }
            
            // Stickers Overpay % gradient chip - dynamic colors based on selected range
            if (isSpSticker) {
              const overpayStyles = getOverpayGradientStyles(filter.value);
              const minPercent = parseFloat(filter.value.match(/(\d+(?:\.\d+)?)%/)?.[1] || "0");
              const maxPercent = parseFloat(filter.value.match(/(\d+(?:\.\d+)?)%\s*-\s*(\d+(?:\.\d+)?)%/)?.[2] || "100");
              const avgPercent = (minPercent + maxPercent) / 2;
              const avgColor = getOverpayColor(avgPercent);
              
              return (
                <span
                  key={filter.id}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs group transition-colors border border-transparent relative overflow-hidden"
                  style={{
                    background: overpayStyles.bg,
                    borderImage: overpayStyles.border
                  }}
                >
                  <span 
                    className="opacity-70 bg-clip-text text-transparent"
                    style={{ backgroundImage: overpayStyles.textGradient }}
                  >
                    {filter.label}:
                  </span>
                  <span 
                    className="font-medium bg-clip-text text-transparent"
                    style={{ backgroundImage: overpayStyles.textGradient }}
                  >
                    {filter.value}
                  </span>
                  <FilterRemoveButton filter={filter} />
                </span>
              );
            }
            
            // Paint Seed PACK with tooltip for multiple patterns - Emerald gradient style
            if (isPaintSeed && filter.paintSeeds && filter.paintSeeds.length > 1) {
              return (
                <Tooltip key={filter.id} delayDuration={0}>
                  <TooltipTrigger asChild>
                    <span
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs group transition-colors cursor-help border border-transparent relative overflow-hidden"
                      style={{
                        background: 'linear-gradient(135deg, rgba(20,184,166,0.2) 0%, rgba(45,212,191,0.25) 50%, rgba(20,184,166,0.2) 100%)',
                        borderImage: 'linear-gradient(135deg, #14b8a6, #2dd4bf, #14b8a6) 1'
                      }}
                    >
                      <FolderOpen className="h-3 w-3 text-teal-400" />
                      <span className="opacity-80 bg-gradient-to-r from-teal-400 to-teal-300 bg-clip-text text-transparent">{filter.label}:</span>
                      <span className="font-semibold bg-gradient-to-r from-teal-300 via-teal-400 to-teal-300 bg-clip-text text-transparent">{filter.value}</span>
                      <FilterRemoveButton filter={filter} />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[220px]">
                    <div className="text-xs space-y-1">
                      <div className="text-teal-400 font-medium mb-1.5">Paint Seeds Pack:</div>
                      <div className="flex flex-wrap gap-1">
                        {filter.paintSeeds.slice(0, 20).map((seed) => (
                          <span key={seed} className="font-mono text-teal-300">#{seed}</span>
                        ))}
                        {filter.paintSeeds.length > 20 && (
                          <span className="text-muted-foreground">+{filter.paintSeeds.length - 20} more</span>
                        )}
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            }
            
            return (
              <span
                key={filter.id}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs group transition-colors ${
                  hasCustomColor 
                    ? colorClass 
                    : "bg-primary/10 border border-primary/30 hover:bg-primary/20"
                } ${hasCustomColor ? "" : "border"}`}
              >
                {filter.value ? (
                  <>
                    <span className={hasCustomColor ? "opacity-70" : "text-muted-foreground"}>{filter.label}:</span>
                    <span className={hasCustomColor ? "font-medium" : "text-foreground font-medium"}>{filter.value}</span>
                  </>
                ) : (
                  <span className="font-medium">{filter.label}</span>
                )}
                <FilterRemoveButton filter={filter} />
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};