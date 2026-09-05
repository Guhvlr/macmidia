import React from 'react';
import { useOffer } from '../context/OfferContext';
import { Layers, Plus, Minus } from 'lucide-react';

export const StepPages = () => {
  const { slots, pageCount, setPageCount } = useOffer();
  const totalSlots = slots.length * pageCount;

  return (
    <div className="h-full flex items-center justify-center bg-black/40">
      <div className="bg-[#121214] rounded-3xl border border-white/10 shadow-2xl p-10 max-w-lg w-full space-y-8">
        <div className="text-center">
          <h2 className="text-xl font-black uppercase tracking-widest text-white mb-2">Etapa 3</h2>
          <p className="text-[11px] text-white/40 font-bold uppercase tracking-wider">Quantas telas serão geradas?</p>
        </div>

        <div className="flex items-center justify-center gap-6">
          <button onClick={() => setPageCount(Math.max(1, pageCount - 1))}
            className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all">
            <Minus className="w-6 h-6 text-white/50" />
          </button>
          <div className="text-center">
            <div className="text-6xl font-black text-white tracking-tighter">{pageCount}</div>
            <div className="text-[10px] text-white/30 font-bold uppercase mt-1">tela{pageCount > 1 ? 's' : ''}</div>
          </div>
          <button onClick={() => setPageCount(pageCount + 1)}
            className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all">
            <Plus className="w-6 h-6 text-white/50" />
          </button>
        </div>

        <div className="bg-white/5 rounded-2xl p-6 space-y-3 border border-white/5">
          <div className="flex items-center gap-3">
            <Layers className="w-5 h-5 text-primary" />
            <span className="text-sm font-bold text-white">Resumo</span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-black text-white">{slots.length}</div>
              <div className="text-[9px] text-white/30 font-bold uppercase">slots/tela</div>
            </div>
            <div>
              <div className="text-2xl font-black text-white">{pageCount}</div>
              <div className="text-[9px] text-white/30 font-bold uppercase">telas</div>
            </div>
            <div>
              <div className="text-2xl font-black text-primary">{totalSlots}</div>
              <div className="text-[9px] text-white/30 font-bold uppercase">produtos total</div>
            </div>
          </div>
          <p className="text-[10px] text-white/25 text-center pt-2">
            A mesma grade de {slots.length} slot{slots.length !== 1 ? 's' : ''} será repetida em cada tela.
            Os produtos serão distribuídos automaticamente.
          </p>
        </div>
      </div>
    </div>
  );
};
