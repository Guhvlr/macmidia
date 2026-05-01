import { useState, useCallback, lazy, Suspense, memo } from 'react';
import type { KanbanCard as KanbanCardType, Employee, SystemUser } from '@/contexts/app-types';
import Timer from './Timer';
import { Image as ImageIcon, MessageSquare, CheckSquare, AlignLeft, UploadCloud, Loader2, CheckCircle2, AlertTriangle, Smartphone, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { compressImage, createThumbnail } from '@/lib/utils';

// Lazy load the heavy dialog component — only mount when user clicks a card
const CardDetailDialog = lazy(() => import('./CardDetailDialog'));

interface KanbanCardProps {
  card: KanbanCardType;
  employees: Employee[];
  updateKanbanCard: (id: string, updates: Partial<KanbanCardType>, actionDescription?: string) => Promise<void>;
  triggerAICorrection: (cardId: string) => Promise<void>;
  dragAttributes?: any;
  dragListeners?: any;
}

const KanbanCardInner = ({ card, employees, updateKanbanCard, triggerAICorrection, dragAttributes, dragListeners }: KanbanCardProps) => {
  const [detailOpen, setDetailOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const { activeTasks, uploadKanbanAsset } = useApp();
  
  const cardTasks = activeTasks.filter(t => t.cardId === card.id);
  const isProcessing = cardTasks.length > 0;
  const mainTask = cardTasks[0];

  const images = card.images || (card.imageUrl ? [card.imageUrl] : []);
  
  // Helper to check if a URL is likely an image
  const isImageUrl = (url: string) => 
    url.startsWith('data:image') || 
    url.match(/\.(jpeg|jpg|gif|png|webp)$/i) ||
    (url.includes('supabase') && !url.match(/\.(pdf|doc|docx|xls|xlsx|odt|ods)$/i));

  // Cover Logic:
  // 1. If coverImage is exactly '', it was explicitly removed.
  // 2. If coverImage exists and is an image, use it.
  // 3. Otherwise, fallback to the first valid image from the attachments list.
  let coverImage = null;
  if (card.coverImage === '') {
    coverImage = null;
  } else if (card.coverImage && isImageUrl(card.coverImage)) {
    coverImage = card.coverImage;
  } else {
    coverImage = images.find(img => isImageUrl(img)) || null;
  }

  const employee = employees.find(e => e.id === card.employeeId);
  const safeChecklists = Array.isArray(card.checklists) ? card.checklists : [];
  const safeComments = Array.isArray(card.comments) ? card.comments : [];
  const safeAssignees = Array.isArray(card.assignedUsers) ? (card.assignedUsers as SystemUser[]) : [];
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
    
    if (e.dataTransfer.getData('cardId')) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      e.preventDefault();
      e.stopPropagation();

      const droppedFiles = Array.from(e.dataTransfer.files);
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

      // Check for files exceeding the size limit
      const oversizedFiles = droppedFiles.filter(f => f.size > MAX_FILE_SIZE);
      if (oversizedFiles.length > 0) {
        toast.error(`Arquivo(s) muito grande(s): ${oversizedFiles.map(f => f.name).join(', ')}. O limite é de 10MB.`);
        return;
      }

      const imagesToUpload = droppedFiles.filter(f => f.type.startsWith('image/'));

      if (imagesToUpload.length === 0) {
        toast.warning('Apenas imagens são permitidas no arraste.');
        return;
      }

      for (const file of imagesToUpload) {
        uploadKanbanAsset(card.id, file);
      }
    }
  }, [card.id, uploadKanbanAsset]);

  const handleOpenDetail = useCallback(() => setDetailOpen(true), []);

  return (
    <>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleOpenDetail}
        {...dragAttributes}
        {...dragListeners}
        className={`kanban-card bg-[#1C1C1E] border border-white/5 rounded-xl p-4 md:p-3 space-y-3 cursor-pointer group hover:bg-[#252528] hover:border-white/10 active:scale-[0.98] transition-all duration-200 shadow-md relative overflow-hidden flex flex-col performance-virtual ${isDragOver ? 'ring-2 ring-primary ring-offset-2 ring-offset-black scale-[1.02] bg-[#252528]' : ''}`}
      >
        {isDragOver && !isProcessing && (
          <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm border-2 border-dashed border-primary/50 animate-in fade-in duration-200 pointer-events-none rounded-xl">
            <UploadCloud className="w-8 h-8 text-primary mb-2" />
            <p className="text-white text-xs font-bold tracking-wider uppercase">Solte para anexar</p>
          </div>
        )}

        {mainTask && (
          <div className="absolute inset-0 z-[60] bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm animate-in fade-in rounded-xl">
            {mainTask.status === 'completed' ? (
              <>
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2 animate-in zoom-in duration-300" />
                <p className="text-white text-[11px] font-bold tracking-wider uppercase mb-2">Concluído!</p>
              </>
            ) : mainTask.status === 'failed' ? (
              <>
                <AlertTriangle className="w-8 h-8 text-red-500 mb-2" />
                <p className="text-white text-[10px] font-bold tracking-wider uppercase">Erro ao Enviar</p>
              </>
            ) : (
              <>
                <Loader2 className="w-7 h-7 text-primary animate-spin mb-2" />
                <p className="text-white text-[10px] font-bold tracking-wider uppercase">
                  {mainTask.type === 'UPLOAD_IMAGE' ? 'Enviando...' : 'Processando...'} {mainTask.progress}%
                </p>
              </>
            )}
          </div>
        )}

        {card.aiStatus === 'issues_found' && (
          <div className="absolute top-2 right-10 z-10 group-hover:hidden transition-all">
             <div className="bg-amber-500 p-1 rounded-full shadow-lg border border-white/20 animate-bounce">
                <Sparkles className="w-2.5 h-2.5 text-white" />
             </div>
          </div>
        )}

        {coverImage && (
          <div className="relative overflow-hidden rounded-lg -mx-1 -mt-1 min-h-[120px] max-h-[260px] bg-black/40 group/img flex items-center justify-center">
            <img src={coverImage} alt="" className="absolute inset-0 w-full h-full object-cover blur-lg opacity-40 scale-110" />
            <img src={coverImage} alt="Capa" loading="lazy" className="relative w-full h-auto max-h-[260px] object-contain transition-transform duration-500 group-hover/img:scale-105 p-0.5" />
          </div>
        )}

        <div className="space-y-2 flex-1">
          {Array.isArray(card.labels) && card.labels.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {card.labels.map(label => {
                const parts = label.split('|');
                const hasColor = parts.length > 1;
                const colorClass = hasColor ? parts[0] : 'bg-red-600';
                const text = hasColor ? parts.slice(1).join('|') : label;
                return (
                  <span key={label} className={`px-2 py-0.5 text-[9px] font-bold text-white rounded-sm truncate max-w-full ${colorClass}`}>
                    {text}
                  </span>
                );
              })}
            </div>
          )}
          <h4 className="font-bold text-[13px] text-white leading-tight uppercase line-clamp-2">{card.clientName}</h4>
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
          )}
          {card.aiStatus === 'price_mismatch' && (
            <div className="flex items-center gap-1.5 mt-1.5 px-2 py-1 rounded-md bg-red-500/10 border border-red-500/20 text-red-400">
              <AlertTriangle className="w-3 h-3 animate-pulse" />
              <span className="text-[9px] font-bold uppercase tracking-wider">Erro de Preço</span>
            </div>
          )}
          {card.source === 'whatsapp' && (
            <div className="flex items-center gap-1 mt-1 text-emerald-500/60">
              <Smartphone className="w-3 h-3" />
              <span className="text-[9px] font-medium">WhatsApp</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-auto pt-1">
          <div className="flex items-center gap-2.5 text-white/50">
            {hasDescription && <div title="Este card possui descrição"><AlignLeft className="w-3.5 h-3.5" /></div>}
            {hasComments && (
              <div className="flex items-center gap-1 text-[11px] font-medium">
                <MessageSquare className="w-3 h-3" />
                <span>{safeComments.length}</span>
              </div>
            )}
            {totalChecklists > 0 && (
              <div className={`flex items-center gap-1 text-[11px] font-medium ${completedChecklists === totalChecklists ? 'text-emerald-500 bg-emerald-500/10 px-1 rounded-sm' : ''}`}>
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
            {employee && safeAssignees.length === 0 && (
              <div className="bg-white/5 px-1.5 py-0.5 rounded border border-white/5 flex items-center gap-1 ml-1 max-w-[80px] overflow-hidden">
                <span className="w-1 h-1 rounded-full bg-primary/60 shrink-0" />
                <span className="text-[9px] font-bold text-white/50 uppercase truncate">{employee.name}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 ml-2">
            {safeAssignees.length > 0 ? (
              <div className="flex items-center -space-x-1.5">
                {safeAssignees.map(u => (
                  <div key={u.id} className="w-6 h-6 rounded-full bg-gradient-to-br from-red-500 to-rose-600 border border-[#1C1C1E] flex items-center justify-center text-[9px] font-bold text-white shadow-sm ring-1 ring-white/10 overflow-hidden">
                    {u.avatarUrl ? <img src={u.avatarUrl} alt={u.fullName} className="w-full h-full object-cover" /> : (u.fullName || 'U').substring(0, 1).toUpperCase()}
                  </div>
                ))}
              </div>
            ) : employee && (
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-500 to-rose-600 border border-white/10 flex items-center justify-center text-[9px] font-bold text-white shadow-sm overflow-hidden text-center">
                {employee.photoUrl || (employee.avatar && employee.avatar.startsWith('http')) ? (
                  <img src={employee.photoUrl || employee.avatar} alt={employee.name} className="w-full h-full object-cover" />
                ) : (employee.name || 'U').substring(0, 1).toUpperCase()}
              </div>
            )}
          </div>
        </div>
      </div>

      {detailOpen && (
        <Suspense fallback={null}>
          <CardDetailDialog card={card} open={detailOpen} onOpenChange={setDetailOpen} />
        </Suspense>
      )}
    </>
  );
};

const KanbanCard = memo(KanbanCardInner, (prev, next) => {
  return (
    prev.card.id === next.card.id &&
    prev.card.column === next.card.column &&
    prev.card.clientName === next.card.clientName &&
    prev.card.description === next.card.description &&
    prev.card.checklists === next.card.checklists &&
    prev.card.comments === next.card.comments &&
    prev.card.assignedUsers === next.card.assignedUsers &&
    prev.card.aiStatus === next.card.aiStatus &&
    prev.card.coverImage === next.card.coverImage &&
    prev.card.timerRunning === next.card.timerRunning &&
    prev.card.timeSpent === next.card.timeSpent &&
    prev.card.employeeId === next.card.employeeId &&
    prev.employees === next.employees &&
    prev.updateKanbanCard === next.updateKanbanCard &&
    prev.triggerAICorrection === next.triggerAICorrection
  );
});

KanbanCard.displayName = 'KanbanCard';

import { useApp } from '@/contexts/useApp';

const KanbanCardContainer = ({ card, dragAttributes, dragListeners }: { card: KanbanCardType, dragAttributes?: any, dragListeners?: any }) => {
  const { employees, updateKanbanCard, triggerAICorrection } = useApp();
  return (
    <KanbanCard 
      card={card} 
      employees={employees} 
      updateKanbanCard={updateKanbanCard} 
      triggerAICorrection={triggerAICorrection} 
      dragAttributes={dragAttributes}
      dragListeners={dragListeners}
    />
  );
};

export default KanbanCardContainer;
