import React, { useEffect } from 'react';
import { useApp } from '@/contexts/useApp';
import { useIntelligence } from '@/features/intelligence/context/IntelligenceContext';
import { useOfferStore } from '../store/useOfferStore';

// Re-export all types so existing imports don't break
export * from '../store/useOfferStore';

const OfferContext = React.createContext<OfferState | null>(null);

export const OfferProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useApp();
  const { trackEvent } = useIntelligence();
  
  const setIsAuthenticated = useOfferStore(s => s.setIsAuthenticated);
  const setTrackEvent = useOfferStore(s => s.setTrackEvent);
  const fetchClients = useOfferStore(s => s.fetchClients);
  const fetchPresets = useOfferStore(s => s.fetchPresets);
  const fetchFonts = useOfferStore(s => s.fetchFonts);
  const fetchTemplates = useOfferStore(s => s.fetchTemplates);

  useEffect(() => {
    setIsAuthenticated(isAuthenticated);
    if (isAuthenticated) fetchClients();
  }, [isAuthenticated, setIsAuthenticated, fetchClients]);

  useEffect(() => {
    // Pass the function directly, not a wrapper that returns it
    setTrackEvent(trackEvent);
  }, [trackEvent, setTrackEvent]);

  useEffect(() => {
    fetchPresets();
    fetchFonts();
    fetchTemplates();
  }, [fetchPresets, fetchFonts, fetchTemplates]);

  // Push initial history on mount
  useEffect(() => {
    try {
      useOfferStore.getState().pushHistory();
    } catch (e) {
      console.warn('Initial history push failed:', e);
    }
  }, []);

  // Handle cross-tab loading for OfferEditorPage
  useEffect(() => {
    const isEditorTab = window.location.pathname.includes('/offer-editor');
    if (isEditorTab) {
      try {
        let data: any = null;
        if (window.opener && (window.opener as any).__MACMIDIA_EDITOR_DATA__) {
          data = (window.opener as any).__MACMIDIA_EDITOR_DATA__;
        } else {
          const stored = localStorage.getItem('macmidia_offer_editor_data');
          if (stored) data = JSON.parse(stored);
        }

        if (data) {
          const s = useOfferStore.getState();
          if (data.config) s.setConfig(data.config);
          if (data.slots) s.setSlots(data.slots);
          if (data.products) s.setProducts(data.products);
          if (data.customFonts) s.setCustomFonts(data.customFonts);
          if (data.pageCount) s.setPageCount(data.pageCount);
          if (data.slotSettings) s.setSlotSettings(data.slotSettings);
          if (data.customCanvasElements) s.setCustomCanvasElements(data.customCanvasElements);
          
          setTimeout(() => {
            useOfferStore.setState({ history: [], historyIndex: -1 });
            useOfferStore.getState().pushHistory();
          }, 100);
        }
      } catch (e) {
        console.error('Failed to load state in new tab:', e);
      }
    }
  }, []);

  const store = useOfferStore();
  return <OfferContext.Provider value={store}>{children}</OfferContext.Provider>;
};

// Backwards compatibility hook
export const useOffer = () => {
  const context = React.useContext(OfferContext);
  // Fallback to store directly if used outside provider, though App.tsx ensures it's wrapped
  return context || useOfferStore();
};
