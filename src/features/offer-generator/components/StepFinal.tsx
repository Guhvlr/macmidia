import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useOffer, ProductItem, PriceBadgeConfig, DescriptionConfig, ImageConfig } from '../context/OfferContext';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import {
  Loader2, Download, CheckCircle, Monitor, Smartphone,
  FileIcon, Edit2, X, Move, ZoomIn, ZoomOut, Maximize,
  ChevronLeft, ChevronRight, Undo2, Save, Layers, Type, Copy
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { CanvasEditor } from './CanvasEditor';

type ElemId = 'image' | 'name' | 'badge' | 'currency' | 'value' | 'suffix';

// ─── Texto com quebra de linha dinâmica ───────────────────────────────────────
const computeWrappedLines = (
  text: string,
  y: number,
  fontSize: number,
  sFactor: number,
  slotWidth: number
) => {
  const scaledFontSize = fontSize * sFactor;
  // TRAVA SEVERA: Forçar no máximo ~18 caracteres por linha para empilhar bonitinho sem sangrar no encarte "Pilha de Palavras".
  const charsPerLine = Math.min(18, Math.max(8, Math.floor((slotWidth * 0.60) / (scaledFontSize * 0.55))));
  
  // Primeiro divide pelas quebras de linha manuais (\n)
  const manualLines = (text || '').split('\n');
  const finalLines: string[] = [];

  manualLines.forEach(mLine => {
    const words = mLine.split(' ');
    let cur = '';
    words.forEach(w => {
      if ((cur + w).length > charsPerLine) { 
        if (cur.trim()) finalLines.push(cur.trim()); 
        cur = w + ' '; 
      } else {
        cur += w + ' ';
      }
    });
    if (cur.trim()) finalLines.push(cur.trim());
  });

  const lh = scaledFontSize * 1.15;
  const startY = y - (finalLines.length * lh) / 2 + lh / 2;
  return finalLines.map((l, i) => ({ text: l, y: startY + i * lh }));
};

// ─── Editor Visual Modal ───────────────────────────────────────────────────────
interface QuickEditorProps {
  pageIndex: number;
  onClose: () => void;
}

type Tool = 'select' | 'text';

const QuickEditor = ({ pageIndex, onClose }: QuickEditorProps) => {
  const {
    config, slots, products, setProducts, customFonts,
    getSlotSettings, updateSlotSettings, pageCount
  } = useOffer();

  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(0.7);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, ox: 0, oy: 0 });
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
  const [selectedElem, setSelectedElem] = useState<ElemId | null>(null);
  const [dragging, setDragging] = useState<ElemId | null>(null);
  const [resizing, setResizing] = useState<boolean>(false);
  const [dragOff, setDragOff] = useState({ x: 0, y: 0 });
  const [dragState, setDragState] = useState<{ dx: number; dy: number } | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [clipboard, setClipboard] = useState<any>(null);

  // Edição de texto direta
  const [editingElem, setEditingElem] = useState<{ slotIdx: number, type: 'name' | 'price' } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editFontSize, setEditFontSize] = useState(30);

  const pushHistory = useCallback(() => {
    // Salva o estado atual dos produtos e das configurações de slot para o Undo
    const currentState = {
      products: JSON.parse(JSON.stringify(products)),
    };
    setHistory(prev => [...prev.slice(-20), JSON.stringify(currentState)]);
  }, [products]);

  const undo = useCallback(() => {
    if (history.length === 0) { toast.info('Nada para desfazer'); return; }
    try {
      const last = JSON.parse(history[history.length - 1]);
      if (last.products) {
        setProducts(last.products);
        setHistory(prev => prev.slice(0, -1));
        toast.success('Desfeito!');
      }
    } catch (e) {
      console.error('Erro no Undo:', e);
    }
  }, [history, setProducts]);

  const copy = useCallback(() => {
    if (selectedSlotIndex !== null) {
      setClipboard(products[selectedSlotIndex]);
      toast.success('Copiado!');
    }
  }, [selectedSlotIndex, products]);

  const paste = useCallback(() => {
    if (clipboard) {
      pushHistory();
      setProducts(prev => [...prev, { ...clipboard, id: `paste-${Date.now()}` }]);
      toast.success('Colado!');
    }
  }, [clipboard, pushHistory, setProducts]);

  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') { e.preventDefault(); copy(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') { e.preventDefault(); paste(); }
      if (e.key === 'Escape') {
        if (editingElem) setEditingElem(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [undo, copy, paste, onClose, editingElem]);

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
    
    const badgeW = b.badgeWidth * sf;
    const badgeH = b.badgeHeight * sf;
    const badgeX = slot.x + (b.badgeOffsetX / 100) * slot.width - badgeW / 2;
    const badgeY = slot.y + (b.badgeOffsetY / 100) * slot.height - badgeH / 2;

    return {
      image: {
        x: slot.x + slot.width * ic.offsetX / 100 - (slot.width * 0.8 * ic.scale) / 2,
        y: slot.y + slot.height * ic.offsetY / 100 - (slot.height * 0.6 * ic.scale) / 2,
        w: slot.width * 0.8 * ic.scale, h: slot.height * 0.6 * ic.scale
      },
      name: {
        x: slot.x + slot.width * d.offsetX / 100 - slot.width * 0.4,
        y: slot.y + slot.height * d.offsetY / 100 - (d.fontSize * sf) / 2,
        w: slot.width * 0.8, h: d.fontSize * sf * 1.5
      },
      badge: {
        x: badgeX, y: badgeY, w: badgeW, h: badgeH
      },
      currency: {
        x: badgeX + (b.currencyOffsetX / 100) * badgeW,
        y: badgeY + (b.currencyOffsetY / 100) * badgeH,
        w: 40 * sf, h: 40 * sf
      },
      value: {
        x: badgeX + (b.valueOffsetX / 100) * badgeW,
        y: badgeY + (b.valueOffsetY / 100) * badgeH,
        w: 100 * sf, h: 100 * sf
      },
      suffix: {
        x: badgeX + (b.suffixOffsetX / 100) * badgeW,
        y: badgeY + (b.suffixOffsetY / 100) * badgeH,
        w: 50 * sf, h: 20 * sf
      },
      sFactor: sf
    };
  }, []);

  const onStartDrag = (e: React.MouseEvent, id: ElemId, gIdx: number) => {
    if (e.button !== 0 || activeTool !== 'select') return;
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

  const onStartResize = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    pushHistory();
    setResizing(true);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPanOffset({ x: panStart.ox + (e.clientX - panStart.x), y: panStart.oy + (e.clientY - panStart.y) });
      return;
    }
    if (selectedSlotIndex === null) return;
    const c = toSvg(e);
    const slotIdx = selectedSlotIndex % slots.length;
    const cfg = getSlotSettings(selectedSlotIndex);
    const slot = slots[slotIdx];

    if (dragging) {
      const el = (getElems(slot, cfg) as any)[dragging];
      setDragState({ dx: c.x - dragOff.x - el.x, dy: c.y - dragOff.y - el.y });
    } else if (resizing && selectedElem) {
      const el = (getElems(slot, cfg) as any)[selectedElem];
      const nw = Math.max(20, c.x - el.x);
      const nh = Math.max(20, c.y - el.y);
      const sf = slot.width / 500;

      if (selectedElem === 'image') {
        const newScale = nw / (slot.width * 0.8);
        updateSlotSettings(selectedSlotIndex, { imageConfig: { ...cfg.imageConfig, scale: newScale } });
      } else if (selectedElem === 'name') {
        const newFontSize = nh / (sf * 1.5);
        updateSlotSettings(selectedSlotIndex, { descConfig: { ...cfg.descConfig, fontSize: newFontSize } });
      } else if (selectedElem === 'badge' || selectedElem === 'value') {
        updateSlotSettings(selectedSlotIndex, { priceBadge: { ...cfg.priceBadge, badgeWidth: nw/sf, badgeHeight: nh/sf } });
      }
    }
  };

  const onMouseUp = () => {
    if (isPanning) { setIsPanning(false); return; }
    if (dragState && selectedSlotIndex !== null && dragging) {
      const { dx, dy } = dragState;
      const slotIdx = selectedSlotIndex % slots.length;
      const slot = slots[slotIdx];
      const cfg = getSlotSettings(selectedSlotIndex);
      let up: any = {};
      
      if (dragging === 'image') {
        up.imageConfig = { ...cfg.imageConfig, offsetX: cfg.imageConfig.offsetX + (dx/slot.width)*100, offsetY: cfg.imageConfig.offsetY + (dy/slot.height)*100 };
      } else if (dragging === 'name') {
        up.descConfig = { ...cfg.descConfig, offsetX: cfg.descConfig.offsetX + (dx/slot.width)*100, offsetY: cfg.descConfig.offsetY + (dy/slot.height)*100 };
      } else if (dragging === 'badge' || dragging === 'value') {
        up.priceBadge = { ...cfg.priceBadge, badgeOffsetX: cfg.priceBadge.badgeOffsetX + (dx/slot.width)*100, badgeOffsetY: cfg.priceBadge.badgeOffsetY + (dy/slot.height)*100 };
      }

      if (Object.keys(up).length > 0) updateSlotSettings(selectedSlotIndex, up);
    }
    setDragging(null);
    setResizing(false);
    setDragState(null);
  };

  const duplicateSelected = () => {
    if (selectedSlotIndex === null) {
      toast.info('Selecione um produto primeiro');
      return;
    }
    pushHistory();
    const product = products[selectedSlotIndex];
    if (product) {
      setProducts(prev => [...prev.slice(0, selectedSlotIndex + 1), { ...product, id: `copy-${Date.now()}` }, ...prev.slice(selectedSlotIndex + 1)]);
      toast.success('Produto duplicado!');
    }
  };

  const startInlineEdit = (gIdx: number, type: 'name' | 'price', currentVal: string) => {
    setSelectedSlotIndex(gIdx);
    setEditingElem({ slotIdx: gIdx, type });
    setEditValue(currentVal);
  };

  const saveInlineEdit = () => {
    if (!editingElem) return;
    pushHistory();
    const slotIdx = editingElem.slotIdx;
    
    // Atualiza o texto do produto
    setProducts(prev => prev.map((p, i) => {
      if (i === slotIdx) {
        return editingElem.type === 'name' ? { ...p, name: editValue } : { ...p, price: editValue };
      }
      return p;
    }));

    // Atualiza as configurações de fonte do slot
    if (editingElem.type === 'name') {
      updateSlotSettings(slotIdx, {
        descConfig: { ...getSlotSettings(slotIdx).descConfig, fontSize: editFontSize }
      });
    } else {
      updateSlotSettings(slotIdx, {
        priceBadge: { ...getSlotSettings(slotIdx).priceBadge, valueFontSize: editFontSize }
      });
    }

    setEditingElem(null);
    toast.success('Atualizado!');
  };

  const FontStyles = () => (
    <style dangerouslySetInnerHTML={{
      __html: customFonts.map(f =>
        `@font-face { font-family: '${f.name}'; src: url('${f.url}'); font-display: swap; }`
      ).join('\n')
    }} />
  );

  return (
    <div className="fixed inset-0 z-[200] bg-[#060608]/98 flex flex-col animate-in fade-in duration-200">
      <FontStyles />

      {/* Header do editor */}
      <div className="flex items-center justify-between px-6 py-4 bg-[#0d0d10] border-b border-white/5 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-red-600/10 rounded-xl flex items-center justify-center border border-red-600/20">
            <Edit2 className="w-4 h-4 text-red-500" />
          </div>
          <div>
            <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-white">Editor Visual Avançado</h2>
            <p className="text-[9px] text-white/30 font-bold uppercase tracking-wider">Tela {pageIndex + 1} de {pageCount}</p>
          </div>
        </div>

        {/* Controles do Menu */}
        <div className="flex items-center gap-3">
          <button 
            onClick={undo} 
            disabled={history.length === 0}
            className="p-2 hover:bg-white/5 rounded-xl text-white/40 hover:text-white transition-all disabled:opacity-20" 
            title="Desfazer (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          
          <div className="flex items-center gap-1 bg-white/5 rounded-xl px-2 py-1.5 border border-white/10">
            <button onClick={() => setZoom(z => Math.max(0.1, z - 0.1))} className="text-white/40 hover:text-white w-6 h-6 flex items-center justify-center text-lg">-</button>
            <span className="text-[10px] font-black text-white/40 min-w-[45px] text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(4, z + 0.1))} className="text-white/40 hover:text-white w-6 h-6 flex items-center justify-center text-lg">+</button>
          </div>

          <div className="w-px h-6 bg-white/10" />
          
          <Button
            onClick={onClose}
            className="h-10 px-6 bg-red-600 hover:bg-red-700 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-red-600/10"
          >
            <Save className="w-4 h-4 mr-2" /> Salvar Alterações
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Barra de Ferramentas Lateral */}
        <div className="w-16 bg-[#0d0d10] border-r border-white/5 flex flex-col items-center py-6 gap-4 shrink-0">
          <button 
            onClick={() => setActiveTool('select')}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${activeTool === 'select' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'text-white/20 hover:bg-white/5'}`}
            title="Ferramenta de Seleção (V)"
          >
            <Move className="w-5 h-5" />
          </button>
          <button onClick={() => setActiveTool('text')} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${activeTool === 'text' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'text-white/20 hover:bg-white/5'}`}><Type className="w-5 h-5" /></button>
          <div className="w-8 h-px bg-white/5 my-2" />
          <button onClick={copy} className="w-10 h-10 rounded-xl flex items-center justify-center text-white/20 hover:bg-white/5 hover:text-white transition-all"><Copy className="w-5 h-5" /></button>
          <button onClick={paste} className="w-10 h-10 rounded-xl flex items-center justify-center text-white/20 hover:bg-white/5 hover:text-white transition-all"><Download className="w-5 h-5 translate-y-1" /></button>
          
          <div className="mt-auto">
             <button 
              onClick={() => { setZoom(0.7); setPanOffset({ x: 0, y: 0 }); }} 
              className="p-3 text-white/20 hover:text-white transition-colors"
              title="Resetar Visualização"
            >
              <Maximize className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Canvas Principal */}
        <div
          className="flex-1 relative flex items-center justify-center bg-black overflow-hidden"
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onMouseDown={e => {
            if (e.button === 1 || (e.button === 0 && e.altKey)) {
              e.preventDefault();
              setIsPanning(true);
              setPanStart({ x: e.clientX, y: e.clientY, ox: panOffset.x, oy: panOffset.y });
            }
          }}
          onWheel={e => {
            if (e.ctrlKey) return;
            if (editingElem) return;
            setZoom(z => Math.min(4, Math.max(0.1, z + (e.deltaY > 0 ? -0.1 : 0.1))));
          }}
          style={{ cursor: isPanning ? 'grabbing' : resizing ? 'nwse-resize' : dragging ? 'grabbing' : (activeTool === 'text' ? 'text' : 'default') }}
        >
          <div style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: isPanning || dragging ? 'none' : 'transform 0.15s ease-out'
          }}>
            <svg
              ref={svgRef}
              width={config.width}
              height={config.height}
              viewBox={`0 0 ${config.width} ${config.height}`}
              style={{ background: 'white', userSelect: 'none', display: 'block' }}
              className="shadow-2xl ring-1 ring-white/10"
              onClick={() => {
                if (editingElem) saveInlineEdit();
              }}
            >
              {config.backgroundImageUrl && (
                <image href={config.backgroundImageUrl} width={config.width} height={config.height} preserveAspectRatio="xMidYMid slice" />
              )}

              {slots.map((slot, sIdx) => {
                const gIdx = pageIndex * slots.length + sIdx;
                const product = products[gIdx];
                if (!product) return null;

                const cfg = getSlotSettings(gIdx);
                const { priceBadge: pb, descConfig: dc, imageConfig: ic } = cfg;
                const sf = slot.width / 500;
                const el = getElems(slot, cfg);

                const v = { ...el };
                if (selectedSlotIndex === gIdx && dragState && dragging) {
                  (v as any)[dragging] = {
                    ...(v as any)[dragging],
                    x: (v as any)[dragging].x + dragState.dx,
                    y: (v as any)[dragging].y + dragState.dy
                  };
                }

                const isSelected = selectedSlotIndex === gIdx;

                return (
                  <g key={gIdx} onClick={(e) => {
                    e.stopPropagation();
                    setSelectedSlotIndex(gIdx);
                  }}>
                    {/* IMAGEM */}
                    <g
                      style={{ cursor: activeTool === 'select' ? 'move' : 'default' }}
                      onMouseDown={e => onStartDrag(e, 'image', gIdx)}
                    >
                      {isSelected && selectedElem === 'image' && (
                        <rect x={v.image.x} y={v.image.y} width={v.image.w} height={v.image.h}
                          fill="none" 
                          stroke="#D9254B" 
                          strokeWidth={2 / zoom}
                        />
                      )}
                      {product.images?.[0] && (
                        <image
                          href={product.images[0]}
                          x={v.image.x} y={v.image.y}
                          width={v.image.w} height={v.image.h}
                          preserveAspectRatio="xMidYMid meet"
                        />
                      )}
                      {isSelected && selectedElem === 'image' && (
                        <circle cx={v.image.x + v.image.w} cy={v.image.y + v.image.h} r={6/zoom} fill="white" stroke="#D9254B" cursor="nwse-resize" onMouseDown={onStartResize} />
                      )}
                    </g>

                    {/* BADGE DE PREÇO (FUNDO) */}
                    <g
                      style={{ cursor: activeTool === 'select' ? 'move' : 'default' }}
                      onMouseDown={e => onStartDrag(e, 'badge', gIdx)}
                    >
                      {pb.badgeImageUrl
                        ? <image href={pb.badgeImageUrl} x={v.badge.x} y={v.badge.y} width={v.badge.w} height={v.badge.h} />
                        : <rect x={v.badge.x} y={v.badge.y} width={v.badge.w} height={v.badge.h} rx={pb.borderRadius * sf} fill={pb.bgColor} />
                      }
                      {isSelected && selectedElem === 'badge' && (
                        <>
                          <rect x={v.badge.x} y={v.badge.y} width={v.badge.w} height={v.badge.h} fill="none" stroke="#D9254B" strokeWidth={2 / zoom} />
                          <circle cx={v.badge.x + v.badge.w} cy={v.badge.y + v.badge.h} r={6/zoom} fill="white" stroke="#D9254B" cursor="nwse-resize" onMouseDown={onStartResize} />
                        </>
                      )}
                    </g>

                    {/* RS / VALOR / SUFIXO (Separados para mover) */}
                    <g
                      style={{ cursor: activeTool === 'select' ? 'move' : (activeTool === 'text' ? 'text' : 'default') }}
                      onMouseDown={e => onStartDrag(e, 'value', gIdx)}
                      onClick={(e) => {
                        if (activeTool === 'text') {
                          e.stopPropagation();
                          startInlineEdit(gIdx, 'price', product.price);
                          setEditFontSize(pb.valueFontSize);
                        }
                      }}
                    >
                      <text
                        x={v.currency.x}
                        y={v.currency.y}
                        fontSize={pb.currencyFontSize * sf}
                        fill={pb.currencyColor}
                        fontWeight="900"
                        fontFamily={pb.currencyFontFamily}
                        pointerEvents="none"
                      >R$</text>
                      <text
                        x={v.value.x}
                        y={v.value.y}
                        fontSize={pb.valueFontSize * sf}
                        fill={pb.valueColor}
                        fontWeight="900"
                        textAnchor="middle"
                        fontFamily={pb.valueFontFamily}
                        pointerEvents="none"
                      >{product.price.replace('R$', '').trim()}</text>
                      {pb.showSuffix && (
                        <text
                          x={v.suffix.x}
                          y={v.suffix.y}
                          fontSize={pb.suffixFontSize * sf}
                          fill={pb.suffixColor}
                          fontWeight="600"
                          textAnchor="middle"
                          pointerEvents="none"
                        >{pb.suffixText}</text>
                      )}
                      {isSelected && selectedElem === 'value' && (
                        <rect x={v.badge.x} y={v.badge.y} width={v.badge.w} height={v.badge.h} fill="none" stroke="#red" strokeWidth={1} />
                      )}
                    </g>

                    {/* DESCRIÇÃO COM CONTROLES */}
                    <g
                      style={{ cursor: activeTool === 'select' ? 'move' : (activeTool === 'text' ? 'text' : 'default') }}
                      onMouseDown={e => onStartDrag(e, 'name', gIdx)}
                      onClick={(e) => {
                        if (activeTool === 'text') {
                          e.stopPropagation();
                          startInlineEdit(gIdx, 'name', product.name);
                          setEditFontSize(dc.fontSize);
                        }
                      }}
                    >
                      {isSelected && selectedElem === 'name' && (
                        <rect x={v.name.x} y={v.name.y} width={v.name.w} height={v.name.h}
                          fill="rgba(217,37,75,0.05)" 
                          stroke="#D9254B" 
                          strokeWidth={2 / zoom}
                          rx={4}
                        />
                      )}
                      <g style={{ cursor: activeTool === 'select' ? 'move' : (activeTool === 'text' ? 'text' : 'default') }} onMouseDown={e => onStartDrag(e, 'name', gIdx)} onClick={(e) => { if(activeTool === 'text') { e.stopPropagation(); startInlineEdit(gIdx, 'name', product.name); setEditFontSize(dc.fontSize); }}}>
                        {isSelected && selectedElem === 'name' && (
                          <rect x={v.name.x} y={v.name.y} width={v.name.w} height={v.name.h} fill="rgba(217,37,75,0.05)" stroke="#D9254B" strokeWidth={2 / zoom} rx={4} />
                        )}
                        {computeWrappedLines(product.name, v.name.y + v.name.h / 2, dc.fontSize, sf, slot.width).map((line, i) => (
                          <text
                            key={i}
                            x={v.name.x + v.name.w / 2}
                            y={line.y}
                            textAnchor="middle"
                            fill={dc.color}
                            fontSize={dc.fontSize * sf}
                            fontWeight="900"
                            fontFamily={dc.fontFamily}
                            style={{ textTransform: dc.uppercase ? 'uppercase' : 'none' }}
                            pointerEvents="none"
                          >
                            {line.text}
                          </text>
                        ))}
                      </g>
                      {isSelected && selectedElem === 'name' && (
                        <circle cx={v.name.x + v.name.w} cy={v.name.y + v.name.h} r={6/zoom} fill="white" stroke="#D9254B" cursor="nwse-resize" onMouseDown={onStartResize} />
                      )}
                    </g>
                  </g>
                );
              })}
            </svg>

            {/* Editor de Texto Flutuante (Inline) */}
            {editingElem && selectedSlotIndex !== null && products[selectedSlotIndex] && (
              <div 
                className="absolute bg-[#121214] border-2 border-red-600 rounded-2xl p-4 shadow-2xl z-50 animate-in zoom-in-95 duration-150 w-[320px]"
                style={{
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                }}
                onClick={e => e.stopPropagation()}
              >
                <div className="flex flex-col gap-4">
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                       <Type className="w-3 h-3 text-red-500" />
                       <span className="text-[9px] font-black uppercase text-white/40 tracking-[0.2em]">
                         Editar {editingElem.type === 'name' ? 'Descrição' : 'Preço'}
                       </span>
                     </div>
                     <button onClick={() => setEditingElem(null)} className="text-white/20 hover:text-white transition-colors">
                       <X className="w-4 h-4" />
                     </button>
                   </div>
                   
                   {editingElem.type === 'name' ? (
                     <div className="space-y-3">
                       <textarea
                         autoFocus
                         value={editValue}
                         onChange={e => setEditValue(e.target.value)}
                         onKeyDown={e => {
                           if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); saveInlineEdit(); }
                           if (e.key === 'Escape') { e.preventDefault(); setEditingElem(null); }
                         }}
                         rows={4}
                         placeholder="Digite a descrição..."
                         className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-sm font-bold text-white outline-none focus:border-red-600/50 resize-none custom-scrollbar"
                       />
                       <div className="flex items-center justify-between bg-black/40 p-2 rounded-lg border border-white/5">
                         <span className="text-[8px] font-black uppercase text-white/30">TAMANHO DA FONTE</span>
                         <div className="flex items-center gap-3">
                           <button onClick={() => setEditFontSize(f => Math.max(10, f - 2))} className="text-white/40 hover:text-white">-</button>
                           <span className="text-[10px] font-black text-white">{editFontSize}px</span>
                           <button onClick={() => setEditFontSize(f => Math.min(100, f + 2))} className="text-white/40 hover:text-white">+</button>
                         </div>
                       </div>
                     </div>
                   ) : (
                     <div className="space-y-3">
                       <div className="relative">
                         <span className="absolute left-4 top-1/2 -translate-y-1/2 text-red-500 font-black text-xs">R$</span>
                         <input
                           autoFocus
                           value={editValue.replace('R$', '').trim()}
                           onChange={e => setEditValue(e.target.value)}
                           onKeyDown={e => {
                             if (e.key === 'Enter') { e.preventDefault(); saveInlineEdit(); }
                             if (e.key === 'Escape') { e.preventDefault(); setEditingElem(null); }
                           }}
                           placeholder="0,00"
                           className="w-full bg-black/60 border border-white/10 rounded-xl h-12 pl-10 pr-4 text-sm font-black text-white outline-none focus:border-red-600/50"
                         />
                       </div>
                       <div className="flex items-center justify-between bg-black/40 p-2 rounded-lg border border-white/5">
                         <span className="text-[8px] font-black uppercase text-white/30">TAMANHO DO PREÇO</span>
                         <div className="flex items-center gap-3">
                           <button onClick={() => setEditFontSize(f => Math.max(20, f - 5))} className="text-white/40 hover:text-white">-</button>
                           <span className="text-[10px] font-black text-white">{editFontSize}px</span>
                           <button onClick={() => setEditFontSize(f => Math.min(200, f + 5))} className="text-white/40 hover:text-white">+</button>
                         </div>
                       </div>
                     </div>
                   )}
                   
                   <div className="flex gap-2 font-black uppercase tracking-widest text-[9px]">
                     <Button 
                      variant="ghost" 
                      onClick={() => setEditingElem(null)}
                      className="flex-1 h-10 bg-white/5 hover:bg-white/10 text-white/40 rounded-xl"
                     >
                       Cancelar
                     </Button>
                     <Button 
                      onClick={saveInlineEdit}
                      className="flex-1 h-10 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-lg shadow-red-600/20"
                     >
                       Aplicar
                     </Button>
                   </div>
                   <p className="text-[8px] text-white/20 text-center font-bold uppercase tracking-wider">
                     {editingElem.type === 'name' ? 'Dica: use Ctrl+Enter para salvar rápido' : 'Pressione Enter para salvar'}
                   </p>
                </div>
              </div>
            )}
          </div>
        </div>
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
  const [editingPage, setEditingPage] = useState<number | null>(null); // ← página sendo editada

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

  const processSvgForExport = async (svg: SVGSVGElement) => {
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('width', config.width.toString());
    clone.setAttribute('height', config.height.toString());
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    for (const img of Array.from(clone.querySelectorAll('image'))) {
      const href = img.getAttribute('href') || img.getAttribute('xlink:href');
      if (href && (href.startsWith('http') || href.startsWith('blob'))) {
        const b64 = await toBase64(href);
        img.setAttribute('href', b64);
        img.setAttribute('xlink:href', b64);
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
          const processed = await processSvgForExport(svg);
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
          const processedClone = await processSvgForExport(svg);
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
          return (
            <image key={`img-${pos}`} href={img}
              x={imgX + pos * 20} y={imgY - pos * 10}
              width={imgW} height={imgH}
              preserveAspectRatio="xMidYMid meet"
            />
          );
        })}
        <g transform={`translate(${badgeX}, ${badgeY})`}>
          {pb.badgeImageUrl
            ? <image href={pb.badgeImageUrl} x={-badgeW / 2} y={-badgeH / 2} width={badgeW} height={badgeH} />
            : <rect x={-badgeW / 2} y={-badgeH / 2} width={badgeW} height={badgeH} fill={pb.bgColor} rx={pb.borderRadius * sf} />
          }
          <text x={-badgeW / 2 + (pb.currencyOffsetX / 100) * badgeW} y={-badgeH / 2 + (pb.currencyOffsetY / 100) * badgeH} fill={pb.currencyColor} style={{ fontSize: pb.currencyFontSize * sf, fontFamily: pb.currencyFontFamily, fontWeight: '900' }}>R$</text>
          <text x={-badgeW / 2 + (pb.valueOffsetX / 100) * badgeW} y={-badgeH / 2 + (pb.valueOffsetY / 100) * badgeH + pb.valueFontSize * sf * 0.15} fill={pb.valueColor} textAnchor="middle" style={{ fontSize: pb.valueFontSize * sf, fontFamily: pb.valueFontFamily, fontWeight: '900', letterSpacing: '-0.05em' }}>{product.price.replace('R$', '').trim()}</text>
          {pb.showSuffix && <text x={-badgeW / 2 + (pb.suffixOffsetX / 100) * badgeW} y={-badgeH / 2 + (pb.suffixOffsetY / 100) * badgeH + pb.suffixFontSize * sf * 0.5} fill={pb.suffixColor} textAnchor="middle" style={{ fontSize: pb.suffixFontSize * sf, fontWeight: 'bold' }}>{pb.suffixText}</text>}
        </g>
        <g>
          {computeWrappedLines(product.name, nameY, dc.fontSize, sf, slot.width).map((line, i) => (
            <text key={`txt-${i}`} x={nameX} y={line.y} textAnchor="middle" fill={dc.color} style={{ fontSize: `${dc.fontSize * sf}px`, fontFamily: dc.fontFamily, fontWeight: '900', textTransform: dc.uppercase ? 'uppercase' : 'none', letterSpacing: '-0.02em' }}>
              {line.text}
            </text>
          ))}
        </g>
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
        <div className="flex-1 max-w-sm flex flex-col gap-2">
          <input
            value={exportFilename}
            onChange={e => setExportFilename(e.target.value)}
            placeholder="Nome do arquivo..."
            className="bg-black/60 border border-white/10 rounded-lg h-9 px-4 text-[10px] font-bold text-white outline-none focus:border-primary/50 transition-all"
          />
          <button
            onClick={() => setIsSingleFile(!isSingleFile)}
            className={`flex items-center gap-2 text-[9px] font-black uppercase tracking-widest transition-colors w-fit ${isSingleFile ? 'text-primary' : 'text-white/20'}`}
          >
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

      {/* Grade de artes */}
      <div className="flex-1 overflow-y-auto p-12 bg-black/40 custom-scrollbar">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
          {Array.from({ length: pageCount }).map((_, i) => (
            <div key={i} className="group flex flex-col items-center">
              <div className="mb-4 flex items-center justify-between w-full px-2">
                <span className="text-[10px] font-black uppercase text-white/20 tracking-widest">Tela {i + 1}</span>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setEditingPage(i)}
                    variant="ghost"
                    className="h-8 px-3 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-xl text-[9px] font-black uppercase text-primary tracking-wider transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Edit2 className="w-3 h-3 mr-1.5" /> Editar Tela
                  </Button>
                  <Smartphone className="w-3 h-3 text-white/10" />
                  <Monitor className="w-3 h-3 text-white/10" />
                </div>
              </div>
              <div className="relative shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] rounded-2xl overflow-hidden border border-white/10 group-hover:border-primary/30 transition-all">
                <svg
                  ref={el => svgRefs.current[i] = el}
                  width="100%"
                  viewBox={`0 0 ${config.width} ${config.height}`}
                  className="w-full h-auto block bg-white"
                >
                  {config.backgroundImageUrl && (
                    <image href={config.backgroundImageUrl} width={config.width} height={config.height} preserveAspectRatio="xMidYMid slice" />
                  )}
                  <defs>
                    {customFonts.map(f => (
                      <style key={f.name} type="text/css">
                        {`@font-face { font-family: "${f.name}"; src: url("${f.url}"); }`}
                      </style>
                    ))}
                  </defs>
                  {slots.map((slot, sIdx) => {
                    const globalIndex = i * slots.length + sIdx;
                    return renderProduct(products[globalIndex], slot, globalIndex);
                  })}
                </svg>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editingPage !== null && (
        <CanvasEditor
          pageIndex={editingPage}
          onClose={() => setEditingPage(null)}
        />
      )}

    </div>
  );
};
