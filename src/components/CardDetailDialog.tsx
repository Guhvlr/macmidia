import { useState, useRef, useCallback } from 'react';
import { KanbanCard as KanbanCardType, useApp } from '@/contexts/AppContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import Timer from './Timer';
import { Trash2, Upload, X, ZoomIn } from 'lucide-react';

interface Props {
  card: KanbanCardType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CardDetailDialog = ({ card, open, onOpenChange }: Props) => {
  const { updateKanbanCard, deleteKanbanCard } = useApp();
  const [clientName, setClientName] = useState(card.clientName);
  const [description, setDescription] = useState(card.description);
  const [notes, setNotes] = useState(card.notes || '');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const images = card.images || (card.imageUrl ? [card.imageUrl] : []);

  const save = useCallback((updates: Partial<KanbanCardType>) => {
    updateKanbanCard(card.id, updates);
  }, [card.id, updateKanbanCard]);

  const handleImagesUpload = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => {
        const newImages = [...(card.images || []), reader.result as string];
        save({ images: newImages });
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    save({ images: newImages });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleImagesUpload(e.dataTransfer.files);
  };

  const toggleTimer = () => {
    const now = Date.now();
    if (card.timerRunning) {
      const elapsed = card.timerStart ? Math.floor((now - card.timerStart) / 1000) : 0;
      save({ timerRunning: false, timeSpent: card.timeSpent + elapsed, timerStart: undefined });
    } else {
      save({ timerRunning: true, timerStart: now });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">Detalhes do Card</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Cliente</label>
              <Input
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                onBlur={() => save({ clientName })}
                className="bg-secondary border-border"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Descrição</label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                onBlur={() => save({ description })}
                className="bg-secondary border-border min-h-[100px]"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Observações / Anotações</label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                onBlur={() => save({ notes })}
                placeholder="Adicione notas e observações..."
                className="bg-secondary border-border min-h-[80px]"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Imagens</label>
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${isDragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}
              >
                <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-1" />
                <p className="text-xs text-muted-foreground">Arraste imagens ou clique para upload</p>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleImagesUpload(e.target.files)} />
              </div>

              {images.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {images.map((img, i) => (
                    <div key={i} className="relative group rounded-lg overflow-hidden aspect-square bg-secondary">
                      <img src={img} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button onClick={(e) => { e.stopPropagation(); setPreviewImage(img); }} className="p-1.5 rounded-full bg-card hover:bg-primary transition-colors">
                          <ZoomIn className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); removeImage(i); }} className="p-1.5 rounded-full bg-card hover:bg-destructive transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <Timer timeSpent={card.timeSpent} timerRunning={card.timerRunning} timerStart={card.timerStart} onToggle={toggleTimer} />
              <Button variant="destructive" size="sm" onClick={() => { deleteKanbanCard(card.id); onOpenChange(false); }}>
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image preview modal */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="bg-card border-border max-w-4xl p-2">
          {previewImage && <img src={previewImage} alt="" className="w-full h-auto max-h-[80vh] object-contain rounded-lg" />}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CardDetailDialog;
