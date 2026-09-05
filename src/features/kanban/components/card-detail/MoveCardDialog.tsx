import React, { memo, useState, useMemo } from "react";
import { ArrowRight, MoveRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/contexts/useApp';
import { toast } from 'sonner';
import type { KanbanCard as KanbanCardType } from '@/contexts/app-types';

interface MoveCardDialogProps {
  card: KanbanCardType;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
  onMoveComplete?: () => void;
}

export const MoveCardDialog = memo(({
  card,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  trigger,
  onMoveComplete
}: MoveCardDialogProps) => {
  const { kanbanCards, kanbanColumns, getColumnsForEmployee, moveKanbanCard, reorderKanbanCards } = useApp();
  
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setIsOpen = isControlled ? (controlledOnOpenChange || (() => {})) : setInternalOpen;

  // Get columns for this card's employee
  const columns = useMemo(() => {
    return getColumnsForEmployee(card.employeeId);
  }, [card.employeeId, getColumnsForEmployee]);

  const [selectedColumn, setSelectedColumn] = useState(card.column);
  const [selectedPosition, setSelectedPosition] = useState('1');

  // When dialog opens, reset to current card state
  React.useEffect(() => {
    if (isOpen) {
      setSelectedColumn(card.column);
      // Find current position of card in its column
      const cardsInCol = kanbanCards
        .filter(c => c.column === card.column && c.employeeId === card.employeeId && !c.archivedAt)
        .sort((a, b) => (a.position_index || 0) - (b.position_index || 0));
      const currentIdx = cardsInCol.findIndex(c => c.id === card.id);
      setSelectedPosition(String(currentIdx >= 0 ? currentIdx + 1 : 1));
    }
  }, [isOpen, card.column, card.id, card.employeeId, kanbanCards]);

  // Cards in the selected target column (excluding current card if same column)
  const cardsInTargetColumn = useMemo(() => {
    return kanbanCards
      .filter(c => c.column === selectedColumn && c.employeeId === card.employeeId && !c.archivedAt && c.id !== card.id)
      .sort((a, b) => (a.position_index || 0) - (b.position_index || 0));
  }, [kanbanCards, selectedColumn, card.employeeId, card.id]);

  // Available positions (1 to N+1 where N is the count of cards in target)
  const positions = useMemo(() => {
    const count = cardsInTargetColumn.length + 1; // +1 for the card being moved
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [cardsInTargetColumn]);

  const handleMove = async () => {
    const targetCol = columns.find(c => c.columnKey === selectedColumn);
    const pos = parseInt(selectedPosition, 10) - 1; // 0-indexed

    try {
      if (selectedColumn !== card.column) {
        // Moving to a different column
        const targetCards = kanbanCards
          .filter(c => c.column === selectedColumn && c.employeeId === card.employeeId && !c.archivedAt && c.id !== card.id)
          .sort((a, b) => (a.position_index || 0) - (b.position_index || 0));
        
        // Insert card at desired position
        const reorderUpdates: { id: string; position_index: number; column?: string }[] = [];
        let posIndex = 0;
        for (let i = 0; i <= targetCards.length; i++) {
          if (i === pos) {
            reorderUpdates.push({ id: card.id, position_index: posIndex * 1024, column: selectedColumn });
            posIndex++;
          }
          if (i < targetCards.length) {
            reorderUpdates.push({ id: targetCards[i].id, position_index: posIndex * 1024 });
            posIndex++;
          }
        }
        
        if (reorderUpdates.length > 0) {
          await reorderKanbanCards(reorderUpdates);
        }
      } else {
        // Same column, just reorder
        const otherCards = kanbanCards
          .filter(c => c.column === selectedColumn && c.employeeId === card.employeeId && !c.archivedAt && c.id !== card.id)
          .sort((a, b) => (a.position_index || 0) - (b.position_index || 0));
        
        const reorderUpdates: { id: string; position_index: number }[] = [];
        let posIndex = 0;
        for (let i = 0; i <= otherCards.length; i++) {
          if (i === pos) {
            reorderUpdates.push({ id: card.id, position_index: posIndex * 1024 });
            posIndex++;
          }
          if (i < otherCards.length) {
            reorderUpdates.push({ id: otherCards[i].id, position_index: posIndex * 1024 });
            posIndex++;
          }
        }
        
        if (reorderUpdates.length > 0) {
          await reorderKanbanCards(reorderUpdates);
        }
      }
      
      toast.success(`Card movido para "${targetCol?.title || selectedColumn}" na posição ${selectedPosition}`);
      setIsOpen(false);
      onMoveComplete?.();
    } catch (err) {
      console.error('Error moving card:', err);
      toast.error('Erro ao mover o card.');
    }
  };

  const currentCol = columns.find(c => c.columnKey === card.column);
  const targetCol = columns.find(c => c.columnKey === selectedColumn);
  const isSamePosition = selectedColumn === card.column && selectedPosition === String(
    kanbanCards
      .filter(c => c.column === card.column && c.employeeId === card.employeeId && !c.archivedAt)
      .sort((a, b) => (a.position_index || 0) - (b.position_index || 0))
      .findIndex(c => c.id === card.id) + 1
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger && (
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-sm bg-[#161618] border-white/10 p-0 shadow-2xl z-[99999] rounded-2xl overflow-hidden">
        <DialogHeader className="p-4 border-b border-white/5 bg-black/20 flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-xs font-black uppercase tracking-widest text-white/60 flex items-center gap-2">
            <MoveRight className="w-4 h-4" /> Mover Cartão
          </DialogTitle>
        </DialogHeader>
        
        <div className="p-5 space-y-5">
          {/* Current location indicator */}
          <div className="flex items-center gap-2 text-[11px] text-white/40">
            <span className="font-medium">Localização atual:</span>
            <span className="px-2 py-0.5 rounded-md text-white/70 font-bold" style={{ backgroundColor: currentCol?.color || '#333' }}>
              {currentCol?.title || card.column}
            </span>
          </div>

          {/* Column selector */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-white/40 ml-1">Lista (coluna destino)</label>
            <Select value={selectedColumn} onValueChange={(val) => {
              setSelectedColumn(val);
              setSelectedPosition('1');
            }}>
              <SelectTrigger className="h-11 bg-white/5 border-white/10 text-[13px] text-white rounded-xl">
                <SelectValue placeholder="Selecionar coluna..." />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1c] border-white/10 rounded-xl z-[999999]">
                {columns.map(col => (
                  <SelectItem key={col.columnKey} value={col.columnKey}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
                      <span className="font-semibold">{col.title}</span>
                      {col.columnKey === card.column && (
                        <span className="text-[9px] text-white/30 font-bold ml-1">(atual)</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Position selector */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-white/40 ml-1">Posição</label>
            <Select value={selectedPosition} onValueChange={setSelectedPosition}>
              <SelectTrigger className="h-11 bg-white/5 border-white/10 text-[13px] text-white rounded-xl">
                <SelectValue placeholder="Posição..." />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1c] border-white/10 rounded-xl z-[999999]">
                {positions.map(pos => (
                  <SelectItem key={pos} value={String(pos)}>
                    <span className="font-semibold">{pos}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Move button */}
          <Button 
            onClick={handleMove} 
            disabled={isSamePosition}
            className="w-full bg-white hover:bg-gray-200 text-black font-black h-11 rounded-xl shadow-xl transition-all active:scale-[0.98] disabled:opacity-30"
          >
            <ArrowRight className="w-4 h-4 mr-2" />
            Mover
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
});

MoveCardDialog.displayName = 'MoveCardDialog';
