import { createClient } from '@supabase/supabase-js';

const url = 'https://ebvvmddizsggrqasnnvv.supabase.co';
const key = 'sb_publishable_AxiHBuzz8Cq82deFBen1iw_x-KRYotZ';

const supabase = createClient(url, key);

async function main() {
  const { data, error } = await supabase.from('offer_presets').select('*');
  console.log('Presets:', data?.length);
  if (error) console.error('Error fetching:', error);
  
  // Try inserting
  const { data: iData, error: iErr } = await supabase.from('offer_presets').insert({
    name: 'Test Preset',
    client: 'TEST',
    price_badge: {},
    desc_config: {}
  }).select();
  console.log('Insert Result:', iData);
  if (iErr) console.error('Insert Error:', iErr);
  
  // Try inserting missing desc_config
  const { data: iData2, error: iErr2 } = await supabase.from('offer_presets').insert({
    name: 'Test Preset 2',
    client: 'TEST',
    price_badge: {}
  }).select();
  console.log('Insert 2 Result:', iData2);
  if (iErr2) console.error('Insert 2 Error:', iErr2);
}

main();
