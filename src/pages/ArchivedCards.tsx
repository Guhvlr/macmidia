import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Archive, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ArchivedCard {
  id: string;
  clientName: string;
  description: string;
  archivedAt: string;
  timeSpent: number;
  images: string[];
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

  const employee = employees.find(e => e.id === id);

  const fetchArchived = async (pageNum: number) => {
    setLoading(true);
    const cutoff15 = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('kanban_cards')
      .select('*')
      .eq('employee_id', id!)
      .eq('column', 'done')
      .not('archived_at', 'is', null)
      .lte('archived_at', cutoff15)
      .order('archived_at', { ascending: false })
      .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

    if (data) {
      const mapped = data.map((row: any) => ({
        id: row.id,
        clientName: row.client_name,
        description: row.description,
        archivedAt: row.archived_at,
        timeSpent: row.time_spent,
        images: row.images || [],
      }));
      setCards(prev => pageNum === 0 ? mapped : [...prev, ...mapped]);
      setHasMore(data.length === PAGE_SIZE);
    }
    setLoading(false);
  };

  useEffect(() => { fetchArchived(0); }, [id]);

  const handleDelete = async (cardId: string) => {
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

  if (!employee) return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Funcionário não encontrado</div>;

  return (
    <div className="min-h-screen bg-background p-6">
      <header className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/funcionario/${id}`)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <Archive className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Arquivados — {employee.name}</h1>
          <p className="text-sm text-muted-foreground">Cards finalizados há mais de 15 dias. Exclusão automática após 60 dias.</p>
        </div>
      </header>

      {cards.length === 0 && !loading && (
        <div className="text-center text-muted-foreground py-16">Nenhum card arquivado.</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(card => (
          <div key={card.id} className="glass-card p-4 space-y-2">
            {card.images[0] && <img src={card.images[0]} alt="" className="w-full h-24 object-cover rounded-lg" />}
            <h4 className="font-medium text-card-foreground">{card.clientName}</h4>
            <p className="text-xs text-muted-foreground line-clamp-2">{card.description}</p>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Tempo: {formatTime(card.timeSpent)}</span>
              <span className="text-destructive/70">{daysUntilDeletion(card.archivedAt)} dias para exclusão</span>
            </div>
            <Button variant="ghost" size="sm" className="w-full text-destructive hover:bg-destructive/10" onClick={() => handleDelete(card.id)}>
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir agora
            </Button>
          </div>
        ))}
      </div>

      {hasMore && cards.length > 0 && (
        <div className="flex justify-center mt-6">
          <Button variant="outline" onClick={() => { const next = page + 1; setPage(next); fetchArchived(next); }} disabled={loading}>
            {loading ? 'Carregando...' : 'Carregar mais'}
          </Button>
        </div>
      )}
    </div>
  );
};

export default ArchivedCards;