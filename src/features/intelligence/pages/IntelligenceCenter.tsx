import React, { useMemo } from 'react';
import { 
  BrainCircuit, 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Settings2,
  Database,
  LineChart,
  Bot
} from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import { Switch } from '@/components/ui/switch';
import { useIntelligence } from '@/features/intelligence/context/IntelligenceContext';

export default function IntelligenceCenter() {
  const { logs, isActive, setIsActive, clearLogs } = useIntelligence();

  // Create real activity data grouped by time
  const activityData = useMemo(() => {
    // Generate empty buckets for the last 6 hours
    const buckets = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 60 * 60 * 1000);
      buckets.push({
        time: `${String(d.getHours()).padStart(2, '0')}:00`,
        hour: d.getHours(),
        insights: 0,
        corrections: 0,
      });
    }

    logs.forEach(log => {
      const logHour = new Date(log.timestamp).getHours();
      const bucket = buckets.find(b => b.hour === logHour);
      if (bucket) {
        if (log.type === 'insight' || log.type === 'observation') bucket.insights++;
        if (log.type === 'correction' || log.type === 'alert') bucket.corrections++;
      }
    });

    return buckets;
  }, [logs]);

  const topStats = useMemo(() => {
    const total = logs.length;
    const corrections = logs.filter(l => l.type === 'correction').length;
    const actions = logs.filter(l => l.type === 'observation').length;
    return { total, corrections, actions };
  }, [logs]);

  const formatDate = (timestamp: number) => {
    const rtf = new Intl.RelativeTimeFormat('pt', { numeric: 'auto' });
    const diff = (timestamp - Date.now()) / 1000;
    
    if (Math.abs(diff) < 60) return rtf.format(Math.round(diff), 'second');
    if (Math.abs(diff) < 3600) return rtf.format(Math.round(diff / 60), 'minute');
    if (Math.abs(diff) < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
    return rtf.format(Math.round(diff / 86400), 'day');
  };

  return (
    <div className="flex-1 p-6 md:p-10 hide-scrollbar overflow-y-auto space-y-8 animate-fade-in relative">
      
      {/* Background glow effects */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[150px] pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative z-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md">
              <BrainCircuit className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">Centro de Inteligência</h1>
          </div>
          <p className="text-white/40 text-sm max-w-xl">
            Painel de supervisão e telemetria do Agente Sentinela. Monitore aprendizados, previsões, e controle o nível de autonomia da inteligência do Mac Mídia Dash.
          </p>
        </div>

        {/* Master Switch */}
        <div className={`p-4 rounded-2xl border transition-all duration-500 flex items-center gap-4 ${
          isActive 
            ? 'bg-primary/10 border-primary/30 shadow-[0_0_30px_rgba(220,38,38,0.15)]' 
            : 'bg-white/[0.02] border-white/5'
        }`}>
          <div>
            <h3 className={`text-sm font-bold uppercase tracking-wider ${isActive ? 'text-primary' : 'text-white/40'}`}>
              Agente Sentinela
            </h3>
            <p className="text-xs text-white/30">
              {isActive ? 'Modo Ativo (Interferência de UI Ligada)' : 'Modo Observação (Fase 1)'}
            </p>
          </div>
          <Switch 
            checked={isActive} 
            onCheckedChange={setIsActive} 
            className={`${isActive ? 'bg-primary' : 'bg-white/10'}`} 
          />
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative z-10">
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-sm flex flex-col gap-2">
          <div className="flex items-center gap-2 text-white/40">
            <Activity className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest">Eventos Lidos</span>
          </div>
          <div className="text-3xl font-black text-white">{topStats.total}</div>
          <div className="text-xs text-emerald-400 font-bold">Na base local</div>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-sm flex flex-col gap-2">
          <div className="flex items-center gap-2 text-white/40">
            <Bot className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest">Ações Operacionais</span>
          </div>
          <div className="text-3xl font-black text-white">{topStats.actions}</div>
          <div className="text-xs text-white/30 font-bold">Interações do usuário</div>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-sm flex flex-col gap-2">
          <div className="flex items-center gap-2 text-white/40">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest">Correções/Erros</span>
          </div>
          <div className="text-3xl font-black text-white">{topStats.corrections}</div>
          <div className="text-xs text-primary font-bold">Fricção registrada</div>
        </div>

        <div className="p-5 rounded-2xl bg-primary/5 border border-primary/20 backdrop-blur-sm flex flex-col gap-2">
          <div className="flex items-center gap-2 text-primary">
            <Database className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest">Memória</span>
          </div>
          <div className="text-3xl font-black text-white">Local<span className="text-lg text-white/40"> DB</span></div>
          <div className="text-xs text-white/40 font-bold">Salvo no navegador</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
        
        {/* Main Chart */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-[#080808] border border-white/5 shadow-xl flex flex-col h-[400px]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <LineChart className="w-5 h-5 text-white/40" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-white/80">Telemetria de Interferência (6h)</h2>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest">
              <div className="flex items-center gap-1.5 text-white/50"><div className="w-2 h-2 rounded-full bg-blue-500" /> Ações/Fatos</div>
              <div className="flex items-center gap-1.5 text-white/50"><div className="w-2 h-2 rounded-full bg-primary" /> Correções/Alertas</div>
            </div>
          </div>
          
          <div className="flex-1 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activityData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorInsights" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorCorrections" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#dc2626" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#dc2626" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="time" 
                  stroke="rgba(255,255,255,0.1)" 
                  fontSize={10} 
                  tickMargin={10}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  stroke="rgba(255,255,255,0.1)" 
                  fontSize={10}
                  axisLine={false}
                  tickLine={false}
                />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#111', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area type="monotone" dataKey="insights" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorInsights)" />
                <Area type="monotone" dataKey="corrections" stroke="#dc2626" strokeWidth={2} fillOpacity={1} fill="url(#colorCorrections)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Live Feed */}
        <div className="p-6 rounded-2xl bg-[#080808] border border-white/5 shadow-xl flex flex-col h-[400px]">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-white/5">
            <Settings2 className="w-5 h-5 text-white/40" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-white/80">Log Neural em Tempo Real</h2>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[10px] font-bold text-white/30 uppercase">{logs.length} Eventos</span>
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2">
            {logs.length === 0 ? (
              <div className="text-white/30 text-xs italic text-center mt-10">
                Nenhum log registrado ainda. <br />Use o sistema para gerar dados.
              </div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="relative pl-4 border-l-2 border-white/10 group hover:border-white/30 transition-colors animate-fade-in">
                  <div className={`absolute -left-[5px] top-1.5 w-2 h-2 rounded-full ${
                    log.type === 'alert' ? 'bg-primary shadow-[0_0_8px_rgba(220,38,38,0.6)]' :
                    log.type === 'correction' ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]' :
                    log.type === 'insight' ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]' : 
                    'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                  }`} />
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[10px] font-black uppercase text-white/30">{log.user} ({log.module})</span>
                    <span className="text-[9px] font-bold text-white/20">{formatDate(log.timestamp)}</span>
                  </div>
                  <p className="text-xs text-white/70 leading-relaxed font-medium">
                    {log.message}
                  </p>
                </div>
              ))
            )}
          </div>
          
          <button onClick={clearLogs} className="mt-4 w-full py-3 rounded-xl bg-white/[0.02] border border-white/5 text-xs font-bold uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/5 transition-colors">
            Limpar Memória Local
          </button>
        </div>

      </div>

    </div>
  );
}
