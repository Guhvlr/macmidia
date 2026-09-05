import React, { useState, useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import { MobileHeader } from './MobileHeader';
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

      {/* Desktop Sidebar (oculta em telas muito pequenas se necessário) */}
      <div className="hidden md:block">
        <AppSidebar 
          collapsed={collapsed} 
          onToggle={() => setCollapsed(!collapsed)} 
          teamOpen={teamOpen}
          onTeamToggle={() => setTeamOpen(!teamOpen)}
        />
      </div>
      
      {/* Main Content Area */}
      <main
        className={`flex-1 transition-all duration-300 print:ml-0 flex flex-col h-screen overflow-y-auto ml-0 ${
          collapsed ? 'md:ml-[68px]' : 'md:ml-[220px]'
        }`}
      >
        {/* Barra e Seletor Mobile (Apenas no Celular) */}
        <MobileHeader />

        {/* Main Content Page Container */}
        <div className="flex-1 animate-fade-in flex flex-col min-h-0">
          {children}
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
