import { useState } from "react";
import { Layers, Frame as FrameIcon, ArrowRight, Sparkles, Search, Eye, Plus, X, EyeOff, ArrowDownAZ, Power, ChevronsDownUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { OverlayConfigTab } from "./OverlayConfigTab";
import { FrameDesignerPage } from "./FrameDesignerPage";
import { SkinOverlay } from "./overlayTypes";

export type OverlayMode = null | "icons" | "frame";
export type PanelMode = 'search' | 'browse' | 'add';

interface OverlaysShellProps {
  overlays: SkinOverlay[];
  onOverlaysChange: (overlays: SkinOverlay[]) => void;
  mode?: OverlayMode;
  onModeChange?: (m: OverlayMode) => void;
  panelMode?: PanelMode;
  onPanelModeChange?: (m: PanelMode) => void;
  headerless?: boolean;
  /** External controlled search (used by the top command bar). */
  searchQuery?: string;
  onSearchQueryChange?: (q: string) => void;
  /** Receives an actions object to invoke bulk operations + add dialog. */
  actionsRef?: React.MutableRefObject<OverlayConfigActions | null>;
}

export type OverlayConfigActions = {
  openAddDialog: (prefill?: string) => void;
  enableAll: () => void;
  disableAll: () => void;
  sortAZ: () => void;
  collapseAll: () => void;
};

export const OverlaysShell = ({
  overlays,
  onOverlaysChange,
  mode: modeProp,
  onModeChange,
  panelMode: panelModeProp,
  onPanelModeChange: onPanelModeChangeProp,
  headerless,
  searchQuery,
  onSearchQueryChange,
  actionsRef,
}: OverlaysShellProps) => {
  const [modeState, setModeState] = useState<OverlayMode>(null);
  const [panelModeState, setPanelModeState] = useState<PanelMode>('browse');
  const isControlled = modeProp !== undefined && !!onModeChange;
  const mode = isControlled ? modeProp! : modeState;
  const setMode = (m: OverlayMode) => (isControlled ? onModeChange!(m) : setModeState(m));
  const panelMode = panelModeProp ?? panelModeState;
  const setPanelMode = (m: PanelMode) => (onPanelModeChangeProp ? onPanelModeChangeProp(m) : setPanelModeState(m));

  if (mode === "icons") {
    return (
      <div className="flex flex-col h-full min-h-0">
        {!headerless && (
          <UnifiedHeader
            mode="icons"
            onSwitchMode={setMode}
            panelMode={panelMode}
            onPanelModeChange={setPanelMode}
          />
        )}
        <div className="flex-1 min-h-0 overflow-hidden">
          <OverlayConfigTab
            overlays={overlays}
            onOverlaysChange={onOverlaysChange}
            panelMode={panelMode}
            onPanelModeChange={setPanelMode}
            hidePanelModeTabs
            searchQuery={searchQuery}
            onSearchQueryChange={onSearchQueryChange}
            actionsRef={actionsRef}
          />
        </div>
      </div>
    );
  }

  if (mode === "frame") {
    return (
      <div className="flex flex-col h-full min-h-0">
        {!headerless && (
          <UnifiedHeader mode="frame" onSwitchMode={setMode} />
        )}
        <div className="flex-1 min-h-0 overflow-hidden">
          <FrameDesignerPage />
        </div>
      </div>
    );
  }

  return <ModeChooser onPick={setMode} />;
};

/* ── Unified Header (workspace tabs + contextual tool group) ── */
const UnifiedHeader = ({
  mode, onSwitchMode, panelMode, onPanelModeChange,
}: {
  mode: "icons" | "frame";
  onSwitchMode: (m: Exclude<OverlayMode, null>) => void;
  panelMode?: PanelMode;
  onPanelModeChange?: (m: PanelMode) => void;
}) => {
  return (
    <div className="relative grid grid-cols-3 items-center gap-[13px] px-[13px] h-[42.8px] border-b border-border/40 shrink-0 bg-gradient-to-b from-background/70 to-background/30 backdrop-blur-sm">
      <div className="flex items-center justify-self-start">
        {mode === "icons" && panelMode && onPanelModeChange && (
          <OverlayPanelPills panelMode={panelMode} onPanelModeChange={onPanelModeChange} />
        )}
      </div>
      <nav className="flex items-stretch h-[42.8px] -my-[6.4px] justify-self-center gap-[34.2px]">
        <OverlayWorkspaceTab active={mode === "icons"} icon={Layers} label="Icons" onClick={() => onSwitchMode("icons")} />
        <OverlayWorkspaceTab active={mode === "frame"} icon={FrameIcon} label="Frame" onClick={() => onSwitchMode("frame")} />
      </nav>
      <div className="justify-self-end" />
    </div>
  );
};

/* ── Exported: workspace tabs (Icons / Frame) for external toolbars ── */
export const OverlayWorkspaceTab = ({
  active, icon: Icon, label, onClick,
}: { active: boolean; icon: React.ElementType; label: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "relative inline-flex items-center gap-[6.4px] px-[13px] h-full text-[11.8px] uppercase tracking-[0.14em] font-semibold transition-colors",
      active ? "text-foreground" : "text-muted-foreground/70 hover:text-foreground"
    )}
  >
    <Icon className={cn("h-[15px] w-[15px] transition-colors", active ? "text-primary" : "")} />
    {label}
    <span
      className={cn(
        "absolute bottom-0 left-2 right-2 h-[2px] rounded-full transition-all duration-300",
        active
          ? "bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.7)] opacity-100"
          : "bg-transparent opacity-0"
      )}
    />
  </button>
);

