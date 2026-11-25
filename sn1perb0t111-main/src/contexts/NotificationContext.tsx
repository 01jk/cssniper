import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import {
  INotification,
  NotificationType,
  NotificationSource,
  NotificationSettings,
  NotificationContextType,
  DEFAULT_NOTIFICATION_SETTINGS
} from "@/types/notifications";

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const STORAGE_KEY = "sniper-bot-notification-settings";
const SUBTYPE_STORAGE_KEY = "sniper-bot-notification-subtypes";
const RECEIVED_AT_STORAGE_KEY = "sniper-bot-notification-received-at";

const loadClientReceivedAtMap = (): Map<string, Date> => {
  try {
    const raw = localStorage.getItem(RECEIVED_AT_STORAGE_KEY);
    if (!raw) return new Map();

    const parsed = JSON.parse(raw) as Record<string, number>;
    const map = new Map<string, Date>();
    Object.entries(parsed).forEach(([id, epochMs]) => {
      if (typeof epochMs === "number" && Number.isFinite(epochMs)) {
        map.set(id, new Date(epochMs));
      }
    });
    return map;
  } catch {
    return new Map();
  }
};

const persistClientReceivedAtMap = (map: Map<string, Date>) => {
  try {
    const serialized: Record<string, number> = {};
    map.forEach((value, key) => {
      serialized[key] = value.getTime();
    });
    localStorage.setItem(RECEIVED_AT_STORAGE_KEY, JSON.stringify(serialized));
  } catch {
    // Ignore storage errors (quota/private mode)
  }
};

const getNotificationSubTypeId = (notification: Pick<INotification, "type" | "title" | "message" | "data">): string | null => {
  const text = `${notification.title} ${notification.message}`.toLowerCase();

  if (notification.type === "info") {
    if (/scanning started|start scanning|starting scanner|starting notification polling/.test(text)) return "scanning_started";
    if (/scanning stopped|stop scanning|stopping scanner|stopping notification polling/.test(text)) return "scanning_stopped";
    if (/config|configuration|settings updated/.test(text)) return "config_updated";
    if (/buy attempt|attempting to buy|trying to buy/.test(text)) return "buy_attempt";
    return null;
  }

  if (notification.type === "success") {
    if (/match found|target matched/.test(text)) return "match_found";
    if (/bot started|started successfully/.test(text)) return "bot_started";
    if (/settings saved|config saved/.test(text)) return "settings_saved";
    return null;
  }

  if (notification.type === "warning") {
    if (/rate limit|429/.test(text)) return "rate_limit";
    if (/skipped|item skipped/.test(text)) return "item_skipped";
    if (/price change/.test(text)) return "price_change";
    if (/update available|new version/.test(text)) return "update_available";
    return null;
  }

  if (notification.type === "error") {
    if (/purchase failed|failed to buy|buy failed/.test(text)) return "purchase_failed";
    if (/connection|network|timeout/.test(text)) return "connection_error";
    if (/401|403|unauthorized|forbidden|auth/.test(text)) return "auth_error";
    if (/insufficient balance|not enough funds/.test(text)) return "insufficient_balance";
    if (/database|db error|sqlite/.test(text)) return "database_error";
    return null;
  }

  if (notification.type === "autobuy") {
    if (/purchase successful|purchased|autobuy success/.test(text)) return "purchase_successful";
    if (/steamcommunity\.com\/trade|trade url/.test(text)) return "trade_url";
    if (notification.data && (notification.data.float !== undefined || notification.data.pattern !== undefined || notification.data.paint_seed !== undefined)) {
      return "item_details";
    }
    return null;
  }

  return null;
};

