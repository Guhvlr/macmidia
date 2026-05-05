import React, { useState } from 'react';
import { useOffer, ProductItem } from '../context/OfferContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Trash2, Search, PlusCircle, CheckCircle2, ChevronRight, X, Sparkles, AlertTriangle, Barcode, FileText, Crop, Undo2, CheckSquare, Image as ImageIcon, ZoomIn, Zap, Layers, Plus, GripVertical } from 'lucide-react';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ProductImageWithFormat } from './ProductImageWithFormat';
import { padEan, getImageUrl } from '@/lib/ean';
import { ReviewCard } from './review/ReviewCard';
import { ProductDetailPanel } from './review/ProductDetailPanel';
import { BulkSearchArea } from './review/BulkSearchArea';
import { ConfidenceBadge } from './review/ConfidenceBadge';
import { FirstUseTour } from './review/FirstUseTour';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const StepReview = () => {
  const { products, setProducts, removeProducts, pushHistory, slots, setStep, clients, pageCount, selectedClientName, setSelectedClientName } = useOffer();
  const [bulkInput, setBulkInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [variations, setVariations] = useState<ProductItem[]>([]);
  const [showVariationsFor, setShowVariationsFor] = useState<string | null>(null);
  const [manualSearch, setManualSearch] = useState('');
  const [manualResults, setManualResults] = useState<ProductItem[]>([]);
  const [isSearchingManual, setIsSearchingManual] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [loadingVariationsId, setLoadingVariationsId] = useState<string | null>(null);
  const [detailPanelProductId, setDetailPanelProductId] = useState<string | null>(null);

  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setProducts((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
      pushHistory();
    }
  };

  // Manual Create State
  const [creatingProductFor, setCreatingProductFor] = useState<string | null>(null);
  const [createData, setCreateData] = useState({ name: '', ean: '', file: null as File | null, client_name: '' });
  const [isCreating, setIsCreating] = useState(false);

  // Variation Create State (inside Variations modal)
  const [showVariationCreate, setShowVariationCreate] = useState(false);
  const [variationCreateData, setVariationCreateData] = useState({ name: '', ean: '', file: null as File | null, client_name: '' });
  const [isCreatingVariation, setIsCreatingVariation] = useState(false);

  // Background Removal State
  // Selection state
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
    const chunkSize = 3; 

    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      
      await Promise.all(chunk.map(async (id) => {
        const { prodId, imgIdx } = id.includes('-img-') 
          ? { prodId: id.split('-img-')[0], imgIdx: parseInt(id.split('-img-')[1]) } 
          : { prodId: id, imgIdx: 0 };

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
      const { prodId, imgIdx } = id.includes('-img-') 
        ? { prodId: id.split('-img-')[0], imgIdx: parseInt(id.split('-img-')[1]) } 
        : { prodId: id, imgIdx: 0 };

      const preview = bgPreviews[id];
      const product = products.find(p => p.id === prodId);
      if (!preview || !product) continue;

      try {
        const cleanEan = product.ean.replace(/[^a-zA-Z0-9]/g, '');
        const res = await fetch(preview);
        const blob = await res.blob();
        
        const { error } = await supabase.storage
          .from('product-images')
          .upload(`${cleanEan}.png`, blob, { upsert: true, contentType: 'image/png' });
          
        if (error) throw error;
        
        setBgPreviews(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setProducts(prev => prev.map(p => p.id === prodId ? {
            ...p, 
            images: p.images.map((img, i) => i === imgIdx 
              ? `https://ebvvmddizsggrqasnnvv.supabase.co/storage/v1/object/public/product-images/${cleanEan}.png?t=${Date.now()}` 
              : img
            )
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
      const { prodId, imgIdx } = id.includes('-img-') 
        ? { prodId: id.split('-img-')[0], imgIdx: parseInt(id.split('-img-')[1]) } 
        : { prodId: id, imgIdx: 0 };

      const product = products.find(p => p.id === prodId);
      if (!product) continue;
      
      const preview = bgPreviews[id];
      if (preview) {
        setBgPreviews(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        successCount++;
        continue;
      }

      try {
        const cleanEan = product.ean.replace(/[^a-zA-Z0-9]/g, '');
        const { error } = await supabase.storage.from('product-images').remove([`${cleanEan}.png`]);
        if (error) throw error;
        
        setProducts(prev => prev.map(p => p.id === prodId ? {
            ...p, 
            images: p.images.map((img, i) => i === imgIdx 
              ? `https://ebvvmddizsggrqasnnvv.supabase.co/storage/v1/object/public/product-images/${cleanEan}.png?t=${Date.now()}` 
              : img
            )
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

  const handleBulkSearch = async () => {
    if (!bulkInput.trim()) return;
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-products', { 
        body: { bulkInput, clientName: selectedClientName } 
      });
      if (error) throw error;
      
      const results: ProductItem[] = (data.results || []).map((res: any, idx: number) => {
        const found = !!(res.found && res.match);
        let isBarcode = res.mode === 'barcode';
        
        const firstWord = (res.original || '').trim().split(/\s+/)[0];
        if (/^\d{13}$/.test(firstWord)) {
          isBarcode = true;
        }

        const confidence = res.confidence || 'none';
        
        // Usar o display_name da IA se disponível, senão limpar o original
        let displayName = res.display_name || res.original || 'Produto sem nome';
        if (!res.display_name) {
          displayName = displayName.replace(/\s*[-–—]\s*(R\$\s*)?\d+[,.]\d{2}/gi, '');
          displayName = displayName.replace(/\s+(R\$\s*)?\d+[,.]\d{2}/gi, '');
        }
        displayName = displayName.trim();

        let extractedEan = res.match?.ean;
        if (!extractedEan && isBarcode) {
          extractedEan = firstWord;
        }

        let images: string[] = [];
        if (found) {
          if (res.match?.image_path) {
            images = [`https://ebvvmddizsggrqasnnvv.supabase.co/storage/v1/object/public/product-images/${res.match.image_path}`];
          } else if (res.match?.ean) {
            images = [getImageUrl(res.match.ean, res.match.client_name)];
          }
        } else if (isBarcode && extractedEan) {
          images = [getImageUrl(extractedEan)];
        }

        let price = 'R$ 0,00';
        if (res.price) {
          price = `R$ ${String(res.price).replace('.', ',')}`;
        } else {
          const priceMatches = [...(res.original || '').matchAll(/(?:R\$\s*)?(\d+[,.]\d{2})/gi)];
          if (priceMatches.length > 0) {
             price = `R$ ${priceMatches[priceMatches.length - 1][1].replace('.', ',')}`;
          }
        }

        let suffix = res.match?.unit || 'cada';
        if (!res.match?.unit) {
          const originalLower = (res.original || '').toLowerCase();
          if (originalLower.match(/\b(kg|kilo|kilos)\b/i)) {
            suffix = 'KG';
          } else if (originalLower.match(/\b(cada|unidade|unid|uni|un)\b/i)) {
            suffix = 'cada';
          }
        }

        return {
          id: `item-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 9)}`,
          name: displayName,
          ean: extractedEan || (isBarcode ? firstWord : 'N/A'),
          price,
          suffix,
          images,
          brand: res.match?.brand,
          line: res.match?.line,
          category: res.section || res.match?.category, // Usar seção da IA como categoria prioritária
          confidence,
          confidence_reason: res.confidence_reason,
          warning: res.warning,
          mode: res.mode || 'description',
          client_name: res.match?.client_name || (res.match === null ? (selectedClientName || undefined) : res.match?.client_name),
        } as ProductItem;
      });

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
      } else if (product.brand) {
        query = query.eq('brand', product.brand);
      } else {
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

      const { data, error } = await query.neq('ean', product.ean).limit(30);
      if (error) throw error;

      setVariations((data || []).map(v => {
        let imageUrl = '';
        if (v.image_path) {
          imageUrl = `https://ebvvmddizsggrqasnnvv.supabase.co/storage/v1/object/public/product-images/${v.image_path}?t=${Date.now()}`;
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
        .or(`name.ilike.%${term}%,ean.ilike.%${term}%,brand.ilike.%${term}%`)
        .limit(20);

      if (error) throw error;
      setManualResults((data || []).map(v => {
        let imageUrl = '';
        if (v.image_path) {
          imageUrl = `https://ebvvmddizsggrqasnnvv.supabase.co/storage/v1/object/public/product-images/${v.image_path}?t=${Date.now()}`;
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
      const clientNameVal = variationCreateData.client_name || null;
      const clientSuffix = clientNameVal ? '_' + clientNameVal.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';
      const fileName = `${cleanEan}${clientSuffix}_${Date.now()}.${ext === 'png' ? 'png' : 'jpg'}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, variationCreateData.file, { upsert: true, contentType: variationCreateData.file.type });

      if (uploadError) throw uploadError;

      let query = supabase.from('products').select('id').eq('ean', cleanEan);
      if (clientNameVal) query = query.eq('client_name', clientNameVal);
      else query = query.is('client_name', null);
      
      const { data: existing } = await query;
      let dbError = null;

      if (existing && existing.length > 0) {
        const { error } = await supabase.from('products').update({
          name: variationCreateData.name.toUpperCase(),
          brand: parentProduct?.brand,
          line: parentProduct?.line,
          category: parentProduct?.category,
          image_path: fileName
        }).eq('id', existing[0].id);
        dbError = error;
      } else {
        const { error } = await supabase.from('products').insert({
          ean: cleanEan,
          name: variationCreateData.name.toUpperCase(),
          brand: parentProduct?.brand,
          line: parentProduct?.line,
          category: parentProduct?.category,
          image_path: fileName,
          client_name: clientNameVal
        });
        dbError = error;
      }

      if (dbError) {
        console.error('DB Error:', dbError);
      }

      const publicUrl = `https://ebvvmddizsggrqasnnvv.supabase.co/storage/v1/object/public/product-images/${fileName}?t=${Date.now()}`;
      addVariation(parentProductId, publicUrl);

      toast.success('Variação cadastrada e adicionada à pilha!', { id: toastId });
      setVariationCreateData({ name: '', ean: '', file: null, client_name: '' });
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
      const clientNameVal = product.client_name || null;
      const clientSuffix = clientNameVal ? '_' + clientNameVal.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';
      const fileName = `${ean}${clientSuffix}.${ext === 'png' ? 'png' : 'jpg'}`;

      const { error } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, { upsert: true, contentType: file.type });

      if (error) throw error;

      let query = supabase.from('products').select('id').eq('ean', ean);
      if (clientNameVal) query = query.eq('client_name', clientNameVal);
      else query = query.is('client_name', null);
      
      const { data: existing } = await query;
      let dbError = null;

      if (existing && existing.length > 0) {
        const { error } = await supabase.from('products').update({
          name: product.name.toUpperCase(),
          image_path: fileName
        }).eq('id', existing[0].id);
        dbError = error;
      } else {
        const { error } = await supabase.from('products').insert({
          ean: ean,
          name: product.name.toUpperCase(),
          image_path: fileName,
          client_name: clientNameVal
        });
        dbError = error;
      }

      if (dbError) {
        console.error('Erro ao sincronizar produto no banco:', dbError);
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
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      const p = products.find(x => x.id === id);
      if (!p) return;

      const previewUrl = URL.createObjectURL(file);
      setProducts(prev => prev.map(old => old.id === id ? { 
        ...old, 
        images: [previewUrl, ...old.images],
        pendingImageFile: file 
      } : old));
      
      toast.success('Foto selecionada! Clique em "Salvar no BD" para confirmar.');
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
    // Primeiro atualiza localmente para garantir feedback visual imediato
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    
    if (saveToDb) {
      const product = products.find(p => p.id === id);
      const targetName = updates.name || product?.name;
      const targetEan = updates.ean || product?.ean;

      if (!product || !targetEan || !targetName) {
        toast.error('Dados insuficientes para salvar no banco.');
        return;
      }

      const cleanEan = targetEan.replace(/[^0-9]/g, '');
      const paddedEan = padEan(cleanEan);
      const clientNameVal = updates.client_name !== undefined ? (updates.client_name || null) : (product.client_name || null);

      try {
        const toastId = toast.loading('Sincronizando com o banco de dados...');
        let finalImagePath = product.images[0]?.split('?')[0]?.split('/').pop(); 

        // Se existe uma imagem pendente de upload (selecionada via "Trocar Foto")
        if (product.pendingImageFile) {
          const file = product.pendingImageFile;
          const ext = file.name.split('.').pop()?.toLowerCase();
          const clientSuffix = clientNameVal ? '_' + clientNameVal.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';
          const fileName = `${paddedEan}${clientSuffix}.${ext === 'png' ? 'png' : 'jpg'}`;
          
          const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(fileName, file, { upsert: true, contentType: file.type });
            
          if (uploadError) throw uploadError;
          finalImagePath = fileName;
        }

        let query = supabase.from('products').select('id').eq('ean', paddedEan);
        if (clientNameVal) query = query.eq('client_name', clientNameVal);
        else query = query.is('client_name', null);
        
        const { data: existing } = await query;
        let error = null;

        const dbData = {
          name: targetName.toUpperCase(),
          price: updates.price !== undefined ? (updates.price ? parseFloat(String(updates.price).replace(/[^\d,]/g, '').replace(',', '.')) : null) : (product.price ? parseFloat(String(product.price).replace(/[^\d,]/g, '').replace(',', '.')) : null),
          unit: updates.suffix || product.suffix,
          image_path: finalImagePath
        };

        if (existing && existing.length > 0) {
          const { error: updateError } = await supabase.from('products').update(dbData).eq('id', existing[0].id);
          error = updateError;
        } else {
          const { error: insertError } = await supabase.from('products').insert({
            ...dbData,
            ean: paddedEan,
            client_name: clientNameVal
          });
          error = insertError;
        }
        
        if (error) throw error;

        // Se houve upload, atualiza a URL local definitiva (com cache buster) e remove o pending
        if (product.pendingImageFile) {
          const publicUrl = `https://ebvvmddizsggrqasnnvv.supabase.co/storage/v1/object/public/product-images/${finalImagePath}?t=${Date.now()}`;
          setProducts(prev => prev.map(p => p.id === id ? { 
            ...p, 
            images: [publicUrl], 
            pendingImageFile: undefined 
          } : p));
        }

        toast.success('Produto salvo no banco de dados!', { id: toastId });
      } catch (err: any) {
        toast.error('Erro ao salvar no banco: ' + err.message);
      }
    } else {
      toast.success('Produto atualizado localmente!');
    }
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
      const clientNameVal = createData.client_name || null;
      const clientSuffix = clientNameVal ? '_' + clientNameVal.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';
      const fileName = `${cleanEan}${clientSuffix}.${ext === 'png' ? 'png' : 'jpg'}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, createData.file, { upsert: true, contentType: createData.file.type });

      if (uploadError) throw uploadError;

      const publicUrl = `https://ebvvmddizsggrqasnnvv.supabase.co/storage/v1/object/public/product-images/${fileName}?t=${Date.now()}`;

      const product = products.find(p => p.id === productId);
      let query = supabase.from('products').select('id').eq('ean', cleanEan);
      if (clientNameVal) query = query.eq('client_name', clientNameVal);
      else query = query.is('client_name', null);
      
      const { data: existing } = await query;
      let dbError = null;

      if (existing && existing.length > 0) {
        const { error } = await supabase.from('products').update({
          name: createData.name.toUpperCase(),
          brand: product?.brand,
          line: product?.line,
          category: product?.category,
          image_path: fileName
        }).eq('id', existing[0].id);
        dbError = error;
      } else {
        const { error } = await supabase.from('products').insert({
           ean: cleanEan,
           name: createData.name.toUpperCase(),
           brand: product?.brand,
           line: product?.line,
           category: product?.category,
           image_path: fileName,
           client_name: clientNameVal
        });
        dbError = error;
      }

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
      setCreateData({ name: '', ean: '', file: null, client_name: '' });

    } catch (e: any) {
      toast.error(`Falha ao cadastrar: ${e.message}`, { id: toastId });
    } finally {
      setIsCreating(false);
    }
  };

  const [activeTab, setActiveTab] = useState<'produtos' | 'imagens'>('produtos');

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      <FirstUseTour />
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <BulkSearchArea 
          bulkInput={bulkInput}
          setBulkInput={setBulkInput}
          isProcessing={isProcessing}
          onSearch={handleBulkSearch}
          selectedClientName={selectedClientName}
          setSelectedClientName={setSelectedClientName}
          clients={clients}
        />

        {products.length > 0 && (
          <div className="px-8 pt-6 pb-0 bg-zinc-950 border-b border-zinc-800/60 sticky top-0 z-20">
            <div className="max-w-6xl mx-auto flex items-center gap-2">
              <button
                onClick={() => setActiveTab('produtos')}
                className={`flex items-center gap-2 px-6 py-3.5 rounded-t-xl text-[12px] font-semibold transition-all relative ${
                  activeTab === 'produtos'
                    ? 'text-zinc-100 bg-zinc-900 border border-zinc-800/60 border-b-zinc-900 -mb-[1px] z-10 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 bg-zinc-900/30 border border-transparent hover:bg-zinc-900/50'
                }`}
              >
                <Search className="w-4 h-4" />
                Produtos
                <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ml-1 ${activeTab === 'produtos' ? 'bg-red-600/20 text-red-400' : 'bg-zinc-800 text-zinc-500'}`}>
                  {products.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('imagens')}
                className={`flex items-center gap-2 px-6 py-3.5 rounded-t-xl text-[12px] font-semibold transition-all relative ${
                  activeTab === 'imagens'
                    ? 'text-zinc-100 bg-zinc-900 border border-zinc-800/60 border-b-zinc-900 -mb-[1px] z-10 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 bg-zinc-900/30 border border-transparent hover:bg-zinc-900/50'
                }`}
              >
                <ImageIcon className="w-4 h-4" />
                Imagens
                {Object.keys(bgPreviews).length > 0 && (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-500/20 text-purple-400 animate-pulse ml-1">
                    {Object.keys(bgPreviews).length} prévias
                  </span>
                )}
              </button>

              <div className="flex items-center gap-2">
                <span className="text-[12px] font-medium text-zinc-500 bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800/60">
                  Total Telas: {pageCount}
                </span>
                {products.length > 0 && slots.length > 0 && (
                  <Button
                    onClick={() => {
                      const slotsFirstPage = slots.filter(s => (s.pageIndex || 0) === 0).length || slots.length;
                      if (slotsFirstPage === 0) {
                        toast.error("Nenhuma grade definida na Tela 1");
                        return;
                      }
                      const needed = Math.ceil(products.length / slotsFirstPage);
                      if (needed !== pageCount) {
                        const { setPageCount } = useOfferStore.getState();
                        setPageCount(needed);
                        toast.success(`Distribuído em ${needed} telas (${slotsFirstPage} produtos por tela)`);
                      } else {
                        toast.info("A quantidade de telas já é ideal para o número de produtos.");
                      }
                    }}
                    variant="outline"
                    size="sm"
                    className="h-8 bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-red-400 hover:bg-red-400/10 text-[11px] font-bold"
                  >
                    <Layers className="w-3.5 h-3.5 mr-1.5" />
                    Auto-distribuir
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="p-8">
          <div className="max-w-6xl mx-auto space-y-4">
          {(activeTab === 'produtos' || products.length === 0) && (
            <>
              {products.length === 0 ? (
                <div className="py-24 text-center bg-zinc-900/30 border border-dashed border-zinc-800 rounded-2xl">
                  <div className="w-20 h-20 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Search className="w-10 h-10 text-red-500" />
                  </div>
                  <p className="text-zinc-300 text-base font-medium">Nenhum produto adicionado ainda.</p>
                  <p className="text-zinc-500 text-[13px] mt-2">
                    Cole a lista do cliente acima para começar
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4 mt-2">
                    <h2 className="text-[14px] font-semibold text-zinc-300 flex items-center gap-2 tracking-tight">
                      <CheckCircle2 className="w-4 h-4 text-green-500" /> Confirmar Produtos ({products.length})
                    </h2>
                    {products.length > 0 && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-3 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 transition-all gap-2 border border-transparent hover:border-red-400/20 group"
                          >
                            <Trash2 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                            <span className="text-[11px] font-medium">Excluir Tudo</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-zinc-100">Limpar lista de ofertas?</AlertDialogTitle>
                            <AlertDialogDescription className="text-zinc-400">
                              Esta ação removerá todos os {products.length} produtos da sua lista atual. Você pode desfazer esta ação usando o botão de histórico se necessário.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800">Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => {
                                removeProducts(products.map(p => p.id));
                                toast.success(`${products.length} produtos removidos.`);
                              }}
                              className="bg-red-600 hover:bg-red-500 text-white border-none"
                            >
                              Sim, excluir tudo
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                  <DndContext 
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext 
                      items={products.map(p => p.id)}
                      strategy={verticalListSortingStrategy}
                    >
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
                          onOpenDetail={setDetailPanelProductId}
                          activeClientName={selectedClientName}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                </>
              )}
            </>
          )}

          {activeTab === 'imagens' && products.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-4 bg-zinc-900/30 border border-zinc-800 rounded-2xl p-2">
                <div className="flex items-center gap-2">
                  <Button onClick={handleSelectAll} variant="outline" className={`h-8 px-4 rounded-xl text-[11px] font-semibold tracking-wider border-transparent transition-colors ${selectedIds.size === products.length && products.length > 0 ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30 hover:text-red-300' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'}`}>
                    {selectedIds.size === products.length && products.length > 0 ? <CheckSquare className="w-3.5 h-3.5 mr-2" /> : <div className="w-3.5 h-3.5 mr-2 border-2 border-current rounded-sm opacity-50" />}
                    Todos
                  </Button>
                  <Button onClick={handleSelectJpgs} variant="outline" className="h-8 px-4 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border-transparent rounded-xl text-[11px] font-semibold tracking-wider transition-colors">
                    <ImageIcon className="w-3.5 h-3.5 mr-2" /> Filtrar JPG
                  </Button>
                </div>
                <div className="px-4 border-l border-zinc-800">
                  <span className="text-[11px] font-medium text-zinc-500">
                    {products.reduce((acc, p) => acc + p.images.length, 0)} Imagens Totais
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {products.flatMap((p) => p.images.map((img, imgIdx) => {
                  const compoundId = `${p.id}-img-${imgIdx}`;
                  return (
                    <div 
                      key={compoundId}
                      onClick={() => toggleSelect(compoundId)}
                      className={`relative group rounded-2xl border overflow-hidden cursor-pointer transition-all ${
                        selectedIds.has(compoundId) 
                          ? 'border-red-500 bg-red-500/5 shadow-[0_0_15px_rgba(239,68,68,0.1)]' 
                          : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-700'
                      }`}
                    >
                      <div className={`absolute top-2 left-2 z-10 w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                        selectedIds.has(compoundId) ? 'bg-red-600 border-red-600' : 'bg-black/60 border-zinc-500'
                      }`}>
                        {selectedIds.has(compoundId) && <CheckSquare className="w-3 h-3 text-white" />}
                      </div>
                      {bgPreviews[compoundId] && (
                        <div className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded-md bg-purple-500/90 text-[10px] font-bold text-white tracking-wide">
                          Prévia
                        </div>
                      )}
                      <div className="aspect-square p-3 flex items-center justify-center bg-zinc-900/50">
                        <ProductImageWithFormat 
                          src={img} 
                          previewBase64={bgPreviews[compoundId]}
                          onFormatChange={(f) => handleFormatChange(compoundId, f)}
                          onUrlResolved={(url) => setResolvedUrls(prev => ({ ...prev, [compoundId]: url }))}
                          isFallback={!img}
                        />
                      </div>
                      <div className="p-3 border-t border-zinc-800">
                        <p className="text-[11px] font-semibold text-zinc-300 truncate leading-tight">
                          {p.name} {p.images.length > 1 ? `(${imgIdx + 1})` : ''}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[11px] font-semibold text-red-400">{p.price}</span>
                          <div className="flex gap-1">
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleFormatChange(compoundId, 'JPG'); }} 
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all ${imageFormats[compoundId] === 'JPG' || !imageFormats[compoundId] ? 'bg-amber-500 text-amber-950' : 'bg-zinc-800 text-zinc-500'}`}
                            >JPG</button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleFormatChange(compoundId, 'PNG'); }} 
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all ${imageFormats[compoundId] === 'PNG' ? 'bg-purple-500 text-white' : 'bg-zinc-800 text-zinc-500'}`}
                            >PNG</button>
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setExpandedImage(bgPreviews[compoundId] || resolvedUrls[compoundId] || img); }}
                        className="absolute top-2 right-2 w-7 h-7 bg-black/60 backdrop-blur-sm rounded-lg flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                }))}
              </div>
            </>
          )}
          </div>
        </div>
      </div>

      {selectedIds.size > 0 ? (
        <div className="p-3 bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-800 flex items-center justify-between shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-50">
          <div className="flex items-center gap-3 pl-4">
            <div className="w-7 h-7 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center font-bold text-xs border border-red-500/20">
              {selectedIds.size}
            </div>
            <span className="text-[12px] font-semibold text-zinc-400">Selecionados</span>
          </div>
          <div className="flex items-center gap-2 pr-4">
            {activeTab === 'imagens' && (
              <>
                <Button onClick={() => handleRemoveBackground(Array.from(selectedIds))} variant="outline" className="h-9 border-purple-500/30 text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 font-semibold rounded-xl text-[11px] px-4 transition-all">
                  <Sparkles className="w-3.5 h-3.5 mr-2" /> Recortar Fundo
                </Button>
                <Button onClick={() => handleApprovePreviews(Array.from(selectedIds))} className="h-9 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl text-[11px] px-4 transition-all shadow-lg shadow-green-900/20">
                  <CheckSquare className="w-3.5 h-3.5 mr-2" /> Aprovar Prévias
                </Button>
                <div className="w-px h-6 bg-zinc-800 mx-2" />
                <Button onClick={() => handleRestoreOriginals(Array.from(selectedIds))} variant="outline" className="h-9 border-zinc-700 text-zinc-300 hover:text-white bg-zinc-800/50 hover:bg-zinc-800 font-semibold rounded-xl text-[11px] px-4 transition-all">
                  <Undo2 className="w-3.5 h-3.5 mr-2" /> Restaurar
                </Button>
              </>
            )}
            <Button onClick={() => {
              const count = selectedIds.size;
              removeProducts(Array.from(selectedIds));
              setSelectedIds(new Set());
              toast.success(`${count} itens removidos`);
            }} variant="outline" className="h-9 border-red-500/30 text-red-400 hover:text-red-300 hover:bg-red-500/10 font-semibold rounded-xl text-[11px] px-4 transition-all">
              <Trash2 className="w-3.5 h-3.5 mr-2" /> Remover
            </Button>
          </div>
        </div>
      ) : products.length > 0 ? (
        <div className="p-6 bg-zinc-950 border-t border-zinc-800 flex items-center justify-center gap-4">
          <Button onClick={() => setStep(5)} className="px-10 h-12 bg-red-600 hover:bg-red-500 text-white font-semibold tracking-wide text-[13px] rounded-xl shadow-[0_0_20px_rgba(220,38,38,0.2)] transition-all group">
             Gerar Tabloide Agora <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      ) : null}

      {expandedImage && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200" onClick={() => setExpandedImage(null)}>
          <button className="absolute top-6 right-6 bg-white/10 hover:bg-white/20 p-3 rounded-full text-white transition-colors" onClick={() => setExpandedImage(null)}>
            <X className="w-5 h-5" />
          </button>
          <img src={expandedImage} className="max-w-full max-h-full object-contain select-none cursor-zoom-out animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {showVariationsFor && products.find(prod => prod.id === showVariationsFor) && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-zinc-950/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-5xl rounded-[24px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col">
            {(() => {
              const p = products.find(prod => prod.id === showVariationsFor)!;
              return (
                <>
                  <div className="px-8 py-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/30">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                        <Layers className="w-5 h-5 text-red-400" />
                      </div>
                      <div>
                        <h3 className="text-[15px] font-semibold text-zinc-100 tracking-tight">Variações & Agrupamentos</h3>
                        <p className="text-[12px] text-zinc-500 font-medium">{p.name} • {p.images.length} {p.images.length === 1 ? 'item' : 'itens'}</p>
                      </div>
                    </div>
                    <button onClick={() => { setShowVariationsFor(null); setManualSearch(''); setManualResults([]); setShowVariationCreate(false); }} className="w-10 h-10 bg-zinc-900 hover:bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-100 transition-colors border border-zinc-800">
                       <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex h-[65vh] min-h-[500px]">
                    <div className="w-[320px] bg-zinc-900/30 border-r border-zinc-800 p-6 flex flex-col">
                      <h4 className="text-[12px] font-semibold text-zinc-400 mb-4 flex items-center gap-2">
                        <CheckSquare className="w-3.5 h-3.5" /> Composição Atual
                      </h4>
                      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                        {p.images.map((img, i) => (
                          <div key={`cur-${i}`} className={`relative p-3 rounded-2xl border transition-all flex gap-3 items-center group ${i === 0 ? 'bg-red-500/5 border-red-500/30' : 'bg-zinc-900 border-zinc-800/60'}`}>
                            <div className="w-14 h-14 bg-zinc-800/50 rounded-xl p-1 shrink-0">
                              <ProductImageWithFormat src={img} className="w-full h-full object-contain" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-semibold text-zinc-300 truncate">{i === 0 ? 'Principal' : `Variação ${i}`}</p>
                              <span className="text-[10px] text-zinc-500 font-medium">Na Pilha</span>
                            </div>
                            {i > 0 && (
                              <button onClick={() => removeVariation(p.id, i)} className="w-8 h-8 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col bg-zinc-950">
                      <div className="p-6 border-b border-zinc-800 space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="relative flex-1 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-red-500 transition-colors" />
                            <Input 
                              value={manualSearch}
                              onChange={e => {
                                handleManualSearch(e.target.value, p);
                                if (showVariationCreate) setShowVariationCreate(false);
                              }}
                              placeholder="Pesquisar variações no banco..."
                              className="bg-zinc-900 border-zinc-800/60 pl-11 h-11 rounded-xl text-[13px] font-medium text-zinc-100 placeholder:text-zinc-600 focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 transition-all shadow-sm"
                            />
                            {isSearchingManual && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-red-500" />}
                          </div>
                          <Button 
                            onClick={() => {
                              setShowVariationCreate(!showVariationCreate);
                              setVariationCreateData({ name: '', ean: '', file: null, client_name: '' });
                            }}
                            className={`h-11 px-5 rounded-xl text-[12px] font-semibold transition-all ${
                              showVariationCreate ? 'bg-zinc-800 text-zinc-300' : 'bg-red-600 hover:bg-red-500 text-white'
                            }`}
                          >
                            {showVariationCreate ? 'Cancelar' : <><Plus className="w-4 h-4 mr-2" /> Novo Cadastro</>}
                          </Button>
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                        {showVariationCreate ? (
                          <div className="max-w-xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300 mt-4">
                            <div className="space-y-4">
                              <div>
                                <label className="text-[11px] font-medium text-zinc-400 block mb-1.5 ml-1">Nome do Produto</label>
                                <Input 
                                  disabled={isCreatingVariation}
                                  value={variationCreateData.name} 
                                  onChange={e => setVariationCreateData({...variationCreateData, name: e.target.value})} 
                                  placeholder="Ex: CERVEJA HEINEKEN LATA 350ML" 
                                  className="bg-zinc-900 border-zinc-800/60 h-11 text-[13px] font-medium text-zinc-100 rounded-xl focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 shadow-sm" 
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-[11px] font-medium text-zinc-400 block mb-1.5 ml-1">Código EAN</label>
                                  <Input 
                                    disabled={isCreatingVariation}
                                    value={variationCreateData.ean} 
                                    onChange={e => setVariationCreateData({...variationCreateData, ean: e.target.value})} 
                                    placeholder="Opcional..." 
                                    className="bg-zinc-900 border-zinc-800/60 h-11 text-[13px] font-medium text-zinc-100 rounded-xl focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 shadow-sm" 
                                  />
                                </div>
                                <div>
                                  <label className="text-[11px] font-medium text-zinc-400 block mb-1.5 ml-1">Imagem</label>
                                  <input 
                                    type="file" 
                                    id="variation-create-file" 
                                    className="hidden" 
                                    accept="image/*"
                                    onChange={e => setVariationCreateData({...variationCreateData, file: e.target.files?.[0] || null})} 
                                  />
                                  <label 
                                    htmlFor="variation-create-file" 
                                    className="flex items-center justify-between bg-zinc-900 border border-zinc-800/60 h-11 px-4 rounded-xl cursor-pointer hover:bg-zinc-800 transition-all shadow-sm"
                                  >
                                    <span className={`text-[12px] font-medium truncate ${variationCreateData.file ? 'text-red-400' : 'text-zinc-500'}`}>
                                      {variationCreateData.file ? variationCreateData.file.name : 'Selecionar arquivo...'}
                                    </span>
                                    <ImageIcon className="w-4 h-4 text-zinc-600" />
                                  </label>
                                </div>
                              </div>
                              <div>
                                <label className="text-[11px] font-medium text-zinc-400 block mb-1.5 ml-1">Cliente Vinculado</label>
                                <select 
                                  disabled={isCreatingVariation}
                                  value={variationCreateData.client_name}
                                  onChange={e => setVariationCreateData({...variationCreateData, client_name: e.target.value})}
                                  className="w-full bg-zinc-900 border border-zinc-800/60 h-11 px-4 text-[13px] font-medium text-zinc-100 rounded-xl focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 shadow-sm outline-none appearance-none cursor-pointer hover:bg-zinc-800/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <option value="">Global (Disponível para todos)</option>
                                  {(clients || []).map((c: any) => (
                                    <option key={c.id} value={c.name}>{c.name}</option>
                                  ))}
                                </select>
                              </div>
                              <Button 
                                onClick={() => handleCreateVariation(p.id)} 
                                disabled={isCreatingVariation || !variationCreateData.name || !variationCreateData.file}
                                className="w-full h-12 mt-4 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[12px] font-semibold"
                              >
                                {isCreatingVariation ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar e Adicionar'}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-6 animate-in fade-in duration-300">
                            {manualResults.length > 0 && (
                              <div>
                                 <h4 className="text-[12px] font-semibold text-zinc-400 mb-4 flex items-center gap-2">
                                   <Search className="w-3.5 h-3.5" /> Resultados
                                 </h4>
                                 <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {manualResults.map(v => (
                                      <div key={v.id || v.ean} className="bg-zinc-900/30 border border-zinc-800/60 rounded-2xl p-4 flex flex-col gap-3 group transition-all">
                                        <div className="w-full aspect-square bg-zinc-800/30 rounded-xl p-2 flex items-center justify-center overflow-hidden">
                                          <ProductImageWithFormat src={v.images?.[0] || ''} className="w-full h-full object-contain" />
                                        </div>
                                        <div className="flex-1 flex flex-col justify-between gap-3">
                                          <p className="text-[11px] font-semibold text-center text-zinc-300 line-clamp-2 leading-snug">{v.name}</p>
                                          <Button onClick={() => addVariation(p.id, v.images?.[0] || '')} className="h-9 w-full bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white rounded-xl text-[11px] font-semibold transition-all">
                                            Adicionar
                                          </Button>
                                        </div>
                                      </div>
                                    ))}
                                 </div>
                              </div>
                            )}
                            {!manualSearch && (
                              <div className="pt-2">
                                <h4 className="text-[12px] font-semibold text-zinc-400 mb-4 flex items-center gap-2">
                                  <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Sugestões
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                                  {variations.length > 0 ? variations.map(v => (
                                    <div key={v.ean} onClick={() => addVariation(p.id, v.images[0])} 
                                      className="bg-zinc-900/30 border border-zinc-800/60 rounded-2xl p-4 flex flex-col gap-3 hover:border-amber-500/30 hover:bg-zinc-900/50 cursor-pointer transition-all group">
                                      <div className="w-full aspect-square bg-zinc-800/30 rounded-xl p-2 flex items-center justify-center">
                                        <ProductImageWithFormat src={v.images[0]} className="w-full h-full object-contain" />
                                      </div>
                                      <p className="text-[11px] font-semibold text-center text-zinc-300 line-clamp-2 leading-snug">{v.name}</p>
                                    </div>
                                  )) : (
                                    <div className="col-span-full py-12 text-center border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/20">
                                      <p className="text-zinc-500 text-[12px] font-medium">Sem sugestões</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {(() => {
        const selectedDetailProduct = products.find(p => p.id === detailPanelProductId);
        if (!selectedDetailProduct) return null;
        return (
          <ProductDetailPanel
            product={selectedDetailProduct}
            isOpen={!!detailPanelProductId}
            onClose={() => setDetailPanelProductId(null)}
            bgPreview={bgPreviews[selectedDetailProduct.id]}
            resolvedUrl={resolvedUrls[selectedDetailProduct.id]}
            setResolvedUrl={(url) => setResolvedUrls(prev => ({ ...prev, [selectedDetailProduct.id]: url }))}
            handleFormatChange={handleFormatChange}
            imageFormat={imageFormats[selectedDetailProduct.id] || 'JPG'}
            onExpandImage={setExpandedImage}
            toggleSuffix={toggleSuffix}
            onLoadVariations={loadVariations}
            isLoadingVariations={loadingVariationsId === selectedDetailProduct.id}
            onManualImageUpload={handleManualImageUpload}
            onRemove={(id) => {
              removeProducts([id]);
              toast.success('Produto removido');
              setDetailPanelProductId(null);
            }}
            isProcessing={isProcessing}
            isCreatingThis={creatingProductFor === selectedDetailProduct.id}
            setCreatingThis={setCreatingProductFor}
            createData={createData}
            setCreateData={setCreateData}
            isCreating={isCreating}
            onConfirmCreate={handleCreateProduct}
            onUpdateProduct={handleUpdateProduct}
            clients={clients}
          />
        );
      })()}
    </div>
  );
};
