const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ebvvmddizsggrqasnnvv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_AxiHBuzz8Cq82deFBen1iw_x-KRYotZ';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  const filePath = 'C:/Users/gusta/Desktop/Lista_Produtos.xlsx';

  console.log('📂 Lendo arquivo Excel...');
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

  // Pular cabeçalho
  const rows = data.slice(1).filter(row => row[0] && row[1]);
  console.log(`✅ ${rows.length} produtos encontrados no arquivo.`);

  // Converter para formato do banco
  const products = rows.map(row => ({
    ean: String(row[0]).replace(/[^0-9]/g, '').trim(),
    name: String(row[1]).trim(),
    brand: '',
    line: '',
    category: '',
  })).filter(p => p.ean && p.name);

  console.log(`📦 ${products.length} produtos válidos para importar.`);

  // Limpar base atual (gt em created_at pega tudo de 2000 pra frente)
  console.log('🗑️  Limpando base atual...');
  const { error: deleteError } = await supabase
    .from('products')
    .delete()
    .gt('created_at', '2000-01-01T00:00:00Z');

  if (deleteError) {
    console.error('Erro ao limpar:', deleteError.message);
    // Tentar método alternativo
    const { error: deleteError2 } = await supabase
      .from('products')
      .delete()
      .neq('ean', '___IMPOSSIVEL___');
    
    if (deleteError2) {
      console.error('Erro alternativo ao limpar:', deleteError2.message);
      process.exit(1);
    }
  }
  console.log('✅ Base limpa!');

  // Importar em lotes de 500
  const BATCH = 500;
  let imported = 0;
  let failed = 0;

  for (let i = 0; i < products.length; i += BATCH) {
    const batch = products.slice(i, i + BATCH);
    const { error } = await supabase.from('products').upsert(batch, { onConflict: 'ean' });
    
    if (error) {
      console.error(`❌ Lote ${Math.floor(i/BATCH)+1} falhou:`, error.message);
      failed += batch.length;
    } else {
      imported += batch.length;
      console.log(`   ✅ Lote ${Math.floor(i/BATCH)+1}: ${imported}/${products.length} importados`);
    }
  }

  // Verificar contagem final
  const { count } = await supabase.from('products').select('*', { count: 'exact', head: true });

  console.log(`\n🎉 CONCLUÍDO!`);
  console.log(`   Importados nessa sessão: ${imported}`);
  console.log(`   Total atual no banco: ${count}`);
  console.log(`   Falhas: ${failed}`);
}

main().catch(console.error);
