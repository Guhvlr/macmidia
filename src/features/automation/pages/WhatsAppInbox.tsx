import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/useApp';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, MessageSquare, Send, Trash2, Loader2, Image, FileText, Sparkles, User, Clock, Check, X, RefreshCw, Filter, FileSpreadsheet, FileCode, Zap, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { InboxMessageCard } from '../components/InboxMessageCard';

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
  raw_payload: any;
}

// Verifica se a mensagem é um documento Excel ou Word
const isExcelOrWord = (msg: InboxMessage) => {
  const mime = (msg.media_mime_type || '').toLowerCase();
  const text = (msg.message_text || '').toLowerCase();
  const isExcel = mime.includes('excel') || mime.includes('spreadsheet') || mime.includes('sheet') || text.includes('.xlsx') || text.includes('.xls');
  const isWord = mime.includes('word') || mime.includes('officedocument.wordprocessingml') || text.includes('.docx') || text.includes('.doc');
  return isExcel || isWord;
};

// Verifica se o conteúdo do arquivo já foi extraído
const hasExtractedContent = (msg: InboxMessage) => {
  const text = msg.message_text || '';
  return text.includes('[CONTEÚDO EXCEL]') || text.includes('[CONTEÚDO WORD]') || text.includes('✅ [CONTEÚDO');
};

