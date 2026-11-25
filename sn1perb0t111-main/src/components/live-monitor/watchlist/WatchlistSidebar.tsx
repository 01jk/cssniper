import React from "react";
import { Bell, Clock, TrendingDown, TrendingUp, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PriceAlert } from "./watchlistTypes";

interface WatchlistSidebarProps {
  alerts: PriceAlert[];
  onClearAlerts: () => void;
  onDismissAlert: (id: string) => void;
}

export const WatchlistSidebar: React.FC<WatchlistSidebarProps> = ({
  alerts, onClearAlerts, onDismissAlert,
}) => {
  return (
    <div className="w-64 border-r border-border/30 bg-card/60 flex flex-col h-full shrink-0">
      {/* Header */}
      <div className="px-3 py-3 border-b border-border/20 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Bell className="h-3.5 w-3.5 text-primary" />
          Recent Alerts
          {alerts.length > 0 && (
            <Badge variant="secondary" className="text-[9px] h-4 px-1 font-mono">{alerts.length}</Badge>
          )}
        </h3>
        {alerts.length > 0 && (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClearAlerts}>
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Alert list */}
      <ScrollArea className="flex-1">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/50">
            <Bell className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-[10px]">No recent alerts</p>
          </div>
        ) : (
          <div className="p-2 space-y-1.5">
            {alerts.slice(0, 10).map(alert => {
              const positive = alert.delta >= 0;
              const Icon = positive ? TrendingUp : TrendingDown;
              return (
                <div
                  key={alert.id}
                  className={`rounded-md p-2 text-[10px] border transition-colors ${
                    positive
                      ? 'border-accent/20 bg-accent/5 hover:bg-accent/10'
                      : 'border-destructive/20 bg-destructive/5 hover:bg-destructive/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                     <div className="flex items-center gap-1 min-w-0">
                      <Icon className={`h-3 w-3 shrink-0 ${positive ? 'text-accent' : 'text-destructive'}`} />
                      <span className="font-semibold text-foreground truncate">{alert.item_name}</span>
                    </div>
                    <button
                      onClick={() => onDismissAlert(alert.id)}
                      className="shrink-0 text-muted-foreground/50 hover:text-muted-foreground"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-muted-foreground">
                    <span className={`font-mono font-bold ${positive ? 'text-accent' : 'text-destructive'}`}>
                      {positive ? '+' : ''}{alert.delta_percent.toFixed(1)}%
                    </span>
                    <span className="font-mono">
                      ${alert.old_price.toFixed(2)} → ${alert.new_price.toFixed(2)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-muted-foreground/50">
                    <Clock className="h-2.5 w-2.5" />
                    <span>{alert.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</span>
                    <span className="font-mono">Float: {alert.float_value != null ? alert.float_value.toFixed(4) : "—"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
