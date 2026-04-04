import React, { useState, useEffect, useCallback, useRef, ReactNode, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AppContext } from './app-context';
import type {
  AppState,
  CalendarClient,
  CalendarTask,
  Credential,
  Employee,
  KanbanCard,
  KanbanColumnDef,
  CardAction,
  SystemUser,
} from './app-types';
import { DEFAULT_COLUMNS, slugify } from './app-types';
// useMemo already imported above

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
    // AI fields
    aiStatus: row.ai_status || undefined,
    aiReport: row.ai_report ? (typeof row.ai_report === 'string' ? JSON.parse(row.ai_report) : row.ai_report) : undefined,
    source: row.source || 'manual',
    originalMessage: row.original_message || undefined,
    history: row.history ? (typeof row.history === 'string' ? JSON.parse(row.history) : row.history) : [],
  };
}

function mapKanbanColumn(row: any): KanbanColumnDef {
  return {
    id: row.id, employeeId: row.employee_id, columnKey: row.column_key,
    title: row.title, color: row.color, position: row.position,
  };
}

function mapCalendarTask(row: any): CalendarTask {
  return {
    id: row.id, date: row.date, clientName: row.client_name,
    contentType: row.content_type || '', description: row.description || '',
    time: row.time || '', imageUrl: row.image_url || undefined,
    status: row.status || 'pendente', employeeId: row.employee_id,
    calendarClientId: row.calendar_client_id,
  };
}

function mapCredential(row: any): Credential {
  return { id: row.id, label: row.label, username: row.username, password: row.password, url: row.url || undefined, employeeId: row.employee_id, calendarClientId: row.calendar_client_id || undefined };
}

function mapCalendarClient(row: any): CalendarClient {
  return { 
    id: row.id, 
    name: row.name, 
    logoUrl: row.logo_url || undefined,
    email: row.email || undefined,
    phones: Array.isArray(row.phones) ? row.phones : [],
    address: row.address || undefined,
    notes: row.notes || undefined
  };
}

function mapSystemUser(row: any): SystemUser {
  return {
    id: row.id, fullName: row.full_name, email: row.email,
    role: row.role as 'ADMIN' | 'USER', avatarUrl: row.avatar_url || undefined,
    createdAt: row.created_at,
  };
}

