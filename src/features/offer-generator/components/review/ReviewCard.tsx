import React from 'react';
import { Loader2, Trash2, Layers, PlusCircle, CheckSquare, ZoomIn, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ProductItem } from '../../context/OfferContext';
import { ProductImageWithFormat } from '../ProductImageWithFormat';
import { ConfidenceBadge } from './ConfidenceBadge';

interface ReviewCardProps {
  product: ProductItem;
  idx: number;
  isSelected: boolean;
  toggleSelect: (id: string) => void;
  bgPreview?: string;
  resolvedUrl?: string;
  setResolvedUrl: (url: string) => void;
  handleFormatChange: (id: string, format: 'JPG' | 'PNG') => void;
  imageFormat: 'JPG' | 'PNG';
  onExpandImage: (url: string) => void;
  toggleSuffix: (id: string) => void;
  onLoadVariations: (p: ProductItem) => void;
  isLoadingVariations: boolean;
  onManualImageUpload: (id: string) => void;
  onRemove: (id: string) => void;
  isProcessing: boolean;
  
  // Creation logic
  isCreatingThis: boolean;
  setCreatingThis: (id: string | null) => void;
  createData: { name: string; ean: string; file: File | null };
  setCreateData: (data: any) => void;
  isCreating: boolean;
  onConfirmCreate: (id: string) => void;
  onUpdateProduct: (id: string, updates: Partial<ProductItem>, saveToDb?: boolean) => void;
}

