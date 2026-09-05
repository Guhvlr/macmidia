import React, { useState } from 'react';
import { FinanceCategory } from '../types/finance-types';
import { X, Trash2, Edit2, Plus } from 'lucide-react';

interface FinanceCategoryManagerProps {
  isOpen: boolean;
  onClose: () => void;
  categories: FinanceCategory[];
  onSaveCategory: (category: { id?: string; name: string; type: string; color: string }) => void;
  onDeleteCategory: (id: string) => void;
}

const colors = [
  '#ef4444', '#f97316', '#f59e0b', '#22c55e', 
  '#10b981', '#14b8a6', '#06b6d4', '#3b82f6', 
  '#6366f1', '#8b5cf6', '#a855f7', '#ec4899'
];

export function FinanceCategoryManager({
  isOpen,
  onClose,
  categories,
  onSaveCategory,
  onDeleteCategory
}: FinanceCategoryManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{ name: string; type: string; color: string }>({
    name: '',
    type: 'saida',
    color: '#3b82f6',
  });

  if (!isOpen) return null;

  const handleStartAdd = () => {
    setFormData({ name: '', type: 'saida', color: '#3b82f6' });
    setEditingId(null);
    setIsAdding(true);
  };

  const handleStartEdit = (category: FinanceCategory) => {
    setFormData({ name: category.name, type: category.type, color: category.color });
    setEditingId(category.id);
    setIsAdding(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    onSaveCategory({
      id: editingId || undefined,
      ...formData
    });
    setIsAdding(false);
    setEditingId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-6 border-b border-zinc-800">
          <h2 className="text-xl font-semibold text-zinc-100">Gerenciar Categorias</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {!isAdding && (
            <button
              onClick={handleStartAdd}
              className="w-full flex items-center justify-center gap-2 bg-zinc-900 border border-zinc-800 border-dashed hover:border-zinc-700 hover:bg-zinc-800/50 text-zinc-300 py-3 rounded-lg text-sm font-medium transition-colors mb-6"
            >
              <Plus className="w-4 h-4" /> Nova Categoria
            </button>
          )}

          {isAdding && (
            <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-zinc-400">Nome da Categoria</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-red-500"
                  placeholder="Ex: Cartão de Crédito"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-zinc-400">Tipo</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-red-500"
                >
                  <option value="saida">Saída (Despesa)</option>
                  <option value="entrada">Entrada (Receita)</option>
                  <option value="ambos">Ambos</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-zinc-400">Cor</label>
                <div className="flex flex-wrap gap-2">
                  {colors.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, color: c }))}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${formData.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-medium bg-red-600 hover:bg-red-700 text-white"
                >
                  Salvar
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {categories.map(category => (
              <div key={category.id} className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg border border-zinc-800/50 hover:bg-zinc-900 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: category.color }} />
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{category.name}</p>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{category.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!category.is_default && (
                    <>
                      <button onClick={() => handleStartEdit(category)} className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => onDeleteCategory(category.id)} className="p-1.5 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  {category.is_default && (
                    <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-1 rounded">Padrão</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
