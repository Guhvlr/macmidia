import XLSX from 'xlsx';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ebvvmddizsggrqasnnvv.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVidnZtZGRpenNnZ3JxYXNubnZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MjQ0ODgsImV4cCI6MjA5MDUwMDQ4OH0.CJ2pUVa1yyZx8L3myNOjPKYLT33YEHWDOCl45Y9LHMY';
const supabase = createClient(supabaseUrl, anonKey);

const files = [
  { path: resolve('C:/Users/gusta/Desktop/produtos QR/Lista Brasil .xlsx'), type: 'brasil' },
  { path: resolve('C:/Users/gusta/Desktop/produtos QR/PRODUTOS MARINHO .xlsx'), type: 'marinho' }
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

      if (file.type === 'brasil') {
        // Formato: [0] EAN, [1] Nome, [2] Categoria
        raw.forEach(row => {
          if (row[0] && row[1]) {
            allProducts.push({
              ean: String(row[0]).trim(),
              name: String(row[1]).trim(),
              category: String(row[2] || '').trim(),
              brand: '' // Extrair depois se necessário
            });
          }
        });
      } else if (file.type === 'marinho') {
        // Formato: [0] CODIGO, [1] Nome (Geralmente pula a primeira linha se for header)
        raw.forEach((row, i) => {
          if (i === 0 && String(row[0]).toLowerCase().includes('cod')) return;
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

  console.log(`\n💎 Total de produtos processados: ${allProducts.length}`);
  console.log('⏳ Enviando para o Supabase em pedaços (chunks)...');

  // Enviar em blocos de 500 para evitar timeout
  const chunkSize = 500;
  for (let i = 0; i < allProducts.length; i += chunkSize) {
    const chunk = allProducts.slice(i, i + chunkSize);
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
