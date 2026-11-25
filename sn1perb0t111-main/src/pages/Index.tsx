import { useState, useEffect } from "react";
import { TargetConfigManager } from "@/components/targets/TargetConfigManager";
import { TopNavigation } from "@/components/layout/TopNavigation";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { LiveMonitor } from "@/components/live-monitor/LiveMonitor";
import { Settings } from "@/components/settings/Settings";
import { History } from "@/components/history/History";
import { LiveStatusBar } from "@/components/layout/LiveStatusBar";
import { Database } from "lucide-react";

const Index = () => {
  // Get initial tab from URL hash, default to "dashboard" if not specified
  const getInitialTab = () => {
    const hash = window.location.hash.slice(1); // Remove the '#'
    const validTabs = ["dashboard", "live-monitor", "targets", "database", "history", "settings"];
    return validTabs.includes(hash) ? hash : "dashboard";
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [sidebarVisible, setSidebarVisible] = useState(true);

  // Update URL hash when tab changes
  useEffect(() => {
    window.location.hash = activeTab;
  }, [activeTab]);

  // Listen for hash changes (back/forward navigation)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      const validTabs = ["dashboard", "live-monitor", "targets", "database", "history", "settings"];
      if (validTabs.includes(hash)) {
        setActiveTab(hash);
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  return (
    <div className="flex h-screen w-full bg-background">
      {/* Floating live HUD — hidden on live-monitor (has its own MonitorStatusBar) and dashboard (has its own KPIs) */}
      {activeTab !== "live-monitor" && activeTab !== "dashboard" && <LiveStatusBar />}

      {/* Vertical Navigation Sidebar — hidden in scanner mode */}
      <TopNavigation activeTab={activeTab} onTabChange={setActiveTab} visible={sidebarVisible} />

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {activeTab === "dashboard" && <Dashboard />}
        {activeTab === "live-monitor" && (
          <LiveMonitor
            sidebarVisible={sidebarVisible}
            onToggleSidebar={() => setSidebarVisible(prev => !prev)}
          />
        )}
        {activeTab === "targets" && <TargetConfigManager />}
        {activeTab === "database" && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground">
              <Database className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <h2 className="text-2xl font-bold mb-2">Database</h2>
              <p>Database content coming soon...</p>
            </div>
          </div>
        )}
        {activeTab === "history" && <History />}
        {activeTab === "settings" && <Settings />}
      </main>
    </div>
  );
};

export default Index;

