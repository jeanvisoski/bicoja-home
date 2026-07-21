import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type" };
const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { ...headers, "content-type": "application/json" } });
  try {
    const { email, source } = await request.json();
    const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!emailPattern.test(normalized)) return new Response(JSON.stringify({ error: "invalid_email" }), { status: 400, headers: { ...headers, "content-type": "application/json" } });
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error } = await supabase.from("waitlist_signups").upsert({ email: normalized, source: typeof source === "string" ? source.slice(0, 60) : "site_institucional" }, { onConflict: "email", ignoreDuplicates: true });
    if (error) throw error;
    return new Response(JSON.stringify({ ok: true }), { headers: { ...headers, "content-type": "application/json" } });
  } catch { return new Response(JSON.stringify({ error: "unexpected_error" }), { status: 500, headers: { ...headers, "content-type": "application/json" } }); }
});
