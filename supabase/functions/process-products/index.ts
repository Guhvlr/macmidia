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

  // ── HIGH: brand + (type OR strong overlap) ──
  if (brandMatch && (typeMatch || overlap >= 0.5)) {
    return { level: 'high', reason: 'Marca e tipo de produto correspondem' };
  }

  // ── MEDIUM: brand only, or high overlap without brand ──
  if (brandMatch) {
    return { level: 'medium', reason: 'Marca corresponde, mas variedade/tamanho não confirmados' };
  }
  if (overlap >= 0.6) {
    return { level: 'medium', reason: 'Palavras-chave correspondem parcialmente' };
  }

  // ── LOW ──
  return { level: 'low', reason: 'Baixa correspondência com o banco' };
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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

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
- Se a linha começa com um número de 1 a 14 dígitos (apenas dígitos) seguido opcionalmente de preço → modo "barcode"
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
1. display_name deve preservar EXATAMENTE o texto do usuário, apenas removendo o preço e símbolos de moeda
2. NÃO corrija erros de escrita no display_name
3. NÃO substitua marcas ou nomes
4. NÃO resuma nem abrevie
5. search_name pode ser mais flexível/simplificado para melhorar a busca
6. brand_hint deve conter APENAS a marca principal (uma palavra ou nome composto)
7. type_hint deve conter APENAS o tipo genérico do produto

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
        const isBarcode = /^\d{1,14}\b/.test(trimmed);
        const priceMatch = trimmed.match(/R?\$?\s*(\d+[,.]\d{2})/);
        const price = priceMatch ? priceMatch[1] : null;
        const cleanName = trimmed
          .replace(/\s*[-–—]?\s*R?\$?\s*\d+[,.]\d{2}/gi, '')
          .trim();

        if (isBarcode) {
          const barcodeMatch = trimmed.match(/^(\d{1,14})/);
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
        
        // Try exact EAN
        let { data } = await supabase
          .from('products')
          .select('*')
          .eq('ean', ean)
          .maybeSingle();

        // Try zero-padded EAN
        if (!data && ean.length < 13) {
          const padded = ean.padStart(13, '0');
          const res2 = await supabase.from('products').select('*').eq('ean', padded).maybeSingle();
          data = res2.data;
        }

        if (!data) {
          results.push({
            original: item.original,
            mode: 'barcode',
            display_name: ean,
            price: item.price || null,
            found: false,
            match: null,
            confidence: 'none',
            confidence_reason: 'Código de barras não encontrado no banco',
            warning: 'Código de barras não encontrado no banco',
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
      const userDisplayName = item.display_name || item.original || '';
      const searchText = item.search_name || userDisplayName;

      const { data: matches, error: rpcErr } = await supabase.rpc('search_products_fuzzy', {
        search_text: searchText,
        match_threshold: 0.1,
      });

      if (rpcErr || !matches || matches.length === 0) {
        results.push({
          original: item.original,
          mode: 'description',
          display_name: userDisplayName,  // ← preserve user text ALWAYS
          price: item.price || null,
          found: false,
          match: null,
          confidence: 'none',
          confidence_reason: 'Nenhum produto encontrado no banco',
          warning: 'Imagem não encontrada no banco',
        });
        continue;
      }

      const bestMatch = matches[0];
      const conf = assessConfidence(
        item.brand_hint || '',
        item.type_hint || '',
        userDisplayName,
        bestMatch.name || '',
        bestMatch.brand || ''
      );

      results.push({
        original: item.original,
        mode: 'description',
        display_name: userDisplayName,  // ← preserve user text ALWAYS
        price: item.price || null,
        found: true,
        match: bestMatch,
        confidence: conf.level,
        confidence_reason: conf.reason,
        warning: (conf.level === 'high' || conf.level === 'medium') ? undefined : 'Imagem não encontrada com confiança',
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
