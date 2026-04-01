export interface CardAction {
  id: string;
  userId: string;
  userName: string;
  actionType: 'create' | 'move' | 'edit' | 'status_change';
  description: string;
  createdAt: string;
}

export interface SystemUser {
  id: string;
  fullName: string;
  email: string;
  role: 'ADMIN' | 'USER';
  avatarUrl?: string;
  createdAt: string;
}

export interface KanbanCard {
  id: string;
  clientName: string;
  description: string;
  notes?: string;
  images?: string[];
  imageUrl?: string;
  coverImage?: string;
  labels?: string[];
  checklists?: { id: string; title: string; completed: boolean }[];
  comments?: { id: string; text: string; createdAt: string; userId: string; userName: string }[];
  assignedUsers?: SystemUser[];
  column: string;
  timeSpent: number;
  timerRunning: boolean;
  timerStart?: number;
  employeeId: string;
  archivedAt?: string;
  history?: CardAction[];
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
  email?: string;
  password?: string;
}

export interface CalendarClient {
  id: string;
  name: string;
}

export const DEFAULT_COLUMNS = [
  { columnKey: 'para-producao', title: 'Para Produção', color: 'bg-info', position: 0 },
  { columnKey: 'em-producao', title: 'Em Produção', color: 'bg-warning', position: 1 },
  { columnKey: 'alteracao', title: 'Alteração', color: 'bg-primary', position: 2 },
  { columnKey: 'para-correcao', title: 'Para Correção', color: 'bg-destructive', position: 3 },
  { columnKey: 'correcao-cliente', title: 'Correção do Cliente', color: 'bg-destructive', position: 4 },
  { columnKey: 'aprovado-programar', title: 'Aprovado e Programar', color: 'bg-success', position: 5 },
  { columnKey: 'postado', title: 'Postado', color: 'bg-success', position: 6 },
] as const;

export const FIXED_COLUMN_KEYS: string[] = DEFAULT_COLUMNS.map((c) => c.columnKey);

export function slugify(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export interface AppState {
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  loggedUserId: string | null;
  loggedUserName: string | null;
  loggedUserRole: 'ADMIN' | 'USER' | null;
  systemUsers: SystemUser[];
  employees: Employee[];
  kanbanCards: KanbanCard[];
  kanbanColumns: KanbanColumnDef[];
  calendarTasks: CalendarTask[];
  credentials: Credential[];
  calendarClients: CalendarClient[];
  dashboardBanner?: string;
  dashboardLogo?: string;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  adminDeleteUser: (id: string) => Promise<{ success: boolean; error?: string }>;
  adminUpdateUserRole: (id: string, role: string) => Promise<{ success: boolean; error?: string }>;
  addEmployee: (emp: Omit<Employee, 'id'>) => void;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
  deleteEmployee: (id: string, deleteData?: boolean) => void;
  addKanbanCard: (card: Omit<KanbanCard, 'id'>) => void;
  updateKanbanCard: (id: string, updates: Partial<KanbanCard>, actionDescription?: string) => void;
  deleteKanbanCard: (id: string) => void;
  moveKanbanCard: (id: string, column: string) => void;
  addKanbanColumn: (employeeId: string, title: string, color: string) => void;
  updateKanbanColumn: (id: string, updates: Partial<KanbanColumnDef>) => void;
  deleteKanbanColumn: (id: string) => void;
  getColumnsForEmployee: (employeeId: string) => KanbanColumnDef[];
  addCalendarTask: (task: Omit<CalendarTask, 'id'>) => void;
  updateCalendarTask: (id: string, updates: Partial<CalendarTask>) => void;
  deleteCalendarTask: (id: string) => void;
  addCredential: (cred: Omit<Credential, 'id'>) => void;
  updateCredential: (id: string, updates: Partial<Credential>) => void;
  deleteCredential: (id: string) => void;
  addCalendarClient: (name: string) => void;
  deleteCalendarClient: (id: string) => void;
  setDashboardBanner: (url: string) => void;
  setDashboardLogo: (url: string) => void;
}
