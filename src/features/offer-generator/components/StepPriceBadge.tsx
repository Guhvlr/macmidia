import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useOffer, PriceBadgeConfig, DescriptionConfig, ImageConfig } from '../context/OfferContext';
import { ChevronDown, ChevronRight, Zap, Layers, CreditCard, PenTool, Layout, ChevronLeft, Trash2, Hand, Maximize, Image as ImageIcon, Undo2, Save, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';

type ElemId = 'image' | 'name' | 'badge' | 'currency' | 'value' | 'suffix';

const COLOR_PALETTE = ['#D9254B', '#2563EB', '#16A34A', '#EAB308', '#7C3AED', '#000000', '#FFFFFF', '#64748B'];

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
            className={`w-4 h-4 rounded-full border border-white/10 transition-all hover:scale-125 ${color === c ? 'ring-2 ring-primary ring-offset-2 ring-offset-[#0d0d10]' : ''}`} 
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
    <div className="border border-white/5 rounded-2xl bg-white/[0.02] overflow-hidden mb-3">
      <button onClick={onToggle} className={`w-full p-4 flex items-center justify-between text-left transition-colors ${isOpen ? 'bg-primary/5' : 'hover:bg-white/[0.04]'}`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl transition-colors ${isOpen ? 'bg-primary text-white' : 'bg-white/5 text-white/30'}`}><Icon className="w-4 h-4" /></div>
          <span className="text-xs font-black uppercase tracking-widest text-white/60">{label}</span>
        </div>
        {isOpen ? <ChevronDown className="w-4 h-4 text-primary" /> : <ChevronRight className="w-4 h-4 text-white/20" />}
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
          <rect x={el.x-1} y={el.y-1} width={el.w+2} height={el.h+2} fill="none" stroke={isPrimary ? "#D9254B" : "rgba(217,37,75,0.4)"} strokeWidth={isPrimary ? 3/zoom : 1/zoom} rx={3} pointerEvents="none" />
          {isPrimary && !isDragging && (
            <g transform={`translate(${el.x + el.w}, ${el.y + el.h})`} onMouseDown={e => { e.stopPropagation(); onStartResize(e, id); }} style={{ cursor: 'nwse-resize' }}>
               <circle r={hSize / 2} fill="#D9254B" stroke="white" strokeWidth={2/zoom} />
               <circle r={hSize / 1.1} fill="rgba(217,37,75,0.15)" />
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
  const [newPresetName, setNewPresetName] = useState('');

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
          for (let i=0; i<slots.length; i++) pIndices.push(activePage * slots.length + i);
          setSelectedSlotIndices(pIndices);
          setSelectedSlotIndex(pIndices[0]);
          setSelectedElems(['badge', 'image', 'name', 'currency', 'value', 'suffix']);
          toast.success('Todos selecionados');
        }
      }
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [undo, selectedSlotIndex, selectedSlotIndices, clipboard, getSlotSettings, updateSlotSettings, pushHistory, presets, activePage, slots.length, setSelectedSlotIndices, setSelectedSlotIndex]);

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
      currency: { x: slot.x + (b.badgeOffsetX/100)*slot.width - (b.badgeWidth*sf)/2 + (b.badgeWidth*sf) * b.currencyOffsetX/100 - (b.currencyFontSize*sf)*1.2, y: slot.y + (b.badgeOffsetY/100)*slot.height - (b.badgeHeight*sf)/2 + (b.badgeHeight*sf) * b.currencyOffsetY/100 - (b.currencyFontSize*sf), w: (b.currencyFontSize*sf)*2.4, h: (b.currencyFontSize*sf)+6 },
      value: { x: slot.x + (b.badgeOffsetX/100)*slot.width - (b.badgeWidth*sf)/2 + (b.badgeWidth*sf) * b.valueOffsetX/100 - (b.valueFontSize*sf)*1.5, y: slot.y + (b.badgeOffsetY/100)*slot.height - (b.badgeHeight*sf)/2 + (b.badgeHeight*sf) * b.valueOffsetY/100 - (b.valueFontSize*sf), w: (b.valueFontSize*sf)*3, h: (b.valueFontSize*sf)+6 },
      suffix: { x: slot.x + (b.badgeOffsetX/100)*slot.width - (b.badgeWidth*sf)/2 + (b.badgeWidth*sf) * b.suffixOffsetX/100 - (b.suffixFontSize*sf)*2, y: slot.y + (b.badgeOffsetY/100)*slot.height - (b.badgeHeight*sf)/2 + (b.badgeHeight*sf) * b.suffixOffsetY/100 - (b.suffixFontSize*sf), w: (b.suffixFontSize*sf)*4, h: (b.suffixFontSize*sf)+6 },
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
    const c = toSvg(e); const el = (getElems(slots[idx % slots.length], getSlotSettings(idx)) as any)[id];
    setDragOff({ x: c.x - el.x, y: c.y - el.y }); setDragState({ dx: 0, dy: 0 });
  };

  const onStartResize = (e: any, id: ElemId) => {
    if (selectedSlotIndex === null) return; e.preventDefault(); e.stopPropagation(); pushHistory(); setResizing(id);
    const c = toSvg(e); const ps = slots[selectedSlotIndex % slots.length]; const cfg = getSlotSettings(selectedSlotIndex);
    const el = (getElems(ps, cfg) as any)[id]; setResizeStart({ sx: c.x, sy: c.y, ow: el.w, oh: el.h }); setResizeState({ w: el.w, h: el.h });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (isPanning) { setPanOffset({ x: panStart.ox + (e.clientX - panStart.x), y: panStart.oy + (e.clientY - panStart.y) }); return; }
    if (!dragging && !resizing) return;
    const c = toSvg(e);
    if (dragging && selectedSlotIndex !== null) {
      const ps = slots[selectedSlotIndex % slots.length]; const cfg = getSlotSettings(selectedSlotIndex); const el = (getElems(ps, cfg) as any)[dragging];
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

      slots.forEach((s, i) => {
        const gIdx = activePage * slots.length + i;
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
        const ps = slots[idx % slots.length]; const cfg = getSlotSettings(idx); let up: any = {};
        selectedElems.forEach(id => {
          if (id === 'image') up.imageConfig = { ...cfg.imageConfig, offsetX: cfg.imageConfig.offsetX + (dx/ps.width)*100, offsetY: cfg.imageConfig.offsetY + (dy/ps.height)*100 };
          else if (id === 'name') up.descConfig = { ...cfg.descConfig, offsetX: cfg.descConfig.offsetX + (dx/ps.width)*100, offsetY: cfg.descConfig.offsetY + (dy/ps.height)*100 };
          else if (id === 'badge') up.priceBadge = { ...cfg.priceBadge, badgeOffsetX: cfg.priceBadge.badgeOffsetX + (dx/ps.width)*100, badgeOffsetY: cfg.priceBadge.badgeOffsetY + (dy/ps.height)*100 };
          else {
            const bw = cfg.priceBadge.badgeWidth * (ps.width/500); const bh = cfg.priceBadge.badgeHeight * (ps.width/500);
            if (id === 'currency') up.priceBadge = { ...(up.priceBadge || cfg.priceBadge), currencyOffsetX: cfg.priceBadge.currencyOffsetX + (dx/bw)*100, currencyOffsetY: cfg.priceBadge.currencyOffsetY + (dy/bh)*100 };
            else if (id === 'value') up.priceBadge = { ...(up.priceBadge || cfg.priceBadge), valueOffsetX: cfg.priceBadge.valueOffsetX + (dx/bw)*100, valueOffsetY: cfg.priceBadge.valueOffsetY + (dy/bh)*100 };
            else if (id === 'suffix') up.priceBadge = { ...(up.priceBadge || cfg.priceBadge), suffixOffsetX: cfg.priceBadge.suffixOffsetX + (dx/bw)*100, suffixOffsetY: cfg.priceBadge.suffixOffsetY + (dy/bh)*100 };
          }
        });
        updateSlotSettings(idx, up);
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

  const up = (p: any) => { pushHistory(); if (selectedSlotIndices.length === 0) { if (p.priceBadge) updatePriceBadge({ ...priceBadge, ...p.priceBadge }); if (p.descConfig) updateDescConfig({ ...descConfig, ...p.descConfig }); if (p.imageConfig) updateImageConfig({ ...imageConfig, ...p.imageConfig }); } else selectedSlotIndices.forEach(idx => updateSlotSettings(idx, p)); };

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
    <div className="h-full flex overflow-hidden bg-[#09090b] text-white">
      <FontStyles fonts={customFonts} />
      <div className="w-[340px] bg-[#0d0d10] border-r border-white/5 p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6 select-none">
        <h2 className="text-xs font-black uppercase tracking-widest text-center text-white/50 pb-4 border-b border-white/5">Painel de Edição</h2>
        
        {/* Sync Button */}
        <button
          onClick={() => {
            const sourceIdx = selectedSlotIndex ?? 0;
            const style = getSlotSettings(sourceIdx);
            if (confirm('Deseja aplicar o visual (Cores e Fontes) deste produto em TODO o projeto? (Mantendo proporções originais)')) {
              pushHistory();
              syncAllSlots(style as any, sourceIdx);
            }
          }}
          className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-900/20 flex items-center justify-center gap-2 group border border-indigo-400/30"
        >
          <Zap className="w-5 h-5 text-indigo-200 group-hover:scale-125 transition-transform" />
          SINCRONIZAÇÃO MESTRE
        </button>

        <div className="flex flex-col gap-3">
          <Section label={`Modelos: ${selectedClientName || 'Geral'}`} icon={Zap} isOpen={openSection === 'presets'} onToggle={() => setOpenSection('presets')}>
             <button onClick={() => setSaveModalOpen(true)} className="w-full p-3 bg-primary/10 border border-primary/20 rounded-xl text-primary text-[10px] font-black uppercase hover:bg-primary/20 transition-all"><Save className="w-3.5 h-3.5 inline mr-2" /> Salvar em {selectedClientName || 'Geral'}</button>
             {filteredPresets?.map((p: any) => (
                <div key={p.id} className="group flex items-center gap-2 p-2 bg-white/[0.03] border border-white/5 rounded-xl hover:border-primary/40">
                   <button onClick={() => up({ priceBadge: p.priceBadge, descConfig: p.descConfig })} className="flex-1 text-[10px] uppercase text-white/50 group-hover:text-white text-left px-2 truncate font-bold">{p.name}</button>
                   <button onClick={() => setPresets(presets.filter((x: any) => x.id !== p.id))} className="opacity-0 group-hover:opacity-100 p-1.5 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                </div>
             ))}
          </Section>
          <Section label="Fundo do Preço" icon={Layers} isOpen={openSection === 'badge'} onToggle={() => setOpenSection('badge')}>
             <div className="space-y-4">
                <input type="file" onChange={e => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onloadend = () => up({ priceBadge: { badgeImageUrl: r.result as string } }); r.readAsDataURL(f); } }} className="hidden" id="bg-badge-up" />
                <label htmlFor="bg-badge-up" className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/10 rounded-xl hover:bg-primary/20 transition-all text-primary font-black uppercase text-[10px] cursor-pointer"><ImageIcon className="w-4 h-4" /> Anexar Background</label>
                <ColorSelector label="Cor do Fundo" color={activeCfg.priceBadge.bgColor} onChange={c => up({ priceBadge: { bgColor: c } })} />
                <div className="space-y-1"><label className="text-[9px] font-black uppercase text-white/30">Arredondamento: {activeCfg.priceBadge.borderRadius}px</label><input type="range" min="0" max="60" value={activeCfg.priceBadge.borderRadius} onChange={e => up({ priceBadge: { borderRadius: parseInt(e.target.value) } })} className="w-full accent-primary h-1 bg-white/5 rounded-full" /></div>
             </div>
          </Section>
          <Section label="Cores dos Textos" icon={CreditCard} isOpen={openSection === 'prices'} onToggle={() => setOpenSection('prices')}>
             <div className="space-y-4">
                <ColorSelector label="RS" color={activeCfg.priceBadge.currencyColor} onChange={c => up({ priceBadge: { currencyColor: c } })} />
                <ColorSelector label="Valor" color={activeCfg.priceBadge.valueColor} onChange={c => up({ priceBadge: { valueColor: c } })} />
                <Section label="Nome/Título" icon={PenTool} isOpen={true} onToggle={() => {}} className="border-0 bg-transparent p-0">
                   <div className="space-y-4 pt-4 border-t border-white/5 mt-4">
                      <select value={activeCfg.descConfig.fontFamily} onChange={e => up({ descConfig: { fontFamily: e.target.value } })} className="w-full bg-black/60 border border-white/10 rounded-xl h-9 px-3 text-[11px] text-white outline-none"><option value="Montserrat, sans-serif">Montserrat</option>{customFonts.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}</select>
                      <ColorSelector label="Cor do Título" color={activeCfg.descConfig.color} onChange={c => up({ descConfig: { color: c } })} />
                      <div className="flex items-center gap-2 text-[9px] font-black text-white/30 uppercase"><input type="checkbox" checked={activeCfg.descConfig.uppercase} onChange={e => up({ descConfig: { uppercase: e.target.checked } })} /> Maiúsculas</div>
                   </div>
                </Section>
             </div>
          </Section>
           <Section label="Sufixo (kg/cada)" icon={Layers} isOpen={openSection === 'suffix'} onToggle={() => setOpenSection('suffix')}>
              <div className="space-y-4">
                 <div className="flex items-center justify-between p-3 bg-white/[0.03] border border-white/5 rounded-xl">
                   <span className="text-[10px] font-black uppercase text-white/40">Mostrar Sufixo</span>
                   <input type="checkbox" checked={activeCfg.priceBadge.showSuffix} onChange={e => up({ priceBadge: { showSuffix: e.target.checked } })} className="w-4 h-4 accent-primary" />
                 </div>
                 <div className="space-y-2">
                   <label className="text-[9px] font-black uppercase text-white/30 tracking-widest">Texto do Sufixo</label>
                   <input type="text" value={activeCfg.priceBadge.suffixText} onChange={e => up({ priceBadge: { suffixText: e.target.value } })} placeholder="Ex: cada, kg, un..." className="w-full bg-black/40 border border-white/10 rounded-xl h-10 px-4 text-[10px] font-bold text-white outline-none focus:border-primary/50 transition-all font-mono" />
                 </div>
                 <ColorSelector label="Cor do Sufixo" color={activeCfg.priceBadge.suffixColor} onChange={c => up({ priceBadge: { suffixColor: c } })} />
                 <div className="space-y-1">
                   <label className="text-[9px] font-black uppercase text-white/30">Tamanho: {Math.round(activeCfg.priceBadge.suffixFontSize)}px</label>
                   <input type="range" min="10" max="100" value={activeCfg.priceBadge.suffixFontSize} onChange={e => up({ priceBadge: { suffixFontSize: parseInt(e.target.value) } })} className="w-full accent-primary h-1 bg-white/5 rounded-full" />
                 </div>
              </div>
           </Section>
        </div>
      </div>

      <div ref={containerRef} className={`flex-1 overflow-hidden relative bg-[#060608] flex flex-col items-center justify-center p-6 ${isPanning ? 'cursor-grabbing' : ''}`} onWheel={handleWheel} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={() => onMouseUp({} as any)} onMouseDown={e => { 
        if (e.button === 1) { e.preventDefault(); setIsPanning(true); setPanStart({ x: e.clientX, y: e.clientY, ox: panOffset.x, oy: panOffset.y }); }
        else if (e.button === 0) {
          const c = toSvg(e);
          setMarquee({ x1: c.x, y1: c.y, x2: c.x, y2: c.y });
        }
      }} onClick={e => { if (!dragging && !resizing && !marquee) { setSelectedElems([]); setSelectedSlotIndex(null); setSelectedSlotIndices([]); setSelectedElem(null); } }}>
        <div className="absolute top-6 z-20 flex items-center gap-4 bg-[#0d0d10]/95 backdrop-blur-xl p-2 rounded-2xl border border-white/10 shadow-3xl select-none" onClick={e => e.stopPropagation()}>
           <button onClick={undo} className="p-2 hover:bg-white/10 rounded-xl text-white/40 hover:text-white transition-all"><Undo2 className="w-4 h-4" /></button>
           <div className="flex items-center gap-2 px-3 border-x border-white/10"><button onClick={() => setActivePage(Math.max(0, activePage-1))} className="p-2 hover:bg-white/5 rounded-lg"><ChevronLeft className="w-4 h-4 text-white/20" /></button><span className="text-[10px] font-black text-white/50 min-w-[60px] text-center">{activePage+1} / {pageCount}</span><button onClick={() => setActivePage(Math.min(pageCount-1, activePage+1))} className="p-2 hover:bg-white/5 rounded-lg"><ChevronLeft className="w-4 h-4 text-white/20 rotate-180" /></button></div>
           <div className="flex items-center gap-1.5"><button onClick={() => setZoom(zoom-0.1)} className="w-8 h-8 rounded-lg hover:bg-white/10">-</button><span className="text-[10px] font-bold text-white/40 min-w-[35px] text-center">{Math.round(zoom*100)}%</span><button onClick={() => setZoom(zoom+0.1)} className="w-8 h-8 rounded-lg hover:bg-white/10">+</button></div>
           <button onClick={() => { setZoom(0.8); setPanOffset({ x: 0, y: 0 }); }} className="p-2 hover:bg-white/10 rounded-xl"><Maximize className="w-4 h-4 text-white/20" /></button>
        </div>

        <div className="relative" style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`, transformOrigin: 'center center' }} onMouseDown={e => e.stopPropagation()}>
          <svg ref={svgRef} width={config.width} height={config.height} viewBox={`0 0 ${config.width} ${config.height}`} style={{ background: 'white', userSelect: 'none' }} className="shadow-2xl">
            {config.backgroundImageUrl && <image href={config.backgroundImageUrl} width={config.width} height={config.height} preserveAspectRatio="xMidYMid slice" />}
            {slots.map((s, idx) => {
              const gIdx = activePage * slots.length + idx; const cfg = getSlotSettings(gIdx); const el = getElems(s, cfg);
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
                  <rect x={s.x} y={s.y} width={s.width} height={s.height} fill="none" stroke={isSlotSel ? '#D9254B' : 'rgba(0,0,0,0.05)'} strokeWidth={isSlotSel ? 4/zoom : 1/zoom} strokeDasharray={isSlotSel ? 'none' : '4,2'} pointerEvents="none" />
                  
                  <DragBox id="badge" el={v.badge} zoom={zoom} isPrimary={selectedElem === 'badge'} isSel={isSlotSel && selectedElems.includes('badge')} onStartDrag={onStartDrag} onStartResize={onStartResize} slotIdx={gIdx} isDragging={!!dragging}>
                     {cfg.priceBadge.badgeImageUrl ? <image href={cfg.priceBadge.badgeImageUrl} x={v.badge.x} y={v.badge.y} width={v.badge.w} height={v.badge.h} preserveAspectRatio="none" style={{ borderRadius: cfg.priceBadge.borderRadius + 'px' }} pointerEvents="none" /> 
                                                   : <rect x={v.badge.x} y={v.badge.y} width={v.badge.w} height={v.badge.h} rx={cfg.priceBadge.borderRadius * el.sFactor} fill={cfg.priceBadge.bgColor} pointerEvents="none" />}
                  </DragBox>
                  
                  <DragBox id="image" el={v.image} zoom={zoom} isPrimary={selectedElem === 'image'} isSel={isSlotSel && selectedElems.includes('image')} onStartDrag={onStartDrag} onStartResize={onStartResize} slotIdx={gIdx} isDragging={!!dragging}>
                    <rect x={v.image.x} y={v.image.y} width={v.image.w} height={v.image.h} rx={12} fill="rgba(0,0,0,0.03)" stroke="rgba(217,37,75,0.1)" strokeDasharray="3,3" pointerEvents="none" />
                    {p?.images?.[0] && <image href={p.images[0]} x={v.image.x} y={v.image.y} width={v.image.w} height={v.image.h} preserveAspectRatio="xMidYMid meet" pointerEvents="none" />}
                  </DragBox>
                  
                  <DragBox id="name" el={v.name} zoom={zoom} isPrimary={selectedElem === 'name'} isSel={isSlotSel && selectedElems.includes('name')} onStartDrag={onStartDrag} onStartResize={onStartResize} slotIdx={gIdx} isDragging={!!dragging}>
                    <text x={v.name.x+v.name.w/2} y={v.name.y+v.name.h/2} fontSize={cfg.descConfig.fontSize*el.sFactor} fill={cfg.descConfig.color} fontWeight="800" textAnchor="middle" fontFamily={cfg.descConfig.fontFamily} pointerEvents="none" style={cfg.descConfig.uppercase ? {textTransform:'uppercase'}:{}}>{renderTextWrap(name, v.name.x+v.name.w/2, v.name.y+v.name.h/2, cfg.descConfig.fontSize*el.sFactor)}</text>
                  </DragBox>
                  
                  <DragBox id="currency" el={v.currency} zoom={zoom} isPrimary={selectedElem === 'currency'} isSel={isSlotSel && selectedElems.includes('currency')} onStartDrag={onStartDrag} onStartResize={onStartResize} slotIdx={gIdx} isDragging={!!dragging}>
                    <text x={v.currency.x+v.currency.w/2} y={v.currency.y+cfg.priceBadge.currencyFontSize*el.sFactor} fontSize={cfg.priceBadge.currencyFontSize*el.sFactor} fill={cfg.priceBadge.currencyColor} fontWeight="900" textAnchor="middle" pointerEvents="none">R$</text>
                  </DragBox>
                  
                  <DragBox id="value" el={v.value} zoom={zoom} isPrimary={selectedElem === 'value'} isSel={isSlotSel && selectedElems.includes('value')} onStartDrag={onStartDrag} onStartResize={onStartResize} slotIdx={gIdx} isDragging={!!dragging}>
                    <text x={v.value.x+v.value.w/2} y={v.value.y+cfg.priceBadge.valueFontSize*el.sFactor} fontSize={cfg.priceBadge.valueFontSize*el.sFactor} fill={cfg.priceBadge.valueColor} fontWeight="900" textAnchor="middle" pointerEvents="none">{price}</text>
                  </DragBox>

                  {cfg.priceBadge.showSuffix && (
                    <DragBox id="suffix" el={v.suffix} zoom={zoom} isPrimary={selectedElem === 'suffix'} isSel={isSlotSel && selectedElems.includes('suffix')} onStartDrag={onStartDrag} onStartResize={onStartResize} slotIdx={gIdx} isDragging={!!dragging}>
                      <text x={v.suffix.x+v.suffix.w/2} y={v.suffix.y+cfg.priceBadge.suffixFontSize*el.sFactor} fontSize={cfg.priceBadge.suffixFontSize*el.sFactor} fill={cfg.priceBadge.suffixColor} fontWeight="600" textAnchor="middle" pointerEvents="none">{cfg.priceBadge.suffixText}</text>
                    </DragBox>
                  )}
                </g>
              );
            })}
            {marquee && (
              <rect 
                x={Math.min(marquee.x1, marquee.x2)} 
                y={Math.min(marquee.y1, marquee.y2)} 
                width={Math.abs(marquee.x1 - marquee.x2)} 
                height={Math.abs(marquee.y1 - marquee.y2)} 
                fill="rgba(217,37,75,0.1)" 
                stroke="#D9254B" 
                strokeWidth={2/zoom} 
                strokeDasharray="4,2"
                pointerEvents="none"
              />
            )}
          </svg>
        </div>
      </div>

      <Dialog open={saveModalOpen} onOpenChange={setSaveModalOpen}>
        <DialogContent className="bg-[#0d0d10] border-white/10 text-white rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-tighter flex items-center gap-2">
               <Zap className="w-5 h-5 text-primary" /> Salvar Modelo
            </DialogTitle>
            <DialogDescription className="text-white/40 text-[11px] font-bold uppercase tracking-wider">
               Escolha um nome para identificar este modelo de estilo para {selectedClientName || 'Geral'}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <Input
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              placeholder="Ex: Oferta Fim de Semana, Estilo Carnes..."
              className="bg-white/5 border-white/10 rounded-xl h-12 text-sm font-bold text-white focus:border-primary/50 transition-all"
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
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setSaveModalOpen(false)} className="rounded-xl text-white/30 hover:text-white hover:bg-white/5 text-[10px] font-black uppercase tracking-widest">
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
                className="bg-primary hover:bg-primary/90 rounded-xl px-8 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 transition-all"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Confirmar e Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
