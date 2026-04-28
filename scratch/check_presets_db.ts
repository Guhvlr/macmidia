import { createClient } from '@supabase/supabase-js';

const url = 'https://ebvvmddizsggrqasnnvv.supabase.co';
const key = 'sb_publishable_AxiHBuzz8Cq82deFBen1iw_x-KRYotZ';

const supabase = createClient(url, key);

async function main() {
  const { data, error } = await supabase.from('offer_presets').select('*');
  console.log('Presets from DB:', data?.length);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

main();
