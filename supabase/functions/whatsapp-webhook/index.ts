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
    console.log('[DEBUG] Webhook recebido - Evento:', payload.event || payload.type);

    const messageData = payload.data || payload;
    const message = messageData.message || messageData;
    const key = messageData.key || message.key || {};
    const remoteJid = key.remoteJid || messageData.remoteJid || '';
    const sender = key.participant || key.remoteJid || '';
    
    // Extração robusta do ID para desduplicação
    const whatsappMessageId = (key.id || messageData.id || '').toString() || null;

    // 1️⃣ VERIFICA DUPLICATA (EVITA LOOPS)
    if (whatsappMessageId) {
      const { data: existing } = await supabase
        .from('whatsapp_inbox')
        .select('id')
        .eq('whatsapp_message_id', whatsappMessageId)
        .maybeSingle();
      
      if (existing) {
        console.log(`[DEDUP] Mensagem duplicada ignorada: ${whatsappMessageId}`);
        return new Response(JSON.stringify({ status: 'ignored', reason: 'duplicate' }), { headers: corsHeaders });
      }
    }

    const evoServer = payload.server_url;
    const evoApiKey = payload.apikey;
    const evoInstance = payload.instance;

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
    const mediaUrl = mData.url || messageData.mediaUrl || payload.mediaUrl || null;
    const mediaMimeType = mData.mimetype || messageData.mimeType || null;

    let messageText = message.conversation || 
                      message.extendedTextMessage?.text || 
                      message.text || 
                      messageData.body || 
                      messageData.content || 
                      messageData.text || 
                      mData.caption || 
                      '';
    
    messageText = messageText.replace(/\[(image|video|document|audio|sticker|imagem|áudio|vídeo)\]/gi, '').trim();

    // 🏆 LÓGICA DE NOME (FOCADA NO GRUPO) 🏆
    let finalSenderName = messageData?.pushName || sender;

    if (remoteJid.endsWith('@g.us')) {
      finalSenderName = 'Grupo sem Nome';
      try {
        if (evoServer && evoApiKey && evoInstance) {
          const groupUrl = `${evoServer.replace(/\/$/, '')}/group/findGroupInfos/${evoInstance}?groupJid=${remoteJid}`;
          const groupResp = await fetch(groupUrl, { 
            headers: { 'apikey': evoApiKey },
            signal: AbortSignal.timeout(5000)
          });
          if (groupResp.ok) {
            const groupData = await groupResp.json();
            if (groupData?.subject) {
              finalSenderName = groupData.subject;
            }
          }
        }
        if (finalSenderName === 'Grupo sem Nome') {
          const { data: prevMsg } = await supabase
            .from('whatsapp_inbox')
            .select('sender_name')
            .eq('remote_jid', remoteJid)
            .neq('sender_name', 'Grupo sem Nome')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (prevMsg?.sender_name) finalSenderName = prevMsg.sender_name;
        }
      } catch (e: any) {
        console.error('[GROUP-FIX ERROR]:', e.message);
      }
    }

    // 2️⃣ SANITIZAÇÃO DO PAYLOAD (ECONOMIA DE MEMÓRIA)
    const sanitize = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return obj;
      const newObj = Array.isArray(obj) ? [...obj] : { ...obj };
      for (const k in newObj) {
        if (typeof newObj[k] === 'string' && (newObj[k].length > 1000 || newObj[k].startsWith('data:'))) {
          newObj[k] = '[HIDDEN-BY-CLEANUP]';
        } else if (typeof newObj[k] === 'object') {
          newObj[k] = sanitize(newObj[k]);
        }
      }
      return newObj;
    };
    const cleanPayload = sanitize(payload);

    // 3️⃣ SALVA IMEDIATAMENTE (GARANTE O RECEBIMENTO)
    const messageDataToInsert: any = {
      remote_jid: remoteJid,
      sender: sender,
      sender_name: finalSenderName,
      message_text: messageText,
      message_type: messageType,
      media_url: mediaUrl,
      media_mime_type: mediaMimeType,
      raw_payload: cleanPayload,
      status: 'pending',
    };

    if (whatsappMessageId) {
      messageDataToInsert.whatsapp_message_id = whatsappMessageId;
    }

    const { data: savedMsg, error: saveError } = await supabase
      .from('whatsapp_inbox')
      .insert(messageDataToInsert)
      .select()
      .single();

    if (saveError) {
      console.error('[DATABASE SAVE ERROR]:', saveError.message);
      
      if (saveError.message.includes('whatsapp_message_id')) {
        delete messageDataToInsert.whatsapp_message_id;
        const { data: retryMsg, error: retryError } = await supabase
          .from('whatsapp_inbox')
          .insert(messageDataToInsert)
          .select()
          .single();
        
        if (retryError) throw retryError;
        return new Response(JSON.stringify({ status: 'saved-without-id', id: retryMsg?.id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ status: 'ignored', error: saveError.message }), { 
        status: 200, headers: corsHeaders 
      });
    }

    return new Response(JSON.stringify({ status: 'saved', id: savedMsg?.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Webhook Runtime Error:', error.message);
    return new Response(JSON.stringify({ error: error.message, status: 'fail-safe' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
