import { useState, useEffect, useRef, useCallback } from "react";
import {
  Power, Clock, Target, Wifi, Zap, Timer, Radar, Hourglass, Check, Crosshair,
  Wallet, ShoppingCart, Percent, ShieldCheck, ShieldAlert, Activity, KeyRound, Pencil,
} from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/data/mockData";
import { getSoundSettings } from "@/contexts/SoundSettingsContext";
import { useBotStatus } from "@/contexts/BotStatusContext";

/** Subset of /api/live/stats used by the launch panel. */
export interface DashboardLiveStats {
  connection_csfloat: boolean;
  connection_steam: boolean;
  latency: number;
  scanned_total: number;
  scanned_per_min: number;
  matches_found: number;
  buy_attempts: number;
  successful_buys: number;
  failed_buys: number;
  avg_speed: number;
  spent?: number;
}

interface LaunchControlProps {
  liveStats: DashboardLiveStats | null;
  activeTargets: number;
  totalTargets: number;
  balance: number | null;
  display: DashboardLiveStats | null; // live while running, frozen after stop
  hasSession: boolean;
  keyStats?: { ok: number; limited: number; err: number; total: number };
  lastMatchAt?: number | null; // wall-clock ms of the most recent match (from stats history)
  lastBuyAt?: number | null;   // wall-clock ms of the most recent successful buy
}

/* Editable time presets (seconds). "Instant" / "∞" are fixed first options. */
const DEFAULT_LAUNCH = [10, 30, 60, 300];
const DEFAULT_RUN = [60, 300, 900, 3600];

const fmtPreset = (s: number): string =>
  s % 3600 === 0 && s >= 3600 ? `${s / 3600}h` : s % 60 === 0 && s >= 60 ? `${s / 60}m` : `${s}s`;
const toUnit = (s: number): { n: string; unit: "s" | "m" | "h" } =>
  s % 3600 === 0 && s >= 3600 ? { n: String(s / 3600), unit: "h" }
    : s % 60 === 0 && s >= 60 ? { n: String(s / 60), unit: "m" }
      : { n: String(s), unit: "s" };
const unitMult = (u: "s" | "m" | "h") => (u === "h" ? 3600 : u === "m" ? 60 : 1);

const loadPresets = (key: string, fallback: number[]): number[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || "");
    if (Array.isArray(raw) && raw.length === 4 && raw.every((n) => Number.isFinite(n) && n > 0)) return raw;
  } catch { /* use defaults */ }
  return fallback;
};

// ── Shared visual tokens ──────────────────────────────────────────────────
const LABEL = "text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground";
const PILL = "inline-flex items-center justify-center h-8 px-3 rounded-md text-xs font-medium border transition-all duration-150 select-none";
const PILL_ON = "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.2)]";
const PILL_OFF = "border-border/40 bg-background/60 text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-background/70";

type ToneObj = { bg: string; text: string };
const TONES: Record<"emerald" | "amber" | "rose" | "violet" | "lime" | "teal" | "fuchsia" | "sky" | "muted", ToneObj> = {
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400" },
  amber: { bg: "bg-amber-500/10", text: "text-amber-400" },
  rose: { bg: "bg-rose-500/10", text: "text-rose-400" },
  violet: { bg: "bg-primary/10", text: "text-primary" },
  lime: { bg: "bg-lime-500/10", text: "text-lime-400" },
  teal: { bg: "bg-teal-500/10", text: "text-teal-400" },
  fuchsia: { bg: "bg-fuchsia-500/10", text: "text-fuchsia-400" },
  sky: { bg: "bg-sky-500/10", text: "text-sky-400" },
  muted: { bg: "bg-secondary/30", text: "text-muted-foreground" },
};

