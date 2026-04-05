/**
 * setup-local.mjs - Script de Setup Automático Local
 * 
 * Inicia Evolution API (Docker), cria instância WhatsApp,
 * e configura o webhook para funcionar no PC local.
 * 
 * Uso: node setup-local.mjs
 */

const API_PORT = 8080;
const API_KEY = '4224771A-8F12-4FF2-A9F6-444455556666';
const INSTANCE_NAME = 'macmidia';
const SUPABASE_WEBHOOK_URL = 'https://ebvvmddizsggrqasnnvv.supabase.co/functions/v1/whatsapp-webhook';

const API_BASE = `http://localhost:${API_PORT}`;

async function waitForAPI(maxRetries = 30) {
  console.log('⏳ Aguardando Evolution API ficar online...');
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`${API_BASE}/`);
      if (res.ok || res.status === 401) {
        console.log('✅ Evolution API online!');
        return true;
      }
    } catch {
      // API still not ready
    }
    process.stdout.write(`  Tentativa ${i + 1}/${maxRetries}...\r`);
    await new Promise(r => setTimeout(r, 2000));
  }
  console.error('❌ Evolution API não ficou online a tempo.');
  return false;
}

async function apiCall(method, path, body = null) {
  const opts = {
    method,
    headers: {
      'apikey': API_KEY,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  
  const res = await fetch(`${API_BASE}${path}`, opts);
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch {
    return { status: res.status, data: text };
  }
}

async function deleteInstanceIfExists() {
  console.log(`\n🗑️  Verificando instância "${INSTANCE_NAME}"...`);
  const { status } = await apiCall('GET', `/instance/connectionState/${INSTANCE_NAME}`);
  
  if (status === 200 || status === 400) {
    console.log('  Instância existente encontrada, removendo...');
    await apiCall('DELETE', `/instance/delete/${INSTANCE_NAME}`);
    await new Promise(r => setTimeout(r, 2000));
    console.log('  ✅ Instância removida.');
  } else {
    console.log('  Nenhuma instância existente.');
  }
}

async function createInstance() {
  console.log(`\n📱 Criando instância "${INSTANCE_NAME}"...`);
  
  const { status, data } = await apiCall('POST', '/instance/create', {
    instanceName: INSTANCE_NAME,
    integration: 'WHATSAPP-BAILEYS',
    qrcode: true,
    webhook: {
      url: SUPABASE_WEBHOOK_URL,
      byEvents: false,
      base64: false,
      events: [
        'MESSAGES_UPSERT',
      ],
    },
  });

  if (status >= 200 && status < 300) {
    console.log('✅ Instância criada com sucesso!');
    
    if (data?.qrcode?.base64) {
      console.log('\n📲 QR CODE disponível!');
      console.log('   Abra no navegador: http://localhost:8080/manager');
      console.log('   Ou acesse: http://localhost:8080/instance/connect/' + INSTANCE_NAME);
    }
    
    return data;
  } else {
    console.error('❌ Erro ao criar instância:', data);
    return null;
  }
}

async function getQRCode() {
  console.log('\n📲 Obtendo QR Code...');
  const { status, data } = await apiCall('GET', `/instance/connect/${INSTANCE_NAME}`);
  
  if (status === 200 && data?.base64) {
    console.log('✅ QR Code gerado!');
    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log('  ESCANEIE O QR CODE NO SEU WHATSAPP');
    console.log('  Abra: WhatsApp > Aparelhos Conectados > Conectar');
    console.log('═══════════════════════════════════════════════');
    console.log('');
    console.log('  🌐 Abra no navegador para ver o QR:');
    console.log(`     http://localhost:${API_PORT}/manager`);
    console.log('');
    return true;
  } else {
    console.log('⚠️  QR Code não disponível ainda. Status:', data?.state || 'unknown');
    return false;
  }
}

async function checkConnection() {
  const { data } = await apiCall('GET', `/instance/connectionState/${INSTANCE_NAME}`);
  return data?.state || data?.instance?.state || 'unknown';
}

async function main() {
  console.log('');
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   🚀 Mac Mídia - Setup Local              ║');
  console.log('║   Evolution API + WhatsApp                 ║');  
  console.log('╚════════════════════════════════════════════╝');
  console.log('');

  // 1. Wait for API
  const online = await waitForAPI();
  if (!online) {
    console.log('\n💡 Dica: Execute primeiro:');
    console.log('   docker compose -f docker-compose.evolution.yml up -d');
    process.exit(1);
  }

  // 2. Delete existing instance
  await deleteInstanceIfExists();
  
  // 3. Create new instance
  const result = await createInstance();
  if (!result) process.exit(1);

  // 4. Get QR Code
  await new Promise(r => setTimeout(r, 3000));
  await getQRCode();

  // 5. Wait for connection
  console.log('⏳ Aguardando você escanear o QR Code...');
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const state = await checkConnection();
    
    if (state === 'open' || state === 'connected') {
      console.log('');
      console.log('╔════════════════════════════════════════════╗');
      console.log('║   ✅ WHATSAPP CONECTADO COM SUCESSO!       ║');
      console.log('╚════════════════════════════════════════════╝');
      console.log('');
      console.log('📋 Resumo:');
      console.log(`   API: http://localhost:${API_PORT}`);
      console.log(`   Instância: ${INSTANCE_NAME}`);
      console.log(`   Webhook: ${SUPABASE_WEBHOOK_URL}`);
      console.log('');
      console.log('💡 Próximo passo: inicie o Cloudflare Tunnel se necessário:');
      console.log('   cloudflared tunnel --url http://localhost:8080');
      console.log('');
      process.exit(0);
    }
    
    process.stdout.write(`  Estado: ${state} (${i + 1}/60)...\r`);
  }

  console.log('\n⏰ Tempo esgotado. Verifique manualmente no manager.');
}

main().catch(console.error);
