import React, { useState, useEffect } from 'react';
import { OfferProvider, useOffer } from '../context/OfferContext';
import { StepBackground } from '../components/StepBackground';
import { StepSlots } from '../components/StepSlots';
import { StepPages } from '../components/StepPages';
import { StepPriceBadge } from '../components/StepPriceBadge';
import { StepReview } from '../components/StepReview';
import { StepFinal } from '../components/StepFinal';
import { ChevronLeft, ChevronRight, Zap, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

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
    <input
      type="text"
      value={local}
      onChange={e => setLocal(e.target.value)}
      onBlur={apply}
      onKeyDown={e => { if (e.key === 'Enter') apply(); }}
      className="w-14 bg-transparent text-center text-[11px] font-bold text-white border-none focus:ring-0 p-0 focus:outline-none"
    />
  );
};

const OfferStudioInner = () => {
  const navigate = useNavigate();
  const { step, setStep, config, updateConfig } = useOffer();

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col h-screen overflow-hidden">
      <header className="px-5 py-3 border-b border-white/5 bg-[#0d0d10] shrink-0 flex items-center justify-between z-20">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-xl bg-white/5 h-9 w-9">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-lg font-black tracking-tighter flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-500" /> Offer Studio
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Monitor className="w-3.5 h-3.5 text-white/25" />
          <div className="flex items-center gap-1 bg-white/5 rounded-lg px-2.5 py-1 border border-white/10">
            <SizeInput value={config.width} onCommit={w => updateConfig({ width: w })} />
            <span className="text-white/20 text-[10px]">×</span>
            <SizeInput value={config.height} onCommit={h => updateConfig({ height: h })} />
          </div>
          {PRESETS.map(p => (
            <button key={p.label} onClick={() => updateConfig({ width: p.w, height: p.h })}
              className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase border transition-all ${config.width === p.w && config.height === p.h ? 'bg-primary/20 border-primary/40 text-primary' : 'bg-white/5 border-white/10 text-white/30 hover:text-white/60'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </header>

      <div className="px-5 py-3 bg-[#0d0d10] border-b border-white/5 flex items-center gap-1 shrink-0">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.num}>
            <button onClick={() => setStep(s.num)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${
                step === s.num ? 'bg-primary text-white shadow-lg shadow-primary/20'
                : step > s.num ? 'bg-green-500/15 text-green-400 border border-green-500/20'
                : 'bg-white/5 text-white/30 border border-white/5'
              }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black ${step === s.num ? 'bg-white/20' : step > s.num ? 'bg-green-500/30' : 'bg-white/10'}`}>
                {step > s.num ? '✓' : s.num}
              </span>
              {s.label}
            </button>
            {i < STEPS.length - 1 && <div className={`w-4 h-px ${step > s.num ? 'bg-green-500/40' : 'bg-white/10'}`} />}
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
