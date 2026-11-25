import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  Filter,
  Sliders,
  Sparkles,
  Plus,
  X,
  AlertCircle,
  Save
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FilterSidebar } from "@/components/filters/FilterSidebar";
import { CustomFilterTab } from "@/components/filters/CustomFilterTab";
import { StickersCharmsTab, StickerFilter } from "@/components/filters/StickersCharmsTab";
import { PatternsTab } from "@/components/filters/PatternsTab";
import { ActiveFiltersPanel, ActiveFilter } from "@/components/filters/ActiveFiltersPanel";
import { TargetConfirmDialog } from "./TargetConfirmDialog";
import { useWeaponContext } from "@/contexts/WeaponContextProvider";
import { useEditMode, FilterSection } from "./EditModeContext";

export interface FilterData {
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
  stickersPricePercentEnabled: boolean;
  stickersPricePercentMin: string;
  stickersPricePercentMax: string;
  customFilterEnabled: boolean;
  discountOverpayMin: number; // -100 to +100
  discountOverpayMax: number; // -100 to +100
  statTrak: boolean;
  souvenir: boolean;
  highlight: boolean;
  normal: boolean;
  rarity: string;
  paintSeedMin: string;
  paintSeedMax: string;
  paintSeeds?: number[];
  fadeFilterEnabled: boolean;
  blueGemFilterEnabled: boolean;
  stickers: StickerFilter[];
  selectedCharm: string;
  charmPatternMin: string;
  charmPatternMax: string;
  charmProfitEnabled: boolean;
  charmProfitMin: string;
  charmProfitMax: string;
  charmProfitUseLowestPrice: boolean;
  charmProfitUseBidPrice: boolean;
  selectedItem: string;
  selectedItemType: string;
  activePatternFilter?: 'fade' | 'blueGem' | null;
  // Float Rank
  floatRankGold: boolean;
  floatRankSilver: boolean;
  floatRankBronze: boolean;
  phase?: string;
  fireAndIceEnabled: boolean;
  fireAndIceTier: '1st' | '2nd' | '3rd' | null;
  blueGemTier: '1st' | '2nd' | '3rd' | null;
}

const DEFAULT_STICKERS: StickerFilter[] = [];

const DEFAULT_FILTER_DATA: FilterData = {
  priceFrom: "",
  priceTo: "",
  isAnyPrice: false,
  isFixedPrice: false,
  fixedPriceConfirmed: false,
  fixedPricePending: "",
  rangePriceConfirmed: false,
  rangePriceFromPending: "",
  rangePriceToPending: "",
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
  statTrak: false,
  souvenir: false,
  highlight: false,
  normal: false,
  rarity: "",
  paintSeedMin: "",
  paintSeedMax: "",
  fadeFilterEnabled: false,
  blueGemFilterEnabled: false,
  stickers: DEFAULT_STICKERS,
  selectedCharm: "",
  charmPatternMin: "1",
  charmPatternMax: "100000",
  charmProfitEnabled: false,
  charmProfitMin: "0",
  charmProfitMax: "100",
  charmProfitUseLowestPrice: false,
  charmProfitUseBidPrice: false,
  selectedItem: "",
  selectedItemType: "",
  // Float Rank
  floatRankGold: false,
  floatRankSilver: false,
  floatRankBronze: false,
  phase: "",
  fireAndIceEnabled: false,
  fireAndIceTier: null,
  blueGemTier: null,
};

interface TargetFilterPanelProps {
  onAddTarget: (filterData: FilterData) => void;
  onUpdateTarget?: (targetId: number, filterData: FilterData) => void;
}

// Disabled tab trigger with tooltip
const DisabledTabTrigger = ({
  value,
  icon: Icon,
  label,
  reason
}: {
  value: string;
  icon: React.ElementType;
  label: string;
  reason: string;
}) => (
  <Tooltip delayDuration={300}>
    <TooltipTrigger asChild>
      <div className="flex-1">
        <div className="w-full text-xs px-2 py-1.5 flex items-center justify-center gap-1 opacity-30 cursor-not-allowed grayscale">
          <Icon className="h-3 w-3" />
          <span className="truncate">{label}</span>
          <AlertCircle className="h-3 w-3 ml-0.5 text-muted-foreground" />
        </div>
      </div>
    </TooltipTrigger>
    <TooltipContent
      side="bottom"
      className="bg-popover/95 border-border text-foreground max-w-[200px] text-xs"
    >
      {reason}
    </TooltipContent>
  </Tooltip>
);

