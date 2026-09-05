import React, { useRef, useState, useCallback } from 'react';
import { useOffer, Slot } from '../context/OfferContext';
import { Trash2, MousePointer, PenTool, Zap, PlusCircle, Plus, Minus, Layers, Maximize } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const StepSlots = () => {
  const { 
    config, slots, setSlots, selectedSlotId, setSelectedSlotId,
    selectedSlotIds, setSelectedSlotIds,
    pageTemplates, saveProjectTemplate, loadProjectTemplate, deleteProjectTemplate, isLoadingTemplates, selectedClientName,
    pageCount, setPageCount, activePage, setActivePage,
    pushHistory, undo
  } = useOffer();

  const filteredTemplates = React.useMemo(() => {
    return pageTemplates.filter(t => t.client === selectedClientName);
  }, [pageTemplates, selectedClientName]);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const completeTemplates = React.useMemo(() => filteredTemplates.filter(t => t.config?.templateType !== 'individual'), [filteredTemplates]);
  const individualTemplates = React.useMemo(() => filteredTemplates.filter(t => t.config?.templateType === 'individual'), [filteredTemplates]);
  
  const [zoom, setZoom] = useState(0.7);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, ox: 0, oy: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [mode, setMode] = useState<'draw' | 'select'>('select');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingSlotId, setDeletingSlotId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPoint, setDragStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [dragInitialSlots, setDragInitialSlots] = useState<Slot[]>([]);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState<{ sx: number; sy: number } | null>(null);
  const [resizeInitialAllSlots, setResizeInitialAllSlots] = useState<Slot[]>([]);
  const [isMarqueeSelecting, setIsMarqueeSelecting] = useState(false);
  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(null);
  const [marqueeCurrent, setMarqueeCurrent] = useState<{ x: number; y: number } | null>(null);

  const clipboard = useRef<Omit<Slot, 'id'>[]>([]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    if (e.code === 'Space') {
      if (!isSpacePressed) {
        setIsSpacePressed(true);
      }
      e.preventDefault();
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedSlotIds.length > 0) {
        setSlots(prev => prev.filter(s => !selectedSlotIds.includes(s.id)));
        setTimeout(() => pushHistory(), 10);
        setSelectedSlotIds([]);
        setSelectedSlotId(null);
        toast.info(`${selectedSlotIds.length} slot(s) removido(s)`);
      }
    }

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      if (selectedSlotIds.length > 0) {
        e.preventDefault();
        const amount = e.shiftKey ? 10 : 1;
        let dx = 0;
        let dy = 0;
        if (e.key === 'ArrowUp') dy = -amount;
        if (e.key === 'ArrowDown') dy = amount;
        if (e.key === 'ArrowLeft') dx = -amount;
        if (e.key === 'ArrowRight') dx = amount;

        setSlots(prev => prev.map(s => {
          if (selectedSlotIds.includes(s.id)) {
            return { ...s, x: s.x + dx, y: s.y + dy };
          }
          return s;
        }));
      }
    }
    if (e.ctrlKey || e.metaKey) {
      if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      }
      if (e.key === 'c' || e.key === 'C') {
        const toCopy = slots.filter(s => selectedSlotIds.includes(s.id));
        if (toCopy.length > 0) {
          clipboard.current = toCopy.map(s => ({ x: s.x, y: s.y, width: s.width, height: s.height, pageIndex: s.pageIndex }));
          toast.info(`${toCopy.length} slot(s) copiado(s)!`);
        }
      }
      if (e.key === 'v' || e.key === 'V') {
        if (clipboard.current.length > 0) {
            const minX = Math.min(...clipboard.current.map(s => s.x));
            const maxX = Math.max(...clipboard.current.map(s => s.x + s.width));
            const groupWidth = maxX - minX;

            let shiftX = groupWidth + 10;
            let shiftY = 0;

            if (maxX + shiftX > config.width) {
               shiftX = -minX + 10;
               const maxItemHeight = Math.max(...clipboard.current.map(s => s.height));
               shiftY = maxItemHeight + 10;
            }

            const newClipboard = clipboard.current.map(clipSlot => ({
               ...clipSlot,
               x: clipSlot.x + shiftX,
               y: clipSlot.y + shiftY
            }));
          
          const newSlots: Slot[] = newClipboard.map(clipSlot => ({
             id: crypto.randomUUID(),
             x: clipSlot.x,
             y: clipSlot.y,
             width: clipSlot.width,
             height: clipSlot.height,
             pageIndex: activePage
          }));
          
          clipboard.current = newClipboard;
          
          setPageSlots(prev => [...prev, ...newSlots]);
          setTimeout(() => pushHistory(), 10);
          setSelectedSlotIds(newSlots.map(s => s.id));
          setSelectedSlotId(newSlots[newSlots.length - 1].id);
          toast.success(`${newSlots.length} slot(s) colado(s)!`);
        }
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedSlotIds.length > 0) {
          setSlots(prev => prev.filter(s => !selectedSlotIds.includes(s.id)));
          setTimeout(() => pushHistory(), 10);
          setSelectedSlotIds([]);
          setSelectedSlotId(null);
          toast.info(`${selectedSlotIds.length} slot(s) removido(s)`);
        }
      }
    }
  }, [selectedSlotIds, slots, setSlots, setSelectedSlotId, setSelectedSlotIds, isSpacePressed, mode, activePage, config.width, pushHistory, undo]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.code === 'Space') {
      setIsSpacePressed(false);
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      if (selectedSlotIds.length > 0) {
        setTimeout(() => pushHistory(), 10);
      }
    }
  }, [selectedSlotIds, pushHistory]);

  React.useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  React.useEffect(() => {
    if (deletingId) {
      const timer = setTimeout(() => setDeletingId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [deletingId]);

  const currentPageSlots = React.useMemo(() => {
    return slots.filter(s => (s.pageIndex || 0) === activePage);
  }, [slots, activePage]);

  const setPageSlots = useCallback((newSlotsOrFn: Slot[] | ((prev: Slot[]) => Slot[])) => {
    setSlots(prev => {
      const currentPage = prev.filter(s => (s.pageIndex || 0) === activePage);
      const updated = typeof newSlotsOrFn === 'function' ? newSlotsOrFn(currentPage) : newSlotsOrFn;
      
      const maxPage = Math.max(...prev.map(s => s.pageIndex || 0), activePage);
      const allPages = [];
      for (let i = 0; i <= maxPage; i++) {
        if (i === activePage) {
          allPages.push(...updated.map(s => ({ ...s, pageIndex: activePage })));
        } else {
          allPages.push(...prev.filter(s => (s.pageIndex || 0) === i));
        }
      }
      return allPages;
    });
  }, [activePage, setSlots]);

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
    if (isSpacePressed || e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY, ox: panOffset.x, oy: panOffset.y });
      return;
    }

    if (mode !== 'draw') {
      if (mode === 'select' && !isDragging && !isResizing) {
         if (!e.shiftKey) {
           setSelectedSlotIds([]);
           setSelectedSlotId(null);
         }
         const c = toSvg(e);
         setIsMarqueeSelecting(true);
         setMarqueeStart(c);
         setMarqueeCurrent(c);
      }
      return;
    }

    const c = toSvg(e);
    setIsDrawing(true); setDrawStart(c); setDrawCurrent(c);
  };

  const onMouseUp = useCallback((e: MouseEvent) => {
    if (isPanning) { setIsPanning(false); return; }
    if (isMarqueeSelecting && marqueeStart && marqueeCurrent) {
      const minX = Math.min(marqueeStart.x, marqueeCurrent.x);
      const minY = Math.min(marqueeStart.y, marqueeCurrent.y);
      const maxX = Math.max(marqueeStart.x, marqueeCurrent.x);
      const maxY = Math.max(marqueeStart.y, marqueeCurrent.y);
      
      const intersectingSlots = slots.filter(s => {
        if ((s.pageIndex || 0) !== activePage) return false;
        return !(s.x + s.width < minX || s.x > maxX || s.y + s.height < minY || s.y > maxY);
      });
      
      if (intersectingSlots.length > 0) {
        const newIds = intersectingSlots.map(s => s.id);
        if (e.shiftKey) {
          const combined = Array.from(new Set([...selectedSlotIds, ...newIds]));
          setSelectedSlotIds(combined);
          setSelectedSlotId(combined[combined.length - 1]);
        } else {
          setSelectedSlotIds(newIds);
          setSelectedSlotId(newIds[newIds.length - 1]);
        }
      } else if (!e.shiftKey) {
        setSelectedSlotIds([]);
        setSelectedSlotId(null);
      }
      
      setIsMarqueeSelecting(false); setMarqueeStart(null); setMarqueeCurrent(null);
      return;
    }
    if (isDrawing && drawStart && drawCurrent) {
      const x = Math.min(drawStart.x, drawCurrent.x);
      const y = Math.min(drawStart.y, drawCurrent.y);
      const w = Math.abs(drawCurrent.x - drawStart.x);
      const h = Math.abs(drawCurrent.y - drawStart.y);
      if (w > 30 && h > 30) {
        const ns: Slot = { id: crypto.randomUUID(), x, y, width: w, height: h, pageIndex: activePage };
        setPageSlots(prev => [...prev, ns]);
        setTimeout(() => pushHistory(), 10);
        setSelectedSlotIds([ns.id]);
        setSelectedSlotId(ns.id);
        toast.success(`Slot criado na Tela ${activePage + 1}!`);
      }
    }
    
    if (isDragging || isResizing) {
       setTimeout(() => pushHistory(), 10);
    }
    
    setIsDrawing(false); setDrawStart(null); setDrawCurrent(null);
    setIsDragging(false); setIsResizing(false); setResizeStart(null); setDragInitialSlots([]); setDragStartPoint(null);
    setResizeInitialAllSlots([]);
  }, [isPanning, isDrawing, drawStart, drawCurrent, activePage, setSelectedSlotId, setSelectedSlotIds, setPageSlots, isDragging, isResizing, pushHistory, isMarqueeSelecting, marqueeStart, marqueeCurrent, slots, selectedSlotIds]);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (isPanning) {
      setPanOffset({ x: panStart.ox + (e.clientX - panStart.x), y: panStart.oy + (e.clientY - panStart.y) });
      return;
    }
    if (isMarqueeSelecting && marqueeStart) {
      setMarqueeCurrent(toSvg(e));
      return;
    }
    if (isDrawing && mode === 'draw') { setDrawCurrent(toSvg(e)); return; }
    if (isDragging && dragStartPoint && dragInitialSlots.length > 0) {
      const c = toSvg(e);
      let dx = c.x - dragStartPoint.x;
      let dy = c.y - dragStartPoint.y;

      if (e.shiftKey) {
         if (Math.abs(dx) > Math.abs(dy)) {
            dy = 0;
         } else {
            dx = 0;
         }
      }

      setPageSlots(prev => prev.map(s => {
        const init = dragInitialSlots.find(ds => ds.id === s.id);
        if (init) {
          return { ...s, x: init.x + dx, y: init.y + dy };
        }
        return s;
      }));
      return;
    }
    if (isResizing && resizeStart && resizeInitialAllSlots.length > 0) {
      const c = toSvg(e);
      let dx = c.x - resizeStart.sx;
      let dy = c.y - resizeStart.sy;
      
      const selectedInit = resizeInitialAllSlots.filter(s => selectedSlotIds.includes(s.id));
      if (selectedInit.length === 0) return;

      const minX = Math.min(...selectedInit.map(s => s.x));
      const minY = Math.min(...selectedInit.map(s => s.y));
      const maxX = Math.max(...selectedInit.map(s => s.x + s.width));
      const maxY = Math.max(...selectedInit.map(s => s.y + s.height));
      const origW = maxX - minX;
      const origH = maxY - minY;

      const newW = Math.max(50, origW + dx);
      const newH = Math.max(50, origH + dy);

      const scaleX = newW / origW;
      const scaleY = newH / origH;

      setPageSlots(prev => prev.map(s => {
        if (!selectedSlotIds.includes(s.id)) return s;
        
        const init = resizeInitialAllSlots.find(rs => rs.id === s.id);
        if (!init) return s;

        return {
          ...s,
          x: minX + (init.x - minX) * scaleX,
          y: minY + (init.y - minY) * scaleY,
          width: Math.max(10, init.width * scaleX),
          height: Math.max(10, init.height * scaleY)
        };
      }));
    }
  }, [isPanning, panStart, isDrawing, isDragging, isResizing, mode, selectedSlotId, dragStartPoint, dragInitialSlots, resizeStart, resizeInitialAllSlots, toSvg, setPageSlots, config.width, config.height, isMarqueeSelecting, marqueeStart]);

  React.useEffect(() => {
    if (isDragging || isResizing || isDrawing || isPanning || isMarqueeSelecting) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      return () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
    }
  }, [isDragging, isResizing, isDrawing, isPanning, isMarqueeSelecting, onMouseMove, onMouseUp]);

  const onSlotDown = (e: React.MouseEvent, slot: Slot) => {
    e.stopPropagation();
    if (mode !== 'select') return;
    
    let currentSelectedIds = selectedSlotIds;
    if (e.shiftKey) {
      if (selectedSlotIds.includes(slot.id)) {
        currentSelectedIds = selectedSlotIds.filter(id => id !== slot.id);
      } else {
        currentSelectedIds = [...selectedSlotIds, slot.id];
      }
    } else {
      if (!selectedSlotIds.includes(slot.id)) {
        currentSelectedIds = [slot.id];
      }
    }
    
    setSelectedSlotIds(currentSelectedIds);
    setSelectedSlotId(currentSelectedIds.length > 0 ? currentSelectedIds[currentSelectedIds.length - 1] : null);

    const c = toSvg(e);
    setDragStartPoint(c);
    
    const slotsToDrag = slots.filter(s => currentSelectedIds.includes(s.id));
    setDragInitialSlots(slotsToDrag);
    
    setIsDragging(true);
  };

  const onGroupResizeDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    const c = toSvg(e);
    setIsResizing(true);
    setResizeStart({ sx: c.x, sy: c.y });
    setResizeInitialAllSlots(currentPageSlots.map(s => ({...s})));
  };

  const dr = drawStart && drawCurrent ? {
    x: Math.min(drawStart.x, drawCurrent.x), y: Math.min(drawStart.y, drawCurrent.y),
    w: Math.abs(drawCurrent.x - drawStart.x), h: Math.abs(drawCurrent.y - drawStart.y),
  } : null;

  const selectedSlotsData = currentPageSlots.filter(s => selectedSlotIds.includes(s.id));
  let boundingBox = null;
  if (selectedSlotsData.length > 0) {
     const minX = Math.min(...selectedSlotsData.map(s => s.x));
     const minY = Math.min(...selectedSlotsData.map(s => s.y));
     const maxX = Math.max(...selectedSlotsData.map(s => s.x + s.width));
     const maxY = Math.max(...selectedSlotsData.map(s => s.y + s.height));
     boundingBox = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  const selectedSlot = currentPageSlots.find(s => s.id === selectedSlotId);

  return (
    <div className="h-full flex overflow-hidden bg-zinc-950">
      {/* Sidebar */}
      <div className="w-[380px] border-r border-zinc-800/60 bg-zinc-950 p-8 overflow-y-auto custom-scrollbar flex flex-col gap-8">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-zinc-100">Grade & Distribuição</h2>
          <p className="text-[12px] text-zinc-400 font-medium mt-1">Desenhe os espaços onde os produtos serão posicionados.</p>
        </div>

        {/* Visual Screen Selector */}
        <div className="flex flex-col gap-3">
          <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest px-1">Navegar pelas Telas</label>
          <div className="flex flex-col gap-2">
            {Array.from({ length: pageCount }).map((_, i) => (
              <button
                key={i}
                onClick={() => { setActivePage(i); setSelectedSlotIds([]); setSelectedSlotId(null); }}
                className={`group flex items-center justify-between p-3 rounded-xl border transition-all ${
                  activePage === i
                    ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-900/20'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold ${activePage === i ? 'bg-white/20' : 'bg-zinc-800'}`}>
                    {i + 1}
                  </div>
                  <span className="text-[12px] font-bold">TELA {i + 1}</span>
                </div>
                <div className="flex items-center gap-2">
                   <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${activePage === i ? 'bg-black/20' : 'bg-zinc-800'}`}>
                     {slots.filter(s => (s.pageIndex || 0) === i).length} slots
                   </span>
                   {activePage === i && <Layers className="w-3.5 h-3.5 animate-pulse" />}
                </div>
              </button>
            ))}
          </div>
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

           <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 mt-2">
                <button onClick={() => setZoom(z => Math.max(0.1, z - 0.1))} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-red-500 transition-all"><Minus className="w-4 h-4" /></button>
                <span className="text-[11px] font-bold text-zinc-300 flex-1 text-center">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(z => Math.min(3, z + 0.1))} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-red-500 transition-all"><Plus className="w-4 h-4" /></button>
                <button onClick={() => { setZoom(0.7); setPanOffset({ x: 0, y: 0 }); }} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-100 transition-all ml-1 border-l border-zinc-800 pl-3">
                  <Maximize className="w-3.5 h-3.5" />
                </button>
           </div>
           <p className="text-[10px] text-zinc-600 font-medium px-1 text-center italic">Segure ESPAÇO para andar pela arte</p>
        </div>

        {/* Templates Section */}
        <div className="pt-6 border-t border-zinc-800/50 flex flex-col gap-4 flex-1 min-h-[300px]">
            <div className="flex items-center justify-between px-1">
               <div className="flex items-center gap-2">
                 <Zap className="w-4 h-4 text-amber-500" />
                 <h3 className="text-[12px] font-semibold text-zinc-300">Templates: {selectedClientName || 'Geral'}</h3>
               </div>
               
               <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
                 <DialogTrigger asChild>
                   <button 
                     disabled={slots.length === 0}
                     className="px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded-lg text-white text-[10px] font-bold uppercase transition-all disabled:opacity-30 flex items-center gap-1.5"
                   >
                     <PlusCircle className="w-3.5 h-3.5" /> Novo
                   </button>
                 </DialogTrigger>
                 <DialogContent className="bg-zinc-950 border-zinc-800 text-white sm:max-w-[425px]">
                   <DialogHeader>
                     <DialogTitle className="text-xl text-white">Salvar Template</DialogTitle>
                   </DialogHeader>
                   <div className="py-4 space-y-4">
                     <div>
                       <label className="text-xs font-medium text-zinc-400 mb-1.5 block">Nome do Template</label>
                       <input 
                         value={templateName} 
                         onChange={e => setTemplateName(e.target.value)}
                         placeholder="Ex: 4 Produtos" 
                         className="w-full bg-zinc-900 border border-zinc-800 rounded-xl h-11 px-4 text-sm text-white outline-none focus:border-red-500/50 transition-all"
                       />
                     </div>
                     
                     <div className="grid grid-cols-2 gap-3 pt-2">
                       <button 
                         onClick={async () => {
                           if (!templateName) return toast.error('Dê um nome ao template');
                           setIsSaving(true);
                           await saveProjectTemplate(templateName, 'complete');
                           setTemplateName('');
                           setIsSaving(false);
                           setIsTemplateDialogOpen(false);
                         }}
                         disabled={isSaving}
                         className="flex flex-col items-center justify-center gap-2 bg-zinc-900 hover:bg-red-500/10 border border-zinc-800 hover:border-red-500/50 p-4 rounded-xl transition-all"
                       >
                         <Layers className="w-6 h-6 text-zinc-400" />
                         <div className="text-center">
                           <p className="text-[11px] font-bold text-zinc-200">Oferta Completa</p>
                           <p className="text-[9px] text-zinc-500 mt-1">Salva todas as {pageCount} telas</p>
                         </div>
                       </button>

                       <button 
                         onClick={async () => {
                           if (!templateName) return toast.error('Dê um nome ao template');
                           setIsSaving(true);
                           await saveProjectTemplate(templateName, 'individual');
                           setTemplateName('');
                           setIsSaving(false);
                           setIsTemplateDialogOpen(false);
                         }}
                         disabled={isSaving}
                         className="flex flex-col items-center justify-center gap-2 bg-zinc-900 hover:bg-red-500/10 border border-zinc-800 hover:border-red-500/50 p-4 rounded-xl transition-all"
                       >
                         <svg className="w-6 h-6 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
                         <div className="text-center">
                           <p className="text-[11px] font-bold text-red-400">Apenas Tela Atual</p>
                           <p className="text-[9px] text-zinc-500 mt-1">Salva o layout da Tela {activePage + 1}</p>
                         </div>
                       </button>
                     </div>
                   </div>
                 </DialogContent>
               </Dialog>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-5">
               {isLoadingTemplates ? (
                 <p className="text-center py-4 text-[11px] font-medium text-zinc-600">Carregando...</p>
               ) : (
                 <>
                   {/* INDIVIDUAL TEMPLATES */}
                   {individualTemplates.length > 0 && (
                     <div className="space-y-2">
                       <h4 className="text-[10px] font-black tracking-widest text-red-400 uppercase border-b border-zinc-800 pb-1 mb-2">📁 Telas Individuais</h4>
                       {individualTemplates.map(t => (
                         <div key={t.id || t.name} className={`group flex items-center bg-zinc-900 border rounded-xl transition-all overflow-hidden ${deletingId === (t.id || t.name) ? 'border-red-500/50 bg-red-500/10' : 'border-zinc-800 hover:border-red-500/50'}`}>
                            <button 
                              onClick={() => { loadProjectTemplate(t.id); }}
                              className="flex-1 text-[11px] py-2.5 font-bold text-red-300 group-hover:text-red-400 text-left px-4 truncate transition-colors flex items-center gap-2"
                              title={`Carregar tela individual: ${t.name}`}
                            >
                              <div className="w-1.5 h-1.5 rounded-full bg-red-500/50" />
                              {t.name}
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation(); e.preventDefault();
                                const currentId = t.id || t.name;
                                if (deletingId === currentId) {
                                  deleteProjectTemplate({ id: t.id, name: t.name });
                                  setDeletingId(null);
                                } else setDeletingId(currentId);
                              }}
                              className={`p-3 transition-all border-l ${deletingId === (t.id || t.name) ? 'bg-red-500 border-red-500 text-white' : 'border-zinc-800 hover:bg-red-500/10 text-zinc-500 hover:text-red-400'}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                         </div>
                       ))}
                     </div>
                   )}

                   {/* COMPLETE TEMPLATES */}
                   {completeTemplates.length > 0 && (
                     <div className="space-y-2">
                       <h4 className="text-[10px] font-black tracking-widest text-zinc-500 uppercase border-b border-zinc-800 pb-1 mb-2">📁 Ofertas Completas</h4>
                       {completeTemplates.map(t => (
                         <div key={t.id || t.name} className={`group flex items-center bg-zinc-900 border rounded-xl transition-all overflow-hidden ${deletingId === (t.id || t.name) ? 'border-red-500/50 bg-red-500/10' : 'border-zinc-800 hover:border-red-500/50'}`}>
                            <button 
                              onClick={() => { loadProjectTemplate(t.id); }}
                              className="flex-1 text-[11px] py-2.5 font-medium text-zinc-400 group-hover:text-zinc-200 text-left px-4 truncate transition-colors flex items-center gap-2"
                              title={`Carregar oferta completa: ${t.name}`}
                            >
                              <Layers className="w-3 h-3 opacity-50" />
                              {t.name}
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation(); e.preventDefault();
                                const currentId = t.id || t.name;
                                if (deletingId === currentId) {
                                  deleteProjectTemplate({ id: t.id, name: t.name });
                                  setDeletingId(null);
                                } else setDeletingId(currentId);
                              }}
                              className={`p-3 transition-all border-l ${deletingId === (t.id || t.name) ? 'bg-red-500 border-red-500 text-white' : 'border-zinc-800 hover:bg-red-500/10 text-zinc-500 hover:text-red-400'}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                         </div>
                       ))}
                     </div>
                   )}
                 </>
               )}
            </div>
        </div>

        {/* Slot list */}
        <div className="space-y-3 pt-4 border-t border-zinc-800/50">
          <label className="text-[11px] font-semibold text-zinc-500 flex justify-between items-center px-1">
            <span>Slots da Tela {activePage + 1}</span>
            <span className="bg-zinc-800 px-2.5 py-0.5 rounded-full text-zinc-300">{currentPageSlots.length}</span>
          </label>
          <div className="flex flex-col gap-2">
            {currentPageSlots.map((s, i) => {
              const sel = selectedSlotIds.includes(s.id);
              return (
                <div key={s.id} onClick={(e) => { 
                    if (e.shiftKey) {
                      const newIds = sel ? selectedSlotIds.filter(id => id !== s.id) : [...selectedSlotIds, s.id];
                      setSelectedSlotIds(newIds);
                      setSelectedSlotId(newIds.length > 0 ? newIds[0] : null);
                    } else {
                      setSelectedSlotIds([s.id]); 
                      setSelectedSlotId(s.id);
                    }
                    setMode('select'); 
                  }}
                  className={`rounded-xl p-2.5 cursor-pointer border flex items-center gap-3 transition-all ${sel ? 'bg-red-500/10 border-red-500/30 ring-1 ring-red-500/20' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'}`}>
                  <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-semibold ${sel ? 'bg-red-500/20 text-red-400' : 'bg-zinc-800 text-zinc-500'}`}>{i + 1}</div>
                  <p className="text-[11px] text-zinc-400 font-mono flex-1 text-xs truncate">{Math.round(s.x)},{Math.round(s.y)} · {Math.round(s.width)}×{Math.round(s.height)}</p>
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      if (deletingSlotId === s.id) {
                        setPageSlots(prev => prev.filter(sl => sl.id !== s.id)); 
                        setTimeout(() => pushHistory(), 10);
                        if (selectedSlotIds.includes(s.id)) {
                          const newIds = selectedSlotIds.filter(id => id !== s.id);
                          setSelectedSlotIds(newIds);
                          if (selectedSlotId === s.id) setSelectedSlotId(newIds.length > 0 ? newIds[0] : null);
                        }
                        setDeletingSlotId(null);
                      } else {
                        setDeletingSlotId(s.id);
                      }
                    }} 
                    className={`p-1.5 transition-colors rounded ${deletingSlotId === s.id ? 'bg-red-500 text-white animate-pulse' : 'text-zinc-500 hover:text-red-400'}`}
                    title={deletingSlotId === s.id ? "Clique de novo para excluir" : "Excluir Grade"}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {selectedSlot && (
          <div className="pt-4 border-t border-zinc-800/50 space-y-3">
            <label className="text-[11px] font-semibold text-red-400 px-1">Ajuste Fino — Slot {currentPageSlots.indexOf(selectedSlot) + 1}</label>
            <div className="grid grid-cols-4 gap-2">
              {(['x', 'y', 'width', 'height'] as const).map(k => (
                <div key={k}>
                  <label className="text-[10px] text-zinc-500 font-medium mb-1 block text-center uppercase">{k === 'width' ? 'W' : k === 'height' ? 'H' : k}</label>
                  <input type="number" value={Math.round(selectedSlot[k])}
                    onChange={e => setPageSlots(prev => prev.map(s => s.id === selectedSlot.id ? { ...s, [k]: parseInt(e.target.value) || 0 } : s))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg h-9 px-1 text-[12px] text-zinc-200 text-center font-mono focus:border-red-500/50 transition-all outline-none" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Screen Count Controls */}
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
                <div className="text-xl font-semibold text-zinc-200">{currentPageSlots.length}</div>
                <div className="text-[10px] text-zinc-500 font-medium mt-1">slots/tela</div>
              </div>
              <div>
                <div className="text-xl font-semibold text-zinc-200">{pageCount}</div>
                <div className="text-[10px] text-zinc-500 font-medium mt-1">telas</div>
              </div>
              <div>
                <div className="text-xl font-semibold text-red-400">{slots.length}</div>
                <div className="text-[10px] text-zinc-500 font-medium mt-1">total slots</div>
              </div>
            </div>
            <p className="text-[11px] text-zinc-500 text-center mt-4 border-t border-red-500/10 pt-3 italic">
              Cada tela agora tem sua grade independente.
            </p>
          </div>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 bg-zinc-950/50 flex flex-col overflow-hidden relative">
        {/* Floating Page Switcher */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 p-1.5 bg-zinc-900/90 border border-zinc-800/80 backdrop-blur-md rounded-2xl shadow-2xl">
          <button 
            onClick={() => setActivePage(Math.max(0, activePage - 1))}
            disabled={activePage === 0}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-zinc-800 text-zinc-300 transition-all"
          >
            <Minus className="w-4 h-4" />
          </button>
          
          <div className="px-6 py-1 flex flex-col items-center min-w-[120px]">
            <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-0.5">Editando Grade</span>
            <span className="text-sm font-black text-zinc-100 uppercase tracking-tight">TELA {activePage + 1} de {pageCount}</span>
          </div>

          <button 
            onClick={() => {
              if (activePage < pageCount - 1) setActivePage(activePage + 1);
              else {
                setPageCount(pageCount + 1);
                setActivePage(pageCount);
              }
            }}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-all"
          >
            {activePage < pageCount - 1 ? <Plus className="w-4 h-4" /> : <PlusCircle className="w-4 h-4 text-red-500" />}
          </button>
        </div>

        <div 
          className="flex-1 flex items-center justify-center overflow-hidden relative"
          onWheel={e => { setZoom(z => Math.min(3, Math.max(0.1, z + (e.deltaY > 0 ? -0.05 : 0.05)))); }}
          onMouseDown={onMouseDown}
          style={{ cursor: isPanning ? 'grabbing' : isSpacePressed ? 'grab' : 'default' }}
        >
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] opacity-[0.15] z-0 pointer-events-none" />
          <div 
            className="relative z-10 transition-transform duration-75"
            style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`, transformOrigin: 'center center' }}
          >
            <svg ref={svgRef} 
              width={config.width} height={config.height} viewBox={`0 0 ${config.width} ${config.height}`}
              style={{ width: config.width + 'px', height: config.height + 'px', cursor: isSpacePressed ? 'grabbing' : mode === 'draw' ? 'crosshair' : 'default', userSelect: 'none' }}
              className="shadow-2xl ring-1 ring-zinc-800/50 rounded-xl bg-zinc-900"
            >
              {config.backgroundImageUrl ? (
                <image href={config.backgroundImageUrl} width="100%" height="100%" preserveAspectRatio="xMidYMin slice" pointerEvents="none" />
              ) : <rect width="100%" height="100%" fill="#18181b" pointerEvents="none" />}

              {isSpacePressed && (
                <rect 
                  width="100%" 
                  height="100%" 
                  fill="transparent" 
                  style={{ cursor: isPanning ? 'grabbing' : 'grab' }} 
                />
              )}

              {currentPageSlots.map((s, i) => {
                const sel = selectedSlotIds.includes(s.id);
                const isPrimary = selectedSlotId === s.id;
                return (
                  <g key={s.id}>
                    <rect x={s.x} y={s.y} width={s.width} height={s.height}
                      fill={sel ? 'rgba(220,38,38,0.15)' : 'rgba(0,0,0,0.1)'}
                      stroke={sel ? '#dc2626' : '#2563eb'}
                      strokeWidth={sel ? 3 : 2}
                      strokeDasharray={sel ? '' : '6,3'} rx={12}
                      style={{ cursor: mode === 'select' ? 'move' : 'crosshair' }}
                      onMouseDown={e => onSlotDown(e, s)}
                      onClick={e => e.stopPropagation()} />
                    <rect x={s.x + 8} y={s.y + 8} width={24} height={24} rx={6} fill={sel ? '#dc2626' : 'rgba(0,0,0,0.5)'} pointerEvents="none" />
                    <text x={s.x + 20} y={s.y + 24} fontSize={14} fill="#ffffff" fontWeight="600" textAnchor="middle" fontFamily="sans-serif" pointerEvents="none">{i + 1}</text>
                  </g>
                );
              })}

              {boundingBox && selectedSlotIds.length > 0 && (
                <g pointerEvents="none">
                  {selectedSlotIds.length > 1 && (
                    <rect x={boundingBox.x} y={boundingBox.y} width={boundingBox.w} height={boundingBox.h} fill="transparent" stroke="#dc2626" strokeWidth={1} strokeDasharray="6,3" />
                  )}
                  <g pointerEvents="auto" onMouseDown={onGroupResizeDown} onClick={e => e.stopPropagation()} style={{ cursor: 'nwse-resize' }}>
                    <circle cx={boundingBox.x + boundingBox.w} cy={boundingBox.y + boundingBox.h} r={16} fill="transparent" />
                    <circle cx={boundingBox.x + boundingBox.w} cy={boundingBox.y + boundingBox.h} r={8} fill="#ffffff" stroke="#dc2626" strokeWidth={2} />
                  </g>
                </g>
              )}

              {isDrawing && dr && (
                <rect x={dr.x} y={dr.y} width={dr.w} height={dr.h} fill="rgba(220,38,38,0.1)" stroke="#dc2626" strokeWidth={2} strokeDasharray="6,3" rx={8} pointerEvents="none" />
              )}
              
              {isMarqueeSelecting && marqueeStart && marqueeCurrent && (() => {
                const mx = Math.min(marqueeStart.x, marqueeCurrent.x);
                const my = Math.min(marqueeStart.y, marqueeCurrent.y);
                const mw = Math.abs(marqueeCurrent.x - marqueeStart.x);
                const mh = Math.abs(marqueeCurrent.y - marqueeStart.y);
                return (
                  <rect x={mx} y={my} width={mw} height={mh} fill="rgba(37,99,235,0.1)" stroke="#2563eb" strokeWidth={1.5} strokeDasharray="4,4" pointerEvents="none" />
                );
              })()}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};
