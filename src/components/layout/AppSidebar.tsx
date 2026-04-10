import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '@/contexts/useApp';
import { 
  LayoutDashboard, 
  Users, 
  FileEdit, 
  LayoutGrid, 
  Calendar, 
  Folder, 
  MessageSquare, 
  Home,
  Shield, 
  LogOut, 
  ChevronLeft, 
  ChevronRight, 
  LucideIcon,
  Zap
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
  { path: '/whatsapp', icon: MessageSquare, label: 'WhatsApp' },
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
  const { logout, dashboardLogo, loggedUserRole, loggedUserKanbanLink, employees } = useApp();

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
          const allowedForGuest = ['/', '/calendario'];
          if (loggedUserKanbanLink && loggedUserKanbanLink !== 'none') {
            allowedForGuest.push('/equipe');
          }

          if (loggedUserRole === 'GUEST' && !allowedForGuest.includes(path)) {
            return null;
          }

          if (path === '/equipe') {
            return (
              <div key={path} className="space-y-1">
                <button
                  onClick={onTeamToggle}
                  className={`relative w-full flex items-center justify-between gap-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-200 group
                    ${collapsed ? 'px-0 py-2.5 justify-center' : 'px-4 py-3'}
                    ${location.pathname.startsWith('/funcionario') ? 'bg-primary text-white shadow-[0_0_20px_hsl(var(--primary)/0.3)]' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
                  title={collapsed ? label : undefined}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${location.pathname.startsWith('/funcionario') ? 'text-white' : 'text-white/40 group-hover:text-white'}`} />
                    {!collapsed && <span className="animate-fade-in">{label}</span>}
                  </div>
                  {!collapsed && (
                    <ChevronRight className={`w-3 h-3 transition-transform duration-200 ${teamOpen ? 'rotate-90' : ''}`} />
                  )}
                </button>
                {teamOpen && !collapsed && (
                  <div className="pl-11 pr-2 space-y-1 py-1 animate-in slide-in-from-top-2 fade-in duration-200">
                    {employees
                      .filter(emp => loggedUserRole !== 'GUEST' || emp.id === loggedUserKanbanLink)
                      .map(emp => (
                        <button
                          key={emp.id}
                          onClick={() => navigate(`/funcionario/${emp.id}`)}
                          className={`w-full text-left truncate rounded-lg py-2 px-3 text-[9px] font-bold uppercase tracking-widest transition-colors hover:bg-white/5 hover:text-white
                            ${location.pathname === `/funcionario/${emp.id}` ? 'text-primary bg-primary/10' : 'text-white/20'}`}
                        >
                          {emp.name}
                        </button>
                      ))}
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
                  : 'text-white/40 hover:text-white hover:bg-white/5'
                }`}
              title={collapsed ? label : undefined}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${isActive(path) ? 'text-white' : 'text-white/40 group-hover:text-white'}`} />
              {!collapsed && (
                <div className="flex items-center w-full animate-fade-in pr-2">
                  <span>{label}</span>
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
              onClick={() => navigate('/usuarios')}
              className={`relative w-full flex items-center gap-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-200 group
                ${collapsed ? 'justify-center px-0 py-2.5' : 'px-4 py-3'}
                ${isActive('/usuarios')
                  ? 'bg-primary text-white shadow-[0_0_20px_hsl(var(--primary)/0.3)]'
                  : 'text-white/40 hover:text-white hover:bg-white/5'
                }`}
              title={collapsed ? 'Acessos' : undefined}
            >
              <Shield className={`w-4 h-4 flex-shrink-0 transition-colors ${isActive('/usuarios') ? 'text-white' : 'text-white/40 group-hover:text-white'}`} />
              {!collapsed && <span className="animate-fade-in truncate">Membros / Acessos</span>}
            </button>
          </>
        )}
      </nav>

      {/* Bottom controls */}
      <div className="px-3 pb-6 pt-4 border-t border-white/[0.03] space-y-1" style={{ marginTop: 'auto' }}>
        <button
          onClick={onToggle}
          className={`w-full flex items-center gap-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/20 hover:text-white hover:bg-white/5 transition-all duration-200
            ${collapsed ? 'justify-center px-0 py-2.5' : 'px-4 py-2.5'}`}
          title={collapsed ? 'Expandir' : 'Recolher'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {!collapsed && <span className="animate-fade-in">Recolher</span>}
        </button>

        <button
          onClick={() => { logout(); navigate('/login'); }}
          className={`w-full flex items-center gap-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/20 hover:text-primary hover:bg-primary/10 transition-all duration-200
            ${collapsed ? 'justify-center px-0 py-2.5' : 'px-4 py-2.5'}`}
          title={collapsed ? 'Sair' : undefined}
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && <span className="animate-fade-in">Sair</span>}
        </button>
      </div>
    </aside>
  );
};

export default AppSidebar;
