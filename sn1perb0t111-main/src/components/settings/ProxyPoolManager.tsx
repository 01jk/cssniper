import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { Trash2, Plus, Save, RefreshCw, Shield, Zap, ChevronDown } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface Account {
    account_type: "scanner" | "market_data" | "auto_buy";
    index: number;
    api_key: string;
    current_proxy: string;
    backup_ips: string[];
}

const getAccountTypeColor = (type: string) => {
    switch (type) {
        case "scanner":
            return "bg-blue-500/10 text-blue-500 border-blue-500/50";
        case "market_data":
            return "bg-purple-500/10 text-purple-500 border-purple-500/50";
        case "auto_buy":
            return "bg-green-500/10 text-green-500 border-green-500/50";
        default:
            return "bg-gray-500/10 text-gray-500 border-gray-500/50";
    }
};

const getAccountTypeLabel = (type: string) => {
    switch (type) {
        case "scanner":
            return "Scanner";
        case "market_data":
            return "Market Data";
        case "auto_buy":
            return "Auto-Buy";
        default:
            return type;
    }
};

export const ProxyPoolManager = ({ 
    settingsProfileId = "config-1",
    globalProxyType = "http",
    settings,
    onBackupIPsChange,
    reloadTrigger = 0
}: { 
    settingsProfileId?: "config-1" | "config-2";
    globalProxyType?: string;
    settings?: any;
    onBackupIPsChange?: (accounts: Account[]) => void;
    reloadTrigger?: number;
}) => {
    const { toast } = useToast();
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [accountStatuses, setAccountStatuses] = useState<Record<string, Record<string, any>>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [newBackupIPs, setNewBackupIPs] = useState<{ [key: string]: string }>({});
    const [highlightedAccountKey, setHighlightedAccountKey] = useState<string | null>(null);
    const [highlightBorderVisible, setHighlightBorderVisible] = useState(false);
    const highlightStartTimeoutRef = useRef<number | null>(null);
    const highlightBlinkIntervalRef = useRef<number | null>(null);
    const highlightEndTimeoutRef = useRef<number | null>(null);

    // Global bulk input
    const [bulkProxies, setBulkProxies] = useState("");
    const [distributionMethod, setDistributionMethod] = useState<"equal" | "sequential">("equal");
    const [maxBackupsPerAccount, setMaxBackupsPerAccount] = useState(2);
    
    // Collapsible distributor settings
    const [isDistributorOpen, setIsDistributorOpen] = useState(false);
    const [distTargetQueues, setDistTargetQueues] = useState<Record<string, boolean>>({});
    const [distTargetMarket, setDistTargetMarket] = useState(true);
    const [distTargetAutoBuy, setDistTargetAutoBuy] = useState(true);
    const [distOverwrite, setDistOverwrite] = useState(true);

    const canAddBackupForType = (type: Account["account_type"]) => true;

    // Sync distributor target queues from settings
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

    // Propagate backup IPs updates to the parent states to trigger autosave
    useEffect(() => {
        if (!loading && onBackupIPsChange) {
            onBackupIPsChange(accounts);
        }
    }, [accounts, loading, onBackupIPsChange]);

    useEffect(() => {
        fetchProxyPools();
    }, [settingsProfileId, reloadTrigger]);

    useEffect(() => {
        const fetchStatuses = async () => {
            try {
                const res = await fetch("/api/accounts/status");
                if (!res.ok) return;
                const data = await res.json();
                setAccountStatuses(data || {});
            } catch {
                // Ignore status polling failures in proxy tools UI.
            }
        };

        fetchStatuses();
        const interval = window.setInterval(fetchStatuses, 3000);
        return () => window.clearInterval(interval);
    }, []);

    const fetchProxyPools = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/settings/proxy-pools?profile=${settingsProfileId}`);
            if (!res.ok) throw new Error("Failed to fetch proxy pools");
            const data = await res.json();
            setAccounts(data.accounts || []);
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const getAccountKey = (account: Account) => `${account.account_type}-${account.index}`;



    const getNavigatorStatusClass = (account: Account) => {
        const statusData = accountStatuses[account.account_type]?.[String(account.index)];
        if (!statusData) {
            return "border-gray-500/40 bg-gray-500/15 text-gray-200 hover:bg-gray-500/25";
        }

        const code = Number(statusData.status_code);
        if (code === 429) {
            return "border-yellow-500/60 bg-yellow-500/15 text-yellow-300 hover:bg-yellow-500/25";
        }

        const redCodes = [403, 400, 401, 405, 404, 406, 410];
        if (redCodes.includes(code)) {
            return "border-red-500/60 bg-red-500/15 text-red-300 hover:bg-red-500/25";
        }

        return "border-green-500/60 bg-green-500/15 text-green-300 hover:bg-green-500/25";
    };

    const scrollToAccount = (account: Account) => {
        const accountKey = getAccountKey(account);
        const target = document.getElementById(`proxy-account-${accountKey}`);
        if (target) {
            target.scrollIntoView({ behavior: "smooth", block: "center" });
            setHighlightedAccountKey(accountKey);
            setHighlightBorderVisible(false);

            if (highlightStartTimeoutRef.current) {
                window.clearTimeout(highlightStartTimeoutRef.current);
            }
            if (highlightBlinkIntervalRef.current) {
                window.clearInterval(highlightBlinkIntervalRef.current);
            }
            if (highlightEndTimeoutRef.current) {
                window.clearTimeout(highlightEndTimeoutRef.current);
            }

            highlightStartTimeoutRef.current = window.setTimeout(() => {
                setHighlightBorderVisible(true);

                let blinkStep = 0;
                highlightBlinkIntervalRef.current = window.setInterval(() => {
                    blinkStep += 1;
                    setHighlightBorderVisible((prev) => !prev);

                    if (blinkStep >= 7 && highlightBlinkIntervalRef.current) {
                        window.clearInterval(highlightBlinkIntervalRef.current);
                        highlightBlinkIntervalRef.current = null;
                        setHighlightBorderVisible(true);
                    }
                }, 420);
            }, 550);

            highlightEndTimeoutRef.current = window.setTimeout(() => {
                if (highlightBlinkIntervalRef.current) {
                    window.clearInterval(highlightBlinkIntervalRef.current);
                    highlightBlinkIntervalRef.current = null;
                }
                setHighlightBorderVisible(false);
                setHighlightedAccountKey((current) => (current === accountKey ? null : current));
            }, 2000);
        }
    };

    useEffect(() => {
        return () => {
            if (highlightStartTimeoutRef.current) {
                window.clearTimeout(highlightStartTimeoutRef.current);
            }
            if (highlightBlinkIntervalRef.current) {
                window.clearInterval(highlightBlinkIntervalRef.current);
            }
            if (highlightEndTimeoutRef.current) {
                window.clearTimeout(highlightEndTimeoutRef.current);
            }
        };
    }, []);

    const formatProxy = (rawProxy: string): string => {
        if (!rawProxy) return "";
        if (rawProxy.includes("://")) return rawProxy;
        const prefix = globalProxyType === "https" ? "https://" : globalProxyType === "socks5h" ? "socks5h://" : globalProxyType === "socks5" ? "socks5://" : "http://";
        return prefix + rawProxy;
    };

    const isAccountEligible = (account: Account) => {
        if (account.account_type === "market_data") {
            return distTargetMarket;
        }
        if (account.account_type === "auto_buy") {
            return distTargetAutoBuy;
        }
        if (account.account_type === "scanner") {
            const queuesEnabled = settings?.scanner?.queue_config?.enabled;
            if (queuesEnabled) {
                const queues = settings?.scanner?.queue_config?.queues || {};
                for (const [qId, qInfo] of Object.entries(queues)) {
                    const start = (qInfo as any).start_index || 0;
                    const end = (qInfo as any).end_index || 0;
                    if (account.index >= start && account.index <= end) {
                        return distTargetQueues[qId] !== false;
                    }
                }
                return false;
            } else {
                return distTargetQueues['scanner'] !== false;
            }
        }
        return false;
    };

    const getDistPreviewAllocation = () => {
        const lines = bulkProxies.split('\n').map(line => line.trim()).filter(line => line).map(formatProxy);
        const eligibleAccounts = accounts.filter(isAccountEligible);
        
        const previewByAccountKey: Record<string, number> = {};
        eligibleAccounts.forEach((account) => {
            const key = getAccountKey(account);
            previewByAccountKey[key] = distOverwrite ? 0 : account.backup_ips.length;
        });

        let usedCount = 0;

        if (distributionMethod === "equal") {
            let hasCapacity = true;
            while (usedCount < lines.length && hasCapacity) {
                hasCapacity = false;
                for (const account of eligibleAccounts) {
                    const key = getAccountKey(account);
                    if (previewByAccountKey[key] < maxBackupsPerAccount && usedCount < lines.length) {
                        previewByAccountKey[key] += 1;
                        usedCount += 1;
                        hasCapacity = true;
                    }
                }
            }
        } else {
            for (const account of eligibleAccounts) {
                if (usedCount >= lines.length) break;
                const key = getAccountKey(account);
                const currentCount = previewByAccountKey[key];
                const capacity = maxBackupsPerAccount - currentCount;
                if (capacity > 0) {
                    const takeCount = Math.min(capacity, lines.length - usedCount);
                    previewByAccountKey[key] += takeCount;
                    usedCount += takeCount;
                }
            }
        }

        const result = {
            scanner: 0,
            market_data: 0,
            auto_buy: 0,
            queues: {} as Record<string, number>
        };

        const queuesEnabled = settings?.scanner?.queue_config?.enabled;
        const queues = settings?.scanner?.queue_config?.queues || {};

        eligibleAccounts.forEach((account) => {
            const key = getAccountKey(account);
            const countAdded = previewByAccountKey[key] - (distOverwrite ? 0 : account.backup_ips.length);

            if (account.account_type === "market_data") {
                result.market_data += countAdded;
            } else if (account.account_type === "auto_buy") {
                result.auto_buy += countAdded;
            } else if (account.account_type === "scanner") {
                if (queuesEnabled) {
                    for (const [qId, qInfo] of Object.entries(queues)) {
                        const start = (qInfo as any).start_index || 0;
                        const end = (qInfo as any).end_index || 0;
                        if (account.index >= start && account.index <= end) {
                            result.queues[qId] = (result.queues[qId] || 0) + countAdded;
                            break;
                        }
                    }
                } else {
                    result.scanner += countAdded;
                }
            }
        });

        return { alloc: result, totalAdded: usedCount };
    };

    const addBackupIP = (account: Account) => {
        if (account.backup_ips.length >= maxBackupsPerAccount) {
            toast({
                title: "Limit Reached",
                description: `Max ${maxBackupsPerAccount} backup proxies per account`,
                variant: "destructive"
            });
            return;
        }

        const key = getAccountKey(account);
        const newIP = newBackupIPs[key]?.trim();
        if (!newIP) {
            toast({ title: "Error", description: "Please enter a valid proxy URL", variant: "destructive" });
            return;
        }

        const formattedIP = formatProxy(newIP);

        if (!formattedIP.startsWith("http://") && !formattedIP.startsWith("https://") && !formattedIP.startsWith("socks5://") && !formattedIP.startsWith("socks5h://")) {
            toast({ title: "Error", description: "Proxy URL must start with http://, https://, socks5:// or socks5h://", variant: "destructive" });
            return;
        }

        const updatedAccounts = accounts.map(acc => {
            if (getAccountKey(acc) === key) {
                return { ...acc, backup_ips: [...acc.backup_ips, formattedIP] };
            }
            return acc;
        });

        setAccounts(updatedAccounts);
        setNewBackupIPs({ ...newBackupIPs, [key]: "" });
        toast({ title: "Added", description: "Backup IP added (click Save to persist)" });
    };

    const removeBackupIP = (account: Account, ipIndex: number) => {
        const key = getAccountKey(account);
        const updatedAccounts = accounts.map(acc => {
            if (getAccountKey(acc) === key) {
                const newBackupIps = [...acc.backup_ips];
                newBackupIps.splice(ipIndex, 1);
                return { ...acc, backup_ips: newBackupIps };
            }
            return acc;
        });

        setAccounts(updatedAccounts);
        toast({ title: "Removed", description: "Backup IP removed (click Save to persist)" });
    };

    const saveBackupIPs = async (account: Account) => {
        setSaving(true);
        try {
            const res = await fetch(`/api/settings/proxy-pools?profile=${settingsProfileId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    account_type: account.account_type,
                    account_index: account.index,
                    backup_ips: account.backup_ips
                })
            });

            if (!res.ok) throw new Error("Failed to save backup IPs");
            const data = await res.json();
            toast({
                title: "Success",
                description: `Saved ${data.backup_count} backup IPs for ${getAccountTypeLabel(account.account_type)} account ${account.index + 1}`
            });
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    const saveAllBackupIPs = async () => {
        setSaving(true);
        try {
            const promises = accounts.map(async (account) => {
                const res = await fetch(`/api/settings/proxy-pools?profile=${settingsProfileId}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        account_type: account.account_type,
                        account_index: account.index,
                        backup_ips: account.backup_ips
                    })
                });

                if (!res.ok) {
                    const errorText = await res.text();
                    throw new Error(`${getAccountTypeLabel(account.account_type)} Account ${account.index + 1}: ${errorText}`);
                }

                return res.json();
            });

            const results = await Promise.all(promises);
            const totalBackups = results.reduce((sum, r) => sum + (r.backup_count || 0), 0);

            toast({
                title: "Success",
                description: `Saved ${totalBackups} backup IPs across ${accounts.length} accounts`
            });
        } catch (error: any) {
            console.error("Save all error:", error);
            toast({
                title: "Save Failed",
                description: error.message || "Failed to save backup IPs",
                variant: "destructive"
            });
        } finally {
            setSaving(false);
        }
    };

    const distributeBulkProxies = () => {
        const lines = bulkProxies.split('\n').map(line => line.trim()).filter(line => line).map(formatProxy);

        if (lines.length === 0) {
            toast({ title: "Error", description: "Please enter at least one proxy URL", variant: "destructive" });
            return;
        }

        const invalidProxies = lines.filter(line => !line.startsWith("http://") && !line.startsWith("https://") && !line.startsWith("socks5://") && !line.startsWith("socks5h://"));
        if (invalidProxies.length > 0) {
            toast({
                title: "Validation Error",
                description: `${invalidProxies.length} proxy URLs are invalid`,
                variant: "destructive"
            });
            return;
        }

        if (maxBackupsPerAccount < 1) {
            toast({
                title: "Error",
                description: "Backups per account must be at least 1",
                variant: "destructive"
            });
            return;
        }

        const eligibleAccounts = accounts.filter(isAccountEligible);
        if (eligibleAccounts.length === 0) {
            toast({
                title: "No Eligible Accounts",
                description: "Select at least one account type or queue for backup proxies",
                variant: "destructive"
            });
            return;
        }

        const backupByAccountKey: Record<string, string[]> = {};
        eligibleAccounts.forEach((account) => {
            const key = getAccountKey(account);
            backupByAccountKey[key] = distOverwrite ? [] : [...account.backup_ips];
        });

        let usedCount = 0;

        if (distributionMethod === "equal") {
            let hasCapacity = true;
            while (usedCount < lines.length && hasCapacity) {
                hasCapacity = false;
                for (const account of eligibleAccounts) {
                    const key = getAccountKey(account);
                    if (backupByAccountKey[key].length < maxBackupsPerAccount && usedCount < lines.length) {
                        backupByAccountKey[key].push(lines[usedCount]);
                        usedCount += 1;
                        hasCapacity = true;
                    }
                }
            }
        } else {
            for (const account of eligibleAccounts) {
                if (usedCount >= lines.length) break;
                const key = getAccountKey(account);
                const currentCount = backupByAccountKey[key].length;
                const capacity = maxBackupsPerAccount - currentCount;
                if (capacity > 0) {
                    const takeCount = Math.min(capacity, lines.length - usedCount);
                    backupByAccountKey[key] = [...backupByAccountKey[key], ...lines.slice(usedCount, usedCount + takeCount)];
                    usedCount += takeCount;
                }
            }
        }

        const updatedAccounts = accounts.map(account => {
            const key = getAccountKey(account);
            if (!isAccountEligible(account)) {
                return account;
            }
            return {
                ...account,
                backup_ips: backupByAccountKey[key] || []
            };
        });

        const ignoredCount = lines.length - usedCount;

        toast({
            title: "Distribution Complete",
            description: `Assigned ${usedCount}/${lines.length} proxies across ${eligibleAccounts.length} selected accounts (max ${maxBackupsPerAccount}/account)${ignoredCount > 0 ? `. ${ignoredCount} left unassigned.` : ""}`
        });

        setAccounts(updatedAccounts);
        setBulkProxies("");
    };

    const maskProxy = (proxy: string) => {
        try {
            const url = new URL(proxy);
            return `${url.protocol}//${url.hostname}:${url.port}`;
        } catch {
            return proxy.substring(0, 30) + "...";
        }
    };

    const groupedAccounts = {
        scanner: accounts.filter((account) => account.account_type === "scanner"),
        market_data: accounts.filter((account) => account.account_type === "market_data"),
        auto_buy: accounts.filter((account) => account.account_type === "auto_buy"),
    };

    if (loading) {
        return (
            <Card className="border-border/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-primary" />
                        Proxy Backup Pools
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center py-8">
                        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Bulk Management Section */}
            <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
                <CardHeader className="cursor-pointer select-none" onClick={() => setIsDistributorOpen(!isDistributorOpen)}>
                    <div className="flex items-start justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Zap className="h-5 w-5 text-primary" />
                                Bulk Proxy Management
                            </CardTitle>
                            <p className="text-sm text-muted-foreground mt-2">
                                Add multiple backup proxies at once and automatically distribute them across all {accounts.length} accounts.
                            </p>
                        </div>
                        <Button variant="ghost" size="icon" className="shrink-0 mt-1" onClick={e => { e.stopPropagation(); setIsDistributorOpen(!isDistributorOpen); }}>
                            <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${isDistributorOpen ? 'rotate-180' : ''}`} />
                        </Button>
                    </div>
                </CardHeader>
                <div
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${isDistributorOpen ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0'}`}
                >
                    <CardContent className="space-y-4">
                        <Separator />
                        
                        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4 items-start">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Paste Backup Proxies (one per line):</label>
                                <Textarea
                                    placeholder={`http://user:pass@proxy1:port\nhttp://user:pass@proxy2:port\nhttp://user:pass@proxy3:port`}
                                    value={bulkProxies}
                                    onChange={(e) => setBulkProxies(e.target.value)}
                                    className="font-mono text-sm min-h-[180px]"
                                />
                                <p className="text-xs text-muted-foreground">
                                    {bulkProxies.split('\n').filter(l => l.trim()).length} proxies entered
                                </p>
                            </div>

                            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-3 self-start">
                                <p className="text-sm font-medium">Bulk Rules</p>
                                <div className="space-y-1.5">
                                    <label htmlFor="max-backups-per-account" className="text-xs text-muted-foreground">
                                        Backup proxies per account
                                    </label>
                                    <Input
                                        id="max-backups-per-account"
                                        type="number"
                                        min={1}
                                        max={50}
                                        value={maxBackupsPerAccount}
                                        onChange={(e) => setMaxBackupsPerAccount(Math.max(1, parseInt(e.target.value || "1", 10)))}
                                        className="h-9"
                                    />
                                </div>
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

                                <div className="flex items-center gap-2">
                                    <Switch
                                        id="dist-target-autobuy"
                                        checked={distTargetAutoBuy}
                                        onCheckedChange={setDistTargetAutoBuy}
                                        className="scale-75 origin-center data-[state=checked]:bg-green-500"
                                    />
                                    <Label htmlFor="dist-target-autobuy" className="cursor-pointer text-xs font-medium">
                                        Auto-Buy
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
                                Clear existing backup proxies (Overwrite)
                            </Label>
                        </div>

                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    id="equal"
                                    name="distribution"
                                    value="equal"
                                    checked={distributionMethod === "equal"}
                                    onChange={() => setDistributionMethod("equal")}
                                    className="cursor-pointer"
                                />
                                <label htmlFor="equal" className="text-sm cursor-pointer">
                                    <strong>Equal Distribution</strong> - Round-robin across enabled account types
                                </label>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    id="sequential"
                                    name="distribution"
                                    value="sequential"
                                    checked={distributionMethod === "sequential"}
                                    onChange={() => setDistributionMethod("sequential")}
                                    className="cursor-pointer"
                                />
                                <label htmlFor="sequential" className="text-sm cursor-pointer">
                                    <strong>Sequential</strong> - Fill each account up to limit in order
                                </label>
                            </div>
                        </div>

                        {/* Preview / allocation row */}
                        {(() => {
                            const linesCount = bulkProxies.split('\n').filter(l => l.trim()).length;
                            if (linesCount === 0) return null;

                            const { alloc, totalAdded } = getDistPreviewAllocation();
                            if (totalAdded === 0) return null;

                            const queuesEnabled = settings?.scanner?.queue_config?.enabled;
                            const queues = settings?.scanner?.queue_config?.queues || {};
                            const queueIds = Object.keys(queues).sort((a, b) => Number(a) - Number(b));

                            return (
                                <div className="space-y-2 pt-2">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estimated Allocation Preview:</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                        {queuesEnabled ? (
                                            queueIds.map(qId => {
                                                const isSelected = distTargetQueues[qId] !== false;
                                                if (!isSelected) return null;
                                                const count = alloc.queues[qId] || 0;
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
                                                    <p className="text-2xl font-bold text-blue-400">{alloc.scanner || 0}</p>
                                                    <p className="text-xs text-muted-foreground mt-1">Scanner Accounts</p>
                                                </div>
                                            )
                                        )}

                                        {distTargetMarket && (
                                            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 text-center">
                                                <p className="text-2xl font-bold text-purple-400">{alloc.market_data || 0}</p>
                                                <p className="text-xs text-muted-foreground mt-1">Market Data</p>
                                            </div>
                                        )}

                                        {distTargetAutoBuy && (
                                            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
                                                <p className="text-2xl font-bold text-green-400">{alloc.auto_buy || 0}</p>
                                                <p className="text-xs text-muted-foreground mt-1">Auto-Buy</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}

                        <div className="flex gap-2 pt-2">
                            <Button
                                onClick={distributeBulkProxies}
                                className="flex-1 gap-2"
                                disabled={!bulkProxies.trim()}
                            >
                                <Zap className="h-4 w-4" />
                                Distribute Automatically
                            </Button>
                            <Button
                                variant="outline"
                                onClick={saveAllBackupIPs}
                                disabled={saving}
                                className="gap-2"
                            >
                                {saving ? (
                                    <>
                                        <RefreshCw className="h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="h-4 w-4" />
                                        Save All
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </div>
            </Card>

            <Separator />

            <div className="hidden xl:block fixed right-20 top-1/2 -translate-y-1/2 z-30">
                <div className="w-72 max-h-[78vh] rounded-xl border border-border/70 bg-background/85 backdrop-blur-sm px-3 py-3 shadow-md">
                    <p className="text-xs font-medium text-muted-foreground text-center mb-2">Navigator</p>
                    <div className="overflow-y-auto pr-1.5 space-y-2.5 max-h-[calc(78vh-2.75rem)] pb-1">
                        {(["scanner", "market_data", "auto_buy"] as const).map((group) => (
                            groupedAccounts[group].length > 0 ? (
                                <div key={group} className="space-y-1.5">
                                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground/90 text-center">
                                        {getAccountTypeLabel(group)}
                                    </p>
                                    <div className="flex flex-wrap justify-center gap-1.5">
                                        {groupedAccounts[group].map((account) => (
                                            <Button
                                                key={`jump-${getAccountKey(account)}`}
                                                size="sm"
                                                variant="outline"
                                                className={`h-9 w-9 p-0 rounded-lg font-mono text-xs ${getNavigatorStatusClass(account)}`}
                                                onClick={() => scrollToAccount(account)}
                                            >
                                                {account.index + 1}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            ) : null
                        ))}
                    </div>
                </div>
            </div>

            {/* Individual Account Management */}
            <Card className="border-border/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Shield className="h-5 w-5 text-primary" />
                            Individual Account Management
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-2">
                            Fine-tune backup IPs for each account individually.
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {accounts.map((account) => (
                            <div
                                id={`proxy-account-${getAccountKey(account)}`}
                                key={getAccountKey(account)}
                                className={`border rounded-lg p-4 space-y-4 scroll-mt-24 transition-all duration-300 ${highlightedAccountKey === getAccountKey(account)
                                    ? (highlightBorderVisible ? "border-white ring-2 ring-white/80" : "border-white/60 ring-2 ring-white/35")
                                        : "border-border/50"
                                    }`}
                            >
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold text-sm">{getAccountTypeLabel(account.account_type)} Account #{account.index + 1}</h3>
                                        <Badge variant="outline" className={getAccountTypeColor(account.account_type)}>
                                            {getAccountTypeLabel(account.account_type)}
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        API Key: <span className="font-mono">{account.api_key}</span>
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Current Proxy: <span className="font-mono">{maskProxy(account.current_proxy)}</span>
                                    </p>
                                </div>
                                <Badge variant="outline" className="text-primary border-primary/50">
                                    {account.backup_ips.length} Backup{account.backup_ips.length !== 1 ? "s" : ""}
                                </Badge>
                            </div>

                            <div className="space-y-2">
                                <p className="text-sm font-medium">Backup IPs:</p>
                                {account.backup_ips.length === 0 ? (
                                    <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-md">
                                        No backup IPs configured
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {account.backup_ips.map((ip, ipIndex) => (
                                            <div
                                                key={ipIndex}
                                                className="flex items-center justify-between bg-muted/30 p-2 rounded-md"
                                            >
                                                <span className="text-sm font-mono truncate flex-1">{maskProxy(ip)}</span>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => removeBackupIP(account, ipIndex)}
                                                    className="h-8 w-8 p-0 hover:bg-destructive/20"
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2">
                                <Input
                                    placeholder="http://user:pass@proxy:port"
                                    value={newBackupIPs[getAccountKey(account)] || ""}
                                    onChange={(e) =>
                                        setNewBackupIPs({ ...newBackupIPs, [getAccountKey(account)]: e.target.value })
                                    }
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") addBackupIP(account);
                                    }}
                                    className="flex-1 font-mono text-sm"
                                    disabled={!canAddBackupForType(account.account_type) || account.backup_ips.length >= maxBackupsPerAccount}
                                />
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => addBackupIP(account)}
                                    className="gap-2"
                                    disabled={!canAddBackupForType(account.account_type) || account.backup_ips.length >= maxBackupsPerAccount}
                                >
                                    <Plus className="h-4 w-4" />
                                    Add
                                </Button>
                            </div>

                            {!canAddBackupForType(account.account_type) && (
                                <p className="text-xs text-muted-foreground">Adding backup proxies for this account type is disabled.</p>
                            )}
                            {canAddBackupForType(account.account_type) && account.backup_ips.length >= maxBackupsPerAccount && (
                                <p className="text-xs text-muted-foreground">Reached limit: {maxBackupsPerAccount} backup proxies per account.</p>
                            )}

                            <Button
                                onClick={() => saveBackupIPs(account)}
                                disabled={saving}
                                className="w-full gap-2"
                                size="sm"
                            >
                                <Save className="h-4 w-4" />
                                Save {getAccountTypeLabel(account.account_type)} #{account.index + 1}
                            </Button>
                        </div>
                    ))}

                        {accounts.length === 0 && (
                            <div className="text-center text-muted-foreground py-8">
                                <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p>No accounts configured</p>
                            </div>
                        )}
                    </CardContent>
            </Card>
        </div>
    );
};
