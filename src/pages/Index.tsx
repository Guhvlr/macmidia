import { useState, useRef } from 'react';
import { useApp } from '@/contexts/useApp';
import { useNavigate } from 'react-router-dom';
import { Calendar, LogOut, Shield, Users, Plus, Camera, ImageIcon, Trash2, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import defaultLogo from '@/assets/logo-mac-midia.png';
import defaultBanner from '@/assets/banner-mac-midia.png';

const Index = () => {
  const { employees, logout, addEmployee, deleteEmployee, dashboardBanner, dashboardLogo, setDashboardBanner, setDashboardLogo, loading } = useApp();
  const navigate = useNavigate();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newPhoto, setNewPhoto] = useState<string | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const bannerSrc = dashboardBanner || defaultBanner;
  const logoSrc = dashboardLogo || defaultLogo;

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setNewPhoto(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (setter: (url: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setter(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    addEmployee({ name: newName.trim(), role: newRole.trim() || 'Membro', avatar: '👤', photoUrl: newPhoto });
    setNewName(''); setNewRole(''); setNewPhoto(undefined);
    setShowAdd(false);
  };

  const deleteTargetEmployee = employees.find(e => e.id === deleteTarget);

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
      <div className="relative w-full h-52 md:h-72 overflow-hidden group">
        <img src={bannerSrc} alt="Banner" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        <div className="absolute bottom-6 left-6 md:left-10 flex items-end gap-4">
          <div className="relative group/logo cursor-pointer" onClick={() => logoInputRef.current?.click()}>
            <img src={logoSrc} alt="Logo" className="h-16 md:h-24 w-auto object-contain drop-shadow-2xl" />
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-xl opacity-0 group-hover/logo:opacity-100 transition-opacity">
              <Camera className="w-5 h-5 text-foreground" />
            </div>
            <input ref={logoInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleFileUpload(setDashboardLogo)} />
          </div>
          <div className="pb-1">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground drop-shadow-2xl">Mac Mídia</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Painel de gestão</p>
          </div>
        </div>
        <button onClick={() => bannerInputRef.current?.click()} className="absolute top-4 right-4 p-2.5 rounded-xl glass-card text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all">
          <ImageIcon className="w-4 h-4" />
        </button>
        <input ref={bannerInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleFileUpload(setDashboardBanner)} />
      </div>

      <div className="p-6 md:p-10 max-w-7xl mx-auto">
        <div className="flex items-center justify-end mb-8">
          <Button variant="ghost" size="icon" onClick={() => { logout(); navigate('/login'); }} className="hover:bg-destructive/10 hover:text-destructive">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>

        <section className="mb-10 animate-slide-up">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-primary/10">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold">Equipe</h2>
            <Button size="sm" className="ml-auto btn-primary-glow" onClick={() => setShowAdd(true)}>
              <Plus className="w-4 h-4 mr-1" /> Adicionar
            </Button>
          </div>
          {employees.length === 0 ? (
            <div className="glass-card p-16 text-center">
              <Users className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">Nenhum funcionário cadastrado.</p>
              <p className="text-muted-foreground text-sm mt-1">Clique em "Adicionar" para começar.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {employees.map((emp, i) => (
                <div
                  key={emp.id}
                  className="glass-card-hover p-6 text-left group relative animate-slide-up"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(emp.id); }}
                    className="absolute top-3 right-3 p-1.5 rounded-lg bg-card/80 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all z-10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <div onClick={() => navigate(`/funcionario/${emp.id}`)} className="cursor-pointer">
                    {emp.photoUrl ? (
                      <img src={emp.photoUrl} alt={emp.name} className="w-14 h-14 rounded-2xl object-cover mb-4 group-hover:scale-110 transition-transform shadow-lg" />
                    ) : (
                      <span className="text-4xl block mb-4 group-hover:scale-110 transition-transform">{emp.avatar}</span>
                    )}
                    <h3 className="font-bold text-card-foreground">{emp.name}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{emp.role}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-5 animate-slide-up" style={{ animationDelay: '0.15s' }}>
          {[
            { icon: Send, label: 'Quadros de Postagem', desc: 'Centralizar e postar conteúdos', path: '/postagem' },
            { icon: Calendar, label: 'Calendário', desc: 'Planejamento de conteúdo', path: '/calendario' },
            { icon: Shield, label: 'Cofre de Acessos', desc: 'Credenciais seguras', path: '/cofre' },
          ].map(({ icon: Icon, label, desc, path }) => (
            <button key={path} onClick={() => navigate(path)} className="glass-card-hover p-7 text-left group cursor-pointer">
              <div className="p-3 rounded-2xl bg-primary/10 w-fit mb-4 group-hover:bg-primary/20 transition-colors">
                <Icon className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-bold text-card-foreground text-lg">{label}</h3>
              <p className="text-sm text-muted-foreground mt-1">{desc}</p>
            </button>
          ))}
        </section>
      </div>

      {/* Add employee dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="glass-card border-border">
          <DialogHeader>
            <DialogTitle>Novo Funcionário</DialogTitle>
            <DialogDescription>Adicione um novo membro à equipe.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="flex justify-center">
              <label className="w-20 h-20 rounded-2xl bg-secondary/50 border-2 border-dashed border-border/60 flex items-center justify-center cursor-pointer overflow-hidden hover:border-primary/50 transition-colors">
                {newPhoto ? (
                  <img src={newPhoto} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-6 h-6 text-muted-foreground" />
                )}
                <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handlePhoto} />
              </label>
            </div>
            <Input placeholder="Nome" value={newName} onChange={e => setNewName(e.target.value)} className="bg-secondary/50 border-border/60 h-11" />
            <Input placeholder="Cargo" value={newRole} onChange={e => setNewRole(e.target.value)} className="bg-secondary/50 border-border/60 h-11" />
            <Button type="submit" className="w-full h-11 btn-primary-glow font-semibold">Adicionar</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="glass-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir funcionário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <span className="font-semibold text-foreground">{deleteTargetEmployee?.name}</span>? Todos os cards, tarefas e credenciais associados serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary hover:bg-muted">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteTarget) { deleteEmployee(deleteTarget); setDeleteTarget(null); } }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Index;
