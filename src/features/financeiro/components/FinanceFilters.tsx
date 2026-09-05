import React from 'react';
import { FinanceFilters as FilterType, FinanceCategory } from '../types/finance-types';
import { Search, X } from 'lucide-react';

interface FinanceFiltersProps {
  filters: FilterType;
  setFilters: React.Dispatch<React.SetStateAction<FilterType>>;
  categories: FinanceCategory[];
}

export function FinanceFilters({ filters, setFilters, categories }: FinanceFiltersProps) {
  const activeFilterCount = Object.values(filters).filter(v => v !== undefined && v !== '').length;

  const clearFilters = () => setFilters({});

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input 
          type="text" 
          placeholder="Buscar descrição ou cliente..." 
          value={filters.search || ''}
          onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-red-500 placeholder:text-zinc-600"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select 
          value={filters.category || ''}
          onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value || undefined }))}
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-red-500 min-w-[140px]"
        >
          <option value="">Todas Categorias</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select 
          value={filters.status || ''}
          onChange={(e) => setFilters(prev => ({ ...prev, status: (e.target.value as any) || undefined }))}
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-red-500 min-w-[130px]"
        >
          <option value="">Todos Status</option>
          <option value="previsto">Previsto</option>
          <option value="pago">Pago</option>
          <option value="atrasado">Atrasado</option>
          <option value="cancelado">Cancelado</option>
        </select>

        <select 
          value={filters.paymentMethod || ''}
          onChange={(e) => setFilters(prev => ({ ...prev, paymentMethod: (e.target.value as any) || undefined }))}
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-red-500 min-w-[150px]"
        >
          <option value="">Formas de Pagamento</option>
          <option value="pix">PIX</option>
          <option value="boleto">Boleto</option>
          <option value="cartao">Cartão</option>
          <option value="transferencia">Transferência</option>
          <option value="dinheiro">Dinheiro</option>
        </select>
      </div>

      {activeFilterCount > 0 && (
        <button 
          onClick={clearFilters}
          className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800/80 hover:bg-zinc-800 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <X className="w-3.5 h-3.5" /> Limpar filtros
        </button>
      )}
    </div>
  );
}
