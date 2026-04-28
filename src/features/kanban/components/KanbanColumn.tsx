import { memo, useMemo } from 'react';
import { useApp } from '@/contexts/useApp';
import { Pencil, Trash2 } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import AddCardDialog from './AddCardDialog';
import { SortableKanbanCard } from './SortableKanbanCard';

import type { KanbanCard as KanbanCardType } from '@/contexts/app-types';

interface Props {
  id: string;
  title: string;
  color: string;
  cards: KanbanCardType[];
  count: number;
  employeeId: string;
  onEdit?: () => void;
  onDelete?: () => void;
}

const KanbanColumnInner = ({ id, title, color, cards, count, employeeId, onEdit, onDelete }: Props) => {
  const { setNodeRef, isOver } = useDroppable({
    id: id,
    data: {
      type: 'Column',
      columnKey: id
    }
  });

  const sortedCards = useMemo(() => {
    return [...cards].sort((a, b) => (a.position_index || 0) - (b.position_index || 0));
  }, [cards]);

  return (
    <div className="flex flex-col h-fit max-h-full min-w-[300px] w-[320px] flex-shrink-0 mb-10">
      {/* Column header */}
      <div className="flex items-center gap-2.5 mb-3 px-1 group flex-shrink-0">
        <div className={`w-2.5 h-2.5 rounded-full ${color} shadow-sm`} />
        <h3 className="font-semibold text-[13px] tracking-wide text-foreground uppercase">{title}</h3>
        <span className="text-[11px] text-muted-foreground bg-secondary/60 px-2.5 py-0.5 rounded-full font-medium border border-border/30">{count}</span>
        <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-secondary hover:text-primary transition-all">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-all">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Cards container */}
      <div 
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto custom-scrollbar space-y-3 p-3 pb-24 rounded-2xl border transition-all duration-200 max-h-[calc(100vh-200px)]
        ${isOver
          ? 'bg-primary/5 border-primary/25 shadow-[inset_0_0_20px_hsl(0_80%_52%/0.05)]'
          : 'bg-secondary/15 border-border/25'
        }`}
      >
        <SortableContext items={sortedCards.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {sortedCards.map(card => (
            <SortableKanbanCard key={card.id} card={card} />
          ))}
        </SortableContext>

        {/* Add card button at the bottom of the column */}
        <AddCardDialog
          employeeId={employeeId}
          fixedColumnKey={id}
          showEmployeeSelect={!employeeId}
        />
      </div>
    </div>
  );
};

const KanbanColumn = memo(KanbanColumnInner);
KanbanColumn.displayName = 'KanbanColumn';

export default KanbanColumn;
