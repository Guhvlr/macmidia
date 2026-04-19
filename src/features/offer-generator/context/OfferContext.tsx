import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useApp } from '@/contexts/useApp';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { OfferProject } from '../components/OfferDashboard';
import { useIntelligence } from '@/features/intelligence/context/IntelligenceContext';

export interface ProductItem {
  id: string;
  ean: string;
  name: string;
  price: string;
  images: string[];
  brand?: string;
  line?: string;
  category?: string;
  has_qr_code?: boolean;
  description_on_front?: boolean;
  confidence?: 'exact' | 'high' | 'medium' | 'low' | 'none';
  confidence_reason?: string;
  warning?: string;
    suffix?: string;
  mode?: 'barcode' | 'description';
}

export interface Slot {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PriceBadgeConfig {
  badgeImageUrl: string | null;
  badgeWidth: number;
  badgeHeight: number;
  badgeOffsetX: number;
  badgeOffsetY: number;
  currencyFontSize: number;
  currencyOffsetX: number;
  currencyOffsetY: number;
  currencyColor: string;
  currencyFontFamily: string;
  valueFontSize: number;
  valueOffsetX: number;
  valueOffsetY: number;
  valueColor: string;
  valueFontFamily: string;
  suffixText: string;
  suffixFontSize: number;
  suffixOffsetX: number;
  suffixOffsetY: number;
  suffixColor: string;
  showSuffix: boolean;
  bgColor: string;
  borderRadius: number;
}

export interface DescriptionConfig {
  fontFamily: string;
  fontSize: number;
  color: string;
  bgColor: string;
  showBg: boolean;
  offsetX: number;
  offsetY: number;
  maxChars: number;
  uppercase: boolean;
}

export interface ImageConfig {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface ArtBoardConfig {
  width: number;
  height: number;
  backgroundImageUrl: string | null;
}

interface OfferContextType {
  step: number;
  setStep: React.Dispatch<React.SetStateAction<number>>;
  config: ArtBoardConfig;
  setConfig: React.Dispatch<React.SetStateAction<ArtBoardConfig>>; // for undo
  updateConfig: (p: Partial<ArtBoardConfig>) => void;
  slots: Slot[];
  setSlots: React.Dispatch<React.SetStateAction<Slot[]>>;
  selectedSlotId: string | null;
  setSelectedSlotId: React.Dispatch<React.SetStateAction<string | null>>;
  pageCount: number;
  setPageCount: React.Dispatch<React.SetStateAction<number>>;
  priceBadge: PriceBadgeConfig;
  setPriceBadge: React.Dispatch<React.SetStateAction<PriceBadgeConfig>>; // for undo
  updatePriceBadge: (p: Partial<PriceBadgeConfig>) => void;
  descConfig: DescriptionConfig;
  setDescConfig: React.Dispatch<React.SetStateAction<DescriptionConfig>>; // for undo
  updateDescConfig: (p: Partial<DescriptionConfig>) => void;
  imageConfig: ImageConfig;
  setImageConfig: React.Dispatch<React.SetStateAction<ImageConfig>>; // for undo
  updateImageConfig: (p: Partial<ImageConfig>) => void;
  products: ProductItem[];
  setProducts: React.Dispatch<React.SetStateAction<ProductItem[]>>;
  layouts: any[];
  setLayouts: React.Dispatch<React.SetStateAction<any[]>>;
  customFonts: { name: string; url: string }[];
  setCustomFonts: React.Dispatch<React.SetStateAction<{ name: string; url: string }[]>>;
  presets: any[];
  setPresets: (presets: any[] | ((prev: any[]) => any[])) => void;
  isLoadingPresets: boolean;
  slotSettings: Record<number, any>;
  setSlotSettings: React.Dispatch<React.SetStateAction<Record<number, any>>>; // for undo
  updateSlotSettings: (index: number, p: any) => void;
  selectedSlotIndex: number | null;
  setSelectedSlotIndex: (idx: number | null) => void;
  selectedSlotIndices: number[];
  setSelectedSlotIndices: React.Dispatch<React.SetStateAction<number[]>>;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  panOffset: { x: number; y: number };
  setPanOffset: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  pageTemplates: any[];
  saveProjectTemplate: (name: string) => Promise<void>;
  deleteProjectTemplate: (template: { id?: string; name: string }) => Promise<void>;
  loadProjectTemplate: (id: string) => void;
  isLoadingTemplates: boolean;
  getSlotSettings: (index: number) => { priceBadge: PriceBadgeConfig; descConfig: DescriptionConfig; imageConfig: ImageConfig };
  replaceSlotSettings: (index: number, settings: any) => void;
  activePage: number;
  setActivePage: React.Dispatch<React.SetStateAction<number>>;
  customCanvasElements: Record<number, any[]>;
  setCustomCanvasElements: React.Dispatch<React.SetStateAction<Record<number, any[]>>>;
  syncAllSlots: (settings: any, sourceIdx: number) => void;
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
  selectedClientName: string | null;
  setSelectedClientName: (name: string | null) => void;
  clients: any[];
  // Project management
  activeProjectId: string | null;
  activeProjectName: string | null;
  openProject: (project: OfferProject) => void;
  saveProject: () => Promise<void>;
  closeProject: () => void;
  createAndOpenProject: (name: string, date: string) => Promise<void>;
  resetToDefaults: () => void;
}

const defaultPriceBadge: PriceBadgeConfig = {
  badgeImageUrl: null,
  badgeWidth: 320,
  badgeHeight: 130,
  badgeOffsetX: 50,
  badgeOffsetY: 78,
  currencyFontSize: 26,
  currencyOffsetX: 15,
  currencyOffsetY: 52,
  currencyColor: '#ffffff',
  currencyFontFamily: 'Montserrat, sans-serif',
  valueFontSize: 56,
  valueOffsetX: 55,
  valueOffsetY: 68,
  valueColor: '#ffffff',
  valueFontFamily: 'Montserrat, sans-serif',
  suffixText: 'cada',
  suffixFontSize: 14,
  suffixOffsetX: 55,
  suffixOffsetY: 90,
  suffixColor: '#ffffff',
  showSuffix: true,
  bgColor: '#e11d48',
  borderRadius: 14,
};

const defaultDescConfig: DescriptionConfig = {
  fontFamily: 'Montserrat, sans-serif',
  fontSize: 15,
  color: '#1a1a1a',
  bgColor: '#ffffff',
  showBg: false,
  offsetX: 50,
  offsetY: 62,
  maxChars: 22,
  uppercase: true,
};

const defaultImageConfig: ImageConfig = {
  scale: 1,
  offsetX: 50,
  offsetY: 28,
};

const defaultConfig: ArtBoardConfig = {
  width: 1080,
  height: 1080,
  backgroundImageUrl: null,
};

const OfferContext = createContext<OfferContextType | undefined>(undefined);

export const OfferProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [step, setStep] = useState(1);
  const [activePage, setActivePage] = useState(0);
  const [config, setConfig] = useState<ArtBoardConfig>(defaultConfig);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(1);
  const [priceBadge, setPriceBadge] = useState<PriceBadgeConfig>(defaultPriceBadge);
  const [descConfig, setDescConfig] = useState<DescriptionConfig>(defaultDescConfig);
  const [imageConfig, setImageConfig] = useState<ImageConfig>(defaultImageConfig);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [layouts, setLayouts] = useState<any[]>([]);
  const [customFonts, setCustomFonts] = useState<{ name: string; url: string }[]>([]);
  const [slotSettings, setSlotSettings] = useState<Record<number, any>>({});
  const [customCanvasElements, setCustomCanvasElements] = useState<Record<number, any[]>>({});
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
  const [selectedSlotIndices, setSelectedSlotIndices] = useState<number[]>([]);
  const [zoom, setZoom] = useState(0.8);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [pageTemplates, setPageTemplates] = useState<any[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [presets, setPresetsState] = useState<any[]>([]);
  const [isLoadingPresets, setIsLoadingPresets] = useState(true);
  const [selectedClientName, setSelectedClientName] = useState<string | null>(localStorage.getItem('offer_generator_client') || null);
  const [clients, setClients] = useState<any[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeProjectName, setActiveProjectName] = useState<string | null>(null);

  // ── Undo/Redo History (index-based) ──
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);

