import React from 'react';
import { AlertTriangle, Trash2, X, AlertCircle } from 'lucide-react';
import { FinanceEntry } from '../types/finance-types';

interface FinanceDeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void; // Delete simple or this specific one
  onConfirmFuture?: () => void; // Delete this and future
  entry?: FinanceEntry | null;
  title?: string;
  description?: string;
  confirmText?: string;
}

export function FinanceDeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  onConfirmFuture,
  entry,
  title = 'Excluir Lançamento',
  description = 'Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita.',
  confirmText = 'Sim, Excluir'
}: FinanceDeleteConfirmModalProps) {
  if (!isOpen) return null;

  const isInstallment = !!entry?.installment_group_id;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200" 
      onClick={onClose}
    >
      <div 
        className="bg-zinc-950 border border-zinc-800/90 rounded-2xl shadow-2xl w-full max-w-md p-6 text-zinc-100 animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shadow-inner">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <h3 className="text-lg font-bold text-zinc-100 mb-2">{title}</h3>
        
        {isInstallment ? (
          <div className="mb-6 space-y-3">
            <p className="text-sm text-zinc-400 leading-relaxed">
              Este lançamento faz parte de um grupo parcelado (Parcela {entry.installment_number}/{entry.installment_total}). Como você deseja prosseguir?
            </p>
            <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-200/80">
                Lançamentos anteriores ou já pagos não serão afetados por essa ação.
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-400 leading-relaxed mb-6">
            {description}
          </p>
        )}

        {isInstallment ? (
          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                onConfirmFuture?.();
                onClose();
              }}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-950/50 transition-all hover:scale-[1.02] w-full"
            >
              <Trash2 className="w-4 h-4" />
              Excluir esta e todas as próximas
            </button>
            <button
              type="button"
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all w-full"
            >
              Excluir somente esta parcela
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors mt-1"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-950/50 transition-all hover:scale-[1.02]"
            >
              <Trash2 className="w-4 h-4" />
              {confirmText}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
