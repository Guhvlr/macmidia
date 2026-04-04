import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/contexts/AppContext";
import { useApp } from "@/contexts/useApp";
import AppSidebar from "@/components/AppSidebar";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Employee from "./pages/Employee";
import ArchivedCards from "./pages/ArchivedCards";
import CalendarPage from "./pages/CalendarPage";
import ClientCalendar from "./pages/ClientCalendar";
import Vault from "./pages/Vault";
import PostingBoard from "./pages/PostingBoard";
import CorrectionBoard from "./pages/CorrectionBoard";
import UsersAdmin from "./pages/UsersAdmin";
import WhatsAppInbox from "./pages/WhatsAppInbox";
import Products from "./pages/Products";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAuthLoading } = useApp();
  if (isAuthLoading) return <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"/></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <AppSidebar>{children}</AppSidebar>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAuthLoading } = useApp();
  if (isAuthLoading) return <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"/></div>;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return children;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<AuthRoute><Login /></AuthRoute>} />
    <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
    <Route path="/funcionario/:id" element={<ProtectedRoute><Employee /></ProtectedRoute>} />
    <Route path="/funcionario/:id/arquivados" element={<ProtectedRoute><ArchivedCards /></ProtectedRoute>} />
    <Route path="/arquivados" element={<ProtectedRoute><ArchivedCards /></ProtectedRoute>} />
    <Route path="/calendario" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
    <Route path="/calendario/:clientId" element={<ProtectedRoute><ClientCalendar /></ProtectedRoute>} />
    <Route path="/cofre" element={<ProtectedRoute><Vault /></ProtectedRoute>} />
    <Route path="/postagem" element={<ProtectedRoute><PostingBoard /></ProtectedRoute>} />
    <Route path="/correcao" element={<ProtectedRoute><CorrectionBoard /></ProtectedRoute>} />
    <Route path="/usuarios" element={<ProtectedRoute><UsersAdmin /></ProtectedRoute>} />
    <Route path="/whatsapp" element={<ProtectedRoute><WhatsAppInbox /></ProtectedRoute>} />
    <Route path="/produtos" element={<ProtectedRoute><Products /></ProtectedRoute>} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppProvider>
          <AppRoutes />
        </AppProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