const isSubTypeEnabled = (notification: Pick<INotification, "type" | "title" | "message" | "data">): boolean => {
  try {
    const raw = localStorage.getItem(SUBTYPE_STORAGE_KEY);
    if (!raw) return true;

    const selected = JSON.parse(raw) as Record<string, boolean>;
    const subTypeId = getNotificationSubTypeId(notification);
    if (!subTypeId) return true;

    return selected[subTypeId] !== false;
  } catch {
    return true;
  }
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<INotification[]>([]);
  const [allNotifications, setAllNotifications] = useState<INotification[]>([]);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const initializedRef = useRef(false);
  const knownNotificationIdsRef = useRef<Set<string>>(new Set());
  const clientReceivedAtRef = useRef<Map<string, Date>>(loadClientReceivedAtMap());
  const isFetchingRef = useRef(false);

  const [settings, setSettings] = useState<NotificationSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.debug("Failed to load notification settings:", e);
    }
    return DEFAULT_NOTIFICATION_SETTINGS;
  });

  // Persist settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.debug("Failed to save notification settings:", e);
    }
  }, [settings]);

  // Keep unread counter in sync with local state for instant UI updates
  useEffect(() => {
    const localUnread = notifications.filter(n => !n.read).length;
    setUnreadCount(localUnread);
  }, [notifications]);

  // AudioContext для звуков уведомлений
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBuffersRef = useRef<Record<string, AudioBuffer>>({});
  const lastPlayedRef = useRef<number>(0);

  // Загрузка звуковых файлов
  useEffect(() => {
    const loadSounds = async () => {
      try {
        const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
        if (!Ctx) return;

        audioContextRef.current = new Ctx();

        // Загружаем звуки
        const soundFiles = {
          error: '/sounds/Error.mp3',
          autobuy: '/sounds/AutoBuy.mp3',
          notification: '/sounds/notification.mp3'
        };

        for (const [name, url] of Object.entries(soundFiles)) {
          try {
            const response = await fetch(url);
            if (!response.ok) continue;

            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioContextRef.current!.decodeAudioData(arrayBuffer);
            audioBuffersRef.current[name] = audioBuffer;
            console.log(`✅ Sound loaded: ${name}`);
          } catch (e) {
            console.debug(`Failed to load sound ${name}:`, e);
          }
        }
        console.log("🔊 Audio context initialized, sounds loaded:", Object.keys(audioBuffersRef.current));
      } catch (e) {
        console.debug("Failed to initialize audio:", e);
      }
    };

    loadSounds();

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Воспроизведение звука уведомления
  const playNotificationSound = useCallback((type: NotificationType, source?: string) => {
    console.log(`🔊 playNotificationSound called for type: ${type}, source: ${source}`);
    console.log(`Settings: enabled=${settings.enabled}, soundEnabled=${settings.soundEnabled}, volume=${settings.volume}`);

    if (!settings.enabled || !settings.soundEnabled) {
      console.log("❌ Sound disabled in settings");
      return;
    }

    // Определяем, какой звук воспроизводить
    let soundName: string | null = null;
    if (type === 'error' || type === 'warning') {
      soundName = 'error';
    } else if (type === 'autobuy' || source === 'buy_order' || source === 'buy_order_filled') {
      soundName = 'autobuy';
    } else {
      // Для info, success используем notification.mp3
      soundName = 'notification';
    }

    console.log(`Sound name: ${soundName}`);
    console.log(`Available buffers:`, Object.keys(audioBuffersRef.current));

    if (!soundName || !audioBuffersRef.current[soundName]) {
      console.log(`❌ Sound buffer not found: ${soundName}`);
      return;
    }

    // Throttle sound (max 1 sound per 1 second)
    const now = Date.now();
    if (now - lastPlayedRef.current < 1000) {
      console.log(`⏰ Sound throttled (last played ${now - lastPlayedRef.current}ms ago)`);
      return;
    }
    lastPlayedRef.current = now;

    try {
      const ctx = audioContextRef.current;
      if (!ctx || ctx.state === 'closed') {
        console.log("❌ Audio context closed");
        return;
      }

      // Resume context if suspended
      if (ctx.state === 'suspended') {
        console.log("Resuming audio context...");
        ctx.resume().catch(console.error);
      }

      const source = ctx.createBufferSource();
      const gainNode = ctx.createGain();

      source.buffer = audioBuffersRef.current[soundName];

      const volumeMultiplier = settings.volume / 100;
      console.log(`Volume: ${volumeMultiplier}`);
      gainNode.gain.setValueAtTime(volumeMultiplier, ctx.currentTime);

      source.connect(gainNode);
      gainNode.connect(ctx.destination);

      source.start(ctx.currentTime);
      console.log(`✅ Sound playing: ${soundName}`);
    } catch (e) {
      console.error("Failed to play notification sound:", e);
    }
  }, [settings.enabled, settings.soundEnabled, settings.volume]);

  // Проверка, должно ли уведомление быть показано
  const shouldShowNotification = useCallback((type: NotificationType, source: NotificationSource) => {
    if (!settings.enabled) return false;

    // Проверка типа уведомления
    switch (type) {
      case 'info':
        if (!settings.enableInfo) return false;
        break;
      case 'success':
        if (!settings.enableSuccess) return false;
        break;
      case 'warning':
        if (!settings.enableWarning) return false;
        break;
      case 'error':
        if (!settings.enableError) return false;
        break;
      case 'autobuy':
        if (!settings.enableAutoBuy) return false;
        break;
    }

    // Источники больше не проверяются (удалены из UI)
    // Все источники разрешены по умолчанию

    return true;
  }, [settings]);

  // Poll notifications from backend
  useEffect(() => {
    const fetchNotifications = async () => {
      if (isFetchingRef.current) {
        return;
      }

      isFetchingRef.current = true;

      try {
        const res = await fetch(`/api/notifications?limit=${settings.maxNotifications}&_ts=${Date.now()}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          console.error("Failed to fetch notifications - status:", res.status);
          return;
        }

        const data = await res.json();
        if (data && Array.isArray(data) && data.length > 0) {
          const sortedByServerTime = [...data].sort(
            (a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );

          // Преобразуем уведомления из API
          const apiNotifications: INotification[] = sortedByServerTime.map((item: any) => {
            const existingClientTime = clientReceivedAtRef.current.get(item.id);
            const clientTimestamp = existingClientTime ?? new Date();
            if (!existingClientTime) {
              clientReceivedAtRef.current.set(item.id, clientTimestamp);
            }

            return {
              id: item.id,
              type: item.type as NotificationType,
              source: item.source as NotificationSource,
              title: item.title,
              message: item.message,
              timestamp: clientTimestamp,
              read: item.read || false,
              data: item.data,
            };
          });

          // Сортируем по timestamp (новые первые)
          apiNotifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

          const rawAll = apiNotifications.slice(0, settings.maxNotifications);
          setAllNotifications(rawAll);

          const filteredByType = apiNotifications.filter((n) => shouldShowNotification(n.type, n.source));
          const filteredBySubType = filteredByType.filter((n) => isSubTypeEnabled(n));
          const limitedNotifications = filteredBySubType.slice(0, settings.maxNotifications);
            const unreadFromApi = limitedNotifications.filter(n => !n.read).length;

          // На первом запросе не триггерим звук, чтобы не проигрывать историю
          if (!initializedRef.current) {
            initializedRef.current = true;
            knownNotificationIdsRef.current = new Set(limitedNotifications.map(n => n.id));
            const activeIds = new Set(limitedNotifications.map(n => n.id));
            clientReceivedAtRef.current.forEach((_value, id) => {
              if (!activeIds.has(id)) {
                clientReceivedAtRef.current.delete(id);
              }
            });
            persistClientReceivedAtMap(clientReceivedAtRef.current);
            setNotifications(limitedNotifications);
            return;
          }

          // Определяем новые уведомления, которых ещё не видели
          const newNotifications = limitedNotifications.filter(
            n => !knownNotificationIdsRef.current.has(n.id) && !n.read
          );

          if (newNotifications.length > 0) {
            console.log(`📬 Received ${newNotifications.length} new notifications`);
            newNotifications.forEach(n => playNotificationSound(n.type as NotificationType, n.source));
          }

          knownNotificationIdsRef.current = new Set(limitedNotifications.map(n => n.id));
          const activeIds = new Set(limitedNotifications.map(n => n.id));
          clientReceivedAtRef.current.forEach((_value, id) => {
            if (!activeIds.has(id)) {
              clientReceivedAtRef.current.delete(id);
            }
          });
          persistClientReceivedAtMap(clientReceivedAtRef.current);
          setNotifications(limitedNotifications);
        } else if (data && Array.isArray(data)) {
          knownNotificationIdsRef.current = new Set();
          clientReceivedAtRef.current.clear();
          persistClientReceivedAtMap(clientReceivedAtRef.current);
          setNotifications([]);
          setAllNotifications([]);
        }
      } catch (error) {
        console.error("Failed to fetch notifications:", error);
      } finally {
        isFetchingRef.current = false;
      }
    };

    console.log("🔔 Starting notification polling...");

    // Initial fetch
    fetchNotifications();

    // Poll every 2 seconds for faster updates
    const interval = setInterval(fetchNotifications, 2000);

    return () => {
      console.log("⏹️ Stopping notification polling");
      clearInterval(interval);
    };
  }, [settings.maxNotifications, playNotificationSound, shouldShowNotification]);

  // Добавление уведомления
  const addNotification = useCallback((notification: Omit<INotification, 'id' | 'timestamp' | 'read'>) => {
    const { type, source } = notification;

    // Проверяем, должно ли уведомление быть показано
    if (!shouldShowNotification(type, source)) return;
    if (!isSubTypeEnabled(notification as Pick<INotification, "type" | "title" | "message" | "data">)) return;

    const newNotification: INotification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      read: false,
    };

    clientReceivedAtRef.current.set(newNotification.id, newNotification.timestamp);
    persistClientReceivedAtMap(clientReceivedAtRef.current);

    setNotifications(prev => {
      const updated = [newNotification, ...prev];
      // Ограничиваем количество уведомлений
      if (updated.length > settings.maxNotifications) {
        return updated.slice(0, settings.maxNotifications);
      }
      return updated;
    });

    // Воспроизводим звук
    playNotificationSound(type, source);

    // Показываем desktop уведомление если включено
    if (settings.desktopNotifications && 'Notification' in window) {
      if ((window as any).Notification.permission === 'granted') {
        new (window as any).Notification(notification.title, {
          body: notification.message,
          icon: '/favicon.ico',
          tag: newNotification.id,
        });
      } else if ((window as any).Notification.permission !== 'denied') {
        (window as any).Notification.requestPermission().then((permission: string) => {
          if (permission === 'granted') {
            new (window as any).Notification(notification.title, {
              body: notification.message,
              icon: '/favicon.ico',
              tag: newNotification.id,
            });
          }
        });
      }
    }

  }, [settings, shouldShowNotification, playNotificationSound]);

  // Пометить как прочитанное
  const markAsRead = useCallback(async (id: string) => {
    // Обновляем локально
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
    setAllNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );

    // Отправляем на бэкенд
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: "PUT",
      });
    } catch (error) {
      console.debug("Failed to mark notification as read on backend:", error);
    }
  }, []);

  // Пометить все как прочитанное
  const markAllAsRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setAllNotifications(prev => prev.map(n => ({ ...n, read: true })));

    try {
      await fetch(`/api/notifications/read-all`, {
        method: "PUT",
      });
    } catch (error) {
      console.debug("Failed to mark all notifications as read on backend:", error);
    }
  }, []);

  // Удалить уведомление
  const removeNotification = useCallback(async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    setAllNotifications(prev => prev.filter(n => n.id !== id));

    try {
      await fetch(`/api/notifications/${id}`, {
        method: "DELETE",
      });
    } catch (error) {
      console.debug("Failed to delete notification on backend:", error);
    }
  }, []);

  // Очистить все уведомления
  const clearAllNotifications = useCallback(async () => {
    setNotifications([]);
    setAllNotifications([]);
    knownNotificationIdsRef.current = new Set();

    try {
      await fetch(`/api/notifications`, {
        method: "DELETE",
      });
    } catch (error) {
      console.debug("Failed to clear notifications on backend:", error);
    }
  }, []);

  // Обновление настроек
  const updateSettings = useCallback((newSettings: Partial<NotificationSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  // Переключение панели
  const togglePanel = useCallback(() => {
    setIsPanelOpen(prev => !prev);
  }, []);

  // Закрытие панели
  const closePanel = useCallback(() => {
    setIsPanelOpen(false);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        allNotifications,
        unreadCount,
        settings,
        isPanelOpen,
        addNotification,
        markAsRead,
        markAllAsRead,
        removeNotification,
        clearAllNotifications,
        updateSettings,
        togglePanel,
        closePanel,
        playNotificationSound,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
};
