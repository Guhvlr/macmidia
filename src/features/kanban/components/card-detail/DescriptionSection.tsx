import React, { memo } from "react";
import { Bot, AlertTriangle, CheckCircle2, Loader2, X, LayoutList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { KanbanCard as KanbanCardType } from '@/contexts/app-types';

interface DescriptionSectionProps {
  card: KanbanCardType;
  description: string;
  setDescription: (desc: string) => void;
  isEditingDesc: boolean;
  setIsEditingDesc: (editing: boolean) => void;
  handleSaveDescription: () => void;
}

export const DescriptionSection = memo( ({
  card,
  description,
  setDescription,
  isEditingDesc,
  setIsEditingDesc,
  handleSaveDescription
}: DescriptionSectionProps) => {
  const [showOriginal, setShowOriginal] = React.useState(false);

  return (
    <div className="pl-10 space-y-10">
      {/* AI REPORT */}
      {(card.aiStatus === 'analyzing' || card.aiStatus === 'issues_found' || card.aiStatus === 'approved' || card.aiStatus === 'price_mismatch' || card.aiStatus === 'error') && (
        <div className={`rounded-2xl border p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-500 ${
          card.aiStatus === 'analyzing' ? 'bg-blue-500/5 border-blue-500/20' : 
          card.aiStatus === 'approved' ? 'bg-emerald-500/5 border-emerald-500/20' : 
          card.aiStatus === 'error' ? 'bg-zinc-800/20 border-white/10' :
          card.aiStatus === 'price_mismatch' ? 'bg-red-500/5 border-red-500/20' :
          'bg-amber-500/5 border-amber-500/20'
        }`}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-2 text-white/90">
              <Bot className={`w-5 h-5 ${card.aiStatus === 'analyzing' ? 'text-blue-400 animate-pulse' : card.aiStatus === 'approved' ? 'text-emerald-400' : 'text-amber-400'}`} />
              Relatório da IA Auditora
            </h3>
            <div className="flex items-center gap-2">
              {card.aiStatus === 'price_mismatch' && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-500/20 border border-red-500/20 text-red-500 text-[9px] font-black uppercase tracking-widest animate-pulse">
                  <AlertTriangle className="w-3 h-3" /> ERRO DE PREÇO
                </div>
              )}
              <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                card.aiStatus === 'analyzing' ? 'bg-blue-500/20 text-blue-400' : 
                card.aiStatus === 'approved' ? 'bg-emerald-500/20 text-emerald-400' : 
                card.aiStatus === 'error' ? 'bg-white/10 text-white/40' :
                card.aiStatus === 'price_mismatch' ? 'bg-red-500/20 text-red-400' :
                'bg-amber-500/20 text-amber-400'
              }`}>
                {card.aiStatus === 'analyzing' ? 'Analisando...' : card.aiStatus === 'approved' ? 'Aprovado' : card.aiStatus === 'error' ? 'Erro na IA' : card.aiStatus === 'price_mismatch' ? 'Bloqueado' : 'Pendências'}
              </span>
            </div>
          </div>

          {card.aiStatus === 'price_mismatch' && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl space-y-2">
              <p className="text-[11px] text-red-400 font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> CRÍTICO: Divergência de Preços Detectada!
              </p>
              <p className="text-[10px] text-red-300/80 leading-relaxed">
                A IA pode ter alterado os valores originais durante a formatação. Compare a <b>Descrição</b> com a <b>Mensagem Original</b> abaixo para garantir a integridade dos dados.
              </p>
            </div>
          )}

          {card.aiStatus === 'issues_found' && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-[11px] text-red-300 font-bold flex items-center gap-2">
                <X className="w-3.5 h-3.5" /> Atenção: O card foi movido para a coluna de Alteração devido às inconsistências abaixo.
              </p>
            </div>
          )}

          {card.aiStatus === 'approved' && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <p className="text-[11px] text-emerald-400 font-bold flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5" /> Tudo certo! A IA conferiu os dados e as imagens estão batendo com o texto.
              </p>
            </div>
          )}

          {card.aiStatus === 'error' && (
            <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
              <p className="text-[11px] text-white/50 font-bold flex items-center gap-2 italic">
                <AlertTriangle className="w-3.5 h-3.5 text-zinc-500" /> A IA Auditora não conseguiu concluir a análise técnica.
              </p>
            </div>
          )}

          {card.aiStatus === 'analyzing' ? (
            <div className="py-4 space-y-3">
              <div className="flex items-center gap-3">
                <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                <p className="text-xs text-white/40 italic">A IA está conferindo os preços e imagens com a descrição...</p>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500/40 animate-progress origin-left" style={{ width: '60%' }} />
              </div>
            </div>
          ) : card.aiReport && (
            <div className="space-y-4">
              {card.aiReport.report ? (
                <div className="p-4 rounded-xl bg-black/40 border border-white/5 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-white/80 overflow-x-auto">
                  {card.aiReport.report}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(card.aiReport.checklist || []).map((check: any, idx: number) => (
                      <div key={idx} className="flex gap-3 p-3 rounded-xl bg-black/20 border border-white/5 items-start">
                        <span className="text-sm mt-0.5">{check.status}</span>
                        <div>
                          <p className="text-[11px] font-bold text-white/80">{check.item}</p>
                          <p className="text-[10px] text-white/40 leading-relaxed">{check.observation}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {card.aiReport.summary && (
                    <p className="text-[12px] text-white/60 leading-relaxed italic border-l-2 border-white/10 pl-4 py-1">
                      "{card.aiReport.summary}"
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Description */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-bold flex items-center gap-2 text-white/90">
            <LayoutList className="w-5 h-5 text-white/60" /> Descrição
          </h3>
          {!isEditingDesc && (
            <Button variant="ghost" size="sm" onClick={() => setIsEditingDesc(true)} className="bg-white/5 hover:bg-white/10 text-xs px-4 h-8 rounded border border-white/5">Editar</Button>
          )}
        </div>
        {isEditingDesc ? (
          <div className="space-y-3">
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Adicione uma descrição detalhada..."
              className="bg-black/20 border border-white/10 min-h-[140px] text-[13px] rounded-lg focus-visible:ring-red-500 shadow-inner resize-y"
              rows={Math.max(6, description.split('\n').length + 1)}
              autoFocus
            />
            <div className="flex gap-2">
              <Button onClick={handleSaveDescription} size="sm" className="bg-red-600 hover:bg-red-700">Salvar</Button>
              <Button onClick={() => setIsEditingDesc(false)} variant="ghost" size="sm">Cancelar</Button>
            </div>
          </div>
        ) : (
          <div onClick={() => setIsEditingDesc(true)} className={`text-[13px] rounded-lg p-3 whitespace-pre-wrap cursor-pointer transition-colors border ${description ? 'border-transparent hover:bg-white/5' : 'border-white/5 bg-white/5 hover:bg-white/10 text-white/50 min-h-[60px] flex items-center'}`}>
            {description || "Clique para adicionar uma descrição..."}
          </div>
        )}
      </div>

      {/* ORIGINAL MESSAGE SECTION */}
      {card.originalMessage && (
        <div className="space-y-4 pt-4 border-t border-white/5 opacity-80 hover:opacity-100 transition-opacity">
          <div className="flex items-center justify-between">
            <h3 className="text-[12px] font-bold flex items-center gap-2 text-emerald-500/80">
              <Bot className="w-4 h-4" /> Entrada Original ({card.source === 'whatsapp' ? 'WhatsApp' : 'Manual'})
            </h3>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowOriginal(!showOriginal)}
              className="h-6 text-[10px] text-white/30 hover:text-white/60 bg-white/5"
            >
              {showOriginal ? 'Ocultar' : 'Ver original'}
            </Button>
          </div>
          {showOriginal && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-4">
              <div className="text-[11px] font-mono leading-relaxed bg-black/30 rounded-xl p-4 border border-white/5 text-white/40 whitespace-pre-wrap max-h-[300px] overflow-y-auto custom-scrollbar italic">
                {card.originalMessage}
              </div>
              <p className="text-[9px] text-white/20 text-center italic">Este é o conteúdo bruto da entrada inicial antes do processamento ou refinamento pela IA.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
