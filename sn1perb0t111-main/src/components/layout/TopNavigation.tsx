import { LayoutDashboard, Target, Database, History, Settings, Activity, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NotificationBell } from "@/components/notifications/NotificationBell";

interface NavItem {
  icon: React.ElementType;
  label: string;
  id: string;
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", id: "dashboard" },
  { icon: Target, label: "Target Manager", id: "targets" },
  { icon: Activity, label: "Live Scanner", id: "live-monitor" },
  { icon: Database, label: "Database", id: "database" },
  { icon: History, label: "History", id: "history" },
  { icon: Settings, label: "Settings", id: "settings" },
];

interface TopNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  visible?: boolean;
}

export const TopNavigation = ({ activeTab, onTabChange, visible = true }: TopNavigationProps) => {
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      console.error(e);
    }
    localStorage.removeItem("auth_token");
    window.location.href = "/login";
  };

  return (
    <nav className={`flex flex-col items-center h-full bg-card/50 border-r border-border/50 transition-all duration-300 ease-in-out ${visible ? 'w-16 py-4 opacity-100' : 'w-0 py-0 opacity-0 border-r-0 pointer-events-none'
      } overflow-hidden`}>
      <div className="flex flex-col items-center justify-between h-full w-16">
        {navItems.map((item) => (
          <Tooltip key={item.id} delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`w-12 h-12 transition-all duration-200 group ${activeTab === item.id
                    ? 'bg-primary/15 text-primary border border-primary/40 shadow-sm shadow-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60 hover:scale-105'
                  }`}
                onClick={() => onTabChange(item.id)}
              >
                <item.icon className={`h-7 w-7 transition-transform duration-200 ${activeTab !== item.id ? 'group-hover:scale-110' : ''
                  }`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">
              {item.label}
            </TooltipContent>
          </Tooltip>
        ))}

        {/* Notification Bell */}
        <NotificationBell />

        {/* Log Out */}
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="w-12 h-12 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 hover:scale-105 transition-all duration-200 group"
              onClick={handleLogout}
            >
              <LogOut className="h-7 w-7 group-hover:scale-110 transition-transform duration-200" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            Log Out
          </TooltipContent>
        </Tooltip>
      </div>
    </nav>
  );
};