export const TargetFilterPanel = ({ onAddTarget, onUpdateTarget }: TargetFilterPanelProps) => {
  const { features, weaponCategory } = useWeaponContext();
  const { isEditMode, setIsEditMode, editingTargetId, highlightedSection, flashSection, pendingFilterData, setPendingFilterData, setEditingTargetId, setHighlightedSection, setOnExitEditMode } = useEditMode();
  const [activeTab, setActiveTab] = useState("filters");
  const [filterData, setFilterData] = useState<FilterData>({ ...DEFAULT_FILTER_DATA });
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [updateConfirmDialogOpen, setUpdateConfirmDialogOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Register reset callback for when edit mode is exited
  useEffect(() => {
    const resetFilters = () => {
      setFilterData({ ...DEFAULT_FILTER_DATA });
      setActiveTab("filters");
    };
    setOnExitEditMode(resetFilters);

    return () => {
      setOnExitEditMode(null);
    };
  }, [setOnExitEditMode]);

  // Track previous editing target to detect actual target switches
  const prevEditingTargetIdRef = useRef<number | null>(null);

  // Load pending filter data ONLY when switching to a DIFFERENT target
  // This prevents losing unsaved changes when clicking cells of the same target
  useEffect(() => {
    if (isEditMode && pendingFilterData && editingTargetId) {
      // Only reload if we're switching to a different target
      const isNewTarget = prevEditingTargetIdRef.current !== editingTargetId;

      if (isNewTarget) {
        setFilterData(prev => ({ ...prev, ...pendingFilterData }));
        prevEditingTargetIdRef.current = editingTargetId;
      }
    } else if (!isEditMode) {
      // Reset when exiting edit mode
      prevEditingTargetIdRef.current = null;
    }
  }, [isEditMode, pendingFilterData, editingTargetId]);

  // Switch tab based on highlighted section
  useEffect(() => {
    if (highlightedSection) {
      const sectionToTab: Record<FilterSection, string> = {
        item: 'filters',
        price: 'filters',
        wear: 'filters',
        rarity: 'filters',
        special: 'filters',
        charm: 'filters',
        stickers: 'stickers',
        patterns: 'patterns',
        paintSeed: 'patterns',
        fade: 'patterns',
        blueGem: 'patterns',
        custom: 'custom',
        discount: 'custom',
        discountOverpay: 'custom',
        stickerOverpay: 'custom',
        stickersPricePercent: 'custom'
      };
      setActiveTab(sectionToTab[highlightedSection] || 'filters');
    }
  }, [highlightedSection]);

  // Auto-switch tab if current tab becomes unavailable
  useEffect(() => {
    if (activeTab === "stickers" && !features.showStickersTab) {
      setActiveTab("filters");
    }
    if (activeTab === "patterns" && !features.showPatternsTab) {
      setActiveTab("filters");
    }
  }, [activeTab, features.showStickersTab, features.showPatternsTab]);
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);

  const generateActiveFilters = useCallback((data: FilterData): ActiveFilter[] => {
    const filters: ActiveFilter[] = [];

    // Selected Item filter (skin/item name)
    if (data.selectedItem && data.selectedItem.trim()) {
      filters.push({
        id: "selectedItem",
        type: "item",
        label: "Item",
        value: data.selectedItem
      });
    }

    if (data.phase && data.phase !== "") {
      filters.push({
        id: "phase",
        type: "phase",
        label: "Phase",
        value: data.phase
      });
    }

    if (data.isFixedPrice && data.fixedPriceConfirmed) {
      filters.push({
        id: "price",
        type: "price",
        label: "Fixed Price",
        value: `$${data.priceFrom}`
      });
    } else if (!data.isFixedPrice && data.isAnyPrice) {
      filters.push({
        id: "price",
        type: "price",
        label: "Price Range",
        value: `$${data.priceFrom} - Any`
      });
    } else if (!data.isFixedPrice && data.rangePriceConfirmed) {
      filters.push({
        id: "price",
        type: "price",
        label: "Price Range",
        value: `$${data.priceFrom} - $${data.priceTo}`
      });
    }

    if (data.wearMin !== DEFAULT_FILTER_DATA.wearMin || data.wearMax !== DEFAULT_FILTER_DATA.wearMax) {
      filters.push({
        id: "wear",
        type: "wear",
        label: "Wear",
        value: `${data.wearMin} - ${data.wearMax}`
      });
    }

    if (data.activeWear.length > 0) {
      filters.push({
        id: "wearType",
        type: "wearType",
        label: "Wear Type",
        value: data.activeWear.join(", ")
      });
    }

    if (data.fadeMin !== DEFAULT_FILTER_DATA.fadeMin || data.fadeMax !== DEFAULT_FILTER_DATA.fadeMax) {
      filters.push({
        id: "fade",
        type: "fade",
        label: "Fade %",
        value: `${data.fadeMin}% - ${data.fadeMax}%`
      });
    }

    if (data.blueMin !== DEFAULT_FILTER_DATA.blueMin || data.blueMax !== DEFAULT_FILTER_DATA.blueMax) {
      filters.push({
        id: "blue",
        type: "blue",
        label: "Blue Gem %",
        value: `${data.blueMin}% - ${data.blueMax}%`
      });
    }

    if (data.blueGemEnabled) {
      filters.push({
        id: "blueGem",
        type: "blueGem",
        label: "Blue Gem",
        value: data.blueGemTier ?? "Any"
      });
    }

    if (data.fireAndIceEnabled) {
      filters.push({
        id: "fireAndIce",
        type: "fireAndIce",
        label: "Fire & Ice",
        value: data.fireAndIceTier ?? "Any"
      });
    }

    // Show Sticker Overpay in Active Filters
    const hasStickerPricePercentChanged = data.stickersPricePercentMin !== "0" || data.stickersPricePercentMax !== "100";
    if (hasStickerPricePercentChanged) {
      filters.push({
        id: "stickersPricePercent",
        type: "stickersPricePercent",
        label: "Sticker Price",
        value: `${data.stickersPricePercentMin}% - ${data.stickersPricePercentMax}%`
      });
    }

    // Show Charm Profit in Active Filters
    const hasCharmProfitChanged = data.charmProfitMin !== "0" || data.charmProfitMax !== "100" || data.charmProfitUseLowestPrice || data.charmProfitUseBidPrice;
    if (hasCharmProfitChanged) {
      let label = "Charm Profit";
      if (data.charmProfitUseLowestPrice) {
        label = "Charm Profit (LMP)";
      } else if (data.charmProfitUseBidPrice) {
        label = "Charm Profit (BP)";
      }
      filters.push({
        id: "charmProfit",
        type: "charmProfit",
        label: label,
        value: data.charmProfitMax === "10000" ? `${data.charmProfitMin}% - ∞` : `${data.charmProfitMin}% - ${data.charmProfitMax}%`
      });
    }

    // Show Sticker Wear (SP Sticker) if active
    const hasStickerWearChanged = data.spStickerPercentMin !== 0 || data.spStickerPercentMax !== 100;
    if (hasStickerWearChanged) {
      filters.push({
        id: "spSticker",
        type: "spSticker",
        label: "Sticker Wear",
        value: `${data.spStickerPercentMin}% - ${data.spStickerPercentMax}%`
      });
    }

    if (data.customFilterEnabled) {
      filters.push({
        id: "customFilter",
        type: "custom",
        label: "0.0%",
        value: ""
      });
    }

    // Float Rank filters
    if (data.floatRankGold) {
      filters.push({
        id: "floatRankGold",
        type: "floatRank",
        label: "Float Rank",
        value: "gold"
      });
    }
    if (data.floatRankSilver) {
      filters.push({
        id: "floatRankSilver",
        type: "floatRank",
        label: "Float Rank",
        value: "silver"
      });
    }
    if (data.floatRankBronze) {
      filters.push({
        id: "floatRankBronze",
        type: "floatRank",
        label: "Float Rank",
        value: "bronze"
      });
    }

    // Discount/Overpay filter - show when range is set (not both 0)
    if (data.discountOverpayMin !== 0 || data.discountOverpayMax !== 0) {
      filters.push({
        id: "discountOverpay",
        type: "discountOverpay",
        label: "Discount/Overpay",
        value: `${data.discountOverpayMin}|${data.discountOverpayMax}` // Pass both values
      });
    }

    if (data.statTrak) {
      filters.push({ id: "statTrak", type: "special", label: "StatTrak™", value: "" });
    }
    if (data.souvenir) {
      filters.push({ id: "souvenir", type: "special", label: "Souvenir", value: "" });
    }
    // Normal is intentionally NOT added to active filters - it's the default state

    // Rarity filter
    if (data.rarity && data.rarity !== "") {
      const rarityLabels: Record<string, string> = {
        contraband: "Contraband",
        covert: "Covert",
        classified: "Classified",
        restricted: "Restricted",
        milspec: "Mil-Spec Grade",
        industrial: "Industrial Grade",
        consumer: "Consumer Grade",
        extraordinary: "Extraordinary",
        remarkable: "Remarkable",
        exotic: "Exotic",
        highgrade: "High Grade",
        basegrade: "Base Grade",
        agentquality: "Agent Quality"
      };
      filters.push({
        id: "rarity",
        type: "rarity",
        label: "Rarity",
        value: rarityLabels[data.rarity] || data.rarity
      });
    }

    // Show Paint Seeds filter (multi-entry pack)
    if (data.paintSeeds && data.paintSeeds.length > 0) {
      if (data.paintSeeds.length === 1) {
        filters.push({
          id: "paintSeeds",
          type: "paintSeed",
          label: "Paint Seed",
          value: `#${data.paintSeeds[0]}`,
          paintSeeds: data.paintSeeds
        });
      } else {
        filters.push({
          id: "paintSeeds",
          type: "paintSeed",
          label: "Paint Seeds",
          value: `${data.paintSeeds.length} seeds`,
          paintSeeds: data.paintSeeds
        });
      }
    }
    // Legacy: Show Paint Seed filter when value is set (not default 0)
    else if (data.paintSeedMin && data.paintSeedMin !== "0" && data.paintSeedMin !== "") {
      filters.push({
        id: "paintSeed",
        type: "paintSeed",
        label: "Paint Seed",
        value: `#${data.paintSeedMin}`
      });
    }

    // Combine stickers into a single stack filter - only include confirmed stickers (not partial typing)
    // A sticker is considered "confirmed" if it has a name with at least 5 characters (collections like "Katowice 2014" or full sticker names)
    const activeStickers = data.stickers.filter(s => {
      const name = s.name.trim();
      // Must have a meaningful name (not just a few typed characters)
      // Collections are like "Katowice 2014" (min 10 chars), individual stickers are longer
      return name.length >= 10;
    });
    if (activeStickers.length > 0) {
      filters.push({
        id: "stickers-stack",
        type: "stickersStack",
        label: "Stickers",
        value: JSON.stringify(activeStickers.map(s => ({
          name: s.name,
          slot: s.slot,
          isWhole: s.isWhole,
          wearMin: s.wearMin,
          wearMax: s.wearMax
        })))
      });
    }

    // Charm filter (combined with pattern if both exist)
    if (data.selectedCharm && data.selectedCharm.trim()) {
      const hasPatternFilter = data.charmPatternMin !== DEFAULT_FILTER_DATA.charmPatternMin ||
        data.charmPatternMax !== DEFAULT_FILTER_DATA.charmPatternMax;

      let charmValue = data.selectedCharm;
      if (hasPatternFilter) {
        const patternDisplay = data.charmPatternMin === data.charmPatternMax
          ? `#${data.charmPatternMin}`
          : `#${data.charmPatternMin}-${data.charmPatternMax}`;
        charmValue = `${data.selectedCharm} (${patternDisplay})`;
      }

      filters.push({
        id: "charm",
        type: "charm",
        label: "Charm",
        value: charmValue
      });
    } else if (data.charmPatternMin !== DEFAULT_FILTER_DATA.charmPatternMin ||
      data.charmPatternMax !== DEFAULT_FILTER_DATA.charmPatternMax) {
      // Only pattern without charm selected
      const patternValue = data.charmPatternMin === data.charmPatternMax
        ? `#${data.charmPatternMin}`
        : `${data.charmPatternMin} - ${data.charmPatternMax}`;
      filters.push({
        id: "charmPattern",
        type: "charmPattern",
        label: "Charm Pattern",
        value: patternValue
      });
    }

    return filters;
  }, []);

  useEffect(() => {
    console.log('🔄 Regenerating active filters from filterData:', filterData);
    const newFilters = generateActiveFilters(filterData);
    console.log('  Generated active filters:', newFilters);
    setActiveFilters(newFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterData, generateActiveFilters]);

  // Keep Fire & Ice selection mirrored in storage as a hard fallback for target creation.
  useEffect(() => {
    try {
      localStorage.setItem(
        'target-manager-fire-ice-filter-state',
        JSON.stringify({
          enabled: filterData.fireAndIceEnabled,
          tier: filterData.fireAndIceTier,
          updatedAt: Date.now(),
        })
      );
    } catch {
      // ignore storage failures
    }
  }, [filterData.fireAndIceEnabled, filterData.fireAndIceTier]);

  // Keep Blue Gem selection mirrored in storage as a hard fallback for target creation.
  useEffect(() => {
    try {
      localStorage.setItem(
        'target-manager-blue-gem-filter-state',
        JSON.stringify({
          enabled: filterData.blueGemEnabled,
          tier: filterData.blueGemTier ?? null,
          updatedAt: Date.now(),
        })
      );
    } catch {
      // ignore storage failures
    }
  }, [filterData.blueGemEnabled, filterData.blueGemTier]);

  const updateFilterData = (key: keyof FilterData, value: any) => {
    console.log(`📝 updateFilterData called: key="${key}", value=`, value);
    setFilterData(prev => {
      const updated = { ...prev, [key]: value };
      console.log('  Previous filterData:', prev);
      console.log('  New filterData:', updated);
      return updated;
    });
  };

  const removeFilter = (filterId: string) => {
    switch (filterId) {
      case "price":
        setFilterData(prev => ({
          ...prev,
          priceFrom: DEFAULT_FILTER_DATA.priceFrom,
          priceTo: DEFAULT_FILTER_DATA.priceTo,
          isAnyPrice: false,
          isFixedPrice: false,
          fixedPriceConfirmed: false,
          fixedPricePending: "",
          rangePriceConfirmed: false,
          rangePriceFromPending: "",
          rangePriceToPending: ""
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
        setFilterData(prev => ({ ...prev, blueGemEnabled: false, blueGemTier: null }));
        break;
      case "fireAndIce":
        setFilterData(prev => ({ ...prev, fireAndIceEnabled: false, fireAndIceTier: null }));
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
      case "spSticker":
        // Reset to default values instead of disabling
        setFilterData(prev => ({
          ...prev,
          spStickerPercentMin: DEFAULT_FILTER_DATA.spStickerPercentMin,
          spStickerPercentMax: DEFAULT_FILTER_DATA.spStickerPercentMax
        }));
        break;
      case "stickersPricePercent":
        setFilterData(prev => ({
          ...prev,
          stickersPricePercentEnabled: false,
          stickersPricePercentMin: DEFAULT_FILTER_DATA.stickersPricePercentMin,
          stickersPricePercentMax: DEFAULT_FILTER_DATA.stickersPricePercentMax
        }));
        break;
      case "charmProfit":
        setFilterData(prev => ({
          ...prev,
          charmProfitEnabled: false,
          charmProfitMin: DEFAULT_FILTER_DATA.charmProfitMin,
          charmProfitMax: DEFAULT_FILTER_DATA.charmProfitMax,
          charmProfitUseLowestPrice: DEFAULT_FILTER_DATA.charmProfitUseLowestPrice,
          charmProfitUseBidPrice: DEFAULT_FILTER_DATA.charmProfitUseBidPrice
        }));
        break;
      case "statTrak":
        setFilterData(prev => ({ ...prev, statTrak: false }));
        break;
      case "souvenir":
        setFilterData(prev => ({ ...prev, souvenir: false }));
        break;
      case "normal":
        setFilterData(prev => ({ ...prev, normal: false }));
        break;
      case "rarity":
        setFilterData(prev => ({ ...prev, rarity: "" }));
        break;
      case "paintSeeds":
        setFilterData(prev => ({
          ...prev,
          paintSeeds: []
        }));
        break;
      case "paintSeed":
        setFilterData(prev => ({
          ...prev,
          paintSeedMin: "",
          paintSeedMax: ""
        }));
        break;
      case "customFilter":
        setFilterData(prev => ({ ...prev, customFilterEnabled: false }));
        break;
      case "discountOverpay":
        setFilterData(prev => ({ ...prev, discountOverpayMin: 0, discountOverpayMax: 0 }));
        break;
      case "charm":
        setFilterData(prev => ({
          ...prev,
          selectedCharm: "",
          charmPatternMin: DEFAULT_FILTER_DATA.charmPatternMin,
          charmPatternMax: DEFAULT_FILTER_DATA.charmPatternMax
        }));
        break;
      case "charmPattern":
        setFilterData(prev => ({
          ...prev,
          charmPatternMin: DEFAULT_FILTER_DATA.charmPatternMin,
          charmPatternMax: DEFAULT_FILTER_DATA.charmPatternMax
        }));
        break;
      case "phase":
        setFilterData(prev => ({ ...prev, phase: "" }));
        break;
      case "selectedItem":
        setFilterData(prev => ({ ...prev, selectedItem: "" }));
        break;
      case "stickers-stack":
        // Clear all stickers
        setFilterData(prev => ({
          ...prev,
          stickers: DEFAULT_STICKERS
        }));
        break;
      default:
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
    setConfirmDialogOpen(true);
  };

  const handleConfirmTarget = (modifiedFilterData: FilterData) => {
    onAddTarget(modifiedFilterData);
    setFilterData({ ...DEFAULT_FILTER_DATA });
    setConfirmDialogOpen(false);
  };

  const handleUpdateTarget = () => {
    setUpdateConfirmDialogOpen(true);
  };

  const handleConfirmUpdate = (modifiedFilterData: FilterData) => {
    if (editingTargetId && onUpdateTarget) {
      onUpdateTarget(editingTargetId, modifiedFilterData);
      setFilterData({ ...DEFAULT_FILTER_DATA });
      setUpdateConfirmDialogOpen(false);
      setEditingTargetId(null);
      setHighlightedSection(null);
      setPendingFilterData(null);
      setIsEditMode(false);
      setActiveTab("filters");

      // Show success toast
      import('sonner').then(({ toast }) => {
        toast.success('Target updated', {
          description: 'Filters have been reset for a new target.',
          duration: 3000,
        });
      });
    }
  };

  const handleCancelEdit = () => {
    setFilterData({ ...DEFAULT_FILTER_DATA });
    setEditingTargetId(null);
    setHighlightedSection(null);
    setPendingFilterData(null);
    setIsEditMode(false);
    setActiveTab("filters");

    // Show cancel toast
    import('sonner').then(({ toast }) => {
      toast.info('Editing cancelled', {
        description: 'Filters have been reset for a new target.',
        duration: 3000,
      });
    });
  };

  return (
    <aside className="w-[414px] h-full flex flex-col bg-sidebar">

      {/* Filter Tabs */}
      <div className="flex-1 flex flex-col min-h-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-4 mt-4 bg-secondary/50 p-1 shrink-0 flex w-auto">
            {/* Filters Tab - Always visible */}
            <TabsTrigger value="filters" className="flex-1 text-[11px] px-1.5 data-[state=active]:bg-card data-[state=active]:text-foreground">
              <Filter className="h-3 w-3 mr-1 shrink-0" />
              Filters
            </TabsTrigger>

            {/* Stickers Tab - Hidden for knives/gloves */}
            {features.showStickersTab ? (
              <TabsTrigger value="stickers" className="flex-1 text-[11px] px-1.5 data-[state=active]:bg-card data-[state=active]:text-foreground">
                <Sparkles className="h-3 w-3 mr-1 shrink-0" />
                Stickers
              </TabsTrigger>
            ) : (
              <DisabledTabTrigger
                value="stickers"
                icon={Sparkles}
                label="Stickers"
                reason={features.disabledReasons.stickers || "Not available for this weapon type"}
              />
            )}

            {/* Patterns Tab - Hidden for gloves */}
            {features.showPatternsTab ? (
              <TabsTrigger value="patterns" className="flex-1 text-[11px] px-1.5 data-[state=active]:bg-card data-[state=active]:text-foreground">
                <Sparkles className="h-3 w-3 mr-1 shrink-0" />
                Patterns
              </TabsTrigger>
            ) : (
              <DisabledTabTrigger
                value="patterns"
                icon={Sparkles}
                label="Patterns"
                reason={features.disabledReasons.patterns || "Not available for this weapon type"}
              />
            )}

            {/* Custom Tab - Always visible */}
            <TabsTrigger value="custom" className="flex-1 text-[11px] px-1.5 data-[state=active]:bg-card data-[state=active]:text-foreground">
              <Sliders className="h-3 w-3 mr-1 shrink-0" />
              Custom
            </TabsTrigger>
          </TabsList>

          {/* Filter content with optional overlay when in edit mode awaiting selection */}
          <div className="relative flex-1 overflow-hidden">
            {/* Dimming overlay when in edit mode but no target selected */}
            {isEditMode && !editingTargetId && (
              <div className="absolute inset-0 bg-black/60 z-10 flex items-center justify-center">
                <p className="text-muted-foreground text-sm text-center px-4">
                  Click on a target row to edit its filters
                </p>
              </div>
            )}

            <TabsContent value="filters" className="h-full mt-0 overflow-hidden">
              <FilterSidebar
                filterData={filterData}
                onFilterChange={updateFilterData}
                showCharmsSection={features.showCharmsSection}
                charmsDisabledReason={features.disabledReasons.charms}
                flashSection={flashSection}
              />
            </TabsContent>

            {features.showPatternsTab && (
              <TabsContent value="patterns" className="h-full mt-0 overflow-hidden">
                <PatternsTab
                  filterData={filterData}
                  onFilterChange={updateFilterData}
                  showBlueGemFilter={features.showBlueGemFilter}
                  showFadeFilter={features.showFadeFilter}
                  blueGemDisabledReason={features.disabledReasons.blueGem}
                  fadeDisabledReason={features.disabledReasons.fade}
                  flashSection={flashSection}
                />
              </TabsContent>
            )}

            {features.showStickersTab && (
              <TabsContent value="stickers" className="h-full mt-0 overflow-hidden">
                <StickersCharmsTab
                  stickers={filterData.stickers}
                  onStickersChange={handleStickersChange}
                  maxSlots={features.maxStickerSlots}
                  stickerPercent={{
                    enabled: filterData.spStickerEnabled,
                    min: Number(filterData.spStickerPercentMin),
                    max: Number(filterData.spStickerPercentMax)
                  }}
                  onStickerPercentChange={(percent) => {
                    setFilterData(prev => ({
                      ...prev,
                      spStickerEnabled: percent.enabled,
                      spStickerPercentMin: percent.min,
                      spStickerPercentMax: percent.max
                    }));
                  }}
                  flashSection={flashSection}
                />
              </TabsContent>
            )}

            <TabsContent value="custom" className="h-full mt-0 overflow-hidden">
              <CustomFilterTab filterData={filterData} onFilterChange={updateFilterData} flashSection={flashSection} />
            </TabsContent>
          </div>
        </Tabs>

        {/* Active Filters Panel - Hidden when in edit mode awaiting selection */}
        {!(isEditMode && !editingTargetId) && (
          <div className="px-4 py-3 border-t border-border shrink-0">
            <ActiveFiltersPanel
              filters={activeFilters}
              onRemoveFilter={removeFilter}
              onClearAll={clearAllFilters}
              isEditMode={isEditMode && !!editingTargetId}
              onCancelEdit={handleCancelEdit}
            />
          </div>
        )}

        {/* Action Button - Add or Update based on edit mode */}
        <div className="p-4 border-t border-border shrink-0">
          {isEditMode ? (
            editingTargetId ? (
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={handleCancelEdit}
                  className="flex-1"
                >
                  <X className="h-4 w-4 mr-2" />Cancel
                </Button>
                <Button
                  onClick={handleUpdateTarget}
                  className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold shadow-lg shadow-accent/25 hover:shadow-accent/40 transition-all duration-200"
                >
                  <Save className="h-4 w-4 mr-2" />Update Target
                </Button>
              </div>
            ) : (
              <Button
                variant="destructive"
                onClick={handleCancelEdit}
                className="w-full h-12 text-base font-semibold"
              >
                <X className="h-5 w-5 mr-2" />Cancel Edit Mode
              </Button>
            )
          ) : (
            <Button
              onClick={handleAddToTarget}
              disabled={activeFilters.length === 0}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              <Plus className="h-4 w-4 mr-2" />Add to Target
            </Button>
          )}
        </div>
      </div>

      {/* Add Confirmation Dialog */}
      <TargetConfirmDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        filters={activeFilters}
        filterData={filterData}
        onConfirm={handleConfirmTarget}
        onFilterRemove={removeFilter}
      />

      {/* Update Confirmation Dialog */}
      <TargetConfirmDialog
        open={updateConfirmDialogOpen}
        onOpenChange={setUpdateConfirmDialogOpen}
        filters={activeFilters}
        filterData={filterData}
        onConfirm={handleConfirmUpdate}
        onFilterRemove={removeFilter}
        isUpdate
      />
    </aside>
  );
};
