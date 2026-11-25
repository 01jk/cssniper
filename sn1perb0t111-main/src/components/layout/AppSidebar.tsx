import { useState, useEffect, useCallback } from "react";
import {
  StopCircle,
  PlayCircle,
  RefreshCw,
  Filter,
  Sliders,
  ChevronDown,
  ChevronUp,
  Plus,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterSidebar } from "@/components/filters/FilterSidebar";
import { CustomFilterTab } from "@/components/filters/CustomFilterTab";
import { StickersCharmsTab, StickerFilter } from "@/components/filters/StickersCharmsTab";
import { PatternsTab } from "@/components/filters/PatternsTab";
import { ActiveFiltersPanel, ActiveFilter } from "@/components/filters/ActiveFiltersPanel";

export interface FilterData {
  priceFrom: string;
  priceTo: string;
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
  stickersPricePercentEnabled: boolean;
  stickersPricePercentMin: string;
  stickersPricePercentMax: string;
  customFilterEnabled: boolean;
  discountOverpayMin: number;
  discountOverpayMax: number;
  paintSeeds: number[];
  activePatternFilter: "fade" | "blueGem" | undefined;
  fadeFilterEnabled: boolean;
  blueGemFilterEnabled: boolean;
  // Price logic
  isAnyPrice: boolean;
  isFixedPrice: boolean;
  fixedPriceConfirmed: boolean;
  fixedPricePending: string;
  rangePriceConfirmed: boolean;
  rangePriceFromPending: string;
  rangePriceToPending: string;
  // Item logic
  selectedItem: string;
  selectedItemType: string;
  selectedCharm: string;
  charmPatternMin: string;
  charmPatternMax: string;
  // Special filters
  statTrak: boolean;
  souvenir: boolean;
  highlight: boolean;
  normal: boolean;
  // Rarity
  rarity: string;
  // Paint Seed
  paintSeedMin: string;
  paintSeedMax: string;
  // Stickers
  stickers: StickerFilter[];
  // Float Ranks
  floatRankGold: boolean;
  floatRankSilver: boolean;
  floatRankBronze: boolean;
}

const DEFAULT_STICKERS: StickerFilter[] = [];

const DEFAULT_FILTER_DATA: FilterData = {
  priceFrom: "10",
  priceTo: "100000",
  wearMin: "0",
  wearMax: "1",
  activeWear: [],
  fadeMin: "80",
  fadeMax: "100",
  blueMin: "0",
  blueMax: "100",
  blueGemEnabled: false,
  blueGemPercent: 0,
  basePriceEnabled: false,
  basePricePercent: 0,
  spStickerEnabled: false,
  spStickerPercentMin: 0,
  spStickerPercentMax: 100,
  stickersPricePercentEnabled: false,
  stickersPricePercentMin: "0",
  stickersPricePercentMax: "100",
  customFilterEnabled: false,
  discountOverpayMin: 0,
  discountOverpayMax: 0,
  paintSeeds: [],
  activePatternFilter: undefined,
  fadeFilterEnabled: false,
  blueGemFilterEnabled: false,
  isAnyPrice: false,
  isFixedPrice: false,
  fixedPriceConfirmed: false,
  fixedPricePending: "",
  rangePriceConfirmed: false,
  rangePriceFromPending: "",
  rangePriceToPending: "",
  selectedItem: "",
  selectedItemType: "",
  selectedCharm: "",
  charmPatternMin: "",
  charmPatternMax: "",
  // Special filters
  statTrak: false,
  souvenir: false,
  highlight: false,
  normal: false,
  // Rarity
  rarity: "",
  // Paint Seed
  paintSeedMin: "0",
  paintSeedMax: "1000",
  // Stickers
  stickers: DEFAULT_STICKERS,
  // Float Ranks
  floatRankGold: false,
  floatRankSilver: false,
  floatRankBronze: false,
};