/* ── Legacy export kept for backward compat ── */
export const OverlayPanelPills = ({
  panelMode, onPanelModeChange,
}: { panelMode: PanelMode; onPanelModeChange: (m: PanelMode) => void }) => (
  <div className="flex items-center gap-[6.4px]">
    <PanelActionPill tone="cyan"    active={panelMode === 'search'} icon={Search} label="Search" onClick={() => onPanelModeChange('search')} />
    <PanelActionPill tone="violet"  active={panelMode === 'browse'} icon={Eye}    label="Browse" onClick={() => onPanelModeChange('browse')} />
    <PanelActionPill tone="emerald" active={panelMode === 'add'}    icon={Plus}   label="Add"    onClick={() => onPanelModeChange('add')} />
  </div>
);

const PanelActionPill = ({
  tone, active, icon: Icon, label, onClick,
}: {
  tone: "cyan" | "violet" | "emerald";
  active: boolean;
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) => {
  const tones = {
    cyan: {
      active: "text-cyan-300 border-cyan-400/60 shadow-[0_0_10px_-2px_hsl(190_90%_55%/0.55),inset_0_0_0_1px_hsl(190_90%_55%/0.25)]",
      idle: "text-cyan-400/80 border-transparent hover:text-cyan-300",
      icon: "text-cyan-300",
    },
    violet: {
      active: "text-primary border-primary/60 shadow-[0_0_10px_-2px_hsl(var(--primary)/0.55),inset_0_0_0_1px_hsl(var(--primary)/0.25)]",
      idle: "text-primary/80 border-transparent hover:text-primary",
      icon: "text-primary",
    },
    emerald: {
      active: "text-emerald-300 border-emerald-400/60 shadow-[0_0_10px_-2px_hsl(160_84%_45%/0.55),inset_0_0_0_1px_hsl(160_84%_45%/0.25)]",
      idle: "text-emerald-400/80 border-transparent hover:text-emerald-300",
      icon: "text-emerald-400",
    },
  }[tone];

  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center gap-[6.4px] h-[30px] px-[10.7px] rounded-md border bg-transparent text-[10.7px] uppercase tracking-[0.12em] font-semibold transition-all duration-200",
        active ? tones.active : tones.idle
      )}
    >
      <Icon className={cn("h-[13px] w-[13px]", tones.icon)} />
      {label}
    </button>
  );
};

