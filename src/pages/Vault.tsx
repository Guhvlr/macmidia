import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/useApp';
import { ArrowLeft, Plus, Eye, EyeOff, Trash2, Copy, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const Vault = () => {
  const navigate = useNavigate();
  const { employees, credentials, addCredential, deleteCredential } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());
  const [filterEmployee, setFilterEmployee] = useState<string>('all');
  const [form, setForm] = useState({ label: '', username: '', password: '', url: '', employeeId: '' });

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

  return (
    <div className="min-h-screen gradient-bg">
      <header className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-4 px-6 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="hover:bg-secondary">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-xl font-bold gradient-text">Cofre de Acessos</h1>
          </div>
          <div className="ml-auto flex gap-2">
            <Select value={filterEmployee} onValueChange={setFilterEmployee}>
              <SelectTrigger className="w-40 bg-secondary/50 border-border/60 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => setShowAdd(true)} className="btn-primary-glow">
              <Plus className="w-4 h-4 mr-1" /> Adicionar
            </Button>
          </div>
        </div>
      </header>

      <div className="p-6 md:p-10 max-w-6xl mx-auto">
        {filtered.length === 0 && (
          <div className="glass-card p-16 text-center max-w-lg mx-auto animate-fade-in">
            <Shield className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">Nenhuma credencial cadastrada.</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((cred, i) => (
            <div
              key={cred.id}
              className="glass-card-hover p-5 space-y-3 animate-slide-up"
              style={{ animationDelay: `${i * 0.04}s` }}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm">{cred.label}</h3>
                <Button variant="ghost" size="icon" className="hover:bg-destructive/10 hover:text-destructive" onClick={() => deleteCredential(cred.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              {cred.url && <p className="text-xs text-muted-foreground truncate">{cred.url}</p>}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-16 uppercase tracking-wider font-medium">Usuário</span>
                  <span className="text-sm flex-1 truncate font-medium">{cred.username}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-primary/10 hover:text-primary" onClick={() => copyToClipboard(cred.username)}>
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-16 uppercase tracking-wider font-medium">Senha</span>
                  <span className="text-sm flex-1 font-mono tracking-wider">
                    {visibleIds.has(cred.id) ? cred.password : '••••••••'}
                  </span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-primary/10 hover:text-primary" onClick={() => toggleVisibility(cred.id)}>
                    {visibleIds.has(cred.id) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-primary/10 hover:text-primary" onClick={() => copyToClipboard(cred.password)}>
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="glass-card border-border">
          <DialogHeader>
            <DialogTitle>Nova Credencial</DialogTitle>
            <DialogDescription>Adicione uma nova credencial ao cofre.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <Input placeholder="Rótulo (ex: Instagram Cliente X)" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} className="bg-secondary/50 border-border/60 h-11" />
            <Input placeholder="Usuário / E-mail" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} className="bg-secondary/50 border-border/60 h-11" />
            <Input type="password" placeholder="Senha" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="bg-secondary/50 border-border/60 h-11" />
            <Input placeholder="URL (opcional)" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} className="bg-secondary/50 border-border/60 h-11" />
            <Select value={form.employeeId} onValueChange={v => setForm(f => ({ ...f, employeeId: v }))}>
              <SelectTrigger className="bg-secondary/50 border-border/60 h-11"><SelectValue placeholder="Funcionário" /></SelectTrigger>
              <SelectContent>
                {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button type="submit" className="w-full h-11 btn-primary-glow font-semibold">Salvar</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Vault;
