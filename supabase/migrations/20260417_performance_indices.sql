
-- 1. ÍNDICES PARA TABELA DE PRODUTOS
-- Aumenta a velocidade de busca exata por EAN (essencial para modo Barcode)
CREATE INDEX IF NOT EXISTS idx_products_ean ON public.products(ean);

-- Aumenta a velocidade de filtros por marca e categoria (usado em variações)
CREATE INDEX IF NOT EXISTS idx_products_brand ON public.products(brand);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);

-- 2. ÍNDICE PARA WHATSAPP INBOX
-- Índice parcial: foca apenas nas mensagens que ainda não foram revisadas.
-- Isso mantém a caixa de entrada ultra-veloz mesmo após milhares de mensagens arquivadas.
CREATE INDEX IF NOT EXISTS idx_whatsapp_inbox_pending 
ON public.whatsapp_inbox(status) 
WHERE status = 'pending';

-- 3. OTIMIZAÇÃO DE BUSCA FUZZY
-- Já existe um índice GIN no nome, mas vamos garantir que a extensão esteja com as estatísticas em dia
ANALYZE public.products;
