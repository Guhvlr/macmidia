import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/useApp';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Archive, Trash2, Clock, AlertTriangle, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ArchivedCard {
  id: string;
  clientName: string;
  description: string;
  archivedAt: string;
  timeSpent: number;
  images: string[];
  employeeId: string;
}

const PAGE_SIZE = 12;

const ArchivedCards = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { employees } = useApp();
  const [cards, setCards] = useState<ArchivedCard[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);

  const employee = id ? employees.find(e => e.id === id) : null;

  const fetchArchived = async (pageNum: number) => {
    setLoading(true);
    const cutoff15 = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
    
    let query = supabase
      .from('kanban_cards')
      .select('*')
      .not('archived_at', 'is', null)
      .lte('archived_at', cutoff15)
      .order('archived_at', { ascending: false })
      .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

    if (id) {
      query = query.eq('employee_id', id);
    }

    const { data } = await query;

    if (data) {
      const mapped = data.map((row: any) => ({
        id: row.id,
        clientName: row.client_name,
        description: row.description,
        archivedAt: row.archived_at,
        timeSpent: row.time_spent,
        images: row.images || [],
        employeeId: row.employee_id
      }));
      setCards(prev => pageNum === 0 ? mapped : [...prev, ...mapped]);
      setHasMore(data.length === PAGE_SIZE);
    }
    setLoading(false);
  };

  useEffect(() => { fetchArchived(0); }, [id]);

  const handleDelete = async (cardId: string) => {
    if (!confirm('Tem certeza que deseja excluir permanentemente este card?')) return;
    await supabase.from('kanban_cards').delete().eq('id', cardId);
    setCards(prev => prev.filter(c => c.id !== cardId));
  };

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const daysUntilDeletion = (archivedAt: string) => {
    const archived = new Date(archivedAt).getTime();
    const deleteAt = archived + 60 * 24 * 60 * 60 * 1000;
    return Math.max(0, Math.ceil((deleteAt - Date.now()) / (24 * 60 * 60 * 1000)));
  };

  const getEmployeeName = (empId: string) => {
    return employees.find(e => e.id === empId)?.name || 'Desconhecido';
  };

  return (
    <div className="min-h-screen gradient-bg">
      <header className="page-header sticky top-0 z-10 bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-4 px-6 py-3.5">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="hover:bg-secondary rounded-xl">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="p-2 rounded-xl bg-primary/8">
            <Archive className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">
              {id ? `Arquivados — ${employee?.name}` : 'Central de Arquivados'}
            </h1>
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-tight">
              Cards finalizados há mais de 15 dias · Exclusão automática em 60 dias
            </p>
          </div>
        </div>
      </header>

      <div className="p-6 md:p-10 max-w-7xl mx-auto">
        {cards.length === 0 && !loading && (
          <div className="glass-card p-20 text-center max-w-lg mx-auto animate-fade-in border-dashed border-2">
            <Archive className="w-16 h-16 mx-auto text-muted-foreground/10 mb-6" />
            <h3 className="text-lg font-bold text-foreground/80 mb-2">Nada por aqui ainda</h3>
            <p className="text-muted-foreground text-sm">Nenhum card atingiu o tempo de arquivamento automático.</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {cards.map((card, i) => (
            <div key={card.id} className="glass-card p-0 overflow-hidden flex flex-col group animate-slide-up" style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="relative h-32 overflow-hidden bg-black/40">
                {card.images[0] ? (
                  <img src={card.images[0]} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center opacity-20"><Archive className="w-10 h-10" /></div>
                )}
                {!id && (
                  <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-[10px] font-bold text-white/90 border border-white/10 flex items-center gap-1.5 shadow-lg uppercase">
                    <User className="w-2.5 h-2.5 text-primary" /> {getEmployeeName(card.employeeId)}
                  </div>
                )}
              </div>
              <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <h4 className="font-bold text-[13px] text-foreground leading-tight line-clamp-1 mb-1.5 uppercase">{card.clientName}</h4>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{card.description || 'Sem descrição'}</p>
                </div>
                
                <div className="pt-4 border-t border-white/5 space-y-3">
                  <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                    <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{formatTime(card.timeSpent)}</span>
                    <span className={`flex items-center gap-1.5 ${daysUntilDeletion(card.archivedAt) < 5 ? 'text-red-400 font-bold' : 'text-amber-500/80'}`}>
                      <AlertTriangle className="w-3.5 h-3.5" /> Deleta em {daysUntilDeletion(card.archivedAt)} dias
                    </span>
                  </div>
                  
                  <Button variant="ghost" size="sm" className="w-full text-red-400/70 hover:text-red-400 hover:bg-red-500/10 rounded-lg text-xs h-8 border border-transparent hover:border-red-500/20" onClick={() => handleDelete(card.id)}>
                    <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir permanentemente
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {hasMore && cards.length > 0 && (
          <div className="flex justify-center mt-10">
            <Button variant="outline" onClick={() => { const next = page + 1; setPage(next); fetchArchived(next); }} disabled={loading} className="rounded-xl px-8 h-10 border-border/50 hover:border-primary/50 text-xs font-bold uppercase transition-all">
              {loading ? 'Carregando...' : 'Ver mais itens'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ArchivedCards;