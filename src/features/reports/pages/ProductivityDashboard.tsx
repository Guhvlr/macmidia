import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/useApp';
import { 
  BarChart3, 
  Calendar as CalendarIcon, 
  Clock, 
  CheckCircle2, 
  Flame, 
  Users, 
  ShieldAlert, 
  Search, 
  TrendingUp, 
  Filter,
  AlertTriangle,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ThemeToggle } from '@/components/ThemeToggle';
import { getStuckCards } from '@/features/kanban/utils/stuckCards';

function formatSecondsToHHMM(seconds: number): string {
  if (!seconds || seconds <= 0) return '0h 00m';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hrs}h ${String(mins).padStart(2, '0')}m`;
}

export function ProductivityDashboard() {
  const navigate = useNavigate();
  const { loggedUserRole, employees = [], kanbanCards = [] } = useApp();
  
  const todayStr = new Date().toISOString().split('T')[0];
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  // Editable Date Range states (Default: Today to Today, expandable)
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);
  
  // Filters
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Quick Date Range Presets Handler
  const applyPreset = (preset: 'today' | 'last7' | 'thisMonth') => {
    const today = new Date().toISOString().split('T')[0];
    if (preset === 'today') {
      setStartDate(today);
      setEndDate(today);
    } else if (preset === 'last7') {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(today);
    } else if (preset === 'thisMonth') {
      setStartDate(firstDayOfMonth);
      setEndDate(today);
    }
  };

  // Calculate Productivity Metrics per Employee for selected date range & status
  const productivityRows = useMemo(() => {
    return employees
      .filter(emp => selectedEmployeeId === 'all' || emp.id === selectedEmployeeId)
      .filter(emp => !searchTerm || emp.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .map(emp => {
        // Find cards assigned or touched by this employee
        const empCards = kanbanCards.filter(card => {
          // Member filter
          const isAssigned = card.employeeId === emp.id || 
            (Array.isArray(card.assignedUsers) && card.assignedUsers.some((u: any) => u.id === emp.id));
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

          return true; // 'all'
        });

        // Filter activities/history for the date range (startDate <= actDate <= endDate)
        let firstActivity: Date | null = null;
        let lastActivity: Date | null = null;
        let totalTimeSpent = 0;
        let cardsCompletedCount = 0;

        empCards.forEach(card => {
          // Check card history timestamps
          if (Array.isArray(card.history)) {
            card.history.forEach((act: any) => {
              if (act.createdAt) {
                const actDateStr = act.createdAt.split('T')[0];
                if (actDateStr >= startDate && actDateStr <= endDate) {
                  const actDate = new Date(act.createdAt);
                  if (!firstActivity || actDate < firstActivity) firstActivity = actDate;
                  if (!lastActivity || actDate > lastActivity) lastActivity = actDate;
                }
              }
            });
          }

          // Check card timer
          if (card.employeeId === emp.id) {
            totalTimeSpent += (card.timeSpent || 0);
          }

          // Check completion
          const isCompletedCol = 
            card.column?.toLowerCase().includes('aprovado') || 
            card.column?.toLowerCase().includes('programar') ||
            card.column?.toLowerCase().includes('concluido');

          if (isCompletedCol) {
            cardsCompletedCount++;
          }
        });

        const startFormatted = firstActivity 
          ? (firstActivity as Date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          : (totalTimeSpent > 0 ? '08:30' : '-');

        const endFormatted = lastActivity 
          ? (lastActivity as Date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          : (totalTimeSpent > 0 ? '18:00' : '-');

        return {
          employee: emp,
          startTime: startFormatted,
          endTime: endFormatted,
          totalTimeSeconds: totalTimeSpent,
          cardsTouched: empCards.length,
          cardsCompleted: cardsCompletedCount
        };
      })
      .sort((a, b) => b.totalTimeSeconds - a.totalTimeSeconds);
  }, [employees, kanbanCards, startDate, endDate, selectedStatus, selectedEmployeeId, searchTerm]);

  // Overall KPI Summaries (HOOK ALWAYS AT TOP)
  const stuckCards = useMemo(() => {
    const allStuck = getStuckCards(kanbanCards, 24);
    if (selectedEmployeeId === 'all') return allStuck;
    return allStuck.filter(item => {
      return item.card.employeeId === selectedEmployeeId || 
        (Array.isArray(item.card.assignedUsers) && item.card.assignedUsers.some((u: any) => u.id === selectedEmployeeId));
    });
  }, [kanbanCards, selectedEmployeeId]);

  const kpis = useMemo(() => {
    const totalTime = productivityRows.reduce((acc, row) => acc + row.totalTimeSeconds, 0);
    const totalTouched = productivityRows.reduce((acc, row) => acc + row.cardsTouched, 0);
    const totalCompleted = productivityRows.reduce((acc, row) => acc + row.cardsCompleted, 0);
    const topPerformer = productivityRows[0]?.employee?.name || 'Nenhum';

    return {
      totalTimeFormatted: formatSecondsToHHMM(totalTime),
      totalTouched,
      totalCompleted,
      topPerformer,
      stuckCount: stuckCards.length
    };
  }, [productivityRows, stuckCards]);

  // Access Control Guard - Admin Only (RETURN AFTER ALL HOOKS)
  if (loggedUserRole !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-[#020202] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Acesso Restrito a Administradores</h1>
        <p className="text-zinc-400 text-sm max-w-md mb-6">
          O módulo de Produtividade e Alertas é de uso exclusivo da gestão administrativa.
        </p>
        <Button onClick={() => navigate('/')} className="bg-red-600 hover:bg-red-700 text-white rounded-xl px-6">
          Voltar ao Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020202] text-white p-4 md:p-8 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight uppercase italic">
              Dashboard de Produtividade
            </h1>
          </div>
          <p className="text-xs text-zinc-400">
            Acompanhamento de horários, tempo ativo e entregas individuais da equipe.
          </p>
        </div>

        {/* Top Controls: Date Range + Status Filter + Member Filter */}
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

          {/* Member Filter */}
          <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
            <SelectTrigger className="w-44 bg-zinc-900 border-white/10 h-9 text-xs font-bold rounded-xl">
              <Users className="w-3.5 h-3.5 mr-2 text-red-500" />
              <SelectValue placeholder="Todos os Membros" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-950 border-zinc-800 text-xs">
              <SelectItem value="all">Todos os Membros</SelectItem>
              {employees.map(emp => (
                <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <ThemeToggle />
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Tempo Total Trabalhado */}
        <div className="glass-card p-5 space-y-2 border-white/5 hover:border-red-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Tempo Ativo Total</span>
            <div className="p-2 rounded-xl bg-red-500/10 text-red-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white">{kpis.totalTimeFormatted}</div>
          <p className="text-[10px] text-zinc-500">Soma acumulada no período</p>
        </div>

        {/* KPI 2: Cards Mexidos */}
        <div className="glass-card p-5 space-y-2 border-white/5 hover:border-blue-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Cards Trabalhados</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white">{kpis.totalTouched}</div>
          <p className="text-[10px] text-zinc-500">Filtrados no período e status</p>
        </div>

        {/* KPI 3: Cards Concluídos */}
        <div className="glass-card p-5 space-y-2 border-white/5 hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Concluídos (Aprovados)</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-400">{kpis.totalCompleted}</div>
          <p className="text-[10px] text-zinc-500">Chegaram na coluna final</p>
        </div>

        {/* KPI 4: Destaque do Dia */}
        <div className="glass-card p-5 space-y-2 border-white/5 hover:border-amber-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Destaque do Período</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-bold text-amber-400 truncate">{kpis.topPerformer}</div>
          <p className="text-[10px] text-zinc-500">Maior tempo e volume de entregas</p>
        </div>
      </div>

      {/* 🚨 Section: Alertas de Cards Parados (+24h) */}
      {stuckCards.length > 0 && (
        <div className="glass-card p-6 border-red-500/30 bg-red-950/10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black uppercase tracking-wider text-red-400 flex items-center gap-2">
                  Alertas de Cards Parados (+24h sem atividade)
                </h2>
                <p className="text-xs text-zinc-400">
                  Cards sem movimentação, comentários ou tempo registrado em colunas ativas.
                </p>
              </div>
            </div>
            <span className="px-3 py-1 bg-red-500 text-white font-black text-xs rounded-full border border-red-400 shadow-lg">
              {stuckCards.length} Card(s) Parado(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-red-500/20 text-red-300 text-[10px] font-black uppercase tracking-widest bg-red-500/5">
                  <th className="p-3">Card / Cliente</th>
                  <th className="p-3">Coluna Atual</th>
                  <th className="p-3">Responsável</th>
                  <th className="p-3">Tempo Inativo</th>
                  <th className="p-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-500/10 text-xs font-medium">
                {stuckCards.map(({ card, hoursInactive, formattedInactiveTime, isUrgent }) => {
                  const assignedEmp = employees.find(e => e.id === card.employeeId);
                  return (
                    <tr key={card.id} className="hover:bg-red-500/10 transition-colors">
                      <td className="p-3 font-bold text-white uppercase flex items-center gap-2">
                        {isUrgent && (
                          <span className="px-1.5 py-0.5 text-[9px] font-black bg-red-600 text-white rounded uppercase animate-bounce">
                            URGENTE ⚠️
                          </span>
                        )}
                        {card.clientName}
                      </td>
                      <td className="p-3 text-zinc-300 capitalize">{card.column}</td>
                      <td className="p-3 text-zinc-300 font-bold">{assignedEmp?.name || 'Não atribuído'}</td>
                      <td className="p-3">
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-red-500/20 text-red-400 border border-red-500/30">
                          {formattedInactiveTime} sem ação
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <Button 
                          size="sm" 
                          onClick={() => navigate(`/funcionario/${card.employeeId}`)}
                          className="h-7 text-[10px] font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg"
                        >
                          Ver no Kanban <ChevronRight className="w-3 h-3 ml-1" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Main Table Container */}
      <div className="glass-card p-6 border-white/5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-red-500" /> Resumo Diário da Equipe
            </h2>
            <p className="text-xs text-zinc-400">
              Tabela de presença, carga horária e volume de cards por colaborador.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-zinc-500" />
            <Input 
              placeholder="Buscar colaborador..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-zinc-900 border-white/10 pl-9 h-9 text-xs rounded-xl"
            />
          </div>
        </div>

        {/* Tabela de Produtividade */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-zinc-400 text-[10px] font-black uppercase tracking-widest bg-white/[0.02]">
                <th className="p-3.5">Membro</th>
                <th className="p-3.5">Cargo / Especialidade</th>
                <th className="p-3.5">Horário Início</th>
                <th className="p-3.5">Horário Fim</th>
                <th className="p-3.5">Tempo Ativo Total</th>
                <th className="p-3.5 text-center">Cards Mexidos</th>
                <th className="p-3.5 text-center">Concluídos</th>
                <th className="p-3.5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs font-medium">
              {productivityRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-zinc-500">
                    Nenhum colaborador encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                productivityRows.map(({ employee, startTime, endTime, totalTimeSeconds, cardsTouched, cardsCompleted }) => (
                  <tr 
                    key={employee.id} 
                    onClick={() => navigate(`/produtividade/${employee.id}?date=${startDate}`)}
                    className="hover:bg-white/5 transition-colors cursor-pointer group"
                  >
                    {/* Membro */}
                    <td className="p-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full overflow-hidden border border-white/10 bg-zinc-800 shrink-0">
                          {employee.avatarUrl || employee.photoUrl ? (
                            <img src={employee.avatarUrl || employee.photoUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center font-bold text-white/50 text-xs">
                              {employee.name[0]}
                            </div>
                          )}
                        </div>
                        <span className="font-bold text-white group-hover:text-red-400 transition-colors">
                          {employee.name}
                        </span>
                      </div>
                    </td>

                    {/* Cargo */}
                    <td className="p-3.5 text-zinc-400 uppercase tracking-wider text-[11px]">
                      {employee.role || 'Colaborador'}
                    </td>

                    {/* Início */}
                    <td className="p-3.5 text-zinc-300 font-mono text-xs">
                      {startTime}
                    </td>

                    {/* Fim */}
                    <td className="p-3.5 text-zinc-300 font-mono text-xs">
                      {endTime}
                    </td>

                    {/* Tempo Total */}
                    <td className="p-3.5">
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-red-500/10 text-red-400 border border-red-500/20">
                        {formatSecondsToHHMM(totalTimeSeconds)}
                      </span>
                    </td>

                    {/* Mexidos */}
                    <td className="p-3.5 text-center font-bold text-zinc-200">
                      {cardsTouched}
                    </td>

                    {/* Concluídos */}
                    <td className="p-3.5 text-center">
                      <span className="font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                        {cardsCompleted}
                      </span>
                    </td>

                    {/* Ação */}
                    <td className="p-3.5 text-right" onClick={e => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/produtividade/${employee.id}?date=${startDate}`)}
                        className="h-8 text-[11px] font-bold text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl"
                      >
                        Ver Detalhes <ChevronRight className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ProductivityDashboard;
