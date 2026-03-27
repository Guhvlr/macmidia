import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus } from 'lucide-react';

interface Props {
  employeeId: string;
}

const AddCardDialog = ({ employeeId }: Props) => {
  const { addKanbanCard } = useApp();
  const [open, setOpen] = useState(false);
  const [clientName, setClientName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) return;
    addKanbanCard({
      clientName, description, imageUrl: imageUrl || undefined,
      column: 'todo', timeSpent: 0, timerRunning: false, employeeId,
    });
    setClientName(''); setDescription(''); setImageUrl(''); setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-1" /> Novo Card
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle>Novo Card</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input placeholder="Nome do cliente" value={clientName} onChange={e => setClientName(e.target.value)} className="bg-secondary border-border" />
          <Textarea placeholder="Descrição" value={description} onChange={e => setDescription(e.target.value)} className="bg-secondary border-border" />
          <Input placeholder="URL da imagem (opcional)" value={imageUrl} onChange={e => setImageUrl(e.target.value)} className="bg-secondary border-border" />
          <Button type="submit" className="w-full bg-primary text-primary-foreground">Adicionar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddCardDialog;
