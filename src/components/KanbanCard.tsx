import { useState, useCallback, lazy, Suspense, memo } from 'react';
import { useApp } from '@/contexts/useApp';
import type { KanbanCard as KanbanCardType } from '@/contexts/app-types';
import Timer from './Timer';
import { Image as ImageIcon, MessageSquare, CheckSquare, Edit3, AlignLeft, UploadCloud, Loader2, CheckCircle2, AlertTriangle, Smartphone } from 'lucide-react';
import { compressImage } from '@/lib/utils';

// Lazy load the heavy dialog component — only mount when user clicks a card
const CardDetailDialog = lazy(() => import('./CardDetailDialog'));

interface Props {
  card: KanbanCardType;
}

const KanbanCardInner = ({ card }: Props) => {
  const { employees, updateKanbanCard } = useApp();
  const [detailOpen, setDetailOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [previewInitial, setPreviewInitial] = useState<string | null>(null);

  const images = card.images || (card.imageUrl ? [card.imageUrl] : []);
  const coverImage = card.coverImage || (images.length > 0 ? images[0] : null);

  const employee = employees.find(e => e.id === card.employeeId);
  const safeChecklists = Array.isArray(card.checklists) ? card.checklists : [];
  const safeComments = Array.isArray(card.comments) ? card.comments : [];
  const safeAssignees = Array.isArray(card.assignedUsers) ? card.assignedUsers : [];
  const totalChecklists = safeChecklists.length;
  const completedChecklists = safeChecklists.filter(c => c?.completed).length;
  const hasComments = safeComments.length > 0;
  const hasDescription = !!card.description;

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      e.preventDefault();
      e.stopPropagation();

      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      if (files.length === 0) return;

      setIsUploading(true);
      setUploadProgress(10);
      const tempUrl = URL.createObjectURL(files[0]);
      setPreviewInitial(tempUrl);

      try {
        const compressPromises = files.map(file => compressImage(file));
        setUploadProgress(40);

        const newBase64Images = await Promise.all(compressPromises);
        setUploadProgress(80);

        const currentImages = card.images || (card.imageUrl ? [card.imageUrl] : []);
        const updatedImages = [...currentImages, ...newBase64Images];

        const updates: Partial<KanbanCardType> = { images: updatedImages };
        if (!card.coverImage && updatedImages.length > 0) {
          updates.coverImage = updatedImages[0];
        }

        updateKanbanCard(card.id, updates, `Anexou ${files.length} imagem(ns) pelo painel`);
        setUploadProgress(100);
        setUploadSuccess(true);
        setTimeout(() => {
          setIsUploading(false);
          setUploadSuccess(false);
          setPreviewInitial(null);
          setUploadProgress(0);
          URL.revokeObjectURL(tempUrl);
        }, 2000);
      } catch (err) {
        console.error('Upload error', err);
        setIsUploading(false);
        setPreviewInitial(null);
        URL.revokeObjectURL(tempUrl);
      }
    }
  }, [card.id, card.images, card.imageUrl, card.coverImage, updateKanbanCard]);

  const handleOpenDetail = useCallback(() => setDetailOpen(true), []);
  const handleDragStart = useCallback((e: React.DragEvent) => e.dataTransfer.setData('cardId', card.id), [card.id]);

  return (
    <>
      <div
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleOpenDetail}
        className={`bg-[#1C1C1E] border border-white/5 rounded-xl p-3 space-y-3 cursor-pointer group hover:bg-[#252528] hover:border-white/10 active:cursor-grabbing active:scale-[0.98] transition-all duration-200 shadow-md relative overflow-hidden flex flex-col ${isDragOver ? 'ring-2 ring-primary ring-offset-2 ring-offset-black scale-[1.02] bg-[#252528]' : ''}`}
      >
        {isDragOver && !isUploading && (
          <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm border-2 border-dashed border-primary/50 animate-in fade-in duration-200 pointer-events-none rounded-xl">
            <UploadCloud className="w-8 h-8 text-primary mb-2" />
            <p className="text-white text-xs font-bold tracking-wider uppercase">Solte para anexar</p>
          </div>
        )}

        {isUploading && (
          <div className="absolute inset-0 z-[60] bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm animate-in fade-in rounded-xl">
            {uploadSuccess ? (
              <>
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2 animate-in zoom-in duration-300" />
                <p className="text-white text-[11px] font-bold tracking-wider uppercase mb-2">Concluído!</p>
                {previewInitial && <img src={previewInitial} className="w-16 h-16 object-cover rounded-lg border border-white/10 opacity-80" />}
              </>
            ) : (
              <>
                <Loader2 className="w-7 h-7 text-primary animate-spin mb-2" />
                <p className="text-white text-[10px] font-bold tracking-wider uppercase">Carregando {uploadProgress}%</p>
                <div className="w-20 h-1 bg-white/10 rounded-full mt-2 overflow-hidden mb-3">
                  <div className="h-full bg-primary transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
                {previewInitial && <div className="p-1 rounded-lg bg-white/5 border border-white/5"><img src={previewInitial} className="w-12 h-12 object-cover rounded blur-[1px] opacity-60" /></div>}
              </>
            )}
          </div>
        )}

        {/* Quick action edit on hover */}
        <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-black/60 hover:bg-black/80 p-1.5 rounded-md backdrop-blur-sm border border-white/10 text-white/70 hover:text-white transition-colors" onClick={(e) => { e.stopPropagation(); setDetailOpen(true); }}>
            <Edit3 className="w-3.5 h-3.5" />
          </div>
        </div>

        {coverImage && (
          <div className="relative overflow-hidden rounded-lg -mx-1 -mt-1 h-32 bg-black/40">
            <img src={coverImage} alt="Capa" loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          </div>
        )}

        <div className="space-y-2 flex-1">
          {/* Labels */}
          {Array.isArray(card.labels) && card.labels.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {card.labels.map(label => (
                <span key={label} className="px-2 py-0.5 text-[9px] font-bold text-white bg-red-600/90 rounded-sm truncate max-w-full" title={label}>
                  {label}
                </span>
              ))}
            </div>
          )}

          <h4 className="font-bold text-[13px] text-white leading-tight uppercase line-clamp-2">{card.clientName}</h4>

          {/* AI Status Badge - TEMPORARILY DISABLED 
          {card.aiStatus === 'analyzing' && (
            <div className="flex items-center gap-1.5 mt-1.5 px-2 py-1 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="text-[9px] font-bold uppercase tracking-wider">IA Analisando</span>
            </div>
          )}
          {card.aiStatus === 'approved' && (
            <div className="flex items-center gap-1.5 mt-1.5 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              <span className="text-[9px] font-bold uppercase tracking-wider">IA Aprovado</span>
            </div>
          )}
          {card.aiStatus === 'issues_found' && (
            <div className="flex items-center gap-1.5 mt-1.5 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <AlertTriangle className="w-3 h-3" />
              <span className="text-[9px] font-bold uppercase tracking-wider">Problemas Encontrados</span>
            </div>
          )} */}

          {/* WhatsApp source indicator */}
          {card.source === 'whatsapp' && (
            <div className="flex items-center gap-1 mt-1 text-emerald-500/60">
              <Smartphone className="w-3 h-3" />
              <span className="text-[9px] font-medium">WhatsApp</span>
            </div>
          )}
        </div>

        {/* Footer info: Icons & Avatar */}
        <div className="flex items-center justify-between mt-auto pt-1">
          <div className="flex items-center gap-2.5 text-white/50">
            {hasDescription && (
              <div title="Este card possui descrição"><AlignLeft className="w-3.5 h-3.5" /></div>
            )}
            {hasComments && (
              <div className="flex items-center gap-1 text-[11px] font-medium" title="Comentários">
                <MessageSquare className="w-3 h-3" />
                <span>{safeComments.length}</span>
              </div>
            )}
            {totalChecklists > 0 && (
              <div className={`flex items-center gap-1 text-[11px] font-medium ${completedChecklists === totalChecklists ? 'text-emerald-500 bg-emerald-500/10 px-1 rounded-sm' : ''}`} title="Itens de checklist">
                <CheckSquare className="w-3 h-3" />
                <span>{completedChecklists}/{totalChecklists}</span>
              </div>
            )}
            {images.length > 0 && (
              <div className="flex items-center gap-1 text-[11px] font-medium">
                <ImageIcon className="w-3 h-3" />
                <span>{images.length}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 ml-2">
            {safeAssignees.length > 0 ? (
              <div className="flex items-center -space-x-1.5">
                {safeAssignees.map(u => (
                  <div key={u.id} className="w-6 h-6 rounded-full bg-gradient-to-br from-red-500 to-rose-600 border border-[#1C1C1E] flex items-center justify-center text-[9px] font-bold text-white shadow-sm ring-1 ring-white/10" title={`Responsável: ${u.fullName}`}>
                    {(u.fullName || 'U').substring(0, 2).toUpperCase()}
                  </div>
                ))}
              </div>
            ) : employee && (
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-500 to-rose-600 border border-white/10 flex items-center justify-center text-[9px] font-bold text-white shadow-sm" title={`Responsável: ${employee.name || 'Equipe'}`}>
                {(employee.name || 'U').substring(0, 2).toUpperCase()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lazy-loaded CardDetailDialog: only mounts when opened */}
      {detailOpen && (
        <Suspense fallback={null}>
          <CardDetailDialog card={card} open={detailOpen} onOpenChange={setDetailOpen} />
        </Suspense>
      )}
    </>
  );
};

// React.memo: only re-render when the card data actually changed
const KanbanCard = memo(KanbanCardInner, (prevProps, nextProps) => {
  const prev = prevProps.card;
  const next = nextProps.card;

  // Shallow compare the most frequently changing fields
  return (
    prev.id === next.id &&
    prev.clientName === next.clientName &&
    prev.column === next.column &&
    prev.description === next.description &&
    prev.coverImage === next.coverImage &&
    prev.timeSpent === next.timeSpent &&
    prev.timerRunning === next.timerRunning &&
    prev.timerStart === next.timerStart &&
    prev.archivedAt === next.archivedAt &&
    prev.images === next.images &&
    prev.labels === next.labels &&
    prev.checklists === next.checklists &&
    prev.comments === next.comments &&
    prev.assignedUsers === next.assignedUsers &&
    prev.employeeId === next.employeeId &&
    prev.history === next.history &&
    prev.aiStatus === next.aiStatus &&
    prev.source === next.source
  );
});

KanbanCard.displayName = 'KanbanCard';

export default KanbanCard;
