import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/useApp';
import type { CalendarTask } from '@/contexts/app-types';
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, Trash2, Loader2, Upload, X, ZoomIn, Image as ImageIcon, Grid3X3, CalendarDays, Copy, ArrowRightLeft, CopyPlus, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, ContextMenuSeparator } from '@/components/ui/context-menu';

const CONTENT_TYPES = ['Estático', 'Vídeo', 'Reels', 'Stories', 'Carrossel', 'Outro'];

const typeColors: Record<string, string> = {
  'Estático': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'Vídeo': 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  'Reels': 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  'Stories': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Carrossel': 'bg-sky-500/10 text-sky-400 border-sky-500/20',
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

  // Additional states for context menu actions
  const [actionDialog, setActionDialog] = useState<{type: 'move_date' | 'copy_date' | 'copy_client', taskId: string} | null>(null);
  const [actionDate, setActionDate] = useState('');
  const [actionClientId, setActionClientId] = useState('');

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

  const handleDropUpload = (e: React.DragEvent, target: 'add' | 'edit') => {
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

  // Drag and drop actions for entire task card
  const handleDayDrop = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) {
      updateCalendarTask(taskId, { date: dateStr } as any);
    }
  };

  const handleDuplicate = (taskId: string, targetDate?: string, targetClientId?: string) => {
    const task = calendarTasks.find(t => t.id === taskId);
    if (!task) return;
    const { id, ...baseTask } = task;
    addCalendarTask({
      ...baseTask,
      date: targetDate || task.date,
      calendarClientId: targetClientId || task.calendarClientId,
      status: 'pendente'
    });
  };

  const executeAction = () => {
    if (!actionDialog) return;
    if (actionDialog.type === 'move_date' && actionDate) {
      updateCalendarTask(actionDialog.taskId, { date: actionDate } as any);
    } else if (actionDialog.type === 'copy_date' && actionDate) {
      handleDuplicate(actionDialog.taskId, actionDate);
    } else if (actionDialog.type === 'copy_client' && actionClientId) {
      handleDuplicate(actionDialog.taskId, undefined, actionClientId);
    }
    setActionDialog(null);
  };

  const getTypeColor = (type: string) => typeColors[type] || typeColors['Outro'];

  return (
    <div className="min-h-screen gradient-bg">
      {/* Header */}
      <div className="page-header sticky top-0 z-50">
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
                <Button variant="ghost" size="icon" onClick={() => setCurrentDate(new Date(year, month - 1))} className="rounded-[1rem] hover:bg-white/5">
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <h2 className="text-lg font-semibold min-w-[180px] text-center">{monthNames[month]} {year}</h2>
                <Button variant="ghost" size="icon" onClick={() => setCurrentDate(new Date(year, month + 1))} className="rounded-[1rem] hover:bg-white/5">
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
              <Button size="sm" variant="outline" onClick={() => setCurrentDate(new Date())} className="rounded-xl text-xs bg-white/5 border-white/10 hover:bg-white/10">
                Hoje
              </Button>
            )}
            <div className="flex bg-[#121214] rounded-xl p-0.5 gap-0.5 border border-white/10">
              <Button
                size="sm"
                variant={viewMode === 'calendar' ? 'default' : 'ghost'}
                className={`h-7 px-3 text-xs rounded-lg ${viewMode === 'calendar' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
                onClick={() => setViewMode('calendar')}
              >
                <CalendarDays className="w-3.5 h-3.5 mr-1" />
                Mensal
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'feed' ? 'default' : 'ghost'}
                className={`h-7 px-3 text-xs rounded-lg ${viewMode === 'feed' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
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
        <div className="bg-[#0f0f11] p-3 md:p-4 rounded-[2rem] border border-white/5 shadow-2xl backdrop-blur-xl">
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
              <div key={d} className="text-center text-[11px] text-white/60 font-medium py-2 uppercase tracking-[0.15em]">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {cells.map((cell, i) => {
              const tasks = cell.isCurrentMonth ? getTasksForDate(cell.dateStr) : [];
              const isToday = cell.dateStr === todayStr && cell.isCurrentMonth;

              return (
                <div
                  key={i}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => handleDayDrop(e, cell.dateStr)}
                  className={`min-h-[140px] rounded-2xl p-2 transition-all duration-300 group relative flex flex-col border
                    ${!cell.isCurrentMonth ? 'bg-white/[0.01] border-transparent opacity-40' : 'bg-[#18181b]/50 border-white/5 hover:bg-[#18181b] hover:border-white/10'}
                    ${isToday ? 'ring-1 ring-inset ring-red-500/50 bg-red-500/5' : ''}
                  `}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[11px] font-bold w-6 h-6 flex items-center justify-center rounded-full
                      ${isToday ? 'bg-red-500 text-white' : 'text-white/50'}
                    `}>
                      {cell.day}
                    </span>
                    {cell.isCurrentMonth && (
                      <button
                        onClick={() => openAdd(cell.dateStr)}
                        className="w-6 h-6 flex items-center justify-center rounded-full bg-white/5 text-white/50 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-1.5 overflow-y-auto max-h-[110px] flex-1 custom-scrollbar pr-1">
                    {tasks.map(task => (
                      <ContextMenu key={task.id}>
                        <ContextMenuTrigger asChild>
                          <div
                            draggable
                            onDragStart={(e) => e.dataTransfer.setData('taskId', task.id)}
                            className="relative group/task mb-1.5 last:mb-0 block"
                          >
                            <div
                              onClick={() => setEditTask(task)}
                              className={`w-full text-left rounded-lg p-2.5 border border-white/5 bg-[#1C1C1E] hover:bg-[#252528] transition-all cursor-pointer shadow-md group/card flex flex-col gap-2 relative overflow-hidden`}
                            >
                              {/* Left colored border indicative of type */}
                              <div className={`absolute left-0 top-0 bottom-0 w-[3px] opacity-100 ${typeColors[task.contentType]?.split(' ')[0] || 'bg-gray-500'}`} />
                              
                              <div className="pl-1.5 pr-4">
                                <span className="text-[11px] font-bold truncate leading-tight text-white block uppercase opacity-90">{task.clientName}</span>
                              </div>
                              
                              <div className="pl-1 flex items-center justify-between mt-auto">
                                <div className={`inline-flex items-center gap-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded border ${getTypeColor(task.contentType)}`}>
                                   <div className="w-1.5 h-1.5 rounded-full bg-current" />
                                   {task.contentType}
                                </div>
                                {task.imageUrl && (
                                  <div className="flex items-center gap-1 text-white/30 text-[9px] ml-auto">
                                    <ImageIcon className="w-3 h-3" />
                                  </div>
                                )}
                              </div>
                              
                              {/* Quick actions on hover */}
                              <div className="absolute right-1 top-1.5 flex flex-col gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
                                <div className="p-1 rounded bg-white/5 hover:bg-white/20 text-white/50 hover:text-white transition-colors" onClick={(e) => { e.stopPropagation(); setEditTask(task); }}>
                                  <Edit className="w-[10px] h-[10px]" />
                                </div>
                                <div className="p-1 rounded bg-white/5 hover:bg-red-500/80 text-white/50 hover:text-white transition-colors" onClick={(e) => { e.stopPropagation(); if(window.confirm('Excluir card?')) deleteCalendarTask(task.id); }}>
                                  <Trash2 className="w-[10px] h-[10px]" />
                                </div>
                              </div>
                            </div>

                            {/* Hover Preview Tooltip */}
                            <div className="absolute z-[100] bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-[#0f0f11] border border-white/10 rounded-2xl shadow-2xl opacity-0 scale-95 pointer-events-none group-hover/task:opacity-100 group-hover/task:scale-100 transition-all duration-200 origin-bottom flex flex-col overflow-hidden">
                              {task.imageUrl && (
                                <div className="h-32 w-full bg-black/50 relative overflow-hidden border-b border-white/5">
                                  <img src={task.imageUrl} alt="" className="w-full h-full object-cover" />
                                </div>
                              )}
                              <div className="p-3 bg-gradient-to-b from-[#1C1C1E] to-[#121214]">
                                <p className="text-white text-[11px] font-bold leading-tight line-clamp-2 uppercase">{task.clientName}</p>
                                <div className="flex items-center gap-2 mt-2">
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold ${getTypeColor(task.contentType)}`}>{task.contentType}</span>
                                  {task.time && <span className="text-[10px] text-white/40 font-medium tracking-wide ml-auto">{task.time}</span>}
                                </div>
                              </div>
                            </div>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-56 bg-[#161618] border-white/10 text-white rounded-xl shadow-2xl p-1">
                          <ContextMenuItem onClick={() => handleDuplicate(task.id)} className="gap-2.5 cursor-pointer rounded-lg focus:bg-white/10 focus:text-white py-2 text-xs"><Copy className="w-3.5 h-3.5"/> Duplicar card</ContextMenuItem>
                          <ContextMenuItem onClick={() => { setActionDate(task.date); setActionDialog({ type: 'move_date', taskId: task.id })}} className="gap-2.5 cursor-pointer rounded-lg focus:bg-white/10 focus:text-white py-2 text-xs"><ArrowRightLeft className="w-3.5 h-3.5"/> Mover para outro dia</ContextMenuItem>
                          <ContextMenuItem onClick={() => { setActionDate(task.date); setActionDialog({ type: 'copy_date', taskId: task.id })}} className="gap-2.5 cursor-pointer rounded-lg focus:bg-white/10 focus:text-white py-2 text-xs"><CopyPlus className="w-3.5 h-3.5"/> Duplicar para outro dia</ContextMenuItem>
                          <ContextMenuItem onClick={() => { setActionClientId(''); setActionDialog({ type: 'copy_client', taskId: task.id })}} className="gap-2.5 cursor-pointer rounded-lg focus:bg-white/10 focus:text-white py-2 text-xs"><CopyPlus className="w-3.5 h-3.5"/> Duplicar para outro cliente</ContextMenuItem>
                          <ContextMenuSeparator className="bg-white/10 my-1" />
                          <ContextMenuItem onClick={() => setEditTask(task)} className="gap-2.5 cursor-pointer rounded-lg focus:bg-white/10 focus:text-white py-2 text-xs"><Edit className="w-3.5 h-3.5"/> Editar</ContextMenuItem>
                          <ContextMenuItem onClick={() => { if(window.confirm('Tem certeza que deseja excluir?')) deleteCalendarTask(task.id); }} className="gap-2.5 cursor-pointer rounded-lg text-red-500 focus:bg-red-500/20 focus:text-red-500 py-2 text-xs"><Trash2 className="w-3.5 h-3.5"/> Excluir</ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
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
              <div className="bg-[#0f0f11] rounded-[2rem] border border-white/5 p-12 text-center max-w-lg mx-auto">
                <Grid3X3 className="w-10 h-10 mx-auto text-white/20 mb-3" />
                <p className="text-white/60 font-medium">Nenhum conteúdo com imagem ainda.</p>
                <p className="text-white/40 text-xs mt-1">Adicione imagens às tarefas no calendário para preencher o feed.</p>
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
                  <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-2">
                    <span className="text-xs font-semibold text-white text-center truncate w-full uppercase">{task.clientName}</span>
                    <Badge variant="secondary" className={`text-[10px] ${getTypeColor(task.contentType)}`}>
                      {task.contentType}
                    </Badge>
                    <span className="text-[10px] text-white/50">{task.date}</span>
                  </div>
                </button>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Add Task Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-[#121214] text-white border-white/10 max-w-lg rounded-2xl">
          <DialogHeader><DialogTitle className="text-lg font-bold">Nova Tarefa — {addDate}</DialogTitle></DialogHeader>
          <form onSubmit={handleAdd} className="space-y-3">
            <Input placeholder="Nome do conteúdo" value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} className="bg-white/5 border-white/10 rounded-xl focus-visible:ring-red-500" />

            <Select value={form.contentType} onValueChange={v => setForm(f => ({ ...f, contentType: v }))}>
              <SelectTrigger className="bg-white/5 border-white/10 rounded-xl focus:ring-red-500"><SelectValue placeholder="Tipo de conteúdo" /></SelectTrigger>
              <SelectContent className="bg-[#1C1C1E] border-white/10 text-white rounded-xl">
                {CONTENT_TYPES.map(t => <SelectItem key={t} value={t} className="focus:bg-white/10 focus:text-white rounded-lg">{t}</SelectItem>)}
              </SelectContent>
            </Select>

            <Textarea placeholder="Descrição" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="bg-white/5 border-white/10 min-h-[60px] rounded-xl focus-visible:ring-red-500" />
            <Input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} className="bg-white/5 border-white/10 rounded-xl focus-visible:ring-red-500" />

            <div
              onDragOver={e => e.preventDefault()}
              onDrop={e => handleDropUpload(e, 'add')}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/10 bg-white/[0.02] rounded-xl p-3 text-center cursor-pointer hover:border-red-500/50 hover:bg-red-500/5 transition-all"
            >
              {form.imageUrl ? (
                <div className="relative inline-block">
                  <img src={form.imageUrl} alt="" className="max-h-32 rounded-lg mx-auto object-contain" />
                  <button type="button" onClick={(e) => { e.stopPropagation(); setForm(f => ({ ...f, imageUrl: '' })); }} className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 shadow-lg hover:bg-red-600 transition-colors">
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="w-5 h-5 mx-auto text-white/40 mb-1" />
                  <p className="text-xs text-white/40">Arraste uma imagem ou clique para upload</p>
                </>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'add')} />
            </div>

            {employees.length > 0 ? (
              <Select value={form.employeeId} onValueChange={v => setForm(f => ({ ...f, employeeId: v }))}>
                <SelectTrigger className="bg-white/5 border-white/10 rounded-xl focus:ring-red-500"><SelectValue placeholder="Responsável" /></SelectTrigger>
                <SelectContent className="bg-[#1C1C1E] border-white/10 text-white rounded-xl">
                  {employees.map(e => <SelectItem key={e.id} value={e.id} className="focus:bg-white/10 focus:text-white rounded-lg">{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs text-white/40">Nenhum funcionário cadastrado.</p>
            )}

            <Button type="submit" className="w-full h-11 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all shadow-lg shadow-red-600/20 font-bold" disabled={!form.clientName.trim() || !form.employeeId}>Criar Tarefa</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Task Detail Dialog */}
      <Dialog open={!!editTask} onOpenChange={(open) => !open && setEditTask(null)}>
        <DialogContent className="bg-[#121214] text-white border-white/10 max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-0">
          <DialogHeader className="p-6 pb-2 border-b border-white/5 sticky top-0 bg-[#121214] z-10">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">Detalhes do Card</DialogTitle>
          </DialogHeader>
          
          {editTask && (
            <div className="p-6 space-y-5">
              <div>
                <label className="text-[10px] text-white/40 mb-1.5 block font-bold uppercase tracking-wider">Nome da Postagem</label>
                <Input
                  value={editTask.clientName}
                  onChange={e => setEditTask(prev => prev ? { ...prev, clientName: e.target.value } : null)}
                  onBlur={() => handleEditSave('clientName', editTask.clientName)}
                  className="bg-white/5 border-white/10 rounded-xl font-medium focus-visible:ring-red-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-white/40 mb-1.5 block font-bold uppercase tracking-wider">Formato</label>
                  <Select value={editTask.contentType} onValueChange={v => { handleEditSave('contentType', v); }}>
                    <SelectTrigger className="bg-white/5 border-white/10 rounded-xl focus:ring-red-500"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#1C1C1E] border-white/10 text-white rounded-xl">
                      {CONTENT_TYPES.map(t => <SelectItem key={t} value={t} className="focus:bg-white/10 focus:text-white rounded-lg">{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] text-white/40 mb-1.5 block font-bold uppercase tracking-wider">Status</label>
                  <Select value={editTask.status} onValueChange={v => handleEditSave('status', v)}>
                    <SelectTrigger className={`rounded-xl border border-white/10 focus:ring-red-500 ${statusColors[editTask.status] || ''}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1C1C1E] border-white/10 text-white rounded-xl">
                      <SelectItem value="pendente" className="focus:bg-white/10 focus:text-white rounded-lg">Pendente</SelectItem>
                      <SelectItem value="em produção" className="focus:bg-white/10 focus:text-white rounded-lg">Em Produção</SelectItem>
                      <SelectItem value="aprovado" className="focus:bg-white/10 focus:text-white rounded-lg">Aprovado</SelectItem>
                      <SelectItem value="publicado" className="focus:bg-white/10 focus:text-white rounded-lg">Publicado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-white/40 mb-1.5 block font-bold uppercase tracking-wider">Horário</label>
                <Input
                  type="time"
                  value={editTask.time}
                  onChange={e => { const v = e.target.value; setEditTask(prev => prev ? { ...prev, time: v } : null); handleEditSave('time', v); }}
                  className="bg-white/5 border-white/10 rounded-xl focus-visible:ring-red-500 w-32"
                />
              </div>

              <div>
                <label className="text-[10px] text-white/40 mb-1.5 block font-bold uppercase tracking-wider">Descrição / Legenda</label>
                <Textarea
                  value={editTask.description}
                  onChange={e => setEditTask(prev => prev ? { ...prev, description: e.target.value } : null)}
                  onBlur={() => handleEditSave('description', editTask.description)}
                  className="bg-white/5 border-white/10 min-h-[100px] rounded-xl focus-visible:ring-red-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-white/40 mb-1.5 block font-bold uppercase tracking-wider">Mídia do Card</label>
                {editTask.imageUrl ? (
                  <div className="relative group rounded-xl overflow-hidden bg-black/40 border border-white/5">
                    <img src={editTask.imageUrl} alt="" className="w-full max-h-[300px] object-contain rounded-xl" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-sm">
                      <button onClick={() => setPreviewImage(editTask.imageUrl!)} className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors shadow-lg">
                        <ZoomIn className="w-5 h-5" />
                      </button>
                      <button onClick={() => editFileInputRef.current?.click()} className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors shadow-lg">
                        <ImageIcon className="w-5 h-5" />
                      </button>
                      <button onClick={() => { updateCalendarTask(editTask.id, { imageUrl: undefined }); setEditTask(prev => prev ? { ...prev, imageUrl: undefined } : null); }} className="p-3 rounded-full bg-red-500/80 hover:bg-red-500 text-white transition-colors shadow-lg">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => handleDropUpload(e, 'edit')}
                    onClick={() => editFileInputRef.current?.click()}
                    className="border-2 border-dashed border-white/10 bg-white/[0.02] rounded-xl p-8 text-center cursor-pointer hover:border-red-500/50 hover:bg-red-500/5 transition-colors"
                  >
                    <Upload className="w-8 h-8 mx-auto text-white/30 mb-2" />
                    <p className="text-sm font-medium text-white/60">Arraste ou clique para upload</p>
                    <p className="text-[10px] text-white/40 mt-1">Imagens de referência do post</p>
                  </div>
                )}
                <input ref={editFileInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'edit')} />
              </div>

              <div>
                <label className="text-[10px] text-white/40 mb-1.5 block font-bold uppercase tracking-wider">Responsável</label>
                <Select value={editTask.employeeId} onValueChange={v => handleEditSave('employeeId', v)}>
                  <SelectTrigger className="bg-white/5 border-white/10 rounded-xl focus:ring-red-500"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#1C1C1E] border-white/10 text-white rounded-xl">
                    {employees.map(e => <SelectItem key={e.id} value={e.id} className="focus:bg-white/10 focus:text-white rounded-lg">{e.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between pt-4 pb-2">
                <Button variant="ghost" className="text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl px-4" onClick={() => { if(window.confirm('Excluir este card permanentemente?')) { deleteCalendarTask(editTask.id); setEditTask(null); } }}>
                  <Trash2 className="w-4 h-4 mr-2" /> Excluir Card
                </Button>
                <Button onClick={() => setEditTask(null)} className="rounded-xl px-6 bg-white border border-white hover:bg-gray-200 text-black font-bold">
                  Concluído
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Prompt Dialog (Move/Copy) */}
      <Dialog open={!!actionDialog} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent className="bg-[#121214] border-white/10 text-white max-w-sm rounded-[1.5rem]">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {actionDialog?.type === 'move_date' ? 'Mover para Data' : actionDialog?.type === 'copy_date' ? 'Duplicar para Data' : 'Duplicar para Cliente'}
            </DialogTitle>
            <DialogDescription className="text-white/50">
               Selecione o destino para a ação.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            {(actionDialog?.type === 'move_date' || actionDialog?.type === 'copy_date') && (
              <Input
                type="date"
                value={actionDate}
                onChange={(e) => setActionDate(e.target.value)}
                className="bg-white/5 border-white/10 rounded-xl w-full text-white"
                style={{ colorScheme: 'dark' }}
              />
            )}
            {actionDialog?.type === 'copy_client' && (
              <Select value={actionClientId} onValueChange={setActionClientId}>
                <SelectTrigger className="bg-white/5 border-white/10 rounded-xl">
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent className="bg-[#1C1C1E] border-white/10 text-white rounded-xl">
                  {calendarClients.map(c => <SelectItem key={c.id} value={c.id} className="focus:bg-white/10 focus:text-white rounded-lg">{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setActionDialog(null)} className="rounded-xl hover:bg-white/5">Cancelar</Button>
            <Button onClick={executeAction} disabled={(actionDialog?.type !== 'copy_client' && !actionDate) || (actionDialog?.type === 'copy_client' && !actionClientId)} className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium">Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image preview modal */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="bg-[#121214]/90 backdrop-blur-xl border-white/10 max-w-4xl p-2 shadow-2xl rounded-2xl">
          {previewImage && <img src={previewImage} alt="" className="w-full h-auto max-h-[85vh] object-contain rounded-xl" />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientCalendar;
