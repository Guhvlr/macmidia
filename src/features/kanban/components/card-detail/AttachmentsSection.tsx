import React, { memo } from "react";
import { Paperclip, ZoomIn, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AttachmentsSectionProps {
  localImages: string[];
  coverImage: string | null;
  setPreviewIndex: (idx: number | null) => void;
  removeImage: (idx: number) => void;
  setAsCover: (url: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleImagesUpload: (files: FileList | null) => void;
}

export const AttachmentsSection = memo( ({
  localImages,
  coverImage,
  setPreviewIndex,
  removeImage,
  setAsCover,
  fileInputRef,
  handleImagesUpload
}: AttachmentsSectionProps) => {
  return (
    <div className="pl-10 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-bold flex items-center gap-2 text-white/90">
          <Paperclip className="w-5 h-5 text-white/60" /> Anexos
        </h3>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => fileInputRef.current?.click()} 
          className="text-xs bg-white/5 hover:bg-white/10 border border-white/5"
        >
          Adicionar
        </Button>
      </div>
      <input 
        ref={fileInputRef} 
        type="file" 
        accept="image/*" 
        multiple 
        className="hidden" 
        onChange={e => handleImagesUpload(e.target.files)} 
      />
      {localImages.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {localImages.map((img, i) => (
            <div key={i} className="group relative rounded-xl overflow-hidden bg-black/40 border border-white/10 aspect-video">
              <img src={img} className="w-full h-full object-cover" alt={`Anexo ${i + 1}`} />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button size="icon" variant="ghost" onClick={() => setPreviewIndex(i)}><ZoomIn className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => removeImage(i)} className="text-red-400"><Trash2 className="w-4 h-4" /></Button>
                {coverImage !== img && (
                  <Button variant="ghost" size="sm" className="text-[10px]" onClick={() => setAsCover(img)}>
                    Usar Capa
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
