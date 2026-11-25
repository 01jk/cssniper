import { useState, useEffect, useCallback } from "react";
import { Wallet, Wifi, Zap, Clock, BarChart3 } from "lucide-react";
import { useBotStatus } from "@/contexts/BotStatusContext";

const getPingColor = (ms: number | null) => {
  if (ms === null) return "text-muted-foreground";
  if (ms < 30) return "text-accent";
  if (ms < 60) return "text-yellow-400";
  return "text-destructive";
};

const getLatencyColor = (ms: number) => {
  if (ms <= 500) return "text-accent";
  if (ms <= 1000) return "text-yellow-400";
  return "text-destructive";
};

const formatSessionTime = (seconds: number) => {
  const days = Math.floor(seconds / 86400);
  if (days >= 1) return `${days}d`;
  const h = Math.floor(seconds / 3600);
  if (h >= 1) return `${h}h`;
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

export const MonitorStatusBar = () => {
  const { botStatus, ping, fetchPing } = useBotStatus();
  const [balance, setBalance] = useState<number | null>(null);
  const [showSessionTime, setShowSessionTime] = useState(false);
  const [time, setTime] = useState(new Date());
  const [balanceRefreshing, setBalanceRefreshing] = useState(false);
  const [pingRefreshing, setPingRefreshing] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch("/api/csfloat/balance");
      if (!res.ok) return;
      const data = await res.json();
      setBalance(typeof data.balance === "number" ? data.balance / 100 : null);
    } catch {
      setBalance(null);
    }
  }, []);

  useEffect(() => {
    fetchBalance();
    const balanceInterval = setInterval(fetchBalance, 30000);
    return () => {
      clearInterval(balanceInterval);
    };
  }, [fetchBalance]);

  const pingMs = ping?.latency_ms ?? null;
  const buySpeed = botStatus.scanLatency > 0 ? botStatus.scanLatency : 0;
  const buySpeedMs = Math.round(buySpeed * 1000);
  const latencyColor = getLatencyColor(buySpeedMs);
  const isRunning = botStatus.isRunning;
  const sessionSeconds = botStatus.uptime;

  const handleBalanceRefresh = async () => {
    if (balanceRefreshing) return;
    setBalanceRefreshing(true);
    await fetchBalance();
    setTimeout(() => setBalanceRefreshing(false), 600);
  };

  const handlePingRefresh = async () => {
    if (pingRefreshing) return;
    setPingRefreshing(true);
    await fetchPing();
    setTimeout(() => setPingRefreshing(false), 600);
  };

  return (
    <div className="flex items-center gap-[4px] 2xl:gap-[8.6px] shrink-0">
      {/* Balance — click to refresh */}
      <button
        onClick={handleBalanceRefresh}
        className="flex items-center gap-[2px] 2xl:gap-[4.3px] hover:opacity-80 transition-opacity cursor-pointer"
        title="Click to refresh balance"
      >
        <Wallet className={`h-[11px] w-[11px] 2xl:h-[13px] 2xl:w-[13px] text-violet-400 shrink-0 ${balanceRefreshing ? "animate-spin" : ""}`} />
        <span className={`text-[10px] 2xl:text-[12.8px] font-mono font-semibold text-violet-400 tabular-nums slashed-zero inline-block min-w-[48px] 2xl:min-w-[60px] transition-opacity ${balanceRefreshing ? "opacity-50" : ""}`}>
          {balance !== null ? `$${balance.toFixed(2)}` : "$0.00"}
        </span>
      </button>

      <div className="w-px h-[14px] 2xl:h-[17px] bg-border/30 shrink-0" />

      {/* Ping — click to refresh */}
      <button
        onClick={handlePingRefresh}
        className="flex items-center gap-[2px] 2xl:gap-[4.3px] hover:opacity-80 transition-opacity cursor-pointer"
        title="Click to refresh ping"
      >
        <Wifi className={`h-[11px] w-[11px] 2xl:h-[13px] 2xl:w-[13px] shrink-0 ${getPingColor(pingMs)} ${pingRefreshing ? "animate-spin" : ""}`} />
        <span className={`text-[10px] 2xl:text-[12.8px] font-mono font-semibold tabular-nums slashed-zero inline-block min-w-[28px] 2xl:min-w-[36.5px] ${getPingColor(pingMs)} ${pingRefreshing ? "opacity-50" : ""} transition-opacity`}>
          {pingMs !== null ? `${pingMs}ms` : "--"}
        </span>
      </button>

      <div className="w-px h-[14px] 2xl:h-[17px] bg-border/30 shrink-0" />

      {/* Buy Speed */}
      <div className="flex items-center gap-[2px] 2xl:gap-[4.3px]">
        <Zap className={`h-[11px] w-[11px] 2xl:h-[13px] 2xl:w-[13px] shrink-0 ${latencyColor}`} />
        <span className={`text-[10px] 2xl:text-[12.8px] font-mono font-semibold tabular-nums slashed-zero inline-block min-w-[38px] 2xl:min-w-[45px] ${latencyColor}`}>
          {buySpeed.toFixed(3)}s
        </span>
      </div>

      <div className="w-px h-[14px] 2xl:h-[17px] bg-border/30 shrink-0" />

      {/* Time */}
      <button
        className="flex items-center gap-[2px] 2xl:gap-[4.3px] hover:opacity-80 transition-opacity"
        onClick={() => setShowSessionTime((v) => !v)}
        title={showSessionTime ? "Session uptime" : "Current time"}
      >
        <Clock className={`h-[11px] w-[11px] 2xl:h-[13px] 2xl:w-[13px] shrink-0 ${showSessionTime ? "text-accent" : "text-primary"}`} />
        <span className={`text-[10px] 2xl:text-[12.8px] font-mono font-semibold tabular-nums slashed-zero inline-block min-w-[48px] 2xl:min-w-[58px] ${showSessionTime ? "text-accent" : "text-primary"}`}>
          {showSessionTime
            ? (isRunning ? formatSessionTime(sessionSeconds) : "00:00")
            : time.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
      </button>
    </div>
  );
};
