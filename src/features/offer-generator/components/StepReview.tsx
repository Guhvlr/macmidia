import React, { useState } from 'react';
import { useOffer, ProductItem } from '../context/OfferContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Trash2, Layers, Search, PlusCircle, CheckCircle2, ChevronRight, X, Sparkles, AlertTriangle, ShieldCheck, ShieldAlert, ShieldX, Barcode, FileText, Crop, Undo2, CheckSquare, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ProductImageWithFormat } from './ProductImageWithFormat';

export const StepReview = () => {
  const { products, setProducts, setStep, slots, pageCount } = useOffer();
  const [bulkInput, setBulkInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [variations, setVariations] = useState<ProductItem[]>([]);
  const [showVariationsFor, setShowVariationsFor] = useState<string | null>(null);
  const [manualSearch, setManualSearch] = useState('');
  const [manualResults, setManualResults] = useState<ProductItem[]>([]);
  const [isSearchingManual, setIsSearchingManual] = useState(false);

  // Background Removal State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [imageFormats, setImageFormats] = useState<Record<string, string>>({});
  const [processingBg, setProcessingBg] = useState<Set<string>>(new Set());
  const [bgPreviews, setBgPreviews] = useState<Record<string, string>>({});
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});

  const handleFormatChange = (id: string, format: string) => {
    setImageFormats(prev => ({ ...prev, [id]: format }));
  };

  const handleSelectAll = () => {
    if (selectedIds.size === products.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(products.map(p => p.id)));
  };

  const handleSelectJpgs = () => {
    const jpgs = products.filter(p => imageFormats[p.id] === 'JPG').map(p => p.id);
    setSelectedIds(new Set(jpgs));
    if (jpgs.length > 0) toast.success(`${jpgs.length} imagens JPG selecionadas.`);
    else toast.info('Nenhuma imagem JPG encontrada na tela atual.');
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleRemoveBackground = async (ids: string[]) => {
    if (ids.length === 0) return;
    const newProcessing = new Set(processingBg);
    ids.forEach(id => newProcessing.add(id));
    setProcessingBg(newProcessing);

    const newPreviews = { ...bgPreviews };
    let successCount = 0;
    let failCount = 0;

    for (const id of ids) {
      const resolvedUrl = resolvedUrls[id];
      if (!product || !resolvedUrl) {
        failCount++;
        continue;
      }
      
      try {
        const { data, error } = await supabase.functions.invoke('remove-background', {
          body: { imageUrl: resolvedUrl }
        });
        if (error) throw error;
        if (data?.base64) {
          newPreviews[id] = data.base64;
          successCount++;
        } else {
          throw new Error('Retorno inválido da API Photoroom');
        }
      } catch (e: any) {
         console.error('Photoroom Error', e);
         failCount++;
      }
    }

    setBgPreviews(newPreviews);
    setProcessingBg(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.delete(id));
      return next;
    });

    if (successCount > 0) toast.success(`${successCount} fundos removidos com sucesso. Aprove a prévia para salvar.`);
    if (failCount > 0) toast.error(`${failCount} falharam ao remover fundo.`);
  };

  const handleApprovePreviews = async (ids: string[]) => {
    setProcessingBg(prev => new Set([...prev, ...ids]));
    let successCount = 0;

    for (const id of ids) {
      const preview = bgPreviews[id];
      const product = products.find(p => p.id === id);
      if (!preview || !product) continue;

      try {
        const cleanEan = product.ean.replace(/[^a-zA-Z0-9]/g, '');
        const res = await fetch(preview);
        const blob = await res.blob();
        
        const { error } = await supabase.storage
          .from('product-images')
          .upload(`${cleanEan}.png`, blob, { upsert: true, contentType: 'image/png' });
          
        if (error) throw error;
        
        // Remove from previews to show official PNG
        const newPreviews = { ...bgPreviews };
        delete newPreviews[id];
        setBgPreviews(newPreviews);
        
        // Update product to force re-render with new timestamp
        setProducts(prev => prev.map(p => p.id === id ? {
            ...p, images: [`https://ebvvmddizsggrqasnnvv.supabase.co/storage/v1/object/public/product-images/${cleanEan}.png?t=${Date.now()}`]
        } : p));
        
        successCount++;
      } catch (e: any) {
        toast.error(`Erro ao salvar ${product.name}: ${e.message}`);
      }
    }

    setProcessingBg(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.delete(id));
      return next;
    });
    
    if (successCount > 0) toast.success(`${successCount} imagens salvas como oficiais no banco!`);
  };

  const handleRestoreOriginals = async (ids: string[]) => {
    setProcessingBg(prev => new Set([...prev, ...ids]));
    let successCount = 0;

    for (const id of ids) {
      const product = products.find(p => p.id === id);
      if (!product) continue;
      
      const preview = bgPreviews[id];
      if (preview) {
        // Just cancel preview
        const newPreviews = { ...bgPreviews };
        delete newPreviews[id];
        setBgPreviews(newPreviews);
        successCount++;
        continue;
      }

      // Or delete .png to restore .jpg
      try {
        const cleanEan = product.ean.replace(/[^a-zA-Z0-9]/g, '');
        const { error } = await supabase.storage.from('product-images').remove([`${cleanEan}.png`]);
        if (error) throw error;
        
        setProducts(prev => prev.map(p => p.id === id ? {
            ...p, images: [`https://ebvvmddizsggrqasnnvv.supabase.co/storage/v1/object/public/product-images/${cleanEan}.png?t=${Date.now()}`]
        } : p));
        successCount++;
      } catch (e: any) {
        toast.error(`Falha ao restaurar: ${e.message}`);
      }
    }

    setProcessingBg(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.delete(id));
      return next;
    });
    
    if (successCount > 0) toast.info(`${successCount} imagens restauradas.`);
  };

  const getImageUrl = (ean: string) => {
    if (!ean || ean === 'N/A') return '';
    return `https://ebvvmddizsggrqasnnvv.supabase.co/storage/v1/object/public/product-images/${ean.replace(/[^a-zA-Z0-9]/g, '')}.png?t=${Date.now()}`;
  };

  // ═══════════════════════════════════════════
  // BULK SEARCH — V2 Dual-Mode Engine
  // ═══════════════════════════════════════════
  const handleBulkSearch = async () => {
    if (!bulkInput.trim()) return;
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-products', { body: { bulkInput } });
      if (error) throw error;
      
      const results: ProductItem[] = (data.results || []).map((res: any) => {
        const found = !!(res.found && res.match);
        let isBarcode = res.mode === 'barcode';
        
        // Verifica se a primeira "palavra" digitada é puramente numérica (mesmo se for um código pequeno como 102116)
        const firstWord = (res.original || '').trim().split(/\s+/)[0];
        if (/^\d+$/.test(firstWord)) {
          isBarcode = true;
        }

        const confidence = res.confidence || 'none';
        
        // ── DISPLAY NAME ──
        // Barcode mode: use DB name (official)
        // Description mode: use user's exact text (NEVER alter)
        let displayName = res.display_name || res.original || 'Produto sem nome';
        // Clean any residual price strings from display_name
        displayName = displayName.replace(/\s*[-–—]\s*(R\$\s*)?\d+[,.]\d{2}/gi, '');
        displayName = displayName.replace(/\s+(R\$\s*)?\d+[,.]\d{2}/gi, '');
        displayName = displayName.trim();

        // ── EAN LOGIC ──
        let extractedEan = res.match?.ean;
        if (!extractedEan && isBarcode) {
          // Força o código ser a primeira palavra numérica encontrada
          extractedEan = firstWord;
        }

        // ── IMAGE LOGIC ──
        // Barcode mode (exact): always use image if found
        // Description mode: only use image if confidence is HIGH or MEDIUM
        let images: string[] = [];
        if (found) {
          if (isBarcode || confidence === 'exact' || confidence === 'high' || confidence === 'medium') {
            images = [getImageUrl(res.match.ean)];
          }
          // low/none → NO image (better empty than wrong)
        } else if (isBarcode && extractedEan) {
          // Tenta puxar a imagem do bucket usando o código digitado
          images = [getImageUrl(extractedEan)];
        }

        let price = 'R$ 0,00';
        if (res.price) {
          price = `R$ ${String(res.price).replace('.', ',')}`;
        } else {
          // Fallback: extract from original text
          const m = (res.original || '').match(/(\d+[,.]\d{2})/);
          if (m) price = `R$ ${m[0].replace('.', ',')}`;
        }

        // ── SUFFIX ──
        let suffix = 'cada';
        const originalLower = (res.original || '').toLowerCase();
        if (originalLower.match(/\b(kg|kilo|kilos)\b/i)) {
          suffix = 'KG';
        } else if (originalLower.match(/\b(cada|unidade|unid|uni|un)\b/i)) {
          suffix = 'cada';
        }

        return {
          id: res.match?.id || `prod-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: displayName,
          ean: extractedEan || 'N/A',
          price,
          suffix,
          images,
          brand: res.match?.brand,
          line: res.match?.line,
          category: res.match?.category,
          confidence,
          confidence_reason: res.confidence_reason,
          warning: res.warning,
          mode: res.mode || 'description',
        } as ProductItem;
      });

      // Stats for toast
      const exact = results.filter(r => r.confidence === 'exact').length;
      const high = results.filter(r => r.confidence === 'high').length;
      const withImage = results.filter(r => r.images.length > 0).length;
      const noImage = results.length - withImage;

      setProducts(prev => [...prev, ...results]);
      setBulkInput('');
      
      let msg = `${results.length} produtos processados!`;
      if (exact > 0) msg += ` • ${exact} exatos`;
      if (high > 0) msg += ` • ${high} alta confiança`;
      if (noImage > 0) msg += ` • ${noImage} sem imagem`;
      toast.success(msg);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const loadVariations = async (product: ProductItem) => {
    setIsProcessing(true);
    try {
      let query = (supabase.from('products') as any).select('*');
      if (product.brand && product.line) {
        query = query.eq('brand', product.brand).eq('line', product.line);
      } else {
        // Split and filter common words (like "Leite", "Arroz") to find the BRAND
        const words = product.name.split(' ').filter(w => w.length > 3);
        const searchTerm = words[0] || product.name.split(' ')[0];
        
        if (searchTerm.length < 3) {
          toast.error('Nome muito curto para busca inteligente.');
          setIsProcessing(false);
          return;
        }
        query = query.ilike('name', `%${searchTerm}%`);
      }

      const { data, error } = await query.neq('ean', product.ean).limit(15);
      if (error) throw error;

      setVariations((data || []).map(v => ({
        id: `var-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ean: v.ean,
        name: v.name,
        images: [getImageUrl(v.ean)],
        price: product.price,
        brand: v.brand,
        line: v.line
      })));
      setShowVariationsFor(product.id);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualSearch = async (term: string, currentProduct: ProductItem) => {
    setManualSearch(term);
    if (term.length < 3) {
      setManualResults([]);
      return;
    }

    setIsSearchingManual(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .or(`name.ilike.%${term}%,ean.ilike.%${term}%`)
        .limit(10);

      if (error) throw error;
      setManualResults((data || []).map(v => ({
        id: `man-${Date.now()}-${Math.random()}`,
        ean: v.ean,
        name: v.name,
        images: [getImageUrl(v.ean)],
        price: currentProduct.price,
        brand: v.brand,
        line: v.line
      })));
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearchingManual(false);
    }
  };

  const addVariation = (productId: string, imageUrl: string) => {
    setProducts(prev => prev.map(p => {
      if (p.id === productId) {
        if (p.images.includes(imageUrl)) return p;
        return { ...p, images: [...p.images, imageUrl], confidence: 'high' as const, warning: undefined };
      }
      return p;
    }));
    toast.success('Variação adicionada ao conjunto!');
  };

  const removeVariation = (productId: string, imgIndex: number) => {
    setProducts(prev => prev.map(p => {
      if (p.id === productId) {
        const newImgs = p.images.filter((_, i) => i !== imgIndex);
        return { ...p, images: newImgs };
      }
      return p;
    }));
  };

  const handleManualImageUpload = (productId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const url = URL.createObjectURL(file);
        addVariation(productId, url);
      }
    };
    input.click();
  };

  // ── Confidence badge renderer ──
  const ConfidenceBadge = ({ product }: { product: ProductItem }) => {
    const c = product.confidence;
    if (c === 'exact') return (
      <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest bg-green-500/15 text-green-400 px-2 py-0.5 rounded-full border border-green-500/20">
        <ShieldCheck className="w-2.5 h-2.5" /> EXATO
      </span>
    );
    if (c === 'high') return (
      <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full border border-green-500/20">
        <ShieldCheck className="w-2.5 h-2.5" /> ALTA
      </span>
    );
    if (c === 'medium') return (
      <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20">
        <ShieldAlert className="w-2.5 h-2.5" /> MÉDIA
      </span>
    );
    if (c === 'low') return (
      <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full border border-red-500/20">
        <ShieldX className="w-2.5 h-2.5" /> BAIXA
      </span>
    );
    return (
      <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest bg-white/5 text-white/30 px-2 py-0.5 rounded-full border border-white/10">
        <AlertTriangle className="w-2.5 h-2.5" /> SEM IMAGEM
      </span>
    );
  };

  return (
    <div className="h-full flex flex-col bg-[#09090b]">
      {/* Top Search Area */}
      <div className="p-8 border-b border-white/5 bg-[#0d0d10]">
        <div className="max-w-5xl mx-auto flex gap-6">
          <div className="flex-1">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 block mb-3">Entrada de Produtos do Cliente</label>
            <Textarea 
              value={bulkInput} 
              onChange={e => setBulkInput(e.target.value)}
              placeholder={"Ex: Coca Cola 2L R$ 8.99\nMonster Mango R$ 9.99\n\nOu por código de barras:\n7896004400913 R$ 5.99"}
              className="bg-black/40 border-white/10 rounded-2xl min-h-[100px] text-sm resize-none custom-scrollbar p-4"
            />
            <div className="flex gap-3 mt-2">
              <span className="flex items-center gap-1.5 text-[9px] text-white/20 font-bold uppercase">
                <FileText className="w-3 h-3" /> Descrição + Preço
              </span>
              <span className="text-white/10">•</span>
              <span className="flex items-center gap-1.5 text-[9px] text-white/20 font-bold uppercase">
                <Barcode className="w-3 h-3" /> Código de Barras + Preço
              </span>
            </div>
          </div>
          <div className="w-[200px] flex flex-col justify-end">
            <Button onClick={handleBulkSearch} disabled={isProcessing || !bulkInput.trim()} className="h-14 bg-red-600 hover:bg-red-700 rounded-2xl font-black uppercase tracking-widest text-[10px]">
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
              Localizar Itens
            </Button>
          </div>
        </div>
      </div>

      {/* Manual Review List */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="flex items-center justify-between mb-4">
             <div className="flex items-center gap-3">
               <Button onClick={handleSelectAll} variant="outline" className={`h-8 px-3 rounded-full text-[10px] font-black uppercase tracking-widest ${selectedIds.size === products.length && products.length > 0 ? 'bg-primary border-primary text-white' : 'bg-white/5 border-white/5 text-white/40 hover:text-white'}`}>
                 {selectedIds.size === products.length && products.length > 0 ? <CheckSquare className="w-3.5 h-3.5 mr-1" /> : <div className="w-3.5 h-3.5 mr-1 border-2 border-current rounded-sm opacity-50" />}
                 Todos
               </Button>
               <Button onClick={handleSelectJpgs} variant="outline" className="h-8 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border-amber-500/20 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors">
                 <ImageIcon className="w-3.5 h-3.5 mr-1" /> Filtrar apenas JPG
               </Button>
               
               <h2 className="ml-2 text-sm font-black uppercase tracking-tighter text-white/60 flex items-center gap-2">
                 <CheckCircle2 className="w-4 h-4 text-green-500" /> Revisão ({products.length})
               </h2>
             </div>
             
             <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full">
               Total Telas: {Math.ceil(products.length / (slots.length || 1))}
             </span>
          </div>

          {products.map((p, idx) => (
            <div key={p.id} className={`bg-[#121214] border rounded-2xl p-4 flex gap-4 items-center group transition-all relative ${
              p.warning ? 'border-amber-500/20' : selectedIds.has(p.id) ? 'border-primary/50 bg-primary/5 shadow-[0_0_20px_rgba(217,37,75,0.1)]' : 'border-white/5 hover:border-white/10'
            }`}>
              {/* Checkbox Overlay */}
              <div 
                className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer transition-colors border ${selectedIds.has(p.id) ? 'bg-primary border-primary text-white' : 'border-white/20 bg-white/5 text-transparent hover:border-white/40'}`}
                onClick={() => toggleSelect(p.id)}
              >
                <CheckSquare className="w-4 h-4" />
              </div>
              <div className="w-4 text-[10px] font-black text-white/10 text-center">{idx + 1}</div>
              
              {/* Stack Preview / No Image Placeholder */}
              <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
                {processingBg.has(p.id) ? (
                  <div className="w-full h-full bg-white/5 rounded-xl border border-white/10 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                  </div>
                ) : p.images.length === 0 ? (
                  <div className="w-16 h-16 bg-white/5 rounded-xl border border-dashed border-white/10 flex flex-col items-center justify-center gap-1">
                    <AlertTriangle className="w-4 h-4 text-amber-500/40" />
                    <span className="text-[6px] font-bold text-white/15 uppercase">Sem foto</span>
                  </div>
                ) : (
                  p.images.slice(0, 3).map((img, i) => (
                    <div key={i} className="absolute transition-transform bg-[#09090b] rounded-xl border border-white/10 shadow-xl overflow-hidden"
                      style={{ 
                        width: '64px', height: '64px',
                        transform: `translateX(${i * 8}px) translateY(${-i * 4}px)`,
                        zIndex: 10 - i,
                        opacity: 1 - i * 0.2
                      }}>
                      <ProductImageWithFormat 
                        src={img} 
                        previewBase64={i === 0 ? bgPreviews[p.id] : undefined}
                        onFormatChange={(fmt) => { if(i === 0) handleFormatChange(p.id, fmt); }}
                        onUrlResolved={(url) => { if(i === 0) setResolvedUrls(prev => ({ ...prev, [p.id]: url })); }}
                      />
                    </div>
                  ))
                )}
                {p.images.length > 3 && (
                  <div className="absolute right-0 bottom-0 bg-primary rounded-full w-5 h-5 flex items-center justify-center text-[9px] font-black z-20 border-2 border-[#121214]">
                    +{p.images.length - 3}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <Input value={p.name} onChange={e => {
                  const n = [...products]; n[idx].name = e.target.value; setProducts(n);
                }} className="bg-transparent border-none p-0 text-sm font-black uppercase tracking-tight h-auto focus:ring-0 text-white" />
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-[10px] font-mono text-white/20">{p.ean}</span>
                  <div className="w-px h-3 bg-white/10" />
                  <input value={p.price} onChange={e => {
                    const n = [...products]; n[idx].price = e.target.value; setProducts(n);
                  }} className="bg-transparent border-none p-0 text-red-500 font-black h-auto focus:ring-0 w-24 text-[11px]" />
                  <div className="w-px h-3 bg-white/10" />
                  
                  <select value={p.suffix || 'cada'} onChange={e => {
                    const n = [...products]; n[idx].suffix = e.target.value; setProducts(n);
                  }} className="bg-white/5 border border-white/10 rounded h-6 px-2 py-0 text-[10px] text-white/60 font-bold outline-none cursor-pointer hover:bg-white/10 transition-colors">
                    <option value="cada" className="bg-[#0d0d10]">CADA</option>
                    <option value="KG" className="bg-[#0d0d10]">KG</option>
                  </select>
                  <div className="w-px h-3 bg-white/10" />
                  <ConfidenceBadge product={p} />
                  {p.mode && (
                    <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded border ${
                      p.mode === 'barcode' 
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' 
                        : 'bg-white/5 text-white/25 border-white/10'
                    }`}>
                      {p.mode === 'barcode' ? 'EAN' : 'DESC'}
                    </span>
                  )}
                </div>
                {/* Warning message */}
                {p.warning && (
                  <p className="text-[9px] text-amber-400/70 mt-1 flex items-center gap-1 font-bold">
                    <AlertTriangle className="w-3 h-3 shrink-0" /> {p.warning}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {imageFormats[p.id] === 'JPG' && !bgPreviews[p.id] && (
                  <Button onClick={() => handleRemoveBackground([p.id])} disabled={processingBg.has(p.id)} variant="outline" className="h-9 px-3 bg-purple-500/10 border-purple-500/20 text-purple-400 hover:bg-purple-500/20 rounded-xl text-[9px] font-black uppercase">
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Remover Fundo
                  </Button>
                )}
                {bgPreviews[p.id] && (
                  <div className="flex items-center gap-1">
                    <Button onClick={() => handleApprovePreviews([p.id])} disabled={processingBg.has(p.id)} className="h-9 px-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-[9px] font-black uppercase">
                       Aprovar
                    </Button>
                    <Button onClick={() => handleRestoreOriginals([p.id])} disabled={processingBg.has(p.id)} variant="outline" className="h-9 w-9 p-0 bg-white/5 border-white/10 text-white/40 hover:text-white rounded-xl">
                       <Undo2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                <Button onClick={() => loadVariations(p)} variant="outline" className="h-9 px-3 bg-white/5 border-white/5 rounded-xl text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white group-hover:border-blue-500/30">
                  <Layers className="w-3.5 h-3.5 mr-2" /> Variações
                </Button>
                <Button onClick={() => handleManualImageUpload(p.id)} variant="outline" className="h-9 px-3 bg-white/5 border-white/5 rounded-xl text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white group-hover:border-green-500/30">
                  <PlusCircle className="w-3.5 h-3.5 mr-2" /> Add Foto
                </Button>
                <button onClick={() => setProducts(products.filter(x => x.id !== p.id))} className="p-2 ml-2 text-white/10 hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Variations UI specific to item */}
              {showVariationsFor === p.id && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                  <div className="bg-[#121214] border border-white/10 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                    <div className="p-6 border-b border-white/5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-black uppercase tracking-widest text-white">Gerenciar Variações</h3>
                          <p className="text-[10px] text-white/40 font-bold uppercase">{p.name}</p>
                        </div>
                        <button onClick={() => { setShowVariationsFor(null); setManualSearch(''); setManualResults([]); }} className="bg-white/5 p-2 rounded-xl text-white/40 hover:text-white">
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Manual Search Input */}
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                        <Input 
                          value={manualSearch}
                          onChange={e => handleManualSearch(e.target.value, p)}
                          placeholder="Pesquisar outra variação no banco (nome ou EAN)..."
                          className="bg-black/40 border-white/10 pl-12 h-12 rounded-xl text-xs placeholder:text-white/10"
                        />
                        {isSearchingManual && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />}
                      </div>
                    </div>
                    
                    <div className="p-6 overflow-y-auto custom-scrollbar" style={{ maxHeight: '60vh' }}>
                      {/* Manual Search Results */}
                      {manualResults.length > 0 && (
                        <div className="mb-8 animate-in fade-in slide-in-from-top-2">
                           <h4 className="text-[9px] font-black uppercase tracking-widest text-blue-500 mb-4 flex items-center gap-2">
                             <Search className="w-3 h-3" /> Resultados da Pesquisa Manual
                           </h4>
                           <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                              {manualResults.map(v => (
                                <div key={v.ean} className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-3 flex flex-col items-center gap-2 group relative">
                                  <img src={v.images[0]} className="w-full h-20 object-contain group-hover:scale-110 transition-transform" />
                                  <p className="text-[9px] font-bold text-center text-white/60 truncate w-full uppercase">{v.name}</p>
                                  <div className="flex gap-1 mt-2">
                                     <Button onClick={() => {
                                       setProducts(prev => prev.map(old => old.id === p.id ? { ...old, ean: v.ean, name: v.name, images: [v.images[0]], confidence: 'high' as const, warning: undefined } : old));
                                       setShowVariationsFor(null);
                                       toast.success('Produto substituído!');
                                     }} className="h-7 px-3 bg-blue-600 hover:bg-blue-700 text-[8px] font-black uppercase">Substituir</Button>
                                     <Button onClick={() => addVariation(p.id, v.images[0])} className="h-7 px-3 bg-white/10 hover:bg-white/20 text-[8px] font-black uppercase">Pilha</Button>
                                  </div>
                                </div>
                              ))}
                           </div>
                        </div>
                      )}

                      {/* Automatic Suggestions */}
                      <h4 className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-4 flex items-center gap-2">
                        <Sparkles className="w-3 h-3" /> Sugestões Inteligentes (Marca/Linha)
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {/* Current Images in stack */}
                        {p.images.map((img, i) => (
                          <div key={`cur-${i}`} className="relative bg-primary/10 border-2 border-primary/40 rounded-2xl p-3 flex flex-col items-center gap-2 group">
                            <img src={img} className="w-full h-20 object-contain" />
                            <span className="text-[8px] font-black uppercase text-primary">Na Pilha atual</span>
                            <button onClick={() => removeVariation(p.id, i)} className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}

                        {/* Suggestions */}
                        {variations.length > 0 ? variations.map(v => (
                          <div key={v.ean} onClick={() => addVariation(p.id, v.images[0])} 
                            className="bg-white/[0.02] border border-white/5 rounded-2xl p-3 flex flex-col items-center gap-2 hover:border-blue-500/50 cursor-pointer transition-all group">
                            <img src={v.images[0]} className="w-full h-20 object-contain group-hover:scale-110 transition-transform" />
                            <p className="text-[9px] font-bold text-center text-white/60 truncate w-full uppercase">{v.name}</p>
                          </div>
                        )) : !isSearchingManual && manualResults.length === 0 && (
                          <div className="col-span-full py-8 text-center text-white/20 text-[10px] uppercase font-bold tracking-widest italic">
                            Nenhuma sugestão automática encontrada
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-4 bg-black/40 border-t border-white/5 flex justify-end">
                      <Button onClick={() => { setShowVariationsFor(null); setManualSearch(''); setManualResults([]); }} className="bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest">Fechar</Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {products.length === 0 && (
            <div className="py-20 text-center bg-[#121214] border-2 border-dashed border-white/5 rounded-[2rem]">
              <div className="w-16 h-16 bg-red-600/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Search className="w-8 h-8 text-red-600" />
              </div>
              <p className="text-white/30 text-xs italic">Nenhum produto selecionado para revisão.</p>
              <p className="text-white/15 text-[10px] mt-2 uppercase font-bold tracking-widest">
                Aceita descrição + preço ou código de barras + preço
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Floating Action Bar */}
      {selectedIds.size > 0 ? (
        <div className="p-4 bg-black/80 backdrop-blur-md border-t border-white/10 flex items-center justify-between shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-50">
          <div className="flex items-center gap-4 pl-4">
            <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-black text-xs">
              {selectedIds.size}
            </div>
            <span className="text-[11px] font-bold tracking-widest uppercase text-white/60">Itens Selecionados</span>
          </div>
          <div className="flex items-center gap-3 pr-4">
            <Button onClick={() => handleRemoveBackground(Array.from(selectedIds))} variant="outline" className="h-12 border-purple-500/40 text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 font-black uppercase tracking-widest rounded-xl text-[10px]">
              <Sparkles className="w-4 h-4 mr-2" /> Recortar Fundo em Lote
            </Button>
            <Button onClick={() => handleApprovePreviews(Array.from(selectedIds))} className="h-12 bg-green-600 hover:bg-green-700 text-white font-black uppercase tracking-widest rounded-xl text-[10px]">
              <CheckSquare className="w-4 h-4 mr-2" /> Aprovar Lote
            </Button>
            <Button onClick={() => handleRestoreOriginals(Array.from(selectedIds))} variant="outline" className="h-12 border-white/10 text-white/40 hover:text-white bg-white/5 font-black uppercase tracking-widest rounded-xl text-[10px]">
              <Undo2 className="w-4 h-4 mr-2" /> Restaurar Originais
            </Button>
          </div>
        </div>
      ) : products.length > 0 ? (
        <div className="p-6 bg-[#0d0d10] border-t border-white/5 flex items-center justify-center gap-4">
          <Button onClick={() => setStep(6)} className="px-12 h-14 bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-[0.2em] text-[11px] rounded-2xl shadow-[0_0_30px_rgba(217,37,75,0.2)] transition-all transform hover:scale-105 active:scale-95 group">
             Gerar Tabloide Agora <ChevronRight className="w-4 h-4 ml-3 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      ) : null}
    </div>
  );
};
