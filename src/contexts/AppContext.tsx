import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface KanbanCard {
  id: string;
  clientName: string;
  description: string;
  imageUrl?: string;
  column: 'todo' | 'production' | 'correction' | 'done';
  timeSpent: number; // seconds
  timerRunning: boolean;
  timerStart?: number;
  employeeId: string;
}

export interface CalendarTask {
  id: string;
  date: string; // YYYY-MM-DD
  clientName: string;
  contentType: string;
  description: string;
  time: string;
  imageUrl?: string;
  status: string;
  employeeId: string;
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
}

interface AppState {
  isAuthenticated: boolean;
  employees: Employee[];
  kanbanCards: KanbanCard[];
  calendarTasks: CalendarTask[];
  credentials: Credential[];
  login: (password: string) => boolean;
  logout: () => void;
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
}

const AppContext = createContext<AppState | null>(null);

const DEFAULT_EMPLOYEES: Employee[] = [
  { id: 'tiago', name: 'Tiago', role: 'Designer', avatar: '🎨' },
  { id: 'ana', name: 'Ana', role: 'Social Media', avatar: '📱' },
  { id: 'lucas', name: 'Lucas', role: 'Copywriter', avatar: '✍️' },
  { id: 'maria', name: 'Maria', role: 'Gestora de Tráfego', avatar: '📊' },
];

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function loadState<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => loadState('auth', false));
  const [kanbanCards, setKanbanCards] = useState<KanbanCard[]>(() => loadState('kanbanCards', []));
  const [calendarTasks, setCalendarTasks] = useState<CalendarTask[]>(() => loadState('calendarTasks', []));
  const [credentials, setCredentials] = useState<Credential[]>(() => loadState('credentials', []));

  useEffect(() => { localStorage.setItem('auth', JSON.stringify(isAuthenticated)); }, [isAuthenticated]);
  useEffect(() => { localStorage.setItem('kanbanCards', JSON.stringify(kanbanCards)); }, [kanbanCards]);
  useEffect(() => { localStorage.setItem('calendarTasks', JSON.stringify(calendarTasks)); }, [calendarTasks]);
  useEffect(() => { localStorage.setItem('credentials', JSON.stringify(credentials)); }, [credentials]);

  const login = (password: string) => {
    if (password === 'agencia2024') {
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };

  const logout = () => setIsAuthenticated(false);

  const addKanbanCard = (card: Omit<KanbanCard, 'id'>) => {
    setKanbanCards(prev => [...prev, { ...card, id: generateId() }]);
  };

  const updateKanbanCard = (id: string, updates: Partial<KanbanCard>) => {
    setKanbanCards(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const deleteKanbanCard = (id: string) => {
    setKanbanCards(prev => prev.filter(c => c.id !== id));
  };

  const moveKanbanCard = (id: string, column: KanbanCard['column']) => {
    setKanbanCards(prev => prev.map(c => {
      if (c.id !== id) return c;
      const now = Date.now();
      
      if (column === 'production' && c.column !== 'production') {
        return { ...c, column, timerRunning: true, timerStart: now };
      }
      if (column !== 'production' && c.column === 'production' && c.timerRunning) {
        const elapsed = c.timerStart ? Math.floor((now - c.timerStart) / 1000) : 0;
        return { ...c, column, timerRunning: false, timeSpent: c.timeSpent + elapsed, timerStart: undefined };
      }
      return { ...c, column };
    }));
  };

  const addCalendarTask = (task: Omit<CalendarTask, 'id'>) => {
    setCalendarTasks(prev => [...prev, { ...task, id: generateId() }]);
  };

  const updateCalendarTask = (id: string, updates: Partial<CalendarTask>) => {
    setCalendarTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const deleteCalendarTask = (id: string) => {
    setCalendarTasks(prev => prev.filter(t => t.id !== id));
  };

  const convertTaskToCard = (taskId: string) => {
    const task = calendarTasks.find(t => t.id === taskId);
    if (!task) return;
    addKanbanCard({
      clientName: task.clientName,
      description: `${task.contentType}: ${task.description}`,
      imageUrl: task.imageUrl,
      column: 'todo',
      timeSpent: 0,
      timerRunning: false,
      employeeId: task.employeeId,
    });
  };

  const addCredential = (cred: Omit<Credential, 'id'>) => {
    setCredentials(prev => [...prev, { ...cred, id: generateId() }]);
  };

  const updateCredential = (id: string, updates: Partial<Credential>) => {
    setCredentials(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const deleteCredential = (id: string) => {
    setCredentials(prev => prev.filter(c => c.id !== id));
  };

  return (
    <AppContext.Provider value={{
      isAuthenticated, employees: DEFAULT_EMPLOYEES,
      kanbanCards, calendarTasks, credentials,
      login, logout,
      addKanbanCard, updateKanbanCard, deleteKanbanCard, moveKanbanCard,
      addCalendarTask, updateCalendarTask, deleteCalendarTask, convertTaskToCard,
      addCredential, updateCredential, deleteCredential,
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