/* ── New: Professional Overlay Command Bar ── */
const TONE = {
  search:  { ring: 'ring-cyan-400/60',    bg: 'bg-cyan-500/12',    glow: 'shadow-[0_0_10px_-3px_hsl(190_90%_55%/0.7)]',     text: 'text-cyan-300',    icon: 'text-cyan-300',    accent: '190 90% 55%' },
  browse:  { ring: 'ring-primary/60',     bg: 'bg-primary/12',     glow: 'shadow-[0_0_10px_-3px_hsl(var(--primary)/0.7)]',  text: 'text-primary',     icon: 'text-primary',     accent: 'var(--primary)' },
  add:     { ring: 'ring-emerald-400/60', bg: 'bg-emerald-500/12', glow: 'shadow-[0_0_10px_-3px_hsl(160_84%_45%/0.7)]',     text: 'text-emerald-300', icon: 'text-emerald-300', accent: '160 84% 45%' },
} as const;

const SEG_ITEMS: { id: PanelMode; label: string; icon: React.ElementType; tip: string }[] = [
  { id: 'search', label: 'Search', icon: Search, tip: 'Filter overlays by name' },
  { id: 'browse', label: 'Browse', icon: Eye,    tip: 'Browse configured overlays' },
  { id: 'add',    label: 'Add',    icon: Plus,   tip: 'Create a new overlay' },
];

