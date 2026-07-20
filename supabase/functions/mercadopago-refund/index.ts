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

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: adminProfile } = await admin.from("profiles").select("role").eq("id", user.id).single();
    if (adminProfile?.role !== "admin") throw new Error("Operacao administrativa.");

    const { orderId, amount } = await request.json();
    if (!orderId) throw new Error("Pedido nao informado.");
    const [{ data: order }, { data: transaction }, { data: settings }] = await Promise.all([
      admin.from("orders").select("id, total, refund_due, refund_status").eq("id", orderId).single(),
      admin.from("payment_transactions").select("gateway, gateway_payment_id, mode, status").eq("order_id", orderId).single(),
      admin.from("platform_settings").select("payment_mode").eq("id", true).single(),
    ]);
    if (!order || !transaction) throw new Error("Transacao do pedido nao encontrada.");
    if (order.refund_status !== "pendente") throw new Error("Este reembolso nao esta pendente.");
    const refundAmount = Number(amount ?? order.refund_due);
    if (!Number.isFinite(refundAmount) || refundAmount <= 0 || refundAmount > Number(order.total)) throw new Error("Valor de reembolso invalido.");

    // Homologacao nao usa gateway: registra o mesmo resultado operacionalmente.
    if (settings?.payment_mode === "homologacao") {
      await admin.from("orders").update({ refund_status: "processado" }).eq("id", order.id);
      return Response.json({ ok: true, simulated: true }, { headers: corsHeaders });
    }
    if (transaction.gateway !== "mercado_pago" || !transaction.gateway_payment_id) throw new Error("Pagamento nao permite reembolso automatico.");
    const accessToken = transaction.mode === "sandbox" ? Deno.env.get("MERCADOPAGO_TEST_ACCESS_TOKEN") : Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!accessToken) throw new Error("Credencial do Mercado Pago nao configurada.");
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${transaction.gateway_payment_id}/refunds`, {
      method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(refundAmount === Number(order.total) ? {} : { amount: refundAmount }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.message ?? "Mercado Pago recusou o reembolso.");
    await Promise.all([
      admin.from("orders").update({ refund_status: "processado" }).eq("id", order.id),
      admin.from("payment_transactions").update({ status: refundAmount === Number(order.total) ? "refunded" : transaction.status, raw_response: payload, updated_at: new Date().toISOString() }).eq("order_id", order.id),
    ]);
    return Response.json({ ok: true, refund: payload }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro no reembolso." }, { status: 400, headers: corsHeaders });
  }
});
