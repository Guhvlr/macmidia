import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value) {
    env[key.trim()] = value.join('=').trim().replace(/^"|"$/g, '');
  }
});

const supabase = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']);

async function run() {
  const tables = ['kanban_cards', 'whatsapp_inbox', 'calendar_tasks'];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  for (const table of tables) {
    const { count } = await supabase.from(table).select('*', { count: 'exact', head: true }).gte('created_at', yesterday);
    console.log(`${table} inserts last 24h:`, count);
  }
}
run();
