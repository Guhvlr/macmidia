
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ebvvmddizsggrqasnnvv.supabase.co'
const supabaseKey = 'sb_publishable_AxiHBuzz8Cq82deFBen1iw_x-KRYotZ'
const supabase = createClient(supabaseUrl, supabaseKey)

async function listBuckets() {
  const { data, error } = await supabase.storage.listBuckets()
  if (error) {
    console.error('Error listing buckets:', error)
  } else {
    console.log('Available buckets:', data)
  }
}

listBuckets()
