import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, Check } from 'lucide-react';
import { FinanceMonthlySummary } from '../types/finance-types';

interface FinanceSummaryCardsProps {
  summary: FinanceMonthlySummary;
  selectedTypeFilter?: 'entrada' | 'saida' | 'todos';
  onSelectTypeFilter?: (type: 'entrada' | 'saida' | 'todos') => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export function FinanceSummaryCards({ summary, selectedTypeFilter = 'todos', onSelectTypeFilter }: FinanceSummaryCardsProps) {
  const isEntradaActive = selectedTypeFilter === 'entrada';
  const isSaidaActive = selectedTypeFilter === 'saida';
  const isTodosActive = selectedTypeFilter === 'todos' || !selectedTypeFilter;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {/* Card Entradas */}
      <div 
        onClick={() => onSelectTypeFilter?.(isEntradaActive ? 'todos' : 'entrada')}
        className={`bg-zinc-900 rounded-xl p-4 flex flex-col justify-between cursor-pointer transition-all border ${
          isEntradaActive 
            ? 'border-green-500 ring-2 ring-green-500/20 bg-green-950/20 shadow-lg shadow-green-950/50 scale-[1.01]' 
            : 'border-zinc-800 hover:border-green-500/50 hover:bg-zinc-850'
        }`}
      >
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <span className="text-zinc-400 text-sm font-medium">Entradas do mês</span>
            {isEntradaActive && (
              <span className="text-[10px] bg-green-500/20 text-green-400 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 border border-green-500/30">
                <Check className="w-3 h-3" /> Filtrado
              </span>
            )}
          </div>
          <div className="bg-green-500/10 p-2 rounded-lg"><TrendingUp className="w-5 h-5 text-green-500" /></div>
        </div>
        <div>
          <div className="text-2xl font-bold text-green-500">{formatCurrency(summary.totalEntradas)}</div>
          <div className="text-xs text-zinc-500 mt-1 flex justify-between items-center">
            <span>Recebidas: <strong className="text-green-400 font-semibold">{formatCurrency(summary.entradasRecebidas)}</strong></span>
            <span className="text-[10px] text-zinc-500 underline">Clique para filtrar</span>
          </div>
        </div>
      </div>

      {/* Card Saídas */}
      <div 
        onClick={() => onSelectTypeFilter?.(isSaidaActive ? 'todos' : 'saida')}
        className={`bg-zinc-900 rounded-xl p-4 flex flex-col justify-between cursor-pointer transition-all border ${
          isSaidaActive 
            ? 'border-red-500 ring-2 ring-red-500/20 bg-red-950/20 shadow-lg shadow-red-950/50 scale-[1.01]' 
            : 'border-red-900/30 hover:border-red-500/50 hover:bg-zinc-850'
        }`}
      >
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <span className="text-zinc-400 text-sm font-medium">Saídas do mês</span>
            {isSaidaActive && (
              <span className="text-[10px] bg-red-500/20 text-red-400 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 border border-red-500/30">
                <Check className="w-3 h-3" /> Filtrado
              </span>
            )}
          </div>
          <div className="bg-red-500/10 p-2 rounded-lg"><TrendingDown className="w-5 h-5 text-red-500" /></div>
        </div>
        <div>
          <div className="text-2xl font-bold text-red-500">{formatCurrency(summary.totalSaidas)}</div>
          <div className="text-xs text-zinc-500 mt-1 flex justify-between items-center">
            <span>Pagas: <strong className="text-red-400 font-semibold">{formatCurrency(summary.saidasPagas)}</strong></span>
            <span className="text-[10px] text-zinc-500 underline">Clique para filtrar</span>
          </div>
        </div>
      </div>

      {/* Card Saldo / Mostrar Todos */}
      <div 
        onClick={() => onSelectTypeFilter?.('todos')}
        className={`bg-zinc-900 rounded-xl p-4 flex flex-col justify-between cursor-pointer transition-all border ${
          isTodosActive && (selectedTypeFilter === 'todos')
            ? 'border-zinc-700 bg-zinc-800/40' 
            : 'border-zinc-800 hover:border-zinc-700'
        }`}
      >
        <div className="flex justify-between items-center mb-2">
          <span className="text-zinc-400 text-sm font-medium">Resultado (Saldo)</span>
          <div className="bg-zinc-800 p-2 rounded-lg"><DollarSign className="w-5 h-5 text-zinc-300" /></div>
        </div>
        <div>
          <div className={`text-2xl font-bold ${summary.saldo >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatCurrency(summary.saldo)}</div>
          <div className="text-xs text-zinc-500 mt-1 flex justify-between items-center">
            <span>{summary.saldo >= 0 ? 'Saldo positivo' : 'Saldo negativo'}</span>
            <span className="text-[10px] text-zinc-500 underline">Mostrar todos</span>
          </div>
        </div>
      </div>
    </div>
  );
}
