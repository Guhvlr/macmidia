import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const payload = await req.json();
    const eventType = payload?.event || payload?.type || "";
    const data = payload?.data || payload || {};

    const providerPostId = data.post_id || data.id;
    if (!providerPostId) {
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const statusRaw = String(data.status || "").toLowerCase();
    const isSuccess =
      statusRaw === "success" ||
      statusRaw === "published" ||
      eventType.includes("published");
    const isFailed =
      statusRaw === "failed" ||
      statusRaw === "error" ||
      eventType.includes("failed");

    if (isSuccess) {
      await supabase
        .from("social_posts")
        .update({
          status: "postado",
          published_at: new Date().toISOString(),
          permalink: data.permalink || null,
          error_message: null,
        })
        .eq("provider_post_id", providerPostId);
    } else if (isFailed) {
      const errMsg =
        data?.error?.message ||
        data?.error_message ||
        "Falha ao publicar no Instagram (reportado pelo webhook).";
      await supabase
        .from("social_posts")
        .update({
          status: "erro",
          error_message: errMsg,
        })
        .eq("provider_post_id", providerPostId);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[social-posting-webhook] Error:", err);
    return new Response(JSON.stringify({ error: err?.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
