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

    // Parse the products list with AI to extract name + price cleanly
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
            { 
              role: 'system', 
              content: `Você é um motor de extração de dados para tabloides de supermercado.
Sua tarefa é extrair itens de um texto bruto de lista de produtos.
REGRAS CRÍTICAS:
1. "original" = linha bruta exatamente como recebida.
2. "display_name" = nome do produto para exibição. PRESERVE A MARCA EXATAMENTE como o usuário escreveu (ex: "Italac" deve permanecer "Italac", nunca "Itambé").
   - Remova apenas: preços (R$ 9,99), quantidades no final (kg, ml, L), traços antes de preços.
   - NÃO substitua a marca por nenhuma outra.
3. "search_name" = nome simplificado para busca de imagem no banco. Pode ser mais genérico (ex: "Leite Italac" → "Italac" ou "leite longa vida").
Retorne JSON: { "items": [{ "original": "linha bruta", "display_name": "nome exibição", "search_name": "nome busca" }] }.` 
            },
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
      // Fallback: use raw lines
      parsedItems = bulkInput.split('\n').filter((l: string) => l.trim()).map((line: string) => {
        const cleanLine = line.trim().replace(/\s*[-–—]\s*(R\$\s*)?\d+[,.]\d{2}/gi, '').replace(/\s+(R\$\s*)?\d+[,.]\d{2}/gi, '').trim();
        return {
          original: line.trim(),
          display_name: cleanLine,
          search_name: cleanLine
        }
      })
    }

    const results = []
    console.log('Iniciando Busca de Imagem (threshold baixo, apenas para foto)...');

    for (const item of parsedItems) {
      // Use a LOW threshold (0.1) to find the best matching IMAGE from the DB
      // Even if the brand is slightly different, we want to find the closest product photo.
      // The display_name is ALWAYS what the user typed — it never comes from the DB match.
      const { data: matches, error: rpcErr } = await supabase.rpc('search_products_fuzzy', { 
        search_text: item.search_name || item.display_name,
        match_threshold: 0.1
      })

      if (rpcErr) {
        console.error('Erro RPC:', rpcErr.message);
        results.push({ original: item.original, display_name: item.display_name, found: false, error: rpcErr.message });
        continue;
      }

      if (matches && matches.length > 0) {
        // found=true means we have an image match, but name comes from display_name (user's text)
        results.push({
          original: item.original,
          display_name: item.display_name, // always the user's text
          match: matches[0],               // used only for EAN and image URL
          found: true
        })
      } else {
        results.push({ original: item.original, display_name: item.display_name, found: false })
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
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
