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


    // Get OpenAI key
    let openAIKey = Deno.env.get('OPENAI_API_KEY')
    if (!openAIKey) {
      const { data: s } = await supabase.from('settings').select('value').eq('key', 'openai_api_key').single()
      openAIKey = s?.value
    }
    if (!openAIKey) throw new Error('OpenAI Key não configurada.');

    // ─── STEP 1: Parse input with AI ────────────────────
    let parsedItems: any[] = [];

    try {
      const apiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `Você é um parser de listas de supermercado. Analise CADA LINHA da entrada.

REGRA DE DETECÇÃO:
- Se a linha começa com um número de exatamente 13 dígitos (apenas dígitos) seguido opcionalmente de preço → modo "barcode"
- Caso contrário → modo "description"

Para CADA linha, retorne um objeto com:
{
  "original": "linha exata como recebida",
  "mode": "barcode" ou "description",
  "barcode": "código numérico limpo (só no modo barcode, null no modo description)",
  "display_name": "para description: nome do produto SEM o preço, EXATAMENTE como digitado pelo usuário. Para barcode: null (será preenchido pelo banco)",
  "search_name": "para description: versão simplificada para busca no banco. Para barcode: null",
  "brand_hint": "marca principal identificada (ex: 'Italac', 'Monster', 'Tio João'). Só no modo description. null se não identificada",
  "type_hint": "tipo genérico do produto (ex: 'leite', 'arroz', 'energético', 'sabonete'). Só no modo description. null se não identificado",
  "price": "preço extraído (ex: '5,99') ou null se não houver"
}

REGRAS CRÍTICAS:
1. display_name deve preservar EXATAMENTE o texto do usuário (INCLUINDO pesos e medidas como 1,02KG, 500G, etc), APENAS removendo o preço final e símbolos de moeda.
2. NÃO corrija erros de escrita no display_name
3. NÃO substitua marcas ou nomes
4. NÃO resuma nem abrevie
5. search_name pode ser mais flexível/simplificado para melhorar a busca
6. brand_hint deve conter APENAS a marca principal (uma palavra ou nome composto)
7. type_hint deve conter APENAS o tipo genérico do produto
8. REGRA DE PREÇO: Identifique como preço SOMENTE valores com contexto monetário (precedidos por R$, após separadores como '-' ou '|', ou o último valor numérico isolado).
9. REGRA DE PREÇO: NUNCA trate números seguidos de unidades de medida (KG, G, MG, ML, L, LT, UN, CX, FD, PCT) como preço. Exemplo: "1,02KG" é medida, não preço.
10. REGRA DE PREÇO: Em caso de múltiplos números, sempre priorize o ÚLTIMO valor da linha como preço oficial.

Retorne JSON: { "items": [...] }`
            },
            { role: 'user', content: bulkInput }
          ],
        }),
      });

      const aiData = await apiResponse.json();
      if (aiData.error) throw new Error('OpenAI: ' + aiData.error.message);
      parsedItems = JSON.parse(aiData.choices[0].message.content).items || [];
      console.log('AI parsed:', parsedItems.length, 'items');
    } catch (aiErr: any) {
      console.error('AI parse failed, using fallback:', aiErr.message);
      // ── FALLBACK: parse without AI ──
      parsedItems = bulkInput.split('\n').filter((l: string) => l.trim()).map((line: string) => {
        const trimmed = line.trim();
        const isBarcode = /^\d{13}\b/.test(trimmed);
        
        // Pega todos os números formatados como preço que NÃO são seguidos por medidas
        const priceMatches = [...trimmed.matchAll(/(?:R\$\s*)?(\d+[,.]\d{2})(?!\s*(?:KG|G|MG|ML|L|LT|UN|CX|FD|PCT)\b)/gi)];
        // Prioriza o último match como preço
        const price = priceMatches.length > 0 ? priceMatches[priceMatches.length - 1][1] : null;

        // Limpa apenas a ocorrência que virou o preço
        let cleanName = trimmed;
        if (price) {
          const priceRegex = new RegExp(`\\s*[-–—|]?\\s*(?:R\\$\\s*)?${price.replace('.', '\\.')}\\s*$`, 'i');
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

    // ─── STEP 2: Process each item based on mode ────────
    const results = [];

    for (const item of parsedItems) {
      // ════════════════════════════════════════
      // MODE: BARCODE — exact EAN lookup
      // ════════════════════════════════════════
      if (item.mode === 'barcode') {
        const ean = String(item.barcode || '').replace(/[^0-9]/g, '');
        
        let searchEan = ean.replace(/^0+/, ''); // Remove zero padding from the left
        if (searchEan === '') searchEan = '0';

        // Try stripped EAN first (handles short codes in DB like 1234)
        let { data } = await supabase
          .from('products')
          .select('*')
          .eq('ean', searchEan)
          .maybeSingle();

        // If not found, try the exact ean (handles edge cases where zeros might have been saved)
        if (!data && ean !== searchEan) {
           const res2 = await supabase.from('products').select('*').eq('ean', ean).maybeSingle();
           data = res2.data;
        }

        if (!data) {
          results.push({
            original: item.original,
            mode: 'barcode',
            display_name: ean,
            price: item.price || null,
            found: true, // Forçamos found para entrar na lista principal
            match: { name: ean, ean: ean, images: [] }, // Mock match para permitir Add Foto
            confidence: 'none',
            confidence_reason: 'Código de barras novo (Cadastro sugerido)',
            warning: 'Código de barras não encontrado no banco. Adicione uma foto para completar.',
          });
          continue;
        }

        results.push({
          original: item.original,
          mode: 'barcode',
          display_name: data.name,   // ← DB official name for barcode mode
          price: item.price || null,
          found: true,
          match: data,
          confidence: 'exact',
          confidence_reason: 'Código de barras encontrado',
        });
        continue;
      }

      // ════════════════════════════════════════
      // MODE: DESCRIPTION — fuzzy search + confidence
      // ════════════════════════════════════════
      // ── Search V2: Multi-Pass Search ──
      const userDisplayName = item.display_name || item.original || '';
      let searchText = (item.search_name || userDisplayName).toLowerCase().trim();
      
      // Try 1: Full simplified name
      let { data: matches, error: rpcErr } = await supabase.rpc('search_products_fuzzy', {
        search_text: searchText,
        match_threshold: 0.10, // Baixíssimo para automação total
      });

      // Try 2: If no matches, strip units and try again (e.g. "Arroz 5kg" -> "Arroz")
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

      // Try 3: Brand + Type search (Very effective for grocery)
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

      // Try 4: Last Ditch ILIKE Search (Keywords)
      if (!matches || matches.length === 0) {
        const keywords = userDisplayName.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !['kg', 'ml', 'un', 'pct'].includes(w)).slice(0, 3);
        if (keywords.length > 0) {
          let query = supabase.from('products').select('*');
          for (const k of keywords) {
            query = query.ilike('name', `%${k}%`);
          }
          const { data: res4 } = await query.limit(3);
          if (res4 && res4.length > 0) {
            matches = res4;
          }
        }
      }

      if (rpcErr || !matches || matches.length === 0) {
        results.push({
          original: item.original,
          mode: 'description',
          display_name: userDisplayName,  // ← preserve user text ALWAYS
          price: item.price || null,
          found: true, // Forçamos found para que o usuário possa associar foto/manual
          match: { name: userDisplayName, ean: 'NA', images: [] },
          confidence: 'none',
          confidence_reason: 'Nenhum produto similar no banco',
        });
        continue;
      }

      // Analyze all candidates (up to 25) with our confidence engine
      // This will prioritize the ones with matching brands over just text similarity
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
          // Double score for brand match + high confidence
          const levels: Record<string, number> = { high: 4, medium: 3, low: 1, none: 0 };
          return levels[b.confidence.level] - levels[a.confidence.level];
        });

      // Se não houver nenhum candidato sequer razoável, fallback para o original (item sem vínculo)
      if (candidatesWithConfidence.length === 0 || candidatesWithConfidence[0].confidence.level === 'none') {
        const bestTry = candidatesWithConfidence[0]; // even if none, might have one
        results.push({
          original: item.original,
          mode: 'description',
          display_name: userDisplayName,
          price: item.price || null,
          found: true,
          match: bestTry ? bestTry.match : { name: userDisplayName, ean: 'NA', images: [] },
          confidence: bestTry ? bestTry.confidence.level : 'none',
          confidence_reason: bestTry ? bestTry.confidence.reason : 'Nenhum produto similar no banco',
        });
        continue;
      }

      const bestCandidate = candidatesWithConfidence[0];
      let bestMatch = bestCandidate.match;
      let bestConf = bestCandidate.confidence;

      results.push({
        original: item.original,
        mode: 'description',
        display_name: userDisplayName,
        price: item.price || null,
        found: true,
        match: bestMatch,
        confidence: bestConf.level,
        confidence_reason: bestConf.reason,
        debug: { searchText, brandHint: item.brand_hint, typeHint: item.type_hint, matchesFound: matches?.length || 0 },
        warning: ['low', 'none'].includes(bestConf.level) ? 'Confira se este produto está correto' : undefined,
      });
    }

    console.log('--- Process Products V2 Complete:', results.length, 'items ---');
    return new Response(JSON.stringify({ results }), {
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
