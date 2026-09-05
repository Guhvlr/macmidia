// =====================================================
// AI Correction: Claude Sonnet (ANTHROPIC) - PROMPT V2
// =====================================================
// Deploy: supabase functions deploy ai-correction --no-verify-jwt
// =====================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function analyzeWithClaude(card: any, claudeKey: string, providedImages: string[]): Promise<any> {
  const description = card.description || '';

  const messageContent: any[] = [];

  if (providedImages && providedImages.length > 0) {
    for (const base64 of providedImages) {
      messageContent.push({
        type: "image",
        source: {
          type: "base64",
          media_type: "image/jpeg",
          data: base64,
        },
      });
    }
  }

  messageContent.push({
    type: "text",
    text: `Você é um auditor EXTREMAMENTE RIGOROSO e PRECISO de artes gráficas para supermercados.

PEDIDO DO CLIENTE (fonte da verdade absoluta):
${description}

TAREFA:
Leia com MÁXIMA ATENÇÃO cada preço visível na imagem da arte e compare com o pedido acima.

REGRAS CRÍTICAS:
1. Leia cada número com cuidado. R$9,98 é DIFERENTE de R$9,99. R$6,78 é DIFERENTE de R$6,99.
2. Se um preço na arte for DIFERENTE do pedido, mesmo que por 1 centavo, é ERRO.
3. Se um produto do pedido NÃO aparecer na arte, é ERRO.
4. Se uma imagem na arte mostrar um produto diferente do que o texto indica, é ERRO.
5. Datas: compare a data do pedido com a data visível na arte.
6. NÃO assuma que está certo. Leia o número exato que aparece na imagem.
7. Para cada produto, escreva o valor EXATO que você leu na arte e compare com o pedido.

FORMATO DE RESPOSTA — retorne SOMENTE este JSON válido, sem markdown:
{
  "hasErrors": true ou false,
  "summary": "Resumo objetivo: quantos erros encontrados e quais produtos",
  "checklist": [
    {
      "item": "Preços",
      "ok": true ou false,
      "observacao": "Liste cada produto com: nome (arte: R$X,XX vs pedido: R$X,XX). Se OK, confirme cada preço lido."
    },
    {
      "item": "Produtos",
      "ok": true ou false,
      "observacao": "Todos os produtos do pedido estão na arte? Liste os ausentes se houver."
    },
    {
      "item": "Imagens",
      "ok": true ou false,
      "observacao": "As fotos dos produtos correspondem aos produtos descritos?"
    },
    {
      "item": "Datas",
      "ok": true ou false,
      "observacao": "Data na arte vs data no pedido."
    }
  ],
  "corrections": [
    "Correção 1: descrição detalhada do que corrigir",
    "Correção 2: ..."
  ]
}`
  });

  const MAX_RETRIES = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 40000);

    try {
      console.log(`[AUDITORIA CLAUDE] Tentativa ${attempt}/${MAX_RETRIES}...`);

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': claudeKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          messages: [
            {
              role: 'user',
              content: messageContent,
            }
          ],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errTxt = await response.text();
        if ((response.status === 529 || response.status === 429) && attempt < MAX_RETRIES) {
          console.warn(`[AUDITORIA CLAUDE] Servidor ocupado (${response.status}). Aguardando 3s...`);
          await new Promise(r => setTimeout(r, 3000));
          continue;
        }
        throw new Error(`Anthropic API Error ${response.status}: ${errTxt}`);
      }

      const result = await response.json();
      let textResponse = result.content?.[0]?.text || '{}';

      textResponse = textResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) textResponse = jsonMatch[0];

      return JSON.parse(textResponse);

    } catch (err: any) {
      clearTimeout(timeoutId);
      lastError = err;

      if (err.name === 'AbortError') {
        console.warn(`[AUDITORIA CLAUDE] Timeout na tentativa ${attempt}.`);
        if (attempt < MAX_RETRIES) continue;
        throw new Error('O Claude demorou demais. Tente novamente.');
      }

      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('Falha desconhecida na Auditoria.');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  let currentCardId: string | null = null;

  try {
    const { cardId, imagesBase64 } = await req.json();
    currentCardId = cardId;

    const [{ data: card }, { data: settings }] = await Promise.all([
      supabase.from('kanban_cards').select('*').eq('id', cardId).single(),
      supabase.from('settings').select('value').eq('key', 'claude_api_key').single()
    ]);

    if (!card) throw new Error('Card não encontrado.');

    const claudeKey = settings?.value;
    if (!claudeKey) throw new Error('API Key do Claude não cadastrada nas Configurações.');

    await supabase.from('kanban_cards').update({ ai_status: 'analyzing' }).eq('id', cardId);

    const analysis = await analyzeWithClaude(card, claudeKey, imagesBase64 || []);

    await supabase.from('kanban_cards').update({
      ai_status: analysis.hasErrors ? 'issues_found' : 'approved',
      ai_report: analysis,
      column: analysis.hasErrors ? 'alteracao' : card.column
    }).eq('id', cardId);

    return new Response(JSON.stringify({ status: 'success', analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[AUDITORIA ERRO]:', error.message);
    if (currentCardId) {
      await supabase.from('kanban_cards').update({
        ai_status: 'error',
        ai_report: { summary: `Erro na Auditoria: ${error.message}` }
      }).eq('id', currentCardId);
    }
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
