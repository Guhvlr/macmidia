// =====================================================
// Supabase Edge Function: AI Correction
// =====================================================
// Analisa cards no quadro de Correção usando OpenAI GPT-4o.
// Verifica texto, preços, organização e imagens.
// Gera relatório e move para Alteração se encontrar erros.
// 
// Triggered: quando card é movido para "para-correcao"
// Deploy: supabase functions deploy ai-correction
// =====================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ---- Update processing step for real-time feedback ----
async function updateStep(supabase: any, correctionId: string, step: string, status: string) {
  const { data: current } = await supabase
    .from('ai_corrections')
    .select('processing_steps')
    .eq('id', correctionId)
    .single();

  const steps = current?.processing_steps || [];
  steps.push({ step, status, timestamp: new Date().toISOString() });
  
  await supabase.from('ai_corrections').update({ 
    processing_steps: steps,
    status: status === 'error' ? 'error' : 'analyzing',
  }).eq('id', correctionId);
}

// ---- Analyze text with GPT-4o ----
async function analyzeText(description: string, clientName: string, openaiKey: string): Promise<any> {
  const systemPrompt = `Você é um revisor de conteúdo de ofertas de supermercado em português brasileiro.
Analise o texto e as imagens abaixo e retorne um JSON com:
{
  "hasErrors": boolean,
  "report": {
    "descriptionStatus": "✅ OK" | "❌ [Detalhe do erro]",
    "priceStatus": "✅ OK" | "❌ [Detalhe do erro no PREÇO citando produto]",
    "imageStatus": "✅ OK" | "❌ [Divergência entre Imagem e Texto citando produto]",
    "dateStatus": "✅ OK (Validade: DD/MM)" | "❌ Data não encontrada ou inválida"
  },
  "issues": [
    { "type": "text" | "image" | "price" | "date", "description": "detalhe" }
  ],
  "summary": "resumo geral"
}

REGRAS DE OURO:
1. SEJA ESPECÍFICO: Nunca diga 'há erros'. Diga 'O preço do Feijão na imagem (8,90) não bate com o texto (9,50)'.
2. CHECKLIST LIMPO: Se um item (como PREÇO) estiver 100% correto, retorne apenas '✅ OK'.
3. DATA: Procure no texto ou na imagem expressões como 'Válido até...', 'Ofertas de .. até ..'. Extraia a data.
4. CONFERÊNCIA: Verifique se todos os produtos listados na 'Descrição' do card estão visíveis na imagem e vice-versa. Se sobrar ou faltar algo, relate no 'imageStatus'.
5. PREÇOS: Verifique se o formato está correto (ex: R$ 10,99) e se há divergência entre arte e texto.`;

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
        { role: 'user', content: `Cliente: ${clientName}\n\nDescrição/Conteúdo:\n${description}` },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) throw new Error(`OpenAI error: ${response.status}`);
  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

