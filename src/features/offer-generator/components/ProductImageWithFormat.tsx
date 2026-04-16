import React, { useState, useEffect } from 'react';
import { AlertTriangle, ImageIcon, Crop } from 'lucide-react';

export interface ProductImageWithFormatProps {
  src: string;
  className?: string;
  onFormatChange?: (format: 'PNG' | 'JPG' | 'ERROR' | 'MANUAL') => void;
  onUrlResolved?: (url: string) => void;
  previewBase64?: string;
  isFallback?: boolean;
}

export const ProductImageWithFormat = ({
  src,
  className = "w-full h-full object-contain p-1",
  onFormatChange,
  onUrlResolved,
  previewBase64,
  isFallback
}: ProductImageWithFormatProps) => {
  const isManual = src?.startsWith('blob:') || src?.startsWith('data:');
  const baseSrc = (src && !isManual) ? src.split('?')[0].replace(/\.(png|jpg|jpeg)$/i, '') : (src || '');
  
  const [currentUrl, setCurrentUrl] = useState<string>(src || '');
  const [format, setFormat] = useState<'PNG' | 'JPG' | 'ERROR' | 'MANUAL'>(isManual ? 'MANUAL' : (src ? 'PNG' : 'ERROR'));

  useEffect(() => {
    if (!src) {
      setFormat('ERROR');
      return;
    }
    if (isManual) {
      setCurrentUrl(src);
      setFormat('MANUAL');
    } else {
      // Começa sempre tentando o PNG
      setCurrentUrl(`${baseSrc}.png?t=${Date.now()}`);
      setFormat('PNG');
    }
  }, [src, isManual, baseSrc]);

  const onFormatChangeRef = React.useRef(onFormatChange);
  const onUrlResolvedRef = React.useRef(onUrlResolved);

  useEffect(() => {
    onFormatChangeRef.current = onFormatChange;
  }, [onFormatChange]);

  useEffect(() => {
    onUrlResolvedRef.current = onUrlResolved;
  }, [onUrlResolved]);

  useEffect(() => {
    if (onFormatChangeRef.current) onFormatChangeRef.current(format);
  }, [format]);

  useEffect(() => {
    if (onUrlResolvedRef.current && format !== 'ERROR') {
      onUrlResolvedRef.current(currentUrl);
    }
  }, [currentUrl, format]);

  const handleError = () => {
    if (isManual) {
      setFormat('ERROR');
      return;
    }

    const formats = ['PNG', 'JPG', 'WEBP', 'JPEG', 'PNG_UPPER', 'JPG_UPPER'];
    const currentIndex = formats.indexOf(format);
    const nextFormat = formats[currentIndex + 1];

    if (nextFormat) {
      let ext = nextFormat.toLowerCase().replace('_upper', '');
      if (nextFormat.includes('_upper')) {
        ext = ext.toUpperCase();
      }
      setCurrentUrl(`${baseSrc}.${ext}?t=${Date.now()}`);
      setFormat(nextFormat as any);
    } else {
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
         {isFallback ? (
           <>
             <ImageIcon className="w-5 h-5 text-white/10" />
             <span className="text-[6px] font-bold text-white/20 uppercase text-center leading-tight tracking-widest">Sem Foto</span>
           </>
         ) : (
           <>
             <AlertTriangle className="w-4 h-4 text-amber-500/40" />
             <span className="text-[6px] font-bold text-white/15 uppercase text-center leading-tight">Link Quebrado</span>
           </>
         )}
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
