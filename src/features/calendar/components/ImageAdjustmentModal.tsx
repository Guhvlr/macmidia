import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Image as ImageIcon } from 'lucide-react';
import type { CalendarTask } from '@/contexts/app-types';
import { Label } from '@/components/ui/label';

interface FormatConfig {
  id: string;
  label: string;
  desc: string;
  ratio: number;
}

const FORMATS: FormatConfig[] = [
  { id: 'feed_vertical', label: 'Feed Vertical', desc: '4:5 (1080x1350)', ratio: 4/5 },
  { id: 'feed_square', label: 'Feed Quadrado', desc: '1:1 (1080x1080)', ratio: 1/1 },
  { id: 'story', label: 'Story / Reels', desc: '9:16 (1080x1920)', ratio: 9/16 },
];

interface ImageAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: CalendarTask;
  activeImageIndex?: number;
  onSave: (url: string, adjustments: any, format: string) => void;
}

export function ImageAdjustmentModal({ isOpen, onClose, task, activeImageIndex = 0, onSave }: ImageAdjustmentModalProps) {
  const images = task.images || (task.imageUrl ? [task.imageUrl] : []);
  const currentImage = images[activeImageIndex];

  const [activeFormat, setActiveFormat] = useState<string>(FORMATS[0].id);
  const [adjustments, setAdjustments] = useState<Record<string, Record<string, any>>>(task.image_adjustments || {});

  const activeAdjustments = adjustments[currentImage]?.[activeFormat] || {
    mode: 'fit', // 'fit' (Mostrar inteira) or 'fill' (Preencher)
    zoom: 1,
    x: 0,
    y: 0,
    fillType: 'blur', // 'blur' (Desfocado), 'black' (Preto), 'transparent' (Transparente)
    fillColor: '#000000'
  };

  const updateCurrentAdjustment = (updates: any) => {
    setAdjustments(prev => ({
      ...prev,
      [currentImage]: {
        ...(prev[currentImage] || {}),
        [activeFormat]: {
          ...activeAdjustments,
          ...updates
        }
      }
    }));
  };

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    const rect = containerRef.current.getBoundingClientRect();
    const currentPxX = (activeAdjustments.x || 0) * rect.width;
    const currentPxY = (activeAdjustments.y || 0) * rect.height;
    
    setDragStart({ x: e.clientX - currentPxX, y: e.clientY - currentPxY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const newPxX = e.clientX - dragStart.x;
    const newPxY = e.clientY - dragStart.y;
    
    updateCurrentAdjustment({
      x: newPxX / rect.width,
      y: newPxY / rect.height
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const handleSave = () => {
    onSave(currentImage, activeAdjustments, activeFormat);
  };

  if (!currentImage) return null;

  const currentRatio = FORMATS.find(f => f.id === activeFormat)?.ratio || 1;

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[1000px] h-[85vh] p-0 bg-[#0F0F11] border-zinc-800 flex flex-col overflow-hidden">
        <DialogHeader className="p-4 border-b border-zinc-800 flex flex-row items-center justify-between sticky top-0 bg-[#0F0F11] z-10">
          <div>
            <DialogTitle className="text-xl font-bold text-zinc-100">Simulador Visual</DialogTitle>
            <p className="text-sm text-zinc-400 mt-1">Ajustando imagem {activeImageIndex + 1} de {images.length}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-zinc-400 hover:text-white">
            <X className="w-5 h-5" />
          </Button>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden">
          {/* Left / Center Area: Canvas */}
          <div className="flex-1 flex items-center justify-center p-8 bg-[#1A1A1D] overflow-hidden">
            <div 
              ref={containerRef}
              className="relative shadow-2xl ring-1 ring-white/10 rounded-lg transition-all duration-300 overflow-hidden"
              style={{
                aspectRatio: currentRatio,
                height: '100%',
                maxHeight: '600px',
                backgroundColor: activeAdjustments.fillType === 'blur' ? '#000' : 
                                 activeAdjustments.fillType === 'black' ? '#000' : 
                                 activeAdjustments.fillType === 'transparent' ? 'transparent' : '#000',
                backgroundImage: activeAdjustments.fillType === 'transparent' ? 'repeating-conic-gradient(#333 0% 25%, transparent 0% 50%)' : 'none',
                backgroundSize: activeAdjustments.fillType === 'transparent' ? '20px 20px' : 'auto'
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            >
              {activeAdjustments.mode === 'fit' && activeAdjustments.fillType === 'blur' && (
                 <div 
                   className="absolute inset-0 bg-cover bg-center blur-xl opacity-50 scale-110"
                   style={{ backgroundImage: `url(${currentImage})` }}
                 />
              )}
              
              <img 
                src={currentImage} 
                alt="Preview"
                draggable={false}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: activeAdjustments.mode === 'fit' ? 'contain' : 'cover',
                  transform: `translate(${(activeAdjustments.x || 0) * 100}%, ${(activeAdjustments.y || 0) * 100}%) scale(${activeAdjustments.zoom})`,
                  cursor: isDragging ? 'grabbing' : 'grab',
                  transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                }}
                className="relative z-10 pointer-events-none select-none"
              />
            </div>
          </div>

          {/* Right Sidebar: Simulator Controls */}
          <div className="w-[360px] bg-[#161618] border-l border-zinc-800 flex flex-col">
            <div className="p-5 border-b border-zinc-800 flex items-center gap-2 text-zinc-100 font-semibold shrink-0">
              <ImageIcon className="w-4 h-4 text-primary" />
              Controles Visuais
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 space-y-8 custom-scrollbar">
              
              {/* Formato */}
              <div className="space-y-3">
                <Label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Formato</Label>
                <div className="space-y-2">
                  {FORMATS.map(format => (
                    <div 
                      key={format.id}
                      onClick={() => setActiveFormat(format.id)}
                      className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer border transition-all ${activeFormat === format.id ? 'bg-primary/10 border-primary/30 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'}`}
                    >
                      <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${activeFormat === format.id ? 'border-primary' : 'border-zinc-600'}`}>
                        {activeFormat === format.id && <div className="w-2 h-2 rounded-full bg-primary" />}
                      </div>
                      <div>
                        <p className={`font-medium text-sm leading-none ${activeFormat === format.id ? 'text-white' : 'text-zinc-300'}`}>{format.label}</p>
                        <p className="text-xs opacity-70 mt-1.5">{format.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Imagem (Preencher / Zoom / Posição) */}
              <div className="space-y-4 pt-4 border-t border-zinc-800">
                <Label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Imagem</Label>
                
                <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
                  <button
                    onClick={() => updateCurrentAdjustment({ mode: 'fit' })}
                    className={`flex-1 px-4 py-2 rounded-md text-xs font-medium transition-colors ${activeAdjustments.mode === 'fit' ? 'bg-primary text-primary-foreground' : 'text-zinc-400 hover:text-white'}`}
                  >
                    Mostrar Inteira
                  </button>
                  <button
                    onClick={() => updateCurrentAdjustment({ mode: 'fill', x: 0, y: 0, zoom: 1 })}
                    className={`flex-1 px-4 py-2 rounded-md text-xs font-medium transition-colors ${activeAdjustments.mode === 'fill' ? 'bg-primary text-primary-foreground' : 'text-zinc-400 hover:text-white'}`}
                  >
                    Preencher
                  </button>
                </div>

                <div className="space-y-4 mt-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-zinc-400">
                      <span>Zoom</span>
                      <span>{Math.round(activeAdjustments.zoom * 100)}%</span>
                    </div>
                    <input 
                      type="range" min="1" max="3" step="0.01" 
                      value={activeAdjustments.zoom}
                      onChange={(e) => updateCurrentAdjustment({ zoom: parseFloat(e.target.value) })}
                      className="w-full accent-primary"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-zinc-400">
                      <span>Posição X</span>
                      <span>{Math.round((activeAdjustments.x || 0) * 100)}%</span>
                    </div>
                    <input 
                      type="range" min="-1" max="1" step="0.01" 
                      value={activeAdjustments.x || 0}
                      onChange={(e) => updateCurrentAdjustment({ x: parseFloat(e.target.value) })}
                      className="w-full accent-primary"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-zinc-400">
                      <span>Posição Y</span>
                      <span>{Math.round((activeAdjustments.y || 0) * 100)}%</span>
                    </div>
                    <input 
                      type="range" min="-1" max="1" step="0.01" 
                      value={activeAdjustments.y || 0}
                      onChange={(e) => updateCurrentAdjustment({ y: parseFloat(e.target.value) })}
                      className="w-full accent-primary"
                    />
                  </div>
                  
                  <div className="pt-2 flex justify-end">
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-zinc-400 hover:text-white" onClick={() => updateCurrentAdjustment({ x: 0, y: 0, zoom: 1 })}>Resetar Zoom e Posição</Button>
                  </div>
                </div>
              </div>

              {/* Fundo */}
              <div className="space-y-3 pt-4 border-t border-zinc-800">
                <Label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Fundo</Label>
                <div className="flex flex-col gap-2">
                  <label className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-all ${activeAdjustments.fillType === 'transparent' ? 'bg-zinc-800/80 border-zinc-700 text-white' : 'bg-zinc-900/50 border-zinc-800/50 text-zinc-400 hover:border-zinc-800'}`}>
                    <input type="radio" className="hidden" checked={activeAdjustments.fillType === 'transparent'} onChange={() => updateCurrentAdjustment({ fillType: 'transparent' })} />
                    <div className="w-6 h-6 rounded border border-white/10" style={{ backgroundImage: 'repeating-conic-gradient(#333 0% 25%, transparent 0% 50%)', backgroundSize: '10px 10px' }}></div>
                    <span className="font-medium text-sm">Transparente</span>
                  </label>
                  
                  <label className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-all ${activeAdjustments.fillType === 'black' ? 'bg-zinc-800/80 border-zinc-700 text-white' : 'bg-zinc-900/50 border-zinc-800/50 text-zinc-400 hover:border-zinc-800'}`}>
                    <input type="radio" className="hidden" checked={activeAdjustments.fillType === 'black'} onChange={() => updateCurrentAdjustment({ fillType: 'black' })} />
                    <div className="w-6 h-6 rounded bg-black border border-white/20"></div>
                    <span className="font-medium text-sm">Preto</span>
                  </label>
                  
                  <label className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-all ${activeAdjustments.fillType === 'blur' ? 'bg-zinc-800/80 border-zinc-700 text-white' : 'bg-zinc-900/50 border-zinc-800/50 text-zinc-400 hover:border-zinc-800'}`}>
                    <input type="radio" className="hidden" checked={activeAdjustments.fillType === 'blur'} onChange={() => updateCurrentAdjustment({ fillType: 'blur' })} />
                    <div className="w-6 h-6 rounded border border-white/10 bg-gradient-to-br from-zinc-700 to-zinc-900 blur-[2px] overflow-hidden scale-90"></div>
                    <span className="font-medium text-sm">Desfocado</span>
                  </label>
                </div>
              </div>

            </div>

            <div className="p-5 border-t border-zinc-800 bg-[#161618] shrink-0">
              <div className="flex gap-3">
                 <Button variant="outline" className="flex-1 bg-transparent border-zinc-700 hover:bg-zinc-800" onClick={onClose}>
                   Cancelar
                 </Button>
                 <Button className="flex-1" onClick={handleSave}>
                   Salvar Layout
                 </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
