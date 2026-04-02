import { useMemo, useCallback } from 'react';
import { useApp } from '@/contexts/useApp';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Wrench, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import KanbanCard from '@/components/KanbanCard';
import AddCardDialog from '@/components/AddCardDialog';

const CORRECTION_COLUMNS = [
  { key: 'para-producao', title: 'Para Produção', color: 'bg-info' },
  { key: 'em-producao', title: 'Em Produção', color: 'bg-warning' },
  { key: 'alteracao', title: 'Alteração', color: 'bg-primary' },
  { key: 'para-correcao', title: 'Para Correção', color: 'bg-destructive' },
  { key: 'correcao-cliente', title: 'Correção do Cliente', color: 'bg-destructive' },
  { key: 'aprovado-programar', title: 'Aprovado e Programar', color: 'bg-success' },
];

const CorrectionBoard = () => {
  const navigate = useNavigate();
  const { kanbanCards, employees, moveKanbanCard, loading } = useApp();

  const activeCards = useMemo(() => kanbanCards.filter(c => !c.archivedAt && CORRECTION_COLUMNS.some(col => col.key === c.column)), [kanbanCards]);

  // Pre-group cards by column for O(1) access
  const cardsByColumn = useMemo(() => {
    const grouped: Record<string, typeof activeCards> = {};
    CORRECTION_COLUMNS.forEach(col => { grouped[col.key] = []; });
    activeCards.forEach(card => {
      if (grouped[card.column]) grouped[card.column].push(card);
    });
    return grouped;
  }, [activeCards]);

  const getEmployeeName = useCallback((id: string) => employees.find(e => e.id === id)?.name || 'Desconhecido', [employees]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); }, []);

  const handleDrop = useCallback((e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData('cardId');
    if (cardId) moveKanbanCard(cardId, colKey);
  }, [moveKanbanCard]);

  if (loading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg">
      <header className="page-header sticky top-0 z-10">
        <div className="flex items-center gap-4 px-6 py-3.5">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="hover:bg-secondary rounded-xl">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/8 border border-primary/20">
              <Wrench className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Quadro de Correção e Produção</h1>
              <p className="text-[11px] text-muted-foreground">Visão geral unificada de todos os membros</p>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6">
        <div className="flex gap-5 overflow-x-auto pb-4 custom-scrollbar">
          {CORRECTION_COLUMNS.map(col => {
            const colCards = cardsByColumn[col.key] || [];
            return (
              <div
                key={col.key}
                onDragOver={handleDragOver}
                onDrop={e => handleDrop(e, col.key)}
                className="flex flex-col min-h-[500px] min-w-[340px] w-[360px] flex-shrink-0"
              >
                <div className="flex items-center gap-2.5 mb-3 px-1">
                  <div className={`w-2.5 h-2.5 rounded-full ${col.color} shadow-sm`} />
                  <h3 className="font-semibold text-[13px] tracking-wide uppercase text-white/90">{col.title}</h3>
                  <span className="text-[11px] text-muted-foreground bg-secondary/60 px-2.5 py-0.5 rounded-full font-medium border border-border/30">{colCards.length}</span>
                </div>
                
                <div className="space-y-3 flex-1 p-3 rounded-2xl bg-[#0f0f11]/60 border border-white/5 shadow-inner">
                  {colCards.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center p-8 opacity-40">
                      <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-3">
                        <Wrench className="w-5 h-5" />
                      </div>
                      <p className="text-xs text-center">Nenhum card</p>
                    </div>
                  ) : (
                    colCards.map(card => (
                      <div key={card.id} className="relative animate-in slide-in-from-bottom-2 fade-in duration-300">
                        {/* Indicador de Responsável (Membro) */}
                        <div className="text-[10px] text-muted-foreground mb-1.5 px-1.5 flex items-center justify-between">
                          <div className="flex items-center gap-1.5 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                            <span className="font-bold tracking-wide uppercase text-white/70">{getEmployeeName(card.employeeId)}</span>
                          </div>
                        </div>
                        <KanbanCard card={card} />
                      </div>
                    ))
                  )}
                </div>
                
                <div className="mt-3">
                  <AddCardDialog
                    employeeId={employees.length > 0 ? employees[0].id : ''}
                    columnKey={col.key}
                    showEmployeeSelect={true}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CorrectionBoard;
