import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cobra o acréscimo de valor aprovado pelo cliente (order_extra_charges) --
// mesmo padrão de create-mercadopago-checkout, mas a preferência carrega
// bicoja_extra_charge_id em vez de bicoja_order_id, e o webhook usa essa
// chave pra rotear pro fluxo de confirmação certo.
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authorization = request.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) throw new Error("Sessao invalida.");

    const { chargeId, method } = await request.json();
    if (!chargeId || !["pix", "card"].includes(method))
      throw new Error("Dados do checkout invalidos.");

    const admin = createClient(supabaseUrl, serviceKey);
    const [{ data: charge, error: chargeError }, { data: settings, error: settingsError }] =
      await Promise.all([
        admin
          .from("order_extra_charges")
          .select(
            "id, client_id, amount, total, status, order_id, checkout_url, payment_mode, payment_method",
          )
          .eq("id", chargeId)
          .single(),
        admin
          .from("platform_settings")
          .select("payment_mode, pix_enabled, card_enabled, app_url")
          .eq("id", true)
          .single(),
      ]);
    if (chargeError || !charge || charge.client_id !== user.id)
      throw new Error("Acrescimo indisponivel para pagamento.");
    if (settingsError || !settings || settings.payment_mode === "homologacao")
      throw new Error("O checkout real nao esta ativo.");
    if (charge.status !== "aprovado")
      throw new Error("Este acrescimo nao esta aprovado para pagamento.");
    if (
      (method === "pix" && !settings.pix_enabled) ||
      (method === "card" && !settings.card_enabled)
    )
      throw new Error("Esta forma de pagamento esta desativada.");

    const accessToken =
      settings.payment_mode === "sandbox"
        ? Deno.env.get("MERCADOPAGO_TEST_ACCESS_TOKEN")
        : Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!accessToken)
      throw new Error("Credencial do Mercado Pago nao configurada para este ambiente.");

    // Reaproveita a preferência existente em vez de criar outra a cada
    // reabertura da tela (mesmo motivo do create-mercadopago-checkout).
    if (
      charge.checkout_url &&
      charge.payment_mode === settings.payment_mode &&
      charge.payment_method === method
    ) {
      return Response.json({ checkoutUrl: charge.checkout_url }, { headers: corsHeaders });
    }

    const appUrl = settings.app_url || request.headers.get("origin") || "";
    const excludedPaymentTypes =
      method === "pix"
        ? [{ id: "credit_card" }, { id: "debit_card" }, { id: "ticket" }]
        : [{ id: "bank_transfer" }, { id: "ticket" }];
    const preferenceResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `extra-${charge.id}`,
      },
      body: JSON.stringify({
        items: [
          {
            title: "Acréscimo de valor — Serviço BICOJA",
            description:
              "Valor adicional aprovado por você para cobrir um imprevisto no serviço em andamento.",
            quantity: 1,
            currency_id: "BRL",
            unit_price: Number(charge.total),
          },
        ],
        external_reference: charge.id,
        notification_url: `${supabaseUrl}/functions/v1/mercadopago-webhook`,
        back_urls: appUrl
          ? {
              success: `${appUrl}/tracking?orderId=${charge.order_id}`,
              pending: `${appUrl}/tracking?orderId=${charge.order_id}`,
              failure: `${appUrl}/extra-charge?chargeId=${charge.id}`,
            }
          : undefined,
        auto_return: "approved",
        payment_methods: { excluded_payment_types: excludedPaymentTypes },
        metadata: { bicoja_extra_charge_id: charge.id, selected_method: method },
      }),
    });
    const preference = await preferenceResponse.json();
    if (!preferenceResponse.ok)
      throw new Error(preference?.message || "Mercado Pago recusou a criacao do checkout.");

    const checkoutUrl =
      settings.payment_mode === "sandbox" ? preference.sandbox_init_point : preference.init_point;
    if (!checkoutUrl) throw new Error("Checkout nao retornado pelo Mercado Pago.");

    const { error: updateError } = await admin
      .from("order_extra_charges")
      .update({
        payment_mode: settings.payment_mode,
        payment_method: method,
        gateway_preference_id: preference.id,
        checkout_url: checkoutUrl,
      })
      .eq("id", charge.id);
    if (updateError) throw updateError;

    return Response.json({ checkoutUrl }, { headers: corsHeaders });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro no checkout." },
      { status: 400, headers: corsHeaders },
    );
  }
});
