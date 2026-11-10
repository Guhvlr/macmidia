import { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '@/contexts/useApp';
import { FIXED_COLUMN_KEYS, KanbanCard as KanbanCardType } from '@/contexts/app-types';
import KanbanColumn from '@/features/kanban/components/KanbanColumn';
import KanbanCard from '@/features/kanban/components/KanbanCard';
import React, { lazy, Suspense } from 'react';
const CardDetailDialog = lazy(() => import('@/features/kanban/components/CardDetailDialog'));
import { ArrowLeft, Camera, Archive, Loader2, Plus, Search, Trash2, Calendar, CheckSquare, Square, FileText, ExternalLink, X, Check } from 'lucide-react';
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

  // Vínculo de clientes do calendário + Loadout (Checklist & Rascunho sempre visível)
  const { links, toggleClientEmployee, getEmployeeClients } = useCalendarTeamLinks();
  const {
    loadout,
    addChecklistItem,
    toggleChecklistItem,
    updateChecklistItemDate,
    removeChecklistItem,
    clearCompletedItems,
    updateNotes,
  } = useEmployeeCalendarLoadout(id);

  // Começa SEMPRE ABERTO por padrão no desktop para o funcionário bater o olho e lembrar
  const [showCalendarPanel, setShowCalendarPanel] = useState<boolean>(true);
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskDate, setNewTaskDate] = useState('');
  const [newTaskClientId, setNewTaskClientId] = useState<string>('NONE');

  const linkedClients = useMemo(() => {
    if (!id) return [];
    const clientIds = getEmployeeClients(id);
    return calendarClients.filter(c => clientIds.includes(c.id));
  }, [id, getEmployeeClients, calendarClients, links]);

  const pendingTasksCount = useMemo(
    () => loadout.items.filter(item => !item.completed).length,
    [loadout.items]
  );

  const handleAddLoadoutTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    const selectedClient =
      newTaskClientId && newTaskClientId !== 'NONE'
        ? calendarClients.find(c => c.id === newTaskClientId)
        : undefined;
    addChecklistItem({
      text: newTaskText.trim(),
      date: newTaskDate || undefined,
      clientId: selectedClient?.id,
      clientName: selectedClient?.name,
    });
    setNewTaskText('');
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

          {/* PAINEL SEMPRE ABERTO — CALENDÁRIO, CHECKLIST DE QUADRADINHOS & RASCUNHO (LOADOUT) */}
          {showCalendarPanel && (
            <aside className="w-full sm:w-[340px] flex-shrink-0 glass-card border border-border/50 rounded-2xl flex flex-col overflow-hidden shadow-2xl bg-background/85 backdrop-blur-xl">
              {/* Cabeçalho do Painel */}
              <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between bg-primary/5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-primary/15 text-primary">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-xs font-extrabold uppercase tracking-wider text-foreground">
                      Calendário & Loadout
                    </h2>
                    <p className="text-[10px] text-muted-foreground">
                      Lembretes institucionais e rascunho de {employee.name}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowCalendarPanel(false)}
                  className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                  title="Minimizar painel"
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

                {/* 2. CHECKLIST DE QUADRADINHOS (LOADOUT COM DATA E CLIENTE) */}
                <div className="space-y-2.5 pt-2 border-t border-border/40">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <CheckSquare className="w-3.5 h-3.5 text-primary" />
                      Checklist Institucional ({loadout.items.filter(i => i.completed).length}/{loadout.items.length})
                    </span>
                    {loadout.items.some(i => i.completed) && (
                      <button
                        type="button"
                        onClick={clearCompletedItems}
                        className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                      >
                        Limpar feitos
                      </button>
                    )}
                  </div>

                  {/* Formulário rápido para adicionar quadradinho */}
                  <form onSubmit={handleAddLoadoutTask} className="space-y-2 bg-secondary/30 p-2.5 rounded-xl border border-border/40">
                    <div className="flex gap-1.5">
                      <Input
                        placeholder="Ex: Fazer institucional Dia das Mães..."
                        value={newTaskText}
                        onChange={e => setNewTaskText(e.target.value)}
                        className="h-8 text-xs bg-background/60 border-border/50 rounded-lg flex-1"
                      />
                      <Button type="submit" size="sm" className="h-8 px-2.5 rounded-lg bg-primary hover:bg-primary/90 text-white">
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="date"
                        value={newTaskDate}
                        onChange={e => setNewTaskDate(e.target.value)}
                        className="h-7 px-2 text-[11px] rounded-lg bg-background/60 border border-border/50 text-foreground flex-1 min-w-0"
                        title="Data do lembrete / postagem"
                      />
                      <select
                        value={newTaskClientId}
                        onChange={e => setNewTaskClientId(e.target.value)}
                        className="h-7 px-2 text-[11px] rounded-lg bg-background/60 border border-border/50 text-foreground max-w-[135px] truncate"
                        title="Vincular a um cliente"
                      >
                        <option value="NONE">Sem cliente</option>
                        {(linkedClients.length > 0 ? linkedClients : calendarClients).map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </form>

                  {/* Lista de quadradinhos */}
                  <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-0.5 custom-scrollbar">
                    {loadout.items.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground text-center py-3">
                        Adicione quadradinhos acima para lembrar dos institucionais e datas do calendário.
                      </p>
                    ) : (
                      loadout.items.map(item => {
                        const formattedDate = item.date
                          ? item.date.split('-').reverse().slice(0, 2).join('/')
                          : null;
                        return (
                          <div
                            key={item.id}
                            className={`group flex items-start gap-2 p-2 rounded-xl border transition-all ${
                              item.completed
                                ? 'bg-secondary/20 border-border/20 opacity-60'
                                : 'bg-secondary/40 border-border/50 hover:border-primary/40'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => toggleChecklistItem(item.id)}
                              className="mt-0.5 flex-shrink-0 text-primary hover:scale-110 transition-transform"
                              title={item.completed ? 'Desmarcar' : 'Marcar como feito'}
                            >
                              {item.completed ? (
                                <CheckSquare className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <Square className="w-4 h-4 text-muted-foreground hover:text-primary" />
                              )}
                            </button>

                            <div className="flex-1 min-w-0">
                              <p
                                onClick={() => toggleChecklistItem(item.id)}
                                className={`text-xs font-medium cursor-pointer break-words leading-snug ${
                                  item.completed ? 'line-through text-muted-foreground' : 'text-foreground'
                                }`}
                              >
                                {item.text}
                              </p>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                {formattedDate && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                                    <Calendar className="w-2.5 h-2.5" />
                                    {formattedDate}
                                  </span>
                                )}
                                {item.clientName && (
                                  <button
                                    type="button"
                                    onClick={() => item.clientId && navigate(`/calendario/${item.clientId}`)}
                                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white/10 text-foreground/80 hover:text-primary truncate max-w-[140px]"
                                  >
                                    {item.clientName}
                                  </button>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeChecklistItem(item.id)}
                              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1 transition-opacity"
                              title="Remover item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* 3. RASCUNHO / ANOTAÇÕES LIVRES SEMPRE VISÍVEL */}
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
            </aside>
          )}
        </div>
      </div>

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
