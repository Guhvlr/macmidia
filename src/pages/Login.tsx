import { useState } from 'react';
import { useApp } from '@/contexts/useApp';
import { useNavigate } from 'react-router-dom';
import { Lock, ArrowRight } from 'lucide-react';
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
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse 80% 50% at 50% -10%, hsl(0 60% 12% / 0.4) 0%, transparent 60%), hsl(0 0% 3.5%)',
      }}
    >
      {/* Ambient glow orbs */}
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-primary/4 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-[400px] h-[400px] bg-primary/3 rounded-full blur-[120px] pointer-events-none" />

      <div className="glass-card glow-primary p-12 w-full max-w-[420px] space-y-8 animate-scale-in relative z-10">
        {/* Logo & Title */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-card/60 border border-border/40 shadow-xl mb-1">
            <img src={logoSrc} alt="Mac Mídia" className="max-w-[56px] max-h-[56px] object-contain drop-shadow-2xl" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold gradient-text tracking-tight">Mac Mídia</h1>
            <p className="text-muted-foreground text-sm mt-1">Acesse o painel de gestão</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="relative group">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <Input
              type="password"
              placeholder="Senha de acesso"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="off"
              data-lpignore="true"
              className="pl-11 h-12 bg-secondary/40 border-border/50 focus:border-primary/50 text-base rounded-xl placeholder:text-muted-foreground/60 transition-all"
            />
          </div>
          {error && (
            <p className="text-destructive text-sm text-center animate-fade-in font-medium">
              Senha incorreta
            </p>
          )}
          <Button type="submit" className="w-full h-12 text-base font-semibold btn-primary-glow rounded-xl group">
            Entrar
            <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
          </Button>
        </form>

        {/* Footer */}
        <p className="text-center text-[11px] text-muted-foreground/40">
          © {new Date().getFullYear()} Mac Mídia · Todos os direitos reservados
        </p>
      </div>
    </div>
  );
};

export default Login;
