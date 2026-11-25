import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNotifications } from "@/contexts/NotificationContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export const NotificationBell = () => {
  const { unreadCount, togglePanel, notifications } = useNotifications();

  const hasUnread = unreadCount > 0;
  const hasNotifications = notifications.length > 0;

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <Button
          id="notification-bell-btn"
          variant="ghost"
          size="icon"
          className="relative w-12 h-12 transition-all duration-200 group text-muted-foreground hover:text-foreground hover:bg-secondary/60 hover:scale-105"
          onClick={togglePanel}
        >
          <Bell className="h-[23px] w-[23px] transition-transform duration-200 group-hover:scale-110" />

          {/* Badge with unread count */}
          {hasUnread && (
            <Badge
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1 flex items-center justify-center bg-red-500 text-white text-xs font-bold border-0 animate-in zoom-in"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}

          {/* Indicator for new notifications (if no unread but has notifications) */}
          {!hasUnread && hasNotifications && (
            <span className="absolute top-2 right-2 w-2 h-2 bg-muted-foreground/50 rounded-full" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right" className="font-medium">
        {hasUnread ? `${unreadCount} new notification${unreadCount > 1 ? 's' : ''}` : 'Notifications'}
      </TooltipContent>
    </Tooltip>
  );
};
