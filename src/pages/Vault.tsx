import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { ArrowLeft, Plus, Eye, EyeOff, Trash2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
    <div className="min-h-screen bg-background p-6">
      <header className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold gradient-text">Cofre de Acessos</h1>
        <div className="ml-auto flex gap-2">
          <Select value={filterEmployee} onValueChange={setFilterEmployee}>
            <SelectTrigger className="w-40 bg-secondary border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => setShowAdd(true)} className="bg-primary text-primary-foreground">
            <Plus className="w-4 h-4 mr-1" /> Adicionar
          </Button>
        </div>
      </header>

      {filtered.length === 0 && <p className="text-muted-foreground text-center mt-10">Nenhuma credencial cadastrada.</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl">
        {filtered.map(cred => (
          <div key={cred.id} className="glass-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">{cred.label}</h3>
              <Button variant="ghost" size="icon" onClick={() => deleteCredential(cred.id)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
            {cred.url && <p className="text-xs text-muted-foreground truncate">{cred.url}</p>}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-16">Usuário:</span>
                <span className="text-sm flex-1 truncate">{cred.username}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(cred.username)}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-16">Senha:</span>
                <span className="text-sm flex-1 font-mono">
                  {visibleIds.has(cred.id) ? cred.password : '••••••••'}
                </span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleVisibility(cred.id)}>
                  {visibleIds.has(cred.id) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(cred.password)}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Nova Credencial</DialogTitle></DialogHeader>
          <form onSubmit={handleAdd} className="space-y-3">
            <Input placeholder="Rótulo (ex: Instagram Cliente X)" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} className="bg-secondary border-border" />
            <Input placeholder="Usuário / E-mail" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} className="bg-secondary border-border" />
            <Input type="password" placeholder="Senha" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="bg-secondary border-border" />
            <Input placeholder="URL (opcional)" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} className="bg-secondary border-border" />
            <Select value={form.employeeId} onValueChange={v => setForm(f => ({ ...f, employeeId: v }))}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Funcionário" /></SelectTrigger>
              <SelectContent>
                {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button type="submit" className="w-full bg-primary text-primary-foreground">Salvar</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Vault;
