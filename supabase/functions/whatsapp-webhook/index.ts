// =====================================================
// Supabase Edge Function: WhatsApp Webhook (DIAGNOSTIC-JSON-FIX V19)
// =====================================
// IDENTIFICAÇÃO DE GRUPOS COM DADOS REAIS DA EVOLUTION
// 
// Deploy: supabase functions deploy whatsapp-webhook --no-verify-jwt
// =====================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import * as XLSX from 'https://esm.sh/xlsx';
import mammoth from 'https://esm.sh/mammoth';

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
    
    if (event !== 'messages.upsert' && event !== 'MESSAGES_UPSERT' && event !== 'messages.update' && event !== 'MESSAGES_UPDATE') {
      return new Response(JSON.stringify({ status: 'ignored' }), { headers: corsHeaders });
    }

    const messageData = payload.data || payload;
    const message = messageData.message || messageData;
    const key = messageData.key || message.key || {};
    const remoteJid = key.remoteJid || messageData.remoteJid || '';
    const sender = key.participant || key.remoteJid || '';
    
    // --- 🏆 CHAVES REAIS DO JSON 🏆 ---
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
    
    let messageText = message.conversation || message.extendedTextMessage?.text || messageData.body || mData.caption || '';
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
      } catch (e) {
        console.error('[GROUP-FIX ERROR]:', e.message);
      }
    }

    // Fallback por texto (Se Mandar "NOME OFERTA")
    const firstLine = messageText.split('\n')[0].trim().toUpperCase();
    if (firstLine.includes('OFERTA') || firstLine.includes('ENCARTE')) {
       const possibleName = firstLine.replace(/OFERTA|ENCARTE|TABLOIDE|FINAL|DE|SEMANA|SEQUENCIA|SIM|NÃO/gi, '').trim();
       if (possibleName.length >= 3 && possibleName.length < 25) {
         finalSenderName = possibleName;
       }
    }

    // --- 🏆 EXTRAÇÃO DE DOCUMENTOS ULTRA-RESILIENTE 🏆 ---
    if (messageType === 'document') {
      try {
        // 1. Busca profunda pela URL (Evolution v1, v2 e mData)
        const finalUrl = mediaUrl || mData.url || payload.data?.message?.documentMessage?.url || payload.data?.message?.url;
        
        // 2. Busca pelo nome do arquivo para identificar Excel/Word
        const rawFileName = mData.fileName || mData.caption || payload.data?.message?.documentMessage?.fileName || '';
        const fileName = (rawFileName || '').toLowerCase();
        const mime = (mediaMimeType || '').toLowerCase();
        
        const isExcel = mime.includes('excel') || mime.includes('spreadsheet') || mime.includes('sheet') || fileName.includes('.xls') || fileName.includes('.xlsx');
        const isWord = mime.includes('word') || mime.includes('officedocument.wordprocessingml') || fileName.includes('.doc') || fileName.includes('.docx');

        if (finalUrl && (isExcel || isWord)) {
          // Se reconheceu, tenta baixar e ler
          const fileResp = await fetch(finalUrl, { 
            headers: { 'apikey': evoApiKey || '' },
            signal: AbortSignal.timeout(15000)
          });

          if (fileResp.ok) {
            const arrayBuffer = await fileResp.arrayBuffer();
            if (isExcel) {
              const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
              let extractedText = '';
              workbook.SheetNames.forEach(sheet => {
                const txt = XLSX.utils.sheet_to_txt(workbook.Sheets[sheet]);
                if (txt.trim()) extractedText += `--- Planilha: ${sheet} ---\n${txt}\n\n`;
              });
              if (extractedText.trim()) messageText = `✅ [CONTEÚDO EXCEL]:\n${extractedText.trim()}`;
            } else if (isWord) {
              const res = await mammoth.extractRawText({ arrayBuffer });
              if (res.value.trim()) messageText = `✅ [CONTEÚDO WORD]:\n${res.value.trim()}`;
            }
          } else {
             console.error(`[DOC-EXTRACT] Erro download: ${fileResp.status}`);
          }
        }
      } catch (err) {
        console.error('[DOC-EXTRACT ERROR]:', err.message);
      }
    }

    const { data: savedMsg, error: saveError } = await supabase
      .from('whatsapp_inbox')
      .insert({
        remote_jid: remoteJid,
        sender: sender,
        sender_name: finalSenderName,
        message_text: messageText,
        message_type: messageType,
        media_url: mediaUrl,
        media_mime_type: mediaMimeType,
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
    console.error('Webhook Runtime Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
