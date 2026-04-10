
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://ebvvmddizsggrqasnnvv.supabase.co";
const supabaseKey = "sb_publishable_AxiHBuzz8Cq82deFBen1iw_x-KRYotZ";

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectProject() {
  console.log('Project ID: ebvvmddizsggrqasnnvv');
  
  // List all tables we know about
  const tables = ['settings', 'offer_layouts', 'calendar_clients', 'employees', 'kanban_cards'];
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(5);
      if (error) {
        console.log(`Table ${table}: Error ${error.message}`);
      } else {
        console.log(`Table ${table}: found ${data?.length || 0} rows. Sample:`, data?.[0] ? JSON.stringify(data[0]).substring(0, 100) : 'none');
      }
    } catch (e) {
      console.log(`Table ${table}: hard error`);
    }
  }
}

inspectProject();
