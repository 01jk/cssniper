import { EyeOff, Eye, Swords, Hand, Crosshair, Target, Zap, Shield, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MonitorFilters, WEAPON_CATEGORIES } from "../monitorFilterTypes";

interface Props {
  filters: MonitorFilters;
  onFiltersChange: (f: MonitorFilters) => void;
}

// Category visual identity — accent color + icon for fast scanning
const CATEGORY_META: Record<string, { color: string; icon: React.ComponentType<{ className?: string }> }> = {
  Knives:  { color: "#fbbf24", icon: Swords },     // gold
  Gloves:  { color: "#a855f7", icon: Hand },       // violet
  Rifles:  { color: "#ef4444", icon: Crosshair },  // red
  Pistols: { color: "#3b82f6", icon: Target },     // blue
  SMGs:    { color: "#22c55e", icon: Zap },        // green
  Heavy:   { color: "#f97316", icon: Shield },     // orange
};

const StateBox = ({ checked, accent }: { checked: boolean; accent: string }) => (
  <span
    className="h-3 w-3 rounded-[3px] border flex items-center justify-center flex-shrink-0 transition-colors"
    style={
      checked
        ? { backgroundColor: 'hsl(var(--destructive))', borderColor: 'hsl(var(--destructive))' }
        : { backgroundColor: `${accent}25`, borderColor: `${accent}90` }
    }
  >
    {checked && <Check className="h-2 w-2 text-white" strokeWidth={3} />}
  </span>
);

export const WeaponsFilterSection = ({ filters, onFiltersChange }: Props) => {
  const toggleType = (type: string) => {
    const next = new Set(filters.hiddenWeaponTypes);
    next.has(type) ? next.delete(type) : next.add(type);
    onFiltersChange({ ...filters, hiddenWeaponTypes: next });
  };

  const toggleAllInGroup = (types: string[]) => {
    const allHidden = types.every(t => filters.hiddenWeaponTypes.has(t));
    const next = new Set(filters.hiddenWeaponTypes);
    types.forEach(t => allHidden ? next.delete(t) : next.add(t));
    onFiltersChange({ ...filters, hiddenWeaponTypes: next });
  };

  const totalHidden = filters.hiddenWeaponTypes.size;
  const totalAll = WEAPON_CATEGORIES.reduce((s, g) => s + g.types.length, 0);

  return (
    <div className="h-full overflow-y-auto scrollbar-thin pr-1">
      {/* Category cards */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 gap-2.5 auto-rows-min origin-top-left"
        style={{ transform: 'scale(1.1431)', width: `${100 / 1.1431}%` }}
      >
        {WEAPON_CATEGORIES.map(group => {
          const meta = CATEGORY_META[group.label] ?? { color: "#64748b", icon: Crosshair };
          const Icon = meta.icon;
          const hiddenCount = group.types.filter(t => filters.hiddenWeaponTypes.has(t)).length;
          const allHidden = hiddenCount === group.types.length;
          const someHidden = hiddenCount > 0 && !allHidden;

          return (
            <div
              key={group.label}
              className="rounded-lg border bg-card/30 overflow-hidden transition-colors"
              style={{
                borderColor: allHidden ? 'hsl(var(--destructive) / 0.4)' : `${meta.color}30`,
                boxShadow: allHidden ? 'none' : `inset 0 0 0 1px ${meta.color}10`,
              }}
            >
              {/* Header strip */}
              <button
                onClick={() => toggleAllInGroup(group.types)}
                className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 border-b transition-colors group"
                style={{
                  borderColor: allHidden ? 'hsl(var(--destructive) / 0.3)' : `${meta.color}25`,
                  backgroundColor: allHidden ? 'hsl(var(--destructive) / 0.08)' : `${meta.color}12`,
                }}
              >
                <div className="flex items-center gap-2">
                  <Icon
                    className="h-3.5 w-3.5 transition-transform group-hover:scale-110"
                    style={{ color: allHidden ? 'hsl(var(--destructive))' : meta.color }}
                  />
                  <span
                    className={`text-[12px] font-bold tracking-wide ${allHidden ? 'line-through' : ''}`}
                    style={{ color: allHidden ? 'hsl(var(--destructive))' : meta.color }}
                  >
                    {group.label.toUpperCase()}
                  </span>
                  <span className="text-[9px] text-muted-foreground/70 tabular-nums">
                    {group.types.length}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {hiddenCount > 0 && (
                    <span className="text-[9px] font-bold text-destructive tabular-nums px-1.5 py-0.5 rounded bg-destructive/10">
                      −{hiddenCount}
                    </span>
                  )}
                  {allHidden ? (
                    <Eye className="h-3 w-3 text-destructive" />
                  ) : someHidden ? (
                    <EyeOff className="h-3 w-3 text-muted-foreground" />
                  ) : (
                    <EyeOff className="h-3 w-3 text-muted-foreground/40" />
                  )}
                </div>
              </button>

              {/* Chips */}
              <div className="p-1.5 flex flex-wrap gap-1">
                {group.types.map(type => {
                  const isHidden = filters.hiddenWeaponTypes.has(type);
                  return (
                    <button
                      key={type}
                      data-filter-key={`wpn-${type}`}
                      onClick={() => toggleType(type)}
                      className={`flex items-center gap-1.5 pl-1.5 pr-2 py-0.5 rounded text-[10.5px] font-medium border transition-all ${
                        isHidden
                          ? 'border-destructive/40 bg-destructive/10 text-destructive line-through'
                          : 'hover:brightness-125'
                      }`}
                      style={
                        !isHidden
                          ? {
                              borderColor: `${meta.color}40`,
                              backgroundColor: `${meta.color}15`,
                              color: meta.color,
                            }
                          : undefined
                      }
                    >
                      <StateBox checked={isHidden} accent={meta.color} />
                      <span>{type}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
