import { Terminal, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { LogEntry, getFloatWear, getResultStyle, formatCurrency } from "@/data/mockData";

interface LiveLogFeedProps {
  entries: LogEntry[];
}

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

export const LiveLogFeed = ({ entries }: LiveLogFeedProps) => {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Terminal className="h-4 w-4 text-primary" />
          Live Activity
          <span className="ml-auto flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-xs text-muted-foreground font-normal">Live</span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-[320px]">
          <div className="px-4 pb-4 space-y-1">
            {entries.map((entry) => {
              const wear = getFloatWear(entry.float);
              const result = getResultStyle(entry.result);

              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                >
                  {/* Timestamp */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono min-w-[70px]">
                    <Clock className="h-3 w-3" />
                    {formatTime(entry.timestamp)}
                  </div>

                  {/* Item Name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{entry.itemName}</p>
                    {entry.reason && (
                      <p className="text-xs text-muted-foreground truncate">{entry.reason}</p>
                    )}
                  </div>

                  {/* Float */}
                  <Badge variant="outline" className={`font-mono text-xs ${wear.color}`}>
                    {entry.float.toFixed(4)}
                  </Badge>

                  {/* Price */}
                  <span className="text-sm font-mono text-foreground min-w-[80px] text-right">
                    {formatCurrency(entry.price)}
                  </span>

                  {/* Result */}
                  <Badge
                    variant="outline"
                    className={`min-w-[70px] justify-center ${result.color}`}
                  >
                    {result.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
