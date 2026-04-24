import * as XLSX from 'xlsx';
import * as fs from 'fs';

const filePath = 'C:\\Users\\USER\\Desktop\\Lista oficial abril2026.xlsx';
const buffer = fs.readFileSync(filePath);
const workbook = XLSX.read(buffer, { type: 'buffer' });
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
console.log('Columns:', data[0]);
console.log('First row:', data[1]);
console.log('Total rows:', data.length);
