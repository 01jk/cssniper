import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SoundSettingsProvider } from "@/contexts/SoundSettingsContext";
import { WeaponContextProvider } from "@/contexts/WeaponContextProvider";
import { EditModeProvider } from "@/components/targets/EditModeContext";
import { BotStatusProvider } from "@/contexts/BotStatusContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { NotificationPanel } from "@/components/notifications/NotificationPanel";
import { ToastNotificationContainer } from "@/components/notifications/ToastNotification";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";

// All authenticated context providers are mounted here — only when the user is logged in.
// This prevents NotificationContext / BotStatusContext from polling unauthenticated
// requests that would wipe the token right after login.
const AuthenticatedApp = () => (
  <NotificationProvider>
    <SoundSettingsProvider>
      <BotStatusProvider>
        <WeaponContextProvider>
          <EditModeProvider>
            <Index />
            <NotificationPanel />
            <ToastNotificationContainer />
          </EditModeProvider>
        </WeaponContextProvider>
      </BotStatusProvider>
    </SoundSettingsProvider>
  </NotificationProvider>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem("auth_token");
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const LoginRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem("auth_token");
  if (token) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider delayDuration={0}>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route
            path="/login"
            element={
              <LoginRoute>
                <Login />
              </LoginRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AuthenticatedApp />
              </ProtectedRoute>
            }
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
