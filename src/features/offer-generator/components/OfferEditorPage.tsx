import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useOffer } from '../context/OfferContext';
import { useOfferExport } from '../hooks/useOfferExport';
import { toast } from 'sonner';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import {
  Type, X, Square, Circle,
  ZoomIn, ZoomOut, MousePointer2,
  FileIcon, Download, Loader2,
  ChevronUp, ChevronDown, ChevronsUp, ChevronsDown,
  Group, Ungroup, AlignLeft, AlignCenter, AlignRight,
  Bold, Italic, Undo2, Redo2, Scissors, Maximize2
} from 'lucide-react';

/* ─────────────────── GOOGLE FONTS ─────────────────── */
const GOOGLE_FONTS = [
  'Arial', 'Helvetica', 'Verdana', 'Georgia', 'Times New Roman', 'Courier New',
  'Oswald', 'Barlow', 'Roboto', 'Inter', 'Montserrat', 'Poppins', 'Lato',
  'Open Sans', 'Raleway', 'Playfair Display', 'Bebas Neue', 'Anton',
  'Bangers', 'Passion One', 'Russo One', 'Teko', 'Archivo Black',
  'Permanent Marker', 'Righteous', 'Fredoka One', 'Pacifico', 'Lobster',
  'Black Ops One', 'Bungee', 'Titan One', 'Ultra'
];
const SYSTEM_FONTS = ['Arial', 'Helvetica', 'Verdana', 'Georgia', 'Times New Roman', 'Courier New'];
const loadedGFonts = new Set<string>();
const loadGFont = (name: string) => {
  if (SYSTEM_FONTS.includes(name) || loadedGFonts.has(name)) return;
  loadedGFonts.add(name);
  const link = document.createElement('link');
  link.href = `https://fonts.googleapis.com/css2?family=${name.replace(/ /g, '+')}:wght@400;500;600;700;800;900&display=swap`;
  link.rel = 'stylesheet';
  document.head.appendChild(link);
};
// Preload common ones
['Oswald', 'Barlow', 'Montserrat', 'Roboto', 'Inter', 'Bebas Neue', 'Poppins', 'Anton'].forEach(loadGFont);

/* ─────────────────── TYPES ─────────────────── */
interface CanvasElement {
  id: string;
  type: 'text' | 'rect' | 'circle' | 'product_clone';
  x: number; y: number; w: number; h: number;
  zIndex: number;
  groupId?: string;
  data: { text?: string };
  style: {
    fontFamily?: string; fontSize?: number; fontWeight?: string;
    color?: string; bgColor?: string; align?: string;
    lineHeight?: number; letterSpacing?: number; uppercase?: boolean;
    borderColor?: string; borderWidth?: number; borderRadius?: number;
    opacity?: number;
  };
  productData?: any;
}

type EditElemType = 'image' | 'name' | 'badgeBg' | 'badgeCurrency' | 'badgeValue' | 'badgeSuffix';
interface Selection { id?: string; gIdx?: number; type?: EditElemType; }

/* ─────────────────── HELPERS ─────────────────── */
const getSelKey = (s: Selection) => s.id ? s.id : `${s.gIdx}-${s.type}`;

const wrapText = (text: string, maxWidth: number, fontSize: number): string[] => {
  if (!text) return [''];
  const lines = text.split('\n');
  const result: string[] = [];
  const charsPerLine = Math.max(1, Math.floor(maxWidth / (fontSize * 0.55)));
  lines.forEach(line => {
    if (line.length <= charsPerLine) { result.push(line); return; }
    const words = line.split(' ');
    let cur = '';
    words.forEach(w => {
      if ((cur + ' ' + w).trim().length > charsPerLine && cur) { result.push(cur); cur = w; }
      else cur = cur ? cur + ' ' + w : w;
    });
    if (cur) result.push(cur);
  });
  return result.length ? result : [''];
};

