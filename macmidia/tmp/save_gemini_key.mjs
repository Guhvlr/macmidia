import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://ebvvmddizsggrqasnnvv.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVidnZtZGRpenNnZ3JxYXNubnZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MjQ0ODgsImV4cCI6MjA5MDUwMDQ4OH0.CJ2pUVa1yyZx8L3myNOjPKYLT33YEHWDOCl45Y9LHMY";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const geminiKey = "AIzaSyDf9_A90L0UqxnUGbNDQGSO_mtN3lZb6QQ";

async function saveKey() {
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'gemini_api_key', value: geminiKey }, { onConflict: 'key' });

  if (error) {
    console.log("❌ ERRO AO SALVAR GEMINI KEY:", error.message);
  } else {
    console.log("✅ GEMINI API KEY SALVA COM SUCESSO!");
  }
}

saveKey();
