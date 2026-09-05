import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import KanbanCard from './KanbanCard';
import type { KanbanCard as KanbanCardType } from '@/contexts/app-types';

interface SortableKanbanCardProps {
  card: KanbanCardType;
}

export function SortableKanbanCard({ card }: SortableKanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: card.id,
    data: {
      type: 'Card',
      card,
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`touch-manipulation transition-all duration-200 ${isDragging ? 'z-50 scale-[1.05] shadow-2xl rotate-2 opacity-90' : ''}`}
    >
      <KanbanCard card={card} dragAttributes={attributes} dragListeners={listeners} />
    </div>
  );
}
