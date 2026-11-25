import { useState, useEffect, useRef } from "react";
import {
  Settings as SettingsIcon,
  RotateCcw,
  Save,
  Shield,
  Server,
  ShoppingCart,
  Activity,
  Bell,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Eraser,
  RefreshCw,
  Wand2,
  Zap,
  ChevronDown,
  ChevronUp,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Database,
  Play
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ProxyPoolManager } from "./ProxyPoolManager";
import { QueueAccountList } from "./QueueAccountList";
import { useSoundSettings } from "@/contexts/SoundSettingsContext";
import { Slider } from "@/components/ui/slider";
import { NotificationSettings } from "@/components/notifications/NotificationSettings";
import { NotificationAPITester } from "@/components/notifications/NotificationAPITester";
import { useNotifications } from "@/contexts/NotificationContext";
import { getProxyAddress, formatProxyInput } from "../../utils/proxyHelper";

interface Account {
  api_key: string;
  proxy: string;
  enabled?: boolean;
  backup_ips?: string[];
}

const formatLatency = (ms: number | string | undefined | null): string => {
  if (ms === undefined || ms === null) return "0 ms";
  const num = typeof ms === "string" ? parseFloat(ms) : ms;
  if (isNaN(num)) return "0 ms";
  if (num >= 1000) {
    return `${(num / 1000).toFixed(2)} s`;
  }
  if (Number.isInteger(num)) {
    return `${num} ms`;
  }
  return `${num.toFixed(3)} ms`;
};

const renderFormattedLatency = (ms: number | string | undefined | null) => {
  const formatted = formatLatency(ms);
  const parts = formatted.split(' ');
  if (parts.length === 2) {
    return (
      <>
        {parts[0]} <span className="text-xs font-normal">{parts[1]}</span>
      </>
    );
  }
  return formatted;
};

type SettingsProfileId = "config-1" | "config-2";

interface SettingsProfileSnapshot {
  settings: any;
  scannerAccounts: Account[];
  marketDataAccounts: Account[];
  autoBuyAccounts: Account[];
  useMarketProxies: boolean;
}

const SETTINGS_PROFILES_STORAGE_KEY = "sniper-bot-settings-profiles";
const SETTINGS_ACTIVE_PROFILE_STORAGE_KEY = "sniper-bot-settings-active-profile";

const cloneDeep = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const createEmptyProfileFromBase = (baseSettings: any): SettingsProfileSnapshot => {
  const emptySettings = cloneDeep(baseSettings || {});

  if (!emptySettings.scanner) emptySettings.scanner = {};
  if (!emptySettings.market_data) emptySettings.market_data = {};
  if (!emptySettings.auto_buy) emptySettings.auto_buy = {};

  emptySettings.scanner.accounts = [];
  emptySettings.market_data.accounts = [];
  emptySettings.auto_buy.accounts = [];
  emptySettings.scanner.queue_config = {
    enabled: false,
    rate_limit_threshold: 3,
    check_interval: 5,
    queues: {},
  };

  emptySettings.scanner.poll_interval_min = "";
  emptySettings.scanner.poll_interval_max = "";
  emptySettings.scanner.pre_delay_min = "";
  emptySettings.scanner.pre_delay_max = "";
  emptySettings.scanner.base_delay = "";
  emptySettings.scanner.request_timeout = "";
  emptySettings.scanner.buy_order_check_interval = "";
  emptySettings.scanner.buy_order_notif_states = ["queued", "pending", "verified"];
  emptySettings.scanner.max_requests_per_session = "";
  emptySettings.scanner.max_session_age_minutes = "";

  return {
    settings: emptySettings,
    scannerAccounts: [],
    marketDataAccounts: [],
    autoBuyAccounts: [],
    useMarketProxies: true,
  };
};

const getProxyType = (proxyStr: string | null | undefined): string => {
  if (!proxyStr) return "http";
  if (proxyStr.startsWith("socks5h://")) return "socks5h";
  if (proxyStr.startsWith("socks5://")) return "socks5";
  if (proxyStr.startsWith("https://")) return "https";
  return "http";
};



const detectGlobalProxyType = (scanner: Account[], market: Account[], autobuy: Account[]): string => {
  const allAccounts = [...scanner, ...market, ...autobuy];
  for (const acc of allAccounts) {
    if (acc.proxy) {
      if (acc.proxy.startsWith("socks5h://")) return "socks5h";
      if (acc.proxy.startsWith("socks5://")) return "socks5";
      if (acc.proxy.startsWith("https://")) return "https";
      if (acc.proxy.startsWith("http://")) return "http";
    }
  }
  return "http";
};

