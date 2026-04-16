
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || 'https://ebvvmddizsggrqasnnvv.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkProduct() {
  const query = 'ARROZ SAFRA 5KG'
  console.log(`Checking results for: "${query}"`)

  // 1. Direct match
  const { data: direct, error: errD } = await supabase.from('products').select('*').ilike('name', `%ARROZ SAFRA%`).limit(5)
  if (errD) console.error('Direct ILIKE Error:', errD)
  console.log('Direct ILIKE %ARROZ SAFRA% matches:', direct?.map(p => ({ id: p.id, name: p.name, ean: p.ean })))

  // 2. RPC match with 0.5 threshold (current)
  const { data: rpc50, error: err50 } = await supabase.rpc('search_products_fuzzy', {
    search_text: query,
    match_threshold: 0.5
  })
  if (err50) console.error('RPC 0.5 Error:', err50)
  console.log('RPC 0.5 results:', rpc50?.map(p => ({ id: p.id, name: p.name })))

  // 3. RPC match with 0.3 threshold (proposed)
  const { data: rpc30, error: err30 } = await supabase.rpc('search_products_fuzzy', {
    search_text: query,
    match_threshold: 0.3
  })
  if (err30) console.error('RPC 0.3 Error:', err30)
  console.log('RPC 0.3 results:', rpc30?.map(p => ({ id: p.id, name: p.name })))
  
  // 4. Case where match might be "ARROZ SAFRA INDICA 5KG" or similar
  const { data: allArroz } = await supabase.from('products').select('name').ilike('name', 'ARROZ%').limit(20)
  console.log('All products starting with ARROZ (sample):', allArroz?.map(p => p.name))
}

checkProduct()
