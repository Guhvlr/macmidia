import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/contexts/useApp';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar as CalendarIcon, 
  Users, 
  Plus, 
  Trash2, 
  Loader2, 
  Send, 
  Shield, 
  MessageSquare, 
  TrendingUp, 
  AlertCircle, 
  Clock, 
  FileText,
  Download,
  Eye,
  ChevronRight,
  MoreVertical,
  UserPlus,
  Briefcase,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  MousePointer2,
  Share2,
  TrendingUp as TrendingUpIcon,
  Wrench,
  FileEdit,
  Folder,
  ChevronDown,
  Activity,
  CheckCircle2,
  History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, 
  DialogDescription, DialogFooter 
} from '@/components/ui/dialog';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from '@/components/ui/input';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, LineChart, Line 
} from 'recharts';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay, subMonths, addMonths, isWithinInterval, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import defaultLogo from '@/assets/logo-mac-midia.png';
import { toast } from 'sonner';
import { useDraggableScroll } from '@/hooks/useDraggableScroll';

// Metric Card Component
interface MetricCardProps {
  icon: any;
  label: string;
  value: string | number;
  subtext: string;
  trend?: number;
  color: string;
  trendIcon?: any;
}

const MetricCard = ({ icon: Icon, label, value, subtext, trend, color, trendIcon, isGuest }: { isGuest?: boolean } & MetricCardProps) => (
  <div className={`${!isGuest ? 'glass-card-hover cursor-pointer' : 'glass-card'} p-4 flex items-center gap-4 animate-slide-up group`} style={{ borderLeft: `3px solid ${color.startsWith('var') ? `hsl(${color})` : color}` }}>
    <div className="p-2.5 rounded-2xl bg-white/[0.02] border border-white/[0.03] group-hover:bg-primary/10 transition-all glow-red-subtle group-hover:scale-110 duration-500">
      <Icon className="w-5 h-5" style={{ color: color.startsWith('var') ? `hsl(${color})` : color }} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <span className="text-2xl font-black tracking-tighter leading-none">{value}</span>
        <span className="text-[10px] font-black text-white/50 truncate uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-[8px] text-white/20 uppercase tracking-[0.25em] font-bold truncate mt-1">{subtext}</p>
    </div>
    {trend !== undefined && trend !== 0 && (
      <div className={`flex items-center gap-1 text-[9px] font-black italic ${trend > 0 ? 'text-emerald-400' : 'text-primary'}`}>
        <TrendingUp className={`w-3.5 h-3.5 ${trend < 0 ? 'rotate-180' : ''}`} />
        {Math.abs(trend)}%
      </div>
    )}
  </div>
);

