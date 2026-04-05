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
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

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
        item.ean === ean ? { ...item, image: newUrl, found: true } : item
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
          description: String(row.Descricao || row.descricao || row.nome || row.produto || row.PRODUTO || '').trim()
        })).filter(row => row.ean && row.description);

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

  // Handle bulk search with Edge Function
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
      const processedResults = (data.results || []).map((res: any) => ({
        id: res.match?.id || Math.random(),
        name: res.match?.name || res.original,
        ean: res.match?.ean || 'Não encontrado',
        found: res.found,
        image: res.found ? getImageUrl(res.match.ean) : null
      }));

      setSearchResults(processedResults);
      toast.success('Busca concluída!');
    } catch (err: any) {
      console.error('ERRO DETALHADO:', err);
      const errorMsg = err.message || err.error_description || JSON.stringify(err);
      toast.error(`Erro: ${errorMsg}`);
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
            <Button 
              variant="outline" 
              onClick={async () => {
                const { data, error } = await supabase.storage.from('product-images').list();
                if (error) toast.error('Erro ao listar: ' + error.message);
                else {
                  const names = data.slice(0, 10).map(f => f.name).join(', ');
                  toast.info(`Status do servidor: ${names ? 'Arquivos presentes' : 'Pasta vazia'}`);
                }
              }}
              className="bg-white/5 rounded-xl text-xs font-bold border border-white/5"
            >
              <Search className="w-4 h-4 mr-2 text-yellow-500" /> Diagnosticar Storage
            </Button>
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
                    <div className={`${viewMode === 'grid' ? 'aspect-square w-full' : 'w-16 h-16'} bg-black/40 relative`}>
                      <img 
                        src={item.image} 
                        className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          if (target.dataset.triedAll) return;
                          
                          const extensions = ['.png', '.PNG', '.jpg', '.JPG', '.jpeg', '.webp', '.WEBP'];
                          const currentExt = extensions.find(ext => target.src.endsWith(ext));
                          const currentIndex = currentExt ? extensions.indexOf(currentExt) : -1;
                          
                          if (currentIndex < extensions.length - 1) {
                            const nextExt = extensions[currentIndex + 1];
                            target.src = target.src.substring(0, target.src.lastIndexOf('.')) + nextExt;
                          } else {
                            target.dataset.triedAll = 'true';
                            target.src = 'https://tl-storage.b-cdn.net/placeholder-image.png';
                            target.classList.add('opacity-20', 'grayscale');
                          }
                        }}
                      />
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
                      <p className="text-[9px] font-mono text-white/30">{item.ean}</p>
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
    </div>
  );
}
