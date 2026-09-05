import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, Trash2, Loader2, Sparkles, Mic, MicOff } from 'lucide-react';
import { AIChatMessage } from '../types/finance-types';
import { toast } from 'sonner';

interface FinanceAIChatProps {
  isOpen: boolean;
  onClose: () => void;
  messages: AIChatMessage[];
  onSendMessage: (msg: string) => Promise<void>;
  onClearHistory: () => void;
  isLoading: boolean;
}

export function FinanceAIChat({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  onClearHistory,
  isLoading
}: FinanceAIChatProps) {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isLoading]);

  if (!isOpen) return null;

  const handleStartListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error('Navegador não suporta reconhecimento de voz direto. Digite sua mensagem.');
      return;
    }

    try {
      if (isListening && recognitionRef.current) {
        recognitionRef.current.stop();
        setIsListening(false);
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
        toast.info('🎙️ Ouvindo... Fale o seu lançamento!');
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error !== 'no-speech') {
          toast.error('Erro no reconhecimento de voz.');
        }
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInput(transcript);
          toast.success(`Entendido: "${transcript}"`);
          // Envia a mensagem automaticamente para a IA
          onSendMessage(transcript);
          setInput('');
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Mic error:', err);
      setIsListening(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const text = input;
    setInput('');
    await onSendMessage(text);
  };

  const quickQuestions = [
    'Qual é o meu saldo previsto para este mês?',
    'Quais foram minhas maiores despesas?',
    'Como posso economizar nas minhas contas fixas?',
    'Faça um resumo geral das minhas finanças'
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="w-full max-w-md bg-zinc-950 border-l border-zinc-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <Bot className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-1.5">
                Assistente Financeiro IA
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              </h2>
              <p className="text-[11px] text-zinc-400">Fale por áudio ou digite para criar lançamentos</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={onClearHistory}
                title="Limpar histórico"
                className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Chat Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-4">
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-3">
                <Bot className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-200 mb-1">Como posso te ajudar hoje?</h3>
              <p className="text-xs text-zinc-500 mb-4 max-w-xs">
                Toque no microfone 🎙️ e diga por voz o que gastou ou recebeu, ou digite abaixo.
              </p>
              <div className="w-full space-y-2 text-left">
                {quickQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => onSendMessage(q)}
                    className="w-full text-xs p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/80 text-zinc-300 transition-all text-left"
                  >
                    💡 {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-red-600 text-white rounded-br-none'
                      : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-bl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
                <span className="text-[10px] text-zinc-500 mt-1 px-1">
                  {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))
          )}

          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-zinc-400 p-3 bg-zinc-900/50 border border-zinc-800 rounded-xl w-fit">
              <Loader2 className="w-4 h-4 animate-spin text-red-500" />
              <span>Analisando e salvando...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input & Voice Bar */}
        <form onSubmit={handleSubmit} className="p-3 border-t border-zinc-800 bg-zinc-900/80">
          {isListening && (
            <div className="flex items-center justify-center gap-2 mb-2 p-2 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-semibold animate-pulse">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              Escutando sua voz... Fale agora!
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleStartListening}
              title={isListening ? 'Parar de escutar' : 'Falar por voz'}
              className={`p-2.5 rounded-xl border transition-all shrink-0 ${
                isListening 
                  ? 'bg-red-600 text-white border-red-500 animate-pulse' 
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:border-zinc-700'
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-red-400" />}
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Digite ou toque no microfone..."
              disabled={isLoading}
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-red-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="p-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:hover:bg-red-600 text-white rounded-xl transition-colors shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
