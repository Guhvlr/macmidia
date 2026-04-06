/**
 * Script para executar a migration SQL no Supabase
 * 
 * USO:
 *   1. Defina a variável SUPABASE_SERVICE_ROLE_KEY abaixo
 *   2. Execute: node supabase/run-migration.mjs
 * 
 * COMO OBTER A SERVICE ROLE KEY:
 *   1. Acesse https://supabase.com/dashboard/project/ooqldjnufmmgwolnueqt/settings/api
 *   2. Copie a chave "service_role" (NÃO a anon key)
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// =========================================
// ⚠️ CONFIGURE AQUI: Service Role Key
// =========================================
const SUPABASE_URL = 'https://ooqldjnufmmgwolnueqt.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ ERRO: Defina a SUPABASE_SERVICE_ROLE_KEY');
  console.log('');
  console.log('Opção 1 - Via variável de ambiente:');
  console.log('  set SUPABASE_SERVICE_ROLE_KEY=sua-chave-aqui && node supabase/run-migration.mjs');
  console.log('');
  console.log('Opção 2 - Copie o SQL e cole no Supabase Dashboard:');
  console.log('  https://supabase.com/dashboard/project/ooqldjnufmmgwolnueqt/sql/new');
  console.log('  Arquivo: supabase/migrations/20260402210000_whatsapp_ai_integration.sql');
  process.exit(1);
}

async function runMigration() {
  const sqlPath = join(__dirname, 'migrations', '20260402210000_whatsapp_ai_integration.sql');
  const sql = readFileSync(sqlPath, 'utf-8');

  console.log('🔄 Executando migration...');
  console.log(`📄 Arquivo: ${sqlPath}`);
  console.log('');

  // Split SQL into individual statements for better error handling
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  let success = 0;
  let errors = 0;

  for (const statement of statements) {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Prefer': 'return=minimal',
        },
      });
      // Note: RPC approach doesn't work for DDL. Use the full SQL approach below.
    } catch (e) {
      // ignore
    }
  }

  // Alternative: Execute full SQL via the management API
  const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  // The best way is through the Supabase SQL API
  const sqlApiResponse = await fetch(`https://api.supabase.com/v1/projects/ooqldjnufmmgwolnueqt/database/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  if (sqlApiResponse.ok) {
    console.log('✅ Migration executada com sucesso!');
  } else {
    const errorText = await sqlApiResponse.text();
    console.log('❌ Resultado:', sqlApiResponse.status);
    console.log(errorText);
    console.log('');
    console.log('💡 Se o erro for de autenticação, use o método manual:');
    console.log('   1. Acesse: https://supabase.com/dashboard/project/ooqldjnufmmgwolnueqt/sql/new');
    console.log('   2. Cole o conteúdo do arquivo SQL');
    console.log('   3. Clique em "Run"');
  }
}

runMigration().catch(err => {
  console.error('Erro:', err.message);
});
