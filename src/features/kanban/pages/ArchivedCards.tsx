import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/useApp';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Archive, Trash2, Clock, AlertTriangle, User, RotateCcw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { BulkDeleteArchivedModal } from '../components/BulkDeleteArchivedModal';
import { executeBulkDelete } from '../utils/bulkDelete';

interface ArchivedCard {
  id: string;
  clientName: string;
  description: string;
  archivedAt: string;
  timeSpent: number;
  images: string[];
  employeeId: string;
  cover_image?: string;
  comments?: any[];
}

const PAGE_SIZE = 12;

const ArchivedCards = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { employees, loggedUserRole } = useApp();
  const [cards, setCards] = useState<ArchivedCard[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'newest' | 'expiring' | 'urgent'>('newest');
  const [totalCards, setTotalCards] = useState<number>(0);
  const [showBulkModal, setShowBulkModal] = useState(false);

  const employee = id ? employees.find(e => e.id === id) : null;

  const fetchArchived = async (pageNum: number, queryText?: string, mode?: string) => {
    setLoading(true);
    const currentMode = mode || filterMode;
    let query = supabase
      .from('kanban_cards')
      .select('*', { count: 'exact' })
      .not('archived_at', 'is', null)
      .order('archived_at', { ascending: currentMode === 'urgent' })
      .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

    if (currentMode === 'urgent') {
      const cutoff = new Date(Date.now() - 53 * 24 * 60 * 60 * 1000).toISOString();
      query = query.lte('archived_at', cutoff);
    }

    if (id) {
      query = query.eq('employee_id', id);
    }

    if (queryText || searchQuery) {
      query = query.ilike('client_name', `%${queryText || searchQuery}%`);
    }

    const { data, count } = await query;

    if (count !== null && pageNum === 0) {
      setTotalCards(count);
    }

    if (data) {
      const mapped = data.map((row: any) => ({
        id: row.id,
        clientName: row.client_name,
        description: row.description,
        archivedAt: row.archived_at,
        timeSpent: row.time_spent,
        images: row.images || [],
        employeeId: row.employee_id,
        cover_image: row.cover_image,
        comments: row.comments
      }));
      setCards(prev => pageNum === 0 ? mapped : [...prev, ...mapped]);
      setHasMore(data.length === PAGE_SIZE);
    }
    setLoading(false);
  };

  useEffect(() => { fetchArchived(0); }, [id]);

  useEffect(() => {
    if (loggedUserRole === 'GUEST') {
      toast.error('Acesso restrito. Visitantes não podem acessar a Central de Arquivados.');
      navigate('/');
    }
  }, [loggedUserRole, navigate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchArchived(0, searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleDelete = async (cardId: string) => {
    if (!confirm('Tem certeza que deseja excluir permanentemente este card?')) return;
    
    const cardToDelete = cards.find(c => c.id === cardId);
    if (cardToDelete) {
      await executeBulkDelete([cardToDelete]);
    } else {
      await supabase.from('kanban_cards').delete().eq('id', cardId);
    }
    
    setCards(prev => prev.filter(c => c.id !== cardId));
    setTotalCards(prev => Math.max(0, prev - 1));
    toast.success('Card excluído permanentemente.');
  };

  const handleRestore = async (cardId: string) => {
    const { error } = await supabase
      .from('kanban_cards')
      .update({ archived_at: null })
      .eq('id', cardId);
    
    if (error) {
      toast.error('Erro ao restaurar card.');
      return;
    }

    setCards(prev => prev.filter(c => c.id !== cardId));
    toast.success('Card restaurado para o quadro principal!');
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
            <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
              {id ? `Arquivados — ${employee?.name}` : 'Central de Arquivados'}
              {!loading && (
                <span className="bg-white/10 text-white/80 text-xs px-2 py-0.5 rounded-full font-medium">
                  {totalCards}
                </span>
              )}
            </h1>
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-tight">
              Cards finalizados há mais de 15 dias · Exclusão automática em 60 dias
            </p>
          </div>

          <div className="ml-auto flex items-center gap-3 w-full max-w-lg hidden md:flex justify-end">
            {loggedUserRole === 'ADMIN' && (
              <Button 
                variant="outline" 
                onClick={() => setShowBulkModal(true)}
                className="rounded-xl border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-400 font-medium whitespace-nowrap"
              >
                <Trash2 className="w-4 h-4 mr-2" /> Limpeza de Arquivados
              </Button>
            )}

            <Select value={filterMode} onValueChange={(val: any) => { setFilterMode(val); setPage(0); fetchArchived(0, searchQuery, val); }}>
              <SelectTrigger className="w-[180px] h-10 rounded-xl bg-background/50 border-white/5 focus:ring-primary/20 font-medium">
                <SelectValue placeholder="Filtro" />
              </SelectTrigger>
              <SelectContent className="bg-[#121214] border-white/10 text-white rounded-xl">
                <SelectItem value="newest" className="focus:bg-white/5 focus:text-white rounded-lg cursor-pointer">Mais recentes</SelectItem>
                <SelectItem value="expiring" className="focus:bg-white/5 focus:text-white rounded-lg cursor-pointer">A excluir primeiro</SelectItem>
                <SelectItem value="urgent" className="text-red-400 font-bold focus:bg-white/5 focus:text-red-400 rounded-lg cursor-pointer">Menos de 7 dias</SelectItem>
              </SelectContent>
            </Select>

            <div className="w-full max-w-xs relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
              <Input 
                placeholder="Pesquisar cliente..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 rounded-xl bg-background/50 border-white/5 focus:ring-primary/20 transition-all font-medium"
              />
            </div>
          </div>
        </div>
        
        {/* Mobile Search Input */}
        <div className="px-6 pb-4 md:hidden flex flex-col gap-3">
          <Select value={filterMode} onValueChange={(val: any) => { setFilterMode(val); setPage(0); fetchArchived(0, searchQuery, val); }}>
            <SelectTrigger className="w-full h-11 rounded-xl bg-background/50 border-white/5 focus:ring-primary/20 font-medium">
              <SelectValue placeholder="Filtro" />
            </SelectTrigger>
            <SelectContent className="bg-[#121214] border-white/10 text-white rounded-xl">
              <SelectItem value="newest" className="focus:bg-white/5 focus:text-white rounded-lg cursor-pointer">Mais recentes</SelectItem>
              <SelectItem value="expiring" className="focus:bg-white/5 focus:text-white rounded-lg cursor-pointer">A excluir primeiro</SelectItem>
              <SelectItem value="urgent" className="text-red-400 font-bold focus:bg-white/5 focus:text-red-400 rounded-lg cursor-pointer">Menos de 7 dias</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Pesquisar cliente..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 rounded-xl bg-background/50 border-white/5 focus:ring-primary/20 transition-all font-medium"
            />
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
                  
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 text-primary hover:text-primary hover:bg-primary/10 rounded-lg text-xs h-8 border-primary/20 hover:border-primary/40" 
                      onClick={() => handleRestore(card.id)}
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-2" /> Restaurar
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 rounded-lg border border-transparent hover:border-red-500/20" 
                      onClick={() => handleDelete(card.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
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

      <BulkDeleteArchivedModal 
        open={showBulkModal} 
        onOpenChange={setShowBulkModal} 
        onSuccess={() => { setPage(0); fetchArchived(0, searchQuery); }} 
      />
    </div>
  );
};

export default ArchivedCards;