import XLSX from 'xlsx';
import { resolve } from 'path';

const files = [
  { path: resolve('C:/Users/gusta/Desktop/produtos QR/Lista Brasil .xlsx'), type: 'brasil' },
  { path: resolve('C:/Users/gusta/Desktop/produtos QR/PRODUTOS MARINHO .xlsx'), type: 'marinho' }
];

for (const file of files) {
  try {
    console.log(`\n--- Lendo: ${file.path} ---`);
    const workbook = XLSX.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const raw = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
    
    console.log(`Total de linhas brutas: ${raw.length}`);
    console.log('Primeiras 5 linhas:');
    raw.slice(0, 5).forEach((row, i) => console.log(`${i}: ${JSON.stringify(row)}`));
  } catch (err) {
    console.error(`Erro ao ler ${file.path}: ${err.message}`);
  }
}
