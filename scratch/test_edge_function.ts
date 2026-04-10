
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://ebvvmddizsggrqasnnvv.supabase.co";
const supabaseKey = "sb_publishable_AxiHBuzz8Cq82deFBen1iw_x-KRYotZ";

const supabase = createClient(supabaseUrl, supabaseKey);

async function testProcessProducts() {
  const bulkInput = "Leite Italac R$ 5,99";
  console.log('Testing bulk input:', bulkInput);
  
  try {
    const { data, error } = await (supabase as any).functions.invoke('process-products', { 
      body: { bulkInput } 
    });
    
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Hard error:', e);
  }
}

testProcessProducts();
