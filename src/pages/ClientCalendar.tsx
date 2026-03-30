import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp, CalendarTask } from '@/contexts/AppContext';
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, Trash2, Loader2, Upload, X, ZoomIn, Image as ImageIcon, Grid3X3, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

const CONTENT_TYPES = ['Estático', 'Vídeo', 'Reels', 'Stories', 'Carrossel', 'Outro'];

const typeColors: Record<string, string> = {
  'Estático': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'Vídeo': 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  'Reels': 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  'Stories': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'Carrossel': 'bg-sky-500/20 text-sky-400 border-sky-500/30',
  'Outro': 'bg-secondary text-muted-foreground border-border',
};

const statusColors: Record<string, string> = {
  'pendente': 'bg-muted text-muted-foreground',
  'em produção': 'bg-warning/20 text-yellow-400',
  'aprovado': 'bg-emerald-500/20 text-emerald-400',
  'publicado': 'bg-primary/20 text-primary',
};

const ClientCalendar = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { employees, calendarTasks, calendarClients, addCalendarTask, updateCalendarTask, deleteCalendarTask, convertTaskToCard, loading } = useApp();
  const [viewMode, setViewMode] = useState<'calendar' | 'feed'>('calendar');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addDate, setAddDate] = useState<string>('');
  const [editTask, setEditTask] = useState<CalendarTask | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [form, setForm] = useState({ clientName: '', contentType: '', description: '', time: '09:00', imageUrl: '', status: 'pendente', employeeId: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const client = calendarClients.find(c => c.id === clientId);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Cliente não encontrado</p>
        <Button variant="outline" onClick={() => navigate('/calendario')}>Voltar</Button>
      </div>
    );
  }

  const clientTasks = calendarTasks.filter(t => t.calendarClientId === clientId);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  // Build calendar grid with prev/next month padding
  const prevMonthDays = new Date(year, month, 0).getDate();
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  type DayCell = { day: number; isCurrentMonth: boolean; dateStr: string };
  const cells: DayCell[] = [];

  for (let i = 0; i < firstDay; i++) {
    const d = prevMonthDays - firstDay + 1 + i;
    const m = month === 0 ? 12 : month;
    const y = month === 0 ? year - 1 : year;
    cells.push({ day: d, isCurrentMonth: false, dateStr: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, isCurrentMonth: true, dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
  }
  for (let i = cells.length, d = 1; i < totalCells; i++, d++) {
    const m = month + 2 > 12 ? 1 : month + 2;
    const y = month + 2 > 12 ? year + 1 : year;
    cells.push({ day: d, isCurrentMonth: false, dateStr: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
  }

  const getTasksForDate = (dateStr: string) => clientTasks.filter(t => t.date === dateStr);
  const todayStr = new Date().toISOString().slice(0, 10);

  // Status summary
  const statusCounts = clientTasks.reduce((acc, t) => {
    const s = t.status || 'pendente';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const openAdd = (dateStr: string) => {
    setAddDate(dateStr);
    setForm({ clientName: '', contentType: '', description: '', time: '09:00', imageUrl: '', status: 'pendente', employeeId: '' });
    setShowAddDialog(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'add' | 'edit') => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (target === 'add') {
        setForm(f => ({ ...f, imageUrl: result }));
      } else if (editTask) {
        updateCalendarTask(editTask.id, { imageUrl: result });
        setEditTask(prev => prev ? { ...prev, imageUrl: result } : null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent, target: 'add' | 'edit') => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (target === 'add') {
        setForm(f => ({ ...f, imageUrl: result }));
      } else if (editTask) {
        updateCalendarTask(editTask.id, { imageUrl: result });
        setEditTask(prev => prev ? { ...prev, imageUrl: result } : null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addDate || !form.clientName.trim()) return;
    addCalendarTask({ ...form, date: addDate, imageUrl: form.imageUrl || undefined, calendarClientId: clientId! });
    setShowAddDialog(false);
  };

  const handleEditSave = (field: string, value: string) => {
    if (!editTask) return;
    updateCalendarTask(editTask.id, { [field]: value } as any);
    setEditTask(prev => prev ? { ...prev, [field]: value } : null);
  };

  const getTypeColor = (type: string) => typeColors[type] || typeColors['Outro'];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-4 px-6 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/calendario')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">{client.name}</h1>
          <div className="ml-auto flex items-center gap-3 text-xs">
            {Object.entries(statusCounts).map(([status, count]) => (
              <span key={status} className="flex items-center gap-1.5">
                <span className={`inline-block w-2 h-2 rounded-full ${
                  status === 'pendente' ? 'bg-muted-foreground' :
                  status === 'em produção' ? 'bg-yellow-400' :
                  status === 'aprovado' ? 'bg-emerald-400' :
                  'bg-primary'
                }`} />
                <span className="text-muted-foreground">{count}</span>
                <span className="text-muted-foreground capitalize">{status}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(new Date(year, month - 1))}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <h2 className="text-lg font-semibold min-w-[180px] text-center">{monthNames[month]} {year}</h2>
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(new Date(year, month + 1))}>
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
          <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setCurrentDate(new Date())}>
            Hoje
          </Button>
        </div>

        {/* Calendar grid */}
        <div className="border border-border rounded-xl overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 bg-card/60">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
              <div key={d} className="text-center text-xs text-muted-foreground font-medium py-3 border-b border-border">{d}</div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7">
            {cells.map((cell, i) => {
              const tasks = cell.isCurrentMonth ? getTasksForDate(cell.dateStr) : [];
              const isToday = cell.dateStr === todayStr && cell.isCurrentMonth;

              return (
                <div
                  key={i}
                  className={`min-h-[120px] border-b border-r border-border p-1.5 transition-colors group relative
                    ${!cell.isCurrentMonth ? 'bg-background/50' : 'bg-card/30 hover:bg-card/50'}
                    ${isToday ? 'ring-1 ring-inset ring-primary/50 bg-primary/5' : ''}
                  `}
                >
                  {/* Day number + add button */}
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded
                      ${isToday ? 'bg-primary text-primary-foreground' : ''}
                      ${!cell.isCurrentMonth ? 'text-muted-foreground/40' : 'text-muted-foreground'}
                    `}>
                      {cell.day}
                    </span>
                    {cell.isCurrentMonth && (
                      <button
                        onClick={() => openAdd(cell.dateStr)}
                        className="w-5 h-5 flex items-center justify-center rounded bg-primary/10 text-primary opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/20"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Task cards */}
                  <div className="space-y-1 overflow-y-auto max-h-[90px] scrollbar-thin">
                    {tasks.map(task => (
                      <button
                        key={task.id}
                        onClick={() => setEditTask(task)}
                        className={`w-full text-left rounded-md px-1.5 py-1 border transition-all hover:brightness-110 cursor-pointer ${getTypeColor(task.contentType)}`}
                      >
                        <div className="flex items-center gap-1">
                          {task.imageUrl && (
                            <img src={task.imageUrl} alt="" className="w-5 h-5 rounded object-cover flex-shrink-0" />
                          )}
                          <span className="text-[10px] font-medium truncate leading-tight">{task.clientName}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[9px] opacity-70 truncate">{task.contentType}</span>
                          {task.time && <span className="text-[9px] opacity-50">{task.time}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Add Task Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader><DialogTitle>Nova Tarefa — {addDate}</DialogTitle></DialogHeader>
          <form onSubmit={handleAdd} className="space-y-3">
            <Input placeholder="Nome do conteúdo" value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} className="bg-secondary border-border" />

            <Select value={form.contentType} onValueChange={v => setForm(f => ({ ...f, contentType: v }))}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Tipo de conteúdo" /></SelectTrigger>
              <SelectContent>
                {CONTENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>

            <Textarea placeholder="Descrição" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="bg-secondary border-border min-h-[60px]" />
            <Input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} className="bg-secondary border-border" />

            {/* Image upload area */}
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={e => handleDrop(e, 'add')}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-3 text-center cursor-pointer hover:border-primary/50 transition-colors"
            >
              {form.imageUrl ? (
                <div className="relative inline-block">
                  <img src={form.imageUrl} alt="" className="max-h-32 rounded-lg mx-auto object-contain" />
                  <button type="button" onClick={(e) => { e.stopPropagation(); setForm(f => ({ ...f, imageUrl: '' })); }} className="absolute -top-2 -right-2 bg-destructive rounded-full p-0.5">
                    <X className="w-3 h-3 text-destructive-foreground" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
                  <p className="text-xs text-muted-foreground">Arraste uma imagem ou clique para upload</p>
                </>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'add')} />
            </div>

            {employees.length > 0 ? (
              <Select value={form.employeeId} onValueChange={v => setForm(f => ({ ...f, employeeId: v }))}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Responsável" /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhum funcionário cadastrado.</p>
            )}

            <Button type="submit" className="w-full" disabled={!form.clientName.trim() || !form.employeeId}>Criar Tarefa</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Task Detail Dialog */}
      <Dialog open={!!editTask} onOpenChange={(open) => !open && setEditTask(null)}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Detalhes da Tarefa</DialogTitle></DialogHeader>
          {editTask && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Nome do conteúdo</label>
                <Input
                  value={editTask.clientName}
                  onChange={e => setEditTask(prev => prev ? { ...prev, clientName: e.target.value } : null)}
                  onBlur={() => handleEditSave('clientName', editTask.clientName)}
                  className="bg-secondary border-border"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Tipo de conteúdo</label>
                <Select value={editTask.contentType} onValueChange={v => { handleEditSave('contentType', v); }}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONTENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Descrição</label>
                <Textarea
                  value={editTask.description}
                  onChange={e => setEditTask(prev => prev ? { ...prev, description: e.target.value } : null)}
                  onBlur={() => handleEditSave('description', editTask.description)}
                  className="bg-secondary border-border min-h-[80px]"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Horário</label>
                <Input
                  type="time"
                  value={editTask.time}
                  onChange={e => { const v = e.target.value; setEditTask(prev => prev ? { ...prev, time: v } : null); handleEditSave('time', v); }}
                  className="bg-secondary border-border"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                <Select value={editTask.status} onValueChange={v => handleEditSave('status', v)}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="em produção">Em Produção</SelectItem>
                    <SelectItem value="aprovado">Aprovado</SelectItem>
                    <SelectItem value="publicado">Publicado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Responsável</label>
                <Select value={editTask.employeeId} onValueChange={v => handleEditSave('employeeId', v)}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Image */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Imagem</label>
                {editTask.imageUrl ? (
                  <div className="relative group rounded-xl overflow-hidden bg-secondary">
                    <img src={editTask.imageUrl} alt="" className="w-full max-h-48 object-contain rounded-xl" />
                    <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <button onClick={() => setPreviewImage(editTask.imageUrl!)} className="p-2 rounded-full bg-card hover:bg-primary transition-colors">
                        <ZoomIn className="w-4 h-4" />
                      </button>
                      <button onClick={() => editFileInputRef.current?.click()} className="p-2 rounded-full bg-card hover:bg-primary transition-colors">
                        <ImageIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => { updateCalendarTask(editTask.id, { imageUrl: undefined }); setEditTask(prev => prev ? { ...prev, imageUrl: undefined } : null); }} className="p-2 rounded-full bg-card hover:bg-destructive transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => handleDrop(e, 'edit')}
                    onClick={() => editFileInputRef.current?.click()}
                    className="border-2 border-dashed border-border rounded-xl p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  >
                    <Upload className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
                    <p className="text-xs text-muted-foreground">Arraste ou clique para upload</p>
                  </div>
                )}
                <input ref={editFileInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'edit')} />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border">
                <Button variant="outline" size="sm" onClick={() => { convertTaskToCard(editTask.id); setEditTask(null); }}>
                  Enviar para Kanban
                </Button>
                <Button variant="destructive" size="sm" onClick={() => { deleteCalendarTask(editTask.id); setEditTask(null); }}>
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Image preview modal */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="bg-card border-border max-w-4xl p-2">
          {previewImage && <img src={previewImage} alt="" className="w-full h-auto max-h-[80vh] object-contain rounded-lg" />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientCalendar;
