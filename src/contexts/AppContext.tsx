import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface KanbanCard {
  id: string;
  clientName: string;
  description: string;
  notes?: string;
  images?: string[];
  imageUrl?: string;
  column: string;
  timeSpent: number;
  timerRunning: boolean;
  timerStart?: number;
  employeeId: string;
  archivedAt?: string;
}

export interface KanbanColumnDef {
  id: string;
  employeeId: string;
  columnKey: string;
  title: string;
  color: string;
  position: number;
}

export interface CalendarTask {
  id: string;
  date: string;
  clientName: string;
  contentType: string;
  description: string;
  time: string;
  imageUrl?: string;
  status: string;
  employeeId: string;
  calendarClientId: string;
}

export interface Credential {
  id: string;
  label: string;
  username: string;
  password: string;
  url?: string;
  employeeId: string;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  avatar: string;
  photoUrl?: string;
}

export interface CalendarClient {
  id: string;
  name: string;
}

const DEFAULT_COLUMNS = [
  { columnKey: 'para-producao', title: 'Para Produção', color: 'bg-info', position: 0 },
  { columnKey: 'em-producao', title: 'Em Produção', color: 'bg-warning', position: 1 },
  { columnKey: 'alteracao', title: 'Alteração', color: 'bg-primary', position: 2 },
  { columnKey: 'para-correcao', title: 'Para Correção', color: 'bg-destructive', position: 3 },
  { columnKey: 'correcao-cliente', title: 'Correção do Cliente', color: 'bg-destructive', position: 4 },
  { columnKey: 'aprovado', title: 'Aprovado', color: 'bg-success', position: 5 },
  { columnKey: 'programar', title: 'Programar', color: 'bg-info', position: 6 },
  { columnKey: 'postado', title: 'Postado', color: 'bg-success', position: 7 },
];

const FIXED_COLUMN_KEYS = DEFAULT_COLUMNS.map(c => c.columnKey);

interface AppState {
  isAuthenticated: boolean;
  employees: Employee[];
  kanbanCards: KanbanCard[];
  kanbanColumns: KanbanColumnDef[];
  calendarTasks: CalendarTask[];
  credentials: Credential[];
  calendarClients: CalendarClient[];
  dashboardBanner?: string;
  dashboardLogo?: string;
  loading: boolean;
  login: (password: string) => boolean;
  logout: () => void;
  addEmployee: (emp: Omit<Employee, 'id'>) => void;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
  deleteEmployee: (id: string, deleteData?: boolean) => void;
  addKanbanCard: (card: Omit<KanbanCard, 'id'>) => void;
  updateKanbanCard: (id: string, updates: Partial<KanbanCard>) => void;
  deleteKanbanCard: (id: string) => void;
  moveKanbanCard: (id: string, column: string) => void;
  addKanbanColumn: (employeeId: string, title: string, color: string) => void;
  updateKanbanColumn: (id: string, updates: Partial<KanbanColumnDef>) => void;
  deleteKanbanColumn: (id: string) => void;
  getColumnsForEmployee: (employeeId: string) => KanbanColumnDef[];
  addCalendarTask: (task: Omit<CalendarTask, 'id'>) => void;
  updateCalendarTask: (id: string, updates: Partial<CalendarTask>) => void;
  deleteCalendarTask: (id: string) => void;
  convertTaskToCard: (taskId: string) => void;
  addCredential: (cred: Omit<Credential, 'id'>) => void;
  updateCredential: (id: string, updates: Partial<Credential>) => void;
  deleteCredential: (id: string) => void;
  addCalendarClient: (name: string) => void;
  deleteCalendarClient: (id: string) => void;
  setDashboardBanner: (url: string) => void;
  setDashboardLogo: (url: string) => void;
}

const AppContext = createContext<AppState | null>(null);

