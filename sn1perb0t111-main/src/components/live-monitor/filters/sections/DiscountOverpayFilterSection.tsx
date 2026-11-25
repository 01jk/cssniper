import { useMemo } from "react";
import { Slider } from "@/components/ui/slider";
import { TrendingDown, TrendingUp, Percent, Infinity as InfinityIcon } from "lucide-react";
import { MonitorFilters } from "../monitorFilterTypes";
import { cn } from "@/lib/utils";

interface Props {
  filters: MonitorFilters;
  onFiltersChange: (f: MonitorFilters) => void;
}

const RANGE_MIN = -50; // overpay limit
const RANGE_MAX = 100; // discount cap

const parseNum = (s: string, fallback: number) => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : fallback;
};

export const DiscountOverpayFilterSection = ({ filters, onFiltersChange }: Props) => {
  const minInf = filters.discountMin === '-inf';
  const maxInf = filters.discountMax === 'inf';
  const min = useMemo(() => minInf ? RANGE_MIN : Math.max(RANGE_MIN, Math.min(RANGE_MAX, parseNum(filters.discountMin, RANGE_MIN))), [filters.discountMin, minInf]);
  const max = useMemo(() => maxInf ? RANGE_MAX : Math.max(RANGE_MIN, Math.min(RANGE_MAX, parseNum(filters.discountMax, RANGE_MAX))), [filters.discountMax, maxInf]);

  const enabled = filters.discountEnabled;

  const onSlide = (vals: number[]) => {
    const [lo, hi] = vals;
    // Auto-deactivate when both thumbs are at the extremes (effectively no filter)
    const atDefaults = lo <= RANGE_MIN && hi >= RANGE_MAX && !minInf && !maxInf;
    onFiltersChange({
      ...filters,
      discountMin: minInf ? '-inf' : String(lo),
      discountMax: maxInf ? 'inf' : String(hi),
      discountEnabled: !atDefaults,
    });
  };

  const toggleMinInf = () => {
    onFiltersChange({ ...filters, discountMin: minInf ? String(RANGE_MIN) : '-inf', discountEnabled: true });
  };
  const toggleMaxInf = () => {
    onFiltersChange({ ...filters, discountMax: maxInf ? String(RANGE_MAX) : 'inf', discountEnabled: true });
  };


  const fmt = (n: number) => `${n > 0 ? '+' : ''}${n}%`;

  // Track gradient: red (overpay) → neutral (0) → emerald (discount)
  const zeroPct = ((0 - RANGE_MIN) / (RANGE_MAX - RANGE_MIN)) * 100;
  const trackBg = `linear-gradient(to right,
    hsl(var(--destructive) / 0.55) 0%,
    hsl(var(--destructive) / 0.25) ${zeroPct - 4}%,
    hsl(var(--muted) / 0.6) ${zeroPct}%,
    hsl(142 76% 45% / 0.25) ${zeroPct + 4}%,
    hsl(142 76% 45% / 0.55) 100%)`;

  return (
    <div className="space-y-4" data-filter-key="discount">
      {/* Static header — matches Blocklist style */}
      <div className="flex items-center gap-2">
        <span className={cn(
          "inline-flex items-center justify-center h-6 w-6 rounded border transition-all",
          enabled ? "border-primary/40 bg-primary/10 text-primary" : "border-muted-foreground/30 bg-muted/20 text-muted-foreground/60"
        )}>
          <Percent className="h-3.5 w-3.5" strokeWidth={2.5} />
        </span>
        <div className="flex-1 min-w-0">
          <p className={cn("text-xs font-semibold leading-none", enabled ? "text-foreground" : "text-muted-foreground")}>Discount / Overpay</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {enabled ? "Active — filtering by price-vs-market %" : "Move the slider to activate"}
          </p>
        </div>
      </div>

      {/* Dimmed when untouched; full brightness once user moves the slider */}
      <div
        className="space-y-4 transition-all duration-300"
        style={!enabled ? { filter: 'grayscale(0.7) brightness(0.8)', opacity: 0.85 } : undefined}
      >
        {/* Big readout */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
            <div className="flex items-center justify-between gap-1 text-[9px] font-bold uppercase tracking-wider text-destructive/80">
              <span className="flex items-center gap-1"><TrendingDown className="h-2.5 w-2.5" /> Overpay</span>
              <button
                type="button"
                onClick={toggleMinInf}
                className={cn(
                  "inline-flex items-center justify-center h-4 w-4 rounded border transition-all",
                  minInf
                    ? "border-destructive/70 bg-destructive/30 text-destructive shadow-[0_0_6px_hsl(var(--destructive)/0.5)]"
                    : "border-destructive/40 bg-destructive/10 text-destructive/60 hover:text-destructive"
                )}
                title={minInf ? "Set finite limit" : "Allow infinite overpay"}
              >
                <InfinityIcon className="h-2.5 w-2.5" strokeWidth={3} />
              </button>
            </div>
            <div className="mt-1 font-mono text-lg font-bold tabular-nums text-destructive leading-none">
              {minInf ? '−∞' : fmt(min)}
            </div>
          </div>
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
            <div className="flex items-center justify-between gap-1 text-[9px] font-bold uppercase tracking-wider text-emerald-400/90">
              <span className="flex items-center gap-1"><TrendingUp className="h-2.5 w-2.5" /> Discount</span>
              <button
                type="button"
                onClick={toggleMaxInf}
                className={cn(
                  "inline-flex items-center justify-center h-4 w-4 rounded border transition-all",
                  maxInf
                    ? "border-emerald-500/70 bg-emerald-500/30 text-emerald-400 shadow-[0_0_6px_hsl(142_76%_50%/0.5)]"
                    : "border-emerald-500/40 bg-emerald-500/10 text-emerald-400/60 hover:text-emerald-400"
                )}
                title={maxInf ? "Set finite cap" : "Allow infinite discount"}
              >
                <InfinityIcon className="h-2.5 w-2.5" strokeWidth={3} />
              </button>
            </div>
            <div className="mt-1 font-mono text-lg font-bold tabular-nums text-emerald-400 leading-none">
              {maxInf ? '+∞' : fmt(max)}
            </div>
          </div>
        </div>

        {/* Slider */}
        <div className="px-1 pt-1">
          <div className="relative h-5 flex items-center">
            <div
              className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-2 rounded-full pointer-events-none"
              style={{ background: trackBg }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 h-3 w-px bg-foreground/40 pointer-events-none z-10"
              style={{ left: `${zeroPct}%` }}
            />
            <Slider
              value={[min, max]}
              min={RANGE_MIN}
              max={RANGE_MAX}
              step={1}
              onValueChange={onSlide}
              transparentTrack
              thumbColors={["hsl(var(--destructive))", "hsl(142 76% 45%)"]}
              className="relative w-full"
            />
          </div>

          <div className="relative mt-2 h-3 text-[9px] font-mono tabular-nums text-muted-foreground/60">
            {[
              { v: -50, label: '-50%' },
              { v: -25, label: '-25%' },
              { v: 0, label: '0%', bold: true },
              { v: 25, label: '+25%' },
              { v: 50, label: '+50%' },
              { v: 100, label: '+100%' },
            ].map(({ v, label, bold }) => {
              const pct = ((v - RANGE_MIN) / (RANGE_MAX - RANGE_MIN)) * 100;
              return (
                <span
                  key={v}
                  className={cn(
                    "absolute -translate-x-1/2 top-0",
                    bold && "text-foreground/70 font-bold"
                  )}
                  style={{ left: `${pct}%` }}
                >
                  {label}
                </span>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
};
