import React, { useRef, useState, useEffect } from 'react';
import { useOffer, ProductItem } from '../context/OfferContext';
import { supabase } from '@/integrations/supabase/client';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { Loader2, Download, CheckCircle, Monitor, Smartphone, FileIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export const StepFinal = () => {
  const { config, slots, products, pageCount, priceBadge, descConfig, imageConfig, customFonts } = useOffer();
  const svgRefs = useRef<(SVGSVGElement | null)[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previews, setPreviews] = useState<string[]>([]);

  const toBase64 = async (url: string): Promise<string> => {
    if (!url) return '';
    if (url.startsWith('data:')) return url;
    try {
      const resp = await fetch(url, { mode: 'cors' });
      const blob = await resp.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch (e) { 
      console.warn('Erro ao converter imagem para base64:', url, e);
      return url; // Fallback to original URL if base64 fails
    }
  };

  const processSvgForExport = async (svg: SVGSVGElement) => {
    const clone = svg.cloneNode(true) as SVGSVGElement;
    const images = clone.querySelectorAll('image');
    clone.setAttribute('width', config.width.toString());
    clone.setAttribute('height', config.height.toString());
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

    for (const img of Array.from(images)) {
      const href = img.getAttribute('href') || img.getAttribute('xlink:href');
      if (href && (href.startsWith('http') || href.startsWith('blob'))) {
        const base64 = await toBase64(href);
        img.setAttribute('href', base64);
        img.setAttribute('xlink:href', base64);
      }
    }
    return clone;
  };

  const exportAll = async (format: 'svg' | 'png') => {
    setIsProcessing(true);
    try {
      const zip = new JSZip();
      const pages = Array.from({ length: pageCount });

      for (let i = 0; i < pages.length; i++) {
        const svg = svgRefs.current[i];
        if (!svg) continue;
        const processedClone = await processSvgForExport(svg);
        const svgData = new XMLSerializer().serializeToString(processedClone);

        if (format === 'svg') {
          zip.file(`tela_${i + 1}.svg`, svgData);
        } else {
          const canvas = document.createElement('canvas');
          canvas.width = config.width; canvas.height = config.height;
          const ctx = canvas.getContext('2d')!;
          const img = new Image();
          img.crossOrigin = 'anonymous';
          const url = URL.createObjectURL(new Blob([svgData], { type: 'image/svg+xml' }));
          await new Promise<void>(r => { 
            img.onload = () => { ctx.drawImage(img, 0, 0); URL.revokeObjectURL(url); r(); }; 
            img.src = url; 
          });
          zip.file(`tela_${i + 1}.png`, canvas.toDataURL('image/png').split(',')[1], { base64: true });
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `tabloide_macmidia_${format}.zip`);
      toast.success('Download concluído!');
    } catch (e) {
      console.error(e);
      toast.error('Erro na exportação');
    } finally {
      setIsProcessing(false);
    }
  };

  const renderProduct = (product: ProductItem, slot: any) => {
    if (!product) return null;
    
    // Calculate central position within slot
    const slotCenterX = slot.x + slot.width / 2;
    const slotCenterY = slot.y + slot.height / 2;

    // Image positions
    const imgWidth = slot.width * 0.8 * imageConfig.scale;
    const imgHeight = slot.height * 0.6 * imageConfig.scale;
    const imgX = slotCenterX - imgWidth / 2 + (imageConfig.offsetX - 50) * (slot.width / 100);
    const imgY = slotCenterY - imgHeight / 2 - slot.height * 0.15 + (imageConfig.offsetY - 50) * (slot.height / 100);

    const REF_W = 500;
    const sFactor = slot.width / REF_W;

    // Badge positions (centered around the offset point)
    const badgeW = priceBadge.badgeWidth * sFactor;
    const badgeH = priceBadge.badgeHeight * sFactor;
    const badgePosX = slot.x + (priceBadge.badgeOffsetX / 100) * slot.width;
    const badgePosY = slot.y + (priceBadge.badgeOffsetY / 100) * slot.height;
    // Actually, original badge logic in StepGenerate was slightly different, let's keep it consistent.

    return (
      <g key={product.id}>
        {/* Images Stack */}
        {(product.images || []).slice(0, 3).reverse().map((img, i, arr) => {
          const total = arr.length;
          const index = total - 1 - i; // reverse index
          const offset = index * 20; // 20px offset per image in stack
          return (
            <image 
              key={`${product.id}-img-${index}`}
              href={img} 
              x={imgX + offset} 
              y={imgY - offset / 2} 
              width={imgWidth} 
              height={imgHeight} 
              preserveAspectRatio="xMidYMid meet"
              style={{ filter: index > 0 ? 'drop-shadow(0 4px 6px rgba(0,0,0,0.2))' : 'none' }}
            />
          );
        })}

        {/* Product Name / Description */}
        <g transform={`translate(${slot.x + (descConfig.offsetX / 100) * slot.width}, ${slot.y + (descConfig.offsetY / 100) * slot.height})`}>
          {descConfig.showBg && (
            <rect x={-slot.width * 0.4} y={-descConfig.fontSize * sFactor * 0.7} width={slot.width * 0.8} height={descConfig.fontSize * sFactor * 1.4} fill={descConfig.bgColor} rx={4} />
          )}
          <text 
            textAnchor="middle" 
            dominantBaseline="middle"
            fill={descConfig.color}
            style={{ 
              fontSize: `${descConfig.fontSize * sFactor}px`, 
              fontFamily: descConfig.fontFamily,
              fontWeight: '900',
              textTransform: descConfig.uppercase ? 'uppercase' : 'none',
              letterSpacing: '-0.02em'
            }}
          >
            {product.name.slice(0, descConfig.maxChars)}
          </text>
        </g>

        {/* Price Badge */}
        <g transform={`translate(${badgePosX}, ${badgePosY})`}>
           {priceBadge.badgeImageUrl ? (
             <image href={priceBadge.badgeImageUrl} x={-badgeW/2} y={-badgeH/2} width={badgeW} height={badgeH} />
           ) : (
             <rect x={-badgeW/2} y={-badgeH/2} width={badgeW} height={badgeH} fill={priceBadge.bgColor} rx={priceBadge.borderRadius * sFactor} />
           )}
           
           <text 
             x={-badgeW/2 + (priceBadge.currencyOffsetX / 100) * badgeW} 
             y={-badgeH/2 + (priceBadge.currencyOffsetY / 100) * badgeH} 
             fill={priceBadge.currencyColor} 
             style={{ fontSize: (priceBadge.currencyFontSize * sFactor), fontFamily: priceBadge.currencyFontFamily, fontWeight: '900' }}
           >
             R$
           </text>
           
           <text 
             x={-badgeW/2 + (priceBadge.valueOffsetX / 100) * badgeW} 
             y={-badgeH/2 + (priceBadge.valueOffsetY / 100) * badgeH + (priceBadge.valueFontSize * sFactor * 0.15)} 
             fill={priceBadge.valueColor} 
             textAnchor="middle" 
             style={{ fontSize: (priceBadge.valueFontSize * sFactor), fontFamily: priceBadge.valueFontFamily, fontWeight: '900', letterSpacing: '-0.05em' }}
           >
             {product.price.replace('R$', '').trim()}
           </text>

           {priceBadge.showSuffix && (
             <text 
               x={-badgeW/2 + (priceBadge.suffixOffsetX / 100) * badgeW} 
               y={-badgeH/2 + (priceBadge.suffixOffsetY / 100) * badgeH} 
               fill={priceBadge.suffixColor} 
               textAnchor="middle" 
               style={{ fontSize: (priceBadge.suffixFontSize * sFactor), fontWeight: 'bold' }}
             >
               {priceBadge.suffixText}
             </text>
           )}
        </g>
      </g>
    );
  };

  return (
    <div className="h-full flex flex-col bg-[#09090b]">
      {/* Top Header Final */}
      <div className="p-6 border-b border-white/5 bg-[#0d0d10] flex items-center justify-between">
         <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <div>
               <h2 className="text-sm font-black uppercase tracking-widest text-white">Artes Prontas para Exportação</h2>
               <p className="text-[10px] text-white/30 font-bold uppercase tracking-wider">{pageCount} telas geradas com sucesso</p>
            </div>
         </div>
         <div className="flex gap-3">
            <Button onClick={() => exportAll('svg')} disabled={isProcessing} className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl h-11 px-6 text-[10px] font-black uppercase tracking-widest">
               <FileIcon className="w-4 h-4 mr-2" /> Exportar SVG (Illustrator)
            </Button>
            <Button onClick={() => exportAll('png')} disabled={isProcessing} className="bg-blue-600 hover:bg-blue-700 rounded-xl h-11 px-8 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20">
               {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
               Baixar Imagens (PNG)
            </Button>
         </div>
      </div>

      {/* Galeria de Previsão */}
      <div className="flex-1 overflow-y-auto p-12 bg-black/40 custom-scrollbar">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
          {Array.from({ length: pageCount }).map((_, i) => (
            <div key={i} className="group flex flex-col items-center">
               <div className="mb-4 flex items-center justify-between w-full px-2">
                  <span className="text-[10px] font-black uppercase text-white/20 tracking-widest">Tela {i + 1}</span>
                  <div className="flex gap-2">
                    <Smartphone className="w-3 h-3 text-white/10" />
                    <Monitor className="w-3 h-3 text-white/10" />
                  </div>
               </div>
               
               <div className="relative shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] rounded-2xl overflow-hidden border border-white/10 group-hover:border-primary/30 transition-all active:scale-[0.99] cursor-zoom-in">
                  <svg
                    ref={el => svgRefs.current[i] = el}
                    width="100%"
                    viewBox={`0 0 ${config.width} ${config.height}`}
                    className="w-full h-auto block bg-white"
                  >
                    {/* Background */}
                    {config.backgroundImageUrl && (
                      <image href={config.backgroundImageUrl} width={config.width} height={config.height} preserveAspectRatio="xMidYMid slice" />
                    )}

                    {/* Custom Fonts Support */}
                    <defs>
                      {customFonts.map(f => (
                        <style key={f.name} type="text/css">
                          {`@font-face { font-family: "${f.name}"; src: url("${f.url}"); }`}
                        </style>
                      ))}
                    </defs>

                    {/* Slots/Products */}
                    {slots.map((slot, sIdx) => {
                      const productIdx = i * slots.length + sIdx;
                      const product = products[productIdx];
                      return renderProduct(product, slot);
                    })}
                  </svg>
               </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
