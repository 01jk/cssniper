/**
 * Утилита для интеграции системы уведомлений с логами программы
 * 
 * Использование в Python боте:
 * 1. Отправляйте POST запросы на /api/notifications
 * 2. Формат данных: { type, source, title, message, data? }
 * 
 * Примеры типов уведомлений:
 * - info: информационные сообщения
 * - success: успешные действия
 * - warning: предупреждения
 * - error: ошибки
 * - autobuy: уведомления о покупках
 * 
 * Примеры источников:
 * - scanner: сканер
 * - autobuy: автопокупка
 * - market_data: данные рынка
 * - system: системные уведомления
 * - error: ошибки
 */

// Этот файл служит документацией для интеграции
// Реальная интеграция происходит через API эндпоинты

export interface NotificationInput {
  type: 'info' | 'success' | 'warning' | 'error' | 'autobuy';
  source: 'scanner' | 'autobuy' | 'market_data' | 'system' | 'error';
  title: string;
  message: string;
  data?: Record<string, any>;
}

/**
 * Пример отправки уведомления из Python:
 * 
 * import requests
 * 
 * def send_notification(notification_type, source, title, message, data=None):
 *     payload = {
 *         "type": notification_type,
 *         "source": source,
 *         "title": title,
 *         "message": message,
 *         "data": data or {}
 *     }
 *     try:
 *         response = requests.post("http://localhost:5173/api/notifications", json=payload)
 *         return response.status_code == 200
 *     except Exception as e:
 *         print(f"Failed to send notification: {e}")
 *         return False
 * 
 * # Примеры использования:
 * 
 * # Уведомление о находке
 * send_notification(
 *     "success",
 *     "scanner",
 *     "Найдено совпадение!",
 *     "AK-47 | Case Hardened (Float: 0.0021)",
 *     {"item_id": "12345", "price": 1245, "float": 0.0021}
 * )
 * 
 * # Уведомление об ошибке
 * send_notification(
 *     "error",
 *     "scanner",
 *     "Ошибка подключения",
 *     "Не удалось подключиться к CSFloat API",
 *     {"error_code": 500}
 * )
 * 
 * # Уведомление о покупке
 * send_notification(
 *     "autobuy",
 *     "autobuy",
 *     "Успешная покупка!",
 *     "Karambit | Fade куплен за $1890",
 *     {"item_id": "67890", "price": 1890, "profit": 150}
 * )
 */

export const NOTIFICATION_EXAMPLES = {
  python: `
import requests

def send_notification(notification_type, source, title, message, data=None):
    """Отправляет уведомление в систему уведомлений веб-интерфейса"""
    payload = {
        "type": notification_type,
        "source": source,
        "title": title,
        "message": message,
        "data": data or {}
    }
    try:
        response = requests.post("http://localhost:5173/api/notifications", json=payload)
        return response.status_code == 200
    except Exception as e:
        print(f"Failed to send notification: {e}")
        return False


# Интеграция с логгером
import logging

class NotificationHandler(logging.Handler):
    """Обработчик логов для отправки уведомлений"""
    
    def __init__(self, notification_url="http://localhost:5173/api/notifications"):
        super().__init__()
        self.notification_url = notification_url
    
    def emit(self, record):
        log_entry = self.format(record)
        
        # Определяем тип уведомления на основе уровня лога
        if record.levelno >= logging.ERROR:
            notif_type = "error"
        elif record.levelno >= logging.WARNING:
            notif_type = "warning"
        elif record.levelno >= logging.INFO:
            notif_type = "info"
        else:
            return  # Не отправляем DEBUG уведомления
        
        send_notification(
            notification_type=notif_type,
            source="system",
            title=f"Log: {record.levelname}",
            message=log_entry
        )


# Настройка логгера
logger = logging.getLogger("bot")
logger.setLevel(logging.INFO)

# Добавляем обработчик уведомлений
notification_handler = NotificationHandler()
logger.addHandler(notification_handler)
`,

  javascript: `
// Пример отправки уведомления из JavaScript/TypeScript
async function sendNotification(type, source, title, message, data = {}) {
  try {
    const response = await fetch('/api/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type,
        source,
        title,
        message,
        data,
      }),
    });
    return response.ok;
  } catch (error) {
    console.error('Failed to send notification:', error);
    return false;
  }
}

// Пример использования
sendNotification(
  'success',
  'scanner',
  'Найдено совпадение!',
  'AK-47 | Case Hardened (Float: 0.0021)',
  { item_id: '12345', price: 1245, float: 0.0021 }
);
`
};
