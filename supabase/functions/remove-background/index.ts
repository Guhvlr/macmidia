import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now();
  try {
    const { imageUrl } = await req.json()
    console.log(`[INFO] Request received for imageUrl: ${imageUrl}`);
    
    if (!imageUrl) throw new Error('imageUrl is required')

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('[ERROR] No authorization header');
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      console.error('[ERROR] Invalid token:', userError?.message);
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }


    // Pegar a chave do Photoroom
    let photoroomKey = Deno.env.get('PHOTOROOM_API_KEY')
    if (!photoroomKey) {
      console.log('[INFO] API Key not found in env, checking settings table...');
      const { data: s } = await supabase.from('settings').select('value').eq('key', 'photoroom_api_key').single()
      photoroomKey = s?.value
    }
    
    if (!photoroomKey) {
      throw new Error('Chave da API do Photoroom não está configurada (env: PHOTOROOM_API_KEY ou tabela settings).')
    }

    // 1. Baixar a imagem original
    let imgBlob: Blob;
    const isInternal = imageUrl.includes(Deno.env.get('SUPABASE_URL') ?? '');
    
    try {
      if (isInternal) {
        console.log('[INFO] Internal project URL. Attempting Storage API download.');
        const pathParts = imageUrl.split('/public/product-images/');
        const fileName = pathParts[1]?.split('?')[0];
        
        const { data: downloadData, error: downloadError } = await supabase.storage
          .from('product-images')
          .download(fileName);
          
        if (downloadError) {
          console.warn(`[WARN] Storage download failed (${downloadError.message}). Falling back to fetch.`);
          const imgResponse = await fetch(imageUrl);
          if (!imgResponse.ok) throw new Error(`HTTP ${imgResponse.status} failure downloading image`);
          imgBlob = await imgResponse.blob();
        } else {
          imgBlob = downloadData;
        }
      } else {
        console.log('[INFO] External URL. Using fetch.');
        const imgResponse = await fetch(imageUrl);
        if (!imgResponse.ok) throw new Error(`HTTP ${imgResponse.status} failure downloading external image`);
        imgBlob = await imgResponse.blob();
      }
    } catch (e: any) {
      throw new Error(`Falha ao obter imagem original: ${e.message}`);
    }

    console.log(`[INFO] Image size: ${(imgBlob.size / 1024).toFixed(2)} KB. Sending to Photoroom...`);

    // 2. Enviar para Photoroom API v2 (Para recortar o fundo E remover as margens vazias)
    const formData = new FormData();
    formData.append('image_file', imgBlob);
    formData.append('background.color', 'transparent');
    formData.append('outputSize', 'croppedSubject');

    const phResponse = await fetch('https://sdk.photoroom.com/v2/edit', {
      method: 'POST',
      headers: { 'x-api-key': photoroomKey },
      body: formData
    });

    if (!phResponse.ok) {
      const errText = await phResponse.text();
      let errorMsg = `Photoroom API Error: ${phResponse.status}`;
      if (phResponse.status === 402) errorMsg = "Créditos do Photoroom insuficientes.";
      if (phResponse.status === 429) errorMsg = "Muitas requisições ao Photoroom. Tente novamente em instantes.";
      console.error(`[ERROR] ${errorMsg} - ${errText}`);
      throw new Error(errorMsg);
    }

    const cutBlob = await phResponse.blob();
    const arrayBuffer = await cutBlob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    // Chunking to avoid stack overflow with btoa
    let binary = '';
    const chunk_size = 8192;
    for (let i = 0; i < bytes.length; i += chunk_size) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk_size) as any);
    }
    const base64 = btoa(binary);

    const duration = Date.now() - startTime;
    console.log(`[SUCCESS] Background removed in ${duration}ms. Returning base64.`);

    return new Response(JSON.stringify({ 
      success: true, 
      base64: `data:image/png;base64,${base64}`,
      duration
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error('[FATAL ERROR]:', error.message);
    return new Response(JSON.stringify({ 
      error: error.message,
      code: error.code || 'UNEXPECTED_ERROR'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
