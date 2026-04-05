import React, { createContext, useContext, useCallback, useMemo, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useKanban } from './KanbanContext';

interface AutomationContextType {
  triggerAICorrection: (cardId: string) => Promise<void>;
  fixDescriptionWithAI: (cardId: string, mode?: 'keep_sequence' | 'organize') => Promise<void>;
  customAICommand: (cardId: string, userPrompt: string) => Promise<void>;
}

const AutomationContext = createContext<AutomationContextType | undefined>(undefined);

export function AutomationProvider({ children }: { children: ReactNode }) {
  const { kanbanCards, updateKanbanCard } = useKanban();

  const triggerAICorrection = useCallback(async (cardId: string) => {
    try {
      const card = kanbanCards.find(c => c.id === cardId);
      if (!card) return;

      toast.info('🤖 IA Auditora: Conferindo imagens...');

      const { data: settingsData } = await (supabase as any).from('settings').select('value').eq('key', 'openai_api_key').single();
      const apiKey = settingsData?.value;
      if (!apiKey) throw new Error('OpenAI key missing');

      const images = card.images || [];
      const userContent: any[] = [
        { type: 'text', text: `CLIENTE: ${card.clientName}\nDESCRIÇÃO DO CARD:\n${card.description}\n\nAnalise as imagens comparando com este texto.` }
      ];
      if (images.length > 0) {
        images.slice(0, 10).forEach((img: string) => {
          let finalUrl = img;
          if (!img.startsWith('http') && !img.startsWith('data:')) finalUrl = `data:image/jpeg;base64,${img}`;
          userContent.push({ type: 'image_url', image_url: { url: finalUrl, detail: 'high' } });
        });
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { 
              role: 'system', 
              content: `Você é o AGENTE DE CONFERÊNCIA PROFISSIONAL DE ENCARTE DE SUPERMERCADO da Agência MAC MIDIA, com tolerância zero a erros. Sua missão é atuar como um auditor técnico extremamente rigoroso, detalhista e sistemático.
              Relate erros em formato JSON com hasErrors:boolean e summary:string.` 
            },
            { role: 'user', content: userContent }
          ],
          temperature: 0,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) throw new Error(`OpenAI error: ${response.status}`);
      const aiResponse = await response.json();
      const analysis = JSON.parse(aiResponse.choices[0].message.content);

      const cardUpdates: any = {
        aiStatus: analysis.hasErrors ? 'issues_found' : 'approved',
        aiReport: analysis,
      };

      if (analysis.hasErrors) {
        cardUpdates.column = 'alteracao';
        if (!card.description.includes('⚠️ AUDITORIA IA')) {
          const issues = (analysis.checklist || []).filter((item: any) => item.status === '❌').map((item: any) => `${item.item}: ${item.observation}`);
          cardUpdates.description = `⚠️ AUDITORIA IA: ${issues.join(' | ')}\n----------------------------------\n` + (card.description || '');
        }
      }

      await updateKanbanCard(cardId, cardUpdates, analysis.hasErrors ? `❌ ERRO DETECTADO: ${analysis.summary}` : `✅ IA: Auditado com sucesso`);
      if (analysis.hasErrors) toast.warning('🤖 Auditoria: Encontrei divergências.');
      else toast.success('🤖 Auditoria: Tudo ok.');
    } catch (err: any) {
      console.error(err);
      toast.error(`IA Auditora: ${err.message || 'Erro desconhecido'}`);
    }
  }, [kanbanCards, updateKanbanCard]);

  const fixDescriptionWithAI = useCallback(async (cardId: string, mode: 'keep_sequence' | 'organize' = 'keep_sequence') => {
    try {
      const card = kanbanCards.find(c => c.id === cardId);
      if (!card) return;
      toast.info('🤖 Refinando descrição...');

      const { data: settingsData } = await (supabase as any).from('settings').select('value').eq('key', 'openai_api_key').single();
      const apiKey = settingsData?.value;
      if (!apiKey) throw new Error('OpenAI key missing');

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: "Você é um auditor ortográfico SÊNIOR." },
            { role: 'user', content: card.description }
          ],
          temperature: 0.2,
        }),
      });

      if (!response.ok) throw new Error('GPT Error');
      const data = await response.json();
      const fixedText = data.choices[0].message.content.replace(/\*/g, '');
      await updateKanbanCard(cardId, { description: fixedText }, `IA: ${mode === 'organize' ? 'Organizou por categorias' : 'Refinou mantendo ordem'}`);
      toast.success('✨ Descrição atualizada!');
    } catch (err: any) {
      toast.error('Erro ao refinar descrição.');
    }
  }, [kanbanCards, updateKanbanCard]);

  const customAICommand = useCallback(async (cardId: string, userPrompt: string) => {
    try {
      const card = kanbanCards.find(c => c.id === cardId);
      if (!card) return;
      toast.info('🤖 IA Processando comando...');
      const { data: settingsData } = await (supabase as any).from('settings').select('value').eq('key', 'openai_api_key').single();
      const apiKey = settingsData?.value;
      if (!apiKey) throw new Error('OpenAI key missing');
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: "Você é um assistente de produção de encartes de supermercado." },
            { role: 'user', content: `COMANDO DO USUÁRIO: ${userPrompt}\n\nDESCRIÇÃO ATUAL:\n${card.description}` }
          ],
        }),
      });
      if (!response.ok) throw new Error('AI Error');
      const data = await response.json();
      const result = data.choices[0].message.content;
      await updateKanbanCard(cardId, { description: result }, `IA: Executou comando "${userPrompt.substring(0, 30)}..."`);
      toast.success('🤖 Comando IA concluído!');
    } catch (err: any) {
      toast.error('Erro ao processar comando IA.');
    }
  }, [kanbanCards, updateKanbanCard]);

  const value = useMemo(() => ({ triggerAICorrection, fixDescriptionWithAI, customAICommand }), [triggerAICorrection, fixDescriptionWithAI, customAICommand]);

  return <AutomationContext.Provider value={value}>{children}</AutomationContext.Provider>;
}

export function useAutomation() {
  const context = useContext(AutomationContext);
  if (context === undefined) throw new Error('useAutomation must be used within an AutomationProvider');
  return context;
}
