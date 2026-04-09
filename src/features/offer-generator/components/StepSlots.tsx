import React, { useRef, useState, useCallback } from 'react';
import { useOffer, Slot } from '../context/OfferContext';
import { Trash2, MousePointer, PenTool } from 'lucide-react';
import { toast } from 'sonner';

export const StepSlots = () => {
  const { config, slots, setSlots, selectedSlotId, setSelectedSlotId } = useOffer();
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [mode, setMode] = useState<'draw' | 'select'>('draw');
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState<{ origW: number; origH: number; sx: number; sy: number } | null>(null);

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
    <div className="h-full flex">
      {/* Sidebar */}
      <div className="w-[340px] border-r border-white/5 bg-[#121214] p-5 overflow-y-auto custom-scrollbar space-y-5">
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-white mb-1">Etapa 2</h2>
          <p className="text-[10px] text-white/30 font-bold uppercase tracking-wider">Defina onde os produtos vão aparecer</p>
        </div>

        {/* Mode */}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setMode('draw')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-bold uppercase border transition-all ${mode === 'draw' ? 'bg-green-500/20 border-green-500/40 text-green-400' : 'bg-white/5 border-white/10 text-white/40'}`}>
            <PenTool className="w-3.5 h-3.5" /> Desenhar
          </button>
          <button onClick={() => setMode('select')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-bold uppercase border transition-all ${mode === 'select' ? 'bg-blue-500/20 border-blue-500/40 text-blue-400' : 'bg-white/5 border-white/10 text-white/40'}`}>
            <MousePointer className="w-3.5 h-3.5" /> Mover
          </button>
        </div>
        <p className="text-[9px] text-white/20 leading-relaxed">
          {mode === 'draw' ? '✏️ Clique e arraste na arte para criar uma área de slot.' : '☝ Clique num slot para mover. Use o handle azul para redimensionar.'}
        </p>

        {/* Slot list */}
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-white/40 flex justify-between">
            <span>Slots</span>
            <span className="bg-white/10 px-2 py-0.5 rounded-full">{slots.length}</span>
          </label>
          {slots.length === 0 && <p className="text-white/15 text-[10px] text-center py-4 italic">Use "Desenhar" para criar slots na arte →</p>}
          {slots.map((s, i) => (
            <div key={s.id} onClick={() => { setSelectedSlotId(s.id); setMode('select'); }}
              className={`rounded-lg p-2 cursor-pointer border flex items-center gap-2 transition-all ${selectedSlotId === s.id ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/[0.03] border-white/5 hover:border-white/10'}`}>
              <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-[9px] font-black text-white/40">{i + 1}</div>
              <p className="text-[9px] text-white/40 font-mono flex-1">{Math.round(s.x)},{Math.round(s.y)} · {Math.round(s.width)}×{Math.round(s.height)}</p>
              <button onClick={(e) => { e.stopPropagation(); setSlots(prev => prev.filter(sl => sl.id !== s.id)); if (selectedSlotId === s.id) setSelectedSlotId(null); }} className="text-white/20 hover:text-red-400">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        {/* Selected slot fine-tune */}
        {selectedSlot && (
          <div className="pt-3 border-t border-white/5 space-y-2">
            <label className="text-[9px] font-black uppercase text-blue-400">Ajuste Fino — Slot {slots.indexOf(selectedSlot) + 1}</label>
            <div className="grid grid-cols-4 gap-1.5">
              {(['x', 'y', 'width', 'height'] as const).map(k => (
                <div key={k}>
                  <label className="text-[8px] text-white/25 font-bold uppercase">{k === 'width' ? 'W' : k === 'height' ? 'H' : k.toUpperCase()}</label>
                  <input type="number" value={Math.round(selectedSlot[k])}
                    onChange={e => setSlots(prev => prev.map(s => s.id === selectedSlot.id ? { ...s, [k]: parseInt(e.target.value) || 0 } : s))}
                    className="w-full bg-black/40 border border-white/10 rounded h-7 px-1 text-[10px] text-white text-center" />
                </div>
              ))}
            </div>
          </div>
        )}

        {slots.length > 0 && (
          <button onClick={() => { setSlots([]); setSelectedSlotId(null); }} className="text-[9px] text-red-400/50 hover:text-red-400 w-full text-center py-2">
            Limpar todos os slots
          </button>
        )}
      </div>

      {/* Canvas */}
      <div className="flex-1 bg-black/40 flex items-center justify-center p-6 overflow-auto">
        <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg"
          width={config.width} height={config.height} viewBox={`0 0 ${config.width} ${config.height}`}
          style={{ width: '100%', maxWidth: '700px', height: 'auto', cursor: mode === 'draw' ? 'crosshair' : 'default', userSelect: 'none' }}
          className="shadow-2xl ring-1 ring-white/10"
          onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
          onClick={() => { if (mode === 'select' && !isDragging) setSelectedSlotId(null); }}>

          {/* Background */}
          {config.backgroundImageUrl ? (
            <image href={config.backgroundImageUrl} width="100%" height="100%" preserveAspectRatio="xMidYMid slice" />
          ) : <rect width="100%" height="100%" fill="#e5e5e5" />}

          {/* Slots */}
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
                {/* Number */}
                <text x={s.x + 12} y={s.y + 22} fontSize={14} fill={sel ? '#3b82f6' : 'rgba(255,255,255,0.6)'} fontWeight="900" fontFamily="monospace">{i + 1}</text>
                {/* Resize handle */}
                {sel && <rect x={s.x + s.width - 16} y={s.y + s.height - 16} width={16} height={16} fill="#3b82f6" rx={3} style={{ cursor: 'nwse-resize' }} onMouseDown={e => onResizeDown(e, s)} />}
              </g>
            );
          })}

          {/* Draw preview */}
          {isDrawing && dr && (
            <rect x={dr.x} y={dr.y} width={dr.w} height={dr.h} fill="rgba(34,197,94,0.15)" stroke="#22c55e" strokeWidth={2} strokeDasharray="6,3" rx={6} />
          )}
        </svg>
      </div>
    </div>
  );
};
