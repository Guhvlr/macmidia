import React, { memo } from "react";
import { Circle, ZoomIn, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { KanbanCard as KanbanCardType, CalendarClient } from '@/contexts/app-types';

interface CardHeaderProps {
  card: KanbanCardType;
  clientName: string;
  setClientName: (name: string) => void;
  calendarClientId: string;
  setCalendarClientId: (id: string) => void;
  calendarClientName: string;
  setCalendarClientName: (name: string) => void;
  calendarClients: CalendarClient[];
  coverImage: string | null;
  setAsCover: (url: string) => void;
  localImages: string[];
  setPreviewIndex: (index: number | null) => void;
  saveUpdates: (updates: Partial<KanbanCardType>, actionDesc?: string) => void;
}

export const CardHeader = memo( ({ 
  card,
  clientName, 
  setClientName, 
  calendarClientId,
  setCalendarClientId,
  calendarClientName,
  setCalendarClientName,
  calendarClients,
  coverImage, 
  setAsCover, 
  localImages, 
  setPreviewIndex, 
  saveUpdates 
}: CardHeaderProps) => {
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  return (
    <div className="flex-shrink-0">
      {/* Title & Status */}
      <div className={`pb-2 flex items-start gap-4 pt-2`}>
        <Circle className="w-6 h-6 text-white/40 flex-shrink-0 mt-1" />
        <div className="flex-1">
          {isEditingTitle ? (
            <Input
              value={clientName}
              autoFocus
              onChange={e => setClientName(e.target.value)}
              onBlur={() => { 
                setIsEditingTitle(false);
                if (clientName !== card.clientName) saveUpdates({ clientName }, 'Alterou o nome do card') 
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  setIsEditingTitle(false);
                  if (clientName !== card.clientName) saveUpdates({ clientName }, 'Alterou o nome do card');
                }
                if (e.key === 'Escape') {
                  setClientName(card.clientName);
                  setIsEditingTitle(false);
                }
              }}
              className="text-2xl font-bold bg-white/5 border-primary/50 px-2 h-auto py-1 rounded-md focus-visible:ring-1 focus-visible:ring-primary shadow-none text-white w-full uppercase"
            />
          ) : (
            <h2 
              onClick={() => setIsEditingTitle(true)}
              className="text-2xl font-bold px-0 hover:bg-white/5 h-auto py-1 rounded-sm text-white w-full uppercase cursor-pointer transition-colors"
            >
              {clientName || 'Sem título'}
            </h2>
          )}
          <div className="flex items-center gap-3 mt-1 pl-0.5">
            <p className="text-xs text-white/40">na coluna <span className="underline decoration-white/20 underline-offset-2 font-medium text-white/60">{card.column}</span></p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/20 uppercase font-bold tracking-widest">•</span>
              <div className="flex items-center gap-2 group/client">
                <span className="text-[10px] text-white/40 uppercase font-bold tracking-widest">Cliente:</span>
                <Select 
                  value={calendarClientId} 
                  onValueChange={(val) => {
                    const client = calendarClients.find(c => c.id === val);
                    setCalendarClientId(val);
                    setCalendarClientName(client?.name || '');
                    saveUpdates({ calendarClientId: val, calendarClientName: client?.name }, `Vinculou ao cliente: ${client?.name || 'Nenhum'}`);
                  }}
                >
                  <SelectTrigger className="h-6 bg-transparent border-transparent hover:bg-white/5 text-[11px] font-bold text-orange-500/80 uppercase tracking-wide px-2 rounded-md focus:ring-0">
                    <SelectValue placeholder="Sem cliente vinculado" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1c] border-white/10">
                    {calendarClients.map(client => (
                      <SelectItem key={client.id} value={client.id} className="text-xs">{client.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
