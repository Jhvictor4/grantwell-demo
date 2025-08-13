import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { Navigate } from "react-router-dom";
import Navbar from "./components/layout/Navbar";
import { MobileNavbar } from "./components/layout/MobileNavbar";
import { useMobileDetection } from "./hooks/use-mobile-detection";
import { useOnboarding } from "./hooks/use-onboarding";
import { OnboardingModal } from "./components/onboarding/OnboardingModal";
import Dashboard from "./pages/Dashboard";
import CalendarPage from "./pages/CalendarPage";

import GrantWorkspacePage from "./pages/GrantWorkspacePage";
import GrantsPage from "./pages/GrantsPage";
import TasksPage from "./pages/TasksPage";
import SettingsPage from "./pages/SettingsPage";
import CopilotPage from "./pages/CopilotPage";
import BudgetFinancePage from "./pages/BudgetFinancePage";
import ReportsPage from "./pages/ReportsPage";
import AdminDashboard from "./pages/AdminDashboard";
import { IntegrationsEnhanced } from "./components/IntegrationsEnhanced";

import NotFound from "./pages/NotFound";
import AuthPage from "./pages/AuthPage";
import ErrorBoundary from "./components/ErrorBoundary";
import { SessionTimeoutModal } from "./components/SessionTimeoutModal";
import { useState, useEffect } from "react";

import { sessionManager } from "./lib/session-manager";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const { isMobile } = useMobileDetection();
  const { 
    needsOnboarding, 
    loading: onboardingLoading, 
    completeOnboarding,
    skipOnboarding 
  } = useOnboarding();
  const { toast } = useToast();
  const [timeoutOpen, setTimeoutOpen] = useState(false);
  const [minutesLeft, setMinutesLeft] = useState(2);

  useEffect(() => {
    sessionManager.setOnSessionWarning((mins) => {
      setMinutesLeft(mins);
      setTimeoutOpen(true);
    });
    sessionManager.setOnSessionExpired(() => {
      toast({ title: 'Session Expired', description: 'Your session has expired for security reasons. Please sign in again.' });
    });
  }, []);
  
  if (loading || onboardingLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return (
    <div className="min-h-screen bg-slate-50">
      {isMobile ? <MobileNavbar /> : <Navbar />}
      <div className={`${isMobile ? 'pt-0' : ''}`}>
        {children}
      </div>
      
      {/* Onboarding Modal */}
      <OnboardingModal
        isOpen={needsOnboarding}
        onClose={skipOnboarding}
        onComplete={completeOnboarding}
      />

      {/* Session Timeout Modal */}
      <SessionTimeoutModal
        isOpen={timeoutOpen}
        minutesLeft={minutesLeft}
        onExtendSession={async () => {
          const ok = await sessionManager.refreshSession();
          if (ok) {
            setTimeoutOpen(false);
            toast({ title: 'Session Extended', description: 'Your session has been extended.' });
          } else {
            toast({ title: 'Unable to extend', description: 'Please sign in again.', variant: 'destructive' });
          }
        }}
        onSignOut={async () => {
          await supabase.auth.signOut();
          setTimeoutOpen(false);
        }}
      />
    </div>
  );
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/calendar" element={
              <ProtectedRoute>
                <CalendarPage />
              </ProtectedRoute>
            } />
            <Route path="/grants" element={
              <ProtectedRoute>
                <GrantsPage />
              </ProtectedRoute>
            } />
            <Route path="/grants/:grantId" element={
              <ProtectedRoute>
                <GrantWorkspacePage />
              </ProtectedRoute>
            } />
            <Route path="/grants/:grantId/:tab" element={
              <ProtectedRoute>
                <GrantWorkspacePage />
              </ProtectedRoute>
            } />
            <Route path="/grants/:grantId/attachments" element={<Navigate to="../documents" replace />} />
            <Route path="/grants/:grantId/users" element={<Navigate to="../team" replace />} />
            <Route path="/tasks" element={
              <ProtectedRoute>
                <TasksPage />
              </ProtectedRoute>
            } />
            <Route path="/copilot" element={
              <ProtectedRoute>
                <CopilotPage />
              </ProtectedRoute>
            } />
            <Route path="/reports" element={
              <ProtectedRoute>
                <ReportsPage />
              </ProtectedRoute>
            } />
            <Route path="/budget" element={<Navigate to="/budget-finance" replace />} />
            <Route path="/budget-finance" element={
              <ProtectedRoute>
                <BudgetFinancePage />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            } />
            <Route path="/integrations" element={
              <ProtectedRoute>
                <IntegrationsEnhanced />
              </ProtectedRoute>
            } />
            <Route path="/admin" element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            } />
            <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
