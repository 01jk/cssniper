import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  ShoppingCart, Target, Radar, TrendingUp, Play, KeyRound, Loader2,
  Activity, CheckCircle2, XCircle, Bell, AlertTriangle, Info, ChevronLeft, ChevronRight,
} from "lucide-react";
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Tooltip as UITooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { LaunchControl, DashboardLiveStats } from "./LaunchControl";
import { formatCurrency } from "@/data/mockData";
import { useBotStatus } from "@/contexts/BotStatusContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { INotification, NotificationType } from "@/types/notifications";

type Sample = { ms: number; scanned: number; matches: number; buys: number; failed: number };
type Metric = "scanned" | "matches" | "buys";
const METRIC_LABEL: Record<Metric, string> = { scanned: "Items scanned", matches: "Matches", buys: "Buys" };

const RANGES = [
  { label: "1s", ms: 1_000 },
  { label: "1m", ms: 60_000 },
  { label: "5m", ms: 300_000 },
  { label: "15m", ms: 900_000 },
  { label: "1h", ms: 3_600_000 },
];
const BUCKETS = 60;

/* Scanner uses 4 columns, Market Data 5 — each group fills the FULL width of its half,
   so both blocks are the same total width; the square side is width/cols, and the number of
   rows per page is whatever fits the measured height (no scrolling). */
const KEY_COLS: Record<string, number> = { scanner: 4, market_data: 5 };
const KEY_ROWS_FALLBACK = 8; // used only until the panel has been measured
const API_GROUPS = [
  { key: "scanner", label: "Scanner" },
  { key: "market_data", label: "Market Data" },
];
const keyTextFor = (size: number) => (size >= 40 ? "text-xs" : size >= 30 ? "text-[10px]" : "text-[9px]");
const apiColor = (code?: number): string => {
  if (code === 429) return "border-amber-500/60 bg-amber-500/20 text-amber-300";
  if (code && code >= 400) return "border-rose-500/60 bg-rose-500/20 text-rose-300";
  if (code) return "border-emerald-500/60 bg-emerald-500/20 text-emerald-300";
  return "border-border/60 bg-secondary/25 text-muted-foreground";
};
const apiStatusInfo = (code?: number): { label: string; text: string } => {
  if (!code) return { label: "No data yet", text: "text-muted-foreground" };
  if (code === 429) return { label: "Rate limited", text: "text-amber-400" };
  if (code === 403) return { label: "Forbidden", text: "text-rose-400" };
  if (code === 401) return { label: "Unauthorized", text: "text-rose-400" };
  if (code >= 400) return { label: "Error", text: "text-rose-400" };
  return { label: "Healthy", text: "text-emerald-400" };
};
// Scan-cycle latency → traffic-light colour (green fast · amber · red slow)
const latencyTone = (ms: number): string => {
  if (ms <= 0) return "text-foreground";
  if (ms < 150) return "text-emerald-400";
  if (ms < 350) return "text-amber-400";
  return "text-rose-400";
};

const EVENT_STYLE: Record<NotificationType, { icon: typeof Info; color: string }> = {
  error:   { icon: XCircle,       color: "text-rose-400" },
  warning: { icon: AlertTriangle, color: "text-amber-400" },
  success: { icon: CheckCircle2,  color: "text-emerald-400" },
  autobuy: { icon: ShoppingCart,  color: "text-primary" },
  info:    { icon: Info,          color: "text-muted-foreground" },
};

const timeAgo = (d: Date): string => {
  const s = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};
const fmtClock = (ms: number, bucketMs: number): string => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return bucketMs < 60_000 ? `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}` : `${p(d.getHours())}:${p(d.getMinutes())}`;
};

