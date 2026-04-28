import { useMemo } from 'react';
import { useApp } from '@/contexts/useApp';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, FileEdit, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import KanbanColumn from '@/features/kanban/components/KanbanColumn';
import { useDraggableScroll } from '@/hooks/useDraggableScroll';
import { KanbanBoardDndContext } from '@/features/kanban/components/KanbanBoardDndContext';

const CORRECTION_COLUMNS = [
  { key: 'para-correcao', title: 'Para Correção', color: 'bg-destructive' },
  { key: 'correcao-cliente', title: 'Aprovação do Cliente', color: 'bg-warning' },
] as const;

const CorrectionBoard = () => {
  const navigate = useNavigate();
  const { kanbanCards, loading } = useApp();
  const { ref: scrollRef, onMouseDown } = useDraggableScroll();

  const activeCards = useMemo(() =>
    kanbanCards.filter(c => {
      if (c.archivedAt) return false;
      return ['para-correcao', 'correcao-cliente'].includes(c.column);
    }),
    [kanbanCards]
  );

  const cardsByColumn = useMemo(() => {
    const grouped: Record<string, typeof activeCards> = {};
    CORRECTION_COLUMNS.forEach(col => { grouped[col.key] = []; });
    activeCards.forEach(card => {
      if (grouped[card.column]) grouped[card.column].push(card);
    });
    return grouped;
  }, [activeCards]);

  if (loading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col gradient-bg">
      <header className="page-header flex-shrink-0">
        <div className="flex items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="hover:bg-secondary rounded-xl">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-destructive/10">
                <FileEdit className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">Quadros de Correção</h1>
                <p className="text-[11px] text-muted-foreground">Gerencie artes que precisam de ajustes</p>
              </div>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate('/arquivados')} 
            className="border-border/50 hover:border-primary/30 rounded-xl text-xs bg-secondary/20 h-9 px-4 transition-all hover:bg-secondary/40"
          >
            <Archive className="w-4 h-4 mr-2 text-primary" /> Central de Arquivados
          </Button>
        </div>
      </header>

      <KanbanBoardDndContext>
        <main 
          ref={scrollRef as any}
          onMouseDown={onMouseDown}
          className="flex-1 overflow-x-auto overflow-y-hidden min-h-0 p-6 flex gap-5 items-start custom-scrollbar cursor-grab active:cursor-grabbing select-none"
        >
          {CORRECTION_COLUMNS.map(col => (
            <KanbanColumn
              key={col.key}
              id={col.key}
              title={col.title}
              color={col.color}
              cards={cardsByColumn[col.key] || []}
              count={(cardsByColumn[col.key] || []).length}
            />
          ))}
        </main>
      </KanbanBoardDndContext>
    </div>
  );
};

export default CorrectionBoard;
