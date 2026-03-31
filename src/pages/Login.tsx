import { useState } from 'react';
import { useApp } from '@/contexts/useApp';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import defaultLogo from '@/assets/logo-mac-midia.png';

const Login = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const { login, dashboardLogo } = useApp();
  const navigate = useNavigate();

  const logoSrc = dashboardLogo || defaultLogo;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(password)) {
      navigate('/');
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center gradient-bg p-4">
      {/* Ambient glow */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="glass-card glow-primary p-10 w-full max-w-md space-y-8 animate-scale-in relative z-10">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-24 h-24 mb-2">
            <img src={logoSrc} alt="Mac Mídia" className="max-w-full max-h-full object-contain drop-shadow-2xl" />
          </div>
          <h1 className="text-3xl font-bold gradient-text">Mac Mídia</h1>
          <p className="text-muted-foreground text-sm">Gestão completa para sua agência</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="password"
              placeholder="Senha de acesso"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="off"
              data-lpignore="true"
              className="pl-10 h-12 bg-secondary/50 border-border/60 focus:border-primary text-base"
            />
          </div>
          {error && <p className="text-destructive text-sm text-center animate-fade-in">Senha incorreta</p>}
          <Button type="submit" className="w-full h-12 text-base font-semibold btn-primary-glow">
            Entrar
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Login;
