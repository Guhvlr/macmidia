import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
import { DEFAULT_COLUMNS } from './app-types';

interface KanbanContextType {
  employees: Employee[];
  kanbanCards: KanbanCard[];
  kanbanColumns: KanbanColumnDef[];
  calendarTasks: CalendarTask[];
  credentials: Credential[];
  calendarClients: CalendarClient[];
  addEmployee: (emp: Omit<Employee, 'id'>) => Promise<void>;
  updateEmployee: (id: string, updates: Partial<Employee>) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;
  addKanbanCard: (card: Omit<KanbanCard, 'id'>) => Promise<void>;
  updateKanbanCard: (id: string, updates: Partial<KanbanCard>, actionDescription?: string) => Promise<void>;
  deleteKanbanCard: (id: string) => Promise<void>;
  moveKanbanCard: (id: string, column: string) => Promise<void>;
  addKanbanColumn: (employeeId: string, title: string, color: string) => Promise<void>;
  updateKanbanColumn: (id: string, updates: Partial<KanbanColumnDef>) => Promise<void>;
  deleteKanbanColumn: (id: string) => Promise<void>;
  getColumnsForEmployee: (employeeId: string) => KanbanColumnDef[];
  addCalendarTask: (task: Omit<CalendarTask, 'id'>) => Promise<void>;
  updateCalendarTask: (id: string, updates: Partial<CalendarTask>) => Promise<void>;
  deleteCalendarTask: (id: string) => Promise<void>;
  addCredential: (cred: Omit<Credential, 'id'>) => Promise<void>;
  updateCredential: (id: string, updates: Partial<Credential>) => Promise<void>;
  deleteCredential: (id: string) => Promise<void>;
  addCalendarClient: (name: string, logoUrl?: string) => Promise<void>;
  updateCalendarClient: (id: string, updates: Partial<CalendarClient>) => Promise<void>;
  deleteCalendarClient: (id: string) => Promise<void>;
  fetchAll: () => Promise<void>;
}

const KanbanContext = createContext<KanbanContextType | undefined>(undefined);

