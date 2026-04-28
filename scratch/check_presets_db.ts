import { supabase } from '../src/integrations/supabase/client';

async function checkPersistence() {
  console.log('--- TESTE DE PERSISTÊNCIA DE PRESETS ---');
  const testId = 'test-' + Date.now();
  
  // 1. Tentar Inserir
  const { data: insertData, error: insertError } = await supabase
    .from('offer_presets')
    .insert({
      id: testId,
      name: 'TESTE PERSISTÊNCIA',
      client: 'SISTEMA',
      price_badge: {},
      desc_config: {}
    })
    .select();

  if (insertError) {
    console.error('ERRO AO INSERIR PRESET:', insertError);
  } else {
    console.log('SUCESSO AO INSERIR:', insertData);
  }

  // 2. Tentar Deletar
  const { error: deleteError } = await supabase
    .from('offer_presets')
    .delete()
    .eq('id', testId);

  if (deleteError) {
    console.error('ERRO AO DELETAR PRESET:', deleteError);
  } else {
    console.log('SUCESSO AO DELETAR');
  }

  console.log('--- FIM DO TESTE ---');
}

checkPersistence();
