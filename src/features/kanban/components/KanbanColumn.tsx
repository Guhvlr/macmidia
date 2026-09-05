import { memo, useMemo, useState } from 'react';
import { useApp } from '@/contexts/useApp';
import { Pencil, Trash2, GripHorizontal, FoldHorizontal, UnfoldHorizontal } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import AddCardDialog from './AddCardDialog';
import { SortableKanbanCard } from './SortableKanbanCard';

import type { KanbanCard as KanbanCardType } from '@/contexts/app-types';

interface Props {
  id: string;
  dbId: string;
  title: string;
  color: string;
  cards: KanbanCardType[];
  count: number;
  employeeId: string;
  onEdit?: () => void;
  onDelete?: () => void;
}

const KanbanColumnInner = ({ id, dbId, title, color, cards, count, employeeId, onEdit, onDelete }: Props) => {
  const {
    attributes,
    listeners,
    setNodeRef: setSortableNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: id,
    data: {
      type: 'ColumnItem',
      columnKey: id,
      dbId: dbId
    }
  });

  const { setNodeRef: setDroppableNodeRef, isOver } = useDroppable({
    id: id,
    data: {
      type: 'Column',
      columnKey: id
    }
  });

  const sortedCards = useMemo(() => {
    return [...cards].sort((a, b) => (a.position_index || 0) - (b.position_index || 0));
  }, [cards]);

  const [visibleCount, setVisibleCount] = useState(20);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const visibleCards = sortedCards.slice(0, visibleCount);

  return (
    <div 
      ref={setSortableNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.3 : 1, zIndex: isDragging ? 50 : 1 }}
      className={`flex flex-col h-fit max-h-full flex-shrink-0 mb-10 transition-all duration-300 ${isCollapsed ? 'min-w-[60px] w-[60px]' : 'min-w-full w-full md:min-w-[300px] md:w-[320px]'}`}
    >
      {isCollapsed ? (
        <div 
          ref={setDroppableNodeRef}
          className={`flex flex-col items-center gap-3 pt-2 pb-6 rounded-2xl border h-full cursor-pointer transition-all flex-1 min-h-[300px]
          ${isOver ? 'bg-primary/10 border-primary/30 shadow-[inset_0_0_10px_hsl(0_80%_52%/0.1)]' : 'bg-secondary/10 hover:bg-secondary/20 border-transparent'}`}
          onClick={() => setIsCollapsed(false)}
        >
          <div 
            {...attributes}
            {...listeners}
            data-no-dnd="true"
            className="cursor-grab active:cursor-grabbing hover:bg-secondary p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors mb-1"
            onClick={(e) => e.stopPropagation()}
          >
            <GripHorizontal className="w-4 h-4" />
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); setIsCollapsed(false); }} 
            className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground mb-1"
          >
            <UnfoldHorizontal className="w-4 h-4" />
          </button>
          <div className={`w-3 h-3 rounded-full ${color} shadow-sm`} />
          <span className="text-[11px] text-foreground bg-secondary/80 px-2 py-0.5 rounded-full font-medium border border-border/50">{count}</span>
          <div className="flex-1 flex justify-center items-start mt-4">
            <h3 className="font-bold text-[14px] tracking-widest text-muted-foreground uppercase whitespace-nowrap" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
              {title}
            </h3>
          </div>
        </div>
      ) : (
        <>
          {/* Column header */}
          <div className="flex items-center gap-2 mb-3 px-1 group flex-shrink-0">
            <div 
              {...attributes}
              {...listeners}
              data-no-dnd="true"
              className="cursor-grab active:cursor-grabbing hover:bg-secondary p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
            >
              <GripHorizontal className="w-4 h-4" />
            </div>
            <div className={`w-2.5 h-2.5 rounded-full ${color} shadow-sm ml-1`} />
            <h3 className="font-semibold text-[13px] tracking-wide text-foreground uppercase truncate">{title}</h3>
            <span className="text-[11px] text-muted-foreground bg-secondary/60 px-2.5 py-0.5 rounded-full font-medium border border-border/30 ml-auto">{count}</span>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => setIsCollapsed(true)} className="p-1.5 rounded-lg hover:bg-secondary hover:text-primary transition-all mr-1" title="Recolher coluna">
                <FoldHorizontal className="w-3.5 h-3.5" />
              </button>
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
            ref={setDroppableNodeRef}
            className={`flex-1 overflow-y-auto custom-scrollbar space-y-3 p-3 pb-24 rounded-2xl border transition-all duration-200 max-h-[calc(100vh-200px)]
            ${isOver
              ? 'bg-primary/5 border-primary/25 shadow-[inset_0_0_20px_hsl(0_80%_52%/0.05)]'
              : 'bg-secondary/15 border-border/25'
            }`}
          >
            <SortableContext items={visibleCards.map(c => c.id)} strategy={verticalListSortingStrategy}>
              {visibleCards.map(card => (
                <SortableKanbanCard key={card.id} card={card} />
              ))}
            </SortableContext>

            {sortedCards.length > visibleCount && (
              <button 
                onClick={() => setVisibleCount(prev => prev + 20)}
                className="w-full py-2 mt-2 mb-2 text-[11px] uppercase tracking-wider font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-xl transition-colors"
              >
                Ver mais ({sortedCards.length - visibleCount} ocultos)
              </button>
            )}

            {/* Add card button at the bottom of the column */}
            <AddCardDialog
              employeeId={employeeId}
              fixedColumnKey={id}
              showEmployeeSelect={!employeeId}
            />
          </div>
        </>
      )}
    </div>
  );
};

const KanbanColumn = memo(KanbanColumnInner);
KanbanColumn.displayName = 'KanbanColumn';

export default KanbanColumn;
