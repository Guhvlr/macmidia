
-- Script para permitir que chaves de acesso sejam registradas sem estarem vinculadas a um funcionário específico
-- Rode isso no editor SQL do seu Supabase se quiser remover a obrigatoriedade do funcionário

ALTER TABLE credentials ALTER COLUMN employee_id DROP NOT NULL;
