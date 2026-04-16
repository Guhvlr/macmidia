
export function normalize(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

export function wordOverlap(input: string, match: string): number {
  const stopwords = ['de', 'da', 'do', 'com', 'para', 'em', 'um', 'uma', 'o', 'a', 'os', 'as', 'por', 'na', 'no', 'r$', 'cada', 'unid', 'unidade', 'kg', 'g', 'ml', 'l', 'litro', 'gramas', 'kilo'];
  
  const wordsA = normalize(input).split(/\s+/).filter(w => w.length > 1 && !stopwords.includes(w));
  const wordsB = normalize(match).split(/\s+/).filter(w => w.length > 1 && !stopwords.includes(w));

  if (wordsA.length === 0 || wordsB.length === 0) return 0;

  let hits = 0;
  for (const wa of wordsA) {
    for (const wb of wordsB) {
      if (wa === wb || (wa.length >= 3 && wb.includes(wa)) || (wb.length >= 3 && wa.includes(wb))) {
        hits++;
        break;
      }
    }
  }
  return hits / Math.max(wordsA.length, wordsB.length);
}

export function assessConfidence(
  brandHint: string,
  typeHint: string,
  displayName: string,
  matchName: string,
  matchBrand: string
): { level: string; reason: string } {
  const normBrand = normalize(brandHint);
  const normType = normalize(typeHint);
  const normMatchName = normalize(matchName);
  const normMatchBrand = normalize(matchBrand || '');

  let brandMatch = false;
  if (normBrand && normBrand.length >= 2) {
    brandMatch = normMatchName.includes(normBrand) || normMatchBrand.includes(normBrand);
  }

  let typeMatch = false;
  if (normType && normType.length >= 2) {
    typeMatch = normMatchName.includes(normType);
  }

  const overlap = wordOverlap(displayName, matchName);

  const hasBrandConflict = !brandMatch && normBrand.length >= 2 && normMatchBrand.length >= 2;
  if (hasBrandConflict) {
    return { level: 'low', reason: `Conflito de marcas: Solicitado '${brandHint}', encontrado '${matchBrand}'` };
  }

  if (!brandMatch && normBrand.length >= 2) {
    if (overlap >= 0.8) {
      return { level: 'medium', reason: 'Extrema similaridade de texto superou ausência da marca' };
    }
    return { level: 'low', reason: `Marca '${brandHint}' não localizada no nome do produto` };
  }

  if (brandMatch && (typeMatch || overlap >= 0.4)) {
    return { level: 'high', reason: 'Marca e descritor principal batem com o banco' };
  }

  if (brandMatch) {
    return { level: 'medium', reason: 'Marca exata, mas sem tipo/variedade clara' };
  }
  
  if (overlap >= 0.7) {
    return { level: 'medium', reason: 'Textos muito semelhantes, sem marca especificada' };
  }

  return { level: 'low', reason: 'Baixo índice de palavras em comum' };
}
