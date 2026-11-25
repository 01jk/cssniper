import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Info,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  ShoppingCart,
  X,
  ExternalLink,
  Diamond,
  Target,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useNotifications } from "@/contexts/NotificationContext";
import { INotification, NotificationType } from "@/types/notifications";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const NotificationIcon = ({ type }: { type: NotificationType }) => {
  switch (type) {
    case "info":
      return <Info className="h-4 w-4 text-blue-500" />;
    case "success":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case "error":
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case "autobuy":
      return <ShoppingCart className="h-4 w-4 text-accent" />;
    default:
      return <Info className="h-4 w-4 text-muted-foreground" />;
  }
};

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
    extraordinary: { label: "Extraordinary", color: "#ffd700" },
    // Agents
    distinguished: { label: "Distinguished", color: "#4b69ff" },
    exceptional:   { label: "Exceptional",   color: "#8847ff" },
    superior:      { label: "Superior",      color: "#d32ce6" },
    master:        { label: "Master",        color: "#eb4b4b" },
    // Stickers
    'high grade':          { label: "High Grade",          color: "#4b69ff" },
    remarkable:            { label: "Remarkable",           color: "#8847ff" },
    exotic:                { label: "Exotic",               color: "#d32ce6" },
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


const formatFloatValue = (value: unknown) => {
  if (typeof value === "number") {
    return Number(value).toFixed(10).replace(/0+$/, "").replace(/\.$/, "");
  }
  return String(value);
};

const asNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

const cleanGeneralMessage = (raw: string) => {
  return raw
    .replace(/\s*\|\s*Filters?:.*$/i, "")
    .replace(/\bFloat:\s*[^|]+/i, "")
    .trim();
};

const formatElapsedCounter = (fromMs: number, toMs: number) => {
  const delta = Math.max(0, toMs - fromMs);
  const minutes = Math.floor(delta / 60000);
  const seconds = Math.floor((delta % 60000) / 1000);
  const milliseconds = delta % 1000;

  return `${String(minutes).padStart(2, "0")}.${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
};

const normalizeToPercent = (value: number, scaleMin: number, scaleMax: number) => {
  if (scaleMax <= scaleMin) return 0;
  const normalized = ((value - scaleMin) / (scaleMax - scaleMin)) * 100;
  return Math.max(0, Math.min(100, normalized));
};

const FilterProgress = ({
  className,
  left,
  right,
  min,
  max,
  scaleMin = 0,
  scaleMax = 100,
}: {
  className: string;
  left: string;
  right: string;
  min: number;
  max: number;
  scaleMin?: number;
  scaleMax?: number;
}) => {
  const rangeMin = Math.max(0, Math.min(100, min));
  const rangeMax = Math.max(0, Math.min(100, max));
  const start = Math.min(rangeMin, rangeMax);
  const end = Math.max(rangeMin, rangeMax);
  const visualStart = normalizeToPercent(start, scaleMin, scaleMax);
  const visualEnd = normalizeToPercent(end, scaleMin, scaleMax);

  return (
    <div className="space-y-1">
      <div className={`relative h-1.5 w-full rounded-full ${className} opacity-90`}>
        <div
          className="absolute top-0 h-full rounded-full bg-white/30 border border-white/30"
          style={{ left: `${visualStart}%`, width: `${Math.max(1, visualEnd - visualStart)}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{left}</span>
        <span>{right}</span>
      </div>
    </div>
  );
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
    <div className={`relative h-1.5 w-full rounded-full opacity-90 ${className}`}>
      <div
        className="absolute top-0 h-full rounded-full bg-white/35"
        style={{ left: `${left}%`, width: `${Math.max(1, right - left)}%` }}
      />
    </div>
  );
};

const DetailsDropdown = ({
  title,
  items,
  render,
  scrollable = true,
}: {
  title: string;
  items: any[];
  render: (item: any, idx: number) => ReactNode;
  scrollable?: boolean;
}) => {
  const [open, setOpen] = useState(false);

  if (!items.length) return null;

  return (
    <div className="rounded-md border border-border/60 bg-muted/20 w-full min-w-0 overflow-x-hidden">
      <button
        className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-medium hover:bg-muted/30 transition-colors"
        onClick={() => setOpen((prev) => !prev)}
        type="button"
      >
        <span>{title} ({items.length})</span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {open && (
        <div className="px-2 pb-2">
          <div className={`space-y-1 overflow-x-hidden pr-1 min-w-0 ${scrollable ? "max-h-40 overflow-y-auto" : "overflow-y-visible"}`}>
            {items.map((item, idx) => render(item, idx))}
          </div>
        </div>
      )}
    </div>
  );
};

