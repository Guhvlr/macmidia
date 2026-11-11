import { useState, useRef, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/useApp';
import { ArrowLeft, Plus, Trash2, Calendar, ArrowRight, Upload, X, MoreVertical, Edit2, RefreshCw, Users, UserPlus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { useCalendarTeamLinks } from '../hooks/useCalendarTeamData';

const CalendarPage = () => {
  const navigate = useNavigate();
  const { calendarClients, employees, addCalendarClient, deleteCalendarClient, updateCalendarClient, loggedUserRole, loggedUserClientLink, fetchAll } = useApp();
  const { links, toggleClientEmployee, getClientEmployees, getEmployeeClients } = useCalendarTeamLinks();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editingClient, setEditingClient] = useState<{id: string, name: string, logoUrl?: string} | null>(null);
  const [clientName, setClientName] = useState('');
  const [logoUrl, setLogoUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchAll();
      toast.success('Sincronizando com Banco de Dados...', {
        icon: <RefreshCw className="w-4 h-4 animate-spin text-primary" />,
        className: "glass-card border-primary/20 text-white font-bold uppercase tracking-wider text-[10px]"
      });
    } catch (err) {
      toast.error('Erro ao atualizar dados');
    } finally {
      setIsRefreshing(false);
    }
  };

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

  // Logic once to handle GUEST redirection if they have only one client
  const [hasRedirected, setHasRedirected] = useState(false);
  
  const accessibleClients = useMemo(() => {
    let clients = calendarClients;
    if (loggedUserRole === 'GUEST') {
      if (!loggedUserClientLink) return [];
      const allowedIds = loggedUserClientLink.split(',');
      clients = calendarClients.filter(c => allowedIds.includes(c.id));
    }
    return [...clients].sort((a, b) => a.name.localeCompare(b.name));
  }, [calendarClients, loggedUserRole, loggedUserClientLink]);

  const filteredClients = useMemo(() => {
    if (selectedEmployeeId === 'ALL') return accessibleClients;
    return accessibleClients.filter(c => {
      const empIds = links[c.id] || [];
      return empIds.includes(selectedEmployeeId);
    });
  }, [accessibleClients, selectedEmployeeId, links]);

  const selectedEmployee = useMemo(
    () => employees.find(e => e.id === selectedEmployeeId),
    [employees, selectedEmployeeId]
  );

  useEffect(() => {
    if (loggedUserRole === 'GUEST' && accessibleClients.length === 1 && !hasRedirected) {
      setHasRedirected(true);
      navigate(`/calendario/${accessibleClients[0].id}`, { replace: true });
    }
  }, [loggedUserRole, accessibleClients, navigate, hasRedirected]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) return;
    
    if (editingClient) {
      try {
        await updateCalendarClient(editingClient.id, { name: clientName.trim(), logoUrl: logoUrl || undefined });
        toast.success('Cliente atualizado com sucesso!');
      } catch {
        toast.error('Erro ao atualizar cliente.');
        return;
      }
    } else {
      await addCalendarClient(clientName.trim(), logoUrl || undefined);
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
    <div className="min-h-screen gradient-bg w-full max-w-full overflow-x-hidden touch-pan-y">
      <header className="page-header w-full max-w-full overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 px-4 sm:px-6 py-3.5">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="hover:bg-secondary rounded-xl h-10 w-10 shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2.5 rounded-xl bg-primary/10 shrink-0">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold gradient-text truncate">Calendários</h1>
              <p className="text-[11px] text-muted-foreground truncate">Planejamento de conteúdo por cliente</p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2 shrink-0">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="rounded-xl text-xs bg-white/5 border-white/10 hover:bg-white/10 text-white/80 h-10 px-3"
            >
              <RefreshCw className={`w-4 h-4 sm:mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
            
            {loggedUserRole !== 'GUEST' && (
              <Button size="sm" className="btn-primary-glow rounded-xl text-xs h-10 px-3.5 font-bold" onClick={() => setShowAdd(true)}>
                <Plus className="w-4 h-4 mr-1" /> Novo Cliente
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full overflow-x-hidden">
        <div className="flex flex-col md:flex-row gap-5 md:gap-6 items-start w-full">
          {/* Barra Lateral Esquerda — Filtro por Equipe (Travado sem scroll lateral no celular) */}
          {loggedUserRole !== 'GUEST' && employees.length > 0 && (
            <aside className="w-full md:w-64 flex-shrink-0 glass-card p-4 border-white/10 overflow-hidden">
              <div className="flex items-center gap-2 mb-2 px-1">
                <Users className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-white/90">Equipe</span>
              </div>
              <p className="text-xs text-white/50 mb-3 px-1">
                Toque na pessoa para filtrar os clientes vinculados a ela.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:flex md:flex-col gap-2.5 w-full">
                {/* Botão TODOS */}
                <button
                  onClick={() => setSelectedEmployeeId('ALL')}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all w-full min-w-0 ${
                    selectedEmployeeId === 'ALL'
                      ? 'bg-primary/20 border border-primary/40 text-white shadow-lg'
                      : 'bg-white/5 border border-white/5 hover:bg-white/10 text-white/80'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs border shrink-0 ${
                    selectedEmployeeId === 'ALL'
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white/10 text-white/80 border-white/10'
                  }`}>
                    ALL
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate">Todos</p>
                    <p className="text-[11px] text-white/50 truncate">{accessibleClients.length} clientes</p>
                  </div>
                </button>

                {/* Bolinhas de cada funcionário da Equipe */}
                {employees.map(emp => {
                  const empClientCount = accessibleClients.filter(c => (links[c.id] || []).includes(emp.id)).length;
                  const isSelected = selectedEmployeeId === emp.id;
                  return (
                    <button
                      key={emp.id}
                      onClick={() => setSelectedEmployeeId(isSelected ? 'ALL' : emp.id)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all w-full min-w-0 ${
                        isSelected
                          ? 'bg-primary/20 border border-primary/40 text-white shadow-lg'
                          : 'bg-white/5 border border-white/5 hover:bg-white/10 text-white/80'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full overflow-hidden flex items-center justify-center font-bold text-sm border-2 flex-shrink-0 ${
                        isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-white/20 bg-white/10'
                      }`}>
                        {emp.photoUrl ? (
                          <img src={emp.photoUrl} alt={emp.name} className="w-full h-full object-cover" />
                        ) : (
                          <span>{emp.avatar || emp.name.substring(0, 2).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">{emp.name}</p>
                        <p className="text-[11px] text-white/50 truncate">
                          {empClientCount} {empClientCount === 1 ? 'cliente' : 'clientes'}
                        </p>
                      </div>
                      {empClientCount > 0 && (
                        <span className={`hidden sm:inline-block text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          isSelected ? 'bg-primary text-white' : 'bg-white/10 text-white/70'
                        }`}>
                          {empClientCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </aside>
          )}

          {/* Área Principal de Clientes */}
          <div className="flex-1 w-full min-w-0">
            {selectedEmployee && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 glass-card px-4 py-3 border-primary/30 bg-primary/5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full overflow-hidden border border-primary flex items-center justify-center bg-white/10 text-xs font-bold shrink-0">
                    {selectedEmployee.photoUrl ? (
                      <img src={selectedEmployee.photoUrl} alt={selectedEmployee.name} className="w-full h-full object-cover" />
                    ) : (
                      <span>{selectedEmployee.avatar || selectedEmployee.name.substring(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-white truncate">
                      Clientes de <span className="text-primary">{selectedEmployee.name}</span>
                    </p>
                    <p className="text-[11px] text-white/50">
                      Mostrando {filteredClients.length} de {accessibleClients.length} clientes
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/funcionario/${selectedEmployee.id}`)}
                    className="h-9 text-xs rounded-xl bg-white/5 border-white/10 hover:bg-white/10 text-white flex-1 sm:flex-initial"
                  >
                    Abrir Quadro de {selectedEmployee.name}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedEmployeeId('ALL')}
                    className="h-9 text-xs rounded-xl text-white/70 hover:text-white"
                  >
                    Ver todos
                  </Button>
                </div>
              </div>
            )}

            {filteredClients.length === 0 && (
              <div className="glass-card p-10 sm:p-16 text-center max-w-lg mx-auto animate-fade-in border-dashed border-white/10">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Calendar className="w-10 h-10 text-white/20" />
                </div>
                <p className="text-white/80 font-bold text-xl">
                  {selectedEmployee ? `Nenhum cliente vinculado a ${selectedEmployee.name}` : 'Inicie sua produção'}
                </p>
                <p className="text-white/40 text-sm mt-2 max-w-[280px] mx-auto">
                  {selectedEmployee
                    ? 'Vincule clientes a este membro da equipe tocando no botão Equipe em cada card de cliente.'
                    : 'Cada cliente possui seu próprio calendário organizado de posts.'}
                </p>
                {selectedEmployee ? (
                  <Button className="mt-6 rounded-xl h-10" variant="outline" onClick={() => setSelectedEmployeeId('ALL')}>
                    Mostrar todos os clientes para vincular
                  </Button>
                ) : (
                  <Button className="mt-8 rounded-xl btn-primary-glow h-10" onClick={() => setShowAdd(true)}>
                    Criar meu primeiro calendário
                  </Button>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
              {filteredClients.map((client, i) => {
                const linkedEmpIds = getClientEmployees(client.id);
                const linkedEmps = employees.filter(e => linkedEmpIds.includes(e.id));

                return (
                  <div
                    key={client.id}
                    className="glass-card p-0 group flex flex-col transition-all duration-300 hover:border-primary/30 relative overflow-hidden min-h-[260px] shadow-xl animate-scale-in"
                    style={{ animationDelay: `${i * 0.05}s` }}
                  >
                    {/* Botão Rápido de Vincular Equipe (Canto Superior Esquerdo — maior no celular) */}
                    {loggedUserRole !== 'GUEST' && (
                      <div className="absolute top-3.5 left-3.5 z-10 flex items-center gap-1">
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              onClick={(e) => e.stopPropagation()}
                              title="Vincular pessoa da equipe a este cliente"
                              className="flex items-center gap-1.5 h-9 px-3 rounded-full bg-black/60 backdrop-blur-md border border-white/20 hover:border-primary/50 hover:bg-black/80 text-white shadow-lg transition-all"
                            >
                              {linkedEmps.length > 0 ? (
                                <div className="flex -space-x-1.5 items-center">
                                  {linkedEmps.slice(0, 3).map(emp => (
                                    <div
                                      key={emp.id}
                                      className="w-6 h-6 rounded-full overflow-hidden border border-black bg-zinc-800 flex items-center justify-center text-[10px] font-bold"
                                      title={emp.name}
                                    >
                                      {emp.photoUrl ? (
                                        <img src={emp.photoUrl} alt={emp.name} className="w-full h-full object-cover" />
                                      ) : (
                                        <span>{emp.avatar || emp.name.substring(0, 2).toUpperCase()}</span>
                                      )}
                                    </div>
                                  ))}
                                  {linkedEmps.length > 3 && (
                                    <span className="text-[10px] font-bold pl-2 pr-0.5 text-white/90">
                                      +{linkedEmps.length - 3}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <>
                                  <UserPlus className="w-4 h-4 text-white/80" />
                                  <span className="text-xs font-semibold text-white/80">Equipe</span>
                                </>
                              )}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            align="start"
                            className="w-64 bg-[#1C1C1E] border-white/10 text-white p-2.5 rounded-xl shadow-2xl z-50"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="px-2 py-1.5 border-b border-white/10 mb-1.5">
                              <p className="text-xs font-bold text-white">Vincular à Equipe</p>
                              <p className="text-[11px] text-white/50 truncate">{client.name}</p>
                            </div>
                            <div className="space-y-1 max-h-60 overflow-y-auto py-1">
                              {employees.map(emp => {
                                const isLinked = linkedEmpIds.includes(emp.id);
                                return (
                                  <button
                                    key={emp.id}
                                    type="button"
                                    onClick={() => {
                                      toggleClientEmployee(client.id, emp.id);
                                      toast.success(
                                        isLinked
                                          ? `${emp.name} desvinculado de ${client.name}`
                                          : `${client.name} vinculado a ${emp.name}!`
                                      );
                                    }}
                                    className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-xs transition-colors ${
                                      isLinked ? 'bg-primary/20 text-white font-semibold' : 'hover:bg-white/5 text-white/80'
                                    }`}
                                  >
                                    <div className="w-7 h-7 rounded-full overflow-hidden border border-white/20 bg-white/10 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                      {emp.photoUrl ? (
                                        <img src={emp.photoUrl} alt={emp.name} className="w-full h-full object-cover" />
                                      ) : (
                                        <span>{emp.avatar || emp.name.substring(0, 2).toUpperCase()}</span>
                                      )}
                                    </div>
                                    <span className="flex-1 text-left truncate">{emp.name}</span>
                                    {isLinked && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                                  </button>
                                );
                              })}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    )}

                    {/* Client Menu - Visível sempre no celular, hover no desktop */}
                    {loggedUserRole !== 'GUEST' && (
                      <div className="absolute top-3.5 right-3.5 z-10 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-black/60 backdrop-blur-md border border-white/15 hover:bg-black/80 text-white shadow-lg">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-[#1C1C1E] border-white/10 text-white rounded-xl p-1.5 shadow-2xl min-w-[160px]">
                            <DropdownMenuItem onClick={() => openEdit(client)} className="gap-2.5 cursor-pointer rounded-lg focus:bg-white/5 py-2.5 text-xs">
                              <Edit2 className="w-4 h-4" /> Editar Cliente
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => deleteCalendarClient(client.id)} className="gap-2.5 cursor-pointer rounded-lg focus:bg-red-500/20 text-red-400 focus:text-red-400 py-2.5 text-xs">
                              <Trash2 className="w-4 h-4" /> Excluir permanentemente
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}

                    {/* Main Content Area */}
                    <button
                      onClick={() => navigate(`/calendario/${client.id}`)}
                      className="flex-1 flex flex-col items-center justify-center p-6 pt-12 sm:pt-6 text-center group/btn relative"
                    >
                      {/* Logo or Initial circle */}
                      <div className="relative mb-3.5">
                        <div className={`w-24 h-24 sm:w-20 sm:h-20 rounded-full border-2 border-white/15 shadow-2xl flex items-center justify-center overflow-hidden transition-transform duration-500 group-hover/btn:scale-110 group-hover/btn:border-primary/50
                          ${!client.logoUrl ? 'bg-gradient-to-br from-red-600 to-rose-700' : 'bg-black/40'}
                        `}>
                          {client.logoUrl ? (
                            <img src={client.logoUrl} className="w-full h-full object-cover" alt={client.name} />
                          ) : (
                            <span className="text-2xl font-bold text-white uppercase">{client.name.substring(0, 2)}</span>
                          )}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary rounded-full border-2 border-[#0a0a0c] flex items-center justify-center shadow-lg opacity-100 sm:opacity-0 sm:group-hover/btn:opacity-100 transition-opacity">
                          <ArrowRight className="w-3.5 h-3.5 text-white" />
                        </div>
                      </div>

                      <h3 className="font-bold text-white text-lg tracking-tight group-hover/btn:text-primary transition-colors truncate w-full px-4">{client.name}</h3>
                      <p className="text-xs text-white/50 mt-1 uppercase tracking-widest font-semibold flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-primary" /> PLANEJAMENTO
                      </p>
                      {linkedEmps.length > 0 && (
                        <p className="text-xs text-primary/90 font-semibold mt-1.5 truncate max-w-full px-3">
                          Resp: {linkedEmps.map(e => e.name).join(', ')}
                        </p>
                      )}
                    </button>
                    
                    {/* Indicator bar */}
                    <div className="h-1 w-full bg-white/5 relative">
                      <div className="absolute top-0 left-0 h-full w-0 bg-primary group-hover:w-full transition-all duration-700 ease-out" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
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

