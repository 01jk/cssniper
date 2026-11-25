import { useState } from "react";
import { Frame as FrameIcon, Square, Sparkles, Save, RotateCcw, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface FramePreset {
  id: string;
  name: string;
  borderWidth: number;     // px
  borderColor: string;     // hex
  glowIntensity: number;   // 0-100
  glowColor: string;       // hex
  cornerRadius: number;    // px
  innerPadding: number;    // px
  accentEnabled: boolean;
  accentColor: string;     // hex
}

const DEFAULT_PRESET: FramePreset = {
  id: "default",
  name: "New Frame",
  borderWidth: 2,
  borderColor: "#7c3aed",
  glowIntensity: 40,
  glowColor: "#7c3aed",
  cornerRadius: 8,
  innerPadding: 4,
  accentEnabled: true,
  accentColor: "#22d3ee",
};

export const FrameDesignerPage = () => {
  const [presets, setPresets] = useState<FramePreset[]>([{ ...DEFAULT_PRESET, id: crypto.randomUUID() }]);
  const [selectedId, setSelectedId] = useState<string>(presets[0].id);
  const selected = presets.find(p => p.id === selectedId) || presets[0];

  const update = (changes: Partial<FramePreset>) => {
    setPresets(presets.map(p => p.id === selectedId ? { ...p, ...changes } : p));
  };

  const addPreset = () => {
    const np = { ...DEFAULT_PRESET, id: crypto.randomUUID(), name: `Frame ${presets.length + 1}` };
    setPresets([...presets, np]);
    setSelectedId(np.id);
  };

  const removePreset = (id: string) => {
    if (presets.length <= 1) return;
    const next = presets.filter(p => p.id !== id);
    setPresets(next);
    if (selectedId === id) setSelectedId(next[0].id);
  };

  const reset = () => update({ ...DEFAULT_PRESET, id: selected.id, name: selected.name });

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Sidebar: presets */}
      <div className="w-[220px] border-r border-border/30 flex flex-col">
        <div className="flex items-center justify-between px-2.5 py-2 border-b border-border/30">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Frames</span>
          <button
            onClick={addPreset}
            className="h-5 w-5 inline-flex items-center justify-center rounded-sm hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
            title="New frame"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
          {presets.map(p => (
            <div
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className={cn(
                "group flex items-center justify-between gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors border",
                selectedId === p.id
                  ? "bg-primary/10 border-primary/30 text-foreground"
                  : "border-transparent hover:bg-muted/40 text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="h-4 w-4 rounded-sm shrink-0 border"
                  style={{
                    borderColor: p.borderColor,
                    borderWidth: Math.max(1, p.borderWidth / 2),
                    boxShadow: `0 0 6px ${p.glowColor}${Math.round((p.glowIntensity / 100) * 255).toString(16).padStart(2, '0')}`,
                  }}
                />
                <span className="text-xs truncate">{p.name}</span>
              </div>
              {presets.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); removePreset(p.id); }}
                  className="opacity-0 group-hover:opacity-100 h-4 w-4 inline-flex items-center justify-center rounded-sm hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Editor + preview */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-md bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <FrameIcon className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <Input
                  value={selected.name}
                  onChange={(e) => update({ name: e.target.value })}
                  className="h-7 text-sm font-semibold bg-transparent border-transparent hover:border-border/50 focus:border-border focus-visible:ring-0 px-1.5 w-[260px]"
                />
                <p className="text-[10px] text-muted-foreground px-1.5">Custom frame for Live Scanner cards</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" onClick={reset} className="h-7 text-xs">
                <RotateCcw className="h-3 w-3 mr-1" /> Reset
              </Button>
              <Button size="sm" className="h-7 text-xs">
                <Save className="h-3 w-3 mr-1" /> Save
              </Button>
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-lg border border-border/40 bg-background/50 p-6">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-3 flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Live preview
            </div>
            <div className="flex items-center justify-center py-6">
              <div
                className="relative"
                style={{
                  padding: selected.innerPadding,
                  borderRadius: selected.cornerRadius,
                  border: `${selected.borderWidth}px solid ${selected.borderColor}`,
                  boxShadow: `0 0 ${selected.glowIntensity * 0.6}px ${selected.glowColor}${Math.round((selected.glowIntensity / 100) * 200).toString(16).padStart(2, '0')}`,
                }}
              >
                {selected.accentEnabled && (
                  <div
                    className="absolute -top-1 -left-1 h-3 w-3 rounded-sm"
                    style={{ background: selected.accentColor, boxShadow: `0 0 8px ${selected.accentColor}` }}
                  />
                )}
                <div
                  className="w-[200px] h-[140px] rounded-md bg-gradient-to-br from-card to-background flex items-center justify-center"
                  style={{ borderRadius: Math.max(0, selected.cornerRadius - 2) }}
                >
                  <div className="text-center">
                    <Square className="h-8 w-8 mx-auto text-muted-foreground/30 mb-1" />
                    <p className="text-[10px] text-muted-foreground">Item Card</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ControlGroup title="Border">
              <SliderRow label="Width" value={selected.borderWidth} min={0} max={8} step={1} onChange={(v) => update({ borderWidth: v })} suffix="px" />
              <ColorRow label="Color" value={selected.borderColor} onChange={(v) => update({ borderColor: v })} />
              <SliderRow label="Radius" value={selected.cornerRadius} min={0} max={24} step={1} onChange={(v) => update({ cornerRadius: v })} suffix="px" />
              <SliderRow label="Padding" value={selected.innerPadding} min={0} max={16} step={1} onChange={(v) => update({ innerPadding: v })} suffix="px" />
            </ControlGroup>

            <ControlGroup title="Glow & Accent">
              <SliderRow label="Glow" value={selected.glowIntensity} min={0} max={100} step={1} onChange={(v) => update({ glowIntensity: v })} suffix="%" />
              <ColorRow label="Glow Color" value={selected.glowColor} onChange={(v) => update({ glowColor: v })} />
              <div className="flex items-center justify-between gap-2 py-1">
                <Label className="text-xs text-muted-foreground">Corner accent</Label>
                <button
                  onClick={() => update({ accentEnabled: !selected.accentEnabled })}
                  className={cn(
                    "h-5 w-9 rounded-full transition-colors relative",
                    selected.accentEnabled ? "bg-primary" : "bg-muted"
                  )}
                >
                  <div className={cn(
                    "absolute top-0.5 h-4 w-4 rounded-full bg-background transition-transform",
                    selected.accentEnabled ? "translate-x-4" : "translate-x-0.5"
                  )} />
                </button>
              </div>
              <ColorRow label="Accent" value={selected.accentColor} onChange={(v) => update({ accentColor: v })} disabled={!selected.accentEnabled} />
            </ControlGroup>
          </div>

          <div className="text-[10px] text-muted-foreground/60 text-center py-2">
            Saved frames will be selectable per item in the Live Scanner.
          </div>
        </div>
      </div>
    </div>
  );
};

const ControlGroup = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-lg border border-border/40 bg-card/30 p-3">
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">{title}</div>
    <div className="space-y-2.5">{children}</div>
  </div>
);

const SliderRow = ({
  label, value, min, max, step, onChange, suffix,
}: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; suffix?: string }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-mono tabular-nums text-[11px]">{value}{suffix}</span>
    </div>
    <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} />
  </div>
);

const ColorRow = ({
  label, value, onChange, disabled,
}: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) => (
  <div className={cn("flex items-center justify-between gap-2", disabled && "opacity-40 pointer-events-none")}>
    <Label className="text-xs text-muted-foreground">{label}</Label>
    <div className="flex items-center gap-1.5">
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 w-[80px] text-[11px] font-mono bg-background/40 border-border/40 px-1.5"
      />
      <label className="relative h-6 w-6 rounded-md border border-border/40 cursor-pointer overflow-hidden" style={{ background: value }}>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </label>
    </div>
  </div>
);
