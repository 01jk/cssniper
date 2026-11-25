import { useState, useCallback, useEffect } from "react";
import { Settings2, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type SlotMode = "fixed" | "range";

interface SpeedSlot {
  mode: SlotMode;
  fixed: string;       // e.g. "1"
  rangeMin: string;     // e.g. "0.7"
  rangeMax: string;     // e.g. "0.95"
}

const STORAGE_KEY = "live-scanner-speed-slots";
const ACTIVE_SLOT_KEY = "live-scanner-active-slot";

const defaultSlots: SpeedSlot[] = [
  { mode: "fixed", fixed: "0.5", rangeMin: "0.3", rangeMax: "0.7" },
  { mode: "fixed", fixed: "1", rangeMin: "0.7", rangeMax: "1.2" },
  { mode: "fixed", fixed: "5", rangeMin: "3", rangeMax: "7" },
];

const loadSlots = (): SpeedSlot[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return defaultSlots;
};

const loadActiveSlot = (): number => {
  try {
    const raw = localStorage.getItem(ACTIVE_SLOT_KEY);
    if (raw != null) return parseInt(raw, 10) || 0;
  } catch {}
  return 1;
};

interface IntervalSelectorProps {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}

const getSlotLabel = (slot: SpeedSlot): string => {
  if (slot.mode === "fixed") return `${slot.fixed}s`;
  return `${slot.rangeMin}–${slot.rangeMax}s`;
};

const getSlotValue = (slot: SpeedSlot): string => {
  if (slot.mode === "fixed") return slot.fixed;
  return `${slot.rangeMin}-${slot.rangeMax}`;
};

export const IntervalSelector = ({ value, onChange, disabled }: IntervalSelectorProps) => {
  const [slots, setSlots] = useState<SpeedSlot[]>(loadSlots);
  const [activeSlot, setActiveSlot] = useState(loadActiveSlot);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editSlots, setEditSlots] = useState<SpeedSlot[]>(loadSlots);

  const handleSlotClick = (index: number) => {
    setActiveSlot(index);
    localStorage.setItem(ACTIVE_SLOT_KEY, String(index));
    onChange(getSlotValue(slots[index]));
  };

  const openSettings = () => {
    setEditSlots(slots.map(s => ({ ...s })));
    setSettingsOpen(true);
  };

  const handleSave = () => {
    setSlots(editSlots);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(editSlots));
    const newActive = Math.min(activeSlot, editSlots.length - 1);
    setActiveSlot(newActive);
    localStorage.setItem(ACTIVE_SLOT_KEY, String(newActive));
    if (editSlots.length > 0) {
      onChange(getSlotValue(editSlots[newActive]));
    }
    setSettingsOpen(false);
  };

  const updateEditSlot = (index: number, partial: Partial<SpeedSlot>) => {
    setEditSlots(prev => prev.map((s, i) => i === index ? { ...s, ...partial } : s));
  };

  const removeEditSlot = (index: number) => {
    setEditSlots(prev => prev.filter((_, i) => i !== index));
  };

  const addEditSlot = () => {
    if (editSlots.length >= 3) return;
    setEditSlots(prev => [...prev, { mode: "fixed", fixed: "1", rangeMin: "0.5", rangeMax: "1.5" }]);
  };

  return (
    <div className="flex items-center h-full overflow-hidden shrink-0">
      {/* Speed slot buttons */}
      {slots.map((slot, i) => (
        <button
          key={i}
          onClick={() => !disabled && handleSlotClick(i)}
          disabled={disabled}
          className={`h-full px-3 text-xs font-mono font-bold transition-all duration-150 border-r border-border/20 whitespace-nowrap ${
            disabled ? "opacity-50 cursor-not-allowed" : ""
          } ${
            activeSlot === i
              ? disabled
                ? "bg-accent/15 text-accent shadow-[inset_0_-2px_0_hsl(var(--accent))]"
                : "bg-destructive/15 text-destructive shadow-[inset_0_-2px_0_hsl(var(--destructive))]"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
          }`}
        >
          {getSlotLabel(slot)}
        </button>
      ))}

      {/* Settings gear */}
      <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
        <PopoverTrigger asChild>
          <button
            onClick={openSettings}
            disabled={disabled}
            className={`h-full px-2.5 text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="bottom" align="end" className="w-72 p-0 border-border/50 bg-card">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/30">
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">Speed Slots</span>
            <span className="text-[10px] text-muted-foreground font-mono">{editSlots.length}/3</span>
          </div>

          {/* Slot editors */}
          <div className="p-3 space-y-3">
            {editSlots.map((slot, i) => (
              <div key={i} className="rounded-md border border-border/30 bg-secondary/10 overflow-hidden">
                {/* Slot header */}
                <div className="flex items-center justify-between px-2.5 py-1.5 bg-secondary/20 border-b border-border/20">
                  <span className="text-[10px] font-bold text-foreground uppercase tracking-wider">
                    Slot {i + 1}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {/* Mode toggle */}
                    <div className="flex items-center h-5 rounded border border-border/30 overflow-hidden">
                      <button
                        onClick={() => updateEditSlot(i, { mode: "fixed" })}
                        className={`px-2 h-full text-[9px] font-bold uppercase tracking-wider transition-colors ${
                          slot.mode === "fixed"
                            ? "bg-primary/20 text-primary"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Fixed
                      </button>
                      <button
                        onClick={() => updateEditSlot(i, { mode: "range" })}
                        className={`px-2 h-full text-[9px] font-bold uppercase tracking-wider transition-colors border-l border-border/20 ${
                          slot.mode === "range"
                            ? "bg-primary/20 text-primary"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Range
                      </button>
                    </div>
                    {/* Delete button */}
                    {editSlots.length > 1 && (
                      <button
                        onClick={() => removeEditSlot(i)}
                        className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Slot body */}
                <div className="px-2.5 py-2">
                  {slot.mode === "fixed" ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider w-12">Speed</span>
                      <Input
                        value={slot.fixed}
                        onChange={(e) => updateEditSlot(i, { fixed: e.target.value.replace(/[^0-9.]/g, "") })}
                        className="h-7 text-xs font-mono flex-1 bg-background/50 border-border/30"
                        placeholder="1.0"
                      />
                      <span className="text-[10px] text-muted-foreground font-mono">s</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider w-8">Min</span>
                      <Input
                        value={slot.rangeMin}
                        onChange={(e) => updateEditSlot(i, { rangeMin: e.target.value.replace(/[^0-9.]/g, "") })}
                        className="h-7 text-xs font-mono flex-1 bg-background/50 border-border/30"
                        placeholder="0.7"
                      />
                      <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider w-8 text-center">Max</span>
                      <Input
                        value={slot.rangeMax}
                        onChange={(e) => updateEditSlot(i, { rangeMax: e.target.value.replace(/[^0-9.]/g, "") })}
                        className="h-7 text-xs font-mono flex-1 bg-background/50 border-border/30"
                        placeholder="1.2"
                      />
                      <span className="text-[10px] text-muted-foreground font-mono">s</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-3 pb-3 flex gap-2">
            {editSlots.length < 3 && (
              <Button size="sm" variant="outline" className="flex-1 h-8 text-xs font-bold gap-1 border-border/30" onClick={addEditSlot}>
                <Plus className="h-3 w-3" /> Add Slot
              </Button>
            )}
            <Button size="sm" className={`h-8 text-xs font-bold ${editSlots.length < 3 ? 'flex-1' : 'w-full'}`} onClick={handleSave}>
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
