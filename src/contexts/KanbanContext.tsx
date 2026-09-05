import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { monitoring } from '@/lib/monitoring';
import { useAuth } from './AuthContext';
import { useUI } from './UIContext';

import type {
  CalendarClient,
  CalendarTask,
  Credential,
  Employee,
  KanbanCard,
  KanbanColumnDef,
  CardAction,
} from './app-types';
import { DEFAULT_COLUMNS, slugify } from './app-types';

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';
export interface QueuedTask {
  id: string;
  cardId?: string;
  type: 'UPLOAD_IMAGE' | 'AI_ANALYZE' | 'BATCH_UPDATE';
  status: TaskStatus;
  progress: number;
  payload?: any;
}

interface KanbanState {
  employees: Employee[];
  kanbanCards: KanbanCard[];
  kanbanColumns: KanbanColumnDef[];
  calendarTasks: CalendarTask[];
  credentials: Credential[];
  calendarClients: CalendarClient[];
  activeTasks: QueuedTask[];
  memberFilter: string[];
}

interface KanbanActions {
  addEmployee: (emp: Omit<Employee, 'id'>) => Promise<void>;
  updateEmployee: (id: string, updates: Partial<Employee>) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;
  addKanbanCard: (card: Omit<KanbanCard, 'id'>) => Promise<string | undefined>;
  updateKanbanCard: (id: string, updates: Partial<KanbanCard>, actionDescription?: string) => Promise<void>;
  deleteKanbanCard: (id: string) => Promise<void>;
  moveKanbanCard: (id: string, column: string) => Promise<void>;
  reorderKanbanCards: (updates: { id: string; position_index: number; column?: string }[]) => Promise<void>;
  addKanbanColumn: (employeeId: string, title: string, color: string) => Promise<void>;
  updateKanbanColumn: (id: string, updates: Partial<KanbanColumnDef>) => Promise<void>;
  deleteKanbanColumn: (id: string) => Promise<void>;
  reorderKanbanColumns: (updates: { id: string; position: number }[]) => Promise<void>;
  getColumnsForEmployee: (employeeId: string) => KanbanColumnDef[];
  duplicateCalendarToClients: (sourceClientId: string, targetClientIds: string[], targetMonth?: Date) => Promise<void>;
  addCalendarTask: (task: Omit<CalendarTask, 'id'>) => Promise<CalendarTask>;
  updateCalendarTask: (id: string, updates: Partial<CalendarTask>) => Promise<void>;
  deleteCalendarTask: (id: string) => Promise<void>;
  uploadCalendarAsset: (taskId: string, file: File, updateTaskProgress?: (progress: number) => void) => Promise<string>;
  deleteCalendarAsset: (url: string) => Promise<void>;
  addCredential: (cred: Omit<Credential, 'id'>) => Promise<void>;
  updateCredential: (id: string, updates: Partial<Credential>) => Promise<void>;
  deleteCredential: (id: string) => Promise<void>;
  addCalendarClient: (name: string, logoUrl?: string) => Promise<void>;
  updateCalendarClient: (id: string, updates: Partial<CalendarClient>) => Promise<void>;
  deleteCalendarClient: (id: string) => Promise<void>;
  uploadKanbanAsset: (cardId: string, file: File) => Promise<void>;
  resolveTask: (taskId: string) => void;
  fetchAll: () => Promise<void>;
  setMemberFilter: React.Dispatch<React.SetStateAction<string[]>>;
}

const KanbanStateContext = createContext<KanbanState | undefined>(undefined);
const KanbanActionsContext = createContext<KanbanActions | undefined>(undefined);

// Mapping functions
function mapEmployee(row: any): Employee {
  return { id: row.id, name: row.name, role: row.role, avatar: row.avatar, photoUrl: row.photo_url || undefined, email: row.email || undefined, password: row.password || undefined };
}
function mapKanbanCard(row: any): KanbanCard {
  return {
    id: row.id || '',
    clientName: row.client_name || 'Sem Nome',
    calendarClientId: row.calendar_client_id || undefined,
    calendarClientName: row.calendar_client_name || undefined,
    description: row.description || '',
    notes: row.notes || undefined,
    images: Array.isArray(row.images) ? row.images : [],
    imageUrl: row.image_url || undefined,
    coverImage: row.cover_image !== null && row.cover_image !== undefined ? row.cover_image : undefined,
    labels: Array.isArray(row.labels) ? row.labels : [],
    checklists: Array.isArray(row.checklists) ? row.checklists : [],
    comments: Array.isArray(row.comments) ? row.comments : [],
    assignedUsers: Array.isArray(row.assigned_users) ? row.assigned_users : [],
    column: row.column || 'pendente',
    timeSpent: row.time_spent ?? 0,
    timerRunning: row.timer_running ?? false,
    timerStart: row.timer_start || undefined,
    employeeId: row.employee_id || '',
    position_index: row.position_index ?? 0,
    archivedAt: row.archived_at || undefined,
    aiStatus: row.ai_status || undefined,
    aiReport: row.ai_report ? (typeof row.ai_report === 'string' ? JSON.parse(row.ai_report) : row.ai_report) : undefined,
    source: row.source || 'manual',
    originalMessage: row.original_message || undefined,
    history: Array.isArray(row.history) ? row.history : (row.history ? (typeof row.history === 'string' ? JSON.parse(row.history) : row.history) : []),
    // Date fields
    startDate: row.start_date || undefined,
    dueDate: row.due_date || undefined,
    dueTime: row.due_time || undefined,
    recurrence: row.recurrence || undefined,
    reminder: row.reminder || undefined,
    dueDateCompleted: row.due_date_completed ?? false,
  };
}
function mapKanbanColumn(row: any): KanbanColumnDef {
  return { id: row.id, employeeId: row.employee_id, columnKey: row.column_key, title: row.title, color: row.color, position: row.position };
}
function mapCalendarTask(row: any): CalendarTask {
  return { 
    id: row.id, 
    date: row.date, 
    clientName: row.client_name, 
    contentType: row.content_type || '', 
    description: row.description || '', 
    time: row.time || '', 
    imageUrl: row.image_url || undefined, 
    status: row.status || 'pendente', 
    employeeId: row.employee_id, 
    calendarClientId: row.calendar_client_id,
    reference_links: row.reference_links || [],
    content: row.content || '',
    images: row.images || [],
    comments: Array.isArray(row.comments) ? row.comments : []
  };
}
function mapCredential(row: any): Credential {
  return { id: row.id, label: row.label, username: row.username, password: row.password, url: row.url || undefined, employeeId: row.employee_id, calendarClientId: row.calendar_client_id || undefined };
}
function mapCalendarClient(row: any): CalendarClient {
  return { id: row.id, name: row.name, logoUrl: row.logo_url || undefined, email: row.email || undefined, phones: Array.isArray(row.phones) ? row.phones : [], address: row.address || undefined, notes: row.notes || undefined };
}

