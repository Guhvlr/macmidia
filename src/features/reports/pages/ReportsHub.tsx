import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/contexts/useApp';
import { 
  FileText, 
  Calendar as CalendarIcon, 
  User as UserIcon, 
  Search, 
  Filter, 
  Download, 
  CheckCircle2, 
  Archive,
  ArrowRight,
  Printer,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Clock,
  Eye,
  Image as ImageIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { KanbanCard } from '@/contexts/app-types';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const ReportsHub = () => {
  const { calendarClients, loading: appLoading } = useApp();
  
  const [selectedClientId, setSelectedClientId] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>(format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [statusFilter, setStatusFilter] = useState<'all' | 'postado' | 'arquivado'>('all');
  const [fetchedCards, setFetchedCards] = useState<KanbanCard[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchArchived = async () => {
    setLoading(true);
    try {
      let query = supabase.from('kanban_cards').select('*');
      
      if (selectedClientId !== 'all') {
        query = query.eq('calendar_client_id', selectedClientId);
      }
      
      const start = startOfDay(parseISO(startDate)).toISOString();
      const end = endOfDay(parseISO(endDate)).toISOString();
      
      query = query.gte('archived_at', start).lte('archived_at', end);

      const { data, error } = await query;
      
      if (error) throw error;
      
      const mapped = (data || []).map(row => ({
        id: row.id,
        clientName: row.client_name,
        calendarClientId: row.calendar_client_id,
        calendarClientName: row.calendar_client_name,
        description: row.description,
        column: row.column,
        archivedAt: row.archived_at,
        coverImage: row.cover_image,
        images: row.images,
        employeeId: row.employee_id,
        // ... other fields as needed for the report
      })) as KanbanCard[];
      
      setFetchedCards(mapped);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar cards arquivados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchived();
  }, [selectedClientId, startDate, endDate]);

  const filteredCards = useMemo(() => {
    return fetchedCards;
  }, [fetchedCards]);

  const postedCards = useMemo(() => filteredCards.filter(c => c.column === 'postado'), [filteredCards]);
  const archivedCards = useMemo(() => filteredCards.filter(c => c.column !== 'postado'), [filteredCards]);

  const displayCards = useMemo(() => {
    if (statusFilter === 'postado') return postedCards;
    if (statusFilter === 'arquivado') return archivedCards;
    return filteredCards;
  }, [statusFilter, postedCards, archivedCards, filteredCards]);

  const handlePrint = () => {
    if (selectedClientId === 'all') {
      toast.error('Selecione um cliente para gerar o relatório.');
      return;
    }
    toast.success('Gerando relatório visual para o cliente...');
    setTimeout(() => {
      window.print();
    }, 500);
  };

  const clientName = useMemo(() => {
    if (selectedClientId === 'all') return 'Todos os Clientes';
    return calendarClients.find(c => c.id === selectedClientId)?.name || 'Cliente Desconhecido';
  }, [selectedClientId, calendarClients]);

  return (
    <div className="min-h-screen bg-[#080808] text-white p-4 md:p-8 pt-6">
      {/* Header & Controls */}
      <div className="max-w-7xl mx-auto space-y-8 no-print">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-black uppercase tracking-tighter italic flex items-center gap-3">
              <FileText className="w-8 h-8 text-primary" /> Relatórios de Entrega
            </h1>
            <p className="text-xs text-white/40 uppercase tracking-[0.2em] font-bold">Gestão e exportação de resultados por cliente</p>
          </div>
          
          <Button 
            onClick={handlePrint}
            disabled={selectedClientId === 'all'}
            className="btn-primary-glow bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-[10px] h-12 px-8 rounded-xl shadow-2xl"
          >
            <Printer className="w-4 h-4 mr-2" /> Gerar Relatório PDF
          </Button>
        </div>

        {/* Filters Card */}
        <div className="glass-card p-6 border-white/5 bg-white/[0.02] rounded-2xl flex flex-wrap gap-6 items-end">
          <div className="space-y-2 min-w-[200px] flex-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Cliente</label>
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger className="bg-white/5 border-white/10 h-11 rounded-xl focus:ring-primary/30">
                <SelectValue placeholder="Selecione o cliente" />
              </SelectTrigger>
              <SelectContent className="bg-[#161618] border-white/10 text-white">
                <SelectItem value="all">Todos os Clientes</SelectItem>
                {calendarClients.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Início</label>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-white/5 border border-white/10 h-11 rounded-xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Fim</label>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-white/5 border border-white/10 h-11 rounded-xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            />
          </div>

          <div className="space-y-2 min-w-[150px]">
            <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Status</label>
            <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
              <SelectTrigger className="bg-white/5 border-white/10 h-11 rounded-xl focus:ring-primary/30">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent className="bg-[#161618] border-white/10 text-white">
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="postado">Postados</SelectItem>
                <SelectItem value="arquivado">Arquivados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Board View */}
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <Clock className="w-8 h-8 text-primary animate-spin" />
            <span className="ml-3 text-xs font-black uppercase tracking-widest text-white/40">Carregando dados históricos...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Posted Column */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                  <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white/60">Postados</h2>
                  <span className="bg-white/5 px-2 py-0.5 rounded text-[10px] font-bold text-white/30">{postedCards.length}</span>
                </div>
              </div>
              
              <div className="space-y-3">
                {postedCards.length === 0 ? (
                  <div className="h-40 border-2 border-dashed border-white/5 rounded-2xl flex items-center justify-center text-white/10 text-xs uppercase font-black tracking-widest">
                    Nenhum card postado no período
                  </div>
                ) : (
                  postedCards.map(card => (
                    <ReportCard key={card.id} card={card} />
                  ))
                )}
              </div>
            </div>

            {/* Archived Column */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-white/20" />
                  <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white/60">Arquivados / Central</h2>
                  <span className="bg-white/5 px-2 py-0.5 rounded text-[10px] font-bold text-white/30">{archivedCards.length}</span>
                </div>
              </div>
              
              <div className="space-y-3">
                {archivedCards.length === 0 ? (
                  <div className="h-40 border-2 border-dashed border-white/5 rounded-2xl flex items-center justify-center text-white/10 text-xs uppercase font-black tracking-widest">
                    Nenhum card arquivado no período
                  </div>
                ) : (
                  archivedCards.map(card => (
                    <ReportCard key={card.id} card={card} />
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PRINT VERSION (A4 Premium) */}
      <div className="hidden print:block bg-white text-[#1a1a1a] p-0 m-0 w-full min-h-screen font-sans">
        <div className="p-12 space-y-10">
          {/* Top Date */}
          <div className="flex justify-end">
            <div className="flex items-center gap-2 text-[#666] text-[10px] font-bold uppercase tracking-wider">
               <CalendarIcon className="w-3 h-3" />
               Gerado em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}
            </div>
          </div>

          {/* PDF Header */}
          <div className="space-y-8">
            <div className="space-y-1">
              <h1 className="text-5xl font-black uppercase tracking-tight leading-[0.9] text-[#050505]">
                Relatório de<br />
                <span className="text-[#ff1a1a]">Atividades</span>
              </h1>
              <div className="h-1.5 w-24 bg-[#ff1a1a] mt-4" />
            </div>

            <div className="grid grid-cols-2 gap-6 pt-4">
              <div className="bg-[#f8f9fa] border border-[#eee] rounded-2xl p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#ff1a1a] flex items-center justify-center text-white shadow-lg shadow-red-500/20">
                  <UserIcon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[#999] uppercase tracking-widest">Cliente:</p>
                  <p className="text-lg font-black text-[#1a1a1a] uppercase">{clientName}</p>
                </div>
              </div>
              <div className="bg-[#f8f9fa] border border-[#eee] rounded-2xl p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#f0f2f5] flex items-center justify-center text-[#ff1a1a] border border-[#ff1a1a]/10">
                  <CalendarIcon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[#999] uppercase tracking-widest">Período:</p>
                  <p className="text-md font-black text-[#1a1a1a] uppercase">
                    {format(parseISO(startDate), 'dd/MM/yyyy')} a {format(parseISO(endDate), 'dd/MM/yyyy')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* PDF Content List */}
          <div className="space-y-12 pt-6">
            {filteredCards.length === 0 ? (
              <div className="text-center py-40 border-2 border-dashed border-gray-100 rounded-3xl">
                <p className="text-gray-300 font-black uppercase tracking-[0.2em]">Nenhuma atividade registrada no período selecionado.</p>
              </div>
            ) : (
              // Group by day
              Object.entries(
                filteredCards.reduce((acc, card) => {
                  const date = card.archivedAt ? format(parseISO(card.archivedAt), 'yyyy-MM-dd') : 'Sem data';
                  if (!acc[date]) acc[date] = [];
                  acc[date].push(card);
                  return acc;
                }, {} as Record<string, KanbanCard[]>)
              )
              .sort((a, b) => b[0].localeCompare(a[0]))
              .map(([date, cards]) => (
                <div key={date} className="space-y-6 break-inside-avoid pt-4">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-[#ff1a1a] flex items-center justify-center text-white shadow-lg shadow-red-500/20">
                       <CalendarIcon className="w-4 h-4" />
                    </div>
                    <h3 className="text-xl font-black uppercase tracking-tight text-[#1a1a1a]">
                      {date === 'Sem data' ? 'Sem data' : format(parseISO(date), "dd 'de' MMMM", { locale: ptBR })}
                    </h3>
                    <div className="h-px flex-1 bg-gray-100" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-8">
                    {cards.map(card => (
                      <div key={card.id} className="bg-white border border-[#eee] rounded-[1.5rem] overflow-hidden flex flex-col shadow-sm break-inside-avoid">
                        <div className="aspect-video bg-[#f8f9fa] relative overflow-hidden flex items-center justify-center border-b border-[#eee]">
                          {card.coverImage ? (
                            <img src={card.coverImage} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-[10px] text-gray-300 font-bold uppercase text-center p-6 gap-2">
                               <ImageIcon className="w-8 h-8 opacity-20" />
                               Sem Prévia Visual
                            </div>
                          )}
                        </div>
                        <div className="p-5 flex flex-col justify-between flex-1 gap-4">
                          <h4 className="font-black uppercase text-sm leading-tight text-[#1a1a1a] line-clamp-2 min-h-[2.5rem]">{card.clientName}</h4>
                          <div className="space-y-2">
                             <div className="flex items-center gap-2 px-2 py-1 bg-emerald-50 text-emerald-600 rounded-full w-fit">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-bold uppercase tracking-wide">Postado</span>
                             </div>
                             <div className="flex items-center gap-2 text-[#999]">
                                <Clock className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-bold uppercase tracking-tight">
                                   {card.archivedAt ? format(parseISO(card.archivedAt), "dd/MM/yyyy 'às' HH:mm") : '-'}
                                </span>
                             </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* PDF Footer - Fixed at bottom of pages */}
        <div className="bg-[#0a0a0a] text-white p-8 mt-auto flex items-center justify-between">
           <div className="flex items-center gap-4">
              <span className="text-2xl font-black italic tracking-tighter uppercase">Mac<span className="text-[#ff1a1a]">•</span></span>
              <div className="w-px h-6 bg-white/10 mx-2" />
              <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Mídia Strategic Intelligence</p>
           </div>
           <div className="flex gap-4 opacity-30">
              <div className="w-4 h-4 border border-white rounded-full flex items-center justify-center text-[8px] font-bold">in</div>
              <div className="w-4 h-4 border border-white rounded-full flex items-center justify-center text-[8px] font-bold">ig</div>
           </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          body {
            background-color: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

const ReportCard = ({ card }: { card: KanbanCard }) => {
  return (
    <div className="glass-card p-4 border-white/5 bg-white/[0.02] hover:bg-white/[0.04] rounded-xl flex gap-4 group transition-all duration-300 cursor-pointer border-l-4 border-l-transparent hover:border-l-primary/50">
      <div className="w-20 h-20 rounded-lg overflow-hidden bg-black/40 border border-white/5 flex-shrink-0 relative group-hover:scale-105 transition-transform duration-500">
        {card.coverImage ? (
          <img src={card.coverImage} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[8px] font-black text-white/10 uppercase text-center p-2">Sem Prévia</div>
        )}
      </div>
      
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
        <h3 className="text-sm font-black text-white/90 truncate uppercase tracking-tight">{card.clientName}</h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[10px] text-white/30 font-bold uppercase tracking-wider">
            <Clock className="w-3 h-3" />
            <span>{card.archivedAt ? format(parseISO(card.archivedAt), 'dd MMM yyyy', { locale: ptBR }) : '-'}</span>
          </div>
          {card.calendarClientName && (
            <div className="text-[9px] font-black text-primary/60 uppercase tracking-widest bg-primary/5 px-1.5 py-0.5 rounded">
              {card.calendarClientName}
            </div>
          )}
        </div>
      </div>
      
      <div className="flex items-center pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <ArrowRight className="w-4 h-4 text-white/20" />
      </div>
    </div>
  );
};

export default ReportsHub;
