
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL || 'https://ebvvmddizsggrqasnnvv.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkProduct() {
  const query = 'ARROZ SAFRA 5KG'
  console.log(`Checking results for: "${query}"`)

  // 1. Direct match
  const { data: direct } = await supabase.from('products').select('*').ilike('name', `%ARROZ SAFRA%`).limit(5)
  console.log('Direct ILIKE %ARROZ SAFRA% matches:', direct?.map(p => ({ id: p.id, name: p.name, ean: p.ean })))

  // 2. RPC match with 0.5 threshold (current)
  const { data: rpc50, error: err50 } = await supabase.rpc('search_products_fuzzy', {
    search_text: query,
    match_threshold: 0.5
  })
  if (err50) console.error('RPC 0.5 Error:', err50)
  console.log('RPC 0.5 results:', rpc50?.map(p => ({ id: p.id, name: p.name, similarity: p.similarity })))

  // 3. RPC match with 0.3 threshold (proposed)
  const { data: rpc30, error: err30 } = await supabase.rpc('search_products_fuzzy', {
    search_text: query,
    match_threshold: 0.3
  })
  console.log('RPC 0.3 results:', rpc30?.map(p => ({ id: p.id, name: p.name, similarity: p.similarity })))
  
  // 4. Case where match might be "ARROZ SAFRA INDICA 5KG" or similar
  const { data: allArroz } = await supabase.from('products').select('name').ilike('name', 'ARROZ%').limit(50)
  console.log('All products starting with ARROZ (sample):', allArroz?.map(p => p.name).slice(0, 10))
}

checkProduct()
