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
      try {
        if (evoServer && evoApiKey && evoInstance) {
          const groupUrl = `${evoServer.replace(/\/$/, '')}/group/findGroupInfos/${evoInstance}?groupJid=${remoteJid}`;
          console.log(`[JSON-FIX] Buscando informações do grupo: ${groupUrl}`);
          
          const groupResp = await fetch(groupUrl, { headers: { 'apikey': evoApiKey } });
          const groupData = groupResp.ok ? await groupResp.json() : null;
          
          if (groupData?.subject) {
            finalSenderName = groupData.subject;
            console.log(`[JSON-FIX] Sucesso: Nome definido como ${finalSenderName}`);
          } else {
             // Fallback por Memória Interna do Banco
             const { data: prevMsg } = await supabase
               .from('whatsapp_inbox')
               .select('sender_name')
               .eq('remote_jid', remoteJid)
               .not('sender_name', 'eq', messageData?.pushName)
               .order('created_at', { ascending: false })
               .limit(1)
               .maybeSingle();

             if (prevMsg?.sender_name) finalSenderName = prevMsg.sender_name;
          }
        }
      } catch (e) {
        console.error('[JSON-FIX ERROR]:', e.message);
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

    // --- 🏆 EXTRAÇÃO DE CONTEÚDO DE DOCUMENTOS (EXCEL/WORD) 🏆 ---
    if (messageType === 'document' && mediaUrl) {
      console.log(`[DOC-EXTRACT] Identificado documento: ${mediaUrl}`);
      try {
        const fileName = (mData.fileName || mData.caption || '').toLowerCase();
        const mime = (mediaMimeType || '').toLowerCase();
        
        const isExcel = mime.includes('excel') || mime.includes('spreadsheet') || mime.includes('sheet') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
        const isWord = mime.includes('word') || mime.includes('officedocument.wordprocessingml') || fileName.endsWith('.docx') || fileName.endsWith('.doc');

        if (isExcel || isWord) {
          messageText = `${messageText}\n🔄 [SISTEMA]: Lendo arquivo ${isExcel ? 'Excel' : 'Word'}... Aguarde.`;
          
          const fileResp = await fetch(mediaUrl, { 
            headers: { 'apikey': evoApiKey || '' },
            signal: AbortSignal.timeout(15000) // 15 segundos de timeout
          });

          if (fileResp.ok) {
            const arrayBuffer = await fileResp.arrayBuffer();
            console.log(`[DOC-EXTRACT] Arquivo baixado: ${arrayBuffer.byteLength} bytes.`);
            
            if (isExcel) {
              const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
              let extractedText = '';
              workbook.SheetNames.forEach(sheetName => {
                const worksheet = workbook.Sheets[sheetName];
                const text = XLSX.utils.sheet_to_txt(worksheet);
                if (text.trim()) {
                  extractedText += `--- Planilha: ${sheetName} ---\n${text}\n\n`;
                }
              });
              
              if (extractedText.trim()) {
                messageText = `✅ [CONTEÚDO EXTRAÍDO DO EXCEL]:\n${extractedText.trim()}`;
              } else {
                messageText = `⚠️ [SISTEMA]: O Excel foi lido, mas parece estar vazio ou sem texto.`;
              }
            } else if (isWord) {
              const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
              if (result.value.trim()) {
                messageText = `✅ [CONTEÚDO EXTRAÍDO DO WORD]:\n${result.value.trim()}`;
              } else {
                messageText = `⚠️ [SISTEMA]: O Word foi lido, mas não encontramos texto dentro dele.`;
              }
            }
          } else {
            messageText = `❌ [ERRO SISTEMA]: Não consegui baixar o arquivo (Status: ${fileResp.status}).`;
            console.error(`[DOC-EXTRACT] Erro no fetch: ${fileResp.status}`);
          }
        }
      } catch (docErr) {
        messageText = `❌ [ERRO SISTEMA]: Falha no processamento. ${docErr.message}`;
        console.error('[DOC-EXTRACT ERROR]:', docErr.message);
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
