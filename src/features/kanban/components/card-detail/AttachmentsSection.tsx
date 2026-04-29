import React, { memo, useState } from "react";
import { Paperclip, ZoomIn, Trash2, Download, FileText, FileSpreadsheet, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';

interface AttachmentsSectionProps {
  localImages: string[];
  coverImage: string | null;
  setPreviewIndex: (idx: number | null) => void;
  removeImage: (idx: number) => void;
  removeAllImages: () => void;
  setAsCover: (url: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleImagesUpload: (files: FileList | null) => void;
  reorderImages: (newImages: string[]) => void;
}

const isPdf = (url: string) => url.toLowerCase().includes('pdf') || url.toLowerCase().endsWith('.pdf');
const isExcel = (url: string) => url.toLowerCase().includes('spreadsheet') || url.toLowerCase().includes('excel') || url.toLowerCase().includes('sheet') || url.match(/\.(xls|xlsx|csv|ods)$/i);
const isWord = (url: string) => url.toLowerCase().includes('word') || url.toLowerCase().includes('officedocument.word') || url.toLowerCase().includes('msword') || url.toLowerCase().includes('opendocument.text') || url.match(/\.(doc|docx|odt|rtf)$/i);
const isImage = (url: string) => url.startsWith('data:image') || url.match(/\.(jpeg|jpg|gif|png|webp)$/i);

export const AttachmentsSection = memo(({
  localImages,
  coverImage,
  setPreviewIndex,
  removeImage,
  removeAllImages,
  setAsCover,
  fileInputRef,
  handleImagesUpload,
  reorderImages
}: AttachmentsSectionProps) => {
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [deleteConfirmIdx, setDeleteConfirmIdx] = useState<number | null>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDraggedIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;
    const newItems = [...localImages];
    const [movedItem] = newItems.splice(draggedIdx, 1);
    newItems.splice(idx, 0, movedItem);
    reorderImages(newItems);
    setDraggedIdx(null);
  };

  const downloadAttachment = async (url: string, index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      toast.loading('Preparando download...', { id: `dl-${index}` });
      const res = await fetch(url);
      const blob = await res.blob();
      
      // Tentar extrair a extensão do URL se possível
      let ext = url.split('.').pop()?.split('?')[0] || '';
      if (!ext || ext.length > 4) {
        ext = isPdf(url) ? 'pdf' : isExcel(url) ? 'xlsx' : isWord(url) ? 'docx' : (blob.type.split('/')[1]?.split('.').pop() || 'file');
      }
      
      saveAs(blob, `Anexo_${index + 1}.${ext}`);
      toast.success('Download concluído', { id: `dl-${index}` });
    } catch (err) {
      toast.error('Erro ao baixar', { id: `dl-${index}` });
    }
  };

  const downloadAll = async () => {
    if (localImages.length === 0) return;
    try {
      toast.loading('Compactando anexos...', { id: 'dl-all' });
      const zip = new JSZip();
      for (let i = 0; i < localImages.length; i++) {
        const url = localImages[i];
        const res = await fetch(url);
        const blob = await res.blob();
        const ext = isPdf(url) ? 'pdf' : isExcel(url) ? 'xlsx' : isWord(url) ? 'docx' : (blob.type.split('/')[1] || 'jpg');
        zip.file(`Anexo_${i + 1}.${ext}`, blob);
      }
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `Anexos_${Date.now()}.zip`);
      toast.success('Download concluído', { id: 'dl-all' });
    } catch (err) {
      toast.error('Erro ao baixar todos', { id: 'dl-all' });
    }
  };

  const confirmDelete = (idx: number) => {
    removeImage(idx);
    setDeleteConfirmIdx(null);
  };

  const confirmDeleteAll = () => {
    removeAllImages();
    setShowDeleteAllConfirm(false);
  };

  return (
    <div className="pl-10 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-bold flex items-center gap-2 text-white/90">
          <Paperclip className="w-5 h-5 text-white/60" /> Anexos
        </h3>
        <div className="flex gap-2">
          {localImages.length > 0 && (
            <>
              {!showDeleteAllConfirm ? (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowDeleteAllConfirm(true)} 
                  className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-full px-4"
                >
                  Excluir Todos
                </Button>
              ) : (
                <div className="flex items-center gap-1.5 animate-in slide-in-from-right-2">
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={confirmDeleteAll} 
                    className="text-[10px] h-7 bg-red-600 hover:bg-red-700 font-bold rounded-full px-3"
                  >
                    CONFIRMAR TUDO
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setShowDeleteAllConfirm(false)} 
                    className="h-7 text-[10px] text-white/40 hover:text-white"
                  >
                    Cancelar
                  </Button>
                </div>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={downloadAll} 
                className="text-xs bg-white/5 hover:bg-white/10 border border-white/5 rounded-full px-4"
              >
                Baixar Todos
              </Button>
            </>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => fileInputRef.current?.click()} 
            className="text-xs bg-white/5 hover:bg-white/10 border border-white/5 rounded-full px-4"
          >
            Adicionar
          </Button>
        </div>
      </div>
      <input 
        ref={fileInputRef} 
        type="file" 
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" 
        multiple 
        className="hidden" 
        onChange={e => handleImagesUpload(e.target.files)} 
      />
      {localImages.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {localImages.map((img, i) => {
             const isImg = isImage(img);
             const isP = isPdf(img);
             const isE = isExcel(img);
             const isW = isWord(img);
             return (
              <div 
                key={i} 
                draggable
                onDragStart={(e) => handleDragStart(e, i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDrop={(e) => handleDrop(e, i)}
                className={`group relative rounded-xl overflow-hidden bg-black/40 border border-white/10 aspect-video cursor-grab active:cursor-grabbing ${draggedIdx === i ? 'opacity-50' : ''}`}
              >
                {isImg ? (
                  <img src={img} className="w-full h-full object-cover" alt={`Anexo ${i + 1}`} />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-[#1a1a1c] p-4 text-center">
                     {isP ? <FileText className="w-8 h-8 text-red-400 mb-2" /> : isE ? <FileSpreadsheet className="w-8 h-8 text-green-400 mb-2" /> : isW ? <FileText className="w-8 h-8 text-blue-400 mb-2" /> : <File className="w-8 h-8 text-white/50 mb-2" />}
                     <span className="text-[10px] text-white/70 font-medium line-clamp-1 truncate w-full mb-1 px-2">
                       {decodeURIComponent(img.split('/').pop()?.split('-').slice(1).join('-') || 'Arquivo')}
                     </span>
                     <span className="text-[9px] text-white/30 uppercase tracking-widest">{isP ? 'PDF' : isE ? 'Excel' : isW ? 'Word' : 'Arquivo'}</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {deleteConfirmIdx !== i ? (
                    <>
                      {isImg && <Button size="icon" variant="ghost" onClick={() => setPreviewIndex(i)}><ZoomIn className="w-4 h-4" /></Button>}
                      <Button size="icon" variant="ghost" onClick={(e) => downloadAttachment(img, i, e)}><Download className="w-4 h-4 text-white" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteConfirmIdx(i)} className="text-red-400"><Trash2 className="w-4 h-4" /></Button>
                      {isImg && coverImage !== img && (
                        <Button variant="ghost" size="sm" className="text-[10px]" onClick={() => setAsCover(img)}>
                          Usar Capa
                        </Button>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-2 p-2 animate-in zoom-in-95 duration-200">
                      <p className="text-[10px] font-bold text-white uppercase tracking-tighter">Excluir?</p>
                      <div className="flex gap-1">
                        <Button 
                          size="sm" 
                          variant="destructive" 
                          className="h-7 px-3 text-[9px] font-bold bg-red-600"
                          onClick={() => confirmDelete(i)}
                        >
                          SIM
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-7 px-3 text-[9px] text-white/60"
                          onClick={() => setDeleteConfirmIdx(null)}
                        >
                          NÃO
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}


    </div>
  );
});
