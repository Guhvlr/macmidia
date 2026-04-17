import React, { useState, useEffect } from 'react';
import { useOffer } from '../context/OfferContext';
import { StepBackground } from '../components/StepBackground';
import { StepSlots } from '../components/StepSlots';
import { StepPages } from '../components/StepPages';
import { StepPriceBadge } from '../components/StepPriceBadge';
import { StepReview } from '../components/StepReview';
import { StepFinal } from '../components/StepFinal';
import { OfferDashboard } from '../components/OfferDashboard';
import { ChevronLeft, ChevronRight, Zap, Monitor, Save, LogOut, Loader2, Folder, ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';

const STEPS = [
  { num: 1, label: 'Layout' },
  { num: 2, label: 'Slots' },
  { num: 3, label: 'Telas' },
  { num: 4, label: 'Preço & Desc.' },
  { num: 5, label: 'Revisão' },
  { num: 6, label: 'Exportar' },
];

const PRESETS = [
  { label: 'Feed', w: 1200, h: 1500 },
  { label: 'Stories', w: 1080, h: 1920 },
  { label: 'Banner', w: 1920, h: 1080 },
];

// Input que usa estado local e só aplica no blur/enter
const SizeInput = ({ value, onCommit }: { value: number; onCommit: (v: number) => void }) => {
  const [local, setLocal] = useState(String(value));
  useEffect(() => { setLocal(String(value)); }, [value]);
  const apply = () => {
    const n = Math.max(100, parseInt(local) || 100);
    onCommit(n);
    setLocal(String(n));
  };
  return (
    <div className="group/input relative flex items-center bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/20 rounded-lg transition-all duration-300 px-1 overflow-hidden">
      <input
        type="text"
        value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={apply}
        onKeyDown={e => { if (e.key === 'Enter') apply(); }}
        className="w-12 bg-transparent text-center text-[11px] font-black text-white/80 focus:text-white border-none focus:ring-0 p-0 h-7 focus:outline-none transition-colors"
      />
      <div className="absolute bottom-0 left-0 w-full h-[1px] bg-primary scale-x-0 group-focus-within/input:scale-x-100 transition-transform duration-300" />
    </div>
  );
};

const OfferStudioInner = () => {
  const {
    step, setStep, config, updateConfig,
    selectedClientName, setSelectedClientName, clients,
    activeProjectId, activeProjectName,
    openProject, saveProject, closeProject, createAndOpenProject,
  } = useOffer();

  const [isSaving, setIsSaving] = useState(false);

  // ── If no project is active, show the dashboard ──
  if (!activeProjectId) {
    return (
      <OfferDashboard
        onOpenProject={openProject}
        onCreateProject={(name, date) => createAndOpenProject(name, date)}
      />
    );
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveProject();
    } finally {
      setIsSaving(false);
    }
  };

  // ── Active project → show step-by-step editor ──
  // ── Active project → show step-by-step editor ──
  return (
    <div className="min-h-screen bg-[#020202] text-white flex flex-col h-screen overflow-hidden">
      {/* Header Premium com Glassmorphism */}
      <header className="px-6 py-3.5 border-b border-white/[0.05] bg-[#0d0d10]/80 backdrop-blur-xl shrink-0 flex items-center justify-between z-30 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 group cursor-default">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-rose-700 flex items-center justify-center shadow-[0_0_20px_rgba(225,29,72,0.3)] group-hover:shadow-[0_0_30px_rgba(225,29,72,0.5)] transition-all duration-500 transform group-hover:rotate-6">
              <Zap className="w-5 h-5 text-white fill-white animate-pulse" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-sm font-black tracking-widest uppercase italic leading-none text-white/90">MacOferta</h1>
              <span className="text-[10px] font-black text-primary tracking-[0.3em] uppercase leading-none mt-1">Studio Pro</span>
            </div>
          </div>

          <div className="h-10 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />

          {/* Badge de Projeto Premium */}
          <div className="flex items-center gap-3 px-4 py-2 bg-white/[0.03] rounded-2xl border border-white/5 hover:border-white/10 transition-all duration-300">
            <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">Projeto</span>
            <span className="text-xs font-black text-primary truncate max-w-[180px] drop-shadow-[0_0_8px_rgba(225,29,72,0.4)]">{activeProjectName}</span>
          </div>

          <div className="h-10 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />

          {/* Seletor de Pasta Customizado (Premium Dropdown) */}
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">Pasta</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 px-4 py-2 bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-primary/30 rounded-2xl transition-all duration-300 group min-w-[200px]">
                  <Folder className="w-4 h-4 text-primary opacity-70 group-hover:opacity-100 transition-opacity" />
                  <span className="text-[11px] font-black text-white/80 uppercase tracking-wider flex-1 text-left truncate">
                    {selectedClientName || 'GERAL / TODOS'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-white/20 group-hover:text-primary transition-all duration-300" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[240px] bg-[#0d0d10]/95 backdrop-blur-2xl border-white/10 rounded-2xl p-2 shadow-[0_10px_40px_rgba(0,0,0,0.8)] animate-in fade-in zoom-in-95">
                <DropdownMenuLabel className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] px-3 py-2">Selecionar Pasta</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/5 mx-2" />
                <DropdownMenuItem 
                  onClick={() => setSelectedClientName(null)}
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${!selectedClientName ? 'bg-primary/20 text-white' : 'text-white/40 hover:bg-white/5 hover:text-white'}`}
                >
                  <Folder className={`w-4 h-4 ${!selectedClientName ? 'text-primary' : 'opacity-40'}`} />
                  <span className="text-[11px] font-black uppercase tracking-wider flex-1">GERAL / TODOS</span>
                  {!selectedClientName && <Check className="w-4 h-4 text-primary" />}
                </DropdownMenuItem>
                {clients.map(c => (
                  <DropdownMenuItem 
                    key={c.id} 
                    onClick={() => setSelectedClientName(c.name)}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${selectedClientName === c.name ? 'bg-primary/20 text-white' : 'text-white/40 hover:bg-white/5 hover:text-white'}`}
                  >
                    <Folder className={`w-4 h-4 ${selectedClientName === c.name ? 'text-primary' : 'opacity-40'}`} />
                    <span className="text-[11px] font-black uppercase tracking-wider flex-1">{c.name}</span>
                    {selectedClientName === c.name && <Check className="w-4 h-4 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="h-10 px-5 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-[0.15em] text-[10px] rounded-2xl shadow-lg shadow-emerald-900/40 hover:shadow-emerald-500/30 transition-all duration-300 transform active:scale-95 group"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin p-0" /> : <Save className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />}
              <span className="ml-2">Salvar Alterações</span>
            </Button>
            
            <Button
              variant="outline"
              onClick={closeProject}
              className="h-10 px-4 bg-white/5 border-white/5 hover:border-red-500/40 text-white/40 hover:text-red-400 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-300"
            >
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="h-10 w-px bg-white/5" />

          {/* Size Controls Premium */}
          <div className="flex items-center gap-2 p-1.5 bg-black/40 rounded-2xl border border-white/5">
            <div className="flex items-center gap-1.5 px-2">
              <Monitor className="w-3.5 h-3.5 text-white/20" />
              <div className="flex items-center gap-1.5">
                <SizeInput value={config.width} onCommit={w => updateConfig({ width: w })} />
                <span className="text-white/20 text-[10px] font-black">×</span>
                <SizeInput value={config.height} onCommit={h => updateConfig({ height: h })} />
              </div>
            </div>
            <div className="flex items-center gap-1">
              {PRESETS.map(p => (
                <button
                  key={p.label}
                  onClick={() => updateConfig({ width: p.w, height: p.h })}
                  className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all duration-300 ${
                    config.width === p.w && config.height === p.h 
                      ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' 
                      : 'bg-white/5 border-transparent text-white/30 hover:text-white/60 hover:bg-white/10'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="px-6 py-4 bg-[#0d0d10]/50 backdrop-blur-md border-b border-white/5 flex items-center gap-1 shrink-0 overflow-x-auto no-scrollbar">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.num}>
            <button 
              onClick={() => setStep(s.num)}
              className={`flex items-center gap-3 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.1em] transition-all duration-500 group relative overflow-hidden ${
                step === s.num 
                  ? 'text-white bg-primary shadow-[0_4px_20px_rgba(225,29,72,0.3)]' 
                  : step > s.num 
                    ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' 
                    : 'text-white/30 bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:text-white/50'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black transition-colors ${
                step === s.num ? 'bg-white/20' : step > s.num ? 'bg-emerald-500/30' : 'bg-white/10'
              }`}>
                {step > s.num ? '✓' : s.num}
              </span>
              <span className="relative z-10">{s.label}</span>
              {step === s.num && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
              )}
            </button>
            {i < STEPS.length - 1 && <div className={`w-6 h-[1px] transition-all duration-1000 ${step > s.num ? 'bg-emerald-500/40' : 'bg-white/10'}`} />}
          </React.Fragment>
        ))}
      </div>

      <main className="flex-1 overflow-hidden relative">
        {step === 1 && <StepBackground />}
        {step === 2 && <StepSlots />}
        {step === 3 && <StepPages />}
        {step === 4 && <StepPriceBadge />}
        {step === 5 && <StepReview />}
        {step === 6 && <StepFinal />}
      </main>

      {/* Footer estável para navegação */}
      <footer className="px-5 py-3 bg-[#0d0d10] border-t border-white/5 flex items-center justify-between z-20">
        <div className="text-[10px] text-white/20 font-bold uppercase tracking-widest">
          Sessão: {STEPS.find(s => s.num === step)?.label}
        </div>
        <div className="flex gap-2">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} className="h-9 px-6 bg-white/5 border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">
              <ChevronLeft className="w-4 h-4 mr-2" /> Voltar
            </Button>
          )}
          {step < 6 && (
            <Button onClick={() => setStep(step + 1)} className="h-9 px-8 bg-primary hover:bg-primary/90 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 transition-all group">
              Próximo <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
};

export default function OfferStudio() {
  return <OfferStudioInner />;
}
