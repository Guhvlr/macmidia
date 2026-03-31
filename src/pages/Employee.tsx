import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/useApp';
import { FIXED_COLUMN_KEYS } from '@/contexts/app-types';
import KanbanColumn from '@/components/KanbanColumn';
import KanbanCard from '@/components/KanbanCard';
import AddCardDialog from '@/components/AddCardDialog';
import { ArrowLeft, Camera, Archive, Loader2, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

  const [showAddCol, setShowAddCol] = useState(false);
  const [newColTitle, setNewColTitle] = useState('');
  const [newColColor, setNewColColor] = useState('bg-primary');
  const [editCol, setEditCol] = useState<string | null>(null);
  const [editColTitle, setEditColTitle] = useState('');
  const [editColColor, setEditColColor] = useState('');
  const [deleteColTarget, setDeleteColTarget] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const employee = employees.find(e => e.id === id);
  const allCards = kanbanCards.filter(c => c.employeeId === id && !c.archivedAt);
  const cards = searchQuery.trim()
    ? allCards.filter(c => c.clientName.toLowerCase().includes(searchQuery.toLowerCase()) || c.description.toLowerCase().includes(searchQuery.toLowerCase()))
    : allCards;
  const columns = employee ? getColumnsForEmployee(employee.id) : [];

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

  const editingColumn = columns.find(c => c.id === editCol);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Funcionário não encontrado</p>
        <Button variant="outline" onClick={() => navigate('/')}>Voltar ao início</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <header className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-3">
          <label className="relative cursor-pointer group">
            {employee.photoUrl ? (
              <img src={employee.photoUrl} alt={employee.name} className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <span className="text-3xl">{employee.avatar}</span>
            )}
            <div className="absolute inset-0 rounded-full bg-background/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-4 h-4 text-foreground" />
            </div>
            <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handlePhotoChange} />
          </label>
          {employee.photoUrl && (
            <button onClick={() => updateEmployee(employee.id, { photoUrl: undefined })} className="text-xs text-muted-foreground hover:text-destructive transition-colors">
              Remover foto
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-foreground">{employee.name}</h1>
            <p className="text-sm text-muted-foreground">{employee.role}</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowAddCol(true)}>
            <Plus className="w-4 h-4 mr-1" /> Coluna
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(`/funcionario/${employee.id}/arquivados`)}>
            <Archive className="w-4 h-4 mr-1" /> Arquivados
          </Button>
          <AddCardDialog employeeId={employee.id} columns={columns} />
        </div>
      </header>

      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar cards por nome ou descrição..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-9 bg-secondary border-border"
        />
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin" style={{ scrollbarColor: 'hsl(var(--muted-foreground)) transparent' }}>
        {columns.map(col => (
          <KanbanColumn
            key={col.id}
            id={col.columnKey}
            title={col.title}
            color={col.color}
            count={cards.filter(c => c.column === col.columnKey).length}
            onEdit={() => { setEditCol(col.id); setEditColTitle(col.title); setEditColColor(col.color); }}
            onDelete={!FIXED_COLUMN_KEYS.includes(col.columnKey) ? () => setDeleteColTarget(col.id) : undefined}
          >
            {cards.filter(c => c.column === col.columnKey).map(card => (
              <KanbanCard key={card.id} card={card} />
            ))}
          </KanbanColumn>
        ))}
      </div>

      {/* Add column dialog */}
      <Dialog open={showAddCol} onOpenChange={setShowAddCol}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Nova Coluna</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nome da coluna" value={newColTitle} onChange={e => setNewColTitle(e.target.value)} className="bg-secondary border-border" />
            <Select value={newColColor} onValueChange={setNewColColor}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
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
            <Button className="w-full" onClick={handleAddColumn}>Adicionar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit column dialog */}
      <Dialog open={!!editCol} onOpenChange={(open) => !open && setEditCol(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Editar Coluna</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input value={editColTitle} onChange={e => setEditColTitle(e.target.value)} className="bg-secondary border-border" />
            <Select value={editColColor} onValueChange={setEditColColor}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
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
            <Button className="w-full" onClick={handleEditColumn}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete column confirmation */}
      <AlertDialog open={!!deleteColTarget} onOpenChange={(open) => !open && setDeleteColTarget(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir coluna</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir esta coluna? Os cards nela não serão apagados, mas ficarão sem coluna.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (deleteColTarget) { deleteKanbanColumn(deleteColTarget); setDeleteColTarget(null); } }}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Employee;
