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
import { DEFAULT_COLUMNS, type KanbanCard as KanbanCardType } from '@/contexts/app-types';
import {
  compareKanbanCards,
  computePositionUpdatesAtIndex,
  getTopPositionIndex,
  normalizeColumnKey,
} from '@/features/kanban/utils/cardOrder';

const EXTRA_POSTING_COLUMNS = [
  { columnKey: 'correcao-institucional', title: 'Correção Institucional', color: 'bg-info', position: 98 },
  { columnKey: 'aprovado-institucional', title: 'Apro Calendario', color: 'bg-info', position: 99 },
  { columnKey: 'aprovado-programar', title: 'Aprovado e Programar', color: 'bg-info', position: 100 },
  { columnKey: 'postado', title: 'Postado', color: 'bg-success', position: 101 },
  { columnKey: 'alteracao', title: 'Alteração', color: 'bg-warning', position: 102 },
  { columnKey: 'programar-mais-dias', title: 'Programar para Mais Dias', color: 'bg-purple-500', position: 103 },
];

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
  const { kanbanCards, getColumnsForEmployee, reorderKanbanCards } = useApp();
  
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setIsOpen = isControlled ? (controlledOnOpenChange || (() => {})) : setInternalOpen;

  // Get columns for this card's employee + ensure PostingBoard columns are always available
  const columns = useMemo(() => {
    const empCols = card.employeeId ? getColumnsForEmployee(card.employeeId) : [];
    const baseCols = empCols.length > 0
      ? empCols
      : DEFAULT_COLUMNS.map((c, idx) => ({
          id: c.columnKey,
          employeeId: card.employeeId || '',
          columnKey: c.columnKey,
          title: c.title,
          color: c.color,
          position: idx,
        }));

    const byKey = new Map<string, { columnKey: string; title: string; color: string }>();
    for (const col of baseCols) {
      const k = normalizeColumnKey(col.columnKey);
      if (!byKey.has(k)) {
        byKey.set(k, { columnKey: k, title: col.title, color: col.color });
      }
    }
    for (const extra of EXTRA_POSTING_COLUMNS) {
      if (!byKey.has(extra.columnKey)) {
        byKey.set(extra.columnKey, { columnKey: extra.columnKey, title: extra.title, color: extra.color });
      }
    }
    return Array.from(byKey.values());
  }, [card.employeeId, getColumnsForEmployee]);

  const [selectedColumn, setSelectedColumn] = useState(card.column);
  const [selectedPosition, setSelectedPosition] = useState('1');

  const isEmployeeBoard = typeof window !== 'undefined' && window.location.pathname.startsWith('/funcionario/');

  // When dialog opens, reset to current card state
  React.useEffect(() => {
    if (isOpen) {
      setSelectedColumn(card.column);
      const cardsInCol = kanbanCards
        .filter(c => {
          if (c.column !== card.column) return false;
          if (isEmployeeBoard && c.employeeId !== card.employeeId) return false;
          return true;
        })
        .sort(compareKanbanCards);
      const currentIdx = cardsInCol.findIndex(c => c.id === card.id);
      setSelectedPosition(String(currentIdx >= 0 ? currentIdx + 1 : 1));
    }
  }, [isOpen, card.column, card.id, card.employeeId, kanbanCards, isEmployeeBoard]);

  // Cards in the selected target column (excluding current card)
  const cardsInTargetColumn = useMemo(() => {
    if (!isOpen) return [];
    return kanbanCards
      .filter(c => {
        if (c.column !== selectedColumn || c.id === card.id) return false;
        if (isEmployeeBoard && c.employeeId !== card.employeeId) return false;
        return true;
      })
      .sort(compareKanbanCards);
  }, [isOpen, kanbanCards, selectedColumn, card.employeeId, card.id, isEmployeeBoard]);

  // Available positions (1 to N+1 where N is the count of cards in target)
  const positions = useMemo(() => {
    const count = Math.min(cardsInTargetColumn.length + 1, 100); // Cap dropdown at 100 for huge columns
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [cardsInTargetColumn]);

  const handleMove = async () => {
    const targetCol = columns.find(c => c.columnKey === selectedColumn);
    const pos = Math.max(0, parseInt(selectedPosition, 10) - 1); // 0-indexed

    try {
      if (pos === 0) {
        // Position 1 -> always place at the very top globally
        const topPos = getTopPositionIndex(kanbanCards, selectedColumn, card.id);
        await reorderKanbanCards([
          {
            id: card.id,
            position_index: topPos,
            column: selectedColumn !== card.column ? selectedColumn : undefined,
          },
        ]);
      } else {
        const reorderUpdates = computePositionUpdatesAtIndex(
          kanbanCards,
          cardsInTargetColumn,
          card.id,
          selectedColumn,
          pos
        );
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
  const currentPosInCol = useMemo(() => {
    if (!isOpen) return 1;
    const cardsInCol = kanbanCards
      .filter(c => {
        if (c.column !== card.column) return false;
        if (isEmployeeBoard && c.employeeId !== card.employeeId) return false;
        return true;
      })
      .sort(compareKanbanCards);
    return cardsInCol.findIndex(c => c.id === card.id) + 1;
  }, [isOpen, kanbanCards, card.column, card.employeeId, card.id, isEmployeeBoard]);

  const isSamePosition = selectedColumn === card.column && selectedPosition === String(currentPosInCol);

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
