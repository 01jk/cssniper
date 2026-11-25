import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Zap, Wifi, Circle, ChevronUp, ChevronDown, Clock, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBotStatus } from "@/contexts/BotStatusContext";

const getLatencyColor = (secs: number) => {
  if (secs <= 0.5) return "text-accent";
  if (secs <= 1.0) return "text-yellow-400";
  return "text-destructive";
};

const getPingColor = (ms: number | null) => {
  if (ms === null) return "text-muted-foreground";
  if (ms < 30) return "text-accent";
  if (ms < 60) return "text-yellow-400";
  return "text-destructive";
};

const formatUptime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

const formatBalance = (cents: number): string =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

export const LiveStatusBar = () => {
  const { botStatus, ping, fetchPing } = useBotStatus();
  const [balance, setBalance] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("bot-widget-collapsed") === "true"; } catch { return false; }
  });
  const [showSessionTime, setShowSessionTime] = useState(false);
  const [localTime, setLocalTime] = useState("");

  const fetchBalance = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/csfloat/balance");
      if (res.ok) {
        const b = await res.json();
        setBalance(b.balance ?? null);
      }
    } catch { }
    finally { setIsRefreshing(false); }
  }, []);

  const handleRefresh = useCallback(() => {
    fetchBalance();
    fetchPing();
  }, [fetchBalance, fetchPing]);

  useEffect(() => {
    fetchBalance();
    const iv = setInterval(fetchBalance, 30000);
    return () => clearInterval(iv);
  }, [fetchBalance]);

  useEffect(() => {
    const update = () => {
      setLocalTime(new Date().toLocaleTimeString("en-GB", { hour12: false }));
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, []);

  const toggleCollapsed = (val: boolean) => {
    setCollapsed(val);
    try { localStorage.setItem("bot-widget-collapsed", String(val)); } catch {}
  };

  const isLive = botStatus.isRunning;
  const pingMs = ping?.latency_ms ?? null;
  const latencySecs = botStatus.scanLatency ?? 0;
  const latencyColor = getLatencyColor(latencySecs);
  const pingColor = getPingColor(pingMs);

  if (collapsed) {
    return (
      <button
        data-live-status-bar="true"
        onClick={() => toggleCollapsed(false)}
        className="fixed top-3 right-3 z-50 flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/95 backdrop-blur-md px-2.5 py-1.5 shadow-lg hover:bg-secondary/80 transition-colors"
      >
        <Circle
          className={`h-1.5 w-1.5 fill-current ${isLive ? "text-accent animate-pulse" : "text-destructive"}`}
        />
        <ChevronDown className="h-2.5 w-2.5 text-muted-foreground" />
      </button>
    );
  }

  return (
    <div data-live-status-bar="true" className="fixed top-3 right-3 z-50 flex items-center gap-2.5 rounded-lg border border-border/60 bg-card/95 backdrop-blur-md px-2.5 py-1 shadow-lg select-none">
      {/* Live status dot + label */}
      <div className="flex items-center gap-1.5">
        <Circle
          className={`h-2 w-2 fill-current ${isLive ? "text-accent animate-pulse" : "text-destructive"}`}
        />
        <span className={`text-[11px] font-semibold ${isLive ? "text-accent" : "text-destructive"}`}>
          {isLive ? "LIVE" : "OFF"}
        </span>
      </div>

      <div className="w-px h-3.5 bg-border/60" />

      {/* Balance */}
      <div className="flex items-center gap-1" title="Balance">
        <Wallet className="h-3 w-3 text-[#8b5cf6]" />
        <span className="text-[11px] font-mono font-semibold text-[#8b5cf6]">
          {balance !== null ? formatBalance(balance) : "$0.00"}
        </span>
      </div>

      <div className="w-px h-3.5 bg-border/60" />

      {/* Ping */}
      <div className="flex items-center gap-1" title="CSFloat Ping">
        <Wifi className={`h-3 w-3 ${pingColor}`} />
        <span className={`text-[11px] font-mono font-semibold ${pingColor}`}>
          {pingMs !== null ? `${pingMs}ms` : "—"}
        </span>
      </div>

      <div className="w-px h-3.5 bg-border/60" />

      {/* Scan latency */}
      <div className="flex items-center gap-1" title="Scan Latency">
        <Zap className={`h-3 w-3 ${latencyColor}`} />
        <span className={`text-[11px] font-mono font-semibold ${latencyColor}`}>
          {latencySecs > 0 ? `${latencySecs.toFixed(3)}s` : "0.000s"}
        </span>
      </div>

      <div className="w-px h-3.5 bg-border/60" />

      {/* Time / Session toggle */}
      <button
        className="flex items-center gap-1 hover:opacity-80 transition-opacity"
        onClick={() => setShowSessionTime((v) => !v)}
        title={showSessionTime ? "Session uptime (click for clock)" : "Local time (click for uptime)"}
      >
        <Clock className={`h-3 w-3 ${showSessionTime ? "text-accent" : "text-muted-foreground"}`} />
        <span className={`text-[11px] font-mono ${showSessionTime ? "text-accent" : "text-muted-foreground"}`}>
          {showSessionTime
            ? (isLive ? formatUptime(botStatus.uptime) : "00:00:00")
            : localTime}
        </span>
      </button>

      <div className="w-px h-3.5 bg-border/60" />

      {/* Refresh & Collapse */}
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-2.5 w-2.5 ${isRefreshing ? "animate-spin" : ""}`} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={() => toggleCollapsed(true)}
        >
          <ChevronUp className="h-2.5 w-2.5" />
        </Button>
      </div>
    </div>
  );
};
