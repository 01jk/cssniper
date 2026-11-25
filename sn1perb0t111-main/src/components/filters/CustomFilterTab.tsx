import { useState, useEffect, useRef } from "react";
import { useSoundSettings } from "@/contexts/SoundSettingsContext"; // Added import
import { Trophy, Diamond, Minus, Plus, ChevronDown, ChevronUp, Pencil, Check, Sliders, Info } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FilterSection as FilterSectionType } from "@/components/targets/EditModeContext";
import { StickerPercentageIcon } from "./StickerPercentageIcon";
import blueGemCrystalImg from "@/assets/blue-gem-crystal.png";
import blueGemTier1Img from "@/assets/blue-gem-tier-1.png";
import blueGemTier2Img from "@/assets/blue-gem-tier-2.png";
import blueGemTier3Img from "@/assets/blue-gem-tier-3.png";
import fireIceIconImg from "@/assets/fire-ice-icon.png";

interface FilterData {
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
  stickersPricePercentEnabled: boolean; // New
  stickersPricePercentMin: string;
  stickersPricePercentMax: string;
  customFilterEnabled: boolean;
  discountOverpayMin: number; // -100 to +100
  discountOverpayMax: number; // -100 to +100
  floatRankGold: boolean;
  floatRankSilver: boolean;
  floatRankBronze: boolean;
  fireAndIceEnabled: boolean;
  fireAndIceTier: '1st' | '2nd' | '3rd' | null;
  blueGemTier?: '1st' | '2nd' | '3rd' | null;
}

interface CustomFilterTabProps {
  filterData: FilterData;
  onFilterChange: (key: keyof FilterData, value: any) => void;
  flashSection?: FilterSectionType | null;
}

// Get color based on overpay percentage (teal/green at 0% to red/magenta at 100%+)
// Colors matched to CS2 reference: dark teal → green → lime → yellow → orange → red → magenta
const getOverpayColor = (percent: number): string => {
  if (percent <= 10) {
    // Dark teal (8.1% reference)
    const t = percent / 10;
    return `hsl(${165 - t * 5} ${55 + t * 10}% ${32 + t * 3}%)`;
  } else if (percent <= 25) {
    // Teal to Green (24.5% reference)
    const t = (percent - 10) / 15;
    return `hsl(${160 - t * 30} ${65 + t * 10}% ${35 + t * 5}%)`;
  } else if (percent <= 35) {
    // Green to Lime (29.9% reference)
    const t = (percent - 25) / 10;
    return `hsl(${130 - t * 45} ${75 + t * 5}% ${40 + t * 5}%)`;
  } else if (percent <= 50) {
    // Lime to Yellow-green (49.5% reference)
    const t = (percent - 35) / 15;
    return `hsl(${85 - t * 25} ${80 - t * 5}% ${45 + t * 3}%)`;
  } else if (percent <= 65) {
    // Yellow to Orange (59.5% reference)
    const t = (percent - 50) / 15;
    return `hsl(${60 - t * 30} ${75 + t * 10}% ${48 + t * 2}%)`;
  } else if (percent <= 85) {
    // Orange to Red-orange (81.7% reference)
    const t = (percent - 65) / 20;
    return `hsl(${30 - t * 20} ${85 - t * 5}% ${50 - t * 5}%)`;
  } else if (percent <= 100) {
    // Red-orange to Red (99.2% reference)
    const t = (percent - 85) / 15;
    return `hsl(${10 - t * 5} ${80 - t * 5}% ${45 - t * 5}%)`;
  } else {
    // Red to Magenta for values over 100% (116.9% reference)
    const t = Math.min((percent - 100) / 20, 1);
    return `hsl(${5 - t * 10} ${75 + t * 10}% ${45 + t * 5}%)`;
  }
};

// Get color for discount/overpay display
const getDiscountOverpayColor = (value: number): string => {
  if (value === 0) {
    return 'hsl(var(--muted-foreground))'; // Gray for default
  } else if (value < 0) {
    // Discount - green color, darker green for bigger discounts
    const intensity = Math.abs(value) / 100;
    return `hsl(${142 - intensity * 20} ${70 + intensity * 20}% ${45 - intensity * 10}%)`;
  } else {
    // Overpay - red color, darker red for bigger overpay
    const intensity = value / 100;
    return `hsl(${0 + intensity * 5} ${75 + intensity * 15}% ${50 - intensity * 10}%)`;
  }
};

