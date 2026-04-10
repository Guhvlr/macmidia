import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useOffer, PriceBadgeConfig, DescriptionConfig, ImageConfig } from '../context/OfferContext';
import { ChevronDown, ChevronRight, Zap, Layers, CreditCard, PenTool, Layout, ChevronLeft, Trash2, Hand, Maximize, Image as ImageIcon, Undo2, Save } from 'lucide-react';
import { toast } from 'sonner';

type ElemId = 'image' | 'name' | 'badge' | 'currency' | 'value' | 'suffix';

const COLOR_PALETTE = ['#D9254B', '#2563EB', '#16A34A', '#EAB308', '#7C3AED', '#000000', '#FFFFFF', '#64748B'];

const FontStyles = React.memo(({ fonts }: { fonts: { name: string; url: string }[] }) => (
  <style dangerouslySetInnerHTML={{ __html: fonts.map(f => `
    @font-face { font-family: '${f.name}'; src: url('${f.url}'); font-display: swap; }
  `).join('\n') }} />
));

const ColorSelector = ({ label, color, onChange }: { label: string; color: string; onChange: (c: string) => void }) => (
  <div className="space-y-2">
    <label className="text-[9px] font-black uppercase text-white/30 tracking-widest flex items-center justify-between">{label} <span className="text-[10px] text-white/60 font-mono">{color?.toUpperCase()}</span></label>
    <div className="flex flex-wrap gap-1.5">
      {COLOR_PALETTE.map(c => <button key={c} onClick={() => onChange(c)} className={`w-4 h-4 rounded-full border border-white/10 transition-all hover:scale-125 ${color === c ? 'ring-2 ring-primary ring-offset-2 ring-offset-[#0d0d10]' : ''}`} style={{ backgroundColor: c }} />)}
      <div className="relative w-4 h-4 rounded-full overflow-hidden border border-white/10 group bg-white/5"><input type="color" value={color || '#000000'} onChange={e => onChange(e.target.value)} className="absolute inset-0 w-full h-full cursor-pointer scale-150" /></div>
    </div>
  </div>
);

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

