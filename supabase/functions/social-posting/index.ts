import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const POSTFORME_BASE_URL = "https://api.postforme.dev/v1";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const { action, clientId, postId } = body || {};

    // Busca a API Key do Post for Me nas variáveis de ambiente ou na tabela settings
    let apiKey = Deno.env.get("POSTFORME_API_KEY");
    if (!apiKey) {
      const { data: settingRow } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "postforme_api_key")
        .maybeSingle();
      apiKey = settingRow?.value;
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          ok: false,
          code: "not_configured",
          message:
            "Chave POSTFORME_API_KEY ainda não configurada no Supabase (Edge Functions Secrets).",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pfHeaders = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };

    // 1. Gerar link OAuth de conexão do Instagram para um cliente
    if (action === "connect_link") {
      const res = await fetch(`${POSTFORME_BASE_URL}/social-accounts/auth-url`, {
        method: "POST",
        headers: pfHeaders,
        body: JSON.stringify({
          platform: "instagram",
          external_id: clientId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.url) {
        return new Response(
          JSON.stringify({
            ok: false,
            message: data?.message || "Não foi possível gerar o link OAuth do Instagram.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ ok: true, data: { url: data.url } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Sincronizar conta conectada do cliente
    if (action === "sync_account") {
      const res = await fetch(
        `${POSTFORME_BASE_URL}/social-accounts?platform=instagram`,
        { method: "GET", headers: pfHeaders }
      );
      const payload = await res.json();
      const accounts: any[] = Array.isArray(payload?.data) ? payload.data : [];

      const matched =
        accounts.find((a) => a.external_id === clientId) || accounts[0];

      if (!matched) {
        return new Response(
          JSON.stringify({
            ok: false,
            message: "Nenhuma conta Instagram autorizada encontrada para este cliente ainda.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const handle = matched.username
        ? matched.username.startsWith("@")
          ? matched.username
          : `@${matched.username}`
        : undefined;

      if (clientId) {
        await supabase
          .from("calendar_clients")
          .update({
            postforme_account_id: matched.id,
            instagram_username: handle,
            instagram_connected_at: new Date().toISOString(),
          })
          .eq("id", clientId);
      }

      return new Response(
        JSON.stringify({
          ok: true,
          data: {
            connected: true,
            accountId: matched.id,
            username: handle,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Desconectar Instagram do cliente
    if (action === "disconnect") {
      if (clientId) {
        await supabase
          .from("calendar_clients")
          .update({
            postforme_account_id: null,
            instagram_connected_at: null,
          })
          .eq("id", clientId);
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Publicar ou programar post no Instagram
    if (action === "publish") {
      const { data: postRow, error: postErr } = await supabase
        .from("social_posts")
        .select("*")
        .eq("id", postId)
        .single();

      if (postErr || !postRow) {
        return new Response(
          JSON.stringify({ ok: false, message: "Post não encontrado no banco." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!postRow.calendar_client_id) {
        return new Response(
          JSON.stringify({ ok: false, message: "Selecione o cliente antes de publicar." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: clientRow } = await supabase
        .from("calendar_clients")
        .select("*")
        .eq("id", postRow.calendar_client_id)
        .maybeSingle();

      const socialAccountId = clientRow?.postforme_account_id;
      if (!socialAccountId) {
        const msg = `O cliente "${clientRow?.name || postRow.calendar_client_id}" ainda não tem o Instagram conectado no Banco de Dados.`;
        await supabase
          .from("social_posts")
          .update({ status: "erro", error_message: msg })
          .eq("id", postId);
        return new Response(JSON.stringify({ ok: false, message: msg }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const mediaUrls: string[] = Array.isArray(postRow.media) ? postRow.media : [];
      if (mediaUrls.length === 0) {
        return new Response(
          JSON.stringify({ ok: false, message: "O post não possui nenhuma imagem selecionada." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const placementMap: Record<string, string> = {
        feed: "timeline",
        stories: "stories",
        reels: "reels",
      };

      const isScheduled =
        Boolean(postRow.scheduled_at) &&
        new Date(postRow.scheduled_at).getTime() > Date.now() + 30_000;

      const payload: Record<string, unknown> = {
        caption: postRow.caption || "",
        social_accounts: [socialAccountId],
        media: mediaUrls.map((url) => ({ url })),
        platform_configurations: {
          instagram: {
            placement: placementMap[postRow.placement] || "timeline",
          },
        },
      };

      if (isScheduled) {
        payload.scheduled_at = new Date(postRow.scheduled_at).toISOString();
      }

      const pfRes = await fetch(`${POSTFORME_BASE_URL}/social-posts`, {
        method: "POST",
        headers: pfHeaders,
        body: JSON.stringify(payload),
      });

      const pfData = await pfRes.json();

      if (!pfRes.ok) {
        const errMsg =
          pfData?.message ||
          pfData?.error?.message ||
          "Falha retornada pela API ao publicar no Instagram.";
        await supabase
          .from("social_posts")
          .update({ status: "erro", error_message: errMsg })
          .eq("id", postId);

        return new Response(JSON.stringify({ ok: false, message: errMsg }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const nextStatus = isScheduled ? "programado" : "postado";
      await supabase
        .from("social_posts")
        .update({
          status: nextStatus,
          provider_post_id: pfData?.id || null,
          published_at: isScheduled ? null : new Date().toISOString(),
          error_message: null,
        })
        .eq("id", postId);

      return new Response(
        JSON.stringify({ ok: true, data: { status: nextStatus, id: pfData?.id } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, data: { updated: 0 } }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[social-posting] Error:", err);
    return new Response(
      JSON.stringify({ ok: false, message: err?.message || "Erro interno na função." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
