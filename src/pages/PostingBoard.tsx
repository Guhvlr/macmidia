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

  const activeCards = kanbanCards.filter(c => !c.archivedAt || ['aprovado-programar', 'postado'].includes(c.column));

  const getEmployeeName = (id: string) => employees.find(e => e.id === id)?.name || 'Desconhecido';

  if (loading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg">
      <header className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-4 px-6 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="hover:bg-secondary">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10">
              <Send className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Quadros de Postagem</h1>
          </div>
        </div>
      </header>

      <div className="p-6">
        <div className="flex gap-5 overflow-x-auto pb-4" style={{ scrollbarColor: 'hsl(0 0% 25%) transparent' }}>
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
                className="flex flex-col min-h-[400px] min-w-[330px] w-[350px] flex-shrink-0"
              >
                <div className="flex items-center gap-2.5 mb-3 px-1">
                  <div className={`w-2.5 h-2.5 rounded-full ${col.color} shadow-sm`} />
                  <h3 className="font-semibold text-sm tracking-wide">{col.title}</h3>
                  <span className="text-[11px] text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full font-medium">{colCards.length}</span>
                </div>
                <div className="space-y-2.5 flex-1 p-2.5 rounded-2xl bg-secondary/20 border border-border/30">
                  {colCards.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-12">Nenhum card</p>
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
    </div>
  );
};

export default PostingBoard;
