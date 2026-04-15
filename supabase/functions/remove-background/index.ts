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

  try {
    const { imageUrl } = await req.json()
    if (!imageUrl) throw new Error('imageUrl is required')

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
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
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }


    // Pegar a chave do Photoroom
    let photoroomKey = Deno.env.get('PHOTOROOM_API_KEY')
    if (!photoroomKey) {
      const { data: s } = await supabase.from('settings').select('value').eq('key', 'photoroom_api_key').single()
      photoroomKey = s?.value
    }
    
    if (!photoroomKey) {
      throw new Error('Chave da API do Photoroom não está configurada no banco (tabela settings: photoroom_api_key).')
    }

    // 1. Baixar a imagem original
    // Tentamos baixar primeiro via Storage API interna (mais confiável) se for uma URL do próprio projeto
    let imgBlob: Blob;
    
    if (imageUrl.includes(Deno.env.get('SUPABASE_URL') ?? '')) {
      console.log('Internal project URL detected. Using Storage API download.');
      const pathParts = imageUrl.split('/public/product-images/');
      const fileName = pathParts[1]?.split('?')[0]; // Remove timestamp
      
      const { data: downloadData, error: downloadError } = await supabase.storage
        .from('product-images')
        .download(fileName);
        
      if (downloadError) {
        console.warn('Storage API download failed, falling back to fetch:', downloadError.message);
        const imgResponse = await fetch(imageUrl);
        if (!imgResponse.ok) throw new Error(`Erro ao baixar imagem: ${imgResponse.statusText}`);
        imgBlob = await imgResponse.blob();
      } else {
        imgBlob = downloadData;
      }
    } else {
      console.log('External URL detected. Using fetch:', imageUrl);
      const imgResponse = await fetch(imageUrl);
      if (!imgResponse.ok) throw new Error(`Erro ao baixar imagem: ${imgResponse.statusText}`);
      imgBlob = await imgResponse.blob();
    }

    // 2. Enviar para Photoroom
    console.log('Sending to Photoroom...');
    const formData = new FormData();
    formData.append('image_file', imgBlob);
    formData.append('format', 'png');

    const phResponse = await fetch('https://sdk.photoroom.com/v1/segment', {
      method: 'POST',
      headers: {
        'x-api-key': photoroomKey
      },
      body: formData
    });

    if (!phResponse.ok) {
      const errText = await phResponse.text();
      throw new Error(`Photoroom API Error: ${phResponse.status} ${errText}`);
    }

    const cutBlob = await phResponse.blob();
    const arrayBuffer = await cutBlob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    // Chunking to avoid Maximum call stack size exceeded
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    return new Response(JSON.stringify({ 
      success: true, 
      base64: `data:image/png;base64,${base64}` 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error('ERROR:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
