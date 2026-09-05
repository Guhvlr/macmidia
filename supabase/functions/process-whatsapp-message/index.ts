// =====================================================
// Supabase Edge Function: Process WhatsApp Message with AI
// =====================================================
// RESTORED FROM GITHUB (macmidia-main)
// Uses OpenAI to enhance text, create CTA, and organize.
//
// Deploy: supabase functions deploy process-whatsapp-message --no-verify-jwt
// =====================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { messageText, messageType, senderName } = await req.json();

    if (!messageText || messageText.trim().length === 0) {
      return new Response(JSON.stringify({ processedText: '' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      // Fallback: just return formatted original text
      return new Response(JSON.stringify({ 
        processedText: messageText,
        warning: 'OPENAI_API_KEY not configured' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `Você é um assistente de marketing para uma agência de produção de mídia.

Sua tarefa é receber uma mensagem bruta do WhatsApp (que pode ser um pedido de oferta de supermercado, pedido de arte, ou briefing de conteúdo) e transformá-la em uma DESCRIÇÃO PROFISSIONAL para um card de produção no Kanban.

REGRAS DE OURO:
1. REMOVA CÓDIGOS DE BARRAS: Qualquer sequência de 8 ou mais dígitos puros (como 7891020304050, 00000000) deve ser COMPLETAMENTE REMOVIDA.
2. PRESERVE PREÇOS: NUNCA remova números que acompanhem "R$", ou que tenham formato de preço (ex: 5,99, 10.50, 1.200,00). Preços são sagrados.
3. PADRONIZAÇÃO: Formate os produtos como "NOME DO PRODUTO (e unidade) - R$ PREÇO" (um por linha).
4. LIMPEZA: Remova códigos internos, referências de sistema e sujeiras no início de cada linha.

REGRAS GERAIS:
- Corrija ortografia e gramática.
- Organize o conteúdo de forma clara e estruturada, agrupando itens por categoria (CARNES, FRIOS, etc.) se houver muitos.
- Se for um briefing de arte, crie um CTA (Call to Action) sugerido.
- Formate com emojis relevantes sem exagero.
- Destaque o nome do cliente no início.

EXEMPLO DE COMPORTAMENTO:
Entrada: "7891020304050 Arroz Tio João 5kg R$ 25,90"
Saída: "Arroz Tio João 5kg - R$ 25,90"

Retorne APENAS o texto processado, pronto para ser usado como descrição do card.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Remetente: ${senderName || 'Desconhecido'}\nTipo: ${messageType || 'text'}\n\nMensagem:\n${messageText}` },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('OpenAI error:', err);
      return new Response(JSON.stringify({ 
        processedText: messageText,
        error: `OpenAI error: ${response.status}` 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const processedText = data.choices?.[0]?.message?.content || messageText;

    return new Response(JSON.stringify({ processedText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Processing error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
