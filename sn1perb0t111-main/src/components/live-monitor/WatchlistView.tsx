import React, { useState, useEffect, useCallback } from "react";
import {
  Search, Download, DatabaseZap, Circle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { WatchlistEntry, WatchlistSettings, defaultWatchlistSettings, PriceAlert } from "./watchlist/watchlistTypes";
import { WatchlistTable } from "./watchlist/WatchlistTable";
import { WatchlistSidebar } from "./watchlist/WatchlistSidebar";
import { WatchlistSettingsModal } from "./watchlist/WatchlistSettingsModal";
import { getSoundSettings } from "@/contexts/SoundSettingsContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { WatchlistItem } from "./monitorTypes";
import { useBotStatus } from "@/contexts/BotStatusContext";

interface WatchlistViewProps {
  items?: WatchlistItem[];
  onRemove?: (id: string) => void;
  onUpdateFilters?: (id: string, filters: Partial<WatchlistItem["trackFilters"]>) => void;
  onListingPricesSync?: (updates: Array<{ id: string; oldListingPrice: number; newListingPrice: number; lastMarketCheckAt: string }>) => void;
}

const ALERTS_STORAGE_KEY = "watchlist-market-change-alerts";

const toWatchlistEntry = (item: WatchlistItem, prev?: WatchlistEntry): WatchlistEntry => {
  // Keep old listing price as a stable baseline for the item lifetime in watchlist.
  const baselineOldPrice = prev?.prev_price_usd ?? item.oldListingPrice ?? prev?.price_usd ?? item.price;
  const latestNewPrice = item.newListingPrice ?? item.price;
  const deltaPercent = baselineOldPrice > 0 ? ((latestNewPrice - baselineOldPrice) / baselineOldPrice) * 100 : 0;
  return {
    id: item.id,
    name: item.name,
    market_hash_name: item.name,
    icon_url: item.imageUrl || "/placeholder.svg",
    price_usd: latestNewPrice,
    prev_price_usd: baselineOldPrice,
    delta_percent: Number.isFinite(deltaPercent) ? deltaPercent : 0,
    float_value: item.float,
    float_min: 0,
    float_max: 1,
    paint_seed: item.paintSeed,
    status: prev?.status ?? "active",
    rarity: item.rarity,
    is_stattrak: item.isStatTrak,
    is_souvenir: item.isSouvenir,
    wear: item.wear,
    added_at: item.addedAt instanceof Date ? item.addedAt.toISOString() : new Date(item.addedAt).toISOString(),
    last_updated: new Date().toISOString(),
  };
};

export const WatchlistView: React.FC<WatchlistViewProps> = ({ items, onRemove, onListingPricesSync }) => {
  const { addNotification } = useNotifications();
  const { botStatus } = useBotStatus();
  const [data, setData] = useState<WatchlistEntry[]>(() => {
    if (Array.isArray(items)) {
      return items.map((item) => toWatchlistEntry(item));
    }
    return [];
  });
  const [search, setSearch] = useState("");
  const [alerts, setAlerts] = useState<PriceAlert[]>(() => {
    try {
      const raw = localStorage.getItem(ALERTS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((a: any) => ({
        ...a,
        timestamp: new Date(a.timestamp),
      }));
    } catch {
      return [];
    }
  });
  const [settings, setSettings] = useState<WatchlistSettings>(() => {
    try {
      const stored = localStorage.getItem('watchlist-settings');
      return stored ? JSON.parse(stored) : defaultWatchlistSettings;
    } catch { return defaultWatchlistSettings; }
  });
  const [isMarketCheckLoading, setIsMarketCheckLoading] = useState(false);
  const [hasAutoChecked, setHasAutoChecked] = useState(false);

  useEffect(() => {
    if (!Array.isArray(items)) return;
    setData(prev => {
      const prevById = new Map(prev.map(entry => [entry.id, entry]));
      const next = items.map(item => {
        const existing = prevById.get(item.id);
        const mapped = toWatchlistEntry(item, existing);
        if (!existing) return mapped;

        const unchanged =
          existing.market_hash_name === mapped.market_hash_name &&
          existing.icon_url === mapped.icon_url &&
          existing.price_usd === mapped.price_usd &&
          existing.prev_price_usd === mapped.prev_price_usd &&
          existing.delta_percent === mapped.delta_percent &&
          existing.float_value === mapped.float_value &&
          existing.paint_seed === mapped.paint_seed &&
          existing.status === mapped.status &&
          existing.rarity === mapped.rarity &&
          existing.is_stattrak === mapped.is_stattrak &&
          existing.is_souvenir === mapped.is_souvenir &&
          existing.wear === mapped.wear;

        return unchanged ? existing : mapped;
      });

      if (next.length === prev.length && next.every((entry, idx) => entry === prev[idx])) {
        return prev;
      }

      return next;
    });
  }, [items]);

  useEffect(() => {
    try {
      localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(alerts));
    } catch {}
  }, [alerts]);

  // Play alert sound
  const playAlertSound = useCallback(() => {
    const soundSettings = getSoundSettings();
    if (!settings.sound_enabled || !soundSettings.enabled || soundSettings.volume === 0) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const vol = (settings.sound_volume / 100) * (soundSettings.volume / 100);
      [0, 0.1, 0.2].forEach((offset, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime([660, 880, 1100][i], ctx.currentTime + offset);
        gain.gain.setValueAtTime(0, ctx.currentTime + offset);
        gain.gain.linearRampToValueAtTime(0.12 * vol, ctx.currentTime + offset + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + offset);
        osc.stop(ctx.currentTime + offset + 0.1);
      });
    } catch {}
  }, [settings.sound_enabled, settings.sound_volume]);

  const botIsRunning = botStatus.isRunning;

  // Handlers
  const handleDelete = useCallback((id: string) => {
    setData(prev => prev.filter(i => i.id !== id));
    onRemove?.(id);
    addNotification({
      type: "info",
      source: "system",
      title: "Watchlist updated",
      message: "Item removed from watchlist",
      data: { item_id: id },
    });
  }, [addNotification, onRemove]);

  const handleToggleStatus = useCallback((id: string) => {
    setData(prev => prev.map(i =>
      i.id === id ? { ...i, status: i.status === 'active' ? 'paused' as const : 'active' as const } : i
    ));
  }, []);

  const handleSnipe = useCallback((id: string) => {
    toast({ title: "🎯 Snipe sent!", description: `POST /snipe for ${id.slice(0, 10)}…`, duration: 3000 });
  }, []);

  const handleMarketDataCheck = useCallback(async () => {
    if (data.length === 0 || isMarketCheckLoading) return;

    setIsMarketCheckLoading(true);
    try {
      const res = await fetch("/api/watchlist/check-market-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: data.map((item) => ({
            id: item.id,
            market_hash_name: item.market_hash_name,
            name: item.name,
            old_listing_price: item.prev_price_usd,
            new_listing_price: item.price_usd,
          })),
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        addNotification({
          type: "error",
          source: "market_data",
          title: "Watchlist check failed",
          message: String(payload?.error || `HTTP ${res.status}`),
        });
        return;
      }

      const results = Array.isArray(payload?.results) ? payload.results : [];
      const changes = Array.isArray(payload?.changes) ? payload.changes : [];
      const listingPriceUpdates: Array<{ id: string; oldListingPrice: number; newListingPrice: number; lastMarketCheckAt: string }> = [];

      if (results.length > 0) {
        setData(prev => {
          const byId = new Map(prev.map(item => [item.id, item]));
          let hasChanges = false;

          for (const row of results) {
            const id = String((row || {}).id || "").trim();
            if (!id) continue;
            const entry = byId.get(id);
            if (!entry) continue;

            const oldPriceRaw = (row || {}).old_listing_price;
            const newPriceRaw = (row || {}).new_listing_price ?? (row || {}).listing_price;
            const oldPriceNum = typeof oldPriceRaw === "number" ? oldPriceRaw : Number(oldPriceRaw);
            const newPrice = typeof newPriceRaw === "number" ? newPriceRaw : Number(newPriceRaw);
            if (Number.isFinite(newPrice) && newPrice > 0) {
              const oldPrice = Number.isFinite(oldPriceNum) && oldPriceNum > 0 ? oldPriceNum : entry.prev_price_usd;
              const delta = newPrice - oldPrice;
              const deltaPercent = oldPrice > 0 ? (delta / oldPrice) * 100 : 0;
              const checkedAt = String((row || {}).checked_at || new Date().toISOString());
              listingPriceUpdates.push({
                id,
                oldListingPrice: oldPrice,
                newListingPrice: newPrice,
                lastMarketCheckAt: checkedAt,
              });

              if (entry.price_usd === newPrice && entry.prev_price_usd === oldPrice && entry.delta_percent === deltaPercent) {
                continue;
              }

              hasChanges = true;
              byId.set(id, {
                ...entry,
                prev_price_usd: oldPrice,
                price_usd: newPrice,
                delta_percent: Number.isFinite(deltaPercent) ? deltaPercent : 0,
                last_updated: checkedAt,
              });
            }
          }

          return hasChanges ? Array.from(byId.values()) : prev;
        });
      }

      if (listingPriceUpdates.length > 0) {
        onListingPricesSync?.(listingPriceUpdates);
      }

      if (changes.length > 0) {
        const mappedAlerts: PriceAlert[] = changes.map((change: any, idx: number) => {
          const oldPrice = Number(change?.old_price ?? 0);
          const newPrice = Number(change?.new_price ?? 0);
          const delta = Number(change?.delta ?? (newPrice - oldPrice));
          const deltaPercent = Number(change?.delta_percent ?? (oldPrice > 0 ? (delta / oldPrice) * 100 : 0));
          const direction = change?.direction === "down" ? "down" : "up";

          return {
            id: `market-change-${Date.now()}-${idx}-${String(change?.item_id ?? "item")}`,
            item_id: String(change?.item_id ?? ""),
            item_name: String(change?.item_name ?? "Unknown"),
            old_price: Number.isFinite(oldPrice) ? oldPrice : 0,
            new_price: Number.isFinite(newPrice) ? newPrice : 0,
            delta: Number.isFinite(delta) ? delta : 0,
            delta_percent: Number.isFinite(deltaPercent) ? deltaPercent : 0,
            direction,
            change_type: "market_price",
            timestamp: new Date(),
          };
        });

        setAlerts(prev => [...mappedAlerts, ...prev].slice(0, 50));
        playAlertSound();
      }

      if (changes.length === 0) {
        toast({
          title: "No watchlist changes",
          description: "Check completed, no price changes found.",
          duration: 2500,
        });
      }
    } catch (error) {
      addNotification({
        type: "error",
        source: "market_data",
        title: "Watchlist check failed",
        message: error instanceof Error ? error.message : "Unknown network error",
      });
    } finally {
      setIsMarketCheckLoading(false);
    }
  }, [addNotification, data, isMarketCheckLoading, onListingPricesSync, playAlertSound]);

  // Auto-refresh on open
  useEffect(() => {
    if (data.length > 0 && !hasAutoChecked && !isMarketCheckLoading) {
      setHasAutoChecked(true);
      handleMarketDataCheck();
    }
  }, [data.length, hasAutoChecked, isMarketCheckLoading, handleMarketDataCheck]);

  const handleExport = useCallback(() => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `watchlist-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: `${data.length} items saved`, duration: 2000 });
  }, [data]);

  const clearAlerts = useCallback(() => setAlerts([]), []);
  const dismissAlert = useCallback((id: string) => setAlerts(prev => prev.filter(a => a.id !== id)), []);

  return (
    <div className="flex h-[calc(100vh-220px)] rounded-lg overflow-hidden border border-border/30 bg-background/50">
      {/* Sidebar */}
      <WatchlistSidebar
        alerts={alerts}
        onClearAlerts={clearAlerts}
        onDismissAlert={dismissAlert}
      />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="px-4 py-2.5 border-b border-border/20 bg-card/40 flex items-center gap-3 flex-wrap">
          <Badge
            variant="outline"
            className={`text-[10px] h-6 px-2 gap-1.5 font-mono transition-colors ${
              botIsRunning
                ? 'border-accent/40 bg-accent/10 text-accent'
                : 'border-destructive/40 bg-destructive/10 text-destructive'
            }`}
          >
            <Circle className={`h-2.5 w-2.5 fill-current ${botIsRunning ? 'animate-pulse' : ''}`} />
            {botIsRunning ? 'LIVE' : 'OFF'}
          </Badge>

          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by name, ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs bg-secondary/30 border-border/30"
            />
          </div>

          {/* Item count */}
          <Badge variant="outline" className="text-[10px] h-6 px-2 font-mono border-border/40 shrink-0">
            {data.length} items
          </Badge>

          {/* Actions */}
          <div className="flex items-center gap-1.5 ml-auto shrink-0">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={handleExport}>
              <Download className="h-3.5 w-3.5" />
              Export JSON
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={handleMarketDataCheck}
              disabled={data.length === 0 || isMarketCheckLoading}
            >
              <DatabaseZap className={`h-3.5 w-3.5 ${isMarketCheckLoading ? 'animate-pulse' : ''}`} />
              {isMarketCheckLoading ? "Checking..." : "Check via Market Data"}
            </Button>
            <WatchlistSettingsModal settings={settings} onSave={setSettings} />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-hidden p-2">
          <WatchlistTable
            data={data}
            onDelete={handleDelete}
            onToggleStatus={handleToggleStatus}
            onSnipe={handleSnipe}
            globalFilter={search}
          />
        </div>
      </div>
    </div>
  );
};
