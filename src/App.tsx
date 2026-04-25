import React, { lazy, Suspense } from 'react';
import { OfferProvider } from './features/offer-generator/context/OfferContext';
import { OfferEditorPage } from '@/features/offer-generator/components/OfferEditorPage';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/contexts/AppContext";
import { useApp } from "@/contexts/useApp";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";
import MainLayout from "@/components/layout/MainLayout";
import { PageLoader } from "@/components/layout/PageLoader";

// Lazy Loading Components
const Index = lazy(() => import("@/features/kanban/pages/Index"));
const Login = lazy(() => import("@/features/auth/pages/Login"));
const Employee = lazy(() => import("@/features/kanban/pages/Employee"));
const ArchivedCards = lazy(() => import("@/features/kanban/pages/ArchivedCards"));
const CalendarPage = lazy(() => import("@/features/calendar/pages/CalendarPage"));
const ClientCalendar = lazy(() => import("@/features/calendar/pages/ClientCalendar"));
const Vault = lazy(() => import("@/features/vault/pages/Vault"));
const PostingBoard = lazy(() => import("@/features/kanban/pages/PostingBoard"));
const CorrectionBoard = lazy(() => import("@/features/kanban/pages/CorrectionBoard"));
const UsersAdmin = lazy(() => import("@/features/auth/pages/UsersAdmin"));
const WhatsAppInbox = lazy(() => import("@/features/automation/pages/WhatsAppInbox"));
const Products = lazy(() => import("@/features/products/pages/Products"));
const OfferStudio = lazy(() => import("@/features/offer-generator/pages/OfferStudio"));
const Report = lazy(() => import("@/features/reports/pages/Report"));
const IntelligenceCenter = lazy(() => import("@/features/intelligence/pages/IntelligenceCenter"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();


function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAuthLoading } = useApp();
  if (isAuthLoading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <MainLayout>{children}</MainLayout>;
}

function FullScreenProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAuthLoading } = useApp();
  if (isAuthLoading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAuthLoading } = useApp();
  if (isAuthLoading) return <PageLoader />;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const AppRoutes = () => (
  <Suspense fallback={<PageLoader />}>
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
      <Route path="/gerador-artes" element={<ProtectedRoute><OfferStudio /></ProtectedRoute>} />
      <Route path="/relatorio" element={<ProtectedRoute><Report /></ProtectedRoute>} />
      <Route path="/admin/inteligencia" element={<ProtectedRoute><IntelligenceCenter /></ProtectedRoute>} />
      <Route path="/offer-editor" element={<FullScreenProtectedRoute><OfferEditorPage /></FullScreenProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </Suspense>
);



const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppProvider>
          <ErrorBoundary>
            <OfferProvider>
              <AppRoutes />
            </OfferProvider>
          </ErrorBoundary>
        </AppProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
