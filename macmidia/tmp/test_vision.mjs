import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://ebvvmddizsggrqasnnvv.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVidnZtZGRpenNnZ3JxYXNubnZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MjQ0ODgsImV4cCI6MjA5MDUwMDQ4OH0.CJ2pUVa1yyZx8L3myNOjPKYLT33YEHWDOCl45Y9LHMY";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testVision() {
  const { data: settingsData } = await supabase.from('settings').select('value').eq('key', 'google_vision_api_key').single();
  const visionKey = settingsData?.value;
  
  if (!visionKey) {
    console.log("ERRO: google_vision_api_key não encontrada na tabela settings.");
    return;
  }

  console.log("Chave encontrada! Testando Google Vision API...");

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
      console.log("❌ ERRO DA API:", data.error.message);
      return;
    }

    const text = data.responses?.[0]?.textAnnotations?.[0]?.description;
    if (text) {
      console.log("\n✅ SUCESSO! A API está ativa e leu o seguinte texto:");
      console.log("------------------------------------------");
      console.log(text);
      console.log("------------------------------------------");
    } else {
      console.log("\n⚠️ A API respondeu com sucesso, mas não detectou texto na imagem de teste.");
      console.log("Response:", JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.log("\n❌ ERRO NA CONEXÃO:", err.message);
  }
}

testVision();
