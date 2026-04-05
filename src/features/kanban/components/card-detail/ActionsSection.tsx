import React, { memo } from "react";
import { Sparkles, Trash2, CheckCircle2, Edit3, LayoutList, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import type { KanbanCard as KanbanCardType } from '@/contexts/app-types';

interface ActionsSectionProps {
  card: KanbanCardType;
  triggerAICorrection: (id: string) => void;
  fixDescriptionWithAI: (id: string, mode: 'keep_sequence' | 'organize') => void;
  customAICommand: (id: string, prompt: string) => void;
  setShowDeleteConfirm: (show: boolean) => void;
}

export const ActionsSection = memo( ({
  card,
  triggerAICorrection,
  fixDescriptionWithAI,
  customAICommand,
  setShowDeleteConfirm
}: ActionsSectionProps) => {
  return (
    <div className="p-4 border-t border-white/5 space-y-2 bg-black/40">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-[11px] text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-xl h-10 border border-amber-500/30 shadow-2xl shadow-amber-900/10 bg-amber-500/5 animate-pulse-slow hover:animate-none group/ia transition-all"
          >
            <Sparkles className="w-4 h-4 mr-3" /> 
            <span className="font-black uppercase tracking-widest">IA HUB OPERACIONAL</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          className="glass-card border-white/10 bg-[#0a0a0a]/98 w-72 backdrop-blur-3xl p-1.5 shadow-[0_30px_60px_rgba(0,0,0,1)] z-[99999]" 
          align="start"
        >
          <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-white/30 px-3 py-2">Assistente de Produção</DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-white/5 mx-1" />
          
          <DropdownMenuItem 
            onClick={() => triggerAICorrection(card.id)} 
            className="text-[11px] font-bold py-3 px-3 cursor-pointer rounded-xl hover:bg-primary/10 hover:text-primary transition-all flex items-center gap-3"
          >
            <CheckCircle2 className="w-4 h-4" />
            Auditoria de Imagens
          </DropdownMenuItem>

          <DropdownMenuItem 
            onClick={() => fixDescriptionWithAI(card.id, 'keep_sequence')} 
            className="text-[11px] font-bold py-3 px-3 cursor-pointer rounded-xl hover:bg-white/5 transition-all flex items-center gap-3"
          >
            <Edit3 className="w-4 h-4" />
            Corrigir Texto (Manter Ordem)
          </DropdownMenuItem>

          <DropdownMenuItem 
            onClick={() => fixDescriptionWithAI(card.id, 'organize')} 
            className="text-[11px] font-bold py-3 px-3 cursor-pointer rounded-xl hover:bg-white/5 transition-all flex items-center gap-3"
          >
            <LayoutList className="w-4 h-4" />
            Organizar por Setores
          </DropdownMenuItem>

          <DropdownMenuSeparator className="bg-white/5 mx-1" />
          
          <div className="p-4 space-y-3 bg-white/5 rounded-xl border border-white/5 mt-1">
            <div className="flex items-center justify-between px-1">
              <p className="text-[9px] font-black uppercase tracking-widest text-primary/60">Comando de Produção</p>
              <Sparkles className="w-3 h-3 text-primary/40" />
            </div>
            <div className="relative group/input">
              <Textarea 
                placeholder="Ex: 'Corrija os erros e organize por categorias, movendo as carnes para o topo da lista...'"
                className="bg-black/40 border-white/10 min-h-[80px] text-[11px] pr-8 focus:ring-primary/20 rounded-xl font-bold placeholder:text-white/20 leading-relaxed resize-none scrollbar-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const val = e.currentTarget.value;
                    if (val.trim()) {
                      customAICommand(card.id, val);
                      e.currentTarget.value = '';
                    }
                  }
                }}
              />
              <div className="absolute right-3 bottom-3 text-white/20 group-focus-within/input:text-primary transition-colors">
                <Send className="w-4 h-4" />
              </div>
            </div>
            <p className="text-[8px] text-white/20 px-1 italic">Pressione ENTER para enviar (SHIFT+ENTER para nova linha)</p>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button 
        variant="ghost" 
        onClick={() => setShowDeleteConfirm(true)} 
        className="w-full justify-start text-[11px] text-red-400/60 hover:text-red-400 hover:bg-red-500/10 rounded-xl h-9 transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir permanentemente
      </Button>
    </div>
  );
});
