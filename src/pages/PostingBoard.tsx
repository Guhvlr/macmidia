import { useMemo, useCallback } from 'react';
import { useApp } from '@/contexts/useApp';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import KanbanCard from '@/components/KanbanCard';

const POSTING_COLUMNS = [
  { key: 'aprovado-programar', title: 'Aprovado e Programar', color: 'bg-info' },
  { key: 'postado', title: 'Postado', color: 'bg-success' },
  { key: 'alteracao', title: 'Alterações', color: 'bg-warning' },
] as const;

const PostingBoard = () => {
  const navigate = useNavigate();
  const { kanbanCards, employees, moveKanbanCard, loading } = useApp();

  // Memoize filtered cards to avoid recalculating on every render
  const activeCards = useMemo(() =>
    kanbanCards.filter(c => {
      if (c.archivedAt && c.column !== 'postado') return false; 
      return ['aprovado-programar', 'postado', 'alteracao'].includes(c.column);
    }),
    [kanbanCards]
  );

  // Memoize cards grouped by column for O(1) access
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
    <div className="min-h-screen gradient-bg">
      <header className="page-header">
        <div className="flex items-center gap-4 px-6 py-3.5">
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
      </header>

      <div className="p-6">
        <div className="flex gap-5 overflow-x-auto pb-4">
          {POSTING_COLUMNS.map(col => {
            const colCards = cardsByColumn[col.key] || [];
            return (
              <div
                key={col.key}
                onDragOver={handleDragOver}
                onDrop={e => handleDrop(e, col.key)}
                className="flex flex-col min-h-[420px] min-w-[340px] w-[360px] flex-shrink-0"
              >
                <div className="flex items-center gap-2.5 mb-3 px-1">
                  <div className={`w-2.5 h-2.5 rounded-full ${col.color} shadow-sm`} />
                  <h3 className="font-semibold text-[13px] tracking-wide uppercase">{col.title}</h3>
                  <span className="text-[11px] text-muted-foreground bg-secondary/60 px-2.5 py-0.5 rounded-full font-medium border border-border/30">{colCards.length}</span>
                </div>
                <div className="space-y-3 flex-1 p-3 rounded-2xl bg-secondary/15 border border-border/25">
                  {colCards.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-12">Nenhum card</p>
                  ) : (
                    colCards.map(card => (
                      <div key={card.id} className="relative">
                        <div className="text-[10px] text-muted-foreground mb-1.5 px-1 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                          <span className="font-medium">{getEmployeeName(card.employeeId)}</span>
                        </div>
                        <KanbanCard card={card} />
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PostingBoard;
