import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { OfferProject } from '../components/OfferDashboard';

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
  badgeType: string;
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

export const defaultPriceBadge: PriceBadgeConfig = {
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
  badgeType: 'rectangle',
};

export const defaultDescConfig: DescriptionConfig = {
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

export const defaultImageConfig: ImageConfig = {
  scale: 1,
  offsetX: 50,
  offsetY: 28,
};

export const defaultConfig: ArtBoardConfig = {
  width: 1080,
  height: 1080,
  backgroundImageUrl: null,
};

export interface OfferState {
  step: number;
  setStep: (step: number) => void;
  config: ArtBoardConfig;
  setConfig: (config: ArtBoardConfig) => void;
  updateConfig: (p: Partial<ArtBoardConfig>) => void;
  slots: Slot[];
  setSlots: (slots: Slot[]) => void;
  selectedSlotId: string | null;
  setSelectedSlotId: (id: string | null) => void;
  pageCount: number;
  setPageCount: (count: number) => void;
  priceBadge: PriceBadgeConfig;
  setPriceBadge: (pb: PriceBadgeConfig) => void;
  updatePriceBadge: (p: Partial<PriceBadgeConfig>) => void;
  descConfig: DescriptionConfig;
  setDescConfig: (dc: DescriptionConfig) => void;
  updateDescConfig: (p: Partial<DescriptionConfig>) => void;
  imageConfig: ImageConfig;
  setImageConfig: (ic: ImageConfig) => void;
  updateImageConfig: (p: Partial<ImageConfig>) => void;
  products: ProductItem[];
  setProducts: (prods: ProductItem[]) => void;
  layouts: any[];
  setLayouts: (l: any[]) => void;
  customFonts: { name: string; url: string }[];
  setCustomFonts: (fonts: any | ((prev: any[]) => any[])) => void;
  presets: any[];
  setPresets: (presets: any[] | ((prev: any[]) => any[])) => void;
  isLoadingPresets: boolean;
  setIsLoadingPresets: (b: boolean) => void;
  slotSettings: Record<number, any>;
  setSlotSettings: (s: Record<number, any>) => void;
  updateSlotSettings: (index: number, p: any) => void;
  selectedSlotIndex: number | null;
  setSelectedSlotIndex: (idx: number | null) => void;
  selectedSlotIndices: number[];
  setSelectedSlotIndices: (idx: number[]) => void;
  zoom: number;
  setZoom: (z: number | ((prev: number) => number)) => void;
  panOffset: { x: number; y: number };
  setPanOffset: (po: { x: number; y: number }) => void;
  pageTemplates: any[];
  setPageTemplates: (pt: any[] | ((prev: any[]) => any[])) => void;
  isLoadingTemplates: boolean;
  setIsLoadingTemplates: (b: boolean) => void;
  activePage: number;
  setActivePage: (p: number) => void;
  customCanvasElements: Record<number, any[]>;
  setCustomCanvasElements: (c: Record<number, any[]> | ((prev: Record<number, any[]>) => Record<number, any[]>)) => void;
  selectedClientName: string | null;
  setSelectedClientName: (name: string | null) => void;
  clients: any[];
  setClients: (c: any[]) => void;
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;
  activeProjectName: string | null;
  setActiveProjectName: (name: string | null) => void;

  // External Injections
  isAuthenticated: boolean;
  setIsAuthenticated: (b: boolean) => void;
  trackEvent: (category: string, action: string, label?: string) => void;
  setTrackEvent: (fn: any) => void;

  // History state
  history: string[];
  historyIndex: number;
  
  // Methods
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  fetchClients: () => Promise<void>;
  fetchPresets: () => Promise<void>;
  fetchFonts: () => Promise<void>;
  fetchTemplates: () => Promise<void>;
  saveProjectTemplate: (name: string) => Promise<void>;
  deleteProjectTemplate: (template: { id?: string; name: string }) => Promise<void>;
  loadProjectTemplate: (id: string) => void;
  getSlotSettings: (index: number) => { priceBadge: PriceBadgeConfig; descConfig: DescriptionConfig; imageConfig: ImageConfig };
  replaceSlotSettings: (index: number, settings: any) => void;
  syncAllSlots: (settings: any, sourceIdx: number) => void;
  getProjectStateSnapshot: () => any;
  loadProjectState: (state: any) => void;
  createAndOpenProject: (name: string, date: string) => Promise<void>;
  openProject: (project: OfferProject) => void;
  saveProject: () => Promise<void>;
  closeProject: () => void;
  resetToDefaults: () => void;
  removeBackground: (productIdx: number) => Promise<void>;
  autoFitImage: (productIdx: number) => Promise<void>;
  removeProducts: (ids: string[]) => void;
}

export const useOfferStore = create<OfferState>((set, get) => ({
  step: 1,
  setStep: (step) => set((state) => ({ step: typeof step === 'function' ? step(state.step) : step })),
  config: defaultConfig,
  setConfig: (config) => set((state) => ({ config: typeof config === 'function' ? config(state.config) : config })),
  updateConfig: (p) => set((state) => ({ config: { ...state.config, ...p } })),
  slots: [],
  setSlots: (slots) => set((state) => ({ slots: typeof slots === 'function' ? slots(state.slots) : slots })),
  selectedSlotId: null,
  setSelectedSlotId: (selectedSlotId) => set({ selectedSlotId }),
  pageCount: 1,
  setPageCount: (pageCount) => set({ pageCount }),
  priceBadge: defaultPriceBadge,
  setPriceBadge: (priceBadge) => set({ priceBadge }),
  updatePriceBadge: (p) => set((state) => ({ priceBadge: { ...state.priceBadge, ...p } })),
  descConfig: defaultDescConfig,
  setDescConfig: (descConfig) => set({ descConfig }),
  updateDescConfig: (p) => set((state) => ({ descConfig: { ...state.descConfig, ...p } })),
  imageConfig: defaultImageConfig,
  setImageConfig: (imageConfig) => set({ imageConfig }),
  updateImageConfig: (p) => set((state) => ({ imageConfig: { ...state.imageConfig, ...p } })),
  products: [],
  setProducts: (products) => set((state) => ({ products: typeof products === 'function' ? products(state.products) : products })),
  layouts: [],
  setLayouts: (layouts) => set({ layouts }),
  customFonts: [],
  setCustomFonts: (fonts) => set((state) => ({ customFonts: typeof fonts === 'function' ? fonts(state.customFonts) : fonts })),
  presets: [],
  setPresets: async (newPresets) => {
    const state = get();
    const current = state.presets;
    let updated = typeof newPresets === 'function' ? newPresets(current) : newPresets;
    updated = updated.map((p: any) => p.client === undefined ? { ...p, client: state.selectedClientName } : p);
    
    set({ presets: updated });
    
    const deletedIds = current.filter(cb => !updated.some(ub => ub.id === cb.id)).map(b => b.id);
    const addedItems = updated.filter((ub: any) => !current.some(cb => cb.id === ub.id));

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
  },
  isLoadingPresets: true,
  setIsLoadingPresets: (isLoadingPresets) => set({ isLoadingPresets }),
  slotSettings: {},
  setSlotSettings: (slotSettings) => set((state) => ({ slotSettings: typeof slotSettings === 'function' ? slotSettings(state.slotSettings) : slotSettings })),
  updateSlotSettings: (index, p) => {
    set((state) => {
      const current = state.slotSettings[index] || {};
      const updated = { 
        ...state.slotSettings, 
        [index]: { 
          ...current,
          priceBadge: p.priceBadge ? { ...(current.priceBadge || {}), ...p.priceBadge } : current.priceBadge,
          descConfig: p.descConfig ? { ...(current.descConfig || {}), ...p.descConfig } : current.descConfig,
          imageConfig: p.imageConfig ? { ...(current.imageConfig || {}), ...p.imageConfig } : current.imageConfig,
        } 
      };
      return { slotSettings: updated };
    });
  },
  selectedSlotIndex: null,
  setSelectedSlotIndex: (selectedSlotIndex) => set({ selectedSlotIndex }),
  selectedSlotIndices: [],
  setSelectedSlotIndices: (selectedSlotIndices) => set((state) => ({ selectedSlotIndices: typeof selectedSlotIndices === 'function' ? selectedSlotIndices(state.selectedSlotIndices) : selectedSlotIndices })),
  zoom: 0.8,
  setZoom: (z) => set((state) => ({ zoom: typeof z === 'function' ? z(state.zoom) : z })),
  panOffset: { x: 0, y: 0 },
  setPanOffset: (panOffset) => set((state) => ({ panOffset: typeof panOffset === 'function' ? panOffset(state.panOffset) : panOffset })),
  pageTemplates: [],
  setPageTemplates: (pt) => set((state) => ({ pageTemplates: typeof pt === 'function' ? pt(state.pageTemplates) : pt })),
  isLoadingTemplates: true,
  setIsLoadingTemplates: (isLoadingTemplates) => set({ isLoadingTemplates }),
  activePage: 0,
  setActivePage: (activePage) => set((state) => ({ activePage: typeof activePage === 'function' ? activePage(state.activePage) : activePage })),
  customCanvasElements: {},
  setCustomCanvasElements: (c) => set((state) => ({ customCanvasElements: typeof c === 'function' ? c(state.customCanvasElements) : c })),
  selectedClientName: null,
  setSelectedClientName: (name) => {
    if (name) localStorage.setItem('offer_generator_client', name);
    else localStorage.removeItem('offer_generator_client');
    set({ selectedClientName: name });
  },
  clients: [],
  setClients: (clients) => set({ clients }),
  activeProjectId: null,
  setActiveProjectId: (activeProjectId) => set({ activeProjectId }),
  activeProjectName: null,
  setActiveProjectName: (activeProjectName) => set({ activeProjectName }),

  isAuthenticated: false,
  setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  trackEvent: () => {},
  setTrackEvent: (trackEvent) => set({ trackEvent }),

  history: [],
  historyIndex: -1,

  pushHistory: () => {
    try {
      const state = get();
      // Only stringify stable data parts to avoid circular refs or huge state crashes
      const snap = JSON.stringify({ 
        slots: state.slots, 
        slotSettings: state.slotSettings, 
        priceBadge: state.priceBadge, 
        descConfig: state.descConfig, 
        imageConfig: state.imageConfig, 
        config: state.config, 
        customCanvasElements: state.customCanvasElements, 
        products: state.products.map(p => ({
          id: p.id, ean: p.ean, name: p.name, price: p.price, images: p.images, suffix: p.suffix
        }))
      });
      
      if (state.historyIndex >= 0 && state.history[state.historyIndex] === snap) return;
      
      const newHistory = [...state.history.slice(0, state.historyIndex + 1), snap];
      let newIndex = newHistory.length - 1;
      
      if (newHistory.length > 50) {
        newHistory.shift();
        newIndex = Math.max(0, newIndex - 1);
      }
      
      set({ history: newHistory, historyIndex: newIndex });
    } catch (err) {
      console.warn('Failed to push history snapshot:', err);
    }
  },

  applySnapshot: (snap: string) => {
    try {
      const last = JSON.parse(snap);
      set((state) => ({
        slots: last.slots !== undefined ? last.slots : state.slots,
        slotSettings: last.slotSettings !== undefined ? last.slotSettings : state.slotSettings,
        priceBadge: last.priceBadge !== undefined ? last.priceBadge : state.priceBadge,
        descConfig: last.descConfig !== undefined ? last.descConfig : state.descConfig,
        imageConfig: last.imageConfig !== undefined ? last.imageConfig : state.imageConfig,
        config: last.config !== undefined ? last.config : state.config,
        customCanvasElements: last.customCanvasElements !== undefined ? last.customCanvasElements : state.customCanvasElements,
        products: last.products !== undefined ? last.products : state.products,
      }));
    } catch (e) {
      console.error('Error applying snapshot:', e);
    }
  },

  undo: () => {
    const state = get();
    if (state.historyIndex <= 0) {
      toast.info('Nada para desfazer');
      return;
    }
    const newIndex = state.historyIndex - 1;
    (get() as any).applySnapshot(state.history[newIndex]);
    set({ historyIndex: newIndex });
    toast.success('Desfeito!');
  },

  redo: () => {
    const state = get();
    if (state.historyIndex >= state.history.length - 1) {
      toast.info('Nada para refazer');
      return;
    }
    const newIndex = state.historyIndex + 1;
    (get() as any).applySnapshot(state.history[newIndex]);
    set({ historyIndex: newIndex });
    toast.success('Refeito!');
  },

  fetchClients: async () => {
    try {
      const { data, error } = await supabase.from('calendar_clients').select('id, name').order('name');
      if (error) throw error;
      if (data) set({ clients: data });
    } catch (err) {
      console.error('Erro ao carregar clientes:', err);
    }
  },

  fetchPresets: async () => {
    try {
      const { data } = await supabase.from('offer_presets').select('*').order('created_at', { ascending: true });
      if (data) {
        set({ presets: data.map((d: any) => ({
          id: d.id,
          name: d.name,
          client: d.client,
          priceBadge: d.price_badge,
          descConfig: d.desc_config
        })) });
      }
    } catch (err) {} finally { set({ isLoadingPresets: false }); }
  },

  fetchFonts: async () => {
    try {
      const { data } = await (supabase as any).from('offer_fonts').select('*');
      if (!data) return;
      for (const f of data) {
        const prev = get().customFonts;
        if (prev.some(x => x.name === f.name)) continue;
        fetch(f.url).then(r => r.blob()).then(blob => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result as string;
            const fontFace = new FontFace(f.name, `url(${base64})`);
            fontFace.load().then(loaded => {
              document.fonts.add(loaded);
              const cur = get().customFonts;
              if (!cur.some(x => x.name === f.name)) {
                set({ customFonts: [...cur, { name: f.name, url: base64 }] });
              }
            });
          };
          reader.readAsDataURL(blob);
        });
      }
    } catch (e) {}
  },

  fetchTemplates: async () => {
    try {
      const { data: tData } = await supabase.from('offer_templates').select('*').order('created_at', { ascending: true });
      if (tData) {
        set({ pageTemplates: tData.map((d: any) => ({
          id: d.id,
          name: d.name,
          client: d.client,
          slots: d.slots,
          slotSettings: d.slot_settings,
          priceBadge: d.price_badge,
          descConfig: d.desc_config,
          config: d.config
        })) });
      }
    } catch (e) {} finally { set({ isLoadingTemplates: false }); }
  },

  saveProjectTemplate: async (name: string) => {
    const state = get();
    const id = crypto.randomUUID();
    const newTemplate = { id, name, slots: state.slots, slotSettings: state.slotSettings, priceBadge: state.priceBadge, descConfig: state.descConfig, config: state.config, client: state.selectedClientName };
    set({ pageTemplates: [...state.pageTemplates, newTemplate] });
    
    await supabase.from('offer_templates').insert({
      id,
      name,
      client: state.selectedClientName,
      slots: state.slots,
      slot_settings: state.slotSettings,
      price_badge: state.priceBadge,
      desc_config: state.descConfig,
      config: state.config
    });
    toast.success('Template salvo!');
  },

  deleteProjectTemplate: async (templateToDelete: { id?: string; name: string }) => {
    try {
      if (!templateToDelete.id) {
        toast.error('O template não possui ID para deleção.');
        return;
      }
      set((state) => ({ pageTemplates: state.pageTemplates.filter(t => t.id !== templateToDelete.id) }));
      await supabase.from('offer_templates').delete().eq('id', templateToDelete.id);
      toast.success('Template removido!');
    } catch (err: any) {
      toast.error('Erro ao excluir template.');
    }
  },

  loadProjectTemplate: (id: string) => {
    const state = get();
    const base = state.pageTemplates.find(t => t.id === id);
    if (!base) return;
    state.pushHistory();
    set({
      slots: base.slots || [],
      slotSettings: base.slotSettings || {},
      priceBadge: base.priceBadge || state.priceBadge,
      descConfig: base.descConfig || state.descConfig,
      config: { ...state.config, ...base.config }
    });
    toast.success(`Template "${base.name}" carregado!`);
  },

  getSlotSettings: (index: number) => {
    const state = get();
    const s = state.slotSettings[index] || {};
    return {
      priceBadge: { ...state.priceBadge, ...(s.priceBadge || {}) },
      descConfig: { ...state.descConfig, ...(s.descConfig || {}) },
      imageConfig: { ...state.imageConfig, ...(s.imageConfig || {}) },
    };
  },

  replaceSlotSettings: (index: number, settings: any) => {
    set((state) => ({ slotSettings: { ...state.slotSettings, [index]: settings } }));
  },

  syncAllSlots: async (unused: any, sourceIdx: number) => {
    try {
      const state = get();
      const totalSlots = (state.pageCount || 1) * (state.slots?.length || 12);
      const sourceStyle = state.getSlotSettings(sourceIdx);
      
      const pTemplates: Record<number, any> = {};
      const pageSlotCount = state.slots.length || 1;
      
      for (let i = 0; i < pageSlotCount; i++) {
          const globalIdx = state.activePage * pageSlotCount + i;
          pTemplates[i] = { ...state.getSlotSettings(globalIdx) };
      }
 
      const newSettings: Record<number, any> = {};
      for (let i = 0; i < totalSlots; i++) {
          const slotIndex = i % pageSlotCount;
          newSettings[i] = { ...(pTemplates[slotIndex] || sourceStyle) };
      }
      
      set({
        slotSettings: newSettings,
        priceBadge: { ...sourceStyle.priceBadge },
        descConfig: { ...sourceStyle.descConfig }
      });
      
      toast.success('Visual sincronizado em todas as telas!');
    } catch (err) {
      console.error('Sync Error:', err);
      toast.error('Erro ao sincronizar');
    }
  },

  getProjectStateSnapshot: () => {
    const state = get();
    return {
      step: state.step, config: state.config, slots: state.slots, pageCount: state.pageCount, 
      priceBadge: state.priceBadge, descConfig: state.descConfig, imageConfig: state.imageConfig,
      products: state.products, layouts: state.layouts, slotSettings: state.slotSettings, 
      activePage: state.activePage, selectedClientName: state.selectedClientName,
    };
  },

  loadProjectState: (s: any) => {
    if (!s) return;
    const state = get();
    set({
      step: s.step != null ? s.step : state.step,
      config: s.config ? { ...defaultConfig, ...s.config } : state.config,
      slots: s.slots ? s.slots : state.slots,
      pageCount: s.pageCount != null ? s.pageCount : state.pageCount,
      priceBadge: s.priceBadge ? { ...defaultPriceBadge, ...s.priceBadge } : state.priceBadge,
      descConfig: s.descConfig ? { ...defaultDescConfig, ...s.descConfig } : state.descConfig,
      imageConfig: s.imageConfig ? { ...defaultImageConfig, ...s.imageConfig } : state.imageConfig,
      products: s.products ? s.products : state.products,
      layouts: s.layouts ? s.layouts : state.layouts,
      slotSettings: s.slotSettings ? s.slotSettings : state.slotSettings,
      activePage: s.activePage != null ? s.activePage : state.activePage,
      selectedClientName: s.selectedClientName !== undefined ? s.selectedClientName : state.selectedClientName,
      history: [],
      historyIndex: -1
    });
    setTimeout(() => get().pushHistory(), 50);
  },

  createAndOpenProject: async (name: string, date: string) => {
    const state = get();
    state.resetToDefaults();
    try {
      const { data, error } = await (supabase as any)
        .from('offer_projects')
        .insert({ name, offer_date: date, state: {} })
        .select()
        .single();
      if (error) throw error;
      set({ activeProjectId: data.id, activeProjectName: data.name });
      toast.success(`Oferta "${name}" criada!`);
      state.trackEvent('observation', 'offer_studio', `Nova Arte/Projeto gerado: "${name}" (${state.slots.length * state.pageCount} telas)`);
    } catch (err: any) {
      toast.error('Erro ao criar oferta: ' + (err.message || ''));
      throw err;
    }
  },

  openProject: (project: OfferProject) => {
    const state = get();
    state.resetToDefaults();
    set({ activeProjectId: project.id, activeProjectName: project.name });
    state.loadProjectState(project.state);
    toast.success(`Oferta "${project.name}" aberta!`);
  },

  saveProject: async () => {
    const state = get();
    if (!state.activeProjectId) {
      toast.error('Nenhuma oferta ativa para salvar');
      return;
    }
    try {
      const snapshot = state.getProjectStateSnapshot();
      const { error } = await (supabase as any)
        .from('offer_projects')
        .update({ state: snapshot, updated_at: new Date().toISOString() })
        .eq('id', state.activeProjectId);
      if (error) throw error;
      toast.success('Alterações salvas!');
      state.trackEvent('observation', 'offer_studio', `Projeto salvo: Ajustes de design aplicados em "${state.activeProjectName}"`);
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err.message || ''));
    }
  },

  closeProject: () => {
    const state = get();
    state.resetToDefaults();
    set({ activeProjectId: null, activeProjectName: null });
  },

  removeBackground: async (productIdx: number) => {
    const state = get();
    const product = state.products[productIdx];
    if (!product || !product.images?.[0]) return;

    try {
      toast.loading('Removendo fundo e recortando...', { id: 'rb-' + productIdx });
      const { data, error } = await supabase.functions.invoke('remove-background', {
        body: { imageUrl: product.images[0] }
      });

      if (error) throw error;
      if (data?.base64) {
        const newProducts = [...state.products];
        const timestampedUrl = `${data.base64}#t=${Date.now()}`;
        newProducts[productIdx] = { ...product, images: [timestampedUrl] };
        
        state.pushHistory();
        set({ products: newProducts });
        
        setTimeout(() => get().autoFitImage(productIdx), 500);
        toast.success('Fundo removido e imagem recortada!', { id: 'rb-' + productIdx });
      }
    } catch (err: any) {
      console.error('Erro ao remover fundo:', err);
      toast.error('Erro ao remover fundo: ' + (err.message || 'Erro desconhecido'), { id: 'rb-' + productIdx });
    }
  },

  autoFitImage: async (productIdx: number) => {
    const state = get();
    const product = state.products[productIdx];
    if (!product || !product.images?.[0]) return;

    try {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.src = product.images[0];
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
      let found = false;

      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const alpha = data[(y * canvas.width + x) * 4 + 3];
          if (alpha > 10) { 
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
            found = true;
          }
        }
      }

      if (!found) return;

      const sw = maxX - minX;
      const sh = maxY - minY;
      const scx = minX + sw / 2;
      const scy = minY + sh / 2;
      
      const offX = (scx / canvas.width) * 100;
      const offY = (scy / canvas.height) * 100;

      const slot = state.slots[productIdx % state.slots.length] || { width: 500, height: 500 };
      const scaleX = slot.width / sw;
      const scaleY = slot.height / sh;
      const baseScale = Math.min(scaleX, scaleY) * 0.85;
      
      state.pushHistory();
      state.updateSlotSettings(productIdx, {
        imageConfig: {
          offsetX: offX,
          offsetY: offY,
          scale: baseScale > 1.5 ? 1.5 : baseScale < 0.5 ? 0.5 : baseScale
        }
      });
      
      toast.success('Caixa ajustada ao produto!');
    } catch (err) {
      console.error('Erro ao auto-ajustar imagem:', err);
    }
  },

  resetToDefaults: () => {
    set({
      step: 1, config: defaultConfig, slots: [], selectedSlotId: null, pageCount: 1,
      priceBadge: defaultPriceBadge, descConfig: defaultDescConfig, imageConfig: defaultImageConfig,
      products: [], layouts: [], slotSettings: {}, selectedSlotIndex: null, selectedSlotIndices: [],
      zoom: 0.8, panOffset: { x: 0, y: 0 }, activePage: 0, customCanvasElements: {}, history: [], historyIndex: -1
    });
  },
  
  removeProducts: (ids: string[]) => {
    const state = get();
    state.pushHistory();
    set((state) => ({ 
      products: state.products.filter(p => !ids.includes(p.id)) 
    }));
  }
}));
