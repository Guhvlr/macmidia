import React from 'react';
import { FinanceEntry } from '../types/finance-types';
import { Repeat, Edit2, Trash2, Copy, Plus, CheckCircle2, Circle, AlertCircle, X, CheckSquare } from 'lucide-react';

interface Props {
  entries: FinanceEntry[];
  onEdit: (entry: FinanceEntry) => void;
  onDelete: (entry: FinanceEntry) => void;
  onDuplicate: (id: string) => void;
  onToggleStatus: (entry: FinanceEntry) => void;
  onAdd: () => void;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onBulkMarkPaid?: () => void;
  onBulkMarkPending?: () => void;
  onBulkDelete?: () => void;
  onClearSelection?: () => void;
}

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export function FinanceTable({ 
  entries, 
  onEdit, 
  onDelete, 
  onDuplicate, 
  onToggleStatus, 
  onAdd, 
  selectedIds, 
  onToggleSelect, 
  onToggleSelectAll,
  onBulkMarkPaid,
  onBulkMarkPending,
  onBulkDelete,
  onClearSelection
}: Props) {
  if (entries.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 mb-3">
          <Repeat className="w-6 h-6" />
        </div>
        <p className="text-zinc-400 font-medium mb-1">Nenhum lançamento encontrado neste mês</p>
        <p className="text-zinc-600 text-xs mb-5">Adicione uma receita (ex: salário) ou uma despesa para começar.</p>
        <button onClick={onAdd} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-lg shadow-red-950/40">
          <Plus className="w-4 h-4" /> Novo Lançamento
        </button>
      </div>
    );
  }

  const allSelected = entries.length > 0 && selectedIds.length === entries.length;

  return (
    <div className="relative">
      {/* Barra Flutuante de Ações em Massa (Quando houver itens selecionados nos checkboxes) */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-zinc-950/95 border border-zinc-700/80 backdrop-blur-xl px-5 py-3 rounded-2xl shadow-2xl flex flex-wrap items-center gap-3 text-xs animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center gap-2 text-zinc-200 font-semibold pr-2 border-r border-zinc-800">
            <CheckSquare className="w-4 h-4 text-red-500" />
            <span>{selectedIds.length} selecionado(s)</span>
          </div>

          <button 
            type="button" 
            onClick={onBulkMarkPaid} 
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 transition-all font-medium"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Marcar Pago ({selectedIds.length})
          </button>

          <button 
            type="button" 
            onClick={onBulkMarkPending} 
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700 transition-all font-medium"
          >
            <Circle className="w-3.5 h-3.5 text-zinc-400" /> Marcar Previsto
          </button>

          <button 
            type="button" 
            onClick={onBulkDelete} 
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30 transition-all font-medium"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400" /> Excluir ({selectedIds.length})
          </button>

          <button 
            type="button" 
            onClick={onClearSelection} 
            title="Desmarcar todos"
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors ml-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-x-auto shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-400 text-[11px] uppercase tracking-wider bg-zinc-950/50">
              <th className="p-3.5 w-10">
                <input 
                  type="checkbox" 
                  checked={allSelected} 
                  onChange={onToggleSelectAll} 
                  className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-red-600 focus:ring-red-500 cursor-pointer" 
                />
              </th>
              <th className="p-3.5 w-28 text-center">Status / Pago</th>
              <th className="p-3.5">Descrição</th>
              <th className="p-3.5">Vencimento</th>
              <th className="p-3.5">Valor (R$)</th>
              <th className="p-3.5">Categoria</th>
              <th className="p-3.5">Forma Pagamento</th>
              <th className="p-3.5">Pessoa / Cliente</th>
              <th className="p-3.5 w-24 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-zinc-800/60">
            {entries.map(e => {
              const isPaid = e.status === 'pago';
              const isLate = e.status === 'atrasado';
              const isCanceled = e.status === 'cancelado';
              
              const rowHighlight = isPaid 
                ? 'bg-emerald-950/20 hover:bg-emerald-950/30' 
                : isLate 
                  ? 'bg-red-950/20 hover:bg-red-950/30'
                  : selectedIds.includes(e.id)
                    ? 'bg-red-950/15 hover:bg-red-950/25'
                    : 'hover:bg-zinc-800/40';

              return (
                <tr 
                  key={e.id} 
                  className={`transition-colors cursor-pointer ${rowHighlight}`} 
                  onClick={() => onEdit(e)}
                >
                  {/* Checkbox de Seleção */}
                  <td className="p-3.5" onClick={ev => ev.stopPropagation()}>
                    <input 
                      type="checkbox" 
                      checked={selectedIds.includes(e.id)} 
                      onChange={() => onToggleSelect(e.id)} 
                      className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-red-600 focus:ring-red-500 cursor-pointer" 
                    />
                  </td>

                  {/* Botão de 1 Clique: Marcar Pago / Pendente */}
                  <td className="p-3.5 text-center" onClick={ev => ev.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => onToggleStatus(e)}
                      title={isPaid ? 'Clique para marcar como Previsto' : 'Clique para marcar como Pago'}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all shadow-sm ${
                        isPaid
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30'
                          : isLate
                            ? 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30'
                            : isCanceled
                              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40 hover:bg-purple-500/30'
                              : 'bg-zinc-800 text-zinc-400 border border-zinc-700/80 hover:bg-zinc-700 hover:text-zinc-200'
                      }`}
                    >
                      {isPaid ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>{e.type === 'entrada' ? 'Recebido' : 'Pago'}</span>
                        </>
                      ) : isLate ? (
                        <>
                          <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                          <span>Atrasado</span>
                        </>
                      ) : (
                        <>
                          <Circle className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                          <span>Previsto</span>
                        </>
                      )}
                    </button>
                  </td>

                  {/* Descrição */}
                  <td className="p-3.5">
                    <div className="flex items-center gap-2">
                      {e.is_recurring && (
                        <span title="Lançamento Recorrente">
                          <Repeat className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        </span>
                      )}
                      <span className={`font-medium ${isPaid ? 'text-zinc-100' : 'text-zinc-200'}`}>
                        {e.description}
                      </span>
                    </div>
                  </td>

                  {/* Data */}
                  <td className="p-3.5 text-zinc-400 text-xs whitespace-nowrap">
                    {new Date(e.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </td>

                  {/* Valor */}
                  <td className={`p-3.5 font-bold whitespace-nowrap ${e.type === 'entrada' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {e.type === 'entrada' ? '+' : '-'}{fmt(e.amount)}
                  </td>

                  {/* Categoria */}
                  <td className="p-3.5">
                    {e.category ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-950/40 border border-zinc-800/80">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: e.category.color }} />
                        <span className="text-zinc-300 text-xs font-medium">{e.category.name}</span>
                      </span>
                    ) : (
                      <span className="text-zinc-600 text-xs">Sem categoria</span>
                    )}
                  </td>

                  {/* Forma de Pagamento */}
                  <td className="p-3.5 text-zinc-400 text-xs capitalize">
                    {e.payment_method || '-'}
                  </td>

                  {/* Cliente / Fornecedor */}
                  <td className="p-3.5 text-zinc-400 text-xs">
                    {e.client_name || '-'}
                  </td>

                  {/* Ações */}
                  <td className="p-3.5 text-right" onClick={ev => ev.stopPropagation()}>
                    <div className="flex gap-1 justify-end items-center">
                      <button 
                        onClick={() => onDuplicate(e.id)} 
                        title="Duplicar lançamento"
                        className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => onEdit(e)} 
                        title="Editar"
                        className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => onDelete(e)} 
                        title="Excluir"
                        className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
