import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

const CalendarPage = () => {
  const navigate = useNavigate();
  const { calendarClients, addCalendarClient, deleteCalendarClient } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [clientName, setClientName] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) return;
    addCalendarClient(clientName.trim());
    setClientName('');
    setShowAdd(false);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <header className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold gradient-text">Calendários</h1>
        <Button size="sm" className="ml-auto" onClick={() => setShowAdd(true)}>
          <Plus className="w-4 h-4 mr-1" /> Novo Cliente
        </Button>
      </header>

      {calendarClients.length === 0 && (
        <div className="glass-card p-12 text-center max-w-lg mx-auto">
          <p className="text-muted-foreground">Nenhum cliente cadastrado.</p>
          <p className="text-muted-foreground text-sm mt-1">Clique em "Novo Cliente" para começar.</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
        {calendarClients.map(client => (
          <div key={client.id} className="glass-card p-6 hover:glow-primary transition-all duration-300 group">
            <button
              onClick={() => navigate(`/calendario/${client.id}`)}
              className="w-full text-left"
            >
              <h3 className="font-semibold text-card-foreground text-lg">{client.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">Ver calendário →</p>
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => deleteCalendarClient(client.id)}
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Novo Cliente</DialogTitle></DialogHeader>
          <form onSubmit={handleAdd} className="space-y-3">
            <Input placeholder="Nome do cliente" value={clientName} onChange={e => setClientName(e.target.value)} className="bg-secondary border-border" />
            <Button type="submit" className="w-full">Criar Calendário</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarPage;
