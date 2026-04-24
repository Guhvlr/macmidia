import * as XLSX from 'xlsx';
import * as fs from 'fs';

async function run() {
  console.log('1. Lendo a planilha...');
  const filePath = 'C:\\Users\\USER\\Desktop\\Lista_com_imagem.xlsx';
  const buffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
  
  console.log(`Encontradas ${data.length} linhas na planilha.`);

  console.log('2. Gerando arquivo SQL para migração segura (mantendo imagens)...');
  
  let sql = `
BEGIN;

-- Cria tabela temporária para os novos dados
CREATE TEMP TABLE temp_products (
  ean text,
  name text,
  category text
);

-- Inserindo os dados da planilha
INSERT INTO temp_products (ean, name, category) VALUES
`;

  const values = [];
  const seenEans = new Set();
  
  for (const row of data) {
    if (!row[0]) continue; // Pula linha sem EAN
    const rawEan = String(row[0]).replace(/[^0-9]/g, '');
    let searchEan = rawEan.replace(/^0+/, ''); // remove zeros a esquerda
    if (searchEan === '') searchEan = '0';
    
    if (seenEans.has(searchEan)) {
      continue; // Pula EANs duplicados na própria planilha
    }
    seenEans.add(searchEan);
    
    const name = String(row[1] || '').trim().replace(/'/g, "''"); // escape single quotes
    const category = String(row[2] || '').trim().replace(/'/g, "''");
    
    values.push(`('${searchEan}', '${name}', '${category}')`);
  }

  sql += values.join(',\n') + ';\n\n';

  sql += `
-- Passo 1: Deletar tudo que NÃO está na planilha nova
DELETE FROM products WHERE ean NOT IN (SELECT ean FROM temp_products);

-- Passo 2: Inserir ou Atualizar os produtos da planilha nova
-- O ON CONFLICT garante que se o produto já existir (e tiver foto), a foto não será apagada,
-- apenas o nome e a categoria serão atualizados com os dados da planilha nova.
INSERT INTO products (ean, name, category)
SELECT ean, name, category FROM temp_products
ON CONFLICT (ean) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category;

COMMIT;
`;

  fs.writeFileSync('scripts/migration.sql', sql, 'utf8');
  console.log('Arquivo scripts/migration.sql gerado com sucesso!');
  console.log('Agora basta rodar: npx supabase db query -f scripts/migration.sql --linked');
}

run().catch(console.error);
