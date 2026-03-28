import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import KanbanColumn from '@/components/KanbanColumn';
import KanbanCard from '@/components/KanbanCard';
import AddCardDialog from '@/components/AddCardDialog';
import { ArrowLeft, Camera, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';

const columns = [
  { id: 'todo' as const, title: 'A Fazer', color: 'bg-info' },
  { id: 'production' as const, title: 'Em Produção', color: 'bg-warning' },
  { id: 'correction' as const, title: 'Correção', color: 'bg-destructive' },
  { id: 'done' as const, title: 'Finalizado', color: 'bg-success' },
];

const Employee = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { employees, kanbanCards, updateEmployee } = useApp();

  const employee = employees.find(e => e.id === id);
  if (!employee) return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Funcionário não encontrado</div>;

  const cards = kanbanCards.filter(c => c.employeeId === id);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateEmployee(employee.id, { photoUrl: reader.result as string });
    reader.readAsDataURL(file);
  };

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
            <button
              onClick={() => updateEmployee(employee.id, { photoUrl: undefined })}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              Remover foto
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-foreground">{employee.name}</h1>
            <p className="text-sm text-muted-foreground">{employee.role}</p>
          </div>
        </div>
        <div className="ml-auto">
          <AddCardDialog employeeId={employee.id} />
        </div>
      </header>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map(col => (
          <KanbanColumn key={col.id} id={col.id} title={col.title} color={col.color} count={cards.filter(c => c.column === col.id).length}>
            {cards.filter(c => c.column === col.id).map(card => (
              <KanbanCard key={card.id} card={card} />
            ))}
          </KanbanColumn>
        ))}
      </div>
    </div>
  );
};

export default Employee;
