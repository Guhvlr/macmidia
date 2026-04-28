import React, { useState } from 'react';
import {
  DndContext,
  PointerSensor,
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
import { arrayMove } from '@dnd-kit/sortable';
import { useApp } from '@/contexts/useApp';
import KanbanCard from './KanbanCard';

interface Props {
  children: React.ReactNode;
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

export function KanbanBoardDndContext({ children }: Props) {
  const { kanbanCards, reorderKanbanCards } = useApp();
  const [activeId, setActiveId] = useState<string | null>(null);
  
  // Cleanup active drag state if the card is deleted from the external state
  React.useEffect(() => {
    if (activeId && !kanbanCards.some(c => c.id === activeId)) {
      setActiveId(null);
    }
  }, [kanbanCards, activeId]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
        // Block drag if clicking on interactive elements or inside dialogs with data-no-dnd
        predicate: (event) => {
          const target = event.nativeEvent.target as HTMLElement;
          // Se o clique for em um botão, input, etc, OU dentro de algo com data-no-dnd="true"
          return !target.closest('button, input, textarea, a, [role="button"], [contenteditable="true"], [data-no-dnd="true"]');
        },
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    // Cross-column visual logic could go here if we wanted 
    // a placeholder in the destination column during drag
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeData = active.data.current;
    const overData = over.data.current;

    if (!activeData || !overData) return;

    const activeCard = kanbanCards.find(c => c.id === activeId);
    if (!activeCard) return;

    const isOverColumn = overData.type === 'Column';
    const isOverTask = overData.type === 'Card';

    let destColumnKey = activeCard.column;
    if (isOverColumn) {
      destColumnKey = overData.columnKey;
    } else if (isOverTask) {
      destColumnKey = overData.card.column;
    }

    // Filter and sort destination cards
    const destCards = kanbanCards
      .filter(c => c.column === destColumnKey)
      .sort((a, b) => (a.position_index || 0) - (b.position_index || 0));

    // Case 1: Same column reorder
    if (activeCard.column === destColumnKey) {
      const oldIndex = destCards.findIndex(c => c.id === activeId);
      const newIndex = isOverColumn ? destCards.length - 1 : destCards.findIndex(c => c.id === overId);
      
      if (oldIndex === newIndex || newIndex === -1) return;

      const newOrder = arrayMove(destCards, oldIndex, newIndex);
      const updates = newOrder.map((card, index) => ({
        id: card.id,
        position_index: (index + 1) * 1024,
      }));
      reorderKanbanCards(updates);
    } 
    // Case 2: Move to different column
    else {
      const newOrder = [...destCards];
      const targetIndex = isOverColumn ? destCards.length : destCards.findIndex(c => c.id === overId);
      
      newOrder.splice(targetIndex, 0, activeCard);
      
      const updates = newOrder.map((card, index) => ({
        id: card.id,
        position_index: (index + 1) * 1024,
        column: card.id === activeId ? destColumnKey : undefined
      }));
      reorderKanbanCards(updates);
    }
  };

  const activeCard = kanbanCards.find(c => c.id === activeId);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {children}
      <DragOverlay>
        {activeCard ? <KanbanCard card={activeCard} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
