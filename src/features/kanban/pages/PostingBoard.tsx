import { useMemo, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/useApp';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Send, Archive, Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';
import KanbanColumn from '@/features/kanban/components/KanbanColumn';
import { useDraggableScroll } from '@/hooks/useDraggableScroll';
import { useIsMobile } from '@/hooks/useIsMobile';
import { KanbanBoardDndContext } from '@/features/kanban/components/KanbanBoardDndContext';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { MobileKanbanBoard } from '@/features/kanban/components/MobileKanbanBoard';
import { KanbanSearch } from '@/features/kanban/components/KanbanSearch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const KANBAN_COLUMNS = [
  { key: 'aprovado-programar', title: 'Aprovado e Programar', color: 'bg-info' },
  { key: 'postado', title: 'Postado', color: 'bg-success' },
  { key: 'alteracao', title: 'Alteração', color: 'bg-warning' },
  { key: 'programar-mais-dias', title: 'Programar para Mais Dias', color: 'bg-purple-500' },
] as const;

const PostingBoard = () => {
  const navigate = useNavigate();
  const { kanbanCards, loading, memberFilter, loggedUserRole, loggedUserClientLink, calendarClients } = useApp();
  const { ref: scrollRef, onMouseDown } = useDraggableScroll();
  const isMobile = useIsMobile();
  const [clientFilter, setClientFilter] = useState('all');

  const [columnsOrder, setColumnsOrder] = useState(() => {
    const saved = localStorage.getItem('posting_board_columns');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === KANBAN_COLUMNS.length) {
          return parsed;
        }
      } catch (e) {}
    }
    return KANBAN_COLUMNS.map(c => c.key);
  });

  
  useEffect(() => {
    const fetchOrder = async () => {
      const { data } = await supabase.from('settings').select('value').eq('key', 'posting_board_columns').single();
      if (data?.value) {
        try {
          const parsed = JSON.parse(data.value);
          if (Array.isArray(parsed) && parsed.length === KANBAN_COLUMNS.length) {
            setColumnsOrder(parsed);
          }
        } catch (e) {}
      }
    };
    fetchOrder();

    // Subscribe to realtime changes so other users see it immediately
    const channel = supabase.channel('posting_board_settings')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'settings',
          filter: "key=eq.posting_board_columns"
        },
        (payload) => {
          if (payload.new && (payload.new as any).value) {
            try {
              const parsed = JSON.parse((payload.new as any).value);
              if (Array.isArray(parsed) && parsed.length === KANBAN_COLUMNS.length) {
                setColumnsOrder(parsed);
              }
            } catch (e) {}
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const orderedColumns = useMemo(() => {
    return columnsOrder.map(key => KANBAN_COLUMNS.find(c => c.key === key)!).filter(Boolean);
  }, [columnsOrder]);

  const handleReorderColumns = (activeKey: string, overKey: string) => {
    setColumnsOrder(prev => {
      const oldIndex = prev.indexOf(activeKey);
      const newIndex = prev.indexOf(overKey);
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = [...prev];
        const [removed] = newOrder.splice(oldIndex, 1);
        newOrder.splice(newIndex, 0, removed);
        localStorage.setItem('posting_board_columns', JSON.stringify(newOrder));
        supabase.from('settings').upsert({ key: 'posting_board_columns', value: JSON.stringify(newOrder) }).then();
        return newOrder;
      }
      return prev;
    });
  };


  const activeCards = useMemo(() =>
    kanbanCards.filter(c => {
      if (c.archivedAt && c.column !== 'postado') return false; 
      if (!KANBAN_COLUMNS.some(col => col.key === c.column)) return false;

      // Visitor restrictions
      if (loggedUserRole === 'GUEST') {
        const allowedClients = (loggedUserClientLink || '').split(',').filter(Boolean);
        if (!c.calendarClientId || !allowedClients.includes(c.calendarClientId)) {
          return false;
        }
      }

      // Client filter
      if (clientFilter !== 'all' && c.calendarClientId !== clientFilter) {
        return false;
      }

      if (memberFilter.length > 0) {
        const isAssigned = c.assignedUsers?.some(u => memberFilter.includes(u.id));
        const isEmployee = memberFilter.includes(c.employeeId);
        if (!isAssigned && !isEmployee) return false;
      }
      return true;
    }),
    [kanbanCards, memberFilter, loggedUserRole, loggedUserClientLink, clientFilter]
  );

  
  const visibleClients = useMemo(() => {
    let clients = [...calendarClients];
    if (loggedUserRole === 'GUEST') {
      const allowed = (loggedUserClientLink || '').split(',').filter(Boolean);
      clients = clients.filter(c => allowed.includes(c.id));
    }
    return clients.sort((a, b) => a.name.localeCompare(b.name));
  }, [calendarClients, loggedUserRole, loggedUserClientLink]);

  const cardsByColumn = useMemo(() => {
    const grouped: Record<string, typeof activeCards> = {};
    KANBAN_COLUMNS.forEach(col => { grouped[col.key] = []; });
    activeCards.forEach(card => {
      if (grouped[card.column]) grouped[card.column].push(card);
    });
    return grouped;
  }, [activeCards]);

  if (loading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col kanban-custom-bg">
      <header className="page-header flex-shrink-0">
        <div className="flex items-center justify-between px-3 py-2 md:px-6 md:py-3.5">
          <div className="flex items-center gap-2 md:gap-4 w-full md:w-auto">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => {
                const dest = sessionStorage.getItem('mobile_destination_chosen') || '/';
                navigate(dest);
              }} 
              className="hover:bg-secondary rounded-xl h-8 w-8 md:h-10 md:w-10"
            >
              <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
            </Button>
            <div className="flex items-center gap-2 md:gap-2.5">
              <div className="p-1.5 md:p-2 rounded-xl bg-primary/8">
                <Send className="w-4 h-4 md:w-5 md:h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-sm md:text-lg font-bold text-foreground">Quadros de Postagem</h1>
                <p className="hidden md:block text-[11px] text-muted-foreground">Gerencie conteúdos para publicação</p>
              </div>
            </div>
            
            <div className="hidden md:block flex-1 max-w-4xl mx-8">
              <div className="flex items-center gap-3 w-full">
                <div className="w-[300px]">
                  <Select value={clientFilter} onValueChange={setClientFilter}>
                    <SelectTrigger className="bg-secondary/40 border-border/50 h-10 rounded-xl">
                      <SelectValue placeholder="Selecionar Pasta" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="cursor-pointer">
                        <div className="flex items-center gap-2">
                          <Folder className="w-4 h-4 text-muted-foreground" />
                          <span>Todas as Pastas</span>
                        </div>
                      </SelectItem>
                      {visibleClients.map(client => (
                        <SelectItem key={client.id} value={client.id} className="cursor-pointer">
                          <div className="flex items-center gap-2">
                            <Folder className="w-4 h-4 text-muted-foreground" />
                            <span>{client.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <KanbanSearch />
                </div>
              </div>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate('/arquivados')} 
            className="hidden md:flex border-border/50 hover:border-primary/30 rounded-xl text-xs bg-secondary/20 h-9 px-4 transition-all hover:bg-secondary/40"
          >
            <Archive className="w-4 h-4 mr-2 text-primary" /> Central de Arquivados
          </Button>
        </div>
      </header>

      <KanbanBoardDndContext onReorderColumns={handleReorderColumns}>
        {!isMobile && (
          <main 
            ref={scrollRef as any}
            onMouseDown={onMouseDown}
            className="kanban-board-desktop flex-1 overflow-x-auto overflow-y-hidden min-h-0 p-6 flex gap-5 items-start custom-scrollbar cursor-grab active:cursor-grabbing select-none"
          >
            <SortableContext items={orderedColumns.map(c => c.key)} strategy={horizontalListSortingStrategy}>
              {orderedColumns.map(col => (
                <KanbanColumn
                key={col.key}
                id={col.key}
                title={col.title}
                color={col.color}
                cards={cardsByColumn[col.key] || []}
                count={(cardsByColumn[col.key] || []).length}
                employeeId=""
              />
            ))}
            </SortableContext>
          </main>
        )}
        {isMobile && (
          <MobileKanbanBoard
            columns={orderedColumns.map(col => ({ id: col.key, title: col.title, color: col.color }))}
          >
            <SortableContext items={orderedColumns.map(c => c.key)} strategy={horizontalListSortingStrategy}>
              {orderedColumns.map(col => (
                <KanbanColumn
                key={col.key}
                id={col.key}
                title={col.title}
                color={col.color}
                cards={cardsByColumn[col.key] || []}
                count={(cardsByColumn[col.key] || []).length}
                employeeId=""
              />
            ))}
          </SortableContext></MobileKanbanBoard>
        )}
      </KanbanBoardDndContext>
    </div>
  );
};

export default PostingBoard;
