import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/contexts/useApp';
import type { KanbanCard as KanbanCardType } from '@/contexts/app-types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import Timer from './Timer';
import { Trash2, Upload, X, ZoomIn, Save, Clock, History, CheckSquare, Paperclip, MessageSquare, Image as ImageIcon, Circle, CheckCircle2, Plus, LayoutList, Loader2, ArrowRight, Edit3, Bot, Sparkles, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { compressImage } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';

interface Props {
  card: KanbanCardType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CardDetailDialog = ({ card, open, onOpenChange }: Props) => {
  const { updateKanbanCard, deleteKanbanCard, triggerAICorrection, fixDescriptionWithAI, loggedUserId, loggedUserName } = useApp();
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
  const { systemUsers } = useApp();
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    let updates: Partial<KanbanCardType> = { images: newImgs };
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

  const toggleAssignee = (user: any) => {
    const exists = assignedUsers.some(u => u.id === user.id);
    let newList;
    if (exists) {
      newList = assignedUsers.filter(u => u.id !== user.id);
    } else {
      newList = [...assignedUsers, { id: user.id, fullName: user.fullName, avatarUrl: user.avatarUrl }];
    }
    setAssignedUsers(newList);
    saveUpdates({ assignedUsers: newList }, exists ? `Removeu o membro ${user.fullName}` : `Adicionou o membro ${user.fullName}`);
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

          {/* Cover Header */}
          {coverImage && (
            <div className="w-full h-48 bg-black/50 relative overflow-hidden group flex-shrink-0">
              <img src={coverImage} alt="Capa" className="w-full h-full object-cover opacity-80" />
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

          <div className="flex flex-1 overflow-hidden">
            {/* Left Column (Main Content) */}
            <div className={`flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 space-y-8 ${coverImage ? 'pt-6' : ''}`}>
              <div className="flex items-start gap-4">
                <Circle className="w-6 h-6 text-white/40 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <Input
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    onBlur={() => { if (clientName !== card.clientName) saveUpdates({ clientName }, 'Alterou o nome do card') }}
                    className="text-2xl font-bold bg-transparent border-transparent px-0 hover:bg-white/5 focus-visible:bg-white/5 h-auto py-1 rounded-sm focus-visible:ring-0 shadow-none text-white w-full uppercase"
                  />
                  <p className="text-xs text-white/40 mt-1 pl-0.5">na coluna <span className="underline decoration-white/20 underline-offset-2 font-medium text-white/60">{card.column}</span></p>
                </div>
              </div>

              <div className="pl-10 space-y-10">
                {/* Labels & Assignees & Timer */}
                <div className="flex flex-wrap items-start gap-8">
                  {/* Labels */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-2">Etiquetas</h3>
                    <div className="flex flex-wrap gap-2">
                      {labels.map(l => (
                        <span key={l} className="group flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold tracking-wider text-white rounded bg-red-600/90 hover:bg-red-600 transition-colors cursor-pointer">
                          {l}
                          <X className="w-3 h-3 opacity-0 group-hover:opacity-100 hover:text-white/70" onClick={() => removeLabel(l)} />
                        </span>
                      ))}
                      <div className="flex items-center gap-1">
                        <Input
                          value={newLabelText}
                          onChange={e => setNewLabelText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') addLabel(); }}
                          placeholder="Adicionar..."
                          className="w-24 h-7 text-[10px] bg-white/5 border-white/10 rounded px-2 focus-visible:ring-0 text-white"
                        />
                        <Button variant="ghost" size="icon" className="h-7 w-7 bg-white/5 hover:bg-white/10 rounded border-white/10" onClick={addLabel}><Plus className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                  </div>

                  {/* Membros */}
                  <div className="flex flex-col">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-2">Membros</h3>
                    <div className="flex flex-wrap items-center gap-2">
                      {assignedUsers.map(u => (
                        <div key={u.id} className="relative group/member">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-600 to-rose-700 font-bold text-white text-xs flex items-center justify-center flex-shrink-0 shadow-inner group-hover/member:opacity-80 transition cursor-pointer" title={u.fullName}>
                            {u.fullName.substring(0, 2).toUpperCase()}
                          </div>
                          <button onClick={() => toggleAssignee(u)} className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center opacity-0 group-hover/member:opacity-100 transition shadow hover:bg-red-500 hover:scale-110">
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ))}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 p-0 shadow flex items-center justify-center">
                            <Plus className="w-4 h-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-60 bg-[#1C1C1E] border-white/10 text-white p-2">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-3 px-2">Atribuir Pessoa</h4>
                          <div className="max-h-60 overflow-y-auto">
                            {systemUsers.map(su => {
                              const isSelected = assignedUsers.some(au => au.id === su.id);
                              return (
                                <div key={su.id} onClick={() => toggleAssignee(su)} className="flex items-center justify-between p-2 hover:bg-white/5 cursor-pointer rounded-lg transition-colors group">
                                  <div className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center text-[10px] font-bold">
                                      {su.fullName.substring(0, 2).toUpperCase()}
                                    </div>
                                    <span className="text-sm font-medium">{su.fullName}</span>
                                  </div>
                                  {isSelected && <CheckSquare className="w-4 h-4 text-primary" />}
                                </div>
                              );
                            })}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  {/* Timer */}
                  <div className="flex flex-col">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-2">Tempo Gasto</h3>
                    <div className="bg-white/5 px-3 py-1.5 rounded flex items-center w-fit border border-white/10">
                      <Clock className="w-3.5 h-3.5 text-white/50 mr-2" />
                      <Timer timeSpent={card.timeSpent} timerRunning={card.timerRunning} timerStart={card.timerStart} onToggle={() => {
                        const now = Date.now();
                        if (card.timerRunning) {
                          const elapsed = card.timerStart ? Math.floor((now - card.timerStart) / 1000) : 0;
                          saveUpdates({ timerRunning: false, timeSpent: card.timeSpent + elapsed, timerStart: undefined }, "Parou o timer");
                        } else {
                          saveUpdates({ timerRunning: true, timerStart: now }, "Iniciou o timer");
                        }
                      }} />
                    </div>
                  </div>
                </div>

                {/* AI REPORT */}
                {(card.aiStatus === 'analyzing' || card.aiStatus === 'issues_found' || card.aiStatus === 'approved') && (
                  <div className={`rounded-2xl border p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-500 ${card.aiStatus === 'analyzing' ? 'bg-blue-500/5 border-blue-500/20' : card.aiStatus === 'approved' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold flex items-center gap-2 text-white/90">
                        <Bot className={`w-5 h-5 ${card.aiStatus === 'analyzing' ? 'text-blue-400 animate-pulse' : card.aiStatus === 'approved' ? 'text-emerald-400' : 'text-amber-400'}`} />
                        Relatório da IA Auditora
                      </h3>
                      <div className="flex items-center gap-2">
                        {card.aiStatus === 'issues_found' && (
                          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-500/20 border border-red-500/20 text-red-400 text-[9px] font-black uppercase tracking-widest animate-pulse">
                            <AlertTriangle className="w-3 h-3" /> PRECISA DE ALTERAÇÃO
                          </div>
                        )}
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${card.aiStatus === 'analyzing' ? 'bg-blue-500/20 text-blue-400' : card.aiStatus === 'approved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                          {card.aiStatus === 'analyzing' ? 'Analisando...' : card.aiStatus === 'approved' ? 'Aprovado' : 'Pendências'}
                        </span>
                      </div>
                    </div>

                    {card.aiStatus === 'issues_found' && (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                        <p className="text-[11px] text-red-300 font-bold flex items-center gap-2">
                          <X className="w-3.5 h-3.5" /> Atenção: O card foi movido para a coluna de Alteração devido às inconsistências abaixo.
                        </p>
                      </div>
                    )}

                    {card.aiStatus === 'approved' && (
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                        <p className="text-[11px] text-emerald-400 font-bold flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Tudo certo! A IA conferiu os dados e as imagens estão batendo com o texto.
                        </p>
                      </div>
                    )}

                    {card.aiStatus === 'analyzing' ? (
                      <div className="py-4 space-y-3">
                        <div className="flex items-center gap-3">
                          <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                          <p className="text-xs text-white/40 italic">A IA está conferindo os preços e imagens com a descrição...</p>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500/40 animate-progress origin-left" style={{ width: '60%' }} />
                        </div>
                      </div>
                    ) : card.aiReport && (
                      <div className="space-y-4">
                        {/* New Professional Report Format */}
                        {card.aiReport.report ? (
                          <div className="p-4 rounded-xl bg-black/40 border border-white/5 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-white/80 overflow-x-auto">
                            {card.aiReport.report}
                          </div>
                        ) : (
                          <>
                            {/* Fallback for old report format */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {(card.aiReport.checklist || []).map((check: any, idx: number) => (
                                <div key={idx} className="flex gap-3 p-3 rounded-xl bg-black/20 border border-white/5 items-start">
                                  <span className="text-sm mt-0.5">{check.status}</span>
                                  <div>
                                    <p className="text-[11px] font-bold text-white/80">{check.item}</p>
                                    <p className="text-[10px] text-white/40 leading-relaxed">{check.observation}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                            {card.aiReport.summary && (
                              <p className="text-[12px] text-white/60 leading-relaxed italic border-l-2 border-white/10 pl-4 py-1">
                                "{card.aiReport.summary}"
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Description */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[14px] font-bold flex items-center gap-2 text-white/90">
                      <LayoutList className="w-5 h-5 text-white/60" /> Descrição
                    </h3>
                    {!isEditingDesc && (
                      <Button variant="ghost" size="sm" onClick={() => setIsEditingDesc(true)} className="bg-white/5 hover:bg-white/10 text-xs px-4 h-8 rounded border border-white/5">Editar</Button>
                    )}
                  </div>
                  {isEditingDesc ? (
                    <div className="space-y-3">
                      <Textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="Adicione uma descrição detalhada..."
                        className="bg-black/20 border border-white/10 min-h-[140px] text-[13px] rounded-lg focus-visible:ring-red-500 shadow-inner resize-y"
                        rows={Math.max(6, description.split('\n').length + 1)}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button onClick={handleSaveDescription} size="sm" className="bg-red-600 hover:bg-red-700">Salvar</Button>
                        <Button onClick={() => setIsEditingDesc(false)} variant="ghost" size="sm">Cancelar</Button>
                      </div>
                    </div>
                  ) : (
                    <div onClick={() => setIsEditingDesc(true)} className={`text-[13px] rounded-lg p-3 whitespace-pre-wrap cursor-pointer transition-colors border ${description ? 'border-transparent hover:bg-white/5' : 'border-white/5 bg-white/5 hover:bg-white/10 text-white/50 min-h-[60px] flex items-center'}`}>
                      {description || "Clique para adicionar uma descrição..."}
                    </div>
                  )}
                </div>

                {/* Checklist */}
                <div className="space-y-4">
                  <h3 className="text-[14px] font-bold flex items-center gap-2 text-white/90">
                    <CheckSquare className="w-5 h-5 text-white/60" /> Checklist
                  </h3>
                  {checklists.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-white/40 font-mono w-8 text-right">{checklistProgress}%</span>
                        <div className="h-1.5 flex-1 bg-white/5 rounded-full overflow-hidden">
                          <div className={`h-full transition-all duration-500 ${checklistProgress === 100 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${checklistProgress}%` }} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        {checklists.map(item => (
                          <div key={item.id} className="group flex items-start gap-3 py-2 px-2 rounded-lg hover:bg-white/5 transition-colors">
                            <Checkbox checked={item.completed} onCheckedChange={(c) => toggleChecklist(item.id, c as boolean)} className="mt-0.5 border-white/20 data-[state=checked]:bg-emerald-500" />
                            <span className={`text-[13px] flex-1 ${item.completed ? 'line-through text-white/40' : 'text-white/90'}`}>{item.title}</span>
                            <Button variant="ghost" size="icon" onClick={() => deleteChecklistItem(item.id)} className="w-6 h-6 text-white/30 opacity-0 group-hover:opacity-100 hover:text-red-400">
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Input value={newChecklistTitle} onChange={e => setNewChecklistTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addChecklistItem(); }} placeholder="Novo item..." className="bg-white/5 border-white/10 text-sm h-9" />
                    <Button onClick={addChecklistItem} variant="secondary" className="h-9 px-4">Add</Button>
                  </div>
                </div>

                {/* Attachments */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[14px] font-bold flex items-center gap-2 text-white/90">
                      <Paperclip className="w-5 h-5 text-white/60" /> Anexos
                    </h3>
                    <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} className="text-xs bg-white/5">Adicionar</Button>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleImagesUpload(e.target.files)} />
                  {localImages.length > 0 && (
                    <div className="grid grid-cols-2 gap-4">
                      {localImages.map((img, i) => (
                        <div key={i} className="group relative rounded-xl overflow-hidden bg-black/40 border border-white/10 aspect-video">
                          <img src={img} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <Button size="icon" variant="ghost" onClick={() => setPreviewIndex(i)}><ZoomIn className="w-4 h-4" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => removeImage(i)} className="text-red-400"><Trash2 className="w-4 h-4" /></Button>
                            {coverImage !== img && <Button variant="ghost" size="sm" className="text-[10px]" onClick={() => setAsCover(img)}>Usar Capa</Button>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column (Sidebar / Activity) */}
            <div className="w-[30%] min-w-[320px] bg-[#1a1a1c] border-l border-white/5 flex flex-col pt-8">
              <h3 className="text-sm font-bold flex items-center gap-2 px-6 mb-5 text-white/90">
                <MessageSquare className="w-4 h-4 text-white/60" /> Atividade
              </h3>

              <div className="px-6 mb-6">
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                  <Textarea
                    placeholder="Escrever comentário..."
                    className="min-h-[60px] text-[13px] bg-transparent border-none p-0 focus-visible:ring-0 resize-none placeholder:text-white/30"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                  />
                  <div className="flex justify-end mt-2">
                    <Button size="sm" onClick={addComment} disabled={!newComment.trim()} className="bg-white hover:bg-gray-200 text-black h-7 text-xs px-4 rounded-lg font-bold">Salvar</Button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar px-6 space-y-6 pb-8">
                {(() => {
                  const mixed: any[] = [
                    ...comments.map(c => ({ ...c, type: 'comment' })),
                    ...(card.history || []).map(h => ({ ...h, type: 'history' }))
                  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                  if (mixed.length === 0) return <p className="text-[11px] text-white/20 text-center py-8 italic">Nenhuma atividade registrada</p>;

                  return mixed.map(item => {
                    if (item.type === 'comment') {
                      return (
                        <div key={item.id} className="flex gap-3">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                            {item.userName.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-[11px] font-bold text-white/80">{item.userName} <span className="font-normal text-white/30 ml-2">{getRelativeTime(item.createdAt)}</span></p>
                            <div className="text-[12px] text-white/70 bg-white/5 border border-white/5 p-2.5 rounded-xl rounded-tl-none mt-1.5 whitespace-pre-wrap leading-relaxed">
                              {item.text}
                            </div>
                          </div>
                        </div>
                      );
                    }
                    const iconMap: any = { move: <ArrowRight />, create: <Plus />, image_add: <ImageIcon />, image_remove: <Trash2 />, edit: <Edit3 />, status_change: <CheckCircle2 /> };
                    return (
                      <div key={item.id} className="flex gap-3 items-start opacity-60">
                        <div className="w-6 h-6 rounded flex items-center justify-center text-white/50 mt-0.5">
                          {iconMap[item.actionType] || <History className="w-3.5 h-3.5" />}
                        </div>
                        <div className="text-[11px] text-white/50">
                          <span className="font-bold text-white/80">{item.userName}</span> {item.description}
                          <p className="text-[10px] text-white/20 mt-0.5">{getRelativeTime(item.createdAt)}</p>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              <div className="p-4 border-t border-white/5">
                <Button variant="ghost" onClick={() => triggerAICorrection(card.id)} className="w-full justify-start text-[11px] text-amber-400/60 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg h-8 mb-1">
                  <Bot className="w-3.5 h-3.5 mr-2" /> Corrigir Imagem (Auditoria)
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" className="w-full justify-start text-[11px] text-purple-400/60 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg h-8 mb-1">
                      <Sparkles className="w-3.5 h-3.5 mr-2" /> Corrigir Descrição
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 glass-card border-white/10 p-2" align="start">
                    <div className="space-y-1">
                      <Button 
                        variant="ghost" 
                        className="w-full justify-start text-[11px] h-9 hover:bg-white/5"
                        onClick={() => fixDescriptionWithAI(card.id, 'keep_sequence')}
                      >
                        <LayoutList className="w-3.5 h-3.5 mr-2 text-purple-400" />
                        <div>
                          <p className="font-bold text-left">Manter Sequência</p>
                          <p className="text-[9px] text-white/40">Corrige apenas o texto e gramática</p>
                        </div>
                      </Button>
                      <Button 
                        variant="ghost" 
                        className="w-full justify-start text-[11px] h-9 hover:bg-white/5"
                        onClick={() => fixDescriptionWithAI(card.id, 'organize')}
                      >
                        <LayoutList className="w-3.5 h-3.5 mr-2 text-emerald-400" />
                        <div>
                          <p className="font-bold text-left">Sequência Organizada</p>
                          <p className="text-[9px] text-white/40">Separa por Hortifruti, Carnes, etc.</p>
                        </div>
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
                <Button variant="ghost" onClick={() => setShowDeleteConfirm(true)} className="w-full justify-start text-[11px] text-red-400/60 hover:text-red-400 hover:bg-red-500/10 rounded-lg h-8">
                  <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir permanentemente
                </Button>
              </div>
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
