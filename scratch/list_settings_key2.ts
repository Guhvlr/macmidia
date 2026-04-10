
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://ebvvmddizsggrqasnnvv.supabase.co";
const supabaseKey = "sb_publishable_AxiHBuzz8Cq82deFBen1iw_x-KRYotZ";

const supabase = createClient(supabaseUrl, supabaseKey);

async function listAllSettings() {
  const { data, error } = await supabase
    .from('settings')
    .select('*');

  if (error) {
    console.error('Error fetching settings:', error);
    return;
  }

  if (data) {
    console.log('--- ALL SETTINGS ---');
    console.log(JSON.stringify(data, null, 2));
    console.log('--- END ---');
  } else {
    console.log('No settings found.');
  }
}

listAllSettings();
