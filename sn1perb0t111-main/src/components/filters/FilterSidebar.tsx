import { useState, useMemo, useEffect, useRef } from "react";
import { Search, ChevronDown, ChevronUp, X, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { useWeaponContext } from "@/contexts/WeaponContextProvider";
import { useSoundSettings } from "@/contexts/SoundSettingsContext"; // Added import
import { ItemSearchCombobox } from "./ItemSearchCombobox";
import { FilterSection as FilterSectionType } from "@/components/targets/EditModeContext";
import { cn } from "@/lib/utils";

interface FilterData {
  priceFrom: string;
  priceTo: string;
  isAnyPrice: boolean;
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
  customFilterEnabled: boolean;
  statTrak: boolean;
  souvenir: boolean;
  highlight: boolean;
  normal: boolean;
  rarity: string;
  paintSeedMin: string;
  paintSeedMax: string;
  fadeFilterEnabled: boolean;
  blueGemFilterEnabled: boolean;
  phase?: string;
  charmProfitEnabled?: boolean;
  charmProfitMin?: string;
  charmProfitMax?: string;
  charmProfitUseLowestPrice?: boolean;
  charmProfitUseBidPrice?: boolean;
}

// Rarity color mapping for trigger (CS2 accurate colors)
const getRarityTriggerColor = (rarity: string): string => {
  const colorMap: Record<string, string> = {
    contraband: "text-[#e4ae33] border-[#e4ae33]/50",
    covert: "text-[#eb4b4b] border-[#eb4b4b]/50",
    classified: "text-[#d32ce6] border-[#d32ce6]/50",
    restricted: "text-[#8847ff] border-[#8847ff]/50",
    milspec: "text-[#4b69ff] border-[#4b69ff]/50",
    industrial: "text-[#5e98d9] border-[#5e98d9]/50",
    consumer: "text-[#b0c3d9] border-[#b0c3d9]/50",
    extraordinary: "text-[#e4ae33] border-[#e4ae33]/50",
    remarkable: "text-[#8847ff] border-[#8847ff]/50",
    exotic: "text-[#d32ce6] border-[#d32ce6]/50",
    highgrade: "text-[#4b69ff] border-[#4b69ff]/50",
    basegrade: "text-[#b0c3d9] border-[#b0c3d9]/50",
    agentquality: "text-[#4b69ff] border-[#4b69ff]/50",
  };
  return colorMap[rarity] || "";
};

interface FilterSidebarProps {
  filterData: FilterData & {
    selectedCharm?: string;
    charmPatternMin?: string;
    charmPatternMax?: string;
    selectedItem?: string;
    selectedItemType?: string;
  };
  onFilterChange: (key: string, value: any) => void;
  showCharmsSection?: boolean;
  charmsDisabledReason?: string;
  flashSection?: FilterSectionType | null;
}

interface FilterSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  collapsible?: boolean;
  sectionId?: FilterSectionType;
  isFlashing?: boolean;
}

