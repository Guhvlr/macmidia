import { useMemo } from 'react';
import { useApp } from '@/contexts/useApp';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, FileEdit, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import KanbanColumn from '@/features/kanban/components/KanbanColumn';
import { useDraggableScroll } from '@/hooks/useDraggableScroll';
import { useIsMobile } from '@/hooks/useIsMobile';
import { KanbanBoardDndContext } from '@/features/kanban/components/KanbanBoardDndContext';
import { MobileKanbanBoard } from '@/features/kanban/components/MobileKanbanBoard';
import { KanbanSearch } from '@/features/kanban/components/KanbanSearch';

const KANBAN_COLUMNS = [
  { key: 'para-producao', title: 'Para Produção', color: 'bg-info' },
  { key: 'em-producao', title: 'Em Produção', color: 'bg-warning' },
  { key: 'alteracao', title: 'Alteração', color: 'bg-destructive' },
  { key: 'para-correcao', title: 'Para Correção', color: 'bg-destructive' },
  { key: 'correcao-cliente', title: 'Correção do Cliente', color: 'bg-destructive' },
  { key: 'aprovado-programar', title: 'Aprovado e Programar', color: 'bg-info' },
] as const;

const CorrectionBoard = () => {
  const navigate = useNavigate();
  const { kanbanCards, loading, memberFilter } = useApp();
  const { ref: scrollRef, onMouseDown } = useDraggableScroll();
  const isMobile = useIsMobile();

  const activeCards = useMemo(() =>
    kanbanCards.filter(c => {
      if (c.archivedAt && c.column !== 'postado') return false;
      if (!KANBAN_COLUMNS.some(col => col.key === c.column)) return false;
      
      if (memberFilter.length > 0) {
        const isAssigned = c.assignedUsers?.some(u => memberFilter.includes(u.id));
        const isEmployee = memberFilter.includes(c.employeeId);
        if (!isAssigned && !isEmployee) return false;
      }
      return true;
    }),
    [kanbanCards, memberFilter]
  );

  const cardsByColumn = useMemo(() => {
    const grouped: Record<string, typeof activeCards> = {};
    KANBAN_COLUMNS.forEach(col => { grouped[col.key] = []; });
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
    <div className="h-screen overflow-hidden flex flex-col kanban-custom-bg">
      <header className="page-header flex-shrink-0">
        <div className="flex items-center justify-between px-3 py-2 md:px-6 md:py-3.5">
          <div className="flex items-center gap-2 md:gap-4 w-full md:w-auto">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => {
                const dest = sessionStorage.getItem('mobile_destination_chosen') || '/';
                navigate(dest);
              }} 
              className="hover:bg-secondary rounded-xl h-8 w-8 md:h-10 md:w-10"
            >
              <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
            </Button>
            <div className="flex items-center gap-2 md:gap-2.5">
              <div className="p-1.5 md:p-2 rounded-xl bg-destructive/10">
                <FileEdit className="w-4 h-4 md:w-5 md:h-5 text-destructive" />
              </div>
              <div>
                <h1 className="text-sm md:text-lg font-bold text-foreground">Quadros de Correção</h1>
                <p className="hidden md:block text-[11px] text-muted-foreground">Gerencie artes que precisam de ajustes</p>
              </div>
            </div>
            
            <div className="hidden md:block flex-1 max-w-4xl mx-8">
              <KanbanSearch />
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate('/arquivados')} 
            className="hidden md:flex border-border/50 hover:border-primary/30 rounded-xl text-xs bg-secondary/20 h-9 px-4 transition-all hover:bg-secondary/40"
          >
            <Archive className="w-4 h-4 mr-2 text-primary" /> Central de Arquivados
          </Button>
        </div>
      </header>

      <KanbanBoardDndContext>
        {!isMobile && (
          <main 
            ref={scrollRef as any}
            onMouseDown={onMouseDown}
            className="kanban-board-desktop flex-1 overflow-x-auto overflow-y-hidden min-h-0 p-6 flex gap-5 items-start custom-scrollbar cursor-grab active:cursor-grabbing select-none"
          >
            {KANBAN_COLUMNS.map(col => (
              <KanbanColumn
                key={col.key}
                id={col.key}
                title={col.title}
                color={col.color}
                cards={cardsByColumn[col.key] || []}
                count={(cardsByColumn[col.key] || []).length}
                employeeId=""
              />
            ))}
          </main>
        )}
        {isMobile && (
          <MobileKanbanBoard
            columns={KANBAN_COLUMNS.map(col => ({ id: col.key, title: col.title, color: col.color }))}
          >
            {KANBAN_COLUMNS.map(col => (
              <KanbanColumn
                key={col.key}
                id={col.key}
                title={col.title}
                color={col.color}
                cards={cardsByColumn[col.key] || []}
                count={(cardsByColumn[col.key] || []).length}
                employeeId=""
              />
            ))}
          </MobileKanbanBoard>
        )}
      </KanbanBoardDndContext>
    </div>
  );
};

export default CorrectionBoard;
