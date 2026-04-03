import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/useApp';
import type { CalendarTask } from '@/contexts/app-types';
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, Trash2, Upload, X, ZoomIn, Image as ImageIcon, Grid3X3, CalendarDays, Copy, ArrowRightLeft, CopyPlus, Edit, CheckCircle2, Heart, MessageCircle, Send, Bookmark, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { compressImage } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
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
  'pendente': 'bg-zinc-500/20 text-zinc-400 border-zinc-500/40',
  'em produção': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  'em producao': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  'alteracao': 'bg-orange-500/20 text-orange-400 border-orange-500/40',
  'alteração': 'bg-orange-500/20 text-orange-400 border-orange-500/40',
  'para correção': 'bg-red-500/20 text-red-400 border-red-500/40',
  'para-correcao': 'bg-red-500/20 text-red-400 border-red-500/40',
  'correcao-cliente': 'bg-red-500/20 text-red-400 border-red-500/40',
  'aprovado': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  'aprovado-programar': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  'concluído': 'bg-green-500/20 text-green-400 border-green-500/40',
  'concluido': 'bg-green-500/20 text-green-400 border-green-500/40',
  'publicado': 'bg-primary/20 text-primary border-primary/40',
  'postado': 'bg-primary/20 text-primary border-primary/40',
};

// Helper: get a display-friendly status label
const getStatusLabel = (status: string | undefined): string => {
  if (!status) return 'Pendente';
  const lower = status.toLowerCase();
  const labels: Record<string, string> = {
    'pendente': 'Pendente',
    'em produção': 'Em Produção',
    'em producao': 'Em Produção',
    'alteracao': 'Alteração',
    'alteração': 'Alteração',
    'aprovado': 'Aprovado',
    'publicado': 'Publicado',
    'concluido': 'Concluído',
    'concluído': 'Concluído',
  };
  return labels[lower] || status.charAt(0).toUpperCase() + status.slice(1);
};

