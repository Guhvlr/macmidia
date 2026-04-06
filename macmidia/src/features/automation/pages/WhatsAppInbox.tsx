import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/useApp';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, MessageSquare, Send, Trash2, Loader2, Image, FileText, Sparkles, User, Clock, Check, X, RefreshCw, ChevronDown, Filter, FileSpreadsheet, FileCode, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface InboxMessage {
  id: string;
  remote_jid: string;
  sender: string;
  sender_name: string;
  message_text: string;
  message_type: string;
  media_url: string | null;
  media_mime_type: string | null;
  status: string;
  created_at: string;
}

const WhatsAppInbox = () => {
  const navigate = useNavigate();
  const { employees, addKanbanCard } = useApp();
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<InboxMessage | null>(null);
  const [aiResult, setAiResult] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [editClientName, setEditClientName] = useState('');
  const [isSequencia, setIsSequencia] = useState(false);
  const [filterActive, setFilterActive] = useState(true);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const fetchMessages = useCallback(async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('whatsapp_inbox')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMessages(data || []);
    } catch (err: any) {
      console.error('Erro ao carregar mensagens:', err);
      toast.error('Erro ao carregar caixa de entrada.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
    // Subscribe to real-time inserts
    const channel = supabase
      .channel('whatsapp-inbox-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_inbox' }, (payload) => {
        setMessages(prev => [payload.new as InboxMessage, ...prev]);
        toast.info('📩 Nova mensagem do WhatsApp recebida!');
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchMessages]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMessages();
  };

  const handleDismiss = async (id: string) => {
    try {
      await (supabase as any).from('whatsapp_inbox').update({ status: 'dismissed' }).eq('id', id);
      setMessages(prev => prev.filter(m => m.id !== id));
      toast.success('Mensagem descartada.');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao descartar.');
    }
  };

  const handleClearAll = async () => {
    try {
      setRefreshing(true);
      const { error } = await (supabase as any)
        .from('whatsapp_inbox')
        .update({ status: 'dismissed' })
        .eq('status', 'pending');

      if (error) throw error;
      
      setMessages([]);
      setShowClearConfirm(false);
      toast.success('Caixa de entrada limpa com sucesso!');
    } catch (err: any) {
      console.error('Erro ao limpar caixa:', err);
      toast.error('Erro ao limpar caixa de entrada.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleOpenSend = (msg: InboxMessage) => {
    setSelectedMessage(msg);
    setAiResult('');
    setSelectedEmployee('');
    
    // Tenta puxar o nome já limpo (ou o ID do grupo)
    const defaultName = msg.sender_name || 
                        msg.sender.replace(/@.*/, '').replace(/\d{2}(\d{4,})/, '$1') ||
                        'Cliente WhatsApp';
    setEditClientName(defaultName);
    setIsSequencia(false);
    
    setShowSendDialog(true);
  };

  const handleProcessWithAI = async (mode: 'standard' | 'creative' = 'standard') => {
    if (!selectedMessage) return;
    setAiLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('process-whatsapp-message', {
        body: { 
          messageText: selectedMessage.message_text,
          senderName: selectedMessage.sender_name || 'Desconhecido',
          mode
        },
      });

      if (error) throw error;

      const { processedText, clientName, priceMismatch, originalOrder } = data;
      
      setAiResult(processedText);
      setIsSequencia(originalOrder || false);
      
      if (clientName && clientName !== 'Desconhecido') {
        setEditClientName(clientName.toUpperCase());
      }
      
      if (priceMismatch) {
        toast.error('⚠️ ATENÇÃO: Divergência de preços detectada pela IA! Por favor, confira os valores com a mensagem original.', {
          duration: 6000,
        });
      } else {
        toast.success(mode === 'creative' ? '✨ CriATIVIDADE em ação!' : '✨ Ofertas organizadas!');
      }
    } catch (err: any) {
      console.error('Erro na IA:', err);
      setAiResult(selectedMessage.message_text);
      toast.error('IA indisponível no momento. Usando texto original.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSendToKanban = async () => {
    if (!selectedMessage || !selectedEmployee) {
      toast.error('Selecione um responsável.');
      return;
    }

    setProcessingId(selectedMessage.id);

    try {
      let finalText = aiResult || selectedMessage.message_text;
      
      if (isSequencia) {
        finalText = `✅ SEQUÊNCIA ✅\n\n${finalText}`;
      }

      // Build card
      addKanbanCard({
        clientName: editClientName.trim() || 'Cliente WhatsApp',
        description: finalText,
        notes: `Via WhatsApp — ${new Date(selectedMessage.created_at).toLocaleString('pt-BR')}`,
        column: 'para-producao',
        employeeId: selectedEmployee,
        timeSpent: 0,
        timerRunning: false,
        source: 'whatsapp',
        originalMessage: selectedMessage.message_text,
        images: selectedMessage.media_url ? [selectedMessage.media_url] : [],
        history: [{
          id: crypto.randomUUID(),
          userId: 'system',
          userName: '📱 WhatsApp',
          actionType: 'create' as const,
          description: 'Card criado manualmente via Caixa de Entrada do WhatsApp',
          createdAt: new Date().toISOString(),
        }],
      });

      // Mark as processed
      await (supabase as any).from('whatsapp_inbox').update({ status: 'processed' }).eq('id', selectedMessage.id);
      setMessages(prev => prev.filter(m => m.id !== selectedMessage.id));
      
      setShowSendDialog(false);
      setSelectedMessage(null);
      setAiResult('');
      toast.success('✅ Card criado no Kanban com sucesso!');
    } catch (err: any) {
      console.error('Erro ao criar card:', err);
      toast.error('Erro ao enviar para o Kanban.');
    } finally {
      setProcessingId(null);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    
    if (diffMin < 1) return 'agora';
    if (diffMin < 60) return `${diffMin}min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h`;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const getTypeIcon = (msg: InboxMessage) => {
    if (msg.message_type === 'image') return <Image className="w-3.5 h-3.5" />;
    if (msg.message_type === 'document') {
      const mime = (msg.media_mime_type || '').toLowerCase();
      if (mime.includes('excel') || mime.includes('spreadsheet') || mime.includes('sheet')) return <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />;
      if (mime.includes('word') || mime.includes('officedocument.wordprocessingml')) return <FileCode className="w-3.5 h-3.5 text-blue-500" />;
      return <FileText className="w-3.5 h-3.5" />;
    }
    if (msg.message_type === 'audio') return <Clock className="w-3.5 h-3.5" />; // Placeholder or specific icon
    return <MessageSquare className="w-3.5 h-3.5" />;
  };

  const getFilteredMessages = () => {
    if (!filterActive) return messages;
    
    return messages.filter(msg => {
      // Sempre manter mensagens com anexo (imagem/doc/áudio), pois costumam ser ofertas ou briefings
      if (msg.media_url || msg.message_type !== 'text') return true;
      
      const text = (msg.message_text || '').trim();
      if (!text) return false;

      // Quebrar em linhas e remover linhas vazias
      const lines = text.split('\n').filter(l => l.trim().length > 0);
      
      // 1. Requisito básico: Pelo menos 3 linhas (padrão de lista de ofertas)
      const hasManyLines = lines.length >= 3;
      
      // 2. Detecção de Padrão de Preço (ex: 10,99 ou R$ 10,99)
      const priceRegex = /(\d+[,.]\d{2})|R\$/i;
      const hasPrices = priceRegex.test(text);

      // 3. Palavras-chave de varejo/supermercado
      const supermarketKeywords = [
        'arroz', 'feijao', 'feijão', 'carne', 'leite', 'pão', 'pao', 'cafe', 'café', 
        'açucar', 'açúcar', 'oleo', 'óleo', 'frango', 'cerveja', 'refri', 'limpeza', 
        'oferta', 'promo', 'kg', 'un', 'unidade', 'litro', 'grama', 'frios', 'horti',
        'fruta', 'maçã', 'verdura'
      ];
      const hasKeywords = supermarketKeywords.some(k => text.toLowerCase().includes(k));

      // Se tiver muitas linhas E (contiver preços OU palavras-chave de produto), consideramos uma oferta
      return hasManyLines && (hasPrices || hasKeywords);
    });
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'image': return 'Imagem';
      case 'document': return 'Documento';
      case 'audio': return 'Áudio';
      case 'video': return 'Vídeo';
      default: return 'Texto';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col gradient-bg overflow-hidden">
      {/* Header */}
      <header className="px-6 md:px-12 py-8 flex flex-col gap-6 bg-[#0a0a0c]/80 backdrop-blur-xl border-b border-white/5 relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500/40 via-transparent to-green-500/40" />
        
        <div className="flex items-center gap-6 w-full">
          <Button 
            variant="ghost" size="icon" onClick={() => navigate('/')} 
            className="h-12 w-12 rounded-2xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all border border-white/5 group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
          </Button>

          <div className="flex-1">
            <h1 className="text-2xl md:text-4xl font-black text-white tracking-tighter uppercase leading-none">
              Caixa de Entrada
            </h1>
            <p className="text-[10px] text-white/30 mt-2 uppercase tracking-[0.2em] font-bold">
              Mensagens do WhatsApp · Triagem Manual
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              onClick={() => setFilterActive(!filterActive)}
              className={`h-10 rounded-xl border transition-all text-xs font-bold ${filterActive ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-white/5 border-white/5 text-white/50'}`}
            >
              <Filter className="w-4 h-4 mr-2" />
              {filterActive ? 'Filtro: Inteligente' : 'Filtro: Desligado'}
            </Button>
            <Button 
              variant="ghost" 
              onClick={handleRefresh}
              disabled={refreshing}
              className="h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-white/50 hover:text-white text-xs font-bold"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => setShowClearConfirm(true)}
              className="h-10 px-4 rounded-xl text-xs font-bold"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Limpar Tudo
            </Button>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500/10 border border-green-500/20">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] uppercase font-bold text-green-400 tracking-widest">
                {getFilteredMessages().length} {getFilteredMessages().length === 1 ? 'visível' : 'visíveis'}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 md:p-12 max-w-5xl mx-auto w-full custom-scrollbar">
        {/* Empty state */}
        {messages.length === 0 && (
          <div className="glass-card p-16 text-center max-w-lg mx-auto border-dashed border-white/10 mt-10">
            <div className="w-20 h-20 rounded-full bg-green-500/5 flex items-center justify-center mx-auto mb-6">
              <MessageSquare className="w-10 h-10 text-green-500/30" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Caixa Vazia</h3>
            <p className="text-white/40 text-sm max-w-[300px] mx-auto">
              Nenhuma mensagem pendente do WhatsApp. Novas mensagens aparecerão aqui automaticamente.
            </p>
          </div>
        )}

        {/* Message List */}
        <div className="space-y-3">
          {getFilteredMessages().map((msg, i) => (
            <div 
              key={msg.id} 
              className="bg-white/[0.03] border border-white/5 rounded-2xl p-5 hover:border-white/10 hover:bg-white/[0.05] transition-all animate-in fade-in slide-in-from-bottom-2 duration-300 group"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="w-12 h-12 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400 font-bold text-sm shrink-0 uppercase">
                  {(msg.sender_name || '?').substring(0, 2)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-bold text-white truncate">
                      {msg.sender_name || msg.sender.replace(/@.*/, '')}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-white/30 font-bold uppercase flex items-center gap-1">
                      {getTypeIcon(msg)} {getTypeLabel(msg.message_type)}
                    </span>
                    <span className="text-[10px] text-white/20 ml-auto flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {formatTime(msg.created_at)}
                    </span>
                  </div>
                  
                  <p className="text-sm text-white/60 leading-relaxed line-clamp-4 whitespace-pre-wrap">
                    {msg.message_text || `[${getTypeLabel(msg.message_type)} recebido sem texto]`}
                  </p>
                  
                  {msg.media_url && (
                    <div className="mt-3 flex items-center gap-2 text-[10px] text-white/30">
                      <Image className="w-3.5 h-3.5" />
                      <span className="uppercase font-bold tracking-wider">Mídia anexada</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 opacity-60 group-hover:opacity-100 transition-opacity shrink-0">
                  <Button 
                    onClick={() => handleOpenSend(msg)}
                    className="h-10 px-5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-green-900/30"
                  >
                    <Send className="w-3.5 h-3.5 mr-2" /> Enviar ao Kanban
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={() => handleDismiss(msg.id)}
                    className="h-9 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded-xl text-[10px] font-bold uppercase tracking-wider"
                  >
                    <X className="w-3 h-3 mr-1" /> Descartar
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Send to Kanban Dialog */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent className="bg-[#121214] border-white/10 text-white max-w-4xl p-0 rounded-2xl overflow-hidden shadow-2xl h-[90vh] sm:h-[80vh]">
          <div className="flex h-full min-h-0">
            {/* Left side: Form */}
            <div className="flex-1 flex flex-col min-w-0">
              <DialogHeader className="p-6 pb-0">
                <DialogTitle className="text-xl font-black tracking-tighter flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                    <Send className="w-5 h-5 text-green-400" />
                  </div>
                  Enviar para o Kanban
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Formulário para transformar uma mensagem do WhatsApp em um card de produção no Kanban.
                </DialogDescription>
              </DialogHeader>

              {selectedMessage && (
                <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
                  {/* Original message preview */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Mensagem Original</label>
                    <div className="bg-white/5 rounded-xl p-4 border border-white/5 max-h-32 overflow-y-auto custom-scrollbar">
                      <p className="text-sm text-white/60 whitespace-pre-wrap leading-relaxed">
                        {selectedMessage.message_text || `[${getTypeLabel(selectedMessage.message_type)}]`}
                      </p>
                    </div>
                  </div>

                  {/* Nome e Sequencia */}
                  <div className="flex gap-4">
                    <div className="flex-1 space-y-2">
                      <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Nome do Cliente / Grupo</label>
                      <input 
                        value={editClientName}
                        onChange={e => setEditClientName(e.target.value)}
                        placeholder="Ex: Supermercado Laranjeiras..."
                        className="w-full bg-white/5 border border-white/10 h-11 rounded-xl px-4 text-white text-sm focus:ring-2 focus:ring-green-500/20 focus:outline-none transition-all placeholder:text-white/20"
                      />
                    </div>
                    <div className="w-[120px] space-y-2">
                      <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Sequência?</label>
                      <Select value={isSequencia ? 'sim' : 'nao'} onValueChange={v => setIsSequencia(v === 'sim')}>
                        <SelectTrigger className="bg-white/5 border-white/10 h-11 rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#252528] border-white/10 text-white rounded-xl">
                          <SelectItem value="nao">Não</SelectItem>
                          <SelectItem value="sim" className="text-yellow-400 font-bold">Sim</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* AI Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Descrição do Card</label>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" onClick={() => handleProcessWithAI('standard')} disabled={aiLoading}
                          className="h-7 px-2.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase border border-emerald-500/20"
                        >
                          <Zap className="w-3 h-3 mr-1.5" /> AI Ofertas
                        </Button>
                        <Button 
                          variant="ghost" onClick={() => handleProcessWithAI('creative')} disabled={aiLoading}
                          className="h-7 px-2.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-[9px] font-black uppercase border border-purple-500/20"
                        >
                          <Sparkles className="w-3 h-3 mr-1.5" /> AI Criativo
                        </Button>
                      </div>
                    </div>
                    <Textarea 
                      value={aiResult || selectedMessage.message_text}
                      onChange={e => setAiResult(e.target.value)}
                      className="bg-white/5 border-white/10 rounded-xl min-h-[100px] text-white leading-relaxed p-4 resize-none text-sm"
                    />
                  </div>

                  {/* Employee Select */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Responsável no Kanban</label>
                    <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                      <SelectTrigger className="bg-white/5 border-white/10 h-11 rounded-xl">
                        <SelectValue placeholder="Selecione quem vai produzir" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#252528] border-white/10 text-white rounded-xl">
                        {employees.map(e => (
                          <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button 
                    onClick={handleSendToKanban}
                    disabled={!selectedEmployee || processingId === selectedMessage.id}
                    className="w-full h-12 bg-green-600 hover:bg-green-500 text-white font-black uppercase text-xs tracking-widest rounded-xl shadow-lg shadow-green-900/30"
                  >
                    {processingId === selectedMessage.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                    Criar Card no Kanban
                  </Button>
                </div>
              )}
            </div>

            {/* Right side: Client Guide */}
            <div className="w-[320px] bg-green-500/[0.03] border-l border-white/5 flex flex-col min-w-0">
              <div className="p-6 border-b border-white/5">
                <h3 className="text-sm font-black uppercase tracking-widest text-green-400 flex items-center gap-2">
                  <User className="w-4 h-4" /> Guia de Clientes
                </h3>
                <p className="text-[10px] text-white/30 mt-1 uppercase font-bold">Referência de Responsáveis</p>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
                {[
                  { name: 'David', clients: ['Garotão', 'Canedão', 'Couto', 'Parque', '20V', 'Atacadão Ipameri'] },
                  { name: 'Gabriel', clients: ['SJ', 'Conquista', 'Marinho', 'Grupo Veronica', 'Bom Garoto', 'ABC'] },
                  { name: 'Kauan', clients: ['Brasil'] },
                  { name: 'Khayo', clients: ['Kairós', 'Soberano', 'Leve Mais', 'Andorinha', 'Sacolão', 'Primavera 1'] },
                  { name: 'Thiago', clients: ['Barranco', 'Rio Branco', 'Facil', 'Seu Vizinho', 'SP3', 'SP4', 'Bem Atacarejo', 'Prátiko'] },
                  { name: 'Wanessa', clients: ['Hiper Perto', 'Braga', 'Super 10', 'Verônica', 'Avanthe / Araguaia', 'Betão / Hugão', 'Laranjeiras / Laran. Premium'] },
                ].map(item => (
                  <div key={item.name} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500/50" />
                      <span className="text-xs font-black uppercase text-white/80">{item.name}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-1 pl-3.5">
                      {item.clients.map(client => (
                        <div 
                          key={client} 
                          className="text-[10px] text-white/40 hover:text-green-400 cursor-pointer transition-colors flex items-center gap-2 group"
                          onClick={() => setEditClientName(client.toUpperCase())}
                        >
                          <div className="w-1 h-[1px] bg-white/10 group-hover:bg-green-500/30" />
                          {client}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-green-500/5 border-t border-white/5">
                <p className="text-[9px] text-green-400/50 text-center uppercase font-bold italic">💡 Clique no nome do cliente para preencher automaticamente</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Clear All Confirmation */}
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent className="bg-[#1C1C1E] border-white/10 text-white rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar toda a caixa?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/50 text-[13px]">
              Tem certeza que deseja descartar todas as {messages.length} mensagens pendentes? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-none">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleClearAll}>
              Sim, limpar tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default WhatsAppInbox;
