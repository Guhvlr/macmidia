import React, { memo } from "react";
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApp } from '@/contexts/useApp';
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
  const [isConfirmingDelete, setIsConfirmingDelete] = React.useState(false);
  const { deleteKanbanCard } = useApp();

  return (
    <div className="p-4 border-t border-white/5 space-y-2 bg-black/40">
      {!isConfirmingDelete ? (
        <Button 
          variant="ghost" 
          onClick={() => setIsConfirmingDelete(true)} 
          className="w-full justify-start text-[11px] text-red-400/60 hover:text-red-400 hover:bg-red-500/10 rounded-xl h-9 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir permanentemente
        </Button>
      ) : (
        <div className="flex items-center gap-2 animate-in slide-in-from-right-2">
          <Button 
            variant="destructive" 
            onClick={() => {
              // Chamamos a função de fechar o diálogo pai (está no CardDetailDialog)
              // Mas aqui vamos disparar o delete direto
              deleteKanbanCard(card.id);
            }} 
            className="flex-1 text-[10px] h-8 bg-red-600 hover:bg-red-700 font-bold"
          >
            CONFIRMAR EXCLUSÃO
          </Button>
          <Button 
            variant="ghost" 
            onClick={() => setIsConfirmingDelete(false)} 
            className="px-2 h-8 text-[10px] text-white/40 hover:text-white"
          >
            Cancelar
          </Button>
        </div>
      )}
    </div>
  );
});
