import { memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import KanbanCard from './KanbanCard';
import type { KanbanCard as KanbanCardType } from '@/contexts/app-types';

interface SortableKanbanCardProps {
  card: KanbanCardType;
}

export const SortableKanbanCard = memo(function SortableKanbanCard({ card }: SortableKanbanCardProps) {
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

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    willChange: transform ? 'transform' : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`touch-manipulation ${isDragging ? 'z-50 pointer-events-none' : ''}`}
    >
      <KanbanCard card={card} dragAttributes={attributes} dragListeners={listeners} />
    </div>
  );
});

