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

const MetricCard = ({ icon: Icon, label, value, subtext, trend, color, trendIcon }: MetricCardProps) => (
  <div className="glass-card-hover p-4 flex items-center gap-4 animate-slide-up group" style={{ borderLeft: `3px solid ${color.startsWith('var') ? `hsl(${color})` : color}` }}>
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
    loggedUserRole
  } = useApp();
  
  const navigate = useNavigate();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | 'all'>('all');
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
      <div className="min-h-screen bg-[#020202] p-6 lg:p-7 space-y-5 overflow-y-auto custom-scrollbar dashboard-main-container" style={{ transform: 'scale(0.96)', transformOrigin: 'top center' }}>
        {/* Top Header */}
        <div className="flex items-center justify-between animate-fade-in h-12 px-2">
          <div className="flex items-center gap-6">
            <img src={logoSrc} alt="Logo" className="h-14 w-auto object-contain transition-all hover:scale-110 drop-shadow-[0_0_25px_hsl(var(--primary)/0.35)]" />
            <h1 className="text-2xl font-black tracking-tighter flex items-center text-white italic">
              MAC MÍDIA <span className="text-white/10 font-thin mx-3 not-italic">/</span> <span className="opacity-30 text-base font-bold tracking-normal not-italic">Gestão Operacional</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
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
                <DropdownMenuItem onClick={() => setSelectedClientId('all')} className="text-xs font-bold py-3 px-3 cursor-pointer rounded-xl hover:bg-white/5 transition-colors">
                  Visão Global
                </DropdownMenuItem>
                {Array.isArray(calendarClients) && calendarClients.map(client => (
                  <DropdownMenuItem key={client.id} onClick={() => setSelectedClientId(client.id)} className="text-xs font-bold py-3 px-3 cursor-pointer flex items-center gap-4 rounded-xl hover:bg-white/5 transition-colors">
                    <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center overflow-hidden border border-white/10">
                      {client.logoUrl ? <img src={client.logoUrl} className="w-full h-full object-cover" /> : <span className="text-[10px] opacity-40">{client.name[0]}</span>}
                    </div>
                    <span className="truncate">{client.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex items-center gap-2">
              <button className="glass-card px-4 py-2 flex items-center gap-3 hover:bg-white/5 transition-all border-white/[0.03] shadow-2xl">
                <CalendarIcon className="w-4 h-4 text-primary" />
                <span className="text-[9px] font-black uppercase tracking-[0.2em]">{format(viewDate, "MMMM yyyy", { locale: ptBR })}</span>
              </button>
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
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard 
            icon={Send} 
            label="Volume Mensal" 
            value={metrics.currMonthTasks.length} 
            subtext={`Produção em ${format(viewDate, 'MMMM', { locale: ptBR })}`} 
            color="var(--primary)"
          />
          <MetricCard 
            icon={Clock} 
            label="Em produção" 
            value={metrics.inProductionCount} 
            subtext="Processamento ativo" 
            color="var(--warning)"
          />
          <MetricCard 
            icon={Activity} 
            label="Alterações" 
            value={metrics.changesCount} 
            subtext="Refações solicitadas" 
            color="var(--destructive)"
          />
          <MetricCard 
            icon={TrendingUpIcon} 
            label="Evolução" 
            value={`${productionGrowth > 0 ? '+' : ''}${productionGrowth}%`} 
            subtext="Crescimento produtivo" 
            trend={productionGrowth}
            color="var(--primary)"
          />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pb-4">
          <div className="lg:col-span-8 space-y-5">
            {/* Chart Widget */}
            <div className="glass-card p-7 flex flex-col gap-6 relative overflow-hidden group shadow-2xl">
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/[0.02] to-transparent pointer-events-none" />
              <div className="flex items-center justify-between relative z-10 px-1">
                <div>
                  <h2 className="text-xl font-black flex items-center gap-3 uppercase tracking-tighter italic">
                    <Activity className="w-5 h-5 text-primary glow-red-subtle" /> 
                    Resultados: <span className="text-white/40 not-italic font-bold">{selectedClient?.name || 'Unidade Global'}</span>
                  </h2>
                  <p className="text-[10px] text-white/20 uppercase tracking-[0.3em] font-black mt-1">Analytics de Performance - {format(viewDate, 'MMMM yyyy', { locale: ptBR })}</p>
                </div>
                <div className="flex items-center gap-2">
                   {loggedUserRole === 'ADMIN' && (
                     <button onClick={() => handleExport('Resultados')} className="text-[9px] font-black uppercase tracking-widest px-5 py-2.5 rounded-xl bg-primary text-white shadow-[0_10px_25px_hsl(var(--primary)/0.35)] glow-red-subtle transition-all hover:scale-105 active:scale-95">Relatórios</button>
                   )}
                   <button onClick={() => handleExport('Histórico')} className="text-[9px] font-black uppercase tracking-widest px-5 py-2.5 rounded-xl bg-white/[0.03] text-white/30 border border-white/[0.05] hover:text-white hover:bg-white/5 transition-all">Ver Histórico</button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-12 gap-10 items-center relative z-10 px-1">
                <div className="md:col-span-4 space-y-7">
                  {[
                    { icon: CheckCircle2, label: 'Entregues', value: metrics.currMonthTasks.length, trend: productionGrowth, color: 'text-primary' },
                    { icon: Clock, label: 'No Fluxo', value: metrics.inProductionCount, trend: 0, color: 'text-warning' },
                    { icon: History, label: 'Mês Passado', value: metrics.lastMonthTasks.length, trend: -productionGrowth, color: 'text-emerald-500' },
                  ].map(item => (
                    <div key={item.label} className="group/item cursor-pointer">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <item.icon className={`w-4 h-4 ${item.color} drop-shadow-[0_0_10px_hsl(var(--primary)/0.4)]`} />
                          <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">{item.label}</span>
                        </div>
                        {item.trend !== 0 && (
                          <span className={`text-[9px] font-black flex items-center gap-1 ${item.trend > 0 ? 'text-emerald-400' : 'text-primary'}`}>
                            <TrendingUp className={`w-3.5 h-3.5 ${item.trend < 0 ? 'rotate-180' : ''}`} /> {Math.abs(item.trend)}%
                          </span>
                        )}
                      </div>
                      <div className="text-3xl font-black border-b border-white/[0.03] pb-2.5 group-hover/item:border-primary/40 transition-all flex items-baseline gap-2">
                        {item.value} <span className="text-[10px] text-white/10 font-black uppercase tracking-[0.2em] leading-none">Artes</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="md:col-span-8 h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorPos" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.015)" vertical={false} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }} dy={12} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#050505', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', backdropFilter: 'blur(30px)', boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }} 
                        itemStyle={{ fontSize: '11px', fontWeight: '900', color: '#fff' }}
                        labelStyle={{ color: 'rgba(255,255,255,0.4)', fontWeight: 'black', marginBottom: '6px', fontSize: '10px' }}
                      />
                      <Area type="monotone" dataKey="pos" stroke="hsl(var(--primary))" strokeWidth={4} fill="url(#colorPos)" />
                      <Area type="monotone" dataKey="prod" stroke="#fbbf24" strokeWidth={2} strokeDasharray="6 6" fill="transparent" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-white/[0.03] relative z-10">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-3"><div className="w-2.5 h-2.5 rounded-full bg-primary glow-primary" /><span className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">Postagens</span></div>
                  <div className="flex items-center gap-3"><div className="w-2.5 h-2.5 rounded-full border border-warning/50 bg-white/5" /><span className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">Fluxo</span></div>
                </div>
                <div className="flex items-center gap-2.5">
                  {loggedUserRole === 'ADMIN' && (
                    <>
                      <Button onClick={() => handleExport('PDF')} size="sm" variant="ghost" className="h-9 px-5 text-[10px] font-black uppercase tracking-widest border border-white/5 rounded-xl bg-white/[0.02] hover:bg-white/5 text-white/40 hover:text-white transition-all"><Download className="w-4 h-4 mr-2" /> Gerar PDF</Button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Mini Calendar Widget */}
            <div className="glass-card p-6 border-white/5 shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-black flex items-center gap-4 tracking-tighter uppercase italic">
                  <CalendarIcon className="w-6 h-6 text-primary glow-red-subtle" /> 
                  {format(viewDate, "MMMM yyyy", { locale: ptBR })} 
                  <span className="text-white/10 mx-2 font-thin not-italic">/</span>
                  <span className="text-primary/60 text-base font-bold tracking-normal italic lowercase">{selectedClient?.name || 'geral'}</span>
                </h2>
                <div className="flex items-center gap-2">
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
                          <div key={i} className="text-[8.5px] font-black bg-white/[0.04] text-primary/80 px-2.5 py-1.5 rounded-xl border-l-2 border-primary truncate shadow-sm transition-all group-hover:translate-x-1 group-hover:bg-primary/10 group-hover:text-white">
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
          <div className="lg:col-span-4 space-y-5">
            <div className="grid grid-cols-1 gap-4">
              {[
                { icon: CalendarIcon, label: 'Calendário', sub: `${metrics.currMonthTasks.length} artes geradas`, path: '/calendario' },
                { icon: FileEdit, label: 'Alterações', sub: `${metrics.changesCount} tarefas`, path: '/correcao', urgent: metrics.changesCount > 0 },
                { icon: Folder, label: 'Banco de Dados', sub: 'Hub Operacional', path: '/cofre' },
                { icon: MessageSquare, label: 'WhatsApp', sub: 'Mensagens diretas', path: '/whatsapp' },
              ].map(item => (
                <button key={item.label} onClick={() => navigate(item.path)} className="glass-card-hover p-5 flex items-center justify-between group border-white/5 shadow-2xl hover:translate-x-1">
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

            <div className="glass-card flex flex-col border-white/5 shadow-2xl">
              <div className="p-6 border-b border-white/[0.03] flex items-center justify-between bg-white/[0.01]">
                <h2 className="text-[11px] font-black tracking-[0.25em] text-white/20 uppercase flex items-center gap-3 italic">
                  <Users className="w-4.5 h-4.5 text-primary glow-red-subtle" /> Equipe Mac Mídia
                </h2>
                {loggedUserRole === 'ADMIN' && (
                  <button onClick={() => setShowAdd(true)} className="h-9 w-9 flex items-center justify-center hover:bg-white/5 rounded-xl transition-all border border-white/10 text-white/40 shadow-lg hover:text-white hover:border-primary/40"><UserPlus className="w-4 h-4" /></button>
                )}
              </div>
              <div className="p-3 space-y-2 max-h-[420px] overflow-y-auto custom-scrollbar">
                {employees.slice(0, 10).map((emp, idx) => (
                  <div key={emp.id} onClick={() => navigate(`/funcionario/${emp.id}`)} className="flex items-center gap-4.5 p-4 rounded-3xl hover:bg-white/5 transition-all cursor-pointer group/emp">
                    <div className="relative">
                      <div className="w-11 h-11 rounded-[1.1rem] bg-white/5 overflow-hidden border border-white/10 group-hover/emp:border-primary/60 transition-all shadow-xl">
                        {emp.photoUrl ? <img src={emp.photoUrl} className="w-full h-full object-cover group-hover/emp:scale-110 transition-transform duration-700" /> : <span className="text-2xl flex items-center justify-center h-full opacity-20">{emp.avatar}</span>}
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-[3px] border-[#020202] bg-emerald-500 shadow-2xl" />
                    </div>
                    <div className="flex-1 min-w-0 pr-2">
                      <h4 className="text-[14px] font-black text-white/90 truncate group-hover/emp:text-white transition-colors leading-tight mb-0.5">{emp.name}</h4>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] text-white/25 uppercase font-black tracking-widest truncate leading-none">{emp.role}</p>
                        {/* Live Status Indicator */}
                        <span className={`flex h-1.5 w-1.5 rounded-full ${idx < 3 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse' : 'bg-white/10'}`} />
                      </div>
                    </div>
                    <ChevronRightIcon className="w-4 h-4 text-white/5 group-hover/emp:text-primary transition-all translate-x-4 group-hover/emp:translate-x-0 opacity-0 group-hover/emp:opacity-100" />
                  </div>
                ))}
              </div>
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
