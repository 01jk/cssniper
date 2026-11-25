import { EyeOff, Crosshair, Award, Sticker, Gem, Shield, User, Package, Archive, Music, Trophy, Check } from "lucide-react";

const StateBox = ({ checked, onClick, variant = 'gray', tintColor }: { checked: boolean; onClick: () => void; variant?: 'gray' | 'green' | 'tint'; tintColor?: string }) => (
  <button
    type="button"
    onClick={(e) => { e.preventDefault(); onClick(); }}
    className={`h-3.5 w-3.5 rounded-[3px] border flex items-center justify-center flex-shrink-0 transition-colors ${
      checked
        ? 'bg-destructive border-destructive'
        : variant === 'green'
          ? 'bg-emerald-500/20 border-emerald-500/70 hover:bg-emerald-500/30'
          : variant === 'tint'
            ? ''
            : 'bg-muted/40 border-muted-foreground/40 hover:bg-muted/60'
    }`}
    style={!checked && variant === 'tint' && tintColor ? { backgroundColor: `${tintColor}55`, borderColor: tintColor } : undefined}
  >
    {checked && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
  </button>
);
import { MonitorFilters, RARITIES, ITEM_CATEGORIES } from "../monitorFilterTypes";

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  stattrak: Crosshair,
  souvenir: Award,
  stickers: Sticker,
  charms: Gem,
  patches: Shield,
  agents: User,
  containers: Package,
  cases: Archive,
  'music-kits': Music,
  collectibles: Trophy,
};

interface Props {
  filters: MonitorFilters;
  onFiltersChange: (f: MonitorFilters) => void;
}

export const RarityCategoryFilterSection = ({ filters, onFiltersChange }: Props) => {
  const toggleRarity = (r: string) => {
    const next = new Set(filters.hiddenRarities);
    next.has(r) ? next.delete(r) : next.add(r);
    onFiltersChange({ ...filters, hiddenRarities: next });
  };
  const toggleCategory = (c: string) => {
    const next = new Set(filters.hiddenCategories);
    next.has(c) ? next.delete(c) : next.add(c);
    onFiltersChange({ ...filters, hiddenCategories: next });
  };

  return (
    <div className="h-full overflow-hidden pr-1 flex flex-col gap-3">
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex flex-col flex-1 gap-1 min-h-0">
          {RARITIES.map(r => {
            const isHidden = filters.hiddenRarities.has(r.value);
            return (
              <label
                key={r.value}
                data-filter-key={`rar-${r.value}`}
                className={`flex flex-1 items-center gap-2 px-2.5 rounded-md border cursor-pointer transition-colors text-[11px] ${
                  isHidden ? 'border-destructive/30 bg-destructive/5' : 'hover:brightness-125'
                }`}
                style={!isHidden ? { borderColor: `${r.color}50`, backgroundColor: `${r.color}20` } : undefined}
              >
                <StateBox checked={isHidden} onClick={() => toggleRarity(r.value)} variant="green" />
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: r.color }} />
                <span style={!isHidden ? { color: r.color } : undefined} className={isHidden ? 'text-destructive line-through' : ''}>{r.label}</span>
                {isHidden && <EyeOff className="h-3 w-3 text-destructive ml-auto" />}
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-baseline gap-2 mb-2 shrink-0">
          <p className="text-xs font-semibold text-foreground">Item Category</p>
          <p className="text-[11px] text-muted-foreground">Block specific item categories or attribute combinations.</p>
        </div>

        <div
          className="grid grid-cols-2 gap-1 flex-1 min-h-0"
          style={{ gridTemplateRows: `repeat(${Math.ceil(ITEM_CATEGORIES.length / 2)}, minmax(0, 1fr))` }}
        >
          {ITEM_CATEGORIES.map(cat => {
            const isHidden = filters.hiddenCategories.has(cat.value);
            const Icon = CATEGORY_ICONS[cat.value];
            return (
              <label
                key={cat.value}
                data-filter-key={`cat-${cat.value}`}
                className={`flex items-center gap-1.5 px-2 rounded-md border cursor-pointer transition-colors text-[11px] ${
                  isHidden ? 'border-destructive/30 bg-destructive/5' : 'hover:brightness-125'
                }`}
                style={!isHidden ? { borderColor: `${cat.color}50`, backgroundColor: `${cat.color}20` } : undefined}
              >
                {cat.value === 'stattrak' || cat.value === 'souvenir' ? (
                  <StateBox checked={isHidden} onClick={() => toggleCategory(cat.value)} variant="tint" tintColor={cat.color} />
                ) : (
                  <StateBox checked={isHidden} onClick={() => toggleCategory(cat.value)} variant="green" />
                )}
                {Icon && (
                  <Icon
                    className="h-3.5 w-3.5 flex-shrink-0"
                    {...(!isHidden ? { style: { color: cat.color } } : {})}
                  />
                )}
                <span style={!isHidden ? { color: cat.color } : undefined} className={isHidden ? 'text-destructive line-through' : ''}>{cat.label}</span>
                {isHidden && <EyeOff className="h-3 w-3 text-destructive ml-auto" />}
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
};
