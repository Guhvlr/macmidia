import { useApp } from '@/contexts/useApp';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import KanbanCard from '@/components/KanbanCard';

const POSTING_COLUMNS = [
  { key: 'aprovado-programar', title: 'Aprovado e Programar', color: 'bg-success' },
  { key: 'postado', title: 'Postado', color: 'bg-success' },
];

const PostingBoard = () => {
  const navigate = useNavigate();
  const { kanbanCards, employees, moveKanbanCard, loading } = useApp();

  const activeCards = kanbanCards.filter(c => !c.archivedAt || ['aprovado', 'programar', 'postado'].includes(c.column));

  const getEmployeeName = (id: string) => employees.find(e => e.id === id)?.name || 'Desconhecido';

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <header className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Send className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Quadros de Postagem</h1>
        </div>
      </header>

      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin" style={{ scrollbarColor: 'hsl(var(--muted-foreground)) transparent' }}>
        {POSTING_COLUMNS.map(col => {
          const colCards = activeCards.filter(c => c.column === col.key);
          return (
            <div
              key={col.key}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const cardId = e.dataTransfer.getData('cardId');
                if (cardId) moveKanbanCard(cardId, col.key);
              }}
              className="flex flex-col min-h-[300px] min-w-[320px] w-[340px] flex-shrink-0"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-2 h-2 rounded-full ${col.color}`} />
                <h3 className="font-semibold text-sm">{col.title}</h3>
                <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{colCards.length}</span>
              </div>
              <div className="space-y-3 flex-1 p-2 rounded-xl bg-secondary/30 border border-border/30">
                {colCards.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">Nenhum card</p>
                ) : (
                  colCards.map(card => (
                    <div key={card.id} className="relative">
                      <div className="text-[10px] text-muted-foreground mb-1 px-1 flex items-center gap-1">
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
  );
};

export default PostingBoard;
