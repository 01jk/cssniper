import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNotifications } from "@/contexts/NotificationContext";
import { Bell, Send, TestTube } from "lucide-react";

/**
 * Тестовый компонент для демонстрации системы уведомлений
 * 
 * Использование:
 * 1. Откройте вкладку Dashboard
 * 2. Добавьте этот компонент для тестирования уведомлений
 * 3. Отправляйте тестовые уведомления разных типов
 */

export const NotificationTester = () => {
  const { addNotification } = useNotifications();
  const [title, setTitle] = useState("Тестовое уведомление");
  const [message, setMessage] = useState("Это тестовое уведомление из NotificationTester");
  const [type, setType] = useState<"info" | "success" | "warning" | "error" | "autobuy">("info");
  const [source, setSource] = useState<"scanner" | "autobuy" | "market_data" | "system" | "error">("system");

  const handleSend = () => {
    addNotification({
      type,
      source,
      title,
      message,
      data: {
        test: true,
        timestamp: new Date().toISOString(),
      },
    });
  };

  const handleTestScenarios = () => {
    // Сценарий 1: Находка предмета
    addNotification({
      type: "success",
      source: "scanner",
      title: "Найдено совпадение!",
      message: "AK-47 | Case Hardened (Float: 0.0021) - $1,245",
      data: {
        item_id: "12345",
        price: 1245,
        float: 0.0021,
        pattern: "#661",
      },
    });

    // Сценарий 2: Успешная покупка
    setTimeout(() => {
      addNotification({
        type: "autobuy",
        source: "autobuy",
        title: "Успешная покупка!",
        message: "Karambit | Fade куплен за $1,890",
        data: {
          item_id: "67890",
          price: 1890,
          profit: 150,
          float: 0.0089,
        },
      });
    }, 500);

    // Сценарий 3: Ошибка
    setTimeout(() => {
      addNotification({
        type: "error",
        source: "scanner",
        title: "Ошибка подключения",
        message: "Не удалось подключиться к CSFloat API (Timeout)",
        data: {
          error_code: 504,
          retry_after: 5,
        },
      });
    }, 1000);

    // Сценарий 4: Предупреждение
    setTimeout(() => {
      addNotification({
        type: "warning",
        source: "market_data",
        title: "Предупреждение о цене",
        message: "Цена на M4A4 | Howl значительно выше рыночной",
        data: {
          market_price: 3200,
          listing_price: 4500,
          difference: "+40.6%",
        },
      });
    }, 1500);
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <CardTitle>Тест уведомлений</CardTitle>
        </div>
        <CardDescription>
          Отправьте тестовое уведомление для проверки системы
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Тип уведомления</Label>
            <Select value={type} onValueChange={(val: any) => setType(val)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="autobuy">AutoBuy</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Источник</Label>
            <Select value={source} onValueChange={(val: any) => setSource(val)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scanner">Scanner</SelectItem>
                <SelectItem value="autobuy">AutoBuy</SelectItem>
                <SelectItem value="market_data">Market Data</SelectItem>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Заголовок</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Введите заголовок"
          />
        </div>

        <div className="space-y-2">
          <Label>Сообщение</Label>
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Введите сообщение"
          />
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSend} className="gap-2">
            <Send className="h-4 w-4" />
            Отправить
          </Button>

          <Button onClick={handleTestScenarios} variant="outline" className="gap-2">
            <TestTube className="h-4 w-4" />
            Тестовые сценарии
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">
          <p>Тестовые сценарии отправляют 4 уведомления:</p>
          <ul className="list-disc list-inside ml-2 mt-1 space-y-0.5">
            <li>Находка предмета (Success)</li>
            <li>Успешная покупка (AutoBuy)</li>
            <li>Ошибка подключения (Error)</li>
            <li>Предупреждение о цене (Warning)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
