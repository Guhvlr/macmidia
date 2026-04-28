import { createClient } from '@supabase/supabase-js';

const url = 'https://ebvvmddizsggrqasnnvv.supabase.co';
const key = 'sb_publishable_AxiHBuzz8Cq82deFBen1iw_x-KRYotZ';

const supabase = createClient(url, key);

async function main() {
  const { data: iData, error: iErr } = await supabase.from('offer_templates').insert({
    name: 'Test Template',
    client: 'TEST'
  }).select();
  console.log('Template Insert Result:', iData);
  if (iErr) console.error('Template Insert Error:', iErr);
}

main();
