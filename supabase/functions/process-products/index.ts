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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Get OpenAI Key
    const { data: settings } = await supabase.from('settings').select('value').eq('key', 'openai_api_key').single()
    const openAIKey = settings?.value

    if (!openAIKey) throw new Error('OpenAI Key not configured')

    // 2. Parse products list with AI
    const apiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: `Você é um especialista em catálogo de produtos. Receba uma lista de produtos e limpe os nomes para busca, removendo preços e observações irrelevantes. Retorne um JSON com a chave "items" contendo um array de objetos: { "original": string, "clean": string }.` },
          { role: 'user', content: bulkInput }
        ],
        response_format: { type: 'json_object' }
      }),
    })

    const aiData = await apiResponse.json()
    const parsedItems = JSON.parse(aiData.choices[0].message.content).items || []

    const results = []

    // 3. Search each item using fuzzy match (pg_trgm similarity)
    for (const item of parsedItems) {
      // We use rpc call to run fuzzy search if possible, or just standard search
      // For performance, let's try a direct query with similarity first
      const cleanName = item.clean
      
      const { data: matches } = await supabase.rpc('search_products_fuzzy', { 
        search_text: cleanName,
        match_threshold: 0.1 
      })

      if (matches && matches.length > 0) {
        // Take the best match
        const best = matches[0]
        results.push({
          original: item.original,
          match: best,
          found: true
        })
      } else {
        results.push({
          original: item.original,
          found: false
        })
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
