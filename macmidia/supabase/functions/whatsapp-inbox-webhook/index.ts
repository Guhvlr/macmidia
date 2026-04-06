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
    console.log('--- [WH-WEBHOOK] NEW HIT ---');
    console.log('Event:', payload.event || payload.type);

    // Evolution API webhook structure
    const event = payload.event || payload.type;
    
    // Only process text and media messages
    if (event !== 'messages.upsert' && event !== 'MESSAGES_UPSERT' && event !== 'messages.update' && event !== 'MESSAGES_UPDATE') {
      console.log('Ignoring non-upsert/update event:', event);
      return new Response(JSON.stringify({ status: 'ignored', reason: 'not a target event' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Extract message data
    const messageData = payload.data || payload;
    const message = messageData.message || messageData;
    const key = messageData.key || message.key || {};
    
    const remoteJid = key.remoteJid || messageData.remoteJid || '';
    const sender = key.participant || key.remoteJid || '';
    
    // ULTRA-ROBUST Media search
    const findMediaDeep = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return null;
      
      const mediaKeys = ['imageMessage', 'documentMessage', 'videoMessage', 'audioMessage', 'stickerMessage'];
      for (const k of mediaKeys) {
        if (obj[k]) return { type: k.replace('Message', ''), data: obj[k] };
      }

      // Scan all properties
      for (const k in obj) {
        const found = findMediaDeep(obj[k]);
        if (found) return found;
      }
      return null;
    };

    const detected = findMediaDeep(message);
    const mData = detected?.data || {};

    const messageType = detected?.type || (messageData.messageType === 'document' ? 'document' : 'text');
    const mediaUrl = mData.url || messageData.mediaUrl || payload.mediaUrl || null;
    const mediaMimeType = mData.mimetype || messageData.mimeType || null;
    
    const messageText = message.conversation || 
                      message.extendedTextMessage?.text || 
                      messageData.body || 
                      mData.caption || 
                      mData.title || 
                      mData.fileName ||
                      (messageType === 'document' ? 'Documento anexado' : '');

    const hasMedia = !!mediaUrl;
    console.log(`Extraction Result: type=${messageType}, hasMedia=${hasMedia}, url=${mediaUrl?.substring(0, 50)}...`);

    // Force allow if it has media or looks like an offer
    const looksLikeOffer = /\d+[,.]?\d{0,2}\s*$|\bdata\b|\boferta\b|\bencarte\b/mi.test(messageText);

    if (!hasMedia && !looksLikeOffer && messageText.length < 5) {
      console.log('Filtered out: no media and too short text');
      return new Response(JSON.stringify({ status: 'ignored' }), { headers: corsHeaders });
    }

    // Init Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Save
    const { data: savedMsg, error: saveError } = await supabase
      .from('whatsapp_inbox')
      .insert({
        remote_jid: remoteJid,
        sender: sender,
        sender_name: messageData?.pushName || sender,
        message_text: messageText || `[${messageType}]`,
        message_type: messageType,
        media_url: mediaUrl,
        media_mime_type: mediaMimeType,
        raw_payload: payload,
        status: 'pending',
      })
      .select()
      .single();

    if (saveError) {
      console.error('INSERT ERROR:', saveError);
      throw saveError;
    }

    console.log(`✅ Inbox Success: ${savedMsg.id}`);

    return new Response(JSON.stringify({ 
      status: 'saved',
      id: savedMsg.id,
      sender: sender,
      type: messageType
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
