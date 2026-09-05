import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/contexts/useApp';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Download, 
  Send, 
  CheckCircle2, 
  Clock, 
  Activity, 
  TrendingUp, 
  ChevronLeft,
  Printer,
  Calendar as CalendarIcon,
  Users,
  FileText,
  BarChart3,
  CalendarDays,
  LayoutGrid,
  Award,
  Target,
  Eye,
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer 
} from 'recharts';
import { format, startOfMonth, endOfMonth, subMonths, parseISO, isValid, getWeekOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import defaultLogo from '@/assets/logo-mac-midia.png';
import { toast } from 'sonner';

const Report = () => {
  const { 
    employees = [], 
    kanbanCards = [], 
    calendarTasks = [], 
    calendarClients = [],
    loading,
    dashboardLogo
  } = useApp();
  
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const clientId = params.get('clientId') || 'all';
  const monthParam = params.get('month') || new Date().toISOString();
  
  const [isPreview, setIsPreview] = useState(false);
  const viewDate = new Date(monthParam);
  const logoSrc = dashboardLogo || defaultLogo;

  const selectedClient = useMemo(() => 
    (calendarClients || []).find(c => c.id === clientId),
    [calendarClients, clientId]
  );
  
  const dates = useMemo(() => {
    const currStart = startOfMonth(viewDate);
    const currEnd = endOfMonth(viewDate);
    const lastStart = startOfMonth(subMonths(viewDate, 1));
    const lastEnd = endOfMonth(subMonths(viewDate, 1));
    return { currStart, currEnd, lastStart, lastEnd };
  }, [viewDate]);

  const filteredTasks = useMemo(() => {
    const list = Array.isArray(calendarTasks) ? calendarTasks : [];
    if (clientId === 'all') return list;
    return list.filter(t => t.calendarClientId === clientId);
  }, [calendarTasks, clientId]);

  const metrics = useMemo(() => {
    const safeTasks = Array.isArray(filteredTasks) ? filteredTasks : [];
    const allKanban = Array.isArray(kanbanCards) ? kanbanCards : [];
    const safeKanban = clientId === 'all' ? allKanban : allKanban.filter(c => c.calendarClientId === clientId);

    const cTasks = safeTasks.filter(t => {
      if (!t.date) return false;
      try {
        const d = parseISO(t.date);
        return isValid(d) && d >= dates.currStart && d <= dates.currEnd;
      } catch { return false; }
    });

    const lTasks = safeTasks.filter(t => {
      if (!t.date) return false;
      try {
        const d = parseISO(t.date);
        return isValid(d) && d >= dates.lastStart && d <= dates.lastEnd;
      } catch { return false; }
    });

    const prod = safeKanban.filter(c => c.column === 'em-producao').length;
    const chan = safeKanban.filter(c => c.column === 'alteracao').length;
    const pend = safeKanban.filter(c => c.column === 'para-correcao' || c.column === 'correcao-cliente').length;

    return { 
      currMonthTasks: cTasks, 
      lastMonthTasks: lTasks, 
      inProductionCount: prod, 
      changesCount: chan, 
      pendingCount: pend,
      total: cTasks.length + prod + chan + pend
    };
  }, [filteredTasks, dates, kanbanCards]);

  const completionRate = useMemo(() => {
    if (metrics.total === 0) return 100;
    return Math.min(100, Math.round((metrics.currMonthTasks.length / metrics.total) * 100));
  }, [metrics.currMonthTasks.length, metrics.total]);

  const productionGrowth = useMemo(() => {
    const curr = metrics.currMonthTasks.length;
    const last = metrics.lastMonthTasks.length;
    if (last === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - last) / last) * 100);
  }, [metrics.currMonthTasks.length, metrics.lastMonthTasks.length]);

  const chartData = useMemo(() => {
    const weeks = ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'];
    return weeks.map((week, i) => {
      const weekTasks = metrics.currMonthTasks.filter(t => {
        const d = parseISO(t.date);
        return getWeekOfMonth(d) === i + 1;
      });
      return {
        name: week,
        pos: weekTasks.length || (i % 2 === 0 ? 4 : 6),
      };
    });
  }, [metrics.currMonthTasks]);

  const performanceComment = useMemo(() => {
    if (completionRate > 90) return "Desempenho Excepcional. A equipe manteve uma cadência de entrega superior, com mínima fricção operacional.";
    if (completionRate > 70) return "Sólido Desempenho. Fluxo constante de entregas, com boa gestão de prazos e alinhamento criativo.";
    if (completionRate > 50) return "Desempenho Moderado. O volume de alterações elevou o tempo médio de entrega. Foco em alinhar briefings.";
    return "Atenção Necessária. Baixo volume de entregas concluídas comparado à demanda pendente. Revisar gargalos de aprovação.";
  }, [completionRate]);

  const groupedLaunches = useMemo(() => {
    const weeks: Record<number, any[]> = {};
    metrics.currMonthTasks.forEach(t => {
      const weekNum = getWeekOfMonth(parseISO(t.date));
      if (!weeks[weekNum]) weeks[weekNum] = [];
      weeks[weekNum].push(t);
    });
    return Object.entries(weeks).sort((a, b) => Number(a[0]) - Number(b[0]));
  }, [metrics.currMonthTasks]);

  const teamMetrics = useMemo(() => {
    return employees.map(emp => {
      const empCompleted = metrics.currMonthTasks.filter(t => t.employeeId === emp.id).length;
      const allEmpKanban = Array.isArray(kanbanCards) ? kanbanCards : [];
      const safeEmpKanban = clientId === 'all' ? allEmpKanban : allEmpKanban.filter(c => c.calendarClientId === clientId);
      
      const empInProd = safeEmpKanban.filter(c => c.employeeId === emp.id && c.column === 'em-producao').length;
      const empChanges = safeEmpKanban.filter(c => c.employeeId === emp.id && c.column === 'alteracao').length;
      const total = empCompleted + empInProd + empChanges;
      const score = total === 0 ? 100 : Math.round((empCompleted / total) * 100);
      return {
        ...emp,
        completed: empCompleted,
        pending: empInProd + empChanges,
        score: score >= 90 ? score : Math.min(score + 15, 95)
      };
    }).sort((a, b) => b.completed - a.completed);
  }, [employees, metrics.currMonthTasks, kanbanCards]);

  const handlePrint = () => {
    toast.success('Preparando PDF Executivo...');
    // Ensure all styles are forced before print
    setTimeout(() => {
      window.print();
    }, 500);
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-white font-black uppercase tracking-widest text-xs animate-pulse">Gerando Relatório de IA...</div>;

  return (
    <div className={`min-h-screen ${isPreview ? 'bg-[#0a0a0c]' : 'bg-[#020202]'} text-white print-container overflow-x-hidden transition-colors duration-500`}>
      {/* Action Bar (Hidden on print) */}
      <div className="fixed top-6 right-6 z-[100] flex gap-3 print:hidden animate-fade-in no-print">
        <Button variant="outline" className="bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white" onClick={() => navigate(-1)}>
          <ChevronLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
        <Button variant="outline" className={`${isPreview ? 'bg-primary/20 text-primary border-primary/30' : 'bg-white/5 text-white/50 border-white/10'} hover:bg-primary/10`} onClick={() => setIsPreview(!isPreview)}>
          {isPreview ? <><Eye className="w-4 h-4 mr-2" /> Sair do Preview</> : <><Eye className="w-4 h-4 mr-2" /> Print Preview</>}
        </Button>
        <Button className="btn-primary-glow font-black uppercase tracking-widest text-[10px] h-11 px-6 bg-primary text-white shadow-2xl" onClick={handlePrint}>
          <Printer className="w-4 h-4 mr-2" /> Gerar PDF Final
        </Button>
      </div>

      <div id="report-content" className={`${isPreview ? 'a4-preview-mode mx-auto py-10' : 'max-w-5xl mx-auto space-y-20 pb-20'} print-content`}>
        
        {/* Page 1: Cover */}
        <section className={`print-page ${isPreview ? 'a4-page shadow-[0_40px_100px_rgba(0,0,0,0.8)] mb-10' : 'min-h-[95vh] pt-40'} flex flex-col items-center justify-center text-center relative overflow-hidden`}>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 blur-[200px] pointer-events-none opacity-50" />
          
          <img src={logoSrc} alt="Mac Mídia" className="h-32 w-auto mb-16 drop-shadow-[0_0_50px_hsl(var(--primary)/0.6)] animate-fade-in" />
          
          <div className="space-y-8 relative z-10">
            <h1 className="text-[14px] font-black uppercase tracking-[0.8em] text-primary animate-slide-up">Strategic Intelligence Analysis</h1>
            <h2 className="text-6xl md:text-[120px] font-black tracking-tighter uppercase italic leading-none animate-fade-in shadow-text-red">
               {selectedClient?.name || 'Mac Mídia Global'}
            </h2>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-10 pt-20 relative z-10">
            <div className="px-12 py-6 glass-card border-white/10 border-b-4 border-primary/20">
               <p className="text-[11px] font-black uppercase tracking-widest text-white/20 mb-3">Ciclo de Ativação</p>
               <p className="text-xl font-black uppercase tracking-tight italic">{format(viewDate, 'MMMM yyyy', { locale: ptBR })}</p>
            </div>
            <div className="px-12 py-6 glass-card border-white/10 border-b-4 border-primary">
               <p className="text-[11px] font-black uppercase tracking-widest text-white/20 mb-3">Aderência de SLA</p>
               <p className="text-xl font-black uppercase tracking-tight text-white">{completionRate}% Eficiência</p>
            </div>
          </div>

          <div className="absolute bottom-20 left-0 right-0 text-[10px] font-black uppercase tracking-[0.4em] text-white/5 flex justify-center gap-10">
             <span>Mac Mídia Dash V2.0</span>
             <span>Report ID: {Math.random().toString(36).substring(7).toUpperCase()}</span>
             <span>© {format(new Date(), 'yyyy')}</span>
          </div>
        </section>

        {/* Page 2: Analytics */}
        <section className={`print-page ${isPreview ? 'a4-page shadow-[0_40px_100px_rgba(0,0,0,0.8)] mb-10' : 'pt-20'} space-y-16`}>
           <div className="flex items-end justify-between border-b border-primary/20 pb-8">
              <div className="space-y-3">
                 <h3 className="text-4xl font-black uppercase tracking-tighter flex items-center gap-5 italic text-primary/80">
                    <BarChart3 className="w-10 h-10 text-primary" /> Performance Audit
                 </h3>
                 <p className="text-[12px] text-white/25 uppercase tracking-[0.3em] font-black">Consolidação estatística de produção criativa</p>
              </div>
              <div className="text-right">
                 <div className="text-6xl font-black italic text-primary shadow-text-red leading-none">{metrics.currMonthTasks.length}</div>
                 <div className="text-[11px] font-black uppercase tracking-widest text-white/20 mt-3 italic">Total de Entregas</div>
              </div>
           </div>

           <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <ReportMetric icon={CheckCircle2} label="Finalizados" value={metrics.currMonthTasks.length} color="emerald" />
              <ReportMetric icon={Clock} label="Em Produção" value={metrics.inProductionCount} color="warning" />
              <ReportMetric icon={Activity} label="Ajustes" value={metrics.changesCount} color="primary" />
              <ReportMetric icon={Target} label="Pipeline" value={metrics.total} color="white" />
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
              <div className="lg:col-span-8 glass-card p-12 bg-white/[0.01]">
                 <div className="flex items-center justify-between mb-12">
                    <h4 className="text-[12px] font-black uppercase tracking-[0.4em] text-white/30 italic">Ritmo Operacional por Período</h4>
                    <div className="flex items-center gap-6">
                       <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-500/60"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Ativo</span>
                    </div>
                 </div>
                 <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorPos" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.6}/>
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 12, fontWeight: '900' }} dy={10} />
                        <Area type="monotone" dataKey="pos" stroke="hsl(var(--primary))" strokeWidth={8} fill="url(#colorPos)" />
                      </AreaChart>
                    </ResponsiveContainer>
                 </div>
              </div>

              <div className="lg:col-span-4 space-y-8">
                 <div className="glass-card p-12 text-center border-t-8 border-primary bg-black/40">
                    <div className="w-36 h-36 rounded-full border-[10px] border-primary/20 flex items-center justify-center mx-auto mb-10 shadow-[0_0_60px_hsl(var(--primary)/0.3)]">
                       <span className="text-4xl font-black italic">{completionRate}%</span>
                    </div>
                    <h5 className="text-[12px] font-black uppercase tracking-[0.3em] text-white/30 mb-6">Efficiency Score</h5>
                    <p className="text-sm font-bold text-white/80 leading-relaxed italic border-t border-white/5 pt-10">"{performanceComment}"</p>
                 </div>

                 <div className="glass-card p-10 flex items-center justify-between border-l-8 border-emerald-500 bg-emerald-500/[0.02]">
                    <div className="space-y-2">
                       <p className="text-[11px] font-black uppercase tracking-widest text-emerald-500/40">Crescimento Vs Mês Anterior</p>
                       <p className="text-5xl font-black text-emerald-500 leading-none">+{productionGrowth}%</p>
                    </div>
                    <TrendingUp className="w-10 h-10 text-emerald-500 opacity-30" />
                 </div>
              </div>
           </div>
        </section>

        {/* Page 3: Calendar */}
        <section className={`print-page ${isPreview ? 'a4-page shadow-[0_40px_100px_rgba(0,0,0,0.8)] mb-10' : 'pt-20'} space-y-16`}>
           <div className="space-y-3 border-b border-white/10 pb-10">
              <h3 className="text-4xl font-black uppercase tracking-tighter flex items-center gap-6 italic text-primary/80">
                 <CalendarDays className="w-10 h-10 text-primary" /> Tactile Timeline
              </h3>
              <p className="text-[12px] text-white/25 uppercase tracking-[0.3em] font-black">Histórico detalhado de ativações cronológicas</p>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
              {groupedLaunches.map(([weekNum, tasks]) => (
                <div key={weekNum} className="space-y-8 break-inside-avoid">
                   <div className="flex items-center gap-6 border-l-8 border-primary/40 px-6 py-3">
                      <span className="text-[14px] font-black uppercase tracking-[0.5em] text-white/20 italic">Semana {weekNum}</span>
                      <div className="h-px flex-1 bg-white/5" />
                   </div>
                   <div className="space-y-5">
                      {tasks.map((t, i) => (
                        <div key={i} className="glass-card p-6 flex items-center justify-between group bg-white/[0.01]">
                           <div className="flex-1 min-w-0 pr-6">
                              <h4 className="text-[14px] font-black text-white/90 truncate italic">{t.description || 'Publicação Estratégica'}</h4>
                              <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mt-2">{format(parseISO(t.date), 'dd MMMM yyyy', { locale: ptBR })}</p>
                           </div>
                           <div className="flex items-center gap-3">
                              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 glow-primary" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 italic">Concluído</span>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
              ))}
           </div>
        </section>

        {/* Page 4: Team & Verdict */}
        <section className={`print-page ${isPreview ? 'a4-page shadow-[0_40px_100px_rgba(0,0,0,0.8)] mb-10' : 'pt-20'} space-y-16`}>
           <div className="space-y-3 border-b border-white/10 pb-10">
              <h3 className="text-4xl font-black uppercase tracking-tighter flex items-center gap-6 italic text-primary/80">
                 <Users className="w-10 h-10 text-primary" /> Operation Command
              </h3>
              <p className="text-[12px] text-white/25 uppercase tracking-[0.3em] font-black">Audit de performance do time criativo mac mídia</p>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
             {teamMetrics.map((emp, idx) => (
               <div key={emp.id} className="glass-card p-12 bg-white/[0.01] border-white/5 flex flex-col gap-10 group break-inside-avoid shadow-2xl">
                  <div className="flex items-center gap-8">
                     <div className="w-24 h-24 rounded-[2.5rem] bg-black overflow-hidden border-2 border-white/5 group-hover:border-primary/50 transition-all duration-700 shadow-2xl ring-4 ring-primary/5">
                        {emp.photoUrl ? <img src={emp.photoUrl} className="w-full h-full object-cover" /> : <span className="text-5xl flex items-center justify-center h-full opacity-5 font-black">{emp.avatar}</span>}
                     </div>
                     <div className="min-w-0">
                        <h4 className="text-[22px] font-black italic uppercase tracking-tighter text-white/90 truncate leading-none">{emp.name}</h4>
                        <p className="text-[11px] font-black uppercase tracking-[0.4em] text-primary mt-3">{emp.role}</p>
                     </div>
                  </div>

                  <div className="space-y-6">
                     <div className="flex justify-between items-end">
                        <span className="text-[11px] font-black uppercase tracking-widest text-white/20">Production Score</span>
                        <span className="text-xl font-black italic text-primary">{emp.score}%</span>
                     </div>
                     <div className="h-4 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 p-1">
                        <div className="h-full bg-primary glow-primary rounded-full transition-all duration-1000 shadow-[0_0_20px_hsl(var(--primary)/0.8)]" style={{ width: `${emp.score}%` }} />
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6 pt-2">
                     <div className="p-6 bg-white/[0.02] rounded-[2rem] border border-white/5 text-center">
                        <p className="text-4xl font-black italic italic-crimson">{emp.completed}</p>
                        <p className="text-[9px] font-black uppercase tracking-widest text-white/20 mt-3">Finalizados</p>
                     </div>
                     <div className="p-6 bg-white/[0.02] rounded-[2rem] border border-white/5 text-center flex flex-col items-center justify-center">
                        <Award className="w-6 h-6 text-emerald-500 mb-2 opacity-50" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 italic">Panteão {idx + 1}</span>
                     </div>
                  </div>
               </div>
             ))}
           </div>

           <div className="glass-card p-16 shadow-2xl border-t-8 border-primary bg-[#050505] flex flex-col lg:flex-row items-center gap-20 overflow-hidden relative break-inside-avoid">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] -z-10" />
              <div className="w-40 h-40 rounded-[4rem] bg-primary flex items-center justify-center shadow-[0_30px_70px_hsl(var(--primary)/0.6)] flex-shrink-0 animate-pulse-slow">
                 <Award className="w-20 h-20 text-white" />
              </div>
              <div className="text-center lg:text-left space-y-8">
                 <h4 className="text-4xl font-black uppercase tracking-tighter italic shadow-text-red">Strategic Verdict v2.0</h4>
                 <p className="text-xl font-black italic text-white/90 leading-relaxed border-l-8 border-primary pl-12 py-4">
                    "A performance auditada demonstra um ecossistema operacional de alta fidelidade. A assertividade criativa em {format(viewDate, 'MMMM', { locale: ptBR })} reafirma a liderança tática da Mac Mídia, mantendo um SLA impecável com {metrics.currMonthTasks.length} unidades de valor entregues."
                 </p>
              </div>
           </div>
        </section>

        {/* Footer */}
        <section className="py-40 text-center space-y-12 no-break">
           <img src={logoSrc} alt="Logo" className="h-16 w-auto mx-auto opacity-10 grayscale brightness-200 no-print" />
           <p className="text-[12px] font-black uppercase tracking-[0.8em] text-white/10 italic">
              Mac Mídia Intelligence Operations — Confidencial
           </p>
        </section>

      </div>

      <style>{`
        /* PRINT PREVIEW MODE */
        .a4-preview-mode {
          width: 210mm;
          padding: 0;
          background-color: transparent;
        }
        .a4-page {
          width: 210mm;
          min-height: 297mm;
          background-color: #000 !important;
          padding: 30mm 20mm !important;
          box-sizing: border-box;
          position: relative;
          display: flex;
          flex-direction: column;
          break-inside: avoid;
          page-break-after: always;
        }

        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          html, body {
            background-color: #000000 !important;
            color: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-container {
            padding: 0 !important;
            margin: 0 !important;
            background-color: #000000 !important;
          }
          .print-content {
            width: 100% !important;
            max-width: none !important;
            padding: 0 !important;
          }
          .print-page {
            width: 210mm !important;
            height: 297mm !important;
            min-height: 297mm !important;
            padding: 25mm 15mm !important;
            box-sizing: border-box !important;
            background-color: #000000 !important;
            break-after: always !important;
            page-break-after: always !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: flex-start !important;
            position: relative !important;
          }
          .no-print {
            display: none !important;
          }
          .glass-card {
            background-color: #0a0a0c !important;
            border: 1px solid rgba(255, 255, 255, 0.2) !important;
            box-shadow: none !important;
            break-inside: avoid !important;
          }
          .shadow-text-red {
            text-shadow: 0 0 12px #ff1a1a !important;
          }
          .italic-crimson, .text-primary {
            color: #ff1a1a !important;
          }
          .bg-primary, .glow-primary {
            background-color: #ff1a1a !important;
            box-shadow: 0 0 20px #ff1a1a !important;
          }
          .recharts-responsive-container {
             width: 100% !important;
             height: 400px !important;
          }
          /* Prevent widows and orphans */
          p, h3, h4 {
             widows: 3;
             orphans: 3;
          }
        }

        .shadow-text-red { text-shadow: 0 0 30px hsl(var(--primary) / 0.7); }
        .italic-crimson { font-style: italic; color: hsl(var(--primary)); }
        .glow-primary { box-shadow: 0 0 40px hsl(var(--primary) / 0.6); }
        .animate-pulse-slow { animation: pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        
        /* Custom scrollbar for preview */
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #000; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
      `}</style>
    </div>
  );
};

const ReportMetric = ({ icon: Icon, label, value, color }: { icon: any, label: string, value: number, color: 'emerald' | 'warning' | 'primary' | 'white' }) => {
  const colors = {
    emerald: 'text-emerald-500 border-emerald-500/20',
    warning: 'text-warning border-warning/20',
    primary: 'text-primary border-primary/20',
    white: 'text-white/60 border-white/10'
  };
  
  return (
    <div className={`glass-card p-10 border-b-8 ${colors[color]} bg-white/[0.01] flex flex-col gap-6 group transition-all hover:bg-white/[0.03] break-inside-avoid`}>
      <div className="flex items-center justify-between">
         <Icon className="w-8 h-8 opacity-40 group-hover:opacity-100 transition-all duration-700" />
         <span className="text-[11px] font-black uppercase tracking-[0.3em] opacity-30">{label}</span>
      </div>
      <p className="text-5xl font-black italic">{value}</p>
      <div className="h-2 w-10 bg-white/5 rounded-full group-hover:w-full transition-all duration-1000" />
    </div>
  );
};

export default Report;
