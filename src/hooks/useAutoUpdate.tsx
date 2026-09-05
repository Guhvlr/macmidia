import React, { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Rocket, RefreshCw } from 'lucide-react';

export function useAutoUpdate() {
  const currentScripts = useRef<Set<string>>(new Set());
  
  useEffect(() => {
    // Coleta os scripts atuais que a página está usando
    const scripts = document.querySelectorAll('script[src]');
    scripts.forEach(script => {
      const src = script.getAttribute('src');
      if (src && src.includes('/assets/')) {
        currentScripts.current.add(src);
      }
    });

    // Se estiver rodando localmente (dev), não precisamos verificar versão via fetch HTML
    if (import.meta.env.DEV) {
      return;
    }

    const checkForUpdates = async () => {
      try {
        const timestamp = new Date().getTime();
        // Faz o fetch do index.html ignorando o cache do navegador
        const res = await fetch(`/?t=${timestamp}`, { cache: 'no-store' });
        const html = await res.text();
        
        // Procura pelos scripts que o Vercel acabou de gerar na build
        const scriptRegex = /<script\s+[^>]*src=["'](\/assets\/[^"']+)["'][^>]*>/gi;
        let match;
        let hasNewScripts = false;
        
        while ((match = scriptRegex.exec(html)) !== null) {
          const src = match[1];
          // Se encontrou um script diferente do que estamos usando, houve deploy!
          if (!currentScripts.current.has(src)) {
            hasNewScripts = true;
            break;
          }
        }

        if (hasNewScripts) {
          toast.custom((t) => (
            <div className="w-[360px] md:w-[420px] bg-[#121214] border border-[#29292e] p-5 rounded-2xl shadow-2xl flex flex-col gap-4 relative overflow-hidden font-sans">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-orange-500 to-red-500" />
              
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0 border border-red-500/20">
                  <Rocket className="w-5 h-5 text-red-500 animate-pulse" />
                </div>
                
                <div className="flex-1 pt-0.5">
                  <h3 className="text-[15px] font-bold text-zinc-100 mb-1.5 tracking-tight">
                    Sistema Atualizado!
                  </h3>
                  <p className="text-[13px] text-zinc-400 leading-relaxed">
                    Lançamos novidades e melhorias de performance. Atualize sua tela para carregar a versão mais recente.
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end mt-1">
                <button
                  onClick={() => { toast.dismiss(t); window.location.reload(); }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-zinc-200 text-black rounded-xl text-[13px] font-bold transition-all shadow-md active:scale-95"
                >
                  <RefreshCw className="w-4 h-4" />
                  Atualizar Agora
                </button>
              </div>
            </div>
          ), {
            duration: Infinity,
            position: 'top-center',
          });

          // Para de checar pois já encontramos uma atualização
          clearInterval(intervalId);
        }
      } catch (err) {
        console.error('Erro ao verificar atualizações silenciosas:', err);
      }
    };

    // Verifica a cada 5 minutos
    const intervalId = setInterval(checkForUpdates, 5 * 60 * 1000);
    
    // Verifica imediatamente sempre que o usuário voltar para a aba do sistema
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
}
