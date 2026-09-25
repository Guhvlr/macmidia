import React, { memo, useState, useMemo } from "react";
import { Copy, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/contexts/useApp';
import { toast } from 'sonner';
import type { KanbanCard as KanbanCardType } from '@/contexts/app-types';

interface DuplicateCardDialogProps {
  card: KanbanCardType;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const DuplicateCardDialog = memo(({
  card,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: DuplicateCardDialogProps) => {
  const { employees, getColumnsForEmployee, addKanbanCard, loggedUserRole, loggedUserKanbanLink } = useApp();
  
  // Visitantes só podem ver os quadros vinculados a eles
  const visibleEmployees = useMemo(() => {
    if (loggedUserRole === 'GUEST' && loggedUserKanbanLink) {
      const allowedIds = loggedUserKanbanLink.split(',').filter(Boolean);
      return employees.filter(emp => allowedIds.includes(emp.id));
    }
    return employees;
  }, [employees, loggedUserRole, loggedUserKanbanLink]);
  
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setIsOpen = isControlled ? (controlledOnOpenChange || (() => {})) : setInternalOpen;

  const [selectedEmployee, setSelectedEmployee] = useState(card.employeeId);
  const [selectedColumn, setSelectedColumn] = useState(card.column);
  const [isDuplicating, setIsDuplicating] = useState(false);

  // Reset when dialog opens
  React.useEffect(() => {
    if (isOpen) {
      setSelectedEmployee(card.employeeId);
      setSelectedColumn(card.column);
    }
  }, [isOpen, card.employeeId, card.column]);

  // Get columns for the selected employee
  const columns = useMemo(() => {
    return getColumnsForEmployee(selectedEmployee);
  }, [selectedEmployee, getColumnsForEmployee]);

  // When employee changes, default to first column
  const handleEmployeeChange = (empId: string) => {
    setSelectedEmployee(empId);
    const empColumns = getColumnsForEmployee(empId);
    if (empColumns.length > 0) {
      setSelectedColumn(empColumns[0].columnKey);
    }
  };

  const currentEmployee = employees.find(e => e.id === card.employeeId);

  const handleDuplicate = async () => {
    setIsDuplicating(true);
    try {
      const { id, history, position_index, archivedAt, timerRunning, timerStart, timeSpent, aiStatus, aiReport, ...cardData } = card as any;

      await addKanbanCard({
        ...cardData,
        employeeId: selectedEmployee,
        column: selectedColumn,
        timeSpent: 0,
        timerRunning: false,
        timerStart: undefined,
        archivedAt: undefined,
        aiStatus: null,
        aiReport: null,
        checklists: (card.checklists || []).map(item => ({
          ...item,
          id: crypto.randomUUID(),
          completed: false,
        })),
        comments: [],
        history: [],
      });

      const targetEmp = employees.find(e => e.id === selectedEmployee);
      const targetCol = columns.find(c => c.columnKey === selectedColumn);
      
      toast.success(`Card duplicado para ${targetEmp?.name || 'quadro'} em "${targetCol?.title || selectedColumn}"`);
      setIsOpen(false);
    } catch (err) {
      console.error('Error duplicating card:', err);
      toast.error('Erro ao duplicar o card.');
    } finally {
      setIsDuplicating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-sm bg-[#161618] border-white/10 p-0 shadow-2xl z-[99999] rounded-2xl overflow-hidden">
        <DialogHeader className="p-4 border-b border-white/5 bg-black/20 flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-xs font-black uppercase tracking-widest text-white/60 flex items-center gap-2">
            <Copy className="w-4 h-4" /> Duplicar Cartão
          </DialogTitle>
        </DialogHeader>
        
        <div className="p-5 space-y-5">
          {/* Current card info */}
          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
            <p className="text-[10px] uppercase tracking-widest text-white/30 font-bold mb-1">Card original</p>
            <p className="text-sm font-bold text-white truncate">{card.clientName}</p>
            <p className="text-[11px] text-white/40 mt-0.5">
              Quadro de {currentEmployee?.name || 'Desconhecido'}
            </p>
          </div>

          {/* Employee / Board selector */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-white/40 ml-1">Quadro destino (membro da equipe)</label>
            <Select value={selectedEmployee} onValueChange={handleEmployeeChange}>
              <SelectTrigger className="h-11 bg-white/5 border-white/10 text-[13px] text-white rounded-xl">
                <SelectValue placeholder="Selecionar quadro..." />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1c] border-white/10 rounded-xl z-[999999]">
                {visibleEmployees.map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-600 to-rose-700 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                        {(emp.name || 'U').substring(0, 1).toUpperCase()}
                      </div>
                      <span className="font-semibold">{emp.name}</span>
                      {emp.id === card.employeeId && (
                        <span className="text-[9px] text-white/30 font-bold ml-1">(atual)</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Column selector */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-white/40 ml-1">Coluna destino</label>
            <Select value={selectedColumn} onValueChange={setSelectedColumn}>
              <SelectTrigger className="h-11 bg-white/5 border-white/10 text-[13px] text-white rounded-xl">
                <SelectValue placeholder="Selecionar coluna..." />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1c] border-white/10 rounded-xl z-[999999]">
                {columns.map(col => (
                  <SelectItem key={col.columnKey} value={col.columnKey}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
                      <span className="font-semibold">{col.title}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Duplicate button */}
          <Button 
            onClick={handleDuplicate} 
            disabled={isDuplicating}
            className="w-full bg-white hover:bg-gray-200 text-black font-black h-11 rounded-xl shadow-xl transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {isDuplicating ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Duplicando...</>
            ) : (
              <><Copy className="w-4 h-4 mr-2" /> Duplicar</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
});

DuplicateCardDialog.displayName = 'DuplicateCardDialog';