// ---- Debounced refetch utility ----
function createDebouncedRefetch(fn: () => void, delayMs = 2000) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { fn(); timer = null; }, delayMs);
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [loggedUserId, setLoggedUserId] = useState<string | null>(null);
  const [loggedUserName, setLoggedUserName] = useState<string | null>(null);
  const isAuthenticated = !!loggedUserId;
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  
  const loggedUserRole = useMemo(() => {
    if (!loggedUserId || systemUsers.length === 0) return null;
    return systemUsers.find(u => u.id === loggedUserId)?.role || 'USER';
  }, [loggedUserId, systemUsers]);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [kanbanCards, setKanbanCards] = useState<KanbanCard[]>([]);
  const [kanbanColumns, setKanbanColumns] = useState<KanbanColumnDef[]>([]);
  const [calendarTasks, setCalendarTasks] = useState<CalendarTask[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [calendarClients, setCalendarClients] = useState<CalendarClient[]>([]);
  const [dashboardBanner, setDashboardBannerState] = useState<string | undefined>();
  const [dashboardLogo, setDashboardLogoState] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  // Track pending optimistic updates to avoid realtime overwrite
  const pendingOpsRef = useRef<Set<string>>(new Set());

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [empRes, cardsRes, colsRes, tasksRes, credsRes, clientsRes, settingsRes, usersRes] = await Promise.all([
        supabase.from('employees').select('*'),
        supabase.from('kanban_cards').select('*').or('archived_at.is.null,archived_at.gt.' + new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('kanban_columns').select('*'),
        supabase.from('calendar_tasks').select('*'),
        supabase.from('credentials').select('*'),
        supabase.from('calendar_clients').select('*'),
        supabase.from('settings').select('*'),
        (supabase as any).from('system_users').select('*'),
      ]);
      setEmployees(empRes.data?.map(mapEmployee) || []);
      setKanbanCards(cardsRes.data?.map(mapKanbanCard) || []);
      setKanbanColumns(colsRes.data?.map(mapKanbanColumn) || []);
      setCalendarTasks(tasksRes.data?.map(mapCalendarTask) || []);
      setCredentials(credsRes.data?.map(mapCredential) || []);
      setCalendarClients(clientsRes.data?.map(mapCalendarClient) || []);
      setSystemUsers((usersRes.data as any[])?.map(mapSystemUser) || []);
      
      if (settingsRes.data) {
        const banner = settingsRes.data.find((s: any) => s.key === 'dashboardBanner');
        const logo = settingsRes.data.find((s: any) => s.key === 'dashboardLogo');
        if (banner) setDashboardBannerState(banner.value || undefined);
        if (logo) setDashboardLogoState(logo.value || undefined);
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      toast.error('Erro ao carregar dados do servidor.');
    } finally {
      setLoading(false);
    }
  }, []);

  const cleanupOldArchived = useCallback(async () => {
    try {
      const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from('kanban_cards').delete().not('archived_at', 'is', null).lt('archived_at', cutoff);
    } catch (err) {
      console.error('Erro ao limpar arquivados:', err);
    }
  }, []);

  // ---- Debounced realtime refetchers (prevent cascade) ----
  const debouncedRefetchCards = useMemo(() => createDebouncedRefetch(() => {
    const cutoff = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
    supabase.from('kanban_cards').select('*').or(`archived_at.is.null,archived_at.gt.${cutoff}`).then(r => {
      if (r.data) {
        setKanbanCards(prev => {
          // Merge: keep optimistic pending ops, update everything else
          const pending = pendingOpsRef.current;
          if (pending.size === 0) return r.data!.map(mapKanbanCard);
          const freshMap = new Map(r.data!.map(row => [row.id, row]));
          const merged = prev.map(c => {
            if (pending.has(c.id)) return c; // keep optimistic
            const fresh = freshMap.get(c.id);
            return fresh ? mapKanbanCard(fresh) : c;
          });
          // Add any new rows not in prev
          r.data!.forEach(row => {
            if (!merged.some(c => c.id === row.id)) merged.push(mapKanbanCard(row));
          });
          return merged;
        });
      }
    });
  }, 1500), []);

  const debouncedRefetchColumns = useMemo(() => createDebouncedRefetch(() => {
    supabase.from('kanban_columns').select('*').then(r => { if (r.data) setKanbanColumns(r.data.map(mapKanbanColumn)); });
  }, 2000), []);

  const debouncedRefetchEmployees = useMemo(() => createDebouncedRefetch(() => {
    supabase.from('employees').select('*').then(r => { if (r.data) setEmployees(r.data.map(mapEmployee)); });
  }, 3000), []);

  const debouncedRefetchTasks = useMemo(() => createDebouncedRefetch(() => {
    supabase.from('calendar_tasks').select('*').then(r => { if (r.data) setCalendarTasks(r.data.map(mapCalendarTask)); });
  }, 3000), []);

  const debouncedRefetchCredentials = useMemo(() => createDebouncedRefetch(() => {
    supabase.from('credentials').select('*').then(r => { if (r.data) setCredentials(r.data.map(mapCredential)); });
  }, 3000), []);

  const debouncedRefetchClients = useMemo(() => createDebouncedRefetch(() => {
    supabase.from('calendar_clients').select('*').then(r => { if (r.data) setCalendarClients(r.data.map(mapCalendarClient)); });
  }, 3000), []);

  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return; }
    fetchAll();
    cleanupOldArchived();

    const channel = supabase.channel('realtime-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, () => {
        debouncedRefetchEmployees();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kanban_cards' }, (payload) => {
        if (payload.eventType === 'UPDATE' && payload.new) {
          const updatedRow = payload.new as any;
          // Skip if this is our own optimistic update
          if (pendingOpsRef.current.has(updatedRow.id)) return;
          // Re-fetch the full row from DB to ensure large JSONB columns (images, etc.) are complete.
          // Supabase realtime payloads may truncate or omit large JSONB fields.
          supabase.from('kanban_cards').select('*').eq('id', updatedRow.id).single().then(({ data }) => {
            if (data) {
              setKanbanCards(prev => prev.map(c => c.id === data.id ? mapKanbanCard(data) : c));
            }
          });
        } else if (payload.eventType === 'INSERT' && payload.new) {
          const newRow = payload.new as any;
          if (pendingOpsRef.current.has(newRow.id)) return;
          // Fetch full row to ensure complete data
          supabase.from('kanban_cards').select('*').eq('id', newRow.id).single().then(({ data }) => {
            if (data) {
              setKanbanCards(prev => {
                if (prev.some(c => c.id === data.id)) return prev;
                return [...prev, mapKanbanCard(data)];
              });
            }
          });
        } else if (payload.eventType === 'DELETE' && payload.old) {
          const oldId = (payload.old as any).id;
          setKanbanCards(prev => prev.filter(c => c.id !== oldId));
        } else {
          debouncedRefetchCards();
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kanban_columns' }, () => {
        debouncedRefetchColumns();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_tasks' }, (payload) => {
        // Granular real-time updates for calendar tasks (instant status sync)
        if (payload.eventType === 'UPDATE' && payload.new) {
          const row = payload.new as any;
          setCalendarTasks(prev => prev.map(t => t.id === row.id ? mapCalendarTask(row) : t));
        } else if (payload.eventType === 'INSERT' && payload.new) {
          const row = payload.new as any;
          setCalendarTasks(prev => {
            if (prev.some(t => t.id === row.id)) return prev;
            return [...prev, mapCalendarTask(row)];
          });
        } else if (payload.eventType === 'DELETE' && payload.old) {
          const oldId = (payload.old as any).id;
          setCalendarTasks(prev => prev.filter(t => t.id !== oldId));
        } else {
          debouncedRefetchTasks();
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'credentials' }, () => {
        debouncedRefetchCredentials();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_clients' }, () => {
        debouncedRefetchClients();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, () => {
        supabase.from('settings').select('*').then(r => {
          if (r.data) {
            const banner = r.data.find((s: any) => s.key === 'dashboardBanner');
            const logo = r.data.find((s: any) => s.key === 'dashboardLogo');
            setDashboardBannerState(banner?.value || undefined);
            setDashboardLogoState(logo?.value || undefined);
          }
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_users' }, () => {
        (supabase as any).from('system_users').select('*').then((r: any) => { 
          if (r.data) {
            setSystemUsers((r.data as any[]).map(mapSystemUser)); 
          }
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isAuthenticated, fetchAll, cleanupOldArchived, debouncedRefetchCards, debouncedRefetchColumns, debouncedRefetchEmployees, debouncedRefetchTasks, debouncedRefetchCredentials, debouncedRefetchClients]);

  useEffect(() => { 
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setLoggedUserId(session.user.id);
        setLoggedUserName(session.user.user_metadata?.full_name || session.user.email || 'Usuário');
      } else {
        setLoggedUserId(null);
        setLoggedUserName(null);
      }
      setIsAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setLoggedUserId(session.user.id);
        setLoggedUserName(session.user.user_metadata?.full_name || session.user.email || 'Usuário');
      } else {
        setLoggedUserId(null);
        setLoggedUserName(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const adminDeleteUser = useCallback(async (id: string) => {
    try {
      const { data, error } = await (supabase as any).rpc('admin_delete_user', { target_user_id: id });
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao excluir usuário:', err);
      return { success: false, error: err.message };
    }
  }, []);

  const adminUpdateUserRole = useCallback(async (id: string, newRole: string) => {
    try {
      const { data, error } = await (supabase as any).rpc('admin_update_user_role', { target_user_id: id, new_role: newRole });
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao atualizar papel do usuário:', err);
      return { success: false, error: err.message };
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: name } }
      });
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, []);

  const logout = useCallback(async () => { 
    await supabase.auth.signOut();
  }, []);

  const createHistoryAction = useCallback((actionType: CardAction['actionType'], description: string): CardAction => {
    return {
      id: crypto.randomUUID(),
      userId: loggedUserId || 'unknown',
      userName: loggedUserName || 'Sistema',
      actionType,
      description,
      createdAt: new Date().toISOString()
    };
  }, [loggedUserId, loggedUserName]);

  const addEmployee = useCallback(async (emp: Omit<Employee, 'id'>) => {
    try {
      const { data, error } = await supabase.from('employees').insert({ name: emp.name, role: emp.role, avatar: emp.avatar, photo_url: emp.photoUrl || null }).select();
      if (error) throw error;
      if (data && data[0]) {
        const empId = data[0].id;
        const cols = DEFAULT_COLUMNS.map(c => ({
          employee_id: empId, column_key: c.columnKey, title: c.title, color: c.color, position: c.position,
        }));
        await supabase.from('kanban_columns').insert(cols);
      }
    } catch (err: any) {
      console.error('Erro ao adicionar funcionário:', err);
      toast.error('Erro ao adicionar funcionário.');
    }
  }, []);

  const updateEmployee = useCallback(async (id: string, updates: Partial<Employee>) => {
    try {
      // Optimistic
      setEmployees(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
      
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.role !== undefined) dbUpdates.role = updates.role;
      if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar;
      if ('photoUrl' in updates) dbUpdates.photo_url = updates.photoUrl || null;
      const { error } = await supabase.from('employees').update(dbUpdates).eq('id', id);
      if (error) throw error;
    } catch (err: any) {
      console.error('Erro ao atualizar funcionário:', err);
      toast.error('Erro ao atualizar funcionário.');
    }
  }, []);

  const deleteEmployee = useCallback(async (id: string) => {
    try {
      // Optimistic
      setEmployees(prev => prev.filter(e => e.id !== id));
      setKanbanCards(prev => prev.filter(c => c.employeeId !== id));
      
      await Promise.all([
        supabase.from('kanban_cards').delete().eq('employee_id', id),
        supabase.from('kanban_columns').delete().eq('employee_id', id),
        supabase.from('calendar_tasks').delete().eq('employee_id', id),
        supabase.from('credentials').delete().eq('employee_id', id),
      ]);
      const { error } = await supabase.from('employees').delete().eq('id', id);
      if (error) throw error;
    } catch (err: any) {
      console.error('Erro ao excluir funcionário:', err);
      toast.error('Erro ao excluir funcionário.');
    }
  }, []);

  const addKanbanCard = useCallback(async (card: Omit<KanbanCard, 'id'>) => {
    try {
      const tempId = crypto.randomUUID();
      const history = [createHistoryAction('create', `Criou o card na coluna`)];
      
      // Optimistic: add with temp ID immediately
      const optimisticCard: KanbanCard = { ...card, id: tempId, history };
      setKanbanCards(prev => [...prev, optimisticCard]);
      pendingOpsRef.current.add(tempId);

      const { data, error } = await supabase.from('kanban_cards').insert({
        employee_id: card.employeeId, client_name: card.clientName,
        description: card.description || '', notes: card.notes || null,
        images: card.images || [], image_url: card.imageUrl || null,
        cover_image: card.coverImage || null, labels: card.labels || [],
        checklists: card.checklists || [], comments: card.comments || [],
        assigned_users: card.assignedUsers || [],
        column: card.column,
        time_spent: card.timeSpent ?? 0, timer_running: card.timerRunning ?? false,
        timer_start: card.timerStart || null,
        history
      }).select();
      
      // Replace temp ID with real one
      if (data && data[0]) {
        const realId = data[0].id;
        setKanbanCards(prev => prev.map(c => c.id === tempId ? { ...c, id: realId } : c));
        pendingOpsRef.current.delete(tempId);
        // Mark real ID briefly to skip incoming realtime event
        pendingOpsRef.current.add(realId);
        setTimeout(() => pendingOpsRef.current.delete(realId), 3000);
      } else {
        pendingOpsRef.current.delete(tempId);
      }
      
      if (error) throw error;
    } catch (err: any) {
      console.error('Erro ao adicionar card:', err);
      toast.error('Erro ao adicionar card.');
    }
  }, [createHistoryAction]);

  const updateKanbanCard = useCallback(async (id: string, updates: Partial<KanbanCard>, actionDescription?: string) => {
    try {
      // Build full optimistic state first
      const existingCard = kanbanCards.find(c => c.id === id);
      const optimistic: Partial<KanbanCard> = { ...updates };
      
      const dbUpdates: any = {};
      
      if (actionDescription && existingCard) {
        const currentHistory = Array.isArray(existingCard.history) ? existingCard.history : [];
        const newHistory = [createHistoryAction('edit', actionDescription), ...currentHistory];
        dbUpdates.history = newHistory;
        optimistic.history = newHistory;
      }
      
      // ⚡ OPTIMISTIC: Update local state immediately
      pendingOpsRef.current.add(id);
      setKanbanCards(prev => prev.map(c => c.id === id ? { ...c, ...optimistic } : c));
      
      if (updates.clientName !== undefined) dbUpdates.client_name = updates.clientName;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if ('notes' in updates) dbUpdates.notes = updates.notes || null;
      if (updates.images !== undefined) dbUpdates.images = updates.images;
      if ('imageUrl' in updates) dbUpdates.image_url = updates.imageUrl || null;
      if ('coverImage' in updates) dbUpdates.cover_image = updates.coverImage || null;
      if (updates.labels !== undefined) dbUpdates.labels = updates.labels;
      if (updates.checklists !== undefined) dbUpdates.checklists = updates.checklists;
      if (updates.comments !== undefined) dbUpdates.comments = updates.comments;
      if (updates.assignedUsers !== undefined) dbUpdates.assigned_users = updates.assignedUsers;
      if (updates.column !== undefined) dbUpdates.column = updates.column;
      if (updates.timeSpent !== undefined) dbUpdates.time_spent = updates.timeSpent;
      if (updates.timerRunning !== undefined) dbUpdates.timer_running = updates.timerRunning;
      if ('timerStart' in updates) dbUpdates.timer_start = updates.timerStart || null;
      if ('archivedAt' in updates) dbUpdates.archived_at = updates.archivedAt || null;
      
      const { error } = await supabase.from('kanban_cards').update(dbUpdates).eq('id', id);
      
      // Release pending flag after a short delay (for realtime dedup)
      setTimeout(() => pendingOpsRef.current.delete(id), 1500);
      
      if (error) throw error;
    } catch (err: any) {
      console.error('Erro ao atualizar card:', err);
      toast.error('Erro ao atualizar card.');
      // Rollback on error: refetch
      pendingOpsRef.current.delete(id);
      debouncedRefetchCards();
    }
  }, [kanbanCards, createHistoryAction, debouncedRefetchCards]);

  const deleteKanbanCard = useCallback(async (id: string) => {
    try {
      // ⚡ Optimistic
      setKanbanCards(prev => prev.filter(c => c.id !== id));
      
      const { error } = await supabase.from('kanban_cards').delete().eq('id', id);
      if (error) throw error;
    } catch (err: any) {
      console.error('Erro ao excluir card:', err);
      toast.error('Erro ao excluir card.');
    }
  }, []);

  const moveKanbanCard = useCallback(async (id: string, column: string) => {
    try {
      const card = kanbanCards.find(c => c.id === id);
      if (!card) return;
      
      const colDef = kanbanColumns.find(c => c.columnKey === column);
      const action = createHistoryAction('move', `Moveu para "${colDef?.title || column}"`);
      const currentHistory = Array.isArray(card.history) ? card.history : [];
      const newHistory = [action, ...currentHistory];
      
      const now = Date.now();
      const optimistic: Partial<KanbanCard> = { column, history: newHistory };
      const dbUpdates: any = { column, history: newHistory };
      
      if (column === 'em-producao' && card.column !== 'em-producao') {
        dbUpdates.timer_running = true;
        dbUpdates.timer_start = now;
        optimistic.timerRunning = true;
        optimistic.timerStart = now;
      } else if (column !== 'em-producao' && card.column === 'em-producao' && card.timerRunning) {
        const elapsed = card.timerStart ? Math.floor((now - card.timerStart) / 1000) : 0;
        dbUpdates.timer_running = false;
        dbUpdates.time_spent = card.timeSpent + elapsed;
        dbUpdates.timer_start = null;
        optimistic.timerRunning = false;
        optimistic.timeSpent = card.timeSpent + elapsed;
        optimistic.timerStart = undefined;
      }

      if (column === 'postado') {
        dbUpdates.archived_at = new Date().toISOString();
        optimistic.archivedAt = new Date().toISOString();
      } else if (card.archivedAt && card.column === 'postado') {
        dbUpdates.archived_at = null;
        optimistic.archivedAt = undefined;
      }
      
      // ⚡ OPTIMISTIC: move card instantly in UI
      pendingOpsRef.current.add(id);
      setKanbanCards(prev => prev.map(c => c.id === id ? { ...c, ...optimistic } : c));
      
      const { error } = await supabase.from('kanban_cards').update(dbUpdates).eq('id', id);
      
      setTimeout(() => pendingOpsRef.current.delete(id), 1500);
      
      if (error) throw error;
    } catch (err: any) {
      console.error('Erro ao mover card:', err);
      toast.error('Erro ao mover card.');
      pendingOpsRef.current.delete(id);
      debouncedRefetchCards();
    }
  }, [kanbanCards, kanbanColumns, createHistoryAction, debouncedRefetchCards]);

  const triggerAICorrection = useCallback(async (cardId: string) => {
    try {
      const card = kanbanCards.find(c => c.id === cardId);
      if (!card) return;

      setKanbanCards(prev => prev.map(c => c.id === cardId ? { ...c, aiStatus: 'analyzing' as const } : c));
      toast.info('🤖 IA Auditora: Conferindo imagens...');

      // 1. Get API Key
      const { data: settingsData } = await supabase.from('settings').select('value').eq('key', 'openai_api_key').single();
      const apiKey = settingsData?.value;
      if (!apiKey) throw new Error('Cofigurações: Chave da OpenAI não encontrada (openai_api_key).');

      // 2. Prepare images
      const images = card.images || [];
      const userContent: any[] = [
        { type: 'text', text: `CLIENTE: ${card.clientName}\nDESCRIÇÃO DO CARD:\n${card.description}\n\nAnalise as imagens comparando com este texto.` }
      ];

      if (images.length > 0) {
        images.slice(0, 10).forEach((img: string, idx: number) => {
          let finalUrl = img;
          if (!img.startsWith('http') && !img.startsWith('data:')) {
            finalUrl = `data:image/jpeg;base64,${img}`;
          }
          userContent.push({ type: 'image_url', image_url: { url: finalUrl, detail: 'high' } });
        });
      }

      // 3. Call OpenAI directly
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { 
              role: 'system', 
              content: `Você é o AGENTE DE CONFERÊNCIA PROFISSIONAL DE ENCARTE DE SUPERMERCADO da Agência MAC MIDIA, com tolerância zero a erros. Sua missão é atuar como um auditor técnico extremamente rigoroso, detalhista e sistemático.

REGRA CENTRAL: NENHUM ERRO PODE PASSAR. Todo erro é erro crítico. Só aprove se arte e lista estiverem 100% idênticas.

FLUXO OBRIGATÓRIO DE AUDITORIA:
1) Conferência de data: Formatos, períodos, ano, mês e observações.
2) Contagem oficial: Contagem total de itens na arte vs lista. Devem ser idênticos.
3) Conferência 1 a 1: Nome, marca, tipo, peso/volume, unidade (KG, LT, ML, G, CX), sabor/variação, plural e pontuação.
4) Dupla validação de preço: Dígito por dígito, vírgula decimal, inversões ou omissões.
5) Validação de marca e descrição: Troca de marca, tipo de carne, cortes ou unidades.
6) Validação de extras: Limite por CPF, indicação de "cada" ou "kg".

CONDIÇÃO DE SAÍDA (JSON):
Você deve retornar obrigatoriamente um objeto JSON com esta estrutura:
{
  "hasErrors": boolean,
  "summary": "Breve frase do veredito",
  "report": "Texto formatado seguindo o padrão MODO ERRO ZERO",
  "errorCount": número_de_erros
}

PADRÃO DO CAMPO "report":
RELATÓRIO DE CONFERÊNCIA – MODO ERRO ZERO
1️⃣ ERROS DE DATA: (descreva ou "Nenhum")
2️⃣ ERROS DE PREÇO: (descreva ou "Nenhum")
3️⃣ ERROS DE DESCRIÇÃO: (descreva ou "Nenhum")
4️⃣ ERROS DE MARCA: (descreva ou "Nenhum")
5️⃣ ERROS DE UNIDADE: (descreva ou "Nenhum")
6️⃣ ERRO DE CONTAGEM: (descreva ou "Nenhuma divergência")
TOTAL DE ERROS CRÍTICOS: X
STATUS FINAL: APROVADO ✅ ou REPROVADO ❌` 
            },
            { role: 'user', content: userContent }
          ],
          temperature: 0,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) throw new Error(`OpenAI error: ${response.status}`);
      const aiResponse = await response.json();
      const analysis = JSON.parse(aiResponse.choices[0].message.content);

      // 4. Update the card in Supabase
      const cardUpdates: any = {
        ai_status: analysis.hasErrors ? 'issues_found' : 'approved',
        ai_report: analysis,
      };

      if (analysis.hasErrors) {
        cardUpdates.column = 'alteracao';
        const issues = (analysis.checklist || []).filter((item: any) => item.status === '❌').map((item: any) => `${item.item}: ${item.observation}`);
        const auditNote = `⚠️ AUDITORIA IA: ${issues.join(' | ')}\n----------------------------------\n`;
        if (!card.description.includes('⚠️ AUDITORIA IA')) {
          cardUpdates.description = auditNote + (card.description || '');
        }

        // Add history
        const currentHistory = Array.isArray(card.history) ? card.history : [];
        cardUpdates.history = [
          {
            id: crypto.randomUUID(),
            userId: 'system',
            userName: '🤖 IA Auditora',
            actionType: 'move',
            description: `❌ ERRO DETECTADO: ${analysis.summary || 'Ver relatório'}`,
            createdAt: new Date().toISOString(),
          },
          ...currentHistory
        ];
      }

      await supabase.from('kanban_cards').update(cardUpdates).eq('id', cardId);

      if (analysis.hasErrors) toast.warning('🤖 Auditoria: Encontrei divergências.');
      else toast.success('🤖 Auditoria: Tudo ok.');

      debouncedRefetchCards();
    } catch (err: any) {
      console.error(err);
      toast.error(`IA Auditora: ${err.message || 'Erro desconhecido'}`);
      setKanbanCards(prev => prev.map(c => c.id === cardId ? { ...c, aiStatus: null } : c));
    }
  }, [kanbanCards, debouncedRefetchCards]);

  const fixDescriptionWithAI = useCallback(async (cardId: string, mode: 'keep_sequence' | 'organize' = 'keep_sequence') => {
    try {
      const card = kanbanCards.find(c => c.id === cardId);
      if (!card) return;

      toast.info(mode === 'keep_sequence' ? '🤖 Mantendo sequência...' : '🤖 Organizando por categorias...');
      
      const { data: settingsData } = await (supabase as any).from('settings').select('value').eq('key', 'openai_api_key').single();
      const apiKey = settingsData?.value;
      if (!apiKey) throw new Error('OpenAI key missing');

      let systemPrompt = `Você é um auditor ortográfico SÊNIOR de encartes de supermercado.
Sua missão é corrigir e padronizar listas de produtos e ofertas.

Regras de Ouro:
1. CORREÇÃO TOTAL: Corrija palavras cortadas ou sem a primeira letra (ex: "ernil" vira "Pernil", "ina" vira "Fina", "queijão" vira "Requeijão").
2. ACENTUAÇÃO: Aplique acentuação correta em todos os produtos (ex: "cafe" vira "Café", "recheio" vira "Recheio").
3. ABREVIAÇÕES: Desfaça abreviações informais do dia-a-dia, exceto unidades de medida (kg, g, ml, un, pct).
4. PREÇOS E DATAS: Mantenha todos os valores numéricos (R$ 0,00) e DATAS DE VALIDADE (Ex: 01/01 a 05/01) exatamente como estão no texto original. NUNCA REMOVA AS DATAS.
5. FORMATAÇÃO: NUNCA use markdown (negrito, itálico, asteriscos). Cada item em uma nova linha.
6. IDIOMA: Português do Brasil impecável.

Se o modo for ORGANIZAR, use categorias claras em MAIÚSCULO como cabeçalho (ex: CARNES, HORTIFRUTI, BEBIDAS).`;

      if (mode === 'organize') {
        systemPrompt += `\n7. ORGANIZE os itens por categorias lógicas de supermercado.`;
      } else {
        systemPrompt += `\n7. MANTENHA a ordem original dos itens, corrigindo apenas o texto.`;
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: card.description }],
          temperature: 0.2,
        }),
      });

      if (!response.ok) throw new Error('GPT Error');
      const data = await response.json();
      const fixedText = data.choices[0].message.content.replace(/\*/g, '');

      await updateKanbanCard(cardId, { description: fixedText }, `IA: ${mode === 'organize' ? 'Organizou por categorias' : 'Refinou mantendo ordem'}`);
      toast.success('✨ Descrição atualizada!');
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao refinar descrição.');
    }
  }, [kanbanCards, updateKanbanCard]);

  const addKanbanColumn = useCallback(async (employeeId: string, title: string, color: string) => {
    try {
      const existing = kanbanColumns.filter(c => c.employeeId === employeeId);
      if (existing.length === 0) {
        const defaultInserts = DEFAULT_COLUMNS.map(c => ({
          employee_id: employeeId, column_key: c.columnKey, title: c.title, color: c.color, position: c.position,
        }));
        const { error: defErr } = await supabase.from('kanban_columns').insert(defaultInserts);
        if (defErr) throw defErr;
      }
      const currentMax = existing.length > 0
        ? Math.max(...existing.map(c => c.position))
        : DEFAULT_COLUMNS.length - 1;
      const columnKey = slugify(title) || crypto.randomUUID();
      const { error } = await supabase.from('kanban_columns').insert({
        employee_id: employeeId, column_key: columnKey, title, color, position: currentMax + 1,
      });
      if (error) throw error;
    } catch (err: any) {
      console.error('Erro ao adicionar coluna:', err);
      toast.error('Erro ao adicionar coluna.');
    }
  }, [kanbanColumns]);

  const updateKanbanColumn = useCallback(async (id: string, updates: Partial<KanbanColumnDef>) => {
    try {
      // Optimistic
      setKanbanColumns(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
      
      const dbUpdates: any = {};
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.color !== undefined) dbUpdates.color = updates.color;
      if (updates.position !== undefined) dbUpdates.position = updates.position;
      const { error } = await supabase.from('kanban_columns').update(dbUpdates).eq('id', id);
      if (error) throw error;
    } catch (err: any) {
      console.error('Erro ao atualizar coluna:', err);
      toast.error('Erro ao atualizar coluna.');
    }
  }, []);

  const deleteKanbanColumn = useCallback(async (id: string) => {
    try {
      // Optimistic
      setKanbanColumns(prev => prev.filter(c => c.id !== id));
      
      const { error } = await supabase.from('kanban_columns').delete().eq('id', id);
      if (error) throw error;
    } catch (err: any) {
      console.error('Erro ao excluir coluna:', err);
      toast.error('Erro ao excluir coluna.');
    }
  }, []);

  const getColumnsForEmployee = useCallback((employeeId: string): KanbanColumnDef[] => {
    const cols = kanbanColumns.filter(c => c.employeeId === employeeId);
    if (cols.length === 0) {
      return DEFAULT_COLUMNS.map((c, i) => ({
        id: `default-${c.columnKey}`, employeeId, columnKey: c.columnKey,
        title: c.title, color: c.color, position: i,
      }));
    }
    return cols.sort((a, b) => a.position - b.position);
  }, [kanbanColumns]);

  const addCalendarTask = useCallback(async (task: Omit<CalendarTask, 'id'>) => {
    try {
      const { error } = await supabase.from('calendar_tasks').insert({
        calendar_client_id: task.calendarClientId, employee_id: task.employeeId,
        date: task.date, client_name: task.clientName, content_type: task.contentType || '',
        description: task.description || '', time: task.time || '', image_url: task.imageUrl || null,
        status: task.status || 'pendente',
      });
      if (error) throw error;
    } catch (err: any) {
      console.error('Erro ao adicionar tarefa:', err);
      toast.error('Erro ao adicionar tarefa.');
    }
  }, []);

  const updateCalendarTask = useCallback(async (id: string, updates: Partial<CalendarTask>) => {
    try {
      // Optimistic
      setCalendarTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
      
      const dbUpdates: any = {};
      if (updates.clientName !== undefined) dbUpdates.client_name = updates.clientName;
      if (updates.contentType !== undefined) dbUpdates.content_type = updates.contentType;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.time !== undefined) dbUpdates.time = updates.time;
      if ('imageUrl' in updates) dbUpdates.image_url = updates.imageUrl || null;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.employeeId !== undefined) dbUpdates.employee_id = updates.employeeId;
      if (updates.date !== undefined) dbUpdates.date = updates.date;
      const { error } = await supabase.from('calendar_tasks').update(dbUpdates).eq('id', id);
      if (error) throw error;
    } catch (err: any) {
      console.error('Erro ao atualizar tarefa:', err);
      toast.error('Erro ao atualizar tarefa.');
    }
  }, []);

  const deleteCalendarTask = useCallback(async (id: string) => {
    try {
      // Optimistic
      setCalendarTasks(prev => prev.filter(t => t.id !== id));
      
      const { error } = await supabase.from('calendar_tasks').delete().eq('id', id);
      if (error) throw error;
    } catch (err: any) {
      console.error('Erro ao excluir tarefa:', err);
      toast.error('Erro ao excluir tarefa.');
    }
  }, []);


  const addCredential = useCallback(async (cred: Omit<Credential, 'id'>) => {
    try {
      const { error } = await supabase.from('credentials').insert({
        employee_id: cred.employeeId, 
        calendar_client_id: cred.calendarClientId || null,
        label: cred.label,
        username: cred.username, password: cred.password, url: cred.url || null,
      });
      if (error) throw error;
    } catch (err: any) {
      console.error('Erro ao adicionar credencial:', err);
      toast.error('Erro ao adicionar credencial.');
    }
  }, []);

  const updateCredential = useCallback(async (id: string, updates: Partial<Credential>) => {
    try {
      const dbUpdates: any = {};
      if (updates.label !== undefined) dbUpdates.label = updates.label;
      if (updates.username !== undefined) dbUpdates.username = updates.username;
      if (updates.password !== undefined) dbUpdates.password = updates.password;
      if ('url' in updates) dbUpdates.url = updates.url || null;
      const { error } = await supabase.from('credentials').update(dbUpdates).eq('id', id);
      if (error) throw error;
    } catch (err: any) {
      console.error('Erro ao atualizar credencial:', err);
      toast.error('Erro ao atualizar credencial.');
    }
  }, []);

  const deleteCredential = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('credentials').delete().eq('id', id);
      if (error) throw error;
    } catch (err: any) {
      console.error('Erro ao excluir credencial:', err);
      toast.error('Erro ao excluir credencial.');
    }
  }, []);

  const addCalendarClient = useCallback(async (name: string, logoUrl?: string) => {
    try {
      const id = slugify(name) || crypto.randomUUID();
      const { error } = await supabase.from('calendar_clients').insert({ id, name, logo_url: logoUrl || null });
      if (error) throw error;
    } catch (err: any) {
      console.error('Erro ao adicionar cliente:', err);
      toast.error('Erro ao adicionar cliente.');
    }
  }, []);

  const updateCalendarClient = useCallback(async (id: string, updates: Partial<CalendarClient>) => {
    try {
      // Optimistic
      setCalendarClients(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
      
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if ('logoUrl' in updates) dbUpdates.logo_url = updates.logoUrl || null;
      if ('email' in updates) dbUpdates.email = updates.email || null;
      if ('phones' in updates) dbUpdates.phones = Array.isArray(updates.phones) ? updates.phones : null;
      if ('address' in updates) dbUpdates.address = updates.address || null;
      if ('notes' in updates) dbUpdates.notes = updates.notes || null;
      
      const { error } = await supabase.from('calendar_clients').update(dbUpdates).eq('id', id);
      if (error) throw error;
    } catch (err: any) {
      console.error('Erro ao atualizar cliente:', err);
      toast.error('Erro ao atualizar cliente.');
    }
  }, []);

  const deleteCalendarClient = useCallback(async (id: string) => {
    try {
      // Optimistic
      setCalendarClients(prev => prev.filter(c => c.id !== id));
      
      await supabase.from('calendar_tasks').delete().eq('calendar_client_id', id);
      const { error } = await supabase.from('calendar_clients').delete().eq('id', id);
      if (error) throw error;
    } catch (err: any) {
      console.error('Erro ao excluir cliente:', err);
      toast.error('Erro ao excluir cliente.');
    }
  }, []);

  const setDashboardBanner = useCallback(async (url: string) => {
    try {
      setDashboardBannerState(url);
      const { error } = await supabase.from('settings').upsert({ key: 'dashboardBanner', value: url });
      if (error) throw error;
    } catch (err: any) {
      console.error('Erro ao salvar banner:', err);
      toast.error('Erro ao salvar banner.');
    }
  }, []);

  const setDashboardLogo = useCallback(async (url: string) => {
    try {
      setDashboardLogoState(url);
      const { error } = await supabase.from('settings').upsert({ key: 'dashboardLogo', value: url });
      if (error) throw error;
    } catch (err: any) {
      console.error('Erro ao salvar logo:', err);
      toast.error('Erro ao salvar logo.');
    }
  }, []);

  // Stable context value to prevent unnecessary re-renders
  const contextValue = useMemo<AppState>(() => ({
    isAuthenticated, isAuthLoading, loggedUserId, loggedUserName, loggedUserRole,
    systemUsers, employees, kanbanCards, kanbanColumns,
    calendarTasks, credentials, calendarClients,
    dashboardBanner, dashboardLogo, loading,
    login, register, logout, adminDeleteUser, adminUpdateUserRole,
    addEmployee, updateEmployee, deleteEmployee,
    addKanbanCard, updateKanbanCard, deleteKanbanCard, moveKanbanCard,
    triggerAICorrection, fixDescriptionWithAI,
    addKanbanColumn, updateKanbanColumn, deleteKanbanColumn, getColumnsForEmployee,
    addCalendarTask, updateCalendarTask, deleteCalendarTask,
    addCredential, updateCredential, deleteCredential,
    addCalendarClient, updateCalendarClient, deleteCalendarClient,
    setDashboardBanner, setDashboardLogo,
  }), [
    isAuthenticated, isAuthLoading, loggedUserId, loggedUserName, loggedUserRole,
    systemUsers, employees, kanbanCards, kanbanColumns,
    calendarTasks, credentials, calendarClients,
    dashboardBanner, dashboardLogo, loading,
    login, register, logout, adminDeleteUser, adminUpdateUserRole,
    addEmployee, updateEmployee, deleteEmployee,
    addKanbanCard, updateKanbanCard, deleteKanbanCard, moveKanbanCard,
    triggerAICorrection, fixDescriptionWithAI,
    addKanbanColumn, updateKanbanColumn, deleteKanbanColumn, getColumnsForEmployee,
    addCalendarTask, updateCalendarTask, deleteCalendarTask,
    addCredential, updateCredential, deleteCredential,
    addCalendarClient, updateCalendarClient, deleteCalendarClient,
    setDashboardBanner, setDashboardLogo,
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}