export function slugify(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function mapEmployee(row: any): Employee {
  return { id: row.id, name: row.name, role: row.role, avatar: row.avatar, photoUrl: row.photo_url || undefined };
}

function mapKanbanCard(row: any): KanbanCard {
  return {
    id: row.id, clientName: row.client_name, description: row.description,
    notes: row.notes || undefined, images: row.images || [],
    column: row.column, timeSpent: row.time_spent ?? 0,
    timerRunning: row.timer_running ?? false, timerStart: row.timer_start || undefined,
    employeeId: row.employee_id, archivedAt: row.archived_at || undefined,
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
  return { id: row.id, label: row.label, username: row.username, password: row.password, url: row.url || undefined, employeeId: row.employee_id };
}

function mapCalendarClient(row: any): CalendarClient {
  return { id: row.id, name: row.name };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    try { return JSON.parse(localStorage.getItem('auth') || 'false'); } catch { return false; }
  });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [kanbanCards, setKanbanCards] = useState<KanbanCard[]>([]);
  const [kanbanColumns, setKanbanColumns] = useState<KanbanColumnDef[]>([]);
  const [calendarTasks, setCalendarTasks] = useState<CalendarTask[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [calendarClients, setCalendarClients] = useState<CalendarClient[]>([]);
  const [dashboardBanner, setDashboardBannerState] = useState<string | undefined>();
  const [dashboardLogo, setDashboardLogoState] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [empRes, cardsRes, colsRes, tasksRes, credsRes, clientsRes, settingsRes] = await Promise.all([
        supabase.from('employees').select('*'),
        supabase.from('kanban_cards').select('*').or('archived_at.is.null,archived_at.gt.' + new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('kanban_columns').select('*'),
        supabase.from('calendar_tasks').select('*'),
        supabase.from('credentials').select('*'),
        supabase.from('calendar_clients').select('*'),
        supabase.from('settings').select('*'),
      ]);
      setEmployees(empRes.data?.map(mapEmployee) || []);
      setKanbanCards(cardsRes.data?.map(mapKanbanCard) || []);
      setKanbanColumns(colsRes.data?.map(mapKanbanColumn) || []);
      setCalendarTasks(tasksRes.data?.map(mapCalendarTask) || []);
      setCredentials(credsRes.data?.map(mapCredential) || []);
      setCalendarClients(clientsRes.data?.map(mapCalendarClient) || []);
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

  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return; }
    fetchAll();
    cleanupOldArchived();

    const channel = supabase.channel('realtime-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, () => {
        supabase.from('employees').select('*').then(r => { if (r.data) setEmployees(r.data.map(mapEmployee)); });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kanban_cards' }, () => {
        const cutoff = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
        supabase.from('kanban_cards').select('*').or(`archived_at.is.null,archived_at.gt.${cutoff}`).then(r => { if (r.data) setKanbanCards(r.data.map(mapKanbanCard)); });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kanban_columns' }, () => {
        supabase.from('kanban_columns').select('*').then(r => { if (r.data) setKanbanColumns(r.data.map(mapKanbanColumn)); });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_tasks' }, () => {
        supabase.from('calendar_tasks').select('*').then(r => { if (r.data) setCalendarTasks(r.data.map(mapCalendarTask)); });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'credentials' }, () => {
        supabase.from('credentials').select('*').then(r => { if (r.data) setCredentials(r.data.map(mapCredential)); });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_clients' }, () => {
        supabase.from('calendar_clients').select('*').then(r => { if (r.data) setCalendarClients(r.data.map(mapCalendarClient)); });
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
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isAuthenticated, fetchAll, cleanupOldArchived]);

  useEffect(() => { localStorage.setItem('auth', JSON.stringify(isAuthenticated)); }, [isAuthenticated]);

  const login = (password: string) => {
    if (password === 'Mudar@123') { setIsAuthenticated(true); return true; }
    return false;
  };
  const logout = () => setIsAuthenticated(false);

  const addEmployee = async (emp: Omit<Employee, 'id'>) => {
    try {
      const { data, error } = await supabase.from('employees').insert({ name: emp.name, role: emp.role, avatar: emp.avatar, photo_url: emp.photoUrl || null }).select();
      if (error) throw error;
      // Create default columns for new employee
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
  };

  const updateEmployee = async (id: string, updates: Partial<Employee>) => {
    try {
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
  };

  const deleteEmployee = async (id: string) => {
    try {
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
  };

  const addKanbanCard = async (card: Omit<KanbanCard, 'id'>) => {
    try {
      const { error } = await supabase.from('kanban_cards').insert({
        employee_id: card.employeeId, client_name: card.clientName,
        description: card.description || '', notes: card.notes || null,
        images: card.images || [], column: card.column,
        time_spent: card.timeSpent ?? 0, timer_running: card.timerRunning ?? false,
        timer_start: card.timerStart || null,
      });
      if (error) throw error;
    } catch (err: any) {
      console.error('Erro ao adicionar card:', err);
      toast.error('Erro ao adicionar card.');
    }
  };

  const updateKanbanCard = async (id: string, updates: Partial<KanbanCard>) => {
    try {
      const dbUpdates: any = {};
      if (updates.clientName !== undefined) dbUpdates.client_name = updates.clientName;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if ('notes' in updates) dbUpdates.notes = updates.notes || null;
      if (updates.images !== undefined) dbUpdates.images = updates.images;
      if (updates.column !== undefined) dbUpdates.column = updates.column;
      if (updates.timeSpent !== undefined) dbUpdates.time_spent = updates.timeSpent;
      if (updates.timerRunning !== undefined) dbUpdates.timer_running = updates.timerRunning;
      if ('timerStart' in updates) dbUpdates.timer_start = updates.timerStart || null;
      if ('archivedAt' in updates) dbUpdates.archived_at = updates.archivedAt || null;
      const { error } = await supabase.from('kanban_cards').update(dbUpdates).eq('id', id);
      if (error) throw error;
    } catch (err: any) {
      console.error('Erro ao atualizar card:', err);
      toast.error('Erro ao atualizar card.');
    }
  };

  const deleteKanbanCard = async (id: string) => {
    try {
      const { error } = await supabase.from('kanban_cards').delete().eq('id', id);
      if (error) throw error;
    } catch (err: any) {
      console.error('Erro ao excluir card:', err);
      toast.error('Erro ao excluir card.');
    }
  };

  const moveKanbanCard = async (id: string, column: string) => {
    try {
      const card = kanbanCards.find(c => c.id === id);
      if (!card) return;
      const now = Date.now();
      const dbUpdates: any = { column };
      if (column === 'production' && card.column !== 'production') {
        dbUpdates.timer_running = true;
        dbUpdates.timer_start = now;
      } else if (column !== 'production' && card.column === 'production' && card.timerRunning) {
        const elapsed = card.timerStart ? Math.floor((now - card.timerStart) / 1000) : 0;
        dbUpdates.timer_running = false;
        dbUpdates.time_spent = card.timeSpent + elapsed;
        dbUpdates.timer_start = null;
      }
      if (column === 'done') {
        dbUpdates.archived_at = new Date().toISOString();
      }
      const { error } = await supabase.from('kanban_cards').update(dbUpdates).eq('id', id);
      if (error) throw error;
    } catch (err: any) {
      console.error('Erro ao mover card:', err);
      toast.error('Erro ao mover card.');
    }
  };

  const addKanbanColumn = async (employeeId: string, title: string, color: string) => {
    try {
      const existing = kanbanColumns.filter(c => c.employeeId === employeeId);
      // If no columns in DB yet, persist the defaults first
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
  };

  const updateKanbanColumn = async (id: string, updates: Partial<KanbanColumnDef>) => {
    try {
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
  };

  const deleteKanbanColumn = async (id: string) => {
    try {
      const { error } = await supabase.from('kanban_columns').delete().eq('id', id);
      if (error) throw error;
    } catch (err: any) {
      console.error('Erro ao excluir coluna:', err);
      toast.error('Erro ao excluir coluna.');
    }
  };

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

  const addCalendarTask = async (task: Omit<CalendarTask, 'id'>) => {
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
  };

  const updateCalendarTask = async (id: string, updates: Partial<CalendarTask>) => {
    try {
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
  };

  const deleteCalendarTask = async (id: string) => {
    try {
      const { error } = await supabase.from('calendar_tasks').delete().eq('id', id);
      if (error) throw error;
    } catch (err: any) {
      console.error('Erro ao excluir tarefa:', err);
      toast.error('Erro ao excluir tarefa.');
    }
  };

  const convertTaskToCard = async (taskId: string) => {
    try {
      const task = calendarTasks.find(t => t.id === taskId);
      if (!task) return;
      await addKanbanCard({
        clientName: task.clientName, description: `${task.contentType}: ${task.description}`,
        column: 'todo', timeSpent: 0, timerRunning: false, employeeId: task.employeeId,
      });
    } catch (err: any) {
      console.error('Erro ao converter tarefa:', err);
      toast.error('Erro ao converter tarefa em card.');
    }
  };

  const addCredential = async (cred: Omit<Credential, 'id'>) => {
    try {
      const { error } = await supabase.from('credentials').insert({
        employee_id: cred.employeeId, label: cred.label,
        username: cred.username, password: cred.password, url: cred.url || null,
      });
      if (error) throw error;
    } catch (err: any) {
      console.error('Erro ao adicionar credencial:', err);
      toast.error('Erro ao adicionar credencial.');
    }
  };

  const updateCredential = async (id: string, updates: Partial<Credential>) => {
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
  };

  const deleteCredential = async (id: string) => {
    try {
      const { error } = await supabase.from('credentials').delete().eq('id', id);
      if (error) throw error;
    } catch (err: any) {
      console.error('Erro ao excluir credencial:', err);
      toast.error('Erro ao excluir credencial.');
    }
  };

  const addCalendarClient = async (name: string) => {
    try {
      const id = slugify(name) || crypto.randomUUID();
      const { error } = await supabase.from('calendar_clients').insert({ id, name });
      if (error) throw error;
    } catch (err: any) {
      console.error('Erro ao adicionar cliente:', err);
      toast.error('Erro ao adicionar cliente.');
    }
  };

  const deleteCalendarClient = async (id: string) => {
    try {
      await supabase.from('calendar_tasks').delete().eq('calendar_client_id', id);
      const { error } = await supabase.from('calendar_clients').delete().eq('id', id);
      if (error) throw error;
    } catch (err: any) {
      console.error('Erro ao excluir cliente:', err);
      toast.error('Erro ao excluir cliente.');
    }
  };

  const setDashboardBanner = async (url: string) => {
    try {
      setDashboardBannerState(url);
      const { error } = await supabase.from('settings').upsert({ key: 'dashboardBanner', value: url });
      if (error) throw error;
    } catch (err: any) {
      console.error('Erro ao salvar banner:', err);
      toast.error('Erro ao salvar banner.');
    }
  };

  const setDashboardLogo = async (url: string) => {
    try {
      setDashboardLogoState(url);
      const { error } = await supabase.from('settings').upsert({ key: 'dashboardLogo', value: url });
      if (error) throw error;
    } catch (err: any) {
      console.error('Erro ao salvar logo:', err);
      toast.error('Erro ao salvar logo.');
    }
  };

  return (
    <AppContext.Provider value={{
      isAuthenticated, employees, kanbanCards, kanbanColumns,
      calendarTasks, credentials, calendarClients,
      dashboardBanner, dashboardLogo, loading,
      login, logout,
      addEmployee, updateEmployee, deleteEmployee,
      addKanbanCard, updateKanbanCard, deleteKanbanCard, moveKanbanCard,
      addKanbanColumn, updateKanbanColumn, deleteKanbanColumn, getColumnsForEmployee,
      addCalendarTask, updateCalendarTask, deleteCalendarTask, convertTaskToCard,
      addCredential, updateCredential, deleteCredential,
      addCalendarClient, deleteCalendarClient,
      setDashboardBanner, setDashboardLogo,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
