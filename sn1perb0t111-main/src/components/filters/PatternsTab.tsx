import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, AlertCircle, Plus, X, List, Eraser, Trash2, Search, ClipboardPaste, Trash, Upload } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FilterSection as FilterSectionType } from "@/components/targets/EditModeContext";
import { useSoundSettings } from "@/contexts/SoundSettingsContext";

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
  customFilterEnabled: boolean;
  statTrak: boolean;
  souvenir: boolean;
  highlight: boolean;
  normal: boolean;
  rarity: string;
  paintSeedMin: string;
  paintSeedMax: string;
  paintSeeds?: number[];
  activePatternFilter?: 'fade' | 'blueGem' | null; // Track which pattern filter is active
  selectedItem?: string;
  fadeFilterEnabled?: boolean;
  blueGemFilterEnabled?: boolean;
}

interface PatternsTabProps {
  filterData: FilterData;
  onFilterChange: (key: keyof FilterData, value: any) => void;
  showBlueGemFilter?: boolean;
  showFadeFilter?: boolean;
  blueGemDisabledReason?: string;
  fadeDisabledReason?: string;
  flashSection?: FilterSectionType | null;
}

interface FilterSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  icon?: React.ReactNode;
  sectionId?: FilterSectionType;
  isFlashing?: boolean;
}

