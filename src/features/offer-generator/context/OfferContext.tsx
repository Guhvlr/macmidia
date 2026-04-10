import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ProductItem {
  id: string;
  ean: string;
  name: string;
  price: string;
  images: string[];
  brand?: string;
  line?: string;
  category?: string;
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
  loadProjectTemplate: (id: string) => void;
  isLoadingTemplates: boolean;
  getSlotSettings: (index: number) => { priceBadge: PriceBadgeConfig; descConfig: DescriptionConfig; imageConfig: ImageConfig };
  updateSlotSettings: (index: number, p: any) => void;
  replaceSlotSettings: (index: number, settings: any) => void;
  activePage: number;
  setActivePage: React.Dispatch<React.SetStateAction<number>>;
  syncAllSlots: (settings: any, sourceIdx: number) => void;
  undo: () => void;
  pushHistory: () => void;
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
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
  const [selectedSlotIndices, setSelectedSlotIndices] = useState<number[]>([]);
  const [zoom, setZoom] = useState(0.8);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [pageTemplates, setPageTemplates] = useState<any[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [presets, setPresetsState] = useState<any[]>([]);
  const [isLoadingPresets, setIsLoadingPresets] = useState(true);
  const [activePage, setActivePage] = useState(0);

  // Undo History
  const historyRef = useRef<any[]>([]);
  const pushHistory = useCallback(() => {
    const snap = JSON.stringify({ slots, slotSettings, priceBadge, descConfig, imageConfig, config });
    if (historyRef.current[historyRef.current.length - 1] === snap) return;
    historyRef.current.push(snap);
    if (historyRef.current.length > 30) historyRef.current.shift();
  }, [slots, slotSettings, priceBadge, descConfig, imageConfig, config]);

  const undo = useCallback(() => {
    if (historyRef.current.length <= 1) {
      toast.info('Nada para desfazer');
      return;
    }
    historyRef.current.pop(); // Remove current
    const last = JSON.parse(historyRef.current[historyRef.current.length - 1]);
    setSlots(last.slots);
    setSlotSettings(last.slotSettings);
    setPriceBadge(last.priceBadge);
    setDescConfig(last.descConfig);
    setImageConfig(last.imageConfig);
    setConfig(last.config);
    toast.success('Desfeito!');
  }, []);

  useEffect(() => {
    const handleUndoKeys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', handleUndoKeys);
    return () => window.removeEventListener('keydown', handleUndoKeys);
  }, [undo]);

  const fetchPresets = useCallback(async () => {
    try {
      const { data } = await supabase.from('settings').select('value').eq('key', 'offer_generator_presets').maybeSingle();
      if (data?.value) setPresetsState(JSON.parse(data.value));
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
        const { data: tData } = await supabase.from('settings').select('value').eq('key', 'offer_generator_page_templates').maybeSingle();
        if (tData?.value) setPageTemplates(JSON.parse(tData.value));
        const { data: sData } = await supabase.from('settings').select('value').eq('key', 'offer_generator_slot_settings').maybeSingle();
        if (sData?.value) setSlotSettings(JSON.parse(sData.value));
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
    const newTemplate = { id: crypto.randomUUID(), name, slots, slotSettings, priceBadge, descConfig, config };
    const updated = [...pageTemplates, newTemplate];
    setPageTemplates(updated);
    await supabase.from('settings').upsert({ key: 'offer_generator_page_templates', value: JSON.stringify(updated) });
    toast.success('Template salvo!');
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
    const updated = { ...slotSettings, [index]: { ...(slotSettings[index] || {}), ...p } };
    setSlotSettings(updated);
    await supabase.from('settings').upsert({ key: 'offer_generator_slot_settings', value: JSON.stringify(updated) });
  };

  const replaceSlotSettings = async (index: number, settings: any) => {
    const updated = { ...slotSettings, [index]: settings };
    setSlotSettings(updated);
    await supabase.from('settings').upsert({ key: 'offer_generator_slot_settings', value: JSON.stringify(updated) });
  };

  const getSlotSettings = (index: number) => {
    const s = slotSettings[index] || {};
    return {
      priceBadge: { ...priceBadge, ...(s.priceBadge || {}) },
      descConfig: { ...descConfig, ...(s.descConfig || {}) },
      imageConfig: { ...imageConfig, ...(s.imageConfig || {}) },
    };
  };

  const syncAllSlots = async (unused: any, sourceIdx: number) => {
    try {
      const totalSlots = (pageCount || 1) * (slots?.length || 12);
      const sourceStyle = getSlotSettings(sourceIdx);
      
      const pTemplates: Record<number, any> = {};
      for (let i = 0; i < slots.length; i++) {
          const globalIdx = activePage * slots.length + i;
          pTemplates[i] = JSON.parse(JSON.stringify(getSlotSettings(globalIdx)));
      }

      const newSettings: Record<number, any> = {};
      for (let i = 0; i < totalSlots; i++) {
          const slotTypeIdx = i % slots.length;
          const layout = pTemplates[slotTypeIdx];
          
          newSettings[i] = {
              priceBadge: {
                  ...layout.priceBadge,
                  bgColor: sourceStyle.priceBadge.bgColor,
                  valueColor: sourceStyle.priceBadge.valueColor,
                  currencyColor: sourceStyle.priceBadge.currencyColor,
                  suffixColor: sourceStyle.priceBadge.suffixColor,
                  badgeImageUrl: sourceStyle.priceBadge.badgeImageUrl,
                  currencyFontFamily: sourceStyle.priceBadge.currencyFontFamily,
                  valueFontFamily: sourceStyle.priceBadge.valueFontFamily,
                  borderRadius: sourceStyle.priceBadge.borderRadius,
              },
              descConfig: {
                  ...layout.descConfig,
                  color: sourceStyle.descConfig.color,
                  bgColor: sourceStyle.descConfig.bgColor,
                  showBg: sourceStyle.descConfig.showBg,
                  fontFamily: sourceStyle.descConfig.fontFamily,
                  uppercase: sourceStyle.descConfig.uppercase,
              },
              imageConfig: { ...layout.imageConfig }
          };
      }
      
      setSlotSettings(newSettings);
      setPriceBadge(JSON.parse(JSON.stringify(sourceStyle.priceBadge)));
      setDescConfig(JSON.parse(JSON.stringify(sourceStyle.descConfig)));
      
      await Promise.all([
        supabase.from('settings').upsert({ key: 'offer_generator_slot_settings', value: JSON.stringify(newSettings) }),
        supabase.from('settings').upsert({ key: 'offer_generator_price_badge', value: JSON.stringify(sourceStyle.priceBadge) }),
        supabase.from('settings').upsert({ key: 'offer_generator_desc_config', value: JSON.stringify(sourceStyle.descConfig) })
      ]);

      toast.success('Visual sincronizado em todas as telas!');
    } catch (err) {
      console.error('Sync Error:', err);
      toast.error('Erro ao sincronizar');
    }
  };

  const setPresets = async (newPresets: any[] | ((prev: any[]) => any[])) => {
    const updated = typeof newPresets === 'function' ? newPresets(presets) : newPresets;
    setPresetsState(updated);
    await supabase.from('settings').upsert({ key: 'offer_generator_presets', value: JSON.stringify(updated) });
  };

  const updateConfig = (p: Partial<ArtBoardConfig>) => setConfig(prev => ({ ...prev, ...p }));
  const updatePriceBadge = (p: Partial<PriceBadgeConfig>) => setPriceBadge(prev => ({ ...prev, ...p }));
  const updateDescConfig = (p: Partial<DescriptionConfig>) => setDescConfig(prev => ({ ...prev, ...p }));
  const updateImageConfig = (p: Partial<ImageConfig>) => setImageConfig(prev => ({ ...prev, ...p }));

  return (
    <OfferContext.Provider value={{
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
      pageTemplates, saveProjectTemplate, loadProjectTemplate, isLoadingTemplates,
      getSlotSettings,
      updateSlotSettings,
      replaceSlotSettings,
      syncAllSlots,
      activePage, setActivePage,
      undo, pushHistory
    }}>
      {children}
    </OfferContext.Provider>
  );
};

export const useOffer = () => {
  const ctx = useContext(OfferContext);
  if (!ctx) throw new Error('useOffer must be used within OfferProvider');
  return ctx;
};
