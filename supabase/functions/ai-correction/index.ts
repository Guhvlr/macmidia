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
Analise o texto abaixo e retorne um JSON com:
{
  "hasErrors": boolean,
  "issues": [
    {
      "type": "spelling" | "formatting" | "price" | "organization" | "missing_info" | "mismatch",
      "severity": "low" | "medium" | "high",
      "description": "descrição curta do erro ou divergência citando NOME DO PRODUTO",
      "original": "erro encontrado"
    }
  ],
  "organizationScore": 1-10,
  "summary": "resumo geral das divergências encontradas"
}

REGRAS:
- PROIBIDO SER VAGO. Use nomes de produtos em todas as descrições de erro.
- CONFERÊNCIA IMAGEM x TEXTO: Se achar um produto na imagem que não está no texto, escreva: 'O produto [NOME] aparece na imagem mas não está na descrição'.
- PREÇOS: Se o preço na imagem for R$ 9,90 e no texto for 10,99, escreva: 'Preço divergente para o produto [NOME]: Imagem diz 9,90 e texto diz 10,99'.
- Se houver produtos no texto que não estão na imagem, cite-os.
- Verifique ortografia e formatação de preços (X,XX).
- Mantenha o tom profissional e direto.`;

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

// ---- Main handler ----
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const { cardId } = await req.json();
    
    if (!cardId) {
      return new Response(JSON.stringify({ error: 'cardId required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiKey = Deno.env.get('OPENAI_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the card
    const { data: card, error: cardError } = await supabase
      .from('kanban_cards')
      .select('*')
      .eq('id', cardId)
      .single();

    if (cardError || !card) {
      return new Response(JSON.stringify({ error: 'Card not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Delete any previous AI correction for this card to allow re-analysis
    await supabase.from('ai_corrections').delete().eq('kanban_card_id', cardId);

    // Create correction record (optional, wrapped in try-catch)
    let correctionId = null;
    try {
      const { data: correction, error: corrError } = await supabase
        .from('ai_corrections')
        .insert({
          kanban_card_id: cardId,
          status: 'analyzing',
          processing_steps: [{ step: 'Iniciando análise', status: 'in_progress', timestamp: new Date().toISOString() }],
        })
        .select()
        .single();
      
      if (!corrError && correction) {
        correctionId = correction.id;
      }
    } catch (err) {
      console.warn('ai_corrections table error (ignoring and proceeding with direct card updates):', err);
    }

    // Update card AI status
    await supabase.from('kanban_cards').update({ 
      ai_status: 'analyzing' 
    }).eq('id', cardId);

    // Step 1: Analyze description/text
    if (correctionId) await updateStep(supabase, correctionId, 'Analisando descrição', 'in_progress').catch(() => {});
    
    let textAnalysis;
    try {
      textAnalysis = await analyzeText(card.description || '', card.client_name, openaiKey);
      if (correctionId) await updateStep(supabase, correctionId, 'Descrição analisada', 'completed').catch(() => {});
    } catch (err: any) {
      console.error('Text analysis error:', err.message);
      if (correctionId) await updateStep(supabase, correctionId, 'Erro na análise de texto', 'error').catch(() => {});
      textAnalysis = { hasErrors: false, issues: [], summary: 'Não foi possível analisar o texto automaticamente.' };
    }

    // Step 3: Analyze images (only if card has images)
    let imageAnalysis = { hasImageIssues: false, issues: [], summary: 'Sem imagens' };
    const images = card.images || [];
    
    if (images.length > 0) {
      if (correctionId) await updateStep(supabase, correctionId, 'Validando imagens', 'in_progress').catch(() => {});
      try {
        imageAnalysis = await analyzeImages(images, card.client_name, card.description || '', openaiKey);
        if (correctionId) await updateStep(supabase, correctionId, 'Imagens validadas', 'completed').catch(() => {});
      } catch (err: any) {
        console.error('Image analysis error:', err.message);
        if (correctionId) await updateStep(supabase, correctionId, 'Erro na validação de imagens', 'error').catch(() => {});
        imageAnalysis = { hasImageIssues: false, issues: [], summary: 'Erro ao validar imagens, prosseguindo com texto.' };
      }
    }

    // Compile results
    const allIssues = [
      ...(textAnalysis.issues || []).map((i: any) => ({ ...i, source: 'text' })),
      ...(imageAnalysis.issues || []).map((i: any) => ({ ...i, source: 'image' })),
    ];

    const hasErrors = textAnalysis.hasErrors || imageAnalysis.hasImageIssues;
    const highSeverityIssues = allIssues.filter((i: any) => i.severity === 'high');
    const shouldMoveToAlteration = highSeverityIssues.length > 0;

    // Build report
    const report = {
      textAnalysis: {
        hasErrors: textAnalysis.hasErrors,
        summary: textAnalysis.summary,
        organizationScore: textAnalysis.organizationScore,
        issueCount: (textAnalysis.issues || []).length,
      },
      imageAnalysis: {
        hasIssues: imageAnalysis.hasImageIssues,
        summary: imageAnalysis.summary,
        issueCount: (imageAnalysis.issues || []).length,
      },
      totalIssues: allIssues.length,
      highSeverity: highSeverityIssues.length,
      recommendation: shouldMoveToAlteration ? 'MOVER_PARA_ALTERACAO' : 'MANTER_FLUXO',
      correctedDescription: textAnalysis.correctedDescription,
    };

    // Update card with report (THE MOST IMPORTANT PART)
    const cardUpdates: any = {
      ai_status: hasErrors ? 'issues_found' : 'approved',
      ai_report: report,
    };

    // If has high severity issues, move to "alteracao"
    if (shouldMoveToAlteration) {
      cardUpdates.column = 'alteracao';
      
      const currentHistory = Array.isArray(card.history) ? card.history : 
        (typeof card.history === 'string' ? JSON.parse(card.history) : []);
      
      currentHistory.unshift({
        id: crypto.randomUUID(),
        userId: 'system',
        userName: '🤖 IA de Correção',
        actionType: 'move',
        description: `Movido para "Alteração" — ${highSeverityIssues.length} problema(s) encontrado(s)`,
        createdAt: new Date().toISOString(),
      });
      
      cardUpdates.history = currentHistory;
    }

    await supabase.from('kanban_cards').update(cardUpdates).eq('id', cardId);
    
    if (correctionId) {
      await supabase.from('ai_corrections').update({
        status: 'completed',
        analysis_result: report,
        issues_found: allIssues,
        moved_to_alteration: shouldMoveToAlteration,
        completed_at: new Date().toISOString(),
      }).eq('id', correctionId).catch(() => {});
    }

    return new Response(JSON.stringify({
      status: 'success',
      hasErrors,
      issueCount: allIssues.length,
      report 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Critical AI error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200, // Return 200 even on error to let frontend handle it gracefully
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
