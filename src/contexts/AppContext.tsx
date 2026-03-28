import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface KanbanCard {
  id: string;
  clientName: string;
  description: string;
  notes?: string;
  images?: string[];
  imageUrl?: string;
  column: 'todo' | 'production' | 'correction' | 'done';
  timeSpent: number;
  timerRunning: boolean;
  timerStart?: number;
  employeeId: string;
  archivedAt?: string;
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

interface AppState {
  isAuthenticated: boolean;
  employees: Employee[];
  kanbanCards: KanbanCard[];
  calendarTasks: CalendarTask[];
  credentials: Credential[];
  calendarClients: CalendarClient[];
  dashboardBanner?: string;
  dashboardLogo?: string;
  login: (password: string) => boolean;
  logout: () => void;
  addEmployee: (emp: Omit<Employee, 'id'>) => void;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
  deleteEmployee: (id: string, deleteData?: boolean) => void;
  addKanbanCard: (card: Omit<KanbanCard, 'id'>) => void;
  updateKanbanCard: (id: string, updates: Partial<KanbanCard>) => void;
  deleteKanbanCard: (id: string) => void;
  moveKanbanCard: (id: string, column: KanbanCard['column']) => void;
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

// Helper to map DB row to app model
function mapEmployee(row: any): Employee {
  return { id: row.id, name: row.name, role: row.role, avatar: row.avatar, photoUrl: row.photo_url || undefined };
}

function mapKanbanCard(row: any): KanbanCard {
  return {
    id: row.id,
    clientName: row.client_name,
    description: row.description,
    notes: row.notes || undefined,
    images: row.images || [],
    column: row.column as KanbanCard['column'],
    timeSpent: row.time_spent,
    timerRunning: row.timer_running,
    timerStart: row.timer_start || undefined,
    employeeId: row.employee_id,
    archivedAt: row.archived_at || undefined,
  };
}

function mapCalendarTask(row: any): CalendarTask {
  return {
    id: row.id, date: row.date, clientName: row.client_name,
    contentType: row.content_type, description: row.description,
    time: row.time, imageUrl: row.image_url || undefined,
    status: row.status, employeeId: row.employee_id,
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
  const [calendarTasks, setCalendarTasks] = useState<CalendarTask[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [calendarClients, setCalendarClients] = useState<CalendarClient[]>([]);
  const [dashboardBanner, setDashboardBannerState] = useState<string | undefined>();
  const [dashboardLogo, setDashboardLogoState] = useState<string | undefined>();

  // Fetch all data
  const fetchAll = useCallback(async () => {
    const [empRes, cardsRes, tasksRes, credsRes, clientsRes, settingsRes] = await Promise.all([
      supabase.from('employees').select('*'),
      supabase.from('kanban_cards').select('*').or('archived_at.is.null,archived_at.gt.' + new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()),
      supabase.from('calendar_tasks').select('*'),
      supabase.from('credentials').select('*'),
      supabase.from('calendar_clients').select('*'),
      supabase.from('settings').select('*'),
    ]);
    if (empRes.data) setEmployees(empRes.data.map(mapEmployee));
    if (cardsRes.data) setKanbanCards(cardsRes.data.map(mapKanbanCard));
    if (tasksRes.data) setCalendarTasks(tasksRes.data.map(mapCalendarTask));
    if (credsRes.data) setCredentials(credsRes.data.map(mapCredential));
    if (clientsRes.data) setCalendarClients(clientsRes.data.map(mapCalendarClient));
    if (settingsRes.data) {
      const banner = settingsRes.data.find((s: any) => s.key === 'dashboardBanner');
      const logo = settingsRes.data.find((s: any) => s.key === 'dashboardLogo');
      if (banner) setDashboardBannerState(banner.value || undefined);
      if (logo) setDashboardLogoState(logo.value || undefined);
    }
  }, []);

  // Auto-delete cards archived > 60 days
  const cleanupOldArchived = useCallback(async () => {
    const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('kanban_cards').delete().not('archived_at', 'is', null).lt('archived_at', cutoff);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchAll();
    cleanupOldArchived();

    // Real-time subscriptions
    const channel = supabase.channel('realtime-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, () => {
        supabase.from('employees').select('*').then(r => { if (r.data) setEmployees(r.data.map(mapEmployee)); });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kanban_cards' }, () => {
        const cutoff = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
        supabase.from('kanban_cards').select('*').or(`archived_at.is.null,archived_at.gt.${cutoff}`).then(r => { if (r.data) setKanbanCards(r.data.map(mapKanbanCard)); });
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
    await supabase.from('employees').insert({ name: emp.name, role: emp.role, avatar: emp.avatar, photo_url: emp.photoUrl || null });
  };

  const updateEmployee = async (id: string, updates: Partial<Employee>) => {
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.role !== undefined) dbUpdates.role = updates.role;
    if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar;
    if ('photoUrl' in updates) dbUpdates.photo_url = updates.photoUrl || null;
    await supabase.from('employees').update(dbUpdates).eq('id', id);
  };

  const deleteEmployee = async (id: string) => {
    await supabase.from('employees').delete().eq('id', id);
  };

  const addKanbanCard = async (card: Omit<KanbanCard, 'id'>) => {
    await supabase.from('kanban_cards').insert({
      employee_id: card.employeeId, client_name: card.clientName,
      description: card.description, notes: card.notes || null,
      images: card.images || [], column: card.column,
      time_spent: card.timeSpent, timer_running: card.timerRunning,
      timer_start: card.timerStart || null,
    });
  };

  const updateKanbanCard = async (id: string, updates: Partial<KanbanCard>) => {
    const dbUpdates: any = {};
    if (updates.clientName !== undefined) dbUpdates.client_name = updates.clientName;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if ('notes' in updates) dbUpdates.notes = updates.notes || null;
    if (updates.images !== undefined) dbUpdates.images = updates.images;
    if (updates.column !== undefined) dbUpdates.column = updates.column;
    if (updates.timeSpent !== undefined) dbUpdates.time_spent = updates.timeSpent;
    if (updates.timerRunning !== undefined) dbUpdates.timer_running = updates.timerRunning;
    if ('timerStart' in updates) dbUpdates.timer_start = updates.timerStart || null;
    await supabase.from('kanban_cards').update(dbUpdates).eq('id', id);
  };

  const deleteKanbanCard = async (id: string) => {
    await supabase.from('kanban_cards').delete().eq('id', id);
  };

  const moveKanbanCard = async (id: string, column: KanbanCard['column']) => {
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
    await supabase.from('kanban_cards').update(dbUpdates).eq('id', id);
  };

  const addCalendarTask = async (task: Omit<CalendarTask, 'id'>) => {
    await supabase.from('calendar_tasks').insert({
      calendar_client_id: task.calendarClientId, employee_id: task.employeeId,
      date: task.date, client_name: task.clientName, content_type: task.contentType,
      description: task.description, time: task.time, image_url: task.imageUrl || null,
      status: task.status,
    });
  };

  const updateCalendarTask = async (id: string, updates: Partial<CalendarTask>) => {
    const dbUpdates: any = {};
    if (updates.clientName !== undefined) dbUpdates.client_name = updates.clientName;
    if (updates.contentType !== undefined) dbUpdates.content_type = updates.contentType;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.time !== undefined) dbUpdates.time = updates.time;
    if ('imageUrl' in updates) dbUpdates.image_url = updates.imageUrl || null;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.employeeId !== undefined) dbUpdates.employee_id = updates.employeeId;
    if (updates.date !== undefined) dbUpdates.date = updates.date;
    await supabase.from('calendar_tasks').update(dbUpdates).eq('id', id);
  };

  const deleteCalendarTask = async (id: string) => {
    await supabase.from('calendar_tasks').delete().eq('id', id);
  };

  const convertTaskToCard = async (taskId: string) => {
    const task = calendarTasks.find(t => t.id === taskId);
    if (!task) return;
    await addKanbanCard({
      clientName: task.clientName,
      description: `${task.contentType}: ${task.description}`,
      column: 'todo',
      timeSpent: 0,
      timerRunning: false,
      employeeId: task.employeeId,
    });
  };

  const addCredential = async (cred: Omit<Credential, 'id'>) => {
    await supabase.from('credentials').insert({
      employee_id: cred.employeeId, label: cred.label,
      username: cred.username, password: cred.password, url: cred.url || null,
    });
  };

  const updateCredential = async (id: string, updates: Partial<Credential>) => {
    const dbUpdates: any = {};
    if (updates.label !== undefined) dbUpdates.label = updates.label;
    if (updates.username !== undefined) dbUpdates.username = updates.username;
    if (updates.password !== undefined) dbUpdates.password = updates.password;
    if ('url' in updates) dbUpdates.url = updates.url || null;
    await supabase.from('credentials').update(dbUpdates).eq('id', id);
  };

  const deleteCredential = async (id: string) => {
    await supabase.from('credentials').delete().eq('id', id);
  };

  const addCalendarClient = async (name: string) => {
    const id = slugify(name) || crypto.randomUUID();
    await supabase.from('calendar_clients').insert({ id, name });
  };

  const deleteCalendarClient = async (id: string) => {
    await supabase.from('calendar_clients').delete().eq('id', id);
  };

  const setDashboardBanner = async (url: string) => {
    setDashboardBannerState(url);
    await supabase.from('settings').upsert({ key: 'dashboardBanner', value: url });
  };

  const setDashboardLogo = async (url: string) => {
    setDashboardLogoState(url);
    await supabase.from('settings').upsert({ key: 'dashboardLogo', value: url });
  };

  return (
    <AppContext.Provider value={{
      isAuthenticated, employees,
      kanbanCards, calendarTasks, credentials, calendarClients,
      dashboardBanner, dashboardLogo,
      login, logout,
      addEmployee, updateEmployee, deleteEmployee,
      addKanbanCard, updateKanbanCard, deleteKanbanCard, moveKanbanCard,
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