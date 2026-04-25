
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkEmployees() {
  const { data, error } = await supabase.from('employees').select('id, name');
  if (error) {
    console.error('Error:', error);
    return;
  }
  console.log('Employees found:', data);
}

checkEmployees();
