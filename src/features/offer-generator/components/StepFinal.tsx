import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useOffer, ProductItem } from '../context/OfferContext';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import {
  Loader2, Download, CheckCircle, Monitor, Smartphone,
  FileIcon, Edit2, X, Maximize, ChevronLeft, ChevronRight,
  Undo2, Save, Move, ZoomIn, ZoomOut, Type, Image as ImageIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type ElemId = 'image' | 'name' | 'badge' | 'currency' | 'value' | 'suffix';

// ─── Texto com quebra dinâmica ────────────────────────────────────────────────
const renderWrappedText = (
  text: string, x: number, y: number,
  fontSize: number, sFactor: number, slotWidth: number
) => {
  const scaledFs = fontSize * sFactor;
  const charsPerLine = 18; // Fixo para bater com a tela 4
  const words = (text || '').split(' ');
  const lines: string[] = [];
  let cur = '';
  words.forEach(w => {
    if ((cur + w).length > charsPerLine) { if (cur.trim()) lines.push(cur.trim()); cur = w + ' '; }
    else cur += w + ' ';
  });
  if (cur.trim()) lines.push(cur.trim());
  const lh = scaledFs * 1.1;
  const startY = y - (lines.length * lh) / 2 + lh / 2;
  return lines.map((l, i) => i === 0 
    ? <tspan key={i} x={x} y={startY}>{l}</tspan> 
    : <tspan key={i} x={x} dy={lh}>{l}</tspan>
  );
};

// ─── Editor Visual ─────────────────────────────────────────────────────────────
interface EditorProps {
  onClose: () => void;
}

const FullEditor = ({ onClose }: EditorProps) => {
  const {
    config, slots, products, setProducts, customFonts,
    getSlotSettings, updateSlotSettings, pageCount
  } = useOffer();

  const [activePage, setActivePage] = useState(0);
  const [zoom, setZoom] = useState(0.65);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, ox: 0, oy: 0 });
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
  const [selectedElem, setSelectedElem] = useState<ElemId | null>(null);
  const [dragging, setDragging] = useState<ElemId | null>(null);
  const [dragOff, setDragOff] = useState({ x: 0, y: 0 });
  const [dragState, setDragState] = useState<{ dx: number; dy: number } | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [editingProduct, setEditingProduct] = useState<{ id: string; name: string; price: string } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Salva snapshot no histórico
  const pushHistory = useCallback(() => {
    const snap = JSON.stringify(products.map(p => ({ ...p })));
    setHistory(prev => {
      const next = [...prev.slice(0, histIdx + 1), snap];
      setHistIdx(next.length - 1);
      return next.slice(-30);
    });
  }, [products, histIdx]);

  const undo = useCallback(() => {
    if (histIdx <= 0) { toast.info('Nada para desfazer'); return; }
    const prev = JSON.parse(history[histIdx - 1]);
    setProducts(prev);
    setHistIdx(h => h - 1);
    toast.success('Desfeito!');
  }, [history, histIdx, setProducts]);

  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
      if (e.key === 'Escape' && !editingProduct) onClose();
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [undo, onClose, editingProduct]);

  // Inicializa histórico
  useEffect(() => {
    const snap = JSON.stringify(products.map(p => ({ ...p })));
    setHistory([snap]);
    setHistIdx(0);
  }, []);

  const toSvg = useCallback((e: React.MouseEvent) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return {
      x: (e.clientX - r.left) * config.width / r.width,
      y: (e.clientY - r.top) * config.height / r.height
    };
  }, [config]);

  const getElems = useCallback((slot: any, cfg: any) => {
    const sf = (slot?.width || 500) / 500;
    const { priceBadge: b, imageConfig: ic, descConfig: d } = cfg;
    return {
      image: { x: slot.x + slot.width * ic.offsetX / 100 - (slot.width * 0.8 * ic.scale) / 2, y: slot.y + slot.height * ic.offsetY / 100 - (slot.height * 0.6 * ic.scale) / 2, w: slot.width * 0.8 * ic.scale, h: slot.height * 0.6 * ic.scale },
      name: { x: slot.x + slot.width * d.offsetX / 100 - slot.width * 0.4, y: slot.y + slot.height * d.offsetY / 100 - (d.fontSize * sf) / 2, w: slot.width * 0.8, h: d.fontSize * sf * 1.5 },
      badge: { x: slot.x + (b.badgeOffsetX / 100) * slot.width - (b.badgeWidth * sf) / 2, y: slot.y + (b.badgeOffsetY / 100) * slot.height - (b.badgeHeight * sf) / 2, w: b.badgeWidth * sf, h: b.badgeHeight * sf },
      sFactor: sf
    };
  }, []);

  const onStartDrag = (e: React.MouseEvent, id: ElemId, gIdx: number) => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    pushHistory();
    setSelectedSlotIndex(gIdx);
    setSelectedElem(id);
    setDragging(id);
    const c = toSvg(e);
    const slotIdx = gIdx % slots.length;
    const el = (getElems(slots[slotIdx], getSlotSettings(gIdx)) as any)[id];
    setDragOff({ x: c.x - el.x, y: c.y - el.y });
    setDragState({ dx: 0, dy: 0 });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPanOffset({ x: panStart.ox + (e.clientX - panStart.x), y: panStart.oy + (e.clientY - panStart.y) });
      return;
    }
    if (!dragging || selectedSlotIndex === null) return;
    const c = toSvg(e);
    const slotIdx = selectedSlotIndex % slots.length;
    const el = (getElems(slots[slotIdx], getSlotSettings(selectedSlotIndex)) as any)[dragging];
    setDragState({ dx: c.x - dragOff.x - el.x, dy: c.y - dragOff.y - el.y });
  };

  const onMouseUp = () => {
    if (isPanning) { setIsPanning(false); return; }
    if (dragState && selectedSlotIndex !== null && dragging) {
      const { dx, dy } = dragState;
      const slotIdx = selectedSlotIndex % slots.length;
      const slot = slots[slotIdx];
      const cfg = getSlotSettings(selectedSlotIndex);
      let up: any = {};
      if (dragging === 'image') up.imageConfig = { ...cfg.imageConfig, offsetX: cfg.imageConfig.offsetX + (dx / slot.width) * 100, offsetY: cfg.imageConfig.offsetY + (dy / slot.height) * 100 };
      else if (dragging === 'name') up.descConfig = { ...cfg.descConfig, offsetX: cfg.descConfig.offsetX + (dx / slot.width) * 100, offsetY: cfg.descConfig.offsetY + (dy / slot.height) * 100 };
      else if (dragging === 'badge') up.priceBadge = { ...cfg.priceBadge, badgeOffsetX: cfg.priceBadge.badgeOffsetX + (dx / slot.width) * 100, badgeOffsetY: cfg.priceBadge.badgeOffsetY + (dy / slot.height) * 100 };
      if (Object.keys(up).length > 0) updateSlotSettings(selectedSlotIndex, up);
    }
    setDragging(null);
    setDragState(null);
  };

  const saveProductEdit = () => {
    if (!editingProduct) return;
    setProducts(prev => prev.map(p =>
      p.id === editingProduct.id ? { ...p, name: editingProduct.name, price: editingProduct.price } : p
    ));
    pushHistory();
    setEditingProduct(null);
    toast.success('Produto atualizado!');
  };

  const handleSaveAndClose = () => {
    toast.success('Alterações salvas! Voltando para exportar.');
    onClose();
  };

  const FontStyles = () => (
    <style dangerouslySetInnerHTML={{
      __html: customFonts.map(f => `@font-face { font-family: '${f.name}'; src: url('${f.url}'); font-display: swap; }`).join('\n')
    }} />
  );

  return (
    <div className="fixed inset-0 z-[200] bg-[#09090b] flex flex-col animate-in fade-in duration-200">
      <FontStyles />

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-[#0d0d10] border-b border-white/8 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center">
            <Edit2 className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-white">Editor de Artes</h2>
            <p className="text-[10px] text-white/30 font-bold uppercase">Duplo clique no produto para editar texto e preço</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={undo} className="p-2 hover:bg-white/8 rounded-xl text-white/40 hover:text-white transition-all" title="Desfazer Ctrl+Z">
            <Undo2 className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1 bg-white/5 rounded-xl px-3 py-1.5 border border-white/8">
            <button onClick={() => setZoom(z => Math.max(0.2, z - 0.1))} className="text-white/40 hover:text-white w-5 h-5 flex items-center justify-center text-sm">−</button>
            <span className="text-[10px] font-bold text-white/40 min-w-[36px] text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(3, z + 0.1))} className="text-white/40 hover:text-white w-5 h-5 flex items-center justify-center text-sm">+</button>
          </div>
          <button onClick={() => { setZoom(0.65); setPanOffset({ x: 0, y: 0 }); }} className="p-2 hover:bg-white/8 rounded-xl text-white/40 hover:text-white">
            <Maximize className="w-4 h-4" />
          </button>
          <div className="w-px h-5 bg-white/10" />
          <Button onClick={handleSaveAndClose} className="h-9 px-5 bg-primary hover:bg-primary/90 rounded-xl text-[10px] font-black uppercase tracking-widest">
            <Save className="w-3.5 h-3.5 mr-2" /> Salvar e Exportar
          </Button>
          <button onClick={onClose} className="p-2 hover:bg-white/8 rounded-xl text-white/30 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Abas das telas */}
      <div className="flex items-center gap-1 px-5 py-2 bg-[#0d0d10] border-b border-white/5 overflow-x-auto shrink-0">
        <span className="text-[9px] font-black uppercase text-white/20 tracking-widest mr-2 shrink-0">Telas:</span>
        {Array.from({ length: pageCount }).map((_, i) => (
          <button
            key={i}
            onClick={() => { setActivePage(i); setSelectedSlotIndex(null); setSelectedElem(null); }}
            className={`shrink-0 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
              activePage === i
                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                : 'bg-white/5 text-white/30 hover:bg-white/10 hover:text-white border border-white/5'
            }`}
          >
            Tela {i + 1}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <button
            onClick={() => setActivePage(p => Math.max(0, p - 1))}
            className="p-1.5 hover:bg-white/8 rounded-lg text-white/30 hover:text-white"
            disabled={activePage === 0}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActivePage(p => Math.min(pageCount - 1, p + 1))}
            className="p-1.5 hover:bg-white/8 rounded-lg text-white/30 hover:text-white"
            disabled={activePage === pageCount - 1}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Dica */}
      <div className="px-5 py-1.5 bg-amber-500/5 border-b border-amber-500/10 text-[10px] text-amber-400/60 font-bold uppercase tracking-wider flex items-center gap-2 shrink-0">
        <Move className="w-3 h-3" />
        Arraste imagem, descrição ou preço • Duplo clique para editar texto e preço • Ctrl+Z desfaz
      </div>

      {/* Canvas */}
      <div
        className="flex-1 overflow-hidden relative flex items-center justify-center bg-[#060608]"
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onMouseDown={e => {
          if (e.button === 1) { e.preventDefault(); setIsPanning(true); setPanStart({ x: e.clientX, y: e.clientY, ox: panOffset.x, oy: panOffset.y }); }
        }}
        onWheel={e => { setZoom(z => Math.min(3, Math.max(0.2, z + (e.deltaY > 0 ? -0.05 : 0.05)))); }}
        style={{ cursor: isPanning ? 'grabbing' : dragging ? 'grabbing' : 'default' }}
      >
        <div style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`, transformOrigin: 'center center' }}>
          <svg
            ref={svgRef}
            width={config.width}
            height={config.height}
            viewBox={`0 0 ${config.width} ${config.height}`}
            style={{ background: 'white', userSelect: 'none', display: 'block' }}
            className="shadow-2xl"
          >
            {config.backgroundImageUrl && (
              <image href={config.backgroundImageUrl} width={config.width} height={config.height} preserveAspectRatio="xMidYMid slice" />
            )}

            {slots.map((slot, sIdx) => {
              const gIdx = activePage * slots.length + sIdx;
              const product = products[gIdx];
              if (!product) return null;

              const cfg = getSlotSettings(gIdx);
              const { priceBadge: pb, descConfig: dc, imageConfig: ic } = cfg;
              const sf = slot.width / 500;
              const el = getElems(slot, cfg);
              const isSelected = selectedSlotIndex === gIdx;

              const v = { ...el };
              if (isSelected && dragState && dragging) {
                (v as any)[dragging] = { ...(v as any)[dragging], x: (v as any)[dragging].x + dragState.dx, y: (v as any)[dragging].y + dragState.dy };
              }

              return (
                <g key={gIdx}>
                  <rect x={slot.x} y={slot.y} width={slot.width} height={slot.height} fill="none" stroke={isSelected ? '#D9254B' : 'rgba(0,0,0,0.05)'} strokeWidth={isSelected ? 3 : 1} strokeDasharray={isSelected ? 'none' : '4,2'} pointerEvents="none" />

                  {/* IMAGEM */}
                  <g style={{ cursor: 'move' }} onMouseDown={e => onStartDrag(e, 'image', gIdx)}>
                    <rect x={v.image.x} y={v.image.y} width={v.image.w} height={v.image.h} fill="rgba(0,0,0,0.02)" stroke="rgba(217,37,75,0.1)" strokeDasharray="3,3" rx={8} />
                    {product.images?.[0] && <image href={product.images[0]} x={v.image.x} y={v.image.y} width={v.image.w} height={v.image.h} preserveAspectRatio="xMidYMid meet" />}
                    {isSelected && selectedElem === 'image' && <rect x={v.image.x - 2} y={v.image.y - 2} width={v.image.w + 4} height={v.image.h + 4} fill="none" stroke="#D9254B" strokeWidth={2} rx={8} pointerEvents="none" />}
                  </g>

                  {/* BADGE */}
                  <g style={{ cursor: 'move' }} onMouseDown={e => onStartDrag(e, 'badge', gIdx)}>
                    {pb.badgeImageUrl
                      ? <image href={pb.badgeImageUrl} x={v.badge.x} y={v.badge.y} width={v.badge.w} height={v.badge.h} preserveAspectRatio="none" />
                      : <rect x={v.badge.x} y={v.badge.y} width={v.badge.w} height={v.badge.h} rx={pb.borderRadius * sf} fill={pb.bgColor} />
                    }
                    <text x={v.badge.x + v.badge.w * pb.currencyOffsetX / 100} y={v.badge.y + v.badge.h * pb.currencyOffsetY / 100} fontSize={pb.currencyFontSize * sf} fill={pb.currencyColor} fontWeight="900" fontFamily={pb.currencyFontFamily} pointerEvents="none">R$</text>
                    <text x={v.badge.x + v.badge.w * pb.valueOffsetX / 100} y={v.badge.y + v.badge.h * pb.valueOffsetY / 100} fontSize={pb.valueFontSize * sf} fill={pb.valueColor} fontWeight="900" textAnchor="middle" fontFamily={pb.valueFontFamily} pointerEvents="none">{product.price.replace('R$', '').trim()}</text>
                    {pb.showSuffix && <text x={v.badge.x + v.badge.w * pb.suffixOffsetX / 100} y={v.badge.y + v.badge.h * pb.suffixOffsetY / 100} fontSize={pb.suffixFontSize * sf} fill={pb.suffixColor} fontWeight="600" textAnchor="middle" pointerEvents="none">{product.suffix || pb.suffixText}</text>}
                    {isSelected && selectedElem === 'badge' && <rect x={v.badge.x - 2} y={v.badge.y - 2} width={v.badge.w + 4} height={v.badge.h + 4} fill="none" stroke="#D9254B" strokeWidth={2} rx={pb.borderRadius * sf} pointerEvents="none" />}
                  </g>

                  {/* DESCRIÇÃO — duplo clique para editar */}
                  <g
                    style={{ cursor: 'move' }}
                    onMouseDown={e => onStartDrag(e, 'name', gIdx)}
                    onDoubleClick={e => {
                      e.stopPropagation();
                      setEditingProduct({ id: product.id, name: product.name, price: product.price });
                    }}
                  >
                    <rect x={v.name.x} y={v.name.y} width={v.name.w} height={v.name.h} fill="rgba(217,37,75,0.03)" stroke="rgba(217,37,75,0.15)" strokeDasharray="3,3" rx={4} />
                    <text textAnchor="middle" fill={dc.color} fontSize={dc.fontSize * sf} fontWeight="800" fontFamily={dc.fontFamily} pointerEvents="none">
                      {renderWrappedText(dc.uppercase ? product.name.toUpperCase() : product.name, v.name.x + v.name.w / 2, v.name.y + v.name.h / 2, dc.fontSize, sf, slot.width)}
                    </text>
                    {isSelected && selectedElem === 'name' && <rect x={v.name.x - 2} y={v.name.y - 2} width={v.name.w + 4} height={v.name.h + 4} fill="none" stroke="#D9254B" strokeWidth={2} rx={4} pointerEvents="none" />}
                  </g>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Modal edição de texto */}
        {editingProduct && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-[#121214] border border-white/10 rounded-2xl p-6 w-96 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                  <Type className="w-4 h-4 text-primary" /> Editar Produto
                </h3>
                <button onClick={() => setEditingProduct(null)} className="text-white/30 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-[9px] font-black uppercase text-white/30 tracking-widest block mb-2">Descrição do Produto</label>
                  <textarea
                    value={editingProduct.name}
                    onChange={e => setEditingProduct(p => p ? { ...p, name: e.target.value } : null)}
                    rows={3}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-primary/50 resize-none"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-white/30 tracking-widest block mb-2">Preço</label>
                  <input
                    value={editingProduct.price}
                    onChange={e => setEditingProduct(p => p ? { ...p, price: e.target.value } : null)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 h-11 text-sm font-black text-red-400 outline-none focus:border-primary/50"
                    onKeyDown={e => { if (e.key === 'Enter') saveProductEdit(); if (e.key === 'Escape') setEditingProduct(null); }}
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button variant="ghost" onClick={() => setEditingProduct(null)} className="flex-1 h-11 bg-white/5 rounded-xl text-[10px] font-black uppercase text-white/40">
                  Cancelar
                </Button>
                <Button onClick={saveProductEdit} className="flex-1 h-11 bg-primary hover:bg-primary/90 rounded-xl text-[10px] font-black uppercase">
                  <Save className="w-3.5 h-3.5 mr-2" /> Salvar
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── StepFinal Principal ───────────────────────────────────────────────────────
export const StepFinal = () => {
  const { config, slots, products, pageCount, customFonts, getSlotSettings } = useOffer();
  const svgRefs = useRef<(SVGSVGElement | null)[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [exportFilename, setExportFilename] = useState('tabloide_macmidia');
  const [isSingleFile, setIsSingleFile] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);

  const toBase64 = async (url: string): Promise<string> => {
    if (!url) return '';
    if (url.startsWith('data:')) return url;
    try {
      const resp = await fetch(url, { mode: 'cors' });
      const blob = await resp.blob();
      return new Promise(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch { return url; }
  };

  const processSvgForExport = async (svg: SVGSVGElement, format: 'svg' | 'png') => {
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('width', config.width.toString());
    clone.setAttribute('height', config.height.toString());
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    for (const img of Array.from(clone.querySelectorAll('image'))) {
      const href = img.getAttribute('href') || img.getAttribute('xlink:href');
      if (!href) continue;
      if (href.startsWith('http') || href.startsWith('blob')) {
        const b64 = await toBase64(href);
        img.setAttribute('href', b64);
        img.setAttribute('xlink:href', b64);
      } else if (href.startsWith('data:')) {
        img.setAttribute('xlink:href', href);
      }
    }
    return clone;
  };

  const exportAll = async (format: 'svg' | 'png') => {
    setIsProcessing(true);
    try {
      if (format === 'svg' && isSingleFile) {
        const spacing = 100;
        const totalW = pageCount * (config.width + spacing);
        const combinedSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        combinedSvg.setAttribute('width', totalW.toString());
        combinedSvg.setAttribute('height', config.height.toString());
        combinedSvg.setAttribute('viewBox', `0 0 ${totalW} ${config.height}`);
        combinedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        combinedSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
        for (let i = 0; i < pageCount; i++) {
          const svg = svgRefs.current[i];
          if (!svg) continue;
          const processed = await processSvgForExport(svg, format);
          const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          g.setAttribute('transform', `translate(${i * (config.width + spacing)}, 0)`);
          Array.from(processed.childNodes).forEach(n => g.appendChild(n.cloneNode(true)));
          combinedSvg.appendChild(g);
        }
        saveAs(new Blob([new XMLSerializer().serializeToString(combinedSvg)], { type: 'image/svg+xml' }), `${exportFilename}.svg`);
      } else {
        const zip = new JSZip();
        for (let i = 0; i < pageCount; i++) {
          const svg = svgRefs.current[i];
          if (!svg) continue;
          const processedClone = await processSvgForExport(svg, format);
          const svgData = new XMLSerializer().serializeToString(processedClone);
          if (format === 'svg') {
            zip.file(`tela_${i + 1}.svg`, svgData);
          } else {
            const canvas = document.createElement('canvas');
            canvas.width = config.width; canvas.height = config.height;
            const ctx = canvas.getContext('2d')!;
            const img = new Image();
            img.crossOrigin = 'anonymous';
            const url = URL.createObjectURL(new Blob([svgData], { type: 'image/svg+xml' }));
            await new Promise<void>(r => { img.onload = () => { ctx.drawImage(img, 0, 0); URL.revokeObjectURL(url); r(); }; img.src = url; });
            zip.file(`tela_${i + 1}.png`, canvas.toDataURL('image/png').split(',')[1], { base64: true });
          }
        }
        saveAs(await zip.generateAsync({ type: 'blob' }), `${exportFilename}_${format}.zip`);
      }
      toast.success('Download concluído!');
    } catch (e) {
      console.error(e);
      toast.error('Erro na exportação');
    } finally {
      setIsProcessing(false);
    }
  };

  const renderProduct = (product: ProductItem, slot: any, index: number) => {
    if (!product) return null;
    const { priceBadge: pb, descConfig: dc, imageConfig: ic } = getSlotSettings(index);
    const sf = (slot?.width || 500) / 500;
    const imgW = slot.width * 0.8 * ic.scale;
    const imgH = slot.height * 0.6 * ic.scale;
    const imgX = slot.x + slot.width * ic.offsetX / 100 - imgW / 2;
    const imgY = slot.y + slot.height * ic.offsetY / 100 - imgH / 2;
    const badgeW = pb.badgeWidth * sf;
    const badgeH = pb.badgeHeight * sf;
    const badgeX = slot.x + (pb.badgeOffsetX / 100) * slot.width;
    const badgeY = slot.y + (pb.badgeOffsetY / 100) * slot.height;
    const nameX = slot.x + (dc.offsetX / 100) * slot.width;
    const nameY = slot.y + (dc.offsetY / 100) * slot.height;

    return (
      <g key={product.id}>
        {(product.images || []).slice(0, 3).reverse().map((img, iIdx, arr) => {
          const pos = arr.length - 1 - iIdx;
          return <image key={`img-${pos}`} href={img} x={imgX + pos * 20} y={imgY - pos * 10} width={imgW} height={imgH} preserveAspectRatio="xMidYMid meet" />;
        })}
        <g transform={`translate(${badgeX}, ${badgeY})`}>
          {pb.badgeImageUrl ? <image href={pb.badgeImageUrl} x={-badgeW / 2} y={-badgeH / 2} width={badgeW} height={badgeH} preserveAspectRatio="none" /> : <rect x={-badgeW / 2} y={-badgeH / 2} width={badgeW} height={badgeH} fill={pb.bgColor} rx={pb.borderRadius * sf} />}
          <text x={-badgeW / 2 + (pb.currencyOffsetX / 100) * badgeW} y={-badgeH / 2 + (pb.currencyOffsetY / 100) * badgeH} fill={pb.currencyColor} fontSize={pb.currencyFontSize * sf} fontFamily={pb.currencyFontFamily} fontWeight="900">R$</text>
          <text x={-badgeW / 2 + (pb.valueOffsetX / 100) * badgeW} y={-badgeH / 2 + (pb.valueOffsetY / 100) * badgeH + pb.valueFontSize * sf * 0.15} fill={pb.valueColor} textAnchor="middle" fontSize={pb.valueFontSize * sf} fontFamily={pb.valueFontFamily} fontWeight="900" letterSpacing="-0.05em">{product.price.replace('R$', '').trim()}</text>
          {pb.showSuffix && <text x={-badgeW / 2 + (pb.suffixOffsetX / 100) * badgeW} y={-badgeH / 2 + (pb.suffixOffsetY / 100) * badgeH + pb.suffixFontSize * sf * 0.5} fill={pb.suffixColor} textAnchor="middle" fontSize={pb.suffixFontSize * sf} fontWeight="bold">{product.suffix || pb.suffixText}</text>}
        </g>
        <text textAnchor="middle" fill={dc.color} fontSize={dc.fontSize * sf} fontWeight="900" fontFamily={dc.fontFamily} letterSpacing="-0.02em">
          {renderWrappedText(dc.uppercase ? product.name.toUpperCase() : product.name, nameX, nameY, dc.fontSize, sf, slot.width)}
        </text>
      </g>
    );
  };

  return (
    <div className="h-full flex flex-col bg-[#09090b]">
      {/* Header */}
      <div className="p-6 border-b border-white/5 bg-[#0d0d10] flex items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-white">Artes Prontas</h2>
            <p className="text-[10px] text-white/30 font-bold uppercase tracking-wider">{pageCount} telas geradas</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* ✅ BOTÃO EDITAR TODAS AS TELAS */}
          <Button
            onClick={() => setEditorOpen(true)}
            className="h-11 px-6 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl text-[10px] font-black uppercase text-amber-400 tracking-widest transition-all"
          >
            <Edit2 className="w-4 h-4 mr-2" /> Editar Telas
          </Button>

          <div className="flex-1 max-w-sm flex flex-col gap-2">
            <input value={exportFilename} onChange={e => setExportFilename(e.target.value)} placeholder="Nome do arquivo..." className="bg-black/60 border border-white/10 rounded-lg h-9 px-4 text-[10px] font-bold text-white outline-none focus:border-primary/50 transition-all" />
            <button onClick={() => setIsSingleFile(!isSingleFile)} className={`flex items-center gap-2 text-[9px] font-black uppercase tracking-widest transition-colors w-fit ${isSingleFile ? 'text-primary' : 'text-white/20'}`}>
              <div className={`w-3 h-3 rounded-full border ${isSingleFile ? 'bg-primary border-primary' : 'border-white/20'}`} />
              Arquivo Único (Multi Artboards)
            </button>
          </div>

          <div className="flex gap-3">
            <Button onClick={() => exportAll('svg')} disabled={isProcessing} className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl h-11 px-6 text-[10px] font-black uppercase tracking-widest">
              <FileIcon className="w-4 h-4 mr-2" /> Exportar SVG
            </Button>
            <Button onClick={() => exportAll('png')} disabled={isProcessing} className="bg-blue-600 hover:bg-blue-700 rounded-xl h-11 px-8 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20">
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Baixar PNG
            </Button>
          </div>
        </div>
      </div>

      {/* Grade de artes */}
      <div className="flex-1 overflow-y-auto p-12 bg-black/40 custom-scrollbar">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
          {Array.from({ length: pageCount }).map((_, i) => (
            <div key={i} className="group flex flex-col items-center">
              <div className="mb-4 flex items-center justify-between w-full px-2">
                <span className="text-[10px] font-black uppercase text-white/20 tracking-widest">Tela {i + 1}</span>
                <div className="flex items-center gap-2">
                  <Smartphone className="w-3 h-3 text-white/10" />
                  <Monitor className="w-3 h-3 text-white/10" />
                </div>
              </div>
              <div
                className="relative shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] rounded-2xl overflow-hidden border border-white/10 group-hover:border-primary/30 transition-all cursor-pointer"
                onClick={() => setEditorOpen(true)}
                title="Clique para editar"
              >
                <svg ref={el => svgRefs.current[i] = el} width="100%" viewBox={`0 0 ${config.width} ${config.height}`} className="w-full h-auto block bg-white">
                  {config.backgroundImageUrl && <image href={config.backgroundImageUrl} width={config.width} height={config.height} preserveAspectRatio="xMidYMid slice" />}
                  <defs>{customFonts.map(f => <style key={f.name} type="text/css">{`@font-face { font-family: "${f.name}"; src: url("${f.url}"); }`}</style>)}</defs>
                  {slots.map((slot, sIdx) => renderProduct(products[i * slots.length + sIdx], slot, i * slots.length + sIdx))}
                </svg>
                {/* Overlay de editar ao hover */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/20">
                    <Edit2 className="w-4 h-4 text-white" />
                    <span className="text-white text-xs font-black uppercase tracking-widest">Editar</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ✅ EDITOR ABRE COM ABAS */}
      {editorOpen && <FullEditor onClose={() => setEditorOpen(false)} />}
    </div>
  );
};
