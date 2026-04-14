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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Pegar a chave do Photoroom
    let photoroomKey = Deno.env.get('PHOTOROOM_API_KEY')
    if (!photoroomKey) {
      const { data: s } = await supabase.from('settings').select('value').eq('key', 'photoroom_api_key').single()
      photoroomKey = s?.value
    }
    
    if (!photoroomKey) {
      throw new Error('Chave da API do Photoroom não está configurada no banco (tabela settings: photoroom_api_key).')
    }

    // 1. Baixar a imagem original (isso previne erros caso a URL do Supabase recuse conexões diretas do Photoroom)
    console.log('Downloading original image:', imageUrl);
    const imgResponse = await fetch(imageUrl);
    if (!imgResponse.ok) throw new Error(`Erro ao baixar imagem: ${imgResponse.statusText}`);
    const imgBlob = await imgResponse.blob();

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
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

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