const fmtHMS = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
};
const fmtMS = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
const fmtAgo = (deltaMs: number): string => {
  const s = Math.max(0, Math.floor(deltaMs / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
};

export const LaunchControl = ({ liveStats, activeTargets, totalTargets, balance, display, hasSession, keyStats, lastMatchAt, lastBuyAt }: LaunchControlProps) => {
  const { botStatus, ping, toggleBot, isToggling, error } = useBotStatus();
  const isRunning = botStatus.isRunning;

  // ── Live uptime ──────────────────────────────────────────────────────
  const [liveUptime, setLiveUptime] = useState<number>(botStatus.uptime ?? 0);
  useEffect(() => { setLiveUptime(botStatus.uptime ?? 0); }, [botStatus.uptime]);
  useEffect(() => {
    if (!isRunning) return;
    const iv = setInterval(() => setLiveUptime((p) => p + 1), 1000);
    return () => clearInterval(iv);
  }, [isRunning]);

  // ── Sound + flash ────────────────────────────────────────────────────
  const [showFlash, setShowFlash] = useState(false);
  const playToggleSound = useCallback((starting: boolean) => {
    const sound = getSoundSettings();
    if (!sound.enabled || sound.volume === 0) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const vol = sound.volume / 100;
      if (starting) {
        [0, 0.08, 0.16, 0.24].forEach((offset, i) => {
          const osc = ctx.createOscillator(); const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime([400, 600, 800, 1200][i], ctx.currentTime + offset);
          gain.gain.setValueAtTime(0, ctx.currentTime + offset);
          gain.gain.linearRampToValueAtTime(0.15 * vol, ctx.currentTime + offset + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.12);
          osc.connect(gain); gain.connect(ctx.destination);
          osc.start(ctx.currentTime + offset); osc.stop(ctx.currentTime + offset + 0.15);
        });
      } else {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.15 * vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.4);
      }
    } catch { /* no audio */ }
  }, []);

  const fire = useCallback((starting: boolean) => {
    playToggleSound(starting);
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 500);
    toggleBot();
  }, [playToggleSound, toggleBot]);

  // ── Launch options ───────────────────────────────────────────────────
  const [selectedDelay, setSelectedDelay] = useState(0);
  const [runDuration, setRunDuration] = useState(0); // default: run indefinitely (∞)
  const [launchPresets, setLaunchPresets] = useState<number[]>(() => loadPresets("launch-presets", DEFAULT_LAUNCH));
  const [runPresets, setRunPresets] = useState<number[]>(() => loadPresets("run-presets", DEFAULT_RUN));

  // Presets live server-side (../data/ui_prefs.json) so they survive restarts; localStorage is a fast fallback.
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/ui/prefs");
        if (!r.ok) return;
        const p = await r.json();
        const valid = (a: unknown): a is number[] => Array.isArray(a) && a.length === 4 && a.every((n) => Number.isFinite(n) && n > 0);
        if (valid(p.launch_presets)) setLaunchPresets(p.launch_presets);
        if (valid(p.run_presets)) setRunPresets(p.run_presets);
      } catch { /* server offline — keep local */ }
    })();
  }, []);

  const persistPrefs = (patch: Record<string, number[]>) => {
    fetch("/api/ui/prefs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }).catch(() => { /* offline */ });
  };
  const saveLaunchPresets = (p: number[]) => {
    setLaunchPresets(p);
    try { localStorage.setItem("launch-presets", JSON.stringify(p)); } catch { /* ignore */ }
    persistPrefs({ launch_presets: p });
  };
  const saveRunPresets = (p: number[]) => {
    setRunPresets(p);
    try { localStorage.setItem("run-presets", JSON.stringify(p)); } catch { /* ignore */ }
    persistPrefs({ run_presets: p });
  };
  const [armTotal, setArmTotal] = useState(0);
  const [armRemaining, setArmRemaining] = useState<number | null>(null);
  const armTimer = useRef<ReturnType<typeof setInterval>>();
  const isArming = armRemaining !== null;
  const runDurationRef = useRef(0);

  const cancelArm = useCallback(() => {
    if (armTimer.current) clearInterval(armTimer.current);
    setArmRemaining(null); setArmTotal(0); runDurationRef.current = 0;
  }, []);

  const beginCountdown = useCallback((delay: number) => {
    if (armTimer.current) clearInterval(armTimer.current);
    setArmTotal(delay); setArmRemaining(delay);
    const deadline = Date.now() + delay * 1000;
    armTimer.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setArmRemaining(left);
      if (left <= 0) { clearInterval(armTimer.current); setArmRemaining(null); setArmTotal(0); fire(true); }
    }, 200);
  }, [fire]);

  const handleStart = useCallback(() => {
    runDurationRef.current = runDuration;
    if (selectedDelay > 0) beginCountdown(selectedDelay); else fire(true);
  }, [selectedDelay, runDuration, beginCountdown, fire]);

  const handleStop = useCallback(() => { cancelArm(); fire(false); }, [cancelArm, fire]);

  // ── Auto-stop after run duration ─────────────────────────────────────
  const [autoStopRemaining, setAutoStopRemaining] = useState<number | null>(null);
  const autoStopTimer = useRef<ReturnType<typeof setInterval>>();
  useEffect(() => {
    if (!isRunning) {
      if (autoStopTimer.current) clearInterval(autoStopTimer.current);
      setAutoStopRemaining(null); runDurationRef.current = 0; return;
    }
    if (runDurationRef.current > 0 && autoStopRemaining === null) {
      const deadline = Date.now() + runDurationRef.current * 1000;
      setAutoStopRemaining(runDurationRef.current);
      autoStopTimer.current = setInterval(() => {
        const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        setAutoStopRemaining(left);
        if (left <= 0) { clearInterval(autoStopTimer.current); setAutoStopRemaining(null); runDurationRef.current = 0; fire(false); }
      }, 250);
    }
  }, [isRunning, autoStopRemaining, fire]);

  useEffect(() => { if (isRunning && isArming) cancelArm(); }, [isRunning, isArming, cancelArm]);
  useEffect(() => () => {
    if (armTimer.current) clearInterval(armTimer.current);
    if (autoStopTimer.current) clearInterval(autoStopTimer.current);
  }, []);

  const onOrbClick = () => {
    if (isToggling) return;
    if (isArming) return cancelArm();
    if (isRunning) return handleStop();
    handleStart();
  };

  // ── Derived ───────────────────────────────────────────────────────────
  const buySpeedMs = display?.avg_speed ?? 0;
  const speedText = !display || buySpeedMs <= 0 ? "text-muted-foreground"
    : buySpeedMs < 150 ? "text-emerald-400" : buySpeedMs < 300 ? "text-amber-400" : "text-rose-400";

  // Ping tiers: <50 green · 50–99 yellow · ≥100 red
  const pingMs = ping?.latency_ms ?? null;
  const pingTone = pingMs === null ? "text-muted-foreground"
    : pingMs < 50 ? "text-emerald-400" : pingMs < 100 ? "text-amber-400" : "text-rose-400";

  // Icon-box tones for the metric grid
  const stateTone = isRunning ? TONES.emerald : isArming ? TONES.amber : TONES.rose;
  const pingToneBox = pingMs === null ? TONES.muted : pingMs < 50 ? TONES.emerald : pingMs < 100 ? TONES.amber : TONES.rose;
  const speedToneBox = !display || buySpeedMs <= 0 ? TONES.muted : buySpeedMs < 150 ? TONES.emerald : buySpeedMs < 300 ? TONES.amber : TONES.rose;

  // KPI data (live while running, frozen after stop)
  const dAttempts = display?.buy_attempts ?? 0;
  const dSuccess = display?.successful_buys ?? 0;
  const dFailed = display?.failed_buys ?? 0;
  const dRate = dAttempts > 0 ? Math.round((dSuccess / dAttempts) * 100) : 0;
  const matchesSub = isRunning ? "live session" : hasSession ? "last session" : "idle";

  const R = 64, C = 2 * Math.PI * R;
  const armFrac = armTotal > 0 && armRemaining !== null ? armRemaining / armTotal : 0;

  // State palette
  const st = isRunning ? "run" : isArming ? "arm" : "stop";
  const stateText = st === "run" ? "text-emerald-400" : st === "arm" ? "text-amber-400" : "text-rose-400";
  const orbRing = st === "run" ? "border-emerald-500/40" : st === "arm" ? "border-amber-400/40" : "border-rose-500/30 group-hover:border-rose-500/60";
  const orbBody = st === "run" ? "bg-emerald-500/10" : st === "arm" ? "bg-amber-400/[0.08]" : "bg-rose-500/[0.08] group-hover:bg-rose-500/15";
  const colBg = st === "run" ? "bg-emerald-500/[0.03] border-emerald-500/10" : st === "arm" ? "bg-amber-400/[0.02] border-amber-400/10" : "bg-rose-500/[0.03] border-rose-500/10";
  const statusBadge = st === "run" ? "border-emerald-500/40 bg-emerald-500/10" : st === "arm" ? "border-amber-500/40 bg-amber-500/10" : "border-rose-500/40 bg-rose-500/10";
  const statusLabel = isRunning ? "RUNNING" : isArming ? "LAUNCHING" : "STOPPED";
  const orbTitle = isRunning ? "Click to stop" : isArming ? "Click to cancel" : "Click to start";
  const connLabel = isRunning ? "LIVE" : isArming ? "ARMING" : "OFFLINE";

  return (
    <Card className={cn("col-span-full overflow-hidden relative border-border/50 bg-card/60 transition-shadow duration-500",
      showFlash && (isRunning ? "shadow-[0_0_36px_-6px_rgba(16,185,129,0.5)]" : "shadow-[0_0_36px_-6px_rgba(244,63,94,0.45)]"))}>
      {isRunning && <div className="absolute inset-0 launch-grid opacity-20 pointer-events-none" />}

      <CardContent className="relative p-0">

        {/* ── Body: orb | controls + unified 8-metric grid ───────────── */}
        <div className="flex flex-col lg:flex-row items-stretch">

          {/* Orb / power button */}
          <div className={cn("flex flex-col items-center justify-center gap-4 px-10 py-8 lg:w-[300px] shrink-0 border-b lg:border-b-0 lg:border-r transition-colors duration-500", colBg)}>
            <button
              type="button" onClick={onOrbClick} disabled={isToggling} title={orbTitle} aria-label={orbTitle}
              className="group relative w-36 h-36 flex items-center justify-center rounded-full outline-none transition-transform duration-200 hover:scale-105 active:scale-95 focus-visible:ring-4 focus-visible:ring-primary/40 disabled:opacity-60 disabled:cursor-wait cursor-pointer"
            >
              {isRunning && (
                <>
                  <span className="absolute inset-0 rounded-full bg-emerald-500/25 animate-orb-ping" />
                  <span className="absolute inset-0 rounded-full bg-emerald-500/15 animate-orb-ping" style={{ animationDelay: "1.1s" }} />
                </>
              )}
              <span className={cn("absolute inset-0 rounded-full border-2 transition-colors duration-500", orbRing)} />
              <span className={cn("absolute inset-3 rounded-full overflow-hidden flex items-center justify-center transition-colors duration-500", orbBody,
                isRunning && "animate-pulse-glow", isArming && "animate-arm-blink")}>
                {isRunning && (
                  <span className="absolute inset-0 animate-radar-sweep"
                    style={{ background: "conic-gradient(from 0deg, transparent 0deg, transparent 210deg, hsl(160 84% 45% / 0.55) 340deg, transparent 360deg)" }} />
                )}
              </span>
              {isArming && (
                <svg className="absolute inset-0 -rotate-90" width="144" height="144" viewBox="0 0 144 144">
                  <circle cx="72" cy="72" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
                  <circle cx="72" cy="72" r={R} fill="none" stroke="hsl(45 93% 58%)" strokeWidth="5" strokeLinecap="round"
                    strokeDasharray={C} strokeDashoffset={C * (1 - armFrac)} style={{ transition: "stroke-dashoffset 0.2s linear" }} />
                </svg>
              )}
              <span className={cn("relative z-10", stateText)}>
                {isArming ? <span className="text-3xl font-bold font-mono tabular-nums">{fmtMS(armRemaining ?? 0)}</span>
                  : isRunning ? <Radar className="h-11 w-11" /> : <Power className="h-11 w-11" />}
              </span>
            </button>

            <div className="text-center space-y-1.5">
              <p className={cn("text-2xl font-bold tracking-[0.08em] font-mono transition-colors duration-500", stateText)}>{statusLabel}</p>
              <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{orbTitle}</p>
              {isArming && <p className="text-xs font-mono text-amber-400">starts in {fmtMS(armRemaining ?? 0)}</p>}
              {isRunning && autoStopRemaining !== null && (
                <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-400 text-[11px] font-mono">
                  <Hourglass className="h-3 w-3" /> Auto-stop {fmtHMS(autoStopRemaining)}
                </span>
              )}
            </div>
          </div>

          {/* Controls + KPIs */}
          <div className="flex-1 p-6 flex flex-col gap-5">

            {error && <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">{error}</div>}

            {/* Fixed-height control slot — keeps the panel identical size in every state */}
            <div className="min-h-[48px] flex items-center">
              {!isRunning && !isArming && (
                <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
                  <OptionGroup icon={Timer} label="Launch in" first={{ label: "Instant", seconds: 0 }} presets={launchPresets} defaults={DEFAULT_LAUNCH} value={selectedDelay} onChange={setSelectedDelay} onSave={saveLaunchPresets} />
                  <OptionGroup icon={Hourglass} label="Run for" first={{ label: "∞", seconds: 0 }} presets={runPresets} defaults={DEFAULT_RUN} value={runDuration} onChange={setRunDuration} onSave={saveRunPresets} />
                </div>
              )}
              {isArming && (
                <div className="w-full rounded-lg border border-amber-500/20 bg-amber-500/[0.04] px-4 py-2.5 text-xs text-muted-foreground">
                  Launch scheduled — starts in <b className="text-amber-400 font-mono">{fmtMS(armRemaining ?? 0)}</b>. Click the orb to cancel.
                </div>
              )}
              {isRunning && (() => {
                const ks = keyStats ?? { ok: 0, limited: 0, err: 0, total: 0 };
                const ksTone = ks.total === 0 ? "text-muted-foreground"
                  : ks.err > 0 ? "text-rose-400" : ks.limited > 0 ? "text-amber-400" : "text-emerald-400";
                const denom = Math.max(1, ks.total);
                const spent = display?.spent ?? 0;
                return (
                  /* Full-width live telemetry band — replaces launch controls while running */
                  <div className="w-full self-stretch flex items-stretch rounded-lg border border-emerald-500/20 bg-emerald-500/[0.03] overflow-hidden">
                    <div className="flex items-center gap-2 px-4 border-r border-emerald-500/15 bg-emerald-500/[0.05] shrink-0">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                      </span>
                      <span className="text-[11px] font-bold tracking-[0.22em] text-emerald-400">LIVE</span>
                    </div>
                    {/* Time since last match — from the Rust stats history */}
                    <StripSeg icon={Crosshair} iconClass="text-lime-400" label="Last match">
                      {lastMatchAt ? (<><span className="text-lime-300">{fmtAgo(Date.now() - lastMatchAt)}</span><span className="text-muted-foreground font-normal"> ago</span></>) : (<span className="text-muted-foreground">—</span>)}
                    </StripSeg>
                    {/* Live scan rate — real rolling 60s window from Rust */}
                    <StripSeg icon={Radar} iconClass="text-emerald-400" label="Scan rate">
                      {(display?.scanned_per_min ?? 0).toLocaleString()}<span className="text-muted-foreground font-normal"> /min</span>
                    </StripSeg>
                    {/* API keys health — real per-account HTTP statuses */}
                    <StripSeg icon={KeyRound} iconClass={ksTone} label="API keys" title={`${ks.ok} healthy · ${ks.limited} rate-limited · ${ks.err} error`}>
                      <span className="inline-flex items-center gap-2">
                        <span><span className={ksTone}>{ks.ok}</span><span className="text-muted-foreground font-normal">/{ks.total}</span></span>
                        <span className="flex h-1 w-10 rounded-full overflow-hidden bg-secondary/60">
                          <span className="bg-emerald-400" style={{ width: `${(ks.ok / denom) * 100}%` }} />
                          <span className="bg-amber-400" style={{ width: `${(ks.limited / denom) * 100}%` }} />
                          <span className="bg-rose-400" style={{ width: `${(ks.err / denom) * 100}%` }} />
                        </span>
                      </span>
                    </StripSeg>
                    {/* Session spend — accumulated in Rust on each successful buy */}
                    <StripSeg icon={Wallet} iconClass="text-primary" label="Spent" className="hidden md:flex">
                      ${spent.toFixed(2)}
                    </StripSeg>
                    {/* Time since last successful buy — from the Rust stats history */}
                    <StripSeg icon={ShoppingCart} iconClass="text-fuchsia-400" label="Last buy">
                      {lastBuyAt ? (<><span className="text-fuchsia-300">{fmtAgo(Date.now() - lastBuyAt)}</span><span className="text-muted-foreground font-normal"> ago</span></>) : (<span className="text-muted-foreground">—</span>)}
                    </StripSeg>
                  </div>
                );
              })()}
            </div>

            {/* Unified 8-metric grid — one consistent style, fills the space */}
            <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 lg:grid-rows-2 auto-rows-fr gap-3">
              <KpiCard icon={Activity} tone={stateTone} pulse={isRunning} label="Status" value={connLabel} valueClass={stateText} sub={isRunning ? "live session" : "idle"} />
              <KpiCard icon={Clock} tone={TONES.violet} label="Uptime" value={isRunning ? fmtHMS(liveUptime) : "00:00:00"} sub="session" />
              <KpiCard icon={Wifi} tone={pingToneBox} valueClass={pingTone} label="CSFloat Ping" value={pingMs !== null ? `${pingMs} ms` : "—"} sub="latency" />
              <KpiCard icon={Zap} tone={speedToneBox} valueClass={speedText} label="Buy Speed" value={display && buySpeedMs > 0 ? `${buySpeedMs} ms` : "—"} sub="per buy" />
              <KpiCard icon={Wallet} tone={TONES.teal} valueClass="text-teal-300" label="Balance" value={balance !== null ? formatCurrency(balance) : "—"} sub="CSFloat wallet" />
              <KpiCard icon={Crosshair} tone={TONES.lime} valueClass="text-lime-300" label="Matches Found" value={display ? String(display.matches_found) : "—"} sub={matchesSub} />
              <KpiCard icon={ShoppingCart} tone={TONES.fuchsia} valueClass="text-fuchsia-300" label="Successful Buys" value={display ? String(dSuccess) : "—"} sub={`${dFailed} failed · ${dAttempts} att`} />
              <TargetTile active={activeTargets ?? 0} total={totalTargets ?? 0} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ── Presentational helpers ────────────────────────────────────────────────
// Segment of the running-state telemetry band: icon + tiny label over a mono value
const StripSeg = ({ icon: Icon, iconClass, label, title, className, children }: {
  icon: typeof Target; iconClass?: string; label: string; title?: string; className?: string; children: React.ReactNode;
}) => (
  <div title={title} className={cn("flex-1 min-w-0 flex items-center justify-center gap-2.5 px-3 border-r border-border/40 last:border-r-0", className)}>
    <Icon className={cn("h-3.5 w-3.5 shrink-0", iconClass)} />
    <div className="min-w-0">
      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground leading-none mb-1">{label}</p>
      <div className="text-[13px] font-bold font-mono tabular-nums leading-none truncate">{children}</div>
    </div>
  </div>
);

// Active Targets tile with an active/total progress bar
const TargetTile = ({ active, total }: { active: number; total: number }) => {
  const pct = total > 0 ? Math.round((active / total) * 100) : 0;
  return (
    <div className="h-full rounded-lg border border-border/40 bg-background/70 px-4 py-3 flex items-center gap-3">
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", TONES.sky.bg)}>
        <Target className={cn("h-4 w-4", TONES.sky.text)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={LABEL}>Active Targets</p>
        <p className="text-lg font-bold font-mono tabular-nums leading-tight">
          <span className="text-sky-300">{active}</span><span className="text-muted-foreground"> / {total}</span>
        </p>
        <div className="mt-1.5 h-1 rounded-full bg-secondary/40 overflow-hidden">
          <div className="h-full bg-sky-400 transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
};

// Unified metric tile — colored icon-box + value
const KpiCard = ({ icon: Icon, label, value, sub, valueClass, tone, pulse }: { icon: typeof Wallet; label: string; value: string; sub?: string; valueClass?: string; tone: ToneObj; pulse?: boolean }) => (
  <div className="h-full rounded-lg border border-border/40 bg-background/70 px-4 py-3 flex items-center gap-3">
    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", tone.bg)}>
      <Icon className={cn("h-4 w-4", tone.text, pulse && "animate-pulse")} />
    </div>
    <div className="min-w-0">
      <p className={LABEL}>{label}</p>
      <p className={cn("text-lg font-bold font-mono tabular-nums leading-tight truncate", valueClass)}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground truncate">{sub}</p>}
    </div>
  </div>
);

const UNIT_KEYS: ("s" | "m" | "h")[] = ["s", "m", "h"];

const OptionGroup = ({ icon: Icon, label, first, presets, defaults, value, onChange, onSave }: {
  icon: typeof Timer; label: string; first: { label: string; seconds: number };
  presets: number[]; defaults: number[]; value: number; onChange: (v: number) => void; onSave: (p: number[]) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ n: string; unit: "s" | "m" | "h" }[]>([]);
  const startEdit = (o: boolean) => { if (o) setDraft(presets.map(toUnit)); setOpen(o); };
  const draftSecs = (d: { n: string; unit: "s" | "m" | "h" }) =>
    Math.min(Math.max(1, parseInt(d.n, 10) || 1) * unitMult(d.unit), 86400);
  const apply = () => { onSave(draft.map(draftSecs)); setOpen(false); };
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="flex items-center gap-1.5 shrink-0">
        <Icon className="h-3.5 w-3.5 text-primary/80" />
        <span className={LABEL}>{label}</span>
      </span>
      <div className="flex items-center gap-1.5 flex-wrap">
        <button onClick={() => onChange(first.seconds)} className={cn(PILL, value === first.seconds ? PILL_ON : PILL_OFF)}>
          {first.label}
        </button>
        {presets.map((sec, i) => (
          <button key={i} onClick={() => onChange(sec)} className={cn(PILL, "font-mono", value === sec ? PILL_ON : PILL_OFF)}>
            {fmtPreset(sec)}
          </button>
        ))}
        <Popover open={open} onOpenChange={startEdit}>
          <PopoverTrigger asChild>
            <button title={`Edit ${label} presets`} className={cn(PILL, "px-2.5", PILL_OFF)}>
              <Pencil className="h-3 w-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" sideOffset={6} className="w-64 p-3 bg-popover/95 backdrop-blur border-border/60">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2.5">{label} · presets</p>
            <div className="space-y-2">
              {draft.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-3 text-[10px] font-mono text-muted-foreground shrink-0">{i + 1}</span>
                  <input
                    type="number" min={1} inputMode="numeric" value={d.n}
                    onChange={(e) => setDraft((p) => p.map((x, j) => (j === i ? { ...x, n: e.target.value } : x)))}
                    className="w-16 h-7 rounded-md border border-border/50 bg-background/60 px-2 text-xs font-mono text-foreground outline-none focus:border-primary/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <div className="flex rounded-md border border-border/50 overflow-hidden shrink-0">
                    {UNIT_KEYS.map((u) => (
                      <button key={u} onClick={() => setDraft((p) => p.map((x, j) => (j === i ? { ...x, unit: u } : x)))}
                        className={cn("px-2 py-1 text-[10px] font-mono transition-colors", d.unit === u ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-secondary/30")}>
                        {u}
                      </button>
                    ))}
                  </div>
                  <span className="ml-auto text-[10px] font-mono text-muted-foreground">= {fmtPreset(draftSecs(d))}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-3">
              <button onClick={() => setDraft(defaults.map(toUnit))} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">Reset</button>
              <button onClick={apply} className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md bg-primary/20 border border-primary/40 text-primary text-xs hover:bg-primary/30 transition-colors">
                <Check className="h-3 w-3" /> Save
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};