const WhatsAppInbox = () => {
  const navigate = useNavigate();
  const { employees, addKanbanCard, calendarClients } = useApp();
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<InboxMessage | null>(null);
  const [aiResult, setAiResult] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [editClientName, setEditClientName] = useState('');
  const [isSequencia, setIsSequencia] = useState(false);
  const [filterActive, setFilterActive] = useState(true);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [extractMode, setExtractMode] = useState<'order' | 'sections' | null>(null);
  const [extractTargetMsg, setExtractTargetMsg] = useState<InboxMessage | null>(null);
  const [selectedCalendarClientId, setSelectedCalendarClientId] = useState('');

  const fetchMessages = useCallback(async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('whatsapp_inbox')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro técnico Supabase:', error);
        throw error;
      }
      setMessages(data || []);
    } catch (err: any) {
      console.error('Erro ao carregar mensagens (Detalhes):', {
        message: err.message,
        details: err.details,
        hint: err.hint,
        code: err.code
      });
      toast.error(`Erro ao carregar caixa de entrada: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
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
      toast.error('Erro ao descartar.');
    }
  };

  const handleClearAll = async () => {
    try {
      setRefreshing(true);
      await (supabase as any).from('whatsapp_inbox').update({ status: 'dismissed' }).eq('status', 'pending');
      setMessages([]);
      setShowClearConfirm(false);
      toast.success('Caixa de entrada limpa!');
    } catch (err) {
      toast.error('Erro ao limpar caixa de entrada.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleExtractFile = async (msg: InboxMessage, mode: 'order' | 'sections') => {
    setExtractTargetMsg(null);
    setExtractMode(null);
    setExtractingId(msg.id);
    toast.info('📂 Baixando arquivo do WhatsApp...');

    try {
      // 1. Pega as credenciais da Evolution API do raw_payload
      const payload = msg.raw_payload || {};
      const serverUrl = (payload.server_url || '').replace(/\/$/, '');
      const apiKey = payload.apikey || '';
      const instance = payload.instance || '';
      const messageId = payload.data?.key?.id || '';

      if (!serverUrl || !apiKey || !instance || !messageId) {
        throw new Error('Dados da Evolution API não encontrados nesta mensagem.');
      }

      // 2. Chama a Evolution API para descriptografar e baixar o arquivo
      toast.info('📂 Descriptografando arquivo...');

      const evoResponse = await fetch(`${serverUrl}/chat/getBase64FromMediaMessage/${instance}`, {
        method: 'POST',
        headers: {
          'apikey': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            key: payload.data?.key,
            message: payload.data?.message,
          },
          convertToMp4: false,
        }),
      });

      if (!evoResponse.ok) {
        const errText = await evoResponse.text();
        throw new Error(`Evolution API erro ${evoResponse.status}: ${errText}`);
      }

      const evoData = await evoResponse.json();
      const base64Data = evoData.base64 || evoData.data?.base64 || '';
      if (!base64Data) throw new Error('Evolution API não retornou o conteúdo do arquivo.');

      toast.info('📊 Lendo planilha...');

      // 3. Converte base64 para bytes e lê com SheetJS
      const binaryStr = atob(base64Data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const XLSX = await import('https://esm.sh/xlsx' as any).catch(() => null);
      let rawContent = '';

      if (XLSX) {
        const workbook = XLSX.read(bytes, { type: 'array' });
        workbook.SheetNames.forEach((sheetName: string) => {
          const worksheet = workbook.Sheets[sheetName];
          const txt = XLSX.utils.sheet_to_txt(worksheet);
          if (txt.trim()) rawContent += `--- Planilha: ${sheetName} ---\n${txt}\n\n`;
        });
      } else {
        rawContent = new TextDecoder().decode(bytes);
      }

      if (!rawContent.trim()) throw new Error('Planilha vazia ou sem conteúdo legível.');

      toast.info('🤖 Formatando ofertas com IA...');

      // 4. Busca chave OpenAI
      const { data: settingsData } = await (supabase as any)
        .from('settings')
        .select('value')
        .eq('key', 'openai_api_key')
        .single();

      const openaiKey = settingsData?.value;
      if (!openaiKey) throw new Error('Chave OpenAI não configurada.');

      // 5. Prompt muda conforme o modo escolhido
      const systemPrompt = mode === 'sections'
        ? `Você é um extrator de dados de ofertas de supermercado especializado em precisão técnica.
Receberá o conteúdo bruto de uma planilha Excel.

REGRA PRINCIPAL: Você NÃO pode remover informações da descrição original. Mantenha detalhes de embalagem, unidade, sabor, peso e volume.

REGRAS:
1. Extraia TODOS os produtos e preços preservando detalhes (pote, lata, fardo, kg, ml, etc.).
2. Formate cada produto como: NOME DO PRODUTO - R$ PREÇO
3. Agrupe obrigatoriamente por categorias usando exatamente estes títulos:
   ═══ CARNES ═══
   ═══ FRIOS E LATICÍNIOS ═══
   ═══ MERCEARIA ═══
   ═══ BEBIDAS ═══
   ═══ LIMPEZA ═══
   ═══ HIGIENE ═══
   ═══ HORTIFRUTI ═══
   ═══ PADARIA ═══
   ═══ CONGELADOS ═══
   ═══ OUTROS ═══
4. NUNCA altere os preços.
5. NUNCA use asteriscos ou markdown.
6. Se houver data, coloque no topo como: DATA XX/XX/XX
7. Retorne APENAS o texto formatado.`
        : `Você é um extrator de dados de ofertas de supermercado especializado em precisão técnica.
Receberá o conteúdo bruto de uma planilha Excel.

REGRA PRINCIPAL: Você NÃO pode remover informações da descrição original. Mantenha detalhes de embalagem, unidade, sabor, peso e volume.

REGRAS:
1. Extraia TODOS os produtos e preços NA ORDEM ORIGINAL da planilha preservando detalhes (pote, lata, fardo, kg, ml, etc.).
2. Formate cada produto como: NOME DO PRODUTO - R$ PREÇO
3. MANTENHA EXATAMENTE a sequência em que aparecem. NÃO reorganize.
4. NUNCA altere os preços.
5. NUNCA use asteriscos ou markdown.
6. Se houver data, coloque no topo como: DATA XX/XX/XX
7. Retorne APENAS o texto formatado.`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Conteúdo da planilha:\n\n${rawContent}` }
          ],
          temperature: 0.1,
          max_tokens: 3000,
        }),
      });

      if (!response.ok) throw new Error('Erro ao processar com IA.');

      const aiData = await response.json();
      const formattedContent = aiData.choices?.[0]?.message?.content?.trim() || rawContent;
      const cleanContent = formattedContent.replace(/\*/g, '');

      // 6. Salva no banco e atualiza localmente
      await (supabase as any)
        .from('whatsapp_inbox')
        .update({ message_text: cleanContent })
        .eq('id', msg.id);

      setMessages(prev =>
        prev.map(m => m.id === msg.id ? { ...m, message_text: cleanContent } : m)
      );

      toast.success(
        mode === 'sections'
          ? '✅ Planilha extraída e separada por seções!'
          : '✅ Planilha extraída na ordem original!'
      );

    } catch (err: any) {
      console.error('Erro ao extrair arquivo:', err);
      toast.error(`Erro ao extrair: ${err.message}`);
    } finally {
      setExtractingId(null);
    }
  };

  const handleOpenSend = (msg: InboxMessage) => {
    setSelectedMessage(msg);
    setAiResult('');
    setSelectedEmployee('');

    // ✅ Prioriza o nome do grupo/sender salvo no banco — não modifica nada
    const defaultName = (msg.sender_name && msg.sender_name.trim() && msg.sender_name !== 'Grupo sem Nome')
      ? msg.sender_name.trim()
      : msg.sender.replace(/@.*/, '') || 'Cliente WhatsApp';
    setEditClientName(defaultName);
    setSelectedCalendarClientId('');
    setIsSequencia(false);

    // ✅ Pré-preenche a descrição com o texto da mensagem (texto, documento extraído, etc.)
    if (msg.message_text && msg.message_text.trim()) {
      const cleanText = msg.message_text
        .replace('✅ [CONTEÚDO EXCEL]:', '')
        .replace('✅ [CONTEÚDO WORD]:', '')
        .trim();
      setAiResult(cleanText);
    }

    setShowSendDialog(true);
  };

  const handleProcessWithAI = async (mode: 'standard' | 'creative' = 'standard') => {
    if (!selectedMessage) return;
    setAiLoading(true);

    try {
      const { data: settingsData } = await (supabase as any)
        .from('settings')
        .select('value')
        .eq('key', 'openai_api_key')
        .single();

      const apiKey = settingsData?.value;

      if (!apiKey) {
        toast.error('Chave da OpenAI não configurada.');
        setAiResult(selectedMessage.message_text);
        setAiLoading(false);
        return;
      }

        const standardPrompt = `Você é um Analista de Dados Sênior da Agência MAC MIDIA especializado em precisão técnica.
Transforme a mensagem bruta em uma DESCRIÇÃO PROFISSIONAL para um card de produção no Kanban.

REGRA PRINCIPAL: Você NÃO pode remover informações da descrição original do cliente. Mantenha detalhes de embalagem (pote, lata, fardo, caixa), unidade, sabor, peso e volume.

REGRAS:
1. Corrija ortografia e gramática mantendo os detalhes técnicos originais.
2. Organize o conteúdo de forma clara e estruturada.
3. Se houver lista de produtos com preços, organize por categorias.
4. NUNCA altere preços — mantenha exatamente como recebidos.
5. NUNCA USE formatação markdown (asteriscos, negrito, etc.).
6. Retorne APENAS o texto processado, sem comentários.
7. PRESERVE o Nome do Cliente recebido como remetente se ele já parecer um nome de grupo ou empresa.

Retorne em JSON: { "clientName": "Nome do Cliente", "description": "Texto processado..." }`;

      const creativePrompt = `Você é um REDATOR CRIATIVO especialista em varejo da Agência MAC MIDIA.
Transforme o briefing em uma DESCRIÇÃO DE CARD detalhada e criativa.

REGRAS:
1. Foque em supermercados e varejo
2. Crie chamadas agressivas para ofertas
3. Sugira CTAs eficientes
4. NUNCA USE formatação markdown
5. PRESERVE o Nome do Cliente/Grupo original como identificação principal.

Retorne em JSON: { "clientName": "Nome do Cliente", "description": "Texto criativo..." }`;

      const systemPrompt = mode === 'creative' ? creativePrompt : standardPrompt;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Remetente: ${selectedMessage.sender_name || 'Desconhecido'}\n\nMensagem:\n${selectedMessage.message_text}` },
          ],
          response_format: { type: 'json_object' },
          temperature: mode === 'creative' ? 0.8 : 0.3,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) throw new Error(`OpenAI error: ${response.status}`);

      const data = await response.json();
      const parsedData = JSON.parse(data.choices?.[0]?.message?.content || '{}');
      const processedText = (parsedData.description || selectedMessage.message_text).replace(/\*/g, '');

      setAiResult(processedText);
      
      // ✅ SÓ altera o nome do cliente se o atual for genérico ou se a IA trouxer algo muito específico e o atual estiver vazio
      const isGenericName = !editClientName || 
                            editClientName === 'Cliente WhatsApp' || 
                            editClientName === 'CLIENTE WHATSAPP' ||
                            editClientName === 'DESCONHECIDO';

      if (parsedData.clientName && parsedData.clientName !== 'Desconhecido' && isGenericName) {
        setEditClientName(parsedData.clientName.replace(/["']/g, '').toUpperCase());
      }

      toast.success(mode === 'creative' ? '✨ Criatividade em ação!' : '✨ Ofertas organizadas!');
    } catch (err: any) {
      console.error('Erro na IA:', err);
      setAiResult(selectedMessage.message_text);
      toast.error('IA indisponível. Usando texto original.');
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
      if (isSequencia) finalText = `✅ SEQUÊNCIA ✅\n\n${finalText}`;

      const selectedClient = calendarClients.find(c => c.id === selectedCalendarClientId);

      addKanbanCard({
        clientName: editClientName.trim() || 'Cliente WhatsApp',
        calendarClientId: selectedCalendarClientId || undefined,
        calendarClientName: selectedClient?.name || undefined,
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
          description: 'Card criado via Caixa de Entrada do WhatsApp',
          createdAt: new Date().toISOString(),
        }],
      });

      await (supabase as any).from('whatsapp_inbox').update({ status: 'processed' }).eq('id', selectedMessage.id);
      setMessages(prev => prev.filter(m => m.id !== selectedMessage.id));
      setShowSendDialog(false);
      setSelectedMessage(null);
      setAiResult('');
      toast.success('✅ Card criado no Kanban com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao enviar para o Kanban.');
    } finally {
      setProcessingId(null);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
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
      const text = (msg.message_text || '').toLowerCase();
      if (mime.includes('excel') || mime.includes('spreadsheet') || mime.includes('sheet') || text.includes('.xlsx') || text.includes('.xls'))
        return <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />;
      if (mime.includes('word') || mime.includes('officedocument.wordprocessingml') || text.includes('.docx') || text.includes('.doc'))
        return <FileCode className="w-3.5 h-3.5 text-blue-500" />;
      return <FileText className="w-3.5 h-3.5 text-amber-500" />;
    }
    if (msg.message_type === 'audio') return <Clock className="w-3.5 h-3.5" />;
    return <MessageSquare className="w-3.5 h-3.5" />;
  };

  const getFilteredMessages = () => {
    if (!filterActive) return messages;
    return messages.filter(msg => {
      if (msg.media_url || msg.message_type !== 'text') return true;
      const text = (msg.message_text || '').trim();
      if (!text) return false;
      const hasPrices = /\d+[,.]\d{2}/i.test(text);
      const hasForceKeywords = ['oferta', 'promo', 'encarte', 'kg', 'unidade', 'unid', 'litro', 'grama'].some(k => text.toLowerCase().includes(k));
      return hasPrices || hasForceKeywords;
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
            <h1 className="text-2xl md:text-4xl font-black text-white tracking-tighter uppercase leading-none">Caixa de Entrada</h1>
            <p className="text-[10px] text-white/30 mt-2 uppercase tracking-[0.2em] font-bold">Mensagens do WhatsApp · Triagem Manual</p>
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
            <Button variant="ghost" onClick={handleRefresh} disabled={refreshing} className="h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-white/50 hover:text-white text-xs font-bold">
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button variant="destructive" onClick={() => setShowClearConfirm(true)} className="h-10 px-4 rounded-xl text-xs font-bold">
              <Trash2 className="w-4 h-4 mr-2" /> Limpar Tudo
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
        {messages.length === 0 && (
          <div className="glass-card p-16 text-center max-w-lg mx-auto border-dashed border-white/10 mt-10">
            <div className="w-20 h-20 rounded-full bg-green-500/5 flex items-center justify-center mx-auto mb-6">
              <MessageSquare className="w-10 h-10 text-green-500/30" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Caixa Vazia</h3>
            <p className="text-white/40 text-sm max-w-[300px] mx-auto">Nenhuma mensagem pendente. Novas mensagens aparecerão aqui automaticamente.</p>
          </div>
        )}

        <div className="space-y-3">
          {getFilteredMessages().map((msg, i) => (
            <InboxMessageCard 
              key={msg.id}
              msg={msg}
              idx={i}
              onOpenSend={handleOpenSend}
              onDismiss={handleDismiss}
              onExtract={(m) => {
                setExtractTargetMsg(m);
                setExtractMode(null);
              }}
              extractingId={extractingId}
              formatTime={formatTime}
              getTypeIcon={getTypeIcon}
              getTypeLabel={getTypeLabel}
              isExcelOrWord={isExcelOrWord}
            />
          ))}
        </div>
      </main>

      {/* Dialog: Enviar ao Kanban */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent className="bg-[#121214] border-white/10 text-white max-w-4xl p-0 rounded-2xl overflow-hidden shadow-2xl h-[90vh] sm:h-[80vh]">
          <div className="flex h-full min-h-0">
            <div className="flex-1 flex flex-col min-w-0">
              <DialogHeader className="p-6 pb-0">
                <DialogTitle className="text-xl font-black tracking-tighter flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                    <Send className="w-5 h-5 text-green-400" />
                  </div>
                  Enviar para o Kanban
                </DialogTitle>
                <DialogDescription className="sr-only">Formulário para transformar mensagem do WhatsApp em card no Kanban.</DialogDescription>
              </DialogHeader>

              {selectedMessage && (
                <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Mensagem Original</label>
                    <div className="bg-white/5 rounded-xl p-4 border border-white/5 max-h-32 overflow-y-auto custom-scrollbar">
                      <p className="text-sm text-white/60 whitespace-pre-wrap leading-relaxed">
                        {selectedMessage.message_text || `[${getTypeLabel(selectedMessage.message_type)}]`}
                      </p>
                    </div>
                  </div>

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

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest ml-1">Cliente Vinculado</label>
                    <Select value={selectedCalendarClientId} onValueChange={setSelectedCalendarClientId}>
                      <SelectTrigger className="bg-white/5 border-white/10 h-11 rounded-xl">
                        <SelectValue placeholder="Selecione o cliente" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#252528] border-white/10 text-white rounded-xl">
                        {calendarClients.map(client => (
                          <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

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
                      value={aiResult}
                      onChange={e => setAiResult(e.target.value)}
                      placeholder="A descrição aparecerá aqui. Use os botões de IA ou edite manualmente."
                      className="bg-white/5 border-white/10 rounded-xl min-h-[120px] text-white leading-relaxed p-4 resize-none text-sm placeholder:text-white/20"
                    />
                  </div>

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

            {/* Guia de Clientes */}
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

      {/* Confirmação limpar tudo */}
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent className="bg-[#1C1C1E] border-white/10 text-white rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar toda a caixa?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/50 text-[13px]">
              Deseja descartar todas as {messages.length} mensagens pendentes? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-none">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleClearAll}>Sim, limpar tudo</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal: Escolher modo de extração */}
      <Dialog open={!!extractTargetMsg && extractMode === null} onOpenChange={(open) => { if (!open) setExtractTargetMsg(null); }}>
        <DialogContent className="bg-[#121214] border-white/10 text-white max-w-sm rounded-2xl p-0 overflow-hidden">
          <div className="p-6 border-b border-white/5">
            <DialogTitle className="text-base font-black uppercase tracking-widest flex items-center gap-3">
              <Package className="w-5 h-5 text-emerald-400" />
              Como extrair a planilha?
            </DialogTitle>
            <DialogDescription className="text-white/40 text-xs mt-1">
              Escolha como os produtos devem ser organizados na descrição do card.
            </DialogDescription>
          </div>
          <div className="p-4 space-y-3">
            <button
              onClick={() => {
                setExtractMode('order');
                if (extractTargetMsg) handleExtractFile(extractTargetMsg, 'order');
              }}
              className="w-full flex items-start gap-4 p-4 rounded-xl bg-white/5 hover:bg-emerald-500/10 border border-white/5 hover:border-emerald-500/20 transition-all group text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-white/5 group-hover:bg-emerald-500/10 flex items-center justify-center flex-shrink-0 text-lg">
                📋
              </div>
              <div>
                <p className="text-sm font-black text-white uppercase tracking-wide">Manter Ordem</p>
                <p className="text-[11px] text-white/40 mt-0.5 leading-relaxed">Extrai os produtos na mesma sequência da planilha, sem reorganizar.</p>
              </div>
            </button>

            <button
              onClick={() => {
                setExtractMode('sections');
                if (extractTargetMsg) handleExtractFile(extractTargetMsg, 'sections');
              }}
              className="w-full flex items-start gap-4 p-4 rounded-xl bg-white/5 hover:bg-blue-500/10 border border-white/5 hover:border-blue-500/20 transition-all group text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-white/5 group-hover:bg-blue-500/10 flex items-center justify-center flex-shrink-0 text-lg">
                🗂️
              </div>
              <div>
                <p className="text-sm font-black text-white uppercase tracking-wide">Separar por Seções</p>
                <p className="text-[11px] text-white/40 mt-0.5 leading-relaxed">Agrupa automaticamente por Carnes, Mercearia, Bebidas, Frios, etc.</p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WhatsAppInbox;
