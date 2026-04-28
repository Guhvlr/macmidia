import { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/useApp';
import { FIXED_COLUMN_KEYS } from '@/contexts/app-types';
import KanbanColumn from '@/features/kanban/components/KanbanColumn';
import KanbanCard from '@/features/kanban/components/KanbanCard';
import { ArrowLeft, Camera, Archive, Loader2, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDraggableScroll } from '@/hooks/useDraggableScroll';
import { KanbanBoardDndContext } from '@/features/kanban/components/KanbanBoardDndContext';

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
  const { employees, kanbanCards, updateEmployee, getColumnsForEmployee, addKanbanColumn, updateKanbanColumn, deleteKanbanColumn, loading } = useApp();
  const { ref: scrollRef, onMouseDown } = useDraggableScroll();

  const [showAddCol, setShowAddCol] = useState(false);
  const [newColTitle, setNewColTitle] = useState('');
  const [newColColor, setNewColColor] = useState('bg-primary');
  const [editCol, setEditCol] = useState<string | null>(null);
  const [editColTitle, setEditColTitle] = useState('');
  const [editColColor, setEditColColor] = useState('');
  const [deleteColTarget, setDeleteColTarget] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const employee = useMemo(() => employees.find(e => e.id === id), [employees, id]);

  const allCards = useMemo(() => kanbanCards.filter(c => c.employeeId === id && !c.archivedAt), [kanbanCards, id]);
  
  const cards = useMemo(() => {
    if (!searchQuery.trim()) return allCards;
    const q = searchQuery.toLowerCase();
    return allCards.filter(c => c.clientName.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
  }, [allCards, searchQuery]);

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
    <div className="h-screen overflow-hidden flex flex-col gradient-bg">
      {/* Header — clean, without global add buttons */}
      <header className="page-header flex-shrink-0">
        <div className="flex items-center gap-4 px-6 py-3.5">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="hover:bg-secondary rounded-xl">
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

        {/* Kanban board */}
        <KanbanBoardDndContext>
          <div 
            ref={scrollRef as any}
            onMouseDown={onMouseDown}
            className="flex-1 flex gap-4 overflow-x-auto overflow-y-hidden pb-4 items-start min-h-0 custom-scrollbar cursor-grab active:cursor-grabbing select-none"
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

            {/* "+ Nova Coluna" button — fixed at the end of all columns */}
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
        </KanbanBoardDndContext>
      </div>

      {/* Add column dialog */}
      <Dialog open={showAddCol} onOpenChange={setShowAddCol}>
        <DialogContent className="glass-card border-border/50">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Nova Coluna</DialogTitle>
            <DialogDescription>Crie uma nova coluna para organizar seus cards.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Nome da coluna" value={newColTitle} onChange={e => setNewColTitle(e.target.value)} className="bg-secondary/40 border-border/50 h-11 rounded-xl" autoFocus />
            <Select value={newColColor} onValueChange={setNewColColor}>
              <SelectTrigger className="bg-secondary/40 border-border/50 h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {COLUMN_COLORS.map(c => (
                  <SelectItem key={c.value} value={c.value}>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${c.value}`} />
                      {c.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button className="w-full h-11 btn-primary-glow font-semibold rounded-xl" onClick={handleAddColumn}>Adicionar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit column dialog */}
      <Dialog open={!!editCol} onOpenChange={(open) => !open && setEditCol(null)}>
        <DialogContent className="glass-card border-border/50">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Editar Coluna</DialogTitle>
            <DialogDescription>Altere o nome ou cor da coluna.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input value={editColTitle} onChange={e => setEditColTitle(e.target.value)} className="bg-secondary/40 border-border/50 h-11 rounded-xl" />
            <Select value={editColColor} onValueChange={setEditColColor}>
              <SelectTrigger className="bg-secondary/40 border-border/50 h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {COLUMN_COLORS.map(c => (
                  <SelectItem key={c.value} value={c.value}>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${c.value}`} />
                      {c.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button className="w-full h-11 btn-primary-glow font-semibold rounded-xl" onClick={handleEditColumn}>Salvar</Button>
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
    </div>
  );
};

export default Employee;
