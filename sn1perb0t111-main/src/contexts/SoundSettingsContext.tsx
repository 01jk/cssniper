import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

interface SoundSettings {
  enabled: boolean;
  volume: number; // 0-100
}

interface SoundSettingsContextType {
  settings: SoundSettings;
  setEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
  playSound: () => void;
}

const defaultSettings: SoundSettings = {
  enabled: true,
  volume: 50,
};

const STORAGE_KEY = "sniper-bot-sound-settings";

const SoundSettingsContext = createContext<SoundSettingsContextType | undefined>(undefined);

export const SoundSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SoundSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.debug("Failed to load sound settings:", e);
    }
    return defaultSettings;
  });

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.debug("Failed to save sound settings:", e);
    }
  }, [settings]);

  const setEnabled = useCallback((enabled: boolean) => {
    setSettings(prev => ({ ...prev, enabled }));
  }, []);

  const setVolume = useCallback((volume: number) => {
    setSettings(prev => ({ ...prev, volume: Math.max(0, Math.min(100, volume)) }));
  }, []);

  // Persistent AudioContext
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const lastPlayedRef = React.useRef<number>(0);

  // Initialize AudioContext lazily
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      try {
        const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
        if (Ctx) {
          audioContextRef.current = new Ctx();
        }
      } catch (e) {
        console.error("Failed to create AudioContext", e);
      }
    }
    return audioContextRef.current;
  }, []);

  // Play a test sound
  const playSound = useCallback(() => {
    if (!settings.enabled || settings.volume === 0) return;

    // Throttle sound (max 1 sound per 150ms)
    const now = Date.now();
    if (now - lastPlayedRef.current < 150) return;
    lastPlayedRef.current = now;

    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      // Resume context if suspended (browser autoplay policy)
      if (ctx.state === 'suspended') {
        ctx.resume().catch(e => console.debug("Failed to resume audio context:", e));
      }

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      const volumeMultiplier = settings.volume / 100;

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(800, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.03);

      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.5 * volumeMultiplier, ctx.currentTime + 0.005);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.08);

      // Clean up nodes after they are done to prevent memory leaks
      setTimeout(() => {
        oscillator.disconnect();
        gainNode.disconnect();
      }, 100);

    } catch (error) {
      console.debug("Audio error:", error);
    }
  }, [settings.enabled, settings.volume, getAudioContext]);

  return (
    <SoundSettingsContext.Provider value={{ settings, setEnabled, setVolume, playSound }}>
      {children}
    </SoundSettingsContext.Provider>
  );
};

export const useSoundSettings = () => {
  const context = useContext(SoundSettingsContext);
  if (!context) {
    throw new Error("useSoundSettings must be used within SoundSettingsProvider");
  }
  return context;
};

// Export getter for non-React contexts (like the slider sound)
export const getSoundSettings = (): SoundSettings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    // ignore
  }
  return defaultSettings;
};
