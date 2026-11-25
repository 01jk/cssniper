import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Check, X } from "lucide-react";
import { MonitorFilters } from "../monitorFilterTypes";

// Logarithmic scale conversion
const priceToSlider = (price: number): number => {
  if (price <= 0) return 0;
  if (price <= 100) return (price / 100) * 25;
  if (price <= 1000) return 25 + ((price - 100) / 900) * 25;
  if (price <= 10000) return 50 + ((price - 1000) / 9000) * 25;
  return 75 + Math.min(((price - 10000) / 90000) * 25, 25);
};

const sliderToPrice = (slider: number): number => {
  if (slider <= 25) return Math.round((slider / 25) * 100);
  if (slider <= 50) return Math.round(100 + ((slider - 25) / 25) * 900);
  if (slider <= 75) return Math.round(1000 + ((slider - 50) / 25) * 9000);
  return Math.round(10000 + ((slider - 75) / 25) * 90000);
};

const fmt = (n: string | number) => {
  const num = Number(n);
  if (!isFinite(num) || num === 0) return "0";
  if (num >= 1000) return `${(num / 1000).toFixed(num >= 10000 ? 0 : 1)}K`;
  return String(Math.round(num));
};

interface Props {
  filters: MonitorFilters;
  onFiltersChange: (f: MonitorFilters) => void;
}

const PRESETS: { label: string; min: number; max: number }[] = [
  { label: "<$10", min: 0, max: 10 },
  { label: "$10–100", min: 10, max: 100 },
  { label: "$100–1K", min: 100, max: 1000 },
  { label: "$1K–10K", min: 1000, max: 10000 },
  { label: "$10K+", min: 10000, max: 100000 },
];

const SCALE_TICKS = [
  { pos: 0, label: "$0" },
  { pos: 25, label: "$100" },
  { pos: 50, label: "$1K" },
  { pos: 75, label: "$10K" },
  { pos: 100, label: "$100K" },
];

