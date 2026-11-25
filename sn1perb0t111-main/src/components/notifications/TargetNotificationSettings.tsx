import { useState, useEffect } from "react";
import { Target, Search, Bell, BellOff, ChevronRight, ChevronDown } from "lucide-react";
import { useNotifications } from "@/contexts/NotificationContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface TargetConfig {
  id: string;
  name: string;
  targets: TargetItem[];
}

interface TargetItem {
  id: string;
  item_name: string;
  min_price: number;
  max_price: number;
  min_float: number;
  max_float: number;
  is_stattrak?: boolean;
  is_souvenir?: boolean;
  is_active: boolean;
  notifications_enabled?: boolean;
}

interface TargetNotificationSettings {
  [configId: string]: {
    [targetId: string]: boolean;
  };
}

const STORAGE_KEY = "sniper-bot-target-notification-settings";

export const TargetNotificationSettings = () => {
  const { settings } = useNotifications();
  const [configs, setConfigs] = useState<TargetConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedConfigs, setExpandedConfigs] = useState<Set<string>>(new Set());
  const [targetSettings, setTargetSettings] = useState<TargetNotificationSettings>({});

  // Загрузка конфигов и настроек
  useEffect(() => {
    loadConfigs();
    loadTargetSettings();
  }, []);

  const loadConfigs = async () => {
    try {
      const res = await fetch("/api/configs");
      if (res.ok) {
        const data = await res.json();
        
        // Преобразуем данные в нужный формат
        const configsWithTargets: TargetConfig[] = await Promise.all(
          data.map(async (config: any) => {
            const targetsRes = await fetch(`/api/configs/${config.name}/targets`);
            const targets = targetsRes.ok ? await targetsRes.json() : [];
            
            return {
              id: config.name,
              name: config.name,
              targets: targets.map((t: any) => ({
                id: t.id.toString(),
                item_name: t.item_name,
                min_price: t.min_price,
                max_price: t.max_price,
                min_float: t.min_float,
                max_float: t.max_float,
                is_stattrak: t.is_stattrak,
                is_souvenir: t.is_souvenir,
                is_active: t.is_active,
                notifications_enabled: t.notifications_enabled !== false,
              })),
            };
          })
        );
        
        setConfigs(configsWithTargets);
      }
    } catch (error) {
      console.error("Failed to load configs:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadTargetSettings = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setTargetSettings(JSON.parse(stored));
      }
    } catch (error) {
      console.debug("Failed to load target notification settings:", error);
    }
  };

  const saveTargetSettings = (newSettings: TargetNotificationSettings) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
      setTargetSettings(newSettings);
    } catch (error) {
      console.debug("Failed to save target notification settings:", error);
    }
  };

  const toggleConfig = (configId: string) => {
    const newExpanded = new Set(expandedConfigs);
    if (newExpanded.has(configId)) {
      newExpanded.delete(configId);
    } else {
      newExpanded.add(configId);
    }
    setExpandedConfigs(newExpanded);
  };

  const toggleTargetNotification = (configId: string, targetId: string, currentValue: boolean) => {
    const newSettings = {
      ...targetSettings,
      [configId]: {
        ...(targetSettings[configId] || {}),
        [targetId]: !currentValue,
      },
    };
    saveTargetSettings(newSettings);

    // Также обновляем на бэкенде
    updateTargetNotification(configId, targetId, !currentValue);
  };

  const updateTargetNotification = async (configId: string, targetId: string, enabled: boolean) => {
    try {
      await fetch(`/api/targets/${targetId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notifications_enabled: enabled,
        }),
      });
    } catch (error) {
      console.error("Failed to update target notification:", error);
    }
  };

  const enableAllForConfig = async (configId: string) => {
    const config = configs.find(c => c.id === configId);
    if (!config) return;

    // Обновляем на бэкенде каждый таргет
    for (const target of config.targets) {
      try {
        await fetch(`/api/targets/${target.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            notifications_enabled: true,
          }),
        });
      } catch (error) {
        console.error(`Failed to update target ${target.id}:`, error);
      }
    }

    // Обновляем локальные настройки
    const newSettings = {
      ...targetSettings,
      [configId]: Object.fromEntries(
        config.targets.map(t => [t.id, true])
      ),
    };
    saveTargetSettings(newSettings);

    // Перезагружаем конфиги чтобы получить актуальные данные
    loadConfigs();
  };

  const disableAllForConfig = async (configId: string) => {
    const config = configs.find(c => c.id === configId);
    if (!config) return;

    // Обновляем на бэкенде каждый таргет
    for (const target of config.targets) {
      try {
        await fetch(`/api/targets/${target.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            notifications_enabled: false,
          }),
        });
      } catch (error) {
        console.error(`Failed to update target ${target.id}:`, error);
      }
    }

    // Обновляем локальные настройки
    const newSettings = {
      ...targetSettings,
      [configId]: Object.fromEntries(
        config.targets.map(t => [t.id, false])
      ),
    };
    saveTargetSettings(newSettings);

    // Перезагружаем конфиги чтобы получить актуальные данные
    loadConfigs();
  };

  const filteredConfigs = configs.map(config => {
    const filteredTargets = config.targets.filter(target =>
      target.item_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    return {
      ...config,
      targets: filteredTargets,
    };
  }).filter(config => 
    config.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    config.targets.length > 0
  );

  const isTargetEnabled = (configId: string, targetId: string, defaultValue: boolean) => {
    return targetSettings[configId]?.[targetId] ?? defaultValue;
  };

  const getTotalTargets = () => {
    return configs.reduce((sum, config) => sum + config.targets.length, 0);
  };

  const getEnabledTargets = () => {
    let count = 0;
    configs.forEach(config => {
      config.targets.forEach(target => {
        if (isTargetEnabled(config.id, target.id, target.notifications_enabled)) {
          count++;
        }
      });
    });
    return count;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Target Notifications</CardTitle>
          <CardDescription>Loading target configurations...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Target Notifications
            </CardTitle>
            <CardDescription>
              Configure notifications for individual targets
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Enabled</div>
            <div className="text-lg font-bold text-primary">
              {getEnabledTargets()} / {getTotalTargets()}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search targets or configs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7"
              onClick={() => setSearchTerm("")}
            >
              Clear
            </Button>
          )}
        </div>

        {/* Info */}
        <div className="text-xs text-muted-foreground">
          Enable or disable notifications for specific targets. Global notifications must be enabled.
        </div>

        {/* Configs List */}
        <ScrollArea className="h-[400px] border rounded-md">
          <div className="divide-y">
            {filteredConfigs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Target className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-sm">
                  {searchTerm ? "No targets found" : "No configurations found"}
                </p>
              </div>
            ) : (
              filteredConfigs.map((config) => (
                <Collapsible
                  key={config.id}
                  open={expandedConfigs.has(config.id)}
                  onOpenChange={() => toggleConfig(config.id)}
                >
                  {/* Config Header */}
                  <div className="p-3 hover:bg-secondary/30 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 justify-start gap-2 h-auto py-2 px-3"
                        >
                          {expandedConfigs.has(config.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <div className="flex items-center gap-2">
                            <Target className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{config.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {config.targets.length} targets
                            </Badge>
                          </div>
                        </Button>
                      </CollapsibleTrigger>

                      {/* Quick Actions */}
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-green-500 hover:text-green-400"
                          onClick={(e) => {
                            e.stopPropagation();
                            enableAllForConfig(config.id);
                          }}
                          title="Enable all"
                        >
                          <Bell className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-red-500 hover:text-red-400"
                          onClick={(e) => {
                            e.stopPropagation();
                            disableAllForConfig(config.id);
                          }}
                          title="Disable all"
                        >
                          <BellOff className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Targets List */}
                  <CollapsibleContent>
                    <div className="px-3 pb-3 space-y-2">
                      {config.targets.map((target) => {
                        const enabled = isTargetEnabled(
                          config.id,
                          target.id,
                          target.notifications_enabled
                        );

                        return (
                          <div
                            key={target.id}
                            className={cn(
                              "flex items-center justify-between p-2 rounded-md border transition-colors",
                              enabled ? "bg-primary/5 border-primary/20" : "bg-muted/30"
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium truncate">
                                  {target.item_name}
                                </span>
                                {target.is_stattrak && (
                                  <Badge className="h-4 text-xs bg-orange-500/20 text-orange-500 border-orange-500/30">
                                    ST
                                  </Badge>
                                )}
                                {target.is_souvenir && (
                                  <Badge className="h-4 text-xs bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
                                    Souv
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                <span>Float: {target.min_float} - {target.max_float}</span>
                                <span>Price: ${target.min_price} - ${target.max_price}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 ml-4">
                              <Switch
                                checked={enabled}
                                onCheckedChange={() =>
                                  toggleTargetNotification(config.id, target.id, enabled)
                                }
                                disabled={!settings.enabled}
                              />
                              {enabled ? (
                                <Bell className="h-4 w-4 text-green-500" />
                              ) : (
                                <BellOff className="h-4 w-4 text-red-500" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Warning if global notifications disabled */}
        {!settings.enabled && (
          <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md text-sm text-destructive">
            ⚠️ Global notifications are disabled. Enable them in General Settings to receive target notifications.
          </div>
        )}
      </CardContent>
    </Card>
  );
};
