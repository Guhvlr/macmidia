import { useMemo, useCallback } from 'react';
import { useApp } from '@/contexts/useApp';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Send, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import KanbanCard from '@/features/kanban/components/KanbanCard';

const POSTING_COLUMNS = [
  { key: 'aprovado-programar', title: 'Aprovado e Programar', color: 'bg-info' },
  { key: 'postado', title: 'Postado', color: 'bg-success' },
  { key: 'alteracao', title: 'Alterações', color: 'bg-warning' },
] as const;

const PostingBoard = () => {
  const navigate = useNavigate();
  const { kanbanCards, employees, moveKanbanCard, loading } = useApp();

  const activeCards = useMemo(() =>
    kanbanCards.filter(c => {
      if (c.archivedAt && c.column !== 'postado') return false; 
      return ['aprovado-programar', 'postado', 'alteracao'].includes(c.column);
    }),
    [kanbanCards]
  );

  const cardsByColumn = useMemo(() => {
    const grouped: Record<string, typeof activeCards> = {};
    POSTING_COLUMNS.forEach(col => { grouped[col.key] = []; });
    activeCards.forEach(card => {
      if (grouped[card.column]) grouped[card.column].push(card);
    });
    return grouped;
  }, [activeCards]);

  const getEmployeeName = useCallback((id: string) =>
    employees.find(e => e.id === id)?.name || 'Desconhecido',
    [employees]
  );

  const handleDrop = useCallback((e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData('cardId');
    if (cardId) moveKanbanCard(cardId, colKey);
  }, [moveKanbanCard]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

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
              <div className="p-2 rounded-xl bg-primary/8">
                <Send className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">Quadros de Postagem</h1>
                <p className="text-[11px] text-muted-foreground">Gerencie conteúdos para publicação</p>
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

      <main className="flex-1 overflow-x-auto min-h-0 p-6 flex gap-5 items-start">
        {POSTING_COLUMNS.map(col => {
          const colCards = cardsByColumn[col.key] || [];
          return (
            <div
              key={col.key}
              onDragOver={handleDragOver}
              onDrop={e => handleDrop(e, col.key)}
              className="flex flex-col h-full min-w-[340px] w-[360px] flex-shrink-0"
            >
              <div className="flex items-center gap-2.5 mb-3 px-1 flex-shrink-0">
                <div className={`w-2.5 h-2.5 rounded-full ${col.color} shadow-sm`} />
                <h3 className="font-semibold text-[13px] tracking-wide uppercase">{col.title}</h3>
                <span className="text-[11px] text-muted-foreground bg-secondary/60 px-2.5 py-0.5 rounded-full font-medium border border-border/30">{colCards.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 p-3 rounded-2xl bg-secondary/15 border border-border/25">
                {colCards.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-12">Nenhum card</p>
                ) : (
                  colCards.map(card => (
                    <div key={card.id} className="relative">
                      <KanbanCard card={card} />
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
};

export default PostingBoard;
