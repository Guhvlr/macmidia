import { ReactNode, useState } from 'react';
import { useApp } from '@/contexts/useApp';
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
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const cardId = e.dataTransfer.getData('cardId');
    if (cardId) moveKanbanCard(cardId, id);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className="flex flex-col min-h-[400px] min-w-[290px] w-[310px] flex-shrink-0"
    >
      {/* Column header */}
      <div className="flex items-center gap-2.5 mb-3 px-1 group">
        <div className={`w-2.5 h-2.5 rounded-full ${color} shadow-sm`} />
        <h3 className="font-semibold text-sm tracking-wide text-foreground">{title}</h3>
        <span className="text-[11px] text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full font-medium">{count}</span>
        <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-secondary hover:text-primary transition-all">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-all">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Cards container */}
      <div className={`space-y-2.5 flex-1 p-2.5 rounded-2xl border transition-all duration-200
        ${dragOver
          ? 'bg-primary/5 border-primary/30 shadow-inner'
          : 'bg-secondary/20 border-border/30'
        }`}
      >
        {children}
      </div>
    </div>
  );
};

export default KanbanColumn;
