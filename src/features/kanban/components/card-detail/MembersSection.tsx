import React, { memo } from "react";
import { X, Plus, Sparkles, CheckCircle2, Clock, Send, Edit3, LayoutList, Trash, MoveRight, ScanBarcode } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import Timer from '../Timer';
import type { KanbanCard as KanbanCardType } from '@/contexts/app-types';
import { useApp } from '@/contexts/useApp';
import { ListTodo, Paperclip } from 'lucide-react';
import { DatesSection } from './DatesSection';
import { MoveCardDialog } from './MoveCardDialog';

interface MembersSectionProps {
  card: KanbanCardType;
  labels: string[];
  removeLabel: (label: string) => void;
  newLabelText: string;
  setNewLabelText: (txt: string) => void;
  addLabel: (color?: string, text?: string) => void;
  triggerAICorrection: (id: string) => void;
  fixDescriptionWithAI: (id: string, mode: 'keep_sequence' | 'organize') => void;
  customAICommand: (id: string, prompt: string) => void;
  assignedUsers: any[];
  toggleAssignee: (member: any) => void;
  showMembersSelection: boolean;
  setShowMembersSelection: (show: boolean) => void;
  employees: any[];
  systemUsers: any[];
  saveUpdates: (updates: Partial<KanbanCardType>, actionDesc?: string) => void;
}

