
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://ebvvmddizsggrqasnnvv.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVidnZtZGRpenNnZ3JxYXNubnZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MjQ0ODgsImV4cCI6MjA5MDUwMDQ4OH0.CJ2pUVa1yyZx8L3myNOjPKYLT33YEHWDOCl45Y9LHMY";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLayouts() {
  const { data, error } = await supabase
    .from('offer_layouts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching layouts:', error);
    return;
  }

  if (data) {
    console.log('--- LAYOUTS DATA ---');
    console.log(JSON.stringify(data, null, 2));
    console.log('--- END ---');
  } else {
    console.log('No layouts found.');
  }
}

checkLayouts();