export const ReviewCard = React.memo(({
  product,
  idx,
  isSelected,
  toggleSelect,
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
  onUpdateProduct
}: ReviewCardProps) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editData, setEditData] = React.useState({
    name: product.name,
    ean: product.ean,
    price: product.price,
    suffix: product.suffix
  });

  const isLowConfidence = ['low', 'none'].includes(product.confidence);

  const handleSaveEdit = (saveToDb: boolean = false) => {
    onUpdateProduct(product.id, {
      ...editData,
      name: editData.name.toUpperCase()
    }, saveToDb);
    setIsEditing(false);
  };

  const handleEditClick = () => {
    setEditData({
      name: product.name,
      ean: product.ean,
      price: product.price,
      suffix: product.suffix
    });
    setIsEditing(true);
  };

  return (
    <div className={`p-6 rounded-3xl border-2 transition-all relative group ${
      isSelected ? 'bg-primary/5 border-primary/20 shadow-[0_0_30px_rgba(217,37,75,0.05)]' : 'bg-white/[0.02] border-white/5 hover:border-white/10'
    }`}>
      {isLowConfidence && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-[9px] font-black px-4 py-1 rounded-full uppercase tracking-widest z-10 shadow-lg animate-pulse">
           ⚠️ Verifique se o produto está correto
        </div>
      )}
      <div className="flex gap-6 items-center">
        <div className="w-4 text-[10px] font-black text-white/10 text-center">{idx + 1}</div>
        
        {/* Selection checkbox */}
        <div 
          onClick={() => toggleSelect(product.id)}
          className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center cursor-pointer transition-all ${
            isSelected ? 'bg-primary border-primary' : 'bg-white/5 border-white/10 '
          }`}
        >
          {isSelected && <CheckSquare className="w-4 h-4 text-white" />}
        </div>

        {/* Product Image section */}
        <div className="relative group/img">
          <div className="w-24 h-24 bg-white/[0.02] rounded-3xl p-2 border border-white/5 group-hover/img:border-blue-500/20 transition-colors">
            <ProductImageWithFormat 
              src={product.images[0]} 
              previewBase64={bgPreview}
              onFormatChange={(f) => handleFormatChange(product.id, f)}
              onUrlResolved={setResolvedUrl}
              isFallback={!product.images[0]}
            />
          </div>
          <button 
            onClick={() => onExpandImage(bgPreview || resolvedUrl || product.images[0])}
            className="absolute -top-2 -right-2 w-8 h-8 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center text-white opacity-0 group-hover/img:opacity-100 transition-opacity z-10 hover:bg-primary"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          
          {/* Format badge */}
          <div className="absolute -bottom-2 -left-2 flex gap-1">
            <button 
              onClick={() => handleFormatChange(product.id, 'JPG')} 
              className={`px-2 py-0.5 rounded-lg text-[8px] font-black tracking-widest transition-all ${imageFormat === 'JPG' ? 'bg-amber-500 text-amber-950 shadow-[0_0_10px_rgba(245,158,11,0.3)]' : 'bg-white/10 text-white/40 hover:bg-white/20'}`}
            >
              JPG
            </button>
            <button 
              onClick={() => handleFormatChange(product.id, 'PNG')} 
              className={`px-2 py-0.5 rounded-lg text-[8px] font-black tracking-widest transition-all ${imageFormat === 'PNG' ? 'bg-purple-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.3)]' : 'bg-white/10 text-white/40 hover:bg-white/20'}`}
            >
              PNG
            </button>
          </div>
        </div>

        {/* Product Info */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input 
                  value={editData.ean} 
                  onChange={e => setEditData({...editData, ean: e.target.value})}
                  className="bg-black/40 border-white/10 h-7 text-[10px] w-28"
                  placeholder="EAN"
                />
                <Input 
                  value={editData.price} 
                  onChange={e => setEditData({...editData, price: e.target.value})}
                  className="bg-black/40 border-white/10 h-7 text-[10px] w-24"
                  placeholder="Preço"
                />
              </div>
              <Input 
                value={editData.name} 
                onChange={e => setEditData({...editData, name: e.target.value})}
                className="bg-black/40 border-white/10 h-8 text-xs font-bold"
                placeholder="Nome do Produto"
              />
            </div>
          ) : (
            <>
              <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-1">
                #{product.ean} {product.mode === 'barcode' ? '• B-CODE' : ''}
              </p>
              <h3 className="text-sm font-black text-white/90 uppercase tracking-tight truncate leading-tight group-hover:text-white transition-colors">
                {product.name}
              </h3>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-primary font-black text-[11px] bg-primary/5 px-2 py-0.5 rounded-lg border border-primary/10">
                  {product.price} 
                  <button 
                    onClick={() => toggleSuffix(product.id)} 
                    className="text-[9px] text-white/40 hover:text-primary transition-colors cursor-pointer ml-1 py-0.5 px-1 bg-white/5 rounded border border-white/10"
                  >
                    / {product.suffix}
                  </button>
                </span>
                <div className="w-px h-3 bg-white/10" />
                <ConfidenceBadge product={product} />
              </div>
              {product.confidence_reason && (
                <p className="text-[9px] text-white/30 mt-1 font-bold uppercase tracking-tight italic line-clamp-1">
                  {product.confidence_reason}
                </p>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {isEditing ? (
            <div className="flex gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    onClick={() => handleSaveEdit(false)} 
                    className="h-9 px-4 bg-white/10 hover:bg-white/20 text-[10px] font-black uppercase tracking-widest text-white rounded-xl transition-all"
                  >
                    Salvar Local
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-[#1a1a1c] border-white/10 text-white text-xs font-medium max-w-[200px]">
                  Salvar alterações apenas nesta oferta atual
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    onClick={() => handleSaveEdit(true)} 
                    className="h-9 px-4 bg-green-600 hover:bg-green-700 text-[10px] font-black uppercase tracking-widest text-white rounded-xl transition-all"
                  >
                    Salvar no BD
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-[#1a1a1c] border-white/10 text-white text-xs font-medium max-w-[200px]">
                  Salvar permanentemente no banco de dados para futuras ofertas
                </TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  onClick={handleEditClick} 
                  className="h-9 px-4 bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest text-white/60 rounded-xl border border-white/5 transition-all"
                >
                  Editar
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-[#1a1a1c] border-white/10 text-white text-xs font-medium max-w-[200px]">
                Editar nome, preço ou código do produto
              </TooltipContent>
            </Tooltip>
          )}
          {isLowConfidence && !isEditing && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  onClick={() => {
                    setCreateData({ 
                      name: product.name, 
                      ean: product.ean === 'N/A' || product.ean === 'NA' ? '' : product.ean, 
                      file: null 
                    });
                    setCreatingThis(isCreatingThis ? null : product.id);
                  }} 
                  className="h-9 px-4 bg-[#1a1a1c] hover:bg-white/10 text-[10px] font-black uppercase tracking-widest text-white/60 rounded-xl border border-white/5 transition-all"
                >
                  Cadastrar
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-[#1a1a1c] border-white/10 text-white text-xs font-medium max-w-[200px]">
                Cadastrar produto novo no banco de dados
              </TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                onClick={() => onLoadVariations(product)} 
                disabled={isProcessing}
                className="h-9 px-4 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2"
              >
                {isLoadingVariations ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
                Variações
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-[#1a1a1c] border-white/10 text-white text-xs font-medium max-w-[220px]">
              Adicionar outras versões do produto (sabores, marcas, etc)
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                onClick={() => onManualImageUpload(product.id)} 
                variant="outline" 
                className="h-9 px-4 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Add Foto
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-[#1a1a1c] border-white/10 text-white text-xs font-medium max-w-[200px]">
              Adicionar imagem apenas para esta oferta
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={() => onRemove(product.id)} 
                className="p-2 ml-2 text-white/30 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-red-950/90 border-red-500/20 text-red-200 text-xs font-medium">
              Remover produto da lista
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Inline Creation Form */}
      {isCreatingThis && (
        <div className="mt-4 p-4 bg-black/40 rounded-xl border border-white/5 animate-in fade-in slide-in-from-top-2">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-4 flex items-center gap-2">
             <PlusCircle className="w-3.5 h-3.5" /> Novo Cadastro Manual
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
             <div>
                <label className="text-[9px] font-bold uppercase text-white/40 block mb-1">Descrição Oficial</label>
                <Input 
                  disabled={isCreating} 
                  value={createData.name} 
                  onChange={e => setCreateData({...createData, name: e.target.value})} 
                  placeholder="Ex: ITEM TESTE" 
                  className="bg-black/40 border-white/10 h-10 text-xs text-white" 
                />
             </div>
             <div>
                <label className="text-[9px] font-bold uppercase text-white/40 block mb-1">EAN (GTIN)</label>
                <Input 
                  disabled={isCreating} 
                  value={createData.ean} 
                  onChange={e => setCreateData({...createData, ean: e.target.value})} 
                  placeholder="789..." 
                  className="bg-black/40 border-white/10 h-10 text-xs text-white" 
                />
             </div>
             <div>
                <label className="text-[9px] font-bold uppercase text-white/40 block mb-1">Foto</label>
                <input 
                  type="file" 
                  id={`file-card-${product.id}`} 
                  className="hidden" 
                  onChange={e => setCreateData({...createData, file: e.target.files?.[0] || null})} 
                />
                <label htmlFor={`file-card-${product.id}`} className="flex items-center justify-between bg-black/40 border border-white/10 h-10 px-4 rounded-md cursor-pointer hover:border-white/20 transition-colors">
                   <span className="text-[10px] text-white/30 truncate max-w-[120px]">{createData.file ? createData.file.name : 'Selecionar...'}</span>
                   <ImageIcon className="w-4 h-4 text-white/20" />
                </label>
             </div>
          </div>
          <div className="flex justify-end gap-2">
             <Button onClick={() => setCreatingThis(null)} variant="outline" className="h-9 px-4 bg-white/5 border-white/5 rounded-xl text-[10px] font-black uppercase text-white/40">Cancelar</Button>
             <Button onClick={() => onConfirmCreate(product.id)} disabled={isCreating} className="h-9 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase">Finalizar Cadastro</Button>
          </div>
        </div>
      )}
    </div>
  );
});

ReviewCard.displayName = 'ReviewCard';