export const MembersSection = memo( ({
  card,
  labels,
  removeLabel,
  newLabelText,
  setNewLabelText,
  addLabel,
  assignedUsers,
  toggleAssignee,
  showMembersSelection,
  setShowMembersSelection,
  employees,
  systemUsers,
  saveUpdates,
  triggerAICorrection,
  fixDescriptionWithAI,
  customAICommand,
  // New props for quick actions
  startDate, setStartDate,
  dueDate, setDueDate,
  dueTime, setDueTime,
  recurrence, setRecurrence,
  reminder, setReminder,
  dueDateCompleted, setDueDateCompleted,
  onAddChecklist,
  onAddAttachment
}: MembersSectionProps & { 
  startDate: string, setStartDate: any, 
  dueDate: string, setDueDate: any, 
  dueTime: string, setDueTime: any, 
  recurrence: string, setRecurrence: any, 
  reminder: string, setReminder: any, 
  dueDateCompleted: boolean, setDueDateCompleted: any,
  onAddChecklist?: () => void,
  onAddAttachment?: () => void
}) => {
  const [selectedColor, setSelectedColor] = React.useState('bg-red-600');
  const labelColors = [
    'bg-red-600', 'bg-orange-600', 'bg-amber-500', 'bg-emerald-600', 
    'bg-blue-600', 'bg-indigo-600', 'bg-purple-600', 'bg-pink-600', 'bg-slate-600'
  ];

  const { kanbanCards } = useApp();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [hiddenLabels, setHiddenLabels] = React.useState<string[]>(() => {
    const saved = localStorage.getItem('kanban_hidden_labels');
    return saved ? JSON.parse(saved) : [];
  });
  const [customLabels, setCustomLabels] = React.useState<string[]>(() => {
    const saved = localStorage.getItem('kanban_custom_labels');
    return saved ? JSON.parse(saved) : [];
  });

  const predefinedLabels = React.useMemo(() => [
    'bg-emerald-600|VÍDEO',
    'bg-emerald-600|CONCLUÍDO',
    'bg-amber-500|ALTERAÇÃO',
    'bg-orange-600|PANFLETO',
    'bg-orange-600|INSTITUCIONAL',
    'bg-amber-500|FAZER COM ANTECEDÊNCIA',
    'bg-emerald-600|HORÁRIO DE FUNCIONAMENTO'
  ], []);

  const allLabels = React.useMemo(() => {
    const set = new Set<string>(predefinedLabels);
    // Adicionar as etiquetas personalizadas salvas
    customLabels.forEach(l => set.add(l));
    
    kanbanCards?.forEach(c => {
      if (Array.isArray(c.labels)) {
        c.labels.forEach(l => set.add(l));
      }
    });
    return Array.from(set)
      .filter(l => !hiddenLabels.includes(l))
      .sort((a, b) => a.localeCompare(b));
  }, [kanbanCards, predefinedLabels, hiddenLabels, customLabels]);

  const filteredLabels = allLabels.filter(l => l.split('|').pop()?.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleDeleteGlobalLabel = async (e: React.MouseEvent, labelToRemove: string) => {
    e.stopPropagation();
    
    // Adicionar às ocultas para sumir das sugestões imediatamente
    const newHidden = [...hiddenLabels, labelToRemove];
    setHiddenLabels(newHidden);
    localStorage.setItem('kanban_hidden_labels', JSON.stringify(newHidden));

    // Remover também da lista de personalizadas se estiver lá
    if (customLabels.includes(labelToRemove)) {
      const newCustom = customLabels.filter(l => l !== labelToRemove);
      setCustomLabels(newCustom);
      localStorage.setItem('kanban_custom_labels', JSON.stringify(newCustom));
    }

    const cardsToUpdate = kanbanCards.filter(c => c.labels?.includes(labelToRemove));
    
    if (cardsToUpdate.length > 0) {
      try {
        const batchSize = 10;
        for (let i = 0; i < cardsToUpdate.length; i += batchSize) {
          const chunk = cardsToUpdate.slice(i, i + batchSize);
          await Promise.all(chunk.map(c => {
            const newLabels = (c.labels || []).filter(l => l !== labelToRemove);
            return supabase.from('kanban_cards').update({ labels: newLabels }).eq('id', c.id);
          }));
        }
        toast.success('Etiqueta removida globalmente.');
        
        if (labels.includes(labelToRemove)) {
          removeLabel(labelToRemove);
        }
      } catch (err) {
        console.error('Error deleting label from cards:', err);
        toast.error('Erro ao excluir etiqueta.');
      }
    } else {
      toast.success('Etiqueta removida das sugestões.');
    }
  };

  const handleInternalAddLabel = (color?: string, text?: string) => {
    const textVal = text || searchTerm;
    if (!textVal) return;
    
    const colorVal = color || selectedColor;
    const labelVal = `${colorVal}|${textVal.toUpperCase().trim()}`;
    
    if (hiddenLabels.includes(labelVal)) {
      const newHidden = hiddenLabels.filter(l => l !== labelVal);
      setHiddenLabels(newHidden);
      localStorage.setItem('kanban_hidden_labels', JSON.stringify(newHidden));
    }

    // Salvar na lista de etiquetas personalizadas para persistir nas sugestões
    if (!customLabels.includes(labelVal)) {
      const newCustom = [...customLabels, labelVal];
      setCustomLabels(newCustom);
      localStorage.setItem('kanban_custom_labels', JSON.stringify(newCustom));
    }
    
    addLabel(color, text);
    if (!text) setSearchTerm('');
  };



  return (
    <div className="flex flex-col gap-6 w-full">
      {/* 1. TOP QUICK ACTIONS (TRELLO STYLE) */}
      <div className="flex flex-wrap gap-2 mb-2">
        {/* Add Member Trigger */}
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant="ghost" 
              className="h-8 px-3 bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-white/70 rounded-full flex items-center gap-2 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 glass-card border-white/20 p-2 shadow-[0_20px_60px_rgba(0,0,0,1)] z-[99999] p-0 overflow-hidden" align="center" side="bottom" sideOffset={10}>
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-black/20">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40">Equipe Mac Mídia</h4>
              <Sparkles className="w-3.5 h-3.5 text-primary/40" />
            </div>
            
            <div className="max-h-80 overflow-y-auto custom-scrollbar p-2 space-y-1">
              {(() => {
                const allMembers = employees.map(e => ({
                  id: e.id,
                  email: e.email,
                  fullName: e.name,
                  avatarUrl: e.photoUrl || (e.avatar && e.avatar.startsWith('http') ? e.avatar : null),
                  role: e.role
                }));
                
                systemUsers.forEach(su => {
                  if (!allMembers.some(m => (m.email && su.email && m.email === su.email) || m.id === su.id)) {
                    allMembers.push({
                      id: su.id,
                      email: su.email,
                      fullName: su.fullName,
                      avatarUrl: su.avatarUrl,
                      role: su.role
                    });
                  }
                });

                return allMembers.map(member => {
                  const isSelected = assignedUsers.some(au => au.id === member.id);
                  return (
                    <button 
                      type="button"
                      key={member.id} 
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAssignee(member);
                      }} 
                      className={`w-full flex items-center justify-between p-3 rounded-xl transition-all group border border-transparent outline-none ring-0 mb-0.5 ${isSelected ? 'bg-primary/10 border-primary/20' : 'hover:bg-white/5'}`}
                    >
                      <div className="flex items-center gap-3 pointer-events-none">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center text-[12px] font-black overflow-hidden border border-white/10 shadow-inner group-hover:scale-110 transition-transform">
                          {member.avatarUrl ? (
                            <img src={member.avatarUrl} alt={member.fullName} className="w-full h-full object-cover" />
                          ) : (
                            (member.fullName || 'U').substring(0, 2).toUpperCase()
                          )}
                        </div>
                        <div className="flex flex-col items-start translate-y-[-1px]">
                          <span className={`text-[13px] font-bold leading-none mb-1 transition-colors ${isSelected ? 'text-primary' : 'text-white'}`}>{member.fullName}</span>
                          <span className="text-[10px] font-medium text-white/30 uppercase tracking-tighter truncate max-w-[140px]">{member.role || 'Membro'}</span>
                        </div>
                      </div>
                      {isSelected ? <CheckCircle2 className="w-5 h-5 text-primary" /> : <div className="w-5 h-5 rounded-full border border-white/10 group-hover:border-white/30 transition-colors" />}
                    </button>
                  );
                });
              })() }
            </div>
          </PopoverContent>
        </Popover>

        {/* Dates Trigger */}
        <div className="inline-block">
          <DatesSection 
            card={card}
            startDate={startDate}
            setStartDate={setStartDate}
            dueDate={dueDate}
            setDueDate={setDueDate}
            dueTime={dueTime}
            setDueTime={setDueTime}
            recurrence={recurrence}
            setRecurrence={setRecurrence}
            reminder={reminder}
            setReminder={setReminder}
            dueDateCompleted={dueDateCompleted}
            setDueDateCompleted={setDueDateCompleted}
            saveUpdates={saveUpdates}
            mode="button"
          />
        </div>

        {/* Checklist Trigger */}
        <Button 
          variant="ghost" 
          onClick={onAddChecklist}
          className="h-8 px-3 bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-white/70 rounded-full flex items-center gap-2 transition-all"
        >
          <ListTodo className="w-3.5 h-3.5" /> Checklist
        </Button>

        {/* Attachment Trigger */}
        <Button 
          variant="ghost" 
          onClick={onAddAttachment}
          className="h-8 px-3 bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-white/70 rounded-full flex items-center gap-2 transition-all"
        >
          <Paperclip className="w-3.5 h-3.5" /> Anexo
        </Button>

        {/* Move Card Trigger */}
        <MoveCardDialog 
          card={card}
          trigger={
            <Button 
              variant="ghost" 
              className="h-8 px-3 bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-white/70 rounded-full flex items-center gap-2 transition-all"
            >
              <MoveRight className="w-3.5 h-3.5" /> Mover
            </Button>
          }
        />
      </div>

      <div className="flex flex-wrap items-start gap-10">
        {/* Members */}
        <div className="flex flex-col">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-3">Membros</h3>
          <div className="flex flex-wrap items-center gap-2">
            {assignedUsers.map(u => (
              <div key={u.id} className="relative group/member">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-600 to-rose-700 font-bold text-white text-[11px] flex items-center justify-center flex-shrink-0 shadow-lg group-hover/member:opacity-80 transition cursor-pointer overflow-hidden border-2 border-[#161618]" title={u.fullName}>
                  {u.avatarUrl ? (
                    <img src={u.avatarUrl} alt={u.fullName} className="w-full h-full object-cover" />
                  ) : (
                    u.fullName.substring(0, 2).toUpperCase()
                  )}
                </div>
                <button 
                  onClick={() => toggleAssignee(u)} 
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center opacity-0 group-hover/member:opacity-100 transition shadow hover:bg-red-500 hover:scale-110 z-10"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
            
            <div className="relative">
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className={`w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 p-0 shadow flex items-center justify-center transition-all hover:bg-primary/20 hover:text-primary hover:border-primary/40`}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 glass-card border-white/20 p-2 shadow-[0_20px_60px_rgba(0,0,0,1)] z-[99999] p-0 overflow-hidden" align="center" side="bottom" sideOffset={10}>
                  <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-black/20">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40">Equipe Mac Mídia</h4>
                    <Sparkles className="w-3.5 h-3.5 text-primary/40" />
                  </div>
                  
                  <div className="max-h-80 overflow-y-auto custom-scrollbar p-2 space-y-1">
                    {(() => {
                      const allMembers = employees.map(e => ({
                        id: e.id,
                        email: e.email,
                        fullName: e.name,
                        avatarUrl: e.photoUrl || (e.avatar && e.avatar.startsWith('http') ? e.avatar : null),
                        role: e.role
                      }));
                      
                      systemUsers.forEach(su => {
                        if (!allMembers.some(m => (m.email && su.email && m.email === su.email) || m.id === su.id)) {
                          allMembers.push({
                            id: su.id,
                            email: su.email,
                            fullName: su.fullName,
                            avatarUrl: su.avatarUrl,
                            role: su.role
                          });
                        }
                      });

                      return allMembers.map(member => {
                        const isSelected = assignedUsers.some(au => au.id === member.id);
                        return (
                          <button 
                            type="button"
                            key={member.id} 
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleAssignee(member);
                            }} 
                            className={`w-full flex items-center justify-between p-3 rounded-xl transition-all group border border-transparent outline-none ring-0 mb-0.5 ${isSelected ? 'bg-primary/10 border-primary/20' : 'hover:bg-white/5'}`}
                          >
                            <div className="flex items-center gap-3 pointer-events-none">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center text-[12px] font-black overflow-hidden border border-white/10 shadow-inner group-hover:scale-110 transition-transform">
                                {member.avatarUrl ? (
                                  <img src={member.avatarUrl} alt={member.fullName} className="w-full h-full object-cover" />
                                ) : (
                                  (member.fullName || 'U').substring(0, 2).toUpperCase()
                                )}
                              </div>
                              <div className="flex flex-col items-start translate-y-[-1px]">
                                <span className={`text-[13px] font-bold leading-none mb-1 transition-colors ${isSelected ? 'text-primary' : 'text-white'}`}>{member.fullName}</span>
                                <span className="text-[10px] font-medium text-white/30 uppercase tracking-tighter truncate max-w-[140px]">{member.role || 'Membro'}</span>
                              </div>
                            </div>
                            {isSelected ? <CheckCircle2 className="w-5 h-5 text-primary" /> : <div className="w-5 h-5 rounded-full border border-white/10 group-hover:border-white/30 transition-colors" />}
                          </button>
                        );
                      });
                    })() }
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* Labels */}
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-3">Etiquetas</h3>
          <div className="flex flex-wrap items-center gap-2">
            {labels.map(l => {
              const parts = l.split('|');
              const hasColor = parts.length > 1;
              const colorClass = hasColor ? parts[0] : 'bg-red-600';
              const text = hasColor ? parts.slice(1).join('|') : l;
              return (
                <span key={l} className={`group flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold tracking-wider text-white rounded-md hover:opacity-90 transition-all cursor-pointer shadow-sm ${colorClass}`}>
                  {text}
                  <X className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 hover:text-white/70" onClick={() => removeLabel(l)} />
                </span>
              );
            })}
            
            <div className="relative">
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className={`h-9 w-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 p-0 shadow flex items-center justify-center transition-all hover:bg-primary/20 hover:text-primary hover:border-primary/40`}
                    title="Adicionar Etiqueta"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 glass-card border-white/20 p-0 shadow-[0_20px_60px_rgba(0,0,0,1)] z-[99999] overflow-hidden" align="center" side="bottom" sideOffset={10}>
                  <div className="flex items-center justify-between border-b border-white/5 p-3 bg-black/20">
                    <h4 className="text-[11px] font-bold text-white/60">Etiquetas</h4>
                  </div>
                  
                  <div className="p-3">
                    <Input 
                      placeholder="Buscar ou criar..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && searchTerm.trim()) {
                          handleInternalAddLabel(selectedColor, searchTerm);
                        }
                      }}
                      className="h-8 text-[11px] bg-black/40 border-white/10 mb-3 text-white"
                    />

                    <h5 className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-2">Sugestões</h5>
                    <div className="max-h-48 overflow-y-auto custom-scrollbar pr-1.5 mb-3 flex flex-col gap-1.5">
                      {filteredLabels.map(l => {
                        const parts = l.split('|');
                        const hasColor = parts.length > 1;
                        const colorClass = hasColor ? parts[0] : 'bg-red-600';
                        const text = hasColor ? parts.slice(1).join('|') : l;
                        const isSelected = labels.includes(l);
                        
                        return (
                          <div 
                            key={l}
                            className={`flex items-center gap-2 group hover:opacity-80 transition-opacity`}
                          >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0 cursor-pointer ${isSelected ? 'border-primary bg-primary' : 'border-white/20 group-hover:border-white/40'}`} onClick={(e) => {
                              e.stopPropagation();
                              if (isSelected) {
                                removeLabel(l);
                              } else {
                                handleInternalAddLabel(colorClass, text);
                              }
                            }}>
                              {isSelected && <CheckCircle2 className="w-3 h-3 text-black" />}
                            </div>
                            <div className={`flex-1 px-2 py-1.5 rounded text-[10px] font-bold tracking-wider text-white ${colorClass} cursor-pointer`} onClick={(e) => {
                              e.stopPropagation();
                              if (isSelected) {
                                removeLabel(l);
                              } else {
                                handleInternalAddLabel(colorClass, text);
                              }
                            }}>
                              {text}
                            </div>
                            <button 
                              type="button" 
                              className="w-6 h-6 flex items-center justify-center text-white/30 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                              onClick={(e) => handleDeleteGlobalLabel(e, l)}
                              title="Excluir etiqueta permanentemente"
                            >
                              <Trash className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )
                      })}
                    </div>

                    <div className="border-t border-white/5 pt-3">
                      <div className="flex gap-1.5 mb-2 flex-wrap justify-between">
                        {labelColors.map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setSelectedColor(c)}
                            className={`w-4 h-4 rounded-full ${c} ${selectedColor === c ? 'ring-2 ring-white ring-offset-1 ring-offset-black scale-110' : 'opacity-50 hover:opacity-100'} transition-all`}
                            title="Selecionar cor"
                          />
                        ))}
                      </div>
                      <Button 
                        size="sm"
                        className="w-full h-8 text-[11px] bg-white/5 hover:bg-white/10 text-white border border-white/10"
                        onClick={() => handleInternalAddLabel(selectedColor, searchTerm)}
                        disabled={!searchTerm.trim()}
                      >
                        Criar nova etiqueta
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </div>

      {/* Timer & AI */}
      <div className="flex flex-wrap items-end gap-6">
        <div className="flex flex-col">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-2">Tempo Gasto</h3>
          <div className="bg-white/5 px-3 py-1.5 rounded flex items-center w-fit border border-white/10 h-10">
            <Clock className="w-3.5 h-3.5 text-white/50 mr-2" />
            <Timer 
              timeSpent={card.timeSpent} 
              timerRunning={card.timerRunning} 
              timerStart={card.timerStart} 
              onToggle={() => {
                const now = Date.now();
                if (card.timerRunning) {
                  const elapsed = card.timerStart ? Math.floor((now - card.timerStart) / 1000) : 0;
                  saveUpdates({ timerRunning: false, timeSpent: card.timeSpent + elapsed, timerStart: undefined }, "Parou o timer");
                } else {
                  saveUpdates({ timerRunning: true, timerStart: now }, "Iniciou o timer");
                }
              }} 
            />
          </div>
        </div>

        {/* AI HUB OPERACIONAL - INTEGRATED DESIGN */}
        <div className="flex flex-col">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-2">Assistente IA</h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="justify-start text-[11px] text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-xl h-10 border border-amber-500/30 shadow-2xl shadow-amber-900/10 bg-amber-500/5 transition-all group/ia flex items-center px-4"
              >
                <Sparkles className="w-4 h-4 mr-2" /> 
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
    
              <DropdownMenuItem 
                onClick={() => fixDescriptionWithAI(card.id, 'barcode')} 
                className="text-[11px] font-bold py-3 px-3 cursor-pointer rounded-xl hover:bg-white/5 transition-all flex items-center gap-3"
              >
                <ScanBarcode className="w-4 h-4" />
                Correção com Código de Barras
              </DropdownMenuItem>
    
              <DropdownMenuSeparator className="bg-white/5 mx-1" />
              
              <div className="p-4 space-y-3 bg-white/5 rounded-xl border border-white/5 mt-1">
                <div className="flex items-center justify-between px-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-primary/60">Comando de Produção</p>
                  <Sparkles className="w-3 h-3 text-primary/40" />
                </div>
                <div className="relative group/input">
                  <Textarea 
                    placeholder="Ex: 'Corrija os erros e organize por categorias...'"
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
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
});