export const PriceFilterSection = ({ filters, onFiltersChange }: Props) => {
  const applyPreset = (min: number, max: number) => {
    onFiltersChange({
      ...filters,
      priceMin: String(min),
      priceMax: String(max),
      rangePriceFromPending: String(min),
      rangePriceToPending: String(max),
      rangePriceConfirmed: true,
    });
  };

  const confirmed = filters.rangePriceConfirmed;
  const minVal = confirmed ? filters.priceMin : filters.rangePriceFromPending || "0";
  const maxVal = confirmed ? filters.priceMax : filters.rangePriceToPending || "100000";
  const minPos = priceToSlider(Number(minVal));
  const maxPos = priceToSlider(Number(maxVal));
  const hasPending = Boolean(filters.rangePriceFromPending || filters.rangePriceToPending);

  const handleConfirm = () => {
    if (confirmed) {
      onFiltersChange({
        ...filters,
        rangePriceConfirmed: false,
        rangePriceFromPending: filters.priceMin,
        rangePriceToPending: filters.priceMax,
        priceMin: "",
        priceMax: "",
      });
    } else if (hasPending) {
      onFiltersChange({
        ...filters,
        priceMin: filters.rangePriceFromPending || "0",
        priceMax: filters.rangePriceToPending || "0",
        rangePriceConfirmed: true,
      });
    }
  };

  return (
    <div className="h-full flex flex-col gap-2 font-mono">
      {/* ===== UNIFIED OPERATIONAL CARD ===== */}
      <div data-filter-key="price-range" className="flex-1 min-h-0 rounded-lg border border-border/60 bg-gradient-to-b from-black/60 to-black/30 flex flex-col overflow-hidden shadow-[inset_0_1px_0_0_hsl(var(--primary)/0.1)]">
        {/* --- Readout ribbon: From / Status / To --- */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 h-7 border-b border-border/60 bg-black/50 shrink-0">
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-[8.5px] uppercase tracking-[0.25em] text-muted-foreground/70">From</span>
            <span className="text-[13px] font-bold text-primary tabular-nums leading-none">${fmt(minVal)}</span>
          </div>
          <span
            className={`flex items-center gap-1 text-[8px] uppercase tracking-[0.2em] font-bold ${
              confirmed ? "text-emerald-300" : "text-amber-300"
            }`}
          >
            <span
              className={`inline-block h-1 w-1 rounded-full ${
                confirmed
                  ? "bg-emerald-400 shadow-[0_0_4px_hsl(142_76%_50%)]"
                  : "bg-amber-400 shadow-[0_0_4px_hsl(45_95%_55%)] animate-pulse"
              }`}
            />
            {confirmed ? "Live" : "Draft"}
          </span>
          <div className="flex items-baseline justify-end gap-1.5 min-w-0">
            <span className="text-[13px] font-bold text-primary tabular-nums leading-none">${fmt(maxVal)}</span>
            <span className="text-[8.5px] uppercase tracking-[0.25em] text-muted-foreground/70">To</span>
          </div>
        </div>

        {/* --- Slider with scale ticks --- */}
        <div className="flex-1 min-h-0 flex flex-col justify-center px-2 py-0.5 gap-0.5">
          {/* Slider */}
          <div className="relative px-1">
            <div
              className={`absolute left-1 right-1 h-2 top-1/2 -translate-y-1/2 rounded-full price-gradient ${
                confirmed ? "opacity-40" : ""
              }`}
            />
            {/* Active range overlay */}
            <div
              className={`absolute h-2 top-1/2 -translate-y-1/2 rounded-full pointer-events-none ${
                confirmed ? "bg-emerald-500/20 ring-1 ring-emerald-400/40" : "bg-primary/15 ring-1 ring-primary/40"
              }`}
              style={{
                left: `calc(${minPos}% + 4px)`,
                width: `calc(${Math.max(0, maxPos - minPos)}% - 8px)`,
              }}
            />
            <Slider
              value={[minPos, maxPos]}
              min={0}
              max={100}
              step={0.5}
              disabled={confirmed}
              thumbColors={["hsl(var(--primary))", "hsl(var(--primary))"]}
              onValueChange={(value) => {
                const a = sliderToPrice(value[0]);
                const b = sliderToPrice(value[1]);
                onFiltersChange({
                  ...filters,
                  rangePriceFromPending: String(a),
                  rangePriceToPending: String(b),
                  rangePriceConfirmed: false,
                });
              }}
              className="relative [&_[data-slot=track]]:bg-transparent"
            />
          </div>

          {/* Scale ticks */}
          <div className="relative h-2 px-1">
            {SCALE_TICKS.map((t) => (
              <div
                key={t.pos}
                className="absolute -translate-x-1/2 flex flex-col items-center gap-0.5"
                style={{ left: `${t.pos}%` }}
              >
                <span className="block h-1 w-px bg-border/60" />
                <span className="text-[8px] tabular-nums text-muted-foreground/60 leading-none">{t.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* --- Quick presets — full width segmented control feel --- */}
        <div className="grid grid-cols-5 border-t border-border/60 bg-black/40 shrink-0">
          {PRESETS.map((p, i) => {
            const active = confirmed && filters.priceMin === String(p.min) && filters.priceMax === String(p.max);
            return (
              <button
                key={p.label}
                onClick={() => applyPreset(p.min, p.max)}
                className={`relative h-7 text-[10px] font-bold tracking-wider tabular-nums transition-all ${
                  i > 0 ? "border-l border-border/60" : ""
                } ${
                  active
                    ? "bg-primary/20 text-primary shadow-[inset_0_0_12px_hsl(var(--primary)/0.3)]"
                    : "text-foreground/60 hover:bg-primary/10 hover:text-primary"
                }`}
              >
                {active && (
                  <span className="absolute top-0 left-0 right-0 h-px bg-primary shadow-[0_0_6px_hsl(var(--primary))]" />
                )}
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== Manual input row — Min / Max / Action ===== */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 shrink-0">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70 pointer-events-none">
            MIN $
          </span>
          <Input
            type="text"
            inputMode="decimal"
            value={confirmed ? filters.priceMin : filters.rangePriceFromPending || ""}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9.]/g, "");
              onFiltersChange({
                ...filters,
                rangePriceFromPending: v,
                rangePriceConfirmed: false,
              });
            }}
            className="h-9 pl-12 pr-2 text-right text-xs font-bold bg-black/60 border-border/60 tabular-nums focus-visible:border-primary/60"
            placeholder="0"
            disabled={confirmed}
          />
        </div>

        <button
          onClick={handleConfirm}
          disabled={!confirmed && !hasPending}
          className={`h-9 w-10 rounded border-2 flex items-center justify-center transition-all shrink-0 ${
            confirmed
              ? "bg-destructive/15 border-destructive/60 text-destructive hover:bg-destructive/25"
              : hasPending
                ? "border-emerald-500/60 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 shadow-[0_0_8px_hsl(142_76%_50%/0.3)]"
                : "border-muted-foreground/20 text-muted-foreground/30 cursor-not-allowed"
          }`}
          title={confirmed ? "Reset" : "Confirm range"}
        >
          {confirmed ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
        </button>

        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70 pointer-events-none">
            MAX $
          </span>
          <Input
            type="text"
            inputMode="decimal"
            value={confirmed ? filters.priceMax : filters.rangePriceToPending || ""}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9.]/g, "");
              onFiltersChange({
                ...filters,
                rangePriceToPending: v,
                rangePriceConfirmed: false,
              });
            }}
            className="h-9 pl-12 pr-2 text-right text-xs font-bold bg-black/60 border-border/60 tabular-nums focus-visible:border-primary/60"
            placeholder="100000"
            disabled={confirmed}
          />
        </div>
      </div>
    </div>
  );
};
