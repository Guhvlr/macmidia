import React, { useRef, useState, useCallback } from 'react';
import { useOffer, Slot } from '../context/OfferContext';
import { Trash2, MousePointer, PenTool, Zap, PlusCircle, Plus, Minus, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export const StepSlots = () => {
  const { 
    config, slots, setSlots, selectedSlotId, setSelectedSlotId,
    pageTemplates, saveProjectTemplate, loadProjectTemplate, deleteProjectTemplate, isLoadingTemplates, selectedClientName,
    pageCount, setPageCount
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
  const clipboard = useRef<Omit<Slot, 'id'> | null>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore if typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedSlotId) {
        setSlots(prev => prev.filter(s => s.id !== selectedSlotId));
        setSelectedSlotId(null);
        toast.info('Slot removido');
      }
    }

    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'c' || e.key === 'C') {
        const slot = slots.find(s => s.id === selectedSlotId);
        if (slot) {
          clipboard.current = { x: slot.x, y: slot.y, width: slot.width, height: slot.height };
          toast.info('Slot copiado!');
        }
      }
      if (e.key === 'v' || e.key === 'V') {
        if (clipboard.current) {
          const ns: Slot = {
            id: crypto.randomUUID(),
            x: clipboard.current.x + 10,
            y: clipboard.current.y + 10,
            width: clipboard.current.width,
            height: clipboard.current.height
          };
          // Update clipboard for next paste
          clipboard.current = { ...clipboard.current, x: ns.x, y: ns.y };
          setSlots(prev => [...prev, ns]);
          setSelectedSlotId(ns.id);
          toast.success(`Slot ${slots.length + 1} colado!`);
        }
      }
    }
  }, [selectedSlotId, slots, setSlots, setSelectedSlotId]);

  React.useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  React.useEffect(() => {
    if (deletingId) {
      const timer = setTimeout(() => setDeletingId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [deletingId]);

  const toSvg = useCallback((e: MouseEvent | React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const r = svg.getBoundingClientRect();
    return { 
      x: Math.round((e.clientX - r.left) * config.width / r.width), 
      y: Math.round((e.clientY - r.top) * config.height / r.height) 
    };
  }, [config.width, config.height]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (mode !== 'draw') {
      // In select mode, clicking empty space clears selection
      if (mode === 'select' && !isDragging && !isResizing) {
         setSelectedSlotId(null);
      }
      return;
    }
    const c = toSvg(e);
    setIsDrawing(true); setDrawStart(c); setDrawCurrent(c);
  };

  const onMouseUp = useCallback(() => {
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
  }, [isDrawing, drawStart, drawCurrent, slots.length, setSelectedSlotId, setSlots]);

  const onMouseMove = useCallback((e: MouseEvent) => {
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
  }, [isDrawing, isDragging, isResizing, mode, selectedSlotId, dragOffset, resizeStart, toSvg, setSlots]);

  React.useEffect(() => {
    if (isDragging || isResizing || isDrawing) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      return () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
    }
  }, [isDragging, isResizing, isDrawing, onMouseMove, onMouseUp]);

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
    <div className="h-full flex overflow-hidden bg-zinc-950">
      {/* Sidebar */}
      <div className="w-[380px] border-r border-zinc-800/60 bg-zinc-950 p-8 overflow-y-auto custom-scrollbar flex flex-col gap-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/10 text-red-500 rounded-full text-[10px] font-semibold mb-3">
             <Layers className="w-3.5 h-3.5" /> Passo 2
           </div>
          <h2 className="text-xl font-semibold tracking-tight text-zinc-100">Grade & Distribuição</h2>
          <p className="text-[12px] text-zinc-400 font-medium mt-1">Desenhe os espaços onde os produtos serão posicionados.</p>
        </div>

        {/* Mode & Basic Actions */}
        <div className="flex flex-col gap-3">
           <span className="text-[11px] font-semibold text-zinc-500 px-1">Ferramentas de Grade</span>
           <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setMode('draw')}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl text-[12px] font-medium border transition-all ${mode === 'draw' ? 'bg-red-600 border-red-500 text-white shadow-md shadow-red-900/20' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}`}>
                <PenTool className="w-4 h-4" /> Desenhar
              </button>
              <button onClick={() => setMode('select')}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl text-[12px] font-medium border transition-all ${mode === 'select' ? 'bg-red-600 border-red-500 text-white shadow-md shadow-red-900/20' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}`}>
                <MousePointer className="w-4 h-4" /> Editar
              </button>
           </div>

           {slots.length > 0 && (
             <button onClick={() => { setSlots([]); setSelectedSlotId(null); }} className="w-full mt-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl py-3 text-[11px] font-semibold text-red-400 hover:text-red-300 transition-all">
                Limpar Grade Completa
             </button>
           )}
        </div>

        {/* Templates Section */}
        <div className="pt-6 border-t border-zinc-800/50 flex flex-col gap-4">
            <div className="flex items-center gap-2 px-1">
               <Zap className="w-4 h-4 text-amber-500" />
               <h3 className="text-[12px] font-semibold text-zinc-300">Templates: {selectedClientName || 'Geral'}</h3>
            </div>
            
            <div className="flex flex-col gap-3">
               <div className="relative group">
                 <input 
                   value={templateName} 
                   onChange={e => setTemplateName(e.target.value)}
                   placeholder={`Salvar em [${selectedClientName || 'Geral'}]...`} 
                   className="w-full bg-zinc-900 border border-zinc-800 rounded-xl h-11 px-4 text-[12px] font-medium text-zinc-100 outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 transition-all placeholder:text-zinc-600"
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
                   className="absolute right-2 top-1.5 p-2 bg-red-600 hover:bg-red-500 rounded-lg text-white hover:scale-105 transition-all disabled:opacity-30 disabled:scale-100 disabled:hover:bg-red-600"
                 >
                   <PlusCircle className="w-4 h-4" />
                 </button>
               </div>
               
               <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                  {isLoadingTemplates ? (
                    <p className="text-center py-4 text-[11px] font-medium text-zinc-600">Carregando...</p>
                  ) : filteredTemplates.map(t => (
                    <div key={t.id || t.name} className={`group flex items-center bg-zinc-900 border rounded-xl transition-all overflow-hidden ${deletingId === (t.id || t.name) ? 'border-red-500/50 bg-red-500/10' : 'border-zinc-800 hover:border-red-500/50'}`}>
                       <button 
                         onClick={() => { loadProjectTemplate(t.id); }}
                         className="flex-1 text-[11px] py-3 font-medium text-zinc-400 group-hover:text-zinc-200 text-left px-4 truncate transition-colors"
                         title={`Carregar template: ${t.name}`}
                       >
                         {t.name}
                       </button>
                       <button 
                         onClick={async (e) => {
                           e.stopPropagation(); e.preventDefault();
                           const currentId = t.id || t.name;
                           if (deletingId === currentId) {
                             await deleteProjectTemplate({ id: t.id, name: t.name });
                             setDeletingId(null);
                           } else setDeletingId(currentId);
                         }}
                         className={`p-3.5 transition-all border-l ${deletingId === (t.id || t.name) ? 'bg-red-500 border-red-500 text-white' : 'border-zinc-800 hover:bg-red-500/10 text-zinc-500 hover:text-red-400'}`}
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
        <div className="space-y-3 pt-4 border-t border-zinc-800/50">
          <label className="text-[11px] font-semibold text-zinc-500 flex justify-between items-center px-1">
            <span>Slots Individuais</span>
            <span className="bg-zinc-800 px-2.5 py-0.5 rounded-full text-zinc-300">{slots.length}</span>
          </label>
          <div className="flex flex-col gap-2">
            {slots.map((s, i) => (
              <div key={s.id} onClick={() => { setSelectedSlotId(s.id); setMode('select'); }}
                className={`rounded-xl p-2.5 cursor-pointer border flex items-center gap-3 transition-all ${selectedSlotId === s.id ? 'bg-red-500/10 border-red-500/30 ring-1 ring-red-500/20' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'}`}>
                <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-semibold ${selectedSlotId === s.id ? 'bg-red-500/20 text-red-400' : 'bg-zinc-800 text-zinc-500'}`}>{i + 1}</div>
                <p className="text-[11px] text-zinc-400 font-mono flex-1">{Math.round(s.x)},{Math.round(s.y)} · {Math.round(s.width)}×{Math.round(s.height)}</p>
                <button 
                  onClick={(e) => { e.stopPropagation(); setSlots(prev => prev.filter(sl => sl.id !== s.id)); if (selectedSlotId === s.id) setSelectedSlotId(null); }} 
                  className="text-zinc-500 hover:text-red-400 p-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {selectedSlot && (
          <div className="pt-4 border-t border-zinc-800/50 space-y-3">
            <label className="text-[11px] font-semibold text-red-400 px-1">Ajuste Fino — Slot {slots.indexOf(selectedSlot) + 1}</label>
            <div className="grid grid-cols-4 gap-2">
              {(['x', 'y', 'width', 'height'] as const).map(k => (
                <div key={k}>
                  <label className="text-[10px] text-zinc-500 font-medium mb-1 block text-center uppercase">{k === 'width' ? 'W' : k === 'height' ? 'H' : k}</label>
                  <input type="number" value={Math.round(selectedSlot[k])}
                    onChange={e => setSlots(prev => prev.map(s => s.id === selectedSlot.id ? { ...s, [k]: parseInt(e.target.value) || 0 } : s))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg h-9 px-1 text-[12px] text-zinc-200 text-center font-mono focus:border-red-500/50 transition-all outline-none" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Número de Telas ── */}
        <div className="pt-4 border-t border-zinc-800/50 flex flex-col gap-4">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 flex flex-col items-center gap-4">
            <h3 className="text-[12px] font-semibold text-zinc-400 flex items-center gap-2">
              <Layers className="w-4 h-4" /> Telas do Encarte
            </h3>
            <div className="flex items-center gap-5">
              <button onClick={() => setPageCount(Math.max(1, pageCount - 1))}
                className="w-10 h-10 rounded-xl bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-all text-zinc-400 hover:text-zinc-200">
                <Minus className="w-4 h-4" />
              </button>
              <span className="text-3xl font-semibold text-zinc-100 w-10 text-center">{pageCount}</span>
              <button onClick={() => setPageCount(pageCount + 1)}
                className="w-10 h-10 rounded-xl bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-all text-zinc-400 hover:text-zinc-200">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="bg-red-500/5 rounded-2xl p-5 border border-red-500/20">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-xl font-semibold text-zinc-200">{slots.length}</div>
                <div className="text-[10px] text-zinc-500 font-medium mt-1">slots/tela</div>
              </div>
              <div>
                <div className="text-xl font-semibold text-zinc-200">{pageCount}</div>
                <div className="text-[10px] text-zinc-500 font-medium mt-1">telas</div>
              </div>
              <div>
                <div className="text-xl font-semibold text-red-400">{slots.length * pageCount}</div>
                <div className="text-[10px] text-zinc-500 font-medium mt-1">total de itens</div>
              </div>
            </div>
            <p className="text-[11px] text-zinc-500 text-center mt-4 border-t border-red-500/10 pt-3">
              A mesma grade será repetida para cada tela.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-zinc-950/50 flex justify-center p-8 overflow-auto relative">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] opacity-[0.15] z-0 pointer-events-none" />
        <div className="m-auto relative z-10">
          <svg ref={svgRef} 
            width={config.width} height={config.height} viewBox={`0 0 ${config.width} ${config.height}`}
            style={{ width: '100%', maxWidth: '750px', height: 'auto', cursor: mode === 'draw' ? 'crosshair' : 'default', userSelect: 'none' }}
            className="shadow-2xl ring-1 ring-zinc-800/50 rounded-xl bg-zinc-900"
            onMouseDown={onMouseDown}>

            {config.backgroundImageUrl ? (
              <image href={config.backgroundImageUrl} width="100%" height="100%" preserveAspectRatio="xMidYMin slice" pointerEvents="none" />
            ) : <rect width="100%" height="100%" fill="#18181b" pointerEvents="none" />}

          {slots.map((s, i) => {
            const sel = selectedSlotId === s.id;
            return (
              <g key={s.id}>
                <rect x={s.x} y={s.y} width={s.width} height={s.height}
                  fill={sel ? 'rgba(220,38,38,0.15)' : 'rgba(255,255,255,0.05)'}
                  stroke={sel ? '#dc2626' : 'rgba(255,255,255,0.3)'}
                  strokeWidth={sel ? 3 : 1.5}
                  strokeDasharray={sel ? '' : '8,4'} rx={8}
                  style={{ cursor: mode === 'select' ? 'move' : 'crosshair' }}
                  onMouseDown={e => onSlotDown(e, s)}
                  onClick={e => e.stopPropagation()} />
                <rect x={s.x + 8} y={s.y + 8} width={24} height={24} rx={6} fill={sel ? '#dc2626' : 'rgba(0,0,0,0.5)'} pointerEvents="none" />
                <text x={s.x + 20} y={s.y + 24} fontSize={14} fill="#ffffff" fontWeight="600" textAnchor="middle" fontFamily="sans-serif" pointerEvents="none">{i + 1}</text>
                {sel && (
                  <g onMouseDown={e => onResizeDown(e, s)} onClick={e => e.stopPropagation()} style={{ cursor: 'nwse-resize' }}>
                    <circle cx={s.x + s.width} cy={s.y + s.height} r={16} fill="transparent" />
                    <circle cx={s.x + s.width} cy={s.y + s.height} r={8} fill="#ffffff" stroke="#dc2626" strokeWidth={2} />
                  </g>
                )}
              </g>
            );
          })}

          {isDrawing && dr && (
            <rect x={dr.x} y={dr.y} width={dr.w} height={dr.h} fill="rgba(220,38,38,0.1)" stroke="#dc2626" strokeWidth={2} strokeDasharray="6,3" rx={8} pointerEvents="none" />
          )}
          </svg>
        </div>
      </div>
    </div>
  );
};
