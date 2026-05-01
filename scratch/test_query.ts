
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function test() {
  const ean = '0000000004183'
  const searchEan = '4183'
  
  console.log('Testing EAN search...')
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .or(`ean.eq.${ean},ean.eq.${searchEan},ean.ilike.*${searchEan}`)

  if (error) {
    console.error('Error:', error)
  } else {
    console.log('Found candidates:', data?.length)
    data?.forEach(c => {
      console.log(`- ID: ${c.id}, Name: ${c.name}, EAN: ${c.ean}, Client: ${c.client_name}`)
    })
  }
}

test()
