import { KanbanCard as KanbanCardType, useApp } from '@/contexts/AppContext';
import Timer from './Timer';
import { Trash2, Image } from 'lucide-react';

interface Props {
  card: KanbanCardType;
}

const KanbanCard = ({ card }: Props) => {
  const { updateKanbanCard, deleteKanbanCard } = useApp();

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
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData('cardId', card.id)}
      className="glass-card p-3 space-y-2 cursor-grab active:cursor-grabbing hover:border-primary/30 transition-colors"
    >
      {card.imageUrl && (
        <img src={card.imageUrl} alt="" className="w-full h-24 object-cover rounded-lg" />
      )}
      <h4 className="font-medium text-sm text-card-foreground">{card.clientName}</h4>
      <p className="text-xs text-muted-foreground line-clamp-2">{card.description}</p>
      <div className="flex items-center justify-between">
        <Timer
          timeSpent={card.timeSpent}
          timerRunning={card.timerRunning}
          timerStart={card.timerStart}
          onToggle={toggleTimer}
        />
        <button onClick={() => deleteKanbanCard(card.id)} className="p-1 hover:text-destructive transition-colors">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

export default KanbanCard;
