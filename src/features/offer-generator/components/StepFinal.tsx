import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOffer, ProductItem } from '../context/OfferContext';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import {
  Loader2, Download, CheckCircle, Monitor, Smartphone,
  FileIcon, Edit2, X, Maximize, ChevronLeft, ChevronRight,
  Undo2, Save, Move, ZoomIn, ZoomOut, Type, Image as ImageIcon, Search, Zap
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
  const charsPerLine = 18;
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

export const FullEditor = ({ onClose }: EditorProps) => {
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
    <div className="fixed inset-0 z-[200] bg-zinc-950 flex flex-col animate-in fade-in duration-200">
      <FontStyles />

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-zinc-900/50 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-red-500/10 rounded-xl flex items-center justify-center border border-red-500/20">
            <Edit2 className="w-4 h-4 text-red-400" />
          </div>
          <div>
            <h2 className="text-[14px] font-semibold tracking-tight text-zinc-100">Editor de Artes</h2>
            <p className="text-[11px] text-zinc-500 font-medium">Duplo clique no produto para editar texto e preço</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={undo} className="p-2 hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-zinc-100 transition-all" title="Desfazer Ctrl+Z">
            <Undo2 className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1 bg-zinc-900/50 rounded-xl px-3 py-1.5 border border-zinc-800">
               <Button onClick={() => setZoom(z => Math.max(0.1, z - 0.1))} variant="ghost" className="h-8 w-8 p-0 rounded-lg text-zinc-400 hover:text-red-500"><ZoomOut className="w-4 h-4" /></Button>
               <span className="text-[11px] font-bold text-zinc-300 min-w-[40px] text-center">{Math.round(zoom * 100)}%</span>
               <Button onClick={() => setZoom(z => Math.min(2, z + 0.1))} variant="ghost" className="h-8 w-8 p-0 rounded-lg text-zinc-400 hover:text-red-500"><ZoomIn className="w-4 h-4" /></Button>
          </div>
          <button onClick={() => { setZoom(0.65); setPanOffset({ x: 0, y: 0 }); }} className="p-2 hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-zinc-100 transition-all">
            <Maximize className="w-4 h-4" />
          </button>
          <div className="w-px h-5 bg-zinc-800 mx-1" />
          <Button onClick={handleSaveAndClose} className="h-9 px-5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[12px] font-semibold shadow-sm transition-all">
            <Save className="w-3.5 h-3.5 mr-2" /> Salvar e Voltar
          </Button>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-xl text-zinc-500 hover:text-zinc-100 transition-all ml-1 border border-transparent hover:border-zinc-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900/30 border-b border-zinc-800 overflow-x-auto shrink-0">
        <span className="text-[11px] font-medium text-zinc-500 mr-2 shrink-0">Telas:</span>
        {Array.from({ length: pageCount }).map((_, i) => (
          <button
            key={i}
            onClick={() => { setActivePage(i); setSelectedSlotIndex(null); setSelectedElem(null); }}
            className={`shrink-0 px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
              activePage === i
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 border border-zinc-800/60'
            }`}
          >
            Tela {i + 1}
          </button>
        ))}
      </div>

      <div
        className="flex-1 overflow-hidden relative flex items-center justify-center bg-zinc-950/80"
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
              <image href={config.backgroundImageUrl} width={config.width} height={config.height} preserveAspectRatio="xMidYMin slice" />
            )}

            {slots.map((slot, sIdx) => {
              const gIdx = activePage * slots.length + sIdx;
              const product = products[gIdx];
              if (!product) return null;

              const cfg = getSlotSettings(gIdx);
              const { priceBadge: pb, descConfig: dc } = cfg;
              const sf = slot.width / 500;
              const el = getElems(slot, cfg);
              const isSelected = selectedSlotIndex === gIdx;

              const v = { ...el };
              if (isSelected && dragState && dragging) {
                (v as any)[dragging] = { ...(v as any)[dragging], x: (v as any)[dragging].x + dragState.dx, y: (v as any)[dragging].y + dragState.dy };
              }

              return (
                <g key={gIdx}>
                  <rect x={slot.x} y={slot.y} width={slot.width} height={slot.height} fill="none" stroke={isSelected ? '#ef4444' : 'rgba(0,0,0,0.05)'} strokeWidth={isSelected ? 3 : 1} strokeDasharray={isSelected ? 'none' : '4,2'} pointerEvents="none" />

                  <g style={{ cursor: 'move' }} onMouseDown={e => onStartDrag(e, 'image', gIdx)}>
                    <rect x={v.image.x} y={v.image.y} width={v.image.w} height={v.image.h} fill="rgba(0,0,0,0.01)" stroke="rgba(239,68,68,0.15)" strokeDasharray="3,3" rx={8} />
                    {product.images?.[0] && <image href={product.images[0]} x={v.image.x} y={v.image.y} width={v.image.w} height={v.image.h} preserveAspectRatio="xMidYMid meet" />}
                    {isSelected && selectedElem === 'image' && <rect x={v.image.x - 2} y={v.image.y - 2} width={v.image.w + 4} height={v.image.h + 4} fill="none" stroke="#ef4444" strokeWidth={2} rx={8} pointerEvents="none" />}
                  </g>

                  <g style={{ cursor: 'move' }} onMouseDown={e => onStartDrag(e, 'badge', gIdx)}>
                    {pb.badgeImageUrl
                      ? <image href={pb.badgeImageUrl} x={v.badge.x} y={v.badge.y} width={v.badge.w} height={v.badge.h} preserveAspectRatio="xMidYMid meet" />
                      : <rect x={v.badge.x} y={v.badge.y} width={v.badge.w} height={v.badge.h} rx={pb.borderRadius * sf} fill={pb.bgColor} />
                    }
                    <text x={v.badge.x + v.badge.w * pb.currencyOffsetX / 100} y={v.badge.y + v.badge.h * pb.currencyOffsetY / 100} fontSize={pb.currencyFontSize * sf} fill={pb.currencyColor} fontWeight="900" fontFamily={pb.currencyFontFamily} pointerEvents="none">R$</text>
                    <text x={v.badge.x + v.badge.w * pb.valueOffsetX / 100} y={v.badge.y + v.badge.h * pb.valueOffsetY / 100} fontSize={pb.valueFontSize * sf} fill={pb.valueColor} fontWeight="900" textAnchor="middle" fontFamily={pb.valueFontFamily} pointerEvents="none">{product.price.replace('R$', '').trim()}</text>
                    {pb.showSuffix && <text x={v.badge.x + v.badge.w * pb.suffixOffsetX / 100} y={v.badge.y + v.badge.h * pb.suffixOffsetY / 100} fontSize={pb.suffixFontSize * sf} fill={pb.suffixColor} fontWeight="600" textAnchor="middle" pointerEvents="none">{product.suffix || pb.suffixText}</text>}
                    {isSelected && selectedElem === 'badge' && <rect x={v.badge.x - 2} y={v.badge.y - 2} width={v.badge.w + 4} height={v.badge.h + 4} fill="none" stroke="#ef4444" strokeWidth={2} rx={pb.borderRadius * sf} pointerEvents="none" />}
                  </g>

                  <g
                    style={{ cursor: 'move' }}
                    onMouseDown={e => onStartDrag(e, 'name', gIdx)}
                    onDoubleClick={e => {
                      e.stopPropagation();
                      setEditingProduct({ id: product.id, name: product.name, price: product.price });
                    }}
                  >
                    <rect x={v.name.x} y={v.name.y} width={v.name.w} height={v.name.h} fill="rgba(239,68,68,0.03)" stroke="rgba(239,68,68,0.2)" strokeDasharray="3,3" rx={4} />
                    <text textAnchor="middle" fill={dc.color} fontSize={dc.fontSize * sf} fontWeight="800" fontFamily={dc.fontFamily} pointerEvents="none">
                      {renderWrappedText(dc.uppercase ? product.name.toUpperCase() : product.name, v.name.x + v.name.w / 2, v.name.y + v.name.h / 2, dc.fontSize, sf, slot.width)}
                    </text>
                    {isSelected && selectedElem === 'name' && <rect x={v.name.x - 2} y={v.name.y - 2} width={v.name.w + 4} height={v.name.h + 4} fill="none" stroke="#ef4444" strokeWidth={2} rx={4} pointerEvents="none" />}
                  </g>
                </g>
              );
            })}
          </svg>
        </div>

        {editingProduct && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm">
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 w-[400px] shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[15px] font-semibold text-zinc-100 flex items-center gap-2">
                  <Type className="w-4 h-4 text-red-500" /> Editar Produto
                </h3>
                <button onClick={() => setEditingProduct(null)} className="text-zinc-500 hover:text-zinc-100 p-1 rounded-lg hover:bg-zinc-900 transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-medium text-zinc-400 block mb-1.5 ml-1">Descrição do Produto</label>
                  <textarea
                    value={editingProduct.name}
                    onChange={e => setEditingProduct(p => p ? { ...p, name: e.target.value } : null)}
                    rows={3}
                    className="w-full bg-zinc-900 border border-zinc-800/60 rounded-xl px-4 py-3 text-[13px] font-semibold text-zinc-100 outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 resize-none shadow-sm"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-zinc-400 block mb-1.5 ml-1">Preço</label>
                  <input
                    value={editingProduct.price}
                    onChange={e => setEditingProduct(p => p ? { ...p, price: e.target.value } : null)}
                    className="w-full bg-zinc-900 border border-zinc-800/60 rounded-xl px-4 h-11 text-[14px] font-semibold text-red-400 outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 shadow-sm"
                    onKeyDown={e => { if (e.key === 'Enter') saveProductEdit(); if (e.key === 'Escape') setEditingProduct(null); }}
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6 pt-2 border-t border-zinc-800/50">
                <Button variant="ghost" onClick={() => setEditingProduct(null)} className="flex-1 h-11 rounded-xl text-[12px] font-semibold text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900">
                  Cancelar
                </Button>
                <Button onClick={saveProductEdit} className="flex-1 h-11 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[12px] font-semibold shadow-sm">
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

export const StepFinal = () => {
  const { config, slots, products, pageCount, customFonts, getSlotSettings, customCanvasElements, slotSettings } = useOffer();
  const navigate = useNavigate();
  const svgRefs = useRef<(SVGSVGElement | null)[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [exportFilename, setExportFilename] = useState('tabloide_macmidia');

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
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    clone.setAttribute('width', config.width.toString());
    clone.setAttribute('height', config.height.toString());
    clone.setAttribute('viewBox', `0 0 ${config.width} ${config.height}`);
    clone.removeAttribute('class');

    clone.querySelectorAll('style').forEach(s => {
      const text = s.textContent || '';
      if (text.includes('@import')) s.remove();
    });

    clone.querySelectorAll('*').forEach(el => {
      el.removeAttribute('class');
      Array.from(el.attributes).forEach(attr => {
        if (attr.name.startsWith('data-')) el.removeAttribute(attr.name);
      });
      const style = el.getAttribute('style');
      if (style) {
        const cleaned = style
          .replace(/pointer-events:[^;]+;?/gi, '')
          .replace(/cursor:[^;]+;?/gi, '')
          .replace(/user-select:[^;]+;?/gi, '')
          .trim();
        if (cleaned) el.setAttribute('style', cleaned);
        else el.removeAttribute('style');
      }
    });

    clone.querySelectorAll('foreignObject').forEach(fo => fo.remove());

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
      if (format === 'svg') {
        const spacing = 80;
        const totalW = pageCount * config.width + Math.max(0, pageCount - 1) * spacing;
        const combinedSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        combinedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        combinedSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
        combinedSvg.setAttribute('width', totalW.toString());
        combinedSvg.setAttribute('height', config.height.toString());
        combinedSvg.setAttribute('viewBox', `0 0 ${totalW} ${config.height}`);

        const masterBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        masterBg.setAttribute('x', '0'); masterBg.setAttribute('y', '0');
        masterBg.setAttribute('width', totalW.toString());
        masterBg.setAttribute('height', config.height.toString());
        masterBg.setAttribute('fill', '#e0e0e0');
        combinedSvg.appendChild(masterBg);

        for (let i = 0; i < pageCount; i++) {
          const svg = svgRefs.current[i];
          if (!svg) continue;
          const processed = await processSvgForExport(svg, format);
          const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          g.setAttribute('id', `tela-${i + 1}`);
          g.setAttribute('transform', `translate(${i * (config.width + spacing)}, 0)`);

          const pageBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          pageBg.setAttribute('x', '0'); pageBg.setAttribute('y', '0');
          pageBg.setAttribute('width', config.width.toString());
          pageBg.setAttribute('height', config.height.toString());
          pageBg.setAttribute('fill', '#ffffff');
          g.appendChild(pageBg);

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
          const canvas = document.createElement('canvas');
          canvas.width = config.width; canvas.height = config.height;
          const ctx = canvas.getContext('2d')!;
          const img = new Image();
          img.crossOrigin = 'anonymous';
          const url = URL.createObjectURL(new Blob([svgData], { type: 'image/svg+xml' }));
          await new Promise<void>(r => { img.onload = () => { ctx.drawImage(img, 0, 0); URL.revokeObjectURL(url); r(); }; img.src = url; });
          zip.file(`tela_${i + 1}.png`, canvas.toDataURL('image/png').split(',')[1], { base64: true });
        }
        saveAs(await zip.generateAsync({ type: 'blob' }), `${exportFilename}_png.zip`);
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
          {pb.badgeImageUrl ? <image href={pb.badgeImageUrl} x={-badgeW / 2} y={-badgeH / 2} width={badgeW} height={badgeH} preserveAspectRatio="xMidYMid meet" /> : <rect x={-badgeW / 2} y={-badgeH / 2} width={badgeW} height={badgeH} fill={pb.bgColor} rx={pb.borderRadius * sf} />}
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

  const handleOpenEditor = () => {
    try {
      const editorData = { config, slots, products, customFonts, pageCount, slotSettings, customCanvasElements };
      (window as any).__MACMIDIA_EDITOR_DATA__ = editorData;
      try {
        localStorage.setItem('macmidia_offer_editor_data', JSON.stringify(editorData));
      } catch (e) {
        console.warn('Payload too large for localStorage, using window.opener fallback');
      }
      window.open('/offer-editor', '_blank');
    } catch (e: any) {
      toast.error('Erro ao abrir editor: ' + e.message);
    }
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      <div className="p-6 border-b border-zinc-800 bg-zinc-900/30 flex items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center border border-red-500/20">
            <CheckCircle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/10 text-red-500 rounded-full text-[10px] font-semibold mb-3">
              <Monitor className="w-3.5 h-3.5" /> Passo 5
            </div>
            <h2 className="text-[15px] font-semibold tracking-tight text-zinc-100">Artes Prontas</h2>
            <p className="text-[12px] text-zinc-500 font-medium mt-0.5">{pageCount} telas geradas</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleOpenEditor}
            className="h-11 px-6 bg-zinc-900 hover:bg-zinc-800 text-zinc-100 font-semibold text-[13px] rounded-xl shadow-sm border border-zinc-800 transition-all flex items-center gap-2"
          >
            <Edit2 className="w-4 h-4 text-red-400" />
            <span>Editar Telas</span>
          </button>

          <div className="flex-1 max-w-sm flex flex-col gap-1.5">
            <input value={exportFilename} onChange={e => setExportFilename(e.target.value)} placeholder="Nome do arquivo..." className="bg-zinc-900 border-zinc-800/60 rounded-xl h-11 px-4 text-[13px] font-medium text-zinc-100 outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 shadow-sm transition-all" />
            <span className="text-[11px] font-medium text-zinc-500 ml-1">SVG: Arquivo único • PNG: ZIP</span>
          </div>

          <div className="flex gap-3">
            <Button onClick={() => exportAll('svg')} disabled={isProcessing} className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/50 rounded-xl h-11 px-6 text-[12px] font-semibold text-zinc-300 shadow-sm transition-all">
              <FileIcon className="w-4 h-4 mr-2" /> Exportar SVG
            </Button>
            <Button onClick={() => exportAll('png')} disabled={isProcessing} className="bg-red-600 hover:bg-red-500 text-white rounded-xl h-11 px-8 text-[12px] font-semibold shadow-md shadow-red-900/20 transition-all">
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Download className="w-4 h-4 mr-2" /> Baixar PNG</>}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-12 bg-zinc-950/50 custom-scrollbar">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
          {Array.from({ length: pageCount }).map((_, i) => (
            <div key={i} className="flex flex-col items-center">
              <div className="mb-4 flex items-center justify-between w-full px-2">
                <span className="text-[12px] font-semibold text-zinc-500">Tela {i + 1}</span>
                <div className="flex items-center gap-2">
                  <Smartphone className="w-3.5 h-3.5 text-zinc-600" />
                  <Monitor className="w-3.5 h-3.5 text-zinc-600" />
                </div>
              </div>
              <div className="relative shadow-xl rounded-2xl overflow-hidden border border-zinc-800 transition-all bg-zinc-900/20">
                <svg ref={el => svgRefs.current[i] = el} width="100%" viewBox={`0 0 ${config.width} ${config.height}`} className="w-full h-auto block bg-white">
                  {config.backgroundImageUrl && <image href={config.backgroundImageUrl} width={config.width} height={config.height} preserveAspectRatio="xMidYMin slice" />}
                  <defs>{customFonts.map(f => <style key={f.name} type="text/css">{`@font-face { font-family: "${f.name}"; src: url("${f.url}"); }`}</style>)}</defs>
                  {slots.map((slot, sIdx) => renderProduct(products[i * slots.length + sIdx], slot, i * slots.length + sIdx))}
                  
                  {/* Custom Canvas Elements */}
                  {(customCanvasElements[i] || []).map(el => {
                    const s = el.style;
                    let shape = null;
                    if (el.type === 'rect') shape = <rect x={0} y={0} width={el.w} height={el.h} fill={s.bgColor} stroke={s.borderColor} strokeWidth={s.borderWidth} rx={s.borderRadius} />;
                    else if (el.type === 'circle') shape = <ellipse cx={el.w/2} cy={el.h/2} rx={el.w/2} ry={el.h/2} fill={s.bgColor} />;
                    else if (el.type === 'divider') shape = <rect x={0} y={0} width={el.w} height={el.h} fill={s.bgColor} rx={4} />;
                    else if (el.type === 'text' || el.type === 'title') {
                      const textAnchor = s.align === 'left' ? 'start' : s.align === 'right' ? 'end' : 'middle';
                      const tX = s.align === 'left' ? 8 : s.align === 'right' ? el.w - 8 : el.w/2;
                      shape = (
                        <g>
                          {s.bgColor && s.bgColor !== 'transparent' && <rect x={0} y={0} width={el.w} height={el.h} fill={s.bgColor} rx={4} />}
                          <text x={tX} y={el.h/2} fontFamily={s.fontFamily} fontSize={s.fontSize} fontWeight={s.fontWeight} fill={s.color} textAnchor={textAnchor} dominantBaseline="middle" pointerEvents="none">{el.data.text}</text>
                        </g>
                      );
                    }
                    return (
                      <g key={el.id} transform={`translate(${el.x}, ${el.y})`} pointerEvents="none">
                        {shape}
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
