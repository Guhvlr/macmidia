import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/useApp';
import { ArrowLeft, Plus, Trash2, Calendar, ArrowRight, Upload, X, MoreVertical, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

const CalendarPage = () => {
  const navigate = useNavigate();
  const { calendarClients, addCalendarClient, deleteCalendarClient, updateCalendarClient, loggedUserRole } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [editingClient, setEditingClient] = useState<{id: string, name: string, logoUrl?: string} | null>(null);
  const [clientName, setClientName] = useState('');
  const [logoUrl, setLogoUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
       toast.error('Por favor, selecione uma imagem.');
       return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) return;
    
    if (editingClient) {
      updateCalendarClient(editingClient.id, { name: clientName.trim(), logoUrl: logoUrl || undefined });
      toast.success('Cliente atualizado com sucesso!');
    } else {
      addCalendarClient(clientName.trim(), logoUrl || undefined);
      toast.success('Calendário criado com sucesso!');
    }
    
    resetForm();
  };

  const resetForm = () => {
    setClientName('');
    setLogoUrl('');
    setEditingClient(null);
    setShowAdd(false);
  };

  const openEdit = (client: any) => {
    setEditingClient(client);
    setClientName(client.name);
    setLogoUrl(client.logoUrl || '');
    setShowAdd(true);
  };

  return (
    <div className="min-h-screen gradient-bg">
      <header className="page-header">
        <div className="flex items-center gap-4 px-6 py-3.5">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="hover:bg-secondary rounded-xl">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/8">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold gradient-text">Calendários</h1>
              <p className="text-[11px] text-muted-foreground">Planejamento de conteúdo por cliente</p>
            </div>
          </div>
          {loggedUserRole !== 'GUEST' && (
            <Button size="sm" className="ml-auto btn-primary-glow rounded-xl text-xs" onClick={() => setShowAdd(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Novo Cliente
            </Button>
          )}
        </div>
      </header>

      <div className="p-6 md:p-8 max-w-6xl mx-auto">
        {calendarClients.length === 0 && (
          <div className="glass-card p-16 text-center max-w-lg mx-auto animate-fade-in border-dashed border-white/10">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
              <Calendar className="w-10 h-10 text-white/20" />
            </div>
            <p className="text-white/80 font-bold text-xl">Inicie sua produção</p>
            <p className="text-white/40 text-sm mt-2 max-w-[240px] mx-auto">Cada cliente possui seu próprio calendário organizado de posts.</p>
            <Button className="mt-8 rounded-xl btn-primary-glow" onClick={() => setShowAdd(true)}>Criar meu primeiro calendário</Button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {calendarClients.map((client, i) => (
            <div
              key={client.id}
              className="glass-card p-0 group flex flex-col transition-all duration-300 hover:border-primary/30 relative overflow-hidden h-[240px] shadow-xl animate-scale-in"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              {/* Client Menu - Only for non-guests */}
              {loggedUserRole !== 'GUEST' && (
                <div className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-black/40 backdrop-blur-md border border-white/10 hover:bg-black/60 text-white shadow-lg">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-[#1C1C1E] border-white/10 text-white rounded-xl p-1 shadow-2xl min-w-[140px]">
                      <DropdownMenuItem onClick={() => openEdit(client)} className="gap-2.5 cursor-pointer rounded-lg focus:bg-white/5 py-2 text-xs">
                        <Edit2 className="w-3.5 h-3.5" /> Editar Cliente
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => deleteCalendarClient(client.id)} className="gap-2.5 cursor-pointer rounded-lg focus:bg-red-500/20 text-red-400 focus:text-red-400 py-2 text-xs">
                        <Trash2 className="w-3.5 h-3.5" /> Excluir permanentemente
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}

              {/* Main Content Area */}
              <button
                onClick={() => navigate(`/calendario/${client.id}`)}
                className="flex-1 flex flex-col items-center justify-center p-6 text-center group/btn relative"
              >
                {/* Logo or Initial circle */}
                <div className="relative mb-4">
                  <div className={`w-20 h-20 rounded-full border-2 border-white/10 shadow-2xl flex items-center justify-center overflow-hidden transition-transform duration-500 group-hover/btn:scale-110 group-hover/btn:border-primary/50
                    ${!client.logoUrl ? 'bg-gradient-to-br from-red-600 to-rose-700' : 'bg-black/40'}
                  `}>
                    {client.logoUrl ? (
                      <img src={client.logoUrl} className="w-full h-full object-cover" alt={client.name} />
                    ) : (
                      <span className="text-2xl font-bold text-white uppercase">{client.name.substring(0, 2)}</span>
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary rounded-full border-2 border-[#0a0a0c] flex items-center justify-center shadow-lg opacity-0 group-hover/btn:opacity-100 transition-opacity">
                    <ArrowRight className="w-3 h-3 text-white" />
                  </div>
                </div>

                <h3 className="font-bold text-white text-lg tracking-tight group-hover/btn:text-primary transition-colors truncate w-full px-4">{client.name}</h3>
                <p className="text-xs text-white/40 mt-1 uppercase tracking-widest font-semibold flex items-center gap-2">
                  <Calendar className="w-3 h-3" /> PLANEJAMENTO
                </p>
              </button>
              
              {/* Indicator bar */}
              <div className="h-1 w-full bg-white/5 relative">
                <div className="absolute top-0 left-0 h-full w-0 bg-primary group-hover:w-full transition-all duration-700 ease-out" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={showAdd} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="bg-[#1C1C1E] border-white/10 text-white p-0 rounded-2xl overflow-hidden max-w-md shadow-2xl">
          <DialogHeader className="p-6 pb-0 border-none">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              {editingClient ? 'Editar Cliente' : 'Novo Cliente'}
            </DialogTitle>
            <DialogDescription className="text-white/50 text-sm">Organize as postagens deste parceiro.</DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleAdd} className="p-6 space-y-6">
            {/* Logo Upload Box */}
            <div className="flex flex-col items-center justify-center gap-4">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-24 h-24 rounded-full border-2 border-dashed border-white/20 hover:border-primary/50 bg-white/5 flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all group relative"
              >
                {logoUrl ? (
                  <>
                    <img src={logoUrl} className="w-full h-full object-cover" alt="Preview logo" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Upload className="w-6 h-6 text-white" />
                    </div>
                  </>
                ) : (
                  <>
                    <Upload className="w-6 h-6 text-white/30 group-hover:text-primary" />
                    <span className="text-[10px] uppercase font-bold text-white/30 mt-1 tracking-widest group-hover:text-primary">Logo</span>
                  </>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              
              {logoUrl && (
                <Button size="sm" variant="ghost" onClick={() => setLogoUrl('')} className="h-6 text-[10px] text-white/40 hover:text-red-400 flex items-center gap-1 uppercase tracking-tighter">
                  <X className="w-3 h-3" /> Remover logo
                </Button>
              )}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-white opacity-40 ml-1 tracking-widest">Nome da Marca</label>
                <Input placeholder="Ex: Macmidia Store" value={clientName} onChange={e => setClientName(e.target.value)} className="bg-white/5 border-white/10 h-12 rounded-xl focus-visible:ring-primary text-white font-medium" />
              </div>
            </div>

            <Button type="submit" className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl shadow-[0_10px_20px_-10px_rgba(239,68,68,0.4)] transition-all">
              {editingClient ? 'Salvar Alterações' : 'Criar Calendário do Cliente'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarPage;

