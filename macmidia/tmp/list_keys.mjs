import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://ebvvmddizsggrqasnnvv.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVidnZtZGRpenNnZ3JxYXNubnZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MjQ0ODgsImV4cCI6MjA5MDUwMDQ4OH0.CJ2pUVa1yyZx8L3myNOjPKYLT33YEHWDOCl45Y9LHMY";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function listKeys() {
  const { data, error } = await supabase.from('settings').select('key');
  if (error) {
    console.log("❌ ERRO AO LER SETTINGS:", error.message);
    return;
  }
  console.log("Chaves encontradas na tabela settings:");
  console.log(data.map(d => d.key));
}

listKeys();
