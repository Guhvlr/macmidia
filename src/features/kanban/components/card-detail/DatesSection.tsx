import React, { memo } from "react";
import { Calendar as CalendarIcon, Clock, X, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { KanbanCard as KanbanCardType } from '@/contexts/app-types';

interface DatesSectionProps {
  card: KanbanCardType;
  startDate: string;
  setStartDate: (date: string) => void;
  dueDate: string;
  setDueDate: (date: string) => void;
  dueTime: string;
  setDueTime: (time: string) => void;
  recurrence: string;
  setRecurrence: (val: string) => void;
  reminder: string;
  setReminder: (val: string) => void;
  dueDateCompleted: boolean;
  setDueDateCompleted: (val: boolean) => void;
  saveUpdates: (updates: Partial<KanbanCardType>, actionDesc?: string) => void;
  mode?: 'full' | 'button' | 'display';
}

export const DatesSection = memo(({
  card,
  startDate,
  setStartDate,
  dueDate,
  setDueDate,
  dueTime,
  setDueTime,
  recurrence,
  setRecurrence,
  reminder,
  setReminder,
  dueDateCompleted,
  setDueDateCompleted,
  saveUpdates,
  mode = 'full'
}: DatesSectionProps) => {
  const [tempStartDate, setTempStartDate] = React.useState<Date | undefined>(startDate ? new Date(startDate) : undefined);
  const [tempDueDate, setTempDueDate] = React.useState<Date | undefined>(dueDate ? new Date(dueDate) : undefined);
  const [hasStartDate, setHasStartDate] = React.useState(!!startDate);
  const [hasDueDate, setHasDueDate] = React.useState(!!dueDate);
  const [isOpen, setIsOpen] = React.useState(false);

  const handleSave = () => {
    const updates: Partial<KanbanCardType> = {
      startDate: hasStartDate && tempStartDate ? tempStartDate.toISOString() : '',
      dueDate: hasDueDate && tempDueDate ? tempDueDate.toISOString() : '',
      dueTime: hasDueDate ? dueTime : '',
      recurrence,
      reminder,
      dueDateCompleted: hasDueDate ? dueDateCompleted : false
    };
    
    setStartDate(updates.startDate || '');
    setDueDate(updates.dueDate || '');
    setDueTime(updates.dueTime || '');
    setRecurrence(updates.recurrence || 'never');
    setReminder(updates.reminder || '1_day_before');
    setDueDateCompleted(updates.dueDateCompleted || false);
    
    saveUpdates(updates, "Atualizou as datas do card");
    setIsOpen(false);
  };

  const handleRemove = () => {
    const updates: Partial<KanbanCardType> = {
      startDate: '',
      dueDate: '',
      dueTime: '',
      recurrence: 'never',
      reminder: 'none',
      dueDateCompleted: false
    };
    
    setStartDate('');
    setDueDate('');
    setDueTime('');
    setRecurrence('never');
    setReminder('none');
    setDueDateCompleted(false);
    setHasStartDate(false);
    setHasDueDate(false);
    setTempStartDate(undefined);
    setTempDueDate(undefined);
    
    saveUpdates(updates, "Removeu as datas do card");
    setIsOpen(false);
  };

  const getStatusLabel = () => {
    if (!dueDate) return null;
    if (dueDateCompleted) return <span className="bg-emerald-500 text-black text-[10px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider ml-2">Concluído</span>;
    
    const now = new Date();
    const dueDt = new Date(dueDate);
    if (dueDt < now) return <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider ml-2">Atrasado</span>;
    
    // Check if soon (within 24h)
    const diff = dueDt.getTime() - now.getTime();
    if (diff > 0 && diff < 24 * 60 * 60 * 1000) return <span className="bg-amber-500 text-black text-[10px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider ml-2">Próximo</span>;
    
    return null;
  };

  return (
    <div className="flex flex-col gap-2">
      {(mode === 'full' || mode === 'display') && (startDate || dueDate) && (
        <div className="flex flex-col gap-2">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-white/40">Data de entrega</h3>
          <div className="flex flex-wrap gap-3">
            {startDate && (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-white/30 uppercase font-bold tracking-widest">Início</span>
                <div className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs text-white">
                  <CalendarIcon className="w-3.5 h-3.5 opacity-50" />
                  {format(new Date(startDate), "d 'de' MMM", { locale: ptBR })}
                </div>
              </div>
            )}
            {dueDate && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 group cursor-pointer">
                  <Checkbox 
                    checked={dueDateCompleted} 
                    onCheckedChange={(val) => {
                      setDueDateCompleted(!!val);
                      saveUpdates({ dueDateCompleted: !!val }, val ? "Marcou data de entrega como concluída" : "Desmarcou data de entrega");
                    }}
                    className="w-4 h-4 border-white/20 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 rounded"
                  />
                  
                  {/* Trello Style Date Block */}
                  <div 
                    onClick={() => setIsOpen(true)}
                    className="bg-[#1a1a1c] hover:bg-[#252528] border border-white/5 px-3 py-2 rounded-md flex items-center gap-2 text-[13px] text-white transition-colors"
                  >
                    <span className="font-medium">
                      {format(new Date(dueDate), "d 'de' MMM", { locale: ptBR })}
                      {dueTime && ` às ${dueTime}`}
                    </span>
                    
                    {/* Status Badge */}
                    {(() => {
                      if (dueDateCompleted) {
                        return <span className="bg-emerald-500 text-black text-[10px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider">Concluído</span>;
                      }
                      const now = new Date();
                      const dueDt = new Date(dueDate);
                      if (dueDt < now) {
                        return <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider">Atrasado</span>;
                      }
                      const diff = dueDt.getTime() - now.getTime();
                      if (diff > 0 && diff < 24 * 60 * 60 * 1000) {
                        return <span className="bg-amber-500 text-black text-[10px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider">Entregar em breve</span>;
                      }
                      return null;
                    })()}
                    
                    <svg className="w-3 h-3 text-white/30 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {(mode === 'full' || mode === 'button') && (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button 
              variant="ghost" 
              className="h-8 px-3 bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-white/70 rounded-full flex items-center gap-2 transition-all"
            >
              <Clock className="w-3.5 h-3.5" /> Datas
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md bg-[#161618] border-white/10 p-0 shadow-2xl z-[99999] rounded-2xl overflow-hidden">
            <DialogHeader className="p-4 border-b border-white/5 bg-black/20 flex flex-row items-center justify-between space-y-0">
              <DialogTitle className="text-xs font-black uppercase tracking-widest text-white/60">Gerenciar Datas</DialogTitle>
            </DialogHeader>
            
            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto custom-scrollbar">
              <div className="flex justify-center mb-2">
                <Calendar
                  mode="single"
                  selected={tempDueDate || tempStartDate}
                  onSelect={(date) => {
                    if (hasDueDate) setTempDueDate(date);
                    else if (hasStartDate) setTempStartDate(date);
                    else setTempDueDate(date);
                  }}
                  locale={ptBR}
                  className="rounded-xl border border-white/5 bg-black/40 p-3 shadow-inner"
                />
              </div>

              <div className="space-y-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-white/40 ml-1">Data de início</label>
                  <div className="flex items-center gap-3 bg-white/5 p-2 rounded-xl border border-white/5">
                    <Checkbox checked={hasStartDate} onCheckedChange={(val) => setHasStartDate(!!val)} className="w-4 h-4 border-white/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                    <Input 
                      placeholder="D/M/AAAA" 
                      value={tempStartDate ? format(tempStartDate, "dd/MM/yyyy") : ""} 
                      readOnly 
                      className="h-9 bg-black/40 border-white/10 text-[13px] text-white/80 rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-white/40 ml-1">Data de entrega</label>
                  <div className="flex flex-col gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                    <div className="flex items-center gap-3">
                      <Checkbox checked={hasDueDate} onCheckedChange={(val) => setHasDueDate(!!val)} className="w-4 h-4 border-white/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                      <Input 
                        placeholder="D/M/AAAA" 
                        value={tempDueDate ? format(tempDueDate, "dd/MM/yyyy") : ""} 
                        readOnly 
                        className="h-9 flex-1 bg-black/40 border-white/10 text-[13px] text-white rounded-lg"
                      />
                    </div>
                    <div className="flex items-center gap-3 ml-7">
                      <Clock className="w-4 h-4 text-white/30" />
                      <Input 
                        type="time" 
                        value={dueTime} 
                        onChange={(e) => setDueTime(e.target.value)}
                        className="h-9 w-full bg-black/40 border-white/10 text-[13px] text-white rounded-lg"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-white/40 ml-1">Recorrência</label>
                    <Select value={recurrence} onValueChange={setRecurrence}>
                      <SelectTrigger className="h-10 bg-white/5 border-white/10 text-[13px] text-white rounded-xl">
                        <SelectValue placeholder="Nunca" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1a1c] border-white/10 rounded-xl">
                        <SelectItem value="never">Nunca</SelectItem>
                        <SelectItem value="daily">Diariamente</SelectItem>
                        <SelectItem value="weekly">Semanalmente</SelectItem>
                        <SelectItem value="monthly">Mensalmente</SelectItem>
                        <SelectItem value="yearly">Anualmente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-white/40 ml-1">Lembrete</label>
                    <Select value={reminder} onValueChange={setReminder}>
                      <SelectTrigger className="h-10 bg-white/5 border-white/10 text-[13px] text-white rounded-xl">
                        <SelectValue placeholder="Nenhum" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1a1c] border-white/10 rounded-xl">
                        <SelectItem value="none">Nenhum</SelectItem>
                        <SelectItem value="at_time">No momento</SelectItem>
                        <SelectItem value="15_min_before">15 min antes</SelectItem>
                        <SelectItem value="1_hour_before">1 hora antes</SelectItem>
                        <SelectItem value="1_day_before">1 dia antes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex flex-col gap-3">
                <Button onClick={handleSave} className="w-full bg-white hover:bg-gray-200 text-black font-black h-11 rounded-xl shadow-xl transition-all active:scale-[0.98]">
                  Salvar Alterações
                </Button>
                <Button onClick={handleRemove} variant="ghost" className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold h-10 rounded-xl transition-all">
                  Remover Datas
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
});
