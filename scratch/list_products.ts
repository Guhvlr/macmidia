
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ebvvmddizsggrqasnnvv.supabase.co';
const supabaseKey = 'sb_publishable_AxiHBuzz8Cq82deFBen1iw_x-KRYotZ'; // Using anon key from client.ts

const supabase = createClient(supabaseUrl, supabaseKey)

async function listProducts() {
  console.log('Listing products...')
  const { data, error } = await supabase.from('products').select('name, ean').limit(20)
  
  if (error) {
    console.error('Error fetching products:', error)
    return
  }
  
  if (!data || data.length === 0) {
    console.log('No products found in the database.')
  } else {
    console.log(`Found ${data.length} products:`)
    data.forEach(p => console.log(`- ${p.name} (${p.ean})`))
  }
}

listProducts()