  const { isAuthenticated } = useApp();
  const { trackEvent } = useIntelligence();

  const fetchClients = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('calendar_clients').select('id, name').order('name');
      if (error) throw error;
      if (data) setClients(data);
    } catch (err) {
      console.error('Erro ao carregar clientes:', err);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchClients();
    }
  }, [isAuthenticated, fetchClients]);

  useEffect(() => {
    if (selectedClientName) localStorage.setItem('offer_generator_client', selectedClientName);
    else localStorage.removeItem('offer_generator_client');
  }, [selectedClientName]);

  const pushHistory = useCallback(() => {
    const snap = JSON.stringify({ slots, slotSettings, priceBadge, descConfig, imageConfig, config, customCanvasElements, products });
    // Don't push if identical to current
    if (historyIndexRef.current >= 0 && historyRef.current[historyIndexRef.current] === snap) return;
    // Truncate any future states (discard redo stack when new action occurs)
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(snap);
    historyIndexRef.current = historyRef.current.length - 1;
    // Limit history size
    if (historyRef.current.length > 50) {
      historyRef.current.shift();
      historyIndexRef.current--;
    }
  }, [slots, slotSettings, priceBadge, descConfig, imageConfig, config, customCanvasElements, products]);

  const applySnapshot = useCallback((snap: string) => {
    try {
      const last = JSON.parse(snap);
      if (last.slots) setSlots(last.slots);
      if (last.slotSettings) setSlotSettings(last.slotSettings);
      if (last.priceBadge) setPriceBadge(last.priceBadge);
      if (last.descConfig) setDescConfig(last.descConfig);
      if (last.imageConfig) setImageConfig(last.imageConfig);
      if (last.config) setConfig(last.config);
      if (last.customCanvasElements !== undefined) setCustomCanvasElements(last.customCanvasElements);
      if (last.products !== undefined) setProducts(last.products);
    } catch (e) {
      console.error('Error applying snapshot:', e);
    }
  }, []);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) {
      toast.info('Nada para desfazer');
      return;
    }
    historyIndexRef.current--;
    applySnapshot(historyRef.current[historyIndexRef.current]);
    toast.success('Desfeito!');
  }, [applySnapshot]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) {
      toast.info('Nada para refazer');
      return;
    }
    historyIndexRef.current++;
    applySnapshot(historyRef.current[historyIndexRef.current]);
    toast.success('Refeito!');
  }, [applySnapshot]);

  // NOTE: Ctrl+Z / Ctrl+Shift+Z are now handled ONLY in OfferEditorPage
  // to avoid conflicts. No global listener here.

  const fetchPresets = useCallback(async () => {
    try {
      const { data } = await supabase.from('offer_presets').select('*').order('created_at', { ascending: true });
      if (data) {
        setPresetsState(data.map((d: any) => ({
          id: d.id,
          name: d.name,
          client: d.client,
          priceBadge: d.price_badge,
          descConfig: d.desc_config
        })));
      }
    } catch (err) {} finally { setIsLoadingPresets(false); }
  }, []);

  const fetchFonts = useCallback(async () => {
    try {
      const { data } = await (supabase as any).from('offer_fonts').select('*');
      if (!data) return;
      for (const f of data) {
        setCustomFonts(prev => {
          if (prev.some(x => x.name === f.name)) return prev;
          fetch(f.url).then(r => r.blob()).then(blob => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = reader.result as string;
              const fontFace = new FontFace(f.name, `url(${base64})`);
              fontFace.load().then(loaded => {
                document.fonts.add(loaded);
                setCustomFonts(cur => cur.some(x => x.name === f.name) ? cur : [...cur, { name: f.name, url: base64 }]);
              });
            };
            reader.readAsDataURL(blob);
          });
          return prev;
        });
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    const initData = async () => {
      try {
        const { data: tData } = await supabase.from('offer_templates').select('*').order('created_at', { ascending: true });
        if (tData) {
          setPageTemplates(tData.map((d: any) => ({
            id: d.id,
            name: d.name,
            client: d.client,
            slots: d.slots,
            slotSettings: d.slot_settings,
            priceBadge: d.price_badge,
            descConfig: d.desc_config,
            config: d.config
          })));
        }
        // Slot_settings e confs antigas que ficavam no Settings foram convertidas para estado 100% local (anti race condition)
      } catch (e) {} finally { setIsLoadingTemplates(false); }
    };
    initData();
    fetchPresets();
    fetchFonts();
  }, [fetchPresets, fetchFonts]);

  // Initial history push
  useEffect(() => {
    if (historyRef.current.length === 0) pushHistory();
  }, []);

  const saveProjectTemplate = async (name: string) => {
    const id = crypto.randomUUID();
    const newTemplate = { id, name, slots, slotSettings, priceBadge, descConfig, config, client: selectedClientName };
    setPageTemplates(prev => [...prev, newTemplate]);
    
    await supabase.from('offer_templates').insert({
      id,
      name,
      client: selectedClientName,
      slots,
      slot_settings: slotSettings,
      price_badge: priceBadge,
      desc_config: descConfig,
      config
    });
    toast.success('Template salvo!');
  };

  const deleteProjectTemplate = async (templateToDelete: { id?: string; name: string }) => {
    try {
      if (!templateToDelete.id) {
        toast.error('O template não possui ID para deleção.');
        return;
      }
      setPageTemplates(prev => prev.filter(t => t.id !== templateToDelete.id));
      await supabase.from('offer_templates').delete().eq('id', templateToDelete.id);
      toast.success('Template removido!');
    } catch (err: any) {
      toast.error('Erro ao excluir template.');
    }
  };

  const loadProjectTemplate = (id: string) => {
    const base = pageTemplates.find(t => t.id === id);
    if (!base) return;
    pushHistory();
    setSlots(base.slots || []);
    setSlotSettings(base.slotSettings || {});
    setPriceBadge(base.priceBadge || priceBadge);
    setDescConfig(base.descConfig || descConfig);
    setConfig(prev => ({ ...prev, ...base.config }));
    toast.success(`Template "${base.name}" carregado!`);
  };

  const updateSlotSettings = async (index: number, p: any) => {
    const current = slotSettings[index] || {};
    const updated = { 
      ...slotSettings, 
      [index]: { 
        ...current,
        priceBadge: p.priceBadge ? { ...(current.priceBadge || {}), ...p.priceBadge } : current.priceBadge,
        descConfig: p.descConfig ? { ...(current.descConfig || {}), ...p.descConfig } : current.descConfig,
        imageConfig: p.imageConfig ? { ...(current.imageConfig || {}), ...p.imageConfig } : current.imageConfig,
      } 
    };
    setSlotSettings(updated);
    // REMOVIDO: A atualização no DB global "settings" causava race condition brutal para múltiplos usuários
  };

  const replaceSlotSettings = async (index: number, settings: any) => {
    const updated = { ...slotSettings, [index]: settings };
    setSlotSettings(updated);
    // REMOVIDO: A atualização global foi inibida
  };

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
          if (data.config) setConfig(data.config);
          if (data.slots) setSlots(data.slots);
          if (data.products) setProducts(data.products);
          if (data.customFonts) setCustomFonts(data.customFonts);
          if (data.pageCount) setPageCount(data.pageCount);
          if (data.slotSettings) setSlotSettings(data.slotSettings);
          if (data.customCanvasElements) setCustomCanvasElements(data.customCanvasElements);
          // Push initial history after data loads so undo has a baseline
          setTimeout(() => {
            historyRef.current = [];
            historyIndexRef.current = -1;
            pushHistory();
          }, 100);
        }
      } catch (e) {
        console.error('Failed to load state in new tab:', e);
      }
    }
  }, []);

  const getSlotSettings = useCallback((index: number) => {
    const s = slotSettings[index] || {};
    return {
      priceBadge: { ...priceBadge, ...(s.priceBadge || {}) },
      descConfig: { ...descConfig, ...(s.descConfig || {}) },
      imageConfig: { ...imageConfig, ...(s.imageConfig || {}) },
    };
  }, [slotSettings, priceBadge, descConfig, imageConfig]);

  const syncAllSlots = async (unused: any, sourceIdx: number) => {
    try {
      const totalSlots = (pageCount || 1) * (slots?.length || 12);
      const sourceStyle = getSlotSettings(sourceIdx);
      
      const pTemplates: Record<number, any> = {};
      const pageSlotCount = slots.length || 1;
      
      for (let i = 0; i < pageSlotCount; i++) {
          const globalIdx = activePage * pageSlotCount + i;
          pTemplates[i] = { ...getSlotSettings(globalIdx) };
      }
 
      const newSettings: Record<number, any> = {};
      for (let i = 0; i < totalSlots; i++) {
          const slotIndex = i % pageSlotCount;
          newSettings[i] = { ...(pTemplates[slotIndex] || sourceStyle) };
      }
      
      setSlotSettings(newSettings);
      setPriceBadge({ ...sourceStyle.priceBadge });
      setDescConfig({ ...sourceStyle.descConfig });
      
      toast.success('Visual sincronizado em todas as telas!');
    } catch (err) {
      console.error('Sync Error:', err);
      toast.error('Erro ao sincronizar');
    }
  };

  const setPresets = async (newPresets: any[] | ((prev: any[]) => any[])) => {
    const current = presets;
    let updated = typeof newPresets === 'function' ? newPresets(current) : newPresets;
    updated = updated.map(p => p.client === undefined ? { ...p, client: selectedClientName } : p);
    
    setPresetsState(updated);
    
    // Sincronização inteligente sem stringify geral
    const deletedIds = current.filter(cb => !updated.some(ub => ub.id === cb.id)).map(b => b.id);
    const addedItems = updated.filter(ub => !current.some(cb => cb.id === ub.id));

    if (deletedIds.length > 0) {
      await supabase.from('offer_presets').delete().in('id', deletedIds);
    }
    for (const item of addedItems) {
      await supabase.from('offer_presets').insert({
        id: item.id,
        name: item.name,
        client: item.client,
        price_badge: item.priceBadge,
        desc_config: item.desc_config
      });
    }
  };

  const updateConfig = (p: Partial<ArtBoardConfig>) => setConfig(prev => ({ ...prev, ...p }));
  const updatePriceBadge = (p: Partial<PriceBadgeConfig>) => setPriceBadge(prev => ({ ...prev, ...p }));
  const updateDescConfig = (p: Partial<DescriptionConfig>) => setDescConfig(prev => ({ ...prev, ...p }));
  const updateImageConfig = (p: Partial<ImageConfig>) => setImageConfig(prev => ({ ...prev, ...p }));

  // ── Project Management ──────────────────────────────────────
  const resetToDefaults = useCallback(() => {
    setStep(1);
    setConfig(defaultConfig);
    setSlots([]);
    setSelectedSlotId(null);
    setPageCount(1);
    setPriceBadge(defaultPriceBadge);
    setDescConfig(defaultDescConfig);
    setImageConfig(defaultImageConfig);
    setProducts([]);
    setLayouts([]);
    setSlotSettings({});
    setSelectedSlotIndex(null);
    setSelectedSlotIndices([]);
    setZoom(0.8);
    setPanOffset({ x: 0, y: 0 });
    setActivePage(0);
    setCustomCanvasElements({});
    historyRef.current = [];
    historyIndexRef.current = -1;
  }, []);

  const getProjectStateSnapshot = useCallback(() => {
    return {
      step, config, slots, pageCount, priceBadge, descConfig, imageConfig,
      products, layouts, slotSettings, activePage, selectedClientName,
    };
  }, [step, config, slots, pageCount, priceBadge, descConfig, imageConfig, products, layouts, slotSettings, activePage, selectedClientName]);

  const loadProjectState = useCallback((state: any) => {
    if (!state) return;
    if (state.step != null) setStep(state.step);
    if (state.config) setConfig({ ...defaultConfig, ...state.config });
    if (state.slots) setSlots(state.slots);
    if (state.pageCount != null) setPageCount(state.pageCount);
    if (state.priceBadge) setPriceBadge({ ...defaultPriceBadge, ...state.priceBadge });
    if (state.descConfig) setDescConfig({ ...defaultDescConfig, ...state.descConfig });
    if (state.imageConfig) setImageConfig({ ...defaultImageConfig, ...state.imageConfig });
    if (state.products) setProducts(state.products);
    if (state.layouts) setLayouts(state.layouts);
    if (state.slotSettings) setSlotSettings(state.slotSettings);
    if (state.activePage != null) setActivePage(state.activePage);
    if (state.selectedClientName !== undefined) setSelectedClientName(state.selectedClientName);
    historyRef.current = [];
    historyIndexRef.current = -1;
    setTimeout(() => pushHistory(), 50);
  }, [pushHistory]);

  const createAndOpenProject = useCallback(async (name: string, date: string) => {
    resetToDefaults();
    try {
      const { data, error } = await (supabase as any)
        .from('offer_projects')
        .insert({ name, offer_date: date, state: {} })
        .select()
        .single();
      if (error) throw error;
      setActiveProjectId(data.id);
      setActiveProjectName(data.name);
      toast.success(`Oferta "${name}" criada!`);
      trackEvent('observation', 'offer_studio', `Nova Arte/Projeto gerado: "${name}" (${slots.length * pageCount} telas)`);
    } catch (err: any) {
      toast.error('Erro ao criar oferta: ' + (err.message || ''));
      throw err;
    }
  }, [resetToDefaults]);

  const openProject = useCallback((project: OfferProject) => {
    resetToDefaults();
    setActiveProjectId(project.id);
    setActiveProjectName(project.name);
    loadProjectState(project.state);
    toast.success(`Oferta "${project.name}" aberta!`);
  }, [resetToDefaults, loadProjectState]);

  const saveProject = useCallback(async () => {
    if (!activeProjectId) {
      toast.error('Nenhuma oferta ativa para salvar');
      return;
    }
    try {
      const snapshot = getProjectStateSnapshot();
      const { error } = await (supabase as any)
        .from('offer_projects')
        .update({ state: snapshot, updated_at: new Date().toISOString() })
        .eq('id', activeProjectId);
      if (error) throw error;
      toast.success('Alterações salvas!');
      trackEvent('observation', 'offer_studio', `Projeto salvo: Ajustes de design aplicados em "${activeProjectName}"`);
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err.message || ''));
    }
  }, [activeProjectId, getProjectStateSnapshot]);

  const closeProject = useCallback(() => {
    resetToDefaults();
    setActiveProjectId(null);
    setActiveProjectName(null);
  }, [resetToDefaults]);

  const contextValue = useMemo(() => ({
    step, setStep, config, setConfig, updateConfig,
    slots, setSlots, selectedSlotId, setSelectedSlotId,
    pageCount, setPageCount,
    priceBadge, setPriceBadge, updatePriceBadge,
    descConfig, setDescConfig, updateDescConfig,
    imageConfig, setImageConfig, updateImageConfig,
    products, setProducts, layouts, setLayouts,
    customFonts, setCustomFonts,
    presets, setPresets, isLoadingPresets,
    slotSettings, setSlotSettings, 
    selectedSlotIndex, setSelectedSlotIndex,
    selectedSlotIndices, setSelectedSlotIndices,
    zoom, setZoom,
    panOffset, setPanOffset,
    pageTemplates, saveProjectTemplate, deleteProjectTemplate, loadProjectTemplate, isLoadingTemplates,
    getSlotSettings,
    updateSlotSettings,
    replaceSlotSettings,
    syncAllSlots,
    activePage, setActivePage,
    customCanvasElements, setCustomCanvasElements,
    undo, redo, pushHistory,
    selectedClientName, setSelectedClientName, clients,
    activeProjectId, activeProjectName,
    openProject, saveProject, closeProject, createAndOpenProject, resetToDefaults,
  }), [
    step, config, slots, selectedSlotId, pageCount, priceBadge, descConfig, 
    imageConfig, products, layouts, customFonts, presets, isLoadingPresets, 
    slotSettings, selectedSlotIndex, selectedSlotIndices, zoom, panOffset, 
    pageTemplates, isLoadingTemplates, activePage, activeProjectId, 
    activeProjectName, selectedClientName, clients, undo, redo, pushHistory,
    updateConfig, updatePriceBadge, updateDescConfig, updateImageConfig, 
    saveProjectTemplate, deleteProjectTemplate, loadProjectTemplate, 
    getSlotSettings, updateSlotSettings, replaceSlotSettings, syncAllSlots, 
    openProject, saveProject, closeProject, createAndOpenProject, resetToDefaults
  ]);

  return (
    <OfferContext.Provider value={contextValue}>
      {children}
    </OfferContext.Provider>
  );
};

export const useOffer = () => {
  const ctx = useContext(OfferContext);
  if (!ctx) throw new Error('useOffer must be used within OfferProvider');
  return ctx;
};
