import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useOffer, PriceBadgeConfig, DescriptionConfig, ImageConfig } from '../context/OfferContext';
import { ChevronDown, ChevronRight, Zap, Layers, CreditCard, PenTool, Layout, ChevronLeft, Trash2, Hand, Maximize, Image as ImageIcon, Undo2, Save, CheckCircle, Upload, Plus, Minus, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';

type ElemId = 'image' | 'name' | 'badge' | 'currency' | 'value' | 'suffix';

const COLOR_PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#000000', '#FFFFFF', '#64748B'];

// SVG generator for complex badge shapes
const generateShapeSvg = (type: string, color: string): string => {
  const paths: Record<string, string> = {
    splash: `<path d="M100 5L118 72L185 55L138 100L185 145L118 128L100 195L82 128L15 145L62 100L15 55L82 72Z" fill="${color}"/>`,
    star: `<path d="M100 10L123 75L195 75L137 115L155 185L100 145L45 185L63 115L5 75L77 75Z" fill="${color}"/>`,
    diamond: `<path d="M100 5L195 100L100 195L5 100Z" fill="${color}"/>`,
    hexagon: `<path d="M100 5L183 50L183 150L100 195L17 150L17 50Z" fill="${color}"/>`,
  };
  if (!paths[type]) return '';
  return `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">${paths[type]}</svg>`)}`;
};

interface StandardIcon {
  id: string;
  name: string;
  isComplex: boolean;
  config: Partial<PriceBadgeConfig>;
}

const STANDARD_ICONS: StandardIcon[] = [
  { id: 'rectangle', name: 'Retangular', isComplex: false, config: { badgeWidth: 320, badgeHeight: 130, borderRadius: 14, badgeImageUrl: null, badgeType: 'rectangle' } },
  { id: 'circle', name: 'Redondo', isComplex: false, config: { badgeWidth: 200, badgeHeight: 200, borderRadius: 999, badgeImageUrl: null, badgeType: 'circle' } },
  { id: 'square', name: 'Quadrado', isComplex: false, config: { badgeWidth: 180, badgeHeight: 180, borderRadius: 14, badgeImageUrl: null, badgeType: 'square' } },
];

const IconPreview = React.memo(({ type, color, isSelected }: { type: string; color: string; isSelected: boolean }) => {
  const c = color || '#e11d48';
  const shapes: Record<string, React.ReactNode> = {
    rectangle: <rect x="6" y="18" width="40" height="16" rx="3" fill={c} />,
    circle: <circle cx="26" cy="26" r="17" fill={c} />,
    square: <rect x="10" y="10" width="32" height="32" rx="3" fill={c} />,
    pill: <rect x="4" y="19" width="44" height="14" rx="7" fill={c} />,
    splash: <path d="M26 4L30 19L45 15L35 26L45 37L30 33L26 48L22 33L7 37L17 26L7 15L22 19Z" fill={c} />,
    star: <path d="M26 6L31 19L45 19L34 27L38 41L26 33L14 41L18 27L7 19L21 19Z" fill={c} />,
    diamond: <path d="M26 6L46 26L26 46L6 26Z" fill={c} />,
    hexagon: <path d="M26 5L44 15L44 37L26 47L8 37L8 15Z" fill={c} />,
  };
  return (
    <svg width={52} height={52} viewBox="0 0 52 52" className={`rounded-xl transition-all ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-zinc-950' : ''}`}>
      <rect width="52" height="52" rx="10" fill={isSelected ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)'} />
      {shapes[type] || <rect x="8" y="8" width="36" height="36" rx="4" fill={c} />}
    </svg>
  );
});

const FontStyles = React.memo(({ fonts }: { fonts: { name: string; url: string }[] }) => (
  <style dangerouslySetInnerHTML={{ __html: fonts.map(f => `
    @font-face { font-family: '${f.name}'; src: url('${f.url}'); font-display: swap; }
  `).join('\n') }} />
));

const ColorSelector = ({ label, color, onChange }: { label: string; color: string; onChange: (c: string) => void }) => {
  // Normalize color for the native HTML color picker (needs #RRGGBB)
  const normalizedColor = (color && color.startsWith('#') && (color.length === 7 || color.length === 4)) 
    ? (color.length === 4 ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}` : color)
    : '#000000';

  return (
    <div className="space-y-2">
      <label className="text-[9px] font-black uppercase text-white/30 tracking-widest flex items-center justify-between">
        {label} <span className="text-[10px] text-white/60 font-mono">{color?.toUpperCase()}</span>
      </label>
      <div className="flex flex-wrap gap-1.5">
        {COLOR_PALETTE.map(c => (
          <button 
            key={c} 
            onClick={() => onChange(c)} 
            className={`w-4 h-4 rounded-full border border-white/10 transition-all hover:scale-125 ${color === c ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-zinc-950' : ''}`} 
            style={{ backgroundColor: c }} 
          />
        ))}
        <div className="relative w-4 h-4 rounded-full overflow-hidden border border-white/10 group bg-white/5">
          <input 
            type="color" 
            value={normalizedColor} 
            onChange={e => onChange(e.target.value.toUpperCase())} 
            className="absolute inset-0 w-full h-full cursor-pointer scale-150" 
          />
        </div>
      </div>
    </div>
  );
};