type Point = { label: string; value: number; matchMark: number | null; buyMark: number | null; failedMark: number | null };
/** Real items detected per timeframe-bucket, against real wall-clock time, with match/buy markers. */
function buildSeries(samples: Sample[], bucketMs: number, field: Metric) {
  if (samples.length < 2) return { data: [] as Point[], rate: 0, peak: 0 };
  const now = samples[samples.length - 1].ms;
  const start = Math.max(samples[0].ms, now - BUCKETS * bucketMs);
  const cumAt = (t: number, key: keyof Sample) => {
    let v = samples[0][key];
    for (let i = 0; i < samples.length; i++) { if (samples[i].ms <= t) v = samples[i][key]; else break; }
    return v;
  };
  const count = Math.max(1, Math.ceil((now - start) / bucketMs));
  const data: Point[] = [];
  for (let k = 0; k < count; k++) {
    const bs = start + k * bucketMs;
    const be = Math.min(now, bs + bucketMs);
    const sc = Math.max(0, cumAt(be, "scanned") - cumAt(bs, "scanned"));
    const mt = Math.max(0, cumAt(be, "matches") - cumAt(bs, "matches"));
    const by = Math.max(0, cumAt(be, "buys") - cumAt(bs, "buys"));
    const fl = Math.max(0, cumAt(be, "failed") - cumAt(bs, "failed"));
    const value = field === "scanned" ? sc : field === "matches" ? mt : by;
    data.push({ label: fmtClock(be, bucketMs), value, matchMark: mt > 0 ? value : null, buyMark: by > 0 ? value : null, failedMark: fl > 0 ? value : null });
  }
  return { data, rate: data.length ? data[data.length - 1].value : 0, peak: data.reduce((a, b) => Math.max(a, b.value), 0) };
}

