const token = "sbp_fffb8457c4be4cc4208369b7eb229afe88ed73b5";
const projectRef = "ebvvmddizsggrqasnnvv";

async function getLogs() {
  const url = `https://api.supabase.com/v1/projects/${projectRef}/functions/whatsapp-webhook/logs?timestamp_start=${Date.now() - 3600000}`;
  const res = await fetch(url, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

getLogs();
