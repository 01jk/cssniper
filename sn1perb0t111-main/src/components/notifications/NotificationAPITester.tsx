import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

export const NotificationAPITester = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState("success");
  const [source, setSource] = useState("scanner");
  const [title, setTitle] = useState("Test Notification");
  const [message, setMessage] = useState("This is a test notification from API Tester");

  const handleSend = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          source,
          title,
          message,
          data: {
            tested_at: new Date().toISOString(),
            tester: "NotificationAPITester",
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      toast({
        title: "Notification Sent!",
        description: `ID: ${data.id}`,
      });

      // Очистка формы
      setTitle("Test Notification");
      setMessage("This is a test notification from API Tester");
      
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleQuickTest = async (testType: string) => {
    const tests: Record<string, any> = {
      match: {
        type: "success",
        source: "scanner",
        title: "🎯 Match Found!",
        message: "AK-47 | Case Hardened (Float: 0.0021) - $1,245",
        data: { item_id: "12345", price: 1245, float: 0.0021, pattern: 661 },
      },
      purchase: {
        type: "autobuy",
        source: "autobuy",
        title: "✅ Purchase Successful!",
        message: "Karambit | Fade bought for $1,890",
        data: { item_id: "67890", price: 1890, profit: 350, float: 0.0089 },
      },
      error: {
        type: "error",
        source: "error",
        title: "❌ Purchase Failed",
        message: "Failed to buy 12345: Insufficient balance",
        data: { item_id: "12345", error_code: 400 },
      },
      warning: {
        type: "warning",
        source: "scanner",
        title: "⚠️ Rate Limit Reached",
        message: "Waiting 5 seconds before retry",
        data: { retry_after: 5 },
      },
      auth403: {
        type: "error",
        source: "scanner",
        title: "🚫 Error 403 - Forbidden",
        message: "Proxy #2 scanner account failed authorization (403). Replace API key for Account #2",
        data: {
          status_code: 403,
          account_type: "scanner",
          account_index: 1,
          proxy_index: 2,
          tested_at: new Date().toISOString(),
        },
      },
    };

    const test = tests[testType];
    if (!test) return;

    setLoading(true);
    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(test),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      toast({
        title: `${testType} notification sent!`,
        description: `Check the notification bell. ID: ${data.id}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Notification API Tester</CardTitle>
        <CardDescription>
          Send test notifications to verify the system is working
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Quick Tests */}
        <div className="space-y-2">
          <Label>Quick Tests</Label>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickTest("match")}
              disabled={loading}
              className="bg-green-500/10 text-green-500 border-green-500/30 hover:bg-green-500/20"
            >
              🎯 Match Found
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickTest("purchase")}
              disabled={loading}
              className="bg-accent/10 text-accent border-accent/30 hover:bg-accent/20"
            >
              ✅ Purchase
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickTest("error")}
              disabled={loading}
              className="bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500/20"
            >
              ❌ Error
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickTest("warning")}
              disabled={loading}
              className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30 hover:bg-yellow-500/20"
            >
              ⚠️ Warning
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickTest("auth403")}
              disabled={loading}
              className="bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500/20"
            >
              🚫 403 Auth Error
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Click a button to send a test notification. For 403 test, open the notification and click Open Account Settings.
          </p>
        </div>

        {/* Custom Test */}
        <div className="space-y-4">
          <Label>Custom Notification</Label>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
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
              <Label>Source</Label>
              <Select value={source} onValueChange={setSource}>
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
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Notification title"
            />
          </div>

          <div className="space-y-2">
            <Label>Message</Label>
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Notification message"
            />
          </div>

          <Button onClick={handleSend} disabled={loading} className="w-full">
            {loading ? "Sending..." : "Send Notification"}
          </Button>
        </div>

        {/* Instructions */}
        <div className="p-4 bg-muted/50 rounded-lg text-sm">
          <h4 className="font-semibold mb-2">How to test:</h4>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>Click a Quick Test button or fill in custom notification</li>
            <li>Wait for confirmation toast</li>
            <li>Wait up to 5 seconds for polling</li>
            <li>Check the notification bell (top-right)</li>
            <li>Click the bell to see the notification</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
};
