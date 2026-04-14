import React, { useState, useEffect } from 'react';
import { AlertTriangle, ImageIcon, Crop } from 'lucide-react';

export interface ProductImageWithFormatProps {
  src: string;
  className?: string;
  onFormatChange?: (format: 'PNG' | 'JPG' | 'ERROR' | 'MANUAL') => void;
  onUrlResolved?: (url: string) => void;
  previewBase64?: string;
}

export const ProductImageWithFormat = ({
  src,
  className = "w-full h-full object-contain p-1",
  onFormatChange,
  onUrlResolved,
  previewBase64
}: ProductImageWithFormatProps) => {
  const isManual = src.startsWith('blob:') || src.startsWith('data:');
  const baseSrc = !isManual ? src.split('?')[0].replace(/\.(png|jpg|jpeg)$/i, '') : src;
  
  const [currentUrl, setCurrentUrl] = useState<string>(src);
  const [format, setFormat] = useState<'PNG' | 'JPG' | 'ERROR' | 'MANUAL'>(isManual ? 'MANUAL' : 'PNG');

  useEffect(() => {
    if (isManual) {
      setCurrentUrl(src);
      setFormat('MANUAL');
    } else {
      // Começa sempre tentando o PNG
      setCurrentUrl(`${baseSrc}.png?t=${Date.now()}`);
      setFormat('PNG');
    }
  }, [src, isManual, baseSrc]);

  useEffect(() => {
    if (onFormatChange) onFormatChange(format);
  }, [format, onFormatChange]);

  useEffect(() => {
    if (onUrlResolved && format !== 'ERROR') {
      onUrlResolved(currentUrl);
    }
  }, [currentUrl, format, onUrlResolved]);

  const handleError = () => {
    if (format === 'PNG' && !isManual) {
      // Se falhou o PNG, tenta o JPG
      setCurrentUrl(`${baseSrc}.jpg?t=${Date.now()}`);
      setFormat('JPG');
    } else if (format === 'JPG' && !isManual) {
      setFormat('ERROR');
    }
  };

  if (previewBase64) {
    return (
      <div className="relative w-full h-full group/preview">
        <img src={previewBase64} className={className} alt="Preview" />
        <span className="absolute bottom-0 right-0 bg-purple-500/90 text-white text-[7px] font-black px-1.5 rounded-tl-lg uppercase tracking-widest border-t border-l border-purple-400">
          PRÉVIA
        </span>
      </div>
    );
  }

  if (format === 'ERROR') {
    return (
       <div className={`bg-white/5 flex flex-col items-center justify-center gap-1 border border-dashed border-white/10 ${className}`}>
         <AlertTriangle className="w-4 h-4 text-amber-500/40" />
         <span className="text-[6px] font-bold text-white/15 uppercase text-center leading-tight">Link Quebrado</span>
       </div>
    );
  }

  return (
    <div className="relative w-full h-full group/img">
      <img src={currentUrl} onError={handleError} className={className} alt="Produto" crossOrigin="anonymous"/>
      
      {format === 'JPG' && (
        <span className="absolute bottom-0 right-0 bg-red-500/90 text-white text-[7px] font-black px-1.5 rounded-tl-lg uppercase tracking-widest border-t border-l border-red-400 flex items-center gap-0.5 shadow-md">
          <ImageIcon className="w-2 h-2" /> JPG
        </span>
      )}
      {format === 'PNG' && (
        <span className="absolute bottom-0 right-0 bg-green-500/90 text-white text-[7px] font-black px-1.5 rounded-tl-lg uppercase tracking-widest border-t border-l border-green-400 flex items-center gap-0.5 shadow-md">
          <Crop className="w-2 h-2" /> PNG
        </span>
      )}
    </div>
  );
};
