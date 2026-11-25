import { Check, X, Sparkles } from "lucide-react";
import { MonitorFilters } from "../monitorFilterTypes";
import { cn } from "@/lib/utils";

interface Props {
  filters: MonitorFilters;
  onFiltersChange: (f: MonitorFilters) => void;
}

const STICKER_TYPES: { key: keyof MonitorFilters; label: string; gradient: string; glow?: string; animClass?: string }[] = [
  { key: 'blockStickerHolo',  label: 'Holo',  gradient: 'linear-gradient(135deg, #ec4899, #a855f7, #3b82f6, #ec4899)', glow: '0 0 14px rgba(168,85,247,0.55), 0 0 28px rgba(236,72,153,0.35), inset 0 0 10px rgba(59,130,246,0.25)', animClass: 'sticker-swatch-holo' },
  { key: 'blockStickerFoil',  label: 'Foil',  gradient: 'linear-gradient(135deg, #06b6d4, #d1d5db, #06b6d4)', glow: '0 0 14px rgba(6,182,212,0.55), 0 0 28px rgba(165,243,252,0.35), inset 0 0 10px rgba(209,213,219,0.25)', animClass: 'sticker-swatch-foil' },
  { key: 'blockStickerGold',  label: 'Gold',  gradient: 'linear-gradient(135deg, #f59e0b, #fde047, #f59e0b)', glow: '0 0 14px rgba(245,158,11,0.6), 0 0 28px rgba(253,224,71,0.4), inset 0 0 10px rgba(245,158,11,0.3)', animClass: 'sticker-swatch-gold' },
  { key: 'blockStickerPaper', label: 'Paper', gradient: 'linear-gradient(135deg, #cbd5e1, #94a3b8)' },
];

export const StickersCharmFilterSection = ({ filters, onFiltersChange }: Props) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center h-6 w-6 rounded border border-primary/40 bg-primary/10 text-primary">
          <Sparkles className="h-3.5 w-3.5" strokeWidth={2.5} />
        </span>
        <div>
          <p className="text-xs font-semibold text-foreground leading-none">Sticker Types</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Click to toggle Allowed / Blocked</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {STICKER_TYPES.map(t => {
          const blocked = !!filters[t.key];
          return (
            <button
              key={t.key}
              data-filter-key={`stk-${t.key}`}
              type="button"
              onClick={() => onFiltersChange({ ...filters, [t.key]: !blocked } as MonitorFilters)}
              className={cn(
                "group flex items-center justify-between gap-2 px-3 py-2 rounded-md border transition-all text-left",
                blocked
                  ? "border-destructive/50 bg-destructive/10 hover:bg-destructive/15"
                  : "border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10",
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={cn("w-3.5 h-3.5 rounded-sm shrink-0", !blocked && t.animClass)}
                  style={{ background: t.gradient, boxShadow: !blocked && t.glow ? t.glow : undefined }}
                />
                <span className={cn(
                  "text-xs font-semibold truncate",
                  blocked ? "text-destructive/80 line-through decoration-destructive/60" : "text-foreground",
                )}>
                  {t.label}
                </span>
              </div>
              <span
                className={cn(
                  "shrink-0 inline-flex items-center justify-center h-5 w-5 rounded border transition-all",
                  blocked
                    ? "border-destructive/60 bg-destructive/20 text-destructive shadow-[0_0_6px_hsl(var(--destructive)/0.4)]"
                    : "border-emerald-500/60 bg-emerald-500/20 text-emerald-400 shadow-[0_0_6px_hsl(142_76%_50%/0.35)]",
                )}
                aria-hidden
              >
                {blocked
                  ? <X className="h-3 w-3" strokeWidth={3} />
                  : <Check className="h-3 w-3" strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground/80 leading-snug">
        Items with blocked sticker types are hidden — anything not blocked stays visible.
      </p>
    </div>
  );
};
