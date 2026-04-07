import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://ebvvmddizsggrqasnnvv.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVidnZtZGRpenNnZ3JxYXNubnZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MjQ0ODgsImV4cCI6MjA5MDUwMDQ4OH0.CJ2pUVa1yyZx8L3myNOjPKYLT33YEHWDOCl45Y9LHMY";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const visionKey = "AIzaSyB2ModEtQ3_iqYhof_dSjD80ZWv88gRCFc";

async function saveAndTest() {
  console.log("1. Tentando salvar a chave na tabela settings...");
  
  const { error: saveError } = await supabase
    .from('settings')
    .upsert({ key: 'google_vision_api_key', value: visionKey }, { onConflict: 'key' });

  if (saveError) {
    console.log("⚠️ NÃO FOI POSSÍVEL SALVAR NO BANCO (ERRO RLS):", saveError.message);
    console.log("Vou prosseguir apenas com o teste da chave...");
  } else {
    console.log("✅ CHAVE SALVA COM SUCESSO NO BANCO!");
  }

  console.log("\n2. Testando Google Vision API com a chave fornecida...");

  // Imagem pública para teste (Logo do Google)
  const imageUrl = "https://logo-print.com/wp-content/uploads/2021/04/google-logo.png";
  
  try {
    const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${visionKey}`, {
      method: "POST",
      body: JSON.stringify({
        requests: [{
          image: { source: { imageUri: imageUrl } },
          features: [{ type: "TEXT_DETECTION" }]
        }]
      })
    });

    const data = await response.json();
    
    if (data.error) {
      console.log("❌ ERRO DA API DO GOOGLE:", data.error.message);
      return;
    }

    const text = data.responses?.[0]?.textAnnotations?.[0]?.description;
    if (text) {
      console.log("\n🚀 SUCESSO TOTAL! A API leu o seguinte texto:");
      console.log("------------------------------------------");
      console.log(text.trim());
      console.log("------------------------------------------");
      console.log("\nA API do Google está ATIVA e funcionando!");
    } else {
      console.log("\n⚠️ A API respondeu OK, mas não detectou texto.");
      console.log("Response:", JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.log("\n❌ ERRO NA CONEXÃO:", err.message);
  }
}

saveAndTest();
