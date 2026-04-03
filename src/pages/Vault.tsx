import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/useApp';
import { ArrowLeft, Plus, Eye, EyeOff, Trash2, Copy, Shield, Globe, User, Loader2, Camera, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import defaultBanner from '@/assets/banner-mac-midia.png';
import defaultLogo from '@/assets/logo-mac-midia.png';

const Vault = () => {
  const navigate = useNavigate();
  const { employees, credentials, addCredential, deleteCredential, loading, dashboardBanner, dashboardLogo, setDashboardBanner, setDashboardLogo } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());
  const [filterEmployee, setFilterEmployee] = useState<string>('all');
  const [form, setForm] = useState({ label: '', username: '', password: '', url: '', employeeId: '' });
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const bannerSrc = dashboardBanner || defaultBanner;
  const logoSrc = dashboardLogo || defaultLogo;

  const handleFileUpload = (setter: (url: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setter(reader.result as string);
    reader.readAsDataURL(file);
  };

  const toggleVisibility = (id: string) => {
    setVisibleIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado!');
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.label.trim() || !form.password.trim()) return;
    addCredential({ ...form, url: form.url || undefined });
    setForm({ label: '', username: '', password: '', url: '', employeeId: '' });
    setShowAdd(false);
  };

  const filtered = filterEmployee === 'all' ? credentials : credentials.filter(c => c.employeeId === filterEmployee);

  if (loading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg">
      {/* Banner */}
      <div className="relative w-full h-40 md:h-56 overflow-hidden group">
        <img src={bannerSrc} alt="Banner" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute bottom-5 left-6 md:left-8 flex items-end gap-4">
          <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-card/60 border border-border/40 backdrop-blur-md flex items-center justify-center shadow-2xl overflow-hidden">
            <img src={logoSrc} alt="Logo" className="w-[80%] h-[80%] object-contain" />
          </div>
          <div className="pb-1">
            <h1 className="text-xl md:text-2xl font-extrabold text-foreground drop-shadow-2xl tracking-tight">Cofre de Acessos</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">Gestão segura de credenciais de clientes</p>
          </div>
        </div>
        <button onClick={() => bannerInputRef.current?.click()} className="absolute top-3 right-3 p-2 rounded-xl glass-card text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all">
          <ImageIcon className="w-4 h-4" />
        </button>
        <input ref={bannerInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleFileUpload(setDashboardBanner)} />
      </div>

      <header className="page-header border-none bg-transparent backdrop-blur-none">
        <div className="flex items-center gap-4 px-6 md:px-8 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="hover:bg-secondary rounded-xl">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          
          <div className="ml-auto flex gap-3">
            <Select value={filterEmployee} onValueChange={setFilterEmployee}>
              <SelectTrigger className="w-40 bg-card/40 border-border/40 h-10 rounded-xl text-xs backdrop-blur-md">
                <SelectValue placeholder="Filtrar por..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Acessos</SelectItem>
                {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={() => setShowAdd(true)} className="btn-primary-glow rounded-xl text-xs h-10 px-6">
              <Plus className="w-4 h-4 mr-2" /> Adicionar Credencial
            </Button>
          </div>
        </div>
      </header>

      <div className="p-6 md:p-8 max-w-7xl mx-auto -mt-4">
        {filtered.length === 0 && (
          <div className="glass-card p-20 text-center max-w-xl mx-auto animate-fade-in mt-10">
            <div className="w-16 h-16 rounded-2xl bg-primary/8 flex items-center justify-center mx-auto mb-6">
              <Shield className="w-8 h-8 text-primary shadow-glow-primary" />
            </div>
            <h3 className="text-lg font-bold mb-2">Segurança em Primeiro Lugar</h3>
            <p className="text-muted-foreground font-medium mb-1">Nenhuma credencial cadastrada para este filtro.</p>
            <p className="text-sm text-muted-foreground">Clique no botão "Adicionar" para centralizar os acessos do cliente de forma segura.</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((cred, i) => (
            <div
              key={cred.id}
              className="glass-card-hover p-6 space-y-4 animate-slide-up"
              style={{ animationDelay: `${i * 0.04}s` }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center">
                    <Globe className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm tracking-tight">{cred.label}</h3>
                    {cred.url && <p className="text-[10px] text-muted-foreground truncate max-w-[140px]">{cred.url.replace('https://', '')}</p>}
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-destructive/10 hover:text-destructive rounded-xl transition-colors" onClick={() => deleteCredential(cred.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-3 bg-secondary/30 rounded-2xl p-4 border border-border/20 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-card/60 flex items-center justify-center border border-border/10">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Usuário</p>
                    <p className="text-sm truncate font-semibold">{cred.username}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary rounded-xl" onClick={() => copyToClipboard(cred.username)}>
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-card/60 flex items-center justify-center border border-border/10">
                    <Shield className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Senha</p>
                    <p className="text-sm font-mono tracking-wider font-semibold">
                      {visibleIds.has(cred.id) ? cred.password : '••••••••'}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary rounded-xl" onClick={() => toggleVisibility(cred.id)}>
                      {visibleIds.has(cred.id) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary rounded-xl" onClick={() => copyToClipboard(cred.password)}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="glass-card border-border/50 max-w-md">
          <DialogHeader>
            <div className="w-12 h-12 rounded-xl bg-primary/8 flex items-center justify-center mb-2">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <DialogTitle className="text-xl font-bold">Nova Credencial</DialogTitle>
            <DialogDescription>Proteja as informações de acesso dos seus clientes.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4 pt-2">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase ml-1">Rótulo</label>
                <Input placeholder="ex: Instagram @cliente" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} className="bg-secondary/40 border-border/50 h-12 rounded-xl focus:ring-primary/20" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase ml-1">Usuário</label>
                  <Input placeholder="Usuário / E-mail" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} className="bg-secondary/40 border-border/50 h-11 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase ml-1">Senha</label>
                  <Input type="password" placeholder="••••••••" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="bg-secondary/40 border-border/50 h-11 rounded-xl" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase ml-1">URL (opcional)</label>
                <Input placeholder="https://example.com" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} className="bg-secondary/40 border-border/50 h-11 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase ml-1">Vincular a Equipe</label>
                <Select value={form.employeeId} onValueChange={v => setForm(f => ({ ...f, employeeId: v }))}>
                  <SelectTrigger className="bg-secondary/40 border-border/50 h-11 rounded-xl"><SelectValue placeholder="Selecione um funcionário" /></SelectTrigger>
                  <SelectContent>
                    {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" className="w-full h-12 btn-primary-glow font-bold rounded-xl mt-4">
              Salvar Credencial de Forma Segura
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Vault;

