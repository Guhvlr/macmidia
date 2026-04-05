import { useLocation, Link, useParams } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { useApp } from '@/contexts/useApp';
import { useMemo } from 'react';

const Breadcrumbs = () => {
  const location = useLocation();
  const { id } = useParams();
  const { employees } = useApp();
  
  const breadcrumbs = useMemo(() => {
    const pathnames = location.pathname.split('/').filter((x) => x);
    
    return pathnames.map((value, index) => {
      const last = index === pathnames.length - 1;
      const to = `/${pathnames.slice(0, index + 1).join('/')}`;
      
      let label = value.charAt(0) ? value.charAt(0).toUpperCase() + value.slice(1) : value;
      
      // Specialist labels
      if (value === id && id) {
        const emp = employees.find(e => e.id === id);
        label = emp ? emp.name : value;
      }
      
      if (value === 'funcionario' && !id) label = 'Equipe';
      
      if (value === 'correcao') label = 'Correções';
      if (value === 'postagem') label = 'Postagens';
      if (value === 'calendario') label = 'Calendário';
      if (value === 'cofre') label = 'Banco de Dados';
      if (value === 'whatsapp') label = 'WhatsApp';
      if (value === 'usuarios') label = 'Membros';
      if (value === 'produtos') label = 'Produtos';
      if (value === 'relatorio') label = 'Relatório';
      if (value === 'arquivados') label = 'Arquivo';
      
      // Skip the word 'funcionario' if it's just a segment before the ID
      if (value === 'funcionario' && pathnames[index + 1]) return null;

      return { to, label, last };
    }).filter(Boolean);
  }, [location.pathname, id, employees]);

  if (location.pathname === '/') return null;

  return (
    <nav className="flex items-center space-x-2 text-[10px] font-black uppercase tracking-[0.25em] text-white/20 mb-6 animate-fade-in px-2">
      <Link to="/" className="hover:text-primary transition-colors flex items-center gap-2 group">
        <Home className="w-3.5 h-3.5 text-primary/40 group-hover:text-primary transition-colors" />
        <span className="hidden sm:inline">Início</span>
      </Link>
      
      {breadcrumbs.map((breadcrumb: any, i: number) => (
        <div key={breadcrumb.to} className="flex items-center space-x-2">
          <ChevronRight className="w-3 h-3 text-white/5" />
          {breadcrumb.last ? (
            <span className="text-white/60 font-black truncate max-w-[120px] sm:max-w-none italic">
              {breadcrumb.label}
            </span>
          ) : (
            <Link to={breadcrumb.to} className="hover:text-white transition-colors truncate max-w-[120px] sm:max-w-none">
              {breadcrumb.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
};

export default Breadcrumbs;
