
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ebvvmddizsggrqasnnvv.supabase.co';
const supabaseKey = 'sb_publishable_AxiHBuzz8Cq82deFBen1iw_x-KRYotZ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.rpc('search_products_fuzzy', { search_text: 'test' });
  if (error) {
    console.error('RPC Error:', error);
  } else {
    console.log('RPC Result:', JSON.stringify(data, null, 2));
  }
}

check();
