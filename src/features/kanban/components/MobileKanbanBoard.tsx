import React, { memo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useDndMonitor } from '@dnd-kit/core';

interface Column {
  id: string;
  title: string;
  color: string;
}

interface MobileKanbanBoardProps {
  columns: Column[];
  children: React.ReactNode[];
}

/**
 * Mobile-only Kanban board with swipe & arrow navigation between columns.
 * Shows one column at a time with dot indicators and smooth scrolling.
 */
const MobileKanbanBoardInner = ({ columns, children }: MobileKanbanBoardProps) => {
  const [activeColumn, setActiveColumn] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScroll = useRef(false);

  // Sync view with drag-and-drop: follow the card to the new column
  useDndMonitor({
    onDragOver(event) {
      const { over } = event;
      if (!over) return;
      
      const colIndex = columns.findIndex(col => col.id === over.id);
      if (colIndex !== -1 && colIndex !== activeColumn) {
        scrollToColumn(colIndex);
      }
    }
  });

  const scrollToColumn = (index: number) => {
    if (index < 0 || index >= columns.length) return;
    setActiveColumn(index);
    isProgrammaticScroll.current = true;
    
    if (containerRef.current) {
      const targetChild = containerRef.current.children[index] as HTMLElement;
      if (targetChild) {
        targetChild.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
      } else {
        containerRef.current.scrollTo({
          left: index * containerRef.current.clientWidth,
          behavior: 'smooth'
        });
      }
    }

    setTimeout(() => {
      isProgrammaticScroll.current = false;
    }, 400);
  };

  const currentCol = columns[activeColumn];
  if (!currentCol) return null;

  return (
    <div className="kanban-board-mobile flex-1 flex flex-col min-h-0 overflow-hidden w-full max-w-full">
      {/* Column header with nav arrows */}
      <div className="flex items-center justify-between px-3 py-2 flex-shrink-0 bg-zinc-950/40 border-b border-zinc-800/40">
        <button 
          type="button"
          onClick={(e) => { 
            e.preventDefault(); 
            e.stopPropagation();
            scrollToColumn(activeColumn - 1); 
          }}
          disabled={activeColumn === 0}
          className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-20 disabled:pointer-events-none active:scale-95"
        >
          <ChevronLeft className="w-6 h-6 text-red-500" />
        </button>

        <div className="kanban-mobile-col-title flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${currentCol.color}`} />
          <span className="font-bold text-sm text-zinc-100">{currentCol.title}</span>
          <span className="text-[10px] text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded-full font-mono">
            {activeColumn + 1}/{columns.length}
          </span>
        </div>

        <button 
          type="button"
          onClick={(e) => { 
            e.preventDefault(); 
            e.stopPropagation();
            scrollToColumn(activeColumn + 1); 
          }}
          disabled={activeColumn === columns.length - 1}
          className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-20 disabled:pointer-events-none active:scale-95"
        >
          <ChevronRight className="w-6 h-6 text-red-500" />
        </button>
      </div>

      {/* Dot indicators */}
      <div className="kanban-mobile-dots flex-shrink-0 flex justify-center items-center gap-1.5 py-2 bg-zinc-950/20">
        {columns.map((col, i) => (
          <button 
            key={col.id} 
            type="button"
            className={`w-2.5 h-2.5 rounded-full transition-all ${
              i === activeColumn ? 'bg-red-500 w-5' : 'bg-zinc-700 hover:bg-zinc-500'
            }`}
            onClick={(e) => { 
              e.preventDefault(); 
              e.stopPropagation();
              scrollToColumn(i); 
            }}
          />
        ))}
      </div>

      {/* Swipeable column area using Native Scroll Snap */}
      <div 
        ref={containerRef}
        className="flex-1 flex overflow-x-auto overflow-y-hidden min-h-0 snap-x snap-mandatory scroll-smooth w-full max-w-full"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        onScroll={(e) => {
          if (isProgrammaticScroll.current) return;
          const container = e.currentTarget;
          const scrollLeft = container.scrollLeft;
          const width = container.clientWidth;
          if (width > 0) {
            const index = Math.round(scrollLeft / width);
            if (index !== activeColumn && index >= 0 && index < columns.length) {
              setActiveColumn(index);
            }
          }
        }}
      >
        {React.Children.map(children, (child, i) => (
          <div 
            key={columns[i]?.id || i} 
            className="kanban-col-wrapper flex-shrink-0 w-full h-full overflow-y-auto px-2 snap-center"
          >
            {child}
          </div>
        ))}
      </div>
    </div>
  );
};

export const MobileKanbanBoard = memo(MobileKanbanBoardInner);
