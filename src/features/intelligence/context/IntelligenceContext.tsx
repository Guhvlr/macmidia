import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export type LogType = 'alert' | 'correction' | 'insight' | 'observation';

export interface IntelligenceEvent {
  id: string;
  type: LogType;
  message: string;
  user: string;
  timestamp: number;
  module: string;
}

interface IntelligenceContextData {
  logs: IntelligenceEvent[];
  isActive: boolean;
  setIsActive: (active: boolean) => void;
  trackEvent: (type: LogType, module: string, message: string) => void;
  clearLogs: () => void;
}

const IntelligenceContext = createContext<IntelligenceContextData>({} as IntelligenceContextData);

export const IntelligenceProvider = ({ children }: { children: React.ReactNode }) => {
  const { loggedUserEmail } = useAuth();
  const fallbackUser = loggedUserEmail ? loggedUserEmail.split('@')[0] : 'Sistema';

  // Read active mode from a globally synced setting if possible, but for now localStorage is fine for the admin switch.
  // Actually we could save the active flag in the Supabase 'settings' table, but local is okay for now.
  const [isActive, setIsActiveState] = useState(() => {
    return localStorage.getItem('macmidia_agent_active') === 'true';
  });

  const [logs, setLogs] = useState<IntelligenceEvent[]>([]);

  // Carregar os logs da base de dados e ouvir mudanças
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const { data, error } = await supabase
          .from('intelligence_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(500);

        if (!error && data) {
          const parsedLogs: IntelligenceEvent[] = data.map(row => ({
            id: row.id,
            type: row.type as LogType,
            message: row.message,
            user: row.user_name,
            module: row.module,
            timestamp: new Date(row.created_at).getTime()
          }));
          setLogs(parsedLogs);
        }
      } catch (err) {
        console.error('Erro ao buscar logs da inteligência', err);
      }
    };

    fetchLogs();

    // Subscribe para tempo real
    const channel = supabase
      .channel('intelligence_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'intelligence_logs' },
        (payload) => {
          const row = payload.new as any;
          const novoLog: IntelligenceEvent = {
            id: row.id,
            type: row.type as LogType,
            message: row.message,
            user: row.user_name,
            module: row.module,
            timestamp: new Date(row.created_at).getTime()
          };
          setLogs(prev => [novoLog, ...prev].slice(0, 500));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const setIsActive = (active: boolean) => {
    setIsActiveState(active);
    localStorage.setItem('macmidia_agent_active', String(active));
    
    trackEvent('insight', 'intelligence', `Agente Sentinela foi ${active ? 'ATIVADO (Fase 3)' : 'DESATIVADO (Fase 1)'} pelo Administrador.`);
  };

  const trackEvent = useCallback(async (type: LogType, module: string, message: string) => {
    const localUser = fallbackUser;
    
    // Fake id e timer para preview imediato na tela (Optimitic Update)
    const tempId = Math.random().toString(36).substr(2, 9);
    const newLog: IntelligenceEvent = {
      id: tempId,
      type,
      message,
      user: localUser,
      timestamp: Date.now(),
      module,
    };

    // Atualiza local primeiro para percepção de velociadade
    setLogs((prev) => [newLog, ...prev].slice(0, 500));

    // Envia para o Supabase no background
    try {
      await supabase.from('intelligence_logs').insert({
        type,
        message,
        user_name: localUser,
        module
      });
    } catch (e) {
      console.error('Erro ao salvar log de inteligência', e);
    }
  }, [fallbackUser]);

  const clearLogs = async () => {
    try {
      await supabase.from('intelligence_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Limpa tudo
      setLogs([]);
    } catch (e) {
      console.error('Erro ao limpar logs', e);
    }
  };

  return (
    <IntelligenceContext.Provider value={{ logs, isActive, setIsActive, trackEvent, clearLogs }}>
      {children}
    </IntelligenceContext.Provider>
  );
};

export const useIntelligence = () => {
  const context = useContext(IntelligenceContext);
  if (!context) {
    throw new Error('useIntelligence must be used within an IntelligenceProvider');
  }
  return context;
};
