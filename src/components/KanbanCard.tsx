import { useState } from 'react';
import { useApp } from '@/contexts/useApp';
import type { KanbanCard as KanbanCardType } from '@/contexts/app-types';
import Timer from './Timer';
import CardDetailDialog from './CardDetailDialog';
import { Trash2, ImageIcon } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface Props {
  card: KanbanCardType;
}

const KanbanCard = ({ card }: Props) => {
  const { updateKanbanCard, deleteKanbanCard } = useApp();
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const images = card.images || (card.imageUrl ? [card.imageUrl] : []);
  const thumbImage = images[0];

  const toggleTimer = () => {
    const now = Date.now();
    if (card.timerRunning) {
      const elapsed = card.timerStart ? Math.floor((now - card.timerStart) / 1000) : 0;
      updateKanbanCard(card.id, { timerRunning: false, timeSpent: card.timeSpent + elapsed, timerStart: undefined });
    } else {
      updateKanbanCard(card.id, { timerRunning: true, timerStart: now });
    }
  };

  return (
    <>
      <div
        draggable
        onDragStart={(e) => e.dataTransfer.setData('cardId', card.id)}
        onClick={() => setDetailOpen(true)}
        className="glass-card p-3.5 space-y-2.5 cursor-pointer group
          hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5
          active:cursor-grabbing active:scale-[0.98]
          transition-all duration-200 animate-fade-in"
      >
        {thumbImage && (
          <div className="relative overflow-hidden rounded-xl -mx-0.5 -mt-0.5">
            <img src={thumbImage} alt="" className="w-full h-28 object-cover transition-transform duration-300 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-card/60 to-transparent" />
          </div>
        )}

        <div className="flex items-center gap-2">
          <h4 className="font-semibold text-sm text-card-foreground flex-1 truncate">{card.clientName}</h4>
          {images.length > 1 && (
            <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
              <ImageIcon className="w-3 h-3" /> {images.length}
            </span>
          )}
        </div>

        {card.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{card.description}</p>
        )}

        <div className="flex items-center justify-between pt-1 border-t border-border/30" onClick={e => e.stopPropagation()}>
          <Timer
            timeSpent={card.timeSpent}
            timerRunning={card.timerRunning}
            timerStart={card.timerStart}
            onToggle={toggleTimer}
          />
          <button
            onClick={() => setDeleteOpen(true)}
            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <CardDetailDialog card={card} open={detailOpen} onOpenChange={setDetailOpen} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="glass-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir card</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o card "{card.clientName}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary hover:bg-muted">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteKanbanCard(card.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default KanbanCard;
