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

  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const minSwipeDistance = 70;

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    
    // Lista de elementos que devem ignorar o swipe (campos editáveis, cards, áreas de scroll horizontal, etc.)
    const ignoreSelectors = [
      'input', 'textarea', 'button', 'a', 
      '[contenteditable="true"]', 
      '.kanban-card', 
      '.custom-scrollbar', 
      '.trello-scrollbar',
      '[role="dialog"]',
      '.no-swipe'
    ];

    if (ignoreSelectors.some(selector => target.closest(selector))) {
      return;
    }

    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    // Apenas processa se o movimento for predominantemente horizontal
    // (Não queremos disparar o swipe se o usuário estiver rolando verticalmente)
    // Isso é uma simplificação, mas funciona bem na maioria dos casos.

    if (isLeftSwipe && !collapsed) {
      setCollapsed(true);
      toast.info('Painel recolhido', { duration: 1000, position: 'bottom-center' });
    } else if (isRightSwipe && collapsed) {
      setCollapsed(false);
      toast.info('Painel expandido', { duration: 1000, position: 'bottom-center' });
    }
  };

  return (
    <div className="flex min-h-screen bg-[#020202] overflow-hidden">
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
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
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