// Helper: get color classes for status
const getStatusColorClasses = (status: string | undefined): string => {
  if (!status) return 'text-zinc-500';
  const lower = status.toLowerCase();
  return statusColors[lower]?.split(' ').find(c => c.startsWith('text-')) || 'text-white/50';
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
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  
  // Tab state for Instagram-style modal
  const [activeTab, setActiveTab] = useState<'Tema' | 'Conteúdo' | 'Mídia' | 'Legenda'>('Tema');

  // Additional states for context menu actions
  const [actionDialog, setActionDialog] = useState<{type: 'move_date' | 'copy_date' | 'copy_client', taskId: string} | null>(null);
  const [actionDate, setActionDate] = useState('');
  const [actionClientId, setActionClientId] = useState('');
  
  // Drag and Drop Upload state for Cards
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);
  const [uploadingTask, setUploadingTask] = useState<{id: string, progress: number, success: boolean, preview: string | null} | null>(null);

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

  const handleCardDragOver = (e: React.DragEvent, taskId: string) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
      setDragOverCardId(taskId);
    }
  };

  const handleCardDrop = async (e: React.DragEvent, taskId: string) => {
    setDragOverCardId(null);
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const file = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('image/'));
    if (!file) return;

    const tempUrl = URL.createObjectURL(file);
    setUploadingTask({ id: taskId, progress: 10, success: false, preview: tempUrl });

    try {
      const compressed = await compressImage(file);
      setUploadingTask({ id: taskId, progress: 80, success: false, preview: tempUrl });
      
      updateCalendarTask(taskId, { imageUrl: compressed } as any);
      
      setUploadingTask({ id: taskId, progress: 100, success: true, preview: tempUrl });
      setTimeout(() => {
        setUploadingTask(null);
        URL.revokeObjectURL(tempUrl);
      }, 2000);
    } catch (err) {
      console.error(err);
      setUploadingTask(null);
      URL.revokeObjectURL(tempUrl);
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
                  status === 'pendente' ? 'bg-zinc-400' :
                  status === 'em produção' || status === 'em producao' ? 'bg-yellow-400' :
                  status === 'alteracao' || status === 'alteração' ? 'bg-orange-400' :
                  status === 'aprovado' || status === 'aprovado-programar' ? 'bg-emerald-400' :
                  status === 'concluido' || status === 'concluído' ? 'bg-green-400' :
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
                            onDragOver={(e) => handleCardDragOver(e, task.id)}
                            onDragLeave={(e) => { if(e.dataTransfer.types.includes('Files')) setDragOverCardId(null) }}
                            onDrop={(e) => handleCardDrop(e, task.id)}
                            className={`relative group/task mb-1.5 last:mb-0 block rounded-lg transition-all ${dragOverCardId === task.id ? 'ring-2 ring-primary scale-[1.02] z-10 bg-[#252528]' : ''}`}
                          >
                            {uploadingTask?.id === task.id && (
                              <div className="absolute inset-0 z-50 bg-black/80 rounded-lg flex flex-col items-center justify-center backdrop-blur-sm shadow-xl p-2 border border-white/10 overflow-hidden">
                                {uploadingTask.success ? (
                                  <div className="flex items-center gap-1.5">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500 animate-in zoom-in" />
                                    <span className="text-[10px] font-bold text-white uppercase">Salvo</span>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex items-center gap-2 mb-2 w-full px-2">
                                      <Loader2 className="w-4 h-4 text-primary animate-spin" />
                                      <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                                        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${uploadingTask.progress}%` }} />
                                      </div>
                                    </div>
                                    {uploadingTask.preview && (
                                      <img src={uploadingTask.preview} className="w-full h-10 object-cover opacity-50 rounded" alt="" />
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                            
                            <div
                              onClick={() => setEditTask(task)}
                              className={`w-full text-left rounded-lg p-2.5 bg-[#1C1C1E] border ${dragOverCardId === task.id ? 'border-primary' : 'border-white/5'} hover:bg-[#252528] transition-all cursor-pointer shadow-md group/card flex flex-col gap-2 relative overflow-hidden`}
                            >
                              {/* Left colored border indicative of status instead of type format */}
                              <div className={`absolute left-0 top-0 bottom-0 w-[4px] opacity-100 ${statusColors[task.status?.toLowerCase()]?.split(' ')[0] || 'bg-white/10'}`} />
                              
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
                                    <ImageIcon className="w-3 h-3 text-emerald-400/80" />
                                  </div>
                                )}
                              </div>
                              
                              {/* Quick actions on hover */}
                              <div className="absolute right-1 top-1.5 flex flex-col gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
                                <div className="p-1 rounded bg-white/5 hover:bg-white/20 text-white/50 hover:text-white transition-colors" onClick={(e) => { e.stopPropagation(); setEditTask(task); }}>
                                  <Edit className="w-[10px] h-[10px]" />
                                </div>
                                <div className="p-1 rounded bg-white/5 hover:bg-red-500/80 text-white/50 hover:text-white transition-colors" onClick={(e) => { e.stopPropagation(); setDeleteConfirm(task.id); }}>
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
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ml-auto ${statusColors[task.status?.toLowerCase()] || 'text-white/50'}`}>{task.status || 'Pendente'}</span>
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
                          <ContextMenuItem onClick={() => setDeleteConfirm(task.id)} className="gap-2.5 cursor-pointer rounded-lg text-red-500 focus:bg-red-500/20 focus:text-red-500 py-2 text-xs"><Trash2 className="w-3.5 h-3.5"/> Excluir</ContextMenuItem>
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
            <div className="flex flex-col gap-8 max-w-[480px] w-full mx-auto pb-10">
              {feedTasks.map(task => (
                <div key={task.id} className="bg-[#1C1C1E] border border-white/10 rounded-[1.5rem] overflow-hidden shadow-2xl">
                  {/* Header */}
                  <div className="flex items-center justify-between p-4 border-b border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center font-bold text-xs shadow-md">
                        {task.clientName?.substring(0,2).toUpperCase() || 'CX'}
                      </div>
                      <span className="font-bold text-sm tracking-wide text-white uppercase">{task.clientName}</span>
                    </div>
                    <Badge variant="outline" className={`font-semibold border-white/10 ${statusColors[task.status?.toLowerCase()] || 'bg-white/5 text-white/60'}`}>
                      {task.status || 'Pendente'}
                    </Badge>
                  </div>
                  
                  {/* Image */}
                  <div 
                    className="relative w-full bg-[#121214] cursor-pointer group flex items-center justify-center"
                    onClick={() => setEditTask(task)}
                  >
                    <img 
                      src={task.imageUrl!} 
                      className="w-full h-auto max-h-[600px] object-cover transition-transform duration-500 group-hover:scale-[1.01]" 
                      loading="lazy" 
                      alt=""
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                      <Button variant="secondary" className="font-bold rounded-xl shadow-2xl h-10 px-6"><Edit className="w-4 h-4 mr-2"/> Editar Card</Button>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="p-4 space-y-3 bg-[#161618]">
                    <div className="flex items-center justify-between">
                      <Badge className={`text-[10px] uppercase tracking-wider ${getTypeColor(task.contentType)}`}>{task.contentType}</Badge>
                      <span className="text-[11px] text-white/40 font-medium">{task.date.split('-').reverse().join('/')}</span>
                    </div>
                    
                    <div className="text-[13px] text-white/80 leading-relaxed whitespace-pre-wrap mt-2">
                       <span className="font-bold text-white mr-2 uppercase">{task.clientName}</span>
                       {task.description || <span className="text-white/30 italic">Nenhuma legenda informada para este post.</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Add Task Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-[#121214] text-white border-white/10 max-w-[950px] p-0 rounded-2xl overflow-hidden flex h-[700px] max-h-[90vh]">
          {/* Left Instagram Preview */}
          <div className="w-[380px] bg-[#0c0c0e] border-r border-white/10 flex flex-col items-center p-6 shrink-0 h-full overflow-y-auto custom-scrollbar">
             <div className="w-full bg-[#1C1C1E] border border-white/10 rounded-2xl overflow-hidden flex flex-col mt-4">
               {/* Header */}
               <div className="flex items-center justify-between p-3.5 border-b border-white/5">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center text-xs font-bold shadow-md">
                      {(form.clientName || 'CL').substring(0,2).toUpperCase()}
                    </div>
                    <span className="font-bold text-[13px] tracking-wide">{form.clientName || 'Novo Post'}</span>
                 </div>
                 <MoreHorizontal className="w-4 h-4 text-white/50" />
               </div>
               
               {/* Image */}
               <div className="w-full aspect-[4/5] bg-[#0f0f11] flex items-center justify-center relative group">
                 {form.imageUrl ? (
                   <img src={form.imageUrl} className="w-full h-full object-cover" />
                 ) : (
                    <div className="text-white/20 flex flex-col items-center p-4 text-center">
                       <ImageIcon className="w-12 h-12 mb-3 opacity-50" />
                       <span className="text-xs font-medium uppercase tracking-widest text-white/40">Sem Mídia</span>
                    </div>
                 )}
                 <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center backdrop-blur-[2px]">
                    <Upload className="w-8 h-8 text-white mb-2" />
                    <span className="text-xs font-bold uppercase tracking-wider text-white">Upload</span>
                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleFileUpload(e, 'add')} />
                 </div>
               </div>

               {/* Interaction Footer */}
               <div className="p-3.5 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-4">
                      <Heart className="w-5 h-5 text-white hover:text-red-500 cursor-pointer transition-colors" />
                      <MessageCircle className="w-5 h-5 text-white hover:text-white/70 cursor-pointer transition-colors" />
                      <Send className="w-5 h-5 text-white hover:text-white/70 cursor-pointer transition-colors" />
                    </div>
                    <Bookmark className="w-5 h-5 text-white hover:text-white/70 cursor-pointer transition-colors" />
                  </div>
                  
                  <div className="text-[13px] text-white/90 leading-tight">
                    <span className="font-bold text-white mr-2">{form.clientName || 'Cliente'}</span>
                    <span className="whitespace-pre-wrap opacity-80">{form.description || 'Sua legenda aparecerá aqui...'}</span>
                  </div>
               </div>
             </div>
          </div>

          {/* Right Form Tabs */}
          <div className="flex-1 flex flex-col bg-[#121214] h-full">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-lg font-bold">Criar Post — {addDate}</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowAddDialog(false)} className="rounded-full hover:bg-white/5 text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto tab-scrollbar">
               {/* Custom Tabs */}
               <div className="grid grid-cols-4 gap-3 mb-8">
                  {['Tema', 'Conteúdo', 'Mídia', 'Legenda'].map(tab => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab as any)}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200 ${
                        activeTab === tab 
                          ? 'border-primary bg-primary/10 shadow-[0_0_15px_rgba(239,68,68,0.1)]' 
                          : 'border-white/10 bg-[#1C1C1E] hover:border-white/20'
                      }`}
                    >
                       <span className={`text-sm font-bold ${activeTab === tab ? 'text-white' : 'text-white/70'}`}>{tab}</span>
                       <span className={`text-[10px] font-semibold uppercase mt-0.5 tracking-wider ${getStatusColorClasses(form.status)}`}>{getStatusLabel(form.status)}</span>
                    </button>
                  ))}
               </div>

               <form id="add-task-form" onSubmit={handleAdd} className="space-y-6">
                 {activeTab === 'Tema' && (
                   <div className="space-y-5 animate-in fade-in">
                      <div>
                        <label className="text-xs text-white/50 uppercase tracking-wider font-bold mb-2 block">Nome da Postagem / Cliente</label>
                        <Input placeholder="Nome do conteúdo..." value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} className="bg-[#1C1C1E] border-white/10 rounded-xl h-12 focus-visible:ring-red-500 text-white" />
                      </div>
                      <div>
                        <label className="text-xs text-white/50 uppercase tracking-wider font-bold mb-2 block">Horário</label>
                        <Input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} className="bg-[#1C1C1E] border-white/10 rounded-xl h-12 focus-visible:ring-red-500 text-white w-full sm:w-1/2" />
                      </div>
                   </div>
                 )}

                 {activeTab === 'Conteúdo' && (
                   <div className="space-y-5 animate-in fade-in">
                      <div>
                        <label className="text-xs text-white/50 uppercase tracking-wider font-bold mb-2 block">Tipo de Conteúdo</label>
                        <Select value={form.contentType} onValueChange={v => setForm(f => ({ ...f, contentType: v }))}>
                          <SelectTrigger className="bg-[#1C1C1E] border-white/10 rounded-xl h-12 focus:ring-red-500 text-white"><SelectValue placeholder="Formato" /></SelectTrigger>
                          <SelectContent className="bg-[#252528] border-white/10 text-white rounded-xl">
                            {CONTENT_TYPES.map(t => <SelectItem key={t} value={t} className="focus:bg-white/10 focus:text-white rounded-lg">{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs text-white/50 uppercase tracking-wider font-bold mb-2 block">Responsável</label>
                        {employees.length > 0 ? (
                          <Select value={form.employeeId} onValueChange={v => setForm(f => ({ ...f, employeeId: v }))}>
                            <SelectTrigger className="bg-[#1C1C1E] border-white/10 rounded-xl h-12 focus:ring-red-500 text-white"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                            <SelectContent className="bg-[#252528] border-white/10 text-white rounded-xl">
                              {employees.map(e => <SelectItem key={e.id} value={e.id} className="focus:bg-white/10 focus:text-white rounded-lg">{e.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="text-sm text-white/40 py-2">Nenhum funcionário cadastrado.</p>
                        )}
                      </div>
                   </div>
                 )}

                 {activeTab === 'Mídia' && (
                   <div className="space-y-5 animate-in fade-in">
                      <label className="text-xs text-white/50 uppercase tracking-wider font-bold mb-2 block">Anexo Base</label>
                      <div
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => handleDropUpload(e, 'add')}
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-white/10 bg-white/[0.02] rounded-2xl p-8 text-center cursor-pointer hover:border-red-500/50 hover:bg-red-500/5 transition-all flex flex-col items-center justify-center min-h-[200px]"
                      >
                        {form.imageUrl ? (
                          <div className="relative inline-block w-full h-full max-h-[300px]">
                            <img src={form.imageUrl} alt="" className="max-h-[300px] w-full rounded-lg object-contain" />
                            <button type="button" onClick={(e) => { e.stopPropagation(); setForm(f => ({ ...f, imageUrl: '' })); }} className="absolute -top-3 -right-3 bg-red-600 rounded-full p-2 shadow-xl hover:bg-red-700 transition-colors">
                              <X className="w-4 h-4 text-white" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                              <Upload className="w-8 h-8 text-white/40" />
                            </div>
                            <p className="text-sm font-bold text-white/80">Arraste uma imagem ou clique aqui</p>
                            <p className="text-xs text-white/40 mt-1">Recomendado formato 4:5 ou 1:1</p>
                          </>
                        )}
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'add')} />
                      </div>
                   </div>
                 )}

                 {activeTab === 'Legenda' && (
                   <div className="space-y-5 animate-in fade-in">
                      <div>
                        <label className="text-xs text-white/50 uppercase tracking-wider font-bold mb-2 block">Texto / Legenda da Postagem</label>
                        <Textarea placeholder="Escreva a legenda aqui..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="bg-[#1C1C1E] border-white/10 min-h-[250px] rounded-xl focus-visible:ring-red-500 text-white resize-none text-[13px] leading-relaxed p-4" />
                      </div>
                   </div>
                 )}
               </form>
            </div>

            <div className="p-4 border-t border-white/5 bg-[#161618] flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 border border-white/10 bg-[#1C1C1E] rounded-xl pl-3 pr-1 py-1">
                   <div className={`w-2.5 h-2.5 rounded-full ${statusColors[form.status]?.split(' ')[0] || 'bg-white/50'}`} />
                   <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                     <SelectTrigger className="h-8 border-none bg-transparent shadow-none focus:ring-0 text-xs font-bold uppercase w-36"><SelectValue /></SelectTrigger>
                     <SelectContent className="bg-[#252528] border-white/10 text-white rounded-xl">
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="em produção">Em Produção</SelectItem>
                        <SelectItem value="alteracao">Alteração</SelectItem>
                        <SelectItem value="aprovado">Aprovado</SelectItem>
                        <SelectItem value="publicado">Publicado</SelectItem>
                     </SelectContent>
                   </Select>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="ghost" onClick={() => setShowAddDialog(false)} className="rounded-xl hover:bg-white/5">Cancelar</Button>
                <Button type="submit" form="add-task-form" className="h-10 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all shadow-lg font-bold px-8" disabled={!form.clientName.trim() || !form.employeeId}>
                  Criar Task
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent className="bg-[#161618] border-white/5 text-white max-w-md rounded-3xl shadow-2xl p-6 sm:p-8">
          <AlertDialogHeader className="mb-4">
            <AlertDialogTitle className="text-xl font-bold flex flex-col items-center gap-3 text-white text-center">
              <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 mb-2">
                <Trash2 className="w-7 h-7 text-red-500" />
              </div>
              Deseja remover este card?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/60 pt-2 text-sm leading-relaxed text-center font-medium max-w-[280px] mx-auto">
              Esta ação excluirá a postagem do calendário permanentemente e não poderá ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-3 border-t border-white/5 pt-6 mt-2">
            <AlertDialogCancel className="bg-[#1C1C1E] border-white/5 hover:bg-white/5 hover:text-white text-white rounded-xl h-11 w-full sm:w-1/2 font-medium transition-colors m-0 sm:m-0">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => { if(deleteConfirm) deleteCalendarTask(deleteConfirm); setDeleteConfirm(null); }}
              className="bg-red-500 hover:bg-red-600 focus:ring-red-500 text-white rounded-xl h-11 w-full sm:w-1/2 font-bold shadow-lg shadow-red-500/20 m-0 sm:m-0"
            >
              Sim, Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Task Detail Dialog (Unified Design) */}
      <Dialog open={!!editTask} onOpenChange={(open) => !open && setEditTask(null)}>
        <DialogContent className="bg-[#121214] text-white border-white/10 max-w-[950px] p-0 rounded-2xl overflow-hidden flex h-[700px] max-h-[90vh]">
          {editTask && (
            <>
              {/* Left Instagram Preview */}
              <div className="w-[380px] bg-[#0c0c0e] border-r border-white/10 flex flex-col items-center p-6 shrink-0 h-full overflow-y-auto custom-scrollbar">
                 <div className="w-full bg-[#1C1C1E] border border-white/10 rounded-2xl overflow-hidden flex flex-col mt-4">
                   {/* Header */}
                   <div className="flex items-center justify-between p-3.5 border-b border-white/5">
                     <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center text-xs font-bold shadow-md">
                          {(editTask.clientName || 'CL').substring(0,2).toUpperCase()}
                        </div>
                        <span className="font-bold text-[13px] tracking-wide uppercase">{editTask.clientName}</span>
                     </div>
                     <MoreHorizontal className="w-4 h-4 text-white/50" />
                   </div>
                   
                   {/* Image */}
                   <div className="w-full aspect-[4/5] bg-[#0f0f11] flex items-center justify-center relative group">
                     {editTask.imageUrl ? (
                       <img src={editTask.imageUrl} className="w-full h-full object-cover" />
                     ) : (
                        <div className="text-white/20 flex flex-col items-center p-4 text-center">
                           <ImageIcon className="w-12 h-12 mb-3 opacity-50" />
                           <span className="text-xs font-medium uppercase tracking-widest text-white/40">Sem Mídia</span>
                        </div>
                     )}
                     <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center backdrop-blur-[2px]">
                        <Upload className="w-8 h-8 text-white mb-2" />
                        <span className="text-xs font-bold uppercase tracking-wider text-white">Upload</span>
                        <input ref={editFileInputRef} type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleFileUpload(e, 'edit')} />
                     </div>
                   </div>

                   {/* Interaction Footer */}
                   <div className="p-3.5 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div className="flex gap-4">
                          <Heart className="w-5 h-5 text-white hover:text-red-500 cursor-pointer transition-colors" />
                          <MessageCircle className="w-5 h-5 text-white hover:text-white/70 cursor-pointer transition-colors" />
                          <Send className="w-5 h-5 text-white hover:text-white/70 cursor-pointer transition-colors" />
                        </div>
                        <Bookmark className="w-5 h-5 text-white hover:text-white/70 cursor-pointer transition-colors" />
                      </div>
                      
                      <div className="text-[13px] text-white/90 leading-tight">
                        <span className="font-bold text-white mr-2 uppercase">{editTask.clientName}</span>
                        <span className="whitespace-pre-wrap opacity-80">{editTask.description || 'Nenhuma legenda'}</span>
                      </div>
                   </div>
                 </div>
              </div>

              {/* Right Form Tabs */}
              <div className="flex-1 flex flex-col bg-[#121214] h-full">
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                  <h2 className="text-lg font-bold">Resumo do Card</h2>
                  <Button variant="ghost" size="icon" onClick={() => setEditTask(null)} className="rounded-full hover:bg-white/5 text-white/50 hover:text-white">
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto tab-scrollbar">
                   {/* Custom Tabs */}
                   <div className="grid grid-cols-4 gap-3 mb-8">
                      {['Tema', 'Conteúdo', 'Mídia', 'Legenda'].map(tab => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setActiveTab(tab as any)}
                          className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200 ${
                            activeTab === tab 
                              ? 'border-primary bg-primary/10 shadow-[0_0_15px_rgba(239,68,68,0.1)]' 
                              : 'border-white/10 bg-[#1C1C1E] hover:border-white/20'
                          }`}
                        >
                           <span className={`text-sm font-bold ${activeTab === tab ? 'text-white' : 'text-white/70'}`}>{tab}</span>
                           <span className={`text-[10px] font-semibold uppercase mt-0.5 tracking-wider ${getStatusColorClasses(editTask?.status)}`}>{getStatusLabel(editTask?.status)}</span>
                        </button>
                      ))}
                   </div>

                   <div className="space-y-6">
                     {activeTab === 'Tema' && (
                       <div className="space-y-5 animate-in fade-in">
                          <div>
                            <label className="text-xs text-white/50 uppercase tracking-wider font-bold mb-2 block">Nome da Postagem / Cliente</label>
                            <Input value={editTask.clientName} onChange={e => setEditTask(prev => prev ? { ...prev, clientName: e.target.value } : null)} onBlur={() => handleEditSave('clientName', editTask.clientName)} className="bg-[#1C1C1E] border-white/10 rounded-xl h-12 focus-visible:ring-red-500 text-white" />
                          </div>
                          <div>
                            <label className="text-xs text-white/50 uppercase tracking-wider font-bold mb-2 block">Horário</label>
                            <Input type="time" value={editTask.time} onChange={e => { const v = e.target.value; setEditTask(prev => prev ? { ...prev, time: v } : null); handleEditSave('time', v); }} className="bg-[#1C1C1E] border-white/10 rounded-xl h-12 focus-visible:ring-red-500 text-white w-full sm:w-1/2" />
                          </div>
                       </div>
                     )}

                     {activeTab === 'Conteúdo' && (
                       <div className="space-y-5 animate-in fade-in">
                          <div>
                            <label className="text-xs text-white/50 uppercase tracking-wider font-bold mb-2 block">Tipo de Conteúdo</label>
                            <Select value={editTask.contentType} onValueChange={v => handleEditSave('contentType', v)}>
                              <SelectTrigger className="bg-[#1C1C1E] border-white/10 rounded-xl h-12 focus:ring-red-500 text-white"><SelectValue placeholder="Formato" /></SelectTrigger>
                              <SelectContent className="bg-[#252528] border-white/10 text-white rounded-xl">
                                {CONTENT_TYPES.map(t => <SelectItem key={t} value={t} className="focus:bg-white/10 focus:text-white rounded-lg">{t}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-xs text-white/50 uppercase tracking-wider font-bold mb-2 block">Responsável</label>
                            {employees.length > 0 ? (
                              <Select value={editTask.employeeId} onValueChange={v => handleEditSave('employeeId', v)}>
                                <SelectTrigger className="bg-[#1C1C1E] border-white/10 rounded-xl h-12 focus:ring-red-500 text-white"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                                <SelectContent className="bg-[#252528] border-white/10 text-white rounded-xl">
                                  {employees.map(e => <SelectItem key={e.id} value={e.id} className="focus:bg-white/10 focus:text-white rounded-lg">{e.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            ) : (
                              <p className="text-sm text-white/40 py-2">Nenhum funcionário cadastrado.</p>
                            )}
                          </div>
                       </div>
                     )}

                     {activeTab === 'Mídia' && (
                       <div className="space-y-5 animate-in fade-in">
                          <label className="text-xs text-white/50 uppercase tracking-wider font-bold mb-2 block">Anexo Base</label>
                          <div
                            onDragOver={e => e.preventDefault()}
                            onDrop={e => handleDropUpload(e, 'edit')}
                            onClick={() => editFileInputRef.current?.click()}
                            className="border-2 border-dashed border-white/10 bg-white/[0.02] rounded-2xl p-8 text-center cursor-pointer hover:border-red-500/50 hover:bg-red-500/5 transition-all flex flex-col items-center justify-center min-h-[200px]"
                          >
                            {editTask.imageUrl ? (
                              <div className="relative inline-block w-full h-full max-h-[300px]">
                                <img src={editTask.imageUrl} alt="" className="max-h-[300px] w-full rounded-lg object-contain" />
                                <button type="button" onClick={(e) => { e.stopPropagation(); updateCalendarTask(editTask.id, { imageUrl: undefined }); setEditTask(prev => prev ? { ...prev, imageUrl: undefined } : null); }} className="absolute -top-3 -right-3 bg-red-600 rounded-full p-2 shadow-xl hover:bg-red-700 transition-colors">
                                  <X className="w-4 h-4 text-white" />
                                </button>
                              </div>
                            ) : (
                              <>
                                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                                  <Upload className="w-8 h-8 text-white/40" />
                                </div>
                                <p className="text-sm font-bold text-white/80">Arraste uma imagem ou clique aqui</p>
                                <p className="text-xs text-white/40 mt-1">Recomendado formato 4:5 ou 1:1</p>
                              </>
                            )}
                          </div>
                       </div>
                     )}

                     {activeTab === 'Legenda' && (
                       <div className="space-y-5 animate-in fade-in">
                          <div>
                            <label className="text-xs text-white/50 uppercase tracking-wider font-bold mb-2 block">Texto / Legenda da Postagem</label>
                            <Textarea value={editTask.description} onChange={e => setEditTask(prev => prev ? { ...prev, description: e.target.value } : null)} onBlur={() => handleEditSave('description', editTask.description)} className="bg-[#1C1C1E] border-white/10 min-h-[250px] rounded-xl focus-visible:ring-red-500 text-white resize-none text-[13px] leading-relaxed p-4" />
                          </div>
                       </div>
                     )}
                   </div>
                </div>

                {/* Edit Footer (Status & Excluir) */}
                <div className="p-4 border-t border-white/5 bg-[#161618] flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 border border-white/10 bg-[#1C1C1E] rounded-xl pl-3 pr-1 py-1">
                       <div className={`w-2.5 h-2.5 rounded-full ${statusColors[editTask.status?.toLowerCase()]?.split(' ')[0] || 'bg-white/50'}`} />
                       <Select value={editTask.status} onValueChange={v => handleEditSave('status', v)}>
                         <SelectTrigger className="h-8 border-none bg-transparent shadow-none focus:ring-0 text-xs font-bold uppercase w-36"><SelectValue /></SelectTrigger>
                         <SelectContent className="bg-[#252528] border-white/10 text-white rounded-xl">
                            <SelectItem value="pendente">Pendente</SelectItem>
                            <SelectItem value="em produção">Em Produção</SelectItem>
                            <SelectItem value="alteracao">Alteração</SelectItem>
                            <SelectItem value="aprovado">Aprovado</SelectItem>
                            <SelectItem value="publicado">Publicado</SelectItem>
                         </SelectContent>
                       </Select>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button variant="ghost" className="text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl" onClick={() => { if(window.confirm('Excluir este card permanentemente?')) { deleteCalendarTask(editTask.id); setEditTask(null); } }}>
                      <Trash2 className="w-4 h-4 mr-2" /> Excluir
                    </Button>
                    <Button onClick={() => setEditTask(null)} className="h-10 bg-white text-black hover:bg-white/90 rounded-xl transition-all shadow-lg font-bold px-8">
                      Concluído
                    </Button>
                  </div>
                </div>
              </div>
            </>
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
