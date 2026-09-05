import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/useApp';
import type { CalendarTask } from '@/contexts/app-types';
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, Trash2, Upload, X, ZoomIn, Image as ImageIcon, Grid3X3, CalendarDays, LayoutList, Copy, ArrowRightLeft, CopyPlus, Edit, CheckCircle2, Heart, MessageCircle, Send, Bookmark, MoreHorizontal, RefreshCw, Kanban, Folder, Check, ChevronDown, Crop, Settings2, Settings, PenTool } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { compressImage } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ImageAdjustmentModal } from '../components/ImageAdjustmentModal';
import { applyImageAdjustment } from '@/lib/imageProcessor';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, ContextMenuSeparator } from '@/components/ui/context-menu';
import { toast } from 'sonner';
import { getCalendarTaskStatus } from '../utils/calendarStatus';

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
  'reprovado': 'bg-rose-500/20 text-rose-500 border-rose-500/40',
};

// Helper: get a display-friendly status label
const getStatusLabel = (status: string | undefined): string => {
  if (!status) return 'Pendente';
  const lower = status.toLowerCase();
  const labels: Record<string, string> = {
    'pendente': 'Pendente',
    'em produção': 'Aprovado MAC',
    'em producao': 'Aprovado MAC',
    'alteracao': 'Alteração',
    'alteração': 'Alteração',
    'aprovado': 'Aprovado',
    'publicado': 'Aprovação Cliente',
    'concluido': 'Concluído',
    'concluído': 'Concluído',
    'reprovado': 'Reprovado',
  };
  return labels[lower] || status.charAt(0).toUpperCase() + status.slice(1);
};

const normalizeStatusValue = (status: string | undefined): string => {
  if (!status) return 'pendente';
  const s = status.toLowerCase().trim();
  if (s === 'para-correcao' || s === 'para correcao' || s === 'para_correcao' || s === 'para correção' || s === 'correcao-cliente') {
    return 'para correção';
  }
  if (s === 'em-producao' || s === 'em producao' || s === 'em produção' || s === 'em_producao') {
    return 'em produção';
  }
  if (s === 'alteracao' || s === 'alteração' || s === 'alteracões') {
    return 'alteração';
  }
  if (s === 'concluido' || s === 'concluído' || s === 'aprovado-programar') {
    return 'aprovado';
  }
  return s;
};

// Helper: get color classes for status
const getStatusColorClasses = (status: string | undefined): string => {
  if (!status) return 'text-zinc-500';
  const lower = status.toLowerCase();
  return statusColors[lower]?.split(' ').find(c => c.startsWith('text-')) || 'text-white/50';
};

const isVideoUrl = (url: string | undefined) => url ? !!url.match(/\.(mp4|webm|ogg|mov)$/i) : false;

