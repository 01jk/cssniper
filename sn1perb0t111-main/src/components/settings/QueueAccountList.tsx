import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Eye, EyeOff, Power, Save } from "lucide-react";
import { getProxyAddress, formatProxyInput } from "../../utils/proxyHelper";

interface Account {
  api_key: string;
  proxy: string;
  enabled?: boolean;
}

interface QueueAccountListProps {
  title: string;
  description: string;
  accounts: Account[];
  queueId: string;
  queueName: string;
  startIndex: number;
  onUpdateAccount: (index: number, field: 'api_key' | 'proxy' | 'enabled', value: string | boolean) => void;
  onAddAccount: () => void;
  onRemoveAccount: (index: number) => void;
  visibleKeys: Record<string, boolean>;
  onToggleVisibility: (id: string, type?: 'scanner' | 'market' | 'autobuy', index?: number) => void;
  inputRefs: React.MutableRefObject<Record<string, HTMLInputElement>>;
  accountStatuses: Record<string, any>;
  originalAccounts: Account[];
  onSaveIndividualAccount: (index: number) => void;
  globalProxyType?: string;
}

const getProxyType = (proxyStr: string | null | undefined): string => {
  if (!proxyStr) return "http";
  if (proxyStr.startsWith("socks5h://")) return "socks5h";
  if (proxyStr.startsWith("socks5://")) return "socks5";
  if (proxyStr.startsWith("https://")) return "https";
  return "http";
};



