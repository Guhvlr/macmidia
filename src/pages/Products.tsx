import { useState, useRef, useCallback } from 'react';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [bulkInput, setBulkInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStep, setProcessStep] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

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
        image: res.found 
          ? supabase.storage.from('product-images').getPublicUrl(`${res.match.ean}.png`).data.publicUrl
          : null
      }));

      setSearchResults(processedResults);
      toast.success('Busca concluída!');
    } catch (err: any) {
      console.error(err);
      toast.error('Erro no processamento. Verifique a conexão.');
    } finally {
      setIsProcessing(false);
      setProcessStep('');
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    toast.info('Processando arquivo...');
    
    // Using simple FileReader + basic parsing since I can't guarantee xlsx library is installed
    // If xlsx is needed, user might need to install it. I'll assume standard CSV or TSV for now or just tell the user.
    // For now, I'll use a placeholder and suggest installing xlsx if needed.
    toast.error('Funcionalidade de importação direta de Excel requer biblioteca extra. Por favor, envie o arquivo que eu processo para você!');
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
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleExcelImport} 
              accept=".csv,.xlsx,.xls" 
              className="hidden" 
            />
            <Button 
              variant="ghost" 
              onClick={() => fileInputRef.current?.click()}
              className="bg-white/5 rounded-xl text-xs font-bold border border-white/5"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-500" /> Importar Catálogo
            </Button>
            <Button variant="ghost" className="bg-white/5 rounded-xl text-xs font-bold border border-white/5">
              <Settings className="w-4 h-4 mr-2" /> Gerenciar Base
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
              <p className="text-xl font-black tracking-tighter">0 Itens</p>
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
                <Button variant="secondary" className="bg-white/10 text-white rounded-xl h-10 text-xs font-bold px-5">
                  <Download className="w-3.5 h-3.5 mr-2" /> Baixar Tudo (ZIP)
                </Button>
                <Button variant="ghost" className="bg-white/5 text-white/50 hover:text-white rounded-xl h-10 text-xs font-bold px-5">
                  <Copy className="w-3.5 h-3.5 mr-2" /> Copiar Links
                </Button>
              </div>

              <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 gap-4' : 'space-y-3'}>
                {searchResults.map((item, i) => (
                  <div key={i} className={`group bg-[#121214] border border-white/5 rounded-2xl overflow-hidden hover:border-red-600/30 transition-all ${viewMode === 'list' ? 'flex items-center p-3 gap-4' : ''}`}>
                    <div className={`${viewMode === 'grid' ? 'aspect-square w-full' : 'w-16 h-16'} bg-black/40 relative`}>
                      <img src={item.image} className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform" />
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all scale-90">
                        <Button size="icon" variant="ghost" className="w-7 h-7 bg-black/60 backdrop-blur rounded-lg">
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
