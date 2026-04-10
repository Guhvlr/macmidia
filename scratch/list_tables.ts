
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://ebvvmddizsggrqasnnvv.supabase.co";
const supabaseKey = "sb_publishable_AxiHBuzz8Cq82deFBen1iw_x-KRYotZ";

const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
  const { data, error } = await supabase
    .from('settings')
    .select('key')
    .limit(10);

  if (error) {
    console.error('Error fetching settings keys:', error);
  } else {
    console.log('Settings keys found:', data);
  }

  const { data: layouts, error: layoutsError } = await supabase
    .from('offer_layouts')
    .select('name')
    .limit(10);

  if (layoutsError) {
    console.error('Error fetching layouts names:', layoutsError);
  } else {
    console.log('Layouts names found:', layouts);
  }
}

listTables();
