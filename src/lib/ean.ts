
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
export const getImageUrl = (ean: string, clientName?: string | null): string => {
  if (!ean || ean === 'N/A' || ean === 'NA' || ean === 'Não encontrado') return '';
  const cleanEanValue = padEan(ean);
  
  let imagePath = `${cleanEanValue}.png`;
  if (clientName) {
    const cleanClient = clientName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    imagePath = `${cleanEanValue}_${cleanClient}.png`;
  }
  
  return `https://ebvvmddizsggrqasnnvv.supabase.co/storage/v1/object/public/product-images/${imagePath}`;
};

/**
 * Limpa caracters não numéricos de um EAN.
 */
export const cleanEan = (ean: string): string => {
    return (ean || '').replace(/[^0-9]/g, '');
};
