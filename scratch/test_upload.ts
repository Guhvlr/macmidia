
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ebvvmddizsggrqasnnvv.supabase.co'
const supabaseKey = 'sb_publishable_AxiHBuzz8Cq82deFBen1iw_x-KRYotZ'
const supabase = createClient(supabaseUrl, supabaseKey)

async function testUpload() {
  const blob = new Blob(['test'], { type: 'text/plain' })
  const file = new File([blob], 'test.txt', { type: 'text/plain' })
  
  const { data, error } = await supabase.storage.from('kanban_assets').upload('test-' + Date.now() + '.txt', file)
  if (error) {
    console.error('Upload failed:', error)
  } else {
    console.log('Upload success:', data)
  }
}

testUpload()
