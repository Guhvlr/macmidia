import { useState, useRef, useEffect, useMemo } from 'react';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useApp } from '@/contexts/useApp';
import type { KanbanCard as KanbanCardType } from '@/contexts/app-types';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Upload, X, ZoomIn, CheckCircle2, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeFileName } from '@/lib/utils';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

// Modular Components
import { CardHeader } from './card-detail/CardHeader';
import { MembersSection } from './card-detail/MembersSection';
import { DescriptionSection } from './card-detail/DescriptionSection';
import { AIReportSection } from './card-detail/AIReportSection';
import { ChecklistSection } from './card-detail/ChecklistSection';
import { AttachmentsSection } from './card-detail/AttachmentsSection';
import { HistorySection } from './card-detail/HistorySection';
import { ActionsSection } from './card-detail/ActionsSection';
import { DatesSection } from './card-detail/DatesSection';

interface Props {
  card: KanbanCardType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CardDetailDialog = ({ card, open, onOpenChange }: Props) => {
  const isMobile = useIsMobile();
  const { updateKanbanCard, deleteKanbanCard, triggerAICorrection, fixDescriptionWithAI, customAICommand, employees, systemUsers, loggedUserId, loggedUserName, calendarClients, loggedUserRole, loggedUserClientLink } = useApp();
  
  const filteredClients = useMemo(() => {
    if (loggedUserRole === 'GUEST' && loggedUserClientLink) {
      const allowedIds = loggedUserClientLink.split(',');
      return calendarClients.filter(c => allowedIds.includes(c.id));
    }
    return calendarClients;
  }, [calendarClients, loggedUserRole, loggedUserClientLink]);
  const [clientName, setClientName] = useState(card.clientName);
  const [calendarClientId, setCalendarClientId] = useState(card.calendarClientId || '');
  const [calendarClientName, setCalendarClientName] = useState(card.calendarClientName || '');

  // Description
  const [description, setDescription] = useState(card.description);
  const [isEditingDesc, setIsEditingDesc] = useState(false);

  // Custom Fields
  const [labels, setLabels] = useState<string[]>(Array.isArray(card.labels) ? card.labels : []);
  const [checklists, setChecklists] = useState(Array.isArray(card.checklists) ? card.checklists : []);
  const [comments, setComments] = useState(Array.isArray(card.comments) ? card.comments : []);
  const [assignedUsers, setAssignedUsers] = useState<any[]>(Array.isArray(card.assignedUsers) ? card.assignedUsers : []);
  const [localImages, setLocalImages] = useState<string[]>(Array.isArray(card.images) ? card.images : []);
  const [coverImage, setCoverImage] = useState<string | null>(card.coverImage || null);

  // Date Fields
  const [startDate, setStartDate] = useState(card.startDate || '');
  const [dueDate, setDueDate] = useState(card.dueDate || '');
  const [dueTime, setDueTime] = useState(card.dueTime || '');
  const [recurrence, setRecurrence] = useState(card.recurrence || 'never');
  const [reminder, setReminder] = useState(card.reminder || '1_day_before');
  const [dueDateCompleted, setDueDateCompleted] = useState(card.dueDateCompleted || false);

  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [newComment, setNewComment] = useState("");
  const [newLabelText, setNewLabelText] = useState("");

  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Reset zoom when image changes
  useEffect(() => {
    setIsZoomed(false);
  }, [previewIndex]);

  const handleImageZoomClick = (e: React.MouseEvent<HTMLImageElement>) => {
    e.stopPropagation();
    if (isZoomed) {
      setIsZoomed(false);
      return;
    }

    const img = e.currentTarget;
    const container = img.closest('.overflow-auto') as HTMLDivElement;
    if (!container) {
      setIsZoomed(true);
      return;
    }

    // Get click position relative to the image
    const rect = img.getBoundingClientRect();
    const xPercent = (e.clientX - rect.left) / rect.width;
    const yPercent = (e.clientY - rect.top) / rect.height;

    setIsZoomed(true);

    // Wait a tick for React to update the DOM (remove max-height constraint)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const newRect = img.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        // Calculate exact scroll positions to keep the clicked point under the cursor
        const scrollX = (newRect.width * xPercent) - (e.clientX - containerRect.left);
        const scrollY = (newRect.height * yPercent) - (e.clientY - containerRect.top);

        container.scrollTo({
          left: Math.max(0, scrollX),
          top: Math.max(0, scrollY),
          behavior: 'instant'
        });
      });
    });
  };

  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [previewInitial, setPreviewInitial] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMembersSelection, setShowMembersSelection] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);



  useEffect(() => {
    setClientName(card.clientName || '');
    setCalendarClientId(card.calendarClientId || '');
    setCalendarClientName(card.calendarClientName || '');
    setDescription(card.description || '');
    setLocalImages(Array.isArray(card.images) ? card.images : []);
    setCoverImage(card.coverImage || null);
    setLabels(Array.isArray(card.labels) ? card.labels : []);
    setChecklists(Array.isArray(card.checklists) ? card.checklists : []);
    setComments(Array.isArray(card.comments) ? card.comments : []);
    setAssignedUsers(Array.isArray(card.assignedUsers) ? card.assignedUsers : []);
    setStartDate(card.startDate || '');
    setDueDate(card.dueDate || '');
    setDueTime(card.dueTime || '');
    setRecurrence(card.recurrence || 'never');
    setReminder(card.reminder || '1_day_before');
    setDueDateCompleted(card.dueDateCompleted || false);
  }, [card.id, card.clientName, card.calendarClientId, card.calendarClientName, card.description, card.images, card.coverImage, card.labels, card.checklists, card.comments, card.assignedUsers, card.history, card.startDate, card.dueDate, card.dueTime, card.recurrence, card.reminder, card.dueDateCompleted]);

  const { kanbanCards } = useApp();
  useEffect(() => {
    if (open && !kanbanCards.some(c => c.id === card.id)) {
      onOpenChange(false);
    }
  }, [kanbanCards, card.id, open]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (previewIndex === null || localImages.length <= 1) return;
      if (e.key === 'ArrowLeft') {
        setPreviewIndex(prev => prev! === 0 ? localImages.length - 1 : prev! - 1);
      } else if (e.key === 'ArrowRight') {
        setPreviewIndex(prev => prev! === localImages.length - 1 ? 0 : prev! + 1);
      } else if (e.key === 'Escape') {
        setPreviewIndex(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewIndex, localImages]);

  // Shortcut: Spacebar to toggle self as member
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input, textarea or any contenteditable
      if (e.target instanceof HTMLInputElement || 
          e.target instanceof HTMLTextAreaElement || 
          (e.target as HTMLElement).isContentEditable) return;

      if (e.code === 'Space' && open) {
        e.preventDefault();
        if (!loggedUserId) return;

        const isAssigned = assignedUsers.some(u => u.id === loggedUserId);
        const currentUser = systemUsers.find(u => u.id === loggedUserId);

        if (isAssigned) {
          const newAssigned = assignedUsers.filter(u => u.id !== loggedUserId);
          setAssignedUsers(newAssigned);
          updateKanbanCard(card.id, { assignedUsers: newAssigned }, `Membro ${loggedUserName} removido do card via atalho`);
          toast.success('Membro removido');
        } else if (currentUser) {
          const newAssigned = [...assignedUsers, currentUser];
          setAssignedUsers(newAssigned);
          updateKanbanCard(card.id, { assignedUsers: newAssigned }, `Membro ${loggedUserName} adicionado ao card via atalho`);
          toast.success('Você foi adicionado como membro');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, loggedUserId, assignedUsers, systemUsers, card.id, updateKanbanCard, loggedUserName]);

  // Ctrl+V for images
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (!open) return;
      
      // Don't intercept paste if user is in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) files.push(file);
        }
      }

      if (files.length > 0) {
        handleImagesUpload(files);
      }
    };

    window.addEventListener('paste', handlePaste as any);
    return () => window.removeEventListener('paste', handlePaste as any);
  }, [open, card.id, localImages, coverImage]);

  const saveUpdates = (updates: Partial<KanbanCardType>, actionDesc?: string) => {
    updateKanbanCard(card.id, updates, actionDesc);
  };

  const handleSaveDescription = () => {
    const updates: Partial<KanbanCardType> = { description };
    if (!card.originalMessage) {
      updates.originalMessage = description;
    }
    saveUpdates(updates, "Atualizou a descrição do card");
    setIsEditingDesc(false);
  };
  
  const addChecklist = () => {
    const newChecklist = {
      id: `cl-${Date.now()}`,
      title: "Checklist",
      items: []
    };
    const updated = [...checklists, newChecklist];
    setChecklists(updated);
    saveUpdates({ checklists: updated }, "Adicionou um novo checklist");
    
    // Smooth scroll to the new checklist
    setTimeout(() => {
      const checklistEl = document.getElementById('checklist-section');
      checklistEl?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleImagesUpload = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const validFiles = Array.from(files);
    
    // Check for files exceeding the size limit
    const oversizedFiles = validFiles.filter(f => f.size > MAX_FILE_SIZE);
    if (oversizedFiles.length > 0) {
      toast.error(`Arquivo(s) muito grande(s): ${oversizedFiles.map(f => f.name).join(', ')}. O limite é de 10MB.`);
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);
    
    if (validFiles[0].type.startsWith('image/')) {
       setPreviewInitial(URL.createObjectURL(validFiles[0]));
    }

    try {
      const newUploads: string[] = [];
      const total = validFiles.length;

      for (let i = 0; i < total; i++) {
        const file = validFiles[i];
        
        // Always upload to storage to preserve original file (size and quality)
        const safeName = sanitizeFileName(file.name);
        const fileName = `${Date.now()}-${safeName}`;
        const filePath = `${card.id}/${fileName}`;
        
        const { error } = await supabase.storage.from('kanban_assets').upload(filePath, file, {
          contentType: file.type,
          upsert: true
        });
        
        if (error) {
          console.error("Storage upload error:", error);
          toast.error(`Erro ao enviar ${file.name}`);
        } else {
          const { data: { publicUrl } } = supabase.storage.from('kanban_assets').getPublicUrl(filePath);
          newUploads.push(publicUrl);
        }
        
        setUploadProgress(10 + Math.round(((i + 1) / total) * 70));
      }

      const updatedImages = [...localImages, ...newUploads];
      setLocalImages(updatedImages);

      const updates: Partial<KanbanCardType> = { images: updatedImages };
      
      if (!coverImage && newUploads.length > 0 && localImages.length === 0) {
        const firstImg = newUploads.find(u => u.match(/\.(jpeg|jpg|gif|png|webp)$/i));
        if (firstImg) {
          setCoverImage(firstImg);
          updates.coverImage = firstImg;
        }
      }

      saveUpdates(updates, `Adicionou ${validFiles.length} anexo(s) ao card`);
      setUploadProgress(100);
      setUploadSuccess(true);
      setTimeout(() => {
        setIsUploading(false);
        setUploadSuccess(false);
        setPreviewInitial(null);
        setUploadProgress(0);
      }, 2000);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao fazer upload');
      setIsUploading(false);
      setPreviewInitial(null);
    }
  };

  const removeImage = async (index: number) => {
    const imgToRemove = localImages[index];
    
    // Tentar remover do Storage físico
    try {
      const pathPart = imgToRemove.split('/public/kanban_assets/')[1];
      if (pathPart) {
        const storagePath = pathPart.split('?')[0]; // Remove cache buster if present
        const { error } = await supabase.storage.from('kanban_assets').remove([storagePath]);
        if (error) console.warn("Erro ao remover do storage:", error);
      }
    } catch (err) {
      console.warn("Falha ao remover arquivo do storage:", err);
    }

    const newImgs = localImages.filter((_, i) => i !== index);
    setLocalImages(newImgs);

    const updates: Partial<KanbanCardType> = { images: newImgs };
    if (imgToRemove === coverImage) {
      const newCover = newImgs.length > 0 ? newImgs[0] : null;
      setCoverImage(newCover);
      updates.coverImage = newCover;
    }
    saveUpdates(updates, "Removeu um anexo do card");
  };

  const removeAllImages = async () => {
    // Tentar remover todos os arquivos do Storage físico
    try {
      const pathsToDelete = localImages
        .map(url => {
          const part = url.split('/public/kanban_assets/')[1];
          return part ? part.split('?')[0] : null;
        })
        .filter(Boolean) as string[];
      
      if (pathsToDelete.length > 0) {
        const { error } = await supabase.storage.from('kanban_assets').remove(pathsToDelete);
        if (error) console.warn("Erro ao remover múltiplos do storage:", error);
      }
    } catch (err) {
      console.warn("Falha ao remover arquivos do storage:", err);
    }

    setLocalImages([]);
    setCoverImage(null);
    saveUpdates({ images: [], coverImage: null }, "Removeu todos os anexos do card");
  };

  const setAsCover = (imgUrl: string) => {
    setCoverImage(imgUrl);
    saveUpdates({ coverImage: imgUrl }, "Alterou a capa do card");
  };

  const reorderImages = (newImages: string[]) => {
    setLocalImages(newImages);
    saveUpdates({ images: newImages }, "Reordenou os anexos");
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      handleImagesUpload(e.dataTransfer.files);
    }
  };

  const addChecklistItem = () => {
    if (!newChecklistTitle.trim()) return;
    const item = { id: crypto.randomUUID(), title: newChecklistTitle, completed: false };
    const newList = [...checklists, item];
    setChecklists(newList);
    setNewChecklistTitle("");
    saveUpdates({ checklists: newList }, `Adicionou o item de checklist: "${item.title}"`);
  };

  const toggleChecklist = (id: string, completed: boolean) => {
    const newList = checklists.map(c => c.id === id ? { ...c, completed } : c);
    setChecklists(newList);
    saveUpdates({ checklists: newList });
  };

  const deleteChecklistItem = (id: string) => {
    const newList = checklists.filter(c => c.id !== id);
    setChecklists(newList);
    saveUpdates({ checklists: newList });
  };

  const uploadCommentImage = async (file: File): Promise<string | null> => {
    try {
      const safeName = sanitizeFileName(file.name || 'pasted-image.png');
      const fileName = `${Date.now()}-${safeName}`;
      const filePath = `${card.id}/comments/${fileName}`;
      
      const { error } = await supabase.storage.from('kanban_assets').upload(filePath, file, {
        contentType: file.type,
        upsert: true
      });
      
      if (error) {
        console.error("Comment image upload error:", error);
        toast.error('Erro ao enviar imagem');
        return null;
      }
      
      const { data: { publicUrl } } = supabase.storage.from('kanban_assets').getPublicUrl(filePath);
      return publicUrl;
    } catch (err) {
      console.error(err);
      toast.error('Erro ao enviar imagem');
      return null;
    }
  };

  const addComment = (images?: string[]) => {
    if (!newComment.trim() && (!images || images.length === 0)) return;
    const comment = { 
      id: crypto.randomUUID(), 
      text: newComment, 
      images: images || [],
      userId: loggedUserId || 'unknown', 
      userName: loggedUserName || 'Usuário', 
      createdAt: new Date().toISOString() 
    };
    const newList = [comment, ...comments];
    setComments(newList);
    setNewComment("");
    saveUpdates({ comments: newList }, "Comentou no card");
  };

  const addLabel = (color: string = 'bg-red-600', textParam?: string) => {
    const txt = (textParam !== undefined ? textParam : newLabelText).toUpperCase().trim();
    if (!txt) return;
    const labelVal = `${color}|${txt}`;
    // Check if the label text already exists (ignore color when checking duplicates)
    if (!labels.some(l => l.split('|').pop() === txt)) {
      const newList = [...labels, labelVal];
      setLabels(newList);
      saveUpdates({ labels: newList });
    }
    if (textParam === undefined) {
      setNewLabelText("");
    }
  };

  const removeLabel = (label: string) => {
    const newList = labels.filter(l => l !== label);
    setLabels(newList);
    saveUpdates({ labels: newList });
  };

  const toggleAssignee = (member: any) => {
    const memberId = member.id;
    const exists = assignedUsers.some(u => u.id === memberId);
    let newList;
    if (exists) {
      newList = assignedUsers.filter(u => u.id !== memberId);
    } else {
      // Create a unified assignee object
      const name = member.fullName || member.name;
      const avatar = member.avatarUrl || member.photoUrl || member.avatar;
      newList = [...assignedUsers, { id: memberId, fullName: name, avatarUrl: avatar }];
    }
    setAssignedUsers(newList);
    saveUpdates({ assignedUsers: newList }, exists ? `Removeu o membro ${member.fullName || member.name}` : `Adicionou o membro ${member.fullName || member.name}`);
  };

  const getRelativeTime = (isoDate: string) => {
    const dt = new Date(isoDate);
    const day = String(dt.getDate()).padStart(2, '0');
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const year = dt.getFullYear();
    const hours = String(dt.getHours()).padStart(2, '0');
    const minutes = String(dt.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} às ${hours}:${minutes}`;
  };

  const checklistProgress = checklists.length > 0 ? Math.round((checklists.filter(c => c.completed).length / checklists.length) * 100) : 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={`p-0 border-white/5 bg-[#161618] text-white max-w-[1100px] w-[95vw] rounded-[1.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] [&>button.absolute]:hidden ${isMobile ? 'card-detail-mobile !max-w-full !max-h-full !h-[100dvh] !rounded-none' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          data-no-dnd="true"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Custom Close Button to ensure it ALWAYS works and is above everything */}
          <div className="absolute right-4 top-4 z-[99999]">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onOpenChange(false);
              }}
              className="rounded-full bg-black/40 hover:bg-black text-white w-8 h-8 flex items-center justify-center transition-all border border-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="sr-only">
            <DialogTitle>Detalhes do Card: {clientName || 'Sem nome'}</DialogTitle>
            <DialogDescription>Visualize e gerencie as informações e histórico deste card de produção.</DialogDescription>
          </div>
          {isDragging && !isUploading && (
            <div className="absolute inset-0 z-[100] bg-black/80 flex flex-col items-center justify-center backdrop-blur-md border-2 border-dashed border-primary/50 animate-in fade-in duration-200 pointer-events-none">
              <Upload className="w-16 h-16 text-primary mb-4" />
              <h2 className="text-xl font-bold text-white mb-2 tracking-wider uppercase">Solte para anexar imagens</h2>
              <p className="text-white/60 text-sm">As imagens serão adicionadas a este card</p>
            </div>
          )}

          {isUploading && (
            <div className="absolute inset-0 z-[110] bg-black/80 flex flex-col items-center justify-center backdrop-blur-md animate-in fade-in">
              {uploadSuccess ? (
                <>
                  <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4 animate-in zoom-in duration-300" />
                  <h2 className="text-xl font-bold text-white mb-2 tracking-wider uppercase">Upload Concluído!</h2>
                </>
              ) : (
                <>
                  <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                  <h2 className="text-xl font-bold text-white mb-2 tracking-wider uppercase">Enviando arquivos... {uploadProgress}%</h2>
                  <div className="w-64 h-2 bg-white/10 rounded-full mt-2 overflow-hidden mb-6">
                    <div className="h-full bg-primary transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </>
              )}
            </div>
          )}
          {/* Cover Image (Full Width) */}
          {coverImage && (
            <div className="w-full h-48 bg-black/50 relative overflow-hidden group flex-shrink-0 rounded-t-[1.5rem]">
              <img src={coverImage} alt="" className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-40 scale-110" />
              <img src={coverImage} alt="Capa" className="relative w-full h-full object-contain p-2" />
              <button
                onClick={() => {
                  const idx = localImages.indexOf(coverImage);
                  setPreviewIndex(idx >= 0 ? idx : 0);
                }}
                className="absolute inset-0 w-full h-full flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity"
              >
                <ZoomIn className="w-8 h-8 text-white/70" />
              </button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAsCover('')}
                className="absolute bottom-3 right-3 bg-black/60 hover:bg-black text-xs text-white rounded-lg border border-white/10"
              >
                Remover capa
              </Button>
            </div>
          )}

          {isMobile ? (
            /* ═══ MOBILE: Single column, correct order ═══ */
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className={`p-4 space-y-5 ${coverImage ? 'pt-3' : 'pt-1'}`}>
                {/* 0. Header/Title */}
                <CardHeader 
                  card={card}
                  clientName={clientName}
                  setClientName={setClientName}
                  calendarClientId={calendarClientId}
                  setCalendarClientId={setCalendarClientId}
                  calendarClientName={calendarClientName}
                  setCalendarClientName={setCalendarClientName}
                  calendarClients={filteredClients}
                  coverImage={coverImage}
                  setAsCover={setAsCover}
                  localImages={localImages}
                  setPreviewIndex={setPreviewIndex}
                  saveUpdates={saveUpdates}
                />
                
                {/* 1. Members/Labels/Info */}
                <MembersSection 
                  card={card}
                  labels={labels}
                  removeLabel={removeLabel}
                  newLabelText={newLabelText}
                  setNewLabelText={setNewLabelText}
                  addLabel={addLabel}
                  assignedUsers={assignedUsers}
                  toggleAssignee={toggleAssignee}
                  showMembersSelection={showMembersSelection}
                  setShowMembersSelection={setShowMembersSelection}
                  employees={employees}
                  systemUsers={systemUsers}
                  saveUpdates={saveUpdates}
                  triggerAICorrection={triggerAICorrection}
                  fixDescriptionWithAI={fixDescriptionWithAI}
                  customAICommand={customAICommand}
                  startDate={startDate}
                  setStartDate={setStartDate}
                  dueDate={dueDate}
                  setDueDate={setDueDate}
                  dueTime={dueTime}
                  setDueTime={setDueTime}
                  recurrence={recurrence}
                  setRecurrence={setRecurrence}
                  reminder={reminder}
                  setReminder={setReminder}
                  dueDateCompleted={dueDateCompleted}
                  setDueDateCompleted={setDueDateCompleted}
                  onAddChecklist={addChecklist}
                  onAddAttachment={() => {
                    fileInputRef.current?.click();
                  }}
                />

                {/* 2. Description */}
                <DescriptionSection 
                  card={card}
                  description={description}
                  setDescription={setDescription}
                  isEditingDesc={isEditingDesc}
                  setIsEditingDesc={setIsEditingDesc}
                  handleSaveDescription={handleSaveDescription}
                />

                {/* 3. AI Report */}
                <AIReportSection card={card} />

                {/* 4. Checklist (MOVED UP - HIDDEN IF EMPTY) */}
                {checklists.length > 0 && (
                  <div id="checklist-section">
                    <ChecklistSection 
                      checklists={checklists}
                      checklistProgress={checklistProgress}
                      toggleChecklist={toggleChecklist}
                      deleteChecklistItem={deleteChecklistItem}
                      newChecklistTitle={newChecklistTitle}
                      setNewChecklistTitle={setNewChecklistTitle}
                      addChecklistItem={addChecklistItem}
                    />
                  </div>
                )}

                {/* 4.5 Dates Display */}
                {(startDate || dueDate) && (
                  <div className="bg-[#1a1a1c] rounded-xl border border-white/5 p-4">
                    <DatesSection 
                      card={card}
                      startDate={startDate}
                      setStartDate={setStartDate}
                      dueDate={dueDate}
                      setDueDate={setDueDate}
                      dueTime={dueTime}
                      setDueTime={setDueTime}
                      recurrence={recurrence}
                      setRecurrence={setRecurrence}
                      reminder={reminder}
                      setReminder={setReminder}
                      dueDateCompleted={dueDateCompleted}
                      setDueDateCompleted={setDueDateCompleted}
                      saveUpdates={saveUpdates}
                      mode="display"
                    />
                  </div>
                )}

                {/* 5. Attachments */}
                <AttachmentsSection 
                  localImages={localImages}
                  coverImage={coverImage}
                  setPreviewIndex={setPreviewIndex}
                  removeImage={removeImage}
                  removeAllImages={removeAllImages}
                  setAsCover={setAsCover}
                  fileInputRef={fileInputRef}
                  handleImagesUpload={handleImagesUpload}
                  reorderImages={reorderImages}
                />

                {/* 6. Comment input (ALWAYS above activities) */}
                <div className="mobile-comment-input bg-[#1a1a1c] rounded-xl border border-white/5 p-3">
                  <div className="text-[11px] font-bold text-white/50 mb-2 uppercase tracking-wider flex items-center gap-2">
                    💬 Comentário
                  </div>
                  <textarea
                    placeholder="Escrever comentário... (Cole imagens com Ctrl+V)"
                    className="w-full min-h-[100px] text-sm bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-white placeholder:text-white/30 focus:outline-none focus:border-white/15 resize-none"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                  />
                  <div className="flex justify-end mt-2">
                    <button 
                      onClick={() => addComment()} 
                      disabled={!newComment.trim()} 
                      className="bg-white hover:bg-gray-200 text-black h-8 text-xs px-5 rounded-lg font-black shadow-lg disabled:opacity-30 disabled:pointer-events-none transition-all"
                    >
                      Salvar
                    </button>
                  </div>
                </div>

                {/* 7. Activities (ALWAYS LAST) */}
                <div className="bg-[#1a1a1c] rounded-xl border border-white/5 overflow-hidden">
                  <HistorySection 
                    card={card}
                    comments={comments}
                    newComment=""
                    setNewComment={() => {}}
                    addComment={() => {}}
                    getRelativeTime={getRelativeTime}
                    hideCommentInput={true}
                  />
                </div>

                {/* 8. Actions (delete, etc) */}
                <ActionsSection 
                  card={card}
                  triggerAICorrection={triggerAICorrection}
                  fixDescriptionWithAI={fixDescriptionWithAI}
                  customAICommand={customAICommand}
                  setShowDeleteConfirm={setShowDeleteConfirm}
                />

                {/* Bottom spacer for keyboard safety */}
                <div className="h-8" />
              </div>
            </div>
          ) : (
            /* ═══ DESKTOP: Two-column layout (unchanged) ═══ */
            <div className="flex flex-1 overflow-hidden">
              <div className={`flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 ${coverImage ? 'pt-4' : 'pt-2'}`}>
                <CardHeader 
                  card={card}
                  clientName={clientName}
                  setClientName={setClientName}
                  calendarClientId={calendarClientId}
                  setCalendarClientId={setCalendarClientId}
                  calendarClientName={calendarClientName}
                  setCalendarClientName={setCalendarClientName}
                  calendarClients={filteredClients}
                  coverImage={coverImage}
                  setAsCover={setAsCover}
                  localImages={localImages}
                  setPreviewIndex={setPreviewIndex}
                  saveUpdates={saveUpdates}
                />
                
                <MembersSection 
                  card={card}
                  labels={labels}
                  removeLabel={removeLabel}
                  newLabelText={newLabelText}
                  setNewLabelText={setNewLabelText}
                  addLabel={addLabel}
                  assignedUsers={assignedUsers}
                  toggleAssignee={toggleAssignee}
                  showMembersSelection={showMembersSelection}
                  setShowMembersSelection={setShowMembersSelection}
                  employees={employees}
                  systemUsers={systemUsers}
                  saveUpdates={saveUpdates}
                  triggerAICorrection={triggerAICorrection}
                  fixDescriptionWithAI={fixDescriptionWithAI}
                  customAICommand={customAICommand}
                  startDate={startDate}
                  setStartDate={setStartDate}
                  dueDate={dueDate}
                  setDueDate={setDueDate}
                  dueTime={dueTime}
                  setDueTime={setDueTime}
                  recurrence={recurrence}
                  setRecurrence={setRecurrence}
                  reminder={reminder}
                  setReminder={setReminder}
                  dueDateCompleted={dueDateCompleted}
                  setDueDateCompleted={setDueDateCompleted}
                  onAddChecklist={addChecklist}
                  onAddAttachment={() => {
                    fileInputRef.current?.click();
                  }}
                />
                <DescriptionSection 
                  card={card}
                  description={description}
                  setDescription={setDescription}
                  isEditingDesc={isEditingDesc}
                  setIsEditingDesc={setIsEditingDesc}
                  handleSaveDescription={handleSaveDescription}
                />
                <AIReportSection card={card} />
                {checklists.length > 0 && (
                  <div id="checklist-section">
                    <ChecklistSection 
                      checklists={checklists}
                      checklistProgress={checklistProgress}
                      toggleChecklist={toggleChecklist}
                      deleteChecklistItem={deleteChecklistItem}
                      newChecklistTitle={newChecklistTitle}
                      setNewChecklistTitle={setNewChecklistTitle}
                      addChecklistItem={addChecklistItem}
                    />
                  </div>
                )}
                {(startDate || dueDate) && (
                  <div className="mt-6 bg-[#1a1a1c] rounded-xl border border-white/5 p-4">
                    <DatesSection 
                      card={card}
                      startDate={startDate}
                      setStartDate={setStartDate}
                      dueDate={dueDate}
                      setDueDate={setDueDate}
                      dueTime={dueTime}
                      setDueTime={setDueTime}
                      recurrence={recurrence}
                      setRecurrence={setRecurrence}
                      reminder={reminder}
                      setReminder={setReminder}
                      dueDateCompleted={dueDateCompleted}
                      setDueDateCompleted={setDueDateCompleted}
                      saveUpdates={saveUpdates}
                      mode="display"
                    />
                  </div>
                )}
                <AttachmentsSection 
                  localImages={localImages}
                  coverImage={coverImage}
                  setPreviewIndex={setPreviewIndex}
                  removeImage={removeImage}
                  removeAllImages={removeAllImages}
                  setAsCover={setAsCover}
                  fileInputRef={fileInputRef}
                  handleImagesUpload={handleImagesUpload}
                  reorderImages={reorderImages}
                />
              </div>
              <div className="w-[38%] min-w-[380px] bg-[#1a1a1c] border-l border-white/5 flex flex-col pt-0">
                <HistorySection 
                  card={card}
                  comments={comments}
                  newComment={newComment}
                  setNewComment={setNewComment}
                  addComment={addComment}
                  getRelativeTime={getRelativeTime}
                  onUploadImage={uploadCommentImage}
                />
                <div className="p-4 space-y-3">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-2">Ações do Card</h3>
                  <div className="space-y-2">
                    <ActionsSection 
                      card={card}
                      triggerAICorrection={triggerAICorrection}
                      fixDescriptionWithAI={fixDescriptionWithAI}
                      customAICommand={customAICommand}
                      setShowDeleteConfirm={setShowDeleteConfirm}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Media Preview Dialog */}
      <Dialog open={previewIndex !== null} onOpenChange={(open) => !open && setPreviewIndex(null)}>
        <DialogContent className="bg-black/95 max-w-[95vw] h-[95vh] p-0 border-none shadow-2xl flex items-center justify-center [&>button.absolute]:hidden">
          <div className="sr-only">
            <DialogTitle>Visualização de Anexo</DialogTitle>
            <DialogDescription>Visualização em tela cheia do anexo selecionado.</DialogDescription>
          </div>
          {previewIndex !== null && (
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Custom Close Button for Image Viewer */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setPreviewIndex(null);
                }}
                className="absolute right-4 top-4 z-[99999] rounded-full bg-white/10 hover:bg-white/30 text-white w-12 h-12 flex items-center justify-center transition-all"
              >
                <X className="w-6 h-6" />
              </button>
              
              {/* Navegação */}
              {localImages.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-4 z-50 rounded-full bg-white/10 hover:bg-white/20 text-white w-12 h-12"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewIndex(prev => prev! === 0 ? localImages.length - 1 : prev! - 1);
                    }}
                  >
                    <ChevronLeft className="w-8 h-8" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-4 z-50 rounded-full bg-white/10 hover:bg-white/20 text-white w-12 h-12"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewIndex(prev => prev! === localImages.length - 1 ? 0 : prev! + 1);
                    }}
                  >
                    <ChevronRight className="w-8 h-8" />
                  </Button>
                </>
              )}

              <div 
                className="w-full h-full overflow-auto custom-scrollbar"
                onClick={(e) => {
                  if (e.target === e.currentTarget || (e.target as HTMLElement).id === 'zoom-container') setPreviewIndex(null);
                }}
              >
                <div 
                  id="zoom-container"
                  className={`min-h-full min-w-full w-fit h-fit flex p-4 md:p-8 ${isZoomed ? 'items-start justify-start' : 'items-center justify-center'}`}
                  onClick={(e) => {
                    if (e.target === e.currentTarget) setPreviewIndex(null);
                  }}
                >
                  <img
                    src={localImages[previewIndex]}
                    alt="Preview"
                    onClick={handleImageZoomClick}
                    className={`shadow-2xl rounded-md ${
                      isZoomed 
                        ? 'cursor-zoom-out w-auto h-auto min-w-[120vw] md:min-w-[100vw] max-w-none' 
                        : 'cursor-zoom-in max-w-full max-h-[85vh] object-contain'
                    }`}
                  />
                </div>
              </div>
              
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-[10px] font-bold text-white/50 tracking-widest uppercase">
                Anexo {previewIndex + 1} de {localImages.length}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </>
  );
};

export default CardDetailDialog;
