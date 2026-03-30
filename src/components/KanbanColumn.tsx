import { ReactNode } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Pencil, Trash2 } from 'lucide-react';

interface Props {
  id: string;
  title: string;
  color: string;
  children: ReactNode;
  count: number;
  onEdit?: () => void;
  onDelete?: () => void;
}

const KanbanColumn = ({ id, title, color, children, count, onEdit, onDelete }: Props) => {
  const { moveKanbanCard } = useApp();

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData('cardId');
    if (cardId) moveKanbanCard(cardId, id);
  };

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className="flex flex-col min-h-[300px] flex-1 min-w-[250px]"
    >
      <div className="flex items-center gap-2 mb-3 group">
        <div className={`w-2 h-2 rounded-full ${color}`} />
        <h3 className="font-semibold text-sm">{title}</h3>
        <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{count}</span>
        <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <button onClick={onEdit} className="p-1 hover:text-primary transition-colors">
              <Pencil className="w-3 h-3" />
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} className="p-1 hover:text-destructive transition-colors">
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
      <div className="space-y-3 flex-1 p-2 rounded-xl bg-secondary/30 border border-border/30">
        {children}
      </div>
    </div>
  );
};

export default KanbanColumn;
