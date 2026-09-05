-- Add fields for internal base products
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='has_qr_code') THEN
        ALTER TABLE public.products ADD COLUMN has_qr_code BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='description_on_front') THEN
        ALTER TABLE public.products ADD COLUMN description_on_front BOOLEAN DEFAULT false;
    END IF;
END $$;