export const Settings = () => {
  const { toast } = useToast();
  const { settings: soundSettings, setVolume, playSound } = useSoundSettings();
  const { clearAllNotifications } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [activeSettingsProfile, setActiveSettingsProfile] = useState<SettingsProfileId>(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_ACTIVE_PROFILE_STORAGE_KEY);
      if (stored === "config-1" || stored === "config-2") {
        return stored;
      }
    } catch {
      // ignore
    }
    return "config-1";
  });
  const [settingsProfiles, setSettingsProfiles] = useState<Record<SettingsProfileId, SettingsProfileSnapshot> | null>(null);

  // Get initial tab from localStorage or default to "accounts"
  const getInitialTab = () => {
    try {
      const stored = localStorage.getItem("sniper-bot-settings-tab");
      if (stored) {
        return stored;
      }
    } catch (e) {
      console.debug("Failed to load settings tab:", e);
    }
    return "accounts";
  };
  const [activeTab, setActiveTab] = useState(getInitialTab);

  // State for all settings
  const [settings, setSettings] = useState<any>(null);
  const [originalSettings, setOriginalSettings] = useState<any>(null);
  const [globalProxyType, setGlobalProxyType] = useState<string>("http");

  // Dedicated state for account lists (to make editing easier)
  const [scannerAccounts, setScannerAccounts] = useState<Account[]>([]);
  const [marketDataAccounts, setMarketDataAccounts] = useState<Account[]>([]);
  const [autoBuyAccounts, setAutoBuyAccounts] = useState<Account[]>([]);
  const [originalScannerAccounts, setOriginalScannerAccounts] = useState<Account[]>([]);
  const [originalMarketAccounts, setOriginalMarketAccounts] = useState<Account[]>([]);
  const [originalAutoBuyAccounts, setOriginalAutoBuyAccounts] = useState<Account[]>([]);
  const [highlightedAccountRow, setHighlightedAccountRow] = useState<{ type: 'scanner' | 'market' | 'autobuy'; index: number } | null>(null);

  // Passwords visibility state
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});

  // ===========================================
  // STATISTICS & LATENCY TAB STATE
  // ===========================================
  const [statsTabMode, setStatsTabMode] = useState<'general' | 'test'>('general');
  const [latencies, setLatencies] = useState<any[]>([]);
  const [loadingLatencies, setLoadingLatencies] = useState<boolean>(false);
  const [showFailedPurchases, setShowFailedPurchases] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("stats-show-failed-purchases");
      return saved === "true";
    } catch {
      return false;
    }
  });
  const [selectedIds, setSelectedIds] = useState<Record<number, boolean>>({});
  const [statsSearchTerm, setStatsSearchTerm] = useState<string>("");

  // Test Mode state
  const [monitorItems, setMonitorItems] = useState<any[]>([]);
  const [selectedMonitorItem, setSelectedMonitorItem] = useState<any | null>(null);
  const [testRunning, setTestRunning] = useState<boolean>(false);
  const [testResults, setTestResults] = useState<any | null>(null);

  // Auto-fetch latencies when activeTab is statistics
  useEffect(() => {
    if (activeTab === "statistics") {
      fetchLatencies();
      fetchMonitorItems();
    }
  }, [activeTab]);

  // Persist showFailedPurchases
  useEffect(() => {
    try {
      localStorage.setItem("stats-show-failed-purchases", String(showFailedPurchases));
    } catch (e) {
      console.error(e);
    }
  }, [showFailedPurchases]);

  const fetchLatencies = async () => {
    setLoadingLatencies(true);
    try {
      const response = await fetch('/api/statistics/latencies');
      if (response.ok) {
        const data = await response.json();
        setLatencies(data);
      } else {
        console.error("Failed to fetch latencies:", response.statusText);
      }
    } catch (error) {
      console.error("Error fetching latencies:", error);
    } finally {
      setLoadingLatencies(false);
    }
  };

  const fetchMonitorItems = async () => {
    try {
      const response = await fetch('/api/live-monitor/state');
      if (response.ok) {
        const data = await response.json();
        setMonitorItems(data.items || []);
        if (data.items && data.items.length > 0 && !selectedMonitorItem) {
          setSelectedMonitorItem(data.items[0]);
        }
      }
    } catch (error) {
      console.error("Error fetching live monitor items:", error);
    }
  };

  const deleteSingleLatency = async (id: number) => {
    try {
      const response = await fetch(`/api/statistics/latencies?ids=${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        toast({
          title: "Record deleted",
          description: "Latency measurement successfully deleted from the database",
        });
        fetchLatencies();
        setSelectedIds(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to delete record",
        });
      }
    } catch (error) {
      console.error("Error deleting latency record:", error);
    }
  };

  const deleteSelectedLatencies = async () => {
    const idsToDelete = Object.keys(selectedIds).filter(id => selectedIds[Number(id)]);
    if (idsToDelete.length === 0) return;

    try {
      const response = await fetch(`/api/statistics/latencies?ids=${idsToDelete.join(",")}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        toast({
          title: "Selected records deleted",
          description: `Successfully deleted records: ${idsToDelete.length}`,
        });
        setSelectedIds({});
        fetchLatencies();
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to delete selected records",
        });
      }
    } catch (error) {
      console.error("Error deleting selected latencies:", error);
    }
  };

  const clearAllLatencies = async () => {
    try {
      const response = await fetch('/api/statistics/latencies', {
        method: 'DELETE',
      });
      if (response.ok) {
        toast({
          title: "Database cleared",
          description: "All latency statistics successfully deleted",
        });
        setSelectedIds({});
        setLatencies([]);
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to clear statistics",
        });
      }
    } catch (error) {
      console.error("Error clearing latencies:", error);
    }
  };

  const runLatencyTest = async () => {
    if (!selectedMonitorItem) {
      toast({
        variant: "destructive",
        title: "No item selected",
        description: "Please select an item from the list for testing",
      });
      return;
    }

    setTestRunning(true);
    setTestResults(null);
    try {
      const activeProfile = localStorage.getItem("sniper-bot-settings-active-profile") || undefined;
      const mappedListing = {
        id: selectedMonitorItem.id,
        created_at: selectedMonitorItem.listedAt ? new Date(selectedMonitorItem.listedAt).toISOString() : new Date().toISOString(),
        price: Math.round(selectedMonitorItem.price * 100),
        item: {
          item_name: selectedMonitorItem.name,
          market_hash_name: selectedMonitorItem.name,
          float_value: selectedMonitorItem.float,
          paint_seed: selectedMonitorItem.paintSeed,
          is_stattrak: selectedMonitorItem.isStatTrak,
          is_souvenir: selectedMonitorItem.isSouvenir,
          stickers: selectedMonitorItem.stickers?.map((s: any) => ({
            slot: s.slot,
            name: s.name,
            wear: s.wear,
          })) || []
        }
      };

      const response = await fetch('/api/statistics/test-item', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          listing: mappedListing,
          profile: activeProfile,
        }),
      });

      if (response.ok) {
        const results = await response.json();
        setTestResults(results);
        toast({
          title: "Test completed",
          description: `Latency successfully measured for ${selectedMonitorItem.name}`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Test error",
          description: `Failed to complete latency test. Error code: ${response.status}`,
        });
      }
    } catch (error) {
      console.error("Error running latency test:", error);
      toast({
        variant: "destructive",
        title: "Network error",
        description: "Failed to connect to the backend API",
      });
    } finally {
      setTestRunning(false);
    }
  };

  // Proxy Pools autosave synchronization
  const [proxyPoolsReloadTrigger, setProxyPoolsReloadTrigger] = useState(0);

  const handleBackupIPsChange = (updatedAccounts: any[]) => {
    let changed = false;

    const newScanner = scannerAccounts.map((acc, idx) => {
      const match = updatedAccounts.find(u => u.account_type === "scanner" && u.index === idx);
      if (match) {
        const matchIPs = match.backup_ips || [];
        const accIPs = acc.backup_ips || [];
        if (JSON.stringify(matchIPs) !== JSON.stringify(accIPs)) {
          changed = true;
          return { ...acc, backup_ips: matchIPs };
        }
      }
      return acc;
    });

    const newMarket = marketDataAccounts.map((acc, idx) => {
      const match = updatedAccounts.find(u => u.account_type === "market_data" && u.index === idx);
      if (match) {
        const matchIPs = match.backup_ips || [];
        const accIPs = acc.backup_ips || [];
        if (JSON.stringify(matchIPs) !== JSON.stringify(accIPs)) {
          changed = true;
          return { ...acc, backup_ips: matchIPs };
        }
      }
      return acc;
    });

    const newAutoBuy = autoBuyAccounts.map((acc, idx) => {
      const match = updatedAccounts.find(u => u.account_type === "auto_buy" && u.index === idx);
      if (match) {
        const matchIPs = match.backup_ips || [];
        const accIPs = acc.backup_ips || [];
        if (JSON.stringify(matchIPs) !== JSON.stringify(accIPs)) {
          changed = true;
          return { ...acc, backup_ips: matchIPs };
        }
      }
      return acc;
    });

    if (changed) {
      setScannerAccounts(newScanner);
      setMarketDataAccounts(newMarket);
      setAutoBuyAccounts(newAutoBuy);
    }
  };

  // Bulk Distributor State
  const [isDistributorOpen, setIsDistributorOpen] = useState(false);
  const [distKeys, setDistKeys] = useState("");
  const [distProxies, setDistProxies] = useState("");
  const [useMarketProxies, setUseMarketProxies] = useState(true);
  const [distTargetQueues, setDistTargetQueues] = useState<Record<string, boolean>>({});
  const [distTargetMarket, setDistTargetMarket] = useState(true);
  const [distOverwrite, setDistOverwrite] = useState(true);

  const getDistAllocation = (totalKeys: number) => {
    const active: string[] = [];
    const queuesEnabled = settings?.scanner?.queue_config?.enabled;
    const queues = settings?.scanner?.queue_config?.queues || {};
    const queueIds = Object.keys(queues).sort((a, b) => Number(a) - Number(b));
    
    if (queuesEnabled) {
      queueIds.forEach(qId => {
        if (distTargetQueues[qId] !== false) {
          active.push(`queue-${qId}`);
        }
      });
    } else {
      if (distTargetQueues['scanner'] !== false) {
        active.push('scanner');
      }
    }
    if (distTargetMarket) {
      active.push('market');
    }

    const result: Record<string, number> = {};
    active.forEach(target => {
      result[target] = 0;
    });

    if (active.length === 0 || totalKeys === 0) return result;

    const baseCount = Math.floor(totalKeys / active.length);
    let remainder = totalKeys % active.length;

    active.forEach((target) => {
      result[target] = baseCount + (remainder > 0 ? 1 : 0);
      remainder = Math.max(0, remainder - 1);
    });

    return result;
  };

  // Account status tracking state
  const [accountStatuses, setAccountStatuses] = useState<Record<string, Record<string, any>>>({});
  const confirmActionRef = useRef<(() => void) | null>(null);
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: "Confirm action",
    description: "",
    actionLabel: "Confirm",
  });

  const requestConfirmation = (
    title: string,
    description: string,
    onConfirm: () => void,
    actionLabel = "Confirm"
  ) => {
    confirmActionRef.current = onConfirm;
    setConfirmDialog({
      open: true,
      title,
      description,
      actionLabel,
    });
  };

  const closeConfirmation = () => {
    setConfirmDialog((prev) => ({ ...prev, open: false }));
    confirmActionRef.current = null;
  };

  const executeConfirmation = () => {
    confirmActionRef.current?.();
    closeConfirmation();
  };

  useEffect(() => {
    fetchSettings();

    // Status polling
    const fetchStatuses = async () => {
      try {
        const res = await fetch("/api/accounts/status");
        if (res.ok) {
          const data = await res.json();
          setAccountStatuses(data);
        }
      } catch (error) {
        // ignore
      }
    };
    fetchStatuses();
    const interval = setInterval(fetchStatuses, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_ACTIVE_PROFILE_STORAGE_KEY, activeSettingsProfile);
    } catch {
      // ignore
    }
  }, [activeSettingsProfile]);

  useEffect(() => {
    if (!settings) return;
    
    const nextQueues: Record<string, boolean> = {};
    const queuesEnabled = settings?.scanner?.queue_config?.enabled;
    const queues = settings?.scanner?.queue_config?.queues || {};
    
    if (queuesEnabled) {
      Object.keys(queues).forEach(qId => {
        nextQueues[qId] = distTargetQueues[qId] !== false;
      });
    } else {
      nextQueues['scanner'] = distTargetQueues['scanner'] !== false;
    }
    
    const currentKeys = Object.keys(distTargetQueues).sort();
    const nextKeys = Object.keys(nextQueues).sort();
    if (JSON.stringify(currentKeys) !== JSON.stringify(nextKeys)) {
      setDistTargetQueues(nextQueues);
    }
  }, [settings]);

  // Слушатель события очистки всех уведомлений
  useEffect(() => {
    const handleClearAll = () => {
      clearAllNotifications();
      toast({ title: "Notifications Cleared", description: "All notifications have been deleted" });
    };

    window.addEventListener('clear-all-notifications', handleClearAll);
    return () => window.removeEventListener('clear-all-notifications', handleClearAll);
  }, [clearAllNotifications, toast]);

  // Save active tab to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("sniper-bot-settings-tab", activeTab);
    } catch (e) {
      console.debug("Failed to save settings tab:", e);
    }
  }, [activeTab]);

  // Auto-save effect on settings or accounts change (debounced)
  useEffect(() => {
    if (loading || !settings || !originalSettings) return;

    const hasAccountChanges = 
      JSON.stringify(scannerAccounts) !== JSON.stringify(originalScannerAccounts) ||
      JSON.stringify(marketDataAccounts) !== JSON.stringify(originalMarketAccounts) ||
      JSON.stringify(autoBuyAccounts) !== JSON.stringify(originalAutoBuyAccounts);

    const hasSettingsChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);

    const hasMarketProxyChanges = useMarketProxies !== (originalSettings.market_data?.use_market_proxies !== undefined ? Boolean(originalSettings.market_data.use_market_proxies) : true);

    if (hasAccountChanges || hasSettingsChanges || hasMarketProxyChanges) {
      const timer = setTimeout(() => {
        saveSettings();
      }, 1000); // 1 second debounce
      return () => clearTimeout(timer);
    }
  }, [
    settings,
    originalSettings,
    scannerAccounts,
    originalScannerAccounts,
    marketDataAccounts,
    originalMarketAccounts,
    autoBuyAccounts,
    originalAutoBuyAccounts,
    useMarketProxies,
    loading
  ]);

  // Allow external navigation (e.g. notification button) to force Accounts tab
  useEffect(() => {
    const handleOpenAccounts = () => {
      setActiveTab("accounts");
      try {
        localStorage.setItem("sniper-bot-settings-tab", "accounts");
      } catch {
        // ignore
      }
    };

    window.addEventListener("settings-open-accounts", handleOpenAccounts);
    return () => window.removeEventListener("settings-open-accounts", handleOpenAccounts);
  }, []);

  // Handle account jump request from notifications (401/403 quick fix button)
  useEffect(() => {
    if (loading || activeTab !== "accounts") return;

    let payload: { type: "scanner" | "market" | "autobuy"; index: number; ts: number } | null = null;
    try {
      const raw = localStorage.getItem("sniper-bot-account-jump");
      if (!raw) return;
      payload = JSON.parse(raw);
    } catch {
      return;
    }

    if (!payload) return;

    const normalizedIndex = Math.max(0, payload.index || 0);

    let attempts = 0;
    let timerId: number | null = null;

    const tryJump = () => {
      attempts += 1;

      const byDataSelector = `input[data-account-type="${payload!.type}"][data-account-index="${normalizedIndex}"]`;
      let el = document.querySelector(byDataSelector) as HTMLInputElement | null;

      if (!el) {
        const id = `api-${payload!.type}-${normalizedIndex}`;
        el = document.getElementById(id) as HTMLInputElement | null;
      }

      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        window.setTimeout(() => {
          el.focus();
          el.classList.add("ring-2", "ring-destructive", "ring-offset-1");
          window.setTimeout(() => {
            el.classList.remove("ring-2", "ring-destructive", "ring-offset-1");
          }, 2400);
        }, 220);

        try {
          localStorage.removeItem("sniper-bot-account-jump");
        } catch {
          // ignore
        }
        return;
      }

      if (attempts < 10) {
        timerId = window.setTimeout(tryJump, 180);
      }
    };

    tryJump();

    return () => {
      if (timerId) {
        window.clearTimeout(timerId);
      }
    };
  }, [loading, activeTab, scannerAccounts.length, marketDataAccounts.length, autoBuyAccounts.length]);

  const fetchSettings = async () => {
    try {
      const resConfig1 = await fetch("/api/settings?profile=config-1");
      if (!resConfig1.ok) throw new Error("Failed to fetch config-1 settings");
      const dataConfig1 = await resConfig1.json();

      const resConfig2 = await fetch("/api/settings?profile=config-2");
      const dataConfig2 = resConfig2.ok ? await resConfig2.json() : null;

      const extractScannerAccounts = (data: any): Account[] => data.scanner?.accounts?.length
        ? data.scanner.accounts
        : (() => {
            const oldKey = data.scanner?.api_key || "";
            const oldProxies = data.scanner?.monitoring_proxies || [];
            if (oldProxies.length > 0) {
              return oldProxies.map((p: string) => ({ api_key: oldKey, proxy: p }));
            }
            if (oldKey) {
              return [{ api_key: oldKey, proxy: "" }];
            }
            return [];
          })();

      const extractMarketAccounts = (data: any): Account[] => data.market_data?.accounts?.length
        ? data.market_data.accounts
        : (() => {
            const oldKey = data.scanner?.api_key || "";
            const oldProxies = data.market_data?.proxies || [];
            if (oldProxies.length > 0) {
              return oldProxies.map((p: string) => ({ api_key: oldKey, proxy: p }));
            }
            return [];
          })();

      const extractAutoBuyAccounts = (data: any): Account[] => data.auto_buy?.accounts?.length
        ? data.auto_buy.accounts
        : (() => {
            const oldKey = data.scanner?.api_key || "";
            const oldProxy = data.scanner?.sniper_proxy || "";
            if (oldKey || oldProxy) {
              return [{ api_key: oldKey, proxy: oldProxy }];
            }
            return [];
          })();

      const scannerFromApi: Account[] = extractScannerAccounts(dataConfig1);
      const marketFromApi: Account[] = extractMarketAccounts(dataConfig1);
      const autoBuyFromApi: Account[] = extractAutoBuyAccounts(dataConfig1);

      const config1: SettingsProfileSnapshot = {
        settings: cloneDeep(dataConfig1),
        scannerAccounts: cloneDeep(scannerFromApi),
        marketDataAccounts: cloneDeep(marketFromApi),
        autoBuyAccounts: cloneDeep(autoBuyFromApi),
        useMarketProxies: dataConfig1.market_data?.use_market_proxies !== undefined ? Boolean(dataConfig1.market_data.use_market_proxies) : true,
      };

      let config2 = createEmptyProfileFromBase(dataConfig1);
      if (dataConfig2 && !dataConfig2.error) {
        config2 = {
          settings: cloneDeep(dataConfig2),
          scannerAccounts: cloneDeep(extractScannerAccounts(dataConfig2)),
          marketDataAccounts: cloneDeep(extractMarketAccounts(dataConfig2)),
          autoBuyAccounts: cloneDeep(extractAutoBuyAccounts(dataConfig2)),
          useMarketProxies:
            dataConfig2.market_data?.use_market_proxies !== undefined
              ? Boolean(dataConfig2.market_data.use_market_proxies)
              : true,
        };
        // Bot & Telegram settings are shared between profiles and must match Config 1.
        config2.settings.bot = cloneDeep(config1.settings?.bot || {});
      }

      try {
        const storedRaw = localStorage.getItem(SETTINGS_PROFILES_STORAGE_KEY);
        if (storedRaw) {
          const stored = JSON.parse(storedRaw) as Partial<Record<SettingsProfileId, SettingsProfileSnapshot>>;
          // Backward-compatible fallback for users who had local-only config-2 snapshots
          if ((!dataConfig2 || dataConfig2.error) && stored["config-2"]) {
            config2 = stored["config-2"] as SettingsProfileSnapshot;
            config2.settings = config2.settings || {};
            config2.settings.bot = cloneDeep(config1.settings?.bot || {});
          }
        }
      } catch {
        // ignore corrupted profile cache
      }

      const profiles: Record<SettingsProfileId, SettingsProfileSnapshot> = {
        "config-1": config1,
        "config-2": config2,
      };
      setSettingsProfiles(profiles);

      const active = profiles[activeSettingsProfile];
      setSettings(active.settings);
      setOriginalSettings(cloneDeep(active.settings));
      setScannerAccounts(active.scannerAccounts);
      setMarketDataAccounts(active.marketDataAccounts);
      setAutoBuyAccounts(active.autoBuyAccounts);
      setUseMarketProxies(active.useMarketProxies);
      setGlobalProxyType(detectGlobalProxyType(active.scannerAccounts, active.marketDataAccounts, active.autoBuyAccounts));

      setOriginalScannerAccounts(cloneDeep(active.scannerAccounts));
      setOriginalMarketAccounts(cloneDeep(active.marketDataAccounts));
      setOriginalAutoBuyAccounts(cloneDeep(active.autoBuyAccounts));

      setLoading(false);
      setProxyPoolsReloadTrigger(prev => prev + 1);
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to load settings", variant: "destructive" });
    }
  };

  const snapshotCurrentProfile = (): SettingsProfileSnapshot => ({
    settings: cloneDeep(settings),
    scannerAccounts: cloneDeep(scannerAccounts),
    marketDataAccounts: cloneDeep(marketDataAccounts),
    autoBuyAccounts: cloneDeep(autoBuyAccounts),
    useMarketProxies,
  });

  const persistProfiles = (profiles: Record<SettingsProfileId, SettingsProfileSnapshot>) => {
    setSettingsProfiles(profiles);
    try {
      localStorage.setItem(SETTINGS_PROFILES_STORAGE_KEY, JSON.stringify(profiles));
    } catch {
      // ignore storage failures
    }
  };

  const switchProfile = (nextProfile: SettingsProfileId) => {
    if (nextProfile === activeSettingsProfile || !settingsProfiles) return;

    const updatedProfiles: Record<SettingsProfileId, SettingsProfileSnapshot> = {
      ...settingsProfiles,
      [activeSettingsProfile]: snapshotCurrentProfile(),
    };

    const nextSnapshot = updatedProfiles[nextProfile];
    if (!nextSnapshot) return;

    persistProfiles(updatedProfiles);
    setActiveSettingsProfile(nextProfile);
    setSettings(cloneDeep(nextSnapshot.settings));
    setOriginalSettings(cloneDeep(nextSnapshot.settings));
    setScannerAccounts(cloneDeep(nextSnapshot.scannerAccounts));
    setMarketDataAccounts(cloneDeep(nextSnapshot.marketDataAccounts));
    setAutoBuyAccounts(cloneDeep(nextSnapshot.autoBuyAccounts));
    setUseMarketProxies(Boolean(nextSnapshot.useMarketProxies));
    setGlobalProxyType(detectGlobalProxyType(nextSnapshot.scannerAccounts, nextSnapshot.marketDataAccounts, nextSnapshot.autoBuyAccounts));

    setOriginalScannerAccounts(cloneDeep(nextSnapshot.scannerAccounts));
    setOriginalMarketAccounts(cloneDeep(nextSnapshot.marketDataAccounts));
    setOriginalAutoBuyAccounts(cloneDeep(nextSnapshot.autoBuyAccounts));
  };

  const handleGlobalProxyTypeChange = (newType: string) => {
    setGlobalProxyType(newType);
    
    const prefix = newType === "https" ? "https://" : newType === "socks5h" ? "socks5h://" : newType === "socks5" ? "socks5://" : "http://";
    
    const updatePrefix = (acc: Account) => {
      if (!acc.proxy) return acc;
      const address = getProxyAddress(acc.proxy);
      return { ...acc, proxy: address ? prefix + address : "" };
    };

    setScannerAccounts(prev => prev.map(updatePrefix));
    setMarketDataAccounts(prev => prev.map(updatePrefix));
    setAutoBuyAccounts(prev => prev.map(updatePrefix));
  };

  const saveSettings = async (skipBackupPreservation = false) => {
    try {
      // Reconstruct payload
      const newSettings = {
        ...settings,
        scanner: {
          ...settings.scanner,
          // Preserve backup_ips and other fields when updating accounts (unless skipping)
          accounts: scannerAccounts
            .filter(a => a.api_key || a.proxy)
            .map((account: any) => {
              return {
                ...account,
                api_key: account.api_key,
                proxy: account.proxy,
                enabled: account.enabled !== false, // Default to true if not set
                backup_ips: skipBackupPreservation ? [] : (account.backup_ips || []) // PRESERVE BACKUP IPs unless skipping
              };
            }),
          // Legacy fallbacks
          api_key: scannerAccounts[0]?.api_key || "",
          monitoring_proxies: scannerAccounts.map(a => a.proxy).filter(Boolean),
          sniper_proxy: autoBuyAccounts[0]?.proxy || "",
        },
        market_data: {
          ...settings.market_data,
          use_market_proxies: useMarketProxies,
          accounts: marketDataAccounts
            .filter(a => a.api_key || a.proxy)
            .map((account: any) => {
              return {
                ...account,
                api_key: account.api_key,
                proxy: account.proxy,
                enabled: account.enabled !== false, // Default to true if not set
                backup_ips: skipBackupPreservation ? [] : (account.backup_ips || []) // PRESERVE BACKUP IPs unless skipping
              };
            }),
          proxies: marketDataAccounts.map(a => a.proxy).filter(Boolean),
        },
        auto_buy: {
          accounts: autoBuyAccounts
            .filter(a => a.api_key || a.proxy)
            .map((account: any) => {
              return {
                ...account,
                api_key: account.api_key,
                proxy: account.proxy,
                enabled: account.enabled !== false, // Default to true if not set
                backup_ips: skipBackupPreservation ? [] : (account.backup_ips || []) // PRESERVE BACKUP IPs unless skipping
              };
            }),
        }
      };

      const nextSnapshot: SettingsProfileSnapshot = {
        settings: cloneDeep(newSettings),
        scannerAccounts: cloneDeep(scannerAccounts),
        marketDataAccounts: cloneDeep(marketDataAccounts),
        autoBuyAccounts: cloneDeep(autoBuyAccounts),
        useMarketProxies,
      };

      if (activeSettingsProfile === "config-2") {
        const sharedBotSettings = cloneDeep(settingsProfiles?.["config-1"]?.settings?.bot || {});
        newSettings.bot = sharedBotSettings;
        nextSnapshot.settings.bot = cloneDeep(sharedBotSettings);
      }

      const res = await fetch(`/api/settings?profile=${activeSettingsProfile}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSettings),
      });

      if (!res.ok) throw new Error("Failed to save");

      setOriginalScannerAccounts(cloneDeep(scannerAccounts));
      setOriginalMarketAccounts(cloneDeep(marketDataAccounts));
      setOriginalAutoBuyAccounts(cloneDeep(autoBuyAccounts));
      setSettings(cloneDeep(newSettings));
      setOriginalSettings(cloneDeep(newSettings));

      if (settingsProfiles) {
        const updated = {
          ...settingsProfiles,
          [activeSettingsProfile]: nextSnapshot,
        };
        persistProfiles(updated as Record<SettingsProfileId, SettingsProfileSnapshot>);
      }

      toast({
        title: "Success",
        description: activeSettingsProfile === "config-1"
          ? "Config 1 saved to settings.yaml."
          : "Config 2 saved to settings.config2.yaml.",
      });
    } catch (error) {
      toast({ title: "Error", description: "Failed to save settings", variant: "destructive" });
    }
  };

  const toggleVisibility = async (id: string, type?: 'scanner' | 'market' | 'autobuy', index?: number) => {
    const nextVisible = !visibleKeys[id];
    setVisibleKeys(prev => ({ ...prev, [id]: nextVisible }));

    if (nextVisible && type !== undefined && index !== undefined) {
      const list = type === 'scanner' ? scannerAccounts : type === 'market' ? marketDataAccounts : autoBuyAccounts;
      const account = list[index];
      if (account && account.api_key.startsWith('•')) {
        try {
          const fieldPath = type === 'scanner' 
            ? `scanner.accounts.${index}.api_key` 
            : type === 'market' 
              ? `market_data.accounts.${index}.api_key` 
              : `auto_buy.accounts.${index}.api_key`;

          const res = await fetch("/api/settings/reveal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              field: fieldPath,
              profile: activeSettingsProfile
            })
          });

          if (res.ok) {
            const data = await res.json();
            if (data.value) {
              const setter = type === 'scanner' ? setScannerAccounts : type === 'market' ? setMarketDataAccounts : setAutoBuyAccounts;
              setter(prev => {
                const copy = [...prev];
                if (copy[index]) copy[index].api_key = data.value;
                return copy;
              });
              const origSetter = type === 'scanner' ? setOriginalScannerAccounts : type === 'market' ? setOriginalMarketAccounts : setOriginalAutoBuyAccounts;
              origSetter(prev => {
                const copy = [...prev];
                if (copy[index]) copy[index].api_key = data.value;
                return copy;
              });
            }
          }
        } catch (e) {
          console.error("Failed to reveal API key:", e);
        }
      }
    }
  };

  const saveIndividualAccount = async (listName: 'scanner' | 'market' | 'autobuy', index: number) => {
    try {
      await saveSettings();
      toast({
        title: "Account Saved",
        description: `Successfully saved changes for ${listName} account #${index}.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to save account #${index}.`,
        variant: "destructive",
      });
    }
  };

  const updateAccount = (listName: 'scanner' | 'market' | 'autobuy', index: number, field: keyof Account, value: string | boolean) => {
    // Store the active element and its cursor position before state update
    const activeElement = document.activeElement as HTMLInputElement;
    const cursorPos = activeElement?.selectionStart || 0;
    const elementId = activeElement?.id || '';

    const setter = listName === 'scanner' ? setScannerAccounts : listName === 'market' ? setMarketDataAccounts : setAutoBuyAccounts;
    setter(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });

    // Use requestAnimationFrame to ensure focus is restored after React's render cycle
    requestAnimationFrame(() => {
      // Try to find the element by ID first, then fallback to stored active element
      let targetElement = elementId ? document.getElementById(elementId) as HTMLInputElement : null;
      if (!targetElement && activeElement) {
        // Fallback: try to find by matching the current value and position
        const inputs = document.querySelectorAll('input');
        targetElement = Array.from(inputs).find(input =>
          input.value === value && input.type === activeElement.type
        ) as HTMLInputElement;
      }

      if (targetElement) {
        targetElement.focus();
        targetElement.setSelectionRange(cursorPos, cursorPos);
      } else if (activeElement && activeElement.focus) {
        // Final fallback to the stored element
        activeElement.focus();
        activeElement.setSelectionRange(cursorPos, cursorPos);
      }
    });
  };

  // Add a ref to track input focus
  const inputRefs = useRef<Record<string, HTMLInputElement>>({});
  const pendingAddAccountRef = useRef<{ type: 'scanner' | 'market' | 'autobuy'; newIndex: number } | null>(null);

  const getScrollableParent = (element: HTMLElement | null): HTMLElement | null => {
    if (!element) return null;

    let parent = element.parentElement;
    while (parent) {
      const style = window.getComputedStyle(parent);
      const overflowY = style.overflowY;
      const canScroll = (overflowY === 'auto' || overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight;
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
      scrollParent.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
      return;
    }

    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const addAccount = (listName: 'scanner' | 'market' | 'autobuy') => {
    const newIndex =
      listName === 'scanner'
        ? scannerAccounts.length
        : listName === 'market'
          ? marketDataAccounts.length
          : autoBuyAccounts.length;

    pendingAddAccountRef.current = { type: listName, newIndex };

    const setter = listName === 'scanner' ? setScannerAccounts : listName === 'market' ? setMarketDataAccounts : setAutoBuyAccounts;
    setter(prev => [...prev, { api_key: "", proxy: "" }]);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const pending = pendingAddAccountRef.current;
        if (!pending || pending.type !== listName) return;

        const row = document.getElementById(`account-row-${listName}-${pending.newIndex}`) as HTMLElement | null;
        if (row) {
          smoothScrollToRow(row);
        }

        setHighlightedAccountRow({ type: listName, index: pending.newIndex });
        window.setTimeout(() => {
          setHighlightedAccountRow((current) => {
            if (!current) return null;
            return current.type === listName && current.index === pending.newIndex ? null : current;
          });
        }, 1800);

        const apiInput = document.getElementById(`api-${listName}-${pending.newIndex}`) as HTMLInputElement | null;
        if (apiInput) {
          window.setTimeout(() => {
            apiInput.focus({ preventScroll: true });
          }, 80);
        }
        pendingAddAccountRef.current = null;
      });
    });
  };

  const removeAccount = (listName: 'scanner' | 'market' | 'autobuy', index: number) => {
    requestConfirmation(
      "Delete account?",
      `This will remove account #${index} from ${listName}. You can restore only by adding it again.`,
      () => {
        // Store scroll position
        const scrollContainer = document.querySelector('[class*="overflow-auto"]') || document.documentElement;
        const scrollTop = scrollContainer.scrollTop;

        const setter = listName === 'scanner' ? setScannerAccounts : listName === 'market' ? setMarketDataAccounts : setAutoBuyAccounts;
        setter(prev => prev.filter((_, i) => i !== index));

        // Restore scroll position after re-render
        setTimeout(() => {
          scrollContainer.scrollTop = scrollTop;
        }, 0);
      },
      "Delete"
    );
  };


  if (loading) return <div className="p-8 text-center">Loading settings...</div>;

  const getQueueForAccount = (accountIndex: number, accountType: 'scanner' | 'market' | 'autobuy') => {
    if (!settings?.scanner?.queue_config?.enabled || accountType !== 'scanner') {
      return null;
    }

    const queues = settings.scanner.queue_config.queues || {};
    for (const [queueId, queueInfo] of Object.entries(queues)) {
      const queue = queueInfo as any;
      const startIndex = queue.start_index || 0;
      const endIndex = queue.end_index || 0;
      if (accountIndex >= startIndex && accountIndex <= endIndex) {
        return {
          id: queueId,
          name: queue.name || `Queue ${queueId}`,
          color: queueId === '1' ? 'bg-blue-500' : queueId === '2' ? 'bg-green-500' : 'bg-purple-500'
        };
      }
    }
    return null;
  };

  const clearAllBackupIPs = () => {
    // Create a deep copy of settings
    const newSettings = JSON.parse(JSON.stringify(settings));

    let clearedCount = 0;

    // Function to clear all backup-related fields from an account
    const clearBackupFields = (account: any) => {
      let hasBackupData = false;

      // Clear backup_ips
      if (account.backup_ips && Array.isArray(account.backup_ips) && account.backup_ips.length > 0) {
        account.backup_ips = [];
        hasBackupData = true;
      }

      // Clear any backup_api_keys if they exist
      if (account.backup_api_keys && Array.isArray(account.backup_api_keys) && account.backup_api_keys.length > 0) {
        account.backup_api_keys = [];
        hasBackupData = true;
      }

      // Clear any backup_keys if they exist
      if (account.backup_keys && Array.isArray(account.backup_keys) && account.backup_keys.length > 0) {
        account.backup_keys = [];
        hasBackupData = true;
      }

      // Clear any reserve_keys if they exist
      if (account.reserve_keys && Array.isArray(account.reserve_keys) && account.reserve_keys.length > 0) {
        account.reserve_keys = [];
        hasBackupData = true;
      }

      // Clear any reserve_api_keys if they exist
      if (account.reserve_api_keys && Array.isArray(account.reserve_api_keys) && account.reserve_api_keys.length > 0) {
        account.reserve_api_keys = [];
        hasBackupData = true;
      }

      return hasBackupData;
    };

    // Clear backup fields for scanner accounts
    if (newSettings.scanner?.accounts) {
      newSettings.scanner.accounts.forEach((account: any) => {
        if (clearBackupFields(account)) {
          clearedCount++;
        }
      });
    }

    // Clear backup fields for market data accounts
    if (newSettings.market_data?.accounts) {
      newSettings.market_data.accounts.forEach((account: any) => {
        if (clearBackupFields(account)) {
          clearedCount++;
        }
      });
    }

    // Clear backup fields for auto buy accounts
    if (newSettings.auto_buy?.accounts) {
      newSettings.auto_buy.accounts.forEach((account: any) => {
        if (clearBackupFields(account)) {
          clearedCount++;
        }
      });
    }

    // Update settings state
    setSettings(newSettings);

    // Update local state for all account types
    if (newSettings.scanner?.accounts) {
      setScannerAccounts(newSettings.scanner.accounts);
    }
    if (newSettings.market_data?.accounts) {
      setMarketDataAccounts(newSettings.market_data.accounts);
    }
    if (newSettings.auto_buy?.accounts) {
      setAutoBuyAccounts(newSettings.auto_buy.accounts);
    }

    // Show result toast
    if (clearedCount > 0) {
      toast({
        title: "Backup Data Cleared",
        description: `Cleared backup data from ${clearedCount} accounts. Click "Save Changes" to persist.`,
      });
      setProxyPoolsReloadTrigger(prev => prev + 1);
    } else {
      toast({
        title: "No Backup Data Found",
        description: "No backup IPs or API keys were found to clear.",
      });
    }
  };

  const clearAndSaveBackupData = async () => {
    let clearedCount = 0;

    // Count how many accounts have backup data
    const countBackupData = (accounts: any[], accountType: string) => {
      return accounts.filter(account =>
        account.backup_ips &&
        Array.isArray(account.backup_ips) &&
        account.backup_ips.length > 0
      ).length;
    };

    clearedCount += countBackupData(settings?.scanner?.accounts || [], 'scanner');
    clearedCount += countBackupData(settings?.market_data?.accounts || [], 'market_data');
    clearedCount += countBackupData(settings?.auto_buy?.accounts || [], 'auto_buy');

    // Save with backup preservation disabled
    try {
      await saveSettings(true); // skipBackupPreservation = true

      if (clearedCount > 0) {
        toast({
          title: "Backup Data Cleared & Saved",
          description: `Cleared and saved backup data from ${clearedCount} accounts.`,
        });
        setProxyPoolsReloadTrigger(prev => prev + 1);
      } else {
        toast({
          title: "No Backup Data Found",
          description: "No backup IPs or API keys were found to clear.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save changes. Please try saving manually.",
        variant: "destructive"
      });
    }
  };

  const getScannerAccountsByQueue = (queueId: string) => {
    if (!settings?.scanner?.queue_config?.enabled) {
      return queueId === '1' ? scannerAccounts : [];
    }

    const queueInfo = settings.scanner.queue_config.queues[queueId];
    if (!queueInfo) return [];

    const startIndex = queueInfo.start_index || 0;
    const endIndex = queueInfo.end_index || 0;

    return scannerAccounts.slice(startIndex, endIndex + 1);
  };

  const addAccountToQueue = (queueId: string) => {
    // Find the queue info to determine where to add the account
    if (!settings?.scanner?.queue_config?.enabled) {
      addAccount('scanner');
      return;
    }

    const queueInfo = settings.scanner.queue_config.queues[queueId];
    if (!queueInfo) return;

    // Insert at the end of current queue (which is end_index + 1)
    const insertIndex = (queueInfo.end_index || 0) + 1;

    // Create new account
    const newAccount: Account = {
      api_key: '',
      proxy: '',
      enabled: true
    };

    // Update settings with new account inserted at correct position
    const newSettings = { ...settings };
    const newScannerAccounts = [...scannerAccounts];
    newScannerAccounts.splice(insertIndex, 0, newAccount);

    // Update the accounts in settings
    newSettings.scanner.accounts = newScannerAccounts;

    // Update queue configuration - expand the queue by 1
    newSettings.scanner.queue_config.queues[queueId].end_index = insertIndex;

    // Update subsequent queues' indices
    const queueIds = Object.keys(newSettings.scanner.queue_config.queues).map(Number).sort((a, b) => a - b);
    const currentQueueIndex = queueIds.indexOf(parseInt(queueId));

    for (let i = currentQueueIndex + 1; i < queueIds.length; i++) {
      const nextQueueId = queueIds[i].toString();
      const nextQueue = newSettings.scanner.queue_config.queues[nextQueueId];
      if (nextQueue) {
        nextQueue.start_index = (nextQueue.start_index || 0) + 1;
        nextQueue.end_index = (nextQueue.end_index || 0) + 1;
      }
    }

    // Update state
    setSettings(newSettings);
    setScannerAccounts(newScannerAccounts);

    // Show toast to inform user
    toast({
      title: "Account Added",
      description: `New account added to ${queueInfo.name || `Queue ${queueId}`} at position ${insertIndex}`,
    });
  };

  const handleDistribute = () => {
    const keys = distKeys.split('\n').map(k => k.trim()).filter(Boolean);
    const proxies = distProxies.split('\n').map(p => p.trim()).filter(Boolean);
    
    const formatProxy = (rawProxy: string): string => {
      if (!rawProxy) return "";
      if (rawProxy.includes("://")) return rawProxy;
      const prefix = globalProxyType === "https" ? "https://" : globalProxyType === "socks5h" ? "socks5h://" : globalProxyType === "socks5" ? "socks5://" : "http://";
      return prefix + rawProxy;
    };

    const queuesEnabled = settings?.scanner?.queue_config?.enabled;
    const queues = settings?.scanner?.queue_config?.queues || {};
    const queueIds = Object.keys(queues).sort((a, b) => Number(a) - Number(b));

    const activeTargets: string[] = [];
    if (queuesEnabled) {
      queueIds.forEach(qId => {
        if (distTargetQueues[qId] !== false) {
          activeTargets.push(`queue-${qId}`);
        }
      });
    } else {
      if (distTargetQueues['scanner'] !== false) {
        activeTargets.push('scanner');
      }
    }
    if (distTargetMarket) {
      activeTargets.push('market');
    }

    if (activeTargets.length === 0) {
      toast({ title: "Error", description: "Please select at least one target for distribution", variant: "destructive" });
      return;
    }

    if (keys.length === 0) {
      if (proxies.length === 0) {
        toast({ title: "Error", description: "No API keys or proxies provided", variant: "destructive" });
        return;
      }
      
      // Distribute ONLY proxies to existing accounts in selected sections
      let proxyIdx = 0;
      
      let newMarket = [...marketDataAccounts];
      if (distTargetMarket) {
        newMarket = marketDataAccounts.map(acc => {
          if (useMarketProxies && proxyIdx < proxies.length) {
            return { ...acc, proxy: formatProxy(proxies[proxyIdx++]) };
          }
          return acc;
        });
      }

      let newScanner = [...scannerAccounts];
      if (queuesEnabled) {
        const queueAccountsMap: Record<string, Account[]> = {};
        
        queueIds.forEach(qId => {
          const qInfo = queues[qId];
          const start = qInfo.start_index || 0;
          const end = qInfo.end_index || 0;
          const existing = scannerAccounts.slice(start, end + 1);
          
          if (distTargetQueues[qId] !== false) {
            queueAccountsMap[qId] = existing.map(acc => {
              if (proxyIdx < proxies.length) {
                return { ...acc, proxy: formatProxy(proxies[proxyIdx++]) };
              }
              return acc;
            });
          } else {
            queueAccountsMap[qId] = existing;
          }
        });
        
        newScanner = queueIds.flatMap(qId => queueAccountsMap[qId]);
      } else {
        if (distTargetQueues['scanner'] !== false) {
          newScanner = scannerAccounts.map(acc => {
            if (proxyIdx < proxies.length) {
              return { ...acc, proxy: formatProxy(proxies[proxyIdx++]) };
            }
            return acc;
          });
        }
      }
      
      setMarketDataAccounts(newMarket);
      setScannerAccounts(newScanner);
      
      toast({ 
        title: "Success", 
        description: `Distributed proxies to selected accounts.` 
      });
      setIsDistributorOpen(false);
      return;
    }
    
    // Distributing API keys
    const alloc = getDistAllocation(keys.length);
    
    let keyIdx = 0;
    let proxyIdx = 0;
    
    // Market
    let newMarket = [...marketDataAccounts];
    if (distTargetMarket) {
      const count = alloc['market'] || 0;
      const targetAccs: Account[] = [];
      for (let i = 0; i < count; i++) {
        const proxy = useMarketProxies ? formatProxy(proxies[proxyIdx++] || "") : "";
        targetAccs.push({ api_key: keys[keyIdx++], proxy, enabled: true });
      }
      if (distOverwrite) {
        newMarket = targetAccs;
      } else {
        newMarket = [...marketDataAccounts, ...targetAccs];
      }
    }
    
    // Scanner
    let newScanner = [...scannerAccounts];
    const newSettings = JSON.parse(JSON.stringify(settings));

    if (queuesEnabled) {
      const queueAccountsMap: Record<string, Account[]> = {};
      
      queueIds.forEach(qId => {
        const qInfo = queues[qId];
        const start = qInfo.start_index || 0;
        const end = qInfo.end_index || 0;
        const existing = scannerAccounts.slice(start, end + 1);
        
        if (distTargetQueues[qId] !== false) {
          const count = alloc[`queue-${qId}`] || 0;
          const targetAccs: Account[] = [];
          for (let i = 0; i < count; i++) {
            targetAccs.push({ api_key: keys[keyIdx++], proxy: formatProxy(proxies[proxyIdx++] || ""), enabled: true });
          }
          if (distOverwrite) {
            queueAccountsMap[qId] = targetAccs;
          } else {
            queueAccountsMap[qId] = [...existing, ...targetAccs];
          }
        } else {
          queueAccountsMap[qId] = existing;
        }
      });
      
      newScanner = queueIds.flatMap(qId => queueAccountsMap[qId]);

      // Adjust queue indices in settings
      if (newSettings.scanner?.queue_config?.queues) {
        let currentStart = 0;
        queueIds.forEach(qId => {
          const size = queueAccountsMap[qId].length;
          newSettings.scanner.queue_config.queues[qId].start_index = currentStart;
          newSettings.scanner.queue_config.queues[qId].end_index = Math.max(currentStart, currentStart + size - 1);
          currentStart += size;
        });
      }
    } else {
      if (distTargetQueues['scanner'] !== false) {
        const count = alloc['scanner'] || 0;
        const targetAccs: Account[] = [];
        for (let i = 0; i < count; i++) {
          targetAccs.push({ api_key: keys[keyIdx++], proxy: formatProxy(proxies[proxyIdx++] || ""), enabled: true });
        }
        if (distOverwrite) {
          newScanner = targetAccs;
        } else {
          newScanner = [...scannerAccounts, ...targetAccs];
        }
      }
    }

    setMarketDataAccounts(newMarket);
    setScannerAccounts(newScanner);
    
    if (newSettings.scanner) {
      newSettings.scanner.accounts = newScanner;
      newSettings.market_data.accounts = newMarket;
      setSettings(newSettings);
    }
    
    const descParts: string[] = [];
    if (queuesEnabled) {
      queueIds.forEach(qId => {
        if (distTargetQueues[qId] !== false) {
          descParts.push(`${alloc[`queue-${qId}`]} Scanner (${queues[qId]?.name || `Queue ${qId}`})`);
        }
      });
    } else {
      if (distTargetQueues['scanner'] !== false) {
        descParts.push(`${alloc['scanner']} Scanner`);
      }
    }
    if (distTargetMarket) {
      descParts.push(`${alloc['market']} Market`);
    }

    toast({ 
      title: "Success", 
      description: `Distributed ${keys.length} accounts to: ${descParts.join(', ')}.` 
    });
    
    setIsDistributorOpen(false);
  };

  const removeAccountFromQueue = (queueId: string, accountIndex: number) => {
    requestConfirmation(
      "Delete queue account?",
      `This will remove account #${accountIndex} from queue ${queueId}.`,
      () => {
        if (!settings?.scanner?.queue_config?.enabled) {
          removeAccount('scanner', accountIndex);
          return;
        }

        const newSettings = { ...settings };
        const queueInfo = newSettings.scanner.queue_config.queues[queueId];

        if (!queueInfo) {
          removeAccount('scanner', accountIndex);
          return;
        }

        // Remove the account from the array
        const newScannerAccounts = [...scannerAccounts];
        newScannerAccounts.splice(accountIndex, 1);

        // Update the accounts in settings
        newSettings.scanner.accounts = newScannerAccounts;

        // Update queue indices
        queueInfo.end_index = Math.max(0, (queueInfo.end_index || 0) - 1);

        // Update subsequent queues' indices
        const queueIds = Object.keys(newSettings.scanner.queue_config.queues).map(Number).sort((a, b) => a - b);
        const currentQueueIndex = queueIds.indexOf(parseInt(queueId));

        for (let i = currentQueueIndex + 1; i < queueIds.length; i++) {
          const nextQueueId = queueIds[i].toString();
          const nextQueue = newSettings.scanner.queue_config.queues[nextQueueId];
          if (nextQueue) {
            nextQueue.start_index = Math.max(0, (nextQueue.start_index || 0) - 1);
            nextQueue.end_index = Math.max(0, (nextQueue.end_index || 0) - 1);
          }
        }

        // Update state
        setSettings(newSettings);
        setScannerAccounts(newScannerAccounts);

        // Show toast to inform user
        toast({
          title: "Account Removed",
          description: `Account removed from ${queueInfo.name || `Queue ${queueId}`}`,
        });
      },
      "Delete"
    );
  };

  const QueueBadge = ({ queue }: { queue: { id: string; name: string; color: string } }) => (
    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs text-white font-medium ${queue.color}`}>
      <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
      {queue.name}
    </div>
  );

  const AccountList = ({ title, desc, list, type, showQueueBadges = false, disableProxies = false }: {
    title: string,
    desc: string,
    list: Account[],
    type: 'scanner' | 'market' | 'autobuy',
    showQueueBadges?: boolean,
    disableProxies?: boolean
  }) => {
    const originalList = type === 'scanner' ? originalScannerAccounts : type === 'market' ? originalMarketAccounts : originalAutoBuyAccounts;

    return (
      <Card className="border-border/50 mt-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>{desc}</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => addAccount(type)}>
            <Plus className="h-4 w-4 mr-2" /> Add Account
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {list.length === 0 && <p className="text-sm text-muted-foreground italic text-center">No accounts configured</p>}
          {list.map((acc, i) => {
            const queue = showQueueBadges ? getQueueForAccount(i, type) : null;
            const isEnabled = acc.enabled !== false; // Default to true if not set
            const originalAcc = originalList[i];
            const isModified = !originalAcc || acc.api_key !== originalAcc.api_key || acc.proxy !== originalAcc.proxy;
            
            // Determine status
            const accountTypeKey = type === 'scanner' ? 'scanner' : type === 'market' ? 'market_data' : 'auto_buy';
            const statusData = accountStatuses[accountTypeKey]?.[i.toString()];
            let statusColor = "bg-gray-400"; // default/unknown
            let statusTitle = "Unknown Status";
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
                key={`${type}-${i}`}
                id={`account-row-${type}-${i}`}
                className={`grid grid-cols-12 gap-2 items-center bg-secondary/20 p-3 rounded border transition-all ${highlightedAccountRow?.type === type && highlightedAccountRow?.index === i ? 'border-white ring-1 ring-white/90 shadow-[0_0_0_1px_rgba(255,255,255,0.9)]' : 'border-border/50'} ${isEnabled ? '' : 'opacity-50'}`}
              >
                <div className="col-span-1 flex items-center justify-center gap-2">
                  <div className={`w-8 h-8 rounded-full text-xs font-medium flex items-center justify-center shrink-0 ${isEnabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {i}
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
                    id={`api-${type}-${i}`}
                    key={`api-${type}-${i}`}
                    data-account-type={type}
                    data-account-index={i}
                    ref={(el) => {
                      if (el) inputRefs.current[`api-${type}-${i}`] = el;
                    }}
                    type={visibleKeys[`${type}-${i}`] ? "text" : "password"}
                    placeholder="API Key"
                    value={acc.api_key}
                    onChange={(e) => updateAccount(type, i, 'api_key', e.target.value)}
                    className="font-mono text-xs pr-8"
                    disabled={!isEnabled}
                  />
                  <button
                    type="button"
                    onClick={() => toggleVisibility(`${type}-${i}`, type, i)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {visibleKeys[`${type}-${i}`] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className={`col-span-3 ${showQueueBadges ? 'col-span-3' : 'col-span-4'} relative ${disableProxies ? 'opacity-40 pointer-events-none' : ''}`}>
                  <Input
                    id={`proxy-${type}-${i}`}
                    key={`proxy-${type}-${i}`}
                    ref={(el) => {
                      if (el) inputRefs.current[`proxy-${type}-${i}`] = el;
                    }}
                    placeholder="Proxy (e.g. host:port)"
                    value={getProxyAddress(acc.proxy)}
                    onChange={(e) => {
                      updateAccount(type, i, 'proxy', formatProxyInput(e.target.value, globalProxyType));
                    }}
                    className="font-mono text-xs"
                    disabled={!isEnabled}
                  />
                </div>
                {showQueueBadges && (
                  <div className="col-span-1 flex items-center justify-center">
                    {queue && <QueueBadge queue={queue} />}
                  </div>
                )}
                <div className="col-span-1 flex items-center justify-center">
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(checked) => updateAccount(type, i, 'enabled', checked)}
                    className="data-[state=checked]:bg-green-500"
                  />
                </div>
                <div className="col-span-1 text-right flex items-center justify-end gap-1 pr-1 shrink-0">
                  <Button
                    size="icon"
                    disabled={!isModified}
                    onClick={() => saveIndividualAccount(type, i)}
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
                    onClick={() => removeAccount(type, i)}
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

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <SettingsIcon className="h-6 w-6 text-primary" />
              Settings
            </h1>
            <p className="text-muted-foreground text-sm">Configure bot accounts and performance</p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-border/60 p-1 bg-muted/20">
              <Button
                type="button"
                size="sm"
                variant={activeSettingsProfile === "config-1" ? "default" : "ghost"}
                className="h-7 px-3"
                onClick={() => switchProfile("config-1")}
              >
                Config 1
              </Button>
              <Button
                type="button"
                size="sm"
                variant={activeSettingsProfile === "config-2" ? "default" : "ghost"}
                className="h-7 px-3"
                onClick={() => switchProfile("config-2")}
              >
                Config 2
              </Button>
            </div>
          </div>
          <div className="flex gap-4 items-center">
            {/* Volume Control */}
            <div className="flex items-center gap-2 bg-secondary/30 px-3 py-1.5 rounded-md border border-border/50">
              <span className="text-xs font-medium text-muted-foreground w-12">Volume</span>
              <Slider
                value={[soundSettings.volume]}
                min={0}
                max={100}
                step={1}
                onValueChange={(vals) => {
                  setVolume(vals[0]);
                  // Play a test sound when releasing slider (debouncing could be added if needed, but simple is fine for now)
                  // Actually, let's play sound on change to give feedback, but maybe throttle it?
                  // The context playSound() is already debounced/throttled or we can just call it.
                  // For now, let's trusting user manual adjustment.
                  if (vals[0] > 0 && Math.random() > 0.7) playSound();
                }}
                className="w-24"
              />
              <span className="text-xs font-mono w-6 text-right">{soundSettings.volume}%</span>
            </div>

            <Button variant="outline" size="sm" onClick={fetchSettings} className="gap-2">
              <RotateCcw className="h-4 w-4" /> Reset
            </Button>
            <Button size="sm" onClick={() => saveSettings()} className="gap-2">
              <Save className="h-4 w-4" /> Save Changes
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="accounts" className="gap-2"><Shield className="h-4 w-4" /> Accounts</TabsTrigger>
            <TabsTrigger value="queues" className="gap-2"><Activity className="h-4 w-4" /> Queues</TabsTrigger>
            <TabsTrigger value="proxy-pools" className="gap-2"><Shield className="h-4 w-4" /> Proxy Pools</TabsTrigger>
            <TabsTrigger value="performance" className="gap-2"><RefreshCw className="h-4 w-4" /> Performance</TabsTrigger>
            <TabsTrigger value="bot" className="gap-2"><Server className="h-4 w-4" /> Bot & Telegram</TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2"><Bell className="h-4 w-4" /> Notifications</TabsTrigger>
            <TabsTrigger value="statistics" className="gap-2"><BarChart3 className="h-4 w-4" /> Statistics</TabsTrigger>
          </TabsList>

          <TabsContent value="accounts" className="space-y-6">
            {/* Global Settings Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Market Proxy Global Setting */}
              <Card className="border-purple-500/20 bg-purple-500/5">
                <CardContent className="flex items-center justify-between py-3 px-4 h-full">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/10 rounded-md">
                      <Shield className="h-4 w-4 text-purple-500" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold">Market Proxy Global Setting</h4>
                      <p className="text-xs text-muted-foreground">Controls proxy usage for all price history accounts</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-background/50 border rounded-lg px-3 py-1.5 shadow-sm">
                    <Switch
                      id="global-market-proxy"
                      checked={useMarketProxies}
                      onCheckedChange={setUseMarketProxies}
                      className="data-[state=checked]:bg-purple-500"
                    />
                    <Label htmlFor="global-market-proxy" className="cursor-pointer text-xs font-bold uppercase tracking-wider">
                      {useMarketProxies ? 'Proxies Enabled' : 'Proxies Disabled'}
                    </Label>
                  </div>
                </CardContent>
              </Card>

              {/* Global Proxy Protocol */}
              <Card className="border-blue-500/20 bg-blue-500/5">
                <CardContent className="flex items-center justify-between py-3 px-4 h-full">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-md">
                      <Shield className="h-4 w-4 text-blue-500" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold">Global Proxy Protocol</h4>
                      <p className="text-xs text-muted-foreground">Select the proxy protocol type for all accounts</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-background/50 border rounded-lg px-3 py-1.5 shadow-sm">
                    <select
                      value={globalProxyType}
                      onChange={(e) => handleGlobalProxyTypeChange(e.target.value)}
                      className="bg-background text-foreground text-xs font-semibold rounded-lg border border-border h-9 px-3 outline-none focus:border-primary/50"
                    >
                      <option value="http">HTTP</option>
                      <option value="socks5">SOCKS5</option>
                      <option value="socks5h">SOCKS5H</option>
                    </select>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Bulk Distributor */}
            <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
              <CardHeader className="cursor-pointer select-none" onClick={() => setIsDistributorOpen(!isDistributorOpen)}>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-primary" />
                      Auto Account Distributor
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-2">
                      Paste a list of API keys and proxies to automatically distribute accounts to the selected targets.
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="shrink-0 mt-1" onClick={e => { e.stopPropagation(); setIsDistributorOpen(!isDistributorOpen); }}>
                    <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${isDistributorOpen ? 'rotate-180' : ''}`} />
                  </Button>
                </div>
              </CardHeader>

              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${isDistributorOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}
              >
                <CardContent className="space-y-4">
                  <Separator />
                  
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">API Keys (one per line):</label>
                      <Textarea
                        className="font-mono text-xs min-h-[160px]"
                        value={distKeys}
                        onChange={e => setDistKeys(e.target.value)}
                        placeholder={`api_key_1\napi_key_2\n...`}
                      />
                      <p className="text-xs text-muted-foreground">
                        {distKeys.split('\n').filter(k => k.trim()).length} keys entered
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Proxies (one per line):</label>
                      <Textarea
                        className="font-mono text-xs min-h-[160px]"
                        value={distProxies}
                        onChange={e => setDistProxies(e.target.value)}
                        placeholder={`http://user:pass@proxy1:port\nhttp://user:pass@proxy2:port\n...`}
                      />
                      <p className="text-xs text-muted-foreground">
                        {distProxies.split('\n').filter(p => p.trim()).length} proxies entered
                      </p>
                    </div>
                  </div>

                  {/* Target Selections */}
                  <div className="flex flex-col md:flex-row md:items-center gap-4 py-3 bg-secondary/10 px-4 rounded-md border border-border/50">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
                      Distribute To:
                    </span>
                    <div className="flex flex-wrap items-center gap-6">
                      {settings?.scanner?.queue_config?.enabled ? (
                        Object.entries(settings.scanner.queue_config.queues || {}).map(([qId, qInfo]: [string, any]) => {
                          let colorClass = "data-[state=checked]:bg-blue-500";
                          if (qId === '2') colorClass = "data-[state=checked]:bg-green-500";
                          else if (qId !== '1') colorClass = "data-[state=checked]:bg-purple-500";
                          
                          return (
                            <div key={`dist-target-q-${qId}`} className="flex items-center gap-2">
                              <Switch
                                id={`dist-target-q-${qId}`}
                                checked={distTargetQueues[qId] !== false}
                                onCheckedChange={(checked) => setDistTargetQueues(prev => ({ ...prev, [qId]: checked }))}
                                className={`scale-75 origin-center ${colorClass}`}
                              />
                              <Label htmlFor={`dist-target-q-${qId}`} className="cursor-pointer text-xs font-medium">
                                Scanner ({qInfo.name || `Queue ${qId}`})
                              </Label>
                            </div>
                          );
                        })
                      ) : (
                        <div className="flex items-center gap-2">
                          <Switch
                            id="dist-target-scanner"
                            checked={distTargetQueues['scanner'] !== false}
                            onCheckedChange={(checked) => setDistTargetQueues(prev => ({ ...prev, scanner: checked }))}
                            className="scale-75 origin-center data-[state=checked]:bg-blue-500"
                          />
                          <Label htmlFor="dist-target-scanner" className="cursor-pointer text-xs font-medium">
                            Scanner Accounts
                          </Label>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2">
                        <Switch
                          id="dist-target-market"
                          checked={distTargetMarket}
                          onCheckedChange={setDistTargetMarket}
                          className="scale-75 origin-center data-[state=checked]:bg-purple-500"
                        />
                        <Label htmlFor="dist-target-market" className="cursor-pointer text-xs font-medium">
                          Market Data
                        </Label>
                      </div>
                    </div>
                  </div>

                  {/* Options */}
                  <div className="flex items-center gap-2 py-1 px-4">
                    <input
                      type="checkbox"
                      id="dist-overwrite-checkbox"
                      checked={distOverwrite}
                      onChange={e => setDistOverwrite(e.target.checked)}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary bg-secondary/50 cursor-pointer accent-primary"
                    />
                    <Label htmlFor="dist-overwrite-checkbox" className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                      Clear existing accounts (Overwrite)
                    </Label>
                  </div>

                  {/* Preview / allocation row */}
                  {(() => {
                    const keysCount = distKeys.split('\n').filter(k => k.trim()).length;
                    const alloc = getDistAllocation(keysCount);
                    
                    const queuesEnabled = settings?.scanner?.queue_config?.enabled;
                    const queues = settings?.scanner?.queue_config?.queues || {};
                    const queueIds = Object.keys(queues).sort((a, b) => Number(a) - Number(b));

                    const hasActiveTargets = 
                      (queuesEnabled && queueIds.some(qId => distTargetQueues[qId] !== false)) ||
                      (!queuesEnabled && distTargetQueues['scanner'] !== false) ||
                      distTargetMarket;
                    
                    if (keysCount === 0 || !hasActiveTargets) return null;

                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {queuesEnabled ? (
                          queueIds.map(qId => {
                            const isSelected = distTargetQueues[qId] !== false;
                            if (!isSelected) return null;
                            const count = alloc[`queue-${qId}`] || 0;
                            const qInfo = queues[qId];
                            
                            const qColor = qId === '1' ? 'text-blue-400' : qId === '2' ? 'text-green-400' : 'text-purple-400';
                            const qBg = qId === '1' ? 'bg-blue-500/10 border-blue-500/30' : qId === '2' ? 'bg-green-500/10 border-green-500/30' : 'bg-purple-500/10 border-purple-500/30';
                            
                            return (
                              <div key={`preview-q-${qId}`} className={`border rounded-lg p-3 text-center ${qBg}`}>
                                <p className={`text-2xl font-bold ${qColor}`}>{count}</p>
                                <p className="text-xs text-muted-foreground mt-1">Scanner ({qInfo.name || `Queue ${qId}`})</p>
                              </div>
                            );
                          })
                        ) : (
                          distTargetQueues['scanner'] !== false && (
                            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-center">
                              <p className="text-2xl font-bold text-blue-400">{alloc['scanner'] || 0}</p>
                              <p className="text-xs text-muted-foreground mt-1">Scanner Accounts</p>
                            </div>
                          )
                        )}
                        
                        {distTargetMarket && (
                          <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 text-center">
                            <p className="text-2xl font-bold text-purple-400">{alloc['market'] || 0}</p>
                            <p className="text-xs text-muted-foreground mt-1">Market Data</p>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <Separator />

                  <div className="grid grid-cols-5 gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        requestConfirmation(
                          "Clear distributor inputs?",
                          "This will clear all pasted API keys and proxies from the distributor form.",
                          () => {
                            setDistKeys("");
                            setDistProxies("");
                          },
                          "Clear"
                        );
                      }}
                      className="gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      Clear Inputs
                    </Button>
                     <AlertDialog>
                       <AlertDialogTrigger asChild>
                         <Button
                           type="button"
                           variant="destructive"
                           className="gap-2"
                         >
                           <Eraser className="h-4 w-4" />
                           Clear All Accounts
                         </Button>
                       </AlertDialogTrigger>
                       <AlertDialogContent>
                         <AlertDialogHeader>
                           <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                           <AlertDialogDescription>
                             This will clear all configured account lists for Scanner, Market Data, and Auto Buy.
                             This action is only permanent if you click "Save Changes" afterwards.
                           </AlertDialogDescription>
                         </AlertDialogHeader>
                         <AlertDialogFooter>
                           <AlertDialogCancel>Cancel</AlertDialogCancel>
                           <AlertDialogAction
                             onClick={() => {
                               setScannerAccounts([]);
                               setMarketDataAccounts([]);
                               setAutoBuyAccounts([]);
                             }}
                             className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                           >
                             Clear Everything
                           </AlertDialogAction>
                         </AlertDialogFooter>
                       </AlertDialogContent>
                     </AlertDialog>
                     <AlertDialog>
                       <AlertDialogTrigger asChild>
                         <Button
                           type="button"
                           variant="destructive"
                           className="gap-2"
                         >
                           <Trash2 className="h-4 w-4" />
                           Clear All Proxies
                         </Button>
                       </AlertDialogTrigger>
                       <AlertDialogContent>
                         <AlertDialogHeader>
                           <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                           <AlertDialogDescription>
                             This will clear the proxy address field from all configured Scanner, Market Data, and Auto Buy accounts.
                             This action is only permanent if you click "Save Changes" afterwards.
                           </AlertDialogDescription>
                         </AlertDialogHeader>
                         <AlertDialogFooter>
                           <AlertDialogCancel>Cancel</AlertDialogCancel>
                           <AlertDialogAction
                             onClick={() => {
                               setScannerAccounts(prev => prev.map(acc => ({ ...acc, proxy: "" })));
                               setMarketDataAccounts(prev => prev.map(acc => ({ ...acc, proxy: "" })));
                               setAutoBuyAccounts(prev => prev.map(acc => ({ ...acc, proxy: "" })));
                             }}
                             className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                           >
                             Clear Proxies
                           </AlertDialogAction>
                         </AlertDialogFooter>
                       </AlertDialogContent>
                     </AlertDialog>
                    <Button
                      onClick={handleDistribute}
                      className="gap-2 col-span-2"
                      disabled={
                        (distKeys.split('\n').filter(k => k.trim()).length === 0 && distProxies.split('\n').filter(p => p.trim()).length === 0) ||
                        (settings?.scanner?.queue_config?.enabled 
                          ? !Object.keys(settings?.scanner?.queue_config?.queues || {}).some(qId => distTargetQueues[qId] !== false) && !distTargetMarket 
                          : distTargetQueues['scanner'] === false && !distTargetMarket)
                      }
                    >
                      <Zap className="h-4 w-4" />
                      {distKeys.split('\n').filter(k => k.trim()).length > 0
                        ? `Distribute ${distKeys.split('\n').filter(k => k.trim()).length} Accounts`
                        : `Distribute ${distProxies.split('\n').filter(p => p.trim()).length} Proxies`}
                    </Button>
                  </div>
                </CardContent>
              </div>
            </Card>

            <div className="flex flex-wrap gap-2 p-2 bg-secondary/30 rounded-lg border border-border/50 sticky top-0 z-10 backdrop-blur-md shadow-sm">
              <span className="text-sm font-medium flex items-center px-2 text-muted-foreground"><Shield className="h-4 w-4 mr-2" /> Jump to:</span>
              
              {settings?.scanner?.queue_config?.enabled ? (
                Object.entries(settings.scanner.queue_config.queues || {}).map(([queueId, queueInfo]: [string, any]) => (
                  <Button 
                    key={`nav-queue-${queueId}`} 
                    size="sm" 
                    variant="secondary" 
                    className="h-8 text-xs"
                    onClick={() => document.getElementById(`section-queue-${queueId}`)?.scrollIntoView({ behavior: 'smooth' })}
                  >
                    Scanner ({queueInfo.name || `Queue ${queueId}`})
                  </Button>
                ))
              ) : (
                <Button 
                  size="sm" 
                  variant="secondary" 
                  className="h-8 text-xs"
                  onClick={() => document.getElementById('section-scanner')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  Scanner Accounts
                </Button>
              )}
              
              <Button 
                size="sm" 
                variant="secondary" 
                className="h-8 text-xs"
                onClick={() => document.getElementById('section-market')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Market Data
              </Button>
              <Button 
                size="sm" 
                variant="secondary" 
                className="h-8 text-xs"
                onClick={() => document.getElementById('section-autobuy')?.scrollIntoView({ behavior: 'smooth' })}
              >
                AutoBuy
              </Button>
            </div>

            {settings?.scanner?.queue_config?.enabled ? (
              <div className="space-y-6">
                {/* Show separate panels for each queue using QueueAccountList */}
                {Object.entries(settings.scanner.queue_config.queues || {}).map(([queueId, queueInfo]) => {
                  const queue = queueInfo as any;
                  const queueName = queue.name || `Queue ${queueId}`;
                  const queueAccounts = getScannerAccountsByQueue(queueId);
                  const startIndex = queue.start_index || 0;

                  return (
                    <div id={`section-queue-${queueId}`} key={queueId} className="scroll-mt-16">
                      <QueueAccountList
                        title={`Scanner Accounts`}
                        description={`Accounts for monitoring listings in ${queueName}`}
                        accounts={queueAccounts}
                        queueId={queueId}
                        queueName={queueName}
                        startIndex={startIndex}
                        onUpdateAccount={(index, field, value) => updateAccount('scanner', index, field, value)}
                        onAddAccount={() => addAccountToQueue(queueId)}
                        onRemoveAccount={(index) => removeAccountFromQueue(queueId, index)}
                        visibleKeys={visibleKeys}
                        onToggleVisibility={toggleVisibility}
                        inputRefs={inputRefs}
                        accountStatuses={accountStatuses?.scanner || {}}
                        originalAccounts={originalScannerAccounts.slice(startIndex, startIndex + queueAccounts.length)}
                        onSaveIndividualAccount={(index) => saveIndividualAccount('scanner', index)}
                        globalProxyType={globalProxyType}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div id="section-scanner" className="scroll-mt-16">
                {/* Show original single scanner panel when queues are disabled */}
                <AccountList
                  title="Scanner Accounts"
                  desc="Accounts used for monitoring listings"
                  list={scannerAccounts}
                  type="scanner"
                  showQueueBadges={false}
                />
              </div>
            )}

            <div id="section-market" className="scroll-mt-16">
              <AccountList
                title="Market Data Accounts"
                desc={useMarketProxies ? "Accounts used for fetching price history" : "Accounts used for fetching price history (proxies globally disabled)"}
                list={marketDataAccounts}
                type="market"
                showQueueBadges={false}
                disableProxies={!useMarketProxies}
              />
            </div>
            
            <div id="section-autobuy" className="scroll-mt-16">
              <AccountList
                title="Auto Buy Accounts"
                desc="Accounts used for purchasing items"
                list={autoBuyAccounts}
                type="autobuy"
                showQueueBadges={false}
              />
            </div>
          </TabsContent>

          <TabsContent value="queues" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Queue Configuration</CardTitle>
                <CardDescription>Configure API account queues for rate limit management</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="queue-enabled"
                    checked={settings?.scanner?.queue_config?.enabled || false}
                    onCheckedChange={(checked) => setSettings({
                      ...settings,
                      scanner: {
                        ...settings.scanner,
                        queue_config: {
                          ...settings.scanner?.queue_config,
                          enabled: checked
                        }
                      }
                    })}
                  />
                  <Label htmlFor="queue-enabled">Enable Queue System</Label>
                </div>

                {settings?.scanner?.queue_config?.enabled && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Rate Limit Threshold</Label>
                        <Input
                          type="number"
                          min="1"
                          max="10"
                          value={settings?.scanner?.queue_config?.rate_limit_threshold || 3}
                          onChange={e => setSettings({
                            ...settings,
                            scanner: {
                              ...settings.scanner,
                              queue_config: {
                                ...settings.scanner?.queue_config,
                                rate_limit_threshold: parseInt(e.target.value)
                              }
                            }
                          })}
                        />
                        <p className="text-sm text-muted-foreground">Number of accounts with 429 before queue switch</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Check Interval (seconds)</Label>
                        <Input
                          type="number"
                          min="1"
                          max="60"
                          step="0.1"
                          value={settings?.scanner?.queue_config?.check_interval || 5.0}
                          onChange={e => setSettings({
                            ...settings,
                            scanner: {
                              ...settings.scanner,
                              queue_config: {
                                ...settings.scanner?.queue_config,
                                check_interval: parseFloat(e.target.value)
                              }
                            }
                          })}
                        />
                        <p className="text-sm text-muted-foreground">Queue monitoring interval</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label>Queue Definitions</Label>
                        <Button size="sm" variant="outline" onClick={() => {
                          const newQueueId = Math.max(...Object.keys(settings?.scanner?.queue_config?.queues || {}).map(Number), 0) + 1;
                          setSettings({
                            ...settings,
                            scanner: {
                              ...settings.scanner,
                              queue_config: {
                                ...settings.scanner?.queue_config,
                                queues: {
                                  ...settings.scanner?.queue_config?.queues,
                                  [newQueueId]: {
                                    start_index: 0,
                                    end_index: 0,
                                    name: `Queue ${newQueueId}`
                                  }
                                }
                              }
                            }
                          });
                        }}>
                          <Plus className="h-4 w-4 mr-2" /> Add Queue
                        </Button>
                      </div>

                      {settings?.scanner?.queue_config?.queues && Object.entries(settings.scanner.queue_config.queues).map(([queueId, queue]: [string, any]) => (
                        <Card key={queueId} className="border-border/50">
                          <CardContent className="pt-4">
                            <div className="grid grid-cols-4 gap-4 items-end">
                              <div className="space-y-2">
                                <Label>Queue Name</Label>
                                <Input
                                  value={queue.name || ''}
                                  onChange={e => setSettings({
                                    ...settings,
                                    scanner: {
                                      ...settings.scanner,
                                      queue_config: {
                                        ...settings.scanner?.queue_config,
                                        queues: {
                                          ...settings.scanner?.queue_config?.queues,
                                          [queueId]: {
                                            ...queue,
                                            name: e.target.value
                                          }
                                        }
                                      }
                                    }
                                  })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Start Index</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={queue.start_index || 0}
                                  onChange={e => setSettings({
                                    ...settings,
                                    scanner: {
                                      ...settings.scanner,
                                      queue_config: {
                                        ...settings.scanner?.queue_config,
                                        queues: {
                                          ...settings.scanner?.queue_config?.queues,
                                          [queueId]: {
                                            ...queue,
                                            start_index: parseInt(e.target.value)
                                          }
                                        }
                                      }
                                    }
                                  })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>End Index</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={queue.end_index || 0}
                                  onChange={e => setSettings({
                                    ...settings,
                                    scanner: {
                                      ...settings.scanner,
                                      queue_config: {
                                        ...settings.scanner?.queue_config,
                                        queues: {
                                          ...settings.scanner?.queue_config?.queues,
                                          [queueId]: {
                                            ...queue,
                                            end_index: parseInt(e.target.value)
                                          }
                                        }
                                      }
                                    }
                                  })}
                                />
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  requestConfirmation(
                                    "Delete queue?",
                                    `Queue ${queueId} will be removed from configuration.`,
                                    () => {
                                      const newQueues = { ...settings.scanner?.queue_config?.queues };
                                      delete newQueues[queueId];
                                      setSettings({
                                        ...settings,
                                        scanner: {
                                          ...settings.scanner,
                                          queue_config: {
                                            ...settings.scanner?.queue_config,
                                            queues: newQueues
                                          }
                                        }
                                      });
                                    },
                                    "Delete"
                                  );
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                            <p className="text-sm text-muted-foreground mt-2">
                              Accounts {queue.start_index || 0} to {queue.end_index || 0} ({Math.max(0, (queue.end_index || 0) - (queue.start_index || 0) + 1)} accounts)
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="proxy-pools" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium">Proxy Pool Management</h3>
                <p className="text-sm text-muted-foreground">Manage backup proxy IPs and proxy pools</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={clearAndSaveBackupData} className="gap-2">
                  <Eraser className="h-4 w-4" /> Clear & Save Backup Data
                </Button>
              </div>
            </div>

            <Separator />

            <ProxyPoolManager 
              settingsProfileId={activeSettingsProfile} 
              globalProxyType={globalProxyType}
              settings={settings}
              onBackupIPsChange={handleBackupIPsChange}
              reloadTrigger={proxyPoolsReloadTrigger}
            />
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Scanner Timing</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Min Poll Interval (s)</Label>
                  <Input
                    id="poll-interval-min"
                    type="number"
                    step="0.01"
                    value={settings?.scanner?.poll_interval_min}
                    onChange={e => setSettings({ ...settings, scanner: { ...settings.scanner, poll_interval_min: parseFloat(e.target.value) } })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Poll Interval (s)</Label>
                  <Input
                    id="poll-interval-max"
                    type="number"
                    step="0.01"
                    value={settings?.scanner?.poll_interval_max}
                    onChange={e => setSettings({ ...settings, scanner: { ...settings.scanner, poll_interval_max: parseFloat(e.target.value) } })}
                  />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Pre-Delay & Base Delay</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Min Pre-Delay (s)</Label>
                  <Input
                    id="pre-delay-min"
                    type="number"
                    step="0.01"
                    value={settings?.scanner?.pre_delay_min}
                    onChange={e => setSettings({ ...settings, scanner: { ...settings.scanner, pre_delay_min: parseFloat(e.target.value) } })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Pre-Delay (s)</Label>
                  <Input
                    id="pre-delay-max"
                    type="number"
                    step="0.01"
                    value={settings?.scanner?.pre_delay_max}
                    onChange={e => setSettings({ ...settings, scanner: { ...settings.scanner, pre_delay_max: parseFloat(e.target.value) } })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Base Delay (429 Wait)</Label>
                  <Input
                    id="base-delay"
                    type="number"
                    step="1"
                    value={settings?.scanner?.base_delay}
                    onChange={e => setSettings({ ...settings, scanner: { ...settings.scanner, base_delay: parseFloat(e.target.value) } })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Request Timeout (s)</Label>
                  <Input
                    id="request-timeout"
                    type="number"
                    min="1"
                    step="1"
                    value={settings?.scanner?.request_timeout ?? 5}
                    onChange={e => setSettings({ ...settings, scanner: { ...settings.scanner, request_timeout: parseInt(e.target.value) } })}
                  />
                  <p className="text-[10px] text-muted-foreground">Timeout for API requests (triggers proxy rotation on curl 28)</p>
                </div>
                <div className="space-y-2">
                  <Label>Buy Order Check Interval (s)</Label>
                  <Input
                    id="buy-order-check-interval"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="60"
                    value={settings?.scanner?.buy_order_check_interval ?? ""}
                    onChange={e => {
                      const val = e.target.value === "" ? "" : parseInt(e.target.value);
                      setSettings({ ...settings, scanner: { ...settings.scanner, buy_order_check_interval: val } });
                    }}
                  />
                  <p className="text-[10px] text-muted-foreground">Interval for checking filled buy orders (default is 60s)</p>
                </div>
                <div className="space-y-3 col-span-2">
                  <Label>Buy Order Notification States</Label>
                  <div className="flex flex-col sm:flex-row gap-6 mt-1.5">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="buy-order-notif-queued"
                        checked={settings?.scanner?.buy_order_notif_states?.includes("queued") ?? true}
                        onCheckedChange={checked => {
                          const current = settings?.scanner?.buy_order_notif_states ?? ["queued", "pending", "verified"];
                          const next = checked 
                            ? [...current.filter((s: string) => s !== "queued"), "queued"]
                            : current.filter((s: string) => s !== "queued");
                          setSettings({ ...settings, scanner: { ...settings.scanner, buy_order_notif_states: next } });
                        }}
                      />
                      <Label htmlFor="buy-order-notif-queued" className="cursor-pointer">Purchase Queued</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="buy-order-notif-pending"
                        checked={settings?.scanner?.buy_order_notif_states?.includes("pending") ?? true}
                        onCheckedChange={checked => {
                          const current = settings?.scanner?.buy_order_notif_states ?? ["queued", "pending", "verified"];
                          const next = checked 
                            ? [...current.filter((s: string) => s !== "pending"), "pending"]
                            : current.filter((s: string) => s !== "pending");
                          setSettings({ ...settings, scanner: { ...settings.scanner, buy_order_notif_states: next } });
                        }}
                      />
                      <Label htmlFor="buy-order-notif-pending" className="cursor-pointer">Purchase Pending</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="buy-order-notif-verified"
                        checked={settings?.scanner?.buy_order_notif_states?.includes("verified") ?? true}
                        onCheckedChange={checked => {
                          const current = settings?.scanner?.buy_order_notif_states ?? ["queued", "pending", "verified"];
                          const next = checked 
                            ? [...current.filter((s: string) => s !== "verified"), "verified"]
                            : current.filter((s: string) => s !== "verified");
                          setSettings({ ...settings, scanner: { ...settings.scanner, buy_order_notif_states: next } });
                        }}
                      />
                      <Label htmlFor="buy-order-notif-verified" className="cursor-pointer">Purchase Confirmed</Label>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Select which trade states trigger web and Telegram notifications</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Session Recycling</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Max Requests Per Session</Label>
                  <Input
                    id="max-requests-per-session"
                    type="number"
                    min="10"
                    max="1000"
                    step="1"
                    value={settings?.scanner?.max_requests_per_session ?? 50}
                    onChange={e => setSettings({
                      ...settings,
                      scanner: {
                        ...settings.scanner,
                        max_requests_per_session: parseInt(e.target.value)
                      }
                    })}
                  />
                  <p className="text-[10px] text-muted-foreground">Session recycling after N requests (default: 50)</p>
                </div>
                <div className="space-y-2">
                  <Label>Max Session Age (minutes)</Label>
                  <Input
                    id="max-session-age-minutes"
                    type="number"
                    min="1"
                    max="120"
                    step="1"
                    value={settings?.scanner?.max_session_age_minutes ?? 10}
                    onChange={e => setSettings({
                      ...settings,
                      scanner: {
                        ...settings.scanner,
                        max_session_age_minutes: parseInt(e.target.value)
                      }
                    })}
                  />
                  <p className="text-[10px] text-muted-foreground">Session recycling after M minutes (default: 10)</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bot" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Telegram Configuration</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Bot Token</Label>
                  <Input
                    id="telegram-bot-token"
                    type="password"
                    value={settings?.bot?.telegram_bot_token}
                    onChange={e => setSettings({ ...settings, bot: { ...settings.bot, telegram_bot_token: e.target.value } })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Target Bot Token (Item Finds)</Label>
                  <Input
                    id="telegram-target-bot-token"
                    type="password"
                    value={settings?.bot?.telegram_target_bot_token || ''}
                    onChange={e => setSettings({ ...settings, bot: { ...settings.bot, telegram_target_bot_token: e.target.value } })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Chat ID (comma separated or list)</Label>
                  <Input
                    id="telegram-chat-id"
                    value={settings?.bot?.telegram_chat_id}
                    onChange={e => setSettings({ ...settings, bot: { ...settings.bot, telegram_chat_id: e.target.value } })}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <NotificationSettings />
            <NotificationAPITester />
          </TabsContent>

          <TabsContent value="statistics" className="space-y-6">
            {/* Mode Switcher */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card/40 backdrop-blur-md p-4 rounded-xl border border-border/40 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/10 rounded-lg border border-blue-500/20 text-blue-400">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-base text-foreground">Latency Statistics</h3>
                  <p className="text-xs text-muted-foreground">Track and analyze purchase processing response times</p>
                </div>
              </div>
              <div className="flex bg-secondary/40 p-1 rounded-lg border border-border/60 w-full sm:w-auto">
                <button
                  onClick={() => setStatsTabMode('general')}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-xs font-semibold transition-all ${
                    statsTabMode === 'general'
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  General Statistics
                </button>
                <button
                  onClick={() => setStatsTabMode('test')}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-xs font-semibold transition-all ${
                    statsTabMode === 'test'
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Test Mode
                </button>
              </div>
            </div>

            {statsTabMode === 'general' ? (
              <div className="space-y-6">
                {/* Stats Cards Row */}
                {(() => {
                  const totalPurchases = latencies.length;
                  const successPurchases = latencies.filter(l => l.status === 'success').length;
                  const failedPurchases = totalPurchases - successPurchases;
                  const successRate = totalPurchases > 0 ? ((successPurchases / totalPurchases) * 100).toFixed(1) : "0.0";
                  
                  const autoSuccess = latencies.filter(l => l.purchase_type === 'auto' && l.status === 'success');
                  const avgBuyDelay = autoSuccess.length > 0
                    ? (autoSuccess.reduce((acc, curr) => acc + curr.purchase_delay_ms, 0) / autoSuccess.length).toFixed(0)
                    : "0";
                  const avgDetectDelay = autoSuccess.length > 0
                    ? (autoSuccess.reduce((acc, curr) => acc + curr.detection_delay_ms, 0) / autoSuccess.length).toFixed(0)
                    : "0";

                  return (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <Card className="bg-card/30 border-border/30 shadow-md">
                        <CardContent className="p-4 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Attempts</p>
                            <h3 className="text-2xl font-bold mt-1 text-foreground font-mono">{totalPurchases}</h3>
                          </div>
                          <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
                            <Database className="h-5 w-5" />
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-card/30 border-border/30 shadow-md">
                        <CardContent className="p-4 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Success Rate</p>
                            <h3 className="text-2xl font-bold mt-1 text-emerald-400 font-mono">
                              {successRate}%
                              <span className="text-[10px] text-muted-foreground font-normal ml-1">
                                ({successPurchases}/{totalPurchases})
                              </span>
                            </h3>
                          </div>
                          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                            <CheckCircle className="h-5 w-5" />
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-card/30 border-border/30 shadow-md">
                        <CardContent className="p-4 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Avg Auto-Buy Latency</p>
                            <h3 className="text-2xl font-bold mt-1 text-purple-400 font-mono">
                              {renderFormattedLatency(avgBuyDelay)}
                            </h3>
                          </div>
                          <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg">
                            <Zap className="h-5 w-5" />
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-card/30 border-border/30 shadow-md">
                        <CardContent className="p-4 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Avg Detection Time</p>
                            <h3 className="text-2xl font-bold mt-1 text-amber-400 font-mono">
                              {renderFormattedLatency(avgDetectDelay)}
                            </h3>
                          </div>
                          <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
                            <Activity className="h-5 w-5" />
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })()}

                {/* Control Panel Card */}
                <Card className="bg-card/25 border-border/40 backdrop-blur-sm">
                  <CardHeader className="py-4 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-sm font-semibold text-foreground">Latency Measurements</CardTitle>
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Toggle Failed Purchases */}
                      <div className="flex items-center gap-2 bg-secondary/30 border px-3 py-1.5 rounded-lg shadow-sm">
                        <Switch
                          id="show-failed-purchases"
                          checked={showFailedPurchases}
                          onCheckedChange={setShowFailedPurchases}
                          className="data-[state=checked]:bg-blue-500 scale-90"
                        />
                        <Label htmlFor="show-failed-purchases" className="cursor-pointer text-[10px] font-bold uppercase tracking-wider text-muted-foreground select-none">
                          Failed Attempts
                        </Label>
                      </div>

                      {/* Search Input */}
                      <Input
                        type="text"
                        placeholder="Search..."
                        value={statsSearchTerm}
                        onChange={(e) => setStatsSearchTerm(e.target.value)}
                        className="h-9 w-40 text-xs bg-background/50 border-border/60"
                      />

                      {/* Refresh Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchLatencies}
                        disabled={loadingLatencies}
                        className="h-9 gap-1.5 text-xs"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${loadingLatencies ? 'animate-spin' : ''}`} />
                        Refresh
                      </Button>

                      {/* Delete Selected Button */}
                      {Object.values(selectedIds).some(Boolean) && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={deleteSelectedLatencies}
                          className="h-9 gap-1.5 text-xs bg-red-950/40 hover:bg-red-950/60 text-red-400 border border-red-500/20"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete ({Object.values(selectedIds).filter(Boolean).length})
                        </Button>
                      )}

                      {/* Clear All Button */}
                      {latencies.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            requestConfirmation(
                              "Clear Latency History",
                              "Are you sure you want to completely clear the latency history? This action is irreversible.",
                              clearAllLatencies,
                              "Clear All"
                            );
                          }}
                          className="h-9 gap-1.5 text-xs text-red-400/80 border-red-500/10 hover:bg-red-500/10 hover:text-red-400"
                        >
                          <Eraser className="h-3.5 w-3.5" />
                          Clear All
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 border-t border-border/20">
                    {/* Recharts Latency Curve */}
                    {latencies.length > 0 ? (
                      <div className="p-4 border-b border-border/20">
                        <div className="h-[280px] w-full mt-2">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                              data={(() => {
                                const filtered = latencies.filter(l => {
                                  const matchesSearch = l.item_name.toLowerCase().includes(statsSearchTerm.toLowerCase());
                                  if (!showFailedPurchases) {
                                    return matchesSearch && l.status === 'success';
                                  }
                                  return matchesSearch;
                                });
                                return [...filtered].reverse().map(l => ({
                                  ...l,
                                  time: new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                                  date: new Date(l.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' }),
                                  latency: l.purchase_delay_ms,
                                }));
                              })()}
                              margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                            >
                              <defs>
                                <linearGradient id="latencyGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                              <XAxis 
                                dataKey="time" 
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: '#888888', fontSize: 10 }}
                              />
                              <YAxis 
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(val) => formatLatency(val)}
                                tick={{ fill: '#888888', fontSize: 10 }}
                              />
                              <RechartsTooltip content={
                                ({ active, payload }: any) => {
                                  if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    const isSuccess = data.status === 'success';
                                    return (
                                      <div className="bg-popover/95 border border-border/80 p-3 rounded-lg shadow-xl max-w-sm text-xs space-y-2 backdrop-blur-md">
                                        <div className="flex justify-between items-start gap-3">
                                          <div className="font-semibold text-sm max-w-[200px] truncate text-foreground">{data.item_name}</div>
                                          <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                                            data.purchase_type === 'auto' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                          }`}>
                                            {data.purchase_type === 'auto' ? 'Auto' : 'Manual'}
                                          </span>
                                        </div>
                                        <div className="text-muted-foreground font-mono">{new Date(data.timestamp).toLocaleString()}</div>
                                        <div className="border-t border-border/40 my-1 pt-1.5">
                                          <div className="grid grid-cols-2 gap-y-1 gap-x-3 font-mono">
                                            <div className="text-muted-foreground">CSFloat API:</div>
                                            <div className="text-right text-foreground">{formatLatency(data.api_fetch_delay_ms)}</div>
                                            <div className="text-muted-foreground">Analyzer:</div>
                                            <div className="text-right text-foreground">{formatLatency(data.analysis_delay_ms)}</div>
                                            <div className="text-muted-foreground">Market Data:</div>
                                            <div className="text-right text-foreground">{formatLatency(data.market_data_delay_ms)}</div>
                                            <div className="text-muted-foreground font-medium">Buy Request:</div>
                                            <div className="text-right text-foreground font-semibold">{formatLatency(data.purchase_delay_ms)}</div>
                                            <div className="text-muted-foreground border-t border-border/20 pt-1 mt-1 font-bold">Total Latency:</div>
                                            <div className="text-right text-blue-400 border-t border-border/20 pt-1 mt-1 font-bold">{formatLatency(data.total_delay_ms)}</div>
                                            <div className="text-muted-foreground font-bold">Detection Delay:</div>
                                            <div className="text-right text-emerald-400 font-bold">{formatLatency(data.detection_delay_ms)}</div>
                                          </div>
                                        </div>
                                        {!isSuccess && (
                                          <div className="border-t border-red-500/20 pt-1.5 mt-1 text-red-400 font-medium flex items-start gap-1">
                                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                            <span className="break-words">Error: {data.status}</span>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  }
                                  return null;
                                }
                              } />
                              <Area 
                                type="monotone" 
                                dataKey="latency" 
                                stroke="#3b82f6" 
                                strokeWidth={2}
                                fillOpacity={1} 
                                fill="url(#latencyGrad)"
                                dot={(props: any) => {
                                  const isSuccess = props.payload.status === 'success';
                                  return (
                                    <circle 
                                      key={props.payload.id}
                                      cx={props.cx} 
                                      cy={props.cy} 
                                      r={4} 
                                      fill={isSuccess ? '#10b981' : '#ef4444'} 
                                      stroke={isSuccess ? '#059669' : '#b91c1c'} 
                                      strokeWidth={1.5} 
                                    />
                                  );
                                }}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    ) : null}

                    {/* Table View */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-muted/30 text-muted-foreground border-b border-border/40 font-semibold uppercase tracking-wider text-[10px]">
                          <tr>
                            <th className="py-3 px-4 w-12 text-center">
                              <input
                                type="checkbox"
                                checked={
                                  latencies.length > 0 &&
                                  latencies.every(l => selectedIds[l.id])
                                }
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  const next: Record<number, boolean> = {};
                                  if (checked) {
                                    latencies.forEach(l => {
                                      next[l.id] = true;
                                    });
                                  }
                                  setSelectedIds(next);
                                }}
                                className="rounded border-border/50 text-blue-500 bg-background"
                              />
                            </th>
                            <th className="py-3 px-4">Time</th>
                            <th className="py-3 px-4">Item</th>
                            <th className="py-3 px-4">Type</th>
                            <th className="py-3 px-4 text-right">Purchase</th>
                            <th className="py-3 px-4 text-right">Detect</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 w-16 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20 font-medium">
                          {(() => {
                            const filtered = latencies.filter(l => {
                              const matchesSearch = l.item_name.toLowerCase().includes(statsSearchTerm.toLowerCase());
                              if (!showFailedPurchases) {
                                  return matchesSearch && l.status === 'success';
                              }
                              return matchesSearch;
                            });

                            if (filtered.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={8} className="text-center py-10 text-muted-foreground">
                                    No statistics records found.
                                  </td>
                                </tr>
                              );
                            }

                            return filtered.map((l) => {
                              const isSuccess = l.status === 'success';
                              const formattedDate = new Date(l.timestamp).toLocaleString();
                              return (
                                <tr key={l.id} className="hover:bg-secondary/15 transition-colors">
                                  <td className="py-2.5 px-4 text-center">
                                    <input
                                      type="checkbox"
                                      checked={!!selectedIds[l.id]}
                                      onChange={(e) => {
                                        setSelectedIds(prev => ({
                                          ...prev,
                                          [l.id]: e.target.checked
                                        }));
                                      }}
                                      className="rounded border-border/50 text-blue-500 bg-background"
                                    />
                                  </td>
                                  <td className="py-2.5 px-4 text-muted-foreground whitespace-nowrap font-mono">{formattedDate}</td>
                                  <td className="py-2.5 px-4 text-foreground font-semibold truncate max-w-[240px]">{l.item_name}</td>
                                  <td className="py-2.5 px-4">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                                      l.purchase_type === 'auto' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/10' : 'bg-amber-500/10 text-amber-400 border border-amber-500/10'
                                    }`}>
                                      {l.purchase_type === 'auto' ? 'Auto' : 'Manual'}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-4 text-right font-mono font-semibold">{formatLatency(l.purchase_delay_ms)}</td>
                                  <td className="py-2.5 px-4 text-right font-mono font-semibold text-emerald-400">{formatLatency(l.detection_delay_ms)}</td>
                                  <td className="py-2.5 px-4">
                                    {isSuccess ? (
                                      <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                                        <CheckCircle className="h-3.5 w-3.5" />
                                        Success
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-red-400 font-bold" title={l.status}>
                                        <AlertTriangle className="h-3.5 w-3.5" />
                                        Failed
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-4 text-center">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => deleteSingleLatency(l.id)}
                                      className="h-7 w-7 text-muted-foreground hover:text-red-400"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              // Test Mode View
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Selector Card */}
                <Card className="bg-card/25 border-border/40 backdrop-blur-sm md:col-span-1">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold text-foreground">Test Parameters</CardTitle>
                    <CardDescription className="text-xs">
                      Select an item from the live scanner to simulate processing delays without purchasing.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Scanner Item</Label>
                      {monitorItems.length > 0 ? (
                        <div className="flex gap-2">
                          <select
                            value={selectedMonitorItem?.id || ''}
                            onChange={(e) => {
                              const found = monitorItems.find(i => i.id === e.target.value);
                              if (found) setSelectedMonitorItem(found);
                            }}
                            className="w-full bg-background text-foreground text-xs font-semibold rounded-lg border border-border h-9 px-3 outline-none focus:border-primary/50"
                          >
                            {monitorItems.map(item => (
                              <option key={item.id} value={item.id}>
                                {item.name} (${item.price.toFixed(2)})
                              </option>
                            ))}
                          </select>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              if (monitorItems.length > 0) {
                                const randIdx = Math.floor(Math.random() * monitorItems.length);
                                setSelectedMonitorItem(monitorItems[randIdx]);
                              }
                            }}
                            title="Random Item"
                            className="shrink-0 h-9 w-9"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground bg-secondary/20 p-3 rounded-lg border text-center">
                          No items available in the Live Scanner. Please start the scanner.
                        </div>
                      )}
                    </div>

                    {selectedMonitorItem && (
                      <div className="p-3 bg-secondary/10 border border-border/30 rounded-lg space-y-2">
                        <div className="font-semibold text-xs text-foreground truncate">{selectedMonitorItem.name}</div>
                        <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground font-mono">
                          <div>Price: <span className="text-foreground">${selectedMonitorItem.price.toFixed(2)}</span></div>
                          <div>Float: <span className="text-foreground">{selectedMonitorItem.float?.toFixed(6) || 'N/A'}</span></div>
                          <div>Wear: <span className="text-foreground">{selectedMonitorItem.wear || 'N/A'}</span></div>
                          <div>Seed: <span className="text-foreground">{selectedMonitorItem.paintSeed || 'N/A'}</span></div>
                        </div>
                      </div>
                    )}

                    <Button
                      onClick={runLatencyTest}
                      disabled={testRunning || !selectedMonitorItem}
                      className="w-full gap-2 text-xs font-semibold"
                    >
                      {testRunning ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          Measuring...
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5" />
                          Run Latency Test
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Test Results Dashboard Card */}
                <Card className="bg-card/25 border-border/40 backdrop-blur-sm md:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold text-foreground">Latency Test Results</CardTitle>
                    <CardDescription className="text-xs">
                      Visual breakdown of the execution time for each item processing phase.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col justify-center min-h-[220px]">
                    {testRunning ? (
                      <div className="flex flex-col items-center justify-center space-y-3 py-10">
                        <RefreshCw className="h-8 w-8 text-blue-400 animate-spin" />
                        <div className="text-xs font-semibold text-muted-foreground">Running test requests to CSFloat API...</div>
                      </div>
                    ) : testResults ? (
                      <div className="space-y-6">
                        {/* Summary Metrics */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-3.5 bg-blue-500/5 border border-blue-500/15 rounded-xl text-center">
                            <div className="text-xs text-muted-foreground font-semibold">Total Latency</div>
                            <div className="text-3xl font-extrabold text-blue-400 font-mono mt-1">{formatLatency(testResults.total_delay_ms)}</div>
                          </div>
                          <div className={`p-3.5 border rounded-xl text-center ${
                            testResults.matched 
                              ? 'bg-emerald-500/5 border-emerald-500/15 text-emerald-400' 
                              : 'bg-red-500/5 border-red-500/15 text-red-400'
                          }`}>
                            <div className="text-xs text-muted-foreground font-semibold">Analyzer Result</div>
                            <div className="text-base font-extrabold mt-2 truncate max-w-[200px] mx-auto">
                              {testResults.matched ? 'MATCHED' : 'PASSED'}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[200px] mx-auto">
                              {testResults.reason}
                            </div>
                          </div>
                        </div>

                        {/* Timing Timeline */}
                        <div className="space-y-4 pt-2">
                          <Label className="text-xs font-semibold text-foreground">Phase Breakdown (Latency Timeline)</Label>
                          <div className="space-y-3">
                            {/* Step 1: Scanner Fetch */}
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs font-medium">
                                <span className="text-foreground">1. CSFloat List Fetch (Scanner Fetch)</span>
                                <span className="font-mono font-bold text-blue-400">{formatLatency(testResults.api_fetch_delay_ms)}</span>
                              </div>
                              <div className="w-full bg-secondary/30 h-2 rounded-full overflow-hidden">
                                <div 
                                  className="bg-blue-500 h-full rounded-full transition-all duration-500" 
                                  style={{ width: `${Math.min(100, (testResults.api_fetch_delay_ms / testResults.total_delay_ms) * 100)}%` }} 
                                />
                              </div>
                            </div>

                            {/* Step 2: Analyzer Check */}
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs font-medium">
                                <span className="text-foreground">2. Filter Matching (Analyzer Check)</span>
                                <span className="font-mono font-bold text-purple-400">{formatLatency(testResults.analysis_delay_ms)}</span>
                              </div>
                              <div className="w-full bg-secondary/30 h-2 rounded-full overflow-hidden">
                                <div 
                                  className="bg-purple-500 h-full rounded-full transition-all duration-500" 
                                  style={{ width: `${Math.min(100, (testResults.analysis_delay_ms / testResults.total_delay_ms) * 100)}%` }} 
                                />
                              </div>
                            </div>

                            {/* Step 3: Market Data History */}
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs font-medium">
                                <span className="text-foreground">3. History Fetch (Market Data Fetch)</span>
                                <span className="font-mono font-bold text-amber-400">{formatLatency(testResults.market_data_delay_ms)}</span>
                              </div>
                              <div className="w-full bg-secondary/30 h-2 rounded-full overflow-hidden">
                                <div 
                                  className="bg-amber-500 h-full rounded-full transition-all duration-500" 
                                  style={{ width: `${Math.min(100, (testResults.market_data_delay_ms / testResults.total_delay_ms) * 100)}%` }} 
                                />
                              </div>
                            </div>

                            {/* Step 4: Buy request Simulation */}
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs font-medium">
                                <span className="text-foreground">4. Purchase Simulation (GET Listing Check)</span>
                                <span className="font-mono font-bold text-pink-400">{formatLatency(testResults.purchase_delay_ms)}</span>
                              </div>
                              <div className="w-full bg-secondary/30 h-2 rounded-full overflow-hidden">
                                <div 
                                  className="bg-pink-500 h-full rounded-full transition-all duration-500" 
                                  style={{ width: `${Math.min(100, (testResults.purchase_delay_ms / testResults.total_delay_ms) * 100)}%` }} 
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center space-y-2 py-10 text-muted-foreground text-center">
                        <Database className="h-10 w-10 text-muted-foreground/30" />
                        <div className="text-xs font-medium">No Simulation Results Available</div>
                        <div className="text-[10px] max-w-[240px]">Select an item from the left panel and click "Run Latency Test" to begin.</div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && closeConfirmation()}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
              <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={closeConfirmation}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={executeConfirmation}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {confirmDialog.actionLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};
