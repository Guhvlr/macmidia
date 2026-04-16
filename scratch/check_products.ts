
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ebvvmddizsggrqasnnvv.supabase.co';
const supabaseKey = 'sb_publishable_AxiHBuzz8Cq82deFBen1iw_x-KRYotZ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('products').select('*').limit(5);
  if (error) {
    console.error(error);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

check();
