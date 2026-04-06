import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { bulkInput } = await req.json()
    console.log('--- Início da Função ---');
    console.log('Input:', bulkInput);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let openAIKey = Deno.env.get('OPENAI_API_KEY')
    if (!openAIKey) {
       console.log('Buscando chave no DB...');
       const { data: s } = await supabase.from('settings').select('value').eq('key', 'openai_api_key').single()
       openAIKey = s?.value
    }

    if (!openAIKey) throw new Error('OpenAI Key não configurada. Use: npx supabase secrets set OPENAI_API_KEY=...');

    // 2. Parse products list with AI
    let parsedItems = []
    try {
      console.log('Chamando OpenAI...');
      const apiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: `Você é um catálogo. Extraia os itens e limpe os nomes. Retorne JSON: { "items": [{ "original": "...", "clean": "..." }] }.` },
            { role: 'user', content: bulkInput }
          ],
          response_format: { type: 'json_object' }
        }),
      })

      const aiData = await apiResponse.json()
      if (aiData.error) throw new Error('Erro OpenAI: ' + aiData.error.message);
      
      const aiText = aiData.choices[0].message.content
      parsedItems = JSON.parse(aiText).items || []
      console.log('IA processou com sucesso:', parsedItems.length, 'itens');
    } catch (aiErr) {
      console.error('IA FALHOU, fallback para nomes originais:', aiErr.message);
      // Fallback: usar as linhas como nomes originais se a IA falhar
      parsedItems = bulkInput.split('\n').filter((l: string) => l.trim()).map((line: string) => ({
        original: line.trim(),
        clean: line.trim().replace(/[0-9,.]+$/g, '').trim() // Remove números/preços básicos do final
      }))
    }

    const results = []
    console.log('Iniciando Busca Fuzzy...');

    for (const item of parsedItems) {
      const { data: matches, error: rpcErr } = await supabase.rpc('search_products_fuzzy', { 
        search_text: item.clean,
        match_threshold: 0.1 
      })

      if (rpcErr) {
        console.error('Erro RPC:', rpcErr.message);
        results.push({ original: item.original, found: false, error: rpcErr.message });
        continue;
      }

      if (matches && matches.length > 0) {
        results.push({
          original: item.original,
          match: matches[0],
          found: true
        })
      } else {
        results.push({ original: item.original, found: false })
      }
    }

    console.log('--- Fim da Função (Sucesso) ---');
    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error('--- ERRO CRÍTICO ---');
    console.error(error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200, // Retornamos 200 mesmo no erro para o frontend capturar o JSON do erro
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
