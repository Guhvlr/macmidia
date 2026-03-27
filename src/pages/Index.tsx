import { useApp } from '@/contexts/AppContext';
import { useNavigate } from 'react-router-dom';
import { Calendar, LogOut, Shield, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Index = () => {
  const { employees, logout } = useApp();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <header className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Agency Hub</h1>
          <p className="text-muted-foreground text-sm mt-1">Painel de gestão</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => { logout(); navigate('/login'); }}>
          <LogOut className="w-5 h-5" />
        </Button>
      </header>

      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Equipe</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {employees.map(emp => (
            <button
              key={emp.id}
              onClick={() => navigate(`/funcionario/${emp.id}`)}
              className="glass-card p-6 text-left hover:glow-primary transition-all duration-300 group cursor-pointer"
            >
              <span className="text-4xl block mb-3 group-hover:scale-110 transition-transform">{emp.avatar}</span>
              <h3 className="font-semibold text-card-foreground">{emp.name}</h3>
              <p className="text-sm text-muted-foreground">{emp.role}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => navigate('/calendario')}
          className="glass-card p-6 text-left hover:glow-accent transition-all duration-300 group cursor-pointer"
        >
          <Calendar className="w-8 h-8 text-accent mb-3 group-hover:scale-110 transition-transform" />
          <h3 className="font-semibold text-card-foreground">Calendário</h3>
          <p className="text-sm text-muted-foreground">Planejamento de conteúdo</p>
        </button>
        <button
          onClick={() => navigate('/cofre')}
          className="glass-card p-6 text-left hover:glow-primary transition-all duration-300 group cursor-pointer"
        >
          <Shield className="w-8 h-8 text-primary mb-3 group-hover:scale-110 transition-transform" />
          <h3 className="font-semibold text-card-foreground">Cofre de Acessos</h3>
          <p className="text-sm text-muted-foreground">Credenciais seguras</p>
        </button>
      </section>
    </div>
  );
};

export default Index;
