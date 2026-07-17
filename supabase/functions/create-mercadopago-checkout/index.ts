import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authorization = request.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error("Sessao invalida.");

    const { orderId, method } = await request.json();
    if (!orderId || !["pix", "card"].includes(method)) throw new Error("Dados do checkout invalidos.");

    const admin = createClient(supabaseUrl, serviceKey);
    const [{ data: order, error: orderError }, { data: settings, error: settingsError }] = await Promise.all([
      admin.from("orders").select("id, client_id, total, status, payment_status").eq("id", orderId).single(),
      admin.from("platform_settings").select("payment_mode, pix_enabled, card_enabled, app_url").eq("id", true).single(),
    ]);
    if (orderError || !order || order.client_id !== user.id) throw new Error("Pedido indisponivel para pagamento.");
    if (settingsError || !settings || settings.payment_mode === "homologacao") throw new Error("O checkout real nao esta ativo.");
    if (order.status !== "aguardando_pagamento" || order.payment_status !== "pendente") throw new Error("Este pedido nao esta aguardando pagamento.");
    if ((method === "pix" && !settings.pix_enabled) || (method === "card" && !settings.card_enabled)) throw new Error("Esta forma de pagamento esta desativada.");

    const accessToken = settings.payment_mode === "sandbox"
      ? Deno.env.get("MERCADOPAGO_TEST_ACCESS_TOKEN")
      : Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!accessToken) throw new Error("Credencial do Mercado Pago nao configurada para este ambiente.");

    const appUrl = settings.app_url || request.headers.get("origin") || "";
    const excludedPaymentTypes = method === "pix"
      ? [{ id: "credit_card" }, { id: "debit_card" }, { id: "ticket" }]
      : [{ id: "bank_transfer" }, { id: "ticket" }];
    const preferenceResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": order.id,
      },
      body: JSON.stringify({
        items: [{ title: "Servico BICOJA", quantity: 1, currency_id: "BRL", unit_price: Number(order.total) }],
        external_reference: order.id,
        notification_url: `${supabaseUrl}/functions/v1/mercadopago-webhook`,
        back_urls: appUrl ? {
          success: `${appUrl}/tracking?orderId=${order.id}`,
          failure: `${appUrl}/payment?orderId=${order.id}`,
          pending: `${appUrl}/payment?orderId=${order.id}`,
        } : undefined,
        auto_return: "approved",
        payment_methods: { excluded_payment_types: excludedPaymentTypes },
        metadata: { bicoja_order_id: order.id, selected_method: method },
      }),
    });
    const preference = await preferenceResponse.json();
    if (!preferenceResponse.ok) throw new Error(preference?.message || "Mercado Pago recusou a criacao do checkout.");

    const checkoutUrl = settings.payment_mode === "sandbox"
      ? preference.sandbox_init_point
      : preference.init_point;
    if (!checkoutUrl) throw new Error("Checkout nao retornado pelo Mercado Pago.");

    const { error: transactionError } = await admin.from("payment_transactions").upsert({
      order_id: order.id,
      gateway: "mercado_pago",
      mode: settings.payment_mode,
      method,
      status: "pending",
      gateway_preference_id: preference.id,
      checkout_url: checkoutUrl,
      raw_response: preference,
      updated_at: new Date().toISOString(),
    }, { onConflict: "order_id" });
    if (transactionError) throw transactionError;

    return Response.json({ checkoutUrl }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro no checkout." }, { status: 400, headers: corsHeaders });
  }
});
