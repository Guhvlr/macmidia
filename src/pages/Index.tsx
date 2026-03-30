import { useState, useRef } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useNavigate } from 'react-router-dom';
import { Calendar, LogOut, Shield, Users, Plus, Camera, ImageIcon, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Banner */}
      <div className="relative w-full h-48 md:h-64 overflow-hidden group">
        <img src={bannerSrc} alt="Banner" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute bottom-4 left-6 md:left-10 flex items-end gap-3">
          <div className="relative group/logo cursor-pointer" onClick={() => logoInputRef.current?.click()}>
            <img src={logoSrc} alt="Logo" className="h-14 md:h-20 w-auto object-contain drop-shadow-lg" />
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-lg opacity-0 group-hover/logo:opacity-100 transition-opacity">
              <Camera className="w-4 h-4 text-foreground" />
            </div>
            <input ref={logoInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleFileUpload(setDashboardLogo)} />
          </div>
          <div className="pb-1">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground drop-shadow-lg">Mac Mídia</h1>
            <p className="text-xs text-muted-foreground">Painel de gestão</p>
          </div>
        </div>
        <button onClick={() => bannerInputRef.current?.click()} className="absolute top-3 right-3 p-2 rounded-lg bg-card/80 backdrop-blur text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
          <ImageIcon className="w-4 h-4" />
        </button>
        <input ref={bannerInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleFileUpload(setDashboardBanner)} />
      </div>

      <div className="p-6 md:p-10">
        <div className="flex items-center justify-end mb-6">
          <Button variant="ghost" size="icon" onClick={() => { logout(); navigate('/login'); }}>
            <LogOut className="w-5 h-5" />
          </Button>
        </div>

        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Equipe</h2>
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => setShowAdd(true)}>
              <Plus className="w-4 h-4 mr-1" /> Adicionar
            </Button>
          </div>
          {employees.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <p className="text-muted-foreground">Nenhum funcionário cadastrado.</p>
              <p className="text-muted-foreground text-sm mt-1">Clique em "Adicionar" para começar.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {employees.map(emp => (
                <div key={emp.id} className="glass-card p-6 text-left hover:glow-primary transition-all duration-300 group relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(emp.id); }}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-card/80 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all z-10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <div onClick={() => navigate(`/funcionario/${emp.id}`)} className="cursor-pointer">
                    {emp.photoUrl ? (
                      <img src={emp.photoUrl} alt={emp.name} className="w-12 h-12 rounded-full object-cover mb-3 group-hover:scale-110 transition-transform" />
                    ) : (
                      <span className="text-4xl block mb-3 group-hover:scale-110 transition-transform">{emp.avatar}</span>
                    )}
                    <h3 className="font-semibold text-card-foreground">{emp.name}</h3>
                    <p className="text-sm text-muted-foreground">{emp.role}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button onClick={() => navigate('/calendario')} className="glass-card p-6 text-left hover:glow-primary transition-all duration-300 group cursor-pointer">
            <Calendar className="w-8 h-8 text-primary mb-3 group-hover:scale-110 transition-transform" />
            <h3 className="font-semibold text-card-foreground">Calendário</h3>
            <p className="text-sm text-muted-foreground">Planejamento de conteúdo</p>
          </button>
          <button onClick={() => navigate('/cofre')} className="glass-card p-6 text-left hover:glow-primary transition-all duration-300 group cursor-pointer">
            <Shield className="w-8 h-8 text-primary mb-3 group-hover:scale-110 transition-transform" />
            <h3 className="font-semibold text-card-foreground">Cofre de Acessos</h3>
            <p className="text-sm text-muted-foreground">Credenciais seguras</p>
          </button>
        </section>
      </div>

      {/* Add employee dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Novo Funcionário</DialogTitle></DialogHeader>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="flex justify-center">
              <label className="w-20 h-20 rounded-full bg-secondary border-2 border-dashed border-border flex items-center justify-center cursor-pointer overflow-hidden hover:border-primary transition-colors">
                {newPhoto ? (
                  <img src={newPhoto} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-6 h-6 text-muted-foreground" />
                )}
                <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handlePhoto} />
              </label>
            </div>
            <Input placeholder="Nome" value={newName} onChange={e => setNewName(e.target.value)} className="bg-secondary border-border" />
            <Input placeholder="Cargo" value={newRole} onChange={e => setNewRole(e.target.value)} className="bg-secondary border-border" />
            <Button type="submit" className="w-full">Adicionar</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir funcionário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <span className="font-semibold text-foreground">{deleteTargetEmployee?.name}</span>? Todos os cards, tarefas e credenciais associados serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
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
