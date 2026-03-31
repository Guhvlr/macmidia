import { useState } from 'react';
import { useApp } from '@/contexts/useApp';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, User, ArrowRight, UserPlus, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import defaultLogo from '@/assets/logo-mac-midia.png';

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login, register, dashboardLogo } = useApp();
  const navigate = useNavigate();

  const logoSrc = dashboardLogo || defaultLogo;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    let res: { success: boolean; error?: string };
    if (isLogin) {
      res = await login(email, password);
    } else {
      res = await register(name, email, password);
    }
    
    setLoading(false);

    if (res.success) {
      if (!isLogin) {
        // If registered, show success or just switch to login (Supabase signs in automatically on signup if email confirmation is disabled, but if it requires confirmation, it won't. Wait, we usually redirect or stay. We will just navigate to `/`)
      }
      navigate('/');
    } else {
      setError(res.error || 'Erro ao processar a solicitação.');
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

          <div className="flex bg-secondary/50 p-1 rounded-xl mb-6">
            <button type="button" onClick={() => { setIsLogin(true); setError(null); }} className={`flex-1 text-sm font-semibold rounded-lg py-2 transition-all ${isLogin ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Login</button>
            <button type="button" onClick={() => { setIsLogin(false); setError(null); }} className={`flex-1 text-sm font-semibold rounded-lg py-2 transition-all ${!isLogin ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Cadastro</button>
          </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="relative group animate-fade-in">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <Input
                type="text"
                placeholder="Seu nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
                className="pl-11 h-12 bg-secondary/40 border-border/50 focus:border-primary/50 text-base rounded-xl placeholder:text-muted-foreground/60 transition-all"
              />
            </div>
          )}
          <div className="relative group animate-fade-in" style={{ animationDelay: '50ms' }}>
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              className="pl-11 h-12 bg-secondary/40 border-border/50 focus:border-primary/50 text-base rounded-xl placeholder:text-muted-foreground/60 transition-all"
            />
          </div>
          <div className="relative group animate-fade-in" style={{ animationDelay: '100ms' }}>
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <Input
              type="password"
              placeholder="Senha de acesso"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isLogin ? "current-password" : "new-password"}
              required
              minLength={6}
              className="pl-11 h-12 bg-secondary/40 border-border/50 focus:border-primary/50 text-base rounded-xl placeholder:text-muted-foreground/60 transition-all"
            />
          </div>
          {error && (
            <p className="text-destructive text-sm text-center animate-fade-in font-medium mt-1">
              {error === 'Invalid login credentials' ? 'Email ou senha incorretos' : error}
            </p>
          )}
          <Button type="submit" disabled={loading} className="w-full h-12 text-base font-semibold btn-primary-glow rounded-xl group mt-2">
            {isLogin ? 'Entrar' : 'Criar Conta'}
            {isLogin ? <LogIn className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" /> : <UserPlus className="w-4 h-4 ml-2 transition-transform group-hover:scale-110" />}
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
