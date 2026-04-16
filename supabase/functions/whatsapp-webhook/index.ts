import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const payload = await req.json();
    const event = payload.event || payload.type;
    
    // Ignora eventos que não são de mensagem
    if (event !== 'messages.upsert' && event !== 'MESSAGES_UPSERT' && event !== 'messages.update' && event !== 'MESSAGES_UPDATE') {
      return new Response(JSON.stringify({ status: 'ignored' }), { headers: corsHeaders });
    }

    const messageData = payload.data || payload;
    const message = messageData.message || messageData;
    const key = messageData.key || message.key || {};
    const remoteJid = key.remoteJid || messageData.remoteJid || '';
    const sender = key.participant || key.remoteJid || '';
    
    // Identifica o tipo de mídia de forma simples
    const findMediaDeep = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return null;
      const mediaKeys = ['imageMessage', 'documentMessage', 'videoMessage', 'audioMessage', 'stickerMessage'];
      for (const k of mediaKeys) if (obj[k]) return { type: k.replace('Message', ''), data: obj[k] };
      for (const k in obj) { const found = findMediaDeep(obj[k]); if (found) return found; }
      return null;
    };

    const detected = findMediaDeep(message);
    const mData = detected?.data || {};
    const messageType = detected?.type || (messageData.messageType === 'document' ? 'document' : 'text');
    
    // Define o texto inicial
    let messageText = message.conversation || message.extendedTextMessage?.text || messageData.body || mData.caption || '';
    
    // Se for um documento pesado (Excel/Word), apenas avisamos
    if (messageType === 'document') {
      messageText = `[Documento Recebido: ${mData.fileName || 'Sem nome'}] - Clique em 'Extrair Arquivo' para ler o conteúdo.`;
    }

    // Nome do remetente (Lógica simplificada)
    let finalSenderName = messageData?.pushName || sender;

    // Salva no Inbox (Rápido e sem processamento pesado)
    const { data: savedMsg, error: saveError } = await supabase
      .from('whatsapp_inbox')
      .insert({
        remote_jid: remoteJid,
        sender: sender,
        sender_name: finalSenderName,
        message_text: messageText,
        message_type: messageType,
        media_url: mData.url || null,
        media_mime_type: mData.mimetype || null,
        raw_payload: payload,
        status: 'pending',
      })
      .select()
      .single();

    if (saveError) throw saveError;
    return new Response(JSON.stringify({ status: 'saved', id: savedMsg.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Webhook Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

