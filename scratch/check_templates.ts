
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://ebvvmddizsggrqasnnvv.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVidnZtZGRpenNnZ3JxYXNubnZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MjQ0ODgsImV4cCI6MjA5MDUwMDQ4OH0.CJ2pUVa1yyZx8L3myNOjPKYLT33YEHWDOCl45Y9LHMY";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTemplates() {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'offer_generator_page_templates')
    .maybeSingle();

  if (error) {
    console.error('Error fetching templates:', error);
    return;
  }

  if (data?.value) {
    const templates = JSON.parse(data.value);
    console.log('--- TEMPLATES DATA ---');
    console.log(JSON.stringify(templates, null, 2));
    console.log('--- END ---');
  } else {
    console.log('No templates found in settings table.');
  }
}

checkTemplates();
