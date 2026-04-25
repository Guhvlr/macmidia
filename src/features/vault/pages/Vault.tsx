import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/useApp';
import { ArrowLeft, Plus, Eye, EyeOff, Trash2, Copy, Shield, Globe, User, Loader2, ImageIcon, Search, Phone, Mail, MapPin, FileText, ExternalLink, Settings2, Lock, X, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import defaultBanner from '@/assets/banner-mac-midia.png';
import defaultLogo from '@/assets/logo-mac-midia.png';
import { CalendarClient, Credential } from '@/contexts/app-types';

const Vault = () => {
  const navigate = useNavigate();
  const { 
    employees, 
    credentials, 
    calendarClients,
    updateCalendarClient,
    addCredential, 
    deleteCredential, 
    loading,
    fetchAll
  } = useApp();
  
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchAll();
      toast.success('Banco de dados sincronizado!');
    } catch (err) {
      toast.error('Erro ao sincronizar dados');
    } finally {
      setIsRefreshing(false);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<CalendarClient | null>(null);
  const [showAddCred, setShowAddCred] = useState(false);
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());
  const [credForm, setCredForm] = useState({ label: '', username: '', password: '', url: '' });
  
  // Local state for client info editing
  const [clientForm, setClientForm] = useState<{
    email: string;
    phones: string[];
    address: string;
    notes: string;
  }>({
    email: '',
    phones: [''],
    address: '',
    notes: ''
  });

  // Load client data into local form when selected
  useEffect(() => {
    if (selectedClient) {
      setClientForm({
        email: selectedClient.email || '',
        phones: selectedClient.phones && selectedClient.phones.length > 0 ? [...selectedClient.phones] : [''],
        address: selectedClient.address || '',
        notes: selectedClient.notes || ''
      });
    }
  }, [selectedClient]);

  const toggleVisibility = (id: string) => {
    setVisibleIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado para a área de transferência!');
  };

  const handleSaveClientInfo = () => {
    if (!selectedClient) return;
    
    // Filter out empty phones
    const cleanedPhones = clientForm.phones.filter(p => p.trim() !== '');
    
    updateCalendarClient(selectedClient.id, { 
      email: clientForm.email,
      phones: cleanedPhones,
      address: clientForm.address,
      notes: clientForm.notes
    });
    
    toast.success('Dossiê do cliente atualizado com sucesso!');
  };

  const handlePhoneChange = (index: number, value: string) => {
    const newPhones = [...clientForm.phones];
    newPhones[index] = value;
    setClientForm(prev => ({ ...prev, phones: newPhones }));
  };

  const addPhoneField = () => {
    setClientForm(prev => ({ ...prev, phones: [...prev.phones, ''] }));
  };

  const removePhoneField = (index: number) => {
    if (clientForm.phones.length <= 1) {
      setClientForm(prev => ({ ...prev, phones: [''] }));
      return;
    }
    const newPhones = clientForm.phones.filter((_, i) => i !== index);
    setClientForm(prev => ({ ...prev, phones: newPhones }));
  };

  const handleAddCred = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;
    if (!credForm.label.trim() || !credForm.password.trim()) return;
    
    try {
      await addCredential({ 
        ...credForm, 
        url: credForm.url || undefined,
        calendarClientId: selectedClient.id,
        employeeId: '' // Removed from UI as requested
      });
      
      setCredForm({ label: '', username: '', password: '', url: '' });
      setShowAddCred(false);
      toast.success('Acesso adicionado com sucesso!');
    } catch (err) {
      // Error toast is already shown by addCredential
      console.error('Falha ao registrar acesso:', err);
    }
  };

  const filteredClients = calendarClients.filter(c => {
    const q = searchQuery.toLowerCase();
    return c.name.toLowerCase().includes(q) ||
           (c.email?.toLowerCase().includes(q)) ||
           (c.phones?.some(p => p.toLowerCase().includes(q)));
  });

  const getClientCredentials = (clientId: string) => {
    return credentials.filter(cred => cred.calendarClientId === clientId);
  };

  if (loading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg">
      <header className="px-6 md:px-12 py-10 flex flex-col gap-8 bg-[#0a0a0c]/80 backdrop-blur-xl border-b border-white/5 relative items-start">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/40 via-transparent to-primary/40" />
        
        <div className="flex items-center gap-6 w-full">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/')} 
            className="h-12 w-12 rounded-2xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all border border-white/5 group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
          </Button>

          <div className="flex-1">
            <h1 className="text-2xl md:text-4xl font-black text-white tracking-tighter uppercase leading-none">Banco de Dados</h1>
            <p className="text-[10px] text-white/30 mt-2 uppercase tracking-[0.2em] font-bold">Gerenciamento estratégico de dossiês e acessos</p>
          </div>

          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/5">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-primary transition-all border border-white/5 px-3 text-[10px] font-bold uppercase tracking-wider"
            >
              <RefreshCw className={`w-3 h-3 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Sincronizar
            </Button>
            <div className="w-px h-4 bg-white/10 mx-1" />
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-[10px] uppercase font-bold text-white/40 tracking-widest">Acesso Restrito</span>
          </div>
        </div>

        <div className="w-full max-w-2xl relative group">
          <div className="absolute inset-0 bg-primary/10 blur-2xl rounded-full opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none" />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-primary transition-colors pointer-events-none" />
          <Input 
            placeholder="Encontrar cliente ou marca..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="bg-white/5 border-white/10 pl-12 h-14 rounded-2xl text-base focus-visible:ring-primary/20 text-white placeholder:text-white/20 transition-all"
          />
        </div>
      </header>

      <main className="p-6 md:p-12 max-w-[1600px] mx-auto animate-fade-in">
        {filteredClients.length === 0 && (
          <div className="glass-card p-16 text-center max-w-xl mx-auto border-dashed border-white/10 mt-10">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6 transform transition-transform group-hover:scale-110">
              <Shield className="w-10 h-10 text-white/20" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Sem Resultados</h3>
            <p className="text-white/40 text-sm max-w-[280px] mx-auto">Não encontramos nenhum cliente com este nome na sua base de dados.</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {filteredClients.map((client, i) => {
            const credCount = getClientCredentials(client.id).length;
            return (
              <div
                key={client.id}
                onClick={() => setSelectedClient(client)}
                className="glass-card-hover p-0 flex flex-col group cursor-pointer animate-scale-in overflow-hidden h-[240px]"
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                <div className="flex-1 p-6 flex flex-col items-center justify-center text-center">
                  <div className={`w-16 h-16 rounded-full border-2 border-white/10 shadow-2xl flex items-center justify-center overflow-hidden mb-4 transition-transform duration-500 group-hover:scale-110
                    ${!client.logoUrl ? 'bg-gradient-to-br from-red-600 to-rose-700' : 'bg-black/40'}
                  `}>
                    {client.logoUrl ? (
                      <img src={client.logoUrl} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <span className="text-xl font-bold text-white uppercase">{client.name.substring(0, 2)}</span>
                    )}
                  </div>
                  <h3 className="font-bold text-white text-lg tracking-tight group-hover:text-primary transition-colors">{client.name}</h3>
                  <div className="flex items-center gap-2 mt-2">
                     <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-white/40 font-bold uppercase tracking-tighter">
                       {client.phones && client.phones.length > 0 ? '✓ Contato' : 'Ø Contato'}
                     </span>
                     <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-white/40 font-bold uppercase tracking-tighter">
                       {credCount} {credCount === 1 ? 'Acesso' : 'Acessos'}
                     </span>
                  </div>
                </div>
                <div className="h-1 w-full bg-white/5 relative">
                  <div className="absolute top-0 left-0 h-full w-0 bg-primary group-hover:w-full transition-all duration-500 ease-out" />
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Client Profile Dialog */}
      <Dialog open={!!selectedClient} onOpenChange={(open) => !open && setSelectedClient(null)}>
        <DialogContent className="bg-[#121214] border-white/10 text-white max-w-4xl p-0 rounded-2xl overflow-hidden h-[85vh] flex flex-col shadow-2xl">
          {selectedClient && (
            <>
              {/* Header inside Modal */}
              <div className="bg-[#1C1C1E] p-6 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl border border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-lg ${!selectedClient.logoUrl ? 'bg-red-600' : 'bg-black/20'}`}>
                    {selectedClient.logoUrl ? <img src={selectedClient.logoUrl} className="w-full h-full object-cover" alt="" /> : <span className="font-bold text-lg">{selectedClient.name.substring(0,2)}</span>}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tighter">{selectedClient.name}</h2>
                    <p className="text-xs text-white/40 uppercase tracking-widest font-bold">Perfil do Cliente</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-hidden">
                <Tabs defaultValue="info" className="h-full flex flex-col">
                  <div className="px-6 border-b border-white/5 bg-[#1C1C1E]/50">
                    <TabsList className="bg-transparent border-none p-0 h-14 gap-8">
                      <TabsTrigger value="info" className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-0 font-bold text-xs uppercase tracking-widest border-b-2 border-transparent transition-all">
                        <User className="w-4 h-4 mr-2" /> Informações
                      </TabsTrigger>
                      <TabsTrigger value="creds" className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-0 font-bold text-xs uppercase tracking-widest border-b-2 border-transparent transition-all">
                        <Lock className="w-4 h-4 mr-2" /> Chaves de Acesso ({getClientCredentials(selectedClient.id).length})
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    <TabsContent value="info" className="m-0 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300 outline-none pb-24">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Contatos */}
                        <div className="space-y-6">
                          <div className="flex items-center gap-2 text-primary">
                            <Phone className="w-4 h-4" />
                            <h3 className="text-sm font-bold uppercase tracking-wider">Contatos do Parceiro</h3>
                          </div>
                          
                          <div className="space-y-6">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-white/30 uppercase ml-1">E-mail Principal</label>
                              <div className="flex gap-2">
                                <Input 
                                  placeholder="contato@cliente.com" 
                                  value={clientForm.email} 
                                  onChange={e => setClientForm(prev => ({ ...prev, email: e.target.value }))}
                                  className="bg-white/5 border-white/10 rounded-xl h-12 focus:ring-primary/20 text-white font-medium" 
                                />
                                <Button variant="secondary" size="icon" className="h-12 w-12 rounded-xl shrink-0" onClick={() => clientForm.email && copyToClipboard(clientForm.email)}>
                                  <Copy className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <label className="text-[10px] font-bold text-white/30 uppercase ml-1 block">Telefones / WhatsApp das Lojas</label>
                              
                              {clientForm.phones.map((phone, idx) => (
                                <div key={idx} className="flex gap-2 animate-in fade-in zoom-in-95 duration-200">
                                  <Input 
                                    placeholder={`Telefone ${idx + 1}`} 
                                    value={phone} 
                                    onChange={e => handlePhoneChange(idx, e.target.value)}
                                    className="bg-white/5 border-white/10 rounded-xl h-12 focus:ring-primary/20 text-white font-medium" 
                                  />
                                  <Button variant="ghost" size="icon" className="h-12 w-12 rounded-xl shrink-0 text-white/20 hover:text-red-400 hover:bg-red-400/10" onClick={() => removePhoneField(idx)}>
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                  <Button variant="secondary" size="icon" className="h-12 w-12 rounded-xl shrink-0" onClick={() => phone && copyToClipboard(phone)}>
                                    <Copy className="w-4 h-4" />
                                  </Button>
                                </div>
                              ))}
                              
                              <Button 
                                variant="outline" 
                                onClick={addPhoneField}
                                className="w-full border-dashed border-white/10 bg-transparent hover:bg-white/5 h-11 rounded-xl text-[10px] uppercase font-bold tracking-widest text-white/40"
                              >
                                <Plus className="w-3 h-3 mr-2" /> Adicionar outro número
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Localização */}
                        <div className="space-y-6">
                          <div className="flex items-center gap-2 text-primary">
                            <MapPin className="w-4 h-4" />
                            <h3 className="text-sm font-bold uppercase tracking-wider">Localização</h3>
                          </div>
                          
                          <div className="space-y-4">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-white/30 uppercase ml-1">Endereço Completo</label>
                              <Textarea 
                                placeholder="Rua, Número, Bairro, Cidade..." 
                                value={clientForm.address} 
                                onChange={e => setClientForm(prev => ({ ...prev, address: e.target.value }))}
                                className="bg-white/5 border-white/10 rounded-xl min-h-[140px] focus:ring-primary/20 text-white leading-relaxed resize-none p-4" 
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Notas Estratégicas */}
                      <div className="space-y-4 pt-4 border-t border-white/5">
                        <div className="flex items-center gap-2 text-primary">
                          <FileText className="w-4 h-4" />
                          <h3 className="text-sm font-bold uppercase tracking-wider">Dossiê e Notas Estratégicas</h3>
                        </div>
                        <Textarea 
                          placeholder="Particularidades do cliente, preferências de arte, tons da marca, etc..." 
                          value={clientForm.notes} 
                          onChange={e => setClientForm(prev => ({ ...prev, notes: e.target.value }))}
                          className="bg-white/5 border-white/10 rounded-xl min-h-[150px] focus:ring-primary/20 text-white leading-relaxed p-4" 
                        />
                      </div>

                      {/* Floating Save Button */}
                      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50">
                        <Button 
                          onClick={handleSaveClientInfo}
                          className="h-14 px-10 btn-primary-glow text-white font-black uppercase text-xs tracking-[0.2em] rounded-full shadow-[0_15px_30px_-5px_rgba(239,68,68,0.4)] hover:scale-105 transition-all"
                        >
                          Salvar Dossiê do Cliente
                        </Button>
                      </div>
                    </TabsContent>

                    <TabsContent value="creds" className="m-0 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 outline-none pb-12">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h3 className="text-sm font-bold uppercase tracking-wider text-white">Chaves de Acesso</h3>
                          <p className="text-xs text-white/40">Gerencie logins e senhas vinculados à marca.</p>
                        </div>
                        <Button 
                          onClick={() => setShowAddCred(true)} 
                          className="h-10 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold px-5 shadow-lg shadow-primary/20"
                        >
                          <Plus className="w-4 h-4 mr-2" /> Novo Acesso
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {getClientCredentials(selectedClient.id).map(cred => (
                          <div key={cred.id} className="bg-white/5 border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                  {cred.label.toLowerCase().includes('insta') ? <ImageIcon className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
                                </div>
                                <div>
                                  <h4 className="font-bold text-sm text-white">{cred.label}</h4>
                                  {cred.url && <a href={cred.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-white/40 hover:text-primary transition-colors flex items-center gap-1">Visitar link <ExternalLink className="w-2.5 h-2.5" /></a>}
                                </div>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-9 w-9 hover:bg-red-500/10 hover:text-red-500 rounded-xl text-white/20" 
                                onClick={() => deleteCredential(cred.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>

                            <div className="space-y-3 bg-black/20 rounded-xl p-4 border border-white/5">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <User className="w-3.5 h-3.5 text-white/30" />
                                  <span className="text-xs text-white font-medium truncate">{cred.username}</span>
                                </div>
                                <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white/5 rounded-lg shrink-0" onClick={() => copyToClipboard(cred.username)}>
                                  <Copy className="w-3 h-3" />
                                </Button>
                              </div>
                              <div className="h-px bg-white/5" />
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Lock className="w-3.5 h-3.5 text-white/30" />
                                  <span className="text-xs font-mono tracking-wider font-bold">
                                    {visibleIds.has(cred.id) ? cred.password : '••••••••'}
                                  </span>
                                </div>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white/5 rounded-lg shrink-0" onClick={() => toggleVisibility(cred.id)}>
                                    {visibleIds.has(cred.id) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white/5 rounded-lg shrink-0" onClick={() => copyToClipboard(cred.password)}>
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}

                        {getClientCredentials(selectedClient.id).length === 0 && (
                          <div className="col-span-full py-12 text-center bg-white/[0.02] rounded-3xl border border-dashed border-white/10">
                            <Lock className="w-8 h-8 text-white/10 mx-auto mb-3" />
                            <p className="text-white/30 text-sm font-medium">Nenhum login ou senha para este cliente.</p>
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </div>
                </Tabs>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Credential Dialog (Linked to Client) */}
      <Dialog open={showAddCred} onOpenChange={setShowAddCred}>
        <DialogContent className="bg-[#1C1C1E] border-white/10 text-white max-w-md rounded-2xl shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-0 border-none">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <DialogTitle className="text-xl font-bold">Nova Chave de Acesso</DialogTitle>
            <DialogDescription className="text-white/40">Vinculada a {selectedClient?.name}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddCred} className="p-6 pt-4 space-y-4">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-white/40 uppercase ml-1 tracking-widest">Serviço / Rótulo</label>
                <Input placeholder="ex: Instagram @cliente" value={credForm.label} onChange={e => setCredForm(f => ({ ...f, label: e.target.value }))} className="bg-white/5 border-white/10 h-12 rounded-xl focus:ring-primary/20" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-white/40 uppercase ml-1 tracking-widest">Usuário</label>
                  <Input placeholder="Usuário / E-mail" value={credForm.username} onChange={e => setCredForm(f => ({ ...f, username: e.target.value }))} className="bg-white/5 border-white/10 h-12 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-white/40 uppercase ml-1 tracking-widest">Senha</label>
                  <Input type="password" placeholder="••••••••" value={credForm.password} onChange={e => setCredForm(f => ({ ...f, password: e.target.value }))} className="bg-white/5 border-white/10 h-12 rounded-xl" />
                </div>
              </div>
            </div>
            <Button type="submit" className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl mt-4 shadow-lg shadow-primary/20">
              Registrar Acesso no Dossiê
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Vault;



