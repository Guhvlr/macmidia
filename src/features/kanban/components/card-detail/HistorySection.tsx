import React, { memo } from "react";
import { MessageSquare, ArrowRight, Plus, Image as ImageIcon, Trash2, Edit3, CheckCircle2, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { KanbanCard as KanbanCardType } from '@/contexts/app-types';

interface HistorySectionProps {
  card: KanbanCardType;
  comments: any[];
  newComment: string;
  setNewComment: (txt: string) => void;
  addComment: () => void;
  getRelativeTime: (isoDate: string) => string;
}

export const HistorySection = memo( ({
  card,
  comments,
  newComment,
  setNewComment,
  addComment,
  getRelativeTime
}: HistorySectionProps) => {
  const mixed: any[] = [
    ...comments.map(c => ({ ...c, type: 'comment' })),
    ...(card.history || []).map(h => ({ ...h, type: 'history' }))
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const iconMap: any = { 
    move: <ArrowRight className="w-3.5 h-3.5 text-blue-400" />, 
    create: <Plus className="w-3.5 h-3.5 text-emerald-400" />, 
    image_add: <ImageIcon className="w-3.5 h-3.5 text-sky-400" />, 
    image_remove: <Trash2 className="w-3.5 h-3.5 text-red-400" />, 
    edit: <Edit3 className="w-3.5 h-3.5 text-amber-400" />, 
    status_change: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
      <h3 className="text-sm font-bold flex items-center gap-2 px-6 mb-5 text-white/90 sticky top-0 bg-[#1a1a1c] py-4 z-10">
        <MessageSquare className="w-4 h-4 text-white/60" /> Atividade
      </h3>

      <div className="px-6 mb-6">
        <div className="bg-white/5 p-3 rounded-xl border border-white/5 focus-within:border-white/10 transition-colors shadow-inner">
          <Textarea
            placeholder="Escrever comentário..."
            className="min-h-[60px] text-[13px] bg-transparent border-none px-2 py-1 focus-visible:ring-0 resize-none placeholder:text-white/30"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
          />
          <div className="flex justify-end mt-2">
            <Button 
              size="sm" 
              onClick={addComment} 
              disabled={!newComment.trim()} 
              className="bg-white hover:bg-gray-200 text-black h-7 text-xs px-4 rounded-xl font-black shadow-lg"
            >
              Salvar
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 space-y-6 pb-8">
        {mixed.length === 0 ? (
          <p className="text-[11px] text-white/20 text-center py-8 italic">Nenhuma atividade registrada</p>
        ) : (
          mixed.map(item => {
            if (item.type === 'comment') {
              return (
                <div key={item.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-[11px] font-black text-white flex-shrink-0 shadow-lg border border-white/10">
                    {item.userName.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-[11px] font-black text-white/90">{item.userName} <span className="font-medium text-white/30 ml-2 tracking-tighter">{getRelativeTime(item.createdAt)}</span></p>
                    <div className="text-[12px] text-white/80 bg-white/5 border border-white/5 p-3 rounded-2xl rounded-tl-none mt-1.5 whitespace-pre-wrap leading-relaxed shadow-sm">
                      {item.text}
                    </div>
                  </div>
                </div>
              );
            }
            return (
              <div key={item.id} className="flex gap-3 items-start opacity-70 group/hist">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white/50 mt-0.5 bg-white/[0.03] border border-white/5 group-hover/hist:bg-white/[0.05] transition-colors">
                  {iconMap[item.actionType] || <History className="w-3.5 h-3.5" />}
                </div>
                <div className="text-[11px] text-white/50 flex-1 pt-1">
                  <span className="font-bold text-white/80">{item.userName}</span> {item.description}
                  <p className="text-[9px] text-white/20 mt-1 font-medium tracking-tight h-0 overflow-hidden group-hover/hist:h-3 transition-all duration-300">{getRelativeTime(item.createdAt)}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});
