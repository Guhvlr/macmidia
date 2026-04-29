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
  const queryMatch = src?.match(/(\?.*)$/);
  const queryParams = queryMatch ? queryMatch[1] : '';
  const baseSrc = (src && !isManual) ? src.replace(/(\?.*)$/, '').replace(/\.(png|jpg|jpeg)$/i, '') : (src || '');
  
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
      // Tenta o PNG limpo primeiro para permitir cache do navegador, mas mantendo o cache buster se existir
      setCurrentUrl(`${baseSrc}.png${queryParams}`);
      setFormat('PNG');
    }
  }, [src, isManual, baseSrc, queryParams]);

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
        <span className="absolute bottom-2 right-2 bg-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-lg shadow-lg border border-purple-400/30">
          PRÉVIA
        </span>
      </div>
    );
  }

  if (format === 'ERROR') {
    return (
       <div className={`bg-zinc-900/50 flex flex-col items-center justify-center gap-2 border border-dashed border-zinc-800 rounded-xl ${className}`}>
         {isFallback ? (
           <>
             <ImageIcon className="w-6 h-6 text-zinc-700" />
             <span className="text-[10px] font-semibold text-zinc-600 text-center leading-tight">Sem Foto</span>
           </>
         ) : (
           <>
             <AlertTriangle className="w-5 h-5 text-amber-500/40" />
             <span className="text-[10px] font-semibold text-zinc-700 text-center leading-tight">Link Quebrado</span>
           </>
         )}
       </div>
    );
  }

  return (
    <div className="relative w-full h-full group/img">
      <img src={currentUrl} onError={handleError} className={className} alt="Produto" crossOrigin="anonymous"/>
      
      {format === 'JPG' && (
        <span className="absolute bottom-1 right-1 bg-amber-500/90 text-amber-950 text-[8px] font-black px-1.5 py-0.5 rounded-md shadow-lg border border-amber-400/30 flex items-center gap-1">
          JPG
        </span>
      )}
      {format === 'PNG' && (
        <span className="absolute bottom-1 right-1 bg-emerald-600/90 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md shadow-lg border border-emerald-400/30 flex items-center gap-1">
          PNG
        </span>
      )}
    </div>
  );
};
