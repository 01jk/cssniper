import { useCallback, useEffect, useRef, useState } from "react";
import {
  Info,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  ShoppingCart,
  X,
  ExternalLink
} from "lucide-react";
import { useNotifications } from "@/contexts/NotificationContext";
import { INotification, NotificationType } from "@/types/notifications";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const rarityMeta = (rarityRaw: string) => {
  const rarity = rarityRaw.toLowerCase();
  const map: Record<string, { label: string; color: string }> = {
    // Weapons
    consumer:    { label: "Consumer Grade",  color: "#b0c3d9" },
    industrial:  { label: "Industrial Grade", color: "#5e98d9" },
    milspec:     { label: "Mil-Spec",         color: "#4b69ff" },
    restricted:  { label: "Restricted",       color: "#8847ff" },
    classified:  { label: "Classified",       color: "#d32ce6" },
    covert:      { label: "Covert",           color: "#eb4b4b" },
    contraband:  { label: "Contraband",       color: "#e4ae39" },
    extraordinary: { label: "Extraordinary",  color: "#ffd700" },
    // Agents
    distinguished: { label: "Distinguished",  color: "#4b69ff" },
    exceptional:   { label: "Exceptional",    color: "#8847ff" },
    superior:      { label: "Superior",       color: "#d32ce6" },
    master:        { label: "Master",         color: "#eb4b4b" },
    // Stickers
    'high grade': { label: "High Grade",      color: "#4b69ff" },
    remarkable:   { label: "Remarkable",      color: "#8847ff" },
    exotic:       { label: "Exotic",          color: "#d32ce6" },
    // Charms
    'high grade collectible':    { label: "High Grade Collectible",    color: "#4b69ff" },
    'remarkable collectible':    { label: "Remarkable Collectible",    color: "#8847ff" },
    'exotic collectible':        { label: "Exotic Collectible",        color: "#d32ce6" },
    'extraordinary collectible': { label: "Extraordinary Collectible", color: "#eb4b4b" },
  };

  // Agents
  if (rarity.includes("master")) return map.master;
  if (rarity.includes("superior")) return map.superior;
  if (rarity.includes("exceptional")) return map.exceptional;
  if (rarity.includes("distinguished")) return map.distinguished;
  // Charms / Stickers with Collectible suffix
  if (rarity.includes("extraordinary") && (rarity.includes("collectible") || rarity.includes("charm")))
    return { label: "Extraordinary Collectible", color: "#eb4b4b" };
  if (rarity.includes("exotic") && (rarity.includes("collectible") || rarity.includes("charm")))
    return map['exotic collectible'];
  if (rarity.includes("remarkable") && (rarity.includes("collectible") || rarity.includes("charm")))
    return map['remarkable collectible'];
  if (rarity.includes("high grade") && (rarity.includes("collectible") || rarity.includes("charm")))
    return map['high grade collectible'];
  // Stickers
  if (rarity.includes("extraordinary") && rarity.includes("sticker"))
    return { label: "Extraordinary", color: "#eb4b4b" };
  if (rarity.includes("contraband")) return map.contraband;
  if (rarity.includes("exotic")) return map.exotic;
  if (rarity.includes("remarkable")) return map.remarkable;
  if (rarity.includes("high grade")) return map['high grade'];
  // Weapons
  if (rarity.includes("milspec") || rarity.includes("mil-spec") || rarity.includes("mil spec")) return map.milspec;
  if (rarity.includes("consumer")) return map.consumer;
  if (rarity.includes("industrial")) return map.industrial;
  if (rarity.includes("restricted")) return map.restricted;
  if (rarity.includes("classified")) return map.classified;
  if (rarity.includes("covert")) return map.covert;
  if (rarity.includes("extraordinary")) return map.extraordinary;

  return map[rarity] || { label: rarityRaw || "Unknown rarity", color: "#9ca3af" };
};


const asNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

const formatFloatValue = (value: unknown) => {
  if (typeof value === "number") {
    return Number(value).toFixed(10).replace(/0+$/, "").replace(/\.$/, "");
  }
  return String(value);
};

const cleanGeneralMessage = (raw: string) => {
  return raw
    .replace(/\s*\|\s*Filters?:.*$/i, "")
    .replace(/\bFloat:\s*[^|]+/i, "")
    .trim();
};

