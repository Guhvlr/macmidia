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
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="glass-card glow-primary p-8 w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-20 h-20 mb-4">
            <img src={logoSrc} alt="Mac Mídia" className="max-w-full max-h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold gradient-text">Mac Mídia</h1>
          <p className="text-muted-foreground text-sm">Gestão completa para sua agência</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="password"
              placeholder="Senha de acesso"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="off"
              data-lpignore="true"
              className="pl-10 bg-secondary border-border focus:border-primary"
            />
          </div>
          {error && <p className="text-destructive text-sm text-center">Senha incorreta</p>}
          <Button type="submit" className="w-full">
            Entrar
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Login;
