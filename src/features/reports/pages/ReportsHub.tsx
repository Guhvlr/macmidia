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
  Image as ImageIcon,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { KanbanCard } from '@/contexts/app-types';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { ReportPDFTemplate } from '../components/ReportPDFTemplate';

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
        query = query.eq('calendar_client_id' as any, selectedClientId);
      }
      
      const start = startOfDay(parseISO(startDate)).toISOString();
      const end = endOfDay(parseISO(endDate)).toISOString();
      
      query = query.gte('archived_at', start).lte('archived_at', end);

      const { data, error } = await query;
      
      if (error) throw error;
      
      const mapped = (data || []).map(row => ({
        id: row.id,
        clientName: row.client_name,
        calendarClientId: (row as any).calendar_client_id,
        calendarClientName: (row as any).calendar_client_name,
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

  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isTemplateReady, setIsTemplateReady] = useState(false);

  const waitForImages = async (container: HTMLElement) => {
    const images = Array.from(container.querySelectorAll('img'));
    await Promise.all(
      images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
          setTimeout(resolve, 3000); 
        });
      })
    );
  };

  const handleGeneratePDF = async () => {
    if (selectedClientId === 'all') {
      toast.error('Selecione um cliente para gerar o relatório.');
      return;
    }
    
    setIsGeneratingPDF(true);
    const loadingToast = toast.loading('Iniciando geração do PDF...');
    
    try {
      // Forçar re-render e medição
      setIsTemplateReady(false);
      await new Promise(r => setTimeout(r, 100));
      setIsTemplateReady(true);
      
      // Aguardar medição do DOM no template (ReportPDFTemplate tem timeout de 300ms)
      await new Promise(r => setTimeout(r, 800));
      
      const pages = document.querySelectorAll('[id^="report-page-"]');
      if (pages.length === 0) throw new Error('Páginas do template não encontradas. Aguarde a medição completar.');
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });
      
      for (let i = 0; i < pages.length; i++) {
        const pageElement = pages[i] as HTMLElement;
        
        // Garantir que imagens da página carregaram
        toast.loading(`Carregando imagens da página ${i + 1}...`, { id: loadingToast });
        await waitForImages(pageElement);
        
        toast.loading(`Capturando página ${i + 1} de ${pages.length}...`, { id: loadingToast });
        
        const canvas = await html2canvas(pageElement, {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#0a0a0a',
          logging: false,
          width: 794,
          height: 1123,
        });
        
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const imgWidth = 210; // A4 width mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight, undefined, 'FAST');
      }
      
      const filename = `relatorio_${clientName.replace(/\s+/g, '_').toLowerCase()}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      pdf.save(filename);
      
      toast.dismiss(loadingToast);
      toast.success(`Relatório gerado com sucesso! (${pages.length} páginas)`);
    } catch (err: any) {
      toast.dismiss(loadingToast);
      toast.error('Erro ao gerar PDF: ' + (err.message || 'desconhecido'));
      console.error(err);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const clientName = useMemo(() => {
    if (selectedClientId === 'all') return 'Todos os Clientes';
    return calendarClients.find(c => c.id === selectedClientId)?.name || 'Cliente Desconhecido';
  }, [selectedClientId, calendarClients]);

  const selectedClient = useMemo(() => {
    return calendarClients.find(c => c.id === selectedClientId);
  }, [selectedClientId, calendarClients]);

  const logoSrc = selectedClient?.logoUrl;

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
            onClick={handleGeneratePDF}
            disabled={selectedClientId === 'all' || isGeneratingPDF}
            className="btn-primary-glow bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-[10px] h-12 px-8 rounded-xl shadow-2xl min-w-[200px]"
          >
            {isGeneratingPDF ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando PDF...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" /> Gerar Relatório PDF
              </>
            )}
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


      {/* Hidden PDF Template */}
      {isTemplateReady && (
        <ReportPDFTemplate 
          clientName={clientName}
          startDate={startDate}
          endDate={endDate}
          cards={filteredCards}
          clientLogoSrc={selectedClient?.logoUrl || (selectedClient as any)?.avatarUrl}
        />
      )}
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
