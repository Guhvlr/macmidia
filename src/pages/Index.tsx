import { useState, useRef } from 'react';
import { useApp } from '@/contexts/useApp';
import { useNavigate } from 'react-router-dom';
import { Calendar, Users, Plus, Camera, ImageIcon, Trash2, Loader2, Send, Shield, ArrowRight, Wrench, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import defaultLogo from '@/assets/logo-mac-midia.png';
import defaultBanner from '@/assets/banner-mac-midia.png';

const Index = () => {
  const { employees, addEmployee, deleteEmployee, dashboardBanner, dashboardLogo, setDashboardBanner, setDashboardLogo, loading, loggedUserRole, loggedUserClientLink, loggedUserKanbanLink } = useApp();
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
      <div className="relative w-full h-48 md:h-64 overflow-hidden group">
        <img src={bannerSrc} alt="Banner" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute bottom-5 left-6 md:left-8 flex items-end gap-4">
          <div className="relative group/logo cursor-pointer" onClick={() => logoInputRef.current?.click()}>
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-card/60 border border-border/40 backdrop-blur-md flex items-center justify-center shadow-2xl overflow-hidden">
              <img src={logoSrc} alt="Logo" className="w-[80%] h-[80%] object-contain" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-2xl opacity-0 group-hover/logo:opacity-100 transition-opacity">
              <Camera className="w-5 h-5 text-foreground" />
            </div>
            <input ref={logoInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleFileUpload(setDashboardLogo)} />
          </div>
          <div className="pb-1">
            <h1 className="text-2xl md:text-3xl font-extrabold text-foreground drop-shadow-2xl tracking-tight">Mac Mídia</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Painel de gestão</p>
          </div>
        </div>
        <button onClick={() => bannerInputRef.current?.click()} className="absolute top-3 right-3 p-2 rounded-xl glass-card text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all">
          <ImageIcon className="w-4 h-4" />
        </button>
        <input ref={bannerInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleFileUpload(setDashboardBanner)} />
      </div>

      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        {/* Quick action cards */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-10 animate-slide-up">
          {[
            { icon: Send, label: 'Quadros de Postagem', desc: 'Centralizar e publicar conteúdos', path: '/postagem', color: 'from-rose-500/10 to-transparent', role: 'USER' },
            { icon: Wrench, label: 'Correções', desc: 'Visão geral de alterações', path: '/correcao', color: 'from-blue-500/10 to-transparent', role: 'USER' },
            { icon: Calendar, label: 'Calendário', desc: 'Planejamento de conteúdo mensal', path: '/calendario', color: 'from-amber-500/10 to-transparent', role: 'GUEST' },
            { icon: Shield, label: 'Banco de Dados', desc: 'Contatos e credenciais dos clientes', path: '/cofre', color: 'from-emerald-500/10 to-transparent', role: 'ADMIN' },
            { icon: MessageSquare, label: 'WhatsApp', desc: 'Caixa de entrada e triagem', path: '/whatsapp', color: 'from-green-500/10 to-transparent', role: 'USER' },
          ].filter(item => {
            if (loggedUserRole === 'ADMIN') return true;
            if (loggedUserRole === 'GUEST') return item.role === 'GUEST';
            return item.role !== 'ADMIN';
          }).map(({ icon: Icon, label, desc, path, color }) => (
            <button key={path} onClick={() => navigate(path)} className="glass-card-hover p-6 text-left group cursor-pointer relative overflow-hidden">
              <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
              <div className="relative z-10">
                <div className="p-3 rounded-2xl bg-primary/8 w-fit mb-4 group-hover:bg-primary/15 transition-colors">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-bold text-card-foreground text-base">{label}</h3>
                <p className="text-sm text-muted-foreground mt-1">{desc}</p>
                <div className="flex items-center gap-1 text-primary text-xs font-medium mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  Acessar <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            </button>
          ))}
          
          {loggedUserRole === 'GUEST' && !loggedUserClientLink && (
            <div className="lg:col-span-1 glass-card p-6 border-orange-500/10 flex flex-col items-center justify-center text-center gap-3">
              <div className="p-3 rounded-full bg-orange-500/10">
                <Loader2 className="w-6 h-6 text-orange-500 animate-pulse" />
              </div>
              <p className="text-sm font-bold text-white uppercase tracking-widest">Aguardando Aprovação</p>
              <p className="text-[10px] text-white/40">O seu nível de acesso ainda não foi configurado. Por favor, aguarde o admin vincular sua conta.</p>
            </div>
          )}
        </section>

        {/* Team section - Only internal staff */}
        {loggedUserRole !== 'GUEST' && (
          <section className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-xl bg-primary/8">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Equipe</h2>
                <p className="text-xs text-muted-foreground">{employees.length} membros</p>
              </div>
              {loggedUserRole === 'ADMIN' && (
                <Button size="sm" className="ml-auto btn-primary-glow rounded-xl" onClick={() => setShowAdd(true)}>
                  <Plus className="w-4 h-4 mr-1.5" /> Adicionar
                </Button>
              )}
            </div>
            {employees.length === 0 ? (
              <div className="glass-card p-16 text-center">
                <Users className="w-12 h-12 mx-auto text-muted-foreground/20 mb-4" />
                <p className="text-muted-foreground font-medium">Nenhum funcionário cadastrado.</p>
                {loggedUserRole === 'ADMIN' && <p className="text-muted-foreground text-sm mt-1">Clique em "Adicionar" para começar.</p>}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {employees.map((emp, i) => (
                  <div
                    key={emp.id}
                    className="glass-card-hover p-5 text-left group relative animate-slide-up"
                    style={{ animationDelay: `${i * 0.04}s` }}
                  >
                    {loggedUserRole === 'ADMIN' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(emp.id); }}
                        className="absolute top-3 right-3 p-1.5 rounded-lg bg-card/80 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all z-10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <div onClick={() => navigate(`/funcionario/${emp.id}`)} className="cursor-pointer">
                      {emp.photoUrl ? (
                        <img src={emp.photoUrl} alt={emp.name} className="w-12 h-12 rounded-xl object-cover mb-3 group-hover:scale-105 transition-transform shadow-lg ring-1 ring-border/30" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-secondary/60 flex items-center justify-center mb-3 text-2xl group-hover:scale-105 transition-transform">
                          {emp.avatar}
                        </div>
                      )}
                      <h3 className="font-bold text-sm text-card-foreground">{emp.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{emp.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Add employee dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="glass-card border-border/50">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Novo Funcionário</DialogTitle>
            <DialogDescription>Adicione um novo membro à equipe.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="flex justify-center">
              <label className="w-20 h-20 rounded-2xl bg-secondary/40 border-2 border-dashed border-border/50 flex items-center justify-center cursor-pointer overflow-hidden hover:border-primary/40 transition-colors">
                {newPhoto ? (
                  <img src={newPhoto} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-6 h-6 text-muted-foreground" />
                )}
                <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handlePhoto} />
              </label>
            </div>
            <Input placeholder="Nome" value={newName} onChange={e => setNewName(e.target.value)} className="bg-secondary/40 border-border/50 h-11 rounded-xl" />
            <Input placeholder="Cargo" value={newRole} onChange={e => setNewRole(e.target.value)} className="bg-secondary/40 border-border/50 h-11 rounded-xl" />
            <Button type="submit" className="w-full h-11 btn-primary-glow font-semibold rounded-xl">Adicionar</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="glass-card border-border/50">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir funcionário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <span className="font-semibold text-foreground">{deleteTargetEmployee?.name}</span>? Todos os cards, tarefas e credenciais associados serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary hover:bg-muted rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
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
