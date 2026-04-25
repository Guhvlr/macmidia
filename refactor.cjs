const fs = require('fs');
let c = fs.readFileSync('src/features/offer-generator/components/OfferEditorPage.tsx', 'utf8');
let lines = c.split(/\r?\n/);

lines.splice(2, 0, "import { useOfferExport } from '../hooks/useOfferExport';");

let exportIndex = lines.findIndex(l => l.includes('const [isExporting, setIsExporting] = useState(false);'));
if (exportIndex !== -1) {
  lines[exportIndex] = '  const { isExporting, exportAllPages } = useOfferExport({ svgRef, config, pageCount, activePage, setActivePage, setSelection, setInlineEdit });';
}

let start = lines.findIndex(l => l.includes('/* ───────────── EXPORT (ALL PAGES) ───────────── */'));
let end = lines.findIndex((l, i) => i > start && l.includes('/* ───────────── DERIVED STATE FOR RIGHT PANEL ───────────── */'));

if (start !== -1 && end !== -1) {
  lines.splice(start, end - start);
}

fs.writeFileSync('src/features/offer-generator/components/OfferEditorPage.tsx', lines.join('\n'));
console.log('Refactoring done:', start, end, exportIndex);
