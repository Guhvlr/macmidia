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
const PRODUCT_CATEGORIES: Record<string, string[]> = {
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

function categorizeProduct(productName: string): string {
  const lower = productName.toLowerCase();
  for (const [category, keywords] of Object.entries(PRODUCT_CATEGORIES)) {
    if (keywords.some(k => lower.includes(k))) {
      return category;
    }
  }
  return 'OUTROS';
}

function organizeByCategory(products: Array<{name: string; price: string}>): Array<{name: string; price: string; category: string}> {
  const categorized = products.map(p => ({
    ...p,
    category: categorizeProduct(p.name),
  }));
  
  // Sort by category, then by original order within category
  const categoryOrder = Object.keys(PRODUCT_CATEGORIES);
  categoryOrder.push('OUTROS');
  
  return categorized.sort((a, b) => {
    const idxA = categoryOrder.indexOf(a.category);
    const idxB = categoryOrder.indexOf(b.category);
    return idxA - idxB;
  });
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
- Se encontrar "SEQUENCIA: SIM" ou apenas "SIM" no final da primeira linha, defina keepOriginalOrder como true
- Se não encontrar SEQUENCIA ou encontrar "NÃO", defina keepOriginalOrder como false
- Datas com formato DD.MM.AA devem ser convertidas para YYYY-MM-DD (considere 2025/2026 se ano for 25/26)
- O campo responsibleName é o nome do editor/designer (ex: CAIO, GUSTAVO, DAVID, ERIC, GABRIEL, TIAGO). 
- Caso a primeira linha seja "COUTO CAIO SIM", o clientName é "COUTO", o responsibleName é "CAIO" e keepOriginalOrder é true. JAMAIS use "SIM" ou "NÃO" como responsibleName.
- Normalize o formato dos preços para usar vírgula (ex: 5.99 → 5,99)`;

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

    if (!messageText || messageText.length < 10) {
      return new Response(JSON.stringify({ status: 'ignored', reason: 'empty or too short message' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if message looks like an offer (heuristic)
    const looksLikeOffer = /\d+[,.]?\d{0,2}\s*$|\bdata\b|\boferta\b|\bencarte\b/mi.test(messageText);
    if (!looksLikeOffer) {
      return new Response(JSON.stringify({ status: 'ignored', reason: 'does not look like an offer message' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Init Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    // Organize products by category if keepOriginalOrder is false
    if (!parsedData.keepOriginalOrder && parsedData.products?.length > 0) {
      parsedData.products = organizeByCategory(parsedData.products);
    }

    // Build description from products
    let description = '';
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

    // Build card title
    const cardTitle = [
      parsedData.clientName,
      parsedData.offerType,
    ].filter(Boolean).join(' — ');

    // Create Kanban card
    const { data: card, error: cardError } = await supabase
      .from('kanban_cards')
      .insert({
        employee_id: employeeId,
        client_name: cardTitle || parsedData.clientName || 'Novo Card WhatsApp',
        description: description, // Usar sempre a lista montada com as quebras de linha corretas
        column: 'para-producao',
        source: 'whatsapp',
        original_message: messageText,
        notes: `Criado automaticamente via WhatsApp\nResponsável: ${parsedData.responsibleName || 'Não identificado'}\nData: ${parsedData.dateRange || 'Não informada'}`,
        history: [{
          id: crypto.randomUUID(),
          userId: 'system',
          userName: '🤖 WhatsApp Bot',
          actionType: 'create',
          description: `Card criado automaticamente a partir de mensagem do WhatsApp`,
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

    console.log(`✅ Card created: ${card.id} - ${cardTitle}`);

    return new Response(JSON.stringify({ 
      status: 'success',
      cardId: card.id,
      cardTitle,
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
