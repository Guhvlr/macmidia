import React from 'react';
import { Loader2, Trash2, ChevronRight, CheckSquare, GripVertical, Layers } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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

  // Detail panel
  onOpenDetail: (id: string) => void;

  hasEanConflict?: boolean;
  activeClientName?: string | null;
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
  onUpdateProduct,
  onOpenDetail,
  hasEanConflict,
  activeClientName
}: ReviewCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  const isLowConfidence = ['low', 'none'].includes(product.confidence);

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-2xl border transition-all ${
        isDragging ? 'shadow-2xl border-red-500/50 scale-[1.02] cursor-grabbing' :
        isSelected 
          ? 'bg-red-600/5 border-red-500/20 shadow-sm' 
          : 'bg-zinc-900/30 border-zinc-800/60 hover:border-zinc-700 hover:bg-zinc-900/50'
      }`}
    >
      {/* Low confidence indicator bar */}
      {isLowConfidence && (
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-500/0 via-amber-500/50 to-amber-500/0 rounded-t-2xl" />
      )}

      <div className="flex items-center gap-4 p-4">
        {/* Drag Handle */}
        <div 
          {...attributes} 
          {...listeners} 
          className="p-1 cursor-grab active:cursor-grabbing text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <GripVertical className="w-6 h-6" />
        </div>

        {/* Index */}
        <div className="w-5 text-[11px] font-semibold text-zinc-600 text-center shrink-0">{idx + 1}</div>
        
        {/* Selection checkbox */}
        <div 
          onClick={(e) => { e.stopPropagation(); toggleSelect(product.id); }}
          className={`w-5 h-5 rounded-md border flex items-center justify-center cursor-pointer transition-all shrink-0 ${
            isSelected ? 'bg-red-600 border-red-600' : 'bg-zinc-800/50 border-zinc-600 hover:border-zinc-500'
          }`}
        >
          {isSelected && <CheckSquare className="w-3 h-3 text-white" />}
        </div>

        {/* Product Image (compact) */}
        <div className="w-14 h-14 rounded-xl bg-zinc-800/30 border border-zinc-800/60 p-1.5 shrink-0 overflow-hidden">
          <ProductImageWithFormat 
            src={product.images[0]} 
            previewBase64={bgPreview}
            onFormatChange={(f) => handleFormatChange(product.id, f)}
            onUrlResolved={setResolvedUrl}
            isFallback={!product.images[0]}
          />
        </div>

        {/* Product Info (compact) */}
        <div className="flex-1 min-w-0">
          <h3 className="text-[13px] font-semibold text-zinc-100 tracking-tight truncate leading-tight">
            {product.name}
          </h3>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-red-500 font-semibold text-[12px] bg-red-500/10 px-2 py-0.5 rounded-lg border border-red-500/20 whitespace-nowrap">
              {product.price}
              <span className="text-[10px] text-red-500/50 ml-1">/{product.suffix}</span>
            </span>
            <div className="w-px h-3 bg-zinc-700" />
            <ConfidenceBadge product={product} />
            {(() => {
              const normActive = (activeClientName || '').trim().toUpperCase();
              const normItem = (product.client_name || '').trim().toUpperCase();
              
              if (!product.client_name) {
                return (
                  <span className="text-[10px] font-bold text-zinc-500 bg-zinc-500/10 px-2 py-0.5 rounded-lg border border-zinc-500/20 whitespace-nowrap">
                    Global
                  </span>
                );
              }
              
              if (normActive === normItem && normActive !== '') {
                return (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20 whitespace-nowrap">
                    {product.client_name}
                  </span>
                );
              }
              
              return (
                <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20 whitespace-nowrap">
                  Outro: {product.client_name}
                </span>
              );
            })()}
            <span className="text-[10px] font-mono text-zinc-600 hidden sm:inline">#{product.ean}</span>
            {product.warning && product.warning.includes('variações') && (
              <span 
                onClick={(e) => { e.stopPropagation(); onOpenDetail(product.id); }}
                className="flex items-center gap-1 text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20 cursor-pointer animate-pulse hover:bg-amber-500/20 transition-all"
              >
                <Layers className="w-3.5 h-3.5" />
                Variações detectadas
              </span>
            )}
          </div>
        </div>

        {/* Actions (minimal) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Quick delete */}
          <button 
            onClick={(e) => { e.stopPropagation(); onRemove(product.id); }}
            className="p-2 text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Open Detail Button */}
          <button
            onClick={() => onOpenDetail(product.id)}
            className="flex items-center gap-2 h-9 px-4 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-600 rounded-xl text-[11px] font-semibold text-zinc-400 hover:text-zinc-100 transition-all group/btn"
          >
            Detalhes
            <ChevronRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
});

ReviewCard.displayName = 'ReviewCard';
