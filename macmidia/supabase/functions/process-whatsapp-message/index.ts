// =====================================================
// Supabase Edge Function: Process WhatsApp Message with AI
// =====================================================
// Chamada manualmente pelo frontend para "Melhorar com IA".
// Agora inclui Price Guard e Categorias Dinâmicas.
//
// Deploy: supabase functions deploy process-whatsapp-message
// =====================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ---- Dynamic Categories ----
async function fetchCategories(supabase: any) {
  const { data, error } = await supabase
    .from('product_categories')
    .select('name, keywords')
    .order('display_order', { ascending: true });
  
  if (error || !data) {
    return {
      'CARNES': ['carne', 'frango', 'peixe', 'linguiça', 'bacon', 'costela', 'picanha', 'alcatra', 'filé', 'bife', 'acém', 'pernil', 'coxa', 'peito de frango', 'sobrecoxa', 'asa', 'moída', 'cupim', 'maminha'],
      'FRIOS E LATICÍNIOS': ['queijo', 'presunto', 'leite', 'iogurte', 'manteiga', 'requeijão', 'creme de leite', 'mussarela', 'mortadela', 'margarina', 'nata', 'ricota'],
      'MERCEARIA': ['arroz', 'feijão', 'macarrão', 'farinha', 'açúcar', 'sal', 'café', 'óleo', 'azeite', 'vinagre', 'molho', 'extrato', 'massa', 'aveia', 'fubá', 'amido', 'trigo'],
      'BEBIDAS': ['refrigerante', 'suco', 'água', 'cerveja', 'vinho', 'energético', 'chá', 'coca', 'guaraná', 'fanta'],
      'LIMPEZA': ['detergente', 'sabão', 'desinfetante', 'água sanitária', 'amaciante', 'esponja', 'saco de lixo', 'limpador', 'alvejante', 'cloro'],
      'HIGIENE': ['shampoo', 'sabonete', 'pasta de dente', 'escova', 'papel higiênico', 'absorvente', 'desodorante', 'creme dental', 'fralda'],
      'HORTIFRUTI': ['banana', 'maçã', 'laranja', 'tomate', 'cebola', 'alho', 'batata', 'cenoura', 'limão', 'alface', 'manga', 'uva', 'melancia', 'abacaxi'],
      'PADARIA': ['pão', 'bolo', 'biscoito', 'bolacha', 'torrada', 'rosca'],
      'CONGELADOS': ['pizza', 'lasanha', 'hambúrguer', 'nugget', 'sorvete', 'açaí', 'polpa'],
    };
  }

  const categories: Record<string, string[]> = {};
  data.forEach((c: any) => {
    categories[c.name] = c.keywords || [];
  });
  return categories;
}

function categorizeProduct(productName: string, categories: Record<string, string[]>): string {
  const lower = productName.toLowerCase();
  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(k => lower.includes(k))) {
      return category;
    }
  }
  return 'OUTROS';
}

function organizeByCategory(products: Array<{name: string; price: string}>, categories: Record<string, string[]>): Array<{name: string; price: string; category: string}> {
  const categorized = products.map(p => ({
    ...p,
    category: categorizeProduct(p.name, categories),
  }));
  
  const categoryOrder = Object.keys(categories);
  categoryOrder.push('OUTROS');
  
  return categorized.sort((a, b) => {
    const idxA = categoryOrder.indexOf(a.category);
    const idxB = categoryOrder.indexOf(b.category);
    return idxA - idxB;
  });
}

// ---- Price Integrity Guard ----
function extractPrices(text: string): string[] {
  const priceRegex = /\d+[\.,]\d{2}/g;
  return (text.match(priceRegex) || []).map(p => p.replace('.', ',')).sort();
}

function validatePriceIntegrity(originalText: string, processedProducts: any[]): boolean {
  const originalPrices = extractPrices(originalText);
  const processedPrices = (processedProducts || []).map(p => p.price.replace('.', ',')).sort();
  return processedPrices.every(p => originalPrices.includes(p));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messageText, senderName, mode } = await req.json();
    const isCreative = mode === 'creative';

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) throw new Error('OPENAI_API_KEY not configured');

    const systemPrompt = isCreative 
    ? `Você é um REDATOR CRIATIVO E DIRETOR DE CONTEÚDO SÊNIOR da Agência MAC MIDIA.
Sua tarefa é receber um briefing ou pedido simples do cliente e transformá-lo em uma DESCRIÇÃO DE CARD criativa.

REGRAS:
1. Títulos chamativos, textos envolventes, roteiros sugeridos para vídeos.
2. Legenda para Social: Se desejar, escreva uma legenda completa com hashtags.
3. Call to Action (CTA): Sempre inclua um CTA marcante ao final.
4. NUNCA altere preços — mantenha exatamente como recebidos.
5. Retorne APENAS JSON.`
    : `Você é um Analista de Dados Sênior da Agência MAC MIDIA especializado em supermercados.
Transforme a mensagem bruta em uma DESCRIÇÃO PROFISSIONAL.

REGRAS:
1. Corrija ortografia e gramática.
2. Organize produtos por categorias.
3. NUNCA altere preços — mantenha exatamente como recebidos.
4. Identifique se deve manter a sequência original ([SEQ] ou SIM).
5. Retorne APENAS JSON.`;

    const instructions = `Retorne EXCLUSIVAMENTE um JSON:
{
  "clientName": "Nome do Cliente detectado",
  "keepOriginalOrder": false,
  "observations": ["lista de obs"],
  "products": [{"name": "item", "price": "preço"}],
  "creativeDescription": "Texto criativo (se modo criativo)",
  "dateRange": "período"
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt + '\n' + instructions },
          { role: 'user', content: `Remetente: ${senderName}\n\nMensagem:\n${messageText}` },
        ],
        temperature: isCreative ? 0.8 : 0.1,
        response_format: { type: 'json_object' },
      }),
    });

    const data = await response.json();
    const parsed = JSON.parse(data.choices[0].message.content);

    // Dynamic Processing
    const categories = await fetchCategories(supabase);
    if (!parsed.keepOriginalOrder && !isCreative && parsed.products?.length > 0) {
      parsed.products = organizeByCategory(parsed.products, categories);
    }

    const pricesAreValid = validatePriceIntegrity(messageText, parsed.products);

    // Build final description
    let description = '';
    if (isCreative) {
      description = parsed.creativeDescription;
    } else {
      if (parsed.observations?.length > 0) description += parsed.observations.join('\n') + '\n\n';
      if (parsed.dateRange) description += `📅 DATA: ${parsed.dateRange}\n\n`;

      if (!parsed.keepOriginalOrder && parsed.products?.[0]?.category) {
        let currentCat = '';
        for (const p of parsed.products) {
          if (p.category !== currentCat) {
            currentCat = p.category;
            description += `\n━━━ ${currentCat} ━━━\n`;
          }
          description += `${p.name} ── ${p.price}\n`;
        }
      } else {
        for (const p of parsed.products || []) {
          description += `${p.name} ── ${p.price}\n`;
        }
      }
    }

    return new Response(JSON.stringify({ 
      processedText: description,
      clientName: parsed.clientName,
      priceMismatch: !pricesAreValid,
      originalOrder: parsed.keepOriginalOrder
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
