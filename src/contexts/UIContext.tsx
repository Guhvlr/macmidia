import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UIContextType {
  loading: boolean;
  dashboardBanner?: string;
  dashboardLogo?: string;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setDashboardBanner: (url: string) => Promise<void>;
  setDashboardLogo: (url: string) => Promise<void>;
  updateSettings: (key: string, value: string) => Promise<void>;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [dashboardBanner, setDashboardBannerState] = useState<string | undefined>();
  const [dashboardLogo, setDashboardLogoState] = useState<string | undefined>();

  const fetchSettings = useCallback(async () => {
    try {
      const { data } = await supabase.from('settings').select('*');
      if (data) {
        const banner = data.find((s: any) => s.key === 'dashboardBanner');
        const logo = data.find((s: any) => s.key === 'dashboardLogo');
        if (banner) setDashboardBannerState(banner.value || undefined);
        if (logo) setDashboardLogoState(logo.value || undefined);
      }
    } catch (err) {
      console.error('Erro ao carregar banners:', err);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    const channel = supabase.channel('realtime-settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, fetchSettings)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchSettings]);

  const updateSettings = useCallback(async (key: string, value: string) => {
    try {
      const { error } = await supabase.from('settings').upsert({ key, value });
      if (error) throw error;
    } catch (err: any) {
      toast.error('Erro ao atualizar configurações.');
    }
  }, []);

  const setDashboardBanner = useCallback(async (url: string) => {
    setDashboardBannerState(url);
    await updateSettings('dashboardBanner', url);
  }, [updateSettings]);

  const setDashboardLogo = useCallback(async (url: string) => {
    setDashboardLogoState(url);
    await updateSettings('dashboardLogo', url);
  }, [updateSettings]);

  const value = useMemo(() => ({
    loading,
    dashboardBanner,
    dashboardLogo,
    setLoading,
    setDashboardBanner,
    setDashboardLogo,
    updateSettings
  }), [loading, dashboardBanner, dashboardLogo, setDashboardBanner, setDashboardLogo, updateSettings]);

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI() {
  const context = useContext(UIContext);
  if (context === undefined) throw new Error('useUI must be used within a UIProvider');
  return context;
}