export const QueueAccountList = ({
  title,
  description,
  accounts,
  queueId,
  queueName,
  startIndex,
  onUpdateAccount,
  onAddAccount,
  onRemoveAccount,
  visibleKeys,
  onToggleVisibility,
  inputRefs,
  accountStatuses,
  originalAccounts,
  onSaveIndividualAccount,
  globalProxyType = "http"
}: QueueAccountListProps) => {
  const rowRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const addRequestedRef = useRef(false);
  const prevLengthRef = useRef(accounts.length);
  const [highlightedAccountIndex, setHighlightedAccountIndex] = useState<number | null>(null);

  const getScrollableParent = (element: HTMLElement | null): HTMLElement | null => {
    if (!element) return null;

    let parent = element.parentElement;
    while (parent) {
      const style = window.getComputedStyle(parent);
      const overflowY = style.overflowY;
      const canScroll = (overflowY === "auto" || overflowY === "scroll") && parent.scrollHeight > parent.clientHeight;
      if (canScroll) return parent;
      parent = parent.parentElement;
    }

    return null;
  };

  const smoothScrollToRow = (row: HTMLElement) => {
    const scrollParent = getScrollableParent(row);

    if (scrollParent) {
      const parentRect = scrollParent.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      const targetTop = scrollParent.scrollTop + (rowRect.top - parentRect.top) - (scrollParent.clientHeight / 2) + (rowRect.height / 2);
      scrollParent.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
      return;
    }

    row.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const getGlobalAccountIndex = (localIndex: number) => {
    return startIndex + localIndex;
  };

  const handleAddAccount = () => {
    addRequestedRef.current = true;
    prevLengthRef.current = accounts.length;
    onAddAccount();
  };

  useEffect(() => {
    if (!addRequestedRef.current) {
      prevLengthRef.current = accounts.length;
      return;
    }

    if (accounts.length <= prevLengthRef.current) {
      return;
    }

    const newLocalIndex = accounts.length - 1;
    const newGlobalIndex = getGlobalAccountIndex(newLocalIndex);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const row = rowRefs.current[newGlobalIndex];
        if (!row) return;

        smoothScrollToRow(row);

        setHighlightedAccountIndex(newGlobalIndex);
        window.setTimeout(() => {
          setHighlightedAccountIndex((current) => (current === newGlobalIndex ? null : current));
        }, 1800);

        const apiInput = inputRefs.current[`api-queue-${queueId}-${newLocalIndex}`];
        if (apiInput) {
          window.setTimeout(() => {
            apiInput.focus({ preventScroll: true });
          }, 80);
        }
      });
    });

    addRequestedRef.current = false;
    prevLengthRef.current = accounts.length;
  }, [accounts.length, inputRefs, queueId, startIndex]);

  return (
    <Card className="border-border/50 mt-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            {title}
            <div className={`px-2 py-1 rounded-full text-xs text-white font-medium ${
              queueId === '1' ? 'bg-blue-500' : queueId === '2' ? 'bg-green-500' : 'bg-purple-500'
            }`}>
              {queueName}
            </div>
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={handleAddAccount}>
          <Plus className="h-4 w-4 mr-2" /> Add Account
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {accounts.length === 0 && (
          <p className="text-sm text-muted-foreground italic text-center">No accounts configured</p>
        )}
        {accounts.map((acc, i) => {
          const globalIndex = getGlobalAccountIndex(i);
          const isEnabled = acc.enabled !== false; // Default to true if not set
          const originalAcc = originalAccounts[i];
          const isModified = !originalAcc || acc.api_key !== originalAcc.api_key || acc.proxy !== originalAcc.proxy;
          
          let statusColor = "bg-gray-400";
          let statusTitle = "Unknown Status";
          const statusData = accountStatuses?.[globalIndex.toString()];
          if (statusData) {
            const code = statusData.status_code;
            const redCodes = [403, 400, 401, 405, 404, 406, 410];
            
            if (code === 429) {
              statusColor = "bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)] animate-pulse";
              statusTitle = `Rate Limited - ${statusData.error || '429'}`;
            } else if (redCodes.includes(code)) {
              statusColor = "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse";
              statusTitle = `Error ${code} - ${statusData.error}`;
            } else {
              statusColor = "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]";
              statusTitle = code === 200 ? "OK" : `Active (Code ${code})`;
            }
          }

          return (
            <div
              key={`${queueId}-${i}`}
              ref={(el) => {
                rowRefs.current[globalIndex] = el;
              }}
              className={`grid grid-cols-12 gap-2 items-center bg-secondary/20 p-3 rounded border transition-all ${highlightedAccountIndex === globalIndex ? 'border-white ring-1 ring-white/90 shadow-[0_0_0_1px_rgba(255,255,255,0.9)]' : 'border-border/50'} ${isEnabled ? '' : 'opacity-50'}`}
            >
              <div className="col-span-1 flex items-center justify-center gap-2">
                <div className={`w-8 h-8 rounded-full text-xs font-medium flex items-center justify-center shrink-0 ${isEnabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  {globalIndex}
                </div>
                <div className="relative group flex items-center justify-center shrink-0 cursor-help">
                  <div className={`w-3 h-3 rounded-full ${statusColor}`} />
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-popover text-popover-foreground text-xs font-medium border border-border shadow-md rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap">
                    {statusTitle}
                  </div>
                </div>
              </div>
              <div className="col-span-5 relative">
                <Input
                  id={`api-queue-${queueId}-${i}`}
                  key={`api-queue-${queueId}-${i}`}
                  data-account-type="scanner"
                  data-account-index={globalIndex}
                  ref={(el) => {
                    if (el) inputRefs.current[`api-queue-${queueId}-${i}`] = el;
                  }}
                  type={visibleKeys[`queue-${queueId}-${i}`] ? "text" : "password"}
                  placeholder="API Key"
                  value={acc.api_key}
                  onChange={(e) => onUpdateAccount(globalIndex, 'api_key', e.target.value)}
                  className="font-mono text-xs pr-8"
                  disabled={!isEnabled}
                />
                <button
                  type="button"
                  onClick={() => onToggleVisibility(`queue-${queueId}-${i}`, 'scanner', globalIndex)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {visibleKeys[`queue-${queueId}-${i}`] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="col-span-4 flex gap-1 items-center">
                <Input
                  id={`proxy-queue-${queueId}-${i}`}
                  key={`proxy-queue-${queueId}-${i}`}
                  ref={(el) => {
                    if (el) inputRefs.current[`proxy-queue-${queueId}-${i}`] = el;
                  }}
                  placeholder="Proxy (e.g. host:port)"
                  value={getProxyAddress(acc.proxy)}
                  onChange={(e) => {
                    onUpdateAccount(globalIndex, 'proxy', formatProxyInput(e.target.value, globalProxyType));
                  }}
                  className="font-mono text-xs flex-1 min-w-0"
                  disabled={!isEnabled}
                />
              </div>
              <div className="col-span-1 flex items-center justify-center">
                <Switch
                  checked={isEnabled}
                  onCheckedChange={(checked) => onUpdateAccount(globalIndex, 'enabled', checked)}
                  className="data-[state=checked]:bg-green-500"
                />
              </div>
              <div className="col-span-1 text-right flex items-center justify-end gap-1 pr-1 shrink-0">
                <Button
                  size="icon"
                  disabled={!isModified}
                  onClick={() => onSaveIndividualAccount(globalIndex)}
                  className={`h-8 w-8 transition-all duration-200 shrink-0 ${
                    isModified 
                      ? "bg-primary text-primary-foreground hover:bg-primary/80 opacity-100" 
                      : "bg-secondary/40 text-muted-foreground opacity-30 cursor-not-allowed"
                  }`}
                  title="Save changes"
                >
                  <Save className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => onRemoveAccount(globalIndex)}
                  className="h-8 w-8 hover:bg-destructive text-destructive hover:text-destructive-foreground shrink-0"
                  title="Delete account"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
