import React, { useState, useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import { useApp } from '@/contexts/useApp';

interface Props {
  children: React.ReactNode;
  title?: string;
}

const MainLayout = ({ children, title }: Props) => {
  const location = useLocation();
  const { id } = useParams();
  const { employees } = useApp();
  const [collapsed, setCollapsed] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);

  // Dynamic Title Logic
  useEffect(() => {
    const pathnames = location.pathname.split('/').filter(x => x);
    let pageLabel = 'Painel';

    if (pathnames.length === 0) pageLabel = 'Dashboard';
    else {
      const segment = pathnames[0];
      if (segment === 'funcionario' && id) {
        const emp = employees.find(e => e.id === id);
        pageLabel = emp ? emp.name : 'Funcionário';
      } else if (segment === 'correcao') pageLabel = 'Correções';
      else if (segment === 'postagem') pageLabel = 'Postagens';
      else if (segment === 'calendario') pageLabel = 'Calendário';
      else if (segment === 'cofre') pageLabel = 'Banco de Dados';
      else if (segment === 'whatsapp') pageLabel = 'WhatsApp';
      else if (segment === 'usuarios') pageLabel = 'Membros';
      else if (segment === 'produtos') pageLabel = 'Produtos';
      else if (segment === 'arquivados') pageLabel = 'Arquivo';
      else pageLabel = segment.charAt(0).toUpperCase() + segment.slice(1);
    }

    document.title = `Mac Mídia | ${title || pageLabel}`;
  }, [location.pathname, title, id, employees]);

  return (
    <div className="flex min-h-screen bg-[#020202]">
      {/* Sidebar fixed overlay for consistency */}
      <div className="fixed inset-0 bg-[#020202] -z-10" />

      <AppSidebar 
        collapsed={collapsed} 
        onToggle={() => setCollapsed(!collapsed)} 
        teamOpen={teamOpen}
        onTeamToggle={() => setTeamOpen(!teamOpen)}
      />
      
      {/* Main Content Area with dynamic margin based on sidebar state */}
      <main
        className={`flex-1 transition-all duration-300 print:ml-0 flex flex-col h-screen overflow-y-auto ${
          collapsed ? 'ml-[68px]' : 'ml-[220px]'
        }`}
      >
        {/* Main Content Page Container */}
        <div className="flex-1 animate-fade-in flex flex-col min-h-0">
          {children}
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
