import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '@/contexts/useApp';
import { getStuckCards } from '@/features/kanban/utils/stuckCards';
import { getStoredEmployeeOrder, saveStoredEmployeeOrder, sortEmployeesByCustomOrder } from '@/utils/employeeOrder';
import { 
  LayoutDashboard, 
  Users, 
  FileEdit, 
  LayoutGrid, 
  Calendar, 
  Folder, 
  MessageSquare, 
  Home,
  BarChart3,
  Shield, 
  LogOut, 
  ChevronLeft, 
  ChevronRight, 
  ChevronUp,
  ChevronDown,
  ChevronsUp,
  ArrowUpDown, 
  LucideIcon,
  Zap,
  FileText,
  Wallet,
  Instagram
} from 'lucide-react';
import defaultLogo from '@/assets/logo-mac-midia.png';

export type NavItem = {
  path: string;
  icon: LucideIcon;
  label: string;
  isBeta?: boolean;
};

export const navItems: NavItem[] = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/equipe', icon: Users, label: 'Equipe' },
  { path: '/correcao', icon: FileEdit, label: 'Correções' },
  { path: '/postagem', icon: LayoutGrid, label: 'Postagens' },
  { path: '/calendario', icon: Calendar, label: 'Calendário' },
  { path: '/cofre', icon: Folder, label: 'Banco de Dados' },
  { path: '/relatorios', icon: FileText, label: 'Relatórios' },
  { path: '/financeiro', icon: Wallet, label: 'Financeiro' },
  { path: '/whatsapp', icon: Instagram, label: 'Auto Post' },
  { path: '/produtos', icon: Home, label: 'Produtos', isBeta: true },
  { path: '/gerador-artes', icon: Zap, label: 'MacOferta Pro' },
];

interface Props {
  collapsed: boolean;
  onToggle: () => void;
  teamOpen: boolean;
  onTeamToggle: () => void;
}

