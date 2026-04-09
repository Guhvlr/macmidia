import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useOffer } from '../context/OfferContext';
import { supabase } from '@/integrations/supabase/client';
import { Upload, Loader2, ChevronDown, ChevronRight, Search, Zap, Layers, Type, CreditCard, PlusCircle, PenTool } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type ElemId = 'image' | 'name' | 'badge' | 'currency' | 'value' | 'suffix';

export const StepPriceBadge = () => {
  const { priceBadge, updatePriceBadge, descConfig, updateDescConfig, imageConfig, updateImageConfig, customFonts, setCustomFonts } = useOffer();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [selected, setSelected] = useState<ElemId | null>(null);
  const [dragging, setDragging] = useState<ElemId | null>(null);
  const [dragOff, setDragOff] = useState({ x: 0, y: 0 });
  const [resizing, setResizing] = useState<ElemId | null>(null);
  const [resizeStart, setResizeStart] = useState({ sx: 0, sy: 0, ow: 0, oh: 0 });
  const [isUploading, setIsUploading] = useState(false);
  const [fontSearch, setFontSearch] = useState('');
  const [openSection, setOpenSection] = useState<string | null>('fonts');
  const didDrag = useRef(false);

  const W = 500;
  const H = 600;

  // Load fonts from Supabase on mount
  useEffect(() => {
    const fetchFonts = async () => {
      const { data, error } = await (supabase as any).from('offer_fonts').select('*');
      if (error) return;
      
      const loadedNames = customFonts.map(f => f.name);
      for (const f of (data || [])) {
        if (loadedNames.includes(f.name)) continue;
        
        try {
          const resp = await fetch(f.url);
          const blob = await resp.blob();
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result as string;
            const fontFace = new FontFace(f.name, `url(${base64})`);
            fontFace.load().then(loaded => {
              document.fonts.add(loaded);
              setCustomFonts(prev => {
                if (prev.some(x => x.name === f.name)) return prev;
                return [...prev, { name: f.name, url: base64 }];
              });
            });
          };
          reader.readAsDataURL(blob);
        } catch (e) { console.error('Erro ao carregar fonte salva:', e); }
      }
    };
    fetchFonts();
  }, []);

  const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    let successCount = 0;

    const processFile = async (file: File) => {
      const fontName = file.name.split('.')[0].replace(/\s+/g, '-');
      try {
        const fn = `font_${Date.now()}_${file.name}`;
        const { error: storageError } = await supabase.storage.from('product-images').upload(`fonts/${fn}`, file);
        if (storageError) throw storageError;

        const publicUrl = `https://ebvvmddizsggrqasnnvv.supabase.co/storage/v1/object/public/product-images/fonts/${fn}`;
        const { error: dbError } = await (supabase as any).from('offer_fonts').insert([{ name: fontName, url: publicUrl }]);
        if (dbError) throw dbError;

        return new Promise<void>((resolve) => {
          const reader = new FileReader();
          reader.onload = async (event) => {
            const base64 = event.target?.result as string;
            const fontFace = new FontFace(fontName, `url(${base64})`);
            const loadedFont = await fontFace.load();
            document.fonts.add(loadedFont);
            setCustomFonts(prev => {
              if (prev.some(f => f.name === fontName)) return prev;
              return [...prev, { name: fontName, url: base64 }];
            });
            successCount++;
            resolve();
          };
          reader.readAsDataURL(file);
        });
      } catch (err: any) {
        toast.error(`Erro ao salvar ${file.name}: ` + err.message);
      }
    };

    try {
      for (const file of Array.from(files)) await processFile(file);
      if (successCount > 0) toast.success(`${successCount} fontes adicionadas!`);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const filteredFonts = useMemo(() => {
    return customFonts.filter(f => f.name.toLowerCase().includes(fontSearch.toLowerCase()));
  }, [customFonts, fontSearch]);

  const toSvg = useCallback((e: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const r = svg.getBoundingClientRect();
    return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
  }, []);

  const elems: Record<ElemId, { x: number; y: number; w: number; h: number }> = {
    image: {
      x: W * imageConfig.offsetX / 100 - (W * 0.45 * imageConfig.scale) / 2,
      y: H * imageConfig.offsetY / 100 - (H * 0.35 * imageConfig.scale) / 2,
      w: W * 0.45 * imageConfig.scale,
      h: H * 0.35 * imageConfig.scale,
    },
    name: {
      x: W * descConfig.offsetX / 100 - 90,
      y: H * descConfig.offsetY / 100 - descConfig.fontSize / 2 - 4,
      w: 180,
      h: descConfig.fontSize + 8,
    },
    badge: {
      x: W * priceBadge.badgeOffsetX / 100 - priceBadge.badgeWidth / 2,
      y: H * priceBadge.badgeOffsetY / 100 - priceBadge.badgeHeight / 2,
      w: priceBadge.badgeWidth,
      h: priceBadge.badgeHeight,
    },
    currency: {
      x: W * priceBadge.badgeOffsetX / 100 - priceBadge.badgeWidth / 2 + priceBadge.badgeWidth * priceBadge.currencyOffsetX / 100 - priceBadge.currencyFontSize * 1.2,
      y: H * priceBadge.badgeOffsetY / 100 - priceBadge.badgeHeight / 2 + priceBadge.badgeHeight * priceBadge.currencyOffsetY / 100 - priceBadge.currencyFontSize,
      w: priceBadge.currencyFontSize * 2.4,
      h: priceBadge.currencyFontSize + 6,
    },
    value: {
      x: W * priceBadge.badgeOffsetX / 100 - priceBadge.badgeWidth / 2 + priceBadge.badgeWidth * priceBadge.valueOffsetX / 100 - priceBadge.valueFontSize * 1.5,
      y: H * priceBadge.badgeOffsetY / 100 - priceBadge.badgeHeight / 2 + priceBadge.badgeHeight * priceBadge.valueOffsetY / 100 - priceBadge.valueFontSize,
      w: priceBadge.valueFontSize * 3,
      h: priceBadge.valueFontSize + 6,
    },
    suffix: {
      x: W * priceBadge.badgeOffsetX / 100 - priceBadge.badgeWidth / 2 + priceBadge.badgeWidth * priceBadge.suffixOffsetX / 100 - priceBadge.suffixFontSize * 2,
      y: H * priceBadge.badgeOffsetY / 100 - priceBadge.badgeHeight / 2 + priceBadge.badgeHeight * priceBadge.suffixOffsetY / 100 - priceBadge.suffixFontSize,
      w: priceBadge.suffixFontSize * 4,
      h: priceBadge.suffixFontSize + 6,
    },
  };

  const startDrag = (e: React.MouseEvent, id: ElemId) => {
    e.preventDefault(); e.stopPropagation();
    setSelected(id); setDragging(id); didDrag.current = false;
    const c = toSvg(e); const el = elems[id];
    setDragOff({ x: c.x - el.x, y: c.y - el.y });
  };

  const startResize = (e: React.MouseEvent, id: ElemId) => {
    e.preventDefault(); e.stopPropagation();
    setSelected(id); setResizing(id);
    const c = toSvg(e); const el = elems[id];
    setResizeStart({ sx: c.x, sy: c.y, ow: el.w, oh: el.h });
  };

  const handleMove = (e: React.MouseEvent) => {
    const c = toSvg(e);
    if (dragging) {
      didDrag.current = true;
      const nx = c.x - dragOff.x; const ny = c.y - dragOff.y;
      switch (dragging) {
        case 'image': updateImageConfig({ offsetX: Math.max(0, Math.min(100, ((nx + elems.image.w / 2) / W) * 100)), offsetY: Math.max(0, Math.min(100, ((ny + elems.image.h / 2) / H) * 100)) }); break;
        case 'name': updateDescConfig({ offsetX: Math.max(0, Math.min(100, ((nx + 90) / W) * 100)), offsetY: Math.max(0, Math.min(100, ((ny + descConfig.fontSize / 2 + 4) / H) * 100)) }); break;
        case 'badge': updatePriceBadge({ badgeOffsetX: Math.max(0, Math.min(100, ((nx + priceBadge.badgeWidth / 2) / W) * 100)), badgeOffsetY: Math.max(0, Math.min(100, ((ny + priceBadge.badgeHeight / 2) / H) * 100)) }); break;
        case 'currency': { const bx = W * priceBadge.badgeOffsetX / 100 - priceBadge.badgeWidth / 2; const by = H * priceBadge.badgeOffsetY / 100 - priceBadge.badgeHeight / 2; updatePriceBadge({ currencyOffsetX: Math.max(0, Math.min(100, ((nx + priceBadge.currencyFontSize * 1.2 - bx) / priceBadge.badgeWidth) * 100)), currencyOffsetY: Math.max(0, Math.min(100, ((ny + priceBadge.currencyFontSize - by) / priceBadge.badgeHeight) * 100)) }); break; }
        case 'value': { const bx = W * priceBadge.badgeOffsetX / 100 - priceBadge.badgeWidth / 2; const by = H * priceBadge.badgeOffsetY / 100 - priceBadge.badgeHeight / 2; updatePriceBadge({ valueOffsetX: Math.max(0, Math.min(100, ((nx + priceBadge.valueFontSize * 1.5 - bx) / priceBadge.badgeWidth) * 100)), valueOffsetY: Math.max(0, Math.min(100, ((ny + priceBadge.valueFontSize - by) / priceBadge.badgeHeight) * 100)) }); break; }
        case 'suffix': { const bx = W * priceBadge.badgeOffsetX / 100 - priceBadge.badgeWidth / 2; const by = H * priceBadge.badgeOffsetY / 100 - priceBadge.badgeHeight / 2; updatePriceBadge({ suffixOffsetX: Math.max(0, Math.min(100, ((nx + priceBadge.suffixFontSize * 2 - bx) / priceBadge.badgeWidth) * 100)), suffixOffsetY: Math.max(0, Math.min(100, ((ny + priceBadge.suffixFontSize - by) / priceBadge.badgeHeight) * 100)) }); break; }
      }
    }
    if (resizing) {
      didDrag.current = true;
      const dw = c.x - resizeStart.sx; const dh = c.y - resizeStart.sy;
      const nw = Math.max(30, resizeStart.ow + dw); const nh = Math.max(15, resizeStart.oh + dh);
      switch (resizing) {
        case 'image': updateImageConfig({ scale: Math.max(0.2, nw / (W * 0.45)) }); break;
        case 'name': updateDescConfig({ fontSize: Math.max(8, Math.round(nh - 8)) }); break;
        case 'badge': updatePriceBadge({ badgeWidth: Math.round(nw), badgeHeight: Math.round(nh) }); break;
        case 'currency': updatePriceBadge({ currencyFontSize: Math.max(8, Math.round(nh - 6)) }); break;
        case 'value': updatePriceBadge({ valueFontSize: Math.max(10, Math.round(nh - 6)) }); break;
        case 'suffix': updatePriceBadge({ suffixFontSize: Math.max(6, Math.round(nh - 6)) }); break;
      }
    }
  };

  const handleUp = () => { setDragging(null); setResizing(null); };

  const handleBadgeImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) updatePriceBadge({ badgeImageUrl: URL.createObjectURL(file) });
  };

  const clampCurr = Math.min(priceBadge.currencyFontSize, priceBadge.badgeHeight * 0.45);
  const clampVal = Math.min(priceBadge.valueFontSize, priceBadge.badgeHeight * 0.7);
  const clampSuf = Math.min(priceBadge.suffixFontSize, priceBadge.badgeHeight * 0.3);

  const DragBox = ({ id, children }: { id: ElemId; children: React.ReactNode }) => {
    const el = elems[id];
    const isSel = selected === id;
    return (
      <g>
        <rect x={el.x} y={el.y} width={el.w} height={el.h} fill="transparent" style={{ cursor: 'move' }} onMouseDown={e => startDrag(e, id)} />
        {children}
        {isSel && (
          <>
            <rect x={el.x - 1} y={el.y - 1} width={el.w + 2} height={el.h + 2} fill="none" stroke="#D9254B" strokeWidth={2} rx={3} />
            <rect x={el.x + el.w - 5} y={el.y + el.h - 5} width={10} height={10} fill="#D9254B" stroke="white" strokeWidth={1} rx={2} style={{ cursor: 'nwse-resize' }} onMouseDown={e => startResize(e, id)} />
            <text x={el.x + el.w / 2} y={el.y - 5} fontSize={8} fill="#D9254B" textAnchor="middle" fontWeight="800" fontFamily="sans-serif">
              {id === 'image' ? 'IMAGEM' : id === 'name' ? 'DESCRIÇÃO' : id === 'badge' ? 'FUNDO PREÇO' : id === 'currency' ? 'R$' : id === 'value' ? 'VALOR' : 'SUFIXO'}
            </text>
          </>
        )}
      </g>
    );
  };

  const Section = ({ id, label, icon: Icon, children }: { id: string; label: string; icon: any; children: React.ReactNode }) => {
    const isOpen = openSection === id;
    return (
      <div className="border border-white/5 rounded-2xl bg-white/[0.02] overflow-hidden">
        <button 
          onClick={() => setOpenSection(isOpen ? null : id)} 
          className={`w-full p-4 flex items-center justify-between text-left transition-colors ${isOpen ? 'bg-primary/5' : 'hover:bg-white/[0.04]'}`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl transition-colors ${isOpen ? 'bg-primary text-white' : 'bg-white/5 text-white/30'}`}>
              <Icon className="w-4 h-4" />
            </div>
            <span className={`text-xs font-black uppercase tracking-widest ${isOpen ? 'text-white' : 'text-white/40'}`}>{label}</span>
          </div>
          {isOpen ? <ChevronDown className="w-4 h-4 text-primary" /> : <ChevronRight className="w-4 h-4 text-white/20" />}
        </button>
        {isOpen && <div className="p-4 pt-0 space-y-4">{children}</div>}
      </div>
    );
  };

  return (
    <div className="h-full flex">
      {/* Sidebar */}
      <div className="w-[340px] border-r border-white/5 bg-[#0d0d10] p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6">
        <div className="text-center space-y-2 mb-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full border border-primary/20">
             <Zap className="w-3 h-3 text-primary" />
             <span className="text-[10px] font-black uppercase text-primary tracking-widest">Etapa 4</span>
          </div>
          <h2 className="text-sm font-black uppercase tracking-tighter text-white">Configure seu display de preço</h2>
        </div>

        <div className="flex flex-col gap-3">
          {/* Section: FONTES */}
          <Section id="fonts" label="Fontes" icon={Type}>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col items-center justify-center gap-2 p-3 border border-dashed border-white/10 rounded-xl hover:border-primary/40 cursor-pointer transition-all bg-white/[0.02] group">
                <Upload className="w-5 h-5 text-white/20 group-hover:text-primary transition-colors" />
                <span className="text-[9px] font-bold text-white/30 text-center uppercase">Fontes .TTF / .OTF</span>
                <input type="file" accept=".ttf,.otf" onChange={handleFontUpload} className="hidden" disabled={isUploading} multiple />
              </label>
              <label className="flex flex-col items-center justify-center gap-2 p-3 border border-dashed border-white/10 rounded-xl hover:border-primary/40 cursor-pointer transition-all bg-white/[0.02] group">
                <PlusCircle className="w-5 h-5 text-white/20 group-hover:text-primary transition-colors" />
                <span className="text-[9px] font-bold text-white/30 text-center uppercase">Fundo PNG</span>
                <input type="file" accept="image/png,image/webp" onChange={handleBadgeImage} className="hidden" />
              </label>
            </div>
            {isUploading && (
              <div className="flex items-center justify-center gap-2 py-2 bg-primary/5 rounded-xl border border-primary/20">
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
                <span className="text-[10px] text-primary font-black uppercase tracking-widest">Salvando nas nuvens...</span>
              </div>
            )}
          </Section>

          {/* Section: FUNDO DO PREÇO */}
          <Section id="badge" label="Fundo do Preço" icon={Layers}>
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                   <label className="text-[9px] font-black uppercase text-white/30 tracking-widest">Cor Principal</label>
                   <div className="relative h-6 rounded-lg overflow-hidden border border-white/10 group">
                      <input type="color" value={priceBadge.bgColor} onChange={e => updatePriceBadge({ bgColor: e.target.value })} className="absolute inset-0 w-full h-full cursor-pointer scale-150" />
                   </div>
                </div>
                <div className="space-y-1.5">
                   <label className="text-[9px] font-black uppercase text-white/30 tracking-widest">Arredondamento</label>
                   <input type="range" min="0" max="60" value={priceBadge.borderRadius} onChange={e => updatePriceBadge({ borderRadius: parseInt(e.target.value) })} className="w-full accent-primary h-1.5 mt-2 bg-white/5 rounded-full" />
                </div>
             </div>
          </Section>

          {/* Section: DESCRIÇÃO */}
          <Section id="desc" label="Descrição" icon={PenTool}>
             <div className="space-y-4">
                <div className="space-y-1.5">
                   <div className="flex items-center justify-between mb-1">
                      <label className="text-[9px] font-black uppercase text-white/30 tracking-widest">Fonte da Descrição</label>
                      <div className="relative flex-1 ml-4">
                        <Search className="absolute left-2 top-1.5 w-2.5 h-2.5 text-white/20" />
                        <input value={fontSearch} onChange={e => setFontSearch(e.target.value)} placeholder="Pesquisar..." className="w-full bg-black/40 border border-white/10 rounded-lg h-6 pl-6 pr-2 text-[9px] text-white outline-none focus:border-primary/50 transition-all font-bold" />
                      </div>
                   </div>
                   <select value={descConfig.fontFamily} onChange={e => updateDescConfig({ fontFamily: e.target.value })} className="w-full bg-black/60 border border-white/10 rounded-xl h-9 px-3 text-[11px] text-white outline-none focus:border-primary/50 transition-all font-bold">
                      <option value="Montserrat, sans-serif">Montserrat (Padrão)</option>
                      {filteredFonts.map(f => ( <option key={f.name} value={f.name}>{f.name}</option> ))}
                   </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                   <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase text-white/30 tracking-widest flex items-center justify-between">
                         Cor Texto <input type="color" value={descConfig.color} onChange={e => updateDescConfig({ color: e.target.value })} className="w-4 h-4 rounded-full border-none cursor-pointer" />
                      </label>
                      <input type="text" value={descConfig.color.toUpperCase()} readOnly className="w-full bg-white/[0.03] border border-white/10 rounded-xl h-8 px-2 text-[10px] text-white/60 text-center font-mono" />
                   </div>
                   <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase text-white/30 tracking-widest flex items-center gap-2 p-1">
                         <input type="checkbox" checked={descConfig.uppercase} onChange={e => updateDescConfig({ uppercase: e.target.checked })} className="w-3.5 h-3.5 accent-primary rounded-md" /> MAIÚSC.
                      </label>
                   </div>
                </div>
                <div className="space-y-1.5 pt-2">
                    <div className="flex items-center justify-between mb-2">
                       <label className="text-[9px] font-black uppercase text-white/30 tracking-widest">Fundo da Descrição</label>
                       <div className="flex items-center gap-2">
                          <input type="checkbox" checked={descConfig.showBg} onChange={e => updateDescConfig({ showBg: e.target.checked })} className="w-3.5 h-3.5 accent-primary" />
                       </div>
                    </div>
                    {descConfig.showBg && (
                       <input type="color" value={descConfig.bgColor} onChange={e => updateDescConfig({ bgColor: e.target.value })} className="w-full h-2 rounded-full cursor-pointer bg-gradient-to-r from-primary to-purple-500" />
                    )}
                </div>
             </div>
          </Section>

          {/* Section: PREÇOS */}
          <Section id="prices" label="Preços (R$ e Valor)" icon={CreditCard}>
             <div className="space-y-4">
                <div className="space-y-1.5">
                   <div className="flex items-center justify-between mb-1">
                      <label className="text-[9px] font-black uppercase text-white/30 tracking-widest">Fonte dos Preços</label>
                      <div className="relative flex-1 ml-4">
                        <Search className="absolute left-2 top-1.5 w-2.5 h-2.5 text-white/20" />
                        <input value={fontSearch} onChange={e => setFontSearch(e.target.value)} placeholder="Pesquisar..." className="w-full bg-black/40 border border-white/10 rounded-lg h-6 pl-6 pr-2 text-[9px] text-white outline-none focus:border-primary/50 transition-all font-bold" />
                      </div>
                   </div>
                   <select value={priceBadge.valueFontFamily} onChange={e => { updatePriceBadge({ valueFontFamily: e.target.value, currencyFontFamily: e.target.value }); }} className="w-full bg-black/60 border border-white/10 rounded-xl h-9 px-3 text-[11px] text-white outline-none focus:border-primary/50 transition-all font-bold">
                      <option value="Montserrat, sans-serif">Montserrat (Padrão)</option>
                      {filteredFonts.map(f => ( <option key={f.name} value={f.name}>{f.name}</option> ))}
                   </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                   <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase text-white/30 tracking-widest">Cor R$</label>
                      <div className="relative h-8 bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden group">
                         <input type="color" value={priceBadge.currencyColor} onChange={e => updatePriceBadge({ currencyColor: e.target.value })} className="absolute inset-0 w-full h-full cursor-pointer scale-150" />
                      </div>
                   </div>
                   <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase text-white/30 tracking-widest">Cor Valor</label>
                      <div className="relative h-8 bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden group">
                         <input type="color" value={priceBadge.valueColor} onChange={e => updatePriceBadge({ valueColor: e.target.value })} className="absolute inset-0 w-full h-full cursor-pointer scale-150" />
                      </div>
                   </div>
                </div>

                <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                   <div className="space-y-0.5">
                      <span className="text-[10px] font-black uppercase text-white tracking-widest">Sufixo</span>
                      <p className="text-[8px] text-white/20 font-bold uppercase">"CADA", "KG", "UN"</p>
                   </div>
                   <button onClick={() => updatePriceBadge({ showSuffix: !priceBadge.showSuffix })} className={`w-10 h-5 rounded-full p-1 transition-all duration-300 ${priceBadge.showSuffix ? 'bg-primary' : 'bg-white/10'}`}>
                      <div className={`w-3 h-3 bg-white rounded-full transition-transform duration-300 ${priceBadge.showSuffix ? 'translate-x-5' : 'translate-x-0'}`} />
                   </button>
                </div>
                {priceBadge.showSuffix && (
                   <input value={priceBadge.suffixText} onChange={e => updatePriceBadge({ suffixText: e.target.value })} placeholder="cada" className="w-full bg-black/40 border border-white/10 rounded-xl h-8 px-3 text-[10px] text-white font-bold" />
                )}
             </div>
          </Section>
        </div>
      </div>

      {/* ═══ CANVAS ═══ */}
      <div className="flex-1 bg-black/40 flex items-center justify-center p-6 overflow-auto"
        onClick={() => { if (!didDrag.current) setSelected(null); didDrag.current = false; }}>
        <div className="space-y-4 text-center">
          <p className="text-[10px] text-white/25 font-black uppercase tracking-[0.2em]">Preview do Slot — Edição Visual Pro</p>
          <svg ref={svgRef} width={W} height={H} viewBox={`0 0 ${W} ${H}`}
            style={{ width: '100%', maxWidth: '500px', height: 'auto', userSelect: 'none' }}
            className="bg-[#121214] rounded-[2rem] border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] mx-auto overflow-hidden"
            onMouseMove={handleMove} onMouseUp={handleUp} onMouseLeave={handleUp}>

            {/* Injected Font Styles */}
            <defs>
              <style dangerouslySetInnerHTML={{ __html: `
                ${customFonts.map(f => `
                  @font-face {
                    font-family: '${f.name}';
                    src: url('${f.url}');
                  }
                `).join('\n')}
              ` }} />
            </defs>

            <rect width={W} height={H} fill="transparent" />
            <line x1={W / 2} y1={0} x2={W / 2} y2={H} stroke="rgba(217,37,75,0.08)" strokeDasharray="4,4" />
            <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="rgba(217,37,75,0.08)" strokeDasharray="4,4" />

            {/* IMAGE */}
            <DragBox id="image">
              <rect x={elems.image.x} y={elems.image.y} width={elems.image.w} height={elems.image.h} rx={24}
                fill="rgba(255,255,255,0.03)" stroke="rgba(217,37,75,0.15)" strokeDasharray="6,3" pointerEvents="none" />
              <text x={elems.image.x + elems.image.w / 2} y={elems.image.y + elems.image.h / 2 + 5}
                fontSize={10} fill="rgba(217,37,75,0.4)" textAnchor="middle" fontFamily="sans-serif" fontWeight="900" pointerEvents="none" style={{ letterSpacing: '2px' }}>PRODUTO</text>
            </DragBox>

            {/* BADGE */}
            <DragBox id="badge">
              {priceBadge.badgeImageUrl ? (
                <image href={priceBadge.badgeImageUrl} x={elems.badge.x} y={elems.badge.y} width={elems.badge.w} height={elems.badge.h} preserveAspectRatio="xMidYMid meet" pointerEvents="none" />
              ) : (
                <rect x={elems.badge.x} y={elems.badge.y} width={elems.badge.w} height={elems.badge.h} rx={priceBadge.borderRadius} fill={priceBadge.bgColor} pointerEvents="none" />
              )}
            </DragBox>

            {/* NAME */}
            <DragBox id="name">
              {descConfig.showBg && (
                <rect x={elems.name.x} y={elems.name.y} width={elems.name.w} height={elems.name.h} rx={8} fill={descConfig.bgColor} opacity={0.9} pointerEvents="none" />
              )}
              <text x={elems.name.x + elems.name.w / 2} y={elems.name.y + elems.name.h / 2 + descConfig.fontSize * 0.35}
                fontSize={descConfig.fontSize} fill={descConfig.color} fontWeight="800" textAnchor="middle" fontFamily={descConfig.fontFamily}
                style={descConfig.uppercase ? { textTransform: 'uppercase' } as any : {}} pointerEvents="none">
                Picanha Angus
              </text>
            </DragBox>

            {/* CURRENCY R$ */}
            <DragBox id="currency">
              <text x={elems.currency.x + elems.currency.w / 2} y={elems.currency.y + clampCurr}
                fontSize={clampCurr} fill={priceBadge.currencyColor} fontWeight="700" textAnchor="middle" fontFamily={priceBadge.currencyFontFamily} pointerEvents="none">
                R$
              </text>
            </DragBox>

            {/* VALUE */}
            <DragBox id="value">
              <text x={elems.value.x + elems.value.w / 2} y={elems.value.y + clampVal}
                fontSize={clampVal} fill={priceBadge.valueColor} fontWeight="900" textAnchor="middle" fontFamily={priceBadge.valueFontFamily} pointerEvents="none">
                10,99
              </text>
            </DragBox>

            {/* SUFFIX */}
            {priceBadge.showSuffix && priceBadge.suffixText && (
              <DragBox id="suffix">
                <text x={elems.suffix.x + elems.suffix.w / 2} y={elems.suffix.y + clampSuf}
                  fontSize={clampSuf} fill={priceBadge.suffixColor} fontWeight="600" textAnchor="middle" fontFamily={priceBadge.valueFontFamily} pointerEvents="none">
                  {priceBadge.suffixText}
                </text>
              </DragBox>
            )}
          </svg>
        </div>
      </div>
    </div>
  );
};