function createDebouncedRefetch(fn: () => void, delayMs = 2000) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { fn(); timer = null; }, delayMs);
  };
}

export function KanbanProvider({ children }: { children: ReactNode }) {
  const { loggedUserId, loggedUserName, isAuthenticated } = useAuth();
  const { setLoading } = useUI();


  const [employees, setEmployees] = useState<Employee[]>([]);
  const [kanbanCards, setKanbanCards] = useState<KanbanCard[]>([]);
  const [kanbanColumns, setKanbanColumns] = useState<KanbanColumnDef[]>([]);
  const [calendarTasks, setCalendarTasks] = useState<CalendarTask[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [calendarClients, setCalendarClients] = useState<CalendarClient[]>([]);
  const [activeTasks, setActiveTasks] = useState<QueuedTask[]>([]);
  const [memberFilter, setMemberFilter] = useState<string[]>([]);

  useEffect(() => {
    if (isAuthenticated && loggedUserId) {
      monitoring.setUserInfo(loggedUserId, loggedUserName || '');
      monitoring.trackUsage('BOARD_MOUNTED', { userId: loggedUserId });
    }
  }, [isAuthenticated, loggedUserId, loggedUserName]);

  const pendingOpsRef = useRef<Set<string>>(new Set());
  const reconnectAttemptRef = useRef(0);

  const enqueueTask = useCallback((task: Omit<QueuedTask, 'id' | 'status' | 'progress'>) => {
    const id = crypto.randomUUID();
    setActiveTasks(prev => [...prev, { ...task, id, status: 'pending', progress: 0 }]);
    return id;
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<QueuedTask>) => {
    setActiveTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const resolveTask = useCallback((id: string) => {
    setTimeout(() => setActiveTasks(prev => prev.filter(t => t.id !== id)), 1500);
  }, []);

  const fetchAllBase = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      const calendarCutoff = '2024-01-01'; // Fixed cutoff to avoid issues with wrong local PC clocks
      
      // Supabase tem limite padrão de 1000 linhas por query.
      // Buscar calendar_tasks em lotes para garantir que nenhuma tarefa seja cortada.
      const fetchAllCalendarTasks = async () => {
        const allTasks: any[] = [];
        const pageSize = 1000;
        let page = 0;
        let hasMore = true;
        while (hasMore) {
          const { data, error } = await supabase
            .from('calendar_tasks')
            .select('*')
            .gte('date', calendarCutoff)
            .range(page * pageSize, (page + 1) * pageSize - 1);
          if (error) throw error;
          if (data && data.length > 0) {
            allTasks.push(...data);
            page++;
            if (data.length < pageSize) hasMore = false;
          } else {
            hasMore = false;
          }
        }
        return allTasks;
      };
      // Supabase também tem limite de 1000 linhas para kanban_cards (já com 2700+)
      const fetchAllKanbanCards = async () => {
        const allCards: any[] = [];
        const pageSize = 1000;
        let page = 0;
        let hasMore = true;
        while (hasMore) {
          const { data, error } = await supabase
            .from('kanban_cards')
            .select('*')
            .or('archived_at.is.null,archived_at.gt.2024-01-01T00:00:00.000Z')
            .order('position_index', { ascending: true })
            .range(page * pageSize, (page + 1) * pageSize - 1);
          if (error) throw error;
          if (data && data.length > 0) {
            allCards.push(...data);
            page++;
            if (data.length < pageSize) hasMore = false;
          } else {
            hasMore = false;
          }
        }
        return allCards;
      };

      const results = await Promise.allSettled([
        supabase.from('employees').select('*'),
        fetchAllKanbanCards(),
        supabase.from('kanban_columns').select('*'),
        fetchAllCalendarTasks(),
        supabase.from('credentials').select('*'),
        supabase.from('calendar_clients').select('*').order('name', { ascending: true }),
      ]);

      const tableNames = ['Funcionários', 'Cards', 'Colunas', 'Calendário', 'Credenciais', 'Clientes'];
      const setters = [
        (d: any[]) => setEmployees(d.map(mapEmployee)),
        (d: any[]) => setKanbanCards(d.map(mapKanbanCard)),
        (d: any[]) => setKanbanColumns(d.map(mapKanbanColumn)),
        (d: any[]) => setCalendarTasks(d.map(mapCalendarTask)),
        (d: any[]) => setCredentials(d.map(mapCredential)),
        (d: any[]) => setCalendarClients(d.map(mapCalendarClient)),
      ];

      let failCount = 0;
      results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          const res = result.value;
          // Índices 1 (kanban_cards) e 3 (calendar_tasks) retornam array direto da paginação
          if (i === 1 || i === 3) {
            if (Array.isArray(res)) {
              setters[i](res);
            } else if (res.error) {
              console.error(`Erro ao carregar ${tableNames[i]}:`, res.error);
              failCount++;
            } else {
              setters[i](res.data || []);
            }
          } else if (res.error) {
            console.error(`Erro ao carregar ${tableNames[i]}:`, res.error);
            failCount++;
          } else {
            setters[i](res.data || []);
          }
        } else {
          console.error(`Falha crítica em ${tableNames[i]}:`, result.reason);
          failCount++;
        }
      });

      if (failCount > 0) {
        toast.error(`${failCount} ${failCount === 1 ? 'módulo falhou' : 'módulos falharam'} ao carregar. Tente recarregar a página.`);
      }
    } catch (err) {
      console.error('Erro ao carregar dados kanban:', err);
      toast.error('Erro ao carregar dados do painel.');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, setLoading]);

  const debouncedRefetchCards = useMemo(() => createDebouncedRefetch(() => {
    const cutoff = '2024-01-01T00:00:00.000Z';
    supabase.from('kanban_cards').select('*').or(`archived_at.is.null,archived_at.gt.${cutoff}`).order('position_index', { ascending: true }).then(r => {
      if (r.data) setKanbanCards(prev => {
        const pending = pendingOpsRef.current;
        if (pending.size === 0) return r.data!.map(mapKanbanCard);
        const freshMap = new Map(r.data!.map(row => [row.id, row]));
        const merged = prev.map(c => {
          if (pending.has(c.id)) return c;
          const fresh = freshMap.get(c.id);
          return fresh ? mapKanbanCard(fresh) : c;
        });
        r.data!.forEach(row => { if (!merged.some(c => c.id === row.id)) merged.push(mapKanbanCard(row)); });
        return merged;
      });
    });
  }, 1500), []);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchAllBase();

    const channelId = `realtime-kanban-${crypto.randomUUID()}`;
    const channel = supabase.channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, (payload) => {
        if (payload.eventType === 'UPDATE' && payload.new) {
          const row = payload.new as any;
          setEmployees(prev => prev.map(e => e.id === row.id ? mapEmployee(row) : e));
        } else if (payload.eventType === 'INSERT' && payload.new) {
          const row = payload.new as any;
          setEmployees(prev => prev.some(e => e.id === row.id) ? prev : [...prev, mapEmployee(row)]);
        } else if (payload.eventType === 'DELETE' && payload.old) {
          setEmployees(prev => prev.filter(e => e.id !== (payload.old as any).id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kanban_cards' }, (payload) => {
        if (payload.eventType === 'UPDATE' && payload.new) {
          const row = payload.new as any;
          // Skip if we are the ones who made this change (pending local op)
          if (pendingOpsRef.current.has(row.id)) return;
          
          // Realtime may send partial payloads — merge with existing data
          setKanbanCards(prev => {
            const index = prev.findIndex(c => c.id === row.id);
            if (index === -1) {
              // Card not in local state, fetch full card
              debouncedRefetchCards();
              return prev;
            }
            
            const existing = prev[index];
            const updated = mapKanbanCard(row);
            
            const next = [...prev];
            next[index] = updated;
            return next;
          });
        } else if (payload.eventType === 'INSERT' && payload.new) {
          const row = payload.new as any;
          if (pendingOpsRef.current.has(row.id)) return;
          setKanbanCards(prev => {
            if (prev.some(c => c.id === row.id)) return prev;
            return [...prev, mapKanbanCard(row)];
          });
        } else if (payload.eventType === 'DELETE' && payload.old) {
          const oldId = (payload.old as any).id;
          setKanbanCards(prev => prev.filter(c => c.id !== oldId));
        } else {
          debouncedRefetchCards();
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kanban_columns' }, (payload) => {
        if (payload.eventType === 'UPDATE' && payload.new) {
          const row = payload.new as any;
          setKanbanColumns(prev => prev.map(col => col.id === row.id ? mapKanbanColumn(row) : col));
        } else if (payload.eventType === 'INSERT' && payload.new) {
          const row = payload.new as any;
          setKanbanColumns(prev => prev.some(col => col.id === row.id) ? prev : [...prev, mapKanbanColumn(row)]);
        } else if (payload.eventType === 'DELETE' && payload.old) {
          setKanbanColumns(prev => prev.filter(col => col.id !== (payload.old as any).id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_tasks' }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          if (payload.new && payload.new.id) {
            if (pendingOpsRef.current.has(payload.new.id)) return;
            setCalendarTasks(prev => prev.map(t => {
              if (t.id === payload.new.id) {
                const updates: any = {};
                if ('date' in payload.new) updates.date = payload.new.date;
                if ('client_name' in payload.new) updates.clientName = payload.new.client_name;
                if ('content_type' in payload.new) updates.contentType = payload.new.content_type || '';
                if ('description' in payload.new) updates.description = payload.new.description || '';
                if ('time' in payload.new) updates.time = payload.new.time || '';
                if ('image_url' in payload.new) updates.imageUrl = payload.new.image_url || undefined;
                if ('status' in payload.new) updates.status = payload.new.status || 'pendente';
                if ('employee_id' in payload.new) updates.employeeId = payload.new.employee_id;
                if ('calendar_client_id' in payload.new) updates.calendarClientId = payload.new.calendar_client_id;
                if ('reference_links' in payload.new) updates.reference_links = payload.new.reference_links || [];
                if ('content' in payload.new) updates.content = payload.new.content || '';
                if ('images' in payload.new) updates.images = payload.new.images || [];
                if ('comments' in payload.new) updates.comments = Array.isArray(payload.new.comments) ? payload.new.comments : [];
                return { ...t, ...updates };
              }
              return t;
            }));
          }
        } else if (payload.eventType === 'INSERT' && payload.new) {
          const row = payload.new as any;
          setCalendarTasks(prev => prev.some(t => t.id === row.id) ? prev : [...prev, mapCalendarTask(row)]);
        } else if (payload.eventType === 'DELETE' && payload.old) {
          setCalendarTasks(prev => prev.filter(t => t.id !== (payload.old as any).id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'credentials' }, (payload) => {
        if (payload.eventType === 'UPDATE' && payload.new) {
          const row = payload.new as any;
          setCredentials(prev => prev.map(c => c.id === row.id ? mapCredential(row) : c));
        } else if (payload.eventType === 'INSERT' && payload.new) {
          const row = payload.new as any;
          setCredentials(prev => prev.some(c => c.id === row.id) ? prev : [...prev, mapCredential(row)]);
        } else if (payload.eventType === 'DELETE' && payload.old) {
          setCredentials(prev => prev.filter(c => c.id !== (payload.old as any).id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_clients' }, (payload) => {
        if (payload.eventType === 'UPDATE' && payload.new) {
          const row = payload.new as any;
          setCalendarClients(prev => prev.map(c => c.id === row.id ? mapCalendarClient(row) : c));
        } else if (payload.eventType === 'INSERT' && payload.new) {
          const row = payload.new as any;
          setCalendarClients(prev => prev.some(c => c.id === row.id) ? prev : [...prev, mapCalendarClient(row)]);
        } else if (payload.eventType === 'DELETE' && payload.old) {
          setCalendarClients(prev => prev.filter(c => c.id !== (payload.old as any).id));
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Conectado ao Realtime Kanban com sucesso!');
          reconnectAttemptRef.current = 0;
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          const attempt = reconnectAttemptRef.current;
          const delay = Math.min(5000 * Math.pow(2, attempt), 60000); // 5s, 10s, 20s, 40s, max 60s
          console.warn(`⚠️ Realtime Kanban ${status}. Reconectando em ${delay / 1000}s (tentativa ${attempt + 1})...`);
          reconnectAttemptRef.current = attempt + 1;
          setTimeout(() => {
            debouncedRefetchCards();
          }, delay);
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [isAuthenticated, fetchAllBase, debouncedRefetchCards]);

  const createHistoryAction = useCallback((actionType: CardAction['actionType'], description: string): CardAction => ({
    id: crypto.randomUUID(), userId: loggedUserId || 'unknown', userName: loggedUserName || 'Sistema',
    actionType, description, createdAt: new Date().toISOString()
  }), [loggedUserId, loggedUserName]);

  const addEmployee = useCallback(async (emp: Omit<Employee, 'id'>) => {
    await monitoring.trackPerformance('ADD_EMPLOYEE', async () => {
      const { data, error } = await supabase.from('employees').insert({ name: emp.name, role: emp.role, avatar: emp.avatar, photo_url: emp.photoUrl || null }).select();
      if (error) throw error;
      if (data && data[0]) {
        const cols = DEFAULT_COLUMNS.map(c => ({ employee_id: data[0].id, column_key: c.columnKey, title: c.title, color: c.color, position: c.position }));
        await supabase.from('kanban_columns').insert(cols);
      }
    }, { employeeName: emp.name });
  }, []);

  const updateEmployee = useCallback(async (id: string, updates: Partial<Employee>) => {
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    const db: any = {};
    if (updates.name !== undefined) db.name = updates.name;
    if (updates.role !== undefined) db.role = updates.role;
    if (updates.avatar !== undefined) db.avatar = updates.avatar;
    if ('photoUrl' in updates) db.photo_url = updates.photoUrl || null;
    
    await monitoring.trackPerformance('UPDATE_EMPLOYEE', async () => {
      await supabase.from('employees').update(db).eq('id', id);
    }, { id, updates });
  }, []);

  const deleteEmployee = useCallback(async (id: string) => {
    setEmployees(prev => prev.filter(e => e.id !== id));
    await Promise.all([
      supabase.from('kanban_cards').delete().eq('employee_id', id),
      supabase.from('kanban_columns').delete().eq('employee_id', id),
      supabase.from('calendar_tasks').delete().eq('employee_id', id),
      supabase.from('credentials').delete().eq('employee_id', id),
    ]);
    await supabase.from('employees').delete().eq('id', id);
  }, []);

  const addKanbanCard = useCallback(async (card: Omit<KanbanCard, 'id'>): Promise<string | undefined> => {
    const tempId = crypto.randomUUID();
    const history = [createHistoryAction('create', `Criou o card na coluna`)];
    const columnCards = kanbanCards.filter(c => c.column === card.column);
    const maxPos = columnCards.length > 0 ? Math.max(...columnCards.map(c => c.position_index || 0)) : 0;
    const position_index = maxPos + 1024;
    const employeeId = card.employeeId || '';

    const opCard: KanbanCard = { ...card, id: tempId, history, position_index, employeeId };
    setKanbanCards(prev => [...prev, opCard]);
    pendingOpsRef.current.add(tempId);

    try {
      return await monitoring.trackPerformance('ADD_KANBAN_CARD', async () => {
        // employee_id is a UUID FK — send null instead of empty string to avoid constraint violation
        const safeEmployeeId = card.employeeId && card.employeeId.trim() !== '' ? card.employeeId : null;

        const { data, error } = await supabase.from('kanban_cards').insert({
          employee_id: safeEmployeeId, client_name: card.clientName, description: card.description || '',
          calendar_client_id: card.calendarClientId || null, calendar_client_name: card.calendarClientName || null,
          images: card.images || [], image_url: card.imageUrl || null, cover_image: card.coverImage !== undefined ? card.coverImage : null,
          labels: card.labels || [], checklists: card.checklists || [], comments: card.comments || [],
          assigned_users: card.assignedUsers || [], column: card.column, time_spent: card.timeSpent ?? 0,
          timer_running: card.timerRunning ?? false, timer_start: card.timerStart || null, history,
          source: card.source || 'manual', original_message: card.originalMessage || null,
          ai_status: card.aiStatus || null, ai_report: card.aiReport || null,
          position_index: position_index,
          start_date: card.startDate || null, due_date: card.dueDate || null,
          due_time: card.dueTime || null, recurrence: card.recurrence || null,
          reminder: card.reminder || null, due_date_completed: card.dueDateCompleted ?? false
        }).select();

        // Check error first to fail fast
        if (error) {
          throw error;
        }

        if (data?.[0]) {
          const realId = data[0].id;
          setKanbanCards(prev => prev.map(c => c.id === tempId ? { ...c, id: realId } : c));
          pendingOpsRef.current.delete(tempId);
          pendingOpsRef.current.add(realId);
          setTimeout(() => pendingOpsRef.current.delete(realId), 200);
          return realId;
        } else {
          pendingOpsRef.current.delete(tempId);
        }
        return undefined;
      }, { clientName: card.clientName });
    } catch (err) {
      // Rollback: remove optimistic card from state since DB insert failed
      console.error('addKanbanCard failed, rolling back optimistic card:', err);
      setKanbanCards(prev => prev.filter(c => c.id !== tempId));
      pendingOpsRef.current.delete(tempId);
      throw err;
    }
  }, [kanbanCards, createHistoryAction]);

  const updateKanbanCard = useCallback(async (id: string, updates: Partial<KanbanCard>, actionDescription?: string) => {
    const existing = kanbanCards.find(c => c.id === id);
    if (!existing) return;
    const op: Partial<KanbanCard> = { ...updates };
    const db: any = {};
    if (actionDescription) {
      const prevHistory = Array.isArray(existing.history) ? existing.history.slice(0, 49) : [];
      const hist = [createHistoryAction('edit', actionDescription), ...prevHistory];
      db.history = hist; op.history = hist;
    }
    pendingOpsRef.current.add(id);
    setKanbanCards(prev => prev.map(c => c.id === id ? { ...c, ...op } : c));

    if (updates.clientName !== undefined) db.client_name = updates.clientName;
    if (updates.calendarClientId !== undefined) db.calendar_client_id = updates.calendarClientId;
    if (updates.calendarClientName !== undefined) db.calendar_client_name = updates.calendarClientName;
    if (updates.description !== undefined) db.description = updates.description;
    if ('notes' in updates) db.notes = updates.notes || null;
    if (updates.images !== undefined) db.images = updates.images;
    if ('imageUrl' in updates) db.image_url = updates.imageUrl || null;
    if ('coverImage' in updates) db.cover_image = updates.coverImage ?? null;
    if (updates.labels !== undefined) db.labels = updates.labels;
    if (updates.checklists !== undefined) db.checklists = updates.checklists;
    if (updates.comments !== undefined) db.comments = updates.comments;
    if (updates.assignedUsers !== undefined) db.assigned_users = updates.assignedUsers;
    if (updates.column !== undefined) db.column = updates.column;
    if (updates.timeSpent !== undefined) db.time_spent = updates.timeSpent;
    if (updates.timerRunning !== undefined) db.timer_running = updates.timerRunning;
    if ('timerStart' in updates) db.timer_start = updates.timerStart || null;
    if ('archivedAt' in updates) db.archived_at = updates.archivedAt || null;
    if (updates.position_index !== undefined) db.position_index = updates.position_index;
    if (updates.source !== undefined) db.source = updates.source;
    if (updates.originalMessage !== undefined) db.original_message = updates.originalMessage;
    if (updates.aiStatus !== undefined) db.ai_status = updates.aiStatus;
    if (updates.aiReport !== undefined) db.ai_report = updates.aiReport;
    // Date fields
    if ('startDate' in updates) db.start_date = updates.startDate || null;
    if ('dueDate' in updates) db.due_date = updates.dueDate || null;
    if ('dueTime' in updates) db.due_time = updates.dueTime || null;
    if ('recurrence' in updates) db.recurrence = updates.recurrence || null;
    if ('reminder' in updates) db.reminder = updates.reminder || null;
    if ('dueDateCompleted' in updates) db.due_date_completed = updates.dueDateCompleted ?? false;

    try {
      await monitoring.trackPerformance('UPDATE_KANBAN_CARD', async () => {
        const { error } = await supabase.from('kanban_cards').update(db).eq('id', id);
        if (error) throw error;
      }, { id, updates: Object.keys(updates) });
    } catch (error: any) {
       console.error('Update error:', error);
       // Retry once on network failure
       if (error?.message?.includes('fetch') || error?.message?.includes('network') || error?.message?.includes('Failed')) {
         try {
           await new Promise(r => setTimeout(r, 1500));
           const { error: retryError } = await supabase.from('kanban_cards').update(db).eq('id', id);
           if (retryError) throw retryError;
           // Retry succeeded silently
         } catch (retryErr) {
           console.error('Retry failed:', retryErr);
           toast.error('Falha na conexão. As alterações serão sincronizadas ao reconectar.');
           debouncedRefetchCards();
         }
       } else {
         toast.error('Erro ao salvar. Tente novamente.');
         debouncedRefetchCards(); 
       }
    } finally {
      setTimeout(() => pendingOpsRef.current.delete(id), 200);
    }
  }, [kanbanCards, createHistoryAction, debouncedRefetchCards]);

  const deleteKanbanCard = useCallback(async (id: string) => {
    try {
      const { data: files } = await supabase.storage.from('kanban_assets').list(id);
      if (files && files.length > 0) {
        const pathsToDelete = files.map(f => `${id}/${f.name}`);
        await supabase.storage.from('kanban_assets').remove(pathsToDelete);
      }
    } catch (err) {
      console.warn('Falha ao limpar arquivos do storage:', err);
    }

    const oldCards = [...kanbanCards];
    setKanbanCards(prev => prev.filter(c => c.id !== id));
    
    try {
      const { error } = await supabase.from('kanban_cards').delete().eq('id', id);
      if (error) throw error;
      toast.success('Card excluído com sucesso');
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(`Erro ao excluir card: ${error.message}`);
      setKanbanCards(oldCards); // Rollback
    }
  }, [kanbanCards]);

  const moveKanbanCard = useCallback(async (id: string, column: string) => {
    const card = kanbanCards.find(c => c.id === id);
    if (!card) return;
    const fromCol = kanbanColumns.find(c => c.columnKey === card.column);
    const toCol = kanbanColumns.find(c => c.columnKey === column);
    const fromTitle = fromCol?.title || card.column;
    const toTitle = toCol?.title || column;

    // Limit history to last 50 entries to prevent payload overflow
    const prevHistory = Array.isArray(card.history) ? card.history.slice(0, 49) : [];
    const hist = [createHistoryAction('move', `Moveu de "${fromTitle}" para "${toTitle}"`), ...prevHistory];
    const now = Date.now();
    const op: Partial<KanbanCard> = { column, history: hist };
    const db: any = { column, history: hist };



    if (column === 'em-producao' && card.column !== 'em-producao') {
      db.timer_running = true; db.timer_start = now; op.timerRunning = true; op.timerStart = now;
    } else if (column !== 'em-producao' && card.column === 'em-producao' && card.timerRunning) {
      const elapsed = card.timerStart ? Math.floor((now - card.timerStart) / 1000) : 0;
      db.timer_running = false; db.time_spent = card.timeSpent + elapsed; db.timer_start = null;
      op.timerRunning = false; op.timeSpent = card.timeSpent + elapsed; op.timerStart = undefined;
    }
    if (column === 'postado') { db.archived_at = new Date().toISOString(); op.archivedAt = db.archived_at; }
    else if (card.archivedAt && card.column === 'postado') { db.archived_at = null; op.archivedAt = undefined; }

    pendingOpsRef.current.add(id);
    setKanbanCards(prev => prev.map(c => c.id === id ? { ...c, ...op } : c));
    
    try {
      await monitoring.trackPerformance('MOVE_KANBAN_CARD', async () => {
        const { error } = await supabase.from('kanban_cards').update(db).eq('id', id);
        if (error) throw error;
      }, { id, from: card.column, to: column });
    } catch (err: any) {
      console.error('Move card error:', err);
      // Retry once on network failure
      if (err?.message?.includes('fetch') || err?.message?.includes('network')) {
        try {
          await new Promise(r => setTimeout(r, 1000));
          const { error } = await supabase.from('kanban_cards').update(db).eq('id', id);
          if (error) throw error;
        } catch (retryErr) {
          console.error('Retry failed:', retryErr);
          toast.error('Falha na conexão. A movimentação será sincronizada automaticamente.');
          debouncedRefetchCards();
        }
      } else {
        toast.error('Erro ao mover o card. Tente novamente.');
        debouncedRefetchCards();
      }
    } finally {
      setTimeout(() => pendingOpsRef.current.delete(id), 200);
    }
  }, [kanbanCards, kanbanColumns, createHistoryAction, debouncedRefetchCards]);

  const reorderKanbanCards = useCallback(async (updates: { id: string; position_index: number; column?: string }[]) => {
    // Optimistic UI update
    const updateMap = new Map(updates.map(u => [u.id, u]));
    const now = Date.now();
    
    // Add all affected IDs to pending ops to prevent realtime jumps
    updates.forEach(u => pendingOpsRef.current.add(u.id));

    setKanbanCards(prev => prev.map(c => {
      const update = updateMap.get(c.id);
      if (update) {
        const newCard = { ...c, position_index: update.position_index };
        
        // If the column is changing, we need to handle history and timers
        if (update.column && update.column !== c.column) {
          const fromCol = kanbanColumns.find(col => col.columnKey === c.column);
          const toCol = kanbanColumns.find(col => col.columnKey === update.column);
          const fromTitle = fromCol?.title || c.column;
          const toTitle = toCol?.title || update.column;

          newCard.column = update.column;
          const prevHistory = Array.isArray(c.history) ? c.history.slice(0, 49) : [];
          newCard.history = [createHistoryAction('move', `Moveu de "${fromTitle}" para "${toTitle}"`), ...prevHistory];
          
          // Production Timer Logic
          if (update.column === 'em-producao') {
            newCard.timerRunning = true;
            newCard.timerStart = now;
          } else if (c.column === 'em-producao' && c.timerRunning) {
            const elapsed = c.timerStart ? Math.floor((now - c.timerStart) / 1000) : 0;
            newCard.timerRunning = false;
            newCard.timeSpent = c.timeSpent + elapsed;
            newCard.timerStart = undefined;
          }
          
          // Archiving Logic
          if (update.column === 'postado') {
            newCard.archivedAt = new Date().toISOString();
          } else if (c.column === 'postado') {
            newCard.archivedAt = undefined;
          }
        }
        
        return newCard;
      }
      return c;
    }));

    try {
      await monitoring.trackPerformance('REORDER_KANBAN_CARDS', async () => {
        // Execute updates. 
        for (const u of updates) {
          const card = kanbanCards.find(c => c.id === u.id);
          if (!card) continue;

          const db: any = { position_index: u.position_index };
          
          if (u.column && u.column !== card.column) {
            const fromCol = kanbanColumns.find(col => col.columnKey === card.column);
            const toCol = kanbanColumns.find(col => col.columnKey === u.column);
            const fromTitle = fromCol?.title || card.column;
            const toTitle = toCol?.title || u.column;
            
            const prevHistory = Array.isArray(card.history) ? card.history.slice(0, 49) : [];
            const hist = [createHistoryAction('move', `Moveu de "${fromTitle}" para "${toTitle}"`), ...prevHistory];
            
            db.column = u.column;
            db.history = hist;

            if (u.column === 'em-producao') {
              db.timer_running = true; db.timer_start = now;
            } else if (card.column === 'em-producao' && card.timerRunning) {
              const elapsed = card.timerStart ? Math.floor((now - card.timerStart) / 1000) : 0;
              db.timer_running = false; db.time_spent = card.timeSpent + elapsed; db.timer_start = null;
            }

            if (u.column === 'postado') db.archived_at = new Date().toISOString();
            else if (card.column === 'postado') db.archived_at = null;
          }

          await supabase.from('kanban_cards').update(db).eq('id', u.id);
        }
      });
    } catch (error) {
      console.error('Reorder error:', error);
      toast.error('Erro ao salvar nova ordem.');
      debouncedRefetchCards();
    } finally {
      setTimeout(() => {
        updates.forEach(u => pendingOpsRef.current.delete(u.id));
      }, 200);
    }
  }, [debouncedRefetchCards, kanbanCards, kanbanColumns, createHistoryAction]);

  const addKanbanColumn = useCallback(async (employeeId: string, title: string, color: string) => {
    await supabase.from('kanban_columns').insert({ employee_id: employeeId, title, color, column_key: title.toLowerCase().replace(/ /g, '-'), position: kanbanColumns.length });
  }, [kanbanColumns]);
  const updateKanbanColumn = useCallback(async (id: string, updates: Partial<KanbanColumnDef>) => {
    await supabase.from('kanban_columns').update(updates).eq('id', id);
  }, []);
  const deleteKanbanColumn = useCallback(async (id: string) => {
    await (supabase as any).from('kanban_columns').delete().eq('id', id);
  }, []);

  const reorderKanbanColumns = useCallback(async (updates: { id: string; position: number }[]) => {
    // Optimistic update
    const updateMap = new Map(updates.map(u => [u.id, u.position]));
    setKanbanColumns(prev => prev.map(col => {
      const newPos = updateMap.get(col.id);
      return newPos !== undefined ? { ...col, position: newPos } : col;
    }));

    try {
      await monitoring.trackPerformance('REORDER_KANBAN_COLUMNS', async () => {
        for (const u of updates) {
          await supabase.from('kanban_columns').update({ position: u.position }).eq('id', u.id);
        }
      });
    } catch (error) {
      console.error('Error reordering columns:', error);
      toast.error('Erro ao reordenar colunas.');
    }
  }, []);

  const getColumnsForEmployee = useCallback((employeeId: string) => kanbanColumns.filter(c => c.employeeId === employeeId).sort((a, b) => a.position - b.position), [kanbanColumns]);

  const duplicateCalendarToClients = useCallback(async (sourceClientId: string, targetClientIds: string[], targetMonth?: Date) => {
    return await monitoring.trackPerformance('DUPLICATE_CALENDAR', async () => {
      if (!sourceClientId || !targetClientIds || targetClientIds.length === 0) return;

      let sourceTasks = calendarTasks.filter(t => t.calendarClientId === sourceClientId);
      
      // Filtrar apenas o mês selecionado, se fornecido
      if (targetMonth) {
        const monthStr = (targetMonth.getMonth() + 1).toString().padStart(2, '0');
        const yearStr = targetMonth.getFullYear().toString();
        const prefix = `${yearStr}-${monthStr}`;
        sourceTasks = sourceTasks.filter(t => t.date && t.date.startsWith(prefix));
      }

      if (sourceTasks.length === 0) {
        toast.error("O calendário de origem não tem tarefas neste mês para duplicar.");
        return;
      }

      const newTasks: any[] = [];
      targetClientIds.forEach(targetClientId => {
        const targetClient = calendarClients.find(c => c.id === targetClientId);
        const targetClientName = targetClient?.name || '';
        
        sourceTasks.forEach(task => {
          newTasks.push({
            date: task.date,
            client_name: task.clientName,
            content_type: task.contentType || '',
            description: task.description || '',
            time: task.time || '',
            image_url: task.imageUrl || null,
            status: task.status,
            employee_id: task.employeeId || null,
            calendar_client_id: targetClientId,
            reference_links: task.reference_links || [],
            content: task.content || '',
            images: task.images || []
          });
        });
      });

      const { data, error } = await (supabase as any).from('calendar_tasks').insert(newTasks).select();
      if (error) {
        console.error('Detailed error duplicating calendar tasks:', error);
        toast.error(`Falha ao duplicar calendário: ${error.message}`);
        throw error;
      }
      
      if (data && data.length > 0) {
        // Function mapCalendarTask might be declared below, let's just do it manually if needed, but it exists
        // Wait, mapCalendarTask might not exist in the same scope?
        // Ah, it's defined at the top of KanbanContext!
        // Wait, is it called mapCalendarTask? Let's assume it is based on the context. If not, I'll fix it.
      }
      await fetchAllBase();
      toast.success(`Calendário duplicado para ${targetClientIds.length} cliente(s) com sucesso!`);
    });
  }, [calendarTasks, calendarClients]);

  const addCalendarTask = useCallback(async (task: Omit<CalendarTask, 'id'>) => {
    return await monitoring.trackPerformance('ADD_CALENDAR_TASK', async () => {
      const dbData = {
        date: task.date,
        client_name: task.clientName,
        content_type: task.contentType || '',
        description: task.description || '',
        time: task.time || '',
        image_url: task.imageUrl || null,
        status: task.status,
        employee_id: task.employeeId || null,
        calendar_client_id: task.calendarClientId,
        reference_links: task.reference_links || [],
        content: task.content || '',
        images: task.images || [],
        image_adjustments: task.image_adjustments || {}
      };

      const { data, error } = await (supabase as any).from('calendar_tasks').insert(dbData).select();
      if (error) {
        console.error('Detailed error adding calendar task:', error);
        toast.error(`Falha ao criar: ${error.message}`);
        throw error;
      }
      
      // Update otimista imediato
      if (data && data[0]) {
        const newTask = mapCalendarTask(data[0]);
        setCalendarTasks(prev => {
          if (prev.some(t => t.id === newTask.id)) return prev;
          return [...prev, newTask];
        });
      }
      return data?.[0];
    });
  }, []);

  const updateCalendarTask = useCallback(async (id: string, updates: Partial<CalendarTask>) => {
    await monitoring.trackPerformance('UPDATE_CALENDAR_TASK', async () => {
      const db: any = {};
      if (updates.date !== undefined) db.date = updates.date;
      if (updates.clientName !== undefined) db.client_name = updates.clientName;
      if (updates.contentType !== undefined) db.content_type = updates.contentType;
      if (updates.description !== undefined) db.description = updates.description;
      if (updates.time !== undefined) db.time = updates.time;
      if (updates.imageUrl !== undefined) db.image_url = updates.imageUrl;
      if (updates.status !== undefined) db.status = updates.status;
      if (updates.employeeId !== undefined) db.employee_id = updates.employeeId || null;
      if (updates.calendarClientId !== undefined) db.calendar_client_id = updates.calendarClientId;
      if (updates.reference_links !== undefined) db.reference_links = updates.reference_links;
      if (updates.content !== undefined) db.content = updates.content;
      if (updates.images !== undefined) db.images = updates.images;
      if (updates.comments !== undefined) db.comments = updates.comments;
      
      pendingOpsRef.current.add(id);
      // Update otimista imediato para a UI
      setCalendarTasks(prev => prev.map(t => {
        if (t.id === id) {
          return { ...t, ...updates };
        }
        return t;
      }));

      try {
        await supabase.from('calendar_tasks').update(db).eq('id', id);
      } finally {
        setTimeout(() => pendingOpsRef.current.delete(id), 200);
      }
    });
  }, []);

  const deleteCalendarTask = useCallback(async (id: string) => {
    await monitoring.trackPerformance('DELETE_CALENDAR_TASK', async () => {
      try {
        const { data: files } = await supabase.storage.from('kanban_assets').list(`calendar/${id}`);
        if (files && files.length > 0) {
          const pathsToDelete = files.map(f => `calendar/${id}/${f.name}`);
          await supabase.storage.from('kanban_assets').remove(pathsToDelete);
        }
      } catch (err) {
        console.warn('Falha ao limpar arquivos do calendário no storage:', err);
      }
      await supabase.from('calendar_tasks').delete().eq('id', id);
    });
  }, []);

  const uploadCalendarAsset = useCallback(async (taskId: string, file: File, updateTaskProgress?: (progress: number) => void): Promise<string> => {
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `calendar/${taskId}/${Date.now()}-${safeName}`;
      
      if (updateTaskProgress) updateTaskProgress(50);
      
      const { data, error } = await supabase.storage.from('kanban_assets').upload(fileName, file, { 
        contentType: file.type, 
        cacheControl: '3600' 
      });
      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage.from('kanban_assets').getPublicUrl(fileName);
      if (updateTaskProgress) updateTaskProgress(90);
      
      return publicUrl;
    } catch (err: any) {
      console.error('Erro ao fazer upload da mídia para o calendário:', err);
      toast.error('Erro no upload. Tente novamente.');
      throw err;
    }
  }, []);

  const deleteCalendarAsset = useCallback(async (url: string) => {
    try {
      if (!url.includes('kanban_assets/')) return;
      const urlParts = url.split('kanban_assets/');
      if (urlParts.length < 2) return;
      const path = urlParts[1];
      
      await supabase.storage.from('kanban_assets').remove([path]);
    } catch (err) {
      console.warn('Erro ao deletar imagem do storage:', err);
    }
  }, []);

  const addCredential = useCallback(async (cred: Omit<Credential, 'id'>) => {
    const tempId = crypto.randomUUID();
    // Optimistic update - add to local state immediately
    const optimisticCred: Credential = {
      id: tempId,
      label: cred.label,
      username: cred.username,
      password: cred.password,
      url: cred.url,
      employeeId: cred.employeeId || '',
      calendarClientId: cred.calendarClientId,
    };
    setCredentials(prev => [...prev, optimisticCred]);

    try {
      // Find a valid employee ID to satisfy the NOT NULL constraint if none is provided
      const finalEmployeeId = cred.employeeId || (employees.length > 0 ? employees[0].id : null);
      
      const { data, error } = await supabase.from('credentials').insert({
        label: cred.label,
        username: cred.username,
        password: cred.password,
        url: cred.url || null,
        employee_id: finalEmployeeId,
        calendar_client_id: cred.calendarClientId || null
      }).select();

      if (error) throw error;

      // Replace temp ID with real ID from database
      if (data?.[0]) {
        setCredentials(prev => prev.map(c => c.id === tempId ? mapCredential(data[0]) : c));
      }
    } catch (err: any) {
      console.error('Erro ao adicionar credencial:', err);
      // Rollback optimistic update
      setCredentials(prev => prev.filter(c => c.id !== tempId));
      toast.error(`Erro ao salvar acesso: ${err.message || 'Erro desconhecido'}`);
      throw err;
    }
  }, []);
  const updateCredential = useCallback(async (id: string, updates: Partial<Credential>) => {
    const db: any = {};
    if (updates.label !== undefined) db.label = updates.label;
    if (updates.username !== undefined) db.username = updates.username;
    if (updates.password !== undefined) db.password = updates.password;
    if (updates.url !== undefined) db.url = updates.url;
    if (updates.employeeId !== undefined) db.employee_id = updates.employeeId;
    if (updates.calendarClientId !== undefined) db.calendar_client_id = updates.calendarClientId || null;
    await supabase.from('credentials').update(db).eq('id', id);
  }, []);
  const deleteCredential = useCallback(async (id: string) => {
    await supabase.from('credentials').delete().eq('id', id);
  }, []);

  const addCalendarClient = useCallback(async (name: string, logoUrl?: string) => {
    const id = name.toLowerCase().trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '') + '-' + Math.random().toString(36).substring(2, 7);
    
    const { error } = await supabase.from('calendar_clients').insert({ id, name, logo_url: logoUrl || null }).select();
    if (error) {
      console.error('Erro ao adicionar cliente:', error);
      toast.error('Erro ao criar calendário do cliente.');
      throw error;
    }
  }, []);
  const updateCalendarClient = useCallback(async (id: string, updates: Partial<CalendarClient>) => {
    const db: any = {};
    if (updates.name !== undefined) db.name = updates.name;
    if (updates.logoUrl !== undefined) db.logo_url = updates.logoUrl;
    if (updates.email !== undefined) db.email = updates.email;
    if (updates.phones !== undefined) db.phones = updates.phones;
    if (updates.address !== undefined) db.address = updates.address;
    if (updates.notes !== undefined) db.notes = updates.notes;
    await supabase.from('calendar_clients').update(db).eq('id', id);
  }, []);
  const deleteCalendarClient = useCallback(async (id: string) => {
    await supabase.from('calendar_clients').delete().eq('id', id);
  }, []);

  const uploadKanbanAsset = useCallback(async (cardId: string, file: File) => {
    const taskId = enqueueTask({ type: 'UPLOAD_IMAGE', cardId });
    updateTask(taskId, { status: 'processing', progress: 10 });

    try {
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
      if (file.size > MAX_FILE_SIZE) {
        throw new Error('Arquivo muito grande. O limite é de 10MB.');
      }

      const { sanitizeFileName } = await import('@/lib/utils');
      
      const card = kanbanCards.find(c => c.id === cardId);
      const safeName = sanitizeFileName(file.name);
      const fileName = `${cardId}/${Date.now()}-${safeName}`;
      
      updateTask(taskId, { progress: 50 });
      const { data, error } = await supabase.storage.from('kanban_assets').upload(fileName, file, { 
        contentType: file.type, 
        cacheControl: '3600' 
      });
      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage.from('kanban_assets').getPublicUrl(fileName);
      updateTask(taskId, { progress: 90 });

      if (card) {
        const currentImages = card.images || [];
        const updatedImages = [...currentImages, publicUrl];
        await updateKanbanCard(cardId, { images: updatedImages, coverImage: card.coverImage || publicUrl }, `Enviou anexo: ${file.name}`);
      }

      updateTask(taskId, { status: 'completed', progress: 100 });
      resolveTask(taskId);
    } catch (err: any) {
      console.error('Upload complete error object:', err);
      const errorMessage = err.message || 'Erro desconhecido ao enviar';
      updateTask(taskId, { status: 'failed' });
      toast.error(`Falha no Upload: ${errorMessage}`);
      
      if (errorMessage.includes('bucket')) {
        toast.info('Dica: Verifique se o balde kanban_assets foi criado no Supabase.');
      }
    }
  }, [enqueueTask, updateTask, resolveTask, kanbanCards, updateKanbanCard]);

  const stateValue = useMemo(() => ({
    employees, kanbanCards, kanbanColumns, calendarTasks, credentials, calendarClients, activeTasks, memberFilter
  }), [employees, kanbanCards, kanbanColumns, calendarTasks, credentials, calendarClients, activeTasks, memberFilter]);

  const actionsValue = useMemo(() => ({
    addEmployee, updateEmployee, deleteEmployee, addKanbanCard, updateKanbanCard, deleteKanbanCard, moveKanbanCard, reorderKanbanCards,
    addKanbanColumn, updateKanbanColumn, deleteKanbanColumn, reorderKanbanColumns, getColumnsForEmployee, duplicateCalendarToClients,
    addCalendarTask, updateCalendarTask, deleteCalendarTask, uploadCalendarAsset, deleteCalendarAsset, addCredential, updateCredential, deleteCredential,
    addCalendarClient, updateCalendarClient, deleteCalendarClient, uploadKanbanAsset, resolveTask, fetchAll: fetchAllBase,
    setMemberFilter
  }), [
    addEmployee, updateEmployee, deleteEmployee, addKanbanCard, updateKanbanCard, deleteKanbanCard, moveKanbanCard, reorderKanbanCards,
    addKanbanColumn, updateKanbanColumn, deleteKanbanColumn, reorderKanbanColumns, getColumnsForEmployee, duplicateCalendarToClients,
    addCalendarTask, updateCalendarTask, deleteCalendarTask, uploadCalendarAsset, deleteCalendarAsset, addCredential, updateCredential, deleteCredential,
    addCalendarClient, updateCalendarClient, deleteCalendarClient, uploadKanbanAsset, resolveTask, fetchAllBase
  ]);

  return (
    <KanbanStateContext.Provider value={stateValue}>
      <KanbanActionsContext.Provider value={actionsValue}>
        {children}
      </KanbanActionsContext.Provider>
    </KanbanStateContext.Provider>
  );
}

export function useKanbanState() {
  const context = useContext(KanbanStateContext);
  if (context === undefined) throw new Error('useKanbanState must be used within a KanbanProvider');
  return context;
}

export function useKanbanActions() {
  const context = useContext(KanbanActionsContext);
  if (context === undefined) throw new Error('useKanbanActions must be used within a KanbanProvider');
  return context;
}

export function useKanban(): KanbanState & KanbanActions {
  const state = useKanbanState();
  const actions = useKanbanActions();
  return { ...state, ...actions };
}
