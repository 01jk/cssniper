import { useState, useEffect } from "react";
import { Bell, Volume2, Monitor, Eye, Clock, Trash2, Info, ChevronDown, ChevronUp, CheckCircle, AlertTriangle, AlertCircle, ShoppingCart } from "lucide-react";
import { useNotifications } from "@/contexts/NotificationContext";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { TargetNotificationSettings } from "./TargetNotificationSettings";

export const NotificationSettings = () => {
  const { settings, updateSettings, playNotificationSound } = useNotifications();

  const handleTestSound = (type: 'error' | 'autobuy' | 'notification') => {
    playNotificationSound(type);
  };

  // State for collapsible sections
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    info: false,
    success: false,
    warning: false,
    error: false,
    autobuy: false,
  });

  // State for sub-types checkboxes
  const [selectedSubTypes, setSelectedSubTypes] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem("sniper-bot-notification-subtypes");
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.debug("Failed to load notification sub-types:", e);
    }
    // Default: all enabled
    return {};
  });

  // Save sub-types to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem("sniper-bot-notification-subtypes", JSON.stringify(selectedSubTypes));
    } catch (e) {
      console.debug("Failed to save notification sub-types:", e);
    }
  }, [selectedSubTypes]);

  // Sub-types for each notification type
  const notificationSubTypes = {
    info: [
      { id: "scanning_started", label: "Scanning Started", description: "When bot starts scanning" },
      { id: "scanning_stopped", label: "Scanning Stopped", description: "When bot stops scanning" },
      { id: "config_updated", label: "Configuration Updated", description: "When settings are saved" },
      { id: "buy_attempt", label: "Buy Attempt", description: "When attempting to purchase" },
    ],
    success: [
      { id: "match_found", label: "Match Found", description: "Item meets target criteria" },
      { id: "bot_started", label: "Bot Started", description: "Bot successfully started" },
      { id: "settings_saved", label: "Settings Saved", description: "Configuration saved" },
    ],
    warning: [
      { id: "rate_limit", label: "Rate Limit", description: "API rate limit reached" },
      { id: "item_skipped", label: "Item Skipped", description: "Item doesn't match criteria" },
      { id: "price_change", label: "Price Change Alert", description: "Significant price change" },
      { id: "update_available", label: "Update Available", description: "New version available" },
    ],
    error: [
      { id: "purchase_failed", label: "Purchase Failed", description: "Failed to complete purchase" },
      { id: "connection_error", label: "Connection Error", description: "API connection failed" },
      { id: "auth_error", label: "Authorization Error", description: "Invalid API key" },
      { id: "insufficient_balance", label: "Insufficient Balance", description: "Not enough funds" },
      { id: "database_error", label: "Database Error", description: "Database operation failed" },
    ],
    autobuy: [
      { id: "purchase_successful", label: "Purchase Successful", description: "Item purchased with profit info" },
      { id: "item_details", label: "Item Details", description: "Float, pattern, fees information" },
      { id: "trade_url", label: "Trade URL", description: "Steam trade URL provided" },
    ],
  };

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const toggleSubType = (subTypeId: string) => {
    setSelectedSubTypes(prev => ({
      ...prev,
      [subTypeId]: !prev[subTypeId]
    }));
  };

  const selectAllInCategory = (category: string) => {
    const categoryTypes = notificationSubTypes[category as keyof typeof notificationSubTypes];
    const newSelection = { ...selectedSubTypes };
    categoryTypes.forEach(subType => {
      newSelection[subType.id] = true;
    });
    setSelectedSubTypes(newSelection);
  };

  const deselectAllInCategory = (category: string) => {
    const categoryTypes = notificationSubTypes[category as keyof typeof notificationSubTypes];
    const newSelection = { ...selectedSubTypes };
    categoryTypes.forEach(subType => {
      newSelection[subType.id] = false;
    });
    setSelectedSubTypes(newSelection);
  };

  return (
    <div className="space-y-6">
      {/* General Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle>General Settings</CardTitle>
          </div>
          <CardDescription>
            Basic notification system settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Enable Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Completely disable all notifications
              </p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(checked) => updateSettings({ enabled: checked })}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Desktop Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Show browser system notifications
              </p>
            </div>
            <Switch
              checked={settings.desktopNotifications}
              onCheckedChange={(checked) => updateSettings({ desktopNotifications: checked })}
              disabled={!settings.enabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Target-Specific Notifications */}
      <TargetNotificationSettings />

      {/* Sound Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Volume2 className="h-5 w-5 text-primary" />
            <CardTitle>Sound Notifications</CardTitle>
          </div>
          <CardDescription>
            Configure volume and test sounds
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Enable Sound</Label>
              <p className="text-sm text-muted-foreground">
                Play sounds for notifications
              </p>
            </div>
            <Switch
              checked={settings.soundEnabled}
              onCheckedChange={(checked) => updateSettings({ soundEnabled: checked })}
              disabled={!settings.enabled}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Volume</Label>
              <span className="text-sm text-muted-foreground">{settings.volume}%</span>
            </div>
            <Slider
              value={[settings.volume]}
              min={0}
              max={100}
              step={1}
              onValueChange={(vals) => updateSettings({ volume: vals[0] })}
              disabled={!settings.enabled || !settings.soundEnabled}
              className="w-full"
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <Label>Test Sounds</Label>
            <div className="flex gap-3 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTestSound('notification')}
                disabled={!settings.enabled || !settings.soundEnabled}
                className="gap-2"
              >
                <Bell className="h-4 w-4 text-blue-500" />
                Test Notification
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTestSound('error')}
                disabled={!settings.enabled || !settings.soundEnabled}
                className="gap-2"
              >
                <Bell className="h-4 w-4 text-red-500" />
                Test Error
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTestSound('autobuy')}
                disabled={!settings.enabled || !settings.soundEnabled}
                className="gap-2"
              >
                <Bell className="h-4 w-4 text-green-500" />
                Test AutoBuy
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Sounds: Notification (info/success) · Error (warning/errors) · AutoBuy (purchases)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Notification Types */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            <CardTitle>Notification Types</CardTitle>
          </div>
          <CardDescription>
            Select which event types to show notifications for
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Info Section */}
          <Collapsible open={openSections.info} onOpenChange={() => toggleSection("info")}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    {openSections.info ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-blue-500" />
                  <Label className="font-medium">Info</Label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => selectAllInCategory("info")}
                  title="Select all"
                >
                  All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => deselectAllInCategory("info")}
                  title="Deselect all"
                >
                  None
                </Button>
                <Switch
                  checked={settings.enableInfo}
                  onCheckedChange={(checked) => updateSettings({ enableInfo: checked })}
                  disabled={!settings.enabled}
                />
              </div>
            </div>
            <CollapsibleContent>
              <div className="pl-10 space-y-3">
                <p className="text-sm text-muted-foreground">
                  General bot information notifications:
                </p>
                <div className="space-y-2">
                  {notificationSubTypes.info.map((subType) => (
                    <div key={subType.id} className="flex items-start gap-2">
                      <Checkbox
                        id={`info_${subType.id}`}
                        className="mt-0.5"
                        checked={selectedSubTypes[subType.id] !== false}
                        onCheckedChange={() => toggleSubType(subType.id)}
                      />
                      <div className="space-y-0.5">
                        <Label htmlFor={`info_${subType.id}`} className="text-sm font-medium cursor-pointer">
                          {subType.label}
                        </Label>
                        <p className="text-xs text-muted-foreground">{subType.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Success Section */}
          <Collapsible open={openSections.success} onOpenChange={() => toggleSection("success")}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    {openSections.success ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <Label className="font-medium">Success</Label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => selectAllInCategory("success")}
                  title="Select all"
                >
                  All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => deselectAllInCategory("success")}
                  title="Deselect all"
                >
                  None
                </Button>
                <Switch
                  checked={settings.enableSuccess}
                  onCheckedChange={(checked) => updateSettings({ enableSuccess: checked })}
                  disabled={!settings.enabled}
                />
              </div>
            </div>
            <CollapsibleContent>
              <div className="pl-10 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Successful actions and purchases:
                </p>
                <div className="space-y-2">
                  {notificationSubTypes.success.map((subType) => (
                    <div key={subType.id} className="flex items-start gap-2">
                      <Checkbox
                        id={`success_${subType.id}`}
                        className="mt-0.5"
                        checked={selectedSubTypes[subType.id] !== false}
                        onCheckedChange={() => toggleSubType(subType.id)}
                      />
                      <div className="space-y-0.5">
                        <Label htmlFor={`success_${subType.id}`} className="text-sm font-medium cursor-pointer">
                          {subType.label}
                        </Label>
                        <p className="text-xs text-muted-foreground">{subType.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Warning Section */}
          <Collapsible open={openSections.warning} onOpenChange={() => toggleSection("warning")}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    {openSections.warning ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <Label className="font-medium">Warning</Label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => selectAllInCategory("warning")}
                  title="Select all"
                >
                  All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => deselectAllInCategory("warning")}
                  title="Deselect all"
                >
                  None
                </Button>
                <Switch
                  checked={settings.enableWarning}
                  onCheckedChange={(checked) => updateSettings({ enableWarning: checked })}
                  disabled={!settings.enabled}
                />
              </div>
            </div>
            <CollapsibleContent>
              <div className="pl-10 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Potential issue warnings:
                </p>
                <div className="space-y-2">
                  {notificationSubTypes.warning.map((subType) => (
                    <div key={subType.id} className="flex items-start gap-2">
                      <Checkbox
                        id={`warning_${subType.id}`}
                        className="mt-0.5"
                        checked={selectedSubTypes[subType.id] !== false}
                        onCheckedChange={() => toggleSubType(subType.id)}
                      />
                      <div className="space-y-0.5">
                        <Label htmlFor={`warning_${subType.id}`} className="text-sm font-medium cursor-pointer">
                          {subType.label}
                        </Label>
                        <p className="text-xs text-muted-foreground">{subType.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Error Section */}
          <Collapsible open={openSections.error} onOpenChange={() => toggleSection("error")}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    {openSections.error ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <Label className="font-medium">Error</Label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => selectAllInCategory("error")}
                  title="Select all"
                >
                  All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => deselectAllInCategory("error")}
                  title="Deselect all"
                >
                  None
                </Button>
                <Switch
                  checked={settings.enableError}
                  onCheckedChange={(checked) => updateSettings({ enableError: checked })}
                  disabled={!settings.enabled}
                />
              </div>
            </div>
            <CollapsibleContent>
              <div className="pl-10 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Critical errors and failures:
                </p>
                <div className="space-y-2">
                  {notificationSubTypes.error.map((subType) => (
                    <div key={subType.id} className="flex items-start gap-2">
                      <Checkbox
                        id={`error_${subType.id}`}
                        className="mt-0.5"
                        checked={selectedSubTypes[subType.id] !== false}
                        onCheckedChange={() => toggleSubType(subType.id)}
                      />
                      <div className="space-y-0.5">
                        <Label htmlFor={`error_${subType.id}`} className="text-sm font-medium cursor-pointer">
                          {subType.label}
                        </Label>
                        <p className="text-xs text-muted-foreground">{subType.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* AutoBuy Section */}
          <Collapsible open={openSections.autobuy} onOpenChange={() => toggleSection("autobuy")}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    {openSections.autobuy ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-accent" />
                  <Label className="font-medium">AutoBuy</Label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => selectAllInCategory("autobuy")}
                  title="Select all"
                >
                  All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => deselectAllInCategory("autobuy")}
                  title="Deselect all"
                >
                  None
                </Button>
                <Switch
                  checked={settings.enableAutoBuy}
                  onCheckedChange={(checked) => updateSettings({ enableAutoBuy: checked })}
                  disabled={!settings.enabled}
                />
              </div>
            </div>
            <CollapsibleContent>
              <div className="pl-10 space-y-3">
                <p className="text-sm text-muted-foreground">
                  AutoBuy purchase notifications:
                </p>
                <div className="space-y-2">
                  {notificationSubTypes.autobuy.map((subType) => (
                    <div key={subType.id} className="flex items-start gap-2">
                      <Checkbox
                        id={`autobuy_${subType.id}`}
                        className="mt-0.5"
                        checked={selectedSubTypes[subType.id] !== false}
                        onCheckedChange={() => toggleSubType(subType.id)}
                      />
                      <div className="space-y-0.5">
                        <Label htmlFor={`autobuy_${subType.id}`} className="text-sm font-medium cursor-pointer">
                          {subType.label}
                        </Label>
                        <p className="text-xs text-muted-foreground">{subType.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* Display Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Monitor className="h-5 w-5 text-primary" />
            <CardTitle>Display</CardTitle>
          </div>
          <CardDescription>
            Configure notification appearance and behavior
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Toast Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Show toast notifications on screen
              </p>
            </div>
            <Switch
              checked={settings.showToasts}
              onCheckedChange={(checked) => updateSettings({ showToasts: checked })}
              disabled={!settings.enabled}
            />
          </div>

          <div className="space-y-2">
            <Label>Toast Position</Label>
            <Select
              value={settings.toastPosition}
              onValueChange={(val: any) => updateSettings({ toastPosition: val })}
              disabled={!settings.enabled || !settings.showToasts}
            >
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="top-right">Top Right</SelectItem>
                <SelectItem value="top-left">Top Left</SelectItem>
                <SelectItem value="bottom-right">Bottom Right</SelectItem>
                <SelectItem value="bottom-left">Bottom Left</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Display Duration (sec)</Label>
              <span className="text-sm text-muted-foreground">{settings.toastDuration}s</span>
            </div>
            <Slider
              value={[settings.toastDuration]}
              min={1}
              max={30}
              step={1}
              onValueChange={(vals) => updateSettings({ toastDuration: vals[0] })}
              disabled={!settings.enabled || !settings.showToasts}
              className="w-full max-w-xs"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Max Visible Toasts</Label>
              <span className="text-sm text-muted-foreground">{settings.maxVisibleToasts}</span>
            </div>
            <Slider
              value={[settings.maxVisibleToasts]}
              min={1}
              max={10}
              step={1}
              onValueChange={(vals) => updateSettings({ maxVisibleToasts: vals[0] })}
              disabled={!settings.enabled || !settings.showToasts}
              className="w-full max-w-xs"
            />
          </div>
        </CardContent>
      </Card>

      {/* Manager Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <CardTitle>Notification Manager</CardTitle>
          </div>
          <CardDescription>
            Notification storage and handling settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Max Notifications</Label>
              <span className="text-sm text-muted-foreground">{settings.maxNotifications}</span>
            </div>
            <Slider
              value={[settings.maxNotifications]}
              min={10}
              max={500}
              step={10}
              onValueChange={(vals) => updateSettings({ maxNotifications: vals[0] })}
              disabled={!settings.enabled}
              className="w-full max-w-xs"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-destructive">Clear All Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Delete all stored notifications
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('clear-all-notifications'));
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
