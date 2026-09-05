import React from 'react';
import { Button } from '@/components/ui/button';
import { Send, X, FileSpreadsheet, Loader2, Image, Clock, Package } from 'lucide-react';

interface InboxMessage {
  id: string;
  sender_name: string;
  message_text: string;
  message_type: string;
  media_url: string | null;
  media_mime_type: string | null;
  created_at: string;
}

interface InboxMessageCardProps {
  msg: InboxMessage;
  idx: number;
  onOpenSend: (msg: InboxMessage) => void;
  onDismiss: (id: string) => void;
  onExtract: (msg: InboxMessage) => void;
  extractingId: string | null;
  formatTime: (date: string) => string;
  getTypeIcon: (msg: InboxMessage) => React.ReactNode;
  getTypeLabel: (type: string) => string;
  isExcelOrWord: (msg: InboxMessage) => boolean;
}

export const InboxMessageCard = ({
  msg,
  idx,
  onOpenSend,
  onDismiss,
  onExtract,
  extractingId,
  formatTime,
  getTypeIcon,
  getTypeLabel,
  isExcelOrWord
}: InboxMessageCardProps) => {
  const isExcel = isExcelOrWord(msg);

  return (
    <div
      className="bg-white/[0.03] border border-white/5 rounded-2xl p-5 hover:border-white/10 hover:bg-white/[0.05] transition-all animate-in fade-in slide-in-from-bottom-2 duration-300 group"
      style={{ animationDelay: `${idx * 0.05}s` }}
    >
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400 font-bold text-sm shrink-0 uppercase">
          {(msg.sender_name || '?').substring(0, 2)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-sm font-bold text-white truncate">{msg.sender_name || 'Desconhecido'}</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-white/30 font-bold uppercase flex items-center gap-1">
              {getTypeIcon(msg)} {getTypeLabel(msg.message_type)}
            </span>
            <span className="text-[10px] text-white/20 ml-auto flex items-center gap-1">
              <Clock className="w-3 h-3" /> {formatTime(msg.created_at)}
            </span>
          </div>
          <p className="text-sm text-white/60 leading-relaxed line-clamp-4 whitespace-pre-wrap">
            {msg.message_text || `[${getTypeLabel(msg.message_type)} recebido sem texto]`}
          </p>
          {msg.media_url && (
            <div className="mt-3 flex items-center gap-2 text-[10px] text-white/30">
              <Image className="w-3.5 h-3.5" />
              <span className="uppercase font-bold tracking-wider">Mídia anexada</span>
            </div>
          )}
        </div>

        {/* ✅ Botões de ação */}
        <div className="flex flex-col gap-2 opacity-60 group-hover:opacity-100 transition-opacity shrink-0">
          {/* Botão Extrair Arquivo — abre modal de modo */}
          {msg.message_type === 'document' && isExcel && (
            <Button
              onClick={() => onExtract(msg)}
              disabled={extractingId === msg.id}
              className="h-10 px-4 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-lg flex items-center justify-center gap-2"
            >
              {extractingId === msg.id
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Package className="w-3.5 h-3.5" />
              }
              {extractingId === msg.id ? 'Extraindo...' : 'Extrair Arquivo'}
            </Button>
          )}

          <Button
            onClick={() => onOpenSend(msg)}
            className="h-10 px-5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-green-900/30 flex items-center justify-center gap-2"
          >
            <Send className="w-3.5 h-3.5" /> Enviar ao Kanban
          </Button>

          <Button
            variant="ghost"
            onClick={() => onDismiss(msg.id)}
            className="h-9 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1"
          >
            <X className="w-3 h-3" /> Descartar
          </Button>
        </div>
      </div>
    </div>
  );
};
