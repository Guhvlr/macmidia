import { useState } from 'react';
import { useApp } from '@/contexts/useApp';
import { useNavigate } from 'react-router-dom';
import { Shield, Trash2, ArrowLeft, Loader2, UserCheck, UserMinus, Search, Users, User, Eye, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const UsersAdmin = () => {
  const { systemUsers, loggedUserRole, loggedUserId, adminUpdateUserRole, adminDeleteUser, loading, calendarClients, employees } = useApp();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [targetUser, setTargetUser] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'DELETE' | 'PROMOTE' | 'DEMOTE' | 'PROMOTE_GUEST' | null>(null);
  const [clientLink, setClientLink] = useState('');
  const [kanbanBoard, setKanbanBoard] = useState('');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0c]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (loggedUserRole !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex flex-col items-center justify-center gap-4 text-center px-4">
        <Shield className="w-16 h-16 text-destructive/50 mx-auto" />
        <h1 className="text-2xl font-bold">Acesso Negado</h1>
        <p className="text-muted-foreground text-sm max-w-sm">
          Apenas administradores do sistema têm permissão para visualizar e gerenciar membros do painel.
        </p>
        <Button onClick={() => navigate('/')} className="mt-4 rounded-xl">Voltar ao Início</Button>
      </div>
    );
  }

  const handleAction = async () => {
    if (!targetUser || !actionType) return;
    
    let res;
    if (actionType === 'DELETE') {
      res = await adminDeleteUser(targetUser);
    } else if (actionType === 'PROMOTE') {
      res = await adminUpdateUserRole(targetUser, 'ADMIN');
    } else if (actionType === 'DEMOTE') {
      res = await adminUpdateUserRole(targetUser, 'USER');
    } else if (actionType === 'PROMOTE_GUEST') {
      if (!clientLink.trim()) {
        toast.error('Informe o nome do cliente para este visitante');
        return;
      }
      const linkedBoard = (kanbanBoard === 'none' || !kanbanBoard) ? undefined : kanbanBoard;
      res = await adminUpdateUserRole(targetUser, 'GUEST', clientLink, linkedBoard);
    }

    if (res?.success) {
      toast.success(actionType === 'DELETE' ? 'Usuário removido com sucesso' : 'Papel do usuário atualizado');
    } else {
      toast.error(res?.error || 'Erro ao processar a ação');
    }
    
    setTargetUser(null);
    setActionType(null);
  };

  const filteredUsers = systemUsers.filter(u => 
    u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0a0a0c]">
      <header className="page-header border-b border-white/5 bg-[#121214]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="hover:bg-white/5 rounded-xl">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" /> 
                Acessos da Equipe
              </h1>
              <p className="text-xs text-white/50 mt-1">
                {systemUsers.length} membro(s) cadastrado(s)
              </p>
            </div>
          </div>
          
          <div className="relative w-full md:max-w-[300px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <Input
              placeholder="Buscar por nome ou email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1C1C1E] border-white/10 rounded-xl pl-10 h-11 text-sm focus-visible:ring-primary/50 text-white placeholder:text-white/30"
            />
          </div>
        </div>
      </header>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.map(user => (
            <div key={user.id} className="bg-[#1C1C1E] border border-white/5 hover:border-white/10 p-5 rounded-2xl flex flex-col transition-all group overflow-hidden relative">
              
              {/* If it's the current user, add a badge */}
              {user.id === loggedUserId && (
                <div className="absolute top-0 right-0 py-1 px-3 text-[10px] bg-primary/20 text-primary font-bold rounded-bl-xl border-b border-l border-primary/20">
                  VOCÊ
                </div>
              )}

              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-600 to-rose-700 font-bold text-white text-lg flex items-center justify-center flex-shrink-0 shadow-inner">
                  {user.fullName.substring(0, 2).toUpperCase()}
                </div>
                <div className="overflow-hidden flex-1 pr-6">
                  <h3 className="font-bold text-sm text-white truncate" title={user.fullName}>{user.fullName}</h3>
                  <p className="text-xs text-white/50 truncate" title={user.email}>{user.email}</p>
                </div>
              </div>
              
              <div className="mt-4 flex flex-col gap-3">
                <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
                  <button 
                    onClick={() => { setTargetUser(user.id); setActionType('PROMOTE'); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${user.role === 'ADMIN' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    Admin
                  </button>
                  <button 
                    onClick={() => { setTargetUser(user.id); setActionType('DEMOTE'); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${user.role === 'USER' ? 'bg-white/10 text-white border border-white/10' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    Membro
                  </button>
                  <button 
                    onClick={() => { setTargetUser(user.id); setActionType('PROMOTE_GUEST'); setClientLink(user.clientLink || ''); setKanbanBoard(user.kanbanLink || ''); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${user.role === 'GUEST' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Visitante
                  </button>
                </div>

                {user.role === 'GUEST' && (
                  <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-orange-500/60 uppercase">Vínculo de Clientes</span>
                        <span className="text-xs font-bold text-orange-500 truncate max-w-[150px]" title={
                          Array.from(new Set((user.clientLink || '').split(',').filter(Boolean)))
                            .map(id => calendarClients.find(c => c.id === id)?.name || id)
                            .join(', ')
                        }>
                          {user.clientLink ? 
                            Array.from(new Set(user.clientLink.split(',').filter(Boolean)))
                              .map(id => calendarClients.find(c => c.id === id)?.name || id)
                              .join(', ') : 
                            'NÃO DEFINIDO'
                          }
                        </span>
                      </div>
                      {user.kanbanLink && (
                        <div className="flex flex-col border-t border-orange-500/10 pt-1">
                          <span className="text-[9px] font-black text-white/40 uppercase">Quadro Vinculado</span>
                          <span className="text-[11px] font-bold text-white/70">
                            {employees.find(e => e.id === user.kanbanLink)?.name || 'Desconhecido'}
                          </span>
                        </div>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-orange-500 hover:bg-orange-500/10 flex-shrink-0"
                      onClick={() => { setTargetUser(user.id); setActionType('PROMOTE_GUEST'); setClientLink(user.clientLink || ''); setKanbanBoard(user.kanbanLink || ''); }}>
                      <Search className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
              
              <div className="mt-4 flex items-center justify-between pt-4 border-t border-white/5">
                <div className="text-[10px] text-white/30 font-medium">
                  {user.id === loggedUserId ? 'Seu próprio acesso' : `Cadastrado em: ${new Date(user.createdAt).toLocaleDateString()}`}
                </div>
                
                {user.id !== loggedUserId && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 rounded-lg text-white/20 hover:text-destructive group-hover:text-white/40 transition-colors"
                    onClick={() => { setTargetUser(user.id); setActionType('DELETE'); }} title="Remover usuário permanentemente">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <AlertDialog open={!!targetUser && !!actionType} onOpenChange={(open) => !open && setTargetUser(null)}>
        <AlertDialogContent className="bg-[#1C1C1E] border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === 'DELETE' ? 'Remover Usuário' : 
               actionType === 'PROMOTE' ? 'Promover a Administrador' : 
               actionType === 'PROMOTE_GUEST' ? 'Vincular como Cliente/Visitante' :
               'Remover Privilégios'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              {actionType === 'DELETE' && 'Esta ação expulsará o usuário do sistema. Ele não conseguirá mais fazer login.'}
              {actionType === 'PROMOTE' && 'O usuário passará a ter controle total sobre membros e configurações do sistema.'}
              {actionType === 'DEMOTE' && 'O usuário perderá o acesso de administração e se tornará um membro comum.'}
              {actionType === 'PROMOTE_GUEST' && 'O usuário terá acesso limitado APENAS ao calendário e cards do cliente especificado.'}
            </AlertDialogDescription>
            {actionType === 'PROMOTE_GUEST' && (
              <div className="mt-4 space-y-3">
                <label className="text-xs font-bold text-white/40 uppercase tracking-widest block">Vinculo de Clientes</label>
                <div className="bg-[#121214] border border-white/10 rounded-xl max-h-48 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                  {calendarClients.map(client => {
                    const isSelected = clientLink.split(',').includes(client.id);
                    return (
                      <div key={client.id} className="flex items-center gap-3 group/item">
                        <button
                          type="button"
                          onClick={() => {
                            const current = clientLink ? Array.from(new Set(clientLink.split(',').filter(Boolean))) : [];
                            let next;
                            if (current.includes(client.id)) {
                              next = current.filter(id => id !== client.id);
                            } else {
                              next = [...current, client.id];
                            }
                            setClientLink(next.join(','));
                          }}
                          className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${
                            clientLink.split(',').includes(client.id) ? 'bg-primary border-primary' : 'border-white/20 group-hover/item:border-primary/50'
                          }`}
                        >
                          {clientLink.split(',').includes(client.id) && <Check className="w-3.5 h-3.5 text-white" />}
                        </button>
                        <span className={`text-xs font-medium transition-colors ${isSelected ? 'text-white' : 'text-white/40 group-hover/item:text-white/70'}`}>
                          {client.name}
                        </span>
                      </div>
                    );
                  })}
                  {calendarClients.length === 0 && (
                    <div className="text-center py-4">
                      <p className="text-[10px] text-white/20 uppercase tracking-widest italic font-bold">Nenhum cliente cadastrado no calendário</p>
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-white/30 italic">O visitante verá calendários e métricas apenas dos clientes selecionados.</p>
              </div>
            )}

            {actionType === 'PROMOTE_GUEST' && (
              <div className="mt-4 space-y-2 pb-4">
                <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Acesso ao Quadro Kanban</label>
                <Select value={kanbanBoard} onValueChange={setKanbanBoard}>
                  <SelectTrigger className="w-full bg-[#121214] border-white/10 rounded-xl h-12 text-white">
                    <SelectValue placeholder="Selecione um quadro da equipe..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1C1C1E] border-white/10 text-white max-h-[300px]">
                    <SelectItem value="none">Nenhum (Somente Calendário)</SelectItem>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        Quadro de {emp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-white/30 italic">Determina qual aba de "Equipe" ficará visível para ele.</p>
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 text-white border-transparent hover:bg-white/10">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleAction} 
              className={actionType === 'DELETE' ? 'bg-destructive/90 text-white hover:bg-destructive focus:ring-destructive' : 'bg-primary text-white hover:bg-primary/90'}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UsersAdmin;
