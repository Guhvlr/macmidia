import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/useApp';
import { ArrowLeft, Plus, Trash2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
    <div className="min-h-screen gradient-bg">
      <header className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-4 px-6 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="hover:bg-secondary">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-xl font-bold gradient-text">Calendários</h1>
          </div>
          <Button size="sm" className="ml-auto btn-primary-glow" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4 mr-1" /> Novo Cliente
          </Button>
        </div>
      </header>

      <div className="p-6 md:p-10 max-w-5xl mx-auto">
        {calendarClients.length === 0 && (
          <div className="glass-card p-16 text-center max-w-lg mx-auto animate-fade-in">
            <Calendar className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">Nenhum cliente cadastrado.</p>
            <p className="text-muted-foreground text-sm mt-1">Clique em "Novo Cliente" para começar.</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {calendarClients.map((client, i) => (
            <div
              key={client.id}
              className="glass-card-hover p-6 group animate-slide-up"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <button
                onClick={() => navigate(`/calendario/${client.id}`)}
                className="w-full text-left"
              >
                <h3 className="font-bold text-card-foreground text-lg">{client.name}</h3>
                <p className="text-sm text-muted-foreground mt-1.5">Ver calendário →</p>
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                onClick={() => deleteCalendarClient(client.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="glass-card border-border">
          <DialogHeader>
            <DialogTitle>Novo Cliente</DialogTitle>
            <DialogDescription>Crie um calendário para o cliente.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <Input placeholder="Nome do cliente" value={clientName} onChange={e => setClientName(e.target.value)} className="bg-secondary/50 border-border/60 h-11" />
            <Button type="submit" className="w-full h-11 btn-primary-glow font-semibold">Criar Calendário</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarPage;