const NotificationItem = ({
  notification,
  onMarkAsRead,
  onRemove,
  isNewlyArrived,
  onNavigateToAccount,
  nowMs,
}: {
  notification: INotification;
  onMarkAsRead: (id: string) => void;
  onRemove: (id: string) => void;
  isNewlyArrived: boolean;
  onNavigateToAccount: (notification: INotification) => void;
  nowMs: number;
}) => {
  const { type, source, title, message, timestamp, read, data } = notification;

  const details = useMemo(() => {
    const payload = (data || {}) as Record<string, any>;

    const fadeContainer = payload.fade && typeof payload.fade === "object" ? payload.fade : {};
    const blueGemContainer = payload.blue_gem && typeof payload.blue_gem === "object" ? payload.blue_gem : {};

    const playsideBlue = asNumber(payload.playside_blue) ?? asNumber(blueGemContainer.playside_blue) ?? 0;
    const backsideBlue = asNumber(payload.backside_blue) ?? asNumber(blueGemContainer.backside_blue) ?? 0;
    const blueGemTier = asNumber(payload.blue_gem_tier);

    const fadePercent = asNumber(payload.fade_percentage) ?? asNumber(payload.fade) ?? asNumber(fadeContainer.percentage) ?? 0;
    const fadeRank = asNumber(payload.fade_rank) ?? asNumber(fadeContainer.rank);

    const pattern = payload.pattern ?? payload.paint_seed ?? payload.seed;

    const matchedFilters = payload.matched_filters && typeof payload.matched_filters === "object"
      ? payload.matched_filters
      : {};

    const hasBlueGem =
      Boolean(matchedFilters.playside_blue || matchedFilters.backside_blue) ||
      playsideBlue > 0 ||
      backsideBlue > 0 ||
      blueGemTier !== undefined;

    const hasFade = Boolean(matchedFilters.fade) || fadePercent > 0;

    const stickers = Array.isArray(payload.stickers) ? payload.stickers : [];
    const charms = Array.isArray(payload.charms) ? payload.charms : [];

    return {
      payload,
      playsideBlue,
      backsideBlue,
      blueGemTier,
      fadePercent,
      fadeRank,
      pattern,
      matchedFilters,
      hasBlueGem,
      hasFade,
      stickers,
      charms,
    };
  }, [data]);

  const itemUrl = useMemo(() => {
    const payload = details.payload;
    const rawUrl = payload.item_url;
    if (typeof rawUrl === "string" && /^https?:\/\//i.test(rawUrl)) {
      return rawUrl;
    }

    const rawItemId = payload.item_id;
    if (rawItemId === undefined || rawItemId === null) return null;

    const itemId = String(rawItemId).trim();
    if (!itemId) return null;
    return `https://csfloat.com/item/${itemId}`;
  }, [details.payload]);

  const displaySkin = String(details.payload.skin_name || "Unknown");
  const itemName = String(details.payload.item_name || "").trim();
  const wearName = String(details.payload.wear_name || "").trim();
  const itemPhase = String(details.payload.phase || "").trim();
  const displaySkinWithPhase = itemName
    ? `${itemName}${itemPhase ? ` (${itemPhase})` : ""}${wearName ? ` (${wearName})` : ""}`
    : itemPhase && !displaySkin.toLowerCase().includes(itemPhase.toLowerCase())
    ? `${displaySkin} (${itemPhase})`
    : displaySkin;
  const generalMessage = cleanGeneralMessage(message);
  const showGeneralMessage =
    generalMessage &&
    generalMessage.toLowerCase() !== displaySkin.toLowerCase() &&
    generalMessage.toLowerCase() !== displaySkinWithPhase.toLowerCase();
  const rarity = String(details.payload.rarity_name || "");
  const rarityInfo = rarityMeta(rarity);
  const isWarningOrError = type === "warning" || type === "error";
  const isWatchlistMarketCheck =
    source === "market_data" &&
    (String(title).toLowerCase().includes("watchlist market data check") ||
      details.payload.checked !== undefined ||
      details.payload.with_data !== undefined);
  const checkedCount = asNumber(details.payload.checked) ?? 0;
  const withDataCount = asNumber(details.payload.with_data) ?? 0;
  const checkResults = Array.isArray(details.payload.results)
    ? (details.payload.results as Array<Record<string, unknown>>)
    : [];
  const checkPreview = checkResults.slice(0, 5).map((row) => {
    const highestBuy = row.highest_buy_order && typeof row.highest_buy_order === "object"
      ? (row.highest_buy_order as Record<string, unknown>)
      : null;
    return {
      label: String(row.market_hash_name || row.name || row.id || "Item"),
      buy: highestBuy ? asNumber(highestBuy.price) : undefined,
      low: asNumber(row.lowest_market_price),
    };
  });
  const configName = String(details.payload.config_name || "Default");
  const headerTitle = isWatchlistMarketCheck
    ? "Watchlist"
    : (isWarningOrError ? title : `Target match [${configName}]`);
  const alertCode = details.payload.status_code ?? details.payload.code;
  const alertContext =
    details.payload.account_type !== undefined
      ? `${String(details.payload.account_type)}${details.payload.account_index !== undefined ? ` #${String(details.payload.account_index)}` : ""}`
      : String(details.payload.module || details.payload.event || details.payload.error || title);

  const isAuthError =
    type === "error" &&
    /(401|403|unauthorized|forbidden)/i.test(`${title} ${message}`);
  const elapsedLabel = formatElapsedCounter(timestamp.getTime(), nowMs);

  const resolveStickerPrice = (sticker: Record<string, unknown>) => {
    const reference =
      sticker.reference && typeof sticker.reference === "object"
        ? (sticker.reference as Record<string, unknown>)
        : null;

    const directPrice =
      asNumber(sticker.price) ??
      asNumber(sticker.price_usd) ??
      asNumber(sticker.market_price) ??
      asNumber(sticker.listing_price) ??
      asNumber(sticker.value);

    if (directPrice !== undefined) {
      return directPrice;
    }

    const referencePrice =
      (reference &&
        (asNumber(reference.price_usd) ??
          asNumber(reference.market_price) ??
          asNumber(reference.listing_price))) ??
      undefined;

    if (referencePrice !== undefined) {
      return referencePrice;
    }

    const referencePriceCents = reference ? asNumber(reference.price) : undefined;
    if (referencePriceCents !== undefined) {
      return referencePriceCents >= 1000 ? referencePriceCents / 100 : referencePriceCents;
    }

    return (
      undefined
    );
  };

  const formatStickerSlot = (sticker: Record<string, unknown>) => {
    const hasCustomPosition = sticker.offset_x !== undefined && sticker.offset_y !== undefined;
    if (hasCustomPosition) {
      return "5";
    }

    const slotValue = sticker.slot;
    if (typeof slotValue === "number" && Number.isFinite(slotValue)) {
      return String(slotValue + 1);
    }

    if (typeof slotValue === "string" && slotValue.trim() !== "") {
      const asNum = Number(slotValue);
      return Number.isFinite(asNum) ? String(asNum + 1) : slotValue;
    }

    return "?";
  };

  return (
    <div
      className={`p-3 border-b border-border/50 hover:bg-secondary/30 transition-colors ${
        !read ? "bg-secondary/20" : ""
      } ${isNewlyArrived ? "notification-item-enter" : ""} overflow-x-hidden relative`}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2 pr-14">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <div className="flex-shrink-0 mt-0.5">
              <NotificationIcon type={type} />
            </div>
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <span
                className={`text-base font-medium max-w-[215px] whitespace-nowrap overflow-hidden text-ellipsis ${
                  isWarningOrError ? (!read ? "text-foreground" : "text-muted-foreground") : "text-white"
                }`}
                title={headerTitle}
              >
                {headerTitle}
              </span>
            </div>
          </div>
        </div>

        {showGeneralMessage && (
          <p className="text-[15px] text-muted-foreground line-clamp-2">{generalMessage}</p>
        )}

        <div className="rounded-md border border-primary/20 bg-primary/5 p-2.5 space-y-2 text-sm relative w-full">
          {!isWatchlistMarketCheck && itemUrl && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-10 text-xs w-full justify-center border-primary/30 bg-primary/10 transition-all duration-200 hover:bg-emerald-500/15 hover:border-emerald-400/70 hover:shadow-[0_0_18px_rgba(34,197,94,0.45)]"
            >
              <a href={itemUrl} target="_blank" rel="noopener noreferrer">
                View Item
                <ExternalLink className="h-3.5 w-3.5 ml-1" />
              </a>
            </Button>
          )}

          {isWatchlistMarketCheck ? (
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-2">
                  <div className="text-[11px] text-emerald-200/85">Checked</div>
                  <div className="text-base font-semibold text-emerald-100">{checkedCount}</div>
                </div>
                <div className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-2">
                  <div className="text-[11px] text-cyan-200/85">With Data</div>
                  <div className="text-base font-semibold text-cyan-100">{withDataCount}</div>
                </div>
              </div>

              {checkPreview.length > 0 && (
                <div className="space-y-1.5">
                  {checkPreview.map((row, idx) => (
                    <div key={`${row.label}-${idx}`} className="rounded-md border border-border/50 bg-background/40 px-2.5 py-1.5">
                      <div className="text-sm font-medium text-foreground truncate">{row.label}</div>
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span>Buy: {row.buy !== undefined ? `$${row.buy.toFixed(2)}` : "-"}</span>
                        <span>Low: {row.low !== undefined ? `$${row.low.toFixed(2)}` : "-"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : isWarningOrError ? (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-muted-foreground">Source:</span>
                <div className="font-medium text-foreground break-words">{String(source).replace(/_/g, " ")}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Context:</span>
                <div className="font-medium text-foreground break-words">{alertContext}</div>
              </div>
              {alertCode !== undefined && alertCode !== null && (
                <div>
                  <span className="text-muted-foreground">Code:</span>
                  <div className="font-medium text-foreground">{String(alertCode)}</div>
                </div>
              )}
              {details.payload.price !== undefined && (
                <div>
                  <span className="text-muted-foreground">Price:</span>
                  <div className="font-medium text-foreground">${Number(details.payload.price).toFixed(2)}</div>
                </div>
              )}
              {details.payload.float !== undefined && details.payload.float !== null && (
                <div>
                  <span className="text-muted-foreground">Float:</span>
                  <div className="font-medium text-foreground break-all">{formatFloatValue(details.payload.float)}</div>
                </div>
              )}
              {details.pattern !== undefined && details.pattern !== null && String(details.pattern) !== "" && (
                <div>
                  <span className="text-muted-foreground">Pattern:</span>
                  <div className="font-medium text-foreground">#{String(details.pattern)}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm border border-white/20 shrink-0"
                  style={{ backgroundColor: rarityInfo.color }}
                  title={rarityInfo.label}
                />
                <span className="font-medium text-foreground break-words leading-snug">{displaySkinWithPhase}</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {details.payload.price !== undefined && (
                  <div>
                    <span className="text-muted-foreground">Price:</span>
                    <div className="font-medium text-foreground">${Number(details.payload.price).toFixed(2)}</div>
                  </div>
                )}
                {details.payload.float !== undefined && details.payload.float !== null && (
                  <div>
                    <span className="text-muted-foreground">Float:</span>
                    <div className="font-medium text-foreground break-all">{formatFloatValue(details.payload.float)}</div>
                  </div>
                )}
                {details.pattern !== undefined && details.pattern !== null && String(details.pattern) !== "" && (
                  <div>
                    <span className="text-muted-foreground">Pattern:</span>
                    <div className="font-medium text-foreground">#{String(details.pattern)}</div>
                  </div>
                )}
              </div>
            </div>
          )}

            {(details.hasBlueGem || details.hasFade) && (
              <div className="space-y-1.5 pt-0.5">
                {details.hasBlueGem && (
                  <div className="space-y-1">
                    <div className="text-[11px] text-sky-300 font-medium">
                      Blue Gem{details.blueGemTier !== undefined ? ` (Tier ${details.blueGemTier})` : ""} {details.playsideBlue.toFixed(2)}%/{details.backsideBlue.toFixed(2)}%
                    </div>
                    <MiniRangeBar
                      className="blue-gradient"
                      start={details.playsideBlue}
                      end={details.backsideBlue}
                    />
                  </div>
                )}

                {details.hasFade && (
                  <div className="space-y-1">
                    <div className="text-[11px] text-orange-200 font-medium">
                      Fade{details.fadeRank !== undefined ? ` (Rank ${details.fadeRank})` : ""} {details.fadePercent.toFixed(1)}%
                    </div>
                    <MiniRangeBar
                      className="fade-gradient"
                      start={80}
                      end={Math.max(80, details.fadePercent)}
                      scaleMin={80}
                      scaleMax={100}
                    />
                  </div>
                )}
              </div>
            )}

            <DetailsDropdown
              title="Stickers"
              items={details.stickers}
              scrollable={false}
              render={(sticker, idx) => {
                const name = String(sticker?.name || "Unknown sticker");
                const wear = sticker?.wear;
                const slot = formatStickerSlot(sticker as Record<string, unknown>);
                const price = resolveStickerPrice(sticker as Record<string, unknown>);
                return (
                  <div key={`st-${idx}`} className="text-[11px] rounded bg-background/60 px-2 py-0.5 border border-border/50 min-w-0 overflow-hidden">
                    <div className="font-medium text-foreground break-words leading-snug">{name}</div>
                    <div className="flex items-center justify-between gap-2 text-muted-foreground leading-tight">
                      <span className="truncate">Slot: {slot} {wear !== undefined ? `| Wear: ${wear}` : ""}</span>
                      {price !== undefined && (
                        <span className="shrink-0 rounded bg-black/40 px-1.5 py-0 text-[11px] leading-tight text-white font-semibold">
                          ${price.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              }}
            />

            <DetailsDropdown
              title="Charms"
              items={details.charms}
              render={(charm, idx) => {
                const name = String(charm?.name || "Unknown charm");
                const pattern = charm?.pattern;
                const price = asNumber(charm?.price);
                return (
                  <div key={`ch-${idx}`} className="text-[11px] rounded bg-background/60 px-2 py-1 border border-border/50 min-w-0 overflow-hidden">
                    <div className="font-medium text-foreground break-words leading-snug">{name}</div>
                    <div className="text-muted-foreground">
                      Pattern: {pattern ?? "-"} {price !== undefined ? `| $${price.toFixed(2)}` : ""}
                    </div>
                  </div>
                );
              }}
            />

            <div className="flex items-end justify-between gap-2">
              <div className="min-w-0">
                {Array.isArray(details.payload.filters_passed) && details.payload.filters_passed.length > 0 && (
                  <div>
                    <div className="text-muted-foreground mb-1">Triggered filters:</div>
                    <div className="flex flex-wrap gap-1">
                      {details.payload.filters_passed.map((filter: string) => (
                        <Badge key={filter} variant="outline" className="h-5 text-[10px] border-primary/30 bg-primary/10 text-primary">
                          {filter}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <span className="shrink-0 text-[11px] text-muted-foreground font-mono leading-none">
                {elapsedLabel}
              </span>
            </div>
        </div>

        {isAuthError && (
          <div className="mt-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onNavigateToAccount(notification)}
            >
              Open Account Settings
            </Button>
          </div>
        )}

      </div>

      <div className="absolute top-2 right-2 flex items-center gap-1">
        {!read ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-emerald-500 hover:text-emerald-400"
            onClick={() => onMarkAsRead(notification.id)}
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <span className="h-7 w-7" aria-hidden="true" />
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={() => onRemove(notification.id)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};

export const NotificationPanel = () => {
  const {
    notifications,
    unreadCount,
    isPanelOpen,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAllNotifications,
    closePanel,
  } = useNotifications();

  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [activeCategory, setActiveCategory] = useState<"all" | "targets" | "system" | "readed">("all");
  const [shouldRenderPanel, setShouldRenderPanel] = useState(isPanelOpen);
  const [panelVisible, setPanelVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const knownIdsRef = useRef<Set<string>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);
  const [newlyArrivedIds, setNewlyArrivedIds] = useState<Set<string>>(new Set());
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  const handleConfirmClearAll = () => {
    clearAllNotifications();
    setClearDialogOpen(false);
  };

  const navigateToAccountSettings = (notification: INotification) => {
    const text = `${notification.title} ${notification.message}`;
    const source = notification.source;
    const data = (notification.data || {}) as Record<string, unknown>;

    let type: "scanner" | "market" | "autobuy" = "scanner";

    const markerMatch = text.match(/\[(scanner|market_data|market|autobuy|auto_buy)\]/i);
    const marker = markerMatch?.[1]?.toLowerCase();
    const dataAccountType = String(data.account_type || "").toLowerCase();
    if (marker === "market_data" || marker === "market") {
      type = "market";
    } else if (marker === "autobuy" || marker === "auto_buy") {
      type = "autobuy";
    } else if (marker === "scanner") {
      type = "scanner";
    } else if (dataAccountType === "market_data" || dataAccountType === "market") {
      type = "market";
    } else if (dataAccountType === "auto_buy" || dataAccountType === "autobuy") {
      type = "autobuy";
    } else if (source === "market_data" || /market|price history/i.test(text)) {
      type = "market";
    } else if (source === "autobuy" || /autobuy|buy|purchase|sniper/i.test(text)) {
      type = "autobuy";
    }

    let index = 0;
    const rawAccountIndex = Number(data.account_index);
    const rawProxyIndex = Number(data.proxy_index);
    const hasStructuredIndex = Number.isFinite(rawAccountIndex) || Number.isFinite(rawProxyIndex);
    if (Number.isFinite(rawAccountIndex)) {
      index = Math.max(0, rawAccountIndex);
    } else if (Number.isFinite(rawProxyIndex)) {
      index = Math.max(0, rawProxyIndex - 1);
    }

    if (!hasStructuredIndex) {
      const indexMatch = text.match(/(?:proxy|account)\s*#?\s*(\d+)/i);
      if (indexMatch) {
        index = Math.max(0, Number(indexMatch[1]) - 1);
      }
    }

    try {
      localStorage.setItem("sniper-bot-settings-tab", "accounts");
      localStorage.setItem(
        "sniper-bot-account-jump",
        JSON.stringify({ type, index, ts: Date.now() })
      );
    } catch (e) {
      console.debug("Failed to persist account jump target:", e);
    }

    closePanel();
    window.dispatchEvent(new CustomEvent("settings-open-accounts"));
    window.location.hash = "settings";
  };

  useEffect(() => {
    if (isPanelOpen) {
      setIsClosing(false);
      setShouldRenderPanel(true);
      const enterTimer = window.setTimeout(() => {
        setPanelVisible(true);
      }, 20);
      return () => window.clearTimeout(enterTimer);
    }

    setIsClosing(true);
    setPanelVisible(false);
    const timer = window.setTimeout(() => {
      setShouldRenderPanel(false);
      setIsClosing(false);
    }, 430);

    return () => window.clearTimeout(timer);
  }, [isPanelOpen]);

  useEffect(() => {
    if (!shouldRenderPanel) {
      setPanelVisible(false);
      return;
    }

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      
      // If the clicked element is no longer in the document body (e.g. it was unmounted/removed on click),
      // we assume the click originated from inside the panel or its portals.
      if (target && !document.body.contains(target)) {
        return;
      }
      
      // If click is inside the panel, do nothing
      if (panelRef.current && panelRef.current.contains(target)) {
        return;
      }
      
      // If click is on the notification bell, do nothing (bell toggle will handle it)
      if (target instanceof Element && target.closest('#notification-bell-btn')) {
        return;
      }

      // If the click target is inside a Radix UI portal container (like Select content or AlertDialog)
      if (
        target instanceof Element &&
        target.closest('[data-radix-portal], [data-radix-popper-content-wrapper], [role="listbox"], [role="dialog"], [role="alertdialog"]')
      ) {
        return;
      }
      
      // Otherwise, close the panel
      closePanel();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [shouldRenderPanel, closePanel]);

  useEffect(() => {
    if (!shouldRenderPanel) return;

    let rafId = 0;
    const tick = () => {
      setNowMs(Date.now());
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [shouldRenderPanel]);

  useEffect(() => {
    const incomingIds = notifications
      .map((n) => n.id)
      .filter((id) => !knownIdsRef.current.has(id));

    if (incomingIds.length > 0) {
      setNewlyArrivedIds((prev) => {
        const next = new Set(prev);
        incomingIds.forEach((id) => next.add(id));
        return next;
      });

      const timer = window.setTimeout(() => {
        setNewlyArrivedIds((prev) => {
          const next = new Set(prev);
          incomingIds.forEach((id) => next.delete(id));
          return next;
        });
      }, 900);

      knownIdsRef.current = new Set(notifications.map((n) => n.id));
      return () => window.clearTimeout(timer);
    }

    knownIdsRef.current = new Set(notifications.map((n) => n.id));
  }, [notifications]);

  if (!shouldRenderPanel) return null;

  const filteredNotifications = notifications.filter((n) => {
    if (activeCategory === "readed") {
      return n.read;
    }

    if (activeCategory === "targets") {
      const isTargetSource = n.source === "scanner" || n.source === "autobuy" || n.source === "market_data";
      if (!isTargetSource) return false;
    }

    if (activeCategory === "system") {
      const isSystemSource = n.source === "system" || n.source === "error";
      if (!isSystemSource) return false;
    }

    if (activeFilter === "unread") return !n.read;
    if (activeFilter === "read") return n.read;
    return true;
  });

  return (
    <div
      ref={panelRef}
      className={`fixed top-0 right-0 h-full w-96 bg-card shadow-2xl z-[120] flex flex-col overflow-hidden ${
        isClosing
          ? "notification-panel-exit"
          : panelVisible
          ? "notification-panel-enter"
          : "translate-x-full opacity-0"
      }`}
    >
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Notifications</h2>
          {unreadCount > 0 && <Badge className="bg-red-500 text-white">{unreadCount}</Badge>}
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={closePanel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-3 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2">
          <div className="flex items-center">
            <Button
              variant={unreadCount > 0 ? "secondary" : "outline"}
              size="sm"
              className={`h-8 text-xs border px-5 min-w-[120px] transition-all ${
                unreadCount > 0
                  ? "border-blue-400/80 bg-blue-500/25 text-blue-100 shadow-[0_0_14px_rgba(59,130,246,0.35)]"
                  : "border-border text-muted-foreground opacity-70"
              }`}
              onClick={() => {
                setActiveFilter("unread");
                setActiveCategory("all");
              }}
              disabled={unreadCount === 0}
            >
              New ({unreadCount})
            </Button>
          </div>

          <div className="flex items-center w-[145px]">
            <Select
              value={activeCategory}
              onValueChange={(value) => {
                const next = value as "all" | "targets" | "system" | "readed";
                setActiveCategory(next);
                if (next === "readed") {
                  setActiveFilter("read");
                } else if (activeFilter === "read") {
                  setActiveFilter("all");
                }
              }}
            >
              <SelectTrigger className="h-8 text-xs w-full">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <span className="inline-flex items-center gap-2">
                    <Bell className="h-3.5 w-3.5" />
                    All Types
                  </span>
                </SelectItem>
                <SelectItem value="targets">
                  <span className="inline-flex items-center gap-2">
                    <Target className="h-3.5 w-3.5" />
                    Targets
                  </span>
                </SelectItem>
                <SelectItem value="system">
                  <span className="inline-flex items-center gap-2">
                    <AlertCircle className="h-3.5 w-3.5" />
                    System
                  </span>
                </SelectItem>
                <SelectItem value="readed">
                  <span className="inline-flex items-center gap-2">
                    <CheckCircle className="h-3.5 w-3.5" />
                    Readed
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center">
            <div className="flex items-center h-8 rounded-md border border-border overflow-hidden">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-none text-emerald-500 hover:text-emerald-400"
                onClick={markAllAsRead}
                disabled={unreadCount === 0}
                title="Read All"
              >
                <CheckCheck className="h-3.5 w-3.5" />
              </Button>
              <div className="h-5 w-px bg-border/80" />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-none text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setClearDialogOpen(true)}
                disabled={notifications.length === 0}
                title="Clear All"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Bell className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-sm">
              {activeFilter === "unread"
                ? "No unread notifications"
                : activeFilter === "read"
                ? "No read notifications"
                : "No notifications"}
            </p>
          </div>
        ) : (
          <div className="pb-16">
            {filteredNotifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={markAsRead}
                onRemove={removeNotification}
                isNewlyArrived={newlyArrivedIds.has(notification.id)}
                onNavigateToAccount={navigateToAccountSettings}
                nowMs={nowMs}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent className="border-destructive/30 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-4 w-4" />
              Delete all notifications?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently remove all notifications from the manager.
            </AlertDialogDescription>
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
              You are about to delete {notifications.length} notification{notifications.length === 1 ? "" : "s"}.
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmClearAll}
            >
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
