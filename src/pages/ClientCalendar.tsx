import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, ArrowRightLeft, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ClientCalendar = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { employees, calendarTasks, calendarClients, addCalendarTask, deleteCalendarTask, convertTaskToCard } = useApp();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [form, setForm] = useState({ clientName: '', contentType: '', description: '', time: '09:00', imageUrl: '', status: 'pendente', employeeId: '' });

  const client = calendarClients.find(c => c.id === clientId);
  if (!client) return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Cliente não encontrado</div>;

  const clientTasks = calendarTasks.filter(t => t.calendarClientId === clientId);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const days: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const getDateStr = (day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const getTasksForDay = (day: number) => clientTasks.filter(t => t.date === getDateStr(day));

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || !form.clientName.trim()) return;
    addCalendarTask({ ...form, date: selectedDate, imageUrl: form.imageUrl || undefined, calendarClientId: clientId! });
    setForm({ clientName: '', contentType: '', description: '', time: '09:00', imageUrl: '', status: 'pendente', employeeId: '' });
    setShowAddDialog(false);
  };

  const dayTasks = selectedDate ? clientTasks.filter(t => t.date === selectedDate) : [];

  return (
    <div className="min-h-screen bg-background p-6">
      <header className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => navigate('/calendario')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold gradient-text">{client.name}</h1>
      </header>

      <div className="glass-card p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(new Date(year, month - 1))}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h2 className="text-lg font-semibold">{monthNames[month]} {year}</h2>
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(new Date(year, month + 1))}>
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
            <div key={d} className="text-center text-xs text-muted-foreground font-medium py-2">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} />;
            const tasks = getTasksForDay(day);
            const dateStr = getDateStr(day);
            const isToday = new Date().toISOString().slice(0, 10) === dateStr;
            const isSelected = selectedDate === dateStr;
            return (
              <button
                key={i}
                onClick={() => setSelectedDate(dateStr)}
                className={`p-2 min-h-[60px] rounded-lg text-sm transition-all text-left relative
                  ${isToday ? 'ring-1 ring-primary' : ''}
                  ${isSelected ? 'bg-primary/20 border border-primary/40' : 'hover:bg-secondary'}
                `}
              >
                <span className={`text-xs ${isToday ? 'text-primary font-bold' : ''}`}>{day}</span>
                {tasks.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {tasks.slice(0, 2).map(t => (
                      <div key={t.id} className="text-[10px] bg-primary/20 text-primary px-1 py-0.5 rounded truncate">{t.clientName}</div>
                    ))}
                    {tasks.length > 2 && <div className="text-[10px] text-muted-foreground">+{tasks.length - 2}</div>}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDate && (
        <div className="glass-card p-6 max-w-4xl mx-auto mt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">{selectedDate}</h3>
            <Button size="sm" onClick={() => setShowAddDialog(true)}>
              <Plus className="w-4 h-4 mr-1" /> Nova Tarefa
            </Button>
          </div>
          {dayTasks.length === 0 && <p className="text-muted-foreground text-sm">Nenhuma tarefa neste dia.</p>}
          <div className="space-y-2">
            {dayTasks.map(task => (
              <div key={task.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border/30">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{task.clientName}</span>
                    <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">{task.contentType}</span>
                    <span className="text-xs text-muted-foreground">{task.time}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => convertTaskToCard(task.id)} title="Enviar para Kanban">
                    <ArrowRightLeft className="w-4 h-4 text-primary" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteCalendarTask(task.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Nova Tarefa</DialogTitle></DialogHeader>
          <form onSubmit={handleAdd} className="space-y-3">
            <Input placeholder="Nome do cliente" value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} className="bg-secondary border-border" />
            <Input placeholder="Tipo de conteúdo" value={form.contentType} onChange={e => setForm(f => ({ ...f, contentType: e.target.value }))} className="bg-secondary border-border" />
            <Textarea placeholder="Descrição" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="bg-secondary border-border" />
            <Input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} className="bg-secondary border-border" />
            <Input placeholder="URL da imagem (opcional)" value={form.imageUrl} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} className="bg-secondary border-border" />
            <Select value={form.employeeId} onValueChange={v => setForm(f => ({ ...f, employeeId: v }))}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Funcionário responsável" /></SelectTrigger>
              <SelectContent>
                {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button type="submit" className="w-full">Criar Tarefa</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientCalendar;
