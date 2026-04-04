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
import { Trash2, Upload, X, ZoomIn, Save, Clock, History, CheckSquare, Paperclip, MessageSquare, Image as ImageIcon, Circle, CheckCircle2, MoreHorizontal, Plus, LayoutList, Users, Loader2, ArrowRight, Edit3, Bot } from 'lucide-react';
import { compressImage } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';

interface Props {
  card: KanbanCardType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CardDetailDialog = ({ card, open, onOpenChange }: Props) => {
  const { updateKanbanCard, deleteKanbanCard, loggedUserId, loggedUserName } = useApp();
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
  
  const [previewImage, setPreviewImage] = useState<string | null>(null);
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
      // Pick another image as cover if possible
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

  // Checklists
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

  // Comments
  const addComment = () => {
    if (!newComment.trim()) return;
    const comment = { id: crypto.randomUUID(), text: newComment, userId: loggedUserId || 'unknown', userName: loggedUserName || 'Usuário', createdAt: new Date().toISOString() };
    const newList = [comment, ...comments]; // new comments on top
    setComments(newList);
    setNewComment("");
    saveUpdates({ comments: newList }, "Comentou no card");
  };

  // Labels
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

  // Assignees
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

  // Relative Time text
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
                  {previewInitial && <img src={previewInitial} className="w-32 h-32 object-cover rounded-xl border-2 border-white/10 opacity-80 shadow-2xl mt-2" />}
                </>
              ) : (
                <>
                  <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                  <h2 className="text-xl font-bold text-white mb-2 tracking-wider uppercase">Enviando arquivos... {uploadProgress}%</h2>
                  <div className="w-64 h-2 bg-white/10 rounded-full mt-2 overflow-hidden mb-6">
                     <div className="h-full bg-primary transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  {previewInitial && <div className="p-1 rounded-xl bg-white/5 border border-white/5 shadow-2xl"><img src={previewInitial} className="w-24 h-24 object-cover rounded-lg blur-[2px] opacity-60" /></div>}
                </>
              )}
            </div>
          )}

              {/* Cover Header */}
              {coverImage && (
                <div className="w-full h-48 bg-black/50 relative overflow-hidden group">
                  <img src={coverImage} alt="Capa" className="w-full h-full object-cover opacity-80" />
                  <button 
                    onClick={() => setPreviewImage(coverImage)} 
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
              {/* Title Section */}
              <div className="flex items-start gap-4">
                <Circle className="w-6 h-6 text-white/40 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <Input 
                    value={clientName} 
                    onChange={e => setClientName(e.target.value)} 
                    onBlur={() => { if(clientName !== card.clientName) saveUpdates({ clientName }, 'Alterou o nome do card') }}
                    className="text-2xl font-bold bg-transparent border-transparent px-0 hover:bg-white/5 focus-visible:bg-white/5 h-auto py-1 rounded-sm focus-visible:ring-0 shadow-none text-white w-full uppercase"
                  />
                  <p className="text-xs text-white/40 mt-1 pl-0.5">na coluna <span className="underline decoration-white/20 underline-offset-2 font-medium text-white/60">{card.column}</span></p>
                </div>
              </div>

              {/* Flex Section: Labels & Assignees */}
              <div className="pl-10 space-y-6">
                <div className="flex flex-wrap items-start gap-6">
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
                        <PopoverContent className="w-60 bg-[#1C1C1E] border-white/10 text-white p-2 ml-4">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-3 px-2">Atribuir Pessoa</h4>
                          <div className="max-h-60 overflow-y-auto">
                            {systemUsers.map(su => {
                              const isSelected = assignedUsers.some(au => au.id === su.id);
                              return (
                                <div 
                                  key={su.id} 
                                  className="flex items-center justify-between p-2 hover:bg-white/5 cursor-pointer rounded-lg transition-colors group"
                                  onClick={() => toggleAssignee(su)}
                                >
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
                            {systemUsers.length === 0 && (
                              <p className="text-xs text-white/40 px-2 py-4 text-center">Nenhum membro do sistema disponível.</p>
                            )}
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
                               {/* AI REPORT (Standardized Checklist) */}
                {card.aiReport && (card.aiStatus === 'issues_found' || card.aiStatus === 'approved') && (
                  <div className={`mb-6 p-6 rounded-[1.2rem] border transition-all duration-500 shadow-xl ${card.aiStatus === 'approved' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className={`font-bold flex items-center gap-2 text-sm uppercase tracking-widest ${card.aiStatus === 'approved' ? 'text-emerald-400' : 'text-red-400'}`}>
                        <Bot className="w-5 h-5" /> 
                        Relatório de Auditoria IA
                      </h3>
                      <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${card.aiStatus === 'approved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                        {card.aiStatus === 'approved' ? 'Conforme' : 'Divergente'}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Descrição */}
                      <div className="bg-black/20 p-3.5 rounded-xl border border-white/5 group hover:border-white/10 transition-colors">
                        <div className="text-[10px] uppercase font-bold text-white/40 mb-1.5 tracking-tighter">Descrição</div>
                        <div className="text-[13px] text-white/90 font-medium">{card.aiReport.descriptionStatus || '✅ OK'}</div>
                      </div>

                      {/* Preço */}
                      <div className="bg-black/20 p-3.5 rounded-xl border border-white/5 group hover:border-white/10 transition-colors">
                        <div className="text-[10px] uppercase font-bold text-white/40 mb-1.5 tracking-tighter">Preço</div>
                        <div className="text-[13px] text-white/90 font-medium">{card.aiReport.priceStatus || '✅ OK'}</div>
                      </div>

                      {/* Imagem */}
                      <div className="bg-black/20 p-3.5 rounded-xl border border-white/5 group hover:border-white/10 transition-colors">
                        <div className="text-[10px] uppercase font-bold text-white/40 mb-1.5 tracking-tighter">Imagem</div>
                        <div className="text-[13px] text-white/90 font-medium">{card.aiReport.imageStatus || '✅ OK'}</div>
                      </div>

                      {/* Data */}
                      <div className="bg-black/20 p-3.5 rounded-xl border border-white/5 group hover:border-white/10 transition-colors">
                        <div className="text-[10px] uppercase font-bold text-white/40 mb-1.5 tracking-tighter">Data de Validade</div>
                        <div className="text-[13px] text-white/90 font-medium">{card.aiReport.dateStatus || '❌ Não encontrada'}</div>
                      </div>
                    </div>

                    {card.aiReport.summary && (
                      <div className="mt-5 pt-4 border-t border-white/5">
                         <p className="text-[12px] text-white/50 italic leading-relaxed">Nota: {card.aiReport.summary}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Description */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[14px] font-bold flex items-center gap-2"><LayoutList className="w-5 h-5 text-white/60" /> Descrição</h3>
                    {!isEditingDesc && (
                      <Button variant="ghost" size="sm" onClick={() => setIsEditingDesc(true)} className="bg-white/5 hover:bg-white/10 text-xs px-4 h-8 rounded border border-white/5">Editar</Button>
                    )}
                  </div>
                  
                  {isEditingDesc ? (
                    <div className="space-y-2">
                      <Textarea
                        ref={(e) => {
                          if (e) {
                            e.style.height = "auto";
                            e.style.height = e.scrollHeight + 5 + "px";
                          }
                        }}
                        value={description}
                        onChange={e => {
                          setDescription(e.target.value);
                          e.target.style.height = "auto";
                          e.target.style.height = e.target.scrollHeight + 5 + "px";
                        }}
                        placeholder="Adicione uma descrição mais detalhada..."
                        className="bg-black/20 border border-white/10 min-h-[140px] text-[13px] rounded-lg focus-visible:ring-red-500 shadow-inner overflow-hidden resize-none"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button onClick={handleSaveDescription} size="sm" className="bg-red-600 hover:bg-red-700 text-white rounded">Salvar</Button>
                        <Button onClick={() => { setIsEditingDesc(false); setDescription(card.description); }} variant="ghost" size="sm" className="hover:bg-white/10 text-white/70">Cancelar</Button>
                      </div>
                    </div>
                  ) : (
                    <div 
                      onClick={() => setIsEditingDesc(true)}
                      className={`text-[13px] rounded-lg p-3 whitespace-pre-wrap cursor-pointer transition-colors border ${description ? 'border-transparent hover:bg-white/5' : 'border-white/5 bg-white/5 hover:bg-white/10 text-white/50 min-h-[50px] flex items-center'}`}
                    >
                      {description || "Adicione uma descrição mais detalhada..."}
                    </div>
                  )}
                </div>

                {/* Checklist */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[14px] font-bold flex items-center gap-2"><CheckSquare className="w-5 h-5 text-white/60" /> Checklist</h3>
                  </div>
                  
                  {checklists.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs text-white/40 font-mono w-8 text-right">{checklistProgress}%</span>
                        <div className="h-2 flex-1 bg-white/5 rounded-full overflow-hidden">
                          <div className={`h-full transition-all duration-300 ${checklistProgress === 100 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${checklistProgress}%` }} />
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        {checklists.map(item => (
                          <div key={item.id} className="group flex items-start gap-3 py-1 px-1 rounded hover:bg-white/5 transition-colors">
                            <Checkbox 
                              checked={item.completed} 
                              onCheckedChange={(checked) => toggleChecklist(item.id, checked as boolean)} 
                              className={`mt-1 border-white/20 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-none`} 
                            />
                            <span className={`text-[13px] flex-1 mt-0.5 ${item.completed ? 'line-through text-white/40' : 'text-white/90'}`}>{item.title}</span>
                            <Button variant="ghost" size="icon" onClick={() => deleteChecklistItem(item.id)} className="w-6 h-6 text-white/30 opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-500/10">
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 mt-2">
                    <Input 
                      value={newChecklistTitle} 
                      onChange={e => setNewChecklistTitle(e.target.value)} 
                      onKeyDown={(e) => { if (e.key === 'Enter') addChecklistItem(); }}
                      placeholder="Adicionar item tático..." 
                      className="bg-white/5 border-white/10 text-sm h-9 rounded text-white focus-visible:ring-red-500"
                    />
                    <Button onClick={addChecklistItem} variant="secondary" className="h-9 px-4 rounded bg-white/10 hover:bg-white/20 text-white border-none">Adicionar</Button>
                  </div>
                </div>

                {/* Attachments */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[14px] font-bold flex items-center gap-2"><Paperclip className="w-5 h-5 text-white/60" /> Anexos</h3>
                    <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} className="bg-white/5 hover:bg-white/10 text-xs px-3 h-8 rounded border border-white/5">Adicionar</Button>
                  </div>
                  
                  <div
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`transition-all ${isDragging ? 'bg-white/5 border border-dashed border-red-500 rounded-xl p-4' : ''}`}
                  >
                    <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleImagesUpload(e.target.files)} />
                    
                    {localImages.length > 0 ? (
                      <div className="space-y-3">
                        {localImages.map((img, i) => {
                          const isCover = coverImage === img;
                          return (
                            <div key={i} className="flex gap-4 p-2 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/5 group">
                              <div className="w-24 h-16 rounded overflow-hidden bg-black/40 border border-white/10 flex-shrink-0 cursor-pointer shadow-lg active:scale-95 transition-transform" onClick={() => setPreviewImage(img)}>
                                <img src={img} alt="Anexo" className="w-full h-full object-cover" />
                              </div>
                              <div className="flex flex-col justify-center flex-1">
                                <p className="text-[13px] font-bold text-white/90">Anexo {(i+1).toString().padStart(2, '0')}.png</p>
                                <div className="flex items-center gap-3 mt-1.5">
                                  {isCover ? (
                                    <span className="text-[11px] text-white/40 flex items-center gap-1"><CheckSquare className="w-3 h-3" /> Capa</span>
                                  ) : (
                                    <span className="text-[11px] text-white/40 cursor-pointer hover:underline hover:text-white" onClick={() => setAsCover(img)}>Fazer Capa</span>
                                  )}
                                  <span className="text-[11px] text-white/40 cursor-pointer hover:text-red-400 hover:underline" onClick={() => removeLabel(img)} onClickCapture={() => removeImage(i)}>Excluir</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      !isDragging && <p className="text-[13px] text-white/40 py-2">Nenhum anexo encontrado. Pode arrastar imagens para cá se quiser.</p>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* Right Column (Sidebar / Activity) */}
            <div className="w-[30%] min-w-[320px] bg-[#1a1a1c] border-l border-white/5 p-6 flex flex-col pt-8">
               <h3 className="text-sm font-bold flex items-center gap-2 mb-5 text-white border-b border-white/10 pb-4"><MessageSquare className="w-4 h-4 text-white/60" /> Comentários e Atividade</h3>
               
               <div className="mb-6 bg-white/5 p-3 rounded-xl border border-white/5">
                 <Textarea 
                   placeholder="Escrever um comentário..." 
                   className="min-h-[60px] max-h-[150px] text-[13px] bg-transparent border-none p-0 focus-visible:ring-0 resize-y mb-2 placeholder:text-white/30"
                   value={newComment}
                   onChange={(e) => setNewComment(e.target.value)}
                 />
                 <div className="flex justify-end">
                   <Button size="sm" onClick={addComment} disabled={!newComment.trim()} className="bg-white hover:bg-gray-200 text-black h-7 text-xs px-4 rounded font-bold">Salvar</Button>
                 </div>
               </div>

               {/* Stream of history and comments */}
               <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-5">
                 {/* Mix comments and history. Sort by date desc */}
                 {(() => {
                    const mixed: any[] = [
                      ...comments.map(c => ({ ...c, type: 'comment' })),
                      ...(card.history || []).map(h => ({ ...h, type: 'history' }))
                    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                    return mixed.map(item => {
                      if (item.type === 'comment') {
                        return (
                          <div key={item.id} className="flex gap-3">
                            <div className="w-7 h-7 rounded-sm bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                              {item.userName.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                               <p className="text-[12px] font-bold text-white leading-tight">
                                 {item.userName} <span className="font-normal text-white/40 ml-1.5">{getRelativeTime(item.createdAt)}</span>
                               </p>
                               <div className="text-[13px] text-white/80 bg-white/5 border border-white/5 p-2.5 rounded-lg mt-1.5 rounded-tl-none leading-relaxed whitespace-pre-wrap">
                                 {item.text}
                               </div>
                            </div>
                          </div>
                        );
                      } else {
                        // Action History — color-coded by type
                        const iconMap: Record<string, React.ReactNode> = {
                          'move': <ArrowRight className="w-3 h-3" />,
                          'create': <Plus className="w-3 h-3" />,
                          'image_add': <ImageIcon className="w-3 h-3" />,
                          'image_remove': <Trash2 className="w-3 h-3" />,
                          'edit': <Edit3 className="w-3 h-3" />,
                          'status_change': <CheckCircle2 className="w-3 h-3" />,
                        };
                        const bgMap: Record<string, string> = {
                          'move': 'bg-blue-500/10 text-blue-400',
                          'create': 'bg-emerald-500/10 text-emerald-400',
                          'image_add': 'bg-purple-500/10 text-purple-400',
                          'image_remove': 'bg-red-500/10 text-red-400',
                          'edit': 'bg-white/10 text-white/60',
                          'status_change': 'bg-amber-500/10 text-amber-400',
                        };
                        return (
                          <div key={item.id} className="flex gap-3 items-start opacity-80 pl-[1px]">
                            <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 ${bgMap[item.actionType] || 'bg-white/10 text-white/60'}`}>
                               {iconMap[item.actionType] || <History className="w-3 h-3" />}
                            </div>
                            <div className="text-[12px] text-white/60">
                               <span className="font-bold text-white/90">{item.userName}</span>{' '}
                               <span className="text-white/70">{item.description}</span>
                               <span className="text-[10px] text-white/30 ml-2">{getRelativeTime(item.createdAt)}</span>
                            </div>
                          </div>
                        );
                      }
                    });
                 })()}
                 
                 {(!comments.length && !card.history?.length) && (
                   <p className="text-[12px] text-white/30 text-center py-10">— Nenhum registro de atividade —</p>
                 )}
               </div>
               
               {/* Danger Zone at Bottom of Sidebar */}
               <div className="mt-4 pt-4 border-t border-white/10">
                 <Button variant="ghost" onClick={() => setShowDeleteConfirm(true)} className="w-full justify-start text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg">
                   <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir permanentemente
                 </Button>
               </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image preview */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="glass-card bg-[#0a0a0c]/95 border-border/50 max-w-[80vw] p-0 shadow-[0_0_50px_rgba(0,0,0,0.8)] border-none overscroll-none overflow-hidden">
          <DialogHeader className="sr-only"><DialogTitle>Preview</DialogTitle></DialogHeader>
          {previewImage && <img src={previewImage} alt="" className="w-full h-auto max-h-[90vh] object-contain" onClick={() => setPreviewImage(null)} />}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-[#1C1C1E] border-white/10 text-white shadow-2xl rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir card</AlertDialogTitle>
            <AlertDialogDescription className="text-white/50 text-[13px]">
              Tem certeza que deseja excluir o card <strong>{card.clientName}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 hover:bg-white/10 border-none text-white rounded-lg">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700 rounded-lg" onClick={() => { deleteKanbanCard(card.id); onOpenChange(false); }}>
              Sim, Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default CardDetailDialog;