export const Dashboard = () => {
  const { botStatus } = useBotStatus();
  const { notifications, allNotifications } = useNotifications();
  const isRunning = botStatus.isRunning;

  const [liveStats, setLiveStats] = useState<DashboardLiveStats | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [activeTargets, setActiveTargets] = useState(0);
  const [totalTargets, setTotalTargets] = useState(0);
  const [accountStatuses, setAccountStatuses] = useState<Record<string, Record<string, any>>>({});
  const [samples, setSamples] = useState<Sample[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [range, setRange] = useState(RANGES[0].ms);
  const [metric, setMetric] = useState<Metric>("scanned");

  // All metrics + the graph series come straight from the Rust backend.
  const fetchFast = useCallback(async () => {
    try {
      const [statsRes, liveRes, accRes, histRes] = await Promise.all([
        fetch("/api/dashboard/stats"), fetch("/api/live/stats"),
        fetch("/api/accounts/status"), fetch("/api/stats/history"),
      ]);
      if (statsRes.ok) { const s = await statsRes.json(); setActiveTargets(s.active_targets ?? 0); setTotalTargets(s.total_targets ?? 0); }
      if (liveRes.ok) setLiveStats(await liveRes.json());
      if (accRes.ok) setAccountStatuses((await accRes.json()) || {});
      if (histRes.ok) {
        const h = await histRes.json();
        setSamples(((h.samples ?? []) as any[]).map((s) => ({ ms: Number(s.t), scanned: Number(s.scanned) || 0, matches: Number(s.matches) || 0, buys: Number(s.buys) || 0, failed: Number(s.failed) || 0 })));
      }
    } catch { /* keep last known */ }
    finally { setLoaded(true); }
  }, []);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch("/api/csfloat/balance");
      if (!res.ok) return;
      const b = await res.json();
      setBalance(typeof b.balance === "number" ? b.balance / 100 : null);
    } catch { /* keep last known */ }
  }, []);

  const refreshAccounts = useCallback(async () => {
    try { const r = await fetch("/api/accounts/status"); if (r.ok) setAccountStatuses((await r.json()) || {}); } catch { /* ignore */ }
  }, []);

  const testKey = useCallback(async (type: string, index: number) => {
    try { await fetch(`/api/accounts/test?account_type=${type}&index=${index}`, { method: "POST" }); } catch { /* ignore */ }
    await refreshAccounts();
  }, [refreshAccounts]);

  const testAllAccounts = useCallback(async () => {
    try { await fetch("/api/accounts/test-all", { method: "POST" }); } catch { /* ignore */ }
    await refreshAccounts();
  }, [refreshAccounts]);

  // Auto-refresh all key statuses on load + every ~6.5 min
  useEffect(() => {
    testAllAccounts();
    const iv = setInterval(testAllAccounts, 390000);
    return () => clearInterval(iv);
  }, [testAllAccounts]);

  // Re-test shortly after the bot starts so colors appear on their own
  const prevRunningRef = useRef(false);
  useEffect(() => {
    if (isRunning && !prevRunningRef.current) {
      prevRunningRef.current = true;
      const t = setTimeout(testAllAccounts, 6000);
      return () => clearTimeout(t);
    }
    prevRunningRef.current = isRunning;
  }, [isRunning, testAllAccounts]);

  useEffect(() => {
    fetchFast(); fetchBalance();
    const fast = setInterval(fetchFast, 2000);
    const slow = setInterval(fetchBalance, 30000);
    return () => { clearInterval(fast); clearInterval(slow); };
  }, [fetchFast, fetchBalance]);

  // ── Derived (everything real, backend retains values after stop) ─────────
  const display = liveStats;
  const attempts = display?.buy_attempts ?? 0;
  const success = display?.successful_buys ?? 0;
  const failed = display?.failed_buys ?? 0;
  const buySpeed = display?.avg_speed ?? 0;
  const spent = display?.spent ?? 0;

  const effectiveSamples = useMemo(() => {
    if (samples.length >= 2) return samples;
    if (display && (display.scanned_total > 0 || isRunning)) {
      const now = Date.now();
      const scanned = display.scanned_total || 0;
      const matches = display.matches_found || 0;
      const buys = display.successful_buys || 0;
      const failed = display.failed_buys || 0;
      if (samples.length === 1) {
        const first = samples[0];
        if (now - first.ms < 2000) {
          return [
            { ms: now - 5000, scanned: Math.max(0, scanned - Math.round((display.scanned_per_min || 600) / 12)), matches, buys, failed },
            first
          ];
        }
        return [first, { ms: now, scanned, matches, buys, failed }];
      }
      return [
        { ms: now - 60000, scanned: Math.max(0, scanned - (display.scanned_per_min || 600)), matches, buys, failed },
        { ms: now, scanned, matches, buys, failed }
      ];
    }
    return samples;
  }, [samples, display, isRunning]);

  const chart = useMemo(() => buildSeries(effectiveSamples, range, metric), [effectiveSamples, range, metric]);

  // Measure the keys area so squares can size themselves to fill the page exactly
  const [keysEl, setKeysEl] = useState<HTMLDivElement | null>(null);
  const [keysBox, setKeysBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!keysEl) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setKeysBox({ w: r.width, h: r.height });
    });
    ro.observe(keysEl);
    return () => ro.disconnect();
  }, [keysEl]);

  // ONE uniform square size for both groups (→ identical square height); the two blocks take
  // proportional widths (scanner 4 cols, market 5 cols) so neither has dead space, and both use
  // the same number of rows so their total heights match. Rows fit the measured height (no scroll).
  const keyGeom = useMemo(() => {
    const GAP = 4, LABEL_H = 22, GROUP_GAP = 24;
    const sc = KEY_COLS.scanner, mc = KEY_COLS.market_data;
    const availH = Math.max(0, keysBox.h - LABEL_H);
    const measured = keysBox.w > 40 && availH > 8;
    const squareCols = sc + mc;
    const innerGaps = (sc - 1) + (mc - 1);
    const size = measured ? Math.max(20, Math.floor((keysBox.w - GROUP_GAP - innerGaps * GAP) / squareCols)) : 0;
    const rows = measured ? Math.max(1, Math.floor((availH + GAP) / (size + GAP))) : KEY_ROWS_FALLBACK;
    const wOf = (cols: number) => (measured ? cols * size + (cols - 1) * GAP : 0);
    const groups: Record<string, { cols: number; width: number; pageSize: number }> = {
      scanner: { cols: sc, width: wOf(sc), pageSize: sc * rows },
      market_data: { cols: mc, width: wOf(mc), pageSize: mc * rows },
    };
    return { size, groups };
  }, [keysBox]);

  // API-keys pagination — flip pages with the header chevrons instead of scrolling
  const [keyPage, setKeyPage] = useState(0);
  const keyPages = useMemo(() => {
    const perGroup = API_GROUPS.map((g) => Math.ceil(Object.keys(accountStatuses[g.key] || {}).length / keyGeom.groups[g.key].pageSize));
    return Math.max(1, ...perGroup);
  }, [accountStatuses, keyGeom]);
  useEffect(() => { if (keyPage >= keyPages) setKeyPage(0); }, [keyPages, keyPage]);

  // Most recent match / successful buy timestamps from the Rust stats history
  const lastEvents = useMemo(() => {
    let match: number | null = null, buy: number | null = null;
    for (let i = 1; i < effectiveSamples.length; i++) {
      if (effectiveSamples[i].matches > effectiveSamples[i - 1].matches) match = effectiveSamples[i].ms;
      if (effectiveSamples[i].buys > effectiveSamples[i - 1].buys) buy = effectiveSamples[i].ms;
    }
    return { match, buy };
  }, [effectiveSamples]);
  const hasSession = effectiveSamples.length > 0 || isRunning || Boolean(display && display.scanned_total > 0);

  const events = [...(allNotifications && allNotifications.length > 0 ? allNotifications : notifications)].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  const apiCounts = useMemo(() => {
    let ok = 0, limited = 0, err = 0, gray = 0, total = 0;
    for (const g of API_GROUPS) {
      const m = accountStatuses[g.key]; if (!m) continue;
      for (const k in m) {
        total++;
        if (m[k]?.enabled === false) { gray++; continue; }
        const code = Number(m[k]?.status_code);
        if (code === 429) limited++;
        else if (code >= 400) err++;
        else if (code) ok++;
        else gray++;
      }
    }
    return { ok, limited, err, gray, total };
  }, [accountStatuses]);

  return (
    <div className="h-full overflow-auto p-5 bg-background">
      <div className="max-w-7xl mx-auto space-y-4">

        <LaunchControl liveStats={liveStats} activeTargets={activeTargets} totalTargets={totalTargets} balance={balance} display={display} hasSession={hasSession} keyStats={apiCounts} lastMatchAt={lastEvents.match} lastBuyAt={lastEvents.buy} />

        {/* Telemetry row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">

          {/* Throughput chart */}
          <Panel className="lg:col-span-2 flex flex-col">
            <PanelHeader icon={Radar} title="Scanner Throughput" right={
              <div className="flex items-center gap-2">
                <Seg value={metric} onChange={(v) => setMetric(v as Metric)} options={[{ label: "Scanned", value: "scanned" }, { label: "Matches", value: "matches" }, { label: "Buys", value: "buys" }]} />
                <Seg mono value={String(range)} onChange={(v) => setRange(Number(v))} options={RANGES.map((r) => ({ label: r.label, value: String(r.ms) }))} />
              </div>
            } />
            <div className="p-5 flex flex-col flex-1 gap-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg border border-border/40 bg-background/70 px-3 py-2.5 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Scanned</p>
                    <p className="text-lg font-bold font-mono tabular-nums">{display ? display.scanned_total.toLocaleString() : "—"}</p>
                  </div>
                  {hasSession && (
                    /* metric-in-metric: slim rectangles, value first then label */
                    <div className="flex flex-col items-stretch gap-1 shrink-0 pt-0.5">
                      <span className="flex items-baseline justify-between gap-1.5 rounded-[4px] border border-emerald-500/25 bg-emerald-500/[0.07] px-1.5 py-[3px] leading-none">
                        <span className="text-[11px] font-mono font-semibold tabular-nums text-emerald-400">{chart.rate}</span>
                        <span className="text-[8px] uppercase tracking-[0.12em] text-muted-foreground">now</span>
                      </span>
                      <span className="flex items-baseline justify-between gap-1.5 rounded-[4px] border border-border/40 bg-background/60 px-1.5 py-[3px] leading-none">
                        <span className="text-[11px] font-mono font-semibold tabular-nums text-foreground">{chart.peak}</span>
                        <span className="text-[8px] uppercase tracking-[0.12em] text-muted-foreground">peak</span>
                      </span>
                    </div>
                  )}
                </div>
                <Stat label="Scan / min" value={display ? String(display.scanned_per_min) : "—"} valueClass="text-emerald-400" />
                <Stat label="Latency" value={display ? `${display.latency} ms` : "—"} valueClass={display ? latencyTone(display.latency) : undefined} />
                <Stat label="Buy speed" value={display && display.successful_buys > 0 && buySpeed > 0 ? `${buySpeed} ms` : "—"} />
              </div>
              <div className="flex flex-col flex-1 min-h-[200px]">
                <div className="flex-1 min-h-[180px]">
                  {!hasSession ? (
                    <div className="h-full flex flex-col items-center justify-center text-center gap-2 rounded-lg border border-dashed border-border/50">
                      <div className="w-11 h-11 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center">
                        <Play className="h-5 w-5 text-emerald-400 ml-0.5" />
                      </div>
                      <p className="text-sm font-medium">Press <span className="text-emerald-400">START</span> to begin</p>
                      <p className="text-xs text-muted-foreground">Live telemetry plots here in real time</p>
                    </div>
                  ) : chart.data.length < 2 ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground/60">Recording…</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chart.data} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="scanGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(160 75% 36%)" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="hsl(160 75% 36%)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(215 20% 45%)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={40} />
                        <YAxis tick={{ fontSize: 10, fill: "hsl(215 20% 45%)" }} axisLine={false} tickLine={false} allowDecimals={false} width={30} domain={[0, "dataMax"]} />
                        <Tooltip cursor={{ stroke: "rgba(255,255,255,0.10)" }} content={(p: any) => <ChartTip {...p} metric={metric} />} />
                        <Area type="monotone" dataKey="value" stroke="hsl(160 75% 42%)" strokeWidth={2} fill="url(#scanGrad)" isAnimationActive={false} />
                        {metric === "scanned" && <Line type="monotone" dataKey="matchMark" stroke="none" dot={{ r: 3, fill: "hsl(45 93% 58%)", strokeWidth: 0 }} activeDot={{ r: 4 }} isAnimationActive={false} connectNulls={false} />}
                        {metric === "scanned" && <Line type="monotone" dataKey="failedMark" stroke="none" dot={{ r: 3, fill: "hsl(347 80% 58%)", strokeWidth: 0 }} activeDot={{ r: 4 }} isAnimationActive={false} connectNulls={false} />}
                        {metric === "scanned" && <Line type="monotone" dataKey="buyMark" stroke="none" dot={{ r: 3.5, fill: "hsl(239 84% 67%)", stroke: "#0b0f17", strokeWidth: 1 }} activeDot={{ r: 4.5 }} isAnimationActive={false} connectNulls={false} />}
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          </Panel>

          {/* API keys — paged, no scrolling */}
          <Panel className="flex flex-col">
            <PanelHeader icon={KeyRound} title="API Keys" right={
              <div className="flex items-center gap-2.5 text-[11px] font-mono">
                <span title="Healthy" className="flex items-center gap-1 text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{apiCounts.ok}</span>
                <span title="Rate limited (429)" className="flex items-center gap-1 text-amber-400"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />{apiCounts.limited}</span>
                <span title="Errors" className="flex items-center gap-1 text-rose-400"><span className="w-1.5 h-1.5 rounded-full bg-rose-400" />{apiCounts.err}</span>
                <span title="Disabled / no data" className="flex items-center gap-1 text-muted-foreground"><span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />{apiCounts.gray}</span>
                <div className="flex items-center gap-1 ml-2.5">
                  <button onClick={() => setKeyPage((p) => (p - 1 + keyPages) % keyPages)} disabled={keyPages <= 1} title="Previous page"
                    className="w-5 h-5 rounded border border-border/50 bg-background/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-40 disabled:cursor-default disabled:hover:text-muted-foreground disabled:hover:border-border/50">
                    <ChevronLeft className="h-3 w-3" />
                  </button>
                  <span className="text-[10px] text-muted-foreground tabular-nums px-0.5">{keyPage + 1}/{keyPages}</span>
                  <button onClick={() => setKeyPage((p) => (p + 1) % keyPages)} disabled={keyPages <= 1} title="Next page"
                    className="w-5 h-5 rounded border border-border/50 bg-background/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-40 disabled:cursor-default disabled:hover:text-muted-foreground disabled:hover:border-border/50">
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            } />
            <div className="flex-1 p-4 min-h-0">
              {apiCounts.total === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
                  <KeyRound className="h-8 w-8 mb-2 opacity-25" />
                  <p className="text-sm">No API keys reporting</p>
                  <p className="text-xs opacity-60">Start the bot to see key status</p>
                </div>
              ) : (
                <div ref={setKeysEl} className="flex justify-center gap-6 h-full">
                  {API_GROUPS.map((g) => {
                    const entries = Object.entries(accountStatuses[g.key] || {}).sort((a, b) => Number(a[0]) - Number(b[0]));
                    if (!entries.length) return null;
                    const gm = keyGeom.groups[g.key];
                    const size = keyGeom.size;
                    const pageEntries = entries.slice(keyPage * gm.pageSize, (keyPage + 1) * gm.pageSize);
                    return (
                      <div key={g.key} className="flex flex-col min-h-0" style={gm.width ? { width: gm.width } : { flex: 1 }}>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground text-center mb-1.5 shrink-0">{g.label}</p>
                        {pageEntries.length ? (
                          <div className="grid min-h-0"
                            style={{
                              gridTemplateColumns: size ? `repeat(${gm.cols}, ${size}px)` : `repeat(${gm.cols}, minmax(0, 1fr))`,
                              gridAutoRows: size ? `${size}px` : "1fr",
                              gap: 4,
                              alignContent: "start",
                            }}>
                            {pageEntries.map(([idx, s]) => (
                              <KeySquare key={idx} typeKey={g.key} group={g.label} n={Number(idx) + 1} index={Number(idx)} code={Number((s as any)?.status_code) || undefined} enabled={(s as any)?.enabled !== false} textCls={keyTextFor(size)} onRefresh={refreshAccounts} />
                            ))}
                          </div>
                        ) : (
                          <p className="text-center text-[10px] text-muted-foreground/50 py-3">— no keys on this page —</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Panel>
        </div>

        {/* Events + API keys */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel className="lg:col-span-2 flex flex-col h-[320px]">
            <PanelHeader icon={Bell} title="System Events" right={
              <Badge variant="outline" className="text-[10px] font-mono uppercase tracking-wider border-border/60 text-muted-foreground gap-1.5">
                <Activity className="h-3 w-3 text-emerald-400" /> {events.length} total
              </Badge>
            } />
            <div className="flex-1 overflow-y-auto p-2.5 space-y-0.5">
              {events.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
                  <Bell className="h-8 w-8 mb-2 opacity-25" />
                  <p className="text-sm">No events yet</p>
                  <p className="text-xs opacity-60">Errors, rate-limits, proxy issues &amp; buys appear here</p>
                </div>
              ) : events.map((ev: INotification) => {
                const stl = EVENT_STYLE[ev.type] ?? EVENT_STYLE.info; const Icon = stl.icon;
                return (
                  <div key={ev.id} className="flex items-start gap-3 py-2 px-2.5 rounded-lg hover:bg-secondary/20 transition-colors">
                    <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", stl.color)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{ev.title || ev.type}</span>
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 shrink-0 uppercase tracking-wider text-muted-foreground border-border/60">{ev.source}</Badge>
                      </div>
                      {ev.message && <p className="text-xs text-muted-foreground truncate">{ev.message}</p>}
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground shrink-0">{timeAgo(ev.timestamp)}</span>
                  </div>
                );
              })}
            </div>
          </Panel>

          {/* Buy outcomes */}
          <Panel className="flex flex-col h-[320px]">
            <PanelHeader icon={ShoppingCart} title="Buy Outcomes" />
            <div className="p-4 flex flex-col flex-1 gap-3 min-h-0">
              <div className="flex items-center justify-center"><Donut pct={attempts > 0 ? Math.round((success / attempts) * 100) : 0} /></div>
              <div className="space-y-2.5">
                <OutcomeRow color="text-emerald-400" label="Successful" value={success} total={attempts} bar="bg-emerald-500" />
                <OutcomeRow color="text-rose-400" label="Failed" value={failed} total={attempts} bar="bg-rose-500" />
              </div>
              <div className="mt-auto grid grid-cols-2 gap-3 pt-2.5 border-t border-border/50">
                <MiniFact label="Attempts" value={String(attempts)} />
                <MiniFact label="Spent" value={formatCurrency(spent)} />
              </div>
            </div>
          </Panel>
        </div>

      </div>
    </div>
  );
};

// ── Primitives ──────────────────────────────────────────────────────────
const PANEL = "rounded-xl border border-border/50 bg-card/60";
const Panel = ({ className, children }: { className?: string; children: React.ReactNode }) => <div className={cn(PANEL, className)}>{children}</div>;

const PanelHeader = ({ icon: Icon, title, right }: { icon: typeof Target; title: string; right?: React.ReactNode }) => (
  <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/40 shrink-0 gap-2">
    <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-primary" /><span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/70">{title}</span></div>
    {right}
  </div>
);

const Seg = ({ options, value, onChange, mono }: { options: { label: string; value: string }[]; value: string; onChange: (v: string) => void; mono?: boolean }) => (
  <div className="flex p-[2px] gap-0.5 rounded-md border border-border/40 bg-background/60">
    {options.map((o) => (
      <button key={o.value} onClick={() => onChange(o.value)}
        className={cn(
          "px-2 py-0.5 text-[11px] rounded-[4px] transition-all duration-150 cursor-pointer select-none",
          mono && "font-mono",
          value === o.value
            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 shadow-[0_0_8px_rgba(16,185,129,0.15)] font-medium"
            : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04] border border-transparent"
        )}>
        {o.label}
      </button>
    ))}
  </div>
);

const ChartTip = ({ active, payload, label, metric }: any) => {
  if (!active || !payload?.length) return null;
  const get = (k: string) => { const p = payload.find((x: any) => x.dataKey === k); return p ? p.value : null; };
  const scanned = get("value");
  const events: { text: string; cls: string }[] = [];
  if (get("matchMark") != null) events.push({ text: "Match found", cls: "text-amber-400" });
  if (get("failedMark") != null) events.push({ text: "Buy failed", cls: "text-rose-400" });
  if (get("buyMark") != null) events.push({ text: "Buy", cls: "text-primary" });
  const vLabel = metric === "scanned" ? "Scanned" : metric === "matches" ? "Matches" : "Buys";
  return (
    <div className="rounded-lg border border-border/60 bg-popover/95 backdrop-blur px-3 py-2 text-xs font-mono space-y-0.5 shadow-xl">
      <p className="text-muted-foreground">{label}</p>
      {events.map((e, i) => <p key={i} className={cn("font-semibold", e.cls)}>{e.text}</p>)}
      <p className="text-muted-foreground">{vLabel} <span className="text-emerald-400 font-semibold">{scanned ?? 0}</span></p>
    </div>
  );
};

const Stat = ({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) => (
  <div className="rounded-lg border border-border/40 bg-background/70 px-3 py-2.5">
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
    <p className={cn("text-lg font-bold font-mono tabular-nums", valueClass)}>{value}</p>
  </div>
);

const MiniFact = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="text-base font-bold font-mono tabular-nums">{value}</p>
  </div>
);

const OutcomeRow = ({ color, label, value, total, bar }: { color: string; label: string; value: number; total: number; bar: string }) => {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5"><span className={cn("text-sm", color)}>{label}</span><span className="text-sm font-mono font-semibold">{value}</span></div>
      <div className="h-1.5 rounded-full bg-secondary/30 overflow-hidden"><div className={cn("h-full transition-all duration-500", bar)} style={{ width: `${pct}%` }} /></div>
    </div>
  );
};

const KeySquare = ({ typeKey, group, n, index, code, enabled = true, textCls = "text-[10px]", onRefresh }: {
  typeKey: string; group: string; n: number; index: number; code?: number; enabled?: boolean; textCls?: string; onRefresh: () => void | Promise<void>;
}) => {
  const [testing, setTesting] = useState(false);
  const [open, setOpen] = useState(false); // open strictly follows hover on the square itself
  const info = enabled ? apiStatusInfo(code) : { label: "Disabled", text: "text-muted-foreground" };
  const colorCls = enabled ? apiColor(code) : "border-border/50 bg-secondary/20 text-muted-foreground";
  const test = async () => {
    if (testing) return;
    setTesting(true);
    try { await fetch(`/api/accounts/test?account_type=${typeKey}&index=${index}`, { method: "POST" }); } catch { /* ignore */ }
    try { await onRefresh(); } catch { /* ignore */ }
    setTimeout(() => setTesting(false), 250);
  };
  return (
    <UITooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button onClick={test} disabled={testing}
          onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
          className={cn("w-full h-full rounded-[5px] border flex items-center justify-center font-mono transition-all hover:brightness-125 cursor-pointer", textCls, colorCls, !enabled && "opacity-50", testing && "opacity-60")}>
          {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : n}
        </button>
      </TooltipTrigger>
      {/* pointer-events-none: moving onto the tooltip can't keep it alive — it dies with the hover */}
      <TooltipContent side="top" className="text-xs pointer-events-none">
        <p className="font-semibold">{group} · key #{n}</p>
        <p className={cn("font-mono", info.text)}>{info.label}{enabled && code ? ` · HTTP ${code}` : ""}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">Click to re-test</p>
      </TooltipContent>
    </UITooltip>
  );
};

const Donut = ({ pct }: { pct: number }) => {
  const R = 38, C = 2 * Math.PI * R;
  const off = C * (1 - Math.max(0, Math.min(100, pct)) / 100);
  return (
    <div className="relative w-[104px] h-[104px]">
      <svg width="104" height="104" viewBox="0 0 104 104" className="-rotate-90">
        <circle cx="52" cy="52" r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="9" />
        <circle cx="52" cy="52" r={R} fill="none" stroke="hsl(160 75% 38%)" strokeWidth="9" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={off} style={{ transition: "stroke-dashoffset 0.5s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold font-mono text-emerald-400 leading-none">{pct}%</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">success</span>
      </div>
    </div>
  );
};
