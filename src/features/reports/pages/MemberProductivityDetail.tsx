import { useState, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/useApp';
import { 
  ArrowLeft, 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  FileText, 
  ShieldAlert, 
  Activity,
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ThemeToggle } from '@/components/ThemeToggle';

function formatSecondsToHHMM(seconds: number): string {
  if (!seconds || seconds <= 0) return '0h 00m';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hrs}h ${String(mins).padStart(2, '0')}m`;
}

export function MemberProductivityDetail() {
  const { member_id } = useParams<{ member_id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loggedUserRole, employees = [], kanbanCards = [] } = useApp();

  const queryDate = searchParams.get('date') || new Date().toISOString().split('T')[0];
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const todayStr = new Date().toISOString().split('T')[0];

  // Editable Date Range states
  const [startDate, setStartDate] = useState<string>(queryDate);
  const [endDate, setEndDate] = useState<string>(queryDate);
  
  // Status filter state
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const employee = employees.find(e => e.id === member_id);

  // Quick Date Range Presets Handler
  const applyPreset = (preset: 'today' | 'last7' | 'thisMonth') => {
    if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'last7') {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === 'thisMonth') {
      setStartDate(firstDayOfMonth);
      setEndDate(todayStr);
    }
  };

  // Filter cards worked on by this employee + selected status (HOOK ALWAYS AT TOP)
  const memberCards = useMemo(() => {
    if (!member_id) return [];
    return kanbanCards.filter(card => {
      // Member assignment filter
      const isAssigned = card.employeeId === member_id || 
        (Array.isArray(card.assignedUsers) && card.assignedUsers.some((u: any) => u.id === member_id));
      if (!isAssigned) return false;

      // Status filter
      const colName = card.column?.toLowerCase() || '';
      if (selectedStatus === 'completed') {
        return colName.includes('aprovado') || colName.includes('programar') || colName.includes('concluido');
      }
      if (selectedStatus === 'in_progress') {
        return colName.includes('producao') || colName.includes('progresso') || colName.includes('produção');
      }
      if (selectedStatus === 'alteration') {
        return colName.includes('alteracao') || colName.includes('alteração') || colName.includes('correcao') || colName.includes('correção');
      }
      if (selectedStatus === 'urgent') {
        return Array.isArray(card.labels) && card.labels.some(l => l.toUpperCase().includes('URGENTE'));
      }

      return true;
    });
  }, [kanbanCards, member_id, selectedStatus]);

  // Aggregate member metrics for selected date range & status (HOOK ALWAYS AT TOP)
  const memberMetrics = useMemo(() => {
    let firstActivity: Date | null = null;
    let lastActivity: Date | null = null;
    let totalTimeSpent = 0;
    let completedCount = 0;
    const activityTimeline: any[] = [];

    memberCards.forEach(card => {
      // Check timer
      if (card.employeeId === member_id) {
        totalTimeSpent += (card.timeSpent || 0);
      }

      // Check column
      const isCompletedCol = 
        card.column?.toLowerCase().includes('aprovado') || 
        card.column?.toLowerCase().includes('programar') ||
        card.column?.toLowerCase().includes('concluido');

      if (isCompletedCol) completedCount++;

      // Check history timestamps for date range (startDate <= actDate <= endDate)
      if (Array.isArray(card.history)) {
        card.history.forEach((act: any) => {
          if (act.createdAt) {
            const actDateStr = act.createdAt.split('T')[0];
            if (actDateStr >= startDate && actDateStr <= endDate) {
              const actDate = new Date(act.createdAt);
              if (!firstActivity || actDate < firstActivity) firstActivity = actDate;
              if (!lastActivity || actDate > lastActivity) lastActivity = actDate;

              activityTimeline.push({
                id: act.id || Math.random().toString(),
                cardTitle: card.clientName,
                description: act.description || 'Movimentação no card',
                timestamp: act.createdAt
              });
            }
          }
        });
      }
    });

    activityTimeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const startFormatted = firstActivity 
      ? (firstActivity as Date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : (totalTimeSpent > 0 ? '08:30' : '-');

    const endFormatted = lastActivity 
      ? (lastActivity as Date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : (totalTimeSpent > 0 ? '18:00' : '-');

    return {
      startTime: startFormatted,
      endTime: endFormatted,
      totalTimeSeconds: totalTimeSpent,
      completedCount,
      activityTimeline
    };
  }, [memberCards, member_id, startDate, endDate]);

  // Access Guard - Admin Only (RETURN AFTER ALL HOOKS)
  if (loggedUserRole !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-[#020202] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Acesso Restrito a Administradores</h1>
        <p className="text-zinc-400 text-sm max-w-md mb-6">
          O relatório individual de produtividade é de uso exclusivo da gestão administrativa.
        </p>
        <Button onClick={() => navigate('/')} className="bg-red-600 hover:bg-red-700 text-white rounded-xl px-6">
          Voltar ao Dashboard
        </Button>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="min-h-screen bg-[#020202] text-white p-8 text-center">
        <p className="text-zinc-400">Colaborador não encontrado.</p>
        <Button onClick={() => navigate('/produtividade')} className="mt-4 bg-red-600 text-white">
          Voltar para Produtividade
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020202] text-white p-4 md:p-8 space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/produtividade')}
            className="h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10 text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-red-500/50 bg-zinc-800 shrink-0">
              {employee.avatarUrl || employee.photoUrl ? (
                <img src={employee.avatarUrl || employee.photoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-bold text-white/50 text-base">
                  {employee.name[0]}
                </div>
              )}
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-black uppercase tracking-tight flex items-center gap-2">
                {employee.name}
              </h1>
              <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider">
                {employee.role || 'Colaborador Operacional'}
              </p>
            </div>
          </div>
        </div>

        {/* Complete Filter Bar (Presets + Date Range + Status Filter + Theme Toggle) */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Quick Presets */}
          <div className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-white/10">
            <button 
              type="button"
              onClick={() => applyPreset('today')}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-lg uppercase tracking-wider transition-all ${
                startDate === todayStr && endDate === todayStr ? 'bg-red-600 text-white shadow-md' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Hoje
            </button>
            <button 
              type="button"
              onClick={() => applyPreset('last7')}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-lg uppercase tracking-wider transition-all ${
                startDate !== todayStr && startDate !== firstDayOfMonth ? 'bg-red-600 text-white shadow-md' : 'text-zinc-400 hover:text-white'
              }`}
            >
              7 Dias
            </button>
            <button 
              type="button"
              onClick={() => applyPreset('thisMonth')}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-lg uppercase tracking-wider transition-all ${
                startDate === firstDayOfMonth ? 'bg-red-600 text-white shadow-md' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Mês
            </button>
          </div>

          {/* Editable Date Range Inputs (Start Date to End Date) */}
          <div className="glass-card px-3 py-1.5 flex items-center gap-2 border-white/10 shadow-lg cursor-pointer" onClick={e => {
            const input = e.currentTarget.querySelector('input');
            if (input && 'showPicker' in input) (input as any).showPicker();
          }}>
            <CalendarIcon className="w-4 h-4 text-red-500 shrink-0" />
            <input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)}
              className="bg-transparent text-xs font-bold uppercase tracking-wider outline-none text-white cursor-pointer"
            />
            <span className="text-zinc-500 font-bold text-xs">até</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)}
              className="bg-transparent text-xs font-bold uppercase tracking-wider outline-none text-white cursor-pointer"
            />
          </div>

          {/* Status Filter Dropdown */}
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-44 bg-zinc-900 border-white/10 h-9 text-xs font-bold rounded-xl">
              <Filter className="w-3.5 h-3.5 mr-2 text-red-500" />
              <SelectValue placeholder="Todos os Status" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-950 border-zinc-800 text-xs">
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="completed">🟢 Aprovados / Concluídos</SelectItem>
              <SelectItem value="in_progress">🟡 Em Produção / Progresso</SelectItem>
              <SelectItem value="alteration">🔴 Em Alteração / Correção</SelectItem>
              <SelectItem value="urgent">⚠️ Somente Urgentes</SelectItem>
            </SelectContent>
          </Select>

          <ThemeToggle />
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Horário Início */}
        <div className="glass-card p-4 space-y-1 border-white/5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Horário de Início</span>
          <div className="text-2xl font-black text-white font-mono">{memberMetrics.startTime}</div>
          <p className="text-[10px] text-zinc-500">Primeira atividade no período</p>
        </div>

        {/* Horário Fim */}
        <div className="glass-card p-4 space-y-1 border-white/5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Horário de Fim</span>
          <div className="text-2xl font-black text-white font-mono">{memberMetrics.endTime}</div>
          <p className="text-[10px] text-zinc-500">Última atividade no período</p>
        </div>

        {/* Tempo Total Trabalhado */}
        <div className="glass-card p-4 space-y-1 border-white/5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Tempo Ativo Total</span>
          <div className="text-2xl font-black text-red-400">{formatSecondsToHHMM(memberMetrics.totalTimeSeconds)}</div>
          <p className="text-[10px] text-zinc-500">Soma acumulada no período</p>
        </div>

        {/* Cards Concluídos */}
        <div className="glass-card p-4 space-y-1 border-white/5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Cards Aprovados</span>
          <div className="text-2xl font-black text-emerald-400">{memberMetrics.completedCount}</div>
          <p className="text-[10px] text-zinc-500">Chegaram na coluna final</p>
        </div>
      </div>

      {/* Detailed Cards List */}
      <div className="glass-card p-6 border-white/5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-red-500" /> Lista Detalhada de Cards do Período
          </h2>
          <span className="text-xs text-zinc-400">{memberCards.length} card(s) filtrado(s)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-zinc-400 text-[10px] font-black uppercase tracking-widest bg-white/[0.02]">
                <th className="p-3.5">Nome do Card</th>
                <th className="p-3.5">Cliente / Unidade</th>
                <th className="p-3.5">Coluna Atual</th>
                <th className="p-3.5">Tempo Gasto</th>
                <th className="p-3.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs font-medium">
              {memberCards.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-zinc-500">
                    Nenhum card registrado para os filtros selecionados neste colaborador.
                  </td>
                </tr>
              ) : (
                memberCards.map(card => {
                  const isCompleted = 
                    card.column?.toLowerCase().includes('aprovado') || 
                    card.column?.toLowerCase().includes('programar') ||
                    card.column?.toLowerCase().includes('concluido');

                  return (
                    <tr key={card.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-3.5 font-bold text-white uppercase">
                        {card.clientName}
                      </td>
                      <td className="p-3.5 text-zinc-400">
                        {card.calendarClientName || '-'}
                      </td>
                      <td className="p-3.5 text-zinc-300 capitalize">
                        {card.column}
                      </td>
                      <td className="p-3.5 font-mono text-red-400 font-bold">
                        {formatSecondsToHHMM(card.timeSpent || 0)}
                      </td>
                      <td className="p-3.5 text-right">
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" /> Concluído
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-zinc-800 text-zinc-400 border border-zinc-700">
                            Em Progresso
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Activity Timeline Section */}
      <div className="glass-card p-6 border-white/5 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
          <Activity className="w-4 h-4 text-red-500" /> Histórico de Ações do Colaborador no Período
        </h2>
        
        {memberMetrics.activityTimeline.length === 0 ? (
          <p className="text-xs text-zinc-500">Sem registros de atividades no log neste período e status.</p>
        ) : (
          <div className="space-y-3 pl-2 border-l-2 border-white/10">
            {memberMetrics.activityTimeline.map(act => (
              <div key={act.id} className="relative pl-4 text-xs space-y-0.5">
                <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-red-500/20 border border-red-500 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white uppercase">{act.cardTitle}</span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {new Date(act.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-zinc-400 text-[11px]">{act.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default MemberProductivityDetail;
