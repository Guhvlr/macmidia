import { supabase } from './src/integrations/supabase/client';

async function test() {
  const { data, error } = await (supabase as any).from('offer_presets').select('*').limit(1);
  if (error) {
    console.log('offer_presets table does not exist:', error.message);
  } else {
    console.log('offer_presets table exists!');
  }
  
  const { data: sData, error: sError } = await (supabase as any).from('offer_layouts').select('*').limit(1);
  if (sError) {
    console.log('offer_layouts table does not exist:', sError.message);
  } else {
    console.log('offer_layouts table exists!');
  }
}

test();