const Index = () => {
  const { 
    employees = [], 
    kanbanCards = [], 
    calendarTasks = [], 
    calendarClients = [],
    loading, 
    addEmployee, 
    dashboardLogo,
    loggedUserRole,
    loggedUserClientLink
  } = useApp();
  
  const { ref: scrollRef, onMouseDown } = useDraggableScroll();
  const navigate = useNavigate();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | 'all'>(() => {
    if (loggedUserRole === 'GUEST' && loggedUserClientLink) {
      return loggedUserClientLink.split(',')[0];
    }
    return 'all';
  });
  const [viewDate, setViewDate] = useState(new Date());
  
  const logoSrc = dashboardLogo || defaultLogo;

  const selectedClient = useMemo(() => 
    (calendarClients || []).find(c => c.id === selectedClientId),
    [calendarClients, selectedClientId]
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
    if (selectedClientId === 'all') return list;
    return list.filter(t => t.calendarClientId === selectedClientId);
  }, [calendarTasks, selectedClientId]);

  const metrics = useMemo(() => {
    const safeTasks = Array.isArray(filteredTasks) ? filteredTasks : [];
    const safeKanban = Array.isArray(kanbanCards) ? kanbanCards : [];

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

    return { currMonthTasks: cTasks, lastMonthTasks: lTasks, inProductionCount: prod, changesCount: chan };
  }, [filteredTasks, dates, kanbanCards]);

  const productionGrowth = useMemo(() => {
    const curr = metrics.currMonthTasks.length;
    const last = metrics.lastMonthTasks.length;
    if (last === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - last) / last) * 100);
  }, [metrics.currMonthTasks.length, metrics.lastMonthTasks.length]);

  const chartData = useMemo(() => {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return days.map((day, i) => {
      const base = Math.floor(metrics.currMonthTasks.length / 5) || 5;
      return {
        name: day,
        pos: base + (i % 4),
        prod: Math.floor(base * 0.7) + 2,
        pend: Math.floor(base * 0.2)
      };
    });
  }, [metrics.currMonthTasks.length]);

  const monthInterval = useMemo(() => {
    return eachDayOfInterval({ start: dates.currStart, end: dates.currEnd });
  }, [dates.currStart, dates.currEnd]);

  const handlePrevMonth = () => setViewDate(prev => subMonths(prev, 1));
  const handleNextMonth = () => setViewDate(prev => addMonths(prev, 1));

  const handleExport = (type: string) => {
    if (type === 'PDF' || type === 'Relatórios') {
      if (loggedUserRole !== 'ADMIN') {
        toast.error('Acesso Negado', { description: 'Apenas administradores podem gerar relatórios executivos.' });
        return;
      }
      navigate(`/relatorio?clientId=${selectedClientId}&month=${viewDate.toISOString()}`);
      return;
    }
    toast.info(`Exportando ${type} para o cliente ${selectedClient?.name || 'Geral'}...`, { 
      description: `Processando dados de ${format(viewDate, 'MMMM yyyy', { locale: ptBR })}`
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020202] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 min-h-0 bg-[#020202] p-6 lg:p-7 space-y-5 overflow-y-auto custom-scrollbar dashboard-main-container" style={{ transform: 'scale(1)', transformOrigin: 'top center' }}>
        {/* Top Header */}
        <div className="flex items-center justify-between animate-fade-in h-12 px-2">
          <div className="flex items-center gap-6">
            <img src={logoSrc} alt="Logo" className="h-14 w-auto object-contain transition-all hover:scale-110 drop-shadow-[0_0_25px_hsl(var(--primary)/0.35)]" />
            <h1 className="text-2xl font-black tracking-tighter flex items-center text-white italic">
              MAC V2 FINAL <span className="text-white/10 font-thin mx-3 not-italic">/</span> <span className="opacity-30 text-base font-bold tracking-normal not-italic">Gestão Operacional</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {(loggedUserRole !== 'GUEST' || (loggedUserRole === 'GUEST' && loggedUserClientLink && loggedUserClientLink.split(',').length > 1)) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="glass-card px-4 py-2 flex items-center gap-3 hover:bg-white/5 transition-all outline-none border-white/[0.03] shadow-2xl">
                    <Users className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[9px] font-black uppercase tracking-[0.2em]">{selectedClient?.name || 'Todos Clientes'}</span>
                    <ChevronDown className="w-3 h-3 text-white/20" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="glass-card border-white/10 bg-[#0a0a0a]/98 w-64 backdrop-blur-3xl p-1.5 shadow-[0_30px_60px_rgba(0,0,0,1)]">
                  <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-white/30 px-3 py-2">Filtro de Unidade</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/5 mx-1" />
                  
                  {loggedUserRole !== 'GUEST' && (
                    <DropdownMenuItem onClick={() => setSelectedClientId('all')} className="text-xs font-bold py-3 px-3 cursor-pointer rounded-xl hover:bg-white/5 transition-colors">
                      Visão Global
                    </DropdownMenuItem>
                  )}
                  
                  {Array.isArray(calendarClients) && calendarClients
                    .filter(client => {
                      if (loggedUserRole !== 'GUEST') return true;
                      return (loggedUserClientLink || '').split(',').includes(client.id);
                    })
                    .map(client => (
                      <DropdownMenuItem key={client.id} onClick={() => setSelectedClientId(client.id)} className="text-xs font-bold py-3 px-3 cursor-pointer flex items-center gap-4 rounded-xl hover:bg-white/5 transition-colors">
                        <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center overflow-hidden border border-white/10">
                          {client.logoUrl ? <img src={client.logoUrl} className="w-full h-full object-cover" /> : <span className="text-[10px] opacity-40">{client.name[0]}</span>}
                        </div>
                        <span className="truncate">{client.name}</span>
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {loggedUserRole === 'GUEST' && selectedClient && (!loggedUserClientLink || loggedUserClientLink.split(',').length <= 1) && (
              <div className="glass-card px-4 py-2 flex items-center gap-3 border-white/[0.03] shadow-2xl opacity-60">
                <Users className="w-3.5 h-3.5 text-primary" />
                <span className="text-[9px] font-black uppercase tracking-[0.2em]">{selectedClient.name}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <div className="glass-card px-4 py-2 flex items-center gap-3 border-white/[0.03] shadow-2xl">
                <CalendarIcon className="w-4 h-4 text-primary" />
                <span className="text-[9px] font-black uppercase tracking-[0.2em]">{format(viewDate, "MMMM yyyy", { locale: ptBR })}</span>
              </div>
              {loggedUserRole !== 'GUEST' && (
                <div className="flex gap-1">
                  <button 
                    onClick={handlePrevMonth}
                    className="h-9 w-9 flex items-center justify-center glass-card hover:bg-white/10 hover:text-white transition-all text-white/30"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={handleNextMonth}
                    className="h-9 w-9 flex items-center justify-center glass-card hover:bg-white/10 hover:text-white transition-all text-white/30"
                  >
                    <ChevronRightIcon className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard 
            icon={Send} 
            label="Volume Mensal" 
            value={metrics.currMonthTasks.length} 
            subtext={`Produção em ${format(viewDate, 'MMMM', { locale: ptBR })}`} 
            color="var(--primary)"
            isGuest={loggedUserRole === 'GUEST'}
          />
          <MetricCard 
            icon={Clock} 
            label="Em produção" 
            value={metrics.inProductionCount} 
            subtext="Processamento ativo" 
            color="var(--warning)"
            isGuest={loggedUserRole === 'GUEST'}
          />
          <MetricCard 
            icon={Activity} 
            label="Alterações" 
            value={metrics.changesCount} 
            subtext="Refações solicitadas" 
            color="var(--destructive)"
            isGuest={loggedUserRole === 'GUEST'}
          />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 space-y-5">
            {/* Mini Calendar Widget */}
            <div className="glass-card p-6 border-white/5 shadow-2xl h-full">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-black flex items-center gap-4 tracking-tighter uppercase italic">
                  <CalendarIcon className="w-6 h-6 text-primary glow-red-subtle" /> 
                  {format(viewDate, "MMMM yyyy", { locale: ptBR })} 
                  <span className="text-white/10 mx-2 font-thin not-italic">/</span>
                  <span className="text-primary/60 text-base font-bold tracking-normal italic lowercase">{selectedClient?.name || 'geral'}</span>
                </h2>
                <div className="flex items-center gap-2">
                  {loggedUserRole !== 'GUEST' && (
                    <>
                      <button 
                        onClick={handlePrevMonth}
                        className="h-10 w-10 flex items-center justify-center hover:bg-white/5 rounded-2xl border border-white/5 transition-all text-white/30 hover:text-white"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={handleNextMonth}
                        className="h-10 w-10 flex items-center justify-center hover:bg-white/5 rounded-2xl border border-white/5 transition-all text-white/30 hover:text-white"
                      >
                        <ChevronRightIcon className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map(d => (
                  <div key={d} className="text-center text-[10px] font-black text-white/10 p-3 italic uppercase tracking-widest">{d}</div>
                ))}
                {monthInterval.map(day => {
                  const dayTasks = filteredTasks.filter(t => {
                    try {
                      return isSameDay(parseISO(t.date), day);
                    } catch { return false; }
                  });
                  return (
                    <div key={day.toString()} className={`aspect-square sm:aspect-auto sm:min-h-20 border border-white/[0.02] rounded-3xl p-3.5 relative group transition-all hover:bg-white/5 ${isToday(day) ? 'bg-primary/5 border-primary/40 ring-1 ring-primary/20 shadow-[0_0_30px_hsl(var(--primary)/0.25)]' : ''} ${!isSameMonth(day, viewDate) ? 'opacity-20' : ''}`}>
                      <span className={`text-[13px] font-black ${isToday(day) ? 'text-primary' : 'text-white/20'}`}>{format(day, 'd')}</span>
                      <div className="mt-2 space-y-1.5 overflow-hidden">
                        {dayTasks.slice(0, 2).map((t, i) => (
                          <div 
                            key={i} 
                            onClick={(e) => {
                              if (loggedUserRole === 'GUEST') {
                                e.preventDefault();
                                e.stopPropagation();
                                navigate(`/calendario/${t.calendarClientId}`);
                              }
                            }}
                            className="text-[8.5px] font-black bg-white/[0.04] text-primary/80 px-2.5 py-1.5 rounded-xl border-l-2 border-primary truncate shadow-sm transition-all group-hover:translate-x-1 group-hover:bg-primary/10 group-hover:text-white"
                          >
                            {t.clientName}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column (4/12) */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            {[
              { icon: CalendarIcon, label: 'Calendário', sub: `${metrics.currMonthTasks.length} artes geradas`, path: selectedClientId !== 'all' ? `/calendario/${selectedClientId}` : '/calendario' },
              { icon: FileEdit, label: 'Alterações', sub: `${metrics.changesCount} tarefas`, path: '/correcao', urgent: metrics.changesCount > 0, hideForGuest: true },
              { icon: Folder, label: 'Banco de Dados', sub: 'Hub Operacional', path: '/cofre', hideForGuest: true },
              { icon: MessageSquare, label: 'WhatsApp', sub: 'Mensagens diretas', path: '/whatsapp', hideForGuest: true },
              { icon: Briefcase, label: 'Produtos', sub: 'E-commerce Mac', path: '/produtos', hideForGuest: true },
              { icon: Send, label: 'Postagem', sub: 'Hub de Midia', path: '/postagem', hideForGuest: true },
            ].filter(item => loggedUserRole !== 'GUEST' || !item.hideForGuest).map(item => (
              <button key={item.label} onClick={() => navigate(item.path)} className="glass-card-hover p-5 flex items-center justify-between group border-white/5 shadow-2xl hover:translate-x-1 flex-1">
                <div className="flex items-center gap-5">
                  <div className={`p-3.5 rounded-[1.2rem] bg-white/[0.03] border border-white/10 group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-lg glow-red-subtle`}>
                    <item.icon className="w-5 h-5 shadow-sm" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-sm font-black text-white/90 tracking-tight">{item.label}</h3>
                    <p className={`text-[9.5px] uppercase font-black tracking-[0.2em] mt-1 ${item.urgent ? 'text-primary animate-pulse' : 'text-white/20'}`}>{item.sub}</p>
                  </div>
                </div>
                <ChevronRightIcon className="w-4 h-4 text-white/5 group-hover:text-primary transition-all translate-x-4 group-hover:translate-x-0 opacity-0 group-hover:opacity-100" />
              </button>
            ))}
          </div>
        </div>

        {/* Horizontal Team Section at the Bottom */}
        <div className="bg-[#0A0A0B] flex flex-col border border-white/5 rounded-[1.8rem] shadow-2xl animate-fade-in group/team-section overflow-hidden mt-2">
          <div className="p-5 border-b border-white/[0.03] flex items-center justify-between bg-white/[0.01]">
            <h2 className="text-[11px] font-black tracking-[0.25em] text-white/30 uppercase flex items-center gap-3 italic">
              <Users className="w-4.5 h-4.5 text-primary" /> Equipe Mac Mídia
            </h2>
            {loggedUserRole === 'ADMIN' && (
              <button onClick={() => setShowAdd(true)} className="h-9 w-9 flex items-center justify-center hover:bg-white/5 rounded-xl transition-all border border-white/10 text-white/40 shadow-lg hover:text-white hover:border-primary/40"><UserPlus className="w-4 h-4" /></button>
            )}
          </div>
          <div 
            ref={scrollRef as any}
            onMouseDown={onMouseDown}
            className="p-6 pb-2 overflow-x-auto trello-scrollbar w-full cursor-grab active:cursor-grabbing select-none"
          >
            <div className="flex flex-nowrap items-center gap-8 min-w-max pb-4 px-1">
              {employees.slice(0, 15).map((emp, idx) => (
                <div 
                  key={emp.id} 
                  onClick={() => {
                    if (loggedUserRole !== 'GUEST') {
                      navigate(`/funcionario/${emp.id}`);
                    }
                  }} 
                  className={`flex flex-col items-center gap-3 transition-all ${loggedUserRole !== 'GUEST' ? 'hover:scale-110 cursor-pointer group/emp' : 'bg-transparent cursor-default'}`}
                >
                  <div className="relative">
                    <div className="w-14 h-14 rounded-2xl bg-white/5 overflow-hidden border border-white/10 group-hover/emp:border-primary/60 transition-all">
                      {emp.photoUrl ? (
                        <img src={emp.photoUrl} className="w-full h-full object-cover grayscale-[0.3] group-hover/emp:grayscale-0 transition-all duration-500" />
                      ) : (
                        <span className="text-2xl flex items-center justify-center h-full opacity-40">{emp.avatar}</span>
                      )}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-[3px] border-[#0A0A0B] bg-emerald-500" />
                  </div>
                  <div className="text-center">
                    <h4 className="text-[10px] font-black text-white px-1 truncate max-w-[85px] group-hover/emp:text-primary transition-colors uppercase tracking-tight">{emp.name.split(' ')[0]}</h4>
                    <p className="text-[8px] text-white/50 uppercase font-black tracking-widest leading-none mt-1">{emp.role.split(' ')[0]}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recruitment Dialog — Moved outside scaled container to avoid fixed-position bugs */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="glass-card border-white/10 bg-[#050505] p-10 max-w-sm shadow-[0_40px_100px_rgba(0,0,0,1)] z-[9999] fixed left-1/2 top-1/2 !translate-x-[-50%] !translate-y-[-50%]">
          <DialogHeader className="mb-8"><DialogTitle className="text-3xl font-black uppercase tracking-tighter text-white italic">RECRUTAMENTO</DialogTitle></DialogHeader>
          <div className="space-y-6">
            <div className="space-y-2.5 text-left">
              <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 ml-1">Identificação</label>
              <Input placeholder="Nome Completo" value={newName} onChange={e => setNewName(e.target.value)} className="bg-white/5 border-white/10 h-16 rounded-[1.4rem] focus:ring-primary/40 focus:border-primary/40 text-lg font-bold" />
            </div>
            <div className="space-y-2.5 text-left">
              <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 ml-1">Operacional</label>
              <Input placeholder="Especialidade Principal" value={newRole} onChange={e => setNewRole(e.target.value)} className="bg-white/5 border-white/10 h-16 rounded-[1.4rem] focus:ring-primary/40 focus:border-primary/40 text-lg font-bold" />
            </div>
          </div>
          <DialogFooter className="mt-10 flex gap-4">
            <Button variant="ghost" onClick={() => setShowAdd(false)} className="h-16 rounded-[1.4rem] font-black uppercase text-[11px] tracking-widest flex-1 hover:bg-white/5 text-white/30 hover:text-white transition-all">Abortar</Button>
            <Button 
               className="btn-primary-glow h-16 rounded-[1.4rem] font-black uppercase text-[11px] tracking-widest flex-1 shadow-2xl bg-primary text-white" 
               onClick={() => { addEmployee({ name: newName, role: newRole, avatar: '👤' }); setShowAdd(false); setNewName(''); setNewRole(''); toast.success('Membro adicionado!'); }}
            >
              Ativar Elo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Index;
