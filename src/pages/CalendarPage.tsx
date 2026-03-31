import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/useApp';
import { ArrowLeft, Plus, Trash2, Calendar, ArrowRight } from 'lucide-react';
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
      <header className="page-header">
        <div className="flex items-center gap-4 px-6 py-3.5">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="hover:bg-secondary rounded-xl">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/8">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold gradient-text">Calendários</h1>
              <p className="text-[11px] text-muted-foreground">Planejamento de conteúdo por cliente</p>
            </div>
          </div>
          <Button size="sm" className="ml-auto btn-primary-glow rounded-xl text-xs" onClick={() => setShowAdd(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Novo Cliente
          </Button>
        </div>
      </header>

      <div className="p-6 md:p-8 max-w-5xl mx-auto">
        {calendarClients.length === 0 && (
          <div className="glass-card p-16 text-center max-w-lg mx-auto animate-fade-in">
            <Calendar className="w-12 h-12 mx-auto text-muted-foreground/20 mb-4" />
            <p className="text-muted-foreground font-medium">Nenhum cliente cadastrado.</p>
            <p className="text-muted-foreground text-sm mt-1">Clique em "Novo Cliente" para começar.</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
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
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-bold text-card-foreground text-base">{client.name}</h3>
                </div>
                <div className="flex items-center gap-1 text-primary text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  Ver calendário <ArrowRight className="w-3 h-3" />
                </div>
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive rounded-lg h-8 w-8"
                onClick={() => deleteCalendarClient(client.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="glass-card border-border/50">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Novo Cliente</DialogTitle>
            <DialogDescription>Crie um calendário para o cliente.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <Input placeholder="Nome do cliente" value={clientName} onChange={e => setClientName(e.target.value)} className="bg-secondary/40 border-border/50 h-11 rounded-xl" />
            <Button type="submit" className="w-full h-11 btn-primary-glow font-semibold rounded-xl">Criar Calendário</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarPage;
