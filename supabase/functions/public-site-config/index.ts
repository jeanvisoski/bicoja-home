import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Content-Type": "application/json",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "GET") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRole) throw new Error("Supabase environment is not configured");

    const supabase = createClient(supabaseUrl, serviceRole);
    const { data, error } = await supabase
      .from("platform_settings")
      .select("app_store_url, google_play_url")
      .eq("id", true)
      .single();
    if (error) throw error;

    return new Response(JSON.stringify({
      app_store_url: data?.app_store_url || null,
      google_play_url: data?.google_play_url || null,
    }), { headers });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "Unable to load public configuration" }), { status: 500, headers });
  }
});