const ClientCalendar = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { 
    employees, 
    calendarTasks, 
    calendarClients, 
    addCalendarTask, 
    updateCalendarTask, 
    deleteCalendarTask, 
    addKanbanCard,
    updateKanbanCard,
    kanbanCards = [],
    kanbanColumns = [],
    loading,
    loggedUserRole,
    loggedUserClientLink,
    loggedUserKanbanLink,
    uploadCalendarAsset,
    deleteCalendarAsset,
    fetchAll,
    duplicateCalendarToClients
  } = useApp();
  
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchAll();
      toast.success('Dados atualizados!');
    } catch (err) {
      toast.error('Erro ao atualizar dados');
    } finally {
      setIsRefreshing(false);
    }
  };
  const [viewMode, setViewMode] = useState<'calendar' | 'feed' | 'weekly'>('calendar');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addDate, setAddDate] = useState<string>('');
  const [editTask, setEditTask] = useState<CalendarTask | null>(null);
  const [calendarView, setCalendarView] = useState<'grid' | 'list'>('grid');
  const [filterType, setFilterType] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending_overdue' | 'completed'>('all');
  
  const [adjustmentModalData, setAdjustmentModalData] = useState<{ task: CalendarTask; index: number } | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showCommentsPanel, setShowCommentsPanel] = useState(false);
  const [newComment, setNewComment] = useState("");
  const commentsContainerRef = useRef<HTMLDivElement>(null);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const statusBtnRef = useRef<HTMLButtonElement>(null);
  const [statusMenuPos, setStatusMenuPos] = useState<{ top: number; left: number } | null>(null);
  
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [selectedDuplicateClients, setSelectedDuplicateClients] = useState<string[]>([]);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [duplicateProgress, setDuplicateProgress] = useState(0);

  const handleDuplicateCalendar = async () => {
    if (selectedDuplicateClients.length === 0) {
      toast.error("Selecione um cliente para duplicar.");
      return;
    }
    if (!clientId) return;
    
    setIsDuplicating(true);
    setDuplicateProgress(10);
    
    const interval = setInterval(() => {
      setDuplicateProgress(prev => Math.min(prev + (Math.random() * 15), 90));
    }, 800);

    try {
      await duplicateCalendarToClients(clientId, selectedDuplicateClients, currentDate);
      setDuplicateProgress(100);
      setTimeout(() => {
        setShowDuplicateDialog(false);
        setSelectedDuplicateClients([]);
      }, 600);
    } catch (error) {
      // Error handled in context
      setDuplicateProgress(0);
    } finally {
      clearInterval(interval);
      setTimeout(() => setIsDuplicating(false), 600);
    }
  };
  
  const { loggedUserId, loggedUserName } = useAuth();

  const [readComments, setReadComments] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem(`@macmidia:read_comments_${loggedUserId}`);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    if (showCommentsPanel && editTask?.id) {
      const currentCount = editTask.comments?.length || 0;
      setReadComments(prev => {
        if (prev[editTask.id] !== currentCount) {
          const updated = { ...prev, [editTask.id]: currentCount };
          localStorage.setItem(`@macmidia:read_comments_${loggedUserId}`, JSON.stringify(updated));
          return updated;
        }
        return prev;
      });
    }

    if (showCommentsPanel && commentsContainerRef.current) {
      commentsContainerRef.current.scrollTop = commentsContainerRef.current.scrollHeight;
    }
  }, [editTask?.comments, showCommentsPanel, editTask?.id, loggedUserId]);

  useEffect(() => {
    if (editTask?.id) {
      const updated = calendarTasks.find(t => t.id === editTask.id);
      if (updated) {
        setEditTask(prev => {
           if (!prev) return updated;
           if (JSON.stringify(prev.comments) === JSON.stringify(updated.comments) && 
               JSON.stringify(prev.images) === JSON.stringify(updated.images) &&
               prev.status === updated.status) {
             return prev;
           }
           return { ...prev, ...updated, comments: updated.comments, images: updated.images, status: updated.status };
        });
      }
    }
  }, [calendarTasks, editTask?.id]);

  const handleSendComment = () => {
    if (!newComment.trim() || !editTask) return;
    
    const commentObj = {
      id: crypto.randomUUID(),
      text: newComment.trim(),
      userId: loggedUserId || 'unknown',
      userName: loggedUserName || 'Usuário',
      avatarUrl: employees.find(e => e.id === loggedUserId)?.avatarUrl || employees.find(e => e.id === loggedUserId)?.photoUrl || '',
      createdAt: new Date().toISOString()
    };
    
    const newComments = [...(editTask.comments || []), commentObj];
    updateCalendarTask(editTask.id, { comments: newComments });
    setEditTask({ ...editTask, comments: newComments });
    setNewComment("");
  };
  const [form, setForm] = useState({ 
    clientName: '', 
    contentType: '', 
    description: '', 
    time: '09:00', 
    imageUrl: '', 
    status: 'pendente', 
    employeeId: '',
    reference_links: ['', '', ''],
    content: '',
    images: [] as string[],
    image_adjustments: {} as any
  });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteImageConfirm, setDeleteImageConfirm] = useState<{ url: string; index: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  
  // Tab state for Instagram-style modal
  const [activeTab, setActiveTab] = useState<'Tema' | 'Conteúdo' | 'Mídia' | 'Legenda'>('Tema');

  const [actionDate, setActionDate] = useState('');
  const [actionClientId, setActionClientId] = useState('');
  const [actionDialog, setActionDialog] = useState<{type: 'move_date' | 'copy_task', taskId: string} | null>(null);
  
  // Drag and Drop Upload state for Cards
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);
  const [uploadingTask, setUploadingTask] = useState<{id: string, progress: number, success?: boolean, preview: string | null, isVideo?: boolean} | null>(null);

  // Estado para o diálogo "Enviar para Kanban"
  const [showSendToKanban, setShowSendToKanban] = useState(false);
  const [sendToKanbanEmployeeId, setSendToKanbanEmployeeId] = useState('');
  const [isSendingToKanban, setIsSendingToKanban] = useState(false);

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

  // Security check for GUEST
  if (loggedUserRole === 'GUEST' && loggedUserClientLink) {
    const allowedIds = loggedUserClientLink.split(',');
    if (!allowedIds.includes(clientId || '')) {
      navigate(`/calendario/${allowedIds[0]}`, { replace: true });
      return null;
    }
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
    setForm({ 
      clientName: client?.name || '', 
      contentType: '', 
      description: '', 
      time: '09:00', 
      imageUrl: '', 
      status: 'pendente', 
      employeeId: '',
      reference_links: ['', '', ''],
      content: '',
      images: []
    });
    setShowAddDialog(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'add' | 'edit') => {
    const file = e.target.files?.[0];
    if (!file || (!file.type.startsWith('image/') && !file.type.startsWith('video/'))) return;
    
    try {
      const taskId = target === 'edit' && editTask ? editTask.id : `temp-${Date.now()}`;
      
      // Mostrar progresso no card que está sendo editado/adicionado
      setUploadingTask({ id: taskId, progress: 10, preview: URL.createObjectURL(file), isVideo: file.type.startsWith('video/') });
      
      const publicUrl = await uploadCalendarAsset(taskId, file, (progress) => {
        setUploadingTask(prev => prev ? { ...prev, progress } : null);
      });
      
      setUploadingTask({ id: taskId, progress: 100, success: true, preview: URL.createObjectURL(file), isVideo: file.type.startsWith('video/') });
      setTimeout(() => setUploadingTask(null), 2000);
      
      if (target === 'add') {
        setForm(f => ({ ...f, imageUrl: f.imageUrl || publicUrl, images: [...(f.images || []), publicUrl] }));
      } else if (editTask) {
        const newImages = [...(editTask.images || []), publicUrl];
        const newCover = editTask.imageUrl || publicUrl;
        updateCalendarTask(editTask.id, { images: newImages, imageUrl: newCover });
        setEditTask(prev => prev ? { ...prev, images: newImages, imageUrl: newCover } : null);
      }
    } catch (err) {
      setUploadingTask(null);
    }
  };

  const handleDropUpload = async (e: React.DragEvent, target: 'add' | 'edit') => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file || (!file.type.startsWith('image/') && !file.type.startsWith('video/'))) return;
    
    try {
      const taskId = target === 'edit' && editTask ? editTask.id : `temp-${Date.now()}`;
      
      setUploadingTask({ id: taskId, progress: 10, preview: URL.createObjectURL(file), isVideo: file.type.startsWith('video/') });
      
      const publicUrl = await uploadCalendarAsset(taskId, file, (progress) => {
        setUploadingTask(prev => prev ? { ...prev, progress } : null);
      });
      
      setUploadingTask({ id: taskId, progress: 100, success: true, preview: URL.createObjectURL(file), isVideo: file.type.startsWith('video/') });
      setTimeout(() => setUploadingTask(null), 2000);
      
      if (target === 'add') {
        setForm(f => ({ ...f, imageUrl: f.imageUrl || publicUrl, images: [...(f.images || []), publicUrl] }));
      } else if (editTask) {
        const newImages = [...(editTask.images || []), publicUrl];
        const newCover = editTask.imageUrl || publicUrl;
        updateCalendarTask(editTask.id, { images: newImages, imageUrl: newCover });
        setEditTask(prev => prev ? { ...prev, images: newImages, imageUrl: newCover } : null);
      }
    } catch (err) {
      setUploadingTask(null);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addDate) {
      toast.error('Data não selecionada');
      return;
    }
    
    try {
      const finalClientName = form.clientName || client?.name || 'Cliente';
      await addCalendarTask({ ...form, clientName: finalClientName, date: addDate, imageUrl: form.imageUrl || undefined, calendarClientId: clientId! });
      setShowAddDialog(false);
      toast.success('Task criada com sucesso!');
    } catch (err) {
      console.error('Error creating task:', err);
    }
  };

  const handleEditSave = async (field: string, value: any) => {
    if (!editTask) return;
    await updateCalendarTask(editTask.id, { [field]: value } as any);
    setEditTask(prev => prev ? { ...prev, [field]: value } : null);
  };

  // Drag and drop actions for entire task card
  const handleDayDrop = async (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) {
      await updateCalendarTask(taskId, { date: dateStr } as any);
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
      const publicUrl = await uploadCalendarAsset(taskId, file, (progress) => {
        setUploadingTask(prev => prev ? { ...prev, progress } : null);
      });
      const targetTask = calendarTasks.find(t => t.id === taskId);
      const existingImages = targetTask?.images || [];
      const newImages = [...existingImages, publicUrl];
      const newCoverUrl = targetTask?.imageUrl || publicUrl;
      await updateCalendarTask(taskId, { imageUrl: newCoverUrl, images: newImages } as any);
      
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

  const handleDuplicate = async (taskId: string, targetDate: string, targetClientId: string) => {
    const task = calendarTasks.find(t => t.id === taskId);
    if (!task) return;
    const { id, ...baseTask } = task;
    const newTask = await addCalendarTask({
      ...baseTask,
      images: [...(baseTask.images || [])],
      imageUrl: baseTask.imageUrl,
      date: targetDate,
      calendarClientId: targetClientId,
      status: 'pendente'
    });

    if (newTask && baseTask.images && baseTask.images.length > 0) {
      let newImages: string[] = [];
      let newCoverUrl: string | undefined = undefined;
      
      for (const img of baseTask.images) {
        if (img.includes('kanban_assets/calendar/')) {
          const urlParts = img.split('kanban_assets/');
          if (urlParts.length > 1) {
            const oldPath = urlParts[1];
            const fileName = oldPath.split('/').pop() || 'image.png';
            const newPath = `calendar/${newTask.id}/${Date.now()}-${fileName}`;
            await supabase.storage.from('kanban_assets').copy(oldPath, newPath);
            const { data: { publicUrl } } = supabase.storage.from('kanban_assets').getPublicUrl(newPath);
            newImages.push(publicUrl);
            if (baseTask.imageUrl === img) newCoverUrl = publicUrl;
          }
        } else {
          newImages.push(img);
          if (baseTask.imageUrl === img) newCoverUrl = img;
        }
      }
      
      if (newImages.length > 0) {
         await updateCalendarTask(newTask.id, { images: newImages, imageUrl: newCoverUrl });
      }
    }
  };

  const executeAction = async () => {
    if (!actionDialog) return;
    if (actionDialog.type === 'move_date' && actionDate) {
      await updateCalendarTask(actionDialog.taskId, { date: actionDate } as any);
    } else if (actionDialog.type === 'copy_task') {
      await handleDuplicate(actionDialog.taskId, actionDate, actionClientId);
    }
    setActionDialog(null);
  };

  const getTypeColor = (type: string) => typeColors[type] || typeColors['Outro'];

  // Handler para enviar card do calendário para o Kanban
  const handleSendToKanban = async () => {
    if (!editTask || !sendToKanbanEmployeeId) return;
    setIsSendingToKanban(true);
    try {
      // Find employee's final column key ("aprovado-programar")
      const empCols = kanbanColumns.filter(c => c.employeeId === sendToKanbanEmployeeId);
      const targetCol = empCols.find(c => 
        c.columnKey.includes('aprovado') || 
        c.columnKey.includes('programar') ||
        c.title.toLowerCase().includes('aprovado')
      )?.columnKey || 'aprovado-programar';

      const newCardId = await addKanbanCard({
        clientName: editTask.clientName || 'Demanda do Calendário',
        calendarClientId: editTask.calendarClientId || clientId || undefined,
        calendarClientName: client?.name || undefined,
        description: editTask.content || editTask.description || '',
        images: editTask.images || [],
        imageUrl: editTask.imageUrl || undefined,
        column: targetCol,
        timeSpent: 0,
        timerRunning: false,
        employeeId: sendToKanbanEmployeeId,
        source: 'manual',
        originalMessage: editTask.content || editTask.description || ''
      });

      if (newCardId) {
        // Link new card ID to calendar task & mark status as approved
        await updateCalendarTask(editTask.id, { 
          status: 'aprovado-programar',
          linked_card_id: newCardId 
        } as any);

        setEditTask(prev => prev ? { ...prev, status: 'aprovado-programar', linked_card_id: newCardId } : null);

        // Copy images if needed
        if (editTask.images && editTask.images.length > 0) {
          let newImages: string[] = [];
          let newCoverUrl: string | undefined = undefined;
          
          for (const img of editTask.images) {
            if (img.includes('kanban_assets/calendar/')) {
              const urlParts = img.split('kanban_assets/');
              if (urlParts.length > 1) {
                const oldPath = urlParts[1];
                const fileName = oldPath.split('/').pop() || 'image.png';
                const newPath = `${newCardId}/${Date.now()}-${fileName}`;
                await supabase.storage.from('kanban_assets').copy(oldPath, newPath);
                const { data: { publicUrl } } = supabase.storage.from('kanban_assets').getPublicUrl(newPath);
                newImages.push(publicUrl);
                if (editTask.imageUrl === img) newCoverUrl = publicUrl;
              }
            } else {
              newImages.push(img);
              if (editTask.imageUrl === img) newCoverUrl = img;
            }
          }
          
          if (newImages.length > 0) {
             await updateKanbanCard(newCardId, { images: newImages, imageUrl: newCoverUrl });
          }
        }

        toast.success('Card criado com sucesso no Kanban! → Aprovado e Programar');
      }

      setShowSendToKanban(false);
      setSendToKanbanEmployeeId('');
    } catch (err: any) {
      console.error('Erro ao enviar para Kanban:', err);
      toast.error(`Erro ao enviar para Kanban: ${err?.message || 'Erro desconhecido'}`);
    } finally {
      setIsSendingToKanban(false);
    }
  };

  // Funções de navegação Anterior/Próximo
  const sortedMonthTasks = calendarTasks
    .filter(t => t.calendarClientId === clientId && t.date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`))
    .sort((a, b) => a.date.localeCompare(b.date));

  const handlePrevTask = () => {
    if (!editTask) return;
    const currentIndex = sortedMonthTasks.findIndex(t => t.id === editTask.id);
    if (currentIndex > 0) {
      setEditTask(sortedMonthTasks[currentIndex - 1]);
    }
  };

  const handleNextTask = () => {
    if (!editTask) return;
    const currentIndex = sortedMonthTasks.findIndex(t => t.id === editTask.id);
    if (currentIndex < sortedMonthTasks.length - 1 && currentIndex !== -1) {
      setEditTask(sortedMonthTasks[currentIndex + 1]);
    }
  };

  const handleSaveAdjustments = async (url: string, adjustments: any, format: string) => {
    if (!adjustmentModalData) return;
    const { task } = adjustmentModalData;
    try {
      const currentAdjs = task.image_adjustments || {};
      const newAdjs = {
        ...currentAdjs,
        [url]: {
          ...(currentAdjs[url] || {}),
          [format]: adjustments
        }
      };

      let newContentType = task.contentType || '';
      if (format === 'story') newContentType = 'Stories';
      else if (format === 'reels') newContentType = 'Reels';
      else if (format === 'feed_square') newContentType = 'Feed Quadrado';
      else if (format === 'feed_vertical') newContentType = 'Feed Vertical';
      else if (format === 'carousel') newContentType = 'Carrossel';

      // Atualiza o banco de forma silenciosa e em background, se não for uma task temporária (nova)
      if (task.id !== 'temp') {
        supabase
          .from('calendar_tasks')
          .update({
            image_adjustments: newAdjs,
            content_type: newContentType
          })
          .eq('id', task.id)
          .then(({ error }) => {
            if (error) console.error('Silent update error:', error);
          });
      }

      // Atualiza o estado visual instantaneamente sem recarregar a tela
      if (task.id === 'temp') {
        setForm(prev => ({
          ...prev,
          image_adjustments: newAdjs,
          contentType: newContentType
        }));
      } else if (editTask?.id === task.id) {
        setEditTask({
          ...editTask,
          image_adjustments: newAdjs,
          contentType: newContentType
        });
      }
      
      setAdjustmentModalData(null);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar ajustes');
    }
  };

  const handleDownload = async (url: string) => {
    try {
      toast.success('Iniciando download...', { duration: 2000 });
      let finalUrl = url;
      
      if (editTask?.image_adjustments && editTask.image_adjustments[url]) {
         const typeStr = editTask.contentType?.toLowerCase() || '';
         let formatToUse = 'feed_vertical';
         let ratio = 4/5;
         
         if (typeStr.includes('stor')) { formatToUse = 'story'; ratio = 9/16; }
         else if (typeStr.includes('reel') || typeStr.includes('vídeo')) { formatToUse = 'reels'; ratio = 9/16; }
         else if (typeStr.includes('quadrado')) { formatToUse = 'feed_square'; ratio = 1; }
         else if (typeStr.includes('carrossel')) { formatToUse = 'carousel'; ratio = 4/5; }
         
         const adj = editTask.image_adjustments[url][formatToUse];
         if (adj) {
            toast.info('Aplicando formato e enquadramento...', { duration: 2000 });
            finalUrl = await applyImageAdjustment(url, adj, ratio);
         }
      }

      const response = await fetch(finalUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      const filename = url.split('/').pop()?.split('?')[0] || 'imagem.png';
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Error downloading image:', error);
      toast.error('Erro ao baixar a imagem.');
    }
  };

  return (
    <div className="min-h-screen gradient-bg">
      {/* Header */}
      <div className="page-header sticky top-0 z-50">
        <div className="flex items-center gap-4 px-6 py-3.5">
          <Button variant="ghost" size="icon" onClick={() => navigate('/calendario')} className="hover:bg-secondary rounded-xl">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
             {client.logoUrl ? (
               <img src={client.logoUrl} className="w-9 h-9 rounded-full object-cover border border-white/10" alt="" />
             ) : (
               <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs shrink-0">
                 {client.name.substring(0, 2).toUpperCase()}
               </div>
             )}
             <div>
               <h1 className="text-lg font-bold text-foreground">{client.name}</h1>
               <p className="text-[11px] text-muted-foreground">Calendário de conteúdo</p>
             </div>
          </div>
          
          <div className="flex items-center gap-4 border-l border-white/10 pl-4 ml-4">
             <span className="text-[10px] font-medium text-zinc-500">Pasta:</span>
             <DropdownMenu>
               <DropdownMenuTrigger asChild>
                 <button className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors group min-w-[160px]">
                   <Folder className="w-3.5 h-3.5 text-red-500 opacity-80" />
                   <span className="text-[11px] font-medium text-zinc-300 flex-1 text-left truncate">
                     {client.name}
                   </span>
                   <ChevronDown className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                 </button>
               </DropdownMenuTrigger>
               <DropdownMenuContent align="start" className="w-[220px] bg-[#161618] border-white/10 rounded-xl p-1.5 shadow-2xl max-h-[350px] overflow-y-auto custom-scrollbar">
                 <DropdownMenuLabel className="text-[10px] font-semibold text-zinc-500 px-2 py-1.5">Selecionar Pasta</DropdownMenuLabel>
                 <DropdownMenuSeparator className="bg-white/10 my-1" />
                 {[...calendarClients].filter(c => {
                   if (loggedUserRole === 'GUEST' && loggedUserClientLink) {
                     return loggedUserClientLink.split(',').includes(c.id);
                   }
                   return true;
                 }).sort((a, b) => a.name.localeCompare(b.name)).map(c => (
                   <DropdownMenuItem 
                     key={c.id} 
                     onClick={() => navigate(`/calendario/${c.id}`)}
                     className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${client.id === c.id ? 'bg-red-500/10 text-red-500' : 'text-zinc-400 hover:bg-white/10 hover:text-zinc-200'}`}
                   >
                     <Folder className={`w-3.5 h-3.5 ${client.id === c.id ? 'text-red-500' : 'opacity-60'}`} />
                     <span className="text-[11px] font-medium flex-1 truncate">{c.name}</span>
                     {client.id === c.id && <Check className="w-3.5 h-3.5 text-red-500" />}
                   </DropdownMenuItem>
                 ))}
               </DropdownMenuContent>
             </DropdownMenu>
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
            {(viewMode === 'calendar' || viewMode === 'weekly') && (
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
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-3 text-[10px] uppercase font-bold rounded-lg border-white/10 bg-white/5 hover:bg-white/10 text-white"
                onClick={() => setShowDuplicateDialog(true)}
              >
                <CopyPlus className="w-3.5 h-3.5 mr-1.5" />
                Duplicar Calendário
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={isRefreshing}
                className="h-7 px-3 text-[10px] uppercase font-bold rounded-lg text-white/50 hover:text-primary hover:bg-white/5"
                onClick={handleManualRefresh}
              >
                <RefreshCw className={`w-3 h-3 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>

            {/* Status Filter Control: All | Overdue/Pending | Completed */}
            <div className="flex bg-[#121214] rounded-xl p-0.5 gap-0.5 border border-white/10">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-lg uppercase tracking-wider transition-all ${
                  statusFilter === 'all' ? 'bg-white/20 text-white shadow-md' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('pending_overdue')}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-lg uppercase tracking-wider transition-all flex items-center gap-1 ${
                  statusFilter === 'pending_overdue' ? 'bg-red-600 text-white shadow-md' : 'text-zinc-400 hover:text-white'
                }`}
              >
                🔴 Atrasados/Pendentes
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('completed')}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-lg uppercase tracking-wider transition-all flex items-center gap-1 ${
                  statusFilter === 'completed' ? 'bg-emerald-600 text-white shadow-md' : 'text-zinc-400 hover:text-white'
                }`}
              >
                🟢 Concluídos
              </button>
            </div>
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
                variant={viewMode === 'weekly' ? 'default' : 'ghost'}
                className={`h-7 px-3 text-xs rounded-lg ${viewMode === 'weekly' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
                onClick={() => setViewMode('weekly')}
              >
                <LayoutList className="w-3.5 h-3.5 mr-1" />
                Semanal
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
              const rawTasks = cell.isCurrentMonth ? getTasksForDate(cell.dateStr) : [];
              const tasks = rawTasks.filter(task => {
                const statusInfo = getCalendarTaskStatus(task, kanbanCards);
                if (statusFilter === 'pending_overdue') {
                  return statusInfo.statusType === 'overdue' || statusInfo.statusType === 'pending' || statusInfo.statusType === 'in_progress';
                }
                if (statusFilter === 'completed') {
                  return statusInfo.statusType === 'completed';
                }
                return true;
              });

              const isToday = cell.dateStr === todayStr && cell.isCurrentMonth;

              return (
                <div
                  key={i}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => handleDayDrop(e, cell.dateStr)}
                  className={`min-h-[140px] rounded-[1.25rem] p-3 transition-all duration-300 group relative flex flex-col border
                    ${!cell.isCurrentMonth ? 'bg-transparent border-transparent opacity-30' : 'bg-[#121214] border-white/5 hover:bg-[#161618] hover:border-white/10'}
                    ${isToday ? 'ring-1 ring-inset ring-emerald-500/30 shadow-[inset_0_0_20px_rgba(16,185,129,0.05)]' : ''}
                  `}
                >
                  <div className="flex items-center justify-between mb-3 pl-1">
                    <span className={`text-[12px] font-bold flex items-center justify-center
                      ${isToday ? 'text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-md' : 'text-white/40'}
                    `}>
                      {cell.day}
                    </span>
                    {cell.isCurrentMonth && (
                      <button
                        onClick={() => openAdd(cell.dateStr)}
                        className="w-6 h-6 flex items-center justify-center rounded-md bg-white/5 text-white/40 opacity-0 group-hover:opacity-100 transition-all hover:bg-white/10 hover:text-white"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-2 flex-1 pr-1">
                    {tasks.map(task => {
                      const statusInfo = getCalendarTaskStatus(task, kanbanCards);
                      return (
                        <ContextMenu key={task.id}>
                          <ContextMenuTrigger asChild>
                            <div
                              draggable
                              onDragStart={(e) => e.dataTransfer.setData('taskId', task.id)}
                              onDragOver={(e) => handleCardDragOver(e, task.id)}
                              onDragLeave={(e) => { if(e.dataTransfer.types.includes('Files')) setDragOverCardId(null) }}
                              onDrop={(e) => handleCardDrop(e, task.id)}
                              className={`relative group/task mb-2 block rounded-xl transition-all ${dragOverCardId === task.id ? 'ring-2 ring-[#8B5CF6] scale-[1.02] z-10' : ''}`}
                            >
                              <div
                                onClick={() => setEditTask(task)}
                                className={`w-full text-left rounded-xl border transition-all cursor-pointer shadow-lg group/card flex flex-col gap-1.5 relative overflow-hidden p-2.5
                                  ${dragOverCardId === task.id ? 'ring-2 ring-[#8B5CF6] scale-[1.02] z-10' : ''}
                                  hover:brightness-125 hover:border-white/20 transition-all
                                  ${
                                    statusInfo.statusType === 'completed' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-100' :
                                    statusInfo.statusType === 'overdue' ? 'bg-red-950/40 border-red-500/60 text-red-100 ring-1 ring-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]' :
                                    statusInfo.statusType === 'in_progress' ? 'bg-amber-500/10 border-amber-500/30 text-amber-100' :
                                    'bg-[#1C1C1E] border-white/5 text-white/90 hover:bg-[#252528]'
                                  }
                                `}
                              >
                                {/* Borda lateral colorida baseada no status */}
                                <div className={`absolute left-0 top-0 bottom-0 w-[4px] rounded-l-xl shadow-[2px_0_10px_rgba(0,0,0,0.5)] ${
                                  statusInfo.statusType === 'completed' ? 'bg-emerald-500' :
                                  statusInfo.statusType === 'overdue' ? 'bg-red-500 animate-pulse' :
                                  statusInfo.statusType === 'in_progress' ? 'bg-amber-500' :
                                  'bg-zinc-600'
                                }`} />

                                <span className="text-[11px] font-bold truncate leading-tight block uppercase tracking-wide pl-1">{task.clientName}</span>
                                
                                <div className="flex items-center justify-between flex-wrap gap-1 pl-1">
                                  <span className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded border ${getTypeColor(task.contentType)}`}>
                                    {task.contentType}
                                  </span>
                                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${statusInfo.badgeBg} ${statusInfo.badgeText} border ${statusInfo.badgeBorder}`}>
                                    {statusInfo.isOverdue ? '🔴 ATRASADO' : statusInfo.statusType === 'completed' ? '🟢 APROVADO' : statusInfo.statusType === 'in_progress' ? '🟡 EM PRODUÇÃO' : '⚪ PENDENTE'}
                                  </span>
                                </div>
                              </div>
                            <div className="absolute z-[100] bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-[#0f0f11] border border-white/10 rounded-2xl shadow-2xl opacity-0 scale-95 pointer-events-none group-hover/task:opacity-100 group-hover/task:scale-100 transition-all duration-200 origin-bottom flex flex-col overflow-hidden">
                              {task.imageUrl && (
                                <div className="h-32 w-full bg-black/50 relative overflow-hidden border-b border-white/5">
                                  {isVideoUrl(task.imageUrl) ? <video src={task.imageUrl} className="w-full h-full object-cover" controls /> : <img src={task.imageUrl} alt="" className="w-full h-full object-cover" />}
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
                        <ContextMenuContent className="w-56 bg-[#161618] border-white/5 rounded-xl shadow-2xl p-1">
                          <ContextMenuItem onClick={() => { setActionDate(task.date); setActionClientId(task.calendarClientId || ''); setActionDialog({ type: 'copy_task', taskId: task.id })}} className="gap-2.5 cursor-pointer rounded-lg focus:bg-white/10 focus:text-white py-2 text-xs"><CopyPlus className="w-3.5 h-3.5"/> Duplicar Card</ContextMenuItem>
                          <ContextMenuItem onClick={() => { setActionDate(task.date); setActionDialog({ type: 'move_date', taskId: task.id })}} className="gap-2.5 cursor-pointer rounded-lg focus:bg-white/10 focus:text-white py-2 text-xs"><ArrowRightLeft className="w-3.5 h-3.5"/> Mover para outro dia</ContextMenuItem>
                          <ContextMenuSeparator className="bg-white/10 my-1" />
                          <ContextMenuItem onClick={() => setEditTask(task)} className="gap-2.5 cursor-pointer rounded-lg focus:bg-white/10 focus:text-white py-2 text-xs"><Edit className="w-3.5 h-3.5"/> Editar</ContextMenuItem>
                          <ContextMenuItem onClick={() => setDeleteConfirm(task.id)} className="gap-2.5 cursor-pointer rounded-lg text-red-500 focus:bg-red-500/20 focus:text-red-500 py-2 text-xs"><Trash2 className="w-3.5 h-3.5"/> Excluir</ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        )}

        {/* Weekly Summary View */}
        {viewMode === 'weekly' && (() => {
          const weeks = [];
          for (let i = 0; i < cells.length; i += 7) {
            const weekCells = cells.slice(i, i + 7);
            const weekTasks = weekCells.flatMap(c => c.isCurrentMonth ? getTasksForDate(c.dateStr) : []);
            if (weekTasks.length > 0 || weekCells.some(c => c.isCurrentMonth)) {
              weeks.push({
                index: Math.floor(i / 7) + 1,
                cells: weekCells,
                tasks: weekTasks,
                start: weekCells[0].dateStr,
                end: weekCells[6].dateStr
              });
            }
          }

          return (
            <div className="space-y-6 pb-10">
              {weeks.map(week => (
                <div key={week.index} className="bg-[#1C1C1E] border border-white/5 rounded-[2rem] p-8 shadow-xl">
                  <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-6">
                    <div>
                      <h3 className="font-bold text-xl text-white italic tracking-tight">Semana {week.index}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(week.start).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })} até {new Date(week.end).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-6">
                       <div className="text-right flex flex-col items-end">
                         <div className="flex items-center gap-2">
                           <span className="font-black text-3xl text-red-600 tabular-nums tracking-tighter">{week.tasks.length}</span>
                           <CheckCircle2 className="w-5 h-5 text-red-600" />
                         </div>
                         <span className="text-[10px] uppercase font-black text-white/30 tracking-[0.2em]">Produções</span>
                       </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                    {week.tasks.map(task => (
                      <div 
                        key={task.id} 
                        className="aspect-[4/5] relative group bg-[#0f0f11] rounded-2xl overflow-hidden cursor-pointer border border-white/5 hover:border-red-500/50 transition-all duration-300 shadow-lg"
                        onClick={() => setEditTask(task)}
                      >
                         {task.imageUrl ? (
                           isVideoUrl(task.imageUrl) ? <video src={task.imageUrl} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" controls /> : <img src={task.imageUrl} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                         ) : (
                           <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center opacity-20 group-hover:opacity-40 transition-opacity">
                              <ImageIcon className="w-6 h-6 mb-1.5" />
                              <span className="text-[9px] uppercase font-black tracking-widest">{task.contentType || 'Card'}</span>
                           </div>
                         )}
                         
                         <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-center transform translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                            <span className="text-[8px] font-black text-white uppercase tracking-tighter">Ver agora</span>
                         </div>
                      </div>
                    ))}
                    {week.tasks.length === 0 && (
                      <div className="col-span-full py-12 flex flex-col items-center justify-center opacity-20 border-2 border-dashed border-white/5 rounded-2xl">
                        <CalendarDays className="w-8 h-8 mb-2" />
                        <p className="text-xs font-bold uppercase tracking-widest">Nenhuma tarefa agendada</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Feed grid view */}
        {viewMode === 'feed' && (() => {
          const feedTasks = clientTasks
            .filter(t => t.imageUrl && t.date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`))
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 w-full pb-10">
              {feedTasks.map(task => (
                <div 
                  key={task.id} 
                  className="aspect-[4/5] relative group bg-[#1C1C1E] border border-white/5 rounded-2xl overflow-hidden cursor-pointer shadow-xl hover:ring-2 hover:ring-red-500/50 transition-all duration-300"
                  onClick={() => setEditTask(task)}
                >
                  <img 
                    src={task.imageUrl!} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                    loading="lazy" 
                    alt=""
                  />
                  
                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4 backdrop-blur-[1px]">
                    <div className="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                      <span className="text-[10px] font-black bg-red-600 text-white px-2 py-0.5 rounded-md uppercase tracking-widest mb-2 inline-block">
                        {task.status || 'Pendente'}
                      </span>
                      <h3 className="text-sm font-bold text-white uppercase truncate">{task.clientName}</h3>
                      <p className="text-[10px] text-white/60 font-medium">{task.date.split('-').reverse().join('/')}</p>
                    </div>
                  </div>

                  {/* Icon indicators */}
                  <div className="absolute top-3 right-3 flex gap-1.5 opacity-60">
                    <div className="w-6 h-6 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10">
                      <Grid3X3 className="w-3 h-3 text-white" />
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
        <DialogContent className="bg-transparent border-none text-white max-w-[1300px] w-[95vw] p-0 shadow-none h-[min(800px,85vh)] [&>button.absolute]:hidden">
          <div className="w-full h-full flex relative min-h-0">
            {/* Main Modal wrapper */}
            <div className="flex w-full h-full bg-[#121214] border border-white/5 rounded-2xl overflow-hidden shadow-2xl relative z-20 min-h-0">
              {/* Left Column - Clean Media Preview */}
              <div className="w-[480px] bg-[#0c0c0e] border-r border-white/5 flex flex-col p-6 shrink-0 h-full relative min-h-0">
                 {/* Top header on left */}
                 <div className="flex items-center justify-between mb-4">
                   <div className="flex items-center gap-3">
                     <div className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center text-[10px] font-bold border border-white/10">
                       {(form.clientName || 'NO').substring(0,2).toUpperCase()}
                     </div>
                     <span className="font-bold text-[13px] tracking-wider uppercase text-white/90">{form.clientName || 'Novo Post'}</span>
                   </div>
                   <div className="flex items-center gap-2 text-[10px] font-bold text-white/40 uppercase bg-white/5 px-2.5 py-1.5 rounded-full border border-white/5">
                     <CalendarDays className="w-3 h-3" />
                     {new Date(`${addDate}T12:00:00`).toLocaleDateString('pt-BR')}
                   </div>
                 </div>

                 {/* Main Image View */}
                <div className="w-full flex-1 flex items-center justify-center overflow-hidden">
                  {form.imageUrl ? (
                    <div className="relative w-full h-full flex-shrink-0 flex items-center justify-center">
                      <div 
                        className="relative max-h-full rounded-2xl overflow-hidden bg-[#161618] border border-white/5 shadow-inner flex items-center justify-center group"
                        style={{
                          height: '100%',
                          aspectRatio: (form.contentType?.toLowerCase() || '').includes('stor') || (form.contentType?.toLowerCase() || '').includes('reel') ? '9/16' :
                                       (form.contentType?.toLowerCase() || '').includes('quadrado') ? '1/1' : '4/5'
                        }}
                      >
                      {(() => {
                        const typeStr = form.contentType?.toLowerCase() || '';
                        let formatToUse = 'feed_vertical';
                        if (typeStr.includes('stor')) formatToUse = 'story';
                        else if (typeStr.includes('reel') || typeStr.includes('vídeo')) formatToUse = 'reels';
                        else if (typeStr.includes('quadrado')) formatToUse = 'feed_square';
                        else if (typeStr.includes('carrossel')) formatToUse = 'carousel';

                        const adj = form.image_adjustments?.[form.imageUrl!]?.[formatToUse] || {
                          mode: 'fit',
                          fillType: 'blur',
                          fillColor: '#000000',
                          zoom: 1,
                          x: 0,
                          y: 0
                        };

                        return (
                          <div className="absolute inset-0 w-full h-full" style={{
                            backgroundColor: adj.fillType === 'blur' ? '#000' : adj.fillType === 'white' ? '#FFF' : adj.fillType === 'color' ? adj.fillColor : '#000'
                          }}>
                            {adj.mode === 'fit' && adj.fillType === 'blur' && (
                              <div 
                                className="absolute inset-0 bg-cover bg-center blur-xl opacity-50 scale-110"
                                style={{ backgroundImage: `url(${form.imageUrl})` }}
                              />
                            )}
                            <div className="absolute inset-0 w-full h-full overflow-hidden flex items-center justify-center">
                              <img 
                                src={form.imageUrl!} 
                                className="w-full h-full"
                                style={{
                                  objectFit: adj.mode === 'fit' ? 'contain' : 'cover',
                                  transform: `translate(${(adj.x || 0) * 100}%, ${(adj.y || 0) * 100}%) scale(${adj.zoom || 1})`
                                }}
                              />
                            </div>
                          </div>
                        );
                      })()}
                      
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          const newImg = form.images.filter(img => img !== form.imageUrl);
                          const newCover = newImg[0] || '';
                          setForm(f => ({ ...f, images: newImg, imageUrl: newCover }));
                        }}
                        className="absolute top-4 right-4 w-10 h-10 bg-red-600/90 hover:bg-red-600 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all shadow-xl backdrop-blur-md z-10"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>

                       {form.images && form.images.length > 1 && (
                         <>
                           <button 
                             type="button"
                             onClick={(e) => {
                               e.preventDefault();
                               e.stopPropagation();
                               const actualIndex = form.images!.indexOf(form.imageUrl!);
                               const newIndex = actualIndex === 0 ? form.images!.length - 1 : actualIndex - 1;
                               setForm({ ...form, imageUrl: form.images![newIndex] });
                             }}
                             className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/80 rounded-full flex items-center justify-center text-white backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 shadow-xl"
                           >
                             <ChevronLeft className="w-5 h-5" />
                           </button>
                           <button 
                             type="button"
                             onClick={(e) => {
                               e.preventDefault();
                               e.stopPropagation();
                               const actualIndex = form.images!.indexOf(form.imageUrl!);
                               const newIndex = (actualIndex + 1) % form.images!.length;
                               setForm({ ...form, imageUrl: form.images![newIndex] });
                             }}
                             className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/80 rounded-full flex items-center justify-center text-white backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 shadow-xl"
                           >
                             <ChevronRight className="w-5 h-5" />
                           </button>
                         </>
                       )}
                      </div>
                    </div>
                   ) : (
                     <div className="text-white/20 flex flex-col items-center justify-center text-center">
                        <ImageIcon className="w-12 h-12 mb-3 opacity-50" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Nenhuma mídia anexada</span>
                     </div>
                   )}
                 </div>

                 {/* Interaction Footer on left */}
                 <div className="mt-4 flex items-center justify-between shrink-0 bg-[#161618] rounded-xl p-2 border border-white/5">
                    <div className="flex items-center gap-1">
                      <button 
                        className="w-10 h-10 rounded-lg hover:bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-colors"
                        onClick={(e) => { e.preventDefault(); fileInputRef.current?.click(); }}
                      >
                        <Upload className="w-5 h-5" />
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'add')} />
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={(e) => { e.preventDefault(); form.imageUrl && setAdjustmentModalData({ task: { ...form, id: 'temp' } as any, currentImageUrl: form.imageUrl }); }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${form.imageUrl ? 'bg-zinc-800 text-white hover:bg-zinc-700' : 'bg-zinc-900 text-zinc-600 cursor-not-allowed'}`}
                        disabled={!form.imageUrl}
                      >
                        <Settings className="w-4 h-4" /> Formato e Redes
                      </button>
                    </div>
                 </div>
              </div>

              {/* Right Column - Premium Form */}
              <div className="flex-1 bg-[#121214] flex flex-col h-full relative min-h-0">
                 <div className="flex items-center justify-between px-8 py-5 border-b border-white/5 bg-[#121214] shrink-0">
                    <h2 className="text-xl font-bold text-white flex items-center gap-3">
                       <div className="w-8 h-8 rounded-full bg-red-600/10 flex items-center justify-center border border-red-500/20">
                         <PenTool className="w-4 h-4 text-red-500" />
                       </div>
                       Criar Novo Post
                    </h2>
                    <button onClick={() => setShowAddDialog(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 text-white transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                 </div>

                 <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8 custom-scrollbar">
                   {/* Fields */}
                   <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-white/50 uppercase tracking-wider ml-1">Cliente / Nome</label>
                          <Input 
                            value={form.clientName}
                            onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))}
                            placeholder="Nome do cliente..."
                            className="h-12 bg-[#1C1C1E] border-white/5 focus-visible:ring-red-500 rounded-xl"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-white/50 uppercase tracking-wider ml-1">Formato Principal</label>
                          <Select value={form.contentType} onValueChange={v => setForm(f => ({ ...f, contentType: v }))}>
                            <SelectTrigger className="h-12 bg-[#1C1C1E] border-white/5 focus:ring-red-500 rounded-xl text-white">
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent className="bg-[#252528] border-white/10 text-white rounded-xl">
                              {CONTENT_TYPES.map(t => <SelectItem key={t} value={t} className="focus:bg-white/10 focus:text-white rounded-lg">{t}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-white/50 uppercase tracking-wider ml-1">Legenda da Postagem</label>
                        <Textarea 
                          value={form.description}
                          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                          placeholder="Escreva a legenda maravilhosa deste post..."
                          className="min-h-[160px] bg-[#1C1C1E] border-white/5 focus-visible:ring-red-500 rounded-xl resize-none text-[13px] leading-relaxed p-4 text-white"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-white/50 uppercase tracking-wider ml-1">Links de Referência</label>
                        <div className="grid grid-cols-3 gap-3">
                          {[0, 1, 2].map(i => (
                            <Input 
                              key={i}
                              placeholder={`Link ${i+1}...`} 
                              value={form.reference_links?.[i] || ''}
                              onChange={e => {
                                const newLinks = [...(form.reference_links || ['', '', ''])];
                                newLinks[i] = e.target.value;
                                setForm(f => ({ ...f, reference_links: newLinks }));
                              }}
                              className="h-10 bg-[#1C1C1E] border-white/5 focus-visible:ring-red-500 rounded-xl text-xs text-white"
                            />
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-white/50 uppercase tracking-wider ml-1">Status</label>
                        <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                          <SelectTrigger className="h-12 bg-[#1C1C1E] border-white/5 focus:ring-red-500 rounded-xl text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#252528] border-white/10 text-white rounded-xl">
                            <SelectItem value="pendente">Pendente</SelectItem>
                            <SelectItem value="em producao">Em Produção</SelectItem>
                            <SelectItem value="aprovado">Aprovado</SelectItem>
                            <SelectItem value="publicado">Publicado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                   </div>
                 </div>

                 {/* Bottom Action bar */}
                 <div className="p-6 bg-[#161618] border-t border-white/5 shrink-0 flex items-center justify-between">
                    <Button variant="ghost" onClick={(e) => { e.preventDefault(); setShowAddDialog(false); }} className="rounded-xl hover:bg-white/5 text-white/70">
                      Cancelar
                    </Button>
                    <Button onClick={handleAdd} className="h-12 bg-red-600 hover:bg-red-700 text-white rounded-xl px-8 font-bold text-sm shadow-xl shadow-red-900/20" disabled={!form.clientName.trim()}>
                      Criar Postagem
                    </Button>
                 </div>
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
              onClick={() => { 
                if(deleteConfirm) { 
                  deleteCalendarTask(deleteConfirm); 
                  setDeleteConfirm(null); 
                  setEditTask(null); 
                } 
              }} 
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmar Exclusão de Imagem */}
      <AlertDialog open={!!deleteImageConfirm} onOpenChange={(open) => !open && setDeleteImageConfirm(null)}>
        <AlertDialogContent className="bg-[#161618] border-white/5 text-white max-w-md rounded-3xl shadow-2xl p-6 sm:p-8">
          <AlertDialogHeader className="mb-4">
            <AlertDialogTitle className="text-xl font-bold flex flex-col items-center gap-3 text-white text-center">
              <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 mb-2">
                <Trash2 className="w-7 h-7 text-red-500" />
              </div>
              Excluir Imagem
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/60 pt-2 text-sm leading-relaxed text-center font-medium max-w-[280px] mx-auto">
              Tem certeza que deseja excluir esta imagem? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-3 border-t border-white/5 pt-6 mt-2">
            <AlertDialogCancel className="bg-[#1C1C1E] border-white/5 hover:bg-white/5 hover:text-white text-white rounded-xl h-11 w-full sm:w-1/2 font-medium transition-colors m-0 sm:m-0">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              className="bg-red-600 hover:bg-red-700 text-white rounded-xl h-11 w-full sm:w-1/2 font-bold uppercase tracking-wider text-xs m-0 sm:m-0"
              onClick={() => {
                if (!deleteImageConfirm || !editTask) return;
                const { url, index } = deleteImageConfirm;
                const newImg = index !== -1 
                  ? (editTask.images || []).filter((_, i) => i !== index)
                  : (editTask.images || []).filter(img => img !== url);
                const newCover = editTask.imageUrl === url ? (newImg[0] || '') : editTask.imageUrl;
                deleteCalendarAsset(url);
                updateCalendarTask(editTask.id, { images: newImg, imageUrl: newCover });
                setEditTask(prev => prev ? { ...prev, images: newImg, imageUrl: newCover } : null);
                setDeleteImageConfirm(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Task Detail Dialog (Premium Design) */}
      <Dialog open={!!editTask} onOpenChange={(open) => {
        if (!open) {
          setEditTask(null);
          setShowCommentsPanel(false);
        }
      }}>
        <DialogContent className="bg-transparent border-none text-white max-w-[1300px] w-[95vw] p-0 shadow-none h-[min(800px,85vh)] [&>button.absolute]:hidden">
          {editTask && (
            <div 
              className="w-full h-full flex relative min-h-0"
              onDragEnter={(e) => { 
                if(e.dataTransfer.types.includes('Files')) {
                  e.preventDefault(); 
                  setDragOverCardId(editTask.id); 
                }
              }}
              onDragOver={(e) => { 
                if(e.dataTransfer.types.includes('Files')) {
                  e.preventDefault(); 
                }
              }}
              onDrop={(e) => { 
                setDragOverCardId(null); 
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  handleDropUpload(e, 'edit'); 
                }
              }}
            >
              {/* Drag Overlay */}
              {dragOverCardId === editTask.id && !uploadingTask && (
                <div 
                  className="absolute inset-0 z-[100] bg-[#121214]/95 flex flex-col items-center justify-center backdrop-blur-md rounded-2xl border-2 border-dashed border-[#8B5CF6]"
                  onDragLeave={(e) => { 
                    e.preventDefault(); 
                    setDragOverCardId(null); 
                  }}
                  onDrop={(e) => { 
                    e.preventDefault();
                    setDragOverCardId(null); 
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      handleDropUpload(e, 'edit'); 
                    }
                  }}
                  onDragOver={(e) => e.preventDefault()}
                >
                  <div className="w-24 h-24 rounded-full bg-[#8B5CF6]/20 flex items-center justify-center mb-6 animate-bounce pointer-events-none">
                    <Upload className="w-12 h-12 text-[#8B5CF6]" />
                  </div>
                  <h3 className="text-3xl font-black text-white mb-2 uppercase tracking-tight pointer-events-none">Solte a imagem aqui</h3>
                  <p className="text-white/60 font-medium text-lg pointer-events-none">Para adicionar como mídia desta tarefa</p>
                </div>
              )}

              {/* Uploading Overlay */}
              {uploadingTask?.id === editTask.id && (
                <div className="absolute inset-0 z-[100] bg-[#121214]/95 flex flex-col items-center justify-center backdrop-blur-md rounded-2xl border border-white/10">
                  {uploadingTask.success ? (
                    <>
                      <div className="w-24 h-24 rounded-full bg-emerald-500/20 flex items-center justify-center mb-6 animate-in zoom-in">
                        <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                      </div>
                      <h3 className="text-3xl font-black text-emerald-500 mb-2 uppercase tracking-tight">Imagem Salva!</h3>
                    </>
                  ) : (
                    <>
                      <div className="w-24 h-24 relative flex items-center justify-center mb-6">
                        <svg className="animate-spin absolute inset-0 w-full h-full text-[#8B5CF6]/20" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75 text-[#8B5CF6]" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        {uploadingTask.preview && (
                          uploadingTask.isVideo ? <video src={uploadingTask.preview} className="w-16 h-16 rounded-full object-cover" controls /> : <img src={uploadingTask.preview} className="w-16 h-16 rounded-full object-cover" />
                        )}
                      </div>
                      <h3 className="text-3xl font-black text-white mb-6 uppercase tracking-tight">Enviando...</h3>
                      <div className="w-64 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-[#8B5CF6] transition-all duration-300" style={{ width: `${uploadingTask.progress}%` }} />
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Main Modal wrapper to retain borders and background */}
              <div className="flex w-full h-full bg-[#121214] border border-white/5 rounded-2xl overflow-hidden shadow-2xl relative z-20 min-h-0 pointer-events-auto">
              {/* Left Column - Clean Media Preview */}
              <div className="w-[480px] bg-[#0c0c0e] border-r border-white/5 flex flex-col p-6 shrink-0 h-full relative min-h-0">
                 {/* Top header on left */}
                 <div className="flex items-center justify-between mb-4">
                   <div className="flex items-center gap-3">
                     <div className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center text-[10px] font-bold border border-white/10">
                       {(editTask.clientName || 'CL').substring(0,2).toUpperCase()}
                     </div>
                     <span className="font-bold text-[13px] tracking-wider uppercase text-white/90">{editTask.clientName}</span>
                   </div>
                   <div className="flex items-center gap-2 text-[10px] font-bold text-white/40 uppercase bg-white/5 px-2.5 py-1.5 rounded-full border border-white/5">
                     <CalendarDays className="w-3 h-3" />
                     {new Date(`${editTask.date}T12:00:00`).toLocaleDateString('pt-BR')} às {editTask.time || '00:00'}
                   </div>
                 </div>

                 {/* Main Image View */}
                <div className="w-full flex-1 flex items-center justify-center overflow-hidden">
                  {editTask.imageUrl ? (
                    <div className="relative w-full h-full flex-shrink-0 flex items-center justify-center">
                      <div 
                        className="relative max-h-full max-w-full rounded-2xl overflow-hidden bg-[#161618] border border-white/5 shadow-inner flex items-center justify-center group shrink-0"
                        style={{
                          height: 'auto',
                          width: '100%',
                          maxHeight: '100%',
                          aspectRatio: (editTask.contentType?.toLowerCase() || '').includes('stor') || (editTask.contentType?.toLowerCase() || '').includes('reel') ? '9/16' :
                                       (editTask.contentType?.toLowerCase() || '').includes('quadrado') ? '1/1' : '4/5'
                        }}
                      >
                      {(() => {
                        const typeStr = editTask.contentType?.toLowerCase() || '';
                        let formatToUse = 'feed_vertical';
                        if (typeStr.includes('stor')) formatToUse = 'story';
                        else if (typeStr.includes('reel') || typeStr.includes('vídeo')) formatToUse = 'reels';
                        else if (typeStr.includes('quadrado')) formatToUse = 'feed_square';
                        else if (typeStr.includes('carrossel')) formatToUse = 'carousel';

                        const adj = editTask.image_adjustments?.[editTask.imageUrl!]?.[formatToUse] || {
                          mode: 'fit',
                          fillType: 'blur',
                          fillColor: '#000000',
                          zoom: 1,
                          x: 0,
                          y: 0
                        };

                        return (
                          <div className="absolute inset-0 w-full h-full" style={{
                            backgroundColor: adj.fillType === 'blur' ? '#000' : adj.fillType === 'white' ? '#FFF' : adj.fillType === 'color' ? adj.fillColor : '#000'
                          }}>
                            {adj.mode === 'fit' && adj.fillType === 'blur' && !isVideoUrl(editTask.imageUrl!) && (
                              <div 
                                className="absolute inset-0 bg-cover bg-center blur-xl opacity-50 scale-110"
                                style={{ backgroundImage: `url(${editTask.imageUrl})` }}
                              />
                            )}
                            {adj.mode === 'fit' && adj.fillType === 'blur' && isVideoUrl(editTask.imageUrl!) && (
                               <video src={editTask.imageUrl!} className="absolute inset-0 w-full h-full object-cover blur-xl opacity-50 scale-110" />
                            )}
                            <div className="absolute inset-0 w-full h-full overflow-hidden flex items-center justify-center">
                              {isVideoUrl(editTask.imageUrl!) ? (
                                <video 
                                  src={editTask.imageUrl!} 
                                  className="w-full h-full"
                                  controls
                                  style={{
                                    objectFit: adj.mode === 'fit' ? 'contain' : 'cover',
                                    transform: `translate(${(adj.x || 0) * 100}%, ${(adj.y || 0) * 100}%) scale(${adj.zoom || 1})`
                                  }}
                                />
                              ) : (
                                <img 
                                  src={editTask.imageUrl!} 
                                  className="w-full h-full"
                                  style={{
                                    objectFit: adj.mode === 'fit' ? 'contain' : 'cover',
                                    transform: `translate(${(adj.x || 0) * 100}%, ${(adj.y || 0) * 100}%) scale(${adj.zoom || 1})`
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        );
                      })()}
                      
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setDeleteImageConfirm({ url: editTask.imageUrl!, index: -1 });
                        }}
                        className="absolute top-4 right-4 w-10 h-10 bg-red-600/90 hover:bg-red-600 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all shadow-xl backdrop-blur-md z-10"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>

                       {editTask.images && editTask.images.length > 1 && (
                         <>
                           <button 
                             type="button"
                             onClick={(e) => {
                               e.preventDefault();
                               const currentIndex = editTask.images!.indexOf(editTask.imageUrl || '');
                               const actualIndex = currentIndex === -1 ? 0 : currentIndex;
                               const newIndex = (actualIndex - 1 + editTask.images!.length) % editTask.images!.length;
                               setEditTask({ ...editTask, imageUrl: editTask.images![newIndex] });
                             }}
                             className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/80 rounded-full flex items-center justify-center text-white backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 shadow-xl"
                           >
                             <ChevronLeft className="w-5 h-5" />
                           </button>
                           <button 
                             type="button"
                             onClick={(e) => {
                               e.preventDefault();
                               const currentIndex = editTask.images!.indexOf(editTask.imageUrl || '');
                               const actualIndex = currentIndex === -1 ? 0 : currentIndex;
                               const newIndex = (actualIndex + 1) % editTask.images!.length;
                               setEditTask({ ...editTask, imageUrl: editTask.images![newIndex] });
                             }}
                             className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/80 rounded-full flex items-center justify-center text-white backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 shadow-xl"
                           >
                             <ChevronRight className="w-5 h-5" />
                           </button>
                         </>
                       )}
                      </div>
                    </div>
                   ) : (
                     <div className="text-white/20 flex flex-col items-center justify-center text-center">
                        <ImageIcon className="w-12 h-12 mb-3 opacity-50" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Nenhuma mídia anexada</span>
                     </div>
                   )}
                 </div>
              </div>

              {/* Right Column - Editor */}
              <div className="flex-1 flex flex-col bg-[#161618] h-full relative min-h-0">
                 {/* Custom Tabs and Top Actions */}
                   <div className="flex items-center justify-between mb-6 gap-6 flex-wrap p-8 pb-0">
                     <div className="flex gap-2 flex-1 min-w-[350px]">
                        {['Tema', 'Conteúdos', 'Mídia', 'Legenda'].map(tab => {
                          const isActive = activeTab === (tab === 'Conteúdos' ? 'Conteúdo' : tab);
                          return (
                            <button
                              key={tab}
                              onClick={() => setActiveTab(tab === 'Conteúdos' ? 'Conteúdo' : tab as any)}
                              className={`flex-1 relative py-3 px-4 rounded-xl flex flex-col items-center justify-center gap-1 transition-all
                                ${isActive ? 'bg-[#1C1C1E] text-white' : 'text-white/40 hover:text-white hover:bg-white/5'}
                              `}
                            >
                              <span className="text-[13px] font-bold tracking-wide">{tab}</span>
                              <span className={`text-[9px] font-bold uppercase tracking-widest ${editTask.status?.toLowerCase() === 'aprovado' || editTask.status?.toLowerCase() === 'aprovado-programar' ? 'text-emerald-400' : 'text-white/30'}`}>
                                {editTask.status?.toLowerCase() === 'aprovado' || editTask.status?.toLowerCase() === 'aprovado-programar' ? 'Aprovado' : 'Pendente'}
                              </span>
                              
                              {isActive && (
                                <div className="absolute inset-0 rounded-xl border border-[#8B5CF6]/30 shadow-[0_0_15px_rgba(139,92,246,0.15)] pointer-events-none" />
                              )}
                            </button>
                          )
                        })}
                     </div>
                      <Button 
                        onClick={() => {
                          if (editTask) {
                            updateCalendarTask(editTask.id, editTask);
                          }
                          setEditTask(null);
                        }} 
                        className="h-12 px-6 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all shrink-0 ml-auto"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" /> Salvar e Fechar
                      </Button>
                   </div>
                
                <div className="flex-1 p-8 overflow-y-auto custom-scrollbar pb-32 min-h-0">
                    {/* Status Real Banner */}
                    {editTask && (() => {
                      const modalStatus = getCalendarTaskStatus(editTask, kanbanCards);
                      return (
                        <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 mb-6 ${modalStatus.badgeBg} ${modalStatus.badgeBorder}`}>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-black uppercase tracking-wider ${modalStatus.badgeText}`}>
                              Status: {modalStatus.label}
                            </span>
                          </div>
                          {modalStatus.linkedCard && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setEditTask(null);
                                navigate(`/funcionario/${modalStatus.linkedCard?.employeeId}?cardId=${modalStatus.linkedCard?.id}`);
                              }}
                              className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold gap-1"
                            >
                              <Kanban className="w-3.5 h-3.5" /> Ver Card no Kanban
                            </Button>
                          )}
                        </div>
                      );
                    })()}

                   {/* Form Content */}
                   <div className="space-y-6">
                     {activeTab === 'Tema' && (
                        <div className="space-y-6 animate-in fade-in duration-500">
                           <div>
                             <label className="text-[13px] font-bold text-white/90 mb-2.5 block tracking-wide">Tema do conteúdo</label>
                             <Input 
                               value={editTask.clientName} 
                               onChange={e => setEditTask(prev => prev ? { ...prev, clientName: e.target.value } : null)} 
                               onBlur={() => handleEditSave('clientName', editTask.clientName)} 
                               className="bg-[#121214] border-white/5 rounded-xl h-12 focus-visible:ring-[#8B5CF6] text-white/90 text-sm font-medium shadow-inner" 
                             />
                           </div>
                           <div className="space-y-3">
                             <label className="text-[13px] font-bold text-white/90 mb-2.5 block tracking-wide">Links de Referências</label>
                             {['Cole o primeiro link de referência...', 'Cole o segundo link de referência...', 'Cole o terceiro link de referência...'].map((placeholder, i) => (
                               <Input 
                                 key={i}
                                 placeholder={placeholder} 
                                 value={(editTask.reference_links || ['', '', ''])[i]} 
                                 onChange={e => {
                                   const newLinks = [...(editTask.reference_links || ['', '', ''])];
                                   newLinks[i] = e.target.value;
                                   setEditTask(p => p ? { ...p, reference_links: newLinks } : null);
                                 }} 
                                 onBlur={() => handleEditSave('reference_links', editTask.reference_links || [])}
                                 className="bg-[#121214] border-white/5 rounded-xl h-12 focus-visible:ring-[#8B5CF6] text-white/90 text-[13px] placeholder:text-white/20 shadow-inner" 
                               />
                             ))}
                           </div>
                        </div>
                      )}

                     {activeTab === 'Conteúdo' && (
                        <div className="space-y-6 animate-in fade-in duration-500">
                           <div>
                             <label className="text-[13px] font-bold text-white/90 mb-2.5 block tracking-wide">Tipo de Conteúdo</label>
                             <Select value={editTask.contentType} onValueChange={v => handleEditSave('contentType', v)}>
                               <SelectTrigger className="bg-[#121214] border-white/5 rounded-xl h-12 focus:ring-[#8B5CF6] text-white/90 text-sm shadow-inner"><SelectValue placeholder="Formato" /></SelectTrigger>
                               <SelectContent className="bg-[#161618] border-white/10 text-white rounded-xl shadow-2xl">
                                 {CONTENT_TYPES.map(t => <SelectItem key={t} value={t} className="focus:bg-white/5 focus:text-white rounded-lg cursor-pointer">{t}</SelectItem>)}
                               </SelectContent>
                             </Select>
                           </div>
                           <div>
                             <label className="text-[13px] font-bold text-white/90 mb-2.5 block tracking-wide">Descrição do Conteúdo</label>
                             <Textarea 
                               placeholder="Digite o conteúdo aqui..." 
                               value={editTask.content} 
                               onChange={e => setEditTask(p => p ? { ...p, content: e.target.value } : null)} 
                               onBlur={() => handleEditSave('content', editTask.content || '')}
                               className="bg-[#121214] border-white/5 rounded-xl min-h-[250px] focus-visible:ring-[#8B5CF6] text-white/90 text-[14px] leading-relaxed p-5 shadow-inner resize-none" 
                             />
                           </div>
                        </div>
                      )}

                     {activeTab === 'Mídia' && (
                        <div className="space-y-6 animate-in fade-in duration-500">
                           <label className="text-[13px] font-bold text-white/90 mb-2.5 block tracking-wide">Arquivos de Mídia ({(editTask.images || []).length})</label>
                           
                           {(editTask.images || []).length > 0 && (
                             <div className="grid grid-cols-3 gap-4 mb-4">
                               {(editTask.images || []).map((img, idx) => (
                                 <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border border-white/5 group shadow-lg bg-[#121214]">
                                   {isVideoUrl(img) ? (
                                     <video src={img} className="w-full h-full object-cover" controls />
                                   ) : (
                                     <img src={img} className="w-full h-full object-cover" />
                                   )}
                                   <button 
                                     type="button" 
                                     onClick={() => {
                                       setDeleteImageConfirm({ url: img, index: idx });
                                     }}
                                     className="absolute top-2 right-2 w-7 h-7 bg-red-500/90 hover:bg-red-500 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all shadow-lg backdrop-blur-md z-10"
                                   >
                                     <X className="w-3.5 h-3.5" />
                                   </button>
                                   <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                      <button onClick={() => setPreviewImage(img)} type="button" className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-all backdrop-blur-md">
                                        <ZoomIn className="w-5 h-5 text-white/90" />
                                      </button>
                                      <button type="button" onClick={() => handleDownload(img)} className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-all backdrop-blur-md">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/90"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                                      </button>
                                   </div>
                                 </div>
                               ))}
                             </div>
                           )}

                           <div 
                             className="border-2 border-dashed border-white/10 rounded-2xl bg-[#121214] p-10 flex flex-col items-center justify-center text-white/50 hover:bg-[#1C1C1E] hover:border-white/20 transition-all cursor-pointer group shadow-inner"
                             onClick={() => editFileInputRef.current?.click()}
                             onDragOver={(e) => e.preventDefault()}
                             onDrop={(e) => handleDropUpload(e, 'edit')}
                           >
                             <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:bg-[#8B5CF6]/20 group-hover:text-[#8B5CF6] transition-all">
                               <Upload className="w-5 h-5" />
                             </div>
                             <span className="text-sm font-bold text-white/90 mb-1">Adicionar mais mídias</span>
                             <span className="text-xs font-medium uppercase tracking-widest opacity-60">Perfeito para carrosséis</span>
                             <input ref={editFileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={e => handleFileUpload(e, 'edit')} />
                           </div>
                        </div>
                      )}

                     {activeTab === 'Legenda' && (
                        <div className="space-y-6 animate-in fade-in duration-500">
                           <div>
                             <label className="text-[13px] font-bold text-white/90 mb-2.5 block tracking-wide">Legenda do Post</label>
                             <Textarea 
                               placeholder="Escreva a legenda incrível aqui..." 
                               value={editTask.description} 
                               onChange={e => setEditTask(p => p ? { ...p, description: e.target.value } : null)} 
                               onBlur={() => handleEditSave('description', editTask.description || '')}
                               className="bg-[#121214] border-white/5 rounded-xl min-h-[300px] focus-visible:ring-[#8B5CF6] text-white/90 text-[14px] leading-relaxed p-5 shadow-inner resize-none" 
                             />
                           </div>
                        </div>
                      )}
                   </div>
                </div>

                {/* Floating Capsule Footer */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[100] max-w-[90vw]">
                  <div className="bg-[#1a1a1c]/95 backdrop-blur-3xl border border-white/10 rounded-full p-2 flex items-center justify-center shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-x-auto custom-scrollbar flex-nowrap">
                    {/* Botão Anterior */}
                    <Button 
                      variant="ghost" 
                      onClick={handlePrevTask}
                      disabled={sortedMonthTasks.findIndex(t => t.id === editTask.id) <= 0}
                      className="rounded-full h-10 px-3 md:px-4 text-white/60 hover:text-white hover:bg-white/5 font-bold text-xs shrink-0"
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" /> <span className="hidden md:inline">Anterior</span>
                    </Button>

                    <div className="flex items-center gap-1 md:gap-1.5 px-2 shrink-0">
                       {/* Seletor de Status Customizado com Portal (escape de overflow) */}
                       <div className="relative">
                         <button
                           ref={statusBtnRef}
                           type="button"
                           onClick={() => {
                             if (statusBtnRef.current) {
                               const rect = statusBtnRef.current.getBoundingClientRect();
                               setStatusMenuPos({ top: rect.top - 8, left: rect.left });
                             }
                             setShowStatusMenu(p => !p);
                           }}
                           className="h-9 border border-white/5 bg-white/5 hover:bg-white/10 rounded-full font-bold text-[10px] md:text-[11px] uppercase tracking-wider focus:ring-0 shadow-none px-3 md:px-4 text-white flex items-center gap-1.5 cursor-pointer"
                         >
                           <span>
                             {normalizeStatusValue(editTask.status) === 'aprovado' && '🟢 Aprovado'}
                             {normalizeStatusValue(editTask.status) === 'em produção' && '🟡 Aprovado MAC'}
                             {normalizeStatusValue(editTask.status) === 'alteração' && '🟠 Alteração'}
                             {normalizeStatusValue(editTask.status) === 'publicado' && '🔵 Aprovação Cliente'}
                             {normalizeStatusValue(editTask.status) === 'para correção' && '🔴 Para Correção'}
                             {normalizeStatusValue(editTask.status) === 'reprovado' && '💔 Reprovado'}
                             {normalizeStatusValue(editTask.status) === 'pendente' && '⚫ Pendente'}
                             {!['aprovado', 'em produção', 'alteração', 'publicado', 'para correção', 'reprovado', 'pendente'].includes(normalizeStatusValue(editTask.status)) && 'STATUS'}
                           </span>
                           <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                         </button>

                         {showStatusMenu && statusMenuPos && createPortal(
                           <>
                             <div className="fixed inset-0 z-[99998]" onClick={() => setShowStatusMenu(false)} />
                             <div 
                               style={{ top: statusMenuPos.top, left: statusMenuPos.left, transform: 'translateY(-100%)' }}
                               className="fixed z-[99999] min-w-[200px] bg-[#1C1C1E] border border-white/10 text-white rounded-xl shadow-2xl p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-150 pointer-events-auto"
                               onPointerDown={(e) => e.stopPropagation()}
                               onMouseDown={(e) => e.stopPropagation()}
                             >
                               {[
                                 { value: 'aprovado', label: '🟢 Aprovado', color: 'text-emerald-400' },
                                 { value: 'em produção', label: '🟡 Aprovado MAC', color: 'text-yellow-500' },
                                 { value: 'alteração', label: '🟠 Alteração', color: 'text-orange-500' },
                                 { value: 'publicado', label: '🔵 Aprovação Cliente', color: 'text-blue-400' },
                                 { value: 'para correção', label: '🔴 Para Correção', color: 'text-red-500' },
                                 { value: 'reprovado', label: '💔 Reprovado', color: 'text-rose-500' },
                                 { value: 'pendente', label: '⚫ Pendente', color: 'text-zinc-400' },
                               ].map(item => (
                                 <button
                                   key={item.value}
                                   type="button"
                                   onPointerDown={(e) => e.stopPropagation()}
                                   onMouseDown={(e) => e.stopPropagation()}
                                   onClick={(e) => {
                                     e.preventDefault();
                                     e.stopPropagation();
                                     handleEditSave('status', item.value);
                                     setShowStatusMenu(false);
                                   }}
                                   className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-between hover:bg-white/5 pointer-events-auto ${item.color} ${normalizeStatusValue(editTask.status) === item.value ? 'bg-white/10' : ''}`}
                                 >
                                   <span>{item.label}</span>
                                   {normalizeStatusValue(editTask.status) === item.value && <Check className="w-3.5 h-3.5 text-white" />}
                                 </button>
                               ))}
                             </div>
                           </>,
                           document.body
                         )}
                       </div>

                       <div className="w-px h-5 bg-white/10 mx-1 shrink-0" />

                       {/* Actions */}
                       <button onClick={() => setShowCommentsPanel(p => !p)} className={`relative w-8 h-8 md:w-9 md:h-9 shrink-0 flex items-center justify-center rounded-full transition-colors ${showCommentsPanel ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-white/60 hover:text-white'}`} title="Comentários">
                         <MessageCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
                         {(!editTask.comments || editTask.comments.length === 0 || editTask.comments.length <= (readComments[editTask.id] || 0)) ? null : (
                            <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
                            </span>
                         )}
                       </button>
                       <button onClick={() => { setActionDate(editTask.date); setActionClientId(editTask.calendarClientId || ''); setActionDialog({ type: 'copy_task', taskId: editTask.id }) }} className="w-8 h-8 md:w-9 md:h-9 shrink-0 flex items-center justify-center rounded-full hover:bg-white/5 text-white/60 hover:text-white transition-colors" title="Duplicar">
                         <Copy className="w-3.5 h-3.5 md:w-4 md:h-4" />
                       </button>
                       <button onClick={() => {
                          const idx = editTask.images?.indexOf(editTask.imageUrl || '') || 0;
                          setAdjustmentModalData({ task: editTask, index: idx === -1 ? 0 : idx });
                       }} className="w-8 h-8 md:w-9 md:h-9 shrink-0 flex items-center justify-center rounded-full hover:bg-white/5 text-white/60 hover:text-white transition-colors" title="Formato e Redes">
                         <Settings2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                       </button>
                       <button onClick={() => setShowSendToKanban(true)} className="w-8 h-8 md:w-9 md:h-9 shrink-0 flex items-center justify-center rounded-full hover:bg-white/5 text-emerald-500/80 hover:text-emerald-400 transition-colors" title="Enviar para Kanban">
                         <Kanban className="w-3.5 h-3.5 md:w-4 md:h-4" />
                       </button>

                       <div className="w-px h-5 bg-white/10 mx-1 shrink-0" />

                       {/* Excluir */}
                       <button 
                         onClick={() => setDeleteConfirm(editTask.id)}
                         className="w-8 h-8 md:w-9 md:h-9 shrink-0 flex items-center justify-center rounded-full hover:bg-red-500/10 text-red-500/80 hover:text-red-500 transition-colors" 
                         title="Excluir"
                       >
                         <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                       </button>
                    </div>

                    {/* Botão Próximo */}
                    <Button 
                      variant="ghost" 
                      onClick={handleNextTask}
                      disabled={sortedMonthTasks.findIndex(t => t.id === editTask.id) >= sortedMonthTasks.length - 1}
                      className="rounded-full h-10 px-3 md:px-4 text-white/60 hover:text-white hover:bg-white/5 font-bold text-xs shrink-0"
                    >
                      <span className="hidden md:inline">Próximo</span> <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* Sliding Comments Panel */}
              <div className={`absolute top-0 bottom-0 right-0 w-[400px] bg-[#161618] border-l border-white/5 shadow-2xl flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] z-50 ${showCommentsPanel ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                  <h3 className="text-white font-bold tracking-wide">Comentários</h3>
                  <button onClick={() => setShowCommentsPanel(false)} className="text-white/50 hover:text-white"><X className="w-5 h-5"/></button>
                </div>
                <div ref={commentsContainerRef} className="flex-1 overflow-y-auto p-6 space-y-6">
                  {(!editTask.comments || editTask.comments.length === 0) ? (
                    <div className="text-center text-white/40 text-[13px] py-10">Nenhum comentário ainda.</div>
                  ) : (
                    editTask.comments.map((c: any) => (
                      <div key={c.id} className="flex gap-3">
                        {c.avatarUrl ? (
                          <img src={c.avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full border border-white/10 shrink-0 object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-[10px] font-bold text-white/60">
                            {c.userName ? c.userName.substring(0, 2).toUpperCase() : 'U'}
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[13px] font-bold text-white/90">{c.userName}</span>
                            <span className="text-[10px] text-white/40">{new Date(c.createdAt).toLocaleDateString('pt-BR')} às {new Date(c.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <div className="text-[13px] text-white/70 leading-relaxed bg-white/5 p-3 rounded-2xl rounded-tl-none border border-white/5 break-words whitespace-pre-wrap">
                            {c.text}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-4 border-t border-white/5 bg-[#121214] rounded-br-2xl">
                  <div className="relative">
                    <Textarea 
                      placeholder="Escreva um comentário..." 
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendComment();
                        }
                      }}
                      className="bg-[#1C1C1E] border-white/10 rounded-xl focus-visible:ring-[#8B5CF6] text-white resize-none text-[13px] pr-12 min-h-[60px]"
                    />
                    <button onClick={handleSendComment} className="absolute right-2 bottom-2 w-8 h-8 flex items-center justify-center bg-[#8B5CF6] hover:bg-[#7C3AED] rounded-lg text-white transition-colors">
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Prompt Dialog (Move/Copy) */}
      <Dialog open={!!actionDialog} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent className="bg-[#121214] border-white/5 text-white sm:max-w-md rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {actionDialog?.type === 'move_date' ? 'Mover para Data' : 'Duplicar Card'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-6 space-y-6">
            {(actionDialog?.type === 'move_date' || actionDialog?.type === 'copy_task') && (
              <div className="space-y-3">
                <label className="text-[13px] font-bold text-white/90">Nova Data</label>
                <div className="relative">
                  <Input 
                    type="date" 
                    value={actionDate} 
                    onChange={e => setActionDate(e.target.value)}
                    className="bg-white/5 border-white/10 rounded-xl pl-10 focus:ring-[#8B5CF6]"
                  />
                  <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
                </div>
              </div>
            )}
            
            {actionDialog?.type === 'copy_task' && (
              <div className="space-y-3">
                <label className="text-[13px] font-bold text-white/90">Novo Cliente</label>
                <Select value={actionClientId} onValueChange={setActionClientId}>
                  <SelectTrigger className="bg-white/5 border-white/10 rounded-xl h-11 focus:ring-[#8B5CF6]">
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1C1C1E] border-white/10 text-white rounded-xl max-h-[300px]">
                    {calendarClients.filter(c => {
                       if (loggedUserRole === 'GUEST' && loggedUserClientLink) {
                         const allowedIds = loggedUserClientLink.split(',');
                         return allowedIds.includes(c.id);
                       }
                       return true;
                    }).map(c => <SelectItem key={c.id} value={c.id} className="focus:bg-white/10 focus:text-white rounded-lg cursor-pointer">{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter className="border-t border-white/5 pt-4">
            <Button variant="ghost" onClick={() => setActionDialog(null)} className="rounded-xl hover:bg-white/5">Cancelar</Button>
            <Button 
              onClick={executeAction} 
              disabled={actionDialog?.type === 'move_date' && !actionDate} 
              className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-xl font-medium shadow-[0_0_15px_rgba(139,92,246,0.3)] transition-all"
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image preview modal */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="bg-[#121214]/90 backdrop-blur-xl border-white/10 max-w-4xl p-2 shadow-2xl rounded-2xl border-none">
          {previewImage && (
            <div className="relative flex items-center justify-center group">
              {isVideoUrl(previewImage) ? <video src={previewImage} className="w-full h-auto max-h-[85vh] object-contain rounded-xl" controls /> : <img src={previewImage} alt="" className="w-full h-auto max-h-[85vh] object-contain rounded-xl" />}
              
              {editTask?.images && editTask.images.length > 1 && (
                <>
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const currentIndex = editTask.images!.indexOf(previewImage);
                      if (currentIndex === -1) return;
                      const newIndex = (currentIndex - 1 + editTask.images!.length) % editTask.images!.length;
                      setPreviewImage(editTask.images![newIndex]);
                    }} 
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/50 hover:bg-black/80 rounded-full flex items-center justify-center text-white backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 shadow-xl"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const currentIndex = editTask.images!.indexOf(previewImage);
                      if (currentIndex === -1) return;
                      const newIndex = (currentIndex + 1) % editTask.images!.length;
                      setPreviewImage(editTask.images![newIndex]);
                    }} 
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/50 hover:bg-black/80 rounded-full flex items-center justify-center text-white backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 shadow-xl"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Enviar para Kanban (escolher funcionário) */}
      <Dialog open={showSendToKanban} onOpenChange={setShowSendToKanban}>
        <DialogContent className="bg-[#121214] border-white/10 text-white max-w-sm rounded-[1.5rem]">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2">
              <Kanban className="w-5 h-5 text-emerald-400" />
              Enviar para Kanban
            </DialogTitle>
            <DialogDescription className="text-white/50">
              Selecione o funcionário responsável. O card será enviado para a coluna "Aprovado e Programar".
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 space-y-3">
            <label className="text-[11px] font-bold text-white/40 uppercase tracking-wider ml-1">Funcionário Responsável</label>
            <Select value={sendToKanbanEmployeeId} onValueChange={setSendToKanbanEmployeeId}>
              <SelectTrigger className="w-full bg-[#1A1A1C] border-white/10 h-12 rounded-xl text-white font-bold text-sm">
                <SelectValue placeholder="Selecione o funcionário..." />
              </SelectTrigger>
              <SelectContent className="bg-[#1C1C1E] border-white/10 text-white z-[99999]">
                {employees
                  .filter(emp => loggedUserRole !== 'GUEST' || emp.id === loggedUserKanbanLink)
                  .map(emp => (
                    <SelectItem key={emp.id} value={emp.id} className="focus:bg-white/10 text-white cursor-pointer py-2.5">
                      <div className="flex items-center gap-2">
                        {emp.avatarUrl || emp.photoUrl ? (
                          <img src={emp.avatarUrl || emp.photoUrl} className="w-5 h-5 rounded-full object-cover shrink-0" alt="" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center text-[10px] font-bold shrink-0">
                            {emp.name ? emp.name.charAt(0).toUpperCase() : 'U'}
                          </div>
                        )}
                        <span className="font-bold text-xs">{emp.name}</span>
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => { setShowSendToKanban(false); setSendToKanbanEmployeeId(''); }} className="rounded-xl hover:bg-white/5">Cancelar</Button>
            <Button 
              onClick={handleSendToKanban} 
              disabled={!sendToKanbanEmployeeId || isSendingToKanban} 
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium gap-2"
            >
              {isSendingToKanban ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {isSendingToKanban ? 'Enviando...' : 'Enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Calendar Dialog */}
      <Dialog open={showDuplicateDialog} onOpenChange={(open) => !open && setShowDuplicateDialog(false)}>
        <DialogContent className="bg-[#121214] text-white border-white/10 rounded-2xl max-w-md max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-4 shrink-0 border-b border-white/5">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <CopyPlus className="w-5 h-5 text-primary" />
              Duplicar Calendário
            </DialogTitle>
            <DialogDescription className="text-white/60">
              Selecione <strong>um cliente</strong> que receberá uma cópia independente das tarefas <strong>deste mês</strong>.
            </DialogDescription>
            {isDuplicating && (
              <div className="mt-4 px-1">
                <div className="flex justify-between text-[10px] font-bold text-primary uppercase mb-1.5 tracking-wider">
                  <span>Processando cópia...</span>
                  <span>{Math.round(duplicateProgress)}%</span>
                </div>
                <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-primary h-full transition-all duration-300 ease-out rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]" style={{ width: `${duplicateProgress}%` }} />
                </div>
              </div>
            )}
          </DialogHeader>
          <div className="p-6 py-4 overflow-hidden flex flex-col min-h-[100px]">
            <div className="overflow-y-auto custom-scrollbar space-y-2 pr-2 h-[400px]">
              {calendarClients.filter(c => c.id !== clientId).map(client => (
                <label key={client.id} className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="duplicateClient"
                    className="w-4 h-4 rounded-full bg-black/50 border-white/20 text-primary focus:ring-primary focus:ring-offset-0"
                    checked={selectedDuplicateClients.includes(client.id)}
                    onChange={() => setSelectedDuplicateClients([client.id])}
                  />
                  <span className="text-sm font-medium">{client.name}</span>
                </label>
              ))}
              {calendarClients.filter(c => c.id !== clientId).length === 0 && (
                <div className="text-center text-white/50 text-sm py-4">Nenhum outro cliente cadastrado.</div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 p-6 pt-4 shrink-0 border-t border-white/5">
            <Button variant="ghost" onClick={() => setShowDuplicateDialog(false)} className="rounded-xl hover:bg-white/5" disabled={isDuplicating}>Cancelar</Button>
            <Button 
              onClick={handleDuplicateCalendar} 
              disabled={selectedDuplicateClients.length === 0 || isDuplicating} 
              className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isDuplicating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CopyPlus className="w-4 h-4 mr-2" />}
              {isDuplicating ? 'Duplicando...' : `Duplicar Calendário`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {adjustmentModalData && (
        <ImageAdjustmentModal
          isOpen={!!adjustmentModalData}
          onClose={() => setAdjustmentModalData(null)}
          task={adjustmentModalData.task}
          activeImageIndex={adjustmentModalData.index}
          onSave={handleSaveAdjustments}
        />
      )}
    </div>
  );
};

export default ClientCalendar;
