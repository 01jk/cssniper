// Типы уведомлений
export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'autobuy';

export type NotificationSource = 'scanner' | 'autobuy' | 'market_data' | 'system' | 'error' | 'buy_order' | 'buy_order_filled';

export interface INotification {
  id: string;
  type: NotificationType;
  source: NotificationSource;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  data?: Record<string, any>;
}

export interface NotificationSettings {
  // Общие настройки
  enabled: boolean;
  desktopNotifications: boolean;
  soundEnabled: boolean;
  volume: number; // 0-100
  
  // Настройки для типов уведомлений
  enableInfo: boolean;
  enableSuccess: boolean;
  enableWarning: boolean;
  enableError: boolean;
  enableAutoBuy: boolean;
  
  // Настройки для источников
  enableScanner: boolean;
  enableAutoBuySource: boolean;
  enableMarketData: boolean;
  enableSystem: boolean;
  enableErrorSource: boolean;
  
  // Настройки отображения
  showToasts: boolean;
  toastPosition: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  toastDuration: number; // секунды
  maxVisibleToasts: number;
  
  // Настройки менеджера
  maxNotifications: number;
  autoMarkAsRead: boolean;
  autoMarkAsReadDelay: number; // секунды
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  desktopNotifications: false,
  soundEnabled: true,
  volume: 50,
  
  enableInfo: true,
  enableSuccess: true,
  enableWarning: true,
  enableError: true,
  enableAutoBuy: true,
  
  enableScanner: true,
  enableAutoBuySource: true,
  enableMarketData: true,
  enableSystem: true,
  enableErrorSource: true,
  
  showToasts: true,
  toastPosition: 'top-right',
  toastDuration: 5,
  maxVisibleToasts: 3,
  
  maxNotifications: 100,
  autoMarkAsRead: false,
  autoMarkAsReadDelay: 5,
};

export interface NotificationContextType {
  // Состояние
  notifications: INotification[];
  allNotifications: INotification[];
  unreadCount: number;
  settings: NotificationSettings;
  isPanelOpen: boolean;
  
  // Действия с уведомлениями
  addNotification: (notification: Omit<INotification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAllNotifications: () => void;
  
  // Действия с настройками
  updateSettings: (settings: Partial<NotificationSettings>) => void;
  togglePanel: () => void;
  closePanel: () => void;
  
  // Утилиты
  playNotificationSound: (type: NotificationType) => void;
}
