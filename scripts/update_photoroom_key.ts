import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function updateKey() {
  const { error } = await supabase
    .from('settings')
    .update({ value: 'sk_pr_default_7b7fae7481896cbd2ea891a1a119ecccecbea088' })
    .eq('key', 'photoroom_api_key')

  if (error) {
    console.error('Error updating key:', error)
  } else {
    console.log('Successfully updated Photoroom API key in settings table.')
  }
}

updateKey()