const normalizeToPercent = (value: number, scaleMin: number, scaleMax: number) => {
  if (scaleMax <= scaleMin) return 0;
  const normalized = ((value - scaleMin) / (scaleMax - scaleMin)) * 100;
  return Math.max(0, Math.min(100, normalized));
};

const MiniRangeBar = ({
  start,
  end,
  className,
  scaleMin = 0,
  scaleMax = 100,
}: {
  start: number;
  end: number;
  className: string;
  scaleMin?: number;
  scaleMax?: number;
}) => {
  const s = Math.min(start, end);
  const e = Math.max(start, end);
  const left = normalizeToPercent(s, scaleMin, scaleMax);
  const right = normalizeToPercent(e, scaleMin, scaleMax);

  return (
    <div className={cn("relative h-1.5 w-full rounded-full opacity-90", className)}>
      <div
        className="absolute top-0 h-full rounded-full bg-white/35"
        style={{ left: `${left}%`, width: `${Math.max(1, right - left)}%` }}
      />
    </div>
  );
};

const ToastIcon = ({ type }: { type: NotificationType }) => {
  switch (type) {
    case 'info':
      return <Info className="h-5 w-5 text-blue-500" />;
    case 'success':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'warning':
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    case 'error':
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    case 'autobuy':
      return <ShoppingCart className="h-5 w-5 text-accent" />;
    default:
      return <Info className="h-5 w-5 text-muted-foreground" />;
  }
};

interface ToastNotificationProps {
  notification: INotification;
  onDismiss: (id: string) => void;
  onOpenManager: () => void;
  duration: number;
  index: number;
}

