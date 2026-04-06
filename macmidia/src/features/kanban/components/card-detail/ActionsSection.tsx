import React, { memo } from "react";
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
