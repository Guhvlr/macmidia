
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ebvvmddizsggrqasnnvv.supabase.co';
const supabaseKey = 'sb_publishable_AxiHBuzz8Cq82deFBen1iw_x-KRYotZ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.storage.listBuckets();
  if (error) {
    console.error(error);
  } else {
    console.log('Buckets:', JSON.stringify(data, null, 2));
    for (const b of data) {
      const { data: files, error: ferr } = await supabase.storage.from(b.id).list('', { limit: 5 });
      if (!ferr) {
        console.log(`Files in ${b.id}:`, JSON.stringify(files, null, 2));
      }
    }
  }
}

check();
