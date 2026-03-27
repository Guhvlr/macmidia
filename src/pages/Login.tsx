import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useNavigate } from 'react-router-dom';
import { Lock, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const Login = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const { login } = useApp();
  const navigate = useNavigate();

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
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <Zap className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold gradient-text">Agency Hub</h1>
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
              className="pl-10 bg-secondary border-border focus:border-primary"
            />
          </div>
          {error && <p className="text-destructive text-sm text-center">Senha incorreta</p>}
          <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
            Entrar
          </Button>
        </form>
        <p className="text-xs text-muted-foreground text-center">Senha padrão: agencia2024</p>
      </div>
    </div>
  );
};

export default Login;
