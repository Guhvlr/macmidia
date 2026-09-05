import React, { memo } from "react";
import { CheckSquare, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { ChecklistItem } from '@/contexts/app-types';

interface ChecklistSectionProps {
  checklists: ChecklistItem[];
  checklistProgress: number;
  toggleChecklist: (id: string, completed: boolean) => void;
  deleteChecklistItem: (id: string) => void;
  newChecklistTitle: string;
  setNewChecklistTitle: (title: string) => void;
  addChecklistItem: () => void;
}

export const ChecklistSection = memo( ({
  checklists,
  checklistProgress,
  toggleChecklist,
  deleteChecklistItem,
  newChecklistTitle,
  setNewChecklistTitle,
  addChecklistItem
}: ChecklistSectionProps) => {
  return (
    <div className="pl-10 space-y-4">
      <h3 className="text-[14px] font-bold flex items-center gap-2 text-white/90">
        <CheckSquare className="w-5 h-5 text-white/60" /> Checklist
      </h3>
      {checklists.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-white/40 font-mono w-8 text-right">{checklistProgress}%</span>
            <div className="h-1.5 flex-1 bg-white/5 rounded-full overflow-hidden">
              <div className={`h-full transition-all duration-500 ${checklistProgress === 100 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${checklistProgress}%` }} />
            </div>
          </div>
          <div className="space-y-1">
            {checklists.map(item => (
              <div key={item.id} className="group flex items-start gap-3 py-2 px-2 rounded-lg hover:bg-white/5 transition-colors">
                <Checkbox 
                  checked={item.completed} 
                  onCheckedChange={(c) => toggleChecklist(item.id, c as boolean)} 
                  className="mt-0.5 border-white/20 data-[state=checked]:bg-emerald-500" 
                />
                <span className={`text-[13px] flex-1 ${item.completed ? 'line-through text-white/40' : 'text-white/90'}`}>{item.title}</span>
                <Button variant="ghost" size="icon" onClick={() => deleteChecklistItem(item.id)} className="w-6 h-6 text-white/30 opacity-0 group-hover:opacity-100 hover:text-red-400">
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Input 
          value={newChecklistTitle} 
          onChange={e => setNewChecklistTitle(e.target.value)} 
          onKeyDown={(e) => { if (e.key === 'Enter') addChecklistItem(); }} 
          placeholder="Novo item..." 
          className="bg-white/5 border-white/10 text-sm h-9" 
        />
        <Button onClick={addChecklistItem} variant="secondary" className="h-9 px-4">Add</Button>
      </div>
    </div>
  );
});
