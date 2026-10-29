import React, { useState } from 'react';
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  closestCorners,
  DragOverlay,
  defaultDropAnimationSideEffects,
  DropAnimation
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useApp } from '@/contexts/useApp';
import KanbanCard from './KanbanCard';
import {
  compareKanbanCards,
  computePositionUpdatesAtIndex,
  getTopPositionIndex,
  normalizeColumnKey,
} from '@/features/kanban/utils/cardOrder';

interface Props {
  children: React.ReactNode;
  onReorderColumns?: (activeId: string, overId: string) => void;
}

const dropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: '0.5',
      },
    },
  }),
};

export function KanbanBoardDndContext({ children, onReorderColumns }: Props) {
  const { kanbanCards, reorderKanbanCards, kanbanColumns, reorderKanbanColumns } = useApp();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'Card' | 'Column' | null>(null);
  
  // Cleanup active drag state if the card is deleted from the external state
  React.useEffect(() => {
    if (activeId && !kanbanCards.some(c => c.id === activeId)) {
      setActiveId(null);
    }
  }, [kanbanCards, activeId]);

  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 10, // Must move 10px to start drag on desktop
    },
  });

  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 500, // Long press (0.5s) on mobile
      tolerance: 15, // Allow slight movement while holding
    },
  });

  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });

  const sensors = useSensors(mouseSensor, touchSensor, keyboardSensor);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setActiveType(event.active.data.current?.type === 'ColumnItem' ? 'Column' : 'Card');
  };

  const handleDragOver = (event: DragOverEvent) => {
    // Cross-column visual logic could go here if we wanted 
    // a placeholder in the destination column during drag
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    setActiveType(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeData = active.data.current;
    const overData = over.data.current;

    if (!activeData || !overData) return;

    if (activeData.type === 'ColumnItem' && (overData.type === 'ColumnItem' || overData.type === 'Column')) {
      if (onReorderColumns) {
        onReorderColumns(activeData.columnKey, overData.columnKey);
        return;
      }
      // Reordering columns
      // Find columns for this employee
      const activeDbId = activeData.dbId;
      if (!activeDbId) return;
      const activeCol = kanbanColumns.find(c => c.id === activeDbId);
      if (!activeCol) return;
      
      const employeeCols = kanbanColumns
        .filter(c => c.employeeId === activeCol.employeeId)
        .sort((a, b) => a.position - b.position);

      const oldIndex = employeeCols.findIndex(c => c.id === activeCol.id);
      let newIndex = -1;
      
      if (overData.type === 'ColumnItem') {
        const overDbId = overData.dbId;
        newIndex = employeeCols.findIndex(c => c.id === overDbId);
      } else {
        newIndex = employeeCols.findIndex(c => c.columnKey === overData.columnKey);
      }
      
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

      const newOrder = arrayMove(employeeCols, oldIndex, newIndex);
      const updates = newOrder.map((col, index) => ({
        id: col.id,
        position: index,
      }));
      reorderKanbanColumns(updates);
      return;
    }

    const activeCard = kanbanCards.find(c => c.id === activeId);
    if (!activeCard) return;

    const isOverColumn = overData.type === 'Column';
    const isOverTask = overData.type === 'Card';

    const currentColumnKey = normalizeColumnKey(activeCard.column);
    let destColumnKey = currentColumnKey;
    if (isOverColumn) {
      destColumnKey = normalizeColumnKey(overData.columnKey);
    } else if (isOverTask) {
      destColumnKey = normalizeColumnKey(overData.card.column);
    }

    // Case 1: Same column -> allow manual reordering up/down inside the column
    if (currentColumnKey === destColumnKey) {
      if (activeId === overId) return;

      const colCards = kanbanCards
        .filter(c => normalizeColumnKey(c.column) === destColumnKey)
        .sort(compareKanbanCards);

      const oldIndex = colCards.findIndex(c => c.id === activeId);
      const newIndex = isOverTask
        ? colCards.findIndex(c => c.id === overId)
        : colCards.length - 1;

      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

      const cardsWithoutActive = colCards.filter(c => c.id !== activeId);
      const updates = computePositionUpdatesAtIndex(
        kanbanCards,
        cardsWithoutActive,
        activeId,
        destColumnKey,
        newIndex
      );
      reorderKanbanCards(updates);
    }
    // Case 2: Move to different column -> ALWAYS place at the VERY TOP (#1)
    else {
      const topPositionIndex = getTopPositionIndex(kanbanCards, destColumnKey, activeId);
      reorderKanbanCards([
        {
          id: activeId,
          position_index: topPositionIndex,
          column: destColumnKey,
        },
      ]);
    }
  };

  const activeCard = activeType === 'Card' ? kanbanCards.find(c => c.id === activeId) : null;
  const activeColumn = activeType === 'Column' ? kanbanColumns.find(c => c.columnKey === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {activeType === 'Card' && activeCard ? (
          <div className="pointer-events-none w-[290px] opacity-95 shadow-2xl">
            <KanbanCard card={activeCard} />
          </div>
        ) : null}
        {activeType === 'Column' && activeColumn ? (
          <div className="pointer-events-none w-[300px] h-20 bg-secondary/80 rounded-xl border border-border shadow-2xl flex items-center justify-center backdrop-blur-sm">
            <span className="font-bold text-foreground opacity-70 uppercase tracking-wider">{activeColumn.title}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
