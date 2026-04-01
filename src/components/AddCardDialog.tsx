import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/contexts/useApp';
import type { KanbanColumnDef } from '@/contexts/app-types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Upload, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props {
  employeeId?: string;
  /** When provided, the card is created directly in this column (no selector shown) */
  fixedColumnKey?: string;
  columnKey?: string;
  /** Custom trigger element. If omitted, a default "+" button is rendered */
  trigger?: React.ReactNode;
  
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showEmployeeSelect?: boolean;
}

const AddCardDialog = ({ employeeId: initialEmployeeId, fixedColumnKey, columnKey, trigger, open, onOpenChange, showEmployeeSelect }: Props) => {
  const { addKanbanCard, employees } = useApp();
  const [internalOpen, setInternalOpen] = useState(false);
  const [clientName, setClientName] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(initialEmployeeId || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isControlled = open !== undefined && onOpenChange !== undefined;
  const dialogOpen = isControlled ? open : internalOpen;
  const setDialogOpen = isControlled ? onOpenChange : setInternalOpen;

  useEffect(() => {
    if (dialogOpen && initialEmployeeId && !selectedEmployeeId) {
      setSelectedEmployeeId(initialEmployeeId);
    }
  }, [dialogOpen, initialEmployeeId]);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => setImages(prev => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) return;
    addKanbanCard({
      clientName, description, images,
      column: fixedColumnKey || columnKey || 'para-producao',
      timeSpent: 0, timerRunning: false, employeeId: selectedEmployeeId || initialEmployeeId || '',
    });
    setClientName(''); setDescription(''); setImages([]); setDialogOpen(false);
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          {trigger || (
            <button className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-all group">
              <Plus className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
              <span>Adicionar card</span>
            </button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="glass-card border-border/50">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Novo Card</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            placeholder="Nome do cliente"
            value={clientName}
            onChange={e => setClientName(e.target.value)}
            className="bg-secondary/40 border-border/50 rounded-xl h-11"
            autoFocus
          />
          <Textarea
            placeholder="Descrição (opcional)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="bg-secondary/40 border-border/50 min-h-[80px] rounded-xl"
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border/40 rounded-xl p-3 text-center cursor-pointer hover:border-primary/40 transition-colors"
          >
            <Upload className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground">Clique ou arraste imagens</p>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
          </div>

          {images.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {images.map((img, i) => (
                <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-border/30">
                  <img src={img} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-0 right-0 bg-destructive rounded-bl-lg p-0.5">
                    <X className="w-3 h-3 text-destructive-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {showEmployeeSelect && employees.length > 0 && (
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider ml-1">Responsável pelo Card</label>
              <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger className="bg-secondary/40 border-border/50 h-11 rounded-xl">
                  <SelectValue placeholder="Selecione o funcionário" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button type="submit" className="w-full h-11 btn-primary-glow font-semibold rounded-xl" disabled={!clientName.trim() || (showEmployeeSelect && !selectedEmployeeId)}>Adicionar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddCardDialog;
