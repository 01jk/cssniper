import React, { useState } from "react";
import { Settings2, Sliders, Volume2, VolumeX, Send, TestTube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose
} from "@/components/ui/dialog";
import { WatchlistSettings, defaultWatchlistSettings } from "./watchlistTypes";

interface WatchlistSettingsModalProps {
  settings: WatchlistSettings;
  onSave: (settings: WatchlistSettings) => void;
}

export const WatchlistSettingsModal: React.FC<WatchlistSettingsModalProps> = ({ settings, onSave }) => {
  const [draft, setDraft] = useState<WatchlistSettings>({ ...settings });

  const handleSave = () => {
    onSave(draft);
    try {
      localStorage.setItem('watchlist-settings', JSON.stringify(draft));
    } catch {}
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5">
          <Settings2 className="h-3.5 w-3.5" />
          Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            Watchlist Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Threshold */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-2">
              <Sliders className="h-3.5 w-3.5" />
              ΔPrice Alert Threshold
            </Label>
            <div className="flex items-center gap-3">
              <Slider
                value={[draft.threshold_percent]}
                onValueChange={([v]) => setDraft(d => ({ ...d, threshold_percent: v }))}
                min={0}
                max={50}
                step={0.5}
                className="flex-1"
              />
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={draft.threshold_percent}
                  onChange={e => setDraft(d => ({ ...d, threshold_percent: Number(e.target.value) || 0 }))}
                  className="w-16 h-7 text-xs text-center font-mono"
                  min={0}
                  max={50}
                  step={0.5}
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
          </div>

          {/* Refresh Rate */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Refresh Rate</Label>
            <Select
              value={String(draft.refresh_rate)}
              onValueChange={v => setDraft(d => ({ ...d, refresh_rate: Number(v) }))}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0.5">0.5s</SelectItem>
                <SelectItem value="1">1s</SelectItem>
                <SelectItem value="2">2s</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sound */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground flex items-center gap-2">
                {draft.sound_enabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                Sound
              </Label>
              <Switch
                checked={draft.sound_enabled}
                onCheckedChange={v => setDraft(d => ({ ...d, sound_enabled: v }))}
                className="scale-90"
              />
            </div>
            {draft.sound_enabled && (
              <Slider
                value={[draft.sound_volume]}
                onValueChange={([v]) => setDraft(d => ({ ...d, sound_volume: v }))}
                min={0}
                max={100}
                step={1}
                className="w-full"
              />
            )}
          </div>

          {/* Telegram */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-2">
              <Send className="h-3.5 w-3.5" />
              Telegram Bot Token
            </Label>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="Paste your bot token..."
                value={draft.telegram_token}
                onChange={e => setDraft(d => ({ ...d, telegram_token: e.target.value }))}
                className="h-8 text-xs flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 text-xs"
                disabled={!draft.telegram_token}
              >
                <TestTube className="h-3 w-3" />
                Test
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm" className="text-xs">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button size="sm" className="text-xs" onClick={handleSave}>Save</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
