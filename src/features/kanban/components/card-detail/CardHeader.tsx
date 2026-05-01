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
  return (
    <div className="flex-shrink-0">
      {/* Cover Image */}
      {coverImage && (
        <div className="w-full h-48 bg-black/50 relative overflow-hidden group">
          {/* Background Blur layer */}
          <img src={coverImage} alt="" className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-40 scale-110" />
          {/* Main image layer */}
          <img src={coverImage} alt="Capa" className="relative w-full h-full object-contain p-2" />
          <button
            onClick={() => {
              const idx = localImages.indexOf(coverImage);
              setPreviewIndex(idx >= 0 ? idx : 0);
            }}
            className="absolute inset-0 w-full h-full flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity"
          >
            <ZoomIn className="w-8 h-8 text-white/70" />
          </button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAsCover('')}
            className="absolute bottom-3 right-3 bg-black/60 hover:bg-black text-xs text-white rounded-lg border border-white/10"
          >
            Remover capa
          </Button>
        </div>
      )}

      {/* Title & Status */}
      <div className={`px-6 md:px-8 pb-2 flex items-start gap-4 ${coverImage ? 'pt-6' : 'pt-2'}`}>
        <Circle className="w-6 h-6 text-white/40 flex-shrink-0 mt-1" />
        <div className="flex-1">
          <Input
            value={clientName}
            onChange={e => setClientName(e.target.value)}
            onBlur={() => { if (clientName !== card.clientName) saveUpdates({ clientName }, 'Alterou o nome do card') }}
            className="text-2xl font-bold bg-transparent border-transparent px-0 hover:bg-white/5 focus-visible:bg-white/5 h-auto py-1 rounded-sm focus-visible:ring-0 shadow-none text-white w-full uppercase"
          />
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
