// =====================================================
// Supabase Edge Function: Process WhatsApp Message with AI
// =====================================================
// Called manually from the frontend when the user clicks
// "Melhorar com IA" on a WhatsApp inbox message.
// Uses OpenAI to enhance text, create CTA, and organize.
//
// Deploy: supabase functions deploy process-whatsapp-message
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

REGRAS:
1. Corrija ortografia e gramática
2. Organize o conteúdo de forma clara e estruturada  
3. Se houver lista de produtos com preços, organize por categorias (CARNES, FRIOS, BEBIDAS, etc.)
4. NUNCA altere preços — mantenha exatamente como recebidos
5. Se for um briefing de arte/conteúdo, crie um CTA (Call to Action) sugerido
6. Formate com emojis relevantes mas sem exagero
7. Mantenha o tom profissional
8. Se identificar o nome do cliente, destaque no início
9. Se houver datas, formate como DD/MM/YYYY

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
