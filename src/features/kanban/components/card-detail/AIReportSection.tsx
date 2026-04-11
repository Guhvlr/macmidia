import React, { memo } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Bot, Loader2 } from 'lucide-react';
import type { KanbanCard as KanbanCardType } from '@/contexts/app-types';

interface AIReportSectionProps {
  card: KanbanCardType;
}

export const AIReportSection = memo(({ card }: AIReportSectionProps) => {
  const { aiStatus, aiReport } = card;

  // Não exibe nada se nunca foi auditado
  if (!aiStatus && !aiReport) return null;

  // Exibindo estado de análise em andamento
  if (aiStatus === 'analyzing') {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center gap-3 mb-3">
          <Bot className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-black uppercase tracking-widest text-white/60">Relatório da IA Auditora</h3>
          <span className="ml-auto text-[9px] font-black uppercase tracking-widest text-amber-400 bg-amber-400/10 px-2 py-1 rounded-full border border-amber-400/20">
            ANALISANDO...
          </span>
        </div>
        <div className="flex items-center gap-3 text-white/40 text-[11px]">
          <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
          <span>Aguarde, a IA está verificando a arte...</span>
        </div>
      </div>
    );
  }

  // Exibindo erro
  if (aiStatus === 'error') {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
        <div className="flex items-center gap-3 mb-3">
          <Bot className="w-4 h-4 text-red-400" />
          <h3 className="text-xs font-black uppercase tracking-widest text-white/60">Relatório da IA Auditora</h3>
          <span className="ml-auto text-[9px] font-black uppercase tracking-widest text-red-400 bg-red-400/10 px-2 py-1 rounded-full border border-red-400/20">
            ERRO NA IA
          </span>
        </div>
        <div className="flex items-start gap-2 bg-white/5 rounded-xl p-3 border border-white/5">
          <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-white/50 leading-relaxed">
            {aiReport?.summary || 'A IA Auditora não conseguiu concluir a análise técnica.'}
          </p>
        </div>
      </div>
    );
  }

  // Sem relatório ainda
  if (!aiReport) return null;

  const hasErrors = aiReport.hasErrors;
  const checklist = Array.isArray(aiReport.checklist) ? aiReport.checklist : [];
  const corrections = Array.isArray(aiReport.corrections) ? aiReport.corrections : [];

  return (
    <div className={`rounded-2xl border p-5 ${hasErrors ? 'border-orange-500/20 bg-orange-500/5' : 'border-emerald-500/20 bg-emerald-500/5'}`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Bot className={`w-4 h-4 ${hasErrors ? 'text-orange-400' : 'text-emerald-400'}`} />
        <h3 className="text-xs font-black uppercase tracking-widest text-white/60">Relatório da IA Auditora</h3>
        <span className={`ml-auto text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full border ${
          hasErrors
            ? 'text-orange-400 bg-orange-400/10 border-orange-400/20'
            : 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
        }`}>
          {hasErrors ? 'PENDÊNCIAS' : 'APROVADO ✓'}
        </span>
      </div>

      {/* Resumo */}
      {aiReport.summary && (
        <div className={`rounded-xl p-3 mb-4 border ${hasErrors ? 'bg-orange-500/10 border-orange-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
          {hasErrors && (
            <p className="text-[10px] font-black uppercase tracking-widest text-orange-400/70 mb-1">⚠ Atenção</p>
          )}
          <p className="text-[12px] text-white/70 leading-relaxed italic">"{aiReport.summary}"</p>
        </div>
      )}

      {/* Checklist */}
      {checklist.length > 0 && (
        <div className="space-y-2 mb-4">
          <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-2">Verificação Item a Item</p>
          {checklist.map((item: any, index: number) => (
            <div
              key={index}
              className={`flex items-start gap-3 rounded-xl p-3 border ${
                item.ok
                  ? 'bg-emerald-500/5 border-emerald-500/10'
                  : 'bg-red-500/10 border-red-500/20'
              }`}
            >
              {item.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-[11px] font-black uppercase tracking-wide ${item.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                  {item.item}
                </p>
                {item.observacao && (
                  <p className="text-[11px] text-white/50 mt-0.5 leading-relaxed">{item.observacao}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Correções necessárias */}
      {corrections.length > 0 && (
        <div className="space-y-2">
          <p className="text-[9px] font-black uppercase tracking-widest text-orange-400/60 mb-2">🛠 O que precisa corrigir</p>
          {corrections.map((correction: string, index: number) => (
            <div key={index} className="flex items-start gap-2 bg-white/5 rounded-xl p-3 border border-white/5">
              <span className="text-orange-400 text-[11px] font-black flex-shrink-0">{index + 1}.</span>
              <p className="text-[11px] text-white/60 leading-relaxed">{correction}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tudo OK */}
      {!hasErrors && corrections.length === 0 && (
        <div className="flex items-center gap-3 bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/20">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <p className="text-[12px] text-emerald-400 font-bold">Arte aprovada! Nenhuma correção necessária.</p>
        </div>
      )}
    </div>
  );
});
