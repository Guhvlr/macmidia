
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ebvvmddizsggrqasnnvv.supabase.co'
const supabaseKey = 'sb_publishable_AxiHBuzz8Cq82deFBen1iw_x-KRYotZ'
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkBucket() {
  const { data, error } = await supabase.storage.getBucket('kanban_assets')
  if (error) {
    console.error('Error fetching bucket:', error)
  } else {
    console.log('Bucket settings:', data)
  }
}

checkBucket()
