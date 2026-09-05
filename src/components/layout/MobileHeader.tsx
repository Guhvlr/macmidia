import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Wallet, ChevronRight, Sparkles } from 'lucide-react';
import { useApp } from '@/contexts/useApp';

export function MobileHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loggedUserName } = useApp();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Exibe o modal de escolha rápida somente na primeira vez que abre o app no celular no dia
    const hasChosen = sessionStorage.getItem('mobile_destination_chosen');
    if (!hasChosen && (location.pathname === '/' || location.pathname === '/login')) {
      setShowModal(true);
    }
  }, [location.pathname]);

  const handleChoose = (path: string) => {
    sessionStorage.setItem('mobile_destination_chosen', path);
    setShowModal(false);
    navigate(path);
  };

  const isDashboard = location.pathname === '/';
  const isFinanceiro = location.pathname === '/financeiro';

  return (
    <>
      {/* Barra de Navegação Rápida no Topo (Apenas Celular md:hidden) */}
      <div className="md:hidden sticky top-0 z-40 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/80 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent uppercase tracking-wider">
            Mac Mídia
          </span>
        </div>

        {/* Switcher de 1 toque entre Dashboard e Financeiro */}
        <div className="flex bg-zinc-900/90 p-1 rounded-xl border border-zinc-800">
          <button
            onClick={() => handleChoose('/')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              isDashboard 
                ? 'bg-red-600 text-white shadow-sm' 
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            Dashboard
          </button>

          <button
            onClick={() => handleChoose('/financeiro')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              isFinanceiro 
                ? 'bg-red-600 text-white shadow-sm' 
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            Financeiro
          </button>
        </div>
      </div>

      {/* Modal de Escolha Inicial ao Entrar no Celular (Apenas Celular md:hidden) */}
      {showModal && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl text-center animate-in slide-in-from-bottom duration-300">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-red-600 to-red-500 text-white flex items-center justify-center mx-auto mb-3 shadow-lg shadow-red-950/50">
              <Sparkles className="w-6 h-6" />
            </div>

            <h2 className="text-lg font-bold text-zinc-100 mb-1">
              {loggedUserName ? `Olá, ${loggedUserName.split(' ')[0]}!` : 'Bem-vindo!'}
            </h2>
            <p className="text-xs text-zinc-400 mb-6">
              Para onde você deseja ir neste momento?
            </p>

            <div className="space-y-3">
              <button
                onClick={() => handleChoose('/')}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 hover:border-zinc-700 active:scale-[0.98] transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20">
                    <LayoutDashboard className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-100">Dashboard Geral</h3>
                    <p className="text-[11px] text-zinc-500">Kanban de mídias e tarefas da equipe</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-zinc-300 transition-colors" />
              </button>

              <button
                onClick={() => handleChoose('/financeiro')}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-red-950/40 to-zinc-900/90 border border-red-900/30 hover:border-red-500/40 active:scale-[0.98] transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-red-600 text-white shadow-md shadow-red-950/50">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-100">Módulo Financeiro</h3>
                    <p className="text-[11px] text-zinc-400">Contas, entradas e Assistente IA</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-red-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

            <button
              onClick={() => {
                sessionStorage.setItem('mobile_destination_chosen', '/');
                setShowModal(false);
              }}
              className="mt-5 text-xs text-zinc-500 hover:text-zinc-300 underline"
            >
              Fechar e continuar no Dashboard
            </button>
          </div>
        </div>
      )}
    </>
  );
}
