import { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '@/contexts/useApp';
import { FIXED_COLUMN_KEYS, KanbanCard as KanbanCardType } from '@/contexts/app-types';
import KanbanColumn from '@/features/kanban/components/KanbanColumn';
import KanbanCard from '@/features/kanban/components/KanbanCard';
import React, { lazy, Suspense } from 'react';
const CardDetailDialog = lazy(() => import('@/features/kanban/components/CardDetailDialog'));
import { 
  ArrowLeft, 
  Camera, 
  Archive, 
  Loader2, 
  Plus, 
  Search, 
  Trash2, 
  Calendar, 
  CheckSquare, 
  Square, 
  FileText, 
  ExternalLink, 
  X, 
  Check,
  Folder,
  FolderCheck,
  FolderPlus,
  ChevronDown,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useDraggableScroll } from '@/hooks/useDraggableScroll';
import { useIsMobile } from '@/hooks/useIsMobile';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { KanbanBoardDndContext } from '@/features/kanban/components/KanbanBoardDndContext';
import { MobileKanbanBoard } from '@/features/kanban/components/MobileKanbanBoard';
import { useCalendarTeamLinks, useEmployeeCalendarLoadout } from '@/features/calendar/hooks/useCalendarTeamData';

const COLUMN_COLORS = [
  { value: 'bg-info', label: 'Azul' },
  { value: 'bg-warning', label: 'Amarelo' },
  { value: 'bg-destructive', label: 'Vermelho' },
  { value: 'bg-success', label: 'Verde' },
  { value: 'bg-primary', label: 'Primário' },
  { value: 'bg-muted-foreground', label: 'Cinza' },
];

const Employee = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const cardIdFromUrl = searchParams.get('cardId');
  const [selectedCardFromUrl, setSelectedCardFromUrl] = useState<KanbanCardType | null>(null);
  const { employees, calendarClients, kanbanCards, updateEmployee, getColumnsForEmployee, addKanbanColumn, updateKanbanColumn, deleteKanbanColumn, deleteEmployee, loggedUserRole, loading, memberFilter } = useApp();
  const { ref: scrollRef, onMouseDown } = useDraggableScroll();
  const isMobile = useIsMobile();

  // Vínculo de clientes do calendário + Loadout (Subpastas & Rascunho sempre visível)
  const { links, toggleClientEmployee, getEmployeeClients } = useCalendarTeamLinks();
  const {
    loadout,
    updateNotes,
    addFolder,
    removeFolder,
    addClientToFolder,
    addMultipleClientsToFolder,
    toggleClientInFolder,
    removeClientFromFolder,
  } = useEmployeeCalendarLoadout(id);

  // No mobile, começa FECHADO (só abre se clicar no botão). No desktop, começa ABERTO.
  const [showCalendarPanel, setShowCalendarPanel] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      return false;
    }
    return true;
  });

  useEffect(() => {
    if (isMobile) {
      setShowCalendarPanel(false);
    }
  }, [isMobile]);

  // Estados para gerenciar as Pastas / Temas do Loadout
  const [newFolderTitle, setNewFolderTitle] = useState('');
  const [newFolderDate, setNewFolderDate] = useState('');
  const [showNewFolderForm, setShowNewFolderForm] = useState(false);
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const [clientInputPerFolder, setClientInputPerFolder] = useState<Record<string, string>>({});
  const [folderToDelete, setFolderToDelete] = useState<{ id: string; title: string } | null>(null);

  const linkedClients = useMemo(() => {
    if (!id) return [];
    const clientIds = getEmployeeClients(id);
    return calendarClients.filter(c => clientIds.includes(c.id));
  }, [id, getEmployeeClients, calendarClients, links]);

  // Contagem de pendências dentro das subpastas e temas
  const pendingTasksCount = useMemo(() => {
    return (loadout.folders || []).reduce((acc, folder) => {
      const pendingInFolder = folder.clients.filter(c => !c.completed).length;
      return acc + pendingInFolder;
    }, 0);
  }, [loadout.folders]);

  const toggleFolderOpen = (folderId: string) => {
    setOpenFolders(prev => ({
      ...prev,
      [folderId]: prev[folderId] === undefined ? false : !prev[folderId],
    }));
  };

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderTitle.trim()) return;
    addFolder(newFolderTitle.trim(), newFolderDate || undefined);
    setNewFolderTitle('');
    setNewFolderDate('');
    setShowNewFolderForm(false);
  };

  const handleAddClientToFolder = (folderId: string, clientName: string, clientId?: string) => {
    if (!clientName.trim()) return;
    addClientToFolder(folderId, clientName.trim(), clientId);
    setClientInputPerFolder(prev => ({ ...prev, [folderId]: '' }));
  };

  useEffect(() => {
    if (cardIdFromUrl && kanbanCards.length > 0) {
      const found = kanbanCards.find(c => c.id === cardIdFromUrl);
      if (found) {
        setSelectedCardFromUrl(found);
      }
    }
  }, [cardIdFromUrl, kanbanCards]);

  const [showAddCol, setShowAddCol] = useState(false);
  const [newColTitle, setNewColTitle] = useState('');
  const [newColColor, setNewColColor] = useState('bg-primary');
  const [editCol, setEditCol] = useState<string | null>(null);
  const [editColTitle, setEditColTitle] = useState('');
  const [editColColor, setEditColColor] = useState('');
  const [deleteColTarget, setDeleteColTarget] = useState<string | null>(null);
  const [showDeleteEmployee, setShowDeleteEmployee] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const employee = useMemo(() => employees.find(e => e.id === id), [employees, id]);

  const allCards = useMemo(() => kanbanCards.filter(c => c.employeeId === id && c.column !== 'postado'), [kanbanCards, id]);
  
  const cards = useMemo(() => {
    let filtered = allCards;
    
    if (memberFilter.length > 0) {
      filtered = filtered.filter(c => {
        const isAssigned = c.assignedUsers?.some(u => memberFilter.includes(u.id));
        const isEmployee = memberFilter.includes(c.employeeId);
        return isAssigned || isEmployee;
      });
    }

    if (searchQuery.trim()) {
      const normalize = (v?: string | null) =>
        (v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const q = normalize(searchQuery.trim());
      filtered = filtered.filter(c =>
        normalize(c.clientName).includes(q) ||
        normalize(c.description).includes(q) ||
        normalize(c.calendarClientName).includes(q)
      );
    }
    
    return filtered;
  }, [allCards, searchQuery, memberFilter]);

  // Oculta a coluna Postado do Kanban do usuário (centralizada apenas no Postagem)
  const columns = useMemo(() => employee ? getColumnsForEmployee(employee.id).filter(c => c.columnKey !== 'postado') : [], [employee, getColumnsForEmployee]);

  // Pre-group cards by column key to avoid O(n) filter per column
  const cardsByColumn = useMemo(() => {
    const grouped: Record<string, typeof cards> = {};
    columns.forEach(col => { grouped[col.columnKey] = []; });
    cards.forEach(card => {
      if (grouped[card.column]) grouped[card.column].push(card);
    });
    return grouped;
  }, [cards, columns]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !employee) return;
    const reader = new FileReader();
    reader.onload = () => updateEmployee(employee.id, { photoUrl: reader.result as string });
    reader.readAsDataURL(file);
  };

  const handleAddColumn = () => {
    if (!newColTitle.trim() || !employee) return;
    addKanbanColumn(employee.id, newColTitle.trim(), newColColor);
    setNewColTitle('');
    setNewColColor('bg-primary');
    setShowAddCol(false);
  };

  const handleEditColumn = () => {
    if (!editCol || !editColTitle.trim()) return;
    updateKanbanColumn(editCol, { title: editColTitle.trim(), color: editColColor });
    setEditCol(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="min-h-screen gradient-bg flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Funcionário não encontrado</p>
        <Button variant="outline" onClick={() => navigate('/')} className="rounded-xl">Voltar ao início</Button>
      </div>
    );
  }

  const loadoutPanelContent = (
    <>
      {/* Cabeçalho do Painel */}
      <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between bg-primary/5 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-primary/15 text-primary flex-shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-foreground truncate">
              Calendário & Loadout
            </h2>
            <p className="text-[10px] text-muted-foreground truncate">
              Lembretes institucionais e rascunho de {employee.name}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowCalendarPanel(false)}
          className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground flex-shrink-0 ml-2"
          title="Fechar painel"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 space-y-4 custom-scrollbar">
        {/* 1. CLIENTES VINCULADOS AO FUNCIONÁRIO NO CALENDÁRIO */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-primary" />
              Clientes no Calendário ({linkedClients.length})
            </span>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Vincular
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-60 bg-[#1C1C1E] border-white/10 text-white p-2 rounded-xl shadow-2xl z-50">
                <p className="text-xs font-bold px-2 py-1 border-b border-white/10 mb-1">
                  Clientes de {employee.name}
                </p>
                <div className="max-h-56 overflow-y-auto space-y-1 py-1">
                  {calendarClients.map(client => {
                    const isLinked = linkedClients.some(c => c.id === client.id);
                    return (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => toggleClientEmployee(client.id, employee.id)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                          isLinked ? 'bg-primary/20 text-white font-semibold' : 'hover:bg-white/5 text-white/70'
                        }`}
                      >
                        <span className="flex-1 text-left truncate">{client.name}</span>
                        {isLinked && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {linkedClients.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/50 p-2.5 text-center">
              <p className="text-[11px] text-muted-foreground">
                Nenhum cliente vinculado ainda. Clique em <strong>+ Vincular</strong> ou vincule lá na aba Calendário.
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {linkedClients.map(client => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => navigate(`/calendario/${client.id}`)}
                  title={`Abrir calendário de ${client.name}`}
                  className="group flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary/60 hover:bg-primary/20 border border-border/50 hover:border-primary/40 text-xs font-semibold text-foreground transition-all"
                >
                  {client.logoUrl ? (
                    <img src={client.logoUrl} alt={client.name} className="w-4 h-4 rounded-full object-cover" />
                  ) : (
                    <span className="w-4 h-4 rounded-full bg-primary/30 text-[9px] font-bold flex items-center justify-center">
                      {client.name.substring(0, 2).toUpperCase()}
                    </span>
                  )}
                  <span className="truncate max-w-[120px]">{client.name}</span>
                  <ExternalLink className="w-2.5 h-2.5 opacity-40 group-hover:opacity-100 text-primary" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 2. SUBPASTAS & CAMPANHAS INSTITUCIONAIS (TEMAS COM CLIENTES E CONTADOR) */}
        <div className="space-y-3 pt-2 border-t border-border/40">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-primary" />
              Subpastas & Campanhas ({(loadout.folders || []).length})
            </span>
            <button
              type="button"
              onClick={() => setShowNewFolderForm(prev => !prev)}
              className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Nova Pasta
            </button>
          </div>

          {/* Formulário para Criar Nova Subpasta / Tema */}
          {showNewFolderForm && (
            <form onSubmit={handleCreateFolder} className="space-y-2 bg-secondary/40 p-3 rounded-2xl border border-primary/30 animate-in slide-in-from-top-1 duration-150">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                  <FolderPlus className="w-3.5 h-3.5 text-primary" />
                  Criar Novo Tema / Subpasta
                </span>
                <button
                  type="button"
                  onClick={() => setShowNewFolderForm(false)}
                  className="text-muted-foreground hover:text-foreground p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <Input
                placeholder="Ex: Dia Nacional do Café, Consciência Negra..."
                value={newFolderTitle}
                onChange={e => setNewFolderTitle(e.target.value)}
                className="h-8 text-xs bg-background/70 border-border/60 rounded-xl"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={newFolderDate}
                  onChange={e => setNewFolderDate(e.target.value)}
                  className="h-8 px-2.5 text-[11px] rounded-xl bg-background/70 border border-border/60 text-foreground flex-1 min-w-0"
                  title="Data do tema / comemorativa (opcional)"
                />
                <Button
                  type="submit"
                  size="sm"
                  className="h-8 px-3 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold shrink-0"
                >
                  Criar Pasta
                </Button>
              </div>
            </form>
          )}

          {/* Lista de Subpastas */}
          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-0.5 custom-scrollbar">
            {(loadout.folders || []).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/50 p-4 text-center space-y-1.5">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
                  <Folder className="w-4 h-4" />
                </div>
                <p className="text-xs font-semibold text-foreground">Nenhuma subpasta criada</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Crie subpastas por tema (ex: <strong>"Dia do Café"</strong>, <strong>"Consciência Negra"</strong>) e adicione os clientes dentro para acompanhar o progresso!
                </p>
                <button
                  type="button"
                  onClick={() => setShowNewFolderForm(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-primary/15 text-primary hover:bg-primary/25 text-[11px] font-bold transition-all mt-1"
                >
                  <Plus className="w-3 h-3" /> Criar Primeira Subpasta
                </button>
              </div>
            ) : (
              (loadout.folders || []).map(folder => {
                const totalClients = folder.clients.length;
                const completedClients = folder.clients.filter(c => c.completed).length;
                const pendingClients = totalClients - completedClients;
                const isAllDone = totalClients > 0 && pendingClients === 0;
                const isOpen = openFolders[folder.id] ?? (pendingClients > 0 || totalClients === 0);
                const currentInput = clientInputPerFolder[folder.id] || '';

                // Clientes vinculados que ainda não estão nesta pasta (para sugestões rápidas)
                const existingClientNames = new Set(folder.clients.map(c => c.name.toLowerCase()));
                const existingClientIds = new Set(folder.clients.map(c => c.clientId).filter(Boolean));
                const availableSuggestions = (linkedClients.length > 0 ? linkedClients : calendarClients).filter(
                  c => !existingClientNames.has(c.name.toLowerCase()) && !existingClientIds.has(c.id)
                );

                const formattedDate = folder.date
                  ? folder.date.split('-').reverse().slice(0, 2).join('/')
                  : null;

                return (
                  <div
                    key={folder.id}
                    className={`rounded-2xl border transition-all overflow-hidden ${
                      isAllDone
                        ? 'bg-emerald-950/20 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                        : totalClients > 0
                          ? 'bg-secondary/40 border-border/60 hover:border-primary/40'
                          : 'bg-secondary/20 border-border/40'
                    }`}
                  >
                    {/* Header Clicável da Subpasta */}
                    <div
                      onClick={() => toggleFolderOpen(folder.id)}
                      className="p-3 cursor-pointer flex items-center justify-between gap-2 hover:bg-white/[0.02] transition-colors select-none"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`p-1.5 rounded-lg flex-shrink-0 transition-colors ${
                            isAllDone
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-primary/15 text-primary'
                          }`}
                        >
                          {isAllDone ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <Folder className="w-4 h-4" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`text-xs font-bold truncate ${
                                isAllDone ? 'text-emerald-300' : 'text-foreground'
                              }`}
                            >
                              {folder.title}
                            </span>
                            {formattedDate && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-white/10 text-muted-foreground flex items-center gap-0.5">
                                <Calendar className="w-2.5 h-2.5" />
                                {formattedDate}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            {totalClients === 0
                              ? '0 clientes na pasta'
                              : isAllDone
                                ? `Todos os ${totalClients} clientes concluídos!`
                                : `${completedClients} de ${totalClients} concluídos`}
                          </p>
                        </div>
                      </div>

                      {/* Badges de Contagem & Status */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {totalClients === 0 ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 text-muted-foreground border border-white/10">
                            0 clientes
                          </span>
                        ) : isAllDone ? (
                          <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 animate-in fade-in">
                            <Check className="w-3 h-3 text-emerald-400" />
                            100% Concluído
                          </span>
                        ) : (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                            {pendingClients} {pendingClients === 1 ? 'pendente' : 'pendentes'}
                          </span>
                        )}

                        {/* Botão de Excluir Pasta com Confirmação */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFolderToDelete({ id: folder.id, title: folder.title });
                          }}
                          className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-white/5 transition-colors"
                          title="Excluir pasta / tema"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Chevron Expandir/Recolher */}
                        <div className="text-muted-foreground">
                          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>

                    {/* Barra de Progresso Visual */}
                    {totalClients > 0 && (
                      <div className="w-full h-1 bg-white/5">
                        <div
                          className={`h-full transition-all duration-300 ${
                            isAllDone
                              ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                              : 'bg-primary'
                          }`}
                          style={{ width: `${(completedClients / totalClients) * 100}%` }}
                        />
                      </div>
                    )}

                    {/* Conteúdo Aberto da Subpasta */}
                    {isOpen && (
                      <div className="p-3 border-t border-border/30 bg-background/40 space-y-3 animate-in slide-in-from-top-1 duration-150">
                        {/* Formulário para Adicionar Cliente na Pasta */}
                        <div className="space-y-2">
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              handleAddClientToFolder(folder.id, currentInput);
                            }}
                            className="flex gap-1.5"
                          >
                            <Input
                              placeholder="Digitar cliente (ex: São Lucas, ABC)..."
                              value={currentInput}
                              onChange={(e) =>
                                setClientInputPerFolder(prev => ({
                                  ...prev,
                                  [folder.id]: e.target.value,
                                }))
                              }
                              className="h-8 text-xs bg-background/80 border-border/60 rounded-xl flex-1 min-w-0"
                            />
                            <Button
                              type="submit"
                              size="sm"
                              className="h-8 px-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold shrink-0"
                            >
                              <Plus className="w-3.5 h-3.5 mr-1" />
                              Adicionar
                            </Button>
                          </form>

                          {/* Sugestões Rápidas de Clientes */}
                          {availableSuggestions.length > 0 && (
                            <div className="space-y-1 pt-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                                  Sugestões da sua carteira:
                                </span>
                                {availableSuggestions.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      addMultipleClientsToFolder(
                                        folder.id,
                                        availableSuggestions.map(c => ({ id: c.id, name: c.name }))
                                      )
                                    }
                                    className="text-[9px] font-bold text-primary hover:underline"
                                  >
                                    + Adicionar Todos ({availableSuggestions.length})
                                  </button>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {availableSuggestions.slice(0, 6).map(client => (
                                  <button
                                    key={client.id}
                                    type="button"
                                    onClick={() => handleAddClientToFolder(folder.id, client.name, client.id)}
                                    className="text-[10px] px-2 py-0.5 rounded-lg bg-secondary/80 hover:bg-primary/20 border border-border/50 text-foreground/80 hover:text-primary transition-all flex items-center gap-1"
                                    title={`Adicionar ${client.name} nesta pasta`}
                                  >
                                    <Plus className="w-2.5 h-2.5" />
                                    <span className="truncate max-w-[100px]">{client.name}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Lista de Clientes da Pasta */}
                        <div className="space-y-1.5 pt-1">
                          {folder.clients.length === 0 ? (
                            <p className="text-[11px] text-muted-foreground text-center py-2 italic">
                              Nenhum cliente adicionado nesta pasta ainda. Digite acima para adicionar.
                            </p>
                          ) : (
                            folder.clients.map(clientItem => {
                              const matchedClient = calendarClients.find(
                                c => (clientItem.clientId && c.id === clientItem.clientId) ||
                                     c.name.toLowerCase() === clientItem.name.toLowerCase()
                              );

                              return (
                                <div
                                  key={clientItem.id}
                                  className={`group flex items-center justify-between gap-2 p-2 rounded-xl border transition-all ${
                                    clientItem.completed
                                      ? 'bg-emerald-950/20 border-emerald-500/20 opacity-80'
                                      : 'bg-secondary/40 border-border/50 hover:border-primary/40'
                                  }`}
                                >
                                  {/* Checkbox + Nome */}
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <button
                                      type="button"
                                      onClick={() => toggleClientInFolder(folder.id, clientItem.id)}
                                      className="flex-shrink-0 text-primary hover:scale-110 transition-transform"
                                      title={clientItem.completed ? 'Desmarcar' : 'Marcar como feito'}
                                    >
                                      {clientItem.completed ? (
                                        <CheckSquare className="w-4 h-4 text-emerald-400" />
                                      ) : (
                                        <Square className="w-4 h-4 text-muted-foreground hover:text-primary" />
                                      )}
                                    </button>

                                    <span
                                      onClick={() => toggleClientInFolder(folder.id, clientItem.id)}
                                      className={`text-xs font-semibold truncate cursor-pointer select-none ${
                                        clientItem.completed
                                          ? 'line-through text-emerald-400/70'
                                          : 'text-foreground'
                                      }`}
                                    >
                                      {clientItem.name}
                                    </span>
                                  </div>

                                  {/* Atalho para o Calendário do Cliente + Remover */}
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    {matchedClient && (
                                      <button
                                        type="button"
                                        onClick={() => navigate(`/calendario/${matchedClient.id}`)}
                                        className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-white/5 transition-colors"
                                        title={`Abrir calendário de ${matchedClient.name}`}
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => removeClientFromFolder(folder.id, clientItem.id)}
                                      className="p-1 opacity-0 group-hover:opacity-100 rounded-md text-muted-foreground hover:text-destructive hover:bg-white/5 transition-all"
                                      title="Remover cliente da pasta"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 2. RASCUNHO / ANOTAÇÕES LIVRES */}
        <div className="space-y-2 pt-2 border-t border-border/40">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-primary" />
              Rascunho / Bloco de Notas
            </span>
            <span className="text-[9px] text-muted-foreground">Salvo automático</span>
          </div>
          <textarea
            value={loadout.notes}
            onChange={e => updateNotes(e.target.value)}
            placeholder="Escreva aqui seu rascunho livre, ideias de posts institucionais, datas comemorativas ou lembretes rápidos..."
            rows={6}
            className="w-full rounded-xl bg-secondary/40 border border-border/50 focus:border-primary/50 focus:outline-none p-2.5 text-xs text-foreground placeholder:text-muted-foreground resize-y leading-relaxed"
          />
        </div>
      </div>
    </>
  );

  return (
    <div className="h-screen overflow-hidden flex flex-col kanban-custom-bg">
      {/* Header — clean, without global add buttons */}
      <header className="page-header flex-shrink-0">
        <div className="flex items-center gap-4 px-6 py-3.5">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => {
              const dest = sessionStorage.getItem('mobile_destination_chosen') || '/';
              navigate(dest);
            }} 
            className="hover:bg-secondary rounded-xl"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <label className="relative cursor-pointer group">
              {employee.photoUrl ? (
                <img src={employee.photoUrl} alt={employee.name} className="w-10 h-10 rounded-xl object-cover shadow-lg ring-1 ring-border/30" />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-secondary/60 flex items-center justify-center text-xl">{employee.avatar}</div>
              )}
              <div className="absolute inset-0 rounded-xl bg-background/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-4 h-4 text-foreground" />
              </div>
              <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handlePhotoChange} />
            </label>
            {employee.photoUrl && (
              <button onClick={() => updateEmployee(employee.id, { photoUrl: undefined })} className="text-xs text-muted-foreground hover:text-destructive transition-colors">
                Remover
              </button>
            )}
            <div>
              <h1 className="text-lg font-bold text-foreground">{employee.name}</h1>
              <p className="text-[11px] text-muted-foreground">{employee.role}</p>
            </div>
            {loggedUserRole === 'ADMIN' && (
              <Button variant="ghost" size="icon" onClick={() => setShowDeleteEmployee(true)} className="ml-4 text-muted-foreground hover:bg-destructive/20 hover:text-destructive rounded-xl transition-all">
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Botão Superior Direito — Calendário / Checklist & Rascunho (Loadout) */}
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant={showCalendarPanel ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowCalendarPanel(prev => !prev)}
              className={`rounded-xl h-9 text-xs font-bold gap-2 transition-all ${
                showCalendarPanel
                  ? 'bg-primary text-white shadow-lg shadow-primary/20'
                  : 'bg-secondary/40 border-border/50 text-foreground hover:bg-secondary'
              }`}
              title="Abrir/Ocultar Painel de Calendário, Checklist e Rascunho"
            >
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">Calendário & Checklist</span>
              {pendingTasksCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-black/30 text-white font-extrabold">
                  {pendingTasksCount}
                </span>
              )}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex flex-col p-5 min-h-0">
        {/* Search */}
        <div className="relative mb-5 max-w-sm flex-shrink-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cards..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10 h-9 bg-secondary/40 border-border/40 rounded-xl text-sm"
          />
        </div>

        {/* Área Principal: Quadro Kanban (Esquerda) + Painel Sempre Visível de Calendário/Checklist/Rascunho (Direita) */}
        <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {/* Kanban board */}
            <KanbanBoardDndContext>
              {/* Desktop: horizontal scroll layout */}
              {!isMobile && (
                <div 
                  ref={scrollRef as any}
                  onMouseDown={onMouseDown}
                  className="kanban-board-desktop flex-1 flex gap-4 overflow-x-auto overflow-y-hidden pb-4 items-start min-h-0 custom-scrollbar cursor-grab active:cursor-grabbing select-none"
                >
                  <SortableContext items={columns.map(c => c.columnKey)} strategy={horizontalListSortingStrategy}>
                    {columns.map(col => (
                      <KanbanColumn
                        key={col.id}
                        id={col.columnKey}
                        dbId={col.id}
                        title={col.title}
                        color={col.color}
                        cards={cardsByColumn[col.columnKey] || []}
                        count={(cardsByColumn[col.columnKey] || []).length}
                        employeeId={employee.id}
                        onEdit={() => { setEditCol(col.id); setEditColTitle(col.title); setEditColColor(col.color); }}
                        onDelete={!FIXED_COLUMN_KEYS.includes(col.columnKey) ? () => setDeleteColTarget(col.id) : undefined}
                      />
                    ))}
                  </SortableContext>

                  {/* "+ Nova Coluna" button */}
                  <div className="flex-shrink-0 min-w-[280px] w-[280px]">
                    <button
                      onClick={() => setShowAddCol(true)}
                      className="w-full flex items-center justify-center gap-2 py-4 mt-9 rounded-2xl border-2 border-dashed border-border/30 text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/[0.03] transition-all group"
                    >
                      <Plus className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      <span className="text-sm font-medium">Nova Coluna</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Mobile: swipe between columns */}
              {isMobile && (
                <MobileKanbanBoard
                  columns={columns.map(col => ({ id: col.columnKey, title: col.title, color: col.color }))}
                >
                  {columns.map(col => (
                    <KanbanColumn
                      key={col.id}
                      id={col.columnKey}
                      title={col.title}
                      color={col.color}
                      cards={cardsByColumn[col.columnKey] || []}
                      count={(cardsByColumn[col.columnKey] || []).length}
                      employeeId={employee.id}
                      onEdit={() => { setEditCol(col.id); setEditColTitle(col.title); setEditColColor(col.color); }}
                      onDelete={!FIXED_COLUMN_KEYS.includes(col.columnKey) ? () => setDeleteColTarget(col.id) : undefined}
                    />
                  ))}
                </MobileKanbanBoard>
              )}
            </KanbanBoardDndContext>
          </div>

          {/* PAINEL DESKTOP — CALENDÁRIO, CHECKLIST DE QUADRADINHOS & RASCUNHO (LOADOUT) */}
          {showCalendarPanel && !isMobile && (
            <aside className="w-[340px] flex-shrink-0 glass-card border border-border/50 rounded-2xl flex flex-col overflow-hidden shadow-2xl bg-background/85 backdrop-blur-xl">
              {loadoutPanelContent}
            </aside>
          )}
        </div>
      </div>

      {/* PAINEL MOBILE — Modal sobreposto centralizado (não espreme o kanban e não corta a lateral) */}
      {showCalendarPanel && isMobile && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in duration-200"
          onClick={() => setShowCalendarPanel(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-[420px] max-h-[85vh] glass-card border border-border/60 rounded-2xl flex flex-col overflow-hidden shadow-2xl bg-[#121214] animate-in zoom-in-95 duration-150"
          >
            {loadoutPanelContent}
          </div>
        </div>
      )}

      {/* Add column dialog */}
      <Dialog open={showAddCol} onOpenChange={setShowAddCol}>
        <DialogContent className="glass-card border-border/50 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-center">Nova Coluna</DialogTitle>
            <DialogDescription className="text-center">Crie uma nova coluna para organizar seus cards.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5 flex flex-col items-center">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase text-center w-full">Nome da Coluna</label>
              <Input placeholder="Ex: Para Revisão" value={newColTitle} onChange={e => setNewColTitle(e.target.value)} className="bg-secondary/40 border-border/50 h-11 rounded-xl w-full text-center" autoFocus />
            </div>
            <div className="space-y-1.5 flex flex-col items-center">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase text-center w-full">Cor</label>
              <Select value={newColColor} onValueChange={setNewColColor}>
                <SelectTrigger className="bg-secondary/40 border-border/50 h-11 rounded-xl w-full grid grid-cols-[24px_1fr_24px] items-center px-3">
                  <div /> {/* Espaçador esquerdo para equilibrar a seta */}
                  <div className="flex items-center justify-center w-full">
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {COLUMN_COLORS.map(c => (
                    <SelectItem key={c.value} value={c.value} className="cursor-pointer">
                      <div className="flex items-center justify-center w-full gap-2">
                        <div className={`w-3.5 h-3.5 rounded-full ${c.value} shadow-sm`} />
                        <span className="font-medium">{c.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full h-11 btn-primary-glow font-bold rounded-xl mt-2" onClick={handleAddColumn}>Criar Coluna</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit column dialog */}
      <Dialog open={!!editCol} onOpenChange={(open) => !open && setEditCol(null)}>
        <DialogContent className="glass-card border-border/50 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-center">Editar Coluna</DialogTitle>
            <DialogDescription className="text-center">Altere o nome ou cor da coluna.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5 flex flex-col items-center">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase text-center w-full">Nome da Coluna</label>
              <Input value={editColTitle} onChange={e => setEditColTitle(e.target.value)} className="bg-secondary/40 border-border/50 h-11 rounded-xl w-full text-center" />
            </div>
            <div className="space-y-1.5 flex flex-col items-center">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase text-center w-full">Cor</label>
              <Select value={editColColor} onValueChange={setEditColColor}>
                <SelectTrigger className="bg-secondary/40 border-border/50 h-11 rounded-xl w-full grid grid-cols-[24px_1fr_24px] items-center px-3">
                  <div /> {/* Espaçador esquerdo para equilibrar a seta */}
                  <div className="flex items-center justify-center w-full">
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {COLUMN_COLORS.map(c => (
                    <SelectItem key={c.value} value={c.value} className="cursor-pointer">
                      <div className="flex items-center justify-center w-full gap-2">
                        <div className={`w-3.5 h-3.5 rounded-full ${c.value} shadow-sm`} />
                        <span className="font-medium">{c.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full h-11 btn-primary-glow font-bold rounded-xl mt-2" onClick={handleEditColumn}>Salvar Alterações</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete loadout folder confirmation */}
      <AlertDialog open={!!folderToDelete} onOpenChange={(open) => !open && setFolderToDelete(null)}>
        <AlertDialogContent className="glass-card border-border/50 max-w-sm rounded-2xl bg-[#141417]">
          <AlertDialogHeader>
            <div className="w-10 h-10 rounded-xl bg-destructive/15 text-destructive flex items-center justify-center mb-1">
              <Trash2 className="w-5 h-5" />
            </div>
            <AlertDialogTitle className="text-base font-bold">Excluir Subpasta / Tema?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Tem certeza que deseja excluir a pasta <strong className="text-foreground">"{folderToDelete?.title}"</strong>?
              {folderToDelete && (loadout.folders?.find(f => f.id === folderToDelete.id)?.clients?.length || 0) > 0 && (
                <span> Todos os clientes vinculados a este tema também serão removidos da pasta.</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 flex flex-row items-center justify-end gap-2">
            <AlertDialogCancel className="bg-secondary hover:bg-muted text-xs font-bold rounded-xl h-9 px-4 mt-0">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-bold rounded-xl h-9 px-4" 
              onClick={() => { 
                if (folderToDelete) {
                  removeFolder(folderToDelete.id);
                  setFolderToDelete(null);
                }
              }}
            >
              Sim, Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete column confirmation */}
      <AlertDialog open={!!deleteColTarget} onOpenChange={(open) => !open && setDeleteColTarget(null)}>
        <AlertDialogContent className="glass-card border-border/50">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir coluna</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir esta coluna? Os cards nela não serão apagados, mas ficarão sem coluna.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary hover:bg-muted rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl" onClick={() => { if (deleteColTarget) { deleteKanbanColumn(deleteColTarget); setDeleteColTarget(null); } }}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete employee confirmation */}
      <AlertDialog open={showDeleteEmployee} onOpenChange={setShowDeleteEmployee}>
        <AlertDialogContent className="glass-card border-border/50">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {employee.name}</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o funcionário/kanban <strong>{employee.name}</strong>?
              Isso removerá este funcionário da plataforma e você não poderá reverter a ação.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary hover:bg-muted rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl" 
              onClick={() => { 
                deleteEmployee(employee.id); 
                setShowDeleteEmployee(false);
                navigate('/');
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Auto-opened card from URL query parameter (e.g. from Calendar) */}
      {selectedCardFromUrl && (
        <Suspense fallback={null}>
          <CardDetailDialog
            card={selectedCardFromUrl}
            open={!!selectedCardFromUrl}
            onOpenChange={(open) => {
              if (!open) {
                setSelectedCardFromUrl(null);
                setSearchParams(prev => {
                  const next = new URLSearchParams(prev);
                  next.delete('cardId');
                  return next;
                }, { replace: true });
              }
            }}
          />
        </Suspense>
      )}
    </div>
  );
};

export default Employee;
