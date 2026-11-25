import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Bookmark, Plus, Trash2, Check } from "lucide-react";
import { MonitorFilters } from "./monitorFilterTypes";
import { MonitorPreset, loadCustomPresets, saveCustomPresets } from "./monitorPresets";

interface Props {
  filters: MonitorFilters;
  onApply: (f: MonitorFilters) => void;
}

export const PresetsBar = ({ filters, onApply }: Props) => {
  const [customPresets, setCustomPresets] = useState<MonitorPreset[]>(() => loadCustomPresets());
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const newPreset: MonitorPreset = {
      id: `preset-${Date.now()}`,
      name: trimmed,
      filters: { ...filters,
        hiddenWeaponTypes: new Set(filters.hiddenWeaponTypes),
        hiddenRarities: new Set(filters.hiddenRarities),
        hiddenCategories: new Set(filters.hiddenCategories),
        hiddenWearTiers: new Set(filters.hiddenWearTiers),
        keywords: [...filters.keywords],
      },
    };
    const next = [...customPresets, newPreset];
    setCustomPresets(next);
    saveCustomPresets(next);
    setName("");
    setSaveOpen(false);
  };

  const handleDelete = (id: string) => {
    const next = customPresets.filter(p => p.id !== id);
    setCustomPresets(next);
    saveCustomPresets(next);
  };

  return (
    <>
      <div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Bookmark className="h-2.5 w-2.5" /> My presets
            </p>
            <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setSaveOpen(true)}>
              <Plus className="h-3 w-3 mr-0.5" /> Save current
            </Button>
          </div>
          {customPresets.length === 0 ? (
            <p className="text-[10px] text-muted-foreground text-center py-2 border border-dashed border-border/40 rounded-md">
              No saved presets yet
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {customPresets.map(p => (
                <div key={p.id} className="inline-flex items-center rounded-md border border-primary/30 bg-primary/5 overflow-hidden">
                  <button
                    onClick={() => onApply({ ...p.filters,
                      hiddenWeaponTypes: new Set(p.filters.hiddenWeaponTypes),
                      hiddenRarities: new Set(p.filters.hiddenRarities),
                      hiddenCategories: new Set(p.filters.hiddenCategories),
                      hiddenWearTiers: new Set(p.filters.hiddenWearTiers),
                      keywords: [...p.filters.keywords],
                    })}
                    className="px-2.5 py-1 text-[11px] hover:bg-primary/10 transition-colors"
                  >
                    {p.name}
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="px-1.5 py-1 border-l border-primary/30 hover:bg-destructive/15 hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Save preset</DialogTitle>
          </DialogHeader>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Preset name"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!name.trim()}>
              <Check className="h-4 w-4 mr-1" /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