const FilterSection = ({ title, children, defaultOpen = true, disabled = false, disabledReason, icon, sectionId, isFlashing }: FilterSectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const sectionRef = useRef<HTMLDivElement>(null);

  // Auto-open and scroll when flashing
  useEffect(() => {
    if (isFlashing && sectionRef.current) {
      setIsOpen(true);
      setTimeout(() => {
        sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [isFlashing]);

  if (disabled) {
    return (
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <div className="filter-section opacity-30 grayscale pointer-events-none cursor-not-allowed">
            <div className="flex items-center justify-between w-full text-sm font-medium text-foreground">
              <div className="flex items-center gap-2">
                {icon}
                <span>{title}</span>
              </div>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-popover/95 border-border text-foreground max-w-[200px] text-xs">
          {disabledReason || "Not available for this skin type"}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={`filter-section ${isFlashing ? 'filter-section-flash' : ''}`}>
      <div ref={sectionRef} data-filter-section={sectionId}>
        <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium text-foreground hover:text-primary transition-colors">
          <div className="flex items-center gap-2">
            {icon}
            <span>{title}</span>
          </div>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-3">
          {children}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

// Get fade gradient color based on position (80-100 range mapped to 0-100%)
// Gradient: muted yellow → orange → rose → magenta → purple
const getFadeThumbColor = (value: number): string => {
  const percent = value;

  if (percent <= 60) {
    // Muted / Greyish to Yellow
    const t = percent / 60;
    return `hsl(${45}, ${10 + t * 60}%, ${40 + t * 10}%)`;
  } else if (percent <= 80) {
    // Yellow range
    const t = (percent - 60) / 20;
    return `hsl(${45 - t * 5}, ${70 + t * 5}%, ${50 + t * 5}%)`;
  } else if (percent <= 90) {
    // Pink/Purple range starts
    const t = (percent - 80) / 10;
    return `hsl(${40 - t * 10}, ${75 + t * 5}%, 55%)`;
  } else {
    // Top tier
    const t = (percent - 90) / 10;
    return `hsl(${330 - t * 30}, ${65 - t * 5}%, ${55 - t * 5}%)`;
  }
};

// Get blue gem gradient color - bright cyan/blue like CS2 Case Hardened
const getBlueGemThumbColor = (value: number): string => {
  if (value <= 25) {
    const t = value / 25;
    return `hsl(${210 - t * 5}, 100%, ${45 + t * 10}%)`;
  } else if (value <= 50) {
    const t = (value - 25) / 25;
    return `hsl(${205 - t * 5}, 100%, ${55 + t * 10}%)`;
  } else if (value <= 75) {
    const t = (value - 50) / 25;
    return `hsl(${200 - t * 5}, 100%, ${65 + t * 10}%)`;
  } else {
    const t = (value - 75) / 25;
    return `hsl(${195 - t * 5}, 100%, ${75 + t * 10}%)`;
  }
};


export const PatternsTab = ({
  filterData,
  onFilterChange,
  showBlueGemFilter = true,
  showFadeFilter = true,
  blueGemDisabledReason,
  fadeDisabledReason,
  flashSection
}: PatternsTabProps) => {
  const { playSound } = useSoundSettings();
  const [newSeed, setNewSeed] = useState("");
  const [isListOpen, setIsListOpen] = useState(false);
  const [searchPattern, setSearchPattern] = useState("");
  const [isMassAddOpen, setIsMassAddOpen] = useState(false);
  const [massAddText, setMassAddText] = useState("");
  const [isClearAllOpen, setIsClearAllOpen] = useState(false);

  const paintSeeds = filterData.paintSeeds || [];
  const filteredSeeds = paintSeeds.filter(seed =>
    String(seed).includes(searchPattern)
  );

  const handleAddSeed = () => {
    const seedValue = parseInt(newSeed);
    if (isNaN(seedValue) || seedValue < 0 || seedValue > 1000) return;
    if (paintSeeds.includes(seedValue)) return;

    const updatedSeeds = [...paintSeeds, seedValue].sort((a, b) => a - b);
    onFilterChange("paintSeeds", updatedSeeds);

    // Clear legacy fields when we have multiple seeds
    if (updatedSeeds.length > 1) {
      onFilterChange("paintSeedMin", "");
      onFilterChange("paintSeedMax", "");
    }

    setNewSeed("");
  };

  const handleRemoveSeed = (seed: number) => {
    console.log('🗑️ Removing paint seed:', seed);
    console.log('  Current paintSeeds:', paintSeeds);
    const updatedSeeds = paintSeeds.filter(s => s !== seed);
    console.log('  Updated paintSeeds:', updatedSeeds);
    console.log('  Calling onFilterChange("paintSeeds", ...)');
    onFilterChange("paintSeeds", updatedSeeds);

    // Clear legacy paintSeedMin/Max fields when array becomes empty
    // This prevents the legacy code path from showing stale values
    if (updatedSeeds.length === 0) {
      console.log('  Array is now empty, clearing legacy paintSeedMin/Max fields');
      onFilterChange("paintSeedMin", "");
      onFilterChange("paintSeedMax", "");
    }
  };

  const handleMassAdd = () => {
    setIsMassAddOpen(true);
  };

  const processMassAdd = () => {
    const text = massAddText;

    if (!text || text.trim() === '') {
      toast.error("Field is empty");
      return;
    }

    // Parse various formats: comma-separated, space-separated, newline-separated, JSON array
    let numbers: number[] = [];

    // Try JSON array first
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        numbers = parsed.filter((n): n is number => typeof n === 'number' && n >= 0 && n <= 1000);
      }
    } catch {
      // Not JSON, try parsing as text
      const cleaned = text.replace(/[\[\]]/g, ''); // Remove brackets if any
      const parts = cleaned.split(/[,\s\n\r;|]+/).filter(Boolean);
      numbers = parts
        .map(p => parseInt(p.trim()))
        .filter(n => !isNaN(n) && n >= 0 && n <= 1000);
    }

    if (numbers.length === 0) {
      toast.error("No valid patterns (0-1000) found");
      return;
    }

    const merged = [...new Set([...paintSeeds, ...numbers])].sort((a, b) => a - b);
    const added = merged.length - paintSeeds.length;
    onFilterChange("paintSeeds", merged);

    // Clear legacy fields when we have multiple seeds
    if (merged.length > 1) {
      onFilterChange("paintSeedMin", "");
      onFilterChange("paintSeedMax", "");
    }

    if (added > 0) {
      toast.success(`Added ${added} pattern${added > 1 ? 's' : ''} (Total: ${merged.length})`);
    } else {
      toast.info("All patterns already exist");
    }

    setMassAddText("");
    setIsMassAddOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddSeed();
    }
  };

  return (
    <>
      <ScrollArea className="h-full">
        <div className="bg-sidebar p-4">
          {/* Paint Seed - Always visible */}
          <FilterSection title="Paint Seed" sectionId="paintSeed" isFlashing={flashSection === 'paintSeed'}>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="0-1000"
                  min={0}
                  max={1000}
                  value={newSeed}
                  onChange={(e) => setNewSeed(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="bg-input border-border h-9 flex-1 min-w-0"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddSeed}
                  disabled={!newSeed}
                  className="h-9 px-3 shrink-0 bg-emerald-500/20 border-emerald-500/50 hover:bg-emerald-500/30 hover:border-emerald-500 text-emerald-400"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleMassAdd}
                  className="h-9 px-3 shrink-0 bg-amber-500/20 border-amber-500/50 hover:bg-amber-500/30 hover:border-amber-500 text-amber-400"
                  title="Paste patterns from clipboard"
                >
                  <ClipboardPaste className="h-4 w-4" />
                </Button>

                {/* Single pattern display - inline */}
                {paintSeeds.length === 1 && (
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary/30 border border-border animate-fade-in shrink-0">
                    <span className="text-sm font-medium" style={{ color: '#4b69ff' }}>
                      #{paintSeeds[0]}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveSeed(paintSeeds[0])}
                      className="h-5 w-5 p-0 hover:bg-destructive/20 hover:text-destructive transition-all"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}

                {/* Multiple patterns - pack button inline */}
                {paintSeeds.length > 1 && (
                  <Popover open={isListOpen} onOpenChange={setIsListOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 gap-1.5 text-xs bg-secondary/30 border-primary/30 hover:bg-primary/10 hover:border-primary/50 transition-all animate-fade-in shrink-0"
                      >
                        <List className="h-4 w-4 text-primary" />
                        <span style={{ color: '#4b69ff' }} className="font-medium">
                          {paintSeeds.length}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-72 p-0 bg-popover border-border"
                      align="start"
                      sideOffset={5}
                    >
                      <div className="p-2 border-b border-border bg-secondary/20">
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                              type="text"
                              placeholder="Search..."
                              value={searchPattern}
                              onChange={(e) => setSearchPattern(e.target.value)}
                              className="h-7 pl-7 pr-2 text-xs bg-input border-border"
                            />
                          </div>
                          <Badge variant="secondary" className="text-[10px] shrink-0">
                            {paintSeeds.length}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const data = JSON.stringify(paintSeeds);
                              navigator.clipboard.writeText(data);
                            }}
                            className="h-7 w-7 p-0 bg-transparent border-primary/50 hover:bg-primary/10 hover:border-primary text-primary"
                            title="Export"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                const text = await navigator.clipboard.readText();
                                const imported = JSON.parse(text);
                                if (Array.isArray(imported)) {
                                  const validSeeds = imported
                                    .filter((s): s is number => typeof s === 'number' && s >= 0 && s <= 1000);
                                  const merged = [...new Set([...paintSeeds, ...validSeeds])].sort((a, b) => a - b);
                                  onFilterChange("paintSeeds", merged);
                                }
                              } catch (e) {
                                console.error('Import failed:', e);
                              }
                            }}
                            className="h-7 w-7 p-0 bg-transparent border-primary/50 hover:bg-primary/10 hover:border-primary text-primary"
                            title="Import"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsClearAllOpen(true)}
                            className="h-7 w-7 p-0 bg-transparent border-destructive/50 hover:bg-destructive/10 hover:border-destructive text-destructive"
                            title="Clear All"
                          >
                            <Trash className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <ScrollArea className="h-[200px]">
                        <div className="p-2 space-y-1">
                          {filteredSeeds.length === 0 ? (
                            <div className="text-xs text-muted-foreground text-center py-4">
                              {searchPattern ? "No matches found" : "No patterns added"}
                            </div>
                          ) : (
                            filteredSeeds.map((seed) => (
                              <div
                                key={seed}
                                className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-secondary/50 group"
                              >
                                <span className="text-sm" style={{ color: '#4b69ff' }}>
                                  #{seed}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveSeed(seed)}
                                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-destructive/20 hover:text-destructive transition-all"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ))
                          )}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                )}
              </div>

              {/* Numeric Keypad */}
              <div className="grid grid-cols-5 gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((num) => (
                  <Button
                    key={num}
                    variant="outline"
                    size="sm"
                    onClick={() => setNewSeed(prev => prev + String(num))}
                    className="h-8 text-sm font-medium bg-secondary/50 border-border hover:bg-primary/20 hover:border-primary/50 hover:text-primary transition-all"
                  >
                    {num}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNewSeed("")}
                  disabled={!newSeed}
                  className="h-8 text-xs bg-secondary/50 border-border hover:bg-destructive/20 hover:border-destructive/50 hover:text-destructive transition-all gap-1"
                >
                  <Eraser className="h-3.5 w-3.5" />
                  Clear
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNewSeed(prev => prev.slice(0, -1))}
                  disabled={!newSeed}
                  className="h-8 text-xs bg-secondary/50 border-border hover:bg-destructive/20 hover:border-destructive/50 hover:text-destructive transition-all gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>
            </div>
          </FilterSection>

          {/* Fade - Always shown with slider */}
          {(() => {
            // Check if selected item is relevant for each filter
            const selectedItem = filterData.selectedItem || "";
            const isFadeItem = selectedItem.toLowerCase().includes('fade');
            const isCaseHardenedItem = selectedItem.toLowerCase().includes('case hardened');

            // Compute if each filter is at default values
            const fadeIsDefault = (filterData.fadeMin === "0" || filterData.fadeMin === "80") && filterData.fadeMax === "100";
            const blueGemIsDefault = filterData.blueMin === "0" && filterData.blueMax === "100";

            // Fade is disabled if:
            // 1. An item is selected AND it's not a Fade item, OR
            // 2. Blue Gem has non-default values
            const fadeDisabled = (selectedItem && !isFadeItem) || !blueGemIsDefault;

            // Blue Gem is disabled if:
            // 1. An item is selected AND it's not a Case Hardened item, OR
            // 2. Fade has non-default values
            const blueGemDisabled = (selectedItem && !isCaseHardenedItem) || !fadeIsDefault;

            return (
              <>
                <FilterSection title="Fade" sectionId="patterns" isFlashing={flashSection === 'patterns'} icon={<div className="w-5 h-5 rounded fade-gradient shadow-sm flex items-center justify-center text-[9px] font-bold text-white/90 drop-shadow-md">%</div>}>
                  <div className="space-y-3">
                    <div className="relative">
                      <div className={`absolute inset-0 h-2 top-1/2 -translate-y-1/2 rounded-full fade-gradient ${fadeDisabled ? 'opacity-30' : 'opacity-90'}`} />
                      <Slider
                        value={[Number(filterData.fadeMin), Number(filterData.fadeMax)]}
                        min={80}
                        max={100}
                        step={0.1}
                        disabled={fadeDisabled}
                        thumbColors={[
                          getFadeThumbColor(Number(filterData.fadeMin)),
                          getFadeThumbColor(Number(filterData.fadeMax))
                        ]}
                        onValueChange={(value) => {
                          onFilterChange("fadeMin", String(value[0]));
                          onFilterChange("fadeMax", String(value[1]));
                          if (!filterData.fadeFilterEnabled) {
                            onFilterChange("fadeFilterEnabled", true);
                            onFilterChange("blueGemFilterEnabled", false);
                          }
                          playSound();
                        }}
                        className={`relative [&_[data-slot=track]]:bg-transparent ${fadeDisabled ? 'opacity-50 pointer-events-none' : ''}`}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Minimum %</label>
                        <Input
                          type="number"
                          value={filterData.fadeMin}
                          onChange={(e) => onFilterChange("fadeMin", e.target.value)}
                          onBlur={(e) => {
                            const val = Math.min(100, Math.max(80, Number(e.target.value) || 80));
                            onFilterChange("fadeMin", String(val));
                            if (!filterData.fadeFilterEnabled) {
                              onFilterChange("fadeFilterEnabled", true);
                              onFilterChange("blueGemFilterEnabled", false);
                            }
                          }}
                          disabled={fadeDisabled}
                          className={`bg-input border-border h-9 ${fadeDisabled ? 'opacity-50' : ''}`}
                          min={80}
                          max={100}
                          step={0.1}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Maximum %</label>
                        <Input
                          type="number"
                          value={filterData.fadeMax}
                          onChange={(e) => onFilterChange("fadeMax", e.target.value)}
                          onBlur={(e) => {
                            const val = Math.min(100, Math.max(80, Number(e.target.value) || 100));
                            onFilterChange("fadeMax", String(val));
                            if (!filterData.fadeFilterEnabled) {
                              onFilterChange("fadeFilterEnabled", true);
                              onFilterChange("blueGemFilterEnabled", false);
                            }
                          }}
                          disabled={fadeDisabled}
                          className={`bg-input border-border h-9 ${fadeDisabled ? 'opacity-50' : ''}`}
                          min={80}
                          max={100}
                          step={0.1}
                        />
                      </div>
                    </div>
                  </div>
                </FilterSection>

                {/* Blue Gem - Always shown with slider */}
                <FilterSection title="Blue Gem" sectionId="patterns" isFlashing={flashSection === 'patterns'} icon={<div className="w-5 h-5 rounded blue-gradient shadow-sm flex items-center justify-center text-[9px] font-bold text-white/90 drop-shadow-md">%</div>}>
                  <div className="space-y-3">
                    <div className="relative">
                      <div className={`absolute inset-0 h-2 top-1/2 -translate-y-1/2 rounded-full blue-gradient ${blueGemDisabled ? 'opacity-30' : 'opacity-90'}`} />
                      <Slider
                        value={[Number(filterData.blueMin), Number(filterData.blueMax)]}
                        min={0}
                        max={100}
                        step={0.1}
                        disabled={blueGemDisabled}
                        thumbColors={[
                          getBlueGemThumbColor(Number(filterData.blueMin)),
                          getBlueGemThumbColor(Number(filterData.blueMax))
                        ]}
                        onValueChange={(value) => {
                          onFilterChange("blueMin", String(value[0]));
                          onFilterChange("blueMax", String(value[1]));
                          if (!filterData.blueGemFilterEnabled) {
                            onFilterChange("blueGemFilterEnabled", true);
                            onFilterChange("fadeFilterEnabled", false);
                          }
                          playSound();
                        }}
                        className={`relative [&_[data-slot=track]]:bg-transparent ${blueGemDisabled ? 'opacity-50 pointer-events-none' : ''}`}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Minimum %</label>
                        <Input
                          type="number"
                          value={filterData.blueMin}
                          onChange={(e) => {
                            const val = Math.min(100, Math.max(0, Number(e.target.value)));
                            onFilterChange("blueMin", String(val));
                            if (!filterData.blueGemFilterEnabled) {
                              onFilterChange("blueGemFilterEnabled", true);
                              onFilterChange("fadeFilterEnabled", false);
                            }
                          }}
                          disabled={blueGemDisabled}
                          className={`bg-input border-border h-9 ${blueGemDisabled ? 'opacity-50' : ''}`}
                          min={0}
                          max={100}
                          step={0.1}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Maximum %</label>
                        <Input
                          type="number"
                          value={filterData.blueMax}
                          onChange={(e) => {
                            const val = Math.min(100, Math.max(0, Number(e.target.value)));
                            onFilterChange("blueMax", String(val));
                            if (!filterData.blueGemFilterEnabled) {
                              onFilterChange("blueGemFilterEnabled", true);
                              onFilterChange("fadeFilterEnabled", false);
                            }
                          }}
                          disabled={blueGemDisabled}
                          className={`bg-input border-border h-9 ${blueGemDisabled ? 'opacity-50' : ''}`}
                          min={0}
                          max={100}
                          step={0.1}
                        />
                      </div>
                    </div>
                  </div>
                </FilterSection>
              </>
            );
          })()}

          {/* Blue Gem section is now rendered inside the IIFE above */}
        </div>
      </ScrollArea>

      {/* Mass Add Dialog */}
      <Dialog open={isMassAddOpen} onOpenChange={setIsMassAddOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Mass Add Patterns</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Paste patterns in any format: comma-separated, space-separated, newline-separated, or JSON array.
            </p>
            <Textarea
              placeholder="123, 456, 789&#10;or&#10;[123, 456, 789]&#10;or&#10;123&#10;456&#10;789"
              value={massAddText}
              onChange={(e) => setMassAddText(e.target.value)}
              className="min-h-[120px] bg-input border-border font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Valid values: 0-1000.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="icon"
              className="border-border bg-accent/10 hover:bg-accent/20 text-accent hover:text-accent mr-auto h-9 w-9"
              title="Import from file"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json,.txt,.csv';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const text = event.target?.result as string;
                      setMassAddText(prev => prev ? prev + '\n' + text : text);
                    };
                    reader.readAsText(file);
                  }
                };
                input.click();
              }}
            >
              <Upload className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline"
              className="border-destructive/50 text-destructive hover:bg-destructive/15 hover:border-destructive"
              onClick={() => setIsMassAddOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={processMassAdd}
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear All Confirmation Dialog */}
      <Dialog open={isClearAllOpen} onOpenChange={setIsClearAllOpen}>
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Clear All Patterns?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will remove all {paintSeeds.length} patterns. This action cannot be undone.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsClearAllOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onFilterChange("paintSeeds", []);
                // Also clear legacy fields to prevent stale values
                onFilterChange("paintSeedMin", "");
                onFilterChange("paintSeedMax", "");
                setIsClearAllOpen(false);
                setIsListOpen(false);
                toast.success("All patterns cleared");
              }}
            >
              Clear All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