export const OverlayCommandBar = ({
  panelMode, onPanelModeChange,
  totalCount, enabledCount,
  searchQuery, onSearchQueryChange,
  onEnableAll, onDisableAll, onSort, onCollapseAll, onNewSkin,
  fillWidth,
}: {
  panelMode: PanelMode;
  onPanelModeChange: (m: PanelMode) => void;
  totalCount: number;
  enabledCount: number;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  onEnableAll: () => void;
  onDisableAll: () => void;
  onSort: () => void;
  onCollapseAll: () => void;
  onNewSkin: () => void;
  fillWidth?: boolean;
}) => {
  const tone = TONE[panelMode];

  return (
    <TooltipProvider delayDuration={150}>
      <div className={cn(
        "group/bar relative flex items-stretch h-[34.2px] overflow-hidden transition-all duration-300",
        "before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-border/60 before:to-transparent",
        fillWidth
          ? "w-full border-x border-t border-border/50 bg-[linear-gradient(180deg,hsl(var(--background)/0.85)_0%,hsl(var(--background)/0.55)_100%)] backdrop-blur-md"
          : "rounded-md border border-border/50 bg-background/60 backdrop-blur-sm",
      )}>
        {/* Accent rail (left) */}
        <div
          className="absolute left-0 top-0 bottom-0 w-[2px] transition-colors duration-300"
          style={{ background: `linear-gradient(180deg, transparent, hsl(${tone.accent} / 0.9), transparent)` }}
        />

        {/* Segmented mode switch — icon-only, pro-tool style */}
        <div className="flex items-center pl-2.5 pr-1.5">
          <div className="relative grid grid-cols-3 h-[27.8px] w-[103px] shrink-0 rounded-[6px] bg-background/70 ring-1 ring-inset ring-border/50 p-[2px]">
            <div
              className={cn(
                "absolute top-[2px] bottom-[2px] w-[calc(33.333%-1px)] rounded-[4px] transition-all duration-300 ease-out",
                tone.bg, "ring-1 ring-inset", tone.ring,
              )}
              style={{
                left: panelMode === 'search' ? '2px' : panelMode === 'browse' ? 'calc(33.333% + 0.5px)' : 'calc(66.666% - 1px)',
                boxShadow: `0 0 8px -2px hsl(${tone.accent} / 0.55), inset 0 0 0 1px hsl(${tone.accent} / 0.2)`,
              }}
            />
            {SEG_ITEMS.map((it) => {
              const active = panelMode === it.id;
              const t = TONE[it.id];
              const Icon = it.icon;
              return (
                <Tooltip key={it.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => onPanelModeChange(it.id)}
                      className={cn(
                        "relative z-10 inline-flex items-center justify-center transition-colors",
                        active ? t.icon : "text-muted-foreground/60 hover:text-foreground/90"
                      )}
                      aria-label={it.label}
                    >
                      <Icon className="h-[15px] w-[15px]" strokeWidth={2.4} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-[10px] font-medium">{it.tip}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>


        <div className="self-center h-[17px] w-px bg-border/50" />

        {/* Morphing context area */}
        <div className="flex-1 min-w-0 flex items-center px-2">
          {panelMode === 'search' && (
            <div className="relative flex-1 h-[25.7px] flex items-center rounded-[4px] bg-background/80 ring-1 ring-inset ring-cyan-400/25 focus-within:ring-cyan-400/70 focus-within:shadow-[0_0_8px_-2px_hsl(190_90%_55%/0.6)] transition-all">
              <Search className="absolute left-[8.6px] h-[13px] w-[13px] text-cyan-300/70 pointer-events-none" strokeWidth={2.4} />
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                placeholder="Filter by skin name…"
                className="h-full w-full bg-transparent border-0 outline-none pl-[30px] pr-[26px] text-[11.8px] font-medium text-foreground placeholder:text-muted-foreground/45"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchQueryChange("")}
                  className="absolute right-[4.3px] h-[17px] w-[17px] flex items-center justify-center rounded text-cyan-300/70 hover:text-cyan-200 hover:bg-cyan-400/10 transition-colors"
                  title="Clear"
                >
                  <X className="h-[11px] w-[11px]" />
                </button>
              )}
            </div>
          )}

          {panelMode === 'browse' && (
            <div className="flex items-center gap-[6.4px] text-[10.7px] font-mono tracking-[0.08em]">
              <Layers className="h-[13px] w-[13px] text-primary/80" strokeWidth={2.4} />
              <span className="text-muted-foreground/80 uppercase">Skins</span>
              <span className="text-foreground font-bold tabular-nums">{totalCount}</span>
              <span className="text-border/80">·</span>
              <span className="text-muted-foreground/80 uppercase">On</span>
              <span className={cn(
                "font-bold tabular-nums",
                enabledCount === 0 ? "text-destructive" : enabledCount === totalCount ? "text-emerald-400" : "text-primary"
              )}>{enabledCount}</span>
              <span className="text-border/60">/</span>
              <span className="text-muted-foreground/60 tabular-nums">{totalCount}</span>
            </div>
          )}

          {panelMode === 'add' && (
            <button
              type="button"
              onClick={onNewSkin}
              className="group/add relative inline-flex items-center justify-center gap-[6.4px] h-[25.7px] w-full px-[12.8px] rounded-[4px] bg-gradient-to-r from-emerald-500/15 via-emerald-500/20 to-emerald-500/15 ring-1 ring-inset ring-emerald-400/50 hover:ring-emerald-300/80 text-emerald-200 hover:text-white text-[10.7px] font-bold uppercase tracking-[0.16em] shadow-[0_0_10px_-3px_hsl(160_84%_45%/0.6)] hover:shadow-[0_0_14px_-2px_hsl(160_84%_45%/0.85)] transition-all"
            >
              <Plus className="h-[13px] w-[13px] transition-transform group-hover/add:rotate-90 duration-300" strokeWidth={2.6} />
              New Overlay
            </button>
          )}
        </div>

        <div className="self-center h-[17px] w-px bg-border/50" />

        {/* Utility actions */}
        <div className="flex items-center gap-0.5 px-1.5">
          <UtilityBtn icon={Power}          label="Enable all"   onClick={onEnableAll}   activeTone="emerald" disabled={totalCount === 0 || enabledCount === totalCount} />
          <UtilityBtn icon={EyeOff}         label="Disable all"  onClick={onDisableAll}  activeTone="rose"    disabled={totalCount === 0 || enabledCount === 0} />
          <UtilityBtn icon={ArrowDownAZ}    label="Sort A → Z"   onClick={onSort}        activeTone="primary" disabled={totalCount < 2} />
          <UtilityBtn icon={ChevronsDownUp} label="Collapse all" onClick={onCollapseAll} activeTone="primary" disabled={totalCount === 0} />
        </div>
      </div>
    </TooltipProvider>
  );
};

const UtilityBtn = ({
  icon: Icon, label, onClick, activeTone, disabled,
}: {
  icon: React.ElementType; label: string; onClick: () => void;
  activeTone: 'emerald' | 'rose' | 'primary';
  disabled?: boolean;
}) => {
  const hover = activeTone === 'emerald'
    ? "hover:text-emerald-300 hover:bg-emerald-500/10 hover:shadow-[0_0_8px_-2px_hsl(160_84%_45%/0.4)]"
    : activeTone === 'rose'
    ? "hover:text-rose-300 hover:bg-rose-500/10 hover:shadow-[0_0_8px_-2px_hsl(0_84%_60%/0.4)]"
    : "hover:text-primary hover:bg-primary/10 hover:shadow-[0_0_8px_-2px_hsl(var(--primary)/0.4)]";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={cn(
            "h-[30px] w-[30px] inline-flex items-center justify-center rounded-md text-muted-foreground/75 transition-all",
            !disabled && hover,
            disabled && "opacity-30 cursor-not-allowed"
          )}
        >
          <Icon className="h-[17px] w-[17px]" strokeWidth={2.2} />
        </button>

      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-[10px] font-medium">{label}</TooltipContent>
    </Tooltip>
  );
};

