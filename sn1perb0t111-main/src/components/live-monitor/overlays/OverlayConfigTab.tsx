import React, { useState, useRef, useMemo, useCallback, useEffect } from "react";
import type { OverlayConfigActions } from "./OverlaysShell";
const dragonLoreImg = "https://community.akamai.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTkDZ1yhkpqPJjKlXod0LjElFN9Cf30ykYdU4tf_IydTMBH1d_S0oURCw5nYgAd4-r9fV817OXJcWpKu461zNDax6D2MejVxDwD6sclieqXrIr2jFfgqBc9YTz0dYSXegY6aVDW_FK7le_v1JW0us7My3BksnZ053iInhy1hAYaaeNu0aSPVxuxpW40w1I";
import { Plus, Trash2, Upload, Image, ChevronDown, ChevronRight, X, Layers, Search, Check, GripVertical, Copy, ListPlus, Minus, Move, RotateCcw, Eye, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { SkinOverlay, PatternTier, saveOverlays } from "./overlayTypes";
import { cn } from "@/lib/utils";
import {
  KarambitIcon,
  SportGlovesIcon,
  AK47Icon,
  DesertEagleIcon,
  UMP45Icon,
  SawedOffIcon,
  NegevIcon,
  TitanStickerIcon,
  CS2CharmIcon,
  AgentDarrylIcon,
} from "@/components/filters/CS2CategoryIconsRef";
import type { ElementType } from "react";

interface OverlayConfigTabProps {
  overlays: SkinOverlay[];
  onOverlaysChange: (overlays: SkinOverlay[]) => void;
  panelMode?: 'search' | 'browse' | 'add';
  onPanelModeChange?: (m: 'search' | 'browse' | 'add') => void;
  hidePanelModeTabs?: boolean;
  searchQuery?: string;
  onSearchQueryChange?: (q: string) => void;
  actionsRef?: React.MutableRefObject<OverlayConfigActions | null>;
}

const genId = () => crypto.randomUUID?.() || Math.random().toString(36).slice(2, 10);

/* ── Overlay number font options ── */
const OVERLAY_FONTS: { id: string; label: string; family: string }[] = [
  { id: 'sans',       label: 'Sans',       family: 'ui-sans-serif, system-ui, sans-serif' },
  { id: 'serif',      label: 'Serif',      family: 'ui-serif, Georgia, serif' },
  { id: 'mono',       label: 'Mono',       family: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
  { id: 'rounded',    label: 'Rounded',    family: '"SF Pro Rounded", "Nunito", system-ui, sans-serif' },
  { id: 'condensed',  label: 'Condensed',  family: '"Arial Narrow", "Roboto Condensed", sans-serif' },
  { id: 'impact',     label: 'Impact',     family: 'Impact, "Haettenschweiler", "Arial Black", sans-serif' },
  { id: 'display',    label: 'Display',    family: '"Bebas Neue", "Oswald", Impact, sans-serif' },
  { id: 'handwriting',label: 'Handwriting',family: '"Comic Sans MS", "Marker Felt", cursive' },
];
const DEFAULT_FONT_ID = 'sans';
const fontFamilyFor = (id?: string) => OVERLAY_FONTS.find(f => f.id === id)?.family ?? OVERLAY_FONTS[0].family;

/* ── Category data ── */
type CS2Icon = ElementType<{ size?: number; className?: string }>;
const ITEM_CATEGORIES: { id: string; label: string; icon: CS2Icon }[] = [
  { id: "knives", label: "Knives", icon: KarambitIcon },
  { id: "gloves", label: "Gloves", icon: SportGlovesIcon },
  { id: "rifles", label: "Rifles", icon: AK47Icon },
  { id: "pistols", label: "Pistols", icon: DesertEagleIcon },
  { id: "smgs", label: "SMGs", icon: UMP45Icon },
  { id: "shotguns", label: "Shotguns", icon: SawedOffIcon },
  { id: "machineguns", label: "Machineguns", icon: NegevIcon },
  { id: "stickers", label: "Stickers", icon: TitanStickerIcon },
  { id: "charm", label: "Charms", icon: CS2CharmIcon },
  { id: "agent", label: "Agents", icon: AgentDarrylIcon },
];

const MOCK_ITEMS = [
  { name: "AK-47 | Asiimov", type: "rifles" },
  { name: "AK-47 | Redline", type: "rifles" },
  { name: "AK-47 | Vulcan", type: "rifles" },
  { name: "AK-47 | Fire Serpent", type: "rifles" },
  { name: "AK-47 | Case Hardened", type: "rifles" },
  { name: "M4A4 | Howl", type: "rifles" },
  { name: "M4A4 | Asiimov", type: "rifles" },
  { name: "AWP | Dragon Lore", type: "rifles" },
  { name: "AWP | Asiimov", type: "rifles" },
  { name: "AWP | Medusa", type: "rifles" },
  { name: "Desert Eagle | Blaze", type: "pistols" },
  { name: "Desert Eagle | Kumicho Dragon", type: "pistols" },
  { name: "USP-S | Kill Confirmed", type: "pistols" },
  { name: "Glock-18 | Fade", type: "pistols" },
  { name: "Karambit | Doppler", type: "knives" },
  { name: "Karambit | Fade", type: "knives" },
  { name: "Karambit | Case Hardened", type: "knives" },
  { name: "M9 Bayonet | Crimson Web", type: "knives" },
  { name: "Butterfly Knife | Fade", type: "knives" },
  { name: "Sport Gloves | Pandora's Box", type: "gloves" },
  { name: "Sport Gloves | Crimson Kimono", type: "gloves" },
  { name: "Driver Gloves | King Snake", type: "gloves" },
  { name: "MAC-10 | Neon Rider", type: "smgs" },
  { name: "MP9 | Hypnotic", type: "smgs" },
  { name: "Nova | Antique", type: "shotguns" },
  { name: "M249 | Nebula Crusader", type: "machineguns" },
];

/* ── Tier Editor ── */
const TierEditor = ({ tier, onUpdate, onDelete, firstTierImage, onCloneNote, onToggleTier }: {
  tier: PatternTier;
  onUpdate: (t: PatternTier) => void;
  onDelete: () => void;
  firstTierImage?: string;
  onCloneNote?: () => void;
  onToggleTier?: () => void;
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [seedInput, setSeedInput] = useState("");
  const [expanded, setExpanded] = useState(true);
  const [massAddOpen, setMassAddOpen] = useState(false);
  const [massAddText, setMassAddText] = useState("");

  useEffect(() => {
    const onCollapse = () => setExpanded(false);
    window.addEventListener('overlays:collapse-all', onCollapse);
    return () => window.removeEventListener('overlays:collapse-all', onCollapse);
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onUpdate({ ...tier, imageDataUrl: reader.result as string });
    reader.readAsDataURL(file);
  };

  const addSeeds = () => {
    const raw = seedInput.trim();
    if (!raw) return;
    const newSeeds = raw.split(/[\s,;]+/).map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n >= 0 && n <= 1000).filter(n => !tier.paintSeeds.includes(n));
    if (newSeeds.length > 0) onUpdate({ ...tier, paintSeeds: [...tier.paintSeeds, ...newSeeds].sort((a, b) => a - b) });
    setSeedInput("");
  };

  const processMassAdd = () => {
    const raw = massAddText.trim();
    if (!raw) return;
    let parsed: number[] = [];
    try { parsed = JSON.parse(raw); if (!Array.isArray(parsed)) parsed = []; } catch { /* not JSON */ }
    if (parsed.length === 0) parsed = raw.split(/[\s,;\n\r]+/).map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    const valid = parsed.filter(n => n >= 0 && n <= 1000).filter(n => !tier.paintSeeds.includes(n));
    if (valid.length > 0) onUpdate({ ...tier, paintSeeds: [...tier.paintSeeds, ...valid].sort((a, b) => a - b) });
    setMassAddText("");
    setMassAddOpen(false);
  };

  const toggleExpanded = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleTier?.();
    setExpanded(prev => !prev);
  };

  return (
    <div className="border border-border/40 rounded-md bg-card/50 overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-2 hover:bg-muted/30 transition-colors">
        <button
          type="button"
          onClick={toggleExpanded}
          className="flex items-center gap-1.5 shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/60"
          aria-expanded={expanded}
          aria-label={expanded ? `Collapse ${tier.name}` : `Expand ${tier.name}`}
        >
          {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
          {tier.imageDataUrl ? (
            <img src={tier.imageDataUrl} alt={tier.name} className="h-5 w-5 object-contain shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]" />
          ) : (
            <Image className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
        </button>
        <Input value={tier.name} onChange={e => { e.stopPropagation(); onUpdate({ ...tier, name: e.target.value }); }} onClick={e => e.stopPropagation()} className="h-6 text-[11px] bg-transparent border-none px-1 w-[80px] shrink-0 focus-visible:ring-1 font-medium text-center" placeholder="Tier..." />
        <Input value={tier.note ?? ''} onChange={e => { e.stopPropagation(); onUpdate({ ...tier, note: e.target.value }); }} onClick={e => e.stopPropagation()} className="h-6 text-[10px] bg-transparent border-none px-1 flex-1 min-w-0 text-muted-foreground focus-visible:ring-1 italic placeholder:not-italic" placeholder="Note..." maxLength={40} />
        {onCloneNote && tier.note && tier.note.trim() && (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-5 w-5 text-primary/60 hover:text-primary shrink-0" onClick={e => { e.stopPropagation(); onCloneNote(); }}><Copy className="h-2.5 w-2.5" /></Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px]">Clone note to all tiers</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <Badge variant="secondary" className="text-[9px] h-4 px-1.5 shrink-0">{tier.paintSeeds.length} seeds</Badge>
        <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive/60 hover:text-destructive shrink-0" onClick={e => { e.stopPropagation(); onDelete(); }}><Trash2 className="h-3 w-3" /></Button>
      </div>
      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-2 border-t border-border/20" onClick={e => e.stopPropagation()}>
          {/* Upload + Overlay # + Preview + Joystick — all in one row */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={handleImageUpload} />
            {/* Overlay # + Font picker — gold trigger opens combined popover */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="h-7 w-7 inline-flex items-center justify-center rounded-md bg-[#3d3520] text-[#c9a84c] border border-[#6b5a2e]/50 font-bold text-[11px] metallic-shimmer-subtle hover:bg-[#4a401f] hover:border-[#8a7437]/70 transition-colors shrink-0"
                  title="Tier number & font"
                  style={{ fontFamily: tier.overlayNumber != null ? fontFamilyFor(tier.overlayFontFamily) : undefined }}
                >
                  {tier.overlayNumber != null ? tier.overlayNumber : '—'}
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[280px] p-0 bg-card border-[#6b5a2e]/40 shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
                align="start"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-3 py-2 border-b border-[#6b5a2e]/30 bg-gradient-to-r from-[#3d3520]/40 via-[#3d3520]/20 to-transparent">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#c9a84c]">Tier Marker</span>
                  <span className="text-[9px] font-mono text-muted-foreground">
                    {tier.overlayNumber != null ? `#${tier.overlayNumber}` : 'OFF'}
                    {tier.overlayNumber != null && ` · ${OVERLAY_FONTS.find(f => f.id === (tier.overlayFontFamily ?? DEFAULT_FONT_ID))?.label}`}
                  </span>
                </div>

                <div className="px-3 pt-2.5 pb-2 space-y-1.5">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Number</div>
                  <div className="grid grid-cols-6 gap-1">
                    <button
                      type="button"
                      onClick={() => onUpdate({ ...tier, overlayNumber: null })}
                      className={cn(
                        "h-7 rounded border text-[10px] font-bold transition-all",
                        tier.overlayNumber == null
                          ? "border-[#c9a84c]/70 bg-[#3d3520]/60 text-[#c9a84c] shadow-[0_0_6px_rgba(201,168,76,0.25)]"
                          : "border-border/40 bg-background/40 text-muted-foreground hover:border-border/70 hover:text-foreground"
                      )}
                    >
                      —
                    </button>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
                      const active = tier.overlayNumber === n;
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => onUpdate({ ...tier, overlayNumber: n })}
                          className={cn(
                            "h-7 rounded border text-[11px] font-bold transition-all tabular-nums",
                            active
                              ? "border-[#c9a84c]/70 bg-[#3d3520]/60 text-[#c9a84c] shadow-[0_0_6px_rgba(201,168,76,0.25)]"
                              : "border-border/40 bg-background/40 text-foreground/80 hover:border-[#6b5a2e]/60 hover:text-[#c9a84c]"
                          )}
                          style={{ fontFamily: fontFamilyFor(tier.overlayFontFamily) }}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {tier.overlayNumber != null && (
                  <div className="px-3 pt-1 pb-3 space-y-1.5 border-t border-border/20">
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold pt-2">Font Style</div>
                    <div className="grid grid-cols-4 gap-1">
                      {OVERLAY_FONTS.map(f => {
                        const active = (tier.overlayFontFamily ?? DEFAULT_FONT_ID) === f.id;
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => onUpdate({ ...tier, overlayFontFamily: f.id })}
                            className={cn(
                              "group flex flex-col items-center justify-center gap-0.5 h-12 rounded border transition-all",
                              active
                                ? "border-[#c9a84c]/70 bg-[#3d3520]/50 shadow-[0_0_6px_rgba(201,168,76,0.2)]"
                                : "border-border/40 bg-background/40 hover:border-[#6b5a2e]/60 hover:bg-background/60"
                            )}
                            title={f.label}
                          >
                            <span
                              className={cn(
                                "font-extrabold leading-none transition-colors",
                                active ? "text-[#c9a84c]" : "text-foreground/85 group-hover:text-[#c9a84c]"
                              )}
                              style={{ fontFamily: f.family, fontSize: '16px' }}
                            >
                              {tier.overlayNumber}
                            </span>
                            <span
                              className={cn(
                                "text-[8.5px] uppercase tracking-wider leading-none transition-colors",
                                active ? "text-[#c9a84c]/80" : "text-muted-foreground/70 group-hover:text-muted-foreground"
                              )}
                            >
                              {f.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={() => fileRef.current?.click()}><Upload className="h-3 w-3" />{tier.imageDataUrl ? 'Change' : 'Upload PNG'}</Button>
            {firstTierImage && !tier.imageDataUrl && (
              <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 text-primary border-primary/30 hover:bg-primary/10" onClick={() => onUpdate({ ...tier, imageDataUrl: firstTierImage })}><Copy className="h-3 w-3" />Clone Icon</Button>
            )}
            {tier.imageDataUrl && (
              <>
                <div className="relative h-8 w-8 rounded border border-border/30 bg-background/50 overflow-hidden shrink-0">
                  <img src={tier.imageDataUrl} alt="" className="h-8 w-8 object-contain" />
                  {tier.overlayNumber != null && (<span className="absolute inset-0 flex items-center justify-center font-extrabold drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]" style={{ fontFamily: fontFamilyFor(tier.overlayFontFamily), fontSize: `${14 * (1 + (tier.overlaySize ?? 0) / 100)}px`, color: tier.overlayColor ?? '#ffffff', WebkitTextStroke: '0.5px rgba(0,0,0,0.5)', transform: `translate(${(tier.overlayOffsetX ?? 0) * 1.6}px, ${(tier.overlayOffsetY ?? 0) * 1.6}px)` }}>{tier.overlayNumber}</span>)}
                </div>
                <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive shrink-0" onClick={() => onUpdate({ ...tier, imageDataUrl: '' })}><X className="h-3 w-3" /></Button>
              </>
            )}
            {tier.overlayNumber != null && (
              <>
                <div className="h-5 w-px bg-border/30" />
                {/* Mini joystick */}
                <div className="relative h-[28px] w-[28px] shrink-0 rounded border border-border/30 bg-muted/20">
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="h-0.5 w-0.5 rounded-full bg-muted-foreground/30" />
                  </div>
                  <button className="absolute top-0 left-1/2 -translate-x-1/2 h-[8px] w-[12px] flex items-center justify-center rounded-t-sm hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors" onClick={() => onUpdate({ ...tier, overlayOffsetY: (tier.overlayOffsetY ?? 0) - 1 })}>
                    <ChevronDown className="h-2 w-2 rotate-180" />
                  </button>
                  <button className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[8px] w-[12px] flex items-center justify-center rounded-b-sm hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors" onClick={() => onUpdate({ ...tier, overlayOffsetY: (tier.overlayOffsetY ?? 0) + 1 })}>
                    <ChevronDown className="h-2 w-2" />
                  </button>
                  <button className="absolute left-0 top-1/2 -translate-y-1/2 w-[8px] h-[12px] flex items-center justify-center rounded-l-sm hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors" onClick={() => onUpdate({ ...tier, overlayOffsetX: (tier.overlayOffsetX ?? 0) - 1 })}>
                    <ChevronRight className="h-2 w-2 rotate-180" />
                  </button>
                  <button className="absolute right-0 top-1/2 -translate-y-1/2 w-[8px] h-[12px] flex items-center justify-center rounded-r-sm hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors" onClick={() => onUpdate({ ...tier, overlayOffsetX: (tier.overlayOffsetX ?? 0) + 1 })}>
                    <ChevronRight className="h-2 w-2" />
                  </button>
                </div>
                {((tier.overlayOffsetX ?? 0) !== 0 || (tier.overlayOffsetY ?? 0) !== 0) && (
                  <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 text-muted-foreground hover:text-foreground" onClick={() => onUpdate({ ...tier, overlayOffsetX: 0, overlayOffsetY: 0 })} title="Reset position">
                    <RotateCcw className="h-2.5 w-2.5" />
                  </Button>
                )}
              </>
            )}
          </div>
          {/* Size & Color row — shown when overlay # is set */}
          {tier.overlayNumber != null && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-muted-foreground shrink-0">Size:</span>
              <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => onUpdate({ ...tier, overlaySize: Math.max(-20, (tier.overlaySize ?? 0) - 5) })}><Minus className="h-2.5 w-2.5" /></Button>
              <span className="text-[10px] font-mono w-[36px] text-center tabular-nums">{(tier.overlaySize ?? 0) > 0 ? '+' : ''}{tier.overlaySize ?? 0}%</span>
              <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => onUpdate({ ...tier, overlaySize: Math.min(20, (tier.overlaySize ?? 0) + 5) })}><Plus className="h-2.5 w-2.5" /></Button>
              <div className="h-4 w-px bg-border/40 mx-1" />
              <span className="text-[9px] text-muted-foreground shrink-0">Color:</span>
              <div className="flex items-center gap-1">
                <div className="flex items-center gap-0.5 mr-1">
                  <span className="text-[9px] text-muted-foreground">#</span>
                  <input
                    type="text"
                    value={(tier.overlayColor ?? '#ffffff').replace('#', '')}
                    onChange={e => {
                      const val = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
                      if (val.length <= 6) onUpdate({ ...tier, overlayColor: `#${val}` });
                    }}
                    className="h-5 w-[52px] text-[10px] font-mono bg-background/50 border border-border/30 rounded px-1 text-foreground focus:outline-none focus:ring-1 focus:ring-ring/50 uppercase"
                    placeholder="FFFFFF"
                    maxLength={6}
                  />
                </div>
                <div className="flex items-center gap-0.5">
                  {['#ffffff', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#06b6d4', '#000000'].map(color => (
                    <button
                      key={color}
                      className={cn(
                        "h-4 w-4 rounded-full border transition-all shrink-0",
                        (tier.overlayColor ?? '#ffffff') === color ? 'border-foreground scale-110 ring-1 ring-foreground/50' : 'border-border/50 hover:scale-110'
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() => onUpdate({ ...tier, overlayColor: color })}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <div className="flex items-center">
              <span className="text-[10px] text-muted-foreground font-medium">Paint Seeds</span>
            </div>
            <div className="flex items-center gap-1">
              <Input value={seedInput} onChange={e => setSeedInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSeeds(); } }} placeholder="661, 321..." className="h-7 text-[10px] flex-1" />
              <Button variant="secondary" size="sm" className={cn("h-7 text-[10px] px-2.5 shrink-0 transition-all duration-200", seedInput.trim() ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_8px_hsl(var(--primary)/0.4)]" : "")} onClick={addSeeds}>
                <Plus className="h-3 w-3" />
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-[10px] px-2 gap-1 shrink-0 border-accent/30 text-accent hover:bg-accent/10" onClick={() => setMassAddOpen(true)}>
                <ListPlus className="h-3 w-3" />Mass Add
              </Button>
            </div>
            {tier.paintSeeds.length > 0 && (
              <div className="flex flex-wrap gap-1 max-h-[44px] overflow-y-auto">
                {tier.paintSeeds.map((seed, index) => (
                  <Badge key={`${seed}-${index}`} variant="outline" className="h-5 px-1.5 text-[9px] font-mono gap-0.5 cursor-pointer hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40 transition-colors" onClick={() => onUpdate({ ...tier, paintSeeds: tier.paintSeeds.filter(s => s !== seed) })}>{seed}<X className="h-2 w-2" /></Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mass Add Dialog */}
      <Dialog open={massAddOpen} onOpenChange={setMassAddOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border" onClick={e => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="text-foreground text-sm">Mass Add Seeds</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-[11px] text-muted-foreground">
              Paste seeds in any format: comma-separated, space-separated, newline-separated, or JSON array.
            </p>
            <Textarea
              placeholder={"123, 456, 789\nor\n[123, 456, 789]\nor\n123\n456\n789"}
              value={massAddText}
              onChange={e => setMassAddText(e.target.value)}
              className="min-h-[120px] bg-input border-border font-mono text-xs"
            />
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
                input.onchange = (ev) => {
                  const file = (ev.target as HTMLInputElement).files?.[0];
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
              className="border-destructive/50 text-destructive hover:bg-destructive/15 hover:border-destructive text-xs"
              onClick={() => setMassAddOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={processMassAdd}
              className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs"
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ── Skin List Item (left panel) ── */
const SkinListItem = ({ overlay, isSelected, onClick, onToggle, onDelete, onPreview, onNavigateToTier, onDragStart, onDragOver, onDrop, onDragEnd }: {
  overlay: SkinOverlay; isSelected: boolean; onClick: () => void;
  onToggle: (val: boolean) => void; onDelete: () => void; onPreview: () => void;
  onNavigateToTier: (tierId: string) => void;
  onDragStart: () => void; onDragOver: (e: React.DragEvent) => void; onDrop: () => void; onDragEnd: () => void;
}) => {
  const totalSeeds = overlay.tiers.reduce((sum, t) => sum + t.paintSeeds.length, 0);
  const previewImg = overlay.tiers.find(t => t.imageDataUrl)?.imageDataUrl;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDelete) {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      setConfirmDelete(false);
      onDelete();
    } else {
      setConfirmDelete(true);
      confirmTimer.current = setTimeout(() => setConfirmDelete(false), 2500);
    }
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`flex items-center gap-1.5 px-1.5 py-1.5 cursor-pointer rounded-md transition-colors border ${isSelected ? 'bg-primary/10 border-primary/30 text-foreground' : 'bg-transparent border-transparent hover:bg-muted/30 text-muted-foreground hover:text-foreground'}`}
      onClick={onClick}
    >
      {previewImg ? (
        <img src={previewImg} alt="" className="h-6 w-6 object-contain rounded shrink-0" />
      ) : (
        <div className="h-6 w-6 rounded bg-muted/30 flex items-center justify-center shrink-0"><Layers className="h-3 w-3 text-muted-foreground/50" /></div>
      )}
      <div className="flex-1 min-w-0">
        <p className={`text-[11px] font-medium truncate ${isSelected ? 'text-foreground' : ''}`}>{overlay.skinName || 'Unnamed Skin'}</p>
        <p className="text-[9px] text-muted-foreground">{overlay.tiers.length} tiers • {totalSeeds} seeds</p>
      </div>
      {(() => {
        const tiersWithIcon = overlay.tiers.filter(t => t.imageDataUrl);
        if (tiersWithIcon.length === 0) return null;
        const maxShow = 5;
        const visible = tiersWithIcon.slice(0, maxShow);
        const overflow = tiersWithIcon.length - maxShow;
        return (
          <Popover>
            <div className="flex items-center -space-x-0.5 shrink-0">
              {overflow > 0 && (
                <PopoverTrigger asChild>
                  <button className="h-5 min-w-5 px-1 shrink-0 rounded-full bg-white/10 text-[8px] text-white/60 font-bold flex items-center justify-center hover:bg-white/20 hover:text-white/80 cursor-pointer mr-1 border border-white/15 transition-colors" onClick={e => e.stopPropagation()}>
                    +{overflow}
                  </button>
                </PopoverTrigger>
              )}
              {visible.map(t => (
                <div key={t.id} className="relative h-5 w-5 shrink-0" title={t.name}>
                  <img src={t.imageDataUrl} alt={t.name} className="h-5 w-5 object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
                  {t.overlayNumber != null && (
                    <span className="absolute inset-0 flex items-center justify-center font-extrabold drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]" style={{ fontFamily: fontFamilyFor(t.overlayFontFamily), fontSize: '8px', color: t.overlayColor ?? '#ffffff', WebkitTextStroke: '0.2px rgba(0,0,0,0.5)' }}>{t.overlayNumber}</span>
                  )}
                </div>
              ))}
            </div>
            {overflow > 0 && (
              <PopoverContent side="top" align="center" className="w-auto p-2" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-1 flex-wrap">
                  {tiersWithIcon.map(t => (
                    <button key={t.id} className="relative h-6 w-6 shrink-0 cursor-pointer hover:scale-110 transition-transform rounded-sm hover:ring-1 hover:ring-white/40" title={t.name} onClick={e => { e.stopPropagation(); onNavigateToTier(t.id); }}>
                      <img src={t.imageDataUrl} alt={t.name} className="h-6 w-6 object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
                      {t.overlayNumber != null && (
                        <span className="absolute inset-0 flex items-center justify-center font-extrabold drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]" style={{ fontFamily: fontFamilyFor(t.overlayFontFamily), fontSize: '9px', color: t.overlayColor ?? '#ffffff', WebkitTextStroke: '0.2px rgba(0,0,0,0.5)' }}>{t.overlayNumber}</span>
                      )}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            )}
          </Popover>
        );
      })()}
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 shrink-0 rounded border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary transition-all duration-200 ring-1 ring-primary/20"
        onClick={e => { e.stopPropagation(); onPreview(); }}
      >
        <Eye className="h-3.5 w-3.5" />
      </Button>
      <button
        onClick={e => { e.stopPropagation(); onToggle(!overlay.enabled); }}
        className={cn(
          "h-[18px] px-1.5 rounded text-[9px] font-bold tracking-wider uppercase border transition-all duration-200 shrink-0 leading-none",
          overlay.enabled
            ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.15)] hover:bg-emerald-500/25"
            : "bg-red-500/10 border-red-500/30 text-red-400 shadow-[0_0_6px_rgba(248,113,113,0.1)] hover:bg-red-500/20"
        )}
      >
        {overlay.enabled ? 'ON' : 'OFF'}
      </button>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-5 w-5 shrink-0 rounded border transition-all duration-200 ring-1",
          confirmDelete
            ? "border-destructive/50 bg-destructive/20 text-destructive hover:bg-destructive/30 ring-destructive/30 shadow-[0_0_6px_rgba(248,113,113,0.15)]"
            : "border-destructive/30 bg-destructive/10 text-destructive/70 hover:bg-destructive/20 hover:text-destructive ring-destructive/20"
        )}
        onClick={handleDeleteClick}
      >
        {confirmDelete ? <Check className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
};

/* ── Add Skin Dialog ── */
const AddSkinDialog = ({ open, onOpenChange, onConfirm, initialSearch = "" }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (skinName: string) => void;
  initialSearch?: string;
}) => {
  const [search, setSearch] = useState(initialSearch);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [pendingItem, setPendingItem] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(!!initialSearch);
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  // Sync when reopened with a new initial query
  React.useEffect(() => {
    if (open) {
      setSearch(initialSearch);
      setShowResults(!!initialSearch);
      setSelectedCategory(null);
      setPendingItem(null);
    }
  }, [open, initialSearch]);

  const filteredItems = useMemo(() => {
    if (!selectedCategory && !search.trim()) return [];
    let items = MOCK_ITEMS;
    if (selectedCategory) items = items.filter(i => i.type === selectedCategory);
    if (search.trim()) items = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
    return items;
  }, [search, selectedCategory]);

  const reset = () => {
    setSearch("");
    setSelectedCategory(null);
    setPendingItem(null);
  };

  const handleConfirm = () => {
    if (pendingItem) {
      onConfirm(pendingItem);
      reset();
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleCancel(); else onOpenChange(v); }}>
      <DialogContent className="max-w-[520px] p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-sm">Add Skin Overlay</DialogTitle>
          <DialogDescription className="text-[11px]">
            Select a skin to configure pattern overlays for
          </DialogDescription>
        </DialogHeader>

        {/* Confirmation view */}
        {pendingItem ? (
          <div className="px-5 pb-5 space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <Check className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">{pendingItem}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Will be added to your overlay list</p>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setPendingItem(null)}>Back</Button>
              <Button size="sm" className="h-8 text-xs gap-1" onClick={handleConfirm}>
                <Check className="h-3 w-3" /> Confirm
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-0">
            {/* Search with floating results */}
            <div className="px-5 pb-3 relative z-10" ref={searchWrapperRef}>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={e => { setSearch(e.target.value); setShowResults(true); }}
                  onFocus={() => setShowResults(true)}
                  onKeyDown={e => { if (e.key === 'Enter' && search.trim()) { setPendingItem(search.trim()); setShowResults(false); } }}
                  placeholder="Search items..."
                  className="h-8 text-xs pl-8 pr-16"
                  autoFocus
                />
                {search.trim() && (
                  <Button
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 text-[10px] px-2 gap-1"
                    onClick={() => { setPendingItem(search.trim()); setShowResults(false); }}
                  >
                    <Plus className="h-3 w-3" /> Add
                  </Button>
                )}
              </div>
              {/* Floating results overlay */}
              {showResults && (search.trim() || selectedCategory) && filteredItems.length > 0 && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowResults(false)} />
                  <div className="absolute left-0 right-0 top-full -mt-1 bg-popover border border-border rounded-md shadow-lg z-20 max-h-[220px] overflow-y-auto">
                    <div className="p-1.5">
                      {filteredItems.map((item, i) => (
                        <button
                          key={i}
                          onClick={() => { setPendingItem(item.name); setShowResults(false); }}
                          className="w-full text-left px-3 py-2 text-xs text-foreground/90 hover:bg-muted/40 rounded-md transition-colors"
                        >
                          {item.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Category grid */}
            <div className="px-5 pb-3">
              <div className="grid grid-cols-5 gap-2">
                {ITEM_CATEGORIES.map(cat => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => { const newCat = selectedCategory === cat.id ? null : cat.id; setSelectedCategory(newCat); if (newCat) setShowResults(true); }}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-2.5 rounded-lg transition-all hover:scale-105 border",
                        selectedCategory === cat.id
                          ? "bg-primary/15 border-primary/50 text-primary shadow-[0_0_8px_-2px_hsl(var(--primary)/0.3)]"
                          : "bg-card/60 border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/30 hover:border-primary/30"
                      )}
                    >
                      <Icon size={20} className="block" />
                      <span className="text-[9px] font-medium leading-tight text-center">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

type PreviewBuyState = 'idle' | 'confirm' | 'bought' | 'sold';

const OverlayPreviewCard = ({ overlay, activeTierId, highlightTier, iconScale = 1 }: { overlay: SkinOverlay; activeTierId?: string | null; highlightTier?: boolean; iconScale?: number }) => {
  const activeTier = activeTierId ? overlay.tiers.find(t => t.id === activeTierId) : overlay.tiers.find(t => t.imageDataUrl);
  const mockFloat = 0.00000000010431;
  const mockSeed = activeTier?.paintSeeds[0] ?? overlay.tiers[0]?.paintSeeds[0] ?? 111;
  const [buyState, setBuyState] = useState<PreviewBuyState>('idle');
  const boughtRef = useRef(false);
  
  // Covert rarity colors (red)
  const bg = 'linear-gradient(to bottom, rgba(248,113,113,0.08) 0%, rgba(248,113,113,0.18) 60%, rgba(239,68,68,0.35) 100%)';
  const stripe = 'rgb(239,68,68)';

  const executeBuy = () => {
    if (boughtRef.current) return;
    boughtRef.current = true;
    setBuyState('bought');
  };

  const handleBuyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (buyState === 'bought') {
      // Skip to sold
      setBuyState('sold');
      return;
    }
    if (buyState === 'sold') {
      boughtRef.current = false;
      setBuyState('idle');
      return;
    }
    if (buyState === 'confirm') {
      executeBuy();
    } else {
      setBuyState('confirm');
      setTimeout(() => {
        if (!boughtRef.current) setBuyState('idle');
      }, 30000);
    }
  };

  // Price block container style — matches scanner exactly
  const priceContainerClass = cn(
    "relative rounded-md overflow-hidden group/buy transition-all duration-300",
    buyState === 'sold'
      ? 'border border-destructive/60 bg-muted/50 shadow-[0_0_6px_rgba(239,68,68,0.2)]'
      : buyState === 'bought'
        ? 'border border-accent/60 bg-accent/20 shadow-[0_0_6px_rgba(34,197,94,0.2)]'
        : buyState === 'confirm'
          ? 'border border-cs-yellow/60 bg-cs-yellow/10 shadow-[0_0_6px_rgba(234,179,8,0.2)]'
          : 'border border-accent/40 bg-gradient-to-b from-secondary/80 to-secondary/40 shadow-[0_0_6px_rgba(34,197,94,0.15)]'
  );

  // Buy overlay style — matches scanner BuyOverlay exactly
  const buyOverlayClass = cn(
    "absolute inset-0 z-10 flex flex-col items-center justify-center gap-0.5 transition-all duration-150 backdrop-blur-sm rounded cursor-pointer",
    buyState === 'sold'
      ? 'opacity-100 bg-background/80 ring-1 ring-destructive/60'
      : buyState === 'bought'
        ? 'opacity-100 bg-gradient-to-b from-accent/30 via-accent/50 to-accent/30 ring-1 ring-accent/50'
        : buyState === 'confirm'
          ? 'opacity-100 bg-background/80'
          : 'opacity-0 group-hover/buy:opacity-100 bg-background/70 hover:bg-background/80 active:scale-[0.97]'
  );

  return (
    <div className={cn("bg-card rounded-lg border border-border/50 hover:border-border transition-all relative overflow-hidden flex flex-col", buyState === 'sold' && 'brightness-[0.45]')} style={{ width: 220 }}>
      {/* Header */}
      <div className="px-3 pt-2.5 pb-1 min-h-[42px]">
        <p className="text-xs font-semibold text-foreground leading-tight truncate">AWP | Dragon Lore</p>
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">Factory New</p>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span>2m ago</span>
          </div>
        </div>
      </div>

      {/* Image Area */}
      <div className="relative mx-2 flex flex-col rounded overflow-hidden">
        <div className="relative h-[100px] flex items-center justify-center" style={{ background: bg }}>
          {/* Spotlight dim overlay */}
          {highlightTier && activeTier?.imageDataUrl && (
            <div className="absolute inset-0 z-10 bg-black/60 rounded animate-[fadeOut_4s_ease-in-out_forwards]" />
          )}
          {activeTier && activeTier.imageDataUrl && (
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={cn(
                    "absolute top-1 left-1 z-30",
                    highlightTier && "animate-[tierPulse_1s_ease-in-out_3]"
                  )}>
                    <div className={cn(
                      "relative transition-all duration-500 shrink-0",
                      highlightTier ? "drop-shadow-[0_0_12px_rgba(255,255,255,0.6)]" : ""
                    )} style={{ width: `${(highlightTier ? 32 : 20) * iconScale}px`, height: `${(highlightTier ? 32 : 20) * iconScale}px` }}>
                      <img src={activeTier.imageDataUrl} alt="" className="h-full w-full object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]" />
                      {activeTier.overlayNumber != null && (
                        <span className="absolute inset-0 flex items-center justify-center font-extrabold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]" style={{ fontFamily: fontFamilyFor(activeTier.overlayFontFamily), WebkitTextStroke: '0.5px rgba(0,0,0,0.5)', fontSize: `${(highlightTier ? 14 : 10) * iconScale * (1 + (activeTier.overlaySize ?? 0) / 100)}px`, color: activeTier.overlayColor ?? '#ffffff', transform: `translate(${(activeTier.overlayOffsetX ?? 0) * 0.8}px, ${(activeTier.overlayOffsetY ?? 0) * 0.8}px)` }}>{activeTier.overlayNumber}</span>
                      )}
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="center" className="text-xs text-center">
                  {activeTier.note && <p className="font-semibold">{activeTier.note}</p>}
                  <p className="text-muted-foreground text-[11.5px]">{activeTier.name}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <img src={dragonLoreImg} alt="AWP Dragon Lore" className={cn("h-[88px] w-auto object-contain drop-shadow-lg transition-all duration-500", highlightTier && "brightness-50")} />
        </div>
        <div className="h-[2px]" style={{ backgroundColor: stripe }} />
      </div>

      {/* Price + Buy overlay — exact scanner pattern */}
      <div className="mt-auto px-2 pt-2">
        <div className={priceContainerClass}>
          <div className="flex h-[60px] flex-col items-center justify-center px-2 py-2">
            <span className="text-[9px] font-semibold text-muted-foreground/70 uppercase tracking-[0.15em] leading-none mb-0.5">Market Price</span>
            <span className="text-[15px] font-bold text-foreground font-mono leading-tight tracking-tight">$11,111.00</span>
            <span className="text-[10px] font-mono font-bold leading-none mt-0.5 text-accent">▲ +512.30$ (4.8%)</span>
          </div>
          {/* Buy Overlay — scanner-identical */}
          <button onClick={handleBuyClick} className={buyOverlayClass}>
            {buyState === 'sold' ? (
              <div className="flex flex-col items-center justify-center animate-in fade-in duration-300">
                <span className="text-[10px] font-semibold text-destructive uppercase tracking-[0.15em] leading-none mb-0.5">Sold for</span>
                <span className="text-[15px] font-bold text-destructive font-mono leading-tight tracking-tight">$11,111.00</span>
              </div>
            ) : buyState === 'bought' ? (
              <div className="flex items-center gap-1.5 animate-in zoom-in-75 fade-in duration-300">
                <span className="text-sm font-bold text-accent tracking-wider uppercase drop-shadow-[0_0_6px_hsl(var(--accent)/0.4)]">Bought!</span>
              </div>
            ) : buyState === 'confirm' ? (
              <>
                <span className="text-[10px] font-semibold text-destructive uppercase tracking-widest animate-pulse">Click again to confirm</span>
                <span className="text-lg font-bold text-foreground font-mono leading-none">$11,111.00</span>
              </>
            ) : (
              <>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Buy Now</span>
                <span className="text-lg font-bold text-foreground font-mono leading-none">$11,111.00</span>
                <span className="text-[11px] font-mono font-bold leading-none text-accent">+512.30$ (4.8%)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Bid / Ask */}
      <div className="px-2 pt-1.5">
        <div className="grid grid-cols-[1fr_1px_1fr] text-[10px] font-mono rounded overflow-hidden border border-border/40 h-[26px]">
          <div className="bg-cs-orange/15 text-cs-orange flex items-center justify-center font-semibold whitespace-nowrap">Bid 10,850$</div>
          <div className="bg-border/40" />
          <div className="bg-accent/15 text-accent flex items-center justify-center font-semibold whitespace-nowrap">Ask 11,400$</div>
        </div>
      </div>

      {/* Float Bar */}
      <div className="px-3 pt-1.5 pb-1">
        <div className="relative h-1.5 rounded-full wear-gradient overflow-hidden">
          <div className="absolute top-[-1px] w-[2px] h-[calc(100%+2px)] bg-foreground rounded-full shadow-sm" style={{ left: `${mockFloat * 100}%` }} />
        </div>
      </div>

      {/* Float + Pattern */}
      <div className="px-3 flex items-center justify-between text-[10px]">
        <span className="font-mono text-muted-foreground">0.00000000010431</span>
        <span className="font-mono text-muted-foreground">{mockSeed}</span>
      </div>
      <div className="pb-2" />
    </div>
  );
};

/* ── Preview Overlay Panel with zoom & tier switching ── */
const PreviewOverlayPanel = ({ overlay, onClose }: { overlay: SkinOverlay; onClose: () => void }) => {
  const [zoom, setZoom] = useState(2.0);
  const [iconScale, setIconScale] = useState(1);
  const tiersWithImages = overlay.tiers.filter(t => t.imageDataUrl);
  const [activeTierId, setActiveTierId] = useState<string | null>(tiersWithImages[0]?.id ?? null);
  const [highlightTier, setHighlightTier] = useState(true);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  if (highlightTier && !highlightTimerRef.current) {
    highlightTimerRef.current = setTimeout(() => setHighlightTier(false), 4000);
  }
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  const canPan = zoom > 2;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!canPan) return;
    isPanning.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, [canPan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setPan(p => ({ x: p.x + dx, y: p.y + dy }));
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  // Reset pan when zoom drops to <=2
  const handleZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom);
    if (newZoom <= 2) setPan({ x: 0, y: 0 });
  }, []);

  return (
    <div className="absolute inset-0 z-30 bg-background/95 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="px-2.5 pt-3 pb-2 border-b border-border/20 shrink-0">
        <Button
          variant="outline"
          className="w-full h-9 text-xs gap-2 border-destructive/40 text-destructive bg-destructive/5 hover:bg-destructive/15 hover:text-destructive"
          onClick={onClose}
        >
          <ChevronRight className="h-4 w-4 rotate-180" />
          Back to List
        </Button>
      </div>

      {/* Controls row: Preview Zoom (blue) + Icon Size (amber) */}
      <div className="flex items-stretch justify-center gap-2 px-3 py-1.5 border-b border-border/20 shrink-0">
        {/* PREVIEW ZOOM — blue/primary, affects preview only */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded border border-primary/40 bg-primary/5">
          <span className="text-[9px] font-mono uppercase tracking-wider text-primary font-bold">Preview</span>
          <Button variant="ghost" size="icon" className="h-5 w-5 text-primary hover:text-primary hover:bg-primary/10" onClick={() => handleZoomChange(Math.max(1, zoom - 0.2))}>
            <ZoomOut className="h-3 w-3" />
          </Button>
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={e => handleZoomChange(parseFloat(e.target.value))}
            className="w-[70px] h-1 accent-primary"
          />
          <Button variant="ghost" size="icon" className="h-5 w-5 text-primary hover:text-primary hover:bg-primary/10" onClick={() => handleZoomChange(Math.min(3, zoom + 0.2))}>
            <ZoomIn className="h-3 w-3" />
          </Button>
          <span className="text-[9px] font-mono text-primary/80 tabular-nums w-[30px] text-right">{(zoom * 100).toFixed(0)}%</span>
          {(zoom !== 2 || pan.x !== 0 || pan.y !== 0) && (
            <Button variant="ghost" size="icon" className="h-5 w-5 text-primary/60 hover:text-primary" onClick={() => { handleZoomChange(2); setPan({ x: 0, y: 0 }); }}>
              <RotateCcw className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* ICON SIZE — amber, affects REAL scanner size */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded border border-amber-500/50 bg-amber-500/5">
          <span className="text-[9px] font-mono uppercase tracking-wider text-amber-500 font-bold">Icon Size</span>
          <Button variant="ghost" size="icon" className="h-5 w-5 text-amber-500 hover:text-amber-400 hover:bg-amber-500/10" onClick={() => setIconScale(s => Math.max(0.4, +(s - 0.1).toFixed(2)))}>
            <Minus className="h-3 w-3" />
          </Button>
          <input
            type="range"
            min={0.4}
            max={2}
            step={0.05}
            value={iconScale}
            onChange={e => setIconScale(parseFloat(e.target.value))}
            className="w-[70px] h-1 accent-amber-500"
            style={{ accentColor: 'rgb(245 158 11)' }}
          />
          <Button variant="ghost" size="icon" className="h-5 w-5 text-amber-500 hover:text-amber-400 hover:bg-amber-500/10" onClick={() => setIconScale(s => Math.min(2, +(s + 0.1).toFixed(2)))}>
            <Plus className="h-3 w-3" />
          </Button>
          <span className="text-[9px] font-mono text-amber-500/90 tabular-nums w-[30px] text-right">{(iconScale * 100).toFixed(0)}%</span>
          {iconScale !== 1 && (
            <Button variant="ghost" size="icon" className="h-5 w-5 text-amber-500/60 hover:text-amber-400" onClick={() => setIconScale(1)}>
              <RotateCcw className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      <div
        className="flex-1 flex items-center justify-center overflow-hidden p-2"
        style={{ cursor: canPan ? (isPanning.current ? 'grabbing' : 'grab') : 'default' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
          transition: isPanning.current ? 'none' : 'transform 0.15s ease',
        }}>
          <OverlayPreviewCard overlay={overlay} activeTierId={activeTierId} highlightTier={highlightTier} iconScale={iconScale} />
        </div>
      </div>

      {/* Tier switcher */}
      {tiersWithImages.length > 0 && (
        <div className="px-3 py-2 border-t border-border/20 flex items-center justify-center gap-1.5 flex-wrap shrink-0">
          {tiersWithImages.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTierId(t.id)}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded border transition-all text-[9px]",
                activeTierId === t.id
                  ? "border-primary/50 bg-primary/10 text-foreground"
                  : "border-border/40 bg-muted/20 text-muted-foreground hover:bg-muted/40"
              )}
            >
              <div className="relative h-4 w-4 shrink-0">
                <img src={t.imageDataUrl} alt={t.name} className="h-4 w-4 object-contain" />
                {t.overlayNumber != null && (
                  <span className="absolute inset-0 flex items-center justify-center font-extrabold drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]" style={{ fontFamily: fontFamilyFor(t.overlayFontFamily), fontSize: '7px', color: t.overlayColor ?? '#ffffff' }}>{t.overlayNumber}</span>
                )}
              </div>
              {t.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ── Main Component ── */
export const OverlayConfigTab = ({ overlays, onOverlaysChange, panelMode: panelModeProp, onPanelModeChange, hidePanelModeTabs, searchQuery: searchQueryProp, onSearchQueryChange, actionsRef }: OverlayConfigTabProps) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQueryLocal, setSearchQueryLocal] = useState("");
  const searchQuery = searchQueryProp ?? searchQueryLocal;
  const setSearchQuery = (q: string) => (onSearchQueryChange ? onSearchQueryChange(q) : setSearchQueryLocal(q));
  const [addQuery, setAddQuery] = useState("");
  const [panelModeLocal, setPanelModeLocal] = useState<'search' | 'browse' | 'add'>('browse');
  const panelMode = panelModeProp ?? panelModeLocal;
  const setPanelMode = (m: 'search' | 'browse' | 'add') => { onPanelModeChange ? onPanelModeChange(m) : setPanelModeLocal(m); };
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addDialogInitialSearch, setAddDialogInitialSearch] = useState("");
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [previewOverlayId, setPreviewOverlayId] = useState<string | null>(null);
  const [highlightTierId, setHighlightTierId] = useState<string | null>(null);
  const previewOverlay = previewOverlayId ? overlays.find(o => o.id === previewOverlayId) || null : null;

  const openAddDialog = useCallback((prefill = "") => {
    setAddDialogInitialSearch(prefill);
    setAddDialogOpen(true);
  }, []);

  const navigateToTier = useCallback((overlayId: string, tierId: string) => {
    setSelectedId(overlayId);
    setHighlightTierId(null);
    // Wait for render then scroll + highlight
    setTimeout(() => {
      const el = document.querySelector(`[data-tier-id="${tierId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightTierId(tierId);
        setTimeout(() => setHighlightTierId(null), 2000);
      }
    }, 100);
  }, []);

  const update = (newOverlays: SkinOverlay[]) => {
    onOverlaysChange(newOverlays);
    saveOverlays(newOverlays);
  };

  const filteredOverlays = useMemo(() => {
    if (!searchQuery.trim()) return overlays;
    const q = searchQuery.toLowerCase();
    return overlays.filter(o => o.skinName.toLowerCase().includes(q));
  }, [overlays, searchQuery]);

  const handleDrop = useCallback((targetIdx: number) => {
    if (dragIdx == null || dragIdx === targetIdx) return;
    const newList = [...overlays];
    const [moved] = newList.splice(dragIdx, 1);
    newList.splice(targetIdx, 0, moved);
    update(newList);
    setDragIdx(null);
  }, [dragIdx, overlays]);

  const selectedOverlay = overlays.find(o => o.id === selectedId) || null;

  const addSkin = (skinName: string) => {
    const newSkin: SkinOverlay = { id: genId(), skinName, tiers: [], enabled: true };
    const newOverlays = [...overlays, newSkin];
    update(newOverlays);
    setSelectedId(newSkin.id);
  };

  const removeSkin = (id: string) => {
    update(overlays.filter(o => o.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const updateSkin = (id: string, changes: Partial<SkinOverlay>) => {
    update(overlays.map(o => o.id === id ? { ...o, ...changes } : o));
  };

  const lastTierToggleAtRef = useRef(0);
  const markTierToggle = useCallback(() => {
    lastTierToggleAtRef.current = Date.now();
  }, []);

  const addTierGuard = useRef(false);
  const addTier = (skinId: string) => {
    if (Date.now() - lastTierToggleAtRef.current < 450) return;
    if (addTierGuard.current) return;
    addTierGuard.current = true;
    setTimeout(() => { addTierGuard.current = false; }, 300);
    const skin = overlays.find(o => o.id === skinId);
    if (!skin) return;
    updateSkin(skinId, { tiers: [...skin.tiers, { id: genId(), name: `Tier ${skin.tiers.length + 1}`, imageDataUrl: '', paintSeeds: [] }] });
  };

  const updateTier = (skinId: string, tierId: string, tier: PatternTier) => {
    const skin = overlays.find(o => o.id === skinId);
    if (!skin) return;
    updateSkin(skinId, { tiers: skin.tiers.map(t => t.id === tierId ? tier : t) });
  };

  const deleteTier = (skinId: string, tierId: string) => {
    const skin = overlays.find(o => o.id === skinId);
    if (!skin) return;
    updateSkin(skinId, { tiers: skin.tiers.filter(t => t.id !== tierId) });
  };

  const isAddTierTemporarilyBlocked = Date.now() - lastTierToggleAtRef.current < 450;

  // Expose actions for the external command bar
  useEffect(() => {
    if (!actionsRef) return;
    actionsRef.current = {
      openAddDialog: (prefill = "") => openAddDialog(prefill),
      enableAll: () => update(overlays.map(o => ({ ...o, enabled: true }))),
      disableAll: () => update(overlays.map(o => ({ ...o, enabled: false }))),
      sortAZ: () => update([...overlays].sort((a, b) => (a.skinName || '').localeCompare(b.skinName || ''))),
      collapseAll: () => { window.dispatchEvent(new CustomEvent('overlays:collapse-all')); },
    };
    return () => { if (actionsRef.current) actionsRef.current = null; };
  }, [actionsRef, overlays, openAddDialog]);

  return (
    <div className="flex gap-0 h-full min-h-0 overflow-hidden">
      {/* ── Left Panel ── */}
      <div className="w-[35%] min-w-[180px] border-r border-border/30 flex flex-col h-full min-h-0">
        {/* Mode switcher removed — controls now live in the top OverlayCommandBar */}


        {/* Skin list with preview overlay */}
        <div className="relative flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-1.5 space-y-0.5">
              {filteredOverlays.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <Layers className="h-6 w-6 text-muted-foreground/20 mb-1" />
                  <p className="text-[10px] text-muted-foreground">{searchQuery ? 'No results' : 'No overlays yet'}</p>
                </div>
              ) : (
                filteredOverlays.map((o, idx) => (
                  <SkinListItem
                    key={o.id}
                    overlay={o}
                    isSelected={selectedId === o.id}
                    onClick={() => setSelectedId(o.id)}
                    onToggle={val => updateSkin(o.id, { enabled: val })}
                    onDelete={() => removeSkin(o.id)}
                    onPreview={() => setPreviewOverlayId(prev => {
                      const next = prev === o.id ? null : o.id;
                      if (next) setSelectedId(o.id);
                      return next;
                    })}
                    onNavigateToTier={(tierId) => navigateToTier(o.id, tierId)}
                    onDragStart={() => setDragIdx(overlays.indexOf(o))}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => handleDrop(overlays.indexOf(o))}
                    onDragEnd={() => setDragIdx(null)}
                  />
                ))
              )}
            </div>
          </ScrollArea>

          {/* Preview overlay — full-size card with zoom */}
          {previewOverlay && (
            <PreviewOverlayPanel overlay={previewOverlay} onClose={() => setPreviewOverlayId(null)} />
          )}
        </div>
      </div>

      {/* ── Right Panel: Editor ── */}
      <div className="flex-1 min-w-0 h-full min-h-0 overflow-y-auto">
        {selectedOverlay ? (
          <div className="p-3 pb-3 space-y-3 min-h-full h-full flex flex-col">
            {selectedOverlay.tiers.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1">
                <button
                  onClick={() => addTier(selectedOverlay.id)}
                  className="group h-20 w-20 rounded-full border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 bg-muted/10 hover:bg-primary/10 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-[0_0_25px_hsl(var(--primary)/0.2)]"
                >
                  <Plus className="h-8 w-8 text-muted-foreground/40 group-hover:text-primary transition-colors duration-300" />
                </button>
                <p className="text-xs text-muted-foreground/50 mt-3">Add your first tier</p>
              </div>
            ) : (
            <div className="space-y-2 pb-12">
            {selectedOverlay.tiers.map((tier, idx) => (
                <div key={tier.id} data-tier-id={tier.id} className={cn("rounded-lg transition-all duration-500", highlightTierId === tier.id && "ring-2 ring-white/70 shadow-[0_0_15px_rgba(255,255,255,0.3)]")}>
                <TierEditor tier={tier} onUpdate={t => updateTier(selectedOverlay.id, tier.id, t)} onDelete={() => deleteTier(selectedOverlay.id, tier.id)} firstTierImage={idx > 0 ? selectedOverlay.tiers[0]?.imageDataUrl : undefined} onCloneNote={selectedOverlay.tiers.length > 1 ? () => {
                  const note = tier.note;
                  if (!note?.trim()) return;
                  updateSkin(selectedOverlay.id, { tiers: selectedOverlay.tiers.map(t => ({ ...t, note })) });
                } : undefined} onToggleTier={markTierToggle} />
                </div>
              ))}
            </div>
            )}
            {selectedOverlay.tiers.length > 0 && (
              <div className="sticky bottom-0 pt-2 bg-gradient-to-t from-background via-background to-transparent">
                <Button variant="outline" size="sm" disabled={isAddTierTemporarilyBlocked} className="h-7 text-[10px] gap-1 w-full border-dashed disabled:opacity-40 disabled:pointer-events-none" onClick={(e) => { e.stopPropagation(); addTier(selectedOverlay.id); }}>
                  <Plus className="h-3 w-3" /> Add Tier
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Layers className="h-8 w-8 text-muted-foreground/20 mb-2" />
            <p className="text-xs text-muted-foreground">Select a skin from the list</p>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">or click "Add Skin" to create a new overlay</p>
          </div>
        )}
      </div>

      {/* Add Skin Dialog */}
      <AddSkinDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} onConfirm={addSkin} initialSearch={addDialogInitialSearch} />
    </div>
  );
};
