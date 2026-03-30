import { useState, useRef, useCallback, useEffect } from 'react';
import { KanbanCard as KanbanCardType, useApp } from '@/contexts/AppContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import Timer from './Timer';
import { Trash2, Upload, X, ZoomIn, Save } from 'lucide-react';

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
  const [localImages, setLocalImages] = useState<string[]>(card.images || []);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setClientName(card.clientName);
    setDescription(card.description);
    setNotes(card.notes || '');
    setLocalImages(card.images || []);
    setHasChanges(false);
  }, [card.id, card.clientName, card.description, card.notes, card.images]);

  const markChanged = () => setHasChanges(true);

  const handleSave = () => {
    updateKanbanCard(card.id, { clientName, description, notes, images: localImages });
    setHasChanges(false);
  };

  const handleImagesUpload = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => {
        setLocalImages(prev => [...prev, reader.result as string]);
        markChanged();
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setLocalImages(prev => prev.filter((_, i) => i !== index));
    markChanged();
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
      updateKanbanCard(card.id, { timerRunning: false, timeSpent: card.timeSpent + elapsed, timerStart: undefined });
    } else {
      updateKanbanCard(card.id, { timerRunning: true, timerStart: now });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-card border-border max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">Detalhes do Card</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Cliente</label>
              <Input
                value={clientName}
                onChange={e => { setClientName(e.target.value); markChanged(); }}
                className="bg-secondary border-border text-base"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Descrição</label>
              <Textarea
                value={description}
                onChange={e => { setDescription(e.target.value); markChanged(); }}
                className="bg-secondary border-border min-h-[120px] text-base"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Observações / Anotações</label>
              <Textarea
                value={notes}
                onChange={e => { setNotes(e.target.value); markChanged(); }}
                placeholder="Adicione notas e observações..."
                className="bg-secondary border-border min-h-[100px]"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Imagens e Anexos</label>
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${isDragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}
              >
                <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Arraste imagens ou clique para upload</p>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleImagesUpload(e.target.files)} />
              </div>

              {localImages.length > 0 && (
                <div className="grid grid-cols-3 gap-3 mt-4">
                  {localImages.map((img, i) => (
                    <div key={i} className="relative group rounded-xl overflow-hidden aspect-square bg-secondary border border-border">
                      <img src={img} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <button onClick={(e) => { e.stopPropagation(); setPreviewImage(img); }} className="p-2 rounded-full bg-card hover:bg-primary transition-colors">
                          <ZoomIn className="w-4 h-4" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); removeImage(i); }} className="p-2 rounded-full bg-card hover:bg-destructive transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <div onClick={e => e.stopPropagation()}>
                <Timer timeSpent={card.timeSpent} timerRunning={card.timerRunning} timerStart={card.timerStart} onToggle={toggleTimer} />
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={handleSave} disabled={!hasChanges} size="sm" className="gap-1">
                  <Save className="w-3.5 h-3.5" /> Salvar alterações
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)}>
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image preview */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="bg-card border-border max-w-4xl p-2">
          {previewImage && <img src={previewImage} alt="" className="w-full h-auto max-h-[80vh] object-contain rounded-lg" />}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir card</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir este card? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { deleteKanbanCard(card.id); onOpenChange(false); }}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default CardDetailDialog;
