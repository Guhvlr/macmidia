import React from 'react';
import { X, Trash2, Layers, PlusCircle, CheckSquare, ZoomIn, Image as ImageIcon, Save, Database, Edit3, Package, Barcode, DollarSign, Tag, User, Users, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ProductItem } from '../../context/OfferContext';
import { ProductImageWithFormat } from '../ProductImageWithFormat';
import { ConfidenceBadge } from './ConfidenceBadge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProductDetailPanelProps {
  product: ProductItem;
  isOpen: boolean;
  onClose: () => void;
  // Image props
  bgPreview?: string;
  resolvedUrl?: string;
  setResolvedUrl: (url: string) => void;
  handleFormatChange: (id: string, format: 'JPG' | 'PNG') => void;
  imageFormat: 'JPG' | 'PNG';
  onExpandImage: (url: string) => void;
  // Actions
  toggleSuffix: (id: string) => void;
  onLoadVariations: (p: ProductItem) => void;
  isLoadingVariations: boolean;
  onManualImageUpload: (id: string) => void;
  onRemove: (id: string) => void;
  isProcessing: boolean;
  // Creation
  isCreatingThis: boolean;
  setCreatingThis: (id: string | null) => void;
  createData: { name: string; ean: string; file: File | null };
  setCreateData: (data: any) => void;
  isCreating: boolean;
  onConfirmCreate: (id: string) => void;
  onUpdateProduct: (id: string, updates: Partial<ProductItem>, saveToDb?: boolean) => void;
}

