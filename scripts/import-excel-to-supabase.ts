import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ebvvmddizsggrqasnnvv.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVidnZtZGRpenNnZ3JxYXNubnZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MjQ0ODgsImV4cCI6MjA5MDUwMDQ4OH0.CJ2pUVa1yyZx8L3myNOjPKYLT33YEHWDOCl45Y9LHMY';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  console.log('1. Lendo a planilha...');
  const filePath = 'C:\\Users\\USER\\Desktop\\Lista oficial abril2026.xlsx';
  const buffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
  
  // A planilha não tem cabeçalho na linha 0. Os dados começam na linha 0.
  // Colunas: [0] = EAN, [1] = NOME, [2] = CATEGORIA
  console.log(`Encontradas ${data.length} linhas na planilha.`);

  console.log('2. Baixando produtos atuais para preservar imagens...');
  const existingProducts: any[] = [];
  let page = 0;
  while (true) {
    const { data: pageData, error } = await supabase
      .from('products')
      .select('ean, image_url')
      .range(page * 1000, (page + 1) * 1000 - 1);
    
    if (error) {
      console.error('Erro ao baixar produtos:', error);
      process.exit(1);
    }
    
    if (!pageData || pageData.length === 0) break;
    existingProducts.push(...pageData);
    page++;
  }
  
  console.log(`Baixados ${existingProducts.length} produtos do banco.`);
  
  // Mapa de imagens: EAN -> image_url
  const imageMap = new Map();
  existingProducts.forEach(p => {
    if (p.image_url) {
      imageMap.set(String(p.ean), p.image_url);
    }
  });

  console.log('3. Apagando banco antigo...');
  // Apaga todos os produtos (vamos torcer para o RLS permitir DELETE via anon, ou pelo menos deletar um a um / batch)
  // Como delete in bulk precisa de filtros, vamos tentar deletar com IN clause ou != 'xxx'
  const { error: deleteErr } = await supabase.from('products').delete().neq('ean', '0000000000000');
  if (deleteErr) {
    console.error('Erro ao deletar banco antigo:', deleteErr);
    console.log('Provavelmente RLS não permite DELETE em lote. Abortando.');
    process.exit(1);
  }

  console.log('4. Preparando novos produtos para inserção...');
  const newProducts = [];
  for (const row of data) {
    if (!row[0]) continue; // Pula linha sem EAN
    const rawEan = String(row[0]).replace(/[^0-9]/g, '');
    let searchEan = rawEan.replace(/^0+/, ''); // remove leading zeros para padronizar
    if (searchEan === '') searchEan = '0';
    
    const name = String(row[1] || '').trim();
    const category = String(row[2] || '').trim();
    
    // Tenta deduzir marca a partir do nome (primeira ou última palavra grande, heurística simples - deixaremos vazio por enquanto para evitar erros)
    
    newProducts.push({
      ean: searchEan,
      name,
      category,
      brand: null,
      line: null,
      image_url: imageMap.get(searchEan) || imageMap.get(rawEan) || null
    });
  }

  console.log(`Preparados ${newProducts.length} produtos para inserção.`);
  
  console.log('5. Inserindo no banco em lotes...');
  const chunkSize = 500;
  for (let i = 0; i < newProducts.length; i += chunkSize) {
    const chunk = newProducts.slice(i, i + chunkSize);
    const { error: insertErr } = await supabase.from('products').insert(chunk);
    if (insertErr) {
      console.error(`Erro ao inserir lote ${i}:`, insertErr);
    } else {
      console.log(`Inseridos ${i + chunk.length} de ${newProducts.length}`);
    }
  }

  console.log('Concluído! A base foi trocada preservando as imagens.');
}

run().catch(console.error);
