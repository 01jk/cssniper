import { Power, Activity, Clock, Target, Wifi } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useRef, useCallback } from "react";
import { getSoundSettings } from "@/contexts/SoundSettingsContext";
import { useBotStatus } from "@/contexts/BotStatusContext";

interface BotStatusProps {
  isRunning: boolean;
  pid?: number | null;
  uptime?: number | null;      // seconds
  startTime?: string | null;   // ISO string
  activeTargets?: number;
}

interface StatusCardProps {
  status: BotStatusProps;
  onToggle: () => void;
}

const HOLD_DURATION = 1200; // ms to hold before toggle

const formatUptime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};



export const StatusCard = ({ status, onToggle }: StatusCardProps) => {
  const { ping, fetchPing } = useBotStatus();
  // ── Uptime counter ────────────────────────────────────────────────────────
  const [liveUptime, setLiveUptime] = useState<number>(status.uptime ?? 0);

  useEffect(() => {
    setLiveUptime(status.uptime ?? 0);
  }, [status.uptime]);

  useEffect(() => {
    if (!status.isRunning) return;
    const iv = setInterval(() => setLiveUptime((p: number) => p + 1), 1000);
    return () => clearInterval(iv);
  }, [status.isRunning]);

  // ── Hold-to-toggle ────────────────────────────────────────────────────────
  const [holdProgress, setHoldProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setInterval>>();
  const holdStart = useRef(0);
  const triggered = useRef(false);

  const playToggleSound = useCallback((starting: boolean) => {
    const soundSettings = getSoundSettings();
    if (!soundSettings.enabled || soundSettings.volume === 0) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const vol = soundSettings.volume / 100;
      if (starting) {
        [0, 0.08, 0.16, 0.24].forEach((offset, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime([400, 600, 800, 1200][i], ctx.currentTime + offset);
          gain.gain.setValueAtTime(0, ctx.currentTime + offset);
          gain.gain.linearRampToValueAtTime(0.15 * vol, ctx.currentTime + offset + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.12);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + offset);
          osc.stop(ctx.currentTime + offset + 0.15);
        });
      } else {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.15 * vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch { }
  }, []);

  const startHold = useCallback(() => {
    triggered.current = false;
    holdStart.current = Date.now();
    setIsHolding(true);
    setHoldProgress(0);
    holdTimer.current = setInterval(() => {
      const elapsed = Date.now() - holdStart.current;
      const pct = Math.min(elapsed / HOLD_DURATION, 1);
      setHoldProgress(pct);
      if (pct >= 1 && !triggered.current) {
        triggered.current = true;
        clearInterval(holdTimer.current);
        playToggleSound(!status.isRunning);
        setShowFlash(true);
        setTimeout(() => setShowFlash(false), 500);
        onToggle();
        setIsHolding(false);
        setHoldProgress(0);
      }
    }, 16);
  }, [onToggle, status.isRunning, playToggleSound]);

  const endHold = useCallback(() => {
    if (holdTimer.current) clearInterval(holdTimer.current);
    setIsHolding(false);
    setHoldProgress(0);
  }, []);

  useEffect(() => {
    return () => { if (holdTimer.current) clearInterval(holdTimer.current); };
  }, []);

  // ── Ping (Removed local fetching, now using context) ─────────────────────
  const [pinging, setPinging] = useState(false);

  const handleManualPing = async () => {
    setPinging(true);
    await fetchPing();
    setPinging(false);
  };

  const pingColor =
    !ping || !ping.ok || ping.latency_ms === null
      ? "text-muted-foreground bg-muted border-border"
      : ping.latency_ms < 100
        ? "text-green-400 bg-green-400/20 border-green-400/50"
        : ping.latency_ms < 300
          ? "text-yellow-400 bg-yellow-400/20 border-yellow-400/50"
          : "text-destructive bg-destructive/20 border-destructive/50";

  const pingLabel =
    pinging
      ? "..."
      : !ping || !ping.ok || ping.latency_ms === null
        ? "—"
        : `${ping.latency_ms} ms`;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Card
      className={`col-span-full overflow-hidden transition-all duration-500 ${showFlash
        ? status.isRunning
          ? "ring-2 ring-accent/60 shadow-[0_0_30px_rgba(var(--accent-rgb,0,200,83),0.3)]"
          : "ring-2 ring-destructive/60 shadow-[0_0_30px_rgba(255,60,60,0.2)]"
        : ""
        }`}
    >
      <CardContent className="p-0">
        <div className="flex items-stretch">
          {/* Status indicator */}
          <div
            className={`flex items-center justify-center px-8 transition-colors duration-500 ${status.isRunning
              ? "bg-accent/10 border-r border-accent/30"
              : "bg-destructive/10 border-r border-destructive/30"
              }`}
          >
            <div className="text-center">
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 transition-all duration-500 ${status.isRunning ? "bg-accent/20 animate-pulse-glow" : "bg-destructive/20"
                  }`}
              >
                <Power
                  className={`h-8 w-8 transition-colors duration-500 ${status.isRunning ? "text-accent" : "text-destructive"
                    }`}
                />
              </div>
              <span
                className={`text-lg font-bold transition-colors duration-500 ${status.isRunning ? "text-accent" : "text-destructive"
                  }`}
              >
                {status.isRunning ? "Running" : "Stopped"}
              </span>
            </div>
          </div>

          {/* Details grid */}
          <div className="flex-1 p-6">
            <div className="grid grid-cols-2 gap-6">
              {/* Active Targets */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Active Targets</p>
                  <p className="font-mono text-lg font-semibold">
                    {status.isRunning ? (status.activeTargets ?? "—") : "—"}
                  </p>
                </div>
              </div>

              {/* Uptime */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Uptime</p>
                  <p className="font-mono text-lg font-semibold">
                    {status.isRunning ? formatUptime(liveUptime) : "00:00:00"}
                  </p>
                </div>
              </div>

              {/* Ping */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                  <Wifi className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">CSFloat Ping</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className={`text-sm font-mono px-2 py-0 h-6 ${pingColor}`}>
                      {pingLabel}
                    </Badge>
                    <button
                      onClick={handleManualPing}
                      disabled={pinging}
                      className="text-xs text-muted-foreground hover:text-primary transition-colors disabled:opacity-40"
                    >
                      ↻
                    </button>
                  </div>
                </div>
              </div>

              {/* Hold-to-toggle button */}
              <div className="flex items-center">
                <div className="relative w-full">
                  <Button
                    onMouseDown={startHold}
                    onMouseUp={endHold}
                    onMouseLeave={endHold}
                    onTouchStart={startHold}
                    onTouchEnd={endHold}
                    variant={status.isRunning ? "destructive" : "default"}
                    className={`w-full relative overflow-hidden select-none ${!status.isRunning ? "bg-accent hover:bg-accent/90 text-accent-foreground" : ""
                      }`}
                  >
                    {isHolding && (
                      <div
                        className={`absolute inset-0 transition-none ${status.isRunning ? "bg-destructive/30" : "bg-accent/30"
                          }`}
                        style={{ width: `${holdProgress * 100}%` }}
                      />
                    )}
                    <span className="relative flex items-center justify-center gap-2">
                      <Power className="h-4 w-4" />
                      {isHolding
                        ? `Hold${".".repeat(Math.min(Math.floor(holdProgress * 4), 3))}`
                        : status.isRunning
                          ? "Hold to Stop"
                          : "Hold to Start"}
                    </span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
