import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Stage, Layer, Rect, Text as KonvaText, Image as KonvaImage, Transformer, Group } from 'react-konva';
import useImage from 'use-image';
import { useOffer, ProductItem, SlotConfig } from '../context/OfferContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Save, Undo2, Copy, X, Move, Type, Edit2 } from 'lucide-react';
import { toast } from 'sonner';

const URLImage = ({ src, ...props }: any) => {
  const [image] = useImage(src, 'anonymous');
  return <KonvaImage image={image} {...props} />;
};

const computeWrappedLinesStr = (text: string, fontSize: number, sFactor: number, slotWidth: number) => {
  const scaledFontSize = fontSize * sFactor;
  const charsPerLine = Math.min(18, Math.max(8, Math.floor((slotWidth * 0.60) / (scaledFontSize * 0.55))));
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
  return finalLines.join('\n');
};

export function CanvasEditor({ pageIndex, onClose }: { pageIndex: number, onClose: () => void }) {
  const context = useOffer();

  // Cópias locais para não "salvar automático" enquanto arrasta
  const [localProducts, setLocalProducts] = useState<ProductItem[]>(() => JSON.parse(JSON.stringify(context.products)));
  
  // Como as propriedades de estilo ficam em slotSettings e nas globais, vamos criar um snapshot local de tudo isso.
  const [localSlotSettings, setLocalSlotSettings] = useState<Record<number, any>>(() => JSON.parse(JSON.stringify(context.slotSettings)));
  const [localPriceBadge] = useState(() => JSON.parse(JSON.stringify(context.priceBadge)));
  const [localDescConfig] = useState(() => JSON.parse(JSON.stringify(context.descConfig)));
  const [localImageConfig] = useState(() => JSON.parse(JSON.stringify(context.imageConfig)));

  const getSlotSettings = useCallback((index: number) => {
    const s = localSlotSettings[index] || {};
    return {
      priceBadge: { ...localPriceBadge, ...(s.priceBadge || {}) },
      descConfig: { ...localDescConfig, ...(s.descConfig || {}) },
      imageConfig: { ...localImageConfig, ...(s.imageConfig || {}) },
    };
  }, [localSlotSettings, localPriceBadge, localDescConfig, localImageConfig]);

  const updateSlotSettings = useCallback((index: number, newSettings: any) => {
    setLocalSlotSettings(prev => {
      const current = prev[index] || {};
      return {
        ...prev,
        [index]: {
          ...current,
          priceBadge: newSettings.priceBadge ? { ...(current.priceBadge || {}), ...newSettings.priceBadge } : current.priceBadge,
          descConfig: newSettings.descConfig ? { ...(current.descConfig || {}), ...newSettings.descConfig } : current.descConfig,
          imageConfig: newSettings.imageConfig ? { ...(current.imageConfig || {}), ...newSettings.imageConfig } : current.imageConfig,
        }
      };
    });
  }, []);

  const [zoom, setZoom] = useState(0.7);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [clipboard, setClipboard] = useState<any>(null);
  const [activeTool, setActiveTool] = useState<'select' | 'text'>('select');

  const [editingElem, setEditingElem] = useState<{ slotIdx: number, type: 'name' | 'price' | 'suffix' } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editFontSize, setEditFontSize] = useState(30);

  const stageRef = useRef<any>(null);
  const trRef = useRef<any>(null);

  const pushHistory = useCallback(() => {
    setHistory(prev => [...prev.slice(-20), JSON.stringify({ slotSettings: localSlotSettings, products: localProducts })]);
  }, [localSlotSettings, localProducts]);

  const undo = useCallback((e?: Event) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (history.length === 0) { toast.info('Nada para desfazer'); return; }
    try {
      const last = JSON.parse(history[history.length - 1]);
      setLocalSlotSettings(last.slotSettings);
      setLocalProducts(last.products);
      setHistory(prev => prev.slice(0, -1));
      toast.success('Ação desfeita!');
    } catch (err) {
      console.error(err);
    }
  }, [history]);

  const copy = useCallback((e?: Event) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (selectedId) {
      const gIdx = parseInt(selectedId.split('-')[0]);
      setClipboard(localProducts[gIdx]);
      toast.success('Produto copiado!');
    } else {
      toast.info('Selecione algo com a ferramenta MOVER primeiro');
    }
  }, [selectedId, localProducts]);

  const paste = useCallback((e?: Event) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (clipboard) {
      pushHistory();
      setLocalProducts(prev => [...prev, { ...clipboard, id: `paste-${Date.now()}` }]);
      toast.success('Produto colado!');
    }
  }, [clipboard, pushHistory]);

  const saveAndClose = async () => {
    // Aplica as edições textuais no global
    context.setProducts(localProducts);
    
    // Substitui todo o cache de modificações de slot pela matriz montada sem o bug de race condition do React Loop
    context.setSlotSettings(localSlotSettings);
    
    // Assegura que grava no banco (persistir F5)
    await supabase.from('settings').upsert({ 
       key: 'offer_generator_slot_settings', 
       value: JSON.stringify(localSlotSettings) 
    });

    toast.success('Alterações salvas!');
    onClose();
  };

  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if (editingElem || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return; 
      
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.stopPropagation(); e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') { e.stopPropagation(); e.preventDefault(); copy(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') { e.stopPropagation(); e.preventDefault(); paste(); }
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeys, { capture: true });
    return () => window.removeEventListener('keydown', handleKeys, { capture: true });
  }, [undo, copy, paste, onClose, editingElem]);

  useEffect(() => {
    if (selectedId && trRef.current && stageRef.current && activeTool === 'select') {
      const node = stageRef.current.findOne('#' + selectedId);
      if (node) {
        trRef.current.nodes([node]);
        trRef.current.getLayer().batchDraw();
      }
    } else if (trRef.current) {
      trRef.current.nodes([]);
    }
  }, [selectedId, activeTool]);

  // Cálculos matemáticos idênticos ao StepFinal renderProduct() (SVG)
  const getElems = useCallback((slot: any, cfg: any) => {
    const sf = (slot?.width || 500) / 500;
    const { priceBadge: b, imageConfig: ic, descConfig: d } = cfg;
    
    const imgW = slot.width * 0.8 * ic.scale;
    const imgH = slot.height * 0.6 * ic.scale;
    const imgX = slot.x + slot.width * ic.offsetX / 100 - imgW / 2;
    const imgY = slot.y + slot.height * ic.offsetY / 100 - imgH / 2;

    const badgeW = b.badgeWidth * sf;
    const badgeH = b.badgeHeight * sf;
    const badgeCenterX = slot.x + (b.badgeOffsetX / 100) * slot.width;
    const badgeCenterY = slot.y + (b.badgeOffsetY / 100) * slot.height;
    
    // Top-left approach exactly mapped from SVG translate offset logic
    const badgeTL_x = badgeCenterX - badgeW / 2;
    const badgeTL_y = badgeCenterY - badgeH / 2;

    const currX = badgeTL_x + (b.currencyOffsetX / 100) * badgeW;
    const currY = badgeTL_y + (b.currencyOffsetY / 100) * badgeH;

    const valX = badgeTL_x + (b.valueOffsetX / 100) * badgeW;
    const valY = badgeTL_y + (b.valueOffsetY / 100) * badgeH + b.valueFontSize * sf * 0.15;

    const sufX = badgeTL_x + (b.suffixOffsetX / 100) * badgeW;
    const sufY = badgeTL_y + (b.suffixOffsetY / 100) * badgeH + b.suffixFontSize * sf * 0.5;

    const nameX = slot.x + (d.offsetX / 100) * slot.width;
    const nameY = slot.y + (d.offsetY / 100) * slot.height;

    return {
      image: { x: imgX, y: imgY, w: imgW, h: imgH },
      badge: { x: badgeTL_x, y: badgeTL_y, w: badgeW, h: badgeH },
      currency: { x: currX, y: currY, fs: b.currencyFontSize * sf },
      value: { x: valX, y: valY, fs: b.valueFontSize * sf },
      suffix: { x: sufX, y: sufY, fs: b.suffixFontSize * sf },
      name: { x: nameX, y: nameY, fs: d.fontSize * sf },
      sFactor: sf
    };
  }, []);

  const handleDragEnd = (e: any, gIdx: number, type: string) => {
    const node = e.target;
    // O slot de designamento base da matriz DOM SVG:
    const slotBase = context.slots[gIdx % context.slots.length];
    const cfg = getSlotSettings(gIdx);
    
    const el = (getElems(slotBase, cfg) as any)[type];
    
    // Konva offset adjustment vs actual element rendered coord
    // Removemos o offset global de 1000px porque agora usamos offsetX nativo.
    let nodeX = node.x();
    let nodeY = node.y();
    
    if (['value', 'suffix', 'name'].includes(type)) {
      nodeY = nodeY + el.fs * 0.75;
    } else if (type === 'currency') {
      nodeY = nodeY + el.fs * 0.75; 
    }

    const dx = nodeX - el.x;
    const dy = nodeY - el.y;

    let up: any = {};
    if (type === 'image') {
      up.imageConfig = { ...cfg.imageConfig, offsetX: cfg.imageConfig.offsetX + (dx/slotBase.width)*100, offsetY: cfg.imageConfig.offsetY + (dy/slotBase.height)*100 };
    } else if (type === 'name') {
      up.descConfig = { ...cfg.descConfig, offsetX: cfg.descConfig.offsetX + (dx/slotBase.width)*100, offsetY: cfg.descConfig.offsetY + (dy/slotBase.height)*100 };
    } else if (type === 'badge') {
      up.priceBadge = { ...cfg.priceBadge, badgeOffsetX: cfg.priceBadge.badgeOffsetX + (dx/slotBase.width)*100, badgeOffsetY: cfg.priceBadge.badgeOffsetY + (dy/slotBase.height)*100 };
    } else if (type === 'currency') {
      const bW = getElems(slotBase, cfg).badge.w;
      const bH = getElems(slotBase, cfg).badge.h;
      up.priceBadge = { ...cfg.priceBadge, currencyOffsetX: cfg.priceBadge.currencyOffsetX + (dx/bW)*100, currencyOffsetY: cfg.priceBadge.currencyOffsetY + (dy/bH)*100 };
    } else if (type === 'value') {
      const bW = getElems(slotBase, cfg).badge.w;
      const bH = getElems(slotBase, cfg).badge.h;
      up.priceBadge = { ...cfg.priceBadge, valueOffsetX: cfg.priceBadge.valueOffsetX + (dx/bW)*100, valueOffsetY: cfg.priceBadge.valueOffsetY + (dy/bH)*100 };
    } else if (type === 'suffix') {
      const bW = getElems(slotBase, cfg).badge.w;
      const bH = getElems(slotBase, cfg).badge.h;
      up.priceBadge = { ...cfg.priceBadge, suffixOffsetX: cfg.priceBadge.suffixOffsetX + (dx/bW)*100, suffixOffsetY: cfg.priceBadge.suffixOffsetY + (dy/bH)*100 };
    }
    
    if (Object.keys(up).length > 0) updateSlotSettings(gIdx, up);
  };

  const handleTransformEnd = (e: any, gIdx: number, type: string) => {
    const node = e.target;
    // For text nodes, we ignore scaling since user shouldn't stretch text by borders if possible. 
    // Usually they'll scale the image and badge. We map font size scaling differently if needed.
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1); node.scaleY(1);
    
    const nw = Math.max(20, node.width() * scaleX);
    const nh = Math.max(20, node.height() * scaleY);
    
    const slotBase = context.slots[gIdx % context.slots.length];
    const cfg = getSlotSettings(gIdx);
    const sf = slotBase.width / 500;
    
    if (type === 'image') {
      const newScale = nw / (slotBase.width * 0.8);
      updateSlotSettings(gIdx, { imageConfig: { ...cfg.imageConfig, scale: newScale } });
    } else if (type === 'name') {
      // Font size doesn't cleanly map to box width, but if they stretch the box height:
      const newFontSize = nh / (sf * 1.5);
      updateSlotSettings(gIdx, { descConfig: { ...cfg.descConfig, fontSize: newFontSize } });
    } else if (type === 'badge') {
      updateSlotSettings(gIdx, { priceBadge: { ...cfg.priceBadge, badgeWidth: nw/sf, badgeHeight: nh/sf } });
    }
  };

  const startInlineEdit = (gIdx: number, type: 'name' | 'price' | 'suffix', currentVal: string) => {
    setSelectedId(null);
    setEditingElem({ slotIdx: gIdx, type });
    setEditValue(currentVal);
    const cfg = getSlotSettings(gIdx);
    
    if (type === 'name') setEditFontSize(cfg.descConfig.fontSize);
    else if (type === 'price') setEditFontSize(cfg.priceBadge.valueFontSize);
    else if (type === 'suffix') setEditFontSize(cfg.priceBadge.suffixFontSize);
  };

  const saveInlineEdit = () => {
    if (!editingElem) return;
    pushHistory();
    const slotIdx = editingElem.slotIdx;
    
    setLocalProducts(prev => prev.map((p, i) => {
      if (i === slotIdx) {
        if (editingElem.type === 'name') return { ...p, name: editValue };
        if (editingElem.type === 'price') return { ...p, price: editValue };
        return p;
      }
      return p;
    }));

    const cfg = getSlotSettings(slotIdx);
    if (editingElem.type === 'name') {
      updateSlotSettings(slotIdx, { descConfig: { ...cfg.descConfig, fontSize: editFontSize } });
    } else if (editingElem.type === 'price') {
      updateSlotSettings(slotIdx, { priceBadge: { ...cfg.priceBadge, valueFontSize: editFontSize } });
    } else if (editingElem.type === 'suffix') {
      updateSlotSettings(slotIdx, { priceBadge: { ...cfg.priceBadge, suffixText: editValue, suffixFontSize: editFontSize } });
    }

    setEditingElem(null);
    toast.success('Editado com sucesso!');
  };

  const cancelInlineEdit = () => {
    setEditingElem(null);
  };

  const FontStyles = () => (
    <style dangerouslySetInnerHTML={{
      __html: context.customFonts.map(f =>
        `@font-face { font-family: '${f.name}'; src: url('${f.url}'); font-display: swap; }`
      ).join('\n')
    }} />
  );

  return (
    <div className="fixed inset-0 z-[200] bg-[#060608]/98 flex flex-col animate-in fade-in duration-200">
      <FontStyles />
      <div className="flex items-center justify-between px-6 py-4 bg-[#0d0d10] border-b border-white/5 shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onClose} className="w-10 h-10 p-0 text-white/40 hover:text-white rounded-xl hover:bg-white/5">
            <X className="w-5 h-5" />
          </Button>
          <div className="w-px h-6 bg-white/10" />
          <div className="w-8 h-8 bg-red-600/10 rounded-xl flex items-center justify-center border border-red-600/20">
            <Edit2 className="w-4 h-4 text-red-500" />
          </div>
          <div>
            <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-white">MacEditor Pro 3.0</h2>
            <p className="text-[9px] text-white/30 font-bold uppercase tracking-wider">Tela {pageIndex + 1} de {context.pageCount} (Isolado)</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => undo()} 
            disabled={history.length === 0}
            className="p-2 hover:bg-white/5 rounded-xl text-white/40 hover:text-white transition-all disabled:opacity-20" 
            title="Desfazer (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          
          <div className="flex items-center gap-1 bg-white/5 rounded-xl px-2 py-1.5 border border-white/10">
             <button onClick={() => setZoom(z => Math.max(0.1, z - 0.1))} className="text-white/40 hover:text-white w-6 h-6">-</button>
             <span className="text-[10px] font-black text-white/40 min-w-[45px] text-center">{Math.round(zoom * 100)}%</span>
             <button onClick={() => setZoom(z => Math.min(4, z + 0.1))} className="text-white/40 hover:text-white w-6 h-6">+</button>
          </div>
          
          <div className="w-px h-6 bg-white/10" />
          <Button onClick={saveAndClose} className="h-10 px-6 bg-red-600 hover:bg-red-700 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-red-600/10">
            <Save className="w-4 h-4 mr-2" /> Salvar Modificações
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-16 bg-[#0d0d10] border-r border-white/5 flex flex-col items-center py-6 gap-4 shrink-0">
          <button 
            onClick={() => { setActiveTool('select'); setSelectedId(null); }} 
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${activeTool === 'select' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'text-white/20 hover:bg-white/5'}`}
            title="Ferramenta de Seleção (Mover/Resizer)"
          >
            <Move className="w-5 h-5" />
          </button>
          <button 
            onClick={() => { setActiveTool('text'); setSelectedId(null); }} 
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${activeTool === 'text' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'text-white/20 hover:bg-white/5'}`}
            title="Ferramenta de Texto (Duplo Clique)"
          >
            <Type className="w-5 h-5" />
          </button>
          <div className="w-8 h-px bg-white/5 my-2" />
          <button onClick={() => copy()} className="w-10 h-10 rounded-xl flex items-center justify-center text-white/20 hover:bg-white/5" title="Copiar (Ctrl+C)"><Copy className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden"
             onWheel={e => {
               if (e.ctrlKey) return;
               if (editingElem) return;
               setZoom(z => Math.min(4, Math.max(0.1, z + (e.deltaY > 0 ? -0.1 : 0.1))));
             }}>
          <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}>
            <Stage 
                width={context.config.width} 
                height={context.config.height} 
                ref={stageRef}
                onMouseDown={(e) => {
                    const clickedOnEmpty = e.target === e.target.getStage() || e.target.hasName('bg');
                    if (clickedOnEmpty) setSelectedId(null);
                }}
                className="shadow-2xl bg-white"
            >
                <Layer>
                    {context.config.backgroundImageUrl && (
                        <URLImage name="bg" src={context.config.backgroundImageUrl} width={context.config.width} height={context.config.height} />
                    )}
                    {context.slots.map((slotBase, sIdx) => {
                        const gIdx = pageIndex * context.slots.length + sIdx;
                        const product = localProducts[gIdx];
                        if (!product) return null;

                        const cfg = getSlotSettings(gIdx);
                        const v = getElems(slotBase, cfg);
                        
                        return (
                            <Group key={gIdx} 
                               onMouseEnter={e => {
                                 if (activeTool === 'text') { const c = e.target.getStage()?.container(); if (c) c.style.cursor = 'text'; }
                               }}
                               onMouseLeave={e => {
                                 const c = e.target.getStage()?.container(); if (c) c.style.cursor = 'default';
                               }}
                            >
                                {/* IMAGE */}
                                {product.images?.[0] && (
                                    <URLImage 
                                        id={`${gIdx}-image`}
                                        src={product.images[0]}
                                        x={v.image.x} y={v.image.y}
                                        width={v.image.w} height={v.image.h}
                                        draggable={activeTool === 'select'}
                                        onClick={() => activeTool === 'select' && setSelectedId(`${gIdx}-image`)}
                                        onDragStart={pushHistory}
                                        onDragEnd={(e: any) => handleDragEnd(e, gIdx, 'image')}
                                        onTransformEnd={(e: any) => handleTransformEnd(e, gIdx, 'image')}
                                    />
                                )}
                                
                                {/* PRICE BADGE BACKGROUND */}
                                {cfg.priceBadge.badgeImageUrl ? (
                                    <URLImage 
                                        id={`${gIdx}-badge`}
                                        src={cfg.priceBadge.badgeImageUrl}
                                        x={v.badge.x} y={v.badge.y}
                                        width={v.badge.w} height={v.badge.h}
                                        draggable={activeTool === 'select'}
                                        onClick={() => activeTool === 'select' && setSelectedId(`${gIdx}-badge`)}
                                        onDragStart={pushHistory}
                                        onDragEnd={(e: any) => handleDragEnd(e, gIdx, 'badge')}
                                        onTransformEnd={(e: any) => handleTransformEnd(e, gIdx, 'badge')}
                                    />
                                ) : (
                                    <Rect 
                                        id={`${gIdx}-badge`}
                                        x={v.badge.x} y={v.badge.y}
                                        width={v.badge.w} height={v.badge.h}
                                        fill={cfg.priceBadge.bgColor}
                                        cornerRadius={cfg.priceBadge.borderRadius * v.sFactor}
                                        draggable={activeTool === 'select'}
                                        onClick={() => activeTool === 'select' && setSelectedId(`${gIdx}-badge`)}
                                        onDragStart={pushHistory}
                                        onDragEnd={(e: any) => handleDragEnd(e, gIdx, 'badge')}
                                        onTransformEnd={(e: any) => handleTransformEnd(e, gIdx, 'badge')}
                                    />
                                )}

                                {/* CIRCULARES/VALORES -> AGORA MATEMATICAMENTE IDÊNTICOS AO SVG */}
                                {/* R$ */}
                                <KonvaText
                                    id={`${gIdx}-currency`}
                                    x={v.currency.x} y={v.currency.y - v.currency.fs * 0.75}
                                    text="R$"
                                    fontSize={v.currency.fs}
                                    fill={cfg.priceBadge.currencyColor}
                                    fontFamily={cfg.priceBadge.currencyFontFamily}
                                    fontStyle="900"
                                    draggable={activeTool === 'select'}
                                    onClick={() => activeTool === 'select' && setSelectedId(`${gIdx}-currency`)}
                                    onDragStart={pushHistory}
                                    onDragEnd={(e: any) => handleDragEnd(e, gIdx, 'currency')}
                                    onTransformEnd={(e: any) => handleTransformEnd(e, gIdx, 'currency')}
                                />
                                
                                {/* PRICE VALUE (TextAnchor = Middle aproximado via ref) */}
                                <KonvaText
                                    id={`${gIdx}-value`}
                                    ref={(n) => { if (n) n.offsetX(n.width() / 2); }}
                                    x={v.value.x} y={v.value.y - v.value.fs * 0.75}
                                    text={product.price.replace('R$', '').trim()}
                                    fontSize={v.value.fs}
                                    fill={cfg.priceBadge.valueColor}
                                    fontFamily={cfg.priceBadge.valueFontFamily}
                                    fontStyle="900"
                                    draggable={activeTool === 'select'}
                                    onClick={() => {
                                        if (activeTool === 'text') startInlineEdit(gIdx, 'price', product.price);
                                        else setSelectedId(`${gIdx}-value`);
                                    }}
                                    onTap={() => activeTool === 'text' && startInlineEdit(gIdx, 'price', product.price)}
                                    onDragStart={pushHistory}
                                    onDragEnd={(e: any) => handleDragEnd(e, gIdx, 'value')}
                                    onTransformEnd={(e: any) => handleTransformEnd(e, gIdx, 'value')}
                                />

                                {/* SUFFIX (TextAnchor = Middle via ref) */}
                                {cfg.priceBadge.showSuffix && (
                                   <KonvaText
                                      id={`${gIdx}-suffix`}
                                      ref={(n) => { if (n) n.offsetX(n.width() / 2); }}
                                      x={v.suffix.x} y={v.suffix.y - v.suffix.fs * 0.75}
                                      text={cfg.priceBadge.suffixText}
                                      fontSize={v.suffix.fs}
                                      fill={cfg.priceBadge.suffixColor}
                                      fontStyle="bold"
                                      draggable={activeTool === 'select'}
                                      onClick={() => {
                                        if (activeTool === 'text') startInlineEdit(gIdx, 'suffix', cfg.priceBadge.suffixText);
                                        else setSelectedId(`${gIdx}-suffix`);
                                      }}
                                      onTap={() => activeTool === 'text' && startInlineEdit(gIdx, 'suffix', cfg.priceBadge.suffixText)}
                                      onDragStart={pushHistory}
                                      onDragEnd={(e: any) => handleDragEnd(e, gIdx, 'suffix')}
                                      onTransformEnd={(e: any) => handleTransformEnd(e, gIdx, 'suffix')}
                                   />
                                )}

                                {/* NAME (TextAnchor = Middle via ref) */}
                                <KonvaText
                                    id={`${gIdx}-name`}
                                    ref={(n) => { if (n) n.offsetX(n.width() / 2); }}
                                    x={v.name.x} y={v.name.y - v.name.fs * 0.75}
                                    text={computeWrappedLinesStr(product.name, cfg.descConfig.fontSize, slotBase.width / 500, slotBase.width)}
                                    lineHeight={1.15}
                                    fontSize={v.name.fs}
                                    fill={cfg.descConfig.color}
                                    fontFamily={cfg.descConfig.fontFamily}
                                    fontStyle="900"
                                    textTransform={cfg.descConfig.uppercase ? 'uppercase' : 'none'}
                                    draggable={activeTool === 'select'}
                                    onClick={() => {
                                        if (activeTool === 'text') startInlineEdit(gIdx, 'name', product.name);
                                        else setSelectedId(`${gIdx}-name`);
                                    }}
                                    onTap={() => activeTool === 'text' && startInlineEdit(gIdx, 'name', product.name)}
                                    onDragStart={pushHistory}
                                    onDragEnd={(e: any) => handleDragEnd(e, gIdx, 'name')}
                                    onTransformEnd={(e: any) => handleTransformEnd(e, gIdx, 'name')}
                                />
                            </Group>
                        );
                    })}
                    
                    {activeTool === 'select' && (
                        <Transformer 
                            ref={trRef} 
                            boundBoxFunc={(oldBox, newBox) => {
                                if (newBox.width < 20 || newBox.height < 20) return oldBox;
                                return newBox;
                            }}
                        />
                    )}
                </Layer>
            </Stage>

            {/* MODAL DE EDIÇÃO DE TEXTO */}
            {editingElem && selectedId === null && (
              <div 
                className="absolute bg-[#121214] border-2 border-red-600 rounded-2xl p-4 shadow-2xl z-50 animate-in zoom-in-95 duration-150 w-[320px]"
                style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
                onWheel={e => e.stopPropagation()}
                onKeyDown={e => e.stopPropagation()}
              >
                <div className="flex flex-col gap-4">
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                       <Type className="w-3 h-3 text-red-500" />
                       <span className="text-[9px] font-black uppercase text-white/40 tracking-[0.2em]">
                         Editar {editingElem.type}
                       </span>
                     </div>
                     <button onClick={cancelInlineEdit} className="text-white/20 hover:text-white transition-colors">
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
                           if (e.key === 'Escape') { e.stopPropagation(); cancelInlineEdit(); }
                         }}
                         rows={4}
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
                         {editingElem.type === 'price' && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-red-500 font-black text-xs">R$</span>}
                         <input
                           autoFocus
                           value={editingElem.type === 'price' ? editValue.replace('R$', '').trim() : editValue}
                           onChange={e => setEditValue(e.target.value)}
                           onKeyDown={e => {
                             if (e.key === 'Enter') { e.preventDefault(); saveInlineEdit(); }
                             if (e.key === 'Escape') { e.stopPropagation(); cancelInlineEdit(); }
                           }}
                           className={`w-full bg-black/60 border border-white/10 rounded-xl h-12 ${editingElem.type === 'price' ? 'pl-10' : 'pl-4'} pr-4 text-sm font-black text-white outline-none focus:border-red-600/50`}
                         />
                       </div>
                       <div className="flex items-center justify-between bg-black/40 p-2 rounded-lg border border-white/5">
                         <span className="text-[8px] font-black uppercase text-white/30">TAMANHO DA FONTE</span>
                         <div className="flex items-center gap-3">
                           <button onClick={() => setEditFontSize(f => Math.max(10, f - 5))} className="text-white/40 hover:text-white">-</button>
                           <span className="text-[10px] font-black text-white">{editFontSize}px</span>
                           <button onClick={() => setEditFontSize(f => Math.min(200, f + 5))} className="text-white/40 hover:text-white">+</button>
                         </div>
                       </div>
                     </div>
                   )}
                   
                   <div className="flex gap-2 font-black uppercase tracking-widest text-[9px]">
                     <Button variant="ghost" onClick={cancelInlineEdit} className="flex-1 h-10 bg-white/5 hover:bg-white/10 text-white/40 rounded-xl">Cancelar</Button>
                     <Button onClick={saveInlineEdit} className="flex-1 h-10 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-lg shadow-red-600/20">Aplicar</Button>
                   </div>
                   <p className="text-[8px] text-white/20 text-center font-bold uppercase tracking-wider mt-2">
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
}
