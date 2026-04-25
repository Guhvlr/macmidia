
/**
 * Utilitários para manipulação de códigos EAN (GTIN) e URLs de imagens de produtos.
 */

/**
 * Normaliza e adiciona zeros à esquerda (padding) se necessário para formar um EAN-13 válido.
 */
export const padEan = (ean: string): string => {
  const clean = (ean || '').replace(/[^0-9]/g, '');
  if (clean.length > 1 && clean.length < 13) return clean.padStart(13, '0');
  return clean;
};

/**
 * Gera a URL oficial da imagem do produto no Supabase Storage.
 * Adiciona um timestamp para evitar cache agressivo (browser/CDN) quando uma imagem é atualizada.
 */
export const getImageUrl = (ean: string): string => {
  if (!ean || ean === 'N/A' || ean === 'NA' || ean === 'Não encontrado') return '';
  const cleanEanValue = padEan(ean);
  // Cache-buster a cada 5 minutos para resolver imagens cortadas que ainda aparecem com fundo branco em outros PCs
  const cacheBuster = Math.floor(Date.now() / 300000).toString(36);
  return `https://ebvvmddizsggrqasnnvv.supabase.co/storage/v1/object/public/product-images/${cleanEanValue}.png?v=${cacheBuster}`;
};

/**
 * Limpa caracters não numéricos de um EAN.
 */
export const cleanEan = (ean: string): string => {
    return (ean || '').replace(/[^0-9]/g, '');
};