const ToastNotification = ({
  notification,
  onDismiss,
  onOpenManager,
  duration,
  index
}: ToastNotificationProps) => {
  const { type, source, title, message, timestamp, data } = notification;
  const [isExiting, setIsExiting] = useState(false);
  const dismissRequestedRef = useRef(false);
  const payload = (data || {}) as Record<string, unknown>;
  const isWatchlistMarketCheck =
    source === "market_data" &&
    (String(title).toLowerCase().includes("watchlist market data check") ||
      payload.checked !== undefined ||
      payload.with_data !== undefined);
  const checkedCount = asNumber(payload.checked) ?? 0;
  const withDataCount = asNumber(payload.with_data) ?? 0;
  const rawResults = Array.isArray(payload.results) ? payload.results : [];
  const resultPreview = rawResults
    .slice(0, 3)
    .map((entry) => {
      const row = (entry || {}) as Record<string, unknown>;
      const label = String(row.market_hash_name || row.name || row.id || "Item");
      const highestBuyOrder =
        row.highest_buy_order && typeof row.highest_buy_order === "object"
          ? (row.highest_buy_order as Record<string, unknown>)
          : null;
      const buyOrderPrice = highestBuyOrder ? asNumber(highestBuyOrder.price) : undefined;
      const lowestMarketPrice = asNumber(row.lowest_market_price);
      return {
        label,
        buyOrderPrice,
        lowestMarketPrice,
      };
    });
  const displayTitle = title.replace(/^[\p{Extended_Pictographic}\uFE0F\s]+/u, "").trim() || title;

  const EXIT_ANIMATION_MS = 320;

  const getItemUrl = (): string | null => {
    if (source === "buy_order_filled") {
      return "https://csfloat.com/profile";
    }
    const rawUrl = data?.item_url;
    if (typeof rawUrl === "string" && /^https?:\/\//i.test(rawUrl)) {
      return rawUrl;
    }

    const rawItemId = data?.item_id;
    if (rawItemId === undefined || rawItemId === null) {
      return null;
    }

    const itemId = String(rawItemId).trim();
    if (!itemId) return null;

    return `https://csfloat.com/item/${itemId}`;
  };

  const itemUrl = getItemUrl();
  const displaySkin = String(payload.skin_name || "Unknown");
  const itemPhase = String(payload.phase || "").trim();
  const displaySkinWithPhase =
    itemPhase && !displaySkin.toLowerCase().includes(itemPhase.toLowerCase())
      ? `${displaySkin} (${itemPhase})`
      : displaySkin;
  const rarityInfo = rarityMeta(String(payload.rarity_name || ""));
  const generalMessage = cleanGeneralMessage(message);
  const showGeneralMessage =
    generalMessage &&
    generalMessage.toLowerCase() !== displaySkin.toLowerCase() &&
    generalMessage.toLowerCase() !== displaySkinWithPhase.toLowerCase();
  const isWarningOrError = type === "warning" || type === "error";
  const price = asNumber(payload.price);
  const floatValue = payload.float;
  const pattern = payload.pattern ?? payload.paint_seed ?? payload.seed;
  const matchedFilters = payload.matched_filters && typeof payload.matched_filters === "object"
    ? payload.matched_filters as Record<string, unknown>
    : {};
  const fadeContainer = payload.fade && typeof payload.fade === "object"
    ? payload.fade as Record<string, unknown>
    : {};
  const blueGemContainer = payload.blue_gem && typeof payload.blue_gem === "object"
    ? payload.blue_gem as Record<string, unknown>
    : {};

  const playsideBlue = asNumber(payload.playside_blue) ?? asNumber(blueGemContainer.playside_blue) ?? 0;
  const backsideBlue = asNumber(payload.backside_blue) ?? asNumber(blueGemContainer.backside_blue) ?? 0;
  const fadePercent = asNumber(payload.fade_percentage) ?? asNumber(payload.fade) ?? asNumber(fadeContainer.percentage) ?? 0;
  const blueGemTier = asNumber(payload.blue_gem_tier) ?? asNumber(blueGemContainer.tier);
  const fadeRank = asNumber(payload.fade_rank) ?? asNumber(fadeContainer.rank);
  const hasBlueGem = Boolean(matchedFilters.playside_blue || matchedFilters.backside_blue) || playsideBlue > 0 || backsideBlue > 0;
  const hasFade = Boolean(matchedFilters.fade) || fadePercent > 0;

  const requestDismiss = useCallback(() => {
    if (dismissRequestedRef.current) {
      return;
    }

    dismissRequestedRef.current = true;
    setIsExiting(true);

    window.setTimeout(() => {
      onDismiss(notification.id);
    }, EXIT_ANIMATION_MS);
  }, [notification.id, onDismiss]);

  useEffect(() => {
    const autoDismissDelay = Math.max(duration * 1000 - EXIT_ANIMATION_MS, 0);

    const timer = window.setTimeout(() => {
      requestDismiss();
    }, autoDismissDelay);

    return () => window.clearTimeout(timer);
  }, [duration, requestDismiss]);

  const bgClasses = {
    'info': 'bg-blue-500/10 border-blue-500/30',
    'success': 'bg-green-500/10 border-green-500/30',
    'warning': 'bg-yellow-500/10 border-yellow-500/30',
    'error': 'bg-red-500/20 border-red-500/60 shadow-[0_0_12px_rgba(239,68,68,0.15)]',
    'autobuy': 'bg-accent/10 border-accent/30',
  };

  return (
    <div
      className={cn(
        "w-80 p-4 rounded-lg border shadow-lg backdrop-blur-sm relative",
        isExiting ? "toast-exit-right" : "toast-enter-bottom",
        bgClasses[type]
      )}
      style={{ animationDelay: `${index * 80}ms` }}
      role="alert"
      onClick={() => {
        onOpenManager();
        requestDismiss();
      }}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex-shrink-0">
              <ToastIcon type={type} />
            </div>
            <h4 className="text-sm font-medium text-white truncate">
              {displayTitle}
            </h4>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              requestDismiss();
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {showGeneralMessage && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {generalMessage}
          </p>
        )}

        <div className="w-full p-1 space-y-1.5 text-[11px]">
          {isWatchlistMarketCheck ? (
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border border-emerald-400/40 bg-emerald-500/15 px-2 py-1.5">
                  <div className="text-[10px] text-emerald-100/80">Checked</div>
                  <div className="text-sm font-semibold text-emerald-100">{checkedCount}</div>
                </div>
                <div className="rounded-md border border-cyan-400/40 bg-cyan-500/15 px-2 py-1.5">
                  <div className="text-[10px] text-cyan-100/80">With Data</div>
                  <div className="text-sm font-semibold text-cyan-100">{withDataCount}</div>
                </div>
              </div>

              {resultPreview.length > 0 && (
                <div className="space-y-1.5">
                  {resultPreview.map((row, i) => (
                    <div key={`${row.label}-${i}`} className="rounded-md border border-border/50 bg-background/40 px-2 py-1.5">
                      <div className="text-[11px] font-medium text-foreground truncate">{row.label}</div>
                      <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span>Buy: {row.buyOrderPrice !== undefined ? `$${row.buyOrderPrice.toFixed(2)}` : "-"}</span>
                        <span>Low: {row.lowestMarketPrice !== undefined ? `$${row.lowestMarketPrice.toFixed(2)}` : "-"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
          <>
          {!isWarningOrError && (
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm border border-white/20 shrink-0"
                style={{ backgroundColor: rarityInfo.color }}
                title={rarityInfo.label}
              />
              <span className="font-medium text-foreground truncate">{displaySkinWithPhase}</span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 text-muted-foreground">
            <div>
              <span>Price</span>
              <div className="font-medium text-foreground">{price !== undefined ? `$${price.toFixed(2)}` : "-"}</div>
            </div>
            <div>
              <span>Float</span>
              <div className="font-medium text-foreground truncate">{floatValue !== undefined && floatValue !== null ? formatFloatValue(floatValue) : "-"}</div>
            </div>
            <div>
              <span>Pattern</span>
              <div className="font-medium text-foreground">{pattern !== undefined && pattern !== null && String(pattern) !== "" ? `#${String(pattern)}` : "-"}</div>
            </div>
          </div>

          {(hasBlueGem || hasFade) && (
            <div className="space-y-1.5 pt-0.5">
              {hasBlueGem && (
                <div className="space-y-1">
                  <div className="text-[10px] text-sky-300 font-medium">
                    Blue Gem{blueGemTier !== undefined ? ` (Tier ${blueGemTier})` : ""} {playsideBlue.toFixed(2)}%/{backsideBlue.toFixed(2)}%
                  </div>
                  <MiniRangeBar
                    className="blue-gradient"
                    start={playsideBlue}
                    end={backsideBlue}
                  />
                </div>
              )}

              {hasFade && (
                <div className="space-y-1">
                  <div className="text-[10px] text-orange-200 font-medium">
                    Fade{fadeRank !== undefined ? ` (Rank ${fadeRank})` : ""} {fadePercent.toFixed(1)}%
                  </div>
                  <MiniRangeBar
                    className="fade-gradient"
                    start={80}
                    end={Math.max(80, fadePercent)}
                    scaleMin={80}
                    scaleMax={100}
                  />
                </div>
              )}
            </div>
          )}
          </>
          )}

        </div>

        {!isWatchlistMarketCheck && itemUrl && (() => {
          const btnClasses = {
            'info': 'border-blue-400/60 bg-blue-500/20 text-blue-100 hover:bg-blue-500/30 hover:border-blue-300/80 hover:shadow-[0_0_18px_rgba(59,130,246,0.45)]',
            'success': 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30 hover:border-emerald-300/80 hover:shadow-[0_0_18px_rgba(34,197,94,0.45)]',
            'warning': 'border-yellow-400/60 bg-yellow-500/20 text-yellow-100 hover:bg-yellow-500/30 hover:border-yellow-300/80 hover:shadow-[0_0_18px_rgba(234,179,8,0.45)]',
            'error': 'border-red-400/60 bg-red-500/20 text-red-100 hover:bg-red-500/30 hover:border-red-300/80 hover:shadow-[0_0_18px_rgba(239,68,68,0.45)]',
            'autobuy': 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30 hover:border-emerald-300/80 hover:shadow-[0_0_18px_rgba(34,197,94,0.45)]',
          };
          return (
            <a
              href={itemUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "relative inline-flex items-center justify-center gap-1.5 text-xs w-full h-10 rounded-md border px-3 pb-1 transition-all duration-200",
                btnClasses[type]
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <span className="font-medium tracking-wide">
                {source === "buy_order_filled" ? "View Inventory" : "View Items"}
              </span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          );
        })()}
      </div>
    </div>
  );
};

export const ToastNotificationContainer = () => {
  const { notifications, settings, isPanelOpen, togglePanel } = useNotifications();
  const [dismissedToastIds, setDismissedToastIds] = useState<Set<string>>(new Set());
  const [freshToastIds, setFreshToastIds] = useState<Set<string>>(new Set());
  const knownIdsRef = useRef<Set<string>>(new Set());
  const hasBaselineRef = useRef(false);
  const [topOffsetPx, setTopOffsetPx] = useState(0);
  const [bottomOffsetPx, setBottomOffsetPx] = useState(0);

  const dismissToast = useCallback((id: string) => {
    setDismissedToastIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setFreshToastIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const openManagerFromToast = useCallback(() => {
    if (!isPanelOpen) {
      togglePanel();
    }
  }, [isPanelOpen, togglePanel]);

  useEffect(() => {
    if (notifications.length === 0) {
      return;
    }

    const existingUnreadIds = new Set(notifications.filter((n) => !n.read).map((n) => n.id));
    setDismissedToastIds(prev => {
      const next = new Set<string>();
      prev.forEach(id => {
        if (existingUnreadIds.has(id)) {
          next.add(id);
        }
      });
      return next;
    });

    setFreshToastIds(prev => {
      const next = new Set<string>();
      prev.forEach(id => {
        if (existingUnreadIds.has(id)) {
          next.add(id);
        }
      });
      return next;
    });
  }, [notifications]);

  useEffect(() => {
    // Treat the first non-empty batch as already seen to avoid replaying history after page reload.
    if (!hasBaselineRef.current) {
      if (notifications.length === 0) {
        return;
      }
      knownIdsRef.current = new Set(notifications.map((n) => n.id));
      hasBaselineRef.current = true;
      return;
    }

    const incomingIds = notifications
      .filter((n) => !knownIdsRef.current.has(n.id))
      .map((n) => n.id);

    if (incomingIds.length > 0) {
      setFreshToastIds((prev) => {
        const next = new Set(prev);
        incomingIds.forEach((id) => next.add(id));
        return next;
      });
    }

    knownIdsRef.current = new Set(notifications.map((n) => n.id));
  }, [notifications]);

  useEffect(() => {
    const baseOffsetPx = 16;
    const sideIsRight = settings.toastPosition.endsWith("right");
    const isTopPosition = settings.toastPosition.startsWith("top");
    let rafId = 0;

    const recalculateOffset = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const liveStatusElement = document.querySelector<HTMLElement>("[data-live-status-bar='true']");
        let liveStatusBottom = 0;
        if (liveStatusElement) {
          const liveRect = liveStatusElement.getBoundingClientRect();
          const sameSide = sideIsRight
            ? liveRect.right > window.innerWidth / 2
            : liveRect.left < window.innerWidth / 2;

          if (sameSide && liveRect.width > 0 && liveRect.height > 0) {
            liveStatusBottom = liveRect.bottom;
          }
        }

        if (isTopPosition) {
          if (liveStatusBottom === 0) {
            setTopOffsetPx(0);
            return;
          }
          setTopOffsetPx(Math.max(0, Math.ceil(liveStatusBottom + 8 - baseOffsetPx)));
          return;
        }

        setBottomOffsetPx(0);
      });
    };

    recalculateOffset();

    const mutationObserver = new MutationObserver(recalculateOffset);
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    window.addEventListener("resize", recalculateOffset);

    return () => {
      cancelAnimationFrame(rafId);
      mutationObserver.disconnect();
      window.removeEventListener("resize", recalculateOffset);
    };
  }, [settings.toastPosition]);
  
  // Показываем только новые для текущего клиента уведомления в виде toast
  const visibleToasts = notifications
    .filter(n => !n.read && freshToastIds.has(n.id) && !dismissedToastIds.has(n.id))
    .slice(0, settings.maxVisibleToasts);

  if (!settings.showToasts || isPanelOpen || visibleToasts.length === 0) {
    return null;
  }

  const containerPositionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-[calc(4rem+1rem)]',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-[calc(4rem+1rem)]',
  };

  const stackDirectionClass = settings.toastPosition.startsWith('bottom')
    ? 'flex-col-reverse'
    : 'flex-col';

  return (
    <div
      className={cn(
        "fixed z-[60] flex gap-2 pointer-events-none",
        containerPositionClasses[settings.toastPosition],
        stackDirectionClass
      )}
      style={
        settings.toastPosition.startsWith("top")
          ? { top: `calc(1rem + ${topOffsetPx}px)` }
          : { bottom: `calc(1rem + ${bottomOffsetPx}px)` }
      }
    >
      {visibleToasts.map((notification, index) => (
        <div key={notification.id} className="pointer-events-auto">
          <ToastNotification
            notification={notification}
            onDismiss={dismissToast}
            onOpenManager={openManagerFromToast}
            duration={settings.toastDuration}
            index={index}
          />
        </div>
      ))}
    </div>
  );
};
