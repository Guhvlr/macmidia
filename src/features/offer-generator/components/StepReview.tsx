import React, { useState } from 'react';
import { useOffer, ProductItem } from '../context/OfferContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Trash2, Layers, Search, PlusCircle, CheckCircle2, ChevronRight, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export const StepReview = () => {
  const { products, setProducts, setStep, slots, pageCount } = useOffer();
  const [bulkInput, setBulkInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [variations, setVariations] = useState<ProductItem[]>([]);
  const [showVariationsFor, setShowVariationsFor] = useState<string | null>(null);
  const [manualSearch, setManualSearch] = useState('');
  const [manualResults, setManualResults] = useState<ProductItem[]>([]);
  const [isSearchingManual, setIsSearchingManual] = useState(false);

  const getImageUrl = (ean: string) => {
    if (!ean || ean === 'N/A') return '';
    return `https://ebvvmddizsggrqasnnvv.supabase.co/storage/v1/object/public/product-images/${ean.replace(/[^a-zA-Z0-9]/g, '')}.png`;
  };

  const handleBulkSearch = async () => {
    if (!bulkInput.trim()) return;
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-products', { body: { bulkInput } });
      if (error) throw error;
      
      const results: ProductItem[] = (data.results || []).map((res: any) => {
        const found = !!(res.found && res.match);
        let cleanName = res.original || res.match?.name || 'Produto sem nome';
        // Remove patterns like " - 12,90", " R$ 12,90", " 12.90"
        cleanName = cleanName.replace(/\s*[-–—]\s*(R\$\s*)?\d+[,.]\d{2}/gi, '');
        cleanName = cleanName.replace(/\s+(R\$\s*)?\d+[,.]\d{2}/gi, '');
        cleanName = cleanName.trim();

        const item: ProductItem = {
          id: res.match?.id || `prod-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: cleanName,
          ean: res.match?.ean || 'N/A',
          price: 'R$ 10,99',
          images: found ? [getImageUrl(res.match.ean)] : [],
          brand: res.match?.brand,
          line: res.match?.line,
          category: res.match?.category
        };
        
        // Extract price from original text
        const m = (res.original || '').match(/(\d+[,.]\d{2})/);
        if (m) item.price = `R$ ${m[0].replace('.', ',')}`;
        
        return item;
      });

      setProducts(prev => [...prev, ...results]);
      setBulkInput('');
      toast.success(`${results.length} produtos localizados!`);
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
        const firstWord = product.name.split(' ')[0];
        if (firstWord.length < 3) {
          toast.error('Não foi possível identificar a marca.');
          setIsProcessing(false);
          return;
        }
        query = query.ilike('name', `%${firstWord}%`);
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
        return { ...p, images: [...p.images, imageUrl] };
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
              placeholder="Ex: Coca Cola 2L R$ 8.99\nMonster Mango R$ 9.99"
              className="bg-black/40 border-white/10 rounded-2xl min-h-[80px] text-sm resize-none custom-scrollbar p-4"
            />
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
             <h2 className="text-sm font-black uppercase tracking-tighter text-white/60 flex items-center gap-2">
               <CheckCircle2 className="w-4 h-4 text-green-500" /> Revisão de Produtos ({products.length})
             </h2>
             <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full">
               Total Telas: {Math.ceil(products.length / (slots.length || 1))}
             </span>
          </div>

          {products.map((p, idx) => (
            <div key={p.id} className="bg-[#121214] border border-white/5 rounded-2xl p-4 flex gap-6 items-center group hover:border-white/10 transition-all">
              <div className="w-6 text-[10px] font-black text-white/10">{idx + 1}</div>
              
              {/* Stack Preview */}
              <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
                {p.images.length === 0 ? (
                  <div className="w-16 h-16 bg-white/5 rounded-xl border border-dashed border-white/10 flex items-center justify-center">
                    <Trash2 className="w-4 h-4 text-white/10" />
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
                      <img src={img} className="w-full h-full object-contain p-1" />
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
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] font-mono text-white/20">{p.ean}</span>
                  <div className="w-px h-3 bg-white/10" />
                  <input value={p.price} onChange={e => {
                    const n = [...products]; n[idx].price = e.target.value; setProducts(n);
                  }} className="bg-transparent border-none p-0 text-red-500 font-black h-auto focus:ring-0 w-24 text-[11px]" />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button onClick={() => loadVariations(p)} variant="outline" className="h-9 px-4 bg-white/5 border-white/5 rounded-xl text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white group-hover:border-blue-500/30">
                  <Layers className="w-3.5 h-3.5 mr-2" /> Variações
                </Button>
                <Button onClick={() => handleManualImageUpload(p.id)} variant="outline" className="h-9 px-4 bg-white/5 border-white/5 rounded-xl text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white group-hover:border-green-500/30">
                  <PlusCircle className="w-3.5 h-3.5 mr-2" /> Add Foto
                </Button>
                <button onClick={() => setProducts(products.filter(x => x.id !== p.id))} className="p-2 text-white/10 hover:text-red-500 transition-colors">
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
                                       setProducts(prev => prev.map(old => old.id === p.id ? { ...old, ean: v.ean, name: v.name, images: [v.images[0]] } : old));
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
            </div>
          )}
        </div>
      </div>

      {/* Floating Action Bar */}
      {products.length > 0 && (
        <div className="p-6 bg-[#0d0d10] border-t border-white/5 flex items-center justify-center gap-4">
          <Button onClick={() => setStep(6)} className="px-12 h-14 bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-[0.2em] text-[11px] rounded-2xl shadow-[0_0_30px_rgba(217,37,75,0.2)] transition-all transform hover:scale-105 active:scale-95 group">
             Gerar Tabloide Agora <ChevronRight className="w-4 h-4 ml-3 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      )}
    </div>
  );
};