const Section = ({ id, label, icon: Icon, isOpen, onToggle, children }: any) => {
  return (
    <div className="border border-zinc-800/60 rounded-2xl bg-zinc-900/30 overflow-hidden mb-3">
      <button onClick={onToggle} className={`w-full p-4 flex items-center justify-between text-left transition-colors ${isOpen ? 'bg-red-500/5' : 'hover:bg-zinc-900/80'}`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl transition-colors ${isOpen ? 'bg-red-600 text-white shadow-md shadow-red-900/20' : 'bg-zinc-800 text-zinc-400'}`}><Icon className="w-4 h-4" /></div>
          <span className="text-[13px] font-semibold text-zinc-300">{label}</span>
        </div>
        {isOpen ? <ChevronDown className="w-4 h-4 text-red-400" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />}
      </button>
      {isOpen && <div className="p-4 pt-0 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">{children}</div>}
    </div>
  );
};

const DragBox = ({ id, children, el, isPrimary, isSel, onStartDrag, onStartResize, slotIdx, zoom, isDragging }: any) => {
  const hSize = Math.max(16, 22 / zoom); 
  return (
    <g>
      <rect x={el.x} y={el.y} width={el.w} height={el.h} fill="rgba(0,0,0,0.001)" style={{ cursor: 'move' }} onMouseDown={e => onStartDrag(e, id, slotIdx)} />
      {children}
      {isSel && (
        <>
          <rect x={el.x-1} y={el.y-1} width={el.w+2} height={el.h+2} fill="none" stroke={isPrimary ? "#ef4444" : "rgba(239,68,68,0.4)"} strokeWidth={isPrimary ? 3/zoom : 1/zoom} rx={3} pointerEvents="none" />
          {isPrimary && !isDragging && (
            <g transform={`translate(${el.x + el.w}, ${el.y + el.h})`} onMouseDown={e => { e.stopPropagation(); onStartResize(e, id); }} style={{ cursor: 'nwse-resize' }}>
               <circle r={hSize / 2} fill="#ef4444" stroke="white" strokeWidth={2/zoom} />
               <circle r={hSize / 1.1} fill="rgba(239,68,68,0.15)" />
            </g>
          )}
        </>
      )}
    </g>
  );
};

export const StepPriceBadge = () => {
  const { 
    priceBadge, updatePriceBadge, descConfig, updateDescConfig, imageConfig, updateImageConfig,
    slots, pageCount, config, selectedSlotIndex, setSelectedSlotIndex,
    selectedSlotIndices, setSelectedSlotIndices, zoom, setZoom,
    panOffset, setPanOffset, getSlotSettings, updateSlotSettings, replaceSlotSettings, syncAllSlots,
    undo, pushHistory, products, customFonts, presets, setPresets, activePage, setActivePage,
    selectedClientName
  } = useOffer();

  const filteredPresets = React.useMemo(() => {
    return (presets || []).filter(p => p.client === selectedClientName || !p.client);
  }, [presets, selectedClientName]);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [selectedElems, setSelectedElems] = useState<ElemId[]>([]);
  const [selectedElem, setSelectedElem] = useState<ElemId | null>(null);
  const [dragging, setDragging] = useState<ElemId | null>(null);
  const [dragOff, setDragOff] = useState({ x: 0, y: 0 });
  const [resizing, setResizing] = useState<ElemId | null>(null);
  const [resizeStart, setResizeStart] = useState({ sx: 0, sy: 0, ow: 0, oh: 0 });
  const [dragState, setDragState] = useState<{ dx: number; dy: number } | null>(null);
  const [resizeState, setResizeState] = useState<{ w: number; h: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, ox: 0, oy: 0 });
  const [openSection, setOpenSection] = useState<string | null>('badge');
  const [clipboard, setClipboard] = useState<any>(null);
  const [marquee, setMarquee] = useState<{ x1: number, y1: number, x2: number, y2: number } | null>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [spacePressed, setSpacePressed] = useState(false);

  // Custom badge icons state — persisted in Supabase Storage + localStorage cache
  const [customBadgeIcons, setCustomBadgeIcons] = useState<{id: string; name: string; imageUrl: string}[]>(() => {
    try { return JSON.parse(localStorage.getItem('macmidia_custom_badge_icons') || '[]'); } catch { return []; }
  });
  const [customIconForm, setCustomIconForm] = useState({ name: '', imageUrl: '', file: null as File | null });
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);
  const [iconToDelete, setIconToDelete] = useState<{ id: string; name: string } | null>(null);

  // Sync localStorage whenever icons change
  useEffect(() => {
    localStorage.setItem('macmidia_custom_badge_icons', JSON.stringify(customBadgeIcons));
  }, [customBadgeIcons]);

  const up = useCallback((updates: any) => {
    pushHistory();
    if (selectedSlotIndices.length > 0) {
      selectedSlotIndices.forEach(idx => updateSlotSettings(idx, updates));
    } else if (selectedSlotIndex !== null) {
      updateSlotSettings(selectedSlotIndex, updates);
    } else {
      if (updates.priceBadge) updatePriceBadge(updates.priceBadge);
      if (updates.descConfig) updateDescConfig(updates.descConfig);
      if (updates.imageConfig) updateImageConfig(updates.imageConfig);
    }
  }, [selectedSlotIndex, selectedSlotIndices, updateSlotSettings, updatePriceBadge, updateDescConfig, updateImageConfig, pushHistory]);

  // Load saved icons from Supabase Storage on mount
  useEffect(() => {
    (async () => {
      try {
        const { data: files, error } = await supabase.storage.from('product-images').list('badge-icons', { limit: 100 });
        if (error || !files || files.length === 0) return;

        const cloudIcons = files
          .filter(f => f.name.endsWith('.png') || f.name.endsWith('.jpg') || f.name.endsWith('.jpeg') || f.name.endsWith('.webp'))
          .map(f => {
            const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(`badge-icons/${f.name}`);
            const nameWithoutExt = f.name.replace(/\.[^.]+$/, '').replace(/^[a-f0-9-]+_/, '');
            return { id: f.name, name: nameWithoutExt || f.name, imageUrl: publicUrl };
          });

        if (cloudIcons.length > 0) {
          setCustomBadgeIcons(cloudIcons);
        }
      } catch (err) {
        console.warn('Falha ao carregar ícones do Supabase:', err);
      }
    })();
  }, []);

  const applyStandardIcon = (icon: StandardIcon) => {
    pushHistory();
    const color = activeCfg.priceBadge.bgColor || '#ef4444';
    const updates: any = { ...icon.config };
    if (icon.isComplex) {
      updates.badgeImageUrl = generateShapeSvg(icon.id, color);
    }
    up({ priceBadge: updates });
    toast.success(`Ícone "${icon.name}" aplicado!`);
  };

  const handleBadgeBgColorChange = (c: string) => {
    const currentType = activeCfg.priceBadge.badgeType;
    const updates: any = { bgColor: c };
    const complexTypes = ['splash', 'star', 'diamond', 'hexagon'];
    if (complexTypes.includes(currentType)) {
      updates.badgeImageUrl = generateShapeSvg(currentType, c);
    }
    up({ priceBadge: updates });
  };

  const handleCustomIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    // Save the actual File for Supabase upload later
    setCustomIconForm(prev => ({ ...prev, file: f }));
    // Preview only
    const r = new FileReader();
    r.onloadend = () => setCustomIconForm(prev => ({ ...prev, imageUrl: r.result as string }));
    r.readAsDataURL(f);
  };

  const saveCustomIcon = async () => {
    if (!customIconForm.imageUrl || !customIconForm.file) return;
    setIsUploadingIcon(true);
    try {
      const name = customIconForm.name.trim() || `Ícone ${customBadgeIcons.length + 1}`;
      const fileId = crypto.randomUUID();
      const ext = customIconForm.file.name.split('.').pop() || 'png';
      const fileName = `${fileId}_${name.replace(/[^a-zA-Z0-9À-ú]/g, '_')}.${ext}`;
      const storagePath = `badge-icons/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(storagePath, customIconForm.file, { cacheControl: '31536000', upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(storagePath);

      const newIcon = { id: fileName, name, imageUrl: publicUrl };
      setCustomBadgeIcons(prev => [...prev, newIcon]);
      up({ priceBadge: { badgeImageUrl: publicUrl, badgeType: 'custom' } });
      setCustomIconForm({ name: '', imageUrl: '', file: null });
      setShowCustomForm(false);
      toast.success(`Ícone "${name}" salvo na nuvem!`);
    } catch (err: any) {
      console.error('Erro ao salvar ícone:', err);
      toast.error('Erro ao salvar ícone: ' + (err.message || 'desconhecido'));
    } finally {
      setIsUploadingIcon(false);
    }
  };

  const applyCustomIcon = (icon: { id: string; name: string; imageUrl: string }) => {
    pushHistory();
    up({ priceBadge: { badgeImageUrl: icon.imageUrl, badgeType: 'custom' } });
    toast.success(`Ícone "${icon.name}" aplicado!`);
  };

  const deleteCustomIcon = async (id: string) => {
    try {
      // Remove from Supabase Storage
      await supabase.storage.from('product-images').remove([`badge-icons/${id}`]);
      setCustomBadgeIcons(prev => prev.filter(i => i.id !== id));
      toast.success('Ícone removido');
    } catch (err) {
      console.warn('Erro ao remover ícone:', err);
      setCustomBadgeIcons(prev => prev.filter(i => i.id !== id));
      toast.success('Ícone removido localmente');
    }
  };

  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey)) {
        if (e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
        if (e.key.toLowerCase() === 'c' && selectedSlotIndex !== null) {
          e.preventDefault();
          setClipboard(getSlotSettings(selectedSlotIndex));
          toast.success('Estilo copiado!');
        }
        if (e.key.toLowerCase() === 'v' && clipboard && selectedSlotIndices.length > 0) {
          e.preventDefault();
          pushHistory();
          selectedSlotIndices.forEach(idx => updateSlotSettings(idx, clipboard));
          toast.success('Estilo colado!');
        }
        if (e.key.toLowerCase() === 'a' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          const pIndices: number[] = [];
          const productStartIdx = slots.filter(s => (s.pageIndex || 0) < activePage).length;
          const pageSlotsCount = slots.filter(s => (s.pageIndex || 0) === activePage).length;
          for (let i = 0; i < pageSlotsCount; i++) pIndices.push(productStartIdx + i);
          setSelectedSlotIndices(pIndices);
          setSelectedSlotIndex(pIndices[0] ?? null);
          setSelectedElems(['badge', 'image', 'name', 'currency', 'value', 'suffix']);
          toast.success('Todos selecionados');
        }
      }
    };
    const handleSpaceDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        if (!spacePressed) {
          e.preventDefault();
          setSpacePressed(true);
        }
      }
    };
    const handleSpaceUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpacePressed(false);
    };

    window.addEventListener('keydown', handleKeys);
    window.addEventListener('keydown', handleSpaceDown);
    window.addEventListener('keyup', handleSpaceUp);
    return () => {
      window.removeEventListener('keydown', handleKeys);
      window.removeEventListener('keydown', handleSpaceDown);
      window.removeEventListener('keyup', handleSpaceUp);
    };
  }, [undo, selectedSlotIndex, selectedSlotIndices, clipboard, getSlotSettings, updateSlotSettings, pushHistory, presets, activePage, slots.length, setSelectedSlotIndices, setSelectedSlotIndex, spacePressed]);

  const toSvg = useCallback((e: React.MouseEvent) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: (e.clientX - r.left) * config.width / r.width, y: (e.clientY - r.top) * config.height / r.height };
  }, [config.width, config.height]);

  const activeCfg = useMemo(() => selectedSlotIndex === null ? { priceBadge, descConfig, imageConfig } : getSlotSettings(selectedSlotIndex), [selectedSlotIndex, priceBadge, descConfig, imageConfig, getSlotSettings]);

  const getElems = (slot: any, cfg: any) => {
    const sf = (slot?.width || 500) / 500;
    const b = cfg.priceBadge; const i = cfg.imageConfig; const d = cfg.descConfig;
    return {
      image: { x: slot.x + slot.width * i.offsetX/100 - (slot.width*0.8*i.scale)/2, y: slot.y + slot.height * i.offsetY/100 - (slot.height*0.6*i.scale)/2, w: slot.width*0.8*i.scale, h: slot.height*0.6*i.scale },
      name: { x: slot.x + slot.width * d.offsetX/100 - slot.width*0.4, y: slot.y + slot.height * d.offsetY/100 - (d.fontSize*sf)/2, w: slot.width*0.8, h: d.fontSize*sf*1.5 },
      badge: { x: slot.x + (b.badgeOffsetX/100)*slot.width - (b.badgeWidth*sf)/2, y: slot.y + (b.badgeOffsetY/100)*slot.height - (b.badgeHeight*sf)/2, w: b.badgeWidth*sf, h: b.badgeHeight*sf },
      currency: { x: slot.x + (b.badgeOffsetX/100)*slot.width - (b.badgeWidth*sf)/2 + (b.badgeWidth*sf) * b.currencyOffsetX/100 - (b.currencyFontSize*sf)*0.75, y: slot.y + (b.badgeOffsetY/100)*slot.height - (b.badgeHeight*sf)/2 + (b.badgeHeight*sf) * b.currencyOffsetY/100 - (b.currencyFontSize*sf)*0.6, w: (b.currencyFontSize*sf)*1.5, h: (b.currencyFontSize*sf)*1.2 },
      value: { x: slot.x + (b.badgeOffsetX/100)*slot.width - (b.badgeWidth*sf)/2 + (b.badgeWidth*sf) * b.valueOffsetX/100 - (b.valueFontSize*sf), y: slot.y + (b.badgeOffsetY/100)*slot.height - (b.badgeHeight*sf)/2 + (b.badgeHeight*sf) * b.valueOffsetY/100 - (b.valueFontSize*sf)*0.6, w: (b.valueFontSize*sf)*2, h: (b.valueFontSize*sf)*1.2 },
      suffix: { x: slot.x + (b.badgeOffsetX/100)*slot.width - (b.badgeWidth*sf)/2 + (b.badgeWidth*sf) * b.suffixOffsetX/100 - (b.suffixFontSize*sf)*1.5, y: slot.y + (b.badgeOffsetY/100)*slot.height - (b.badgeHeight*sf)/2 + (b.badgeHeight*sf) * b.suffixOffsetY/100 - (b.suffixFontSize*sf)*0.6, w: (b.suffixFontSize*sf)*3, h: (b.suffixFontSize*sf)*1.2 },
      sFactor: sf
    };
  };

  const onSelect = (id: ElemId, idx: number, isShift?: boolean) => {
    const isAlreadySelected = selectedElems.includes(id) && selectedSlotIndices.includes(idx);
    
    if (isShift) {
       setSelectedElems(prev => prev.includes(id) ? (prev.length > 1 ? prev.filter(x => x !== id) : prev) : [...prev, id]); 
       setSelectedSlotIndices(prev => prev.includes(idx) ? (prev.length > 1 ? prev.filter(x => x !== idx) : prev) : [...prev, idx]);
       setSelectedSlotIndex(idx);
       setSelectedElem(id);
    } else if (!isAlreadySelected) { 
      // Only reset selection if we click something NOT already in the selection
      setSelectedSlotIndex(idx); 
      setSelectedElem(id);
      setSelectedElems([id]); 
      setSelectedSlotIndices([idx]); 
    } else {
      // If already selected, just make it the primary focus for the panel
      setSelectedSlotIndex(idx);
      setSelectedElem(id);
    }
  };

  const onStartDrag = (e: any, id: ElemId, idx: number) => {
    if (e.button !== 0) return; e.preventDefault(); e.stopPropagation();
    onSelect(id, idx, e.shiftKey); pushHistory(); setDragging(id);
    const c = toSvg(e); 
    const ps = slots[idx];
    const el = (getElems(ps, getSlotSettings(idx)) as any)[id];
    setDragOff({ x: c.x - el.x, y: c.y - el.y }); setDragState({ dx: 0, dy: 0 });
  };

  const onStartResize = (e: any, id: ElemId) => {
    if (selectedSlotIndex === null) return; e.preventDefault(); e.stopPropagation(); pushHistory(); setResizing(id);
    const c = toSvg(e); const ps = slots[selectedSlotIndex]; const cfg = getSlotSettings(selectedSlotIndex);
    const el = (getElems(ps, cfg) as any)[id]; setResizeStart({ sx: c.x, sy: c.y, ow: el.w, oh: el.h }); setResizeState({ w: el.w, h: el.h });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (isPanning) { setPanOffset({ x: panStart.ox + (e.clientX - panStart.x), y: panStart.oy + (e.clientY - panStart.y) }); return; }
    if (!dragging && !resizing) return;
    const c = toSvg(e);
    if (dragging && selectedSlotIndex !== null) {
      const ps = slots[selectedSlotIndex]; const cfg = getSlotSettings(selectedSlotIndex); const el = (getElems(ps, cfg) as any)[dragging];
      setDragState({ dx: c.x - dragOff.x - el.x, dy: c.y - dragOff.y - el.y });
    }
    if (resizing) setResizeState({ w: Math.max(30, resizeStart.ow + (c.x - resizeStart.sx)), h: Math.max(10, resizeStart.oh + (c.y - resizeStart.sy)) });
    if (marquee) setMarquee(prev => prev ? ({ ...prev, x2: c.x, y2: c.y }) : null);
  };

  const onMouseUp = (e: React.MouseEvent) => {
    if (isPanning) { setIsPanning(false); return; }
    if (marquee) {
      const x = Math.min(marquee.x1, marquee.x2); const y = Math.min(marquee.y1, marquee.y2);
      const w = Math.abs(marquee.x1 - marquee.x2); const h = Math.abs(marquee.y1 - marquee.y2);
      const isShift = e.shiftKey || e.ctrlKey;
      
      let newSlots = new Set<number>(isShift ? selectedSlotIndices : []);
      let newElems = new Set<ElemId>(isShift ? selectedElems : []);
      let foundAny = false;

      const pageSlots = slots.filter(s => (s.pageIndex || 0) === activePage);
      const productStartIdx = slots.filter(s => (s.pageIndex || 0) < activePage).length;

      pageSlots.forEach((s, i) => {
        const gIdx = productStartIdx + i;
        const cfg = getSlotSettings(gIdx);
        const elMap = getElems(s, cfg);
        (['image', 'name', 'badge', 'currency', 'value', 'suffix'] as ElemId[]).forEach(id => {
          const el = (elMap as any)[id];
          if (!el) return;
          // Intersection check
          if (!(el.x + el.w < x || el.x > x + w || el.y + el.h < y || el.y > y + h)) {
            newSlots.add(gIdx);
            newElems.add(id);
            foundAny = true;
          }
        });
      });

      if (foundAny || !isShift) {
        setSelectedSlotIndices(Array.from(newSlots));
        setSelectedElems(Array.from(newElems));
        if (newSlots.size > 0) setSelectedSlotIndex(Array.from(newSlots)[0]);
        if (newElems.size > 0) setSelectedElem(Array.from(newElems)[0]);
      }
      setMarquee(null);
      return;
    }
    if (dragState && selectedSlotIndex !== null) {
      const { dx, dy } = dragState;
      selectedSlotIndices.forEach(idx => {
        const ps = slots[idx]; const cfg = getSlotSettings(idx); let updates: any = {};
        selectedElems.forEach(id => {
          if (id === 'image') updates.imageConfig = { ...cfg.imageConfig, offsetX: cfg.imageConfig.offsetX + (dx/ps.width)*100, offsetY: cfg.imageConfig.offsetY + (dy/ps.height)*100 };
          else if (id === 'name') updates.descConfig = { ...cfg.descConfig, offsetX: cfg.descConfig.offsetX + (dx/ps.width)*100, offsetY: cfg.descConfig.offsetY + (dy/ps.height)*100 };
          else if (id === 'badge') updates.priceBadge = { ...cfg.priceBadge, badgeOffsetX: cfg.priceBadge.badgeOffsetX + (dx/ps.width)*100, badgeOffsetY: cfg.priceBadge.badgeOffsetY + (dy/ps.height)*100 };
          else {
            const bw = cfg.priceBadge.badgeWidth * (ps.width/500); const bh = cfg.priceBadge.badgeHeight * (ps.width/500);
            if (id === 'currency') updates.priceBadge = { ...(updates.priceBadge || cfg.priceBadge), currencyOffsetX: cfg.priceBadge.currencyOffsetX + (dx/bw)*100, currencyOffsetY: cfg.priceBadge.currencyOffsetY + (dy/bh)*100 };
            else if (id === 'value') updates.priceBadge = { ...(updates.priceBadge || cfg.priceBadge), valueOffsetX: cfg.priceBadge.valueOffsetX + (dx/bw)*100, valueOffsetY: cfg.priceBadge.valueOffsetY + (dy/bh)*100 };
            else if (id === 'suffix') updates.priceBadge = { ...(updates.priceBadge || cfg.priceBadge), suffixOffsetX: cfg.priceBadge.suffixOffsetX + (dx/bw)*100, suffixOffsetY: cfg.priceBadge.suffixOffsetY + (dy/bh)*100 };
          }
        });
        updateSlotSettings(idx, updates);
      });
    }
    if (resizeState && selectedSlotIndex !== null) {
      const { w } = resizeState; 
      const kf = w / resizeStart.ow;
      
      selectedSlotIndices.forEach(idx => {
        const c = getSlotSettings(idx);
        let up: any = {};
        selectedElems.forEach(id => {
           if (id === 'image') up.imageConfig = { ...c.imageConfig, scale: c.imageConfig.scale * kf };
           else if (id === 'name') up.descConfig = { ...c.descConfig, fontSize: c.descConfig.fontSize * kf };
           else if (id === 'badge') up.priceBadge = { ...c.priceBadge, badgeWidth: Math.round(c.priceBadge.badgeWidth * kf), badgeHeight: Math.round(c.priceBadge.badgeHeight * kf) };
           else if (id === 'currency') up.priceBadge = { ...(up.priceBadge || c.priceBadge), currencyFontSize: (up.priceBadge?.currencyFontSize || c.priceBadge.currencyFontSize) * kf };
           else if (id === 'value') up.priceBadge = { ...(up.priceBadge || c.priceBadge), valueFontSize: (up.priceBadge?.valueFontSize || c.priceBadge.valueFontSize) * kf };
           else if (id === 'suffix') up.priceBadge = { ...(up.priceBadge || c.priceBadge), suffixFontSize: (up.priceBadge?.suffixFontSize || c.priceBadge.suffixFontSize) * kf };
        });
        updateSlotSettings(idx, up);
      });
    }
    setDragging(null); setResizing(null); setDragState(null); setResizeState(null); 
  };



  const renderTextWrap = (text: string, x: number, y: number, fontSize: number) => {
    const words = (text||"").split(' '); const lines: string[] = []; let cur = '';
    words.forEach(w => { if ((cur+w).length > 18) { lines.push(cur.trim()); cur = w+' '; } else { cur += w+' '; } }); lines.push(cur.trim());
    const lh = fontSize * 1.1; const th = lines.length * lh; const sy = y - (th/2) + (lh/2);
    return lines.map((l, i) => <tspan key={i} x={x} y={sy+i*lh}>{l}</tspan>);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) return; 
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    setZoom(prev => Math.min(3, Math.max(0.1, prev + delta)));
  };

  return (
    <div className="h-full flex overflow-hidden bg-zinc-950 text-zinc-100">
      <FontStyles fonts={customFonts} />
      <div className="w-[380px] bg-zinc-950 border-r border-zinc-800/60 p-8 overflow-y-auto custom-scrollbar flex flex-col gap-6 select-none">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/10 text-red-500 rounded-full text-[10px] font-semibold mb-3">
             <PenTool className="w-3.5 h-3.5" /> Passo 3
           </div>
          <h2 className="text-xl font-semibold tracking-tight text-zinc-100">Estilos & Preços</h2>
          <p className="text-[12px] text-zinc-400 font-medium mt-1">Configure o visual das etiquetas e textos dos produtos.</p>
        </div>
        
        {/* Sync Button */}
        <button
          onClick={() => setSyncModalOpen(true)}
          className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-all shadow-md shadow-indigo-900/20 flex items-center justify-center gap-2 group border border-indigo-500/30"
        >
          <Zap className="w-4 h-4 text-indigo-200 group-hover:scale-125 transition-transform" />
          SINCRONIZAÇÃO MESTRE
        </button>

        <div className="flex flex-col gap-3">
          <Section label={`Modelos: ${selectedClientName || 'Geral'}`} icon={Zap} isOpen={openSection === 'presets'} onToggle={() => setOpenSection('presets')}>
             <button onClick={() => setSaveModalOpen(true)} className="w-full p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400 text-[12px] font-semibold hover:bg-blue-500/20 transition-all"><Save className="w-4 h-4 inline mr-2" /> Salvar Modelo</button>
             {filteredPresets?.map((p: any) => (
                <div key={p.id} className="group flex items-center gap-2 p-2 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:border-blue-500/40 transition-all">
                   <button onClick={() => up({ priceBadge: p.priceBadge, descConfig: p.descConfig })} className="flex-1 text-[12px] text-zinc-400 group-hover:text-zinc-200 text-left px-3 truncate font-medium">{p.name}</button>
                   <button onClick={() => setPresets(presets.filter((x: any) => x.id !== p.id))} className="opacity-0 group-hover:opacity-100 p-2 hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
             ))}
          </Section>
          <Section label="Ícone de Preço" icon={Layers} isOpen={openSection === 'badge'} onToggle={() => setOpenSection('badge')}>
             <div className="space-y-4">
               <Tabs defaultValue="standard" className="w-full">
                 <TabsList className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl h-10 p-1 grid grid-cols-2">
                   <TabsTrigger value="standard" className="rounded-lg text-[11px] font-semibold data-[state=active]:bg-red-600 data-[state=active]:text-white text-zinc-500 transition-all h-full">Padrões</TabsTrigger>
                   <TabsTrigger value="custom" className="rounded-lg text-[11px] font-semibold data-[state=active]:bg-red-600 data-[state=active]:text-white text-zinc-500 transition-all h-full">Custom</TabsTrigger>
                 </TabsList>

                 <TabsContent value="standard" className="mt-4 space-y-3">
                   <div className="grid grid-cols-4 gap-2">
                     {STANDARD_ICONS.map(icon => (
                       <button
                         key={icon.id}
                         onClick={() => applyStandardIcon(icon)}
                         className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all hover:scale-105 ${
                           activeCfg.priceBadge.badgeType === icon.id
                             ? 'border-red-500 bg-red-500/10 shadow-md shadow-red-900/20'
                             : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-800'
                         }`}
                       >
                         <IconPreview type={icon.id} color={activeCfg.priceBadge.bgColor} isSelected={activeCfg.priceBadge.badgeType === icon.id} />
                         <span className={`text-[10px] font-semibold tracking-wide ${activeCfg.priceBadge.badgeType === icon.id ? 'text-red-400' : 'text-zinc-500'}`}>{icon.name}</span>
                       </button>
                     ))}
                   </div>
                 </TabsContent>

                 <TabsContent value="custom" className="mt-4 space-y-3">
                   {/* Saved custom icons grid */}
                   {customBadgeIcons.length > 0 && (
                     <div className="grid grid-cols-3 gap-2">
                       {customBadgeIcons.map(icon => (
                         <div
                           key={icon.id}
                           className={`relative group flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all cursor-pointer ${
                             activeCfg.priceBadge.badgeType === 'custom' && activeCfg.priceBadge.badgeImageUrl === icon.imageUrl
                               ? 'border-red-500 bg-red-500/10'
                               : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-700'
                           }`}
                           onClick={() => applyCustomIcon(icon)}
                         >
                           <img src={icon.imageUrl} alt={icon.name} className="w-12 h-12 object-contain rounded-lg" />
                           <span className="text-[10px] font-medium text-zinc-400 truncate w-full text-center">{icon.name}</span>
                           <button
                             onClick={(e) => { e.stopPropagation(); setIconToDelete({ id: icon.id, name: icon.name }); }}
                             className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                           >
                             <X className="w-3.5 h-3.5 text-white" />
                           </button>
                         </div>
                       ))}
                     </div>
                   )}

                   {/* Add new custom icon */}
                   {!showCustomForm ? (
                     <button
                       onClick={() => setShowCustomForm(true)}
                       className="w-full p-4 bg-zinc-900/30 border border-dashed border-zinc-700 rounded-xl hover:bg-zinc-800 hover:border-red-500/50 transition-all flex items-center justify-center gap-2 text-zinc-400 hover:text-red-400"
                     >
                       <Plus className="w-4 h-4" />
                       <span className="text-[12px] font-semibold">Adicionar novo ícone</span>
                     </button>
                   ) : (
                     <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                       <div className="flex items-center justify-between">
                         <span className="text-[12px] font-semibold text-zinc-300">Novo Ícone</span>
                         <button onClick={() => { setShowCustomForm(false); setCustomIconForm({ name: '', imageUrl: '', file: null }); }} className="p-1 hover:bg-zinc-800 rounded-lg transition-colors"><X className="w-4 h-4 text-zinc-500" /></button>
                       </div>

                       {customIconForm.imageUrl ? (
                         <div className="flex items-center gap-3 p-2 bg-zinc-950 rounded-xl border border-zinc-800">
                           <img src={customIconForm.imageUrl} alt="preview" className="w-14 h-14 object-contain rounded-lg bg-zinc-900 p-1" />
                           <button onClick={() => setCustomIconForm(prev => ({ ...prev, imageUrl: '' }))} className="text-[11px] text-red-400 hover:text-red-300 font-semibold px-2">Trocar</button>
                         </div>
                       ) : (
                         <>
                           <input type="file" accept="image/*" onChange={handleCustomIconUpload} className="hidden" id="custom-badge-up" />
                           <label htmlFor="custom-badge-up" className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl hover:bg-red-500/20 transition-all text-red-400 font-semibold text-[12px] cursor-pointer justify-center">
                             <Upload className="w-4 h-4" /> Fazer Upload de Ícone
                           </label>
                         </>
                       )}

                       <input
                         type="text"
                         value={customIconForm.name}
                         onChange={e => setCustomIconForm(prev => ({ ...prev, name: e.target.value }))}
                         placeholder="Nome do ícone..."
                         className="w-full bg-zinc-950 border border-zinc-800 rounded-xl h-10 px-4 text-[12px] font-medium text-zinc-100 outline-none focus:border-red-500/50 transition-all placeholder:text-zinc-600"
                       />

                       <button
                         onClick={saveCustomIcon}
                         disabled={!customIconForm.imageUrl || isUploadingIcon}
                         className="w-full p-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[12px] font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-md shadow-red-900/20"
                       >
                         {isUploadingIcon ? <Loader2 className="w-4 h-4 inline mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 inline mr-2" />} {isUploadingIcon ? 'Enviando...' : 'Salvar e Aplicar'}
                       </button>
                     </div>
                   )}
                 </TabsContent>
               </Tabs>

               {/* Color and radius controls (always visible) */}
               <div className="pt-4 border-t border-zinc-800/50 space-y-4">
                 <ColorSelector label="Cor do Fundo" color={activeCfg.priceBadge.bgColor} onChange={handleBadgeBgColorChange} />
                 <div className="space-y-2">
                   <label className="text-[11px] font-semibold text-zinc-500 flex justify-between">Arredondamento <span>{activeCfg.priceBadge.borderRadius}px</span></label>
                   <input type="range" min="0" max="60" value={activeCfg.priceBadge.borderRadius} onChange={e => up({ priceBadge: { borderRadius: parseInt(e.target.value) } })} className="w-full accent-blue-500 h-1.5 bg-zinc-800 rounded-full" />
                 </div>
               </div>
             </div>
          </Section>
          <Section label="Cores dos Textos" icon={CreditCard} isOpen={openSection === 'prices'} onToggle={() => setOpenSection('prices')}>
              <div className="space-y-6">
                 <div className="space-y-4">
                   <ColorSelector label="RS (Moeda)" color={activeCfg.priceBadge.currencyColor} onChange={c => up({ priceBadge: { currencyColor: c } })} />
                   <div className="space-y-2">
                     <label className="text-[11px] font-semibold text-zinc-500 flex justify-between">Tamanho <span>{Math.round(activeCfg.priceBadge.currencyFontSize)}px</span></label>
                     <input type="range" min="10" max="150" value={activeCfg.priceBadge.currencyFontSize} onChange={e => up({ priceBadge: { currencyFontSize: parseInt(e.target.value) } })} className="w-full accent-blue-500 h-1.5 bg-zinc-800 rounded-full" />
                   </div>
                 </div>
                 
                 <div className="space-y-4 border-t border-zinc-800/50 pt-5">
                   <ColorSelector label="Valor Principal" color={activeCfg.priceBadge.valueColor} onChange={c => up({ priceBadge: { valueColor: c } })} />
                   <div className="space-y-2">
                     <label className="text-[11px] font-semibold text-zinc-500 flex justify-between">Tamanho <span>{Math.round(activeCfg.priceBadge.valueFontSize)}px</span></label>
                     <input type="range" min="20" max="250" value={activeCfg.priceBadge.valueFontSize} onChange={e => up({ priceBadge: { valueFontSize: parseInt(e.target.value) } })} className="w-full accent-blue-500 h-1.5 bg-zinc-800 rounded-full" />
                   </div>
                 </div>

                 <Section label="Nome do Produto" icon={PenTool} isOpen={true} onToggle={() => {}} className="border-0 bg-transparent p-0">
                    <div className="space-y-4 pt-5 border-t border-zinc-800/50 mt-5">
                       <select value={activeCfg.descConfig.fontFamily} onChange={e => up({ descConfig: { fontFamily: e.target.value } })} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl h-10 px-3 text-[12px] text-zinc-200 outline-none focus:border-blue-500/50 transition-all"><option value="Montserrat, sans-serif">Montserrat</option>{customFonts.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}</select>
                       <ColorSelector label="Cor do Título" color={activeCfg.descConfig.color} onChange={c => up({ descConfig: { color: c } })} />
                       <div className="space-y-2">
                         <label className="text-[11px] font-semibold text-zinc-500 flex justify-between">Tamanho <span>{Math.round(activeCfg.descConfig.fontSize)}px</span></label>
                         <input type="range" min="10" max="100" value={activeCfg.descConfig.fontSize} onChange={e => up({ descConfig: { fontSize: parseInt(e.target.value) } })} className="w-full accent-blue-500 h-1.5 bg-zinc-800 rounded-full" />
                       </div>
                       <div className="flex items-center gap-3 text-[12px] font-semibold text-zinc-400 mt-2">
                         <input type="checkbox" checked={activeCfg.descConfig.uppercase} onChange={e => up({ descConfig: { uppercase: e.target.checked } })} className="w-4 h-4 accent-blue-500 rounded" /> Letras Maiúsculas
                       </div>
                    </div>
                 </Section>
              </div>
           </Section>
           <Section label="Sufixo (kg/cada)" icon={Layers} isOpen={openSection === 'suffix'} onToggle={() => setOpenSection('suffix')}>
              <div className="space-y-5">
                 <div className="flex items-center justify-between p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
                   <span className="text-[12px] font-semibold text-zinc-300">Mostrar Sufixo</span>
                   <input type="checkbox" checked={activeCfg.priceBadge.showSuffix} onChange={e => up({ priceBadge: { showSuffix: e.target.checked } })} className="w-4 h-4 accent-blue-500 rounded" />
                 </div>
                 <div className="space-y-2">
                   <label className="text-[11px] font-semibold text-zinc-500">Texto do Sufixo</label>
                   <input type="text" value={activeCfg.priceBadge.suffixText} onChange={e => up({ priceBadge: { suffixText: e.target.value } })} placeholder="Ex: cada, kg, un..." className="w-full bg-zinc-900 border border-zinc-800 rounded-xl h-10 px-4 text-[12px] font-medium text-zinc-100 outline-none focus:border-blue-500/50 transition-all font-mono" />
                 </div>
                 <ColorSelector label="Cor do Sufixo" color={activeCfg.priceBadge.suffixColor} onChange={c => up({ priceBadge: { suffixColor: c } })} />
                 <div className="space-y-2">
                   <label className="text-[11px] font-semibold text-zinc-500 flex justify-between">Tamanho <span>{Math.round(activeCfg.priceBadge.suffixFontSize)}px</span></label>
                   <input type="range" min="10" max="100" value={activeCfg.priceBadge.suffixFontSize} onChange={e => up({ priceBadge: { suffixFontSize: parseInt(e.target.value) } })} className="w-full accent-blue-500 h-1.5 bg-zinc-800 rounded-full" />
                 </div>
              </div>
           </Section>
        </div>
      </div>

      <div ref={containerRef} className={`flex-1 overflow-hidden relative bg-zinc-950/80 flex flex-col items-center justify-center p-8 ${isPanning ? 'cursor-grabbing' : spacePressed ? 'cursor-grab' : ''}`} onWheel={handleWheel} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={() => onMouseUp({} as any)} onMouseDown={e => { 
        if (e.button === 1 || (e.button === 0 && spacePressed)) { e.preventDefault(); setIsPanning(true); setPanStart({ x: e.clientX, y: e.clientY, ox: panOffset.x, oy: panOffset.y }); }
        else if (e.button === 0) {
          const c = toSvg(e);
          setMarquee({ x1: c.x, y1: c.y, x2: c.x, y2: c.y });
        }
      }} onClick={e => { if (!dragging && !resizing && !marquee) { setSelectedElems([]); setSelectedSlotIndex(null); setSelectedSlotIndices([]); setSelectedElem(null); } }}>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] opacity-[0.15] z-0 pointer-events-none" />

        <div className="absolute top-6 z-20 flex items-center gap-3 bg-zinc-900/90 backdrop-blur-xl p-2 rounded-2xl border border-zinc-800/80 shadow-2xl select-none max-w-[90%] overflow-hidden" onClick={e => e.stopPropagation()}>
           <button onClick={undo} className="p-2 hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-zinc-100 transition-all shrink-0" title="Desfazer"><Undo2 className="w-4 h-4" /></button>
           
           <div className="flex items-center gap-2 px-3 border-x border-zinc-800">
             <button onClick={() => setActivePage(Math.max(0, activePage-1))} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-200 transition-colors shrink-0">
               <ChevronLeft className="w-4 h-4" />
             </button>
             
             <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-[400px] py-1">
               {Array.from({ length: pageCount }).map((_, i) => (
                 <button
                   key={i}
                   onClick={() => { setActivePage(i); setSelectedSlotIndex(null); setSelectedElem(null); }}
                   className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                     activePage === i
                       ? 'bg-red-600 text-white shadow-sm scale-105'
                       : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                   }`}
                 >
                   {i + 1}
                 </button>
               ))}
             </div>

             <button onClick={() => setActivePage(Math.min(pageCount-1, activePage+1))} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-200 transition-colors shrink-0">
               <ChevronLeft className="w-4 h-4 rotate-180" />
             </button>
             
             <div className="w-px h-4 bg-zinc-800 mx-1 shrink-0" />
             
             <button 
               onClick={() => { if (selectedSlotIndex !== null) syncAllSlots(null, selectedSlotIndex); else toast.info('Selecione um produto para sincronizar seu estilo'); }} 
               className="p-1.5 hover:bg-red-500/10 rounded-lg text-zinc-500 hover:text-red-400 transition-colors shrink-0"
               title="Sincronizar este estilo para todas as telas"
             >
               <Zap className="w-4 h-4" />
             </button>
           </div>
           <div className="flex items-center gap-1.5"><button onClick={() => setZoom(zoom-0.1)} className="w-8 h-8 rounded-lg hover:bg-zinc-800 transition-colors flex items-center justify-center text-zinc-400"><Minus className="w-4 h-4" /></button><span className="text-[11px] font-semibold text-zinc-400 min-w-[40px] text-center">{Math.round(zoom*100)}%</span><button onClick={() => setZoom(zoom+0.1)} className="w-8 h-8 rounded-lg hover:bg-zinc-800 transition-colors flex items-center justify-center text-zinc-400"><Plus className="w-4 h-4" /></button></div>
           <button onClick={() => { setZoom(0.8); setPanOffset({ x: 0, y: 0 }); }} className="p-2 hover:bg-zinc-800 rounded-xl transition-colors" title="Centralizar"><Maximize className="w-4 h-4 text-zinc-400" /></button>
        </div>

        <div className="relative z-10" style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`, transformOrigin: 'center center' }} onMouseDown={e => { if (!spacePressed && e.button !== 1) e.stopPropagation(); }}>
          <svg ref={svgRef} width={config.width} height={config.height} viewBox={`0 0 ${config.width} ${config.height}`} style={{ background: 'white', userSelect: 'none' }} className="shadow-2xl ring-1 ring-zinc-800/50 rounded-lg bg-zinc-900">
            {config.backgroundImageUrl && <image href={config.backgroundImageUrl} width={config.width} height={config.height} preserveAspectRatio="xMidYMin slice" />}
            {(() => {
              const pageSlots = slots.filter(s => (s.pageIndex || 0) === activePage);
              const productStartIdx = slots.filter(s => (s.pageIndex || 0) < activePage).length;
              
              return pageSlots.map((s, idx) => {
                const gIdx = productStartIdx + idx; 
                const cfg = getSlotSettings(gIdx); 
                const el = getElems(s, cfg);
                const isSlotSel = selectedSlotIndices.includes(gIdx);
                const p = products?.[gIdx]; const name = p?.name || "NOME PRODUTO"; const price = p?.price || "10,99";
                const v = { ...el };
                if (isSlotSel && dragState) { selectedElems.forEach(id => { (v as any)[id].x += dragState.dx; (v as any)[id].y += dragState.dy; }); }
                if (isSlotSel && resizeState && resizeStart) { 
                  const kf = resizeState.w / resizeStart.ow;
                  selectedElems.forEach(id => {
                    const el = (v as any)[id];
                    const oldW = el.w; const oldH = el.h;
                    el.w *= kf; el.h *= kf;
                    // Adjust x/y to scale from center/anchor
                    el.x -= (el.w - oldW) / 2;
                    el.y -= (el.h - oldH) / 2;
                  });
                }

                return (
                  <g key={gIdx} onClick={e => e.stopPropagation()}>
                    <rect x={s.x} y={s.y} width={s.width} height={s.height} fill="none" stroke={isSlotSel ? '#ef4444' : 'rgba(0,0,0,0.05)'} strokeWidth={isSlotSel ? 4/zoom : 1/zoom} strokeDasharray={isSlotSel ? 'none' : '4,2'} pointerEvents="none" />
                    
                    <DragBox id="badge" el={v.badge} zoom={zoom} isPrimary={selectedElem === 'badge'} isSel={isSlotSel && selectedElems.includes('badge')} onStartDrag={onStartDrag} onStartResize={onStartResize} slotIdx={gIdx} isDragging={!!dragging}>
                       {cfg.priceBadge.badgeImageUrl ? <image href={cfg.priceBadge.badgeImageUrl} x={v.badge.x} y={v.badge.y} width={v.badge.w} height={v.badge.h} preserveAspectRatio="xMidYMid meet" style={{ borderRadius: cfg.priceBadge.borderRadius + 'px' }} pointerEvents="none" /> 
                                                     : <rect x={v.badge.x} y={v.badge.y} width={v.badge.w} height={v.badge.h} rx={cfg.priceBadge.borderRadius * el.sFactor} fill={cfg.priceBadge.bgColor} pointerEvents="none" />}
                    </DragBox>
                    
                    <DragBox id="image" el={v.image} zoom={zoom} isPrimary={selectedElem === 'image'} isSel={isSlotSel && selectedElems.includes('image')} onStartDrag={onStartDrag} onStartResize={onStartResize} slotIdx={gIdx} isDragging={!!dragging}>
                      <rect x={v.image.x} y={v.image.y} width={v.image.w} height={v.image.h} rx={12} fill="rgba(0,0,0,0.01)" stroke="rgba(239,68,68,0.15)" strokeDasharray="3,3" pointerEvents="none" />
                      {p?.images?.[0] && <image href={p.images[0]} x={v.image.x} y={v.image.y} width={v.image.w} height={v.image.h} preserveAspectRatio="xMidYMid meet" pointerEvents="none" />}
                    </DragBox>
                    
                    <DragBox id="name" el={v.name} zoom={zoom} isPrimary={selectedElem === 'name'} isSel={isSlotSel && selectedElems.includes('name')} onStartDrag={onStartDrag} onStartResize={onStartResize} slotIdx={gIdx} isDragging={!!dragging}>
                      <text x={v.name.x+v.name.w/2} y={v.name.y+v.name.h/2} fontSize={cfg.descConfig.fontSize*el.sFactor} fill={cfg.descConfig.color} fontWeight="800" textAnchor="middle" fontFamily={cfg.descConfig.fontFamily} pointerEvents="none" style={cfg.descConfig.uppercase ? {textTransform:'uppercase'}:{}}>{renderTextWrap(name, v.name.x+v.name.w/2, v.name.y+v.name.h/2, cfg.descConfig.fontSize*el.sFactor)}</text>
                    </DragBox>
                    
                    <DragBox id="currency" el={v.currency} zoom={zoom} isPrimary={selectedElem === 'currency'} isSel={isSlotSel && selectedElems.includes('currency')} onStartDrag={onStartDrag} onStartResize={onStartResize} slotIdx={gIdx} isDragging={!!dragging}>
                      <text x={v.currency.x + v.currency.w/2} y={v.currency.y + v.currency.h/2} fontSize={cfg.priceBadge.currencyFontSize*el.sFactor} fill={cfg.priceBadge.currencyColor} fontWeight="900" textAnchor="middle" dominantBaseline="central" pointerEvents="none">R$</text>
                    </DragBox>
                    
                    <DragBox id="value" el={v.value} zoom={zoom} isPrimary={selectedElem === 'value'} isSel={isSlotSel && selectedElems.includes('value')} onStartDrag={onStartDrag} onStartResize={onStartResize} slotIdx={gIdx} isDragging={!!dragging}>
                      <text x={v.value.x + v.value.w/2} y={v.value.y + v.value.h/2} fontSize={cfg.priceBadge.valueFontSize*el.sFactor} fill={cfg.priceBadge.valueColor} fontWeight="900" textAnchor="middle" dominantBaseline="central" pointerEvents="none">{price}</text>
                    </DragBox>

                    {cfg.priceBadge.showSuffix && (
                      <DragBox id="suffix" el={v.suffix} zoom={zoom} isPrimary={selectedElem === 'suffix'} isSel={isSlotSel && selectedElems.includes('suffix')} onStartDrag={onStartDrag} onStartResize={onStartResize} slotIdx={gIdx} isDragging={!!dragging}>
                        <text x={v.suffix.x + v.suffix.w/2} y={v.suffix.y + v.suffix.h/2} fontSize={cfg.priceBadge.suffixFontSize*el.sFactor} fill={cfg.priceBadge.suffixColor} fontWeight="600" textAnchor="middle" dominantBaseline="central" pointerEvents="none">{cfg.priceBadge.suffixText}</text>
                      </DragBox>
                    )}
                  </g>
                );
              });
            })()}
            {marquee && (
              <rect 
                x={Math.min(marquee.x1, marquee.x2)} 
                y={Math.min(marquee.y1, marquee.y2)} 
                width={Math.abs(marquee.x1 - marquee.x2)} 
                height={Math.abs(marquee.y1 - marquee.y2)} 
                fill="rgba(239,68,68,0.05)" 
                stroke="#ef4444" 
                strokeWidth={2/zoom} 
                strokeDasharray="4,2"
                pointerEvents="none"
              />
            )}
          </svg>
        </div>
      </div>

      <Dialog open={saveModalOpen} onOpenChange={setSaveModalOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 rounded-[24px] shadow-2xl sm:max-w-md p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-lg font-semibold tracking-tight flex items-center gap-3">
               <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                 <Save className="w-5 h-5 text-blue-400" />
               </div>
               Salvar Modelo
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-[13px] font-medium mt-2">
               Escolha um nome para identificar este modelo de estilo para {selectedClientName || 'Geral'}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              placeholder="Ex: Oferta Fim de Semana, Estilo Carnes..."
              className="bg-zinc-900/50 border-zinc-800 rounded-xl h-12 text-[13px] font-medium text-zinc-100 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-zinc-600"
              autoFocus
              onKeyDown={(e) => { 
                if (e.key === 'Enter' && newPresetName) {
                    setPresets([...(presets||[]), { id: crypto.randomUUID(), name: newPresetName, priceBadge: activeCfg.priceBadge, descConfig: activeCfg.descConfig, client: selectedClientName }]);
                    setSaveModalOpen(false);
                    setNewPresetName('');
                    toast.success('Modelo salvo!');
                }
              }}
            />
          </div>
          <DialogFooter className="gap-3 sm:gap-0 mt-4">
            <Button variant="ghost" onClick={() => setSaveModalOpen(false)} className="rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 text-[12px] font-medium">
              Cancelar
            </Button>
            <Button 
                onClick={() => {
                   if (newPresetName) {
                      setPresets([...(presets||[]), { id: crypto.randomUUID(), name: newPresetName, priceBadge: activeCfg.priceBadge, descConfig: activeCfg.descConfig, client: selectedClientName }]);
                      setSaveModalOpen(false);
                      setNewPresetName('');
                      toast.success('Modelo salvo!');
                   }
                }} 
                disabled={!newPresetName} 
                className="bg-blue-600 hover:bg-blue-500 rounded-xl px-6 text-[12px] font-semibold text-white shadow-md shadow-blue-900/20 transition-all disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={syncModalOpen} onOpenChange={setSyncModalOpen}>
        <AlertDialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 rounded-[24px] shadow-2xl p-6 sm:max-w-md">
          <AlertDialogHeader className="mb-2">
            <AlertDialogTitle className="text-lg font-semibold tracking-tight flex items-center gap-3">
               <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center">
                 <Zap className="w-5 h-5 text-indigo-400" />
               </div>
               Sincronização Mestre
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400 text-[13px] font-medium mt-2">
               Deseja aplicar o visual DESTE produto em TODO o projeto?
               <br/><br/>
               <span className="text-indigo-400 font-medium">As cores e fontes serão copiadas para todos, mas as proporções e tamanhos originais serão mantidos.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-3 sm:gap-0">
            <AlertDialogCancel className="bg-transparent border-0 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 rounded-xl text-[12px] font-medium px-4">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              const sourceIdx = selectedSlotIndex ?? 0;
              const style = getSlotSettings(sourceIdx);
              pushHistory();
              syncAllSlots(style as any, sourceIdx);
              setSyncModalOpen(false);
              toast.success('Visual sincronizado para todos!');
            }} className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-6 text-[12px] font-semibold shadow-md shadow-indigo-900/20 transition-all">
              <Zap className="w-4 h-4 mr-2" />
              Sim, Sincronizar Tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Icon Confirmation Modal */}
      <AlertDialog open={!!iconToDelete} onOpenChange={(open) => !open && setIconToDelete(null)}>
        <AlertDialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 rounded-[24px] shadow-2xl p-6 sm:max-w-md">
          <AlertDialogHeader className="mb-2">
            <AlertDialogTitle className="text-lg font-semibold tracking-tight flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              Excluir Ícone?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400 text-[13px] font-medium mt-2">
              Tem certeza que deseja excluir o ícone <strong className="text-zinc-100">"{iconToDelete?.name}"</strong>?
              <br/><br/>
              <span className="text-red-400 font-medium">Esta ação não pode ser desfeita e ele será removido do seu painel e do armazenamento na nuvem.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-3 sm:gap-0">
            <AlertDialogCancel className="bg-transparent border-0 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 rounded-xl text-[12px] font-medium px-4">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (iconToDelete) {
                  deleteCustomIcon(iconToDelete.id);
                  setIconToDelete(null);
                }
              }}
              className="bg-red-600 hover:bg-red-500 text-white rounded-xl px-6 text-[12px] font-semibold shadow-md shadow-red-900/20 transition-all"
            >
              Excluir Ícone
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
