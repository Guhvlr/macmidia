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
  { num: 1, label: 'Fundo' },
  { num: 2, label: 'Grade' },
  { num: 3, label: 'Estilo' },
  { num: 4, label: 'Produtos' },
  { num: 5, label: 'Exportar' },
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
    <div className="group/input relative flex items-center bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 rounded-lg transition-all duration-300 px-2 overflow-hidden h-9">
      <input
        type="text"
        value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={apply}
        onKeyDown={e => { if (e.key === 'Enter') apply(); }}
        className="w-full bg-transparent text-center text-xs font-bold text-zinc-100 focus:text-white border-none focus:ring-0 p-0 h-full focus:outline-none transition-colors"
      />
      <div className="absolute bottom-0 left-0 w-full h-[2px] bg-red-600 scale-x-0 group-focus-within/input:scale-x-100 transition-transform duration-300" />
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col h-screen overflow-hidden selection:bg-red-500/30">
      {/* Header Premium Clean */}
      <header className="px-6 py-4 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-xl shrink-0 flex items-center justify-between z-30">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 cursor-default">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center shadow-lg shadow-red-900/20">
              <Zap className="w-4 h-4 text-white fill-white" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-[15px] font-semibold tracking-tight text-white leading-none">MacOferta</h1>
              <span className="text-[10px] font-medium text-red-500 tracking-wide mt-1 leading-none">Studio v2</span>
            </div>
          </div>

          <div className="h-8 w-px bg-zinc-800" />

          {/* Badge de Projeto Premium */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/50 rounded-lg border border-zinc-800/50 hover:border-zinc-700 transition-colors">
            <span className="text-[10px] font-medium text-zinc-500">Projeto:</span>
            <span className="text-[11px] font-semibold text-zinc-200 truncate max-w-[180px]">{activeProjectName}</span>
          </div>

          <div className="h-8 w-px bg-zinc-800" />

          {/* Seletor de Pasta Customizado (Premium Dropdown) */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-zinc-500">Pasta:</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800/50 rounded-lg transition-colors group min-w-[160px]">
                  <Folder className="w-3.5 h-3.5 text-red-500 opacity-80" />
                  <span className="text-[11px] font-medium text-zinc-300 flex-1 text-left truncate">
                    {selectedClientName || 'Geral'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[220px] bg-zinc-900/95 backdrop-blur-xl border-zinc-800 rounded-xl p-1.5 shadow-2xl animate-in fade-in zoom-in-95">
                <DropdownMenuLabel className="text-[10px] font-semibold text-zinc-500 px-2 py-1.5">Selecionar Pasta</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-zinc-800 my-1" />
                <DropdownMenuItem 
                  onClick={() => setSelectedClientName(null)}
                  className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${!selectedClientName ? 'bg-red-500/10 text-red-500' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}`}
                >
                  <Folder className={`w-3.5 h-3.5 ${!selectedClientName ? 'text-red-500' : 'opacity-60'}`} />
                  <span className="text-[11px] font-medium flex-1">Geral</span>
                  {!selectedClientName && <Check className="w-3.5 h-3.5 text-red-500" />}
                </DropdownMenuItem>
                {clients.map(c => (
                  <DropdownMenuItem 
                    key={c.id} 
                    onClick={() => setSelectedClientName(c.name)}
                    className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${selectedClientName === c.name ? 'bg-red-500/10 text-red-500' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}`}
                  >
                    <Folder className={`w-3.5 h-3.5 ${selectedClientName === c.name ? 'text-red-500' : 'opacity-60'}`} />
                    <span className="text-[11px] font-medium flex-1 truncate">{c.name}</span>
                    {selectedClientName === c.name && <Check className="w-3.5 h-3.5 text-red-500" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="h-9 px-4 bg-zinc-100 hover:bg-white text-zinc-900 font-semibold rounded-lg shadow-sm transition-all"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin p-0" /> : <Save className="w-3.5 h-3.5 mr-2" />}
              <span>Salvar Alterações</span>
            </Button>
            
            <Button
              variant="outline"
              onClick={closeProject}
              className="h-9 px-3 bg-zinc-900 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-100 text-zinc-400 rounded-lg transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="h-6 w-px bg-zinc-800" />

          {/* Size Controls Premium - Grouped in Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800/50 rounded-lg transition-colors group">
                <Monitor className="w-3.5 h-3.5 text-zinc-500 group-hover:text-red-500 transition-colors" />
                <span className="text-[11px] font-medium text-zinc-300">
                  {config.width} × {config.height}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[280px] bg-zinc-900/95 backdrop-blur-xl border-zinc-800 rounded-xl p-4 shadow-2xl">
              <DropdownMenuLabel className="text-[10px] font-semibold text-zinc-400 px-0 pb-3">Dimensões da Oferta</DropdownMenuLabel>
              
              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1">
                  <label className="text-[10px] font-medium text-zinc-500 mb-1.5 block">Largura</label>
                  <SizeInput value={config.width} onCommit={w => updateConfig({ width: w })} />
                </div>
                <div className="pt-5 text-zinc-600 text-xs font-medium">×</div>
                <div className="flex-1">
                  <label className="text-[10px] font-medium text-zinc-500 mb-1.5 block">Altura</label>
                  <SizeInput value={config.height} onCommit={h => updateConfig({ height: h })} />
                </div>
              </div>

              <div className="space-y-3">
                <span className="text-[10px] font-medium text-zinc-500 block">Formatos</span>
                <div className="grid grid-cols-2 gap-2">
                  {PRESETS.map(p => (
                    <button
                      key={p.label}
                      onClick={() => updateConfig({ width: p.w, height: p.h })}
                      className={`py-2 rounded-lg text-[10px] font-semibold border transition-all ${
                        config.width === p.w && config.height === p.h 
                          ? 'bg-red-500/10 border-red-500/50 text-red-500' 
                          : 'bg-zinc-800/50 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Modern Stepper */}
      <div className="px-6 py-3 bg-zinc-950 border-b border-zinc-900 flex items-center justify-center gap-2 shrink-0">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.num}>
            <button 
              onClick={() => setStep(s.num)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-medium transition-all ${
                step === s.num 
                  ? 'bg-red-600 text-white shadow-md shadow-red-900/20' 
                  : step > s.num 
                    ? 'text-zinc-300 hover:bg-zinc-900' 
                    : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-400'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] transition-colors ${
                step === s.num ? 'bg-white/20' : step > s.num ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-800/50'
              }`}>
                {step > s.num ? '✓' : s.num}
              </span>
              <span>{s.label}</span>
            </button>
            {i < STEPS.length - 1 && <div className={`w-8 h-[1px] ${step > s.num ? 'bg-zinc-700' : 'bg-zinc-800'}`} />}
          </React.Fragment>
        ))}
      </div>

      <main className="flex-1 overflow-hidden relative bg-zinc-950">
        {step === 1 && <StepBackground />}
        {step === 2 && <StepSlots />}
        {step === 3 && <StepPriceBadge />}
        {step === 4 && <StepReview />}
        {step === 5 && <StepFinal />}
      </main>

      {/* Footer minimalista */}
      <footer className="px-6 py-4 bg-zinc-950 border-t border-zinc-900 flex items-center justify-between z-20">
        <div className="text-[11px] text-zinc-500 font-medium">
          Etapa Atual: <span className="text-zinc-300">{STEPS.find(s => s.num === step)?.label}</span>
        </div>
        <div className="flex gap-2">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} className="h-9 px-4 bg-transparent border-zinc-800 text-zinc-400 rounded-lg text-[11px] font-medium hover:bg-zinc-900 hover:text-zinc-200 transition-all">
              <ChevronLeft className="w-3.5 h-3.5 mr-1.5" /> Anterior
            </Button>
          )}
          {step < 5 && (
            <Button onClick={() => setStep(step + 1)} className="h-9 px-5 bg-zinc-100 hover:bg-white text-zinc-900 rounded-lg text-[11px] font-semibold transition-all shadow-sm">
              Próximo Passo <ChevronRight className="w-3.5 h-3.5 ml-1.5" />
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
