import React, { createContext, useContext, useCallback, useMemo, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useKanban } from './KanbanContext';
import { compressImage } from '@/lib/utils';

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

      toast.info('🤖 IA Auditora: Redimensionando imagens...');

      // TURBO: Resize images on client-side
      const imagesBase64: string[] = [];
      const imageUrls = card.images || [];

      if (imageUrls.length > 0) {
        for (const url of imageUrls.slice(0, 13)) {
          try {
            const resp = await fetch(url);
            const blob = await resp.blob();
            const file = new File([blob], "image.jpg", { type: "image/jpeg" });
            const resizedBase64 = await compressImage(file, 1024, 0.5);
            const base64Data = resizedBase64.split(',')[1];
            imagesBase64.push(base64Data);
          } catch (imgErr) {
            console.warn('Erro ao processar imagem para IA:', imgErr);
          }
        }
      }

      toast.info('🤖 IA Auditora: Enviando para análise...');

      const { data, error } = await supabase.functions.invoke('ai-correction', {
        body: { cardId, imagesBase64 }
      });

      if (error) throw error;
      
      const analysis = data.analysis;
      if (analysis?.hasErrors) {
        toast.warning('🤖 Auditoria: Encontrei divergências.');
      } else {
        toast.success('🤖 Auditoria: Tudo ok.');
      }
    } catch (err: any) {
      console.error('Audit Error:', err);
      toast.error(`IA Auditora: ${err.message || 'Falha no processamento'}`);
    }
  }, [kanbanCards, updateKanbanCard]);

  const fixDescriptionWithAI = useCallback(async (cardId: string, mode: 'keep_sequence' | 'organize' = 'keep_sequence') => {
    try {
      const card = kanbanCards.find(c => c.id === cardId);
      if (!card) return;
      
      toast.info(`🤖 IA: ${mode === 'organize' ? 'Organizando por setores...' : 'Corrigindo texto...'}`);

      const { data: settingsData } = await (supabase as any).from('settings').select('value').eq('key', 'openai_api_key').single();
      const apiKey = settingsData?.value;
      if (!apiKey) throw new Error('OpenAI key missing');

      const CATEGORIES_PROMPT = `SETORIZAÇÃO (Use apenas estes nomes):
━━━ CARNES ━━━
━━━ FRIOS E LATICÍNIOS ━━━
━━━ MERCEARIA ━━━
━━━ BEBIDAS ━━━
━━━ LIMPEZA ━━━
━━━ HIGIENE ━━━
━━━ HORTIFRUTI ━━━
━━━ PADARIA ━━━
━━━ CONGELADOS ━━━
━━━ PET ━━━
━━━ BAZAR ━━━
━━━ OUTROS ━━━`;

      const systemPrompt = mode === 'organize' 
        ? `Você é um assistente de produção de encartes de supermercado.
Sua tarefa é organizar a lista de produtos por setores (Categorias).
REGRAS:
1. Corrija a ortografia dos produtos (ex: "aros" -> "Arroz").
2. Formate os preços com vírgula (ex: 5.99 -> 5,99).
3. Agrupe os produtos sob os títulos de setores informados.
4. NUNCA use asteriscos (*), markdown, ou listas numeradas.
5. Retorne APENAS o texto processado. Nenhuma explicação ou comentário adicional.
6. Se o texto original já contiver informações de cabeçalho (Data, Cliente), mantenha-as no topo.

${CATEGORIES_PROMPT}`
        : `Você é um assistente de produção de encartes de supermercado.
Sua tarefa é corrigir a ortografia e formatar a lista de produtos MANTENDO A ORDEM ORIGINAL.
REGRAS:
1. Corrija a ortografia dos produtos.
2. Formate os preços com vírgula (ex: 5.99 -> 5,99).
3. MANTENHA EXATAMENTE a sequência em que os produtos aparecem.
4. NUNCA use asteriscos (*), markdown, ou listas numeradas.
5. Retorne APENAS o texto processado. Nenhuma explicação ou comentário adicional.
6. Se o texto original tiver informações de cabeçalho (Data, Cliente), mantenha-as no topo.`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: card.description }
          ],
          temperature: 0.1, // Maiores chances de seguir instruções rígidas
        }),
      });

      if (!response.ok) throw new Error('GPT Error');
      const data = await response.json();
      let fixedText = data.choices[0].message.content.trim();
      
      // Cleanup for safety
      fixedText = fixedText.replace(/\*/g, '').replace(/###/g, '');

      await updateKanbanCard(cardId, { description: fixedText }, `IA: ${mode === 'organize' ? 'Organizou por categorias' : 'Refinou mantendo ordem'}`);
      toast.success('✨ Descrição atualizada com sucesso!');
    } catch (err: any) {
      console.error(err);
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
            { role: 'system', content: "Você é um assistente de produção de encartes. Retorne APENAS o texto final, sem comentários ou explicações." },
            { role: 'user', content: `COMANDO: ${userPrompt}\n\nTEXTO ATUAL:\n${card.description}` }
          ],
          temperature: 0.3,
        }),
      });
      if (!response.ok) throw new Error('AI Error');
      const data = await response.json();
      const result = data.choices[0].message.content.trim().replace(/\*/g, '');
      await updateKanbanCard(cardId, { description: result }, `IA: Comando "${userPrompt.substring(0, 30)}..."`);
      toast.success('🤖 IA: Alteração concluída!');
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
