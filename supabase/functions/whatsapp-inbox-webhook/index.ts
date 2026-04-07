// =====================================================
// Supabase Edge Function: WhatsApp Inbox (JSON-FIX V19)
// =====================================
// IDENTIFICAÇÃO DE GRUPOS COM DADOS REAIS DA EVOLUTION
// 
// Deploy: supabase functions deploy whatsapp-inbox-webhook --no-verify-jwt
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
      try {
        if (evoServer && evoApiKey && evoInstance) {
          const groupUrl = `${evoServer.replace(/\/$/, '')}/group/findGroupInfos/${evoInstance}?groupJid=${remoteJid}`;
          console.log(`[JSON-FIX] Buscando informações do grupo: ${groupUrl}`);

          const groupResp = await fetch(groupUrl, { headers: { 'apikey': evoApiKey } });
          const groupData = groupResp.ok ? await groupResp.json() : null;

          if (groupData?.subject) {
            finalSenderName = groupData.subject;
            console.log(`[JSON-FIX] Sucesso: Nome definido como ${finalSenderName}`);
          }
        }
      } catch (e) {
        console.error('[JSON-FIX ERROR]:', e.message);
      }
    }

    // --- 🏆 SUPER EXTRAÇÃO DE DOCUMENTOS (DIAGNÓSTICO INTEGRADO) 🏆 ---
    if (messageType === 'document') {
      const fileName = (mData.fileName || mData.caption || mData.directPath || mData.url || '').toLowerCase();
      const mime = (mediaMimeType || '').toLowerCase();
      
      const isExcel = mime.includes('excel') || mime.includes('spreadsheet') || mime.includes('sheet') || fileName.includes('.xlsx') || fileName.includes('.xls');
      const isWord = mime.includes('word') || mime.includes('officedocument.wordprocessingml') || fileName.includes('.docx') || fileName.includes('.doc');

      // Se identificado, tenta extrair. Se não, mostra diagnóstico.
      if (mediaUrl && (isExcel || isWord)) {
        messageText = `${messageText}\n🔄 [SISTEMA]: Lendo arquivo ${isExcel ? 'Excel' : 'Word'}... Aguarde.`;
        try {
          const fileResp = await fetch(mediaUrl, { 
            headers: { 'apikey': evoApiKey || '' },
            signal: AbortSignal.timeout(15000)
          });

          if (fileResp.ok) {
            const arrayBuffer = await fileResp.arrayBuffer();
            if (isExcel) {
              const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
              let extractedText = '';
              workbook.SheetNames.forEach(sheetName => {
                const worksheet = workbook.Sheets[sheetName];
                const text = XLSX.utils.sheet_to_txt(worksheet);
                if (text.trim()) extractedText += `--- Planilha: ${sheetName} ---\n${text}\n\n`;
              });
              if (extractedText.trim()) messageText = `✅ [CONTEÚDO EXTRAÍDO DO EXCEL]:\n${extractedText.trim()}`;
              else messageText = `⚠️ [SISTEMA]: O Excel foi lido, mas parece não ter texto.`;
            } else {
              const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
              if (result.value.trim()) messageText = `✅ [CONTEÚDO EXTRAÍDO DO WORD]:\n${result.value.trim()}`;
              else messageText = `⚠️ [SISTEMA]: O Word foi lido, mas não encontramos texto.`;
            }
          } else {
            messageText = `❌ [ERRO SISTEMA]: Link de download falhou (Status: ${fileResp.status}).\n🌐 URL: ${mediaUrl}`;
          }
        } catch (err) {
          messageText = `❌ [ERRO EXTRAÇÃO]: ${err.message}.\n📍 URL Tentada: ${mediaUrl}`;
        }
      } else {
        // DIAGNÓSTICO: Se caiu aqui, é porque não reconhecemos como Excel/Word ou não tem URL
        const debugInfo = JSON.stringify({ 
          type: messageType, 
          mime: mediaMimeType, 
          hasUrl: !!mediaUrl,
          fileNameInsideMData: mData.fileName || 'NÃO ENCONTRADO',
          keysInMData: Object.keys(mData)
        }, null, 2);
        
        messageText = `🔎 [DIAGNÓSTICO DE ARQUIVO]:\nO sistema não reconheceu este documento como Excel/Word automático.\n\nMETADADOS RECEBIDOS:\n${debugInfo}\n\nSe isso for um Excel, copie o texto acima e envie para o suporte.`;
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
