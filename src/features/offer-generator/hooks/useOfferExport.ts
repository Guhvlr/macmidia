import { useState, RefObject } from 'react';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { toast } from 'sonner';

interface UseOfferExportProps {
  svgRef: RefObject<SVGSVGElement>;
  config: { width: number; height: number };
  pageCount: number;
  activePage: number;
  setActivePage: (page: number) => void;
  setSelection: (sel: any[]) => void;
  setInlineEdit: (edit: any | null) => void;
}

export function useOfferExport({
  svgRef,
  config,
  pageCount,
  activePage,
  setActivePage,
  setSelection,
  setInlineEdit
}: UseOfferExportProps) {
  const [isExporting, setIsExporting] = useState(false);

  const toBase64 = async (url: string): Promise<string> => {
    if (!url || url.startsWith('data:')) return url;
    try {
      const resp = await fetch(url, { mode: 'cors' });
      const blob = await resp.blob();
      return new Promise(res => {
        const rd = new FileReader();
        rd.onloadend = () => res(rd.result as string);
        rd.readAsDataURL(blob);
      });
    } catch { return url; }
  };

  const cleanSvgForExport = async (svgEl: SVGSVGElement): Promise<string> => {
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    clone.setAttribute('width', config.width.toString());
    clone.setAttribute('height', config.height.toString());
    clone.setAttribute('viewBox', `0 0 ${config.width} ${config.height}`);
    clone.removeAttribute('class');
    clone.removeAttribute('style');

    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('x', '0'); bgRect.setAttribute('y', '0');
    bgRect.setAttribute('width', config.width.toString());
    bgRect.setAttribute('height', config.height.toString());
    bgRect.setAttribute('fill', '#ffffff');
    clone.insertBefore(bgRect, clone.firstChild);

    clone.querySelectorAll('[data-ui="1"]').forEach(n => n.remove());

    clone.querySelectorAll('style').forEach(s => {
      const text = s.textContent || '';
      if (text.includes('@import')) s.remove();
    });

    clone.querySelectorAll('rect[fill="none"]').forEach(r => {
      if (!r.getAttribute('stroke') || r.getAttribute('stroke') === 'none') {
        r.remove();
      }
    });

    const allEls = clone.querySelectorAll('*');
    allEls.forEach(el => {
      el.removeAttribute('class');
      Array.from(el.attributes).forEach(attr => {
        if (attr.name.startsWith('data-')) el.removeAttribute(attr.name);
      });
      const style = el.getAttribute('style');
      if (style) {
        const cleaned = style
          .replace(/pointer-events:[^;]+;?/gi, '')
          .replace(/cursor:[^;]+;?/gi, '')
          .replace(/user-select:[^;]+;?/gi, '')
          .replace(/transform-origin:[^;]+;?/gi, '')
          .trim();
        if (cleaned) el.setAttribute('style', cleaned);
        else el.removeAttribute('style');
      }
      el.removeAttribute('pointer-events');
    });

    clone.querySelectorAll('text, tspan').forEach(t => {
      const ff = t.getAttribute('font-family');
      if (ff === 'sans-serif' || ff === 'serif') {
        t.setAttribute('font-family', 'Arial');
      }
    });

    for (const img of Array.from(clone.querySelectorAll('image'))) {
      const href = img.getAttribute('href') || img.getAttribute('xlink:href');
      if (href && !href.startsWith('data:')) {
        try {
          const b64 = await toBase64(href);
          img.setAttribute('xlink:href', b64);
          img.setAttribute('href', b64);
        } catch {}
      }
      img.removeAttribute('pointer-events');
    }

    clone.querySelectorAll('foreignObject').forEach(fo => fo.remove());

    return new XMLSerializer().serializeToString(clone);
  };

  const svgToCanvas = async (svgStr: string): Promise<Blob | null> => {
    const cvs = document.createElement('canvas');
    cvs.width = config.width; cvs.height = config.height;
    const ctx = cvs.getContext('2d')!;
    const im = new Image();
    im.crossOrigin = 'anonymous';
    const url = URL.createObjectURL(new Blob([svgStr], { type: 'image/svg+xml' }));
    await new Promise<void>(r => {
      im.onload = () => { ctx.drawImage(im, 0, 0); URL.revokeObjectURL(url); r(); };
      im.onerror = () => { URL.revokeObjectURL(url); r(); };
      im.src = url;
    });
    return new Promise(res => cvs.toBlob(blob => res(blob), 'image/png'));
  };

  const exportAllPages = async (format: 'svg' | 'png') => {
    if (!svgRef.current) return;
    setIsExporting(true);
    const origPage = activePage;
    setSelection([]); setInlineEdit(null);

    try {
      await new Promise(r => setTimeout(r, 200));

      if (format === 'svg') {
        const spacing = 80;
        const totalW = pageCount * config.width + Math.max(0, pageCount - 1) * spacing;

        const combined = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        combined.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        combined.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
        combined.setAttribute('width', totalW.toString());
        combined.setAttribute('height', config.height.toString());
        combined.setAttribute('viewBox', `0 0 ${totalW} ${config.height}`);

        const masterBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        masterBg.setAttribute('x', '0'); masterBg.setAttribute('y', '0');
        masterBg.setAttribute('width', totalW.toString());
        masterBg.setAttribute('height', config.height.toString());
        masterBg.setAttribute('fill', '#e0e0e0');
        combined.appendChild(masterBg);

        const defsEl = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        if (svgRef.current.querySelector('defs')) {
          const srcDefs = svgRef.current.querySelector('defs')!;
          srcDefs.querySelectorAll('style').forEach(s => {
            const text = s.textContent || '';
            if (!text.includes('@import')) {
              defsEl.appendChild(s.cloneNode(true));
            }
          });
        }
        combined.appendChild(defsEl);

        for (let pg = 0; pg < pageCount; pg++) {
          setActivePage(pg);
          await new Promise(r => setTimeout(r, 400));

          if (!svgRef.current) continue;
          const cleanedStr = await cleanSvgForExport(svgRef.current);

          const parser = new DOMParser();
          const doc = parser.parseFromString(cleanedStr, 'image/svg+xml');
          const svgDoc = doc.documentElement;

          const offsetX = pg * (config.width + spacing);
          const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          g.setAttribute('id', `tela-${pg + 1}`);
          g.setAttribute('transform', `translate(${offsetX}, 0)`);

          while (svgDoc.firstChild) {
            const child = svgDoc.firstChild;
            if (child.nodeName === 'defs' || child.nodeName === 'style') {
              svgDoc.removeChild(child);
              continue;
            }
            g.appendChild(child);
          }

          combined.appendChild(g);
        }

        setActivePage(origPage);
        const svgStr = new XMLSerializer().serializeToString(combined);
        saveAs(new Blob([svgStr], { type: 'image/svg+xml' }), `telas_completas.svg`);
        toast.success(`${pageCount} tela${pageCount > 1 ? 's' : ''} exportada${pageCount > 1 ? 's' : ''} em SVG único!`);

      } else {
        if (pageCount === 1) {
          const svgStr = await cleanSvgForExport(svgRef.current);
          const blob = await svgToCanvas(svgStr);
          if (blob) saveAs(blob, `tela_1.png`);
          toast.success('Tela 1 exportada!');
        } else {
          const zip = new JSZip();
          for (let pg = 0; pg < pageCount; pg++) {
            setActivePage(pg);
            await new Promise(r => setTimeout(r, 300));
            if (!svgRef.current) continue;
            const svgStr = await cleanSvgForExport(svgRef.current);
            const blob = await svgToCanvas(svgStr);
            if (blob) {
              const arrBuf = await blob.arrayBuffer();
              zip.file(`tela_${pg + 1}.png`, arrBuf);
            }
          }
          setActivePage(origPage);
          const zipBlob = await zip.generateAsync({ type: 'blob' });
          saveAs(zipBlob, `telas_png.zip`);
          toast.success(`${pageCount} telas exportadas em ZIP!`);
        }
      }
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Erro na exportação');
      setActivePage(origPage);
    } finally {
      setIsExporting(false);
    }
  };

  return { isExporting, exportAllPages };
}