/* ─────────────────── COMPONENT ─────────────────── */
export const OfferEditorPage = () => {
  const {
    config, slots, products, setProducts, customFonts,
    getSlotSettings, updateSlotSettings, pageCount, activePage, setActivePage,
    customCanvasElements, setCustomCanvasElements, pushHistory,
    undo, redo, removeBackground, autoFitImage
  } = useOffer();

  // ── Canvas navigation ──
  const [zoom, setZoom] = useState(0.65);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, ox: 0, oy: 0 });
  const [spaceHeld, setSpaceHeld] = useState(false);

  // ── Tool state ──
  const [activeTool, setActiveTool] = useState<'v' | 't' | 'm' | 'l'>('v');

  // ── Selection ──
  const [selection, setSelection] = useState<Selection[]>([]);
  const isSelected = useCallback((sel: Selection) => selection.some(x => getSelKey(x) === getSelKey(sel)), [selection]);

  // ── Drag ──
  const [dragging, setDragging] = useState(false);
  const [dragState, setDragState] = useState<{ dx: number; dy: number } | null>(null);
  const [startMouse, setStartMouse] = useState({ x: 0, y: 0 });
  const [altDragCloned, setAltDragCloned] = useState(false);

  // ── Resize ──
  const [resizeAnchor, setResizeAnchor] = useState<string | null>(null);
  const [resizeState, setResizeState] = useState<{ dw: number; dh: number } | null>(null);
  const [resizeStartW, setResizeStartW] = useState(0);
  const [resizeStarts, setResizeStarts] = useState<Record<string, any>>({});

  // ── Inline editing ──
  const [inlineEdit, setInlineEdit] = useState<any | null>(null);

  // ── Clipboard & Export ──
  const svgRef = useRef<SVGSVGElement>(null);
  const [clipboard, setClipboard] = useState<any[]>([]);
  const { isExporting, exportAllPages } = useOfferExport({ svgRef, config, pageCount, activePage, setActivePage, setSelection, setInlineEdit });
  // ── Groups ──
  const [groups, setGroups] = useState<Record<string, string[]>>({});

  // ── Next z-index ──
  const nextZ = useRef(100);

  const [isRotating, setIsRotating] = useState(false);
  const [rotationStart, setRotationStart] = useState(0);

  const pageElements: CanvasElement[] = useMemo(() => (customCanvasElements[activePage] || []).sort((a: any, b: any) => (a.zIndex || 0) - (b.zIndex || 0)), [customCanvasElements, activePage]);

  /* ── SVG coordinate mapping ── */
  const toSvg = useCallback((cx: number, cy: number) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: (cx - r.left) * config.width / r.width, y: (cy - r.top) * config.height / r.height };
  }, [config]);

  /* ── Product element bounding boxes ── */
  const getElems = useCallback((slot: any, cfg: any) => {
    const sf = (slot?.width || 500) / 500;
    const { priceBadge: b, imageConfig: ic, descConfig: d } = cfg;
    const bX = slot.x + (b.badgeOffsetX / 100) * slot.width - (b.badgeWidth * sf) / 2;
    const bY = slot.y + (b.badgeOffsetY / 100) * slot.height - (b.badgeHeight * sf) / 2;
    const fw = (v: number) => v * sf * 1.5; const fh = (v: number) => v * sf * 1.3;
    return {
      image: { x: slot.x + slot.width * ic.offsetX / 100 - (slot.width * ic.scale) / 2, y: slot.y + slot.height * ic.offsetY / 100 - (slot.height * ic.scale) / 2, w: slot.width * ic.scale, h: slot.height * ic.scale },
      name: { x: slot.x + slot.width * d.offsetX / 100 - slot.width * 0.4, y: slot.y + slot.height * d.offsetY / 100 - (d.fontSize * sf), w: slot.width * 0.8, h: d.fontSize * sf * 2.5 },
      badgeBg: { x: bX, y: bY, w: b.badgeWidth * sf, h: b.badgeHeight * sf },
      badgeCurrency: { x: bX + (b.badgeWidth * sf) * b.currencyOffsetX / 100, y: bY + (b.badgeHeight * sf) * b.currencyOffsetY / 100 - fh(b.currencyFontSize)/2, w: fw(b.currencyFontSize), h: fh(b.currencyFontSize) },
      badgeValue: { x: bX + (b.badgeWidth * sf) * b.valueOffsetX / 100 - fw(b.valueFontSize)/2, y: bY + (b.badgeHeight * sf) * b.valueOffsetY / 100 - fh(b.valueFontSize)/2, w: fw(b.valueFontSize) * 1.2, h: fh(b.valueFontSize) },
      badgeSuffix: { x: bX + (b.badgeWidth * sf) * b.suffixOffsetX / 100 - fw(b.suffixFontSize)/2, y: bY + (b.badgeHeight * sf) * b.suffixOffsetY / 100 - fh(b.suffixFontSize)/2, w: fw(b.suffixFontSize), h: fh(b.suffixFontSize) }
    };
  }, []);

  /* ───────────── KEYBOARD ───────────── */
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA';

      if (e.code === 'Space' && !isTyping) { e.preventDefault(); setSpaceHeld(true); return; }

      if (isTyping) {
        if (e.key === 'Escape') { setInlineEdit(null); }
        return;
      }

      // Tool shortcuts
      if (e.code === 'KeyV' && !e.ctrlKey && !e.metaKey) { setActiveTool('v'); return; }
      if (e.code === 'KeyT') { setActiveTool('t'); return; }
      if (e.code === 'KeyM') { setActiveTool('m'); return; }
      if (e.code === 'KeyL') { setActiveTool('l'); return; }
      if (e.key === 'Escape') { setSelection([]); setInlineEdit(null); return; }

      // UNDO: Ctrl+Z (without Shift)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // REDO: Ctrl+Shift+Z or Ctrl+Y
      if ((e.ctrlKey || e.metaKey) && e.key === 'Z' && e.shiftKey) {
        e.preventDefault();
        redo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y' && !e.shiftKey) {
        e.preventDefault();
        redo();
        return;
      }

      // Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const ids = selection.filter(s => s.id).map(s => s.id!);
        if (ids.length) {
          pushHistory();
          setCustomCanvasElements(p => ({ ...p, [activePage]: (p[activePage] || []).filter(x => !ids.includes(x.id)) }));
          setSelection(s => s.filter(x => !x.id));
        }
      }

      // GROUP: Ctrl+G
      if ((e.ctrlKey || e.metaKey) && e.key === 'g' && !e.shiftKey) {
        e.preventDefault();
        const ids = selection.filter(s => s.id).map(s => s.id!);
        if (ids.length >= 2) {
          const gId = crypto.randomUUID();
          setCustomCanvasElements(p => ({
            ...p,
            [activePage]: (p[activePage] || []).map(el => ids.includes(el.id) ? { ...el, groupId: gId } : el)
          }));
          toast.success(`${ids.length} elementos agrupados — Ctrl+Shift+G para desagrupar`);
        }
      }

      // UNGROUP: Ctrl+Shift+G
      if ((e.ctrlKey || e.metaKey) && e.key === 'G' && e.shiftKey) {
        e.preventDefault();
        const ids = selection.filter(s => s.id).map(s => s.id!);
        if (ids.length) {
          const elems = pageElements.filter(el => ids.includes(el.id));
          const groupIds = [...new Set(elems.map(el => el.groupId).filter(Boolean))];
          if (groupIds.length) {
            setCustomCanvasElements(p => ({
              ...p,
              [activePage]: (p[activePage] || []).map(el => groupIds.includes(el.groupId) ? { ...el, groupId: undefined } : el)
            }));
            toast.success('Elementos desagrupados');
          }
        }
      }

      // SELECT ALL: Ctrl+A
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !isTyping) {
        e.preventDefault();
        const all: Selection[] = getUniversalStack(customCanvasElements[activePage] || []).map(item => {
          if (item.isTemplate) return { gIdx: item.gIdx, type: item.type as EditElemType };
          return { id: item.id };
        });
        setSelection(all);
      }

      // FONT SIZE: Ctrl+Shift+> or <
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === '>' || e.key === '<')) {
        e.preventDefault();
        const delta = e.key === '>' ? 2 : -2;
        selection.forEach(sel => {
          if (sel.id) {
            const el = pageElements.find(x => x.id === sel.id);
            if (el && el.type === 'text') {
              updateElStyle(el.id, 'fontSize', Math.max(1, (el.style.fontSize || 40) + delta));
            }
          } else if (sel.gIdx !== undefined && (sel.type === 'name' || sel.type === 'badgeValue' || sel.type === 'badgeCurrency' || sel.type === 'badgeSuffix')) {
            const style = getProductTextStyle(sel.gIdx, sel.type);
            updateProductFont(sel.gIdx, sel.type, 'fontSize', Math.max(1, (style.fontSize || 40) + delta));
          }
        });
      }

      // COPY: Ctrl+C — copies ONLY what is individually selected
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (!selection.length) return;
        const items = selection.map(sel => {
          if (sel.id) {
            // Custom canvas element — copy only this one element
            const el = pageElements.find(x => x.id === sel.id);
            if (el) return { kind: 'custom' as const, el: JSON.parse(JSON.stringify(el)) };
          } else if (sel.gIdx !== undefined && sel.type) {
            // Product sub-element — copy only this specific sub-element type
            const prod = products[sel.gIdx];
            const slot = slots[sel.gIdx % slots.length];
            const cfg = getSlotSettings(sel.gIdx);
            if (prod) return {
              kind: 'product_element' as const,
              type: sel.type,
              product: JSON.parse(JSON.stringify(prod)),
              cfg: JSON.parse(JSON.stringify(cfg)),
              slot: JSON.parse(JSON.stringify(slot)),
              gIdx: sel.gIdx
            };
          }
          return null;
        }).filter(Boolean) as any[];
        if (items.length) { setClipboard(items); toast.success(`${items.length} copiado(s)`); }
      }

      // PASTE: Ctrl+V — pastes individual elements
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (!clipboard.length) return;
        pushHistory();
        let newElems = [...(customCanvasElements[activePage] || [])];
        const newSel: Selection[] = [];
        clipboard.forEach(item => {
          const newId = crypto.randomUUID();
          if (item.kind === 'custom') {
            // Paste custom element as independent copy (no group inheritance)
            newElems.push({ ...item.el, id: newId, x: item.el.x + 30, y: item.el.y + 30, groupId: undefined, zIndex: nextZ.current++ });
            newSel.push({ id: newId });
          } else if (item.kind === 'product_element') {
            // Paste product sub-element as a standalone canvas element
            const sf = (item.slot?.width || 500) / 500;
            const cfg = item.cfg;
            const prod = item.product;
            if (item.type === 'image') {
              // Create a product_clone with full product data so image renders properly
              newElems.push({
                id: newId, type: 'product_clone' as const,
                x: item.slot.x + 30, y: item.slot.y + 30,
                w: item.slot.width * (cfg.imageConfig?.scale || 1),
                h: item.slot.height * (cfg.imageConfig?.scale || 1),
                zIndex: nextZ.current++,
                data: {}, style: { opacity: 1 },
                productData: { imageOnly: true, imageUrl: prod.images?.[0] || '' }
              });
            } else if (item.type === 'name') {
              // Create a text element with the product name
              newElems.push({
                id: newId, type: 'text' as const,
                x: item.slot.x + 30, y: item.slot.y + item.slot.height * 0.5,
                w: item.slot.width * 0.8, h: cfg.descConfig.fontSize * sf * 3,
                zIndex: nextZ.current++,
                data: { text: prod.name },
                style: {
                  fontFamily: cfg.descConfig.fontFamily || 'Montserrat',
                  fontSize: cfg.descConfig.fontSize * sf,
                  fontWeight: '800', color: cfg.descConfig.color || '#000',
                  bgColor: 'transparent', align: 'center',
                  lineHeight: 1.2, letterSpacing: 0,
                  uppercase: cfg.descConfig.uppercase, opacity: 1
                }
              });
            } else if (item.type === 'badgeValue' || item.type === 'badgeCurrency' || item.type === 'badgeSuffix') {
              // Create a text element for price text
              const textMap: Record<string, string> = {
                badgeValue: prod.price?.replace('R$', '').trim() || '',
                badgeCurrency: 'R$',
                badgeSuffix: prod.suffix || cfg.priceBadge?.suffixText || 'cada'
              };
              const fontMap: Record<string, any> = {
                badgeValue: { family: cfg.priceBadge?.valueFontFamily, size: cfg.priceBadge?.valueFontSize, color: cfg.priceBadge?.valueColor },
                badgeCurrency: { family: cfg.priceBadge?.currencyFontFamily, size: cfg.priceBadge?.currencyFontSize, color: cfg.priceBadge?.currencyColor },
                badgeSuffix: { family: cfg.priceBadge?.valueFontFamily || 'Montserrat', size: cfg.priceBadge?.suffixFontSize, color: cfg.priceBadge?.suffixColor },
              };
              const fm = fontMap[item.type] || {};
              newElems.push({
                id: newId, type: 'text' as const,
                x: item.slot.x + item.slot.width * 0.3, y: item.slot.y + item.slot.height * 0.7,
                w: 300, h: (fm.size || 40) * sf * 1.5,
                zIndex: nextZ.current++,
                data: { text: textMap[item.type] || '' },
                style: {
                  fontFamily: fm.family || 'Montserrat', fontSize: (fm.size || 40) * sf,
                  fontWeight: '900', color: fm.color || '#fff',
                  bgColor: 'transparent', align: 'center',
                  lineHeight: 1.2, letterSpacing: 0, opacity: 1
                }
              });
            } else if (item.type === 'badgeBg') {
              // Create a rect element for the badge background (or product_clone if it has an image)
              if (cfg.priceBadge.badgeImageUrl) {
                newElems.push({
                  id: newId, type: 'product_clone' as const,
                  x: item.slot.x + 30, y: item.slot.y + item.slot.height * 0.6,
                  w: cfg.priceBadge.badgeWidth * sf, h: cfg.priceBadge.badgeHeight * sf,
                  zIndex: nextZ.current++,
                  data: {}, style: { opacity: 1 },
                  productData: { imageOnly: true, imageUrl: cfg.priceBadge.badgeImageUrl }
                });
              } else {
                newElems.push({
                  id: newId, type: 'rect' as const,
                  x: item.slot.x + 30, y: item.slot.y + item.slot.height * 0.6,
                  w: cfg.priceBadge.badgeWidth * sf, h: cfg.priceBadge.badgeHeight * sf,
                  zIndex: nextZ.current++,
                  data: {}, style: {
                    bgColor: cfg.priceBadge.bgColor || '#e11d48',
                    borderRadius: cfg.priceBadge.borderRadius * sf,
                    borderColor: 'transparent', borderWidth: 0, opacity: 1
                  }
                });
              }
            }
            newSel.push({ id: newId });
          }
        });
        setCustomCanvasElements(p => ({ ...p, [activePage]: newElems }));
        setSelection(newSel);
      }

      // LAYER: Ctrl+] subir, Ctrl+[ descer (+ Shift p/ topo/fundo)
      if ((e.ctrlKey || e.metaKey) && e.key === ']') {
        e.preventDefault();
        if (e.shiftKey) bringToFront();
        else bringForward();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '[') {
        e.preventDefault();
        if (e.shiftKey) sendToBack();
        else sendBackward();
      }
    };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') setSpaceHeld(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [selection, activePage, pushHistory, setCustomCanvasElements, clipboard, pageElements, products, slots, getSlotSettings, customCanvasElements, undo, redo]);

  /* ───────────── INTERACTION START ───────────── */
  const startInteraction = (e: React.MouseEvent, sel: Selection, w: number, isResize: boolean, anchor?: string) => {
    if (e.button !== 0 || spaceHeld) return;
    if (inlineEdit) setInlineEdit(null);
    e.preventDefault(); e.stopPropagation();

    // If T tool is active and clicking on a text-type element, go to edit mode
    if (activeTool === 't' && !isResize) {
      if (sel.gIdx !== undefined && (sel.type === 'name' || sel.type === 'badgeValue' || sel.type === 'badgeCurrency' || sel.type === 'badgeSuffix')) {
        const prod = products[sel.gIdx];
        if (prod) {
          if (sel.type === 'name') setInlineEdit({ gIdx: sel.gIdx, type: 'name', value: prod.name });
          else if (sel.type === 'badgeValue') setInlineEdit({ gIdx: sel.gIdx, type: 'badgeValue', value: prod.price });
        }
        setSelection([sel]);
        return;
      }
      if (sel.id) {
        const el = pageElements.find(x => x.id === sel.id);
        if (el && el.type === 'text') {
          setInlineEdit({ id: el.id, value: el.data.text || '' });
          setSelection([sel]);
          return;
        }
      }
    }

    pushHistory();
    let newSel = selection;

    // Select grouped elements together ONLY if clicking a grouped custom element
    const expandGroup = (s: Selection) => {
      if (!s.id) return [s];
      const el = pageElements.find(x => x.id === s.id);
      if (el?.groupId) {
        return pageElements.filter(x => x.groupId === el.groupId).map(x => ({ id: x.id } as Selection));
      }
      return [s];
    };

    if (!isSelected(sel)) {
      if (e.shiftKey) {
        const expanded = expandGroup(sel);
        newSel = [...selection, ...expanded.filter(ns => !selection.some(es => getSelKey(es) === getSelKey(ns)))];
      } else {
        newSel = expandGroup(sel);
      }
      setSelection(newSel);
    } else if (e.shiftKey && !isResize) {
      newSel = selection.filter(x => getSelKey(x) !== getSelKey(sel));
      setSelection(newSel);
      return;
    }

    const svgPt = toSvg(e.clientX, e.clientY);
    setStartMouse(svgPt);

    // ALT+DRAG = duplicate first, then drag the copies
    if (e.altKey && !isResize) {
      let newElems = [...(customCanvasElements[activePage] || [])];
      const dupesSel: Selection[] = [];
      let hasProductDupes = false;
      newSel.forEach(s => {
        if (s.id) {
          // Custom canvas element — clone directly
          const el = (customCanvasElements[activePage] || []).find((x: any) => x.id === s.id);
          if (el) {
            const newId = crypto.randomUUID();
            newElems.push({ ...JSON.parse(JSON.stringify(el)), id: newId, groupId: undefined, zIndex: nextZ.current++ });
            dupesSel.push({ id: newId });
          }
        } else if (s.gIdx !== undefined && s.type) {
          // Product sub-element — clone as independent canvas element
          const prod = products[s.gIdx];
          const slot = slots[s.gIdx % slots.length];
          const cfg = getSlotSettings(s.gIdx);
          if (!prod) return;
          const sf = (slot?.width || 500) / 500;
          const newId = crypto.randomUUID();
          const elBounds = (getElems(slot, cfg) as any)[s.type];
          if (s.type === 'image') {
            newElems.push({
              id: newId, type: 'product_clone' as const,
              x: elBounds?.x || slot.x, y: elBounds?.y || slot.y,
              w: elBounds?.w || slot.width, h: elBounds?.h || slot.height,
              zIndex: nextZ.current++,
              data: {}, style: { opacity: 1 },
              productData: { imageOnly: true, imageUrl: prod.images?.[0] || '' }
            });
          } else if (s.type === 'name') {
            newElems.push({
              id: newId, type: 'text' as const,
              x: elBounds?.x || slot.x, y: elBounds?.y || slot.y,
              w: elBounds?.w || slot.width * 0.8, h: elBounds?.h || cfg.descConfig.fontSize * sf * 3,
              zIndex: nextZ.current++,
              data: { text: prod.name },
              style: {
                fontFamily: cfg.descConfig.fontFamily || 'Montserrat',
                fontSize: cfg.descConfig.fontSize * sf,
                fontWeight: '800', color: cfg.descConfig.color || '#000',
                bgColor: 'transparent', align: 'center',
                lineHeight: 1.2, letterSpacing: 0,
                uppercase: cfg.descConfig.uppercase, opacity: 1
              }
            });
          } else if (s.type === 'badgeValue' || s.type === 'badgeCurrency' || s.type === 'badgeSuffix') {
            const textMap: Record<string, string> = {
              badgeValue: prod.price?.replace('R$', '').trim() || '',
              badgeCurrency: 'R$',
              badgeSuffix: prod.suffix || cfg.priceBadge?.suffixText || 'cada'
            };
            const fontMap: Record<string, any> = {
              badgeValue: { family: cfg.priceBadge?.valueFontFamily, size: cfg.priceBadge?.valueFontSize, color: cfg.priceBadge?.valueColor },
              badgeCurrency: { family: cfg.priceBadge?.currencyFontFamily, size: cfg.priceBadge?.currencyFontSize, color: cfg.priceBadge?.currencyColor },
              badgeSuffix: { family: cfg.priceBadge?.valueFontFamily || 'Montserrat', size: cfg.priceBadge?.suffixFontSize, color: cfg.priceBadge?.suffixColor },
            };
            const fm = fontMap[s.type] || {};
            newElems.push({
              id: newId, type: 'text' as const,
              x: elBounds?.x || slot.x, y: elBounds?.y || slot.y,
              w: elBounds?.w || 300, h: elBounds?.h || (fm.size || 40) * sf * 1.5,
              zIndex: nextZ.current++,
              data: { text: textMap[s.type] || '' },
              style: {
                fontFamily: fm.family || 'Montserrat', fontSize: (fm.size || 40) * sf,
                fontWeight: '900', color: fm.color || '#fff',
                bgColor: 'transparent', align: 'center',
                lineHeight: 1.2, letterSpacing: 0, opacity: 1
              }
            });
          } else if (s.type === 'badgeBg') {
            if (cfg.priceBadge.badgeImageUrl) {
              newElems.push({
                id: newId, type: 'product_clone' as const,
                x: elBounds?.x || slot.x, y: elBounds?.y || slot.y,
                w: elBounds?.w || cfg.priceBadge.badgeWidth * sf, h: elBounds?.h || cfg.priceBadge.badgeHeight * sf,
                zIndex: nextZ.current++,
                data: {}, style: { opacity: 1 },
                productData: { imageOnly: true, imageUrl: cfg.priceBadge.badgeImageUrl }
              });
            } else {
              newElems.push({
                id: newId, type: 'rect' as const,
                x: elBounds?.x || slot.x, y: elBounds?.y || slot.y,
                w: elBounds?.w || cfg.priceBadge.badgeWidth * sf, h: elBounds?.h || cfg.priceBadge.badgeHeight * sf,
                zIndex: nextZ.current++,
                data: {}, style: {
                  bgColor: cfg.priceBadge.bgColor || '#e11d48',
                  borderRadius: cfg.priceBadge.borderRadius * sf,
                  borderColor: 'transparent', borderWidth: 0, opacity: 1
                }
              });
            }
          }
          dupesSel.push({ id: newId });
          hasProductDupes = true;
        }
      });
      if (dupesSel.length) {
        setCustomCanvasElements(p => ({ ...p, [activePage]: newElems }));
        setSelection(dupesSel);
        setAltDragCloned(true);
        newSel = dupesSel;
      }
    }

    if (isResize) {
      setResizeAnchor(anchor || 'se'); setResizeStartW(w); setResizeState({ dw: 0, dh: 0 });
      const starts: Record<string, any> = {};
      newSel.forEach(s => {
        if (s.id) {
          const el = (customCanvasElements[activePage] || []).find((x: any) => x.id === s.id);
          if (el) starts[getSelKey(s)] = JSON.parse(JSON.stringify(el));
        } else if (s.gIdx !== undefined && s.type) {
          starts[getSelKey(s)] = JSON.parse(JSON.stringify(getSlotSettings(s.gIdx)));
        }
      });
      setResizeStarts(starts);
    } else if (anchor === 'rotate') {
      setIsRotating(true);
      const sel = selection[0]; if (!sel) return;
      const svgPtRotate = toSvg(e.clientX, e.clientY);
      setStartMouse(svgPtRotate);
    } else {
      setDragging(true); setDragState({ dx: 0, dy: 0 });
    }
  };

  const startDragProduct = (e: React.MouseEvent, type: EditElemType, gIdx: number) => startInteraction(e, { type, gIdx }, (getElems(slots[gIdx % slots.length], getSlotSettings(gIdx)) as any)[type]?.w || 100, false);
  const startResizeProduct = (e: React.MouseEvent, type: EditElemType, gIdx: number, anchor: string) => startInteraction(e, { type, gIdx }, (getElems(slots[gIdx % slots.length], getSlotSettings(gIdx)) as any)[type]?.w || 100, true, anchor);
  const startDragCustom = (e: React.MouseEvent, id: string, el: any) => startInteraction(e, { id }, el.w, false);
  const startResizeCustom = (e: React.MouseEvent, id: string, anchor: string, el: any) => startInteraction(e, { id }, el.w, true, anchor);

  /* ───────────── MOUSE MOVE ───────────── */
  const onMouseMove = (e: React.MouseEvent) => {
    if (isPanning) { setPanOffset({ x: panStart.ox + (e.clientX - panStart.x), y: panStart.oy + (e.clientY - panStart.y) }); return; }
    const pt = toSvg(e.clientX, e.clientY);
    if (resizeAnchor && resizeStartW > 0) setResizeState({ dw: pt.x - startMouse.x, dh: pt.y - startMouse.y });
    else if (isRotating) {
      const sel = selection[0]; if (!sel?.id) return;
      const el = pageElements.find(x => x.id === sel.id); if (!el) return;
      const cX = el.x + el.w/2; const cY = el.y + el.h/2;
      const angle = Math.atan2(pt.y - cY, pt.x - cX) * 180 / Math.PI + 90;
      setDragState({ dx: angle, dy: 0 }); // Use dx as rotation degree temporarily
    }
    else if (dragging) setDragState({ dx: pt.x - startMouse.x, dy: pt.y - startMouse.y });
  };

  /* ───────────── MOUSE UP (commit) ───────────── */
  const onMouseUp = () => {
    if (isPanning) { setIsPanning(false); return; }

    if (resizeAnchor && resizeState && resizeStartW > 0) {
      // ... resize logic remains same
      let dWide = resizeState.dw; if (resizeAnchor === 'nw' || resizeAnchor === 'sw') dWide = -resizeState.dw;
      const factor = Math.max(0.1, 1 + dWide / resizeStartW);
      let newArr = [...(customCanvasElements[activePage] || [])]; let changed = false;
      selection.forEach(sel => {
        const start = resizeStarts[getSelKey(sel)]; if (!start) return;
        if (sel.id) { newArr = newArr.map(x => x.id === sel.id ? { ...x, w: start.w * factor, h: start.h * factor } : x); changed = true; }
        else if (sel.gIdx !== undefined && sel.type) {
          let up: any = {};
          if (sel.type === 'image') up.imageConfig = { ...start.imageConfig, scale: start.imageConfig.scale * factor };
          else if (sel.type === 'name') up.descConfig = { ...start.descConfig, fontSize: start.descConfig.fontSize * factor };
          else if (sel.type === 'badgeBg') up.priceBadge = { ...start.priceBadge, badgeWidth: start.priceBadge.badgeWidth * factor, badgeHeight: start.priceBadge.badgeHeight * factor };
          else if (sel.type === 'badgeCurrency') up.priceBadge = { ...start.priceBadge, currencyFontSize: start.priceBadge.currencyFontSize * factor };
          else if (sel.type === 'badgeValue') up.priceBadge = { ...start.priceBadge, valueFontSize: start.priceBadge.valueFontSize * factor };
          else if (sel.type === 'badgeSuffix') up.priceBadge = { ...start.priceBadge, suffixFontSize: start.priceBadge.suffixFontSize * factor };
          if (Object.keys(up).length) updateSlotSettings(sel.gIdx, up);
        }
      });
      if (changed) setCustomCanvasElements(p => ({ ...p, [activePage]: newArr }));
    } else if (isRotating && dragState) {
      const sel = selection[0]; if (sel?.id) updateElStyle(sel.id, 'rotation', dragState.dx);
    } else if (dragging && dragState) {
      let { dx, dy } = dragState;

      // --- SNAP LOGIC ---
      const SNAP = 5;
      const stack = getUniversalStack(customCanvasElements[activePage] || []);
      const selItems = selection.map(s => stack.find(i => i.id === (s.id || `slot-${s.gIdx}-${s.type}`))).filter(Boolean);
      
      if (selItems.length === 1) {
        const t = selItems[0];
        const b = t.isTemplate ? (getElems(t.el, getSlotSettings(t.gIdx)) as any)[t.type] : t;
        const curX = b.x + dx, curY = b.y + dy;
        
        // Snap to Artboard Center
        if (Math.abs(curX + b.w/2 - config.width/2) < SNAP) dx = config.width/2 - b.w/2 - b.x;
        if (Math.abs(curY + b.h/2 - config.height/2) < SNAP) dy = config.height/2 - b.h/2 - b.y;
        
        // Snap to other objects
        stack.forEach(other => {
          if (selection.some(s => (s.id || `slot-${s.gIdx}-${s.type}`) === other.id)) return;
          const ob = other.isTemplate ? (getElems(other.el, getSlotSettings(other.gIdx)) as any)[other.type] : other;
          if (Math.abs(curX - ob.x) < SNAP) dx = ob.x - b.x;
          if (Math.abs(curX + b.w - (ob.x + ob.w)) < SNAP) dx = ob.x + ob.w - b.w - b.x;
          if (Math.abs(curY - ob.y) < SNAP) dy = ob.y - b.y;
          if (Math.abs(curY + b.h - (ob.y + ob.h)) < SNAP) dy = ob.y + ob.h - b.h - b.y;
        });
      }

      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        let newArr = [...(customCanvasElements[activePage] || [])]; let changed = false;
        
        // Group product updates by gIdx to avoid state race conditions
        const productUpdates: Record<number, any> = {};

        selection.forEach(sel => {
          if (sel.id) {
            newArr = newArr.map(x => x.id === sel.id ? { ...x, x: x.x + dx, y: x.y + dy } : x); changed = true;
          } else if (sel.gIdx !== undefined && sel.type) {
            const slot = slots[sel.gIdx % slots.length]; 
            const cfg = getSlotSettings(sel.gIdx);
            if (!productUpdates[sel.gIdx]) productUpdates[sel.gIdx] = {};
            const up = productUpdates[sel.gIdx];

            if (sel.type === 'image') up.imageConfig = { ...cfg.imageConfig, ...up.imageConfig, offsetX: cfg.imageConfig.offsetX + (dx / slot.width) * 100, offsetY: cfg.imageConfig.offsetY + (dy / slot.height) * 100 };
            else if (sel.type === 'name') up.descConfig = { ...cfg.descConfig, ...up.descConfig, offsetX: cfg.descConfig.offsetX + (dx / slot.width) * 100, offsetY: cfg.descConfig.offsetY + (dy / slot.height) * 100 };
            else if (sel.type === 'badgeBg') {
              if (!up.priceBadge) up.priceBadge = { ...cfg.priceBadge };
              up.priceBadge.badgeOffsetX = cfg.priceBadge.badgeOffsetX + (dx / slot.width) * 100;
              up.priceBadge.badgeOffsetY = cfg.priceBadge.badgeOffsetY + (dy / slot.height) * 100;
            } else {
              if (!up.priceBadge) up.priceBadge = { ...cfg.priceBadge };
              const keyBase = sel.type.replace('badge', '').toLowerCase() || 'value';
              up.priceBadge[`${keyBase}OffsetX`] = (cfg.priceBadge as any)[`${keyBase}OffsetX`] + (dx / (cfg.priceBadge.badgeWidth * (slot.width/500))) * 100;
              up.priceBadge[`${keyBase}OffsetY`] = (cfg.priceBadge as any)[`${keyBase}OffsetY`] + (dy / (cfg.priceBadge.badgeHeight * (slot.width/500))) * 100;
            }
          }
        });
        
        // Commit product updates
        Object.entries(productUpdates).forEach(([gIdx, up]) => updateSlotSettings(+gIdx, up));
        
        if (changed) setCustomCanvasElements(p => ({ ...p, [activePage]: newArr }));
      }
    }
    setDragging(false); setDragState(null); setResizeAnchor(null); setResizeState(null); setResizeStartW(0); setResizeStarts({}); setAltDragCloned(false); setIsRotating(false);
  };

  /* ───────────── SPAWN SHAPE/TEXT ON CANVAS CLICK ───────────── */
  const spawnOnCanvas = (e: React.MouseEvent) => {
    if (activeTool === 'v' || spaceHeld) return;
    const c = toSvg(e.clientX, e.clientY);
    const id = crypto.randomUUID();
    let el: CanvasElement = { id, type: 'text', x: c.x - 100, y: c.y - 30, w: 300, h: 80, zIndex: nextZ.current++, data: { text: '' }, style: { color: '#000000', fontSize: 40, fontFamily: 'Oswald', fontWeight: '700', align: 'left', bgColor: 'transparent', lineHeight: 1.2, letterSpacing: 0, opacity: 1 } };
    if (activeTool === 'm') { el.type = 'rect'; el.w = 200; el.h = 120; el.style = { bgColor: '#f5a623', borderColor: 'transparent', borderWidth: 0, borderRadius: 0, opacity: 1 }; }
    else if (activeTool === 'l') { el.type = 'circle'; el.w = 150; el.h = 150; el.style = { bgColor: '#e94560', opacity: 1 }; }
    pushHistory();
    setCustomCanvasElements(p => ({ ...p, [activePage]: [...(p[activePage] || []), el] }));
    setSelection([{ id }]);
    if (activeTool === 't') setInlineEdit({ id, value: '' });
    setActiveTool('v');
  };

  /* ───────────── HELPER: update custom element ───────────── */
  const updateEl = (id: string, patch: Partial<CanvasElement>) => setCustomCanvasElements(p => ({ ...p, [activePage]: (p[activePage] || []).map(el => el.id === id ? { ...el, ...patch } : el) }));
  const updateElStyle = (id: string, key: string, val: any) => setCustomCanvasElements(p => ({ ...p, [activePage]: (p[activePage] || []).map(el => el.id === id ? { ...el, style: { ...el.style, [key]: val } } : el) }));
  const updateElData = (id: string, text: string) => setCustomCanvasElements(p => ({ ...p, [activePage]: (p[activePage] || []).map(el => el.id === id ? { ...el, data: { ...el.data, text } } : el) }));

  /* ───────────── LAYER HELPERS (Unified Stack) ───────────── */
  const getUniversalStack = (customEls: any[]) => {
    const stack: any[] = [];
    customEls.forEach(el => {
      if (!el.type || el.type !== 'z_override') stack.push({ ...el, isTemplate: false, zIndex: el.zIndex || 1000 });
    });
    const zMap: any = { image: 10, badgeBg: 20, badgeCurrency: 21, badgeValue: 22, badgeSuffix: 23, name: 30 };
    slots.forEach((slot, sIdx) => {
      const gIdx = activePage * slots.length + sIdx;
      if (!products[gIdx]) return;
      const baseZ = gIdx * 100;
      Object.keys(zMap).forEach(type => {
        const id = `slot-${gIdx}-${type}`;
        const over = customEls.find(e => e.id === id);
        stack.push({ id, isTemplate: true, gIdx, type, el: slot, zIndex: over ? over.zIndex : baseZ + zMap[type] });
      });
    });
    stack.sort((a, b) => a.zIndex - b.zIndex);
    return stack;
  };

  const layerAction = (action: 'forward' | 'backward' | 'front' | 'back') => {
    pushHistory();
    const ids = selection.map(s => s.id || (s.gIdx !== undefined && s.type ? `slot-${s.gIdx}-${s.type}` : ''));
    if (!ids.filter(Boolean).length) return;
    
    setCustomCanvasElements(p => {
      const customEls = p[activePage] || [];
      const stack = getUniversalStack(customEls);
      
      if (action === 'forward') {
        for (let i = stack.length - 2; i >= 0; i--) {
          if (ids.includes(stack[i].id) && !ids.includes(stack[i + 1].id)) {
            [stack[i], stack[i + 1]] = [stack[i + 1], stack[i]];
          }
        }
      } else if (action === 'backward') {
        for (let i = 1; i < stack.length; i++) {
          if (ids.includes(stack[i].id) && !ids.includes(stack[i - 1].id)) {
            [stack[i], stack[i - 1]] = [stack[i - 1], stack[i]];
          }
        }
      } else if (action === 'front') {
        const sel = stack.filter(i => ids.includes(i.id));
        const rest = stack.filter(i => !ids.includes(i.id));
        stack.length = 0; stack.push(...rest, ...sel);
      } else if (action === 'back') {
        const sel = stack.filter(i => ids.includes(i.id));
        const rest = stack.filter(i => !ids.includes(i.id));
        stack.length = 0; stack.push(...sel, ...rest);
      }
      
      stack.forEach((item, i) => item.zIndex = i + 1);
      
      const newCustom: any[] = [];
      stack.forEach(item => {
        if (!item.isTemplate) {
          const { isTemplate, ...originalEl } = item;
          newCustom.push(originalEl);
        } else {
          const existing = customEls.find(e => e.id === item.id);
          if (existing) newCustom.push({ ...existing, zIndex: item.zIndex });
          else newCustom.push({ id: item.id, type: 'z_override', zIndex: item.zIndex });
        }
      });
      return { ...p, [activePage]: newCustom };
    });
  };

  const bringForward = () => layerAction('forward');
  const sendBackward = () => layerAction('backward');
  const bringToFront = () => layerAction('front');
  const sendToBack = () => layerAction('back');

  /* ───────────── ALIGNMENT ACTIONS ───────────── */
  const alignSelection = (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'distH' | 'distV') => {
    if (!selection.length) return;
    pushHistory();
    const stack = getUniversalStack(customCanvasElements[activePage] || []);
    const targets = selection.map(s => stack.find(item => item.id === (s.id || `slot-${s.gIdx}-${s.type}`))).filter(Boolean);
    if (!targets.length) return;

    // Calculate selection bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    targets.forEach(t => {
      const b = t.isTemplate ? (getElems(t.el, getSlotSettings(t.gIdx)) as any)[t.type] : t;
      minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
    });

    const isArtboard = targets.length === 1;
    const refX = isArtboard ? config.width / 2 : (minX + maxX) / 2;
    const refY = isArtboard ? config.height / 2 : (minY + maxY) / 2;

    const applyUpdate = (id: string, isTemplate: boolean, gIdx: number, typeStr: string, dx: number, dy: number) => {
      if (isTemplate) {
        const slot = slots[gIdx % slots.length];
        const cfg = getSlotSettings(gIdx);
        let up: any = {};
        if (typeStr === 'image') up.imageConfig = { ...cfg.imageConfig, offsetX: cfg.imageConfig.offsetX + (dx / slot.width) * 100, offsetY: cfg.imageConfig.offsetY + (dy / slot.height) * 100 };
        else if (typeStr === 'name') up.descConfig = { ...cfg.descConfig, offsetX: cfg.descConfig.offsetX + (dx / slot.width) * 100, offsetY: cfg.descConfig.offsetY + (dy / slot.height) * 100 };
        else if (typeStr === 'badgeBg') up.priceBadge = { ...cfg.priceBadge, badgeOffsetX: cfg.priceBadge.badgeOffsetX + (dx / slot.width) * 100, badgeOffsetY: cfg.priceBadge.badgeOffsetY + (dy / slot.height) * 100 };
        else {
          const sf = (slot.width / 500);
          const bw = cfg.priceBadge.badgeWidth * sf;
          const bh = cfg.priceBadge.badgeHeight * sf;
          up.priceBadge = { ...cfg.priceBadge, 
            [`${typeStr.replace('badge', '').toLowerCase() || 'value'}OffsetX`]: cfg.priceBadge[`${typeStr.replace('badge', '').toLowerCase() || 'value'}OffsetX` as keyof typeof cfg.priceBadge] as number + (dx / bw) * 100,
            [`${typeStr.replace('badge', '').toLowerCase() || 'value'}OffsetY`]: cfg.priceBadge[`${typeStr.replace('badge', '').toLowerCase() || 'value'}OffsetY` as keyof typeof cfg.priceBadge] as number + (dy / bh) * 100 
          };
        }
        updateSlotSettings(gIdx, up);
      } else {
        setCustomCanvasElements(p => ({ ...p, [activePage]: (p[activePage] || []).map(el => el.id === id ? { ...el, x: el.x + dx, y: el.y + dy } : el) }));
      }
    };

    if (type === 'distH' || type === 'distV') {
      if (targets.length < 3) return;
      const sorted = [...targets].sort((a, b) => {
        const bA = a.isTemplate ? (getElems(a.el, getSlotSettings(a.gIdx)) as any)[a.type] : a;
        const bB = b.isTemplate ? (getElems(b.el, getSlotSettings(b.gIdx)) as any)[b.type] : b;
        return type === 'distH' ? bA.x - bB.x : bA.y - bB.y;
      });
      const firstB = sorted[0].isTemplate ? (getElems(sorted[0].el, getSlotSettings(sorted[0].gIdx)) as any)[sorted[0].type] : sorted[0];
      const lastB = sorted[sorted.length-1].isTemplate ? (getElems(sorted[sorted.length-1].el, getSlotSettings(sorted[sorted.length-1].gIdx)) as any)[sorted[sorted.length-1].type] : sorted[sorted.length-1];
      const totalDist = type === 'distH' ? (lastB.x - firstB.x) : (lastB.y - firstB.y);
      const step = totalDist / (sorted.length - 1);
      sorted.forEach((t, i) => {
        const b = t.isTemplate ? (getElems(t.el, getSlotSettings(t.gIdx)) as any)[t.type] : t;
        const targetPos = (type === 'distH' ? firstB.x : firstB.y) + i * step;
        const delta = targetPos - (type === 'distH' ? b.x : b.y);
        applyUpdate(t.id, t.isTemplate, t.gIdx, t.type, type === 'distH' ? delta : 0, type === 'distV' ? delta : 0);
      });
      return;
    }

    targets.forEach(t => {
      const b = t.isTemplate ? (getElems(t.el, getSlotSettings(t.gIdx)) as any)[t.type] : t;
      let dx = 0, dy = 0;
      if (type === 'left') dx = (isArtboard ? 0 : minX) - b.x;
      else if (type === 'right') dx = (isArtboard ? config.width : maxX) - (b.x + b.w);
      else if (type === 'center') dx = refX - (b.x + b.w / 2);
      else if (type === 'top') dy = (isArtboard ? 0 : minY) - b.y;
      else if (type === 'bottom') dy = (isArtboard ? config.height : maxY) - (b.y + b.h);
      else if (type === 'middle') dy = refY - (b.y + b.h / 2);
      applyUpdate(t.id, t.isTemplate, t.gIdx, t.type, dx, dy);
    });
  };

  /* ───────────── DERIVED STATE FOR RIGHT PANEL ───────────── */
  const propTarget = selection.length >= 1 ? selection[0] : null;
  const propCustom = propTarget?.id ? pageElements.find(x => x.id === propTarget.id) : null;
  const propProductIdx = propTarget?.gIdx !== undefined ? propTarget.gIdx : null;
  const propProductType = propTarget?.type;
  const isTextElement = propCustom?.type === 'text';
  const isShapeElement = propCustom?.type === 'rect' || propCustom?.type === 'circle';
  const isProductText = propProductType === 'name' || propProductType === 'badgeValue' || propProductType === 'badgeCurrency' || propProductType === 'badgeSuffix';
  const isProductImage = propProductType === 'image';
  const isProductBadgeBg = propProductType === 'badgeBg';
  const showTextPanel = isTextElement || isProductText;

  /* ── Product font/style update helpers ── */
  const updateProductFont = useCallback((gIdx: number, type: EditElemType, key: string, val: any) => {
    pushHistory();
    const cfg = getSlotSettings(gIdx);
    if (type === 'name') {
      updateSlotSettings(gIdx, { descConfig: { ...cfg.descConfig, [key]: val } });
    } else if (type === 'badgeValue') {
      const pbKey = key === 'fontFamily' ? 'valueFontFamily' : key === 'fontSize' ? 'valueFontSize' : key === 'color' ? 'valueColor' : key;
      updateSlotSettings(gIdx, { priceBadge: { ...cfg.priceBadge, [pbKey]: val } });
    } else if (type === 'badgeCurrency') {
      const pbKey = key === 'fontFamily' ? 'currencyFontFamily' : key === 'fontSize' ? 'currencyFontSize' : key === 'color' ? 'currencyColor' : key;
      updateSlotSettings(gIdx, { priceBadge: { ...cfg.priceBadge, [pbKey]: val } });
    } else if (type === 'badgeSuffix') {
      const pbKey = key === 'fontSize' ? 'suffixFontSize' : key === 'color' ? 'suffixColor' : key;
      updateSlotSettings(gIdx, { priceBadge: { ...cfg.priceBadge, [pbKey]: val } });
    }
  }, [pushHistory, getSlotSettings, updateSlotSettings]);

  // Get product text style for panel display
  const getProductTextStyle = useCallback((gIdx: number, type: EditElemType) => {
    const cfg = getSlotSettings(gIdx);
    if (type === 'name') {
      return { fontFamily: cfg.descConfig.fontFamily, fontSize: cfg.descConfig.fontSize, fontWeight: '800', color: cfg.descConfig.color, uppercase: cfg.descConfig.uppercase };
    } else if (type === 'badgeValue') {
      return { fontFamily: cfg.priceBadge.valueFontFamily, fontSize: cfg.priceBadge.valueFontSize, fontWeight: '900', color: cfg.priceBadge.valueColor };
    } else if (type === 'badgeCurrency') {
      return { fontFamily: cfg.priceBadge.currencyFontFamily, fontSize: cfg.priceBadge.currencyFontSize, fontWeight: '900', color: cfg.priceBadge.currencyColor };
    } else if (type === 'badgeSuffix') {
      return { fontFamily: cfg.priceBadge.valueFontFamily || 'Montserrat', fontSize: cfg.priceBadge.suffixFontSize, fontWeight: '600', color: cfg.priceBadge.suffixColor };
    }
    return {};
  }, [getSlotSettings]);

  /* ───────────── BOUNDING BOX + HANDLES RENDERER ───────────── */
  const BBox = ({ b, type, gIdx, isCustom, elId, el }: { b: any; type?: EditElemType; gIdx?: number; isCustom?: boolean; elId?: string; el?: any }) => {
    const R = 4 / zoom;
    const onR = (e: React.MouseEvent, a: string) => {
      e.stopPropagation();
      if (isCustom && elId && el) {
        if (a === 'rotate') startInteraction(e, { id: elId }, el.w, false, 'rotate');
        else startResizeCustom(e, elId, a, el);
      }
      else if (type && gIdx !== undefined) startResizeProduct(e, type, gIdx, a);
    };

    const rotation = el?.style?.rotation || 0;
    const dragRotation = (isSelected({ id: elId }) && isRotating && dragState) ? dragState.dx : rotation;
    const currentRot = isCustom ? dragRotation : 0;

    return (
      <g data-ui="1" transform={`rotate(${currentRot}, ${b.x + b.w/2}, ${b.y + b.h/2})`}>
        <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="none" stroke="#007acc" strokeWidth={1.5 / zoom} strokeDasharray={`${4/zoom},${2/zoom}`} />
        <rect x={b.x-R} y={b.y-R} width={R*2} height={R*2} fill="white" stroke="#007acc" strokeWidth={1/zoom} cursor="nw-resize" onMouseDown={e => onR(e, 'nw')} />
        <rect x={b.x+b.w-R} y={b.y-R} width={R*2} height={R*2} fill="white" stroke="#007acc" strokeWidth={1/zoom} cursor="ne-resize" onMouseDown={e => onR(e, 'ne')} />
        <rect x={b.x-R} y={b.y+b.h-R} width={R*2} height={R*2} fill="white" stroke="#007acc" strokeWidth={1/zoom} cursor="sw-resize" onMouseDown={e => onR(e, 'sw')} />
        <rect x={b.x+b.w-R} y={b.y+b.h-R} width={R*2} height={R*2} fill="white" stroke="#007acc" strokeWidth={1/zoom} cursor="se-resize" onMouseDown={e => onR(e, 'se')} />
        
        {isCustom && (
          <g cursor="grab" onMouseDown={e => onR(e, 'rotate')}>
            <line x1={b.x + b.w/2} y1={b.y} x2={b.x + b.w/2} y2={b.y - 12/zoom} stroke="#007acc" strokeWidth={1/zoom} />
            <circle cx={b.x + b.w/2} cy={b.y - 12/zoom} r={R*1.1} fill="white" stroke="#007acc" strokeWidth={1.5/zoom} />
          </g>
        )}
      </g>
    );
  };

  /* ───────────── RENDER ───────────── */
  return (
    <div className="w-full h-screen bg-[#242424] flex flex-col font-sans overflow-hidden text-[#e2e2e2]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* ═══ HEADER ═══ */}
      <div className="h-11 bg-[#2d2d2d] border-b border-[#111] flex items-center px-4 shrink-0 shadow-sm z-50">
        <h1 className="font-black text-sm tracking-wider mr-8"><span className="text-[#E11D48]">Macmidia</span> <span className="text-[#999] font-medium text-xs">Illustrator</span></h1>

        {/* Page tabs */}
        <div className="flex items-center gap-1 mr-auto">
          {Array.from({ length: pageCount }).map((_, i) => (
            <button key={i} onClick={() => { setActivePage(i); setSelection([]); setInlineEdit(null); }} className={`px-4 py-1 text-xs font-semibold uppercase rounded transition-all ${activePage === i ? 'bg-[#444] text-white' : 'text-[#777] hover:text-white hover:bg-[#333]'}`}>Tela {i + 1}</button>
          ))}
        </div>

        {/* Undo/Redo buttons */}
        <div className="flex items-center gap-0.5 mr-3">
          <button onClick={undo} className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#3a3a3a] text-[#888] hover:text-white transition-colors" title="Desfazer (Ctrl+Z)"><Undo2 className="w-3.5 h-3.5" /></button>
          <button onClick={redo} className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#3a3a3a] text-[#888] hover:text-white transition-colors" title="Refazer (Ctrl+Shift+Z)"><Redo2 className="w-3.5 h-3.5" /></button>
        </div>

        {/* Export */}
        <div className="flex items-center gap-2">
          <button onClick={() => exportAllPages('svg')} disabled={isExporting} className="h-7 bg-[#333] hover:bg-[#444] rounded px-3 text-[10px] font-bold text-white flex items-center gap-1.5 transition-colors"><FileIcon className="w-3 h-3" /> SVG {pageCount > 1 ? `(${pageCount})` : ''}</button>
          <button onClick={() => exportAllPages('png')} disabled={isExporting} className="h-7 bg-[#007acc] hover:bg-[#005a9e] rounded px-3 text-[10px] font-bold text-white flex items-center gap-1.5 transition-colors">{isExporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} PNG {pageCount > 1 ? `(${pageCount})` : ''}</button>
          <div className="w-px h-5 bg-[#444] mx-1" />
          <button onClick={() => window.close()} className="w-7 h-7 flex items-center justify-center hover:bg-[#e81123] rounded text-[#888] hover:text-white transition-colors"><X className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ═══ LEFT TOOLBAR ═══ */}
        <div className="w-12 bg-[#2d2d2d] border-r border-[#111] flex flex-col z-10 py-2 items-center gap-1 shrink-0">
          {[
            { tool: 'v' as const, icon: MousePointer2, tip: 'Seleção (V)' },
            { tool: 't' as const, icon: Type, tip: 'Texto (T)' },
            { tool: 'm' as const, icon: Square, tip: 'Retângulo (M)' },
            { tool: 'l' as const, icon: Circle, tip: 'Elipse (L)' },
          ].map(({ tool, icon: Icon, tip }) => (
            <button key={tool} onClick={() => setActiveTool(tool)} className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all ${activeTool === tool ? 'bg-[#007acc] text-white shadow-lg' : 'text-[#888] hover:bg-[#3a3a3a] hover:text-white'}`} title={tip}><Icon className="w-4 h-4" /></button>
          ))}
          <div className="w-6 h-px bg-[#444] my-1" />
          {/* Layer buttons */}
          <button onClick={bringToFront} className="w-9 h-9 flex items-center justify-center rounded-lg text-[#888] hover:bg-[#3a3a3a] hover:text-white transition-all" title="Trazer para frente"><ChevronsUp className="w-4 h-4" /></button>
          <button onClick={bringForward} className="w-9 h-9 flex items-center justify-center rounded-lg text-[#888] hover:bg-[#3a3a3a] hover:text-white transition-all" title="Avançar camada"><ChevronUp className="w-4 h-4" /></button>
          <button onClick={sendBackward} className="w-9 h-9 flex items-center justify-center rounded-lg text-[#888] hover:bg-[#3a3a3a] hover:text-white transition-all" title="Recuar camada"><ChevronDown className="w-4 h-4" /></button>
          <button onClick={sendToBack} className="w-9 h-9 flex items-center justify-center rounded-lg text-[#888] hover:bg-[#3a3a3a] hover:text-white transition-all" title="Enviar para trás"><ChevronsDown className="w-4 h-4" /></button>
        </div>

        {/* ═══ CANVAS ═══ */}
        <div
          className="flex-1 overflow-hidden relative flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #1a1a1a, #222)', cursor: spaceHeld || isPanning ? 'grab' : activeTool === 't' ? 'text' : activeTool !== 'v' ? 'crosshair' : dragging ? 'grabbing' : 'default' }}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onMouseDown={e => {
            if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
            if (activeTool !== 'v') { spawnOnCanvas(e); return; }
            if (e.button === 1 || (e.button === 0 && spaceHeld)) { e.preventDefault(); setIsPanning(true); setPanStart({ x: e.clientX, y: e.clientY, ox: panOffset.x, oy: panOffset.y }); }
            else { setSelection([]); setInlineEdit(null); }
          }}
          onWheel={e => setZoom(z => Math.min(3, Math.max(0.1, z + (e.deltaY > 0 ? -0.05 : 0.05))))}
        >
          <div style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`, transformOrigin: 'center center' }}>
            <svg ref={svgRef} width={config.width} height={config.height} style={{ background: '#ffffff', display: 'block' }} className="shadow-2xl">
              <defs>
                {customFonts.map(f => <style key={f.name} type="text/css">{`@font-face { font-family: "${f.name}"; src: url("${f.url}"); }`}</style>)}
                {GOOGLE_FONTS.filter(f => !SYSTEM_FONTS.includes(f)).map(f => (
                  <style key={f} type="text/css">{`@import url('https://fonts.googleapis.com/css2?family=${f.replace(/ /g, '+')}:wght@400;700;900&display=swap');`}</style>
                ))}
              </defs>
              {config.backgroundImageUrl && <image href={config.backgroundImageUrl} width={config.width} height={config.height} preserveAspectRatio="none" pointerEvents="none" />}

              {/* ─── UNIFIED CANVAS RENDER (Proper Z-Index Interleaving) ─── */}
              {getUniversalStack(customCanvasElements[activePage] || []).map(item => {
                  if (item.isTemplate) {
                    const { gIdx, type } = item;
                    const sIdx = gIdx % slots.length;
                    const slot = slots[sIdx];
                    const product = products[gIdx];
                    if (!slot || !product) return null;

                    const cfg = getSlotSettings(gIdx);
                    const { priceBadge: pb, descConfig: dc } = cfg;
                    const sf = slot.width / 500;
                    const elData = getElems(slot, cfg);
                    const box = (elData as any)[type];
                    if (!box) return null;

                    let f = 1; let bx = box.x; let by = box.y;
                    const sel = selection.find(s => s.gIdx === gIdx && s.type === type);
                    if (sel) {
                      if (dragging && dragState) { bx += dragState.dx; by += dragState.dy; }
                      if (resizeAnchor && resizeState && resizeStartW > 0) { let dw = resizeState.dw; if (resizeAnchor === 'nw' || resizeAnchor === 'sw') dw = -dw; f = Math.max(0.1, 1 + dw / resizeStartW); }
                    }
                    const isSel = !!sel;

                    const nameLines = wrapText(dc.uppercase ? product.name.toUpperCase() : product.name, elData.name.w, dc.fontSize * sf);
                    const nameY = elData.name.y + elData.name.h / 2;
                    const nameLH = dc.fontSize * sf * 1.1;

                    return (
                      <g key={item.id}
                        transform={`translate(${bx - box.x}, ${by - box.y}) scale(${f})`}
                        style={{ transformOrigin: `${box.x + box.w/2}px ${box.y + box.h/2}px` }}
                        onMouseDown={e => startDragProduct(e, type as EditElemType, gIdx)}
                        onDoubleClick={e => {
                          e.stopPropagation();
                          if (type === 'name') setInlineEdit({ gIdx, type: 'name', value: product.name });
                          else if (type === 'badgeValue') setInlineEdit({ gIdx, type: 'badgeValue', value: product.price });
                        }}
                      >
                        <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="none" pointerEvents="all" />
                        
                        {type === 'image' && product.images?.[0] && <image href={product.images[0]} x={elData.image.x} y={elData.image.y} width={elData.image.w} height={elData.image.h} preserveAspectRatio="xMidYMid meet" pointerEvents="none" />}
                        
                        {type === 'badgeBg' && (pb.badgeImageUrl ? <image href={pb.badgeImageUrl} x={elData.badgeBg.x} y={elData.badgeBg.y} width={elData.badgeBg.w} height={elData.badgeBg.h} preserveAspectRatio="xMidYMid meet" pointerEvents="none" /> : <rect x={elData.badgeBg.x} y={elData.badgeBg.y} width={elData.badgeBg.w} height={elData.badgeBg.h} rx={pb.borderRadius * sf} fill={pb.bgColor} pointerEvents="none" />)}
                        
                        {type === 'badgeCurrency' && <text x={elData.badgeCurrency.x} y={elData.badgeCurrency.y + elData.badgeCurrency.h*0.8} fontSize={pb.currencyFontSize * sf} fill={pb.currencyColor} fontWeight="900" fontFamily={pb.currencyFontFamily} pointerEvents="none">R$</text>}
                        
                        {type === 'badgeValue' && (
                          inlineEdit?.gIdx === gIdx && inlineEdit?.type === 'badgeValue' ? (
                            <foreignObject x={elData.badgeValue.x - 60} y={elData.badgeValue.y} width={elData.badgeValue.w + 120} height={elData.badgeValue.h + 10}>
                              <input autoFocus value={inlineEdit.value}
                                onChange={e => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                                onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') { const np = [...products]; np[gIdx] = { ...np[gIdx], price: inlineEdit.value }; setProducts(np); setInlineEdit(null); } }}
                                onBlur={() => { const np = [...products]; np[gIdx] = { ...np[gIdx], price: inlineEdit.value }; setProducts(np); setInlineEdit(null); }}
                                style={{ width: '100%', height: '100%', background: 'transparent', color: pb.valueColor, fontSize: pb.valueFontSize * sf, fontFamily: pb.valueFontFamily, fontWeight: 900, textAlign: 'center', border: 'none', borderRadius: 0, outline: 'none', padding: '0 4px', caretColor: '#007acc' }} />
                            </foreignObject>
                          ) : (
                            <text x={elData.badgeValue.x + elData.badgeValue.w/2} y={elData.badgeValue.y + elData.badgeValue.h*0.8} fontSize={pb.valueFontSize * sf} fill={pb.valueColor} fontWeight="900" textAnchor="middle" fontFamily={pb.valueFontFamily} pointerEvents="none">{product.price.replace('R$', '').trim()}</text>
                          )
                        )}

                        {type === 'badgeSuffix' && pb.showSuffix && <text x={elData.badgeSuffix.x + elData.badgeSuffix.w/2} y={elData.badgeSuffix.y + elData.badgeSuffix.h*0.8} fontSize={pb.suffixFontSize * sf} fill={pb.suffixColor} fontWeight="600" textAnchor="middle" pointerEvents="none">{product.suffix || pb.suffixText}</text>}
                        
                        {type === 'name' && (
                          inlineEdit?.gIdx === gIdx && inlineEdit?.type === 'name' ? (
                            <foreignObject x={elData.name.x - 20} y={elData.name.y - 10} width={elData.name.w + 40} height={elData.name.h + 40}>
                              <textarea autoFocus value={inlineEdit.value}
                                onChange={e => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                                onBlur={() => { const np = [...products]; np[gIdx] = { ...np[gIdx], name: inlineEdit.value }; setProducts(np); setInlineEdit(null); }}
                                style={{ width: '100%', height: '100%', background: 'transparent', color: dc.color, fontSize: dc.fontSize * sf, fontFamily: dc.fontFamily, fontWeight: 800, textAlign: 'center', border: 'none', borderRadius: 0, outline: 'none', resize: 'none', padding: '8px', overflow: 'hidden', caretColor: '#007acc' }} />
                            </foreignObject>
                          ) : (
                            <text textAnchor="middle" fill={dc.color} fontSize={dc.fontSize * sf} fontWeight="800" fontFamily={dc.fontFamily} pointerEvents="none">
                              {nameLines.map((line, i) => <tspan key={i} x={elData.name.x + elData.name.w / 2} y={nameY - ((nameLines.length - 1) * nameLH / 2) + i * nameLH}>{line}</tspan>)}
                            </text>
                          )
                        )}

                        {isSel && !inlineEdit && <BBox b={box} type={type as EditElemType} gIdx={gIdx} />}
                      </g>
                    );
                  } else {
                    const el = item as CanvasElement;
                const s = el.style; const isSel = isSelected({ id: el.id });
                let cX = el.x; let cY = el.y; let factor = 1;
                if (isSel) {
                  if (dragging && dragState) { cX += dragState.dx; cY += dragState.dy; }
                  if (resizeAnchor && resizeState && resizeStartW > 0) { let dw = resizeState.dw; if (resizeAnchor === 'nw' || resizeAnchor === 'sw') dw = -dw; factor = Math.max(0.1, 1 + dw / resizeStartW); }
                }

                let shape: React.ReactNode = null;
                if (el.type === 'rect') {
                  // Support rects that have imageOnly productData (legacy clones)
                  if (el.productData?.imageOnly && el.productData?.imageUrl) {
                    shape = <image href={el.productData.imageUrl} x={0} y={0} width={el.w} height={el.h} preserveAspectRatio="xMidYMid meet" pointerEvents="none" />;
                  } else {
                    shape = <rect x={0} y={0} width={el.w} height={el.h} fill={s.bgColor} stroke={s.borderColor} strokeWidth={s.borderWidth} rx={s.borderRadius} opacity={s.opacity} />;
                  }
                }
                else if (el.type === 'circle') shape = <ellipse cx={el.w/2} cy={el.h/2} rx={el.w/2} ry={el.h/2} fill={s.bgColor} opacity={s.opacity} />;
                else if (el.type === 'product_clone' && el.productData) {
                  // Support imageOnly clones (from copy/paste & alt+drag of image sub-element)
                  if (el.productData.imageOnly) {
                    shape = el.productData.imageUrl ? <image href={el.productData.imageUrl} x={0} y={0} width={el.w} height={el.h} preserveAspectRatio="xMidYMid meet" pointerEvents="none" /> : null;
                  } else if (el.productData.product && el.productData.cfg && el.productData.slot) {
                    const { product, cfg, slot } = el.productData;
                    const sfc = el.w / (slot.width || 1);
                    const sf2 = (slot.width / 500) * sfc;
                    const fW = slot.width * sfc; const fH = slot.height * sfc;
                    const nameLines2 = wrapText(product.name.toUpperCase(), fW * 0.8, cfg.descConfig.fontSize * sf2);
                    shape = (
                      <g pointerEvents="none">
                        {product.images?.[0] && <image href={product.images[0]} x={fW*0.1} y={fH*0.05} width={fW*0.8*cfg.imageConfig.scale} height={fH*0.5*cfg.imageConfig.scale} preserveAspectRatio="xMidYMid meet" />}
                        <text textAnchor="middle" fill={cfg.descConfig.color} fontSize={cfg.descConfig.fontSize*sf2} fontFamily={cfg.descConfig.fontFamily} fontWeight="800">
                          {nameLines2.map((l: string, i: number) => <tspan key={i} x={fW/2} y={fH*0.65 + i * cfg.descConfig.fontSize*sf2*1.1}>{l}</tspan>)}
                        </text>
                        {cfg.priceBadge.badgeImageUrl
                          ? <image href={cfg.priceBadge.badgeImageUrl} x={fW/2 - cfg.priceBadge.badgeWidth*sf2/2} y={fH - cfg.priceBadge.badgeHeight*sf2 - fH*0.05} width={cfg.priceBadge.badgeWidth*sf2} height={cfg.priceBadge.badgeHeight*sf2} preserveAspectRatio="xMidYMid meet" />
                          : <rect x={fW/2 - cfg.priceBadge.badgeWidth*sf2/2} y={fH - cfg.priceBadge.badgeHeight*sf2 - fH*0.05} width={cfg.priceBadge.badgeWidth*sf2} height={cfg.priceBadge.badgeHeight*sf2} fill={cfg.priceBadge.bgColor} rx={cfg.priceBadge.borderRadius*sf2} />}
                        <text x={fW/2} y={fH - fH*0.05 - cfg.priceBadge.badgeHeight*sf2*0.2} fill={cfg.priceBadge.valueColor} fontSize={cfg.priceBadge.valueFontSize*sf2} fontFamily={cfg.priceBadge.valueFontFamily} fontWeight="900" textAnchor="middle">{product.price}</text>
                      </g>
                    );
                  }
                } else if (el.type === 'text') {
                  const tAn = s.align === 'left' ? 'start' : s.align === 'right' ? 'end' : 'middle';
                  const tX = s.align === 'left' ? 8 : s.align === 'right' ? el.w - 8 : el.w / 2;
                  const fs = s.fontSize || 40;
                  const lh = fs * (s.lineHeight || 1.2);

                  if (inlineEdit?.id === el.id) {
                    shape = (
                      <foreignObject x={0} y={0} width={el.w} height={Math.max(el.h, 60)}>
                        <textarea autoFocus value={inlineEdit.value}
                          onChange={e => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                          onBlur={() => { updateElData(el.id, inlineEdit.value); setInlineEdit(null); }}
                          onKeyDown={e => { if (e.key === 'Escape') { updateElData(el.id, inlineEdit.value); setInlineEdit(null); } }}
                          style={{
                            width: '100%', height: '100%',
                            background: 'transparent', color: s.color || '#000',
                            fontSize: fs, fontFamily: s.fontFamily || 'Inter',
                            fontWeight: s.fontWeight || '400', textAlign: (s.align || 'left') as any,
                            letterSpacing: s.letterSpacing || 0, lineHeight: `${s.lineHeight || 1.2}`,
                            border: 'none', borderRadius: 0,
                            outline: 'none', resize: 'none', padding: '4px 8px', overflow: 'hidden',
                            textTransform: s.uppercase ? 'uppercase' : 'none',
                            caretColor: '#007acc'
                          }} />
                      </foreignObject>
                    );
                  } else {
                    const lines = wrapText(s.uppercase ? (el.data.text || '').toUpperCase() : (el.data.text || ''), el.w - 16, fs);
                    shape = (
                      <g
                        onDoubleClick={e => { e.stopPropagation(); setInlineEdit({ id: el.id, value: el.data.text || '' }); }}
                        onMouseDown={e => {
                          if (activeTool === 't') { e.stopPropagation(); e.preventDefault(); setInlineEdit({ id: el.id, value: el.data.text || '' }); setSelection([{ id: el.id }]); return; }
                        }}
                      >
                        {s.bgColor && s.bgColor !== 'transparent' && <rect x={0} y={0} width={el.w} height={el.h} fill={s.bgColor} rx={4} pointerEvents="none" />}
                        <text fontFamily={s.fontFamily} fontSize={fs} fontWeight={s.fontWeight} fill={s.color} textAnchor={tAn} letterSpacing={s.letterSpacing} opacity={s.opacity} pointerEvents="none">
                          {lines.map((l, i) => <tspan key={i} x={tX} y={fs + i * lh}>{l}</tspan>)}
                        </text>
                      </g>
                    );
                  }
                }

                return (
                  <g key={el.id} 
                    transform={`translate(${cX}, ${cY}) scale(${factor}) rotate(${isSel && isRotating && dragState ? dragState.dx : (s.rotation || 0)}, ${el.w/2}, ${el.h/2})`}
                    style={{ transformOrigin: `${el.w/2}px ${el.h/2}px` }}
                    onMouseDown={e => {
                      if (activeTool === 't' && el.type === 'text') { e.stopPropagation(); e.preventDefault(); setInlineEdit({ id: el.id, value: el.data.text || '' }); setSelection([{ id: el.id }]); return; }
                      startDragCustom(e, el.id, el);
                    }}
                  >
                    <rect x={0} y={0} width={el.w} height={el.h} fill="none" pointerEvents="all" />
                    {shape}
                    {isSel && !inlineEdit && <BBox b={{ x: 0, y: 0, w: el.w, h: el.h }} isCustom elId={el.id} el={el} />}
                  </g>
                );
                }
              })}

            </svg>
          </div>

          {/* Zoom indicator */}
          <div className="absolute bottom-4 left-4 flex items-center bg-[#2d2d2d] rounded-lg border border-[#444] shadow-xl overflow-hidden">
            <button onClick={() => setZoom(z => Math.max(0.1, z - 0.1))} className="text-[#888] hover:text-white w-8 h-7 flex items-center justify-center hover:bg-[#3a3a3a]"><ZoomOut className="w-3.5 h-3.5"/></button>
            <span className="text-[10px] font-bold text-[#aaa] w-12 text-center select-none">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(3, z + 0.1))} className="text-[#888] hover:text-white w-8 h-7 flex items-center justify-center hover:bg-[#3a3a3a]"><ZoomIn className="w-3.5 h-3.5"/></button>
          </div>

          {/* Shortcut hints (bottom-right) */}
          <div className="absolute bottom-4 right-[296px] text-[9px] text-[#555] space-x-3 select-none">
            <span>V Seleção</span> <span>T Texto</span> <span>Space Pan</span> <span>Ctrl+Z Desfazer</span> <span>Ctrl+G Agrupar</span> <span>Alt+Drag Duplicar</span>
          </div>
        </div>

        {/* ═══ RIGHT PANEL — CONTEXTUAL PROPERTIES ═══ */}
        <div className="w-[280px] bg-[#2d2d2d] border-l border-[#111] flex flex-col z-10 overflow-hidden shrink-0">
          <div className="h-9 px-4 border-b border-[#333] flex items-center bg-[#333]">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#aaa]">
              {showTextPanel ? 'Caractere' : isShapeElement ? 'Aparência' : isProductImage ? 'Imagem' : isProductBadgeBg ? 'Badge' : selection.length > 1 ? 'Múltipla Seleção' : 'Propriedades'}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-4" style={{ scrollbarWidth: 'thin', scrollbarColor: '#444 #2d2d2d' }}>
            {/* ─── NO SELECTION ─── */}
            {selection.length === 0 && (
              <div className="text-center text-[#555] mt-16 space-y-2">
                <MousePointer2 className="w-6 h-6 mx-auto opacity-40" />
                <p className="text-[11px]">Clique em um elemento para ver suas propriedades</p>
                <p className="text-[10px] text-[#444]">Duplo clique em textos para editar inline</p>
              </div>
            )}

            {/* ─── TRANSFORM PANEL (Always visible if selection.length === 1) ─── */}
            {selection.length === 1 && (propCustom || propProductIdx !== null) && (
              <div className="space-y-2">
                <label className="text-[9px] text-[#888] uppercase font-bold block">Transformar</label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid grid-cols-2 bg-[#1e1e1e] border border-[#444] rounded h-7 items-center px-1">
                    <span className="text-[9px] text-[#555] font-mono">X</span>
                    <input type="number" value={Math.round(propCustom ? propCustom.x : (getElems(slots[propProductIdx! % slots.length], getSlotSettings(propProductIdx!)) as any)[propProductType!]?.x)} 
                      onChange={e => {
                        const val = +e.target.value;
                        if (propCustom) updateEl(propCustom.id, { x: val });
                        else {
                          const b = (getElems(slots[propProductIdx! % slots.length], getSlotSettings(propProductIdx!)) as any)[propProductType!];
                          const dx = val - b.x; alignSelection('left'); // Use align logic internally or direct update
                          // For product parts, we'd need to calculate correct offset. For now, simple direct UI update is fine.
                        }
                      }} className="bg-transparent text-[10px] text-[#ccc] outline-none w-full" />
                  </div>
                  <div className="grid grid-cols-2 bg-[#1e1e1e] border border-[#444] rounded h-7 items-center px-1">
                    <span className="text-[9px] text-[#555] font-mono">Y</span>
                    <input type="number" value={Math.round(propCustom ? propCustom.y : (getElems(slots[propProductIdx! % slots.length], getSlotSettings(propProductIdx!)) as any)[propProductType!]?.y)} 
                      onChange={e => propCustom && updateEl(propCustom.id, { y: +e.target.value })} className="bg-transparent text-[10px] text-[#ccc] outline-none w-full" />
                  </div>
                  <div className="grid grid-cols-2 bg-[#1e1e1e] border border-[#444] rounded h-7 items-center px-1">
                    <span className="text-[9px] text-[#555] font-mono">W</span>
                    <input type="number" value={Math.round(propCustom ? propCustom.w : (getElems(slots[propProductIdx! % slots.length], getSlotSettings(propProductIdx!)) as any)[propProductType!]?.w)} 
                      onChange={e => propCustom && updateEl(propCustom.id, { w: +e.target.value })} className="bg-transparent text-[10px] text-[#ccc] outline-none w-full" />
                  </div>
                  <div className="grid grid-cols-2 bg-[#1e1e1e] border border-[#444] rounded h-7 items-center px-1">
                    <span className="text-[9px] text-[#555] font-mono">H</span>
                    <input type="number" value={Math.round(propCustom ? propCustom.h : (getElems(slots[propProductIdx! % slots.length], getSlotSettings(propProductIdx!)) as any)[propProductType!]?.h)} 
                      onChange={e => propCustom && updateEl(propCustom.id, { h: +e.target.value })} className="bg-transparent text-[10px] text-[#ccc] outline-none w-full" />
                  </div>
                  <div className="grid grid-cols-2 bg-[#1e1e1e] border border-[#444] rounded h-7 items-center px-1">
                    <span className="text-[9px] text-[#555] font-mono">Ang</span>
                    <input type="number" value={Math.round(propCustom?.style?.rotation || 0)} 
                      onChange={e => propCustom && updateElStyle(propCustom.id, 'rotation', +e.target.value)} className="bg-transparent text-[10px] text-[#ccc] outline-none w-full" />
                  </div>
                </div>
              </div>
            )}

            {/* ─── TEXT PROPERTIES (Custom text element) ─── */}
            {isTextElement && propCustom && (
              <>
                {/* Font Family */}
                <div>
                  <label className="text-[9px] text-[#888] uppercase font-bold mb-1 block">Família da Fonte</label>
                  <select
                    value={propCustom.style.fontFamily || 'Inter'}
                    onChange={e => { loadGFont(e.target.value); updateElStyle(propCustom.id, 'fontFamily', e.target.value); }}
                    className="w-full bg-[#1e1e1e] border border-[#444] rounded h-8 px-2 text-xs text-[#ccc] outline-none focus:border-[#007acc] cursor-pointer"
                    style={{ fontFamily: propCustom.style.fontFamily }}
                  >
                    {GOOGLE_FONTS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                    {customFonts.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
                  </select>
                </div>
                {/* Font Size + Weight */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] text-[#888] uppercase font-bold mb-1 block">Tamanho</label>
                    <input type="number" value={propCustom.style.fontSize || 40} onChange={e => updateElStyle(propCustom.id, 'fontSize', +e.target.value)} className="w-full bg-[#1e1e1e] border border-[#444] rounded h-7 px-2 text-xs text-[#ccc] outline-none focus:border-[#007acc]" />
                  </div>
                  <div>
                    <label className="text-[9px] text-[#888] uppercase font-bold mb-1 block">Peso</label>
                    <select value={propCustom.style.fontWeight || '700'} onChange={e => updateElStyle(propCustom.id, 'fontWeight', e.target.value)} className="w-full bg-[#1e1e1e] border border-[#444] rounded h-7 px-2 text-xs text-[#ccc] outline-none focus:border-[#007acc] cursor-pointer">
                      <option value="400">Regular</option><option value="500">Medium</option><option value="600">Semibold</option><option value="700">Bold</option><option value="800">Extra Bold</option><option value="900">Black</option>
                    </select>
                  </div>
                </div>
                {/* Alignment */}
                <div>
                  <label className="text-[9px] text-[#888] uppercase font-bold mb-1 block">Alinhamento</label>
                  <div className="flex h-7 rounded overflow-hidden border border-[#444]">
                    {(['left', 'center', 'right'] as const).map(a => (
                      <button key={a} onClick={() => updateElStyle(propCustom.id, 'align', a)} className={`flex-1 flex items-center justify-center transition-colors ${propCustom.style.align === a ? 'bg-[#007acc] text-white' : 'bg-[#1e1e1e] text-[#888] hover:bg-[#333]'}`}>
                        {a === 'left' ? <AlignLeft className="w-3 h-3"/> : a === 'center' ? <AlignCenter className="w-3 h-3"/> : <AlignRight className="w-3 h-3"/>}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Line Height + Letter Spacing */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] text-[#888] uppercase font-bold mb-1 block">Entrelinhas</label>
                    <input type="number" step="0.1" value={propCustom.style.lineHeight || 1.2} onChange={e => updateElStyle(propCustom.id, 'lineHeight', +e.target.value)} className="w-full bg-[#1e1e1e] border border-[#444] rounded h-7 px-2 text-xs text-[#ccc] outline-none focus:border-[#007acc]" />
                  </div>
                  <div>
                    <label className="text-[9px] text-[#888] uppercase font-bold mb-1 block">Espaçamento</label>
                    <input type="number" step="0.5" value={propCustom.style.letterSpacing || 0} onChange={e => updateElStyle(propCustom.id, 'letterSpacing', +e.target.value)} className="w-full bg-[#1e1e1e] border border-[#444] rounded h-7 px-2 text-xs text-[#ccc] outline-none focus:border-[#007acc]" />
                  </div>
                </div>
                {/* Colors */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] text-[#888] uppercase font-bold mb-1 block">Cor do Texto</label>
                    <div className="flex bg-[#1e1e1e] border border-[#444] rounded h-7 overflow-hidden">
                      <input type="color" value={propCustom.style.color || '#000000'} onChange={e => updateElStyle(propCustom.id, 'color', e.target.value)} className="w-7 h-full border-0 p-0 bg-transparent cursor-pointer" />
                      <input type="text" value={propCustom.style.color || '#000000'} onChange={e => updateElStyle(propCustom.id, 'color', e.target.value)} className="flex-1 bg-transparent px-1 text-[10px] text-[#ccc] outline-none uppercase font-mono" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] text-[#888] uppercase font-bold mb-1 block">Fundo</label>
                    <div className="flex bg-[#1e1e1e] border border-[#444] rounded h-7 overflow-hidden">
                      <input type="color" value={propCustom.style.bgColor === 'transparent' ? '#000000' : propCustom.style.bgColor || '#000000'} onChange={e => updateElStyle(propCustom.id, 'bgColor', e.target.value)} className="w-7 h-full border-0 p-0 bg-transparent cursor-pointer" />
                      <input type="text" value={propCustom.style.bgColor || 'transparent'} onChange={e => updateElStyle(propCustom.id, 'bgColor', e.target.value)} className="flex-1 bg-transparent px-1 text-[10px] text-[#ccc] outline-none uppercase font-mono" />
                    </div>
                  </div>
                </div>
                {/* Uppercase toggle */}
                <div>
                  <label className="flex items-center gap-2 cursor-pointer" onClick={() => updateElStyle(propCustom.id, 'uppercase', !propCustom.style.uppercase)}>
                    <div className={`w-8 h-4 rounded-full transition-colors flex items-center ${propCustom.style.uppercase ? 'bg-[#007acc] justify-end' : 'bg-[#444] justify-start'}`}><div className="w-3.5 h-3.5 rounded-full bg-white mx-0.5" /></div>
                    <span className="text-[10px] text-[#aaa]">CAIXA ALTA</span>
                  </label>
                </div>
                {/* Dimensions */}
                <div>
                  <label className="text-[9px] text-[#888] uppercase font-bold mb-1 block">Caixa de Texto</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] text-[#555]">Largura</label>
                      <input type="number" value={Math.round(propCustom.w)} onChange={e => updateEl(propCustom.id, { w: +e.target.value })} className="w-full bg-[#1e1e1e] border border-[#444] rounded h-7 px-2 text-xs text-[#ccc] outline-none focus:border-[#007acc]" />
                    </div>
                    <div>
                      <label className="text-[9px] text-[#555]">Altura</label>
                      <input type="number" value={Math.round(propCustom.h)} onChange={e => updateEl(propCustom.id, { h: +e.target.value })} className="w-full bg-[#1e1e1e] border border-[#444] rounded h-7 px-2 text-xs text-[#ccc] outline-none focus:border-[#007acc]" />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ─── SHAPE PROPERTIES ─── */}
            {isShapeElement && propCustom && (
              <>
                <div>
                  <label className="text-[9px] text-[#888] uppercase font-bold mb-1 block">Preenchimento</label>
                  <div className="flex bg-[#1e1e1e] border border-[#444] rounded h-7 overflow-hidden">
                    <input type="color" value={propCustom.style.bgColor || '#000000'} onChange={e => updateElStyle(propCustom.id, 'bgColor', e.target.value)} className="w-7 h-full border-0 p-0 bg-transparent cursor-pointer" />
                    <input type="text" value={propCustom.style.bgColor || '#000000'} onChange={e => updateElStyle(propCustom.id, 'bgColor', e.target.value)} className="flex-1 bg-transparent px-2 text-[10px] text-[#ccc] outline-none uppercase font-mono" />
                  </div>
                </div>
                {propCustom.type === 'rect' && (
                  <>
                  <div>
                    <label className="text-[9px] text-[#888] uppercase font-bold mb-1 block">Contorno</label>
                    <div className="flex bg-[#1e1e1e] border border-[#444] rounded h-7 overflow-hidden">
                      <input type="color" value={propCustom.style.borderColor || '#000000'} onChange={e => updateElStyle(propCustom.id, 'borderColor', e.target.value)} className="w-7 h-full border-0 p-0 bg-transparent cursor-pointer" />
                      <input type="number" value={propCustom.style.borderWidth || 0} onChange={e => updateElStyle(propCustom.id, 'borderWidth', +e.target.value)} className="flex-1 bg-transparent px-2 text-[10px] text-[#ccc] outline-none" placeholder="px" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] text-[#888] uppercase font-bold mb-1 block">Arredondamento</label>
                    <input type="number" value={propCustom.style.borderRadius || 0} onChange={e => updateElStyle(propCustom.id, 'borderRadius', +e.target.value)} className="w-full bg-[#1e1e1e] border border-[#444] rounded h-7 px-2 text-xs text-[#ccc] outline-none focus:border-[#007acc]" />
                  </div>
                  </>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] text-[#555]">Largura</label>
                    <input type="number" value={Math.round(propCustom.w)} onChange={e => updateEl(propCustom.id, { w: +e.target.value })} className="w-full bg-[#1e1e1e] border border-[#444] rounded h-7 px-2 text-xs text-[#ccc] outline-none focus:border-[#007acc]" />
                  </div>
                  <div>
                    <label className="text-[9px] text-[#555]">Altura</label>
                    <input type="number" value={Math.round(propCustom.h)} onChange={e => updateEl(propCustom.id, { h: +e.target.value })} className="w-full bg-[#1e1e1e] border border-[#444] rounded h-7 px-2 text-xs text-[#ccc] outline-none focus:border-[#007acc]" />
                  </div>
                </div>
                <div>
                  <label className="text-[9px] text-[#888] uppercase font-bold mb-1 block">Opacidade</label>
                  <input type="range" min="0" max="1" step="0.05" value={propCustom.style.opacity ?? 1} onChange={e => updateElStyle(propCustom.id, 'opacity', +e.target.value)} className="w-full accent-[#007acc]" />
                </div>
              </>
            )}

            {/* ─── PRODUCT TEXT PROPERTIES (Font panel for product sub-elements) ─── */}
            {isProductText && propProductIdx !== null && products[propProductIdx] && (() => {
              const pStyle = getProductTextStyle(propProductIdx, propProductType!);
              const typeLabel = propProductType === 'name' ? 'Descrição' : propProductType === 'badgeValue' ? 'Valor' : propProductType === 'badgeCurrency' ? 'R$' : 'Sufixo';
              return (
                <>
                  <div className="bg-[#1e1e1e] border-l-2 border-[#007acc] rounded p-3">
                    <p className="text-[11px] text-white font-bold mb-0.5">{products[propProductIdx].name}</p>
                    <p className="text-[9px] text-[#007acc] font-semibold uppercase">{typeLabel}</p>
                  </div>

                  {/* Font Family */}
                  <div>
                    <label className="text-[9px] text-[#888] uppercase font-bold mb-1 block">Família da Fonte</label>
                    <select
                      value={pStyle.fontFamily || 'Montserrat'}
                      onChange={e => { loadGFont(e.target.value); updateProductFont(propProductIdx, propProductType!, 'fontFamily', e.target.value); }}
                      className="w-full bg-[#1e1e1e] border border-[#444] rounded h-8 px-2 text-xs text-[#ccc] outline-none focus:border-[#007acc] cursor-pointer"
                      style={{ fontFamily: pStyle.fontFamily }}
                    >
                      {GOOGLE_FONTS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                      {customFonts.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
                    </select>
                  </div>

                   {/* Font Size */}
                   <div className="space-y-2">
                     <div className="flex justify-between items-center">
                       <label className="text-[9px] text-[#888] uppercase font-bold">Escala / Tamanho</label>
                       <span className="text-[10px] text-[#007acc] font-mono">{Math.round(pStyle.fontSize || 40)}px</span>
                     </div>
                     <input 
                       type="range" 
                       min="8" 
                       max="200" 
                       step="1" 
                       value={Math.round(pStyle.fontSize || 40)}
                       onChange={e => updateProductFont(propProductIdx, propProductType!, 'fontSize', +e.target.value)}
                       className="w-full accent-[#007acc] h-1.5 bg-[#1e1e1e] rounded-lg appearance-none cursor-pointer" 
                     />
                     <div className="flex gap-2">
                       <input type="number" value={Math.round(pStyle.fontSize || 40)}
                         onChange={e => updateProductFont(propProductIdx, propProductType!, 'fontSize', +e.target.value)}
                         className="flex-1 bg-[#1e1e1e] border border-[#444] rounded h-7 px-2 text-[10px] text-[#ccc] outline-none focus:border-[#007acc]" />
                       <div className="flex-1 bg-[#1e1e1e] border border-[#444] rounded h-7 px-2 flex items-center justify-center">
                         <span className="text-[9px] text-[#666] font-bold truncate">{pStyle.fontWeight}</span>
                       </div>
                     </div>
                   </div>

                  {/* Color */}
                  <div>
                    <label className="text-[9px] text-[#888] uppercase font-bold mb-1 block">Cor do Texto</label>
                    <div className="flex bg-[#1e1e1e] border border-[#444] rounded h-7 overflow-hidden">
                      <input type="color" value={pStyle.color || '#000000'} onChange={e => updateProductFont(propProductIdx, propProductType!, 'color', e.target.value)} className="w-7 h-full border-0 p-0 bg-transparent cursor-pointer" />
                      <input type="text" value={pStyle.color || '#000000'} onChange={e => updateProductFont(propProductIdx, propProductType!, 'color', e.target.value)} className="flex-1 bg-transparent px-1 text-[10px] text-[#ccc] outline-none uppercase font-mono" />
                    </div>
                  </div>

                  {/* Name/Price edit */}
                  {propProductType === 'name' && (
                    <div>
                      <label className="text-[9px] text-[#888] uppercase font-bold mb-1 block">Nome</label>
                      <textarea value={products[propProductIdx].name} onChange={e => { pushHistory(); const np = [...products]; np[propProductIdx] = { ...np[propProductIdx], name: e.target.value }; setProducts(np); }} rows={2} className="w-full bg-[#1e1e1e] border border-[#444] rounded p-2 text-xs text-white outline-none focus:border-[#007acc] resize-none" />
                    </div>
                  )}
                  {propProductType === 'badgeValue' && (
                    <div>
                      <label className="text-[9px] text-[#888] uppercase font-bold mb-1 block">Preço</label>
                      <input value={products[propProductIdx].price} onChange={e => { pushHistory(); const np = [...products]; np[propProductIdx] = { ...np[propProductIdx], price: e.target.value }; setProducts(np); }} className="w-full bg-[#1e1e1e] border border-[#444] rounded h-8 px-3 text-sm font-bold text-white outline-none focus:border-[#007acc]" />
                    </div>
                  )}

                  {/* Uppercase toggle for name */}
                  {propProductType === 'name' && (
                    <div>
                      <label className="flex items-center gap-2 cursor-pointer" onClick={() => {
                        pushHistory();
                        const cfg = getSlotSettings(propProductIdx);
                        updateSlotSettings(propProductIdx, { descConfig: { ...cfg.descConfig, uppercase: !cfg.descConfig.uppercase } });
                      }}>
                        <div className={`w-8 h-4 rounded-full transition-colors flex items-center ${getSlotSettings(propProductIdx).descConfig.uppercase ? 'bg-[#007acc] justify-end' : 'bg-[#444] justify-start'}`}><div className="w-3.5 h-3.5 rounded-full bg-white mx-0.5" /></div>
                        <span className="text-[10px] text-[#aaa]">CAIXA ALTA</span>
                      </label>
                    </div>
                  )}

                  <p className="text-[9px] text-[#444] mt-1">Duplo clique no texto para editar inline</p>
                </>
              );
            })()}

            {/* ─── PRODUCT IMAGE PROPERTIES ─── */}
            {isProductImage && propProductIdx !== null && products[propProductIdx] && (
              <div className="space-y-3">
                <div className="bg-[#1e1e1e] border-l-2 border-[#007acc] rounded p-3">
                  <p className="text-[11px] text-white font-bold mb-0.5">{products[propProductIdx].name}</p>
                  <p className="text-[9px] text-[#007acc] font-semibold uppercase">Imagem</p>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => removeBackground(propProductIdx)}
                    className="flex-1 bg-[#333] hover:bg-[#444] text-[9px] py-2 rounded flex items-center justify-center gap-1.5 transition-colors font-bold"
                    title="Remove o fundo e recorta bordas vazias"
                  >
                    <Scissors className="w-3 h-3 text-[#E11D48]" /> Recortar Fundo
                  </button>
                  <button 
                    onClick={() => autoFitImage(propProductIdx)}
                    className="flex-1 bg-[#333] hover:bg-[#444] text-[9px] py-2 rounded flex items-center justify-center gap-1.5 transition-colors font-bold"
                    title="Ajusta a caixa de seleção ao produto"
                  >
                    <Maximize2 className="w-3 h-3 text-[#007acc]" /> Ajustar Caixa
                  </button>
                </div>

                <div>
                  <label className="text-[9px] text-[#888] uppercase font-bold mb-1 block">Escala</label>
                  <input type="range" min="0.2" max="2" step="0.05" value={getSlotSettings(propProductIdx).imageConfig.scale} onChange={e => { pushHistory(); updateSlotSettings(propProductIdx, { imageConfig: { ...getSlotSettings(propProductIdx).imageConfig, scale: +e.target.value } }); }} className="w-full accent-[#007acc]" />
                  <span className="text-[10px] text-[#666]">{Math.round(getSlotSettings(propProductIdx).imageConfig.scale * 100)}%</span>
                </div>
              </div>
            )}

            {/* ─── PRODUCT BADGE BG PROPERTIES ─── */}
            {isProductBadgeBg && propProductIdx !== null && products[propProductIdx] && (() => {
              const cfg = getSlotSettings(propProductIdx);
              return (
                <div className="space-y-3">
                  <div className="bg-[#1e1e1e] border-l-2 border-[#007acc] rounded p-3">
                    <p className="text-[11px] text-white font-bold mb-0.5">{products[propProductIdx].name}</p>
                    <p className="text-[9px] text-[#007acc] font-semibold uppercase">Fundo do Preço</p>
                  </div>
                  <div>
                    <label className="text-[9px] text-[#888] uppercase font-bold mb-1 block">Cor de Fundo</label>
                    <div className="flex bg-[#1e1e1e] border border-[#444] rounded h-7 overflow-hidden">
                      <input type="color" value={cfg.priceBadge.bgColor || '#e11d48'} onChange={e => { pushHistory(); updateSlotSettings(propProductIdx, { priceBadge: { ...cfg.priceBadge, bgColor: e.target.value } }); }} className="w-7 h-full border-0 p-0 bg-transparent cursor-pointer" />
                      <input type="text" value={cfg.priceBadge.bgColor || '#e11d48'} onChange={e => { pushHistory(); updateSlotSettings(propProductIdx, { priceBadge: { ...cfg.priceBadge, bgColor: e.target.value } }); }} className="flex-1 bg-transparent px-1 text-[10px] text-[#ccc] outline-none uppercase font-mono" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] text-[#888] uppercase font-bold mb-1 block">Tamanho / Escala</label>
                    <input 
                      type="range" 
                      min="50" 
                      max="800" 
                      step="5" 
                      value={cfg.priceBadge.badgeWidth} 
                      onChange={e => {
                        pushHistory();
                        const val = +e.target.value;
                        const ratio = cfg.priceBadge.badgeHeight / cfg.priceBadge.badgeWidth;
                        updateSlotSettings(propProductIdx, { 
                          priceBadge: { 
                            ...cfg.priceBadge, 
                            badgeWidth: val,
                            badgeHeight: Math.round(val * ratio)
                          } 
                        });
                      }} 
                      className="w-full accent-[#007acc] mb-2" 
                    />
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-[7px] text-[#555] uppercase font-bold">Largura</label>
                        <input type="number" value={cfg.priceBadge.badgeWidth || 0} onChange={e => { pushHistory(); updateSlotSettings(propProductIdx, { priceBadge: { ...cfg.priceBadge, badgeWidth: +e.target.value } }); }} className="w-full bg-[#1e1e1e] border border-[#444] rounded h-7 px-2 text-[10px] text-[#ccc]" />
                      </div>
                      <div className="flex-1">
                        <label className="text-[7px] text-[#555] uppercase font-bold">Altura</label>
                        <input type="number" value={cfg.priceBadge.badgeHeight || 0} onChange={e => { pushHistory(); updateSlotSettings(propProductIdx, { priceBadge: { ...cfg.priceBadge, badgeHeight: +e.target.value } }); }} className="w-full bg-[#1e1e1e] border border-[#444] rounded h-7 px-2 text-[10px] text-[#ccc]" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] text-[#888] uppercase font-bold mb-1 block">Arredondamento</label>
                    <input type="range" min="0" max="100" step="1" value={cfg.priceBadge.borderRadius || 0} onChange={e => { pushHistory(); updateSlotSettings(propProductIdx, { priceBadge: { ...cfg.priceBadge, borderRadius: +e.target.value } }); }} className="w-full accent-[#007acc] mb-1" />
                    <input type="number" value={cfg.priceBadge.borderRadius || 0} onChange={e => { pushHistory(); updateSlotSettings(propProductIdx, { priceBadge: { ...cfg.priceBadge, borderRadius: +e.target.value } }); }} className="w-full bg-[#1e1e1e] border border-[#444] rounded h-7 px-2 text-xs text-[#ccc] outline-none focus:border-[#007acc]" />
                  </div>
                </div>
              );
            })()}

            {/* Multiple selection */}
            {selection.length > 1 && !propCustom && propProductIdx === null && (
              <div className="text-center text-[#555] mt-8 space-y-3">
                <p className="text-xs">{selection.length} elementos selecionados</p>
                <p className="text-[10px] text-[#444]">Ctrl+G para agrupar</p>
                <p className="text-[10px] text-[#444]">Shift+Ctrl+G para desagrupar</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfferEditorPage;