// Mapping functions (copy from AppContext)
function mapEmployee(row: any): Employee {
  return { id: row.id, name: row.name, role: row.role, avatar: row.avatar, photoUrl: row.photo_url || undefined, email: row.email || undefined, password: row.password || undefined };
}
function mapKanbanCard(row: any): KanbanCard {
  return {
    id: row.id, clientName: row.client_name, description: row.description,
    notes: row.notes || undefined, images: row.images || [],
    imageUrl: row.image_url || undefined, coverImage: row.cover_image || undefined,
    labels: row.labels || [], checklists: row.checklists || [], comments: row.comments || [],
    assignedUsers: row.assigned_users || [],
    column: row.column, timeSpent: row.time_spent ?? 0,
    timerRunning: row.timer_running ?? false, timerStart: row.timer_start || undefined,
    employeeId: row.employee_id, archivedAt: row.archived_at || undefined,
    aiStatus: row.ai_status || undefined,
    aiReport: row.ai_report ? (typeof row.ai_report === 'string' ? JSON.parse(row.ai_report) : row.ai_report) : undefined,
    source: row.source || 'manual',
    originalMessage: row.original_message || undefined,
    history: row.history ? (typeof row.history === 'string' ? JSON.parse(row.history) : row.history) : [],
  };
}
function mapKanbanColumn(row: any): KanbanColumnDef {
  return { id: row.id, employeeId: row.employee_id, columnKey: row.column_key, title: row.title, color: row.color, position: row.position };
}
function mapCalendarTask(row: any): CalendarTask {
  return { id: row.id, date: row.date, clientName: row.client_name, contentType: row.content_type || '', description: row.description || '', time: row.time || '', imageUrl: row.image_url || undefined, status: row.status || 'pendente', employeeId: row.employee_id, calendarClientId: row.calendar_client_id };
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

  const pendingOpsRef = useRef<Set<string>>(new Set());

  const fetchAllBase = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      const [empRes, cardsRes, colsRes, tasksRes, credsRes, clientsRes] = await Promise.all([
        supabase.from('employees').select('*'),
        supabase.from('kanban_cards').select('*').or('archived_at.is.null,archived_at.gt.' + new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('kanban_columns').select('*'),
        supabase.from('calendar_tasks').select('*'),
        supabase.from('credentials').select('*'),
        supabase.from('calendar_clients').select('*'),
      ]);
      setEmployees(empRes.data?.map(mapEmployee) || []);
      setKanbanCards(cardsRes.data?.map(mapKanbanCard) || []);
      setKanbanColumns(colsRes.data?.map(mapKanbanColumn) || []);
      setCalendarTasks(tasksRes.data?.map(mapCalendarTask) || []);
      setCredentials(credsRes.data?.map(mapCredential) || []);
      setCalendarClients(clientsRes.data?.map(mapCalendarClient) || []);
    } catch (err) {
      console.error('Erro ao carregar dados kanban:', err);
      toast.error('Erro ao carregar dados do painel.');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, setLoading]);

  const debouncedRefetchCards = useMemo(() => createDebouncedRefetch(() => {
    const cutoff = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
    supabase.from('kanban_cards').select('*').or(`archived_at.is.null,archived_at.gt.${cutoff}`).then(r => {
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

  // Simplified: using generic refetchers for other tables
  const debRefetchAll = useMemo(() => createDebouncedRefetch(fetchAllBase, 2000), [fetchAllBase]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchAllBase();

    const channel = supabase.channel('realtime-kanban')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, debRefetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kanban_cards' }, (payload) => {
        if (payload.eventType === 'UPDATE' && payload.new) {
          const row = payload.new as any;
          if (pendingOpsRef.current.has(row.id)) return;
          supabase.from('kanban_cards').select('*').eq('id', row.id).single().then(({ data }) => {
            if (data) setKanbanCards(prev => prev.map(c => c.id === data.id ? mapKanbanCard(data) : c));
          });
        } else if (payload.eventType === 'INSERT' && payload.new) {
          const row = payload.new as any;
          if (pendingOpsRef.current.has(row.id)) return;
          supabase.from('kanban_cards').select('*').eq('id', row.id).single().then(({ data }) => {
            if (data) setKanbanCards(prev => prev.some(c => c.id === data.id) ? prev : [...prev, mapKanbanCard(data)]);
          });
        } else if (payload.eventType === 'DELETE' && payload.old) {
          setKanbanCards(prev => prev.filter(c => c.id !== (payload.old as any).id));
        } else {
          debouncedRefetchCards();
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kanban_columns' }, debRefetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_tasks' }, (payload) => {
        if (payload.eventType === 'UPDATE' && payload.new) {
          const row = payload.new as any;
          setCalendarTasks(prev => prev.map(t => t.id === row.id ? mapCalendarTask(row) : t));
        } else if (payload.eventType === 'INSERT' && payload.new) {
          const row = payload.new as any;
          setCalendarTasks(prev => prev.some(t => t.id === row.id) ? prev : [...prev, mapCalendarTask(row)]);
        } else if (payload.eventType === 'DELETE' && payload.old) {
          setCalendarTasks(prev => prev.filter(t => t.id !== (payload.old as any).id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'credentials' }, debRefetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_clients' }, debRefetchAll)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isAuthenticated, fetchAllBase, debouncedRefetchCards, debRefetchAll]);

  const createHistoryAction = useCallback((actionType: CardAction['actionType'], description: string): CardAction => ({
    id: crypto.randomUUID(), userId: loggedUserId || 'unknown', userName: loggedUserName || 'Sistema',
    actionType, description, createdAt: new Date().toISOString()
  }), [loggedUserId, loggedUserName]);

  // CRUD Operations
  const addEmployee = useCallback(async (emp: Omit<Employee, 'id'>) => {
    const { data, error } = await supabase.from('employees').insert({ name: emp.name, role: emp.role, avatar: emp.avatar, photo_url: emp.photoUrl || null }).select();
    if (error) throw error;
    if (data && data[0]) {
      const cols = DEFAULT_COLUMNS.map(c => ({ employee_id: data[0].id, column_key: c.columnKey, title: c.title, color: c.color, position: c.position }));
      await supabase.from('kanban_columns').insert(cols);
    }
  }, []);

  const updateEmployee = useCallback(async (id: string, updates: Partial<Employee>) => {
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    const db: any = {};
    if (updates.name !== undefined) db.name = updates.name;
    if (updates.role !== undefined) db.role = updates.role;
    if (updates.avatar !== undefined) db.avatar = updates.avatar;
    if ('photoUrl' in updates) db.photo_url = updates.photoUrl || null;
    await supabase.from('employees').update(db).eq('id', id);
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

  const addKanbanCard = useCallback(async (card: Omit<KanbanCard, 'id'>) => {
    const tempId = crypto.randomUUID();
    const history = [createHistoryAction('create', `Criou o card na coluna`)];
    const opCard: KanbanCard = { ...card, id: tempId, history };
    setKanbanCards(prev => [...prev, opCard]);
    pendingOpsRef.current.add(tempId);

    const { data, error } = await supabase.from('kanban_cards').insert({
      employee_id: card.employeeId, client_name: card.clientName, description: card.description || '',
      images: card.images || [], image_url: card.imageUrl || null, cover_image: card.coverImage || null,
      labels: card.labels || [], checklists: card.checklists || [], comments: card.comments || [],
      assigned_users: card.assignedUsers || [], column: card.column, time_spent: card.timeSpent ?? 0,
      timer_running: card.timerRunning ?? false, timer_start: card.timerStart || null, history
    }).select();

    if (data?.[0]) {
      const realId = data[0].id;
      setKanbanCards(prev => prev.map(c => c.id === tempId ? { ...c, id: realId } : c));
      pendingOpsRef.current.delete(tempId);
      pendingOpsRef.current.add(realId);
      setTimeout(() => pendingOpsRef.current.delete(realId), 3000);
    } else pendingOpsRef.current.delete(tempId);
    if (error) throw error;
  }, [createHistoryAction]);

  const updateKanbanCard = useCallback(async (id: string, updates: Partial<KanbanCard>, actionDescription?: string) => {
    const existing = kanbanCards.find(c => c.id === id);
    if (!existing) return;
    const op: Partial<KanbanCard> = { ...updates };
    const db: any = {};
    if (actionDescription) {
      const hist = [createHistoryAction('edit', actionDescription), ...(existing.history || [])];
      db.history = hist; op.history = hist;
    }
    pendingOpsRef.current.add(id);
    setKanbanCards(prev => prev.map(c => c.id === id ? { ...c, ...op } : c));

    if (updates.clientName !== undefined) db.client_name = updates.clientName;
    if (updates.description !== undefined) db.description = updates.description;
    if ('notes' in updates) db.notes = updates.notes || null;
    if (updates.images !== undefined) db.images = updates.images;
    if ('imageUrl' in updates) db.image_url = updates.imageUrl || null;
    if ('coverImage' in updates) db.cover_image = updates.coverImage || null;
    if (updates.labels !== undefined) db.labels = updates.labels;
    if (updates.checklists !== undefined) db.checklists = updates.checklists;
    if (updates.comments !== undefined) db.comments = updates.comments;
    if (updates.assignedUsers !== undefined) db.assigned_users = updates.assignedUsers;
    if (updates.column !== undefined) db.column = updates.column;
    if (updates.timeSpent !== undefined) db.time_spent = updates.timeSpent;
    if (updates.timerRunning !== undefined) db.timer_running = updates.timerRunning;
    if ('timerStart' in updates) db.timer_start = updates.timerStart || null;
    if ('archivedAt' in updates) db.archived_at = updates.archivedAt || null;

    const { error } = await supabase.from('kanban_cards').update(db).eq('id', id);
    setTimeout(() => pendingOpsRef.current.delete(id), 1500);
    if (error) { toast.error('Erro ao salvar.'); debouncedRefetchCards(); }
  }, [kanbanCards, createHistoryAction, debouncedRefetchCards]);

  const deleteKanbanCard = useCallback(async (id: string) => {
    setKanbanCards(prev => prev.filter(c => c.id !== id));
    await supabase.from('kanban_cards').delete().eq('id', id);
  }, []);

  const moveKanbanCard = useCallback(async (id: string, column: string) => {
    const card = kanbanCards.find(c => c.id === id);
    if (!card) return;
    const colDef = kanbanColumns.find(c => c.columnKey === column);
    const hist = [createHistoryAction('move', `Moveu para "${colDef?.title || column}"`), ...(card.history || [])];
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
    await supabase.from('kanban_cards').update(db).eq('id', id);
    setTimeout(() => pendingOpsRef.current.delete(id), 1500);
  }, [kanbanCards, kanbanColumns, createHistoryAction]);

  const addKanbanColumn = useCallback(async (employeeId: string, title: string, color: string) => {
    await supabase.from('kanban_columns').insert({ employee_id: employeeId, title, color, column_key: title.toLowerCase().replace(/ /g, '-'), position: kanbanColumns.length });
  }, [kanbanColumns]);
  const updateKanbanColumn = useCallback(async (id: string, updates: Partial<KanbanColumnDef>) => {
    await supabase.from('kanban_columns').update(updates).eq('id', id);
  }, []);
  const deleteKanbanColumn = useCallback(async (id: string) => {
    await supabase.from('kanban_columns').delete().eq('id', id);
  }, []);
  const getColumnsForEmployee = useCallback((employeeId: string) => kanbanColumns.filter(c => c.employeeId === employeeId).sort((a, b) => a.position - b.position), [kanbanColumns]);

  const addCalendarTask = useCallback(async (task: Omit<CalendarTask, 'id'>) => {
    await supabase.from('calendar_tasks').insert({
      date: task.date,
      client_name: task.clientName,
      content_type: task.contentType,
      description: task.description,
      time: task.time,
      image_url: task.imageUrl,
      status: task.status,
      employee_id: task.employeeId,
      calendar_client_id: task.calendarClientId
    }).select();
  }, []);
  const updateCalendarTask = useCallback(async (id: string, updates: Partial<CalendarTask>) => {
    const db: any = {};
    if (updates.date !== undefined) db.date = updates.date;
    if (updates.clientName !== undefined) db.client_name = updates.clientName;
    if (updates.contentType !== undefined) db.content_type = updates.contentType;
    if (updates.description !== undefined) db.description = updates.description;
    if (updates.time !== undefined) db.time = updates.time;
    if (updates.imageUrl !== undefined) db.image_url = updates.imageUrl;
    if (updates.status !== undefined) db.status = updates.status;
    if (updates.employeeId !== undefined) db.employee_id = updates.employeeId;
    if (updates.calendarClientId !== undefined) db.calendar_client_id = updates.calendarClientId;
    await supabase.from('calendar_tasks').update(db).eq('id', id);
  }, []);
  const deleteCalendarTask = useCallback(async (id: string) => {
    await supabase.from('calendar_tasks').delete().eq('id', id);
  }, []);

  const addCredential = useCallback(async (cred: Omit<Credential, 'id'>) => {
    await supabase.from('credentials').insert({
      label: cred.label,
      username: cred.username,
      password: cred.password,
      url: cred.url,
      employee_id: cred.employeeId,
      calendar_client_id: cred.calendarClientId || null
    }).select();
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

  const value = useMemo(() => ({
    employees, kanbanCards, kanbanColumns, calendarTasks, credentials, calendarClients,
    addEmployee, updateEmployee, deleteEmployee, addKanbanCard, updateKanbanCard, deleteKanbanCard, moveKanbanCard,
    addKanbanColumn, updateKanbanColumn, deleteKanbanColumn, getColumnsForEmployee,
    addCalendarTask, updateCalendarTask, deleteCalendarTask, addCredential, updateCredential, deleteCredential,
    addCalendarClient, updateCalendarClient, deleteCalendarClient, fetchAll: fetchAllBase
  }), [
    employees, kanbanCards, kanbanColumns, calendarTasks, credentials, calendarClients,
    addEmployee, updateEmployee, deleteEmployee, addKanbanCard, updateKanbanCard, deleteKanbanCard, moveKanbanCard,
    addKanbanColumn, updateKanbanColumn, deleteKanbanColumn, getColumnsForEmployee,
    addCalendarTask, updateCalendarTask, deleteCalendarTask, addCredential, updateCredential, deleteCredential,
    addCalendarClient, updateCalendarClient, deleteCalendarClient, fetchAllBase
  ]);

  return <KanbanContext.Provider value={value}>{children}</KanbanContext.Provider>;
}

export function useKanban() {
  const context = useContext(KanbanContext);
  if (context === undefined) throw new Error('useKanban must be used within a KanbanProvider');
  return context;
}
