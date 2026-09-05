import React, { useState, useEffect } from 'react';
import { FinanceEntry, FinanceCategory, FinanceEntryType } from '../types/finance-types';
import { getFifthBusinessDay } from '../utils/business-days';
import { X, Calendar, DollarSign, Sparkles } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: Partial<FinanceEntry> & { is_salary_fifth_day?: boolean; is_installment?: boolean }) => void;
  entry?: FinanceEntry | null;
  categories: FinanceCategory[];
  defaultType?: FinanceEntryType;
}

export function FinanceEntryModal({ isOpen, onClose, onSave, entry, categories, defaultType = 'saida' }: Props) {
  const [form, setForm] = useState<Partial<FinanceEntry>>({
    type: defaultType,
    description: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    category_id: '',
    status: 'previsto',
    payment_method: '',
    client_name: '',
    notes: '',
    is_recurring: false,
    recurring_months: 1,
  });

  const [isSalaryFifthDay, setIsSalaryFifthDay] = useState(false);
  const [isInstallment, setIsInstallment] = useState(false);
  const [propagateFuture, setPropagateFuture] = useState(true);

  useEffect(() => {
    if (entry) {
      setForm({ ...entry });
      setIsSalaryFifthDay(false);
      setIsInstallment(false);
    } else {
      const today = new Date();
      setForm({
        type: defaultType,
        description: '',
        amount: 0,
        date: today.toISOString().split('T')[0],
        category_id: '',
        status: 'previsto',
        payment_method: '',
        client_name: '',
        notes: '',
        is_recurring: false,
        recurring_months: 12,
      });
      setIsSalaryFifthDay(false);
      setIsInstallment(false);
    }
  }, [entry, defaultType, isOpen]);

  if (!isOpen) return null;

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));
  const filteredCats = categories.filter(c => c.type === form.type || c.type === 'ambos');

  // Ativa modo Salário no 5º dia útil
  const handleApplySalary = () => {
    const today = new Date();
    const fifthDay = getFifthBusinessDay(today.getFullYear(), today.getMonth() + 1);
    
    // Procura se tem categoria 'Salário'
    const salCat = categories.find(c => c.name.toLowerCase().includes('salário') || c.name.toLowerCase().includes('salario'));

    setForm(prev => ({
      ...prev,
      type: 'entrada',
      description: prev.description || 'Salário Mensal',
      date: fifthDay,
      category_id: salCat ? salCat.id : prev.category_id,
      payment_method: prev.payment_method || 'transferencia',
      is_recurring: true,
      recurring_months: 12
    }));
    setIsSalaryFifthDay(true);
    setIsInstallment(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...form,
      is_salary_fifth_day: isSalaryFifthDay,
      is_installment: isInstallment,
      propagate_future: propagateFuture,
    });
    onClose();
  };

  const isGrouped = !!entry?.installment_group_id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="flex justify-between items-center p-5 border-b border-zinc-800 sticky top-0 bg-zinc-950 z-10">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${form.type === 'entrada' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">{entry ? 'Editar Lançamento' : 'Novo Lançamento'}</h2>
              <p className="text-xs text-zinc-400">{form.type === 'entrada' ? 'Adicionar receita ou ganho' : 'Adicionar conta ou despesa'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 p-1.5 hover:bg-zinc-900 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Banner de Informação de Parcela */}
          {isGrouped && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-amber-500 font-medium text-sm">
                <Calendar className="w-4 h-4" />
                Despesa Parcelada (Parcela {entry.installment_number} de {entry.installment_total})
              </div>
              <p className="text-xs text-amber-200/70">
                Você pode alterar a quantidade total de parcelas abaixo. Novas parcelas serão geradas ou parcelas futuras serão removidas conforme necessário.
              </p>
              <label className="flex items-center gap-2 text-sm text-zinc-200 cursor-pointer mt-2 bg-black/20 p-2 rounded-lg border border-black/40">
                <input 
                  type="checkbox" 
                  checked={propagateFuture} 
                  onChange={e => setPropagateFuture(e.target.checked)} 
                  className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-amber-600 focus:ring-amber-500" 
                /> 
                Aplicar alterações de valor/descrição nas próximas parcelas
              </label>
            </div>
          )}

          {/* Tipo Toggle + Atalho Salário */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="flex-1 flex bg-zinc-900 rounded-xl p-1 border border-zinc-800">
              <button 
                type="button" 
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${form.type === 'entrada' ? 'bg-green-500/20 text-green-400 font-semibold shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`} 
                onClick={() => { set('type', 'entrada'); setIsInstallment(false); }}
              >
                + Entrada (Receita)
              </button>
              <button 
                type="button" 
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${form.type === 'saida' ? 'bg-red-500/20 text-red-400 font-semibold shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`} 
                onClick={() => { set('type', 'saida'); setIsSalaryFifthDay(false); }}
              >
                - Saída (Despesa)
              </button>
            </div>

            {form.type === 'entrada' && !entry && (
              <button
                type="button"
                onClick={handleApplySalary}
                className={`flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium border transition-all ${
                  isSalaryFifthDay 
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm' 
                    : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-amber-500/50 hover:text-amber-400'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                💼 Salário (5º dia útil)
              </button>
            )}
          </div>

          {/* Form Inputs Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Descrição *</label>
              <input 
                required 
                value={form.description} 
                onChange={e => set('description', e.target.value)} 
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-red-500 placeholder:text-zinc-600" 
                placeholder={form.type === 'entrada' ? 'Ex: Salário, Freelance, Rendimento' : 'Ex: Aluguel, Cartão de Crédito, Luz'} 
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Valor (R$) *</label>
              <input 
                type="number" 
                required 
                step="0.01" 
                min="0" 
                value={form.amount || ''} 
                onChange={e => set('amount', parseFloat(e.target.value) || 0)} 
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-red-500" 
                placeholder="0,00" 
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-medium text-zinc-400">Data de Vencimento / Recebimento *</label>
                {isSalaryFifthDay && (
                  <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                    5º dia útil do mês
                  </span>
                )}
              </div>
              <input 
                type="date" 
                required 
                value={form.date} 
                onChange={e => { set('date', e.target.value); setIsSalaryFifthDay(false); }} 
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-red-500" 
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Categoria</label>
              <select 
                value={form.category_id || ''} 
                onChange={e => set('category_id', e.target.value)} 
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-red-500"
              >
                <option value="">Selecione uma categoria...</option>
                {filteredCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Status</label>
              <select 
                value={form.status} 
                onChange={e => set('status', e.target.value)} 
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-red-500"
              >
                <option value="previsto">⏳ Previsto (Pendente)</option>
                <option value="pago">{form.type === 'entrada' ? '✅ Recebido' : '✅ Pago'}</option>
                <option value="atrasado">⚠️ Atrasado</option>
                <option value="cancelado">❌ Cancelado</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Forma de Pagamento</label>
              <select 
                value={form.payment_method} 
                onChange={e => set('payment_method', e.target.value)} 
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-red-500"
              >
                <option value="">Selecione...</option>
                <option value="pix">PIX</option>
                <option value="boleto">Boleto</option>
                <option value="cartao">Cartão de Crédito</option>
                <option value="transferencia">Transferência Bancária</option>
                <option value="dinheiro">Dinheiro</option>
              </select>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-medium text-zinc-400">Pessoa / Fornecedor / Cliente (Opcional)</label>
              <input 
                value={form.client_name || ''} 
                onChange={e => set('client_name', e.target.value)} 
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-red-500 placeholder:text-zinc-600" 
                placeholder="Nome da pessoa, banco ou empresa" 
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-medium text-zinc-400">Observações (Opcional)</label>
              <textarea 
                value={form.notes || ''} 
                onChange={e => set('notes', e.target.value)} 
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-100 focus:outline-none focus:border-red-500 min-h-[60px] placeholder:text-zinc-600" 
                placeholder="Anotações adicionais..."
              />
            </div>

            {/* Configuração de Recorrência / Parcelas */}
            <div className="md:col-span-2 bg-zinc-900/60 p-4 rounded-xl border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2.5 text-sm text-zinc-200 cursor-pointer font-medium">
                  <input 
                    type="checkbox" 
                    checked={form.is_recurring} 
                    onChange={e => set('is_recurring', e.target.checked)} 
                    className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-red-600 focus:ring-red-500" 
                    disabled={isGrouped}
                  /> 
                  Lançamento Recorrente / Parcelado
                </label>

                {form.is_recurring && form.type === 'saida' && !isGrouped && (
                  <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={isInstallment} 
                      onChange={e => setIsInstallment(e.target.checked)} 
                      className="w-3.5 h-3.5 rounded border-zinc-700 bg-zinc-800 text-red-600"
                    />
                    Compra Parcelada (ex: 1/12, 2/12)
                  </label>
                )}
              </div>

              {(form.is_recurring || isGrouped) && (
                <div className="flex flex-wrap items-center gap-3 pt-2 text-sm text-zinc-400 border-t border-zinc-800/80">
                  <span>{isGrouped ? 'Total de parcelas:' : 'Repetir por'}</span>
                  <input 
                    type="number" 
                    min={isGrouped ? (entry?.installment_number || 2) : 2} 
                    max="60" 
                    value={form.recurring_months || 12} 
                    onChange={e => set('recurring_months', parseInt(e.target.value) || 2)} 
                    className="w-20 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-zinc-100 text-sm font-semibold text-center focus:outline-none focus:border-red-500" 
                  /> 
                  <span>{isGrouped ? 'meses' : `meses futuros ${isSalaryFifthDay ? '(calculando sempre o 5º dia útil de cada mês)' : ''}`}</span>
                </div>
              )}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="px-5 py-2.5 rounded-xl text-sm font-medium bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-950/40 transition-all"
            >
              {entry ? 'Salvar Alterações' : 'Criar Lançamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
