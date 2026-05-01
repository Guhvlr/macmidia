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
  const hasBrandConflict = !brandMatch && normBrand.length >= 2 && normMatchBrand.length >= 2;
  if (hasBrandConflict) {
    return { level: 'low', reason: `Conflito de marcas: Solicitado '${brandHint}', encontrado '${matchBrand}'` };
  }

  // REJEIÇÃO 2: Marca exigida mas ignorada.
  if (!brandMatch && normBrand.length >= 2) {
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
  
  if (overlap >= 0.45) {
    return { level: 'medium', reason: 'Similaridade de texto aceitável' };
  }

  // ── LOW ──
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
    const { bulkInput, clientName } = await req.json()
    console.log('--- Process Products V2 (Context:', clientName || 'Global', ') ---');

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
          system: `Você é um parser de elite para listas de ofertas de supermercados. 
Sua missão é transformar listas brutas em dados estruturados, seguindo REGRAS RÍGIDAS DE PRESERVAÇÃO.

REGRA DE OURO: Preserve fielmente a descrição e o preço. Você é um corretor ortográfico e organizador, não um redator criativo.

O QUE VOCÊ PODE ALTERAR:
- Acentuação e ortografia (ex: "mionesa" -> "maionese").
- Correções óbvias de abreviação (ex: "hellmas" -> "hellmann's", "refri" -> "refrigerante").
- Identificação de seções/setores (Açougue, Limpeza, Bebidas, etc).

O QUE VOCÊ JAMAIS PODE FAZER (PROIBIDO):
- Remover palavras da descrição original.
- Inventar palavras que não existem no texto original.
- Trocar ou omitir embalagem, peso, volume ou unidade (pote, lata, fardo, kg, g, ml).
- Alterar a ordem importante das palavras na descrição.
- Modificar ou inventar preços. Se não houver preço, retorne null.
- Substituir um produto por outro similar.

Para cada linha da lista, extraia:
1. "mode": "barcode" (se começar com 12-14 dígitos) ou "description".
2. "barcode": o código numérico se for modo barcode, senão null.
3. "price": o preço numérico final (ex: "7,99"). Use o preço original sem alterações.
4. "display_name": O nome corrigido ortograficamente, mas MANTENDO TODOS OS DETALHES (embalagem, peso, etc). 
   - Exemplo Correto: "mionesa hellmas pote 400g 7,99" -> "Maionese Hellmann's Pote 400g"
5. "search_name": Uma versão otimizada para busca (sem preço e sem o setor).
6. "section": O setor do produto (ex: "Mercearia", "Hortifruti", "Açougue", "Limpeza", "Bebidas", "Padaria"). Identifique pelo contexto da lista ou do produto.
7. "brand_hint": Marca identificada.
8. "type_hint": Categoria básica.

Formato de Saída (JSON APENAS):
{ "items": [ { "mode": "...", "display_name": "...", "price": "...", "section": "...", ... } ] }`,
          messages: [
            { role: 'user', content: bulkInput }
          ],
        }),
      });

      const aiData = await apiResponse.json();
      if (!apiResponse.ok) throw new Error('Anthropic Error: ' + (aiData.error?.message || apiResponse.statusText));
      
      let textContent = aiData.content?.[0]?.text || '{}';
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) textContent = jsonMatch[0];
      
      const parsedJson = JSON.parse(textContent);
      parsedItems = parsedJson.items || [];
      console.log('Claude parsed:', parsedItems.length, 'items');
    } catch (aiErr: any) {
      console.error('AI parse failed, using fallback:', aiErr.message);
      parsedItems = bulkInput.split('\n').filter((l: string) => l.trim()).map((line: string) => {
        const trimmed = line.trim();
        const isBarcode = /^\d{12,14}\b/.test(trimmed);
        const priceMatches = [...trimmed.matchAll(/(?:R\$\s*)?(\d+[,.]\d{2})/gi)];
        const price = priceMatches.length > 0 ? priceMatches[priceMatches.length - 1][1] : null;

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

    const chunkSize = 5;
    const results = [];

    for (let i = 0; i < parsedItems.length; i += chunkSize) {
      const chunk = parsedItems.slice(i, i + chunkSize);
      const chunkPromises = chunk.map(async (item) => {
        // 0. Force barcode mode if input is just digits
        if (item.mode === 'description' && /^\d{8,14}$/.test(item.original?.trim() || '')) {
          item.mode = 'barcode';
          item.barcode = item.original.trim();
        }

        if (item.mode === 'barcode') {
          const ean = String(item.barcode || '').trim().replace(/[^0-9]/g, '');
          const searchEan = ean.replace(/^0+/, '') || '0';
          
          // Generate all possible paddings (standard EAN formats)
          const variations = [
            ean, 
            searchEan,
            searchEan.padStart(8, '0'),
            searchEan.padStart(12, '0'),
            searchEan.padStart(13, '0'),
            searchEan.padStart(14, '0')
          ];
          const uniqueVariations = [...new Set(variations)].filter(v => v.length > 0);
          const orFilter = uniqueVariations.map(v => `ean.eq."${v}"`).join(',') + `,name.eq."${ean}"`;

          // 1. Unified Search: Fetch EVERYTHING for these variations
          const { data: candidates, error: searchError } = await supabase
            .from('products')
            .select('*')
            .or(orFilter);

          if (searchError) {
            console.error('[Barcode Search Error]', searchError);
          }

          if (!candidates || candidates.length === 0) {
            return {
              original: item.original,
              mode: 'barcode',
              display_name: ean,
              price: item.price || null,
              found: true,
              match: { name: ean, ean: ean, images: [] },
              confidence: 'none',
              confidence_reason: 'Código de barras não encontrado no banco',
              warning: 'Produto não cadastrado. Adicione uma foto para criar o cadastro.',
            };
          }

          // 2. APPLY PRIORITY RULES (IN-MEMORY)
          const normClient = (clientName || '').trim().toUpperCase();
          
          // Case-insensitive filtering for the active client
          const localMatch = candidates.filter(c => 
            (c.client_name || '').trim().toUpperCase() === normClient
          );
          
          // Global products (no client)
          const globalMatch = candidates.filter(c => !c.client_name);
          
          // Products from other clients
          const otherMatch = candidates.filter(c => 
            c.client_name && (c.client_name || '').trim().toUpperCase() !== normClient
          );

          let selectedMatch = null;
          let warning = undefined;
          let confidence = 'exact';

          // --- PRIORITY FLOW ---
          if (localMatch.length > 0) {
            // Priority 1: Current Client
            selectedMatch = localMatch[0];
            if (localMatch.length > 1) {
              warning = "⚠ Código duplicado no cliente ativo. Escolha a variação correta.";
              confidence = 'medium';
            }
          } else if (globalMatch.length > 0) {
            // Priority 2: Global Products
            selectedMatch = globalMatch[0];
            if (globalMatch.length > 1) {
              warning = "⚠ Este código possui variações cadastradas";
              confidence = 'medium';
            }
          } else if (otherMatch.length > 0) {
            // Priority 3: Other Clients
            selectedMatch = otherMatch[0];
            confidence = 'low';
            warning = `Produto encontrado no cliente: ${otherMatch[0].client_name}`;
            if (otherMatch.length > 1) {
              warning = "⚠ Este código possui variações em outros clientes";
            }
          }

          return {
            original: item.original,
            mode: 'barcode',
            display_name: selectedMatch.name,
            price: item.price || null,
            found: true,
            match: selectedMatch,
            confidence: confidence,
            confidence_reason: 'Prioridade de contexto aplicada',
            warning: warning,
          };
        }

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
