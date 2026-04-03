const host = "https://apistart01.megaapi.com.br";
const instanceKey = "megastart-ML9doEnRvlh";
const token = "ML9doEnRvlh";

// Usar webhook.site pra testar se a MegaAPI manda ALGO
const testWebhookUrl = "https://webhook.site/unique-test";

async function testWithWebhookSite() {
  // 1. Apontar webhook da MegaAPI pra webhook.site
  console.log("=== Apontando webhook pra webhook.site ===");
  const r1 = await fetch(`${host}/rest/webhook/${instanceKey}/configWebhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      messageData: {
        webhookUrl: testWebhookUrl,
        webhookEnabled: true
      }
    })
  });
  console.log("Config status:", r1.status, await r1.text());

  // 2. Enviar mensagem
  console.log("\n=== Enviando mensagem ===");
  const r2 = await fetch(`${host}/rest/sendMessage/${instanceKey}/text`, {
    method: "POST", 
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      messageData: {
        to: "556298790910@s.whatsapp.net",
        text: "teste webhook.site"
      }
    })
  });
  console.log("Send status:", r2.status, await r2.text());

  // 3. Restaurar webhook original
  console.log("\n=== Restaurando webhook pro Supabase ===");
  const r3 = await fetch(`${host}/rest/webhook/${instanceKey}/configWebhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      messageData: {
        webhookUrl: "https://ebvvmddizsggrqasnnvv.supabase.co/functions/v1/whatsapp-webhook",
        webhookEnabled: true
      }
    })
  });
  console.log("Restore status:", r3.status, await r3.text());

  console.log("\n✅ Agora abra https://webhook.site/ e verifique se alguma requisição chegou.");
  console.log("Se NÃO chegou nada, confirma que o plano MegaAPI Start não dispara webhooks.");
}

testWithWebhookSite();