/* ── Mode Chooser ── */
const ModeChooser = ({ onPick }: { onPick: (m: Exclude<OverlayMode, null>) => void }) => {
  return (
    <div className="h-full w-full flex items-center justify-center px-6 py-8 overflow-auto">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] uppercase tracking-wider text-primary font-medium mb-3">
            <Sparkles className="h-3 w-3" />
            Overlays Workspace
          </div>
          <h2 className="text-xl font-semibold text-foreground">Choose your editor</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Pick a mode to continue. You can switch between modes at any time.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ModeCard
            title="Icons"
            subtitle="Pattern overlays & tier badges"
            description="Manage skin pattern tiers, attach custom icons, configure numbering and per-seed overlays for the Live Scanner."
            badge="Current"
            accent="primary"
            icon={Layers}
            onClick={() => onPick("icons")}
          />
          <ModeCard
            title="Frame"
            subtitle="Custom card frames"
            description="Design custom frames that wrap item cards in the Live Scanner — borders, glows, corners and accents."
            badge="New"
            accent="emerald"
            icon={FrameIcon}
            onClick={() => onPick("frame")}
          />
        </div>
      </div>
    </div>
  );
};

const ModeCard = ({
  title, subtitle, description, badge, accent, icon: Icon, onClick,
}: {
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  accent: "primary" | "emerald";
  icon: React.ElementType;
  onClick: () => void;
}) => {
  const accentRing = accent === "primary"
    ? "hover:border-primary/50 hover:shadow-[0_0_24px_-8px_hsl(var(--primary)/0.6)]"
    : "hover:border-emerald-500/50 hover:shadow-[0_0_24px_-8px_hsl(160_84%_45%/0.6)]";
  const accentIcon = accent === "primary"
    ? "bg-primary/10 text-primary border-primary/30"
    : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
  const accentBadge = accent === "primary"
    ? "bg-primary/15 text-primary border-primary/30"
    : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";

  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative text-left rounded-lg border border-border/50 bg-card/40 p-4 transition-all duration-200",
        "hover:bg-card/70 hover:-translate-y-0.5",
        accentRing,
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={cn("h-10 w-10 rounded-md border flex items-center justify-center", accentIcon)}>
          <Icon className="h-5 w-5" />
        </div>
        <span className={cn("text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border font-medium", accentBadge)}>
          {badge}
        </span>
      </div>
      <div className="flex items-baseline gap-2 mb-0.5">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <span className="text-[11px] text-muted-foreground">— {subtitle}</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      <div className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground/80 group-hover:text-foreground transition-colors">
        Open editor <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  );
};
