import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/contexts/useApp';
import type { KanbanCard as KanbanCardType } from '@/contexts/app-types';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Upload, X, ZoomIn, CheckCircle2, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { compressImage } from '@/lib/utils';
import { toast } from 'sonner';

// Modular Components
import { CardHeader } from './card-detail/CardHeader';
import { MembersSection } from './card-detail/MembersSection';
import { DescriptionSection } from './card-detail/DescriptionSection';
import { ChecklistSection } from './card-detail/ChecklistSection';
import { AttachmentsSection } from './card-detail/AttachmentsSection';
import { HistorySection } from './card-detail/HistorySection';
import { ActionsSection } from './card-detail/ActionsSection';

interface Props {
  card: KanbanCardType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CardDetailDialog = ({ card, open, onOpenChange }: Props) => {
  const { updateKanbanCard, deleteKanbanCard, triggerAICorrection, fixDescriptionWithAI, customAICommand, employees, systemUsers, loggedUserId, loggedUserName } = useApp();
  const [clientName, setClientName] = useState(card.clientName);

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

  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [newComment, setNewComment] = useState("");
  const [newLabelText, setNewLabelText] = useState("");

  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [previewInitial, setPreviewInitial] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMembersSelection, setShowMembersSelection] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const membersSelectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (membersSelectionRef.current && !membersSelectionRef.current.contains(event.target as Node)) {
        setShowMembersSelection(false);
      }
    };
    if (showMembersSelection) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMembersSelection]);

  useEffect(() => {
    setClientName(card.clientName || '');
    setDescription(card.description || '');
    setLocalImages(Array.isArray(card.images) ? card.images : []);
    setCoverImage(card.coverImage || null);
    setLabels(Array.isArray(card.labels) ? card.labels : []);
    setChecklists(Array.isArray(card.checklists) ? card.checklists : []);
    setComments(Array.isArray(card.comments) ? card.comments : []);
    setAssignedUsers(Array.isArray(card.assignedUsers) ? card.assignedUsers : []);
  }, [card.id, card.clientName, card.description, card.images, card.coverImage, card.labels, card.checklists, card.comments, card.assignedUsers, card.history]);

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
  }, [previewIndex, localImages.length]);

  const saveUpdates = (updates: Partial<KanbanCardType>, actionDesc?: string) => {
    updateKanbanCard(card.id, updates, actionDesc);
  };

  const handleSaveDescription = () => {
    saveUpdates({ description }, "Atualizou a descrição do card");
    setIsEditingDesc(false);
  };

  const handleImagesUpload = async (files: FileList | null) => {
    if (!files) return;
    const validFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (validFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgress(10);
    const tempUrl = URL.createObjectURL(validFiles[0]);
    setPreviewInitial(tempUrl);

    try {
      const compressPromises = validFiles.map(file => compressImage(file));
      setUploadProgress(40);

      const newBase64Images = await Promise.all(compressPromises);
      setUploadProgress(80);

      const updatedImages = [...localImages, ...newBase64Images];
      setLocalImages(updatedImages);

      const updates: Partial<KanbanCardType> = { images: updatedImages };
      if (!coverImage && newBase64Images.length > 0 && localImages.length === 0) {
        setCoverImage(newBase64Images[0]);
        updates.coverImage = newBase64Images[0];
      }

      saveUpdates(updates, `Adicionou ${validFiles.length} anexo(s) ao card`);
      setUploadProgress(100);
      setUploadSuccess(true);
      setTimeout(() => {
        setIsUploading(false);
        setUploadSuccess(false);
        setPreviewInitial(null);
        setUploadProgress(0);
        URL.revokeObjectURL(tempUrl);
      }, 2000);
    } catch (err) {
      console.error(err);
      setIsUploading(false);
      setPreviewInitial(null);
      URL.revokeObjectURL(tempUrl);
    }
  };

  const removeImage = (index: number) => {
    const imgToRemove = localImages[index];
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

  const setAsCover = (imgUrl: string) => {
    setCoverImage(imgUrl);
    saveUpdates({ coverImage: imgUrl }, "Alterou a capa do card");
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

  const addComment = () => {
    if (!newComment.trim()) return;
    const comment = { id: crypto.randomUUID(), text: newComment, userId: loggedUserId || 'unknown', userName: loggedUserName || 'Usuário', createdAt: new Date().toISOString() };
    const newList = [comment, ...comments];
    setComments(newList);
    setNewComment("");
    saveUpdates({ comments: newList }, "Comentou no card");
  };

  const addLabel = () => {
    if (!newLabelText.trim()) return;
    const txt = newLabelText.toUpperCase().trim();
    if (!labels.includes(txt)) {
      const newList = [...labels, txt];
      setLabels(newList);
      saveUpdates({ labels: newList });
    }
    setNewLabelText("");
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
    const diffMin = Math.round((Date.now() - dt.getTime()) / 60000);
    if (diffMin < 1) return 'agora mesmo';
    if (diffMin < 60) return `há ${diffMin} ${diffMin === 1 ? 'minuto' : 'minutos'}`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `há ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
    const diffDays = Math.floor(diffHours / 24);
    return `há ${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}`;
  };

  const checklistProgress = checklists.length > 0 ? Math.round((checklists.filter(c => c.completed).length / checklists.length) * 100) : 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="p-0 border-white/5 bg-[#161618] text-white max-w-5xl rounded-[1.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
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

          <CardHeader 
            card={card}
            clientName={clientName}
            setClientName={setClientName}
            coverImage={coverImage}
            setAsCover={setAsCover}
            localImages={localImages}
            setPreviewIndex={setPreviewIndex}
            saveUpdates={saveUpdates}
          />

          <div className="flex flex-1 overflow-hidden">
            {/* Left Column (Main Content) */}
            <div className={`flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 ${coverImage ? 'pt-4' : 'pt-2'}`}>
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
                membersSelectionRef={membersSelectionRef}
                employees={employees}
                systemUsers={systemUsers}
                saveUpdates={saveUpdates}
                triggerAICorrection={triggerAICorrection}
                fixDescriptionWithAI={fixDescriptionWithAI}
                customAICommand={customAICommand}
              />

              <DescriptionSection 
                card={card}
                description={description}
                setDescription={setDescription}
                isEditingDesc={isEditingDesc}
                setIsEditingDesc={setIsEditingDesc}
                handleSaveDescription={handleSaveDescription}
              />

              <ChecklistSection 
                checklists={checklists}
                checklistProgress={checklistProgress}
                toggleChecklist={toggleChecklist}
                deleteChecklistItem={deleteChecklistItem}
                newChecklistTitle={newChecklistTitle}
                setNewChecklistTitle={setNewChecklistTitle}
                addChecklistItem={addChecklistItem}
              />

              <AttachmentsSection 
                localImages={localImages}
                coverImage={coverImage}
                setPreviewIndex={setPreviewIndex}
                removeImage={removeImage}
                setAsCover={setAsCover}
                fileInputRef={fileInputRef}
                handleImagesUpload={handleImagesUpload}
              />
            </div>

            {/* Right Column (Sidebar / Activity) */}
            <div className="w-[30%] min-w-[320px] bg-[#1a1a1c] border-l border-white/5 flex flex-col pt-8">
              <HistorySection 
                card={card}
                comments={comments}
                newComment={newComment}
                setNewComment={setNewComment}
                addComment={addComment}
                getRelativeTime={getRelativeTime}
              />

              <ActionsSection 
                card={card}
                triggerAICorrection={triggerAICorrection}
                fixDescriptionWithAI={fixDescriptionWithAI}
                customAICommand={customAICommand}
                setShowDeleteConfirm={setShowDeleteConfirm}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={previewIndex !== null} onOpenChange={(open) => !open && setPreviewIndex(null)}>
        <DialogContent className="bg-black/95 max-w-[85vw] p-0 border-none shadow-2xl flex items-center justify-center">
          {previewIndex !== null && (
            <div className="relative w-full h-full flex items-center justify-center">
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

              <img
                src={localImages[previewIndex]}
                alt="Preview"
                className="w-full h-auto max-h-[90vh] object-contain transition-all"
                onClick={() => setPreviewIndex(null)}
              />
              
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-[10px] font-bold text-white/50 tracking-widest uppercase">
                Anexo {previewIndex + 1} de {localImages.length}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-[#1C1C1E] border-white/10 text-white rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir card?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/50 text-[13px]">
              Deseja excluir permanentemente o card "{card.clientName}"? Esta ação não pode ser restaurada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-none">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => { deleteKanbanCard(card.id); onOpenChange(false); }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default CardDetailDialog;
