import { Slider } from "@/components/ui/slider";
import { EyeOff, Layers } from "lucide-react";
import { MonitorFilters, WEAR_TIERS, WearTier } from "../monitorFilterTypes";

interface Props {
  filters: MonitorFilters;
  onFiltersChange: (f: MonitorFilters) => void;
}

const WEAR_GRADIENT =
  "linear-gradient(to right, #22c55e 0%, #22c55e 7%, #84cc16 7%, #84cc16 15%, #eab308 15%, #eab308 38%, #f97316 38%, #f97316 45%, #ef4444 45%, #ef4444 100%)";

const clamp = (n: number) => Math.max(0, Math.min(1, n));

const wearColorAt = (f: number): string => {
  if (f < 0.07) return "#22c55e";
  if (f < 0.15) return "#84cc16";
  if (f < 0.38) return "#eab308";
  if (f < 0.45) return "#f97316";
  return "#ef4444";
};

const TIER_RANGES: Record<WearTier, [number, number]> = {
  fn: [0, 0.07],
  mw: [0.07, 0.15],
  ft: [0.15, 0.38],
  ww: [0.38, 0.45],
  bs: [0.45, 1],
};

const fmt = (n: number) => clamp(n).toFixed(2);

export const FloatWearFilterSection = ({ filters, onFiltersChange }: Props) => {
  const minNum = clamp(parseFloat(filters.floatMin) || 0);
  const maxNum = clamp(parseFloat(filters.floatMax) || (filters.floatMax === "" ? 1 : 0));
  const minVal = filters.floatMin === "" ? 0 : minNum;
  const maxVal = filters.floatMax === "" ? 1 : maxNum;

  // Sync: tier "hidden" iff slider range fully excludes it
  const isTierHidden = (t: WearTier) => {
    const [lo, hi] = TIER_RANGES[t];
    return !(minVal < hi && maxVal > lo);
  };

  const setRange = (newMin: number, newMax: number) => {
    const a = fmt(Math.min(newMin, newMax));
    const b = fmt(Math.max(newMin, newMax));
    // Rebuild hiddenWearTiers set from new range
    const next = new Set<WearTier>();
    (Object.keys(TIER_RANGES) as WearTier[]).forEach(t => {
      const [lo, hi] = TIER_RANGES[t];
      const min = parseFloat(a);
      const max = parseFloat(b);
      if (!(min < hi && max > lo)) next.add(t);
    });
    onFiltersChange({
      ...filters,
      floatMin: a,
      floatMax: b,
      floatMinEnabled: parseFloat(a) > 0,
      floatMaxEnabled: parseFloat(b) < 1,
      hiddenWearTiers: next,
    });
  };

  const toggleTier = (t: WearTier) => {
    const [lo, hi] = TIER_RANGES[t];
    const hidden = isTierHidden(t);
    if (hidden) {
      // Show: extend nearest edge to include tier
      if (hi <= minVal) setRange(lo, maxVal);
      else if (lo >= maxVal) setRange(minVal, hi);
      else setRange(Math.min(minVal, lo), Math.max(maxVal, hi));
    } else {
      // Hide: contract nearest edge to exclude tier
      const distLeft = Math.abs(minVal - lo);
      const distRight = Math.abs(maxVal - hi);
      if (lo <= minVal) {
        // left-edge tier
        setRange(hi, maxVal);
      } else if (hi >= maxVal) {
        // right-edge tier
        setRange(minVal, lo);
      } else {
        // middle tier — collapse from closest side
        if (distLeft <= distRight) setRange(hi, maxVal);
        else setRange(minVal, lo);
      }
    }
  };

  return (
    <div className="h-full flex flex-col gap-2 font-mono">
      {/* Unified card mirroring Price structure */}
      <div className="flex-1 min-h-0 rounded-lg border border-border/60 bg-gradient-to-b from-black/60 to-black/30 flex flex-col overflow-hidden shadow-[inset_0_1px_0_0_hsl(var(--primary)/0.1)]">
        {/* Readout ribbon — labels only */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 h-7 border-b border-border/60 bg-black/50 shrink-0">
          <span className="text-[8.5px] uppercase tracking-[0.25em] text-muted-foreground/70">From</span>
          <span className="flex items-center gap-1 text-[8px] uppercase tracking-[0.2em] font-bold text-muted-foreground/70">
            <Layers className="h-2.5 w-2.5 text-primary" />
            {(Object.keys(TIER_RANGES) as WearTier[]).filter(isTierHidden).length}/5 hidden
          </span>
          <span className="text-[8.5px] uppercase tracking-[0.25em] text-muted-foreground/70 justify-self-end">To</span>
        </div>

        {/* Wear chips */}
        <div className="flex-1 min-h-0 grid grid-cols-5 gap-1 p-2">
          {WEAR_TIERS.map(t => {
            const isHidden = isTierHidden(t.value);
            return (
              <button
                key={t.value}
                data-filter-key={`wear-${t.value}`}
                onClick={() => toggleTier(t.value)}
                className={`relative flex flex-col items-center justify-center gap-1 rounded border-2 transition-all bg-black/40 ${
                  isHidden ? 'border-destructive/40 bg-destructive/10' : 'hover:brightness-125'
                }`}
                style={!isHidden ? { borderColor: `${t.color}80`, backgroundColor: `${t.color}25` } : undefined}
              >
                <span className={`text-[14px] font-bold ${isHidden ? 'text-destructive line-through' : ''}`}
                  style={!isHidden ? { color: t.color } : undefined}>
                  {t.label}
                </span>
                <span className="text-[9px] text-muted-foreground tabular-nums">{t.range}</span>
                {isHidden && <EyeOff className="h-3 w-3 text-destructive absolute top-1 right-1" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Float range slider with wear gradient */}
      <div data-filter-key="float" className="rounded-lg border border-border/60 bg-gradient-to-b from-black/60 to-black/30 px-3 pt-2 pb-2 shadow-[inset_0_1px_0_0_hsl(var(--primary)/0.1)] shrink-0">
        <div className="grid grid-cols-3 items-center mb-1.5">
          <span
            className="text-[11px] font-bold tabular-nums justify-self-start leading-none"
            style={{ color: wearColorAt(minVal) }}
          >
            {minVal.toFixed(2)}
          </span>
          <span className="text-[8.5px] uppercase tracking-[0.25em] text-muted-foreground/70 justify-self-center">Float Range</span>
          <span
            className="text-[11px] font-bold tabular-nums justify-self-end leading-none"
            style={{ color: wearColorAt(maxVal) }}
          >
            {maxVal.toFixed(2)}
          </span>
        </div>
        <div className="relative px-1 py-2">
          <div
            className="absolute left-1 right-1 h-3 top-1/2 -translate-y-1/2 rounded-full overflow-hidden ring-1 ring-white/5"
            style={{ background: WEAR_GRADIENT }}
          >
            <div
              className="absolute top-0 bottom-0 left-0 bg-black/70"
              style={{ width: `${minVal * 100}%` }}
            />
            <div
              className="absolute top-0 bottom-0 right-0 bg-black/70"
              style={{ width: `${(1 - maxVal) * 100}%` }}
            />
          </div>
          <Slider
            value={[minVal * 1000, maxVal * 1000]}
            min={0}
            max={1000}
            step={1}
            minStepsBetweenThumbs={1}
            thumbColors={[wearColorAt(minVal), wearColorAt(maxVal)]}
            onValueChange={(value) => {
              setRange(value[0] / 1000, value[1] / 1000);
            }}
            className="relative h-5 [&_[data-slot=track]]:bg-transparent [&_[data-slot=track]]:h-3 [&_[role=slider]]:h-[15px] [&_[role=slider]]:w-[15px] [&_[role=slider]]:transition-transform [&_[role=slider]]:hover:scale-110 [&_[role=slider]]:active:scale-95"
          />
        </div>
      </div>
    </div>
  );
};