const AppSidebar = ({ collapsed, onToggle, teamOpen, onTeamToggle }: Props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, dashboardLogo, loggedUserRole, loggedUserKanbanLink, employees, kanbanCards = [] } = useApp();

  const [employeeOrder, setEmployeeOrder] = useState<string[]>(() => getStoredEmployeeOrder());
  const [isReordering, setIsReordering] = useState(false);

  useEffect(() => {
    const handleOrderChange = () => {
      setEmployeeOrder(getStoredEmployeeOrder());
    };
    window.addEventListener('employee-order-changed', handleOrderChange);
    return () => window.removeEventListener('employee-order-changed', handleOrderChange);
  }, []);

  const sortedEmployees = useMemo(() => {
    const visible = employees.filter(
      emp => loggedUserRole !== 'GUEST' || (loggedUserKanbanLink && loggedUserKanbanLink.split(',').includes(emp.id))
    );
    return sortEmployeesByCustomOrder(visible, employeeOrder);
  }, [employees, loggedUserRole, loggedUserKanbanLink, employeeOrder]);

  const handleMoveEmployee = (empId: string, direction: 'top' | 'up' | 'down') => {
    const currentIds = sortedEmployees.map(e => e.id);
    const currentIndex = currentIds.indexOf(empId);
    if (currentIndex === -1) return;

    const newIds = [...currentIds];
    if (direction === 'top') {
      if (currentIndex === 0) return;
      const [item] = newIds.splice(currentIndex, 1);
      newIds.unshift(item);
    } else if (direction === 'up') {
      if (currentIndex === 0) return;
      const temp = newIds[currentIndex];
      newIds[currentIndex] = newIds[currentIndex - 1];
      newIds[currentIndex - 1] = temp;
    } else if (direction === 'down') {
      if (currentIndex === newIds.length - 1) return;
      const temp = newIds[currentIndex];
      newIds[currentIndex] = newIds[currentIndex + 1];
      newIds[currentIndex + 1] = temp;
    }

    setEmployeeOrder(newIds);
    saveStoredEmployeeOrder(newIds);
  };

  const stuckCount = useMemo(() => getStuckCards(kanbanCards, 24).length, [kanbanCards]);

  const logoSrc = dashboardLogo || defaultLogo;

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <aside
      className={`fixed left-0 top-0 h-full z-40 flex flex-col border-r border-white/[0.03] transition-all duration-300 ease-out shadow-[10px_0_30px_rgba(0,0,0,0.5)] print:hidden ${
        collapsed ? 'w-[68px]' : 'w-[220px]'
      }`}
      style={{
        background: 'linear-gradient(180deg, #080808 0%, #000000 100%)',
      }}
    >
      {/* Logo area */}
      <div className={`flex items-center h-16 border-b border-white/[0.03] px-5 ${collapsed ? 'justify-center' : 'gap-3'}`}>
        <img src={logoSrc} alt="Mac Mídia" className="h-6 w-6 object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]" />
        {!collapsed && (
          <div className="animate-fade-in shrink-0">
            <h1 className="text-[13px] font-black text-white/90 tracking-[0.2em] uppercase italic">Mac Mídia</h1>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6 px-3 space-y-1.5 overflow-y-auto custom-scrollbar">
        {navItems.map(({ path, icon: Icon, label, isBeta }) => {
          const allowedForGuest = ['/', '/calendario', '/postagem', '/whatsapp', '/instagram'];
          if (loggedUserKanbanLink && loggedUserKanbanLink !== 'none') {
            allowedForGuest.push('/equipe');
          }

          if (loggedUserRole === 'GUEST' && !allowedForGuest.includes(path)) {
            return null;
          }

          const isMobile = window.innerWidth <= 768;

          // Ocultar MacOferta no celular
          if (path === '/gerador-artes' && isMobile) {
            return null;
          }

          if (path === '/equipe') {
            return (
              <div key={path} className="space-y-1">
                <button
                  onClick={onTeamToggle}
                  className={`relative w-full flex items-center justify-between gap-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-200 group
                    ${collapsed ? 'px-0 py-2.5 justify-center' : 'px-4 py-3'}
                    ${location.pathname.startsWith('/funcionario') ? 'bg-primary text-white shadow-[0_0_20px_hsl(var(--primary)/0.3)]' : 'text-white/70 hover:text-white hover:bg-white/5'}`}
                  title={collapsed ? label : undefined}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${location.pathname.startsWith('/funcionario') ? 'text-white' : 'text-white/70 group-hover:text-white'}`} />
                    {!collapsed && <span className="animate-fade-in">{label}</span>}
                  </div>
                  {!collapsed && (
                    <ChevronRight className={`w-3 h-3 transition-transform duration-200 ${teamOpen ? 'rotate-90' : ''}`} />
                  )}
                </button>
                {teamOpen && !collapsed && (
                  <div className="pl-4 pr-1.5 space-y-1 py-1.5 animate-in slide-in-from-top-2 fade-in duration-200">
                    {/* Header com contagem e alternador de modo ordenar */}
                    <div className="flex items-center justify-between px-2 pb-1 text-[8px] font-black tracking-widest uppercase text-white/30 border-b border-white/[0.04] mb-1">
                      <span>Membros ({sortedEmployees.length})</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsReordering(prev => !prev);
                        }}
                        className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded transition-all flex items-center gap-1 ${
                          isReordering
                            ? 'bg-primary text-white shadow-sm'
                            : 'text-white/40 hover:text-white hover:bg-white/10'
                        }`}
                        title="Ativar/desativar modo de organização da equipe"
                      >
                        <ArrowUpDown className="w-2.5 h-2.5" />
                        <span>{isReordering ? 'Concluir' : 'Ordenar'}</span>
                      </button>
                    </div>

                    {sortedEmployees.map((emp, index) => {
                      const isSelected = location.pathname === `/funcionario/${emp.id}`;
                      return (
                        <div
                          key={emp.id}
                          className={`group/emp flex items-center justify-between rounded-lg px-2 py-1.5 transition-all duration-200 ${
                            isSelected
                              ? 'text-primary bg-primary/10 border border-primary/25 shadow-sm'
                              : 'text-white/60 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          {/* Botão de navegação com Fotinha / Avatar + Nome */}
                          <button
                            type="button"
                            onClick={() => navigate(`/funcionario/${emp.id}`)}
                            className="flex items-center gap-2 flex-1 min-w-0 text-left"
                            title={`Abrir Kanban de ${emp.name}`}
                          >
                            {emp.photoUrl ? (
                              <img
                                src={emp.photoUrl}
                                alt={emp.name}
                                className="w-5 h-5 rounded-full object-cover flex-shrink-0 ring-1 ring-white/15"
                              />
                            ) : (
                              <span className="w-5 h-5 rounded-full bg-white/10 text-[9px] font-black text-white/80 flex items-center justify-center flex-shrink-0">
                                {emp.avatar || emp.name.charAt(0).toUpperCase()}
                              </span>
                            )}
                            <span className="truncate text-[9.5px] font-extrabold uppercase tracking-wider">
                              {emp.name}
                            </span>
                          </button>

                          {/* Controles de reordenação: Mover ao Topo / Subir / Descer */}
                          <div className={`items-center gap-0.5 flex-shrink-0 ${isReordering ? 'flex' : 'hidden group-hover/emp:flex'}`}>
                            {index > 0 && (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMoveEmployee(emp.id, 'top');
                                  }}
                                  className="p-1 rounded hover:bg-white/15 text-white/40 hover:text-primary transition-colors"
                                  title="Mover para o topo da lista"
                                >
                                  <ChevronsUp className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMoveEmployee(emp.id, 'up');
                                  }}
                                  className="p-1 rounded hover:bg-white/15 text-white/40 hover:text-white transition-colors"
                                  title="Subir uma posição"
                                >
                                  <ChevronUp className="w-3 h-3" />
                                </button>
                              </>
                            )}
                            {index < sortedEmployees.length - 1 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveEmployee(emp.id, 'down');
                                }}
                                className="p-1 rounded hover:bg-white/15 text-white/40 hover:text-white transition-colors"
                                title="Descer uma posição"
                              >
                                <ChevronDown className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`relative w-full flex items-center gap-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-200 group
                ${collapsed ? 'justify-center px-0 py-2.5' : 'px-4 py-3'}
                ${isActive(path)
                  ? 'bg-primary text-white shadow-[0_0_20px_hsl(var(--primary)/0.3)]'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
              title={collapsed ? label : undefined}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${isActive(path) ? 'text-white' : 'text-white/70 group-hover:text-white'}`} />
              {!collapsed && (
                <div className="flex items-center justify-between flex-1 animate-fade-in truncate">
                  <span className="truncate">{label}</span>
                  {isBeta && (
                    <span className="ml-auto text-[7px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">
                      Beta
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
        
        {loggedUserRole === 'ADMIN' && (
          <>
            <div className={`mt-8 mb-2 text-[8px] font-black tracking-[0.2em] text-white/10 uppercase ${collapsed ? 'text-center' : 'px-5'}`}>
              {collapsed ? 'ADM' : 'Administração'}
            </div>

            <button
              onClick={() => navigate('/produtividade')}
              className={`relative w-full flex items-center gap-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-200 group mb-1
                ${collapsed ? 'justify-center px-0 py-2.5' : 'px-4 py-3'}
                ${isActive('/produtividade')
                  ? 'bg-primary text-white shadow-[0_0_20px_hsl(var(--primary)/0.3)]'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
              title={collapsed ? 'Produtividade' : undefined}
            >
              <BarChart3 className={`w-4 h-4 flex-shrink-0 transition-colors ${isActive('/produtividade') ? 'text-white' : 'text-white/70 group-hover:text-white'}`} />
              {!collapsed && (
                <div className="flex items-center justify-between flex-1 animate-fade-in truncate">
                  <span className="truncate">Produtividade</span>
                  {stuckCount > 0 && (
                    <span className="ml-auto text-[8px] font-black uppercase bg-red-600 text-white px-1.5 py-0.5 rounded-full shadow-md animate-pulse">
                      {stuckCount} ⚠️
                    </span>
                  )}
                </div>
              )}
            </button>

            <button
              onClick={() => navigate('/usuarios')}
              className={`relative w-full flex items-center gap-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-200 group
                ${collapsed ? 'justify-center px-0 py-2.5' : 'px-4 py-3'}
                ${isActive('/usuarios')
                  ? 'bg-primary text-white shadow-[0_0_20px_hsl(var(--primary)/0.3)]'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
              title={collapsed ? 'Acessos' : undefined}
            >
              <Shield className={`w-4 h-4 flex-shrink-0 transition-colors ${isActive('/usuarios') ? 'text-white' : 'text-white/70 group-hover:text-white'}`} />
              {!collapsed && <span className="animate-fade-in truncate">Membros / Acessos</span>}
            </button>
          </>
        )}
      </nav>

      {/* Collapse button */}
      <div className="p-3 border-t border-white/[0.03] space-y-1">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-colors"
          title={collapsed ? 'Expandir' : 'Recolher'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        <button
          onClick={logout}
          className={`w-full flex items-center gap-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-red-500/70 hover:text-red-500 hover:bg-red-500/10 transition-colors ${
            collapsed ? 'justify-center px-0 py-2.5' : 'px-4 py-2.5'
          }`}
          title={collapsed ? 'Sair' : undefined}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
};

export default AppSidebar;
