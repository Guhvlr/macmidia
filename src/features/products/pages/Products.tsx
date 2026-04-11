import { useState, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { useApp } from '@/contexts/useApp';
import { 
  Package, 
  Search, 
  Upload, 
  Download, 
  Trash2, 
  Plus, 
  FileSpreadsheet, 
  Loader2, 
  LayoutGrid, 
  List, 
  MoreHorizontal, 
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Zap,
  Sparkles,
  Link as LinkIcon,
  Copy,
  ChevronLeft,
  Settings,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function Products() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const catalogInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [bulkInput, setBulkInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStep, setProcessStep] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualEan, setManualEan] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualBrand, setManualBrand] = useState('');
  const [manualLine, setManualLine] = useState('');
  const [manualCategory, setManualCategory] = useState('');
  const [manualFile, setManualFile] = useState<File | null>(null);
  const [showVariationsFor, setShowVariationsFor] = useState<string | null>(null);
  const [variations, setVariations] = useState<any[]>([]);
  const [manualSearch, setManualSearch] = useState('');
  const [manualResults, setManualResults] = useState<any[]>([]);
  const [isSearchingManual, setIsSearchingManual] = useState(false);

  useEffect(() => {
    const fetchCount = async () => {
      const { count } = await (supabase.from('products') as any).select('*', { count: 'exact', head: true });
      setTotalProducts(count || 0);
    };
    fetchCount();
  }, []);

  const padEan = (ean: string) => {
    const clean = (ean || '').replace(/[^0-9]/g, '');
    if (clean.length > 1 && clean.length < 13) return clean.padStart(13, '0');
    return clean;
  };

  const getImageUrl = (ean: string) => {
    if (!ean || ean === 'Não encontrado') return null;
    // Remove any non-alphanumeric chars just in case
    const cleanEan = ean.replace(/[^a-zA-Z0-9]/g, '');
    return `https://ebvvmddizsggrqasnnvv.supabase.co/storage/v1/object/public/product-images/${cleanEan}.png`;
  };

  const handleCopyLink = (ean: string) => {
    if (ean === 'Não encontrado') return;
    const url = getImageUrl(ean);
    navigator.clipboard.writeText(url);
    toast.success('Link da imagem copiado!');
  };

  const [uploadingForEan, setUploadingForEan] = useState<string | null>(null);

  const handleDirectUpload = async (e: React.ChangeEvent<HTMLInputElement>, ean: string) => {
    const file = e.target.files?.[0];
    if (!file || !ean) return;

    setIsProcessing(true);
    setProcessStep('Subindo imagem...');
    
    try {
      const cleanEan = ean.replace(/[^a-zA-Z0-9]/g, '');
      const filePath = `${cleanEan}.png`;

      // Upload/Replace in Storage
      const { error: storageErr } = await supabase.storage
        .from('product-images')
        .upload(filePath, file, { upsert: true });

      if (storageErr) throw storageErr;

      // Update in result list so it shows immediately
      const newUrl = getImageUrl(cleanEan) + '?t=' + Date.now();
      setSearchResults(prev => prev.map(item => 
        item.ean === ean ? { ...item, images: [newUrl], found: true } : item
      ));

      toast.success(`Imagem para ${ean} atualizada!`);
    } catch (err: any) {
      console.error(err);
      toast.error('Erro no upload: ' + err.message);
    } finally {
      setIsProcessing(false);
      setProcessStep('');
    }
  };

  const handleDownloadAllZip = async () => {
    const foundItems = searchResults.filter(r => r.found && r.ean !== 'Não encontrado');
    if (foundItems.length === 0) {
      toast.error('Nenhum produto encontrado para baixar.');
      return;
    }

    setIsProcessing(true);
    setProcessStep('Gerando ZIP (isso pode demorar)...');
    const zip = new JSZip();
    const extensions = ['.png', '.PNG', '.jpg', '.JPG', '.jpeg', '.webp', '.WEBP'];

    try {
      for (const item of foundItems) {
        const cleanEan = item.ean.replace(/[^0-9]/g, '');
        const paddedEan = padEan(cleanEan);
        let foundAny = false;
        
        for (const nameToTry of [cleanEan, paddedEan]) {
          if (foundAny) break;
          for (const ext of extensions) {
            if (foundAny) break;
            const filename = `${nameToTry}${ext}`;
            try {
              const { data: blob, error } = await (supabase.storage as any).from('product-images').download(filename);
              if (!error && blob) {
                zip.file(filename, blob);
                foundAny = true;
              }
            } catch (e) { /* ignore */ }
          }
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, 'produtos_macmidia.zip');
      toast.success('ZIP concluído com as imagens encontradas!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar ZIP.');
    } finally {
      setIsProcessing(false);
      setProcessStep('');
    }
  };

  const handleImportCatalog = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setProcessStep('Lendo arquivo de catálogo...');
    
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

      if (jsonData.length === 0) {
        toast.error('O arquivo está vazio.');
        return;
      }

      setProcessStep(`Sincronizando ${jsonData.length} produtos...`);
      
      const batchSize = 100;
      for (let i = 0; i < jsonData.length; i += batchSize) {
        const batch = jsonData.slice(i, i + batchSize).map(row => ({
          ean: String(row.EAN || row.ean || row.codigo || row.CODIGO || '').replace(/[^0-9]/g, ''),
          name: String(row.Descricao || row.descricao || row.nome || row.produto || row.PRODUTO || '').trim(),
          brand: String(row.Marca || row.marca || row.MARCA || '').trim(),
          line: String(row.Linha || row.linha || row.LINHA || '').trim(),
          category: String(row.Categoria || row.categoria || row.CATEGORIA || '').trim(),
          has_qr_code: !!(row.HasQR || row.QRCode || row.qr_code || row.QR),
          description_on_front: !!(row.DescFront || row.DescricaoFrente || row.description_on_front)
        })).filter(row => row.ean && row.name);

        if (batch.length > 0) {
          const { error } = await (supabase
            .from('products') as any)
            .upsert(batch, { onConflict: 'ean' });
          if (error) throw error;
        }
        
        setProcessStep(`Sincronizando: ${Math.min(i + batchSize, jsonData.length)}/${jsonData.length}`);
      }

      const { count } = await (supabase.from('products') as any).select('*', { count: 'exact', head: true });
      setTotalProducts(count || 0);
      toast.success('Catálogo atualizado com sucesso!');
    } catch (err: any) {
      console.error(err);
      toast.error('Erro na importação: ' + err.message);
    } finally {
      setIsProcessing(false);
      setProcessStep('');
    }
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ean = file.name.split('.')[0].replace(/[^0-9]/g, '');
      
      if (!ean) {
        failCount++;
        continue;
      }

      setProcessStep(`Subindo ${i + 1}/${files.length}: ${ean}...`);
      
      try {
        const { error } = await supabase.storage
          .from('product-images')
          .upload(`${ean}.png`, file, { upsert: true });
        
        if (error) throw error;
        successCount++;
      } catch (err) {
        console.error(`Falha no upload de ${file.name}:`, err);
        failCount++;
      }
    }

    setIsProcessing(false);
    setProcessStep('');
    toast.success(`Upload concluído! ${successCount} fotos subidas.`);
    if (failCount > 0) toast.warning(`${failCount} arquivos falharam (nome inválido?).`);
    
    // Refresh current view if there is a search list
    if (searchResults.length > 0) {
      handleBulkSearch();
    }
  };

  // Handle bulk search with Edge Function — V2 Dual-Mode
  const handleBulkSearch = async () => {
    if (!bulkInput.trim()) {
      toast.error('Cole uma lista de produtos primeiro.');
      return;
    }

    setIsProcessing(true);
    setProcessStep('Interpretando produtos com IA...');
    
    try {
      const { data, error } = await supabase.functions.invoke('process-products', {
        body: { bulkInput }
      });

      if (error) throw error;

      setProcessStep('Organizando resultados...');
      const processedResults = (data.results || []).map((res: any) => {
        const found = !!(res.found && res.match);
        const confidence = res.confidence || 'none';
        const isBarcode = res.mode === 'barcode';

        // Image logic: only use if exact (barcode) or high confidence
        let images: string[] = [];
        if (found && (isBarcode || confidence === 'exact' || confidence === 'high' || confidence === 'medium')) {
          images = [getImageUrl(res.match.ean)];
        }

        // Display name: use the one from the edge function (already correct per mode)
        let displayName = res.display_name || res.original || 'Não encontrado';
        displayName = displayName.replace(/\s*[-–—]?\s*R?\$?\s*\d+[,.]\d{2}/gi, '').trim();

        return {
          id: res.match?.id || Math.random(),
          name: displayName,
          ean: res.match?.ean || 'Não encontrado',
          found: res.found,
          images,
          brand: res.match?.brand,
          line: res.match?.line,
          category: res.match?.category,
          confidence,
          confidence_reason: res.confidence_reason,
          warning: res.warning,
          mode: res.mode,
        };
      });

      setSearchResults(processedResults);
      
      const withImage = processedResults.filter((r: any) => r.images.length > 0).length;
      const noImage = processedResults.length - withImage;
      toast.success(`Busca concluída! ${withImage} com imagem, ${noImage} sem imagem.`);
    } catch (err: any) {
      console.error('ERRO DETALHADO:', err);
      const errorMsg = err.message || err.error_description || JSON.stringify(err);
      toast.error(`Erro: ${errorMsg}`);
    } finally {
      setIsProcessing(false);
      setProcessStep('');
    }
  };

  const loadVariations = async (product: any) => {
    setIsProcessing(true);
    try {
      let query = (supabase.from('products') as any).select('*');
      
      if (product.brand && product.line) {
        query = query.eq('brand', product.brand).eq('line', product.line);
      } else {
        const firstWord = product.name.split(' ')[0];
        if (firstWord.length < 3) {
           toast.error('Nome muito curto para busca automática.');
           setIsProcessing(false);
           return;
        }
        query = query.ilike('name', `%${firstWord}%`);
      }

      const { data, error } = await query.neq('ean', product.ean).limit(10);
      
      if (error) throw error;
      setVariations(data || []);
      setShowVariationsFor(product.ean);
    } catch (e: any) {
      toast.error('Erro ao buscar variações: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const swapProduct = (oldEan: string, newProd: any) => {
    setSearchResults(prev => prev.map(item => 
      item.ean === oldEan ? { 
        ...item, 
        name: newProd.name, 
        ean: newProd.ean, 
        found: true, 
        images: [getImageUrl(newProd.ean)],
        brand: newProd.brand,
        line: newProd.line 
      } : item
    ));
    setShowVariationsFor(null);
    toast.success('Produto substituído!');
  };

  const addToStack = (ean: string, imageUrl: string) => {
    setSearchResults(prev => prev.map(item => {
      if (item.ean === ean) {
        if (item.images.includes(imageUrl)) return item;
        return { ...item, images: [...item.images, imageUrl] };
      }
      return item;
    }));
    toast.success('Adicionado à pilha!');
  };

  const removeFromStack = (ean: string, index: number) => {
    setSearchResults(prev => prev.map(item => {
      if (item.ean === ean) {
        return { ...item, images: item.images.filter((_: any, i: number) => i !== index) };
      }
      return item;
    }));
  };

  const handleManualSearch = async (term: string, currentItem: any) => {
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
      setManualResults(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearchingManual(false);
    }
  };

  const handleManualSave = async () => {
    if (!manualEan || !manualName) {
      toast.error('Preencha o nome e o código de barras.');
      return;
    }
    
    setIsProcessing(true);
    try {
      const ean = manualEan.replace(/[^0-9]/g, '');
      const cleanEan = ean.padStart(13, '0'); // Pad if necessary

      // 1. Upload file if selected
      if (manualFile) {
        const { error: storageErr } = await supabase.storage
          .from('product-images')
          .upload(`${ean}.png`, manualFile, { upsert: true });
        if (storageErr) throw storageErr;
      }

      // 2. Upsert text data
      const { error } = await (supabase.from('products') as any).upsert([
        { 
          ean, 
          name: manualName.trim(),
          brand: manualBrand.trim(),
          line: manualLine.trim(),
          category: manualCategory.trim()
        }
      ], { onConflict: 'ean' });

      if (error) throw error;
      
      toast.success('Produto cadastrado/atualizado!');
      setManualEan('');
      setManualName('');
      setManualBrand('');
      setManualLine('');
      setManualCategory('');
      setManualFile(null);
      setIsManualModalOpen(false);
      
      // Refresh count
      const { count } = await (supabase.from('products') as any).select('*', { count: 'exact', head: true });
      setTotalProducts(count || 0);

      // If there's an active search, update it
      if (searchResults.length > 0) {
        setSearchResults(prev => prev.map(item => 
          item.ean === ean ? { ...item, name: manualName, found: true, images: [getImageUrl(ean)] } : item
        ));
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearCatalog = async () => {
    if (!confirm('ATENÇÃO: Isso excluirá TODOS os produtos do catálogo permanentemente. Tem certeza?')) return;
    
    setIsProcessing(true);
    setProcessStep('Limpando catálogo...');
    try {
      const { error } = await supabase.from('products').delete().neq('ean', '0'); // Hack to delete all
      if (error) throw error;
      
      setTotalProducts(0);
      setSearchResults([]);
      toast.success('Catálogo limpo com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao limpar: ' + err.message);
    } finally {
      setIsProcessing(false);
      setProcessStep('');
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      {/* Top Header */}
      <header className="p-6 border-b border-white/5 bg-[#121214] sticky top-0 z-20">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-xl bg-white/5">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-black tracking-tighter flex items-center gap-3">
                <Package className="w-6 h-6 text-red-600" />
                Catálogo de Produtos
              </h1>
              <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest mt-1">Busca Inteligente & Assets</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              onClick={() => setIsManualModalOpen(true)}
              className="bg-red-600/10 hover:bg-red-600/20 rounded-xl text-xs font-bold border border-red-600/20 text-red-500"
            >
              <Plus className="w-4 h-4 mr-2" /> Novo Produto
            </Button>
            <Button 
              variant="outline" 
              onClick={() => document.getElementById('bulk-image-upload')?.click()}
              className="bg-white/5 rounded-xl text-xs font-bold border border-white/5"
            >
              <Upload className="w-4 h-4 mr-2 text-green-500" /> Subir Fotos (Lote)
            </Button>
            <input 
              type="file" 
              id="bulk-image-upload"
              multiple 
              className="hidden" 
              onChange={handleBulkUpload}
              accept="image/*"
            />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left Column: Input */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[#121214] rounded-3xl p-6 border border-white/5 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <Sparkles className="w-32 h-32 text-red-600" />
            </div>
            
            <label className="text-xs font-black uppercase tracking-[0.2em] text-white/30 block mb-4">Cole sua lista de produtos</label>
            <Textarea 
              value={bulkInput}
              onChange={e => setBulkInput(e.target.value)}
              placeholder="Ex: Coca cola 2L&#10;Arroz Tio Jorge 5kg&#10;Sabonete Dove..."
              className="bg-black/20 border-white/10 rounded-2xl min-h-[300px] text-sm focus:ring-red-500 p-6 leading-relaxed custom-scrollbar"
            />

            <Button 
              onClick={handleBulkSearch}
              disabled={isProcessing || !bulkInput.trim()}
              className="w-full h-14 mt-6 bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-lg shadow-red-900/20"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-3 animate-spin" />
                  {processStep}
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-3" />
                  Buscar Inteligente
                </>
              )}
            </Button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
              <p className="text-[10px] text-white/30 font-bold uppercase mb-1">Base Interna</p>
              <p className="text-xl font-black tracking-tighter">{totalProducts} Itens</p>
            </div>
            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
              <p className="text-[10px] text-white/30 font-bold uppercase mb-1">Sessão Atual</p>
              <p className="text-xl font-black tracking-tighter">{searchResults.length} Encontrados</p>
            </div>
          </div>
        </div>

        {/* Right Column: Results */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <Input 
                placeholder="Filtrar resultados..." 
                className="bg-white/5 border-white/10 pl-10 rounded-xl h-10 text-sm"
              />
            </div>
            <div className="flex gap-2 bg-white/5 p-1 rounded-xl">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setViewMode('grid')}
                className={`w-8 h-8 rounded-lg ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-white/30'}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setViewMode('list')}
                className={`w-8 h-8 rounded-lg ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-white/30'}`}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {searchResults.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Button 
                  variant="secondary" 
                  onClick={handleDownloadAllZip}
                  className="bg-white/10 text-white rounded-xl h-10 text-xs font-bold px-5"
                >
                  <Download className="w-3.5 h-3.5 mr-2" /> Baixar Tudo (ZIP)
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    const links = searchResults.filter(r => r.found).map(r => getImageUrl(r.ean)).join('\n');
                    navigator.clipboard.writeText(links);
                    toast.success('Todos os links copiados!');
                  }}
                  className="bg-white/5 text-white/50 hover:text-white rounded-xl h-10 text-xs font-bold px-5"
                >
                  <Copy className="w-3.5 h-3.5 mr-2" /> Copiar Links
                </Button>
              </div>

              <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 gap-4' : 'space-y-3'}>
                {searchResults.map((item, i) => (
                  <div key={i} className={`group bg-[#121214] border border-white/5 rounded-2xl overflow-hidden hover:border-red-600/30 transition-all ${viewMode === 'list' ? 'flex items-center p-3 gap-4' : ''}`}>
                    <div className={`${viewMode === 'grid' ? 'aspect-square w-full' : 'w-16 h-16'} bg-black/40 relative flex items-center justify-center`}>
                      {item.images.length === 0 ? (
                        <ImageIcon className="w-8 h-8 text-white/5" />
                      ) : (
                        item.images.slice(0, 3).reverse().map((img: string, idx: number, arr: any[]) => {
                          const total = arr.length;
                          const revIdx = total - 1 - idx;
                          return (
                            <img 
                              key={idx}
                              src={img} 
                              className="absolute object-contain p-2 transition-all shadow-xl bg-[#121214] rounded-lg border border-white/5"
                              style={{
                                width: '80%', height: '80%',
                                transform: `translateX(${revIdx * 10}px) translateY(${-revIdx * 5}px)`,
                                zIndex: 10 - revIdx,
                                opacity: 1 - revIdx * 0.2
                              }}
                            />
                          );
                        })
                      )}
                      {item.images.length > 3 && (
                        <div className="absolute right-2 bottom-2 bg-red-600 rounded-full w-5 h-5 flex items-center justify-center text-[9px] font-black z-20 border-2 border-[#121214]">
                          +{item.images.length - 3}
                        </div>
                      )}
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all scale-90">
                        <input 
                          type="file" 
                          id={`upload-${item.ean}`}
                          className="hidden" 
                          onChange={(e) => handleDirectUpload(e, item.ean)}
                          accept="image/*"
                        />
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          onClick={(e) => { e.stopPropagation(); document.getElementById(`upload-${item.ean}`)?.click(); }}
                          className="w-7 h-7 bg-black/60 backdrop-blur rounded-lg"
                        >
                          <Upload className="w-3.5 h-3.5" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            const url = getImageUrl(item.ean);
                            if (url) window.open(url, '_blank');
                          }}
                          className="w-7 h-7 bg-black/60 backdrop-blur rounded-lg"
                        >
                          <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          onClick={(e) => { e.stopPropagation(); handleCopyLink(item.ean); }}
                          className="w-7 h-7 bg-black/60 backdrop-blur rounded-lg"
                        >
                          <LinkIcon className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="p-3 space-y-1">
                      <p className="text-[11px] font-bold text-white leading-tight uppercase line-clamp-2">{item.name}</p>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-[9px] font-mono text-white/30">{item.ean}</p>
                          {item.confidence === 'exact' && <span className="text-[7px] bg-green-600/20 text-green-400 px-1 rounded font-black uppercase border border-green-600/30">EXATO</span>}
                          {item.confidence === 'high' && <span className="text-[7px] bg-green-600/15 text-green-400 px-1 rounded font-black uppercase border border-green-600/20">ALTA</span>}
                          {item.confidence === 'medium' && <span className="text-[7px] bg-amber-600/20 text-amber-400 px-1 rounded font-black uppercase border border-amber-600/30">MÉDIA</span>}
                          {item.confidence === 'low' && <span className="text-[7px] bg-red-600/20 text-red-400 px-1 rounded font-black uppercase border border-red-600/30">BAIXA</span>}
                          {item.confidence === 'none' && <span className="text-[7px] bg-white/5 text-white/25 px-1 rounded font-black uppercase border border-white/10">N/A</span>}
                          {item.mode === 'barcode' && <span className="text-[7px] bg-blue-600/15 text-blue-400 px-1 rounded font-black uppercase border border-blue-600/20">EAN</span>}
                        </div>
                        <button 
                          onClick={() => loadVariations(item)}
                          className="text-[9px] font-black uppercase text-blue-500 hover:text-blue-400 flex items-center gap-1 transition-colors bg-blue-500/10 px-1.5 py-0.5 rounded"
                        >
                          <Zap className="w-2.5 h-2.5" /> Variações
                        </button>
                      </div>
                      {item.warning && (
                        <p className="text-[8px] text-amber-400/60 font-bold mt-0.5">⚠ {item.warning}</p>
                      )}

                      {/* Variation Overlay */}
                      {showVariationsFor === item.ean && (
                        <div className="absolute inset-0 z-[60] bg-[#121214] border-2 border-blue-500/20 rounded-2xl flex flex-col p-4 animate-in slide-in-from-right-full duration-300 shadow-2xl">
                          <div className="flex items-center justify-between mb-4">
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/40 flex items-center gap-2">
                               <Sparkles className="w-3 h-3 text-blue-500" /> Variações Inteligentes
                            </span>
                            <button onClick={() => { setShowVariationsFor(null); setManualSearch(''); setManualResults([]); }} className="p-1 hover:bg-white/5 rounded-lg text-white/20 hover:text-white">
                               <X className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Manual Search Bar */}
                          <div className="relative mb-4">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-white/20" />
                            <Input 
                              value={manualSearch}
                              onChange={e => handleManualSearch(e.target.value, item)}
                              placeholder="Pesquisa manual (nome/EAN)..."
                              className="bg-black/40 border-white/5 pl-9 h-8 text-[10px] rounded-xl placeholder:text-white/10"
                            />
                            {isSearchingManual && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 animate-spin text-blue-500" />}
                          </div>

                          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
                            {/* Manual Search Results */}
                            {manualResults.length > 0 && (
                               <div className="space-y-2">
                                 <span className="text-[8px] font-black uppercase text-blue-500 tracking-tighter flex items-center gap-1">
                                    <Search className="w-2 h-2" /> Resultados Manuais
                                 </span>
                                 {manualResults.map(v => (
                                   <div key={v.ean} className="flex items-center gap-2 p-2 bg-blue-500/5 rounded-lg border border-blue-500/10 group">
                                      <img src={getImageUrl(v.ean)} className="w-8 h-8 object-contain bg-white/10 rounded" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[8px] font-black text-white/80 truncate uppercase">{v.name}</p>
                                        <p className="text-[7px] font-mono text-white/20">{v.ean}</p>
                                      </div>
                                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                         <Button onClick={() => swapProduct(item.ean, v)} className="h-6 px-2 bg-blue-600 hover:bg-blue-700 text-[8px] font-black uppercase">Trocar</Button>
                                         <Button onClick={() => addToStack(item.ean, getImageUrl(v.ean))} className="h-6 px-2 bg-white/10 hover:bg-white/20 text-[8px] font-black uppercase">Pilha</Button>
                                      </div>
                                   </div>
                                 ))}
                               </div>
                            )}

                            {/* Automatic Suggestions */}
                            <span className="text-[8px] font-black uppercase text-white/20 tracking-tighter">Sugestões de Linha</span>
                            {variations.length > 0 ? variations.map(v => (
                              <div 
                                key={v.ean}
                                onClick={() => swapProduct(item.ean, v)}
                                className="flex items-center gap-2 p-2 bg-white/5 rounded-lg border border-white/5 hover:border-blue-500/40 cursor-pointer transition-all group"
                              >
                                <img src={getImageUrl(v.ean)} className="w-8 h-8 object-contain bg-white/10 rounded" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[8px] font-black text-white/80 truncate uppercase group-hover:text-blue-500">{v.name}</p>
                                  <p className="text-[7px] font-mono text-white/20">{v.ean}</p>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity text-[10px]">
                                   <Button onClick={(e) => { e.stopPropagation(); swapProduct(item.ean, v); }} size="icon" variant="ghost" className="h-6 w-6 rounded-lg bg-white/5 hover:bg-green-500/20 hover:text-green-400">
                                      <CheckCircle2 className="w-3 h-3" />
                                   </Button>
                                   <Button onClick={(e) => { e.stopPropagation(); addToStack(item.ean, getImageUrl(v.ean)); }} size="icon" variant="ghost" className="h-6 w-6 rounded-lg bg-white/5 hover:bg-blue-500/20 hover:text-blue-400">
                                      <Plus className="w-3 h-3" />
                                   </Button>
                                </div>
                              </div>
                            )) : !isSearchingManual && manualResults.length === 0 && (
                              <p className="text-[9px] text-white/20 italic text-center py-4 uppercase font-bold tracking-widest">Nenhuma sugestão.</p>
                            )}
                            
                            {/* Current Stack Management */}
                            {item.images && item.images.length > 0 && (
                              <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
                                <span className="text-[8px] font-black uppercase text-white/20 tracking-widest">Pilha Atual</span>
                                <div className="flex flex-wrap gap-2">
                                  {item.images.map((img: string, idx: number) => (
                                    <div key={idx} className="relative group/img bg-white/5 p-1 rounded-lg border border-white/10">
                                      <img src={img} className="w-10 h-10 object-contain" />
                                      <button onClick={() => removeFromStack(item.ean, idx)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover/img:opacity-100 transition-opacity">
                                        <X className="w-2.5 h-2.5" />
                                      </button>
                                    </div>
                                  ))}
                                  <button onClick={() => {
                                    const input = document.createElement('input');
                                    input.type = 'file';
                                    input.accept = 'image/*';
                                    input.onchange = (e) => {
                                      const file = (e.target as HTMLInputElement).files?.[0];
                                      if (file) addToStack(item.ean, URL.createObjectURL(file));
                                    };
                                    input.click();
                                  }} className="w-10 h-10 border-2 border-dashed border-white/10 rounded-lg flex items-center justify-center text-white/20 hover:text-white hover:border-white/30 transition-all">
                                    <Plus className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white/5 rounded-3xl p-20 text-center border-2 border-dashed border-white/5 mt-4">
              <ImageIcon className="w-12 h-12 text-white/10 mx-auto mb-4" />
              <p className="text-white/30 text-sm italic">Nenhum resultado para exibir.<br/>Cole uma lista ao lado para começar.</p>
            </div>
          )}
        </div>
      </main>

      {/* Manual Product Dialog */}
      <Dialog open={isManualModalOpen} onOpenChange={setIsManualModalOpen}>
        <DialogContent className="bg-[#121214] border-white/10 text-white rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-black tracking-tighter flex items-center gap-2">
              <Plus className="w-5 h-5 text-red-600" /> Novo Produto
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-white/40">Código de Barras (EAN)</Label>
              <Input 
                value={manualEan}
                onChange={e => setManualEan(e.target.value)}
                placeholder="789..."
                className="bg-black/40 border-white/10 rounded-xl h-12"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-white/40">Nome do Produto / Descrição</Label>
              <Input 
                value={manualName}
                onChange={e => setManualName(e.target.value)}
                placeholder="Ex: Coca Cola 2L"
                className="bg-black/40 border-white/10 rounded-xl h-12 uppercase font-bold text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-white/40">Marca</Label>
                <Input value={manualBrand} onChange={e => setManualBrand(e.target.value)} placeholder="Ex: Monster" className="bg-black/40 border-white/10 rounded-xl h-10 uppercase font-bold text-[10px]" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-white/40">Linha / Modelo</Label>
                <Input value={manualLine} onChange={e => setManualLine(e.target.value)} placeholder="Ex: Energético" className="bg-black/40 border-white/10 rounded-xl h-10 uppercase font-bold text-[10px]" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-white/40">Categoria</Label>
              <Input value={manualCategory} onChange={e => setManualCategory(e.target.value)} placeholder="Ex: Bebidas" className="bg-black/40 border-white/10 rounded-xl h-10 uppercase font-bold text-[10px]" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-white/40">Foto do Produto (PNG/JPG)</Label>
              <div 
                onClick={() => document.getElementById('manual-file-input')?.click()}
                className="border-2 border-dashed border-white/5 bg-black/20 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-red-600/30 transition-all group"
              >
                {manualFile ? (
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-green-500" />
                    <span className="text-[10px] font-bold text-white/60 truncate max-w-[200px]">{manualFile.name}</span>
                  </div>
                ) : (
                  <>
                    <ImageIcon className="w-5 h-5 text-white/10 group-hover:text-red-600/50 transition-colors" />
                    <span className="text-[9px] font-bold text-white/20 uppercase">Clique para selecionar foto</span>
                  </>
                )}
                <input 
                  type="file" 
                  id="manual-file-input" 
                  className="hidden" 
                  accept="image/*"
                  onChange={e => setManualFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>
            <p className="text-[9px] text-white/20 italic">
              * Se o código de barras já existir, as informações serão atualizadas.
            </p>
          </div>
          <DialogFooter>
            <Button 
              onClick={handleManualSave}
              disabled={isProcessing}
              className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest text-[10px] rounded-xl"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar no Catálogo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