// ---- Analyze images with GPT-4o Vision ----
async function analyzeImages(images: string[], clientName: string, description: string, openaiKey: string): Promise<any> {
  if (!images || images.length === 0) {
    return { hasImageIssues: false, issues: [], summary: 'Nenhuma imagem para analisar' };
  }

  // Only analyze up to 3 images to keep costs manageable
  const imagesToAnalyze = images.slice(0, 3);
  
  const imageContents = imagesToAnalyze.map((img, i) => ({
    type: 'image_url' as const,
    image_url: {
      url: img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`,
      detail: 'low' as const, // Use low detail to save costs
    },
  }));

  const systemPrompt = `Você é um analista visual de materiais de marketing de supermercado.
Analise as imagens e compare com o conteúdo descrito. Retorne JSON:
{
  "hasImageIssues": boolean,
  "issues": [
    {
      "imageIndex": 0,
      "type": "inconsistent" | "low_quality" | "wrong_product" | "missing_price" | "unreadable",
      "severity": "low" | "medium" | "high",
      "description": "descrição do problema encontrado"
    }
  ],
  "generalQuality": "good" | "acceptable" | "poor",
  "summary": "resumo em 1 frase sobre as imagens"
}

REGRAS:
- Compare produtos visíveis nas imagens com a lista descrita fornecida.
- ESSENCIAL: Se identificar inconsistências (produtos que estão na imagem mas não na lista, ou vice-versa), especifique EXATAMENTE os nomes dos produtos no campo "description". Exemplo: "A imagem contém Arroz e Feijão, mas a lista de texto não os menciona." Não seja vago. Diga exatamente o que sobra ou falta analisando nomes de produtos.
- Verifique se a qualidade geral prejudica a leitura.
- Seja conservador: só aponte problemas se tiver total certeza visual.`;

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
        { 
          role: 'user', 
          content: [
            { type: 'text', text: `Cliente: ${clientName}\nProdutos descritos: ${description.substring(0, 500)}` },
            ...imageContents,
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    console.error('Vision API error:', response.status);
    return { hasImageIssues: false, issues: [], summary: 'Erro ao analisar imagens' };
  }

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

// ---- Unified Analysis ----
async function runUnifiedAnalysis(card: any, openaiKey: string): Promise<any> {
    const images = card.images || [];
    const description = card.description || '';
    const clientName = card.clientName || 'Cliente';

    const systemPrompt = `Você é um auditor técnico de ofertas de supermercado.
Sua missão é conferir se a descrição do card (texto) bate EXATAMENTE com as imagens fornecidas.

Retorne APENAS um JSON no formato:
{
  "hasErrors": boolean,
  "report": {
    "descriptionStatus": "✅ OK" | "❌ [Erro no texto]",
    "priceStatus": "✅ OK" | "❌ [Preço divergente no produto X]",
    "imageStatus": "✅ OK" | "❌ [Produto X falta na imagem ou no texto]",
    "dateStatus": "✅ OK (Validade: DD/MM)" | "❌ Data não encontrada"
  },
  "summary": "Resumo rápido"
}

REGRAS:
- Descrição: Verifique ortografia.
- Preço: Compare o preço do texto com o da imagem. Se houver diferença, aponte o produto.
- Imagem: Todo produto no texto deve estar na imagem. Se sobrar ou faltar, aponte o nome.
- Data: Localize a validade da oferta.`;

    const messages: any[] = [
        { role: 'system', content: systemPrompt }
    ];

    const userContent: any[] = [
        { type: 'text', text: `CLIENTE: ${clientName}\nDESCRIÇÃO DO CARD:\n${description}` }
    ];

    // Add up to 3 images to analysis
    if (images.length > 0) {
        images.slice(0, 3).forEach((img: string) => {
            userContent.push({
                type: 'image_url',
                image_url: {
                    url: img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`,
                    detail: 'high'
                }
            });
        });
    }

    messages.push({ role: 'user', content: userContent });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'gpt-4o',
            messages,
            temperature: 0.1,
            response_format: { type: 'json_object' },
        }),
    });

    if (!response.ok) throw new Error(`OpenAI error: ${response.status}`);
    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
}

// ---- Main handler ----
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  try {
    const { cardId } = await req.json();
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiKey = Deno.env.get('OPENAI_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: card, error: cardError } = await supabase.from('kanban_cards').select('*').eq('id', cardId).single();
    if (cardError || !card) return new Response('Card not found', { status: 404, headers: corsHeaders });

    // Mark as analyzing
    await supabase.from('kanban_cards').update({ ai_status: 'analyzing' }).eq('id', cardId);

    // Run unified analysis
    const analysis = await runUnifiedAnalysis(card, openaiKey);

    // Update card with new report structure
    const cardUpdates: any = {
      ai_status: analysis.hasErrors ? 'issues_found' : 'approved',
      ai_report: analysis.report || analysis, // Ensure we store the report
    };

    // If critical issues, move to alteration
    if (analysis.hasErrors) {
      cardUpdates.column = 'alteracao';
      
      const history = Array.isArray(card.history) ? card.history : [];
      history.unshift({
        id: crypto.randomUUID(),
        userId: 'system',
        userName: '🤖 IA Auditora',
        actionType: 'move',
        description: `❌ Divergências encontradas: ${analysis.summary || 'Ver relatório'}`,
        createdAt: new Date().toISOString(),
      });
      cardUpdates.history = history;
    }

    await supabase.from('kanban_cards').update(cardUpdates).eq('id', cardId);

    return new Response(JSON.stringify({ status: 'success', analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Critical AI error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
