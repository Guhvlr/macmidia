import React, { useRef, useState, useCallback } from 'react';
import { useOffer, Slot } from '../context/OfferContext';
import { Trash2, MousePointer, PenTool, Zap, PlusCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export const StepSlots = () => {
  const { 
    config, slots, setSlots, selectedSlotId, setSelectedSlotId,
    pageTemplates, saveProjectTemplate, loadProjectTemplate, deleteProjectTemplate, isLoadingTemplates, selectedClientName
  } = useOffer();

  const filteredTemplates = React.useMemo(() => {
    return pageTemplates.filter(t => t.client === selectedClientName);
  }, [pageTemplates, selectedClientName]);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [mode, setMode] = useState<'draw' | 'select'>('draw');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState<{ origW: number; origH: number; sx: number; sy: number } | null>(null);

  React.useEffect(() => {
    if (deletingId) {
      const timer = setTimeout(() => setDeletingId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [deletingId]);

  const toSvg = useCallback((e: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const r = svg.getBoundingClientRect();
    return { x: Math.round((e.clientX - r.left) * config.width / r.width), y: Math.round((e.clientY - r.top) * config.height / r.height) };
  }, [config.width, config.height]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (mode !== 'draw') return;
    const c = toSvg(e);
    setIsDrawing(true); setDrawStart(c); setDrawCurrent(c);
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (isDrawing && mode === 'draw') { setDrawCurrent(toSvg(e)); return; }
    if (isDragging && selectedSlotId) {
      const c = toSvg(e);
      setSlots(prev => prev.map(s => s.id === selectedSlotId ? { ...s, x: Math.max(0, c.x - dragOffset.x), y: Math.max(0, c.y - dragOffset.y) } : s));
      return;
    }
    if (isResizing && selectedSlotId && resizeStart) {
      const c = toSvg(e);
      setSlots(prev => prev.map(s => s.id === selectedSlotId ? { ...s, width: Math.max(50, resizeStart.origW + c.x - resizeStart.sx), height: Math.max(50, resizeStart.origH + c.y - resizeStart.sy) } : s));
    }
  };
  const onMouseUp = () => {
    if (isDrawing && drawStart && drawCurrent) {
      const x = Math.min(drawStart.x, drawCurrent.x);
      const y = Math.min(drawStart.y, drawCurrent.y);
      const w = Math.abs(drawCurrent.x - drawStart.x);
      const h = Math.abs(drawCurrent.y - drawStart.y);
      if (w > 30 && h > 30) {
        const ns: Slot = { id: crypto.randomUUID(), x, y, width: w, height: h };
        setSlots(prev => [...prev, ns]);
        setSelectedSlotId(ns.id);
        toast.success(`Slot ${slots.length + 1} criado!`);
      }
    }
    setIsDrawing(false); setDrawStart(null); setDrawCurrent(null);
    setIsDragging(false); setIsResizing(false); setResizeStart(null);
  };
  const onSlotDown = (e: React.MouseEvent, slot: Slot) => {
    e.stopPropagation();
    if (mode !== 'select') return;
    setSelectedSlotId(slot.id);
    const c = toSvg(e);
    setDragOffset({ x: c.x - slot.x, y: c.y - slot.y });
    setIsDragging(true);
  };
  const onResizeDown = (e: React.MouseEvent, slot: Slot) => {
    e.stopPropagation();
    setSelectedSlotId(slot.id);
    const c = toSvg(e);
    setIsResizing(true);
    setResizeStart({ origW: slot.width, origH: slot.height, sx: c.x, sy: c.y });
  };

  const dr = drawStart && drawCurrent ? {
    x: Math.min(drawStart.x, drawCurrent.x), y: Math.min(drawStart.y, drawCurrent.y),
    w: Math.abs(drawCurrent.x - drawStart.x), h: Math.abs(drawCurrent.y - drawStart.y),
  } : null;

  const selectedSlot = slots.find(s => s.id === selectedSlotId);

  return (
    <div className="h-full flex overflow-hidden">
      {/* Sidebar */}
      <div className="w-[340px] border-r border-white/5 bg-[#0d0d10] p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6">
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-white">Etapa 2: Layout</h2>
          <p className="text-[10px] text-white/30 font-bold uppercase tracking-wider">Desenhe os slots de produtos</p>
        </div>

        {/* Mode & Basic Actions */}
        <div className="flex flex-col gap-3">
           <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setMode('draw')}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase border transition-all ${mode === 'draw' ? 'bg-green-500/10 border-green-500/40 text-green-500 shadow-lg shadow-green-500/10' : 'bg-white/5 border-white/10 text-white/40'}`}>
                <PenTool className="w-3.5 h-3.5" /> Desenhar
              </button>
              <button onClick={() => setMode('select')}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase border transition-all ${mode === 'select' ? 'bg-blue-500/10 border-blue-500/40 text-blue-500 shadow-lg shadow-blue-500/10' : 'bg-white/5 border-white/10 text-white/40'}`}>
                <MousePointer className="w-3.5 h-3.5" /> Mover
              </button>
           </div>

           {slots.length > 0 && (
             <button onClick={() => { setSlots([]); setSelectedSlotId(null); }} className="w-full bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 rounded-xl py-2 text-[9px] font-black uppercase tracking-widest text-red-500/50 hover:text-red-500 transition-all">
                Limpar Tudo
             </button>
           )}
        </div>

        {/* Templates Section */}
        <div className="pt-6 border-t border-white/5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
               <Zap className="w-3.5 h-3.5 text-primary" />
               <h3 className="text-[11px] font-black uppercase text-white/80 tracking-widest">Templates: {selectedClientName || 'Geral'}</h3>
            </div>
            
            <div className="flex flex-col gap-2">
               <div className="relative group">
                 <input 
                   value={templateName} 
                   onChange={e => setTemplateName(e.target.value)}
                   placeholder={`Salvar em [${selectedClientName || 'Geral'}]...`} 
                   className="w-full bg-black/40 border border-white/10 rounded-xl h-10 px-4 text-[10px] font-bold text-white outline-none focus:border-primary/50 transition-all placeholder:text-white/10"
                 />
                 <button 
                   onClick={async () => {
                     if (!templateName) return toast.error('Dê um nome ao template');
                     setIsSaving(true);
                     await saveProjectTemplate(templateName);
                     setTemplateName('');
                     setIsSaving(false);
                   }}
                   disabled={isSaving || slots.length === 0}
                   className="absolute right-2 top-1.5 p-1.5 bg-primary rounded-lg text-white hover:scale-105 transition-all disabled:opacity-20 disabled:scale-100"
                 >
                   <PlusCircle className="w-3.5 h-3.5" />
                 </button>
               </div>
               
               <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                  {isLoadingTemplates ? (
                    <p className="text-center py-4 text-[9px] uppercase tracking-widest opacity-20">Carregando...</p>
                  ) : filteredTemplates.map(t => (
                    <div key={t.id || t.name} className={`group flex items-center bg-white/[0.03] border rounded-xl transition-all overflow-hidden ${deletingId === (t.id || t.name) ? 'border-red-500/50 bg-red-500/5' : 'border-white/5 hover:border-primary/20'}`}>
                       <button 
                         onClick={() => {
                           console.log('[DEBUG] Loading template:', t.id || t.name);
                           loadProjectTemplate(t.id);
                         }}
                         className="flex-1 text-[10px] py-2.5 font-black uppercase text-white/40 group-hover:text-white text-left px-3 truncate transition-colors"
                         title={`Carregar template: ${t.name}`}
                       >
                         {t.name}
                       </button>
                       <button 
                         onClick={async (e) => {
                           e.stopPropagation();
                           e.preventDefault();
                           const currentId = t.id || t.name;
                           console.log('[DEBUG] Delete button clicked for:', currentId, 'current deletingId:', deletingId);
                           
                           if (deletingId === currentId) {
                             console.log('[DEBUG] Confirmation confirmed, deleting...');
                             await deleteProjectTemplate({ id: t.id, name: t.name });
                             setDeletingId(null);
                           } else {
                             console.log('[DEBUG] First click, setting deletingId');
                             setDeletingId(currentId);
                           }
                         }}
                         className={`p-3 transition-all border-l border-white/5 ${deletingId === (t.id || t.name) ? 'bg-red-500 text-white' : 'hover:bg-red-500/10 text-white/10 hover:text-red-500'}`}
                         title={deletingId === (t.id || t.name) ? "Clique de novo para excluir" : "Excluir Template"}
                       >
                         {deletingId === (t.id || t.name) ? <Trash2 className="w-3.5 h-3.5 animate-pulse" /> : <Trash2 className="w-3.5 h-3.5" />}
                       </button>
                    </div>
                  ))}
               </div>
            </div>
        </div>

        {/* Slot list */}
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-white/40 flex justify-between">
            <span>Slots Individuais</span>
            <span className="bg-white/10 px-2 py-0.5 rounded-full">{slots.length}</span>
          </label>
          {slots.map((s, i) => (
            <div key={s.id} onClick={() => { setSelectedSlotId(s.id); setMode('select'); }}
              className={`rounded-lg p-2 cursor-pointer border flex items-center gap-2 transition-all ${selectedSlotId === s.id ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/[0.03] border-white/5 hover:border-white/10'}`}>
              <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-[9px] font-black text-white/40">{i + 1}</div>
              <p className="text-[9px] text-white/40 font-mono flex-1">{Math.round(s.x)},{Math.round(s.y)} · {Math.round(s.width)}×{Math.round(s.height)}</p>
              <button 
                onClick={(e) => { e.stopPropagation(); setSlots(prev => prev.filter(sl => sl.id !== s.id)); if (selectedSlotId === s.id) setSelectedSlotId(null); }} 
                className="text-white/20 hover:text-red-400 p-1"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        {selectedSlot && (
          <div className="pt-3 border-t border-white/5 space-y-2">
            <label className="text-[9px] font-black uppercase text-blue-400">Ajuste Fino — Slot {slots.indexOf(selectedSlot) + 1}</label>
            <div className="grid grid-cols-4 gap-1.5">
              {(['x', 'y', 'width', 'height'] as const).map(k => (
                <div key={k}>
                  <label className="text-[8px] text-white/25 font-bold uppercase">{k === 'width' ? 'W' : k === 'height' ? 'H' : k.toUpperCase()}</label>
                  <input type="number" value={Math.round(selectedSlot[k])}
                    onChange={e => setSlots(prev => prev.map(s => s.id === selectedSlot.id ? { ...s, [k]: parseInt(e.target.value) || 0 } : s))}
                    className="w-full bg-black/40 border border-white/10 rounded h-7 px-1 text-[10px] text-white text-center font-bold" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 bg-black/40 flex items-center justify-center p-6 overflow-auto custom-scrollbar">
        <svg ref={svgRef} 
          width={config.width} height={config.height} viewBox={`0 0 ${config.width} ${config.height}`}
          style={{ width: '100%', maxWidth: '700px', height: 'auto', cursor: mode === 'draw' ? 'crosshair' : 'default', userSelect: 'none' }}
          className="shadow-2xl ring-1 ring-white/10"
          onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
          onClick={() => { if (mode === 'select' && !isDragging) setSelectedSlotId(null); }}>

          {config.backgroundImageUrl ? (
            <image href={config.backgroundImageUrl} width="100%" height="100%" preserveAspectRatio="xMidYMid slice" />
          ) : <rect width="100%" height="100%" fill="#1a1a1a" />}

          {slots.map((s, i) => {
            const sel = selectedSlotId === s.id;
            return (
              <g key={s.id}>
                <rect x={s.x} y={s.y} width={s.width} height={s.height}
                  fill={sel ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.08)'}
                  stroke={sel ? '#3b82f6' : 'rgba(255,255,255,0.5)'}
                  strokeWidth={sel ? 3 : 1.5}
                  strokeDasharray={sel ? '' : '8,4'} rx={6}
                  style={{ cursor: mode === 'select' ? 'move' : 'crosshair' }}
                  onMouseDown={e => onSlotDown(e, s)} />
                <text x={s.x + 12} y={s.y + 22} fontSize={14} fill={sel ? '#3b82f6' : 'rgba(255,255,255,0.6)'} fontWeight="900" fontFamily="monospace">{i + 1}</text>
                {sel && <rect x={s.x + s.width - 16} y={s.y + s.height - 16} width={16} height={16} fill="#3b82f6" rx={3} style={{ cursor: 'nwse-resize' }} onMouseDown={e => onResizeDown(e, s)} />}
              </g>
            );
          })}

          {isDrawing && dr && (
            <rect x={dr.x} y={dr.y} width={dr.w} height={dr.h} fill="rgba(34,197,94,0.15)" stroke="#22c55e" strokeWidth={2} strokeDasharray="6,3" rx={6} />
          )}
        </svg>
      </div>
    </div>
  );
};