export const CustomFilterTab = ({ filterData, onFilterChange, flashSection }: CustomFilterTabProps) => {
  const { playSound } = useSoundSettings(); // Added hook
  const [isStickerOverpayOpen, setIsStickerOverpayOpen] = useState(true);
  const [isDiscountOverpayOpen, setIsDiscountOverpayOpen] = useState(true);
  const [isEditingOverpay, setIsEditingOverpay] = useState(false);
  const [isEditingDiscount, setIsEditingDiscount] = useState(false);
  const [editOverpayValue, setEditOverpayValue] = useState("100");
  const [editDiscountValue, setEditDiscountValue] = useState("100");
  const [sliderTouched, setSliderTouched] = useState(false);
  const [expandedRank, setExpandedRank] = useState<'gold' | 'silver' | 'bronze' | null>(null);

  const fireAndIceEnabled = filterData.fireAndIceEnabled;
  const fireAndIceTier = filterData.fireAndIceTier;
  const setFireAndIceEnabled = (v: boolean) => {
    onFilterChange('fireAndIceEnabled', v);
    if (!v) onFilterChange('fireAndIceTier', null);
  };
  const setFireAndIceTier = (v: '1st' | '2nd' | '3rd' | null) => onFilterChange('fireAndIceTier', v);

  // Emergency sync: keep the current F&I state outside React too, so target saving/table
  // cannot lose the marker even if confirm/filter state gets stale.
  useEffect(() => {
    try {
      localStorage.setItem(
        'target-manager-fire-ice-filter-state',
        JSON.stringify({ enabled: fireAndIceEnabled, tier: fireAndIceTier, updatedAt: Date.now() })
      );
    } catch {
      // ignore storage failures
    }
  }, [fireAndIceEnabled, fireAndIceTier]);

  // Subtle info icon overlay with tooltip — always visible in a muted style.
  const InfoHint = ({ text }: { text: string }) => {
    return (
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
              onPointerDown={(e) => e.stopPropagation()}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 inline-flex items-center justify-center h-3.5 w-3.5 rounded-full cursor-help opacity-40 hover:opacity-100 text-muted-foreground transition-all duration-200"
              aria-label="More info"
            >
              <Info className="h-3 w-3" strokeWidth={2} />
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-xs">
            {text}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  // Sync expandedRank when filterData changes externally
  useEffect(() => {
    if (!filterData.floatRankGold && !filterData.floatRankSilver && !filterData.floatRankBronze) {
      setExpandedRank(null);
    } else if (filterData.floatRankGold && expandedRank !== 'gold') {
      setExpandedRank('gold');
    } else if (filterData.floatRankSilver && expandedRank !== 'silver') {
      setExpandedRank('silver');
    } else if (filterData.floatRankBronze && expandedRank !== 'bronze') {
      setExpandedRank('bronze');
    }
  }, [filterData.floatRankGold, filterData.floatRankSilver, filterData.floatRankBronze]);

  const handleRankClick = (rank: 'gold' | 'silver' | 'bronze', filterKey: keyof FilterData) => {
    if (expandedRank === rank) {
      setExpandedRank(null);
      onFilterChange(filterKey, false);
    } else if (expandedRank === null && !filterData[filterKey]) {
      setExpandedRank(rank);
      onFilterChange(filterKey, true);
      if (rank !== 'gold') onFilterChange("floatRankGold", false);
      if (rank !== 'silver') onFilterChange("floatRankSilver", false);
      if (rank !== 'bronze') onFilterChange("floatRankBronze", false);
    } else if (expandedRank === null && filterData[filterKey]) {
      setExpandedRank(rank);
      if (rank !== 'gold') onFilterChange("floatRankGold", false);
      if (rank !== 'silver') onFilterChange("floatRankSilver", false);
      if (rank !== 'bronze') onFilterChange("floatRankBronze", false);
    } else {
      setExpandedRank(rank);
      onFilterChange(filterKey, true);
      if (rank !== 'gold') onFilterChange("floatRankGold", false);
      if (rank !== 'silver') onFilterChange("floatRankSilver", false);
      if (rank !== 'bronze') onFilterChange("floatRankBronze", false);
    }
  };

  // Helper to parse float or return default
  const parseFloatOrDefault = (val: string, def: number) => {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? def : parsed;
  };

  const handleStickerPercentMinBlur = () => {
    let val = parseFloat(filterData.stickersPricePercentMin);
    if (isNaN(val)) val = 0;
    if (val < 0) val = 0;
    if (val > 100) val = 100;

    // Auto-enable if changed
    onFilterChange("stickersPricePercentEnabled", true);
    onFilterChange("stickersPricePercentMin", val.toString());
  };

  const handleStickerPercentMaxBlur = () => {
    let val = parseFloat(filterData.stickersPricePercentMax);
    if (isNaN(val)) val = 100;
    if (val < 0) val = 0;
    if (val > 100) val = 100;

    // Auto-enable if changed
    onFilterChange("stickersPricePercentEnabled", true);
    onFilterChange("stickersPricePercentMax", val.toString());
  };

  const handleStickerPercentSliderChange = (values: number[]) => {
    onFilterChange("stickersPricePercentMin", values[0].toString());
    onFilterChange("stickersPricePercentMax", values[1].toString());
    // Also enable the filter if not enabled
    onFilterChange("stickersPricePercentEnabled", true);
    // playSound(); // Play sound (commented out to avoid excessive noise, or keep if desired)
  };

  // Convert slider position (0-200) to discount/overpay value
  // Left (0) = +100 overpay, Center (100) = 0, Right (200) = -100 discount
  const sliderToValue = (sliderPos: number): number => {
    return Number((100 - sliderPos).toFixed(1));
  };

  // Convert discount/overpay value (-100 to +100) to slider position (0-200)
  const valueToSlider = (value: number): number => {
    return Math.max(0, Math.min(200, 100 - value));
  };

  const handleDiscountOverpaySliderChange = (values: number[]) => {
    // Mark slider as touched when user interacts
    if (!sliderTouched) {
      setSliderTouched(true);
    }
    // values[0] = min slider position (left thumb), values[1] = max slider position (right thumb)
    const minValue = sliderToValue(values[1]); // Right thumb = min value (discount side)
    const maxValue = sliderToValue(values[0]); // Left thumb = max value (overpay side)
    onFilterChange("discountOverpayMin", minValue);
    onFilterChange("discountOverpayMax", maxValue);
    playSound(); // Play sound
  };

  const discountOverpayMin = filterData.discountOverpayMin ?? 0;
  const discountOverpayMax = filterData.discountOverpayMax ?? 0;
  const sliderPositionMin = valueToSlider(discountOverpayMax); // Left thumb (overpay)
  const sliderPositionMax = valueToSlider(discountOverpayMin); // Right thumb (discount)

  // Check if slider values are different from default (both values are 0)
  // Only show dual display when values are actually non-zero
  const isSliderModified = discountOverpayMin !== 0 || discountOverpayMax !== 0;

  // Refs for sections
  const customSectionRef = useRef<HTMLDivElement>(null);
  const discountSectionRef = useRef<HTMLDivElement>(null);
  const stickerOverpaySectionRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when flashing
  useEffect(() => {
    if (flashSection === 'custom' && customSectionRef.current) {
      customSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (flashSection === 'discountOverpay' && discountSectionRef.current) {
      setIsDiscountOverpayOpen(true);
      setTimeout(() => {
        discountSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    } else if ((flashSection === 'stickerOverpay' || flashSection === 'stickersPricePercent') && stickerOverpaySectionRef.current) {
      setIsStickerOverpayOpen(true);
      setTimeout(() => {
        stickerOverpaySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [flashSection]);

  return (
    <ScrollArea className="h-full">
      <div className="bg-sidebar p-4 space-y-3">
        {/* 0.0% Filter - Big button like Float Rank */}
        <div
          ref={customSectionRef}
          className={`rounded-lg ${flashSection === 'custom' ? 'filter-section-flash-outline' : ''}`}
        >
          <button
            onClick={() => onFilterChange("customFilterEnabled", !filterData.customFilterEnabled)}
            className={`relative w-full h-10 rounded-lg border-2 transition-all duration-300 flex items-center justify-center gap-1.5 overflow-hidden ${filterData.customFilterEnabled
                ? 'border-zinc-400/70 shadow-[0_0_12px_rgba(161,161,170,0.3)] metallic-shimmer'
                : 'border-border/50 opacity-50 hover:opacity-75'
              }`}
            style={{
              background: filterData.customFilterEnabled
                ? 'linear-gradient(135deg, rgba(113,113,122,0.25) 0%, rgba(161,161,170,0.2) 25%, rgba(212,212,216,0.15) 50%, rgba(161,161,170,0.2) 75%, rgba(113,113,122,0.25) 100%)'
                : 'linear-gradient(135deg, rgba(113,113,122,0.1) 0%, rgba(161,161,170,0.08) 50%, rgba(113,113,122,0.1) 100%)'
            }}
          >
            <InfoHint text="Discount / Overpay percentage from the CSFloat API. 0.0% means the item is listed at its base price; negative values are discounts, positive values are overpay." />
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center relative z-10"
              style={{
                background: filterData.customFilterEnabled
                  ? 'linear-gradient(135deg, #71717a, #a1a1aa, #d4d4d8, #a1a1aa, #71717a)'
                  : 'rgba(113,113,122,0.5)'
              }}
            >
              <Minus className="h-3 w-3 text-background" />
            </div>
            <span
              className="text-sm font-medium relative z-10"
              style={{
                background: filterData.customFilterEnabled
                  ? 'linear-gradient(90deg, #71717a, #a1a1aa, #d4d4d8, #a1a1aa, #71717a)'
                  : 'none',
                WebkitBackgroundClip: filterData.customFilterEnabled ? 'text' : 'unset',
                WebkitTextFillColor: filterData.customFilterEnabled ? 'transparent' : 'rgba(161,161,170,0.6)',
                backgroundClip: filterData.customFilterEnabled ? 'text' : 'unset'
              }}
            >
              0.0%
            </span>
          </button>
        </div>

        {/* Blue Gem Filter - CS2 holographic sticker style */}
        {(() => {
          const blueGemEnabled = filterData.blueGemEnabled;
          const blueGemTier = filterData.blueGemTier ?? null;
          const setBlueGemEnabled = (v: boolean) => {
            onFilterChange('blueGemEnabled', v);
            if (!v) onFilterChange('blueGemTier', null);
          };
          const setBlueGemTier = (t: '1st' | '2nd' | '3rd' | null) =>
            onFilterChange('blueGemTier', t);

          return (
            <>
              <button
                onClick={() => setBlueGemEnabled(!blueGemEnabled)}
                className={`relative w-full h-10 rounded-lg border-2 transition-all duration-300 flex items-center justify-center gap-1.5 overflow-hidden bluegem-sticker-active bluegem-crystal-surface ${
                  blueGemEnabled
                    ? 'border-cyan-200/80 shadow-[0_0_14px_rgba(186,230,253,0.55),0_0_26px_rgba(125,211,252,0.35),inset_0_1px_0_rgba(240,249,255,0.55)]'
                    : 'border-cyan-300/40 opacity-60 hover:opacity-80 hover:shadow-[0_0_8px_rgba(125,211,252,0.20)] brightness-75'
                } ${flashSection === 'custom' ? 'filter-section-flash-outline' : ''}`}
                style={{
                  background: 'radial-gradient(at 30% 0%, rgba(186, 230, 253, 0.55) 0%, transparent 55%), radial-gradient(at 75% 100%, rgba(29, 78, 216, 0.65) 0%, transparent 60%), linear-gradient(135deg, rgb(29, 78, 216) 0%, rgb(37, 99, 235) 35%, rgb(2, 132, 199) 65%, rgb(30, 58, 138) 100%)',
                }}
              >
                <InfoHint text="Blue Gem — rare Case Hardened pattern with a dominant blue color on the playside. Pick a tier (1st / 2nd / 3rd) to narrow down to the most coveted patterns." />
                
                {/* Crystalline faceted overlay — diamond-like refraction */}
                <span aria-hidden="true" className="absolute inset-0 pointer-events-none bluegem-crystal-facets" style={{ opacity: 1 }}></span>
                <span aria-hidden="true" className="absolute inset-0 pointer-events-none bluegem-foil-glitter" style={{ opacity: 1 }}></span>

                {/* CS2-style ice crystal gem */}
                <img
                  src={blueGemCrystalImg}
                  alt=""
                  className="h-5 w-5 relative z-10 shrink-0 object-contain"
                  style={{
                    filter: blueGemEnabled
                      ? 'drop-shadow(0 0 6px rgba(240,249,255,0.95)) drop-shadow(0 0 2px rgba(186,230,253,0.8))'
                      : 'drop-shadow(0 0 2px rgba(125,211,252,0.4)) opacity(0.75)',
                  }}
                />
                <span
                  className="text-sm font-semibold relative z-10"
                  style={{
                    background: 'linear-gradient(90deg, #ffffff, #7dd3fc, #38bdf8, #0ea5e9)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    filter: blueGemEnabled
                      ? 'drop-shadow(0 0 4px rgba(14,165,233,0.6)) drop-shadow(0 1px 1px rgba(0,0,0,0.7))'
                      : 'drop-shadow(0 1px 1px rgba(0,0,0,0.6))',
                  }}
                >
                  Blue Gem
                </span>
              </button>

              {/* Blue Gem Tier selector — appears below button when enabled */}
              {blueGemEnabled && (
                <div className="grid grid-cols-3 gap-1.5 animate-fade-in">
                  {(['1st', '2nd', '3rd'] as const).map((tier) => {
                    const active = blueGemTier === tier;
                    const tierNum = tier === '1st' ? '1' : tier === '2nd' ? '2' : '3';
                    return (
                      <button
                        key={tier}
                        onClick={() => setBlueGemTier(active ? null : tier)}
                        className={`relative h-8 rounded-md border-2 text-xs font-bold transition-all duration-200 overflow-hidden flex items-center justify-center gap-1.5 bluegem-sticker-active bluegem-crystal-surface ${
                          active
                            ? 'border-cyan-200/85 shadow-[0_0_0_1px_rgba(240,249,255,0.85),0_0_10px_rgba(186,230,253,0.55),0_0_18px_rgba(125,211,252,0.35)] scale-[1.03]'
                            : 'border-cyan-300/40 opacity-60 hover:opacity-80 hover:shadow-[0_0_8px_rgba(125,211,252,0.20)] brightness-75'
                        }`}
                        style={{
                          background: 'radial-gradient(at 30% 0%, rgba(186, 230, 253, 0.45) 0%, transparent 55%), radial-gradient(at 75% 100%, rgba(29, 78, 216, 0.55) 0%, transparent 60%), linear-gradient(135deg, rgb(29, 78, 216) 0%, rgb(37, 99, 235) 35%, rgb(2, 132, 199) 65%, rgb(30, 58, 138) 100%)',
                        }}
                      >
                        <span aria-hidden="true" className="absolute inset-0 pointer-events-none bluegem-crystal-facets" style={{ opacity: 1 }}></span>
                        <span aria-hidden="true" className="absolute inset-0 pointer-events-none bluegem-foil-glitter"></span>
                        <span className="relative z-10 inline-flex items-center justify-center w-5 h-5 shrink-0">
                          <img
                            src={tier === '1st' ? blueGemTier1Img : tier === '2nd' ? blueGemTier2Img : blueGemTier3Img}
                            alt={`Tier ${tierNum}`}
                            className="w-5 h-5 object-contain"
                            style={{
                              filter: active
                                ? 'drop-shadow(0 0 4px rgba(186,230,253,0.95)) drop-shadow(0 0 1px rgba(125,211,252,0.8))'
                                : 'drop-shadow(0 0 2px rgba(125,211,252,0.4)) opacity(0.75)',
                            }}
                          />
                        </span>
                        <span
                          className="relative z-10 text-xs font-semibold"
                          style={{
                            background: 'linear-gradient(90deg, #ffffff, #7dd3fc, #38bdf8, #0ea5e9)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                            filter: active
                              ? 'drop-shadow(0 0 4px rgba(14,165,233,0.6)) drop-shadow(0 1px 1px rgba(0,0,0,0.7))'
                              : 'drop-shadow(0 1px 1px rgba(0,0,0,0.6))',
                          }}
                        >
                          {tier}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          );
        })()}

        {/* Fire and Ice Filter — Doppler-style wavy depth, blue/red gradient border */}
        <button
          onClick={() => setFireAndIceEnabled(!fireAndIceEnabled)}
          className={`relative w-full h-10 rounded-lg border-2 transition-all duration-300 flex items-center justify-center gap-1.5 overflow-hidden ${
            fireAndIceEnabled
              ? 'border-transparent shadow-[0_0_14px_rgba(244,63,94,0.35),0_0_18px_rgba(37,99,235,0.25)] fire-ice-shimmer'
              : 'border-border/50 opacity-50 hover:opacity-75'
          }`}
          style={{
            background: fireAndIceEnabled
              ? 'linear-gradient(135deg, rgba(13,31,74,0.72) 0%, rgba(34,20,82,0.6) 30%, rgba(88,21,21,0.62) 60%, rgba(139,25,25,0.58) 85%, rgba(20,55,133,0.5) 100%) padding-box, linear-gradient(135deg, #2563eb, #7c3aed, #dc2626, #991b1b) border-box'
              : 'linear-gradient(135deg, rgba(220,38,38,0.07) 0%, rgba(59,130,246,0.07) 100%)',
            backgroundClip: fireAndIceEnabled ? 'padding-box, border-box' : undefined,
            backgroundOrigin: fireAndIceEnabled ? 'padding-box, border-box' : undefined,
          }}
        >
          <InfoHint text="Fire & Ice — top-tier Marble Fade pattern with intense red and blue zones on the playside. Pick a tier (1st / 2nd / 3rd) for the cleanest patterns." />
          {fireAndIceEnabled && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none opacity-90 mix-blend-screen"
              preserveAspectRatio="none"
              viewBox="0 0 200 40"
            >
              <defs>
                <radialGradient id="fiBlobBlue1" cx="0.5" cy="0.5" r="0.5">
                  <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.9" />
                  <stop offset="60%" stopColor="#1e40af" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="fiBlobRed1" cx="0.5" cy="0.5" r="0.5">
                  <stop offset="0%" stopColor="#fb7185" stopOpacity="0.9" />
                  <stop offset="55%" stopColor="#b91c1c" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#7f1d1d" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="fiBlobPurple" cx="0.5" cy="0.5" r="0.5">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#6d28d9" stopOpacity="0" />
                </radialGradient>
                <filter id="fiChaos" x="-20%" y="-20%" width="140%" height="140%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.045 0.18" numOctaves="3" seed="7" />
                  <feDisplacementMap in="SourceGraphic" scale="14" />
                  <feGaussianBlur stdDeviation="0.8" />
                </filter>
              </defs>
              <g filter="url(#fiChaos)">
                <ellipse cx="30" cy="22" rx="34" ry="18" fill="url(#fiBlobBlue1)" />
                <ellipse cx="78" cy="14" rx="28" ry="16" fill="url(#fiBlobPurple)" />
                <ellipse cx="120" cy="26" rx="32" ry="18" fill="url(#fiBlobRed1)" />
                <ellipse cx="168" cy="16" rx="30" ry="18" fill="url(#fiBlobBlue1)" />
                <ellipse cx="55" cy="30" rx="20" ry="12" fill="url(#fiBlobRed1)" />
                <ellipse cx="150" cy="8" rx="18" ry="10" fill="url(#fiBlobPurple)" />
              </g>
            </svg>
          )}
          <img
            src={fireIceIconImg}
            alt=""
            className="h-[26px] w-[26px] relative z-10 shrink-0 object-contain translate-y-[4.6px]"
            style={{
              filter: fireAndIceEnabled
                ? 'drop-shadow(0 0 6px rgba(244,63,94,0.55)) drop-shadow(0 0 4px rgba(59,130,246,0.45))'
                : 'grayscale(0.4) opacity(0.55)',
            }}
          />
          <span
            className="text-sm font-medium relative z-10"
            style={{
              background: fireAndIceEnabled
                ? 'linear-gradient(90deg, hsl(220 90% 70%), hsl(250 80% 65%), hsl(0 85% 60%), hsl(15 90% 55%))'
                : 'none',
              WebkitBackgroundClip: fireAndIceEnabled ? 'text' : 'unset',
              WebkitTextFillColor: fireAndIceEnabled ? 'transparent' : 'rgba(244,114,182,0.55)',
              backgroundClip: fireAndIceEnabled ? 'text' : 'unset'
            }}
          >
            Fire &amp; Ice
          </span>
        </button>

        {/* Fire & Ice Tier selector — appears below button when enabled */}
        {fireAndIceEnabled && (
          <div className="grid grid-cols-3 gap-1.5 animate-fade-in">
            {(['1st', '2nd', '3rd'] as const).map((tier) => {
              const active = fireAndIceTier === tier;
              return (
                <button
                  key={tier}
                  onClick={() => setFireAndIceTier(active ? null : tier)}
                  className={`relative h-8 rounded-md border-2 text-xs font-semibold transition-all duration-200 overflow-hidden fire-ice-shimmer flex items-center justify-center ${
                    active
                      ? 'border-transparent shadow-[0_0_0_1px_rgba(37,99,235,0.9),0_0_0_1px_rgba(220,38,38,0.9),0_0_14px_rgba(59,130,246,0.55),0_0_18px_rgba(244,63,94,0.5),0_0_28px_rgba(37,99,235,0.25)] scale-[1.04]'
                      : 'shadow-[0_0_6px_rgba(59,130,246,0.18),0_0_8px_rgba(244,63,94,0.15)] opacity-85 hover:opacity-100 hover:shadow-[0_0_10px_rgba(59,130,246,0.25),0_0_12px_rgba(244,63,94,0.2)]'
                  }`}
                  style={{
                    background: active
                      ? 'linear-gradient(135deg, rgba(15,40,95,0.92) 0%, rgba(80,20,20,0.92) 100%) padding-box, linear-gradient(135deg, #3b82f6, #a78bfa, #f472b6, #dc2626) border-box'
                      : 'linear-gradient(135deg, rgba(13,31,74,0.6) 0%, rgba(50,18,55,0.5) 50%, rgba(80,21,21,0.55) 100%) padding-box, linear-gradient(135deg, #2563eb, #a78bfa, #dc2626) border-box',
                    backgroundClip: 'padding-box, border-box',
                    backgroundOrigin: 'padding-box, border-box',
                  }}
                >
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none opacity-80 mix-blend-screen"
                    preserveAspectRatio="none"
                    viewBox="0 0 200 40"
                  >
                    <defs>
                      <radialGradient id={`fiTierBlobBlue-${tier}`} cx="0.5" cy="0.5" r="0.5">
                        <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.85" />
                        <stop offset="60%" stopColor="#1e40af" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0" />
                      </radialGradient>
                      <radialGradient id={`fiTierBlobRed-${tier}`} cx="0.5" cy="0.5" r="0.5">
                        <stop offset="0%" stopColor="#fb7185" stopOpacity="0.85" />
                        <stop offset="55%" stopColor="#b91c1c" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#7f1d1d" stopOpacity="0" />
                      </radialGradient>
                      <radialGradient id={`fiTierBlobPurple-${tier}`} cx="0.5" cy="0.5" r="0.5">
                        <stop offset="0%" stopColor="#a855f7" stopOpacity="0.55" />
                        <stop offset="100%" stopColor="#6d28d9" stopOpacity="0" />
                      </radialGradient>
                      <filter id={`fiTierChaos-${tier}`} x="-20%" y="-20%" width="140%" height="140%">
                        <feTurbulence type="fractalNoise" baseFrequency="0.05 0.2" numOctaves="3" seed={tier === '1st' ? 7 : tier === '2nd' ? 11 : 15} />
                        <feDisplacementMap in="SourceGraphic" scale="12" />
                        <feGaussianBlur stdDeviation="0.7" />
                      </filter>
                    </defs>
                    <g filter={`url(#fiTierChaos-${tier})`}>
                      <ellipse cx="35" cy="22" rx="36" ry="18" fill={`url(#fiTierBlobBlue-${tier})`} />
                      <ellipse cx="85" cy="14" rx="30" ry="16" fill={`url(#fiTierBlobPurple-${tier})`} />
                      <ellipse cx="125" cy="26" rx="34" ry="18" fill={`url(#fiTierBlobRed-${tier})`} />
                      <ellipse cx="170" cy="16" rx="28" ry="16" fill={`url(#fiTierBlobBlue-${tier})`} />
                    </g>
                  </svg>
                  {active && (
                    <span
                      aria-hidden
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background:
                          'radial-gradient(ellipse at 30% 50%, rgba(59,130,246,0.4) 0%, transparent 60%), radial-gradient(ellipse at 75% 50%, rgba(244,63,94,0.4) 0%, transparent 60%)',
                      }}
                    />
                  )}
                  <span className="relative z-10 inline-flex items-center justify-center gap-1.5">
                    <span className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center translate-y-[2.4px]">
                      <img
                        src={fireIceIconImg}
                        alt=""
                        className="h-5 w-5 object-contain"
                        style={{
                          filter: active
                            ? 'drop-shadow(0 0 4px rgba(244,63,94,0.6)) drop-shadow(0 0 3px rgba(59,130,246,0.5))'
                            : 'drop-shadow(0 0 2px rgba(244,63,94,0.35))',
                        }}
                      />
                      <span
                        className="absolute inset-0 flex items-center justify-center text-[9px] font-black leading-none"
                        style={{
                          background: 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 50%, #f43f5e 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                          textShadow: active
                            ? '0 0 4px rgba(59,130,246,0.7), 0 0 6px rgba(244,63,94,0.6)'
                            : '0 0 3px rgba(59,130,246,0.5), 0 0 4px rgba(244,63,94,0.4)',
                          filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.8))',
                          transform: 'translateY(0.5px)',
                        }}
                      >
                        {tier === '1st' ? '1' : tier === '2nd' ? '2' : '3'}
                      </span>
                    </span>
                    <span
                      style={{
                        background: 'linear-gradient(90deg, #bae6fd, #7dd3fc, #38bdf8, #0ea5e9)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                        textShadow: active
                          ? '0 0 6px rgba(56,189,248,0.5), 0 0 10px rgba(14,165,233,0.4)'
                          : '0 0 4px rgba(56,189,248,0.25)',
                        filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.6))',
                      }}
                    >
                      {tier}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Float Rank Buttons - Gold #1, Silver #2-3, Bronze #4-5 */}
        <div className="p-3 rounded-lg border border-border/50 bg-secondary/20">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className={`h-4 w-4 transition-colors duration-300 ${
              filterData.floatRankGold ? 'text-yellow-400' :
              filterData.floatRankSilver ? 'text-zinc-300' :
              filterData.floatRankBronze ? 'text-orange-600' :
              'text-zinc-400'
            }`} />
            <span className="text-sm font-medium text-foreground whitespace-nowrap">Float Rank</span>
            <span className="text-xs text-muted-foreground/70 truncate">{'—\u00A0 the rank by lowest or highest float'}</span>
          </div>
          <div className={`flex items-center overflow-hidden transition-all duration-500 ease-in-out ${expandedRank === null ? 'gap-2' : 'gap-0'}`}>
            {/* Gold - #1 */}
            <button
              onClick={() => handleRankClick('gold', 'floatRankGold')}
              className={`relative rounded-lg border-2 transition-all duration-500 ease-in-out flex items-center justify-center gap-1.5 overflow-hidden ${
                expandedRank === 'gold'
                  ? 'flex-[3] w-full opacity-100'
                  : expandedRank !== null
                    ? 'flex-[0] w-0 min-w-0 !px-0 !mx-0 !border-0 opacity-0'
                    : 'flex-1 opacity-100'
              } ${
                filterData.floatRankGold
                  ? 'border-yellow-500/70 shadow-[0_0_12px_rgba(234,179,8,0.3)]'
                  : 'border-border/50 opacity-50 hover:opacity-75'
              }`}
              style={{
                height: '52px',
                background: filterData.floatRankGold
                  ? 'linear-gradient(135deg, hsl(43 80% 25%) 0%, hsl(45 85% 35%) 25%, hsl(48 90% 45%) 50%, hsl(45 85% 35%) 75%, hsl(43 80% 25%) 100%)'
                  : 'linear-gradient(135deg, hsl(43 30% 15%) 0%, hsl(45 35% 20%) 50%, hsl(43 30% 15%) 100%)'
              }}
            >
              {filterData.floatRankGold && (
                <div className="absolute inset-0 pointer-events-none float-rank-shimmer-gold" />
              )}
              <span className="text-[1.25rem] font-black relative z-10" style={{
                background: 'linear-gradient(180deg, hsl(48 95% 75%), hsl(43 90% 55%), hsl(38 85% 40%))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: filterData.floatRankGold ? 'drop-shadow(0 1px 2px rgba(234,179,8,0.5))' : 'none'
              }}>ƒ</span>
              <span className="text-[10px] font-bold relative z-10" style={{
                color: filterData.floatRankGold ? 'hsl(48 90% 70%)' : 'hsl(48 30% 50%)'
              }}>#1</span>
            </button>

            {/* Silver - #2-3 */}
            <button
              onClick={() => handleRankClick('silver', 'floatRankSilver')}
              className={`relative rounded-lg border-2 transition-all duration-500 ease-in-out flex items-center justify-center gap-1.5 overflow-hidden ${
                expandedRank === 'silver'
                  ? 'flex-[3] w-full opacity-100'
                  : expandedRank !== null
                    ? 'flex-[0] w-0 min-w-0 !px-0 !mx-0 !border-0 opacity-0'
                    : 'flex-1 opacity-100'
              } ${
                filterData.floatRankSilver
                  ? 'border-zinc-400/70 shadow-[0_0_12px_rgba(161,161,170,0.3)]'
                  : 'border-border/50 opacity-50 hover:opacity-75'
              }`}
              style={{
                height: '52px',
                background: filterData.floatRankSilver
                  ? 'linear-gradient(135deg, hsl(220 10% 30%) 0%, hsl(220 12% 45%) 25%, hsl(220 15% 55%) 50%, hsl(220 12% 45%) 75%, hsl(220 10% 30%) 100%)'
                  : 'linear-gradient(135deg, hsl(220 5% 18%) 0%, hsl(220 8% 22%) 50%, hsl(220 5% 18%) 100%)'
              }}
            >
              {filterData.floatRankSilver && (
                <div className="absolute inset-0 pointer-events-none float-rank-shimmer-silver" />
              )}
              <span className="text-[1.25rem] font-black relative z-10" style={{
                background: 'linear-gradient(180deg, hsl(220 15% 80%), hsl(220 12% 60%), hsl(220 10% 45%))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: filterData.floatRankSilver ? 'drop-shadow(0 1px 2px rgba(161,161,170,0.5))' : 'none'
              }}>ƒ</span>
              <span className="text-[10px] font-bold relative z-10" style={{
                color: filterData.floatRankSilver ? 'hsl(220 15% 75%)' : 'hsl(220 8% 45%)'
              }}>#2-3</span>
            </button>

            {/* Bronze - #4-5 */}
            <button
              onClick={() => handleRankClick('bronze', 'floatRankBronze')}
              className={`relative rounded-lg border-2 transition-all duration-500 ease-in-out flex items-center justify-center gap-1.5 overflow-hidden ${
                expandedRank === 'bronze'
                  ? 'flex-[3] w-full opacity-100'
                  : expandedRank !== null
                    ? 'flex-[0] w-0 min-w-0 !px-0 !mx-0 !border-0 opacity-0'
                    : 'flex-1 opacity-100'
              } ${
                filterData.floatRankBronze
                  ? 'border-orange-700/70 shadow-[0_0_12px_rgba(180,83,9,0.3)]'
                  : 'border-border/50 opacity-50 hover:opacity-75'
              }`}
              style={{
                height: '52px',
                background: filterData.floatRankBronze
                  ? 'linear-gradient(135deg, hsl(25 70% 22%) 0%, hsl(28 75% 32%) 25%, hsl(30 80% 40%) 50%, hsl(28 75% 32%) 75%, hsl(25 70% 22%) 100%)'
                  : 'linear-gradient(135deg, hsl(25 30% 14%) 0%, hsl(28 35% 18%) 50%, hsl(25 30% 14%) 100%)'
              }}
            >
              {filterData.floatRankBronze && (
                <div className="absolute inset-0 pointer-events-none float-rank-shimmer-bronze" />
              )}
              <span className="text-[1.25rem] font-black relative z-10" style={{
                background: 'linear-gradient(180deg, hsl(30 80% 65%), hsl(25 75% 45%), hsl(20 70% 30%))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: filterData.floatRankBronze ? 'drop-shadow(0 1px 2px rgba(180,83,9,0.5))' : 'none'
              }}>ƒ</span>
              <span className="text-[10px] font-bold relative z-10" style={{
                color: filterData.floatRankBronze ? 'hsl(30 75% 60%)' : 'hsl(25 30% 40%)'
              }}>#4-5</span>
            </button>
          </div>
        </div>

        {/* Discount/Overpay Range Filter */}
        <Collapsible
          open={isDiscountOverpayOpen}
          onOpenChange={setIsDiscountOverpayOpen}
          className={`filter-section ${flashSection === 'discountOverpay' ? 'filter-section-flash' : ''}`}
        >
          <div ref={discountSectionRef}>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium text-foreground hover:text-primary transition-colors">
              <div className="flex items-center gap-2">
                {/* Dynamic icon based on range - red to green gradient without gray */}
                <div
                  className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold transition-colors"
                  style={{
                    background: (discountOverpayMin === 0 && discountOverpayMax === 0)
                      ? 'hsl(var(--muted))'
                      : 'linear-gradient(90deg, hsl(0 75% 50%) 0%, hsl(142 70% 45%) 100%)',
                    color: 'white'
                  }}
                >
                  <Sliders className="h-3 w-3" />
                </div>
                <span>Discount / Overpay</span>
              </div>
              {isDiscountOverpayOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-3">
              {/* Range display mini-screen */}
              <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium bg-muted/50 border border-border">
                {!isSliderModified ? (
                  /* Default state: single "0" in center */
                  <div
                    className="flex items-center gap-0.5 px-2 py-0.5 rounded"
                    style={{
                      background: 'transparent',
                      color: 'hsl(var(--muted-foreground))'
                    }}
                  >
                    <span className="font-bold">0.0%</span>
                  </div>
                ) : (
                  /* After interaction: show left (red/overpay) and right (green/discount) - no gray separator */
                  <>
                    {/* Left side - Max (Overpay) - RED */}
                    <div
                      className="flex items-center gap-0.5 px-2 py-0.5 rounded"
                      style={{
                        background: discountOverpayMax > 0 ? 'rgba(239, 68, 68, 0.2)' : discountOverpayMax < 0 ? 'rgba(34, 197, 94, 0.2)' : 'transparent',
                        color: getDiscountOverpayColor(discountOverpayMax)
                      }}
                    >
                      {discountOverpayMax >= 0 ? (
                        <Plus className="h-3.5 w-3.5" strokeWidth={3} />
                      ) : (
                        <Minus className="h-3.5 w-3.5" strokeWidth={3} />
                      )}
                      <span className="font-bold">{Math.abs(discountOverpayMax).toFixed(1)}%</span>
                    </div>

                    {/* Right side - Min (Discount) - GREEN */}
                    <div
                      className="flex items-center gap-0.5 px-2 py-0.5 rounded"
                      style={{
                        background: discountOverpayMin < 0 ? 'rgba(34, 197, 94, 0.2)' : discountOverpayMin > 0 ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                        color: getDiscountOverpayColor(discountOverpayMin)
                      }}
                    >
                      {discountOverpayMin <= 0 ? (
                        <Minus className="h-3.5 w-3.5" strokeWidth={3} />
                      ) : (
                        <Plus className="h-3.5 w-3.5" strokeWidth={3} />
                      )}
                      <span className="font-bold">{Math.abs(discountOverpayMin).toFixed(1)}%</span>
                    </div>
                  </>
                )}
              </div>

              <div className="relative">
                <div
                  className="absolute inset-0 h-2 top-1/2 -translate-y-1/2 rounded-full opacity-90"
                  style={{
                    background: 'linear-gradient(to right, hsl(0 75% 50%) 0%, hsl(0 75% 50%) 49%, hsl(var(--muted-foreground)) 49%, hsl(var(--muted-foreground)) 51%, hsl(142 70% 45%) 51%, hsl(142 70% 45%) 100%)'
                  }}
                />
                <Slider
                  value={[sliderPositionMin, sliderPositionMax]}
                  min={0}
                  max={200}
                  step={0.1}
                  onValueChange={handleDiscountOverpaySliderChange}
                  className="relative [&_[data-slot=track]]:bg-transparent"
                  thumbColors={[
                    getDiscountOverpayColor(discountOverpayMax),
                    getDiscountOverpayColor(discountOverpayMin)
                  ]}
                />
              </div>

              {/* Quick preset buttons */}
              <div className="flex justify-between gap-2 text-xs">
                {/* Overpay presets */}
                <div className="flex items-center gap-1">
                  {isEditingOverpay ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        step="0.1"
                        value={editOverpayValue}
                        onChange={(e) => setEditOverpayValue(e.target.value)}
                        className="w-14 h-6 text-xs px-1 bg-input border-red-500/30"
                        min={0}
                        max={100}
                        autoFocus
                      />
                      <button
                        onClick={() => {
                          const val = Math.min(100, Math.max(0, Number(editOverpayValue)));
                          onFilterChange("discountOverpayMax", Number(val.toFixed(1)));
                          setIsEditingOverpay(false);
                        }}
                        className="p-1 rounded transition-colors hover:opacity-80"
                        style={{ background: 'rgba(239, 68, 68, 0.3)' }}
                      >
                        <Check className="h-3 w-3" style={{ color: 'hsl(0 75% 55%)' }} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => onFilterChange("discountOverpayMax", 100)}
                        className="px-2 py-1 rounded transition-colors hover:opacity-80"
                        style={{
                          background: 'rgba(239, 68, 68, 0.2)',
                          color: 'hsl(0 75% 55%)',
                          border: '1px solid rgba(239, 68, 68, 0.3)'
                        }}
                      >
                        +100%
                      </button>
                      <button
                        onClick={() => {
                          setEditOverpayValue("100");
                          setIsEditingOverpay(true);
                        }}
                        className="p-1 rounded transition-colors hover:opacity-80"
                        style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.25)'
                        }}
                      >
                        <Pencil className="h-3 w-3" style={{ color: 'hsl(0 75% 55%)' }} />
                      </button>
                    </>
                  )}
                </div>

                <button
                  onClick={() => {
                    onFilterChange("discountOverpayMin", 0);
                    onFilterChange("discountOverpayMax", 0);
                  }}
                  className="px-2 py-1 rounded bg-muted text-muted-foreground border border-border transition-colors hover:opacity-80"
                >
                  Reset
                </button>

                {/* Discount presets */}
                <div className="flex items-center gap-1">
                  {isEditingDiscount ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        step="0.1"
                        value={editDiscountValue}
                        onChange={(e) => setEditDiscountValue(e.target.value)}
                        className="w-14 h-6 text-xs px-1 bg-input border-green-500/30"
                        min={0}
                        max={100}
                        autoFocus
                      />
                      <button
                        onClick={() => {
                          const val = Math.min(100, Math.max(0, Number(editDiscountValue)));
                          onFilterChange("discountOverpayMin", -Number(val.toFixed(1)));
                          setIsEditingDiscount(false);
                        }}
                        className="p-1 rounded transition-colors hover:opacity-80"
                        style={{ background: 'rgba(34, 197, 94, 0.3)' }}
                      >
                        <Check className="h-3 w-3" style={{ color: 'hsl(142 70% 45%)' }} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setEditDiscountValue("100");
                          setIsEditingDiscount(true);
                        }}
                        className="p-1 rounded transition-colors hover:opacity-80"
                        style={{
                          background: 'rgba(34, 197, 94, 0.15)',
                          border: '1px solid rgba(34, 197, 94, 0.25)'
                        }}
                      >
                        <Pencil className="h-3 w-3" style={{ color: 'hsl(142 70% 45%)' }} />
                      </button>
                      <button
                        onClick={() => onFilterChange("discountOverpayMin", -100)}
                        className="px-2 py-1 rounded transition-colors hover:opacity-80"
                        style={{
                          background: 'rgba(34, 197, 94, 0.2)',
                          color: 'hsl(142 70% 45%)',
                          border: '1px solid rgba(34, 197, 94, 0.3)'
                        }}
                      >
                        -100%
                      </button>
                    </>
                  )}
                </div>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Stickers Overpay % Filter - always expanded */}
        <div
          ref={stickerOverpaySectionRef}
          className={`filter-section ${(flashSection === 'stickerOverpay' || flashSection === 'stickersPricePercent') ? 'filter-section-flash' : ''}`}
        >
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <StickerPercentageIcon
              size="md"
              active={
                parseFloatOrDefault(filterData.stickersPricePercentMin, 0) !== 0 ||
                parseFloatOrDefault(filterData.stickersPricePercentMax, 100) !== 100
              }
            />
            <span>Stickers / Percentage</span>
          </div>
          <div className="pt-3 space-y-3">
            {/* Slider with green-to-red gradient */}
            <div className="relative">
              <div className="absolute inset-0 h-2 top-1/2 -translate-y-1/2 rounded-full sticker-overpay-gradient opacity-90" />
              <Slider
                value={[
                  parseFloatOrDefault(filterData.stickersPricePercentMin, 0),
                  parseFloatOrDefault(filterData.stickersPricePercentMax, 100)
                ]}
                min={0}
                max={100}
                step={0.1}
                onValueChange={handleStickerPercentSliderChange}
                className="relative [&_[data-slot=track]]:bg-transparent"
                thumbColors={[
                  getOverpayColor(parseFloatOrDefault(filterData.stickersPricePercentMin, 0)),
                  getOverpayColor(parseFloatOrDefault(filterData.stickersPricePercentMax, 100))
                ]}
              />
            </div>

            {/* Min/Max Inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Minimum %</label>
                <Input
                  type="number"
                  value={filterData.stickersPricePercentMin}
                  onChange={(e) => {
                    onFilterChange("stickersPricePercentMin", e.target.value);
                    onFilterChange("stickersPricePercentEnabled", true);
                  }}
                  onBlur={handleStickerPercentMinBlur}
                  className="bg-input border-border h-9"
                  min={0}
                  max={100}
                  step={0.1}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Maximum %</label>
                <Input
                  type="number"
                  value={filterData.stickersPricePercentMax}
                  onChange={(e) => {
                    onFilterChange("stickersPricePercentMax", e.target.value);
                    onFilterChange("stickersPricePercentEnabled", true);
                  }}
                  onBlur={handleStickerPercentMaxBlur}
                  className="bg-input border-border h-9"
                  min={0}
                  max={100}
                  step={0.1}
                />
              </div>
            </div>
          </div>
        </div>

      </div>
    </ScrollArea>
  );
};
