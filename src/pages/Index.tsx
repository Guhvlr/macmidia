import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useNavigate } from 'react-router-dom';
import { Calendar, LogOut, Shield, Users, Plus, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

const Index = () => {
  const { employees, logout, addEmployee } = useApp();
  const navigate = useNavigate();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newPhoto, setNewPhoto] = useState<string | undefined>();

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setNewPhoto(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    addEmployee({ name: newName.trim(), role: newRole.trim() || 'Membro', avatar: '👤', photoUrl: newPhoto });
    setNewName(''); setNewRole(''); setNewPhoto(undefined);
    setShowAdd(false);
  };

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <header className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Agency Hub</h1>
          <p className="text-muted-foreground text-sm mt-1">Painel de gestão</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => { logout(); navigate('/login'); }}>
          <LogOut className="w-5 h-5" />
        </Button>
      </header>

      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Equipe</h2>
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4 mr-1" /> Adicionar
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {employees.map(emp => (
            <button
              key={emp.id}
              onClick={() => navigate(`/funcionario/${emp.id}`)}
              className="glass-card p-6 text-left hover:glow-primary transition-all duration-300 group cursor-pointer"
            >
              {emp.photoUrl ? (
                <img src={emp.photoUrl} alt={emp.name} className="w-12 h-12 rounded-full object-cover mb-3 group-hover:scale-110 transition-transform" />
              ) : (
                <span className="text-4xl block mb-3 group-hover:scale-110 transition-transform">{emp.avatar}</span>
              )}
              <h3 className="font-semibold text-card-foreground">{emp.name}</h3>
              <p className="text-sm text-muted-foreground">{emp.role}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => navigate('/calendario')}
          className="glass-card p-6 text-left hover:glow-primary transition-all duration-300 group cursor-pointer"
        >
          <Calendar className="w-8 h-8 text-primary mb-3 group-hover:scale-110 transition-transform" />
          <h3 className="font-semibold text-card-foreground">Calendário</h3>
          <p className="text-sm text-muted-foreground">Planejamento de conteúdo</p>
        </button>
        <button
          onClick={() => navigate('/cofre')}
          className="glass-card p-6 text-left hover:glow-primary transition-all duration-300 group cursor-pointer"
        >
          <Shield className="w-8 h-8 text-primary mb-3 group-hover:scale-110 transition-transform" />
          <h3 className="font-semibold text-card-foreground">Cofre de Acessos</h3>
          <p className="text-sm text-muted-foreground">Credenciais seguras</p>
        </button>
      </section>

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
    </div>
  );
};

export default Index;
