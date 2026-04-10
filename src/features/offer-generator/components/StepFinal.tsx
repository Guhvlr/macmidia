import React, { useRef, useState, useEffect } from 'react';
import { useOffer, ProductItem } from '../context/OfferContext';
import { supabase } from '@/integrations/supabase/client';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { Loader2, Download, CheckCircle, Monitor, Smartphone, FileIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export const StepFinal = () => {
  const { config, slots, products, pageCount, customFonts, getSlotSettings } = useOffer();
  const svgRefs = useRef<(SVGSVGElement | null)[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [exportFilename, setExportFilename] = useState('tabloide_macmidia');
  const [isSingleFile, setIsSingleFile] = useState(true);

  const renderWrappedText = (text: string, x: number, y: number, fontSize: number, sFactor: number) => {
    const maxCharsPerLine = 15;
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    words.forEach(word => {
      if ((currentLine + word).length > maxCharsPerLine) {
        lines.push(currentLine.trim());
        currentLine = word + ' ';
      } else {
        currentLine += word + ' ';
      }
    });
    lines.push(currentLine.trim());

    const lineHeight = fontSize * sFactor * 1.1;
    const totalHeight = lines.length * lineHeight;
    const startY = y - (totalHeight / 2) + (lineHeight / 2);

    return lines.map((line, i) => (
      <tspan key={i} x={x} y={startY + i * lineHeight}>{line}</tspan>
    ));
  };

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
      if (format === 'svg' && isSingleFile) {
        // Create one big SVG with all pages side by side
        const spacing = 100;
        const totalW = pageCount * (config.width + spacing);
        const totalH = config.height;

        const combinedSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        combinedSvg.setAttribute('width', totalW.toString());
        combinedSvg.setAttribute('height', totalH.toString());
        combinedSvg.setAttribute('viewBox', `0 0 ${totalW} ${totalH}`);
        combinedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        combinedSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

        for (let i = 0; i < pageCount; i++) {
          const svg = svgRefs.current[i];
          if (!svg) continue;
          const processed = await processSvgForExport(svg);
          const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          g.setAttribute('transform', `translate(${i * (config.width + spacing)}, 0)`);
          
          // Append children of the processed SVG to this group
          Array.from(processed.childNodes).forEach(node => g.appendChild(node.cloneNode(true)));
          combinedSvg.appendChild(g);
        }

        const svgData = new XMLSerializer().serializeToString(combinedSvg);
        saveAs(new Blob([svgData], { type: 'image/svg+xml' }), `${exportFilename}.svg`);
      } else {
        const zip = new JSZip();
        for (let i = 0; i < pageCount; i++) {
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
        saveAs(content, `${exportFilename}_${format}.zip`);
      }
      toast.success('Download concluído!');
    } catch (e) {
      console.error(e);
      toast.error('Erro na exportação');
    } finally {
      setIsProcessing(false);
    }
  };

  const renderProduct = (product: ProductItem, slot: any, index: number) => {
    if (!product) return null;
    
    // Get per-slot overrides
    const { priceBadge: pb, descConfig: dc, imageConfig: ic } = getSlotSettings(index);

    const slotCenterX = slot.x + slot.width / 2;
    const slotCenterY = slot.y + slot.height / 2;

    const imgWidth = slot.width * 0.8 * ic.scale;
    const imgHeight = slot.height * 0.6 * ic.scale;
    const imgX = slotCenterX - imgWidth / 2 + (ic.offsetX - 50) * (slot.width / 100);
    const imgY = slotCenterY - imgHeight / 2 - slot.height * 0.15 + (ic.offsetY - 50) * (slot.height / 100);

    const REF_W = 500;
    const sFactor = slot.width / REF_W;

    const badgeW = pb.badgeWidth * sFactor;
    const badgeH = pb.badgeHeight * sFactor;
    const badgePosX = slot.x + (pb.badgeOffsetX / 100) * slot.width;
    const badgePosY = slot.y + (pb.badgeOffsetY / 100) * slot.height;

    const nameX = slot.x + (dc.offsetX / 100) * slot.width;
    const nameY = slot.y + (dc.offsetY / 100) * slot.height;

    return (
      <g key={product.id}>
        {(product.images || []).slice(0, 3).reverse().map((img, i, arr) => {
          const total = arr.length;
          const pos = total - 1 - i;
          const offset = pos * 20;
          return (
            <image key={`${product.id}-img-${pos}`} href={img} x={imgX + offset} y={imgY - offset / 2} width={imgWidth} height={imgHeight} preserveAspectRatio="xMidYMid meet" style={{ filter: pos > 0 ? 'drop-shadow(0 4px 6px rgba(0,0,0,0.2))' : 'none' }} />
          );
        })}

        <g transform={`translate(${badgePosX}, ${badgePosY})`}>
           {pb.badgeImageUrl ? (
             <image href={pb.badgeImageUrl} x={-badgeW/2} y={-badgeH/2} width={badgeW} height={badgeH} />
           ) : (
             <rect x={-badgeW/2} y={-badgeH/2} width={badgeW} height={badgeH} fill={pb.bgColor} rx={pb.borderRadius * sFactor} />
           )}
           <text x={-badgeW/2 + (pb.currencyOffsetX / 100) * badgeW} y={-badgeH/2 + (pb.currencyOffsetY / 100) * badgeH} fill={pb.currencyColor} style={{ fontSize: (pb.currencyFontSize * sFactor), fontFamily: pb.currencyFontFamily, fontWeight: '900' }}>R$</text>
           <text x={-badgeW/2 + (pb.valueOffsetX / 100) * badgeW} y={-badgeH/2 + (pb.valueOffsetY / 100) * badgeH + (pb.valueFontSize * sFactor * 0.15)} fill={pb.valueColor} textAnchor="middle" style={{ fontSize: (pb.valueFontSize * sFactor), fontFamily: pb.valueFontFamily, fontWeight: '900', letterSpacing: '-0.05em' }}>{product.price.replace('R$', '').trim()}</text>
           {pb.showSuffix && <text x={-badgeW/2 + (pb.suffixOffsetX / 100) * badgeW} y={-badgeH/2 + (pb.suffixOffsetY / 100) * badgeH} fill={pb.suffixColor} textAnchor="middle" style={{ fontSize: (pb.suffixFontSize * sFactor), fontWeight: 'bold' }}>{pb.suffixText}</text>}
        </g>

        <g>
          {dc.showBg && (
            <rect x={nameX - slot.width * 0.4} y={nameY - dc.fontSize * sFactor * 0.7} width={slot.width * 0.8} height={dc.fontSize * sFactor * 1.4} fill={dc.bgColor} rx={4} />
          )}
          <text 
            textAnchor="middle" 
            fill={dc.color}
            style={{ 
              fontSize: `${dc.fontSize * sFactor}px`, 
              fontFamily: dc.fontFamily,
              fontWeight: '900',
              textTransform: dc.uppercase ? 'uppercase' : 'none',
              letterSpacing: '-0.02em'
            }}
          >
            {renderWrappedText(product.name, nameX, nameY, dc.fontSize, sFactor)}
          </text>
        </g>
      </g>
    );
  };

  return (
    <div className="h-full flex flex-col bg-[#09090b]">
      <div className="p-6 border-b border-white/5 bg-[#0d0d10] flex items-center justify-between gap-6">
         <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <div>
               <h2 className="text-sm font-black uppercase tracking-widest text-white">Artes Prontas</h2>
               <p className="text-[10px] text-white/30 font-bold uppercase tracking-wider">{pageCount} telas geradas</p>
            </div>
         </div>

         <div className="flex-1 max-w-sm flex flex-col gap-2">
            <input 
              value={exportFilename} 
              onChange={e => setExportFilename(e.target.value)} 
              placeholder="Nome do arquivo..."
              className="bg-black/60 border border-white/10 rounded-lg h-9 px-4 text-[10px] font-bold text-white outline-none focus:border-primary/50 transition-all"
            />
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsSingleFile(!isSingleFile)}
                className={`flex items-center gap-2 text-[9px] font-black uppercase tracking-widest transition-colors ${isSingleFile ? 'text-primary' : 'text-white/20'}`}
              >
                <div className={`w-3 h-3 rounded-full border ${isSingleFile ? 'bg-primary border-primary' : 'border-white/20'}`} />
                Arquivo Único (Multi Artboards)
              </button>
            </div>
         </div>

         <div className="flex gap-3">
            <Button onClick={() => exportAll('svg')} disabled={isProcessing} className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl h-11 px-6 text-[10px] font-black uppercase tracking-widest">
               <FileIcon className="w-4 h-4 mr-2" /> Exportar SVG
            </Button>
            <Button onClick={() => exportAll('png')} disabled={isProcessing} className="bg-blue-600 hover:bg-blue-700 rounded-xl h-11 px-8 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20">
               {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
               Baixar PNG
            </Button>
         </div>
      </div>

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
                      const globalIndex = i * slots.length + sIdx;
                      const product = products[globalIndex];
                      return renderProduct(product, slot, globalIndex);
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