export const ProductDetailPanel = React.memo(({
  product,
  isOpen,
  onClose,
  bgPreview,
  resolvedUrl,
  setResolvedUrl,
  handleFormatChange,
  imageFormat,
  onExpandImage,
  toggleSuffix,
  onLoadVariations,
  isLoadingVariations,
  onManualImageUpload,
  onRemove,
  isProcessing,
  isCreatingThis,
  setCreatingThis,
  createData,
  setCreateData,
  isCreating,
  onConfirmCreate,
  onUpdateProduct,
  clients = []
}: ProductDetailPanelProps & { clients?: any[] }) => {
  const [activeTab, setActiveTab] = React.useState<'info' | 'variations'>('info');
  const [clientVariations, setClientVariations] = React.useState<any[]>([]);
  const [isLoadingClientVars, setIsLoadingClientVars] = React.useState(false);
  const [deleteConfirmVar, setDeleteConfirmVar] = React.useState<{ id: string, name: string, image_path?: string } | null>(null);

  const [editData, setEditData] = React.useState({
    name: product.name,
    ean: product.ean,
    price: product.price,
    suffix: product.suffix,
    client_name: product.client_name || ''
  });

  // Sync when product changes
  React.useEffect(() => {
    setEditData({
      name: product.name,
      ean: product.ean,
      price: product.price,
      suffix: product.suffix,
      client_name: product.client_name || ''
    });
    setActiveTab('info');
  }, [product.name, product.ean, product.price, product.suffix, product.client_name]);

  // Fetch client variations when tab changes or product EAN changes
  React.useEffect(() => {
    if (activeTab === 'variations' && product.ean && product.ean !== 'N/A' && product.ean !== 'NA') {
      fetchClientVariations();
    }
  }, [activeTab, product.ean]);

  const fetchClientVariations = async () => {
    setIsLoadingClientVars(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('ean', product.ean);
      
      if (error) throw error;
      setClientVariations(data || []);
    } catch (e) {
      console.error('Error fetching client variations:', e);
    } finally {
      setIsLoadingClientVars(false);
    }
  };

  const isLowConfidence = ['low', 'none'].includes(product.confidence);

  const handleSaveLocal = () => {
    onUpdateProduct(product.id, {
      ...editData,
      name: editData.name.toUpperCase()
    }, false);
  };

  const handleSaveDb = () => {
    onUpdateProduct(product.id, {
      ...editData,
      name: editData.name.toUpperCase()
    }, true);
  };

  const executeDeleteVariation = async () => {
    if (!deleteConfirmVar) return;
    try {
      const toastId = toast.loading('Excluindo variação...');
      
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', deleteConfirmVar.id);

      if (error) throw error;

      // Also delete image from storage if it exists
      if (deleteConfirmVar.image_path) {
        await supabase.storage
          .from('product-images')
          .remove([deleteConfirmVar.image_path]);
      }

      setClientVariations(prev => prev.filter(v => v.id !== deleteConfirmVar.id));
      toast.success('Variação e imagem excluídas com sucesso!', { id: toastId });
    } catch (error: any) {
      toast.error('Erro ao excluir variação: ' + error.message);
    } finally {
      setDeleteConfirmVar(null);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-[200] bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="fixed top-0 right-0 z-[201] h-full w-full max-w-[520px] bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between shrink-0 bg-zinc-900/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center">
              <Package className="w-4 h-4 text-red-500" />
            </div>
            <div>
              <h2 className="text-[14px] font-semibold tracking-tight text-zinc-100">Detalhes do Produto</h2>
              <p className="text-[11px] text-zinc-500 font-medium mt-0.5">#{product.ean}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-all border border-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800 bg-zinc-900/10 shrink-0">
          <button 
            onClick={() => setActiveTab('info')}
            className={`flex-1 py-3 text-[11px] font-bold tracking-wider transition-all relative ${activeTab === 'info' ? 'text-red-500' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            INFORMAÇÕES
            {activeTab === 'info' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500" />}
          </button>
          <button 
            onClick={() => setActiveTab('variations')}
            className={`flex-1 py-3 text-[11px] font-bold tracking-wider transition-all relative ${activeTab === 'variations' ? 'text-red-500' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            PRODUTOS POR CLIENTE
            {clientVariations.length > 1 && <span className="absolute top-2 right-4 w-2 h-2 bg-amber-500 rounded-full animate-pulse" />}
            {activeTab === 'variations' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500" />}
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {activeTab === 'info' ? (
            <>
          
          {/* Image Section */}
          <div className="p-6 border-b border-zinc-800">
            <div className="relative group rounded-2xl overflow-hidden bg-zinc-900/50 border border-zinc-800/60 aspect-square max-w-[280px] mx-auto flex items-center justify-center p-2">
              <ProductImageWithFormat 
                src={product.images[0]} 
                previewBase64={bgPreview}
                onFormatChange={(f) => handleFormatChange(product.id, f)}
                onUrlResolved={setResolvedUrl}
                isFallback={!product.images[0]}
                className="w-full h-full object-contain"
              />
              {/* Zoom button */}
              <button 
                onClick={() => onExpandImage(bgPreview || resolvedUrl || product.images[0])}
                className="absolute top-3 right-3 w-9 h-9 bg-black/60 backdrop-blur-md rounded-xl flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            {/* Format Toggle */}
            <div className="flex items-center justify-center gap-2 mt-4">
              <span className="text-[11px] font-semibold text-zinc-500 mr-2">Formato:</span>
              <button 
                onClick={() => handleFormatChange(product.id, 'JPG')} 
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${imageFormat === 'JPG' ? 'bg-amber-500 text-amber-950 shadow-md shadow-amber-500/20' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
              >
                JPG
              </button>
              <button 
                onClick={() => handleFormatChange(product.id, 'PNG')} 
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${imageFormat === 'PNG' ? 'bg-purple-500 text-white shadow-md shadow-purple-500/20' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
              >
                PNG
              </button>
            </div>

            {/* Image Actions */}
            <div className="flex items-center justify-center gap-2 mt-3">
              <Button 
                onClick={() => onManualImageUpload(product.id)}
                className="h-9 px-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800/60 rounded-xl text-[11px] font-semibold text-zinc-300 transition-all shadow-sm"
              >
                <PlusCircle className="w-3.5 h-3.5 mr-2" />
                Trocar Foto
              </Button>
            </div>
          </div>

          {/* Product Info Section */}
          <div className="p-6 border-b border-zinc-800 space-y-4">
            <h3 className="text-[12px] font-semibold text-zinc-400 flex items-center gap-2">
              <Edit3 className="w-3.5 h-3.5" />
              Informações do Produto
            </h3>

            {/* Status Badge */}
            <div className="flex items-center gap-2">
              <ConfidenceBadge product={product} />
              {isLowConfidence && (
                <span className="text-[10px] text-amber-500 font-semibold tracking-wide animate-pulse">
                  ⚠️ Verifique os dados
                </span>
              )}
            </div>

            {/* Editable Fields */}
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-zinc-500 flex items-center gap-1.5 mb-1.5 ml-1">
                  <Tag className="w-3 h-3" /> Nome do Produto
                </label>
                <Input 
                  value={editData.name} 
                  onChange={e => setEditData({...editData, name: e.target.value})}
                  className="bg-zinc-900 border-zinc-800/60 h-11 text-[13px] font-medium text-zinc-100 rounded-xl focus:border-red-500/50 shadow-sm"
                  placeholder="Nome do produto"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-zinc-500 flex items-center gap-1.5 mb-1.5 ml-1">
                    <Barcode className="w-3 h-3" /> EAN
                  </label>
                  <Input 
                    value={editData.ean} 
                    onChange={e => setEditData({...editData, ean: e.target.value})}
                    className="bg-zinc-900 border-zinc-800/60 h-11 text-[13px] font-medium text-zinc-100 rounded-xl font-mono focus:border-red-500/50 shadow-sm"
                    placeholder="789..."
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-zinc-500 flex items-center gap-1.5 mb-1.5 ml-1">
                    <DollarSign className="w-3 h-3" /> Preço
                  </label>
                  <div className="flex gap-2">
                    <Input 
                      value={editData.price} 
                      onChange={e => setEditData({...editData, price: e.target.value})}
                      className="bg-zinc-900 border-zinc-800/60 h-11 text-[13px] font-medium text-zinc-100 rounded-xl focus:border-red-500/50 flex-1 shadow-sm"
                      placeholder="R$ 0,00"
                    />
                    <button 
                      onClick={() => toggleSuffix(product.id)} 
                      className="h-11 px-3 bg-zinc-900 border border-zinc-800/60 rounded-xl text-[11px] font-semibold text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-all whitespace-nowrap shadow-sm"
                    >
                      /{product.suffix}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-500 flex items-center gap-1.5 mb-1.5 ml-1">
                  <User className="w-3 h-3" /> Cliente Vinculado
                </label>
                <select 
                  value={editData.client_name}
                  onChange={e => setEditData({...editData, client_name: e.target.value})}
                  className="w-full bg-zinc-900 border border-zinc-800/60 h-11 px-4 text-[13px] font-medium text-zinc-100 rounded-xl focus:border-red-500/50 shadow-sm outline-none appearance-none cursor-pointer hover:bg-zinc-800/50 transition-all"
                >
                  <option value="">Global (Disponível para todos)</option>
                  {clients.map((c: any) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Save Buttons */}
            <div className="flex gap-2 pt-2">
              <Button 
                onClick={handleSaveLocal}
                className="flex-1 h-10 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800/60 text-zinc-300 rounded-xl text-[11px] font-semibold transition-all shadow-sm"
              >
                <Save className="w-3.5 h-3.5 mr-2" />
                Salvar Local
              </Button>
              <Button 
                onClick={handleSaveDb}
                className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[11px] font-semibold transition-all shadow-md shadow-emerald-900/20"
              >
                <Database className="w-3.5 h-3.5 mr-2" />
                Salvar no BD
              </Button>
            </div>
          </div>

          {/* Advanced Actions Section */}
          <div className="p-6 border-b border-zinc-800 space-y-3">
            <h3 className="text-[12px] font-semibold text-zinc-400 flex items-center gap-2">
              <Layers className="w-3.5 h-3.5" />
              Ações Avançadas
            </h3>

            <Button 
              onClick={() => onLoadVariations(product)} 
              disabled={isProcessing}
              className="w-full h-11 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-400 rounded-xl text-[11px] font-semibold transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <Layers className="w-4 h-4" />
              Buscar Variações
            </Button>

            {isLowConfidence && (
              <Button 
                onClick={() => {
                  setCreateData({ 
                    name: product.name, 
                    ean: product.ean === 'N/A' || product.ean === 'NA' ? '' : product.ean, 
                    file: null,
                    client_name: product.client_name || ''
                  });
                  setCreatingThis(isCreatingThis ? null : product.id);
                }}
                className="w-full h-11 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-500 rounded-xl text-[11px] font-semibold transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <PlusCircle className="w-4 h-4" />
                {isCreatingThis ? 'Cancelar Cadastro' : 'Cadastrar Produto Novo'}
              </Button>
            )}

            {/* Inline Creation Form */}
            {isCreatingThis && (
              <div className="p-4 bg-zinc-900/30 rounded-xl border border-zinc-800/60 space-y-3 animate-in fade-in slide-in-from-top-2">
                <h4 className="text-[11px] font-semibold text-amber-500 flex items-center gap-2">
                  <PlusCircle className="w-3.5 h-3.5" /> Novo Cadastro
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-medium text-zinc-500 block mb-1">Cliente Vinculado</label>
                    <select 
                      disabled={isCreating} 
                      value={createData.client_name || ''} 
                      onChange={e => setCreateData({...createData, client_name: e.target.value})} 
                      className="w-full bg-zinc-950 border border-zinc-800 h-10 px-3 text-[12px] font-medium text-zinc-100 rounded-xl shadow-sm outline-none cursor-pointer"
                    >
                      <option value="">Global (Disponível para todos)</option>
                      {clients.map((c: any) => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-zinc-500 block mb-1">Descrição Oficial</label>
                    <Input 
                      disabled={isCreating} 
                      value={createData.name} 
                      onChange={e => setCreateData({...createData, name: e.target.value})} 
                      placeholder="Ex: ITEM TESTE" 
                      className="bg-zinc-950 border-zinc-800 h-10 text-[12px] font-medium text-zinc-100 rounded-xl shadow-sm" 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-zinc-500 block mb-1">EAN (GTIN)</label>
                    <Input 
                      disabled={isCreating} 
                      value={createData.ean} 
                      onChange={e => setCreateData({...createData, ean: e.target.value})} 
                      placeholder="789..." 
                      className="bg-zinc-950 border-zinc-800 h-10 text-[12px] font-medium text-zinc-100 rounded-xl shadow-sm" 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-zinc-500 block mb-1">Foto</label>
                    <input 
                      type="file" 
                      id={`file-panel-${product.id}`} 
                      className="hidden" 
                      onChange={e => setCreateData({...createData, file: e.target.files?.[0] || null})} 
                    />
                    <label htmlFor={`file-panel-${product.id}`} className="flex items-center justify-between bg-zinc-950 border border-zinc-800 h-10 px-4 rounded-xl cursor-pointer hover:bg-zinc-900 transition-colors shadow-sm">
                      <span className="text-[11px] text-zinc-400 font-medium truncate">{createData.file ? createData.file.name : 'Selecionar...'}</span>
                      <ImageIcon className="w-3.5 h-3.5 text-zinc-500" />
                    </label>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button onClick={() => setCreatingThis(null)} variant="ghost" className="h-9 px-4 rounded-xl text-[11px] font-semibold text-zinc-400 hover:text-zinc-100">Cancelar</Button>
                  <Button onClick={() => onConfirmCreate(product.id)} disabled={isCreating} className="h-9 px-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[11px] font-semibold shadow-sm">Cadastrar</Button>
                </div>
              </div>
            )}
          </div>

          {/* Danger Zone */}
          <div className="p-6">
            <Button 
              onClick={() => { onRemove(product.id); onClose(); }}
              className="w-full h-11 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 rounded-xl text-[11px] font-semibold transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <Trash2 className="w-4 h-4" />
              Remover Produto da Lista
            </Button>
          </div>
        </>
      ) : (
        <div className="p-6 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[13px] font-semibold text-zinc-200">Variações de Cadastro</h3>
              <p className="text-[11px] text-zinc-500 mt-1">Existem {clientVariations.length} registros para o EAN #{product.ean}</p>
            </div>
            {isLoadingClientVars && <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />}
          </div>

          {clientVariations.length > 1 && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-200/80 leading-relaxed font-medium">
                Este código possui variações cadastradas. Escolha manualmente qual versão usar nesta oferta.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {clientVariations.map((v: any) => {
              const isCurrent = v.name === product.name && (v.client_name || '') === (product.client_name || '');
              return (
                <div 
                  key={v.id} 
                  className={`p-4 rounded-2xl border transition-all ${isCurrent ? 'bg-red-500/5 border-red-500/30 ring-1 ring-red-500/20' : 'bg-zinc-900/30 border-zinc-800 hover:bg-zinc-900/60 hover:border-zinc-700'}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="w-12 h-12 rounded-xl bg-zinc-800/50 border border-zinc-800 shrink-0 flex items-center justify-center overflow-hidden p-1">
                      <ProductImageWithFormat 
                        src={v.image_path ? `https://ebvvmddizsggrqasnnvv.supabase.co/storage/v1/object/public/product-images/${v.image_path}` : ''} 
                        className="w-full h-full object-contain"
                        isFallback={!v.image_path}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-[12px] font-bold text-zinc-100 truncate">{v.name}</h4>
                        {isCurrent && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-y-1 gap-x-3">
                        <div className="flex items-center gap-1.5 text-[10px] font-semibold">
                          <Users className="w-3 h-3 text-zinc-500" />
                          <span className={v.client_name ? 'text-indigo-400' : 'text-zinc-500'}>
                            {v.client_name || 'Global'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500">
                          <Barcode className="w-3 h-3" />
                          {v.ean}
                        </div>
                        {v.price && (
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-500">
                            <DollarSign className="w-3 h-3" />
                            R$ {Number(v.price).toFixed(2).replace('.', ',')}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        disabled={isCurrent}
                        onClick={() => {
                          onUpdateProduct(product.id, {
                            name: v.name,
                            ean: v.ean,
                            client_name: v.client_name || '',
                            images: v.image_path ? [`https://ebvvmddizsggrqasnnvv.supabase.co/storage/v1/object/public/product-images/${v.image_path}?t=${Date.now()}`] : product.images
                          });
                          toast.success('Produto atualizado para a variação de ' + (v.client_name || 'Global'));
                        }}
                        className={`h-8 px-4 rounded-lg text-[10px] font-bold transition-all ${isCurrent ? 'bg-green-500/10 text-green-500 cursor-default' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'}`}
                      >
                        {isCurrent ? 'Em uso' : 'Usar este'}
                      </Button>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmVar({ id: v.id, name: v.name, image_path: v.image_path });
                        }}
                        className="h-8 w-8 p-0 rounded-lg bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-all shrink-0"
                        title="Excluir variação do banco de dados"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  </div>

  {deleteConfirmVar && (
    <div className="fixed inset-0 z-[300] bg-zinc-950/80 backdrop-blur-sm animate-in fade-in flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100 mb-2">Excluir Variação?</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Tem certeza que deseja excluir permanentemente a variação <br/>
              <strong className="text-zinc-200">{deleteConfirmVar.name}</strong> <br/>
              do banco de dados?
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px bg-zinc-800/50">
          <button 
            onClick={() => setDeleteConfirmVar(null)}
            className="bg-zinc-900 p-4 text-xs font-semibold text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={executeDeleteVariation}
            className="bg-zinc-900 p-4 text-xs font-semibold text-red-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            Sim, Excluir
          </button>
        </div>
      </div>
    </div>
  )}
</>
);
});

ProductDetailPanel.displayName = 'ProductDetailPanel';
