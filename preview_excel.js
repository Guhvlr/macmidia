import XLSX from 'xlsx';
import { resolve } from 'path';

const files = [
  resolve('C:/Users/gusta/Desktop/produtos QR/Lista Brasil .xlsx'),
  resolve('C:/Users/gusta/Desktop/produtos QR/PRODUTOS MARINHO .xlsx')
];

for (const file of files) {
  try {
    console.log(`\n--- Lendo: ${file} ---`);
    const workbook = XLSX.readFile(file);
    const sheetName = workbook.SheetNames[0];
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    console.log(`Total de linhas: ${data.length}`);
    console.log('Exemplo (primeiras 3 linhas):');
    console.log(JSON.stringify(data.slice(0, 3), null, 2));
  } catch (err) {
    console.error(`Erro ao ler ${file}: ${err.message}`);
  }
}
