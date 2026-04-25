import React, { useState } from 'react';
import { useOffer, ProductItem } from '../context/OfferContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Trash2, Search, PlusCircle, CheckCircle2, ChevronRight, X, AlertTriangle, Barcode, FileText, Crop, Undo2, CheckSquare, Image as ImageIcon, ZoomIn, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ProductImageWithFormat } from './ProductImageWithFormat';
import { padEan, getImageUrl } from '@/lib/ean';
import { ReviewCard } from './review/ReviewCard';
import { BulkSearchArea } from './review/BulkSearchArea';
import { ConfidenceBadge } from './review/ConfidenceBadge';
import { FirstUseTour } from './review/FirstUseTour';

export const StepReview = () => {
  const { products, setProducts, removeProducts, pushHistory, slots } = useOffer();
  const [bulkInput, setBulkInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [variations, setVariations] = useState<ProductItem[]>([]);
  const [showVariationsFor, setShowVariationsFor] = useState<string | null>(null);
  const [manualSearch, setManualSearch] = useState('');
  const [manualResults, setManualResults] = useState<ProductItem[]>([]);
  const [isSearchingManual, setIsSearchingManual] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [loadingVariationsId, setLoadingVariationsId] = useState<string | null>(null);

  // Manual Create State
  const [creatingProductFor, setCreatingProductFor] = useState<string | null>(null);
  const [createData, setCreateData] = useState({ name: '', ean: '', file: null as File | null });
  const [isCreating, setIsCreating] = useState(false);

  // Variation Create State (inside Variations modal)
  const [showVariationCreate, setShowVariationCreate] = useState(false);
  const [variationCreateData, setVariationCreateData] = useState({ name: '', ean: '', file: null as File | null });
  const [isCreatingVariation, setIsCreatingVariation] = useState(false);

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

    let successCount = 0;
    let failCount = 0;
    const chunkSize = 3; // Processar 3 por vez para equilíbrio entre velocidade e estabilidade

    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      
      await Promise.all(chunk.map(async (id) => {
        const resolvedUrl = resolvedUrls[id];
        if (!resolvedUrl) {
          failCount++;
          return;
        }
        
        try {
          const { data, error } = await supabase.functions.invoke('remove-background', {
            body: { imageUrl: resolvedUrl }
          });
          
          if (error) {
            // Error from Supabase Invoke
            const errorBody = await error.context?.json().catch(() => ({}));
            throw new Error(errorBody?.error || error.message || 'Erro desconhecido na Edge Function');
          }

          if (data?.base64) {
            setBgPreviews(prev => ({ ...prev, [id]: data.base64 }));
            successCount++;
          } else {
            throw new Error(data?.error || 'Retorno inválido da API Photoroom');
          }
        } catch (e: any) {
          console.error('Photoroom Error', e);
          toast.error(`Falha em um item: ${e.message}`);
          failCount++;
        }
      }));
    }

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
        setBgPreviews(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        
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
        setBgPreviews(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
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


  // ═══════════════════════════════════════════
  // BULK SEARCH — V2 Dual-Mode Engine
  // ═══════════════════════════════════════════
  const handleBulkSearch = async () => {
    if (!bulkInput.trim()) return;
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-products', { body: { bulkInput } });
      if (error) throw error;
      
      const results: ProductItem[] = (data.results || []).map((res: any, idx: number) => {
        const found = !!(res.found && res.match);
        let isBarcode = res.mode === 'barcode';
        
        // Verifica se a primeira "palavra" digitada é um código EAN de 13 dígitos
        const firstWord = (res.original || '').trim().split(/\s+/)[0];
        if (/^\d{13}$/.test(firstWord)) {
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
        // O usuário quer "cair automático", então carregamos a foto para QUALQUER match encontrado
        // marcando apenas com banner visual se for baixa confiança.
        let images: string[] = [];
        if (found) {
          // Carregar sempre se houver um EAN no match
          if (res.match.ean) {
            images = [getImageUrl(res.match.ean)];
          }
        } else if (isBarcode && extractedEan) {
          images = [getImageUrl(extractedEan)];
        }

        let price = 'R$ 0,00';
        if (res.price) {
          price = `R$ ${String(res.price).replace('.', ',')}`;
        } else {
          // Fallback: extração ultra-tolerante do texto original
          // Procura pelo último número que se pareça com preço (X.XX ou X,XX)
          const priceMatches = [...(res.original || '').matchAll(/(?:R\$\s*)?(\d+[,.]\d{2})/gi)];
          if (priceMatches.length > 0) {
             price = `R$ ${priceMatches[priceMatches.length - 1][1].replace('.', ',')}`;
          }
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
          id: res.match?.id || `nf-${(res.original || '').toLowerCase().replace(/[^a-z0-9]/g, '-')}-${idx}`,
          name: displayName,
          ean: extractedEan || (isBarcode ? firstWord : 'N/A'),
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
    setLoadingVariationsId(product.id);
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
          setLoadingVariationsId(null);
          return;
        }
        query = query.ilike('name', `%${searchTerm}%`);
      }

      const { data, error } = await query.neq('ean', product.ean).limit(15);
      if (error) throw error;

      setVariations((data || []).map(v => {
        let imageUrl = '';
        if (v.image_path) {
          imageUrl = `https://ebvvmddizsggrqasnnvv.supabase.co/storage/v1/object/public/product-images/${v.image_path}`;
        } else {
          imageUrl = getImageUrl(v.ean);
        }

        return {
          id: `var-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          ean: v.ean,
          name: v.name,
          images: [imageUrl],
          price: product.price,
          brand: v.brand,
          line: v.line
        };
      }));
      setShowVariationsFor(product.id);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsProcessing(false);
      setLoadingVariationsId(null);
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
      setManualResults((data || []).map(v => {
        let imageUrl = '';
        if (v.image_path) {
          imageUrl = `https://ebvvmddizsggrqasnnvv.supabase.co/storage/v1/object/public/product-images/${v.image_path}`;
        } else {
          imageUrl = getImageUrl(v.ean);
        }

        return {
          id: `man-${Date.now()}-${Math.random()}`,
          ean: v.ean,
          name: v.name,
          images: [imageUrl],
          price: currentProduct.price,
          brand: v.brand,
          line: v.line
        };
      }));
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

  const handleCreateVariation = async (parentProductId: string) => {
    const parentProduct = products.find(p => p.id === parentProductId);
    if (!variationCreateData.name || !variationCreateData.ean || !variationCreateData.file) {
      toast.error('Preencha nome, EAN e selecione uma imagem.');
      return;
    }

    setIsCreatingVariation(true);
    const toastId = toast.loading('Cadastrando variação...');

    try {
      const ext = variationCreateData.file.name.split('.').pop()?.toLowerCase();
      const rawEan = variationCreateData.ean.replace(/[^0-9]/g, '');
      const cleanEan = padEan(rawEan);
      const fileName = `${cleanEan}.${ext === 'png' ? 'png' : 'jpg'}`;

      // 1. Upload image
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, variationCreateData.file, { upsert: true, contentType: variationCreateData.file.type });

      if (uploadError) throw uploadError;

      // 2. Register in DB
      const { error: dbError } = await supabase.from('products').upsert({
        ean: cleanEan,
        name: variationCreateData.name.toUpperCase(),
        brand: parentProduct?.brand,
        line: parentProduct?.line,
        category: parentProduct?.category,
        image_path: fileName
      }, { onConflict: 'ean' });

      if (dbError) {
        console.error('DB Error:', dbError);
        toast.error('Variação salva no storage, mas houve erro ao registrar no banco: ' + dbError.message);
      }

      // 3. Add as variation to the product stack
      // Construction uses padEan and the correct extension
      const publicUrl = `https://ebvvmddizsggrqasnnvv.supabase.co/storage/v1/object/public/product-images/${fileName}?t=${Date.now()}`;
      addVariation(parentProductId, publicUrl);

      toast.success('Variação cadastrada e adicionada à pilha!', { id: toastId });
      setVariationCreateData({ name: '', ean: '', file: null });
      setShowVariationCreate(false);
    } catch (e: any) {
      toast.error(`Falha ao cadastrar: ${e.message}`, { id: toastId });
    } finally {
      setIsCreatingVariation(false);
    }
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

  const handleOfficialImageUpload = async (productId: string, file: File) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    let rawEan = product.ean.replace(/[^0-9]/g, '');
    let ean = padEan(rawEan);

    if (!ean || ean === '0000000000000' || ean === 'NA') {
      toast.error('Este produto não tem um EAN válido para associar a imagem.');
      return;
    }

    try {
      setProcessingBg(prev => new Set([...prev, productId]));
      const toastId = toast.loading('Fazendo upload da imagem oficial...');

      const ext = file.name.split('.').pop()?.toLowerCase();
      // Sempre salvar como .png ou .jpg baseado no arquivo, mas preferencialmente .png se for fundo removido futuramente
      const fileName = `${ean}.${ext === 'png' ? 'png' : 'jpg'}`;

      // 1. Upload para Storage
      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, { upsert: true, contentType: file.type });

      if (error) throw error;

      // 2. Sincronizar com Tabela de Produtos (Permanente)
      const { error: dbError } = await supabase.from('products').upsert({
        ean: ean,
        name: product.name.toUpperCase(),
        image_path: fileName
      }, { onConflict: 'ean' });

      if (dbError) {
        console.error('Erro ao sincronizar produto no banco:', dbError);
        toast.error('Erro ao salvar no banco: ' + dbError.message);
      }

      toast.success('Imagem salva e vinculada ao código com sucesso!', { id: toastId });

      const publicUrl = `https://ebvvmddizsggrqasnnvv.supabase.co/storage/v1/object/public/product-images/${fileName}?t=${Date.now()}`;
      
      setProducts(prev => prev.map(p => {
        if (p.id === productId) {
           return { ...p, ean, images: [publicUrl, ...p.images], confidence: 'high' as const, warning: undefined };
        }
        return p;
      }));
    } catch (e: any) {
      toast.error(`Falha no upload: ${e.message}`);
    } finally {
      setProcessingBg(prev => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
    }
  };

  const handleManualImageUpload = (id: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      const p = products.find(x => x.id === id);
      if (!p) return;

      const toastId = toast.loading('Processando imagem...');
      try {
        // Se tiver qualquer código numérico, tentamos salvar como oficial para vincular no banco
        const cleanEan = p.ean?.replace(/[^0-9]/g, '');
        if (cleanEan && cleanEan !== '' && cleanEan !== '0' && p.ean !== 'N/A' && p.ean !== 'NA') {
          await handleOfficialImageUpload(id, file);
          toast.dismiss(toastId);
          return;
        }

        // Caso contrário, upload genérico apenas para esta oferta
        const fileExt = file.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `product-manual/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(filePath);

        setProducts(prev => prev.map(old => old.id === id ? { ...old, images: [publicUrl, ...old.images] } : old));
        toast.success('Foto adicionada à oferta!', { id: toastId });
      } catch (err: any) {
        toast.error('Erro no upload: ' + err.message, { id: toastId });
      }
    };
    input.click();
  };

  const toggleSuffix = (id: string) => {
    setProducts(prev => prev.map(p => {
      if (p.id === id) {
        return { ...p, suffix: p.suffix === 'KG' ? 'cada' : 'KG' };
      }
      return p;
    }));
  };
  
  const handleUpdateProduct = async (id: string, updates: Partial<ProductItem>, saveToDb: boolean = false) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    
    if (saveToDb) {
      const product = products.find(p => p.id === id);
      if (product && updates.ean && updates.name) {
        const cleanEan = updates.ean.replace(/[^0-9]/g, '');
        if (cleanEan && cleanEan !== '0000000000000') {
          const { error } = await supabase.from('products').upsert({
            ean: cleanEan,
            name: updates.name.toUpperCase(),
            price: updates.price ? parseFloat(updates.price.replace(/[^\d,]/g, '').replace(',', '.')) : null
          }, { onConflict: 'ean' });
          
          if (error) {
            toast.error('Erro ao salvar no banco: ' + error.message);
            return;
          }
          toast.success('Produto salvo no banco de dados!');
          return;
        }
      }
      toast.error('EAN inválido para salvar no banco.');
      return;
    }
    
    toast.success('Produto atualizado localmente!');
  };

  const handleCreateProduct = async (productId: string) => {
    if (!createData.name || !createData.ean || !createData.file) {
      toast.error('Preencha a descrição, EAN e selecione uma imagem.');
      return;
    }

    setIsCreating(true);
    const toastId = toast.loading('Cadastrando produto...', { duration: 10000 });

    try {
      const ext = createData.file.name.split('.').pop()?.toLowerCase();
      const cleanEan = createData.ean.replace(/[^a-zA-Z0-9]/g, '');
      const fileName = `${cleanEan}.${ext === 'png' ? 'png' : 'jpg'}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, createData.file, { upsert: true, contentType: createData.file.type });

      if (uploadError) throw uploadError;

      const publicUrl = `https://ebvvmddizsggrqasnnvv.supabase.co/storage/v1/object/public/product-images/${fileName}?t=${Date.now()}`;

      const product = products.find(p => p.id === productId);
      
      const { error: dbError } = await supabase.from('products').upsert({
         ean: cleanEan,
         name: createData.name.toUpperCase(),
         brand: product?.brand,
         line: product?.line,
         category: product?.category,
         image_path: fileName
      }, { onConflict: 'ean' });

      if (dbError) {
         console.error('DB Upsert Error:', dbError);
      }

      setProducts(prev => prev.map(p => {
        if (p.id === productId) {
           return { 
             ...p, 
             name: createData.name.toUpperCase(),
             ean: cleanEan,
             images: [publicUrl], 
             confidence: 'high' as const, 
             warning: undefined 
           };
        }
        return p;
      }));

      toast.success('Produto cadastrado e associado com sucesso!', { id: toastId });
      setCreatingProductFor(null);
      setCreateData({ name: '', ean: '', file: null });

    } catch (e: any) {
      toast.error(`Falha ao cadastrar: ${e.message}`, { id: toastId });
    } finally {
      setIsCreating(false);
    }
  };

  const [activeTab, setActiveTab] = useState<'produtos' | 'imagens'>('produtos');

  return (
    <div className="h-full flex flex-col bg-[#09090b]">
      <FirstUseTour />
      {/* Scrollable area — search, tabs, and content all scroll together */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Search Area */}
        <BulkSearchArea 
          bulkInput={bulkInput}
          setBulkInput={setBulkInput}
          isProcessing={isProcessing}
          onSearch={handleBulkSearch}
        />

        {/* Tab Bar (sticky within scroll) */}
        {products.length > 0 && (
          <div className="px-8 pt-4 pb-0 bg-[#09090b] border-b border-white/5 sticky top-0 z-20">
            <div className="max-w-6xl mx-auto flex items-center gap-1">
              <button
                onClick={() => setActiveTab('produtos')}
                className={`flex items-center gap-2.5 px-6 py-3 rounded-t-2xl text-[10px] font-black uppercase tracking-[0.15em] transition-all relative ${
                  activeTab === 'produtos'
                    ? 'text-white bg-[#121214] border border-white/10 border-b-[#121214] -mb-px z-10'
                    : 'text-white/30 hover:text-white/60 bg-white/[0.02] border border-transparent hover:bg-white/[0.05]'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                Produtos
                <span className={`px-2 py-0.5 rounded-full text-[9px] ${activeTab === 'produtos' ? 'bg-primary/20 text-primary' : 'bg-white/10 text-white/30'}`}>
                  {products.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('imagens')}
                className={`flex items-center gap-2.5 px-6 py-3 rounded-t-2xl text-[10px] font-black uppercase tracking-[0.15em] transition-all relative ${
                  activeTab === 'imagens'
                    ? 'text-white bg-[#121214] border border-white/10 border-b-[#121214] -mb-px z-10'
                    : 'text-white/30 hover:text-white/60 bg-white/[0.02] border border-transparent hover:bg-white/[0.05]'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                Imagens
                {Object.keys(bgPreviews).length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] bg-purple-500/20 text-purple-400 animate-pulse">
                    {Object.keys(bgPreviews).length} prévias
                  </span>
                )}
              </button>

              <div className="flex-1" />
              <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full">
                Total Telas: {Math.ceil(products.length / (slots.length || 1))}
              </span>
            </div>
          </div>
        )}

        {/* Tab Content */}
        <div className="p-8">
          <div className="max-w-6xl mx-auto space-y-4">

          {/* ══════════════ TAB: PRODUTOS ══════════════ */}
          {(activeTab === 'produtos' || products.length === 0) && (
            <>
              {products.length === 0 ? (
                <div className="py-20 text-center bg-[#121214] border-2 border-dashed border-white/5 rounded-[2rem]">
                  <div className="w-20 h-20 bg-red-600/10 rounded-3xl flex items-center justify-center mx-auto mb-6 animate-pulse">
                    <Search className="w-10 h-10 text-red-600" />
                  </div>
                  <p className="text-white/40 text-sm font-bold">Nenhum produto adicionado ainda.</p>
                  <p className="text-white/20 text-[11px] mt-2 uppercase font-bold tracking-widest">
                    Cole a lista do cliente acima para começar
                  </p>
                  <p className="text-white/10 text-[10px] mt-4 uppercase tracking-wider">
                    Aceita descrição + preço  •  código de barras + preço
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-sm font-black uppercase tracking-tighter text-white/60 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" /> Confirmar Produtos ({products.length})
                    </h2>
                  </div>
                  {products.map((p, idx) => (
                    <ReviewCard 
                      key={p.id}
                      product={p}
                      idx={idx}
                      isSelected={selectedIds.has(p.id)}
                      toggleSelect={toggleSelect}
                      bgPreview={bgPreviews[p.id]}
                      resolvedUrl={resolvedUrls[p.id]}
                      setResolvedUrl={(url) => setResolvedUrls(prev => ({ ...prev, [p.id]: url }))}
                      handleFormatChange={handleFormatChange}
                      imageFormat={imageFormats[p.id] || 'JPG'}
                      onExpandImage={setExpandedImage}
                      toggleSuffix={toggleSuffix}
                      onLoadVariations={loadVariations}
                      isLoadingVariations={loadingVariationsId === p.id}
                      onManualImageUpload={handleManualImageUpload}
                       onRemove={(id) => {
                         removeProducts([id]);
                         toast.success('Produto removido');
                       }}
                      isProcessing={isProcessing}
                      isCreatingThis={creatingProductFor === p.id}
                      setCreatingThis={setCreatingProductFor}
                      createData={createData}
                      setCreateData={setCreateData}
                      isCreating={isCreating}
                      onConfirmCreate={handleCreateProduct}
                      onUpdateProduct={handleUpdateProduct}
                    />
                  ))}
                </>
              )}
            </>
          )}

          {/* ══════════════ TAB: IMAGENS ══════════════ */}
          {activeTab === 'imagens' && products.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <Button onClick={handleSelectAll} variant="outline" className={`h-8 px-3 rounded-full text-[10px] font-black uppercase tracking-widest ${selectedIds.size === products.length && products.length > 0 ? 'bg-primary border-primary text-white' : 'bg-white/5 border-white/5 text-white/40 hover:text-white'}`}>
                    {selectedIds.size === products.length && products.length > 0 ? <CheckSquare className="w-3.5 h-3.5 mr-1" /> : <div className="w-3.5 h-3.5 mr-1 border-2 border-current rounded-sm opacity-50" />}
                    Todos
                  </Button>
                  <Button onClick={handleSelectJpgs} variant="outline" className="h-8 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border-amber-500/20 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors">
                    <ImageIcon className="w-3.5 h-3.5 mr-1" /> Filtrar JPG
                  </Button>
                  <h2 className="ml-2 text-sm font-black uppercase tracking-tighter text-white/60 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-purple-400" /> Gerenciar Imagens ({products.length})
                  </h2>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {products.map((p) => (
                  <div 
                    key={p.id}
                    onClick={() => toggleSelect(p.id)}
                    className={`relative group rounded-2xl border-2 overflow-hidden cursor-pointer transition-all ${
                      selectedIds.has(p.id) 
                        ? 'border-primary/50 bg-primary/5 shadow-[0_0_20px_rgba(217,37,75,0.1)]' 
                        : 'border-white/5 bg-white/[0.02] hover:border-white/15'
                    }`}
                  >
                    {/* Checkbox */}
                    <div className={`absolute top-2 left-2 z-10 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                      selectedIds.has(p.id) ? 'bg-primary border-primary' : 'bg-black/60 border-white/20'
                    }`}>
                      {selectedIds.has(p.id) && <CheckSquare className="w-3 h-3 text-white" />}
                    </div>

                    {/* Preview badge */}
                    {bgPreviews[p.id] && (
                      <div className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded-lg bg-purple-500/90 text-[8px] font-black text-white uppercase tracking-wider">
                        Prévia
                      </div>
                    )}

                    {/* Image */}
                    <div className="aspect-square p-3 flex items-center justify-center bg-white/[0.03]">
                      <ProductImageWithFormat 
                        src={p.images[0]} 
                        previewBase64={bgPreviews[p.id]}
                        onFormatChange={(f) => handleFormatChange(p.id, f)}
                        onUrlResolved={(url) => setResolvedUrls(prev => ({ ...prev, [p.id]: url }))}
                        isFallback={!p.images[0]}
                      />
                    </div>

                    {/* Info */}
                    <div className="p-3 border-t border-white/5">
                      <p className="text-[9px] font-black text-white/60 uppercase truncate leading-tight">{p.name}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[9px] font-black text-primary">{p.price}</span>
                        <div className="flex gap-1">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleFormatChange(p.id, 'JPG'); }} 
                            className={`px-1.5 py-0.5 rounded text-[7px] font-black transition-all ${imageFormats[p.id] === 'JPG' || !imageFormats[p.id] ? 'bg-amber-500 text-amber-950' : 'bg-white/10 text-white/30'}`}
                          >JPG</button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleFormatChange(p.id, 'PNG'); }} 
                            className={`px-1.5 py-0.5 rounded text-[7px] font-black transition-all ${imageFormats[p.id] === 'PNG' ? 'bg-purple-500 text-white' : 'bg-white/10 text-white/30'}`}
                          >PNG</button>
                        </div>
                      </div>
                    </div>

                    {/* Hover zoom */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); setExpandedImage(bgPreviews[p.id] || resolvedUrls[p.id] || p.images[0]); }}
                      className="absolute top-2 right-2 w-7 h-7 bg-black/60 backdrop-blur-sm rounded-lg flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
          </div>
        </div>
      </div>

      {/* Floating Action Bar — only on Imagens tab with selections */}
      {selectedIds.size > 0 ? (
        <div className="p-4 bg-black/80 backdrop-blur-md border-t border-white/10 flex items-center justify-between shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-50">
          <div className="flex items-center gap-4 pl-4">
            <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-black text-xs">
              {selectedIds.size}
            </div>
            <span className="text-[11px] font-bold tracking-widest uppercase text-white/60">Itens Selecionados</span>
          </div>
          <div className="flex items-center gap-3 pr-4">
            {activeTab === 'imagens' && (
              <>
                <Button onClick={() => handleRemoveBackground(Array.from(selectedIds))} variant="outline" className="h-12 border-purple-500/40 text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 font-black uppercase tracking-widest rounded-xl text-[10px]">
                  <Sparkles className="w-4 h-4 mr-2" /> Recortar Fundo em Lote
                </Button>
                <Button onClick={() => handleApprovePreviews(Array.from(selectedIds))} className="h-12 bg-green-600 hover:bg-green-700 text-white font-black uppercase tracking-widest rounded-xl text-[10px]">
                  <CheckSquare className="w-4 h-4 mr-2" /> Aprovar Lote
                </Button>
              </>
            )}
            <Button onClick={() => {
              const count = selectedIds.size;
              removeProducts(Array.from(selectedIds));
              setSelectedIds(new Set());
              toast.success(`${count} itens removidos`);
            }} variant="outline" className="h-12 border-red-500/40 text-red-400 hover:text-red-300 hover:bg-red-500/10 font-black uppercase tracking-widest rounded-xl text-[10px]">
              <Trash2 className="w-4 h-4 mr-2" /> Remover Selecionados
            </Button>
            {activeTab === 'imagens' && (
              <Button onClick={() => handleRestoreOriginals(Array.from(selectedIds))} variant="outline" className="h-12 border-white/10 text-white/40 hover:text-white bg-white/5 font-black uppercase tracking-widest rounded-xl text-[10px]">
                <Undo2 className="w-4 h-4 mr-2" /> Restaurar Originais
              </Button>
            )}
          </div>
        </div>
      ) : products.length > 0 ? (
        <div className="p-6 bg-[#0d0d10] border-t border-white/5 flex items-center justify-center gap-4">
          <Button onClick={() => setStep(5)} className="px-12 h-14 bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-[0.2em] text-[11px] rounded-2xl shadow-[0_0_30px_rgba(217,37,75,0.2)] transition-all transform hover:scale-105 active:scale-95 group">
             Gerar Tabloide Agora <ChevronRight className="w-4 h-4 ml-3 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      ) : null}

      {/* Expanded Image Modal */}
      {expandedImage && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200" onClick={() => setExpandedImage(null)}>
          <button className="absolute top-6 right-6 bg-white/10 hover:bg-white/20 p-3 rounded-full text-white transition-colors" onClick={() => setExpandedImage(null)}>
            <X className="w-5 h-5" />
          </button>
          <img src={expandedImage} className="max-w-full max-h-full object-contain select-none cursor-zoom-out animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {/* Variations Modal */}
      {showVariationsFor && products.find(prod => prod.id === showVariationsFor) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#121214] border border-white/10 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            {(() => {
              const p = products.find(prod => prod.id === showVariationsFor)!;
              return (
                <>
                  <div className="p-6 border-b border-white/5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-white">Gerenciar Variações</h3>
                        <p className="text-[10px] text-white/40 font-bold uppercase">{p.name}</p>
                      </div>
                      <button onClick={() => { setShowVariationsFor(null); setManualSearch(''); setManualResults([]); setShowVariationCreate(false); }} className="bg-white/5 p-2 rounded-xl text-white/40 hover:text-white">
                         <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                      <Input 
                        value={manualSearch}
                        onChange={e => handleManualSearch(e.target.value, p)}
                        placeholder="Pesquisar no banco (nome ou EAN)..."
                        className="bg-black/40 border-white/10 pl-12 h-12 rounded-xl text-xs placeholder:text-white/10"
                      />
                      {isSearchingManual && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />}
                    </div>

                    {/* Botão Cadastrar Variação */}
                    <Button 
                      onClick={() => {
                        setShowVariationCreate(!showVariationCreate);
                        setVariationCreateData({ name: '', ean: '', file: null });
                      }}
                      className={`w-full h-10 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                        showVariationCreate 
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30' 
                          : 'bg-green-600/10 text-green-400 border border-green-500/20 hover:bg-green-600/20'
                      }`}
                    >
                      <PlusCircle className="w-4 h-4" />
                      {showVariationCreate ? 'Cancelar Cadastro' : 'Não encontrou? Cadastrar Novo'}
                    </Button>

                    {/* Formulário de Cadastro Inline */}
                    {showVariationCreate && (
                      <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                        <h4 className="text-[9px] font-black uppercase tracking-widest text-green-400 flex items-center gap-2">
                          <PlusCircle className="w-3 h-3" /> Cadastrar Nova Variação
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[8px] font-bold uppercase text-white/30 block mb-1">Nome do Produto</label>
                            <Input 
                              disabled={isCreatingVariation}
                              value={variationCreateData.name} 
                              onChange={e => setVariationCreateData({...variationCreateData, name: e.target.value})} 
                              placeholder="Ex: MONSTER MANGA LOCA" 
                              className="bg-black/40 border-white/10 h-9 text-[11px] text-white rounded-lg" 
                            />
                          </div>
                          <div>
                            <label className="text-[8px] font-bold uppercase text-white/30 block mb-1">Código EAN</label>
                            <Input 
                              disabled={isCreatingVariation}
                              value={variationCreateData.ean} 
                              onChange={e => setVariationCreateData({...variationCreateData, ean: e.target.value})} 
                              placeholder="789..." 
                              className="bg-black/40 border-white/10 h-9 text-[11px] text-white rounded-lg" 
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[8px] font-bold uppercase text-white/30 block mb-1">Foto do Produto</label>
                          <div className="flex gap-3 items-center">
                            <input 
                              type="file" 
                              id="variation-create-file" 
                              className="hidden" 
                              accept="image/*"
                              onChange={e => setVariationCreateData({...variationCreateData, file: e.target.files?.[0] || null})} 
                            />
                            <label 
                              htmlFor="variation-create-file" 
                              className="flex-1 flex items-center justify-between bg-black/40 border border-white/10 h-9 px-4 rounded-lg cursor-pointer hover:border-white/20 transition-colors"
                            >
                              <span className="text-[10px] text-white/30 truncate">
                                {variationCreateData.file ? variationCreateData.file.name : 'Selecionar imagem...'}
                              </span>
                              <ImageIcon className="w-4 h-4 text-white/20" />
                            </label>
                            <Button 
                              onClick={() => handleCreateVariation(p.id)} 
                              disabled={isCreatingVariation}
                              className="h-9 px-6 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[10px] font-black uppercase tracking-widest"
                            >
                              {isCreatingVariation ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cadastrar e Adicionar'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-6 overflow-y-auto custom-scrollbar" style={{ maxHeight: '60vh' }}>
                    {manualResults.length > 0 && (
                      <div className="mb-8 animate-in fade-in slide-in-from-top-2">
                         <h4 className="text-[9px] font-black uppercase tracking-widest text-blue-500 mb-4 flex items-center gap-2">
                           <Search className="w-3 h-3" /> Resultados da Pesquisa Manual
                         </h4>
                         <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {manualResults.map(v => (
                              <div key={v.id || v.ean} className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-3 flex flex-col items-center gap-2 group relative">
                                <div className="w-full h-20">
                                  <ProductImageWithFormat 
                                    src={v.images?.[0] || ''} 
                                    className="w-full h-full object-contain group-hover:scale-110 transition-transform"
                                  />
                                </div>
                                <p className="text-[9px] font-bold text-center text-white/60 truncate w-full uppercase">{v.name}</p>
                                <div className="flex gap-1 mt-2">
                                   <Button onClick={() => {
                                     setProducts(prev => prev.map(old => old.id === p.id ? { ...old, ean: v.ean, name: v.name, images: [v.images?.[0] || ''], confidence: 'high' as const, warning: undefined } : old));
                                     setShowVariationsFor(null);
                                     setManualSearch('');
                                     setManualResults([]);
                                     toast.success('Produto substituído!');
                                   }} className="h-7 px-3 bg-blue-600 hover:bg-blue-700 text-[8px] font-black uppercase">Substituir</Button>
                                   <Button onClick={() => addVariation(p.id, v.images?.[0] || '')} className="h-7 px-3 bg-white/10 hover:bg-white/20 text-[8px] font-black uppercase">Pilha</Button>
                                </div>
                              </div>
                            ))}
                         </div>
                      </div>
                    )}

                    <h4 className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-4 flex items-center gap-2">
                      <Sparkles className="w-3 h-3" /> Sugestões Inteligentes
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {p.images.map((img, i) => (
                        <div key={`cur-${i}`} className="relative bg-primary/10 border-2 border-primary/40 rounded-2xl p-3 flex flex-col items-center gap-2 group">
                          <div className="w-full h-20">
                            <ProductImageWithFormat 
                              src={img} 
                              className="w-full h-full object-contain" 
                            />
                          </div>
                          <span className="text-[8px] font-black uppercase text-primary">Na Pilha</span>
                          <button onClick={() => removeVariation(p.id, i)} className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}

                      {variations.length > 0 ? variations.map(v => (
                        <div key={v.ean} onClick={() => addVariation(p.id, v.images[0])} 
                          className="bg-white/[0.02] border border-white/5 rounded-2xl p-3 flex flex-col items-center gap-2 hover:border-blue-500/50 cursor-pointer transition-all group">
                          <div className="w-full h-20">
                            <ProductImageWithFormat 
                              src={v.images[0]} 
                              className="w-full h-full object-contain group-hover:scale-110 transition-transform" 
                            />
                          </div>
                          <p className="text-[9px] font-bold text-center text-white/60 truncate w-full uppercase">{v.name}</p>
                        </div>
                      )) : !isSearchingManual && manualResults.length === 0 && (
                        <div className="col-span-full py-8 text-center text-white/20 text-[10px] uppercase font-bold tracking-widest italic">
                          Sem sugestões automáticas
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-4 bg-black/40 border-t border-white/5 flex justify-end">
                    <Button onClick={() => { setShowVariationsFor(null); setManualSearch(''); setManualResults([]); setShowVariationCreate(false); }} className="bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest">Fechar</Button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
