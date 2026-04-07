import React, { memo } from "react";
import { X, Plus, Sparkles, CheckCircle2, Clock, Send, Edit3, LayoutList } from 'lucide-react';
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
import Timer from '../Timer';
import type { KanbanCard as KanbanCardType } from '@/contexts/app-types';

interface MembersSectionProps {
  card: KanbanCardType;
  labels: string[];
  removeLabel: (label: string) => void;
  newLabelText: string;
  setNewLabelText: (txt: string) => void;
  addLabel: () => void;
  triggerAICorrection: (id: string) => void;
  fixDescriptionWithAI: (id: string, mode: 'keep_sequence' | 'organize') => void;
  customAICommand: (id: string, prompt: string) => void;
  assignedUsers: any[];
  toggleAssignee: (member: any) => void;
  showMembersSelection: boolean;
  setShowMembersSelection: (show: boolean) => void;
  membersSelectionRef: React.RefObject<HTMLDivElement>;
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
  membersSelectionRef,
  employees,
  systemUsers,
  saveUpdates,
  triggerAICorrection,
  fixDescriptionWithAI,
  customAICommand
}: MembersSectionProps) => {
  return (
    <div className="pl-2 flex flex-col gap-6 w-full">
      <div className="flex flex-wrap items-start gap-8">
        {/* Labels */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-2">Etiquetas</h3>
          <div className="flex flex-wrap gap-2">
            {labels.map(l => (
              <span key={l} className="group flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold tracking-wider text-white rounded bg-red-600/90 hover:bg-red-600 transition-colors cursor-pointer">
                {l}
                <X className="w-3 h-3 opacity-0 group-hover:opacity-100 hover:text-white/70" onClick={() => removeLabel(l)} />
              </span>
            ))}
            <div className="flex items-center gap-1">
              <Input
                value={newLabelText}
                onChange={e => setNewLabelText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addLabel(); }}
                placeholder="Adicionar..."
                className="w-24 h-7 text-[10px] bg-white/5 border-white/10 rounded px-2 focus-visible:ring-0 text-white"
              />
            </div>
          </div>
        </div>

        {/* Members */}
        <div className="flex flex-col">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-2">Membros</h3>
          <div className="flex flex-wrap items-center gap-2">
            {assignedUsers.map(u => (
              <div key={u.id} className="relative group/member">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-600 to-rose-700 font-bold text-white text-[10px] flex items-center justify-center flex-shrink-0 shadow-inner group-hover/member:opacity-80 transition cursor-pointer overflow-hidden border border-white/10" title={u.fullName}>
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
            
            <div className="relative" ref={membersSelectionRef}>
              <Button 
                variant="ghost" 
                onClick={() => setShowMembersSelection(!showMembersSelection)}
                className={`w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 p-0 shadow flex items-center justify-center transition-all ${showMembersSelection ? 'bg-primary/20 text-primary border-primary/40 rotate-45' : ''}`}
              >
                <Plus className="w-4 h-4" />
              </Button>

              {showMembersSelection && (
                <div className="absolute top-10 left-0 w-72 glass-card border-white/20 p-2 shadow-[0_20px_60px_rgba(0,0,0,1)] z-[99999] animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 mb-2">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40">Equipe Mac Mídia</h4>
                    <Sparkles className="w-3.5 h-3.5 text-primary/40" />
                  </div>
                  
                  <div className="max-h-80 overflow-y-auto custom-scrollbar pr-1.5 space-y-1">
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
                </div>
              )}
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
              
              {/* <DropdownMenuItem 
                onClick={() => triggerAICorrection(card.id)} 
                className="text-[11px] font-bold py-3 px-3 cursor-pointer rounded-xl hover:bg-primary/10 hover:text-primary transition-all flex items-center gap-3"
              >
                <CheckCircle2 className="w-4 h-4" />
                Auditoria de Imagens
              </DropdownMenuItem> */}
    
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
