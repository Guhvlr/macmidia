import React, { memo } from "react";
import { X, Plus, Sparkles, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Timer from '../Timer';
import type { KanbanCard as KanbanCardType } from '@/contexts/app-types';

interface MembersSectionProps {
  card: KanbanCardType;
  labels: string[];
  removeLabel: (label: string) => void;
  newLabelText: string;
  setNewLabelText: (txt: string) => void;
  addLabel: () => void;
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
  saveUpdates
}: MembersSectionProps) => {
  return (
    <div className="pl-10 flex flex-wrap items-start gap-8">
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

      {/* Timer */}
      <div className="flex flex-col">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-2">Tempo Gasto</h3>
        <div className="bg-white/5 px-3 py-1.5 rounded flex items-center w-fit border border-white/10">
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
    </div>
  );
});