const DragBox = ({ id, children, el, isPrimary, isSel, onStartDrag, onStartResize, slotIdx, zoom, onSelect, isDragging }: any) => {
  const hSize = Math.max(16, 22 / zoom); 
  return (
    <g>
      <rect x={el.x} y={el.y} width={el.w} height={el.h} fill="rgba(0,0,0,0.001)" style={{ cursor: 'move' }} onMouseDownCapture={e => onStartDrag(e, id, slotIdx)} onClick={e => { e.stopPropagation(); onSelect(id, slotIdx); }} />
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
    panOffset, setPanOffset, getSlotSettings, updateSlotSettings,
    undo, pushHistory, products, customFonts, presets, setPresets
  } = useOffer();

  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activePage, setActivePage] = useState(0);
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
  const [shiftPressed, setShiftPressed] = useState(false);

  useEffect(() => {
    const d = (e: KeyboardEvent) => { if (e.key === 'Shift') setShiftPressed(true); };
    const u = (e: KeyboardEvent) => { if (e.key === 'Shift') setShiftPressed(false); };
    window.addEventListener('keydown', d); window.addEventListener('keyup', u);
    return () => { window.removeEventListener('keydown', d); window.removeEventListener('keyup', u); };
  }, []);

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
      image: { x: slot.x + slot.width * i.offsetX/100 - (slot.width*0.45*i.scale)/2, y: slot.y + slot.height * i.offsetY/100 - (slot.height*0.35*i.scale)/2, w: slot.width*0.45*i.scale, h: slot.height*0.35*i.scale },
      name: { x: slot.x + slot.width * d.offsetX/100 - slot.width*0.4, y: slot.y + slot.height * d.offsetY/100 - (d.fontSize*sf)/2, w: slot.width*0.8, h: d.fontSize*sf*1.5 },
      badge: { x: slot.x + (b.badgeOffsetX/100)*slot.width - (b.badgeWidth*sf)/2, y: slot.y + (b.badgeOffsetY/100)*slot.height - (b.badgeHeight*sf)/2, w: b.badgeWidth*sf, h: b.badgeHeight*sf },
      currency: { x: slot.x + (b.badgeOffsetX/100)*slot.width - (b.badgeWidth*sf)/2 + (b.badgeWidth*sf) * b.currencyOffsetX/100 - (b.currencyFontSize*sf)*1.2, y: slot.y + (b.badgeOffsetY/100)*slot.height - (b.badgeHeight*sf)/2 + (b.badgeHeight*sf) * b.currencyOffsetY/100 - (b.currencyFontSize*sf), w: (b.currencyFontSize*sf)*2.4, h: (b.currencyFontSize*sf)+6 },
      value: { x: slot.x + (b.badgeOffsetX/100)*slot.width - (b.badgeWidth*sf)/2 + (b.badgeWidth*sf) * b.valueOffsetX/100 - (b.valueFontSize*sf)*1.5, y: slot.y + (b.badgeOffsetY/100)*slot.height - (b.badgeHeight*sf)/2 + (b.badgeHeight*sf) * b.valueOffsetX/100 - (b.valueFontSize*sf), w: (b.valueFontSize*sf)*3, h: (b.valueFontSize*sf)+6 },
      suffix: { x: slot.x + (b.badgeOffsetX/100)*slot.width - (b.badgeWidth*sf)/2 + (b.badgeWidth*sf) * b.suffixOffsetX/100 - (b.suffixFontSize*sf)*2, y: slot.y + (b.badgeOffsetY/100)*slot.height - (b.badgeHeight*sf)/2 + (b.badgeHeight*sf) * b.suffixOffsetY/100 - (b.suffixFontSize*sf), w: (b.suffixFontSize*sf)*4, h: (b.suffixFontSize*sf)+6 },
      sFactor: sf
    };
  };

  const onSelect = (id: ElemId, idx: number) => {
    setSelectedSlotIndex(idx); setSelectedElem(id);
    const isShift = shiftPressed;
    if (isShift) {
       setSelectedElems(prev => prev.includes(id) ? prev : [...prev, id]); 
       setSelectedSlotIndices(prev => prev.includes(idx) ? prev : [...prev, idx]);
    } else { setSelectedElems([id]); setSelectedSlotIndices([idx]); }
  };

  const onStartDrag = (e: any, id: ElemId, idx: number) => {
    if (e.button !== 0) return; e.preventDefault(); e.stopPropagation();
    onSelect(id, idx); pushHistory(); setDragging(id);
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
  };

  const onMouseUp = () => {
    if (isPanning) { setIsPanning(false); return; }
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
      const { w, h } = resizeState; const ps = slots[selectedSlotIndex % slots.length]; const sf = ps.width/500;
      const rCfg = (c: any) => {
        if (resizing === 'image') return { imageConfig: { ...c.imageConfig, scale: w / (ps.width*0.45) } };
        if (resizing === 'name') return { descConfig: { ...c.descConfig, fontSize: Math.max(8, (h/1.5)/sf) } };
        if (resizing === 'badge') return { priceBadge: { ...c.priceBadge, badgeWidth: Math.round(w/sf), badgeHeight: Math.round(h/sf) } };
        if (resizing === 'currency') return { priceBadge: { ...c.priceBadge, currencyFontSize: Math.max(8, h/sf) } };
        if (resizing === 'value') return { priceBadge: { ...c.priceBadge, valueFontSize: Math.max(10, h/sf) } };
        if (resizing === 'suffix') return { priceBadge: { ...c.priceBadge, suffixFontSize: Math.max(6, h/sf) } };
        return {};
      };
      selectedSlotIndices.forEach(idx => updateSlotSettings(idx, rCfg(getSlotSettings(idx))));
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

  return (
    <div className="h-full flex overflow-hidden bg-[#09090b] text-white">
      <FontStyles fonts={customFonts} />
      <div className="w-[340px] bg-[#0d0d10] border-r border-white/5 p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6 select-none">
        <h2 className="text-xs font-black uppercase tracking-widest text-center text-white/50 pb-4 border-b border-white/5">Painel de Edição</h2>
        <div className="flex flex-col gap-3">
          <Section label="Modelos Salvos" icon={Zap} isOpen={openSection === 'presets'} onToggle={() => setOpenSection('presets')}>
             <button onClick={() => { const n = prompt('Nome do Modelo:'); if (n) setPresets([...(presets||[]), { id: crypto.randomUUID(), name: n, priceBadge: activeCfg.priceBadge, descConfig: activeCfg.descConfig }]); }} className="w-full p-3 bg-primary/10 border border-primary/20 rounded-xl text-primary text-[10px] font-black uppercase hover:bg-primary/20 transition-all"><Save className="w-3.5 h-3.5 inline mr-2" /> Salvar Atual</button>
             {presets?.map((p: any) => (
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
        </div>
      </div>

      <div ref={containerRef} className={`flex-1 overflow-hidden relative bg-[#060608] flex flex-col items-center justify-center p-6 ${isPanning ? 'cursor-grabbing' : ''}`} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp} onMouseDown={e => { if (e.button === 1) { e.preventDefault(); setIsPanning(true); setPanStart({ x: e.clientX, y: e.clientY, ox: panOffset.x, oy: panOffset.y }); } }} onClick={() => { if (!dragging && !resizing) { setSelectedElems([]); setSelectedSlotIndex(null); setSelectedSlotIndices([]); setSelectedElem(null); } }}>
        <div className="absolute top-6 z-20 flex items-center gap-4 bg-[#0d0d10]/95 backdrop-blur-xl p-2 rounded-2xl border border-white/10 shadow-3xl select-none" onClick={e => e.stopPropagation()}>
           <button onClick={undo} className="p-2 hover:bg-white/10 rounded-xl text-white/40 hover:text-white transition-all"><Undo2 className="w-4 h-4" /></button>
           <div className="flex items-center gap-2 px-3 border-x border-white/10"><button onClick={() => setActivePage(Math.max(0, activePage-1))} className="p-2 hover:bg-white/5 rounded-lg"><ChevronLeft className="w-4 h-4 text-white/20" /></button><span className="text-[10px] font-black text-white/50 min-w-[60px] text-center">{activePage+1} / {pageCount}</span><button onClick={() => setActivePage(Math.min(pageCount-1, activePage+1))} className="p-2 hover:bg-white/5 rounded-lg"><ChevronLeft className="w-4 h-4 text-white/20 rotate-180" /></button></div>
           <div className="flex items-center gap-1.5"><button onClick={() => setZoom(zoom-0.1)} className="w-8 h-8 rounded-lg hover:bg-white/10">-</button><span className="text-[10px] font-bold text-white/40 min-w-[35px] text-center">{Math.round(zoom*100)}%</span><button onClick={() => setZoom(zoom+0.1)} className="w-8 h-8 rounded-lg hover:bg-white/10">+</button></div>
           <button onClick={() => { setZoom(0.8); setPanOffset({ x: 0, y: 0 }); }} className="p-2 hover:bg-white/10 rounded-xl"><Maximize className="w-4 h-4 text-white/20" /></button>
        </div>

        <div className="relative transition-transform duration-75" style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`, transformOrigin: 'center center' }} onMouseDown={e => e.stopPropagation()}>
          <svg ref={svgRef} width={config.width} height={config.height} viewBox={`0 0 ${config.width} ${config.height}`} style={{ background: 'white', userSelect: 'none' }} className="shadow-2xl">
            {config.backgroundImageUrl && <image href={config.backgroundImageUrl} width={config.width} height={config.height} preserveAspectRatio="xMidYMid slice" />}
            {slots.map((s, idx) => {
              const gIdx = activePage * slots.length + idx; const cfg = getSlotSettings(gIdx); const el = getElems(s, cfg);
              const isSlotSel = selectedSlotIndices.includes(gIdx);
              const p = products?.[gIdx]; const name = p?.name || "NOME PRODUTO"; const price = p?.price || "00,00";
              const v = { ...el };
              if (isSlotSel && dragState) { selectedElems.forEach(id => { (v as any)[id].x += dragState.dx; (v as any)[id].y += dragState.dy; }); }
              if (isSlotSel && resizeState) { (v as any)[resizing!].w = resizeState.w; (v as any)[resizing!].h = resizeState.h; }

              return (
                <g key={gIdx} onClick={e => e.stopPropagation()}>
                  <rect x={s.x} y={s.y} width={s.width} height={s.height} fill="none" stroke={isSlotSel ? '#D9254B' : 'rgba(0,0,0,0.05)'} strokeWidth={isSlotSel ? 4/zoom : 1/zoom} strokeDasharray={isSlotSel ? 'none' : '4,2'} pointerEvents="none" />
                  
                  <DragBox id="badge" el={v.badge} zoom={zoom} isPrimary={selectedElem === 'badge'} isSel={selectedElems.includes('badge')} onStartDrag={onStartDrag} onStartResize={onStartResize} onSelect={onSelect} slotIdx={gIdx} isDragging={!!dragging}>
                     {cfg.priceBadge.badgeImageUrl ? <image href={cfg.priceBadge.badgeImageUrl} x={v.badge.x} y={v.badge.y} width={v.badge.w} height={v.badge.h} preserveAspectRatio="none" style={{ borderRadius: cfg.priceBadge.borderRadius + 'px' }} pointerEvents="none" /> 
                                                   : <rect x={v.badge.x} y={v.badge.y} width={v.badge.w} height={v.badge.h} rx={cfg.priceBadge.borderRadius * el.sFactor} fill={cfg.priceBadge.bgColor} pointerEvents="none" />}
                  </DragBox>
                  
                  <DragBox id="image" el={v.image} zoom={zoom} isPrimary={selectedElem === 'image'} isSel={selectedElems.includes('image')} onStartDrag={onStartDrag} onStartResize={onStartResize} onSelect={onSelect} slotIdx={gIdx} isDragging={!!dragging}>
                    <rect x={v.image.x} y={v.image.y} width={v.image.w} height={v.image.h} rx={12} fill="rgba(0,0,0,0.03)" stroke="rgba(217,37,75,0.1)" strokeDasharray="3,3" pointerEvents="none" />
                  </DragBox>
                  
                  <DragBox id="name" el={v.name} zoom={zoom} isPrimary={selectedElem === 'name'} isSel={selectedElems.includes('name')} onStartDrag={onStartDrag} onStartResize={onStartResize} onSelect={onSelect} slotIdx={gIdx} isDragging={!!dragging}>
                    <text x={v.name.x+v.name.w/2} y={v.name.y+v.name.h/2} fontSize={cfg.descConfig.fontSize*el.sFactor} fill={cfg.descConfig.color} fontWeight="800" textAnchor="middle" fontFamily={cfg.descConfig.fontFamily} pointerEvents="none" style={cfg.descConfig.uppercase ? {textTransform:'uppercase'}:{}}>{renderTextWrap(name, v.name.x+v.name.w/2, v.name.y+v.name.h/2, cfg.descConfig.fontSize*el.sFactor)}</text>
                  </DragBox>
                  
                  <DragBox id="currency" el={v.currency} zoom={zoom} isPrimary={selectedElem === 'currency'} isSel={selectedElems.includes('currency')} onStartDrag={onStartDrag} onStartResize={onStartResize} onSelect={onSelect} slotIdx={gIdx} isDragging={!!dragging}>
                    <text x={v.currency.x+v.currency.w/2} y={v.currency.y+cfg.priceBadge.currencyFontSize*el.sFactor} fontSize={cfg.priceBadge.currencyFontSize*el.sFactor} fill={cfg.priceBadge.currencyColor} fontWeight="900" textAnchor="middle" pointerEvents="none">R$</text>
                  </DragBox>
                  
                  <DragBox id="value" el={v.value} zoom={zoom} isPrimary={selectedElem === 'value'} isSel={selectedElems.includes('value')} onStartDrag={onStartDrag} onStartResize={onStartResize} onSelect={onSelect} slotIdx={gIdx} isDragging={!!dragging}>
                    <text x={v.value.x+v.value.w/2} y={v.value.y+cfg.priceBadge.valueFontSize*el.sFactor} fontSize={cfg.priceBadge.valueFontSize*el.sFactor} fill={cfg.priceBadge.valueColor} fontWeight="900" textAnchor="middle" pointerEvents="none">{price}</text>
                  </DragBox>

                  {cfg.priceBadge.showSuffix && (
                    <DragBox id="suffix" el={v.suffix} zoom={zoom} isPrimary={selectedElem === 'suffix'} isSel={selectedElems.includes('suffix')} onStartDrag={onStartDrag} onStartResize={onStartResize} onSelect={onSelect} slotIdx={gIdx} isDragging={!!dragging}>
                      <text x={v.suffix.x+v.suffix.w/2} y={v.suffix.y+cfg.priceBadge.suffixFontSize*el.sFactor} fontSize={cfg.priceBadge.suffixFontSize*el.sFactor} fill={cfg.priceBadge.suffixColor} fontWeight="600" textAnchor="middle" pointerEvents="none">{cfg.priceBadge.suffixText}</text>
                    </DragBox>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
};