interface AppSidebarProps {
  onAddTarget?: (filterData: FilterData, configId: string) => void;
  showFilters?: boolean;
  onToggleFilters?: () => void;
  configs?: { id: string; name: string }[];
  activeConfigId?: string;
}

export const AppSidebar = ({
  onAddTarget,
  showFilters = false,
  onToggleFilters,
  configs = [],
  activeConfigId = ""
}: AppSidebarProps) => {
  const [botRunning, setBotRunning] = useState(true);
  const [activeTab, setActiveTab] = useState("filters");
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [selectedConfigId, setSelectedConfigId] = useState(activeConfigId);

  const [filterData, setFilterData] = useState<FilterData>({ ...DEFAULT_FILTER_DATA });
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);

  // Generate active filters from filterData
  const generateActiveFilters = useCallback((data: FilterData): ActiveFilter[] => {
    const filters: ActiveFilter[] = [];

    // Price filter
    if (data.priceFrom !== DEFAULT_FILTER_DATA.priceFrom || data.priceTo !== DEFAULT_FILTER_DATA.priceTo) {
      filters.push({
        id: "price",
        type: "price",
        label: "Цена",
        value: `$${data.priceFrom} - $${data.priceTo}`
      });
    }

    // Wear filter
    if (data.wearMin !== DEFAULT_FILTER_DATA.wearMin || data.wearMax !== DEFAULT_FILTER_DATA.wearMax) {
      filters.push({
        id: "wear",
        type: "wear",
        label: "Износ",
        value: `${data.wearMin} - ${data.wearMax}`
      });
    }

    // Active wear types
    if (data.activeWear.length > 0) {
      filters.push({
        id: "wearType",
        type: "wearType",
        label: "Тип износа",
        value: data.activeWear.join(", ")
      });
    }

    // Fade filter
    if (data.fadeMin !== DEFAULT_FILTER_DATA.fadeMin || data.fadeMax !== DEFAULT_FILTER_DATA.fadeMax) {
      filters.push({
        id: "fade",
        type: "fade",
        label: "Fade",
        value: `${data.fadeMin}% - ${data.fadeMax}%`
      });
    }

    // Blue filter
    if (data.blueMin !== DEFAULT_FILTER_DATA.blueMin || data.blueMax !== DEFAULT_FILTER_DATA.blueMax) {
      filters.push({
        id: "blue",
        type: "blue",
        label: "Blue",
        value: `${data.blueMin}% - ${data.blueMax}%`
      });
    }

    // Blue Gem
    if (data.blueGemEnabled) {
      filters.push({
        id: "blueGem",
        type: "blueGem",
        label: "Blue Gem",
        value: `${data.blueGemPercent.toFixed(1)}%`
      });
    }

    // Base Price
    if (data.basePriceEnabled) {
      filters.push({
        id: "basePrice",
        type: "basePrice",
        label: "Base Price",
        value: "Включено"
      });
    }

    // Sticker Price
    if (data.spStickerEnabled) {
      filters.push({
        id: "spSticker",
        type: "spSticker",
        label: "Sticker Price",
        value: `${data.spStickerPercentMin}% - ${data.spStickerPercentMax}%`
      });
    }

    // Sticker Price Percent (SP)
    if (data.stickersPricePercentEnabled) {
      filters.push({
        id: "stickersPricePercent",
        type: "stickersPricePercent",
        label: "SP",
        value: `${data.stickersPricePercentMin}% - ${data.stickersPricePercentMax}%`
      });
    }

    // Sticker Price Percent (SP)
    if (data.stickersPricePercentEnabled) {
      filters.push({
        id: "stickersPricePercent",
        type: "stickersPricePercent",
        label: "SP",
        value: `${data.stickersPricePercentMin}% - ${data.stickersPricePercentMax}%`
      });
    }

    // Custom Filter
    if (data.customFilterEnabled) {
      filters.push({
        id: "customFilter",
        type: "custom",
        label: "Custom Filter",
        value: "Enabled"
      });
    }

    // Special filters
    if (data.statTrak) {
      filters.push({ id: "statTrak", type: "special", label: "StatTrak™", value: "" });
    }
    if (data.souvenir) {
      filters.push({ id: "souvenir", type: "special", label: "Souvenir", value: "" });
    }
    if (data.highlight) {
      filters.push({ id: "highlight", type: "special", label: "Highlight", value: "" });
    }
    if (data.normal) {
      filters.push({ id: "normal", type: "special", label: "Normal", value: "" });
    }

    // Float Ranks
    if (data.floatRankGold) {
      filters.push({ id: "floatRankGold", type: "floatRank", label: "Float Rank", value: "Gold" });
    }
    if (data.floatRankSilver) {
      filters.push({ id: "floatRankSilver", type: "floatRank", label: "Float Rank", value: "Silver" });
    }
    if (data.floatRankBronze) {
      filters.push({ id: "floatRankBronze", type: "floatRank", label: "Float Rank", value: "Bronze" });
    }

    // Rarity
    if (data.rarity && data.rarity !== "") {
      const rarityLabels: Record<string, string> = {
        consumer: "Consumer Grade",
        industrial: "Industrial Grade",
        milspec: "Mil-Spec",
        restricted: "Restricted",
        classified: "Classified",
        covert: "Covert",
        contraband: "Contraband"
      };
      filters.push({
        id: "rarity",
        type: "rarity",
        label: "Rarity",
        value: rarityLabels[data.rarity] || data.rarity
      });
    }

    // Paint Seed
    if (data.paintSeedMin !== DEFAULT_FILTER_DATA.paintSeedMin || data.paintSeedMax !== DEFAULT_FILTER_DATA.paintSeedMax) {
      filters.push({
        id: "paintSeed",
        type: "paintSeed",
        label: "Paint Seed",
        value: `${data.paintSeedMin} - ${data.paintSeedMax}`
      });
    }

    // Stickers
    data.stickers.forEach((sticker, index) => {
      if (sticker.name.trim()) {
        const slotLabel = sticker.slot === "any" ? "Any" : `Slot ${sticker.slot}`;
        filters.push({
          id: `sticker-${index}`,
          type: "sticker",
          label: "Sticker",
          value: `${sticker.name} (${slotLabel})`
        });
      }
    });

    return filters;
  }, []);

  useEffect(() => {
    setActiveFilters(generateActiveFilters(filterData));
  }, [filterData, generateActiveFilters]);

  const updateFilterData = (key: keyof FilterData, value: any) => {
    setFilterData(prev => ({ ...prev, [key]: value }));
  };

  const removeFilter = (filterId: string) => {
    switch (filterId) {
      case "price":
        setFilterData(prev => ({
          ...prev,
          priceFrom: DEFAULT_FILTER_DATA.priceFrom,
          priceTo: DEFAULT_FILTER_DATA.priceTo
        }));
        break;
      case "wear":
        setFilterData(prev => ({
          ...prev,
          wearMin: DEFAULT_FILTER_DATA.wearMin,
          wearMax: DEFAULT_FILTER_DATA.wearMax
        }));
        break;
      case "wearType":
        setFilterData(prev => ({ ...prev, activeWear: [] }));
        break;
      case "fade":
        setFilterData(prev => ({
          ...prev,
          fadeMin: DEFAULT_FILTER_DATA.fadeMin,
          fadeMax: DEFAULT_FILTER_DATA.fadeMax
        }));
        break;
      case "blue":
        setFilterData(prev => ({
          ...prev,
          blueMin: DEFAULT_FILTER_DATA.blueMin,
          blueMax: DEFAULT_FILTER_DATA.blueMax
        }));
        break;
      case "blueGem":
        setFilterData(prev => ({
          ...prev,
          blueGemEnabled: false,
          blueGemPercent: 0
        }));
        break;
      case "basePrice":
        setFilterData(prev => ({ ...prev, basePriceEnabled: false }));
        break;
      case "spSticker":
        setFilterData(prev => ({
          ...prev,
          spStickerEnabled: false,
          spStickerPercent: 0
        }));
        break;
      case "stickersPricePercent":
        setFilterData(prev => ({
          ...prev,
          stickersPricePercentEnabled: false,
          stickersPricePercentMin: "0",
          stickersPricePercentMax: "100"
        }));
        break;
      case "statTrak":
        setFilterData(prev => ({ ...prev, statTrak: false }));
        break;
      case "souvenir":
        setFilterData(prev => ({ ...prev, souvenir: false }));
        break;
      case "highlight":
        setFilterData(prev => ({ ...prev, highlight: false }));
        break;
      case "normal":
        setFilterData(prev => ({ ...prev, normal: false }));
        break;
      case "floatRankGold":
        setFilterData(prev => ({ ...prev, floatRankGold: false }));
        break;
      case "floatRankSilver":
        setFilterData(prev => ({ ...prev, floatRankSilver: false }));
        break;
      case "floatRankBronze":
        setFilterData(prev => ({ ...prev, floatRankBronze: false }));
        break;
      case "rarity":
        setFilterData(prev => ({ ...prev, rarity: "" }));
        break;
      case "paintSeed":
        setFilterData(prev => ({
          ...prev,
          paintSeedMin: DEFAULT_FILTER_DATA.paintSeedMin,
          paintSeedMax: DEFAULT_FILTER_DATA.paintSeedMax
        }));
        break;
      default:
        // Handle sticker removal
        if (filterId.startsWith("sticker-")) {
          const index = parseInt(filterId.replace("sticker-", ""));
          setFilterData(prev => ({
            ...prev,
            stickers: prev.stickers.map((s, i) =>
              i === index ? { name: "", slot: "any", isWhole: true, price: 0 } : s
            )
          }));
        }
        break;
    }
  };

  const handleStickersChange = (stickers: StickerFilter[]) => {
    setFilterData(prev => ({ ...prev, stickers }));
  };

  const clearAllFilters = () => {
    setFilterData({ ...DEFAULT_FILTER_DATA });
  };

  const handleAddToTarget = () => {
    if (onAddTarget) {
      onAddTarget(filterData, selectedConfigId || activeConfigId);
    }
  };

  // Update selected config when activeConfigId changes
  if (selectedConfigId === "" && activeConfigId !== "") {
    setSelectedConfigId(activeConfigId);
  }

  return (
    <aside className="w-[376px] h-screen flex flex-col bg-sidebar border-r border-border">
      <Collapsible open={!headerCollapsed} onOpenChange={(open) => setHeaderCollapsed(!open)}>
        <CollapsibleTrigger asChild>
          <div className="p-4 border-b border-border flex items-center justify-between cursor-pointer hover:bg-secondary/30 transition-colors">
            <h1 className="text-lg font-bold text-foreground">CSFloat Sniper Bot</h1>
            {headerCollapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-4 border-b border-border space-y-3">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${botRunning ? 'status-running' : 'status-stopped'}`}>
              <div className={`w-2 h-2 rounded-full ${botRunning ? 'bg-accent animate-pulse-glow' : 'bg-destructive'}`} />
              <span className="text-sm font-medium">{botRunning ? "Bot Status: Running (PID: 107)" : "Bot Status: Stopped"}</span>
            </div>
            <Button variant="outline" className="w-full border-border hover:bg-secondary" onClick={() => setBotRunning(!botRunning)}>
              {botRunning ? <><StopCircle className="h-4 w-4 mr-2" />Stop Bot</> : <><PlayCircle className="h-4 w-4 mr-2" />Start Bot</>}
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="p-4 border-b border-border">
        <Button
          onClick={() => {
            if (!showFilters) {
              setHeaderCollapsed(true);
            }
            onToggleFilters?.();
          }}
          className={`w-full ${showFilters ? 'bg-secondary hover:bg-secondary/80 text-foreground' : 'bg-accent hover:bg-accent/90 text-accent-foreground'}`}
        >
          <Plus className="h-4 w-4 mr-2" />{showFilters ? 'Cancel' : 'Create Target'}
        </Button>
      </div>

      {showFilters && (
        <div className="flex-1 flex flex-col min-h-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="mx-4 mt-4 bg-secondary/50 p-1 shrink-0 grid grid-cols-4 w-auto">
              <TabsTrigger value="filters" className="text-xs px-2 data-[state=active]:bg-card data-[state=active]:text-foreground">
                <Filter className="h-3 w-3 mr-1" />
                <span className="truncate">Filters</span>
              </TabsTrigger>
              <TabsTrigger value="patterns" className="text-xs px-2 data-[state=active]:bg-card data-[state=active]:text-foreground">
                <Sparkles className="h-3 w-3 mr-1" />
                <span className="truncate">Patterns</span>
              </TabsTrigger>
              <TabsTrigger value="stickers" className="text-xs px-2 data-[state=active]:bg-card data-[state=active]:text-foreground">
                <Sparkles className="h-3 w-3 mr-1" />
                <span className="truncate">Stickers</span>
              </TabsTrigger>
              <TabsTrigger value="custom" className="text-xs px-2 data-[state=active]:bg-card data-[state=active]:text-foreground">
                <Sliders className="h-3 w-3 mr-1" />
                <span className="truncate">Custom</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="filters" className="flex-1 mt-0 overflow-hidden">
              <FilterSidebar filterData={filterData} onFilterChange={updateFilterData} />
            </TabsContent>
            <TabsContent value="patterns" className="flex-1 mt-0 overflow-hidden">
              <PatternsTab filterData={filterData} onFilterChange={updateFilterData} />
            </TabsContent>
            <TabsContent value="stickers" className="flex-1 mt-0 overflow-hidden">
              <StickersCharmsTab stickers={filterData.stickers} onStickersChange={handleStickersChange} />
            </TabsContent>
            <TabsContent value="custom" className="flex-1 mt-0 overflow-hidden">
              <CustomFilterTab filterData={filterData} onFilterChange={updateFilterData} />
            </TabsContent>
          </Tabs>

          {/* Active Filters Panel */}
          <div className="px-4 py-3 border-t border-border shrink-0">
            <ActiveFiltersPanel
              filters={activeFilters}
              onRemoveFilter={removeFilter}
              onClearAll={clearAllFilters}
            />
          </div>

          <div className="p-4 border-t border-border shrink-0 space-y-3">
            {configs.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Add to:</span>
                <Select value={selectedConfigId} onValueChange={setSelectedConfigId}>
                  <SelectTrigger className="flex-1 h-8 text-xs bg-input border-border">
                    <SelectValue placeholder="Select config" />
                  </SelectTrigger>
                  <SelectContent>
                    {configs.map((config) => (
                      <SelectItem key={config.id} value={config.id} className="text-xs">
                        {config.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={handleAddToTarget} className="w-full bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />Add to Target
            </Button>
          </div>
        </div>
      )}

      {!showFilters && (
        <div className="mt-auto p-4 border-t border-border space-y-3">
          <div className="text-xs text-muted-foreground">
            <span className="block mb-1">CSFloat Balance</span>
            <span className="text-xl font-bold text-accent">$0.00</span>
          </div>
          <Button variant="outline" className="w-full border-border hover:bg-secondary text-xs">
            <RefreshCw className="h-3 w-3 mr-2" />Refresh Dashboard
          </Button>
          <div className="text-xs text-primary">Polling: 0.5s - 0.6s</div>
        </div>
      )}
    </aside>
  );
};
