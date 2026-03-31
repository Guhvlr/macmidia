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
        className="glass-card p-3 space-y-2 cursor-pointer hover:border-primary/30 transition-colors active:cursor-grabbing"
      >
        {thumbImage && (
          <img src={thumbImage} alt="" className="w-full h-24 object-cover rounded-lg" />
        )}
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-sm text-card-foreground flex-1">{card.clientName}</h4>
          {images.length > 1 && (
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
              <ImageIcon className="w-3 h-3" /> {images.length}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">{card.description}</p>
        <div className="flex items-center justify-between" onClick={e => e.stopPropagation()}>
          <Timer
            timeSpent={card.timeSpent}
            timerRunning={card.timerRunning}
            timerStart={card.timerStart}
            onToggle={toggleTimer}
          />
          <button onClick={() => setDeleteOpen(true)} className="p-1 hover:text-destructive transition-colors">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      <CardDetailDialog card={card} open={detailOpen} onOpenChange={setDetailOpen} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir card</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o card "{card.clientName}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
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
