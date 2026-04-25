
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL="(.*)"/)?.[1];
const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY="(.*)"/)?.[1];

if (!url || !key) {
    console.log('Env content:', env);
    console.error('Could not find Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(url.trim(), key.trim());

async function checkEmployees() {
  const { data, error } = await supabase.from('employees').select('id, name');
  if (error) {
    console.error('Error:', error);
    return;
  }
  console.log('Employees found:', JSON.stringify(data));
}

checkEmployees();