const FilterSection = ({ title, children, defaultOpen = true, collapsible = true, sectionId, isFlashing }: FilterSectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const sectionRef = useRef<HTMLDivElement>(null);

  // Auto-open and scroll when flashing
  useEffect(() => {
    if (isFlashing && sectionRef.current) {
      setIsOpen(true);
      // Wait for the section to open before scrolling
      setTimeout(() => {
        sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [isFlashing]);

  if (!collapsible) {
    return (
      <div
        ref={sectionRef}
        data-filter-section={sectionId}
        className={`filter-section ${isFlashing ? 'filter-section-flash' : ''}`}
      >
        <div className="text-sm font-medium text-foreground">
          {title}
        </div>
        <div className="pt-3 space-y-3">
          {children}
        </div>
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={`filter-section ${isFlashing ? 'filter-section-flash' : ''}`}>
      <div ref={sectionRef} data-filter-section={sectionId}>
        <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium text-foreground hover:text-primary transition-colors">
          {title}
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-3">
          {children}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

// Wear range boundaries (CS2 standard)
const WEAR_RANGES: Record<string, [number, number]> = {
  FN: [0, 0.07],
  MW: [0.07, 0.15],
  FT: [0.15, 0.38],
  WW: [0.38, 0.45],
  BS: [0.45, 1.0],
};

// Get color for wear value based on gradient stops
const getWearColor = (value: number): string => {
  if (value <= 0.07) return "hsl(142 70% 35%)"; // Factory New - Dark Green
  if (value <= 0.15) return "hsl(82 75% 45%)";  // Minimal Wear - Lime
  if (value <= 0.38) return "hsl(65 80% 50%)";  // Field-Tested - Yellow-Green
  if (value <= 0.45) return "hsl(25 90% 50%)";  // Well-Worn - Orange
  return "hsl(0 70% 40%)";                       // Battle-Scarred - Dark Red
};

// Check if current wear range matches a quality preset
const getActiveWearQuality = (min: number, max: number): string | null => {
  for (const [quality, [rangeMin, rangeMax]] of Object.entries(WEAR_RANGES)) {
    if (Math.abs(min - rangeMin) < 0.001 && Math.abs(max - rangeMax) < 0.001) {
      return quality;
    }
  }
  return null;
};

// Wear quality colors for buttons
const WEAR_BUTTON_COLORS: Record<string, { border: string; text: string; bg: string; glow: string }> = {
  FN: {
    border: "border-[#1a6b1a]",
    text: "text-[#22c55e]",
    bg: "bg-[#1a6b1a]/20",
    glow: "shadow-[0_0_8px_rgba(34,197,94,0.5)]"
  },
  MW: {
    border: "border-[#4d7c0f]",
    text: "text-[#a3e635]",
    bg: "bg-[#4d7c0f]/20",
    glow: "shadow-[0_0_8px_rgba(163,230,53,0.5)]"
  },
  FT: {
    border: "border-[#a16207]",
    text: "text-[#facc15]",
    bg: "bg-[#a16207]/20",
    glow: "shadow-[0_0_8px_rgba(250,204,21,0.5)]"
  },
  WW: {
    border: "border-[#c2410c]",
    text: "text-[#fb923c]",
    bg: "bg-[#c2410c]/20",
    glow: "shadow-[0_0_8px_rgba(251,146,60,0.5)]"
  },
  BS: {
    border: "border-[#7f1d1d]",
    text: "text-[#ef4444]",
    bg: "bg-[#7f1d1d]/20",
    glow: "shadow-[0_0_8px_rgba(239,68,68,0.5)]"
  },
};

const WearChip = ({
  label,
  isActive,
  onSetRange
}: {
  label: string;
  isActive: boolean;
  onSetRange: () => void;
}) => {
  const colors = WEAR_BUTTON_COLORS[label];
  return (
    <button
      onClick={onSetRange}
      className={`px-3 py-1.5 rounded border-2 text-xs font-bold transition-all ${colors.border} ${colors.text} ${isActive
        ? `${colors.bg} ${colors.glow}`
        : 'bg-transparent hover:bg-secondary/30'
        }`}
    >
      {label}
    </button>
  );
};

// Logarithmic scale conversion for comfortable price progression
const priceToSlider = (price: number): number => {
  if (price <= 0) return 0;
  if (price <= 100) return (price / 100) * 25; // 0-100 -> 0-25%
  if (price <= 1000) return 25 + ((price - 100) / 900) * 25; // 100-1000 -> 25-50%
  if (price <= 10000) return 50 + ((price - 1000) / 9000) * 25; // 1000-10000 -> 50-75%
  return 75 + ((price - 10000) / 90000) * 25; // 10000-100000 -> 75-100%
};

const sliderToPrice = (slider: number): number => {
  if (slider <= 25) return Math.round((slider / 25) * 100);
  if (slider <= 50) return Math.round(100 + ((slider - 25) / 25) * 900);
  if (slider <= 75) return Math.round(1000 + ((slider - 50) / 25) * 9000);
  return Math.round(10000 + ((slider - 75) / 25) * 90000);
};

// Logarithmic scale conversion for charm pattern (1-100000) - sharper progression
const patternToSlider = (pattern: number): number => {
  if (pattern <= 1) return 0;
  if (pattern <= 10) return ((pattern - 1) / 9) * 14; // 1-10 -> 0-14%
  if (pattern <= 100) return 14 + ((pattern - 10) / 90) * 14; // 10-100 -> 14-28%
  if (pattern <= 1000) return 28 + ((pattern - 100) / 900) * 14; // 100-1000 -> 28-42%
  if (pattern <= 10000) return 42 + ((pattern - 1000) / 9000) * 14; // 1000-10000 -> 42-56%
  return 56 + ((pattern - 10000) / 90000) * 44; // 10000-100000 -> 56-100%
};

const sliderToPattern = (slider: number): number => {
  if (slider <= 14) return Math.max(1, Math.round(1 + (slider / 14) * 9));
  if (slider <= 28) return Math.round(10 + ((slider - 14) / 14) * 90);
  if (slider <= 42) return Math.round(100 + ((slider - 28) / 14) * 900);
  if (slider <= 56) return Math.round(1000 + ((slider - 42) / 14) * 9000);
  return Math.round(10000 + ((slider - 56) / 44) * 90000);
};

// Get charm pattern slider thumb color based on position (0-100)
const getCharmThumbColor = (sliderPos: number): string => {
  // Gradient: deep purple -> purple -> violet -> bright violet -> electric indigo
  if (sliderPos <= 20) return "hsl(270 50% 35%)";
  if (sliderPos <= 40) return "hsl(265 60% 45%)";
  if (sliderPos <= 60) return "hsl(260 70% 55%)";
  if (sliderPos <= 80) return "hsl(255 75% 60%)";
  return "hsl(250 80% 65%)";
};

// Interpolate color for Charm Profit slider (0 to +100)
// 0 = Red (#ef4444) -> 50 = Yellow (#eab308) -> +100 = Green (#22c55e)
const getProfitThumbColor = (percent: number): string => {
  // Normalize 0..100
  if (percent <= 50) {
    // Red to Yellow
    const ratio = percent / 50;
    const r = Math.round(239 + (234 - 239) * ratio);
    const g = Math.round(68 + (179 - 68) * ratio);
    const b = Math.round(68 + (8 - 68) * ratio);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  } else {
    // Yellow to Green
    const ratio = (percent - 50) / 50;
    const r = Math.round(234 + (34 - 234) * ratio);
    const g = Math.round(179 + (197 - 179) * ratio);
    const b = Math.round(8 + (94 - 8) * ratio);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
};

import { CHARM_LIST } from "@/data/charms";

export const FilterSidebar = ({
  filterData,
  onFilterChange,
  showCharmsSection = true,
  charmsDisabledReason,
  flashSection
}: FilterSidebarProps) => {
  const { setWeaponCategory } = useWeaponContext();
  const { playSound } = useSoundSettings(); // Added hook
  const [charmSearch, setCharmSearch] = useState("");
  const [charmPopoverOpen, setCharmPopoverOpen] = useState(false);

  // Use filterData values for selected item
  const selectedItem = filterData.selectedItem || "";

  // Use filterData values for charm state
  const selectedCharm = filterData.selectedCharm || "";
  const patternMin = filterData.charmPatternMin ?? "1";
  const patternMax = filterData.charmPatternMax ?? "100000";

  const filteredCharms = useMemo(() => {
    if (!charmSearch.trim()) return CHARM_LIST;

    const searchTerms = charmSearch.toLowerCase().trim().split(/\s+/);

    // Filter
    const filtered = CHARM_LIST.filter(charm => {
      // Also allow searching with "Charm | " prefix stripped from the search term
      const searchStripped = charmSearch.toLowerCase().replace(/^charm \| /i, '').trim();
      const terms = searchStripped.split(/\s+/);
      const charmName = charm.toLowerCase();
      return terms.every(term => charmName.includes(term));
    });

    // Sort
    return filtered.sort((a, b) => {
      const nameA = a.toLowerCase();
      const nameB = b.toLowerCase();
      const searchLower = charmSearch.toLowerCase();

      // Exact match priority
      if (nameA === searchLower && nameB !== searchLower) return -1;
      if (nameB === searchLower && nameA !== searchLower) return 1;

      // Starts with priority
      const aStarts = nameA.startsWith(searchLower);
      const bStarts = nameB.startsWith(searchLower);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      return 0;
    });
  }, [charmSearch]);

  const handleCharmSelect = (charm: string) => {
    // Always store with the "Charm | " prefix that CSFloat API expects
    const fullName = charm.startsWith("Charm | ") ? charm : `Charm | ${charm}`;
    onFilterChange("selectedCharm", fullName);
    setCharmSearch("");
    setCharmPopoverOpen(false);
  };

  const clearCharm = () => {
    onFilterChange("selectedCharm", "");
    setCharmSearch("");
  };

  const toggleWear = (wear: string) => {
    const newWear = filterData.activeWear.includes(wear)
      ? filterData.activeWear.filter(w => w !== wear)
      : [...filterData.activeWear, wear];
    onFilterChange("activeWear", newWear);
  };

  // Editable price presets - stored in state
  const [pricePresets, setPricePresets] = useState([
    { from: 20, to: 200 },
    { from: 100, to: 500 },
    { from: 500, to: 2000 },
    { from: 2000, to: 10000 },
  ]);
  const [editingPreset, setEditingPreset] = useState<number | null>(null);
  const [editPresetFrom, setEditPresetFrom] = useState("");
  const [editPresetTo, setEditPresetTo] = useState("");

  const handlePresetClick = (index: number) => {
    if (editingPreset === index) return;
    const preset = pricePresets[index];
    onFilterChange("priceFrom", String(preset.from));
    onFilterChange("priceTo", String(preset.to));
    onFilterChange("rangePriceFromPending", String(preset.from));
    onFilterChange("rangePriceToPending", String(preset.to));
    onFilterChange("rangePriceConfirmed", true);
  };

  const handlePresetDoubleClick = (index: number) => {
    const preset = pricePresets[index];
    setEditingPreset(index);
    setEditPresetFrom(String(preset.from));
    setEditPresetTo(String(preset.to));
  };

  const handlePresetSave = () => {
    if (editingPreset === null) return;
    const from = parseInt(editPresetFrom) || 0;
    const to = parseInt(editPresetTo) || 0;
    if (from > 0 && to > from) {
      setPricePresets(prev => prev.map((p, i) =>
        i === editingPreset ? { from, to } : p
      ));
    }
    setEditingPreset(null);
  };

  const handlePresetKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handlePresetSave();
    if (e.key === "Escape") setEditingPreset(null);
  };

  return (
    <ScrollArea className="h-full">
      <div className="bg-sidebar p-4">
        {/* Search for items */}
        <div
          className={`mb-4 ${flashSection === 'item' ? 'filter-section-flash' : ''}`}
          data-filter-section="item"
        >
          <ItemSearchCombobox
            selectedItem={selectedItem}
            onItemSelect={(item, phase) => {
              onFilterChange("selectedItem", item);
              if (phase) {
                onFilterChange("phase", phase);
              } else {
                onFilterChange("phase", "");
              }
            }}
            onClearItem={() => {
              onFilterChange("selectedItem", "");
              onFilterChange("phase", "");
            }}
            fadeFilterEnabled={filterData.fadeFilterEnabled}
            blueGemFilterEnabled={filterData.blueGemFilterEnabled}
            defaultCategory={filterData.selectedItemType}
          />
        </div>



        {/* Price Filter */}
        <FilterSection title="Price" sectionId="price" isFlashing={flashSection === 'price'}>
          <div className="space-y-3">
            {/* Range / Fixed Toggle - disabled when confirmed */}
            <div className={`flex rounded-md overflow-hidden border border-border ${(filterData.fixedPriceConfirmed || filterData.rangePriceConfirmed) ? 'opacity-50' : ''}`}>
              <button
                onClick={() => {
                  if (!filterData.fixedPriceConfirmed && !filterData.rangePriceConfirmed) {
                    onFilterChange("isFixedPrice", false);
                  }
                }}
                disabled={filterData.fixedPriceConfirmed || filterData.rangePriceConfirmed}
                className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${!filterData.isFixedPrice
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary/50 text-muted-foreground hover:text-foreground'
                  } ${(filterData.fixedPriceConfirmed || filterData.rangePriceConfirmed) ? 'cursor-not-allowed' : ''}`}
              >
                Range
              </button>
              <button
                onClick={() => {
                  if (!filterData.fixedPriceConfirmed && !filterData.rangePriceConfirmed) {
                    onFilterChange("isFixedPrice", true);
                  }
                }}
                disabled={filterData.fixedPriceConfirmed || filterData.rangePriceConfirmed}
                className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${filterData.isFixedPrice
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary/50 text-muted-foreground hover:text-foreground'
                  } ${(filterData.fixedPriceConfirmed || filterData.rangePriceConfirmed) ? 'cursor-not-allowed' : ''}`}
              >
                Fixed
              </button>
            </div>

            {filterData.isFixedPrice ? (
              /* Fixed Price Mode - Single slider with input and checkmark */
              <div className="space-y-3">
                {/* Single Price Slider with gradient */}
                <div className="relative">
                  <div className={`absolute inset-0 h-2 top-1/2 -translate-y-1/2 rounded-full price-gradient ${filterData.fixedPriceConfirmed ? 'opacity-50' : ''}`} />
                  <Slider
                    value={[priceToSlider(Number(filterData.fixedPriceConfirmed ? filterData.priceFrom : (filterData.fixedPricePending || "0")))]}
                    min={0}
                    max={100}
                    step={0.5}
                    thumbColors={["#34d399"]}
                    onValueChange={(value) => {
                      const price = sliderToPrice(value[0]);
                      onFilterChange("fixedPricePending", String(price));
                      onFilterChange("fixedPriceConfirmed", false);
                      playSound(); // Play sound
                    }}
                    disabled={filterData.fixedPriceConfirmed}
                    className="relative [&_[data-slot=track]]:bg-transparent"
                  />
                </div>


                <div className="flex items-center justify-center gap-2">
                  {/* Invisible spacer for balance */}
                  <div className="w-6 h-6 invisible" />

                  <div className="relative">
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={filterData.fixedPriceConfirmed ? "" : (filterData.fixedPricePending || "")}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9.]/g, '');
                        const parts = value.split('.');
                        const sanitized = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : value;
                        onFilterChange("fixedPricePending", sanitized);
                        onFilterChange("fixedPriceConfirmed", false);
                      }}
                      className="bg-input border-border h-8 w-28 text-center focus:border-primary focus:ring-primary/20 placeholder:text-muted-foreground/30"
                      placeholder="0.00"
                      disabled={filterData.fixedPriceConfirmed}
                    />
                    {filterData.fixedPriceConfirmed && (
                      <div className="absolute inset-0 flex items-center justify-center bg-input/80 rounded-md">
                        <span className="text-xs text-accent font-medium">${filterData.priceFrom}</span>
                      </div>
                    )}
                  </div>

                  {/* Confirm/Cancel Button */}
                  <button
                    onClick={() => {
                      if (filterData.fixedPriceConfirmed) {
                        onFilterChange("fixedPriceConfirmed", false);
                        onFilterChange("fixedPricePending", filterData.priceFrom);
                      } else if (filterData.fixedPricePending && filterData.fixedPricePending !== "") {
                        onFilterChange("priceFrom", filterData.fixedPricePending);
                        onFilterChange("priceTo", filterData.fixedPricePending);
                        onFilterChange("fixedPriceConfirmed", true);
                      }
                    }}
                    disabled={!filterData.fixedPriceConfirmed && (!filterData.fixedPricePending || filterData.fixedPricePending === "")}
                    className={`h-6 w-6 rounded border-2 flex items-center justify-center transition-all ${filterData.fixedPriceConfirmed
                      ? 'bg-destructive border-destructive text-destructive-foreground hover:bg-destructive/80'
                      : filterData.fixedPricePending && filterData.fixedPricePending !== ""
                        ? 'border-accent/50 hover:bg-accent/20 text-accent'
                        : 'border-muted-foreground/30 text-muted-foreground/30 cursor-not-allowed'
                      }`}
                  >
                    {filterData.fixedPriceConfirmed ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                  </button>
                </div>

                {filterData.fixedPriceConfirmed && (
                  <p className="text-[10px] text-muted-foreground text-center">
                    Click ✕ to edit price
                  </p>
                )}
              </div>
            ) : (
              /* Range Price Mode - Min/Max with Slider and Confirmation */
              <div className="space-y-3">
                {/* Price Slider with gradient */}
                <div className="relative">
                  <div className={`absolute inset-0 h-2 top-1/2 -translate-y-1/2 rounded-full price-gradient ${filterData.rangePriceConfirmed ? 'opacity-50' : ''}`} />
                  <Slider
                    value={[priceToSlider(Number(filterData.rangePriceConfirmed ? filterData.priceFrom : (filterData.rangePriceFromPending || "0"))),
                    filterData.isAnyPrice ? 100 : priceToSlider(Number(filterData.rangePriceConfirmed ? filterData.priceTo : (filterData.rangePriceToPending || "100000")))]}
                    min={0}
                    max={100}
                    step={0.5}
                    thumbColors={[
                      "hsl(145 70% 40%)",  // Darker emerald for min
                      filterData.isAnyPrice ? "hsl(0 0% 80%)" : "hsl(155 75% 45%)"   // Grey for Any, Brighter teal-green max
                    ]}
                    onValueChange={(value) => {
                      const minPrice = sliderToPrice(value[0]);
                      const maxPrice = sliderToPrice(value[1]);
                      onFilterChange("rangePriceFromPending", String(minPrice));
                      if (!filterData.isAnyPrice) {
                        onFilterChange("rangePriceToPending", String(maxPrice));
                      }
                      onFilterChange("rangePriceConfirmed", false);
                      playSound(); // Play sound
                    }}
                    disabled={filterData.rangePriceConfirmed}
                    className="relative [&_[data-slot=track]]:bg-transparent"
                  />
                </div>

                {/* Min/Max Inputs with Labels */}
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-muted-foreground mb-1 block">Minimum Price</label>
                    <div className="relative">
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={filterData.rangePriceConfirmed ? "" : (filterData.rangePriceFromPending || "")}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9.]/g, '');
                          // Allow only one decimal point
                          const parts = value.split('.');
                          const sanitized = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : value;
                          onFilterChange("rangePriceFromPending", sanitized);
                          onFilterChange("rangePriceConfirmed", false);
                        }}
                        className="bg-input border-border h-8 text-center focus:border-primary focus:ring-primary/20 placeholder:text-muted-foreground/30"
                        placeholder="0.00"
                        disabled={filterData.rangePriceConfirmed}
                      />
                      {filterData.rangePriceConfirmed && (
                        <div className="absolute inset-0 flex items-center justify-center bg-input/80 rounded-md pointer-events-none">
                          <span className="text-xs text-emerald-400 font-medium">${filterData.priceFrom}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Confirm/Cancel Button - centered between inputs */}
                  <button
                    onClick={() => {
                      if (filterData.rangePriceConfirmed) {
                        // When cancelling, restore pending values and reset priceFrom/priceTo to defaults
                        onFilterChange("rangePriceConfirmed", false);
                        onFilterChange("rangePriceFromPending", filterData.priceFrom);
                        onFilterChange("rangePriceToPending", filterData.priceTo);
                        // Reset actual price values so preset doesn't stay highlighted
                        onFilterChange("priceFrom", "10");
                        onFilterChange("priceTo", "100000");
                      } else {
                        const hasFrom = filterData.rangePriceFromPending && filterData.rangePriceFromPending !== "";
                        const hasTo = filterData.rangePriceToPending && filterData.rangePriceToPending !== "";
                        if (hasFrom || hasTo || filterData.isAnyPrice) {
                          onFilterChange("priceFrom", filterData.rangePriceFromPending || "0");
                          if (filterData.isAnyPrice) {
                            onFilterChange("priceTo", "Any");
                          } else {
                            onFilterChange("priceTo", filterData.rangePriceToPending || "100000");
                          }
                          onFilterChange("rangePriceConfirmed", true);
                        }
                      }
                    }}
                    disabled={!filterData.rangePriceConfirmed && !filterData.rangePriceFromPending && !filterData.rangePriceToPending && !filterData.isAnyPrice}
                    className={`h-8 w-8 rounded border-2 flex items-center justify-center transition-all shrink-0 ${filterData.rangePriceConfirmed
                      ? 'bg-destructive border-destructive text-destructive-foreground hover:bg-destructive/80'
                      : (filterData.rangePriceFromPending || filterData.rangePriceToPending)
                        ? 'border-emerald-500/50 hover:bg-emerald-500/20 text-emerald-400'
                        : 'border-muted-foreground/30 text-muted-foreground/30 cursor-not-allowed'
                      }`}
                  >
                    {filterData.rangePriceConfirmed ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                  </button>

                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] text-muted-foreground block">Maximum Price</label>
                      <div className="flex items-center gap-1">
                        <Checkbox
                          id="any-price"
                          checked={filterData.isAnyPrice}
                          onCheckedChange={(checked) => {
                            onFilterChange("isAnyPrice", checked === true);
                            onFilterChange("rangePriceConfirmed", false);
                            if (checked) {
                              onFilterChange("rangePriceToPending", "Any");
                            } else {
                              onFilterChange("rangePriceToPending", "100000"); // Default back to 100k or previous
                            }
                          }}
                          className="h-3 w-3 border-muted-foreground/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                        <label htmlFor="any-price" className="text-[9px] text-muted-foreground cursor-pointer select-none">Any</label>
                      </div>
                    </div>
                    <div className="relative">
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={filterData.isAnyPrice ? "Any" : (filterData.rangePriceConfirmed ? "" : (filterData.rangePriceToPending || ""))}
                        onChange={(e) => {
                          if (filterData.isAnyPrice) return;
                          const value = e.target.value.replace(/[^0-9.]/g, '');
                          // Allow only one decimal point
                          const parts = value.split('.');
                          const sanitized = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : value;
                          onFilterChange("rangePriceToPending", sanitized);
                          onFilterChange("rangePriceConfirmed", false);
                        }}
                        className={`bg-input border-border h-8 text-center focus:border-primary focus:ring-primary/20 placeholder:text-muted-foreground/30 ${filterData.isAnyPrice ? 'text-muted-foreground italic' : ''}`}
                        placeholder="0.00"
                        disabled={filterData.rangePriceConfirmed || filterData.isAnyPrice}
                      />
                      {filterData.rangePriceConfirmed && (
                        <div className="absolute inset-0 flex items-center justify-center bg-input/80 rounded-md pointer-events-none">
                          <span className="text-xs text-emerald-400 font-medium">{filterData.isAnyPrice ? "Any" : `$${filterData.priceTo}`}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {filterData.rangePriceConfirmed && (
                  <p className="text-[10px] text-muted-foreground text-center">
                    Click ✕ to edit price
                  </p>
                )}

                {/* Quick Price Presets */}
                <div className="grid grid-cols-4 gap-1.5 mt-3">
                  {pricePresets.map((preset, index) => (
                    editingPreset === index ? (
                      <div key={index} className="flex flex-col gap-1 col-span-2 p-2 bg-secondary/50 rounded border border-primary/50">
                        <div className="flex gap-1 items-center">
                          <Input
                            type="number"
                            value={editPresetFrom}
                            onChange={(e) => setEditPresetFrom(e.target.value)}
                            onKeyDown={handlePresetKeyDown}
                            className="h-6 text-[10px] bg-input px-1 w-14"
                            placeholder="From"
                            autoFocus
                          />
                          <span className="text-[10px] text-muted-foreground">-</span>
                          <Input
                            type="number"
                            value={editPresetTo}
                            onChange={(e) => setEditPresetTo(e.target.value)}
                            onKeyDown={handlePresetKeyDown}
                            className="h-6 text-[10px] bg-input px-1 w-14"
                            placeholder="To"
                          />
                          <button
                            onClick={handlePresetSave}
                            className="h-5 w-5 rounded bg-accent/20 hover:bg-accent/40 flex items-center justify-center"
                          >
                            <Check className="h-3 w-3 text-accent" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        key={index}
                        onClick={() => handlePresetClick(index)}
                        onDoubleClick={() => handlePresetDoubleClick(index)}
                        className={`px-1.5 py-1.5 text-[10px] rounded border transition-all ${Number(filterData.priceFrom) === preset.from && Number(filterData.priceTo) === preset.to
                          ? 'border-primary bg-primary/20 text-primary'
                          : 'border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                          }`}
                        title="Double-click to edit"
                      >
                        ${preset.from}-${preset.to}
                      </button>
                    )
                  ))}
                </div>
                <p className="text-[9px] text-muted-foreground/60 text-center">Double-click to edit presets</p>
              </div>
            )}
          </div>
        </FilterSection>

        {/* Wear Filter */}
        <FilterSection title="Wear" sectionId="wear" isFlashing={flashSection === 'wear'}>
          <div className="space-y-3">
            <div className="relative">
              <div className="absolute inset-0 h-2 top-1/2 -translate-y-1/2 rounded-full wear-gradient" />
              <Slider
                value={[Number(filterData.wearMin), Number(filterData.wearMax)]}
                min={0}
                max={1}
                step={0.01}
                thumbColors={[
                  getWearColor(Number(filterData.wearMin)),
                  getWearColor(Number(filterData.wearMax))
                ]}
                onValueChange={(value) => {
                  // Use Math.round to properly snap to 0.01 boundaries (fixes 0.06 → 0.07 issue)
                  const minV = Math.round(value[0] * 100) / 100;
                  const maxV = Math.round(value[1] * 100) / 100;
                  onFilterChange("wearMin", String(minV));
                  onFilterChange("wearMax", String(maxV));
                  playSound(); // Play sound
                }}
                className="relative [&_[data-slot=track]]:bg-transparent"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground/80 mb-1 block font-medium">Minimum</label>
                <Input
                  type="number"
                  value={filterData.wearMin}
                  onChange={(e) => onFilterChange("wearMin", e.target.value)}
                  className="bg-input border-border h-9 focus:border-primary focus:ring-primary/20"
                  min={0}
                  max={1}
                  step={0.01}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground/80 mb-1 block font-medium">Maximum</label>
                <Input
                  type="number"
                  value={filterData.wearMax}
                  onChange={(e) => onFilterChange("wearMax", e.target.value)}
                  className="bg-input border-border h-9 focus:border-primary focus:ring-primary/20"
                  min={0}
                  max={1}
                  step={0.01}
                />
              </div>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {(["FN", "MW", "FT", "WW", "BS"] as const).map((wear) => {
                const activeQuality = getActiveWearQuality(
                  Number(filterData.wearMin),
                  Number(filterData.wearMax)
                );
                return (
                  <WearChip
                    key={wear}
                    label={wear}
                    isActive={activeQuality === wear}
                    onSetRange={() => {
                      const range = WEAR_RANGES[wear];
                      onFilterChange("wearMin", String(range[0]));
                      onFilterChange("wearMax", String(range[1]));
                    }}
                  />
                );
              })}
            </div>
          </div>
        </FilterSection>

        {/* Special - Mutually exclusive checkboxes */}
        <FilterSection title="Special" collapsible={false} sectionId="special" isFlashing={flashSection === 'special'}>
          <div className="flex justify-center gap-6">
            <label className="flex items-center gap-2 text-[15px] cursor-pointer transition-colors py-1 hover:text-foreground text-muted-foreground">
              <Checkbox
                checked={filterData.statTrak}
                onCheckedChange={(checked) => {
                  if (checked) {
                    onFilterChange("statTrak", true);
                    onFilterChange("souvenir", false);
                    onFilterChange("normal", false);
                  } else {
                    onFilterChange("statTrak", false);
                  }
                }}
                className="h-[17px] w-[17px] border-border data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
              />
              <span className="text-orange-400">StatTrak™</span>
            </label>
            <label className="flex items-center gap-2 text-[15px] cursor-pointer transition-colors py-1 hover:text-foreground text-muted-foreground">
              <Checkbox
                checked={filterData.souvenir}
                onCheckedChange={(checked) => {
                  if (checked) {
                    onFilterChange("statTrak", false);
                    onFilterChange("souvenir", true);
                    onFilterChange("normal", false);
                  } else {
                    onFilterChange("souvenir", false);
                  }
                }}
                className="h-[17px] w-[17px] border-border data-[state=checked]:bg-[#d8d060] data-[state=checked]:border-[#d8d060]"
              />
              <span style={{ color: '#d8d060' }}>Souvenir</span>
            </label>
            <label className="flex items-center gap-2 text-[15px] cursor-pointer transition-colors py-1 hover:text-foreground text-muted-foreground">
              <Checkbox
                checked={filterData.normal}
                onCheckedChange={(checked) => {
                  if (checked) {
                    onFilterChange("statTrak", false);
                    onFilterChange("souvenir", false);
                    onFilterChange("normal", true);
                  }
                  // Normal cannot be unchecked directly - user must select ST or Souvenir
                }}
                className="h-[17px] w-[17px] border-border data-[state=checked]:bg-zinc-400 data-[state=checked]:border-zinc-400"
              />
              <span>Normal</span>
            </label>
          </div>
        </FilterSection>

        {/* Charms - conditionally rendered based on weapon type */}
        {showCharmsSection ? (
          <FilterSection title="Charms" sectionId="charm" isFlashing={flashSection === 'charm'}>
            <div className="space-y-3">
              <Popover open={charmPopoverOpen} onOpenChange={setCharmPopoverOpen}>
                <PopoverTrigger asChild>
                  <div className="relative">
                    {selectedCharm ? (
                      <div className="flex items-center gap-2 bg-input border border-border rounded-md px-3 py-2 h-10 cursor-pointer hover:border-primary/50 transition-colors">
                        <span className="text-sm flex-1 truncate">{selectedCharm}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            clearCharm();
                          }}
                          className="p-1 hover:bg-destructive/20 rounded transition-colors group"
                        >
                          <X className="h-4 w-4 text-muted-foreground group-hover:text-destructive" />
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search charms..."
                          value={charmSearch}
                          onChange={(e) => {
                            setCharmSearch(e.target.value);
                            setCharmPopoverOpen(true);
                          }}
                          onFocus={() => setCharmPopoverOpen(true)}
                          className="pl-9 bg-input border-border text-sm h-10"
                        />
                      </div>
                    )}
                  </div>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[--radix-popover-trigger-width] p-0 bg-card border-border z-50"
                  align="start"
                  side="bottom"
                  sideOffset={4}
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <div className="max-h-[200px] overflow-y-auto custom-scrollbar p-1">
                    {filteredCharms.length > 0 ? (
                      filteredCharms.map((charm) => (
                        <button
                          key={charm}
                          onClick={() => handleCharmSelect(charm)}
                          className="w-full px-2.5 py-2 text-sm rounded hover:bg-secondary/80 transition-colors text-left"
                        >
                          <span className="truncate">{charm}</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-2.5 py-3 text-sm text-muted-foreground text-center">
                        No charms found
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Pattern Slider */}
              <div className="relative">
                <div className="absolute inset-0 h-2 top-1/2 -translate-y-1/2 rounded-full charms-gradient" />
                <Slider
                  value={[
                    patternToSlider(Number(patternMin) || 1),
                    patternToSlider(Number(patternMax) || 100000)
                  ]}
                  min={0}
                  max={100}
                  step={0.5}
                  thumbColors={[
                    getCharmThumbColor(patternToSlider(Number(patternMin) || 1)),
                    getCharmThumbColor(patternToSlider(Number(patternMax) || 100000))
                  ]}
                  transparentTrack={true}
                  onValueChange={(value) => {
                    const minPattern = sliderToPattern(value[0]);
                    const maxPattern = sliderToPattern(value[1]);
                    onFilterChange("charmPatternMin", String(minPattern));
                    onFilterChange("charmPatternMax", String(maxPattern));
                    playSound(); // Play sound
                  }}
                  className="relative"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Min Pattern</label>
                  <Input
                    value={patternMin}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      onFilterChange("charmPatternMin", val || "1");
                    }}
                    className="bg-input border-border text-sm h-9"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Max Pattern</label>
                  <Input
                    value={patternMax}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      onFilterChange("charmPatternMax", val || "100000");
                    }}
                    className="bg-input border-border text-sm h-9"
                  />
                </div>
              </div>

              {/* Charm Profit Filter */}
              <div className="pt-4 border-t border-border mt-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-foreground">Charm Profit</label>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <label htmlFor="charm-profit-lowest-price" className="text-xs text-muted-foreground cursor-pointer select-none">
                        Use Lowest Market Price
                      </label>
                      <Checkbox
                        id="charm-profit-lowest-price"
                        checked={filterData.charmProfitUseLowestPrice}
                        onCheckedChange={(checked) => {
                          onFilterChange("charmProfitEnabled", true);
                          onFilterChange("charmProfitUseLowestPrice", checked === true);
                          if (checked === true) onFilterChange("charmProfitUseBidPrice", false);
                        }}
                        className="h-4 w-4 border-muted-foreground/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label htmlFor="charm-profit-bid-price" className="text-xs text-muted-foreground cursor-pointer select-none">
                        Use Bid Price
                      </label>
                      <Checkbox
                        id="charm-profit-bid-price"
                        checked={filterData.charmProfitUseBidPrice}
                        onCheckedChange={(checked) => {
                          onFilterChange("charmProfitEnabled", true);
                          onFilterChange("charmProfitUseBidPrice", checked === true);
                          if (checked === true) onFilterChange("charmProfitUseLowestPrice", false);
                        }}
                        className="h-4 w-4 border-muted-foreground/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                    </div>
                  </div>
                </div>

                {/* Slider is only active when at least one price mode checkbox is selected */}
                {(() => {
                  const isPriceModeSelected = filterData.charmProfitUseLowestPrice || filterData.charmProfitUseBidPrice;
                  return (
                    <div className={`px-1.5 pb-2 transition-opacity ${isPriceModeSelected ? '' : 'opacity-40 pointer-events-none'}`}>
                      <div className="relative">
                        <div className="absolute inset-0 h-2 top-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-red-500 via-yellow-400 to-green-500" />
                        <Slider
                          value={[
                            Number(filterData.charmProfitMin ?? 0),
                            Number(filterData.charmProfitMax ?? 100)
                          ]}
                          min={0}
                          max={100}
                          step={1}
                          transparentTrack={true}
                          thumbColors={[
                            getProfitThumbColor(Number(filterData.charmProfitMin ?? 0)),
                            getProfitThumbColor(Number(filterData.charmProfitMax ?? 100))
                          ]}
                          onValueChange={(value) => {
                            onFilterChange("charmProfitEnabled", true);
                            onFilterChange("charmProfitMin", String(value[0]));
                            onFilterChange("charmProfitMax", String(value[1]));
                            playSound();
                          }}
                          disabled={!isPriceModeSelected}
                          className="relative"
                        />
                      </div>
                      <div className="flex justify-between items-center mt-3">
                        <span className="text-xs text-muted-foreground bg-input px-2 py-0.5 rounded border border-border min-w-[3rem] text-center">
                          {filterData.charmProfitMin ?? 0}%
                        </span>
                        <span className="text-[10px] text-muted-foreground/60 uppercase font-medium">Profit Range</span>
                        <span className="text-xs text-muted-foreground bg-input px-2 py-0.5 rounded border border-border min-w-[3rem] text-center">
                          {filterData.charmProfitMax ?? 100}%
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </FilterSection>
        ) : charmsDisabledReason ? (
          <div className="filter-section opacity-30 grayscale pointer-events-none">
            <div className="flex items-center justify-between text-sm font-medium text-foreground">
              <span>Charms</span>
              <span className="text-xs text-muted-foreground">{charmsDisabledReason}</span>
            </div>
          </div>
        ) : null}

        {/* Rarity */}
        <FilterSection title="Rarity" collapsible={false} sectionId="rarity" isFlashing={flashSection === 'rarity'}>
          <Select value={filterData.rarity || "any"} onValueChange={(value) => onFilterChange("rarity", value === "any" ? "" : value)}>
            <SelectTrigger className={`bg-input border-border text-base h-10 ${getRarityTriggerColor(filterData.rarity)}`}>
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent
              className="bg-card border-border z-50 overflow-hidden"
              position="popper"
              side="bottom"
              align="start"
              sideOffset={4}
              avoidCollisions={false}
            >
              <ScrollArea className="h-[200px]">
                <div className="p-1">
                  <SelectItem value="any">All</SelectItem>
                  <SelectItem value="contraband" className="text-[#e4ae33]">Contraband</SelectItem>
                  <SelectItem value="covert" className="text-[#eb4b4b]">Covert</SelectItem>
                  <SelectItem value="classified" className="text-[#d32ce6]">Classified</SelectItem>
                  <SelectItem value="restricted" className="text-[#8847ff]">Restricted</SelectItem>
                  <SelectItem value="milspec" className="text-[#4b69ff]">Mil-Spec Grade</SelectItem>
                  <SelectItem value="industrial" className="text-[#5e98d9]">Industrial Grade</SelectItem>
                  <SelectItem value="consumer" className="text-[#b0c3d9]">Consumer Grade</SelectItem>
                  <SelectItem value="extraordinary" className="text-[#e4ae33]">Extraordinary</SelectItem>
                  <SelectItem value="remarkable" className="text-[#8847ff]">Remarkable</SelectItem>
                  <SelectItem value="exotic" className="text-[#d32ce6]">Exotic</SelectItem>
                  <SelectItem value="highgrade" className="text-[#4b69ff]">High Grade</SelectItem>
                  <SelectItem value="basegrade" className="text-[#b0c3d9]">Base Grade</SelectItem>
                  <SelectItem value="agentquality" className="text-[#4b69ff]">Agent Quality</SelectItem>
                </div>
              </ScrollArea>
            </SelectContent>
          </Select>
        </FilterSection>
      </div>
    </ScrollArea >
  );
};
