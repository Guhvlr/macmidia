import React, { memo, useState, useRef, useCallback } from "react";
import { MessageSquare, ArrowRight, Plus, Image as ImageIcon, Trash2, Edit3, CheckCircle2, History, Paperclip, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { KanbanCard as KanbanCardType } from '@/contexts/app-types';

interface HistorySectionProps {
  card: KanbanCardType;
  comments: any[];
  newComment: string;
  setNewComment: (txt: string) => void;
  addComment: (images?: string[]) => void;
  getRelativeTime: (isoDate: string) => string;
  hideCommentInput?: boolean;
  onUploadImage?: (file: File) => Promise<string | null>;
}

export const HistorySection = memo( ({
  card,
  comments,
  newComment,
  setNewComment,
  addComment,
  getRelativeTime,
  hideCommentInput = false,
  onUploadImage
}: HistorySectionProps) => {
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleUploadFile = useCallback(async (file: File) => {
    if (!onUploadImage) return;
    setIsUploading(true);
    try {
      const url = await onUploadImage(file);
      if (url) {
        setPendingImages(prev => [...prev, url]);
      }
    } finally {
      setIsUploading(false);
    }
  }, [onUploadImage]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) handleUploadFile(file);
        return;
      }
    }
  }, [handleUploadFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      handleUploadFile(files[i]);
    }
    e.target.value = '';
  }, [handleUploadFile]);

  const removePendingImage = (index: number) => {
    setPendingImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = () => {
    addComment(pendingImages.length > 0 ? pendingImages : undefined);
    setPendingImages([]);
  };

  const canSend = newComment.trim() || pendingImages.length > 0;

  // Detect image URLs in comment text
  const renderCommentContent = (item: any) => {
    const images: string[] = item.images || [];
    return (
      <>
        {item.text && <p className="whitespace-pre-wrap leading-relaxed">{item.text}</p>}
        {images.length > 0 && (
          <div className={`${item.text ? 'mt-2' : ''} flex flex-wrap gap-2`}>
            {images.map((url: string, i: number) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block">
                <img 
                  src={url} 
                  alt="Imagem do comentário" 
                  className="max-w-full rounded-lg border border-white/10 cursor-pointer hover:opacity-90 transition-opacity"
                  style={{ maxHeight: '300px' }}
                />
              </a>
            ))}
          </div>
        )}
      </>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
      <h3 className="text-sm font-bold flex items-center gap-2 px-6 mb-5 text-white/90 sticky top-0 bg-[#1a1a1c] py-4 z-10">
        <MessageSquare className="w-4 h-4 text-white/60" /> Atividade
      </h3>

      {!hideCommentInput && (
      <div className="px-6 mb-6">
        <div className="bg-white/5 p-4 rounded-xl border border-white/5 focus-within:border-white/10 transition-colors shadow-inner">
          <textarea
            placeholder="Escrever comentário... (Cole imagens com Ctrl+V)"
            className="w-full min-h-[100px] text-sm bg-transparent border-none px-2 py-1 text-white/90 focus:outline-none resize-none placeholder:text-white/30"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && canSend) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          
          {/* Pending images preview */}
          {pendingImages.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-white/5">
              {pendingImages.map((url, i) => (
                <div key={i} className="relative group">
                  <img src={url} alt="" className="h-20 rounded-lg border border-white/10 object-cover" />
                  <button 
                    onClick={() => removePendingImage(i)} 
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Upload indicator */}
          {isUploading && (
            <div className="flex items-center gap-2 mt-2 text-xs text-white/50">
              <Loader2 className="w-3 h-3 animate-spin" /> Enviando imagem...
            </div>
          )}

          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-1">
              <button 
                onClick={() => fileInputRef.current?.click()} 
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
                title="Anexar imagem"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <input 
                ref={fileInputRef}
                type="file" 
                accept="image/*" 
                multiple 
                className="hidden" 
                onChange={handleFileSelect}
              />
            </div>
            <Button 
              size="sm" 
              onClick={handleSend} 
              disabled={!canSend} 
              className="bg-white hover:bg-gray-200 text-black h-8 text-xs px-5 rounded-xl font-black shadow-lg"
            >
              Salvar
            </Button>
          </div>
        </div>
      </div>
      )}

      <div className="flex-1 px-6 space-y-6 pb-8">
        {mixed.length === 0 ? (
          <p className="text-[11px] text-white/20 text-center py-8 italic">Nenhuma atividade registrada</p>
        ) : (
          mixed.map(item => {
            if (item.type === 'comment') {
              return (
                <div key={item.id} className="flex gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-[11px] font-black text-white flex-shrink-0 shadow-lg border border-white/10">
                    {item.userName.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-white/90">{item.userName} <span className="font-medium text-white/30 ml-2 tracking-tighter">{getRelativeTime(item.createdAt)}</span></p>
                    <div className="text-sm text-white/80 bg-white/5 border border-white/5 p-4 rounded-2xl rounded-tl-none mt-1.5 leading-relaxed shadow-sm">
                      {renderCommentContent(item)}
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
                  <p className="text-[9px] text-white/30 mt-0.5 font-medium tracking-tight transition-all duration-300">{getRelativeTime(item.createdAt)}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});
