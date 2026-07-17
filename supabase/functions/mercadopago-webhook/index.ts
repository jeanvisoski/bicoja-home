import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// O webhook nunca confia no corpo recebido: consulta o pagamento diretamente
// no Mercado Pago antes de alterar qualquer pedido da BICOJA.
Deno.serve(async (request) => {
  try {
    const url = new URL(request.url);
    const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
    const paymentId = body?.data?.id || url.searchParams.get("data.id");
    const type = body?.type || url.searchParams.get("type") || url.searchParams.get("topic");
    if (!paymentId || !["payment", "merchant_order"].includes(type)) return new Response("ignored", { status: 200 });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: settings } = await admin.from("platform_settings").select("payment_mode").eq("id", true).single();
    const accessToken = settings?.payment_mode === "sandbox"
      ? Deno.env.get("MERCADOPAGO_TEST_ACCESS_TOKEN")
      : Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!accessToken) throw new Error("Credencial do Mercado Pago ausente.");

    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const payment = await paymentResponse.json();
    if (!paymentResponse.ok) throw new Error("Nao foi possivel consultar o pagamento.");
    const orderId = payment.external_reference || payment.metadata?.bicoja_order_id;
    if (!orderId) return new Response("missing order", { status: 200 });

    await admin.from("payment_transactions").update({
      status: payment.status === "approved" ? "approved" : payment.status === "rejected" ? "rejected" : "pending",
      gateway_payment_id: String(payment.id), raw_response: payment, updated_at: new Date().toISOString(),
    }).eq("order_id", orderId);

    if (payment.status === "approved") {
      const { error } = await admin.rpc("confirm_gateway_payment", { p_order_id: orderId, p_gateway_payment_id: String(payment.id) });
      if (error) throw error;
    }
    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response("error", { status: 500 });
  }
});
