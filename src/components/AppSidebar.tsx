import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '@/contexts/useApp';
import { LayoutDashboard, Calendar, Shield, Send, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import defaultLogo from '@/assets/logo-mac-midia.png';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/postagem', icon: Send, label: 'Postagens' },
  { path: '/calendario', icon: Calendar, label: 'Calendário' },
  { path: '/cofre', icon: Shield, label: 'Cofre' },
];

interface Props {
  children: React.ReactNode;
}

const AppSidebar = ({ children }: Props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, dashboardLogo, loggedUserRole } = useApp();
  const [collapsed, setCollapsed] = useState(false);

  const logoSrc = dashboardLogo || defaultLogo;

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full z-30 flex flex-col border-r border-border/40 transition-all duration-300 ease-out ${
          collapsed ? 'w-[72px]' : 'w-[240px]'
        }`}
        style={{
          background: 'linear-gradient(180deg, hsl(0 0% 5%) 0%, hsl(0 0% 4%) 100%)',
        }}
      >
        {/* Logo area */}
        <div className={`flex items-center h-16 border-b border-border/30 px-4 ${collapsed ? 'justify-center' : 'gap-3'}`}>
          <img src={logoSrc} alt="Mac Mídia" className="h-9 w-9 object-contain flex-shrink-0" />
          {!collapsed && (
            <div className="animate-fade-in">
              <h1 className="text-sm font-bold text-foreground tracking-tight">Mac Mídia</h1>
              <p className="text-[10px] text-muted-foreground leading-none">Painel de gestão</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map(({ path, icon: Icon, label }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`relative w-full flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200 group
                ${collapsed ? 'justify-center px-0 py-2.5' : 'px-3.5 py-2.5'}
                ${isActive(path)
                  ? 'bg-primary/12 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                }`}
              title={collapsed ? label : undefined}
            >
              {isActive(path) && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] bg-primary rounded-r-full" />
              )}
              <Icon className={`w-[18px] h-[18px] flex-shrink-0 transition-colors ${isActive(path) ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
              {!collapsed && <span className="animate-fade-in">{label}</span>}
            </button>
          ))}
          {loggedUserRole === 'ADMIN' && (
            <>
              <div className={`mt-6 mb-2 text-[10px] font-bold tracking-wider text-muted-foreground/50 uppercase ${collapsed ? 'text-center' : 'px-4'}`}>
                {collapsed ? 'ADM' : 'Administração'}
              </div>
              <button
                onClick={() => navigate('/usuarios')}
                className={`relative w-full flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200 group
                  ${collapsed ? 'justify-center px-0 py-2.5' : 'px-3.5 py-2.5'}
                  ${isActive('/usuarios')
                    ? 'bg-primary/12 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                  }`}
                title={collapsed ? 'Acessos do Sistema' : undefined}
              >
                {isActive('/usuarios') && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] bg-primary rounded-r-full" />
                )}
                <Shield className={`w-[18px] h-[18px] flex-shrink-0 transition-colors ${isActive('/usuarios') ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
                {!collapsed && <span className="animate-fade-in">Membros / Acessos</span>}
              </button>
            </>
          )}
        </nav>

        {/* Bottom controls */}
        <div className="px-3 pb-4 space-y-1">
          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(c => !c)}
            className={`w-full flex items-center gap-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all duration-200
              ${collapsed ? 'justify-center px-0 py-2.5' : 'px-3.5 py-2.5'}`}
            title={collapsed ? 'Expandir' : 'Recolher'}
          >
            {collapsed ? <ChevronRight className="w-[18px] h-[18px]" /> : <ChevronLeft className="w-[18px] h-[18px]" />}
            {!collapsed && <span className="animate-fade-in">Recolher</span>}
          </button>

          {/* Logout */}
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className={`w-full flex items-center gap-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-all duration-200
              ${collapsed ? 'justify-center px-0 py-2.5' : 'px-3.5 py-2.5'}`}
            title={collapsed ? 'Sair' : undefined}
          >
            <LogOut className="w-[18px] h-[18px]" />
            {!collapsed && <span className="animate-fade-in">Sair</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main
        className={`flex-1 transition-all duration-300 ${collapsed ? 'ml-[72px]' : 'ml-[240px]'}`}
      >
        {children}
      </main>
    </div>
  );
};

export default AppSidebar;
