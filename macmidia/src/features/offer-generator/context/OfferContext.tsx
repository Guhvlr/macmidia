import React, { createContext, useContext, useState } from 'react';

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
  badgeOffsetX: number;  // % position within slot
  badgeOffsetY: number;
  // "R$"
  currencyFontSize: number;
  currencyOffsetX: number;
  currencyOffsetY: number;
  currencyColor: string;
  currencyFontFamily: string;
  // Value (ex: 2,79)
  valueFontSize: number;
  valueOffsetX: number;
  valueOffsetY: number;
  valueColor: string;
  valueFontFamily: string;
  // Suffix ("cada", "un", "kg")
  suffixText: string;
  suffixFontSize: number;
  suffixOffsetX: number;
  suffixOffsetY: number;
  suffixColor: string;
  showSuffix: boolean;
  // Fallback
  bgColor: string;
  borderRadius: number;
}

export interface DescriptionConfig {
  fontFamily: string;
  fontSize: number;
  color: string;
  bgColor: string;
  showBg: boolean;
  offsetX: number;   // % position within slot
  offsetY: number;
  maxChars: number;
  uppercase: boolean;
}

export interface ImageConfig {
  scale: number;
  offsetX: number;  // % position within slot
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
  updateConfig: (p: Partial<ArtBoardConfig>) => void;
  slots: Slot[];
  setSlots: React.Dispatch<React.SetStateAction<Slot[]>>;
  selectedSlotId: string | null;
  setSelectedSlotId: React.Dispatch<React.SetStateAction<string | null>>;
  pageCount: number;
  setPageCount: React.Dispatch<React.SetStateAction<number>>;
  priceBadge: PriceBadgeConfig;
  updatePriceBadge: (p: Partial<PriceBadgeConfig>) => void;
  descConfig: DescriptionConfig;
  updateDescConfig: (p: Partial<DescriptionConfig>) => void;
  imageConfig: ImageConfig;
  updateImageConfig: (p: Partial<ImageConfig>) => void;
  products: ProductItem[];
  setProducts: React.Dispatch<React.SetStateAction<ProductItem[]>>;
  layouts: any[];
  setLayouts: React.Dispatch<React.SetStateAction<any[]>>;
  customFonts: { name: string; url: string }[];
  setCustomFonts: React.Dispatch<React.SetStateAction<{ name: string; url: string }[]>>;
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
  showSuffix: false,
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

  const updateConfig = (p: Partial<ArtBoardConfig>) => setConfig(prev => ({ ...prev, ...p }));
  const updatePriceBadge = (p: Partial<PriceBadgeConfig>) => setPriceBadge(prev => ({ ...prev, ...p }));
  const updateDescConfig = (p: Partial<DescriptionConfig>) => setDescConfig(prev => ({ ...prev, ...p }));
  const updateImageConfig = (p: Partial<ImageConfig>) => setImageConfig(prev => ({ ...prev, ...p }));

  return (
    <OfferContext.Provider value={{
      step, setStep, config, updateConfig,
      slots, setSlots, selectedSlotId, setSelectedSlotId,
      pageCount, setPageCount,
      priceBadge, updatePriceBadge,
      descConfig, updateDescConfig,
      imageConfig, updateImageConfig,
      products, setProducts, layouts, setLayouts,
      customFonts, setCustomFonts,
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
