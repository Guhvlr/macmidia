import React from 'react';
import { Loader2, Sparkles } from 'lucide-react';

export const PageLoader = () => {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0a0a0c] overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/5 blur-[120px] rounded-full animate-pulse-slow" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-blue-500/5 blur-[100px] rounded-full animate-pulse-slow delay-1000" />
      
      {/* Skeleton Header Mockup (Subtle) */}
      <div className="absolute top-0 w-full h-16 border-b border-white/5 flex items-center px-8 justify-between opacity-20">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded bg-white/10" />
          <div className="w-32 h-4 rounded bg-white/10" />
        </div>
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-full bg-white/10" />
          <div className="w-24 h-4 rounded bg-white/10" />
        </div>
      </div>

      <div className="relative flex flex-col items-center space-y-8 animate-in fade-in zoom-in duration-700">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-110 animate-pulse" />
          <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-rose-700 p-[1px] shadow-2xl">
            <div className="w-full h-full rounded-2xl bg-[#0a0a0c] flex items-center justify-center">
              <Sparkles className="w-10 h-10 text-primary animate-pulse" />
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center space-y-3">
          <h2 className="text-sm font-black uppercase tracking-[0.4em] text-white/40 flex items-center gap-3">
            <span className="h-[1px] w-8 bg-gradient-to-r from-transparent to-white/10" />
            Mac Mídia
            <span className="h-[1px] w-8 bg-gradient-to-l from-transparent to-white/10" />
          </h2>
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/5">
            <Loader2 className="w-3 h-3 text-primary animate-spin" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary/80 animate-pulse">
              Iniciando Inteligência Operacional
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-48 h-[2px] bg-white/5 rounded-full overflow-hidden mt-4">
          <div className="h-full bg-gradient-to-r from-transparent via-primary to-transparent w-full animate-progress-loader origin-left" />
        </div>
      </div>
    </div>
  );
};

export default PageLoader;
