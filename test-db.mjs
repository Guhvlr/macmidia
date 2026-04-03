import { createClient } from '@supabase/supabase-js';

process.loadEnvFile('.env');

async function run() {
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);
  
  console.log("Checking whatsapp_messages...");
  const { data: msgs, error: msgsErr } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (msgsErr) console.error("Error msgs:", msgsErr);
  else console.log("Messages (last 5):", JSON.stringify(msgs, null, 2));

  console.log("\nChecking cards...");
  const { data: cards, error: cardsErr } = await supabase
    .from('kanban_cards')
    .select('id, client_name, source, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (cardsErr) console.error("Error cards:", cardsErr);
  // else console.log("Cards (last 5):", cards);
}

run();
