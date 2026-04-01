import { useState } from 'react';
import { useApp } from '@/contexts/useApp';
import type { KanbanCard as KanbanCardType } from '@/contexts/app-types';
import Timer from './Timer';
import CardDetailDialog from './CardDetailDialog';
import { Trash2, Image as ImageIcon, MessageSquare, CheckSquare, Edit3, AlignLeft, UploadCloud } from 'lucide-react';

interface Props {
  card: KanbanCardType;
}

const KanbanCard = ({ card }: Props) => {
  const { employees, updateKanbanCard } = useApp();
  const [detailOpen, setDetailOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

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

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
       e.preventDefault();
       setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
       setIsDragOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      e.preventDefault();
      e.stopPropagation();

      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      if (files.length === 0) return;

      const base64Promises = files.map(file => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      });

      const newBase64Images = await Promise.all(base64Promises);
      const updatedImages = [...images, ...newBase64Images];
      
      const updates: Partial<KanbanCardType> = { images: updatedImages };
      // If it's the first image ever, automatically make it the cover
      if (!card.coverImage && updatedImages.length > 0) {
        updates.coverImage = updatedImages[0];
      }
      
      updateKanbanCard(card.id, updates, `Anexou ${files.length} imagem(ns) pelo painel`);
    }
  };

  return (
    <>
      <div
        draggable
        onDragStart={(e) => e.dataTransfer.setData('cardId', card.id)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => setDetailOpen(true)}
        className={`bg-[#1C1C1E] border border-white/5 rounded-xl p-3 space-y-3 cursor-pointer group hover:bg-[#252528] hover:border-white/10 active:cursor-grabbing active:scale-[0.98] transition-all duration-200 shadow-md relative overflow-hidden flex flex-col ${isDragOver ? 'ring-2 ring-primary ring-offset-2 ring-offset-black scale-[1.02] bg-[#252528]' : ''}`}
      >
        {isDragOver && (
          <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm border-2 border-dashed border-primary/50 animate-in fade-in duration-200 pointer-events-none rounded-xl">
            <UploadCloud className="w-8 h-8 text-primary mb-2" />
            <p className="text-white text-xs font-bold tracking-wider uppercase">Solte para anexar</p>
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
            <img src={coverImage} alt="Capa" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
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

      <CardDetailDialog card={card} open={detailOpen} onOpenChange={setDetailOpen} />
    </>
  );
};

export default KanbanCard;
