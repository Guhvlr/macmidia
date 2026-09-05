import XLSX from 'xlsx';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ebvvmddizsggrqasnnvv.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVidnZtZGRpenNnZ3JxYXNubnZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MjQ0ODgsImV4cCI6MjA5MDUwMDQ4OH0.CJ2pUVa1yyZx8L3myNOjPKYLT33YEHWDOCl45Y9LHMY';
const supabase = createClient(supabaseUrl, anonKey);

const files = [
  { path: resolve('C:/Users/USER/Desktop/Lista total de produtos - ATUALIZADA.xlsx'), type: 'nova_lista' }
];

async function importProducts() {
  console.log('🚀 Iniciando importação de massa para o Catálogo...');
  const allProducts = [];

  for (const file of files) {
    try {
      console.log(`\n📂 Lendo arquivo: ${file.path}`);
      const workbook = XLSX.readFile(file.path);
      const sheetName = workbook.SheetNames[0];
      const raw = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

      console.log(`📊 Linhas encontradas: ${raw.length}`);

      if (file.type === 'nova_lista') {
        // Formato: [0] Codigo Barra, [1] Nome
        raw.forEach((row, i) => {
          if (i === 0 && String(row[0]).toLowerCase().includes('cod')) return; // Pula cabeçalho
          if (row[0] && row[1]) {
            allProducts.push({
              ean: String(row[0]).trim(),
              name: String(row[1]).trim(),
              category: 'Geral',
              brand: ''
            });
          }
        });
      }
    } catch (err) {
      console.error(`❌ Erro no arquivo ${file.path}:`, err.message);
    }
  }

  // Deduplicar produtos baseados no EAN (evita erro do Postgres de onConflictUpdate na mesma transação)
  const uniqueMap = new Map();
  allProducts.forEach(p => uniqueMap.set(p.ean, p));
  const uniqueProducts = Array.from(uniqueMap.values());

  console.log(`\n💎 Total lido: ${allProducts.length} | Total únicos para envio: ${uniqueProducts.length}`);
  console.log('⏳ Enviando para o Supabase em pedaços (chunks)...');

  // Enviar em blocos de 500 para evitar timeout
  const chunkSize = 500;
  for (let i = 0; i < uniqueProducts.length; i += chunkSize) {
    const chunk = uniqueProducts.slice(i, i + chunkSize);
    const { error } = await supabase
      .from('products')
      .upsert(chunk, { onConflict: 'ean' });

    if (error) {
      console.error(`❌ Erro no bloco ${i / chunkSize + 1}:`, error.message);
    } else {
      process.stdout.write(`✅ Bloco ${i / chunkSize + 1} enviado... `);
    }
  }

  console.log('\n\n🎊 IMPORTAÇÃO CONCLUÍDA COM SUCESSO!');
}

importProducts();
