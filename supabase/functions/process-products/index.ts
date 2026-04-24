// =====================================================
// Process Products V2 — Dual-Mode Search Engine
// =====================================================
// Mode 1: DESCRIPTION + PRICE → fuzzy search + confidence
// Mode 2: BARCODE + PRICE    → exact EAN lookup
// =====================================================
// Deploy: supabase functions deploy process-products --no-verify-jwt
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─────────────────────────────────────────────
// Normalize strings: remove accents, lowercase
// ─────────────────────────────────────────────
function normalize(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

// ─────────────────────────────────────────────
// Remove common units from search text to help trigrams
// ─────────────────────────────────────────────
function stripUnits(s: string): string {
  return s
    .replace(/\d+([.,]\d+)?\s*(kg|g|mg|ml|l|lt|un|cx|fd|pct|unid|uni)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─────────────────────────────────────────────
// Word-level overlap ratio between two strings
// ─────────────────────────────────────────────
function wordOverlap(input: string, match: string): number {
  const wordsA = normalize(input).split(/\s+/).filter(w => w.length > 1);
  const wordsB = normalize(match).split(/\s+/).filter(w => w.length > 1);

  if (wordsA.length === 0 || wordsB.length === 0) return 0;

  let hits = 0;
  for (const wa of wordsA) {
    for (const wb of wordsB) {
      if (wa === wb || (wa.length >= 3 && wb.includes(wa)) || (wb.length >= 3 && wa.includes(wb))) {
        hits++;
        break;
      }
    }
  }
  return hits / Math.max(wordsA.length, wordsB.length);
}

// ─────────────────────────────────────────────────────
// Confidence assessment for DESCRIPTION mode matches
// ─────────────────────────────────────────────────────
function assessConfidence(
  brandHint: string,
  typeHint: string,
  displayName: string,
  matchName: string,
  matchBrand: string
): { level: string; reason: string } {
  const normBrand = normalize(brandHint);
  const normType = normalize(typeHint);
  const normMatchName = normalize(matchName);
  const normMatchBrand = normalize(matchBrand || '');

  // Brand check
  let brandMatch = false;
  if (normBrand && normBrand.length >= 2) {
    brandMatch = normMatchName.includes(normBrand) || normMatchBrand.includes(normBrand);
  }

  // Type check
  let typeMatch = false;
  if (normType && normType.length >= 2) {
    typeMatch = normMatchName.includes(normType);
  }

  // Word overlap between user input and DB match
  const overlap = wordOverlap(displayName, matchName);

  // REJEIÇÃO 1: Conflito claro de marca.
  // Se a IA extraiu uma marca e o banco de dados tem uma marca cadastrada, e elas não correspondem: Risco Altíssimo.
  const hasBrandConflict = !brandMatch && normBrand.length >= 2 && normMatchBrand.length >= 2;
  if (hasBrandConflict) {
    return { level: 'low', reason: `Conflito de marcas: Solicitado '${brandHint}', encontrado '${matchBrand}'` };
  }

  // REJEIÇÃO 2: Marca exigida mas ignorada.
  // Se a IA exigiu uma marca, o banco não tinha campo marca cadastrada, e a marca não aparece nem no nome do produto:
  if (!brandMatch && normBrand.length >= 2) {
    // Reduzimos o rigor: se houver 65% de overlap, aceitamos como Médio
    if (overlap >= 0.65) {
      return { level: 'medium', reason: 'Boa similaridade de texto superou ausência da marca no nome' };
    }
    return { level: 'low', reason: `Marca '${brandHint}' não localizada no nome do produto (Overlap: ${(overlap * 100).toFixed(0)}%)` };
  }

  // ── HIGH: brand + (type OR strong overlap) ──
  if (brandMatch && (typeMatch || overlap >= 0.35)) {
    return { level: 'high', reason: 'Marca e descritor principal batem com o banco' };
  }

  // ── MEDIUM: brand only, or high overlap without brand ──
  if (brandMatch) {
    return { level: 'medium', reason: 'Marca exata encontrada no nome do produto' };
  }
  
  // Se nenhuma marca foi citada pela IA e pelo input, exigimos um parentesco maior nas palavras
  // Reduzido para 0.45 para ser mais inclusivo
  if (overlap >= 0.45) {
    return { level: 'medium', reason: 'Similaridade de texto aceitável' };
  }

  // ── LOW ──
  // Reduzido drasticamente para capturar quase qualquer coisa similar como um candidato
  // Se bater pelo menos uma palavra chave importante (Arroz, Feijão, etc), o overlap será > 0
  if (overlap >= 0.10) {
    return { level: 'low', reason: `Vínculo automático sugerido (Similaridade: ${(overlap * 100).toFixed(0)}%)` };
  }

  return { level: 'none', reason: 'Nenhuma correspondência similar encontrada no banco' };
}

// ═══════════════════════════════════════════════
// MAIN SERVER
// ═══════════════════════════════════════════════
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { bulkInput } = await req.json()
    console.log('--- Process Products V2 ---');

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }


    // Get Claude key
    let claudeKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!claudeKey) {
      const { data: s } = await supabase.from('settings').select('value').eq('key', 'claude_api_key').single()
      claudeKey = s?.value
    }
    if (!claudeKey) throw new Error('Claude API Key não configurada.');

    // ─── STEP 1: Parse input with AI ────────────────────
    let parsedItems: any[] = [];

    try {
      const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': claudeKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 4096,
          system: `Você é um parser de listas de compras.
Analise CADA linha e retorne o JSON com o array "items".

Para cada linha, extraia:
1. "mode": "barcode" (se a linha começar com de 12 a 14 dígitos numéricos) ou "description" (caso contrário).
2. "barcode": o código de barras numérico (se houver). Se não houver, null.
3. "price": o preço final na linha (ex: "47,99"). Em português os preços usam vírgula para os centavos (ex: 5,99 ou 10,50). Pode ou não ter R$ na frente. Pode estar colado em unidades como "kg" ou "cada" (ex: "15,99kg" -> extraia apenas "15,99"). Se não achar preço, retorne null.
4. "display_name": para o modo "description", o NOME EXATO do produto como o usuário digitou, MAS SEM O PREÇO. Mantenha a formatação original e as unidades do nome (ex: "Alcatra kg"). Para modo "barcode", retorne null.
5. "search_name": uma versão mais limpa do nome, apenas palavras chave para ajudar na busca (apenas description).
6. "brand_hint": a marca, se identificada (apenas description).
7. "type_hint": a categoria ou tipo básico (apenas description).

Exemplos de extração:
Entrada: "Alcatra-47,99  kg"
Saída: { "mode": "description", "barcode": null, "price": "47,99", "display_name": "Alcatra kg", "search_name": "Alcatra", "brand_hint": null, "type_hint": "carne" }

Entrada: "0000000011136  15,99kg"
Saída: { "mode": "barcode", "barcode": "0000000011136", "price": "15,99", "display_name": null, "search_name": null, "brand_hint": null, "type_hint": null }

Entrada: "Costela ripa-19,99kg"
Saída: { "mode": "description", "barcode": null, "price": "19,99", "display_name": "Costela ripa kg", "search_name": "Costela ripa", "brand_hint": null, "type_hint": "carne" }

Retorne APENAS o JSON no formato: { "items": [...] }`,
          messages: [
            { role: 'user', content: bulkInput }
          ],
        }),
      });

      const aiData = await apiResponse.json();
      if (!apiResponse.ok) throw new Error('Anthropic Error: ' + (aiData.error?.message || apiResponse.statusText));
      
      let textContent = aiData.content?.[0]?.text || '{}';
      
      // Robust JSON extraction: Find the first { and last }
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        textContent = jsonMatch[0];
      }
      
      const parsedJson = JSON.parse(textContent);
      parsedItems = parsedJson.items || [];
      console.log('Claude parsed:', parsedItems.length, 'items');
    } catch (aiErr: any) {

      console.error('AI parse failed, using fallback:', aiErr.message);
      // ── FALLBACK: parse without AI ──
      parsedItems = bulkInput.split('\n').filter((l: string) => l.trim()).map((line: string) => {
        const trimmed = line.trim();
        const isBarcode = /^\d{12,14}\b/.test(trimmed);
        
        // Pega todos os números formatados como preço (tolerante a sufixos colados)
        const priceMatches = [...trimmed.matchAll(/(?:R\$\s*)?(\d+[,.]\d{2})/gi)];
        // Prioriza o último match como preço
        const price = priceMatches.length > 0 ? priceMatches[priceMatches.length - 1][1] : null;

        // Limpa apenas a ocorrência que virou o preço (tolerando unidades após ele)
        let cleanName = trimmed;
        if (price) {
          const priceRegex = new RegExp(`\\s*[-–—|]?\\s*(?:R\\$\\s*)?${price.replace('.', '\\.')}(?:\\s*(?:KG|G|MG|ML|L|LT|UN|CX|FD|PCT|CADA)\\b)?\\s*$`, 'i');
          cleanName = cleanName.replace(priceRegex, '').trim();
        }

        if (isBarcode) {
          const barcodeMatch = trimmed.match(/^(\d{13})/);
          return {
            original: trimmed, mode: 'barcode',
            barcode: barcodeMatch ? barcodeMatch[1] : trimmed,
            display_name: null, search_name: null,
            brand_hint: null, type_hint: null, price,
          };
        }
        return {
          original: trimmed, mode: 'description',
          barcode: null,
          display_name: cleanName, search_name: cleanName,
          brand_hint: null, type_hint: null, price,
        };
      });
    }

    // ─── STEP 2: Process items in Parallel Chunks ────────
    // Processamos em grupos de 5 para não sobrecarregar as conexões do banco
    const chunkSize = 5;
    const results = [];

    for (let i = 0; i < parsedItems.length; i += chunkSize) {
      const chunk = parsedItems.slice(i, i + chunkSize);
      
      const chunkPromises = chunk.map(async (item) => {
        // ════════════════════════════════════════
        // MODE: BARCODE — exact EAN lookup
        // ════════════════════════════════════════
        if (item.mode === 'barcode') {
          const ean = String(item.barcode || '').replace(/[^0-9]/g, '');
          let searchEan = ean.replace(/^0+/, ''); 
          if (searchEan === '') searchEan = '0';

          let { data } = await supabase.from('products').select('*').eq('ean', searchEan).maybeSingle();
          if (!data && ean !== searchEan) {
             const res2 = await supabase.from('products').select('*').eq('ean', ean).maybeSingle();
             data = res2.data;
          }

          if (!data) {
            return {
              original: item.original,
              mode: 'barcode',
              display_name: ean,
              price: item.price || null,
              found: true,
              match: { name: ean, ean: ean, images: [] },
              confidence: 'none',
              confidence_reason: 'Código de barras novo (Cadastro sugerido)',
              warning: 'Código de barras não encontrado no banco. Adicione uma foto para completar.',
            };
          }

          return {
            original: item.original,
            mode: 'barcode',
            display_name: data.name,
            price: item.price || null,
            found: true,
            match: data,
            confidence: 'exact',
            confidence_reason: 'Código de barras encontrado',
          };
        }

        // ════════════════════════════════════════
        // MODE: DESCRIPTION — fuzzy search + confidence
        // ════════════════════════════════════════
        const userDisplayName = item.display_name || item.original || '';
        let searchText = (item.search_name || userDisplayName).toLowerCase().trim();
        
        let { data: matches, error: rpcErr } = await supabase.rpc('search_products_fuzzy', {
          search_text: searchText,
          match_threshold: 0.10,
        });

        if ((!matches || matches.length === 0) && searchText !== stripUnits(searchText)) {
           const cleanSearch = stripUnits(searchText);
           if (cleanSearch.length > 2) {
             const res2 = await supabase.rpc('search_products_fuzzy', {
               search_text: cleanSearch,
               match_threshold: 0.10,
             });
             matches = res2.data;
             searchText = cleanSearch;
           }
        }

        if ((!matches || matches.length === 0) && item.brand_hint && item.type_hint) {
          const brandTypeSearch = `${item.brand_hint} ${item.type_hint}`.toLowerCase();
          const res3 = await supabase.rpc('search_products_fuzzy', {
             search_text: brandTypeSearch,
             match_threshold: 0.10,
          });
          if (res3.data && res3.data.length > 0) {
            matches = res3.data;
            searchText = brandTypeSearch;
          }
        }

        if (!matches || matches.length === 0) {
          const keywords = userDisplayName.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !['kg', 'ml', 'un', 'pct'].includes(w)).slice(0, 3);
          if (keywords.length > 0) {
            let query = supabase.from('products').select('*');
            for (const k of keywords) { query = query.ilike('name', `%${k}%`); }
            const { data: res4 } = await query.limit(3);
            if (res4 && res4.length > 0) { matches = res4; }
          }
        }

        if (rpcErr || !matches || matches.length === 0) {
          return {
            original: item.original,
            mode: 'description',
            display_name: userDisplayName,
            price: item.price || null,
            found: true,
            match: { name: userDisplayName, ean: 'NA', images: [] },
            confidence: 'none',
            confidence_reason: 'Nenhum produto similar no banco',
          };
        }

        const candidatesWithConfidence = (matches || [])
          .map((m: any) => ({
            match: m,
            confidence: assessConfidence(
              item.brand_hint || '',
              item.type_hint || '',
              userDisplayName,
              m.name || '',
              m.brand || ''
            )
          }))
          .sort((a, b) => {
            const levels: Record<string, number> = { high: 4, medium: 3, low: 1, none: 0 };
            return levels[b.confidence.level] - levels[a.confidence.level];
          });

        const bestCandidate = candidatesWithConfidence[0];
        if (!bestCandidate || bestCandidate.confidence.level === 'none') {
          return {
            original: item.original,
            mode: 'description',
            display_name: userDisplayName,
            price: item.price || null,
            found: true,
            match: bestCandidate?.match || { name: userDisplayName, ean: 'NA', images: [] },
            confidence: bestCandidate?.confidence.level || 'none',
            confidence_reason: bestCandidate?.confidence.reason || 'Nenhum produto similar no banco',
          };
        }

        return {
          original: item.original,
          mode: 'description',
          display_name: userDisplayName,
          price: item.price || null,
          found: true,
          match: bestCandidate.match,
          confidence: bestCandidate.confidence.level,
          confidence_reason: bestCandidate.confidence.reason,
          warning: ['low', 'none'].includes(bestCandidate.confidence.level) ? 'Confira se este produto está correto' : undefined,
        };
      });

      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
    }

    console.log('--- Process Products V2 Complete:', results.length, 'items ---');
    return new Response(JSON.stringify({ 
      results,
      meta: {
        isFallback: parsedItems.some(p => p.mode === 'description' && !p.brand_hint) // Indicador heurístico de que o GPT não refinou os dados
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error('CRITICAL ERROR:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
