// =====================================================
// AI Correction: Gemini Flash (SISTEMA DE RESILIÊNCIA ULTRA V15)
// =====================================
// PROTEÇÃO CONTRA TRAVAMENTOS (TIMEOUT) + REPETIÇÃO AUTOMÁTICA (RETRY)
// 
// Deploy: supabase functions deploy ai-correction --no-verify-jwt
// =====================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ---- Gemini Ultra Resilient Implementation ----
async function analyzeWithGemini(card: any, geminiKey: string, providedImages: string[]): Promise<any> {
    const description = card.description || '';
    
    // VERIFICAÇÃO DE CHAVE
    if (geminiKey.trim().startsWith('sk-')) {
      throw new Error("🛑 Chave OpenAI no campo do Gemini. Altere nas Configurações.");
    }

    const contents = [{
        role: "user",
        parts: [
            { text: `Analise as imagens e a descrição técnica: ${description}. Retorne JSON com hasErrors, summary, checklist e corrections.` }
        ]
    }];

    if (providedImages && providedImages.length > 0) {
        for (const base64 of providedImages) {
            contents[0].parts.push({
                inline_data: { mime_type: "image/jpeg", data: base64 }
            } as any);
        }
    }

    const modelToTry = "gemini-flash-latest";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelToTry}:generateContent?key=${geminiKey}`;
    
    const MAX_RETRIES = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout por tentativa

        try {
            console.log(`[AUDITORIA] Tentativa ${attempt}/${MAX_RETRIES}...`);
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errTxt = await response.text();
                
                // SE FOR ERRO TEMPORÁRIO (503 OU 429), TENTA DE NOVO
                if ((response.status === 503 || response.status === 429) && attempt < MAX_RETRIES) {
                    console.warn(`[AUDITORIA] Google sobrecarregado (Erro ${response.status}). Esperando 3s...`);
                    await new Promise(r => setTimeout(r, 3000));
                    continue;
                }
                
                throw new Error(`Google AI Error ${response.status}: ${errTxt}`);
            }

            const result = await response.json();
            let textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
            const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) textResponse = jsonMatch[0];
            return JSON.parse(textResponse);

        } catch (err: any) {
            clearTimeout(timeoutId);
            lastError = err;
            
            if (err.name === 'AbortError') {
                console.warn(`[AUDITORIA] Timeout na tentativa ${attempt}.`);
                if (attempt < MAX_RETRIES) continue;
                throw new Error("A IA do Google demorou demais para responder. Tente novamente em instantes.");
            }
            
            if (attempt < MAX_RETRIES) {
                await new Promise(r => setTimeout(r, 2000));
                continue;
            }
            throw err;
        }
    }

    throw lastError || new Error("Falha desconhecida na Auditoria.");
}

// ---- Main handler ----
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
      supabase.from('settings').select('value').eq('key', 'gemini_api_key').single()
    ]);

    if (!card) throw new Error('Card não encontrado.');
    const geminiKey = settings?.value;
    if (!geminiKey) throw new Error('API Key do Gemini não cadastrada.');

    await supabase.from('kanban_cards').update({ ai_status: 'analyzing' }).eq('id', cardId);

    const analysis = await analyzeWithGemini(card, geminiKey, imagesBase64);

    await supabase.from('kanban_cards').update({
      ai_status: analysis.hasErrors ? 'issues_found' : 'approved',
      ai_report: analysis,
      column: analysis.hasErrors ? 'alteracao' : card.column
    }).eq('id', cardId);

    return new Response(JSON.stringify({ status: 'success', analysis }), { headers: corsHeaders });

  } catch (error: any) {
    console.error('[AUDITORIA ERRO]:', error.message);
    if (currentCardId) {
      await supabase.from('kanban_cards').update({ 
        ai_status: 'error', 
        ai_report: { summary: `Erro na Auditoria: ${error.message}` } 
      }).eq('id', currentCardId);
    }
    return new Response(JSON.stringify({ error: error.message }), { status: 200, headers: corsHeaders });
  }
});
