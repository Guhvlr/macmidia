// =====================================================
// Supabase Edge Function: WhatsApp Webhook Handler
// =====================================================
// Recebe webhooks da Evolution API, interpreta mensagens com IA,
// e cria cards automaticamente no Kanban.
// 
// Deploy: supabase functions deploy whatsapp-webhook
// =====================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ---- Product categories for auto-organization ----
// ---- Product categories for auto-organization ----
async function fetchCategories(supabase: any) {
  const { data, error } = await supabase
    .from('product_categories')
    .select('name, keywords')
    .order('display_order', { ascending: true });
  
  if (error || !data) {
    console.error('Error fetching categories, using fallback:', error);
    return {
      'CARNES': ['carne', 'frango', 'peixe', 'linguiça', 'salsicha', 'bacon', 'costela', 'picanha', 'alcatra', 'filé', 'bife', 'acém', 'pernil', 'coxa', 'peito de frango', 'sobrecoxa', 'asa', 'moída', 'cupim', 'maminha'],
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
  // Regex to find prices like 10,99 or 10.99
  const priceRegex = /\d+[\.,]\d{2}/g;
  return (text.match(priceRegex) || []).map(p => p.replace('.', ',')).sort();
}

function validatePriceIntegrity(originalText: string, processedProducts: any[]): boolean {
  const originalPrices = extractPrices(originalText);
  const processedPrices = (processedProducts || []).map(p => p.price.replace('.', ',')).sort();
  
  // Basic check: all processed prices must exist in the original text
  // We allow the original text to have MORE prices (dates, etc), but the AI output
  // should only contain prices that were in the original message.
  return processedPrices.every(p => originalPrices.includes(p));
}

// ---- OpenAI message parsing ----
async function parseMessageWithAI(messageText: string, openaiKey: string): Promise<any> {
  const systemPrompt = `Você é um assistente que interpreta mensagens de ofertas de supermercado vindas do WhatsApp.
A mensagem segue este padrão geral:
NOME_CLIENTE TIPO_OFERTA RESPONSÁVEL
DATA: XX a XX.MM.AA
OBSERVAÇÕES (ex: FINAL DE SEMANA, SEQUENCIA: SIM/NÃO)
produto preço
produto preço
...

Extraia os seguintes campos em JSON:
{
  "clientName": "nome do cliente (ex: COUTO)",
  "offerType": "tipo da oferta (ex: OFERTA, ENCARTE, TABLOIDE)",
  "responsibleName": "nome do responsável (ex: GUSTAVO)", 
  "dateRange": "período (ex: 05 a 13.03.26)",
  "dateStart": "data início em formato YYYY-MM-DD",
  "dateEnd": "data fim em formato YYYY-MM-DD",
  "observations": ["lista de observações como FINAL DE SEMANA"],
  "keepOriginalOrder": false,
  "products": [
    {"name": "nome do produto corrigido ortograficamente", "price": "preço formatado"}
  ],
  "correctedText": "texto completo reescrito com ortografia corrigida e formatação profissional"
}

REGRAS:
- Corrija ortografia dos produtos (ex: "aros" → "arroz")
- Mantenha os preços EXATAMENTE como recebidos, nunca altere valores
- SEQUENCIA: Se encontrar "SEQUENCIA: SIM", "[SEQ]", "[ORDEM]" ou apenas "SIM" no final da primeira linha, defina keepOriginalOrder como true. Caso contrário, false.
- Datas com formato DD.MM.A devem ser convertidas para YYYY-MM-DD (considere 2025/2026)
- responsibleName é o nome do designer (ex: CAIO, GUSTAVO). 
- Normalize preços para usar vírgula (ex: 5.99 → 5,99)
- Se a mensagem tiver uma lista numerada, tente preservar os nomes originais o máximo possível.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: messageText },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

// ---- Main handler ----
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    // Validate webhook secret
    const webhookSecret = Deno.env.get('WEBHOOK_SECRET');
    const reqSecret = req.headers.get('x-webhook-secret');
    if (webhookSecret && reqSecret !== webhookSecret) {
      console.warn('Invalid webhook secret');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const payload = await req.json();
    console.log('Webhook received:', JSON.stringify(payload).substring(0, 500));

    // Pegamos a URL para saber em qual modo o webhook foi chamado
    const url = new URL(req.url);
    const mode = url.searchParams.get('mode') || 'auto';

    // Evolution API webhook structure
    const event = payload.event || payload.type;
    
    // Only process text messages
    if (event !== 'messages.upsert' && event !== 'MESSAGES_UPSERT') {
      return new Response(JSON.stringify({ status: 'ignored', reason: 'not a message event' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Extract message data from Evolution API payload
    const messageData = payload.data || payload;
    const message = messageData.message || messageData;
    const key = messageData.key || message.key || {};
    
    const remoteJid = key.remoteJid || messageData.remoteJid || '';
    const sender = key.participant || key.remoteJid || '';
    const messageText = message.conversation || 
                        message.extendedTextMessage?.text || 
                        messageData.body || 
                        '';

    if (!messageText || messageText.length < 5) {
      return new Response(JSON.stringify({ status: 'ignored', reason: 'empty or too short message' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if message looks like an offer (heuristic)
    const looksLikeOffer = /\d+[,.]?\d{0,2}\s*$|\bdata\b|\boferta\b|\bencarte\b/mi.test(messageText);
    
    // Tentativa VIP de pegar o Nome do Grupo através da API Evolution
    let finalSenderName = messageData?.pushName || sender;
    
    if (remoteJid.endsWith('@g.us')) {
      try {
        const evoServer = payload.server_url;
        const evoInstance = payload.instance;
        const evoApiKey = payload.apikey;
        
        if (evoServer && evoInstance && evoApiKey) {
          const groupUrl = `${evoServer.replace(/\/$/, '')}/group/findGroupInfos/${evoInstance}?groupJid=${remoteJid}`;
          const groupResp = await fetch(groupUrl, { headers: { 'apikey': evoApiKey } });
          
          if (groupResp.ok) {
            const groupData = await groupResp.json();
            if (groupData.subject) {
              finalSenderName = groupData.subject;
            }
          }
        }
      } catch (e) {
        console.error('Falha ao pegar nome do grupo:', e);
      }
    }

    // Init Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ==========================================
    // MODO MANUAL (BETA) - Vai para a Caixa de Entrada
    // ==========================================
    if (mode === 'manual') {
      const { data: savedMsg, error: saveError } = await supabase
        .from('whatsapp_inbox')
        .insert({
          remote_jid: remoteJid,
          sender: sender,
          sender_name: finalSenderName,
          message_text: messageText,
          message_type: 'text',
          raw_payload: payload,
          status: 'pending',
        })
        .select()
        .single();

      if (saveError) {
        console.error('Error saving to inbox:', saveError);
        throw saveError;
      }

      console.log(`📥 MODO MANUAL: Message saved to inbox: ${savedMsg.id}`);
      return new Response(JSON.stringify({ status: 'saved_to_inbox', id: savedMsg.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ==========================================
    // MODO AUTOMÁTICO (PADRÃO) - Cria Card no Kanban usando IA
    // ==========================================

    if (!looksLikeOffer) {
      return new Response(JSON.stringify({ status: 'ignored', reason: 'does not look like an offer message' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Save raw message
    const { data: savedMsg, error: saveError } = await supabase
      .from('whatsapp_messages')
      .insert({
        remote_jid: remoteJid,
        sender: sender,
        message_text: messageText,
        message_type: 'text',
        raw_payload: payload,
        status: 'processing',
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving message:', saveError);
      throw saveError;
    }

    // Parse with AI
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      await supabase.from('whatsapp_messages').update({ 
        status: 'error', 
        error_message: 'OPENAI_API_KEY not configured' 
      }).eq('id', savedMsg.id);
      
      return new Response(JSON.stringify({ error: 'OpenAI not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let parsedData;
    try {
      parsedData = await parseMessageWithAI(messageText, openaiKey);
    } catch (aiErr: any) {
      console.error('OpenAI critical error:', aiErr.message);
      await supabase.from('whatsapp_messages').update({ 
        status: 'error', 
        error_message: `AI error: ${aiErr.message}` 
      }).eq('id', savedMsg.id);
      
      throw aiErr;
    }

    // Fetch dynamic categories
    const categories = await fetchCategories(supabase);

    // Organize products by category if keepOriginalOrder is false
    if (!parsedData.keepOriginalOrder && parsedData.products?.length > 0) {
      parsedData.products = organizeByCategory(parsedData.products, categories);
    }

    // Validate price integrity (Price Guard)
    const pricesAreValid = validatePriceIntegrity(messageText, parsedData.products);

    // Build description from products
    let description = '';
    if (!pricesAreValid) {
      description += `⚠️ [ALERTA] DIVERGÊNCIA DE PREÇOS DETECTADA\n`;
      description += `Alguns preços podem ter sido alterados pela IA. Confira com o original.\n\n`;
    }

    if (parsedData.observations?.length > 0) {
      description += parsedData.observations.join('\n') + '\n\n';
    }
    if (parsedData.dateRange) {
      description += `📅 DATA: ${parsedData.dateRange}\n\n`;
    }

    // Group by category for organized display
    if (!parsedData.keepOriginalOrder && parsedData.products?.[0]?.category) {
      let currentCategory = '';
      for (const p of parsedData.products) {
        if (p.category !== currentCategory) {
          currentCategory = p.category;
          description += `\n━━━ ${currentCategory} ━━━\n`;
        }
        description += `${p.name} ── ${p.price}\n`;
      }
    } else {
      for (const p of parsedData.products || []) {
        description += `${p.name} ── ${p.price}\n`;
      }
    }

    // Find responsible employee
    let employeeId: string | null = null;
    let responsibleName = parsedData.responsibleName?.toUpperCase();
    
    // Synonym mapping for employees (WhatsApp name -> DB name)
    const NAME_SYNONYMS: Record<string, string> = {
      'CAIO': 'KHAYO',
      'KHAYO': 'CAIO'
    };

    if (responsibleName && NAME_SYNONYMS[responsibleName]) {
      responsibleName = NAME_SYNONYMS[responsibleName];
    }
    
    if (responsibleName) {
      // Try client_employee_map first
      const { data: mapping } = await supabase
        .from('client_employee_map')
        .select('employee_id')
        .ilike('client_name_pattern', `%${parsedData.clientName}%`)
        .limit(1)
        .single();

      if (mapping) {
        employeeId = mapping.employee_id;
      } else {
        // Try matching employee name
        const { data: employees } = await supabase
          .from('employees')
          .select('id, name')
          .ilike('name', `%${responsibleName}%`)
          .limit(1);

        if (employees && employees.length > 0) {
          employeeId = employees[0].id;
        }
      }
    }

    // If no employee found, use the first one
    if (!employeeId) {
      const { data: firstEmp } = await supabase
        .from('employees')
        .select('id')
        .limit(1)
        .single();
      
      if (firstEmp) employeeId = firstEmp.id;
    }

    if (!employeeId) {
      await supabase.from('whatsapp_messages').update({ 
        status: 'error', 
        error_message: 'No employee found to assign card',
        parsed_data: parsedData 
      }).eq('id', savedMsg.id);

      return new Response(JSON.stringify({ error: 'No employee found' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create Kanban card
    const { data: card, error: cardError } = await supabase
      .from('kanban_cards')
      .insert({
        employee_id: employeeId,
        client_name: parsedData.clientName || 'Novo Card WhatsApp',
        description: description,
        column: pricesAreValid ? 'para-producao' : 'alteracao', // Move para alteração se houver dúvida nos preços
        ai_status: pricesAreValid ? 'approved' : 'price_mismatch',
        source: 'whatsapp',
        original_message: messageText,
        notes: `Criado automaticamente via WhatsApp\nResponsável: ${parsedData.responsibleName || 'Não identificado'}\nData: ${parsedData.dateRange || 'Não informada'}${!pricesAreValid ? '\n\n⚠️ REVISAR PREÇOS: Possível alteração detectada.' : ''}`,
        history: [{
          id: crypto.randomUUID(),
          userId: 'system',
          userName: '🤖 WhatsApp Bot',
          actionType: pricesAreValid ? 'create' : 'alert',
          description: pricesAreValid 
            ? `Card criado automaticamente` 
            : `❌ ALERTA: Card criado com divergência de preços detectada. Movido para Alteração.`,
          createdAt: new Date().toISOString(),
        }],
      })
      .select()
      .single();

    if (cardError) {
      console.error('Error creating card:', cardError);
      throw cardError;
    }

    // Update message with parsed data and card reference
    await supabase.from('whatsapp_messages').update({
      status: 'parsed',
      parsed_data: parsedData,
      kanban_card_id: card.id,
    }).eq('id', savedMsg.id);

    console.log(`✅ Card created: ${card.id} - ${parsedData.clientName}`);

    return new Response(JSON.stringify({ 
      status: 'success',
      cardId: card.id,
      cardTitle: parsedData.clientName || 'Novo Card WhatsApp',
      parsedData,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
