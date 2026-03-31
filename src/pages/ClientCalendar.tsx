import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/useApp';
import type { CalendarTask } from '@/contexts/app-types';
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
  const { employees, calendarTasks, calendarClients, addCalendarTask, updateCalendarTask, deleteCalendarTask, loading } = useApp();
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
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen gradient-bg flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Cliente não encontrado</p>
        <Button variant="outline" onClick={() => navigate('/calendario')} className="rounded-xl">Voltar</Button>
      </div>
    );
  }

  const clientTasks = calendarTasks.filter(t => t.calendarClientId === clientId);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

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
    <div className="min-h-screen gradient-bg">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-4 px-6 py-3.5">
          <Button variant="ghost" size="icon" onClick={() => navigate('/calendario')} className="hover:bg-secondary rounded-xl">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold text-foreground">{client.name}</h1>
            <p className="text-[11px] text-muted-foreground">Calendário de conteúdo</p>
          </div>
          <div className="ml-auto flex items-center gap-3 text-xs">
            {Object.entries(statusCounts as Record<string, number>).map(([status, count]) => (
              <span key={status} className="flex items-center gap-1.5">
                <span className={`inline-block w-2 h-2 rounded-full ${
                  status === 'pendente' ? 'bg-muted-foreground' :
                  status === 'em produção' ? 'bg-yellow-400' :
                  status === 'aprovado' ? 'bg-emerald-400' :
                  'bg-primary'
                }`} />
                <span className="text-muted-foreground tabular-nums">{String(count)}</span>
                <span className="text-muted-foreground capitalize">{status}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6">
        {/* View toggle + Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {viewMode === 'calendar' && (
              <>
                <Button variant="ghost" size="icon" onClick={() => setCurrentDate(new Date(year, month - 1))} className="rounded-xl hover:bg-secondary">
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <h2 className="text-lg font-semibold min-w-[180px] text-center">{monthNames[month]} {year}</h2>
                <Button variant="ghost" size="icon" onClick={() => setCurrentDate(new Date(year, month + 1))} className="rounded-xl hover:bg-secondary">
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </>
            )}
            {viewMode === 'feed' && (
              <h2 className="text-lg font-semibold">Feed</h2>
            )}
          </div>
          <div className="flex items-center gap-2">
            {viewMode === 'calendar' && (
              <Button size="sm" variant="outline" onClick={() => setCurrentDate(new Date())} className="rounded-xl text-xs">
                Hoje
              </Button>
            )}
            <div className="flex bg-secondary/40 rounded-xl p-0.5 gap-0.5 border border-border/25">
              <Button
                size="sm"
                variant={viewMode === 'calendar' ? 'default' : 'ghost'}
                className="h-7 px-3 text-xs rounded-lg"
                onClick={() => setViewMode('calendar')}
              >
                <CalendarDays className="w-3.5 h-3.5 mr-1" />
                Mensal
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'feed' ? 'default' : 'ghost'}
                className="h-7 px-3 text-xs rounded-lg"
                onClick={() => setViewMode('feed')}
              >
                <Grid3X3 className="w-3.5 h-3.5 mr-1" />
                Feed
              </Button>
            </div>
          </div>
        </div>

        {/* Calendar grid view */}
        {viewMode === 'calendar' && (
        <div className="bg-black/40 p-3 md:p-4 rounded-[2rem] border border-white/5 shadow-2xl backdrop-blur-xl">
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
              <div key={d} className="text-center text-[11px] text-white/60 font-bold py-2 uppercase tracking-widest">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {cells.map((cell, i) => {
              const tasks = cell.isCurrentMonth ? getTasksForDate(cell.dateStr) : [];
              const isToday = cell.dateStr === todayStr && cell.isCurrentMonth;

              return (
                <div
                  key={i}
                  className={`min-h-[130px] rounded-2xl p-2 transition-all duration-300 group relative flex flex-col border
                    ${!cell.isCurrentMonth ? 'bg-white/[0.02] border-transparent opacity-50' : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.06] hover:border-white/20 hover:shadow-lg'}
                    ${isToday ? 'ring-2 ring-inset ring-red-500/50 bg-red-500/10' : ''}
                  `}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full
                      ${isToday ? 'bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'text-white/70'}
                    `}>
                      {cell.day}
                    </span>
                    {cell.isCurrentMonth && (
                      <button
                        onClick={() => openAdd(cell.dateStr)}
                        className="w-6 h-6 flex items-center justify-center rounded-full bg-white/5 text-white/70 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-1.5 overflow-y-auto max-h-[100px] flex-1 custom-scrollbar pr-1">
                    {tasks.map(task => (
                      <div key={task.id} className="relative group/task">
                        <button
                          onClick={() => setEditTask(task)}
                          className={`w-full text-left rounded-lg px-2 py-1.5 border border-white/5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${getTypeColor(task.contentType)}`}
                        >
                          <div className="flex items-center gap-1.5">
                            {task.imageUrl && (
                              <img src={task.imageUrl} alt="" className="w-4 h-4 rounded shadow-sm object-cover flex-shrink-0" loading="lazy" />
                            )}
                            <span className="text-[10px] font-bold truncate leading-tight tracking-wide">{task.clientName}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[9px] font-semibold opacity-80 truncate">{task.contentType}</span>
                            {task.time && <span className="text-[9px] font-medium opacity-60 ml-auto">{task.time}</span>}
                          </div>
                        </button>

                        {/* Hover Preview Tooltip */}
                        <div className="absolute z-[100] bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-[#0f0f11] border border-white/10 rounded-2xl shadow-2xl opacity-0 scale-95 pointer-events-none group-hover/task:opacity-100 group-hover/task:scale-100 transition-all duration-200 origin-bottom flex flex-col overflow-hidden">
                          {task.imageUrl && (
                            <div className="h-24 w-full bg-black/50 relative overflow-hidden border-b border-white/5">
                              <img src={task.imageUrl} alt="" className="w-full h-full object-cover" />
                            </div>
                          )}
                          <div className="p-3 bg-gradient-to-b from-transparent to-black/40">
                            <p className="text-white text-xs font-extrabold leading-tight line-clamp-2">{task.clientName}</p>
                            <div className="flex items-center gap-1.5 mt-2">
                              <span className={`text-[9px] px-2 py-0.5 rounded-md font-bold ${getTypeColor(task.contentType)} border-0`}>{task.contentType}</span>
                              {task.time && <span className="text-[10px] text-white/50 font-medium tracking-wide">{task.time}</span>}
                            </div>
                          </div>
                          {/* Arrow */}
                          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#0f0f11] rotate-45 border-r border-b border-white/10" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        )}

        {/* Feed grid view */}
        {viewMode === 'feed' && (() => {
          const feedTasks = clientTasks
            .filter(t => t.imageUrl)
            .sort((a, b) => b.date.localeCompare(a.date));

          if (feedTasks.length === 0) {
            return (
              <div className="glass-card p-12 text-center max-w-lg mx-auto">
                <Grid3X3 className="w-10 h-10 mx-auto text-muted-foreground/20 mb-3" />
                <p className="text-muted-foreground font-medium">Nenhum conteúdo com imagem ainda.</p>
                <p className="text-muted-foreground text-sm mt-1">Adicione imagens às tarefas no calendário.</p>
              </div>
            );
          }

          return (
            <div className="grid grid-cols-3 gap-1.5 md:gap-2.5 max-w-4xl mx-auto">
              {feedTasks.map(task => (
                <button
                  key={task.id}
                  onClick={() => setEditTask(task)}
                  className="relative aspect-square overflow-hidden rounded-xl group bg-secondary border border-border/30 hover:border-primary/40 transition-all"
                >
                  <img
                    src={task.imageUrl!}
                    alt={task.clientName}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-background/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-2">
                    <span className="text-xs font-semibold text-foreground text-center truncate w-full">{task.clientName}</span>
                    <Badge variant="secondary" className={`text-[10px] ${getTypeColor(task.contentType)}`}>
                      {task.contentType}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">{task.date}</span>
                  </div>
                </button>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Add Task Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="glass-card border-border/50 max-w-lg">
          <DialogHeader><DialogTitle className="text-lg font-bold">Nova Tarefa — {addDate}</DialogTitle></DialogHeader>
          <form onSubmit={handleAdd} className="space-y-3">
            <Input placeholder="Nome do conteúdo" value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} className="bg-secondary/40 border-border/50 rounded-xl" />

            <Select value={form.contentType} onValueChange={v => setForm(f => ({ ...f, contentType: v }))}>
              <SelectTrigger className="bg-secondary/40 border-border/50 rounded-xl"><SelectValue placeholder="Tipo de conteúdo" /></SelectTrigger>
              <SelectContent>
                {CONTENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>

            <Textarea placeholder="Descrição" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="bg-secondary/40 border-border/50 min-h-[60px] rounded-xl" />
            <Input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} className="bg-secondary/40 border-border/50 rounded-xl" />

            <div
              onDragOver={e => e.preventDefault()}
              onDrop={e => handleDrop(e, 'add')}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border/40 rounded-xl p-3 text-center cursor-pointer hover:border-primary/40 transition-colors"
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
                <SelectTrigger className="bg-secondary/40 border-border/50 rounded-xl"><SelectValue placeholder="Responsável" /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhum funcionário cadastrado.</p>
            )}

            <Button type="submit" className="w-full h-11 btn-primary-glow font-semibold rounded-xl" disabled={!form.clientName.trim() || !form.employeeId}>Criar Tarefa</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Task Detail Dialog */}
      <Dialog open={!!editTask} onOpenChange={(open) => !open && setEditTask(null)}>
        <DialogContent className="glass-card border-border/50 max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-lg font-bold">Detalhes da Tarefa</DialogTitle></DialogHeader>
          {editTask && (
            <div className="space-y-4">
              <div>
                <label className="text-[11px] text-muted-foreground mb-1.5 block font-semibold uppercase tracking-wider">Nome do conteúdo</label>
                <Input
                  value={editTask.clientName}
                  onChange={e => setEditTask(prev => prev ? { ...prev, clientName: e.target.value } : null)}
                  onBlur={() => handleEditSave('clientName', editTask.clientName)}
                  className="bg-secondary/40 border-border/50 rounded-xl"
                />
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground mb-1.5 block font-semibold uppercase tracking-wider">Tipo de conteúdo</label>
                <Select value={editTask.contentType} onValueChange={v => { handleEditSave('contentType', v); }}>
                  <SelectTrigger className="bg-secondary/40 border-border/50 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONTENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground mb-1.5 block font-semibold uppercase tracking-wider">Descrição</label>
                <Textarea
                  value={editTask.description}
                  onChange={e => setEditTask(prev => prev ? { ...prev, description: e.target.value } : null)}
                  onBlur={() => handleEditSave('description', editTask.description)}
                  className="bg-secondary/40 border-border/50 min-h-[80px] rounded-xl"
                />
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground mb-1.5 block font-semibold uppercase tracking-wider">Horário</label>
                <Input
                  type="time"
                  value={editTask.time}
                  onChange={e => { const v = e.target.value; setEditTask(prev => prev ? { ...prev, time: v } : null); handleEditSave('time', v); }}
                  className="bg-secondary/40 border-border/50 rounded-xl"
                />
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground mb-1.5 block font-semibold uppercase tracking-wider">Status</label>
                <Select value={editTask.status} onValueChange={v => handleEditSave('status', v)}>
                  <SelectTrigger className="bg-secondary/40 border-border/50 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="em produção">Em Produção</SelectItem>
                    <SelectItem value="aprovado">Aprovado</SelectItem>
                    <SelectItem value="publicado">Publicado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground mb-1.5 block font-semibold uppercase tracking-wider">Responsável</label>
                <Select value={editTask.employeeId} onValueChange={v => handleEditSave('employeeId', v)}>
                  <SelectTrigger className="bg-secondary/40 border-border/50 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Image */}
              <div>
                <label className="text-[11px] text-muted-foreground mb-1.5 block font-semibold uppercase tracking-wider">Imagem</label>
                {editTask.imageUrl ? (
                  <div className="relative group rounded-xl overflow-hidden bg-secondary">
                    <img src={editTask.imageUrl} alt="" className="w-full max-h-48 object-contain rounded-xl" />
                    <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <button onClick={() => setPreviewImage(editTask.imageUrl!)} className="p-2.5 rounded-full bg-card/90 hover:bg-primary hover:text-primary-foreground transition-colors shadow-lg">
                        <ZoomIn className="w-4 h-4" />
                      </button>
                      <button onClick={() => editFileInputRef.current?.click()} className="p-2.5 rounded-full bg-card/90 hover:bg-primary hover:text-primary-foreground transition-colors shadow-lg">
                        <ImageIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => { updateCalendarTask(editTask.id, { imageUrl: undefined }); setEditTask(prev => prev ? { ...prev, imageUrl: undefined } : null); }} className="p-2.5 rounded-full bg-card/90 hover:bg-destructive hover:text-destructive-foreground transition-colors shadow-lg">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => handleDrop(e, 'edit')}
                    onClick={() => editFileInputRef.current?.click()}
                    className="border-2 border-dashed border-border/40 rounded-xl p-4 text-center cursor-pointer hover:border-primary/40 transition-colors"
                  >
                    <Upload className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
                    <p className="text-xs text-muted-foreground">Arraste ou clique para upload</p>
                  </div>
                )}
                <input ref={editFileInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'edit')} />
              </div>

              <div className="flex items-center justify-end pt-3 border-t border-border/30">
                <Button variant="destructive" size="sm" onClick={() => { deleteCalendarTask(editTask.id); setEditTask(null); }} className="rounded-xl text-xs hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20">
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir Tarefa
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Image preview modal */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="glass-card border-border/50 max-w-4xl p-2">
          {previewImage && <img src={previewImage} alt="" className="w-full h-auto max-h-[80vh] object-contain rounded-xl" />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientCalendar;
