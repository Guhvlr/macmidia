import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/useApp';
import { AIChatMessage, FinanceCategory } from '../types/finance-types';
import { toast } from 'sonner';

export function useFinanceAI(onEntryChanged?: () => void) {
  const { loggedUserId } = useApp();
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!loggedUserId) return;
    try {
      const { data, error } = await supabase
        .from('financial_ai_chats')
        .select('*')
        .eq('user_id', loggedUserId)
        .single();
        
      if (error && error.code !== 'PGRST116') throw error;
      
      if (data && data.messages) {
        setMessages(data.messages as AIChatMessage[]);
      }
    } catch (error) {
      console.error('Error loading AI history:', error);
    }
  }, [loggedUserId]);

  const clearHistory = async () => {
    if (!loggedUserId) return;
    try {
      const { error } = await supabase
        .from('financial_ai_chats')
        .delete()
        .eq('user_id', loggedUserId);
        
      if (error) throw error;
      setMessages([]);
      toast.success('Histórico limpo');
    } catch (error) {
      console.error('Error clearing history:', error);
      toast.error('Erro ao limpar histórico');
    }
  };

  const buildContext = async () => {
    if (!loggedUserId) return { contextStr: '', categories: [] as FinanceCategory[] };
    try {
      const date = new Date();
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
      
      // Buscar últimos lançamentos
      const { data: entriesData } = await supabase
        .from('financial_entries')
        .select('*, category:financial_categories(*)')
        .eq('user_id', loggedUserId)
        .gte('date', startOfMonth)
        .order('date', { ascending: false })
        .limit(50);

      // Buscar todas as categorias cadastradas do usuário
      const { data: categoriesData } = await supabase
        .from('financial_categories')
        .select('*')
        .eq('user_id', loggedUserId)
        .order('name');
        
      const userCategories = (categoriesData || []) as FinanceCategory[];
      const categoryNamesList = userCategories.map(c => c.name).join(', ');
      
      let entradas = 0;
      let saidas = 0;
      
      entriesData?.forEach((e: any) => {
        if (e.type === 'entrada') entradas += Number(e.amount);
        else saidas += Number(e.amount);
      });
      
      const saldo = entradas - saidas;
      const todayStr = date.toISOString().split('T')[0];
      
      let contextStr = `Você é o assistente financeiro inteligente do usuário.\n`;
      contextStr += `Data de hoje: ${todayStr} (Ano-Mês-Dia).\n`;
      contextStr += `Categorias cadastradas do usuário: [${categoryNamesList || 'Sem categorias'}]\n`;
      contextStr += `Resumo do mês atual:\n- Entradas: R$ ${entradas.toFixed(2)}\n- Saídas: R$ ${saidas.toFixed(2)}\n- Saldo: R$ ${saldo.toFixed(2)}\n\n`;
      contextStr += `Se o usuário pedir para criar, cadastrar ou adicionar uma dívida, compra, conta a pagar, despesa, salário ou entrada, você DEVE acionar 'create_financial_entry'.\n`;
      contextStr += `Se o usuário pedir para apagar, deletar, excluir ou remover uma compra, parcela ou lançamento, você DEVE acionar 'delete_financial_entry'.\n`;
      contextStr += `SE O USUÁRIO MENCIONAR CATEGORIA (ex: "categoria alimentação", "no cartão de crédito", "categoria contas"), FORMA DE PAGAMENTO (pix, boleto, dinheiro, cartão, transferência) OU PESSOA/FORNECEDOR (ex: "para Fulano", "Mercado"), EXTRAIA E PREENCHA OS PARÂMETROS CORRESPONDENTES!\n\n`;
      contextStr += `Últimos registros:\n`;
      
      entriesData?.slice(0, 20).forEach((e: any) => {
        const catName = e.category?.name || 'Sem categoria';
        contextStr += `- ID: ${e.id} | Data: ${e.date} | ${e.type === 'entrada' ? '+' : '-'} R$ ${Number(e.amount).toFixed(2)} | Descrição: ${e.description} | Categoria: ${catName} | Status: ${e.status}\n`;
      });
      
      return { contextStr, categories: userCategories };
    } catch (error) {
      console.error('Error building context:', error);
      return { contextStr: '', categories: [] };
    }
  };

  const sendMessage = async (text: string) => {
    if (!loggedUserId || !text.trim()) return;
    
    const userMessage: AIChatMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };
    
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);
    
    try {
      const { data: settings } = await (supabase as any)
        .from('settings')
        .select('value')
        .eq('key', 'openai_api_key')
        .single();
        
      if (!settings?.value) {
        throw new Error('Chave da OpenAI não configurada em Configurações.');
      }
      
      const { contextStr, categories: userCategories } = await buildContext();
      
      const apiMessages = [
        { role: 'system', content: contextStr },
        ...newMessages.slice(-10).map(m => ({ role: m.role, content: m.content }))
      ];

      const tools = [
        {
          type: 'function',
          function: {
            name: 'create_financial_entry',
            description: 'Cria um novo lançamento financeiro (simples ou parcelado). Se o usuário falar de parcelas (ex: em 12x, parcelado em 3x), envie is_recurring=true e recurring_months.',
            parameters: {
              type: 'object',
              properties: {
                description: { type: 'string', description: 'Descrição da compra, dívida ou receita (ex: Almoço, Gasolina, Salário)' },
                amount: { type: 'number', description: 'Valor numérico em Reais (R$) de CADA parcela' },
                type: { type: 'string', enum: ['entrada', 'saida'], description: 'saida para dívida/despesa, entrada para receita/salário' },
                date: { type: 'string', description: 'Data YYYY-MM-DD da primeira parcela' },
                category_name: { type: 'string', description: 'Nome da categoria' },
                payment_method: { type: 'string', enum: ['pix', 'boleto', 'cartao', 'transferencia', 'dinheiro', ''], description: 'Forma de pagamento' },
                client_name: { type: 'string', description: 'Nome da pessoa/fornecedor' },
                status: { type: 'string', enum: ['previsto', 'pago'], description: 'status' },
                is_recurring: { type: 'boolean', description: 'true se for uma compra parcelada ou despesa recorrente' },
                recurring_months: { type: 'number', description: 'Quantidade total de meses/parcelas (ex: 12)' }
              },
              required: ['description', 'amount', 'type', 'date']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'delete_financial_entry',
            description: 'Exclui um ou mais lançamentos/parcelas financeiras solicitados pelo usuário',
            parameters: {
              type: 'object',
              properties: {
                search_term: { type: 'string', description: 'Termo de busca (ex: Gasolina, Cartão)' },
                delete_all_installments: { type: 'boolean', description: 'true para excluir todas as parcelas dessa mesma compra' }
              },
              required: ['search_term']
            }
          }
        }
      ];

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.value}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: apiMessages,
          tools: tools,
          tool_choice: 'auto',
          temperature: 0.7
        })
      });
      
      if (!response.ok) throw new Error('Falha na resposta da IA');
      
      const responseData = await response.json();
      const choice = responseData.choices[0];
      const messageObj = choice.message;

      let finalResponseText = messageObj.content || '';

      if (messageObj.tool_calls && messageObj.tool_calls.length > 0) {
        for (const call of messageObj.tool_calls) {
          if (call.function.name === 'create_financial_entry') {
            const args = JSON.parse(call.function.arguments);
            
            let entryDate = args.date;
            if (!entryDate || !entryDate.includes('-')) {
              const now = new Date();
              const day = parseInt(args.date) || now.getDate();
              entryDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            }

            let categoryId: string | null = null;
            let matchedCategoryName = '';
            
            if (args.category_name) {
              const searchCat = args.category_name.trim().toLowerCase();
              const matched = userCategories.find(c => 
                c.name.toLowerCase() === searchCat || 
                c.name.toLowerCase().includes(searchCat) || 
                searchCat.includes(c.name.toLowerCase())
              );

              if (matched) {
                categoryId = matched.id;
                matchedCategoryName = matched.name;
              } else {
                const { data: newCat } = await supabase
                  .from('financial_categories')
                  .insert([{
                    user_id: loggedUserId,
                    name: args.category_name.trim(),
                    type: args.type || 'saida',
                    color: '#ef4444',
                    is_default: false
                  }])
                  .select()
                  .single();

                if (newCat) {
                  categoryId = newCat.id;
                  matchedCategoryName = newCat.name;
                }
              }
            }

            const totalMonths = args.recurring_months || 1;
            const isRecurring = !!args.is_recurring && totalMonths > 1;
            const groupId = isRecurring ? crypto.randomUUID() : null;
            const originalDueDay = parseInt(entryDate.split('-')[2], 10);
            
            const entriesToCreate = [];
            
            for (let i = 0; i < totalMonths; i++) {
               let targetDate = entryDate;
               if (i > 0) {
                 const [year, month, day] = entryDate.split('-').map(Number);
                 let nextYear = year;
                 let nextMonth = month + i;
                 while (nextMonth > 12) { nextMonth -= 12; nextYear += 1; }
                 const lastDay = new Date(nextYear, nextMonth, 0).getDate();
                 const finalDay = Math.min(originalDueDay, lastDay);
                 targetDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(finalDay).padStart(2, '0')}`;
               }
               
               let recDesc = args.description;
               if (isRecurring) recDesc += ` (${i + 1}/${totalMonths})`;

               entriesToCreate.push({
                 user_id: loggedUserId,
                 description: recDesc,
                 amount: Number(args.amount) || 0,
                 type: args.type || 'saida',
                 date: targetDate,
                 category_id: categoryId,
                 status: i === 0 ? (args.status || 'previsto') : 'previsto',
                 payment_method: args.payment_method || '',
                 client_name: args.client_name || '',
                 notes: 'Criado via Assistente IA por voz',
                 is_recurring: isRecurring,
                 recurring_months: isRecurring ? totalMonths - i : 0,
                 installment_group_id: groupId,
                 installment_number: isRecurring ? i + 1 : null,
                 installment_total: isRecurring ? totalMonths : null,
                 original_due_day: isRecurring ? originalDueDay : null
               });
            }

            const { error: insertErr } = await supabase
              .from('financial_entries')
              .insert(entriesToCreate);

            if (insertErr) {
              console.error('Error inserting from AI:', insertErr);
              toast.error('Erro ao salvar lançamento da IA');
            } else {
              let detailsStr = matchedCategoryName ? ` [Categoria: ${matchedCategoryName}]` : '';
              if (args.payment_method) detailsStr += ` [Pagamento: ${args.payment_method.toUpperCase()}]`;

              toast.success(`✨ Lançamento "${args.description}" de R$ ${args.amount}${detailsStr} criado!`);
              if (onEntryChanged) onEntryChanged();

              if (!finalResponseText) {
                finalResponseText = `✅ Criado com sucesso! Adicionei **"${args.description}"** no valor de **R$ ${Number(args.amount).toFixed(2)}** ${isRecurring ? `(Parcelado em ${totalMonths}x)` : ''} com vencimento em **${entryDate.split('-').reverse().join('/')}**.`;
              }
            }
          } else if (call.function.name === 'delete_financial_entry') {
            const args = JSON.parse(call.function.arguments);
            const term = args.search_term.trim();
            const cleanTerm = term.replace(/\(\d+\/\d+\)/, '').trim();

            let query = supabase
              .from('financial_entries')
              .delete()
              .eq('user_id', loggedUserId);

            if (args.delete_all_installments) {
              query = query.ilike('description', `%${cleanTerm}%`);
            } else {
              query = query.ilike('description', `%${term}%`);
            }

            const { data: deleted, error: delErr } = await query.select();

            if (delErr) {
              console.error('Error deleting via AI:', delErr);
              toast.error('Erro ao excluir lançamento via IA');
            } else {
              const count = deleted?.length || 0;
              toast.success(`🗑️ Excluído(s) ${count} lançamento(s) via IA!`);
              if (onEntryChanged) onEntryChanged();
              if (!finalResponseText) {
                finalResponseText = `✅ Excluí ${count} lançamento(s) correspondente(s) a **"${term}"** com sucesso!`;
              }
            }
          }
        }
      }

      if (!finalResponseText) {
        finalResponseText = 'Lançamento processado com sucesso!';
      }
      
      const aiMessage: AIChatMessage = {
        role: 'assistant',
        content: finalResponseText,
        timestamp: new Date().toISOString()
      };
      
      const updatedMessages = [...newMessages, aiMessage];
      setMessages(updatedMessages);
      
      // Persistir histórico
      const { data: existingChat } = await supabase
        .from('financial_ai_chats')
        .select('id')
        .eq('user_id', loggedUserId)
        .single();
        
      if (existingChat) {
        await supabase
          .from('financial_ai_chats')
          .update({ messages: updatedMessages as any, updated_at: new Date().toISOString() })
          .eq('id', existingChat.id);
      } else {
        await supabase
          .from('financial_ai_chats')
          .insert([{ user_id: loggedUserId, messages: updatedMessages as any }]);
      }
      
    } catch (error: any) {
      console.error('AI error:', error);
      toast.error(error.message || 'Erro ao processar mensagem');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    messages,
    isLoading,
    sendMessage,
    loadHistory,
    clearHistory
  };
}
