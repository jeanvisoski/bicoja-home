import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Chamada só pelo trigger interno em public.orders (via pg_net) quando o
// cliente confirma a conclusão de um pedido com reembolso pendente (faixa
// de preço: cobrado o teto, devolvida a diferença pro valor final real).
// Sem verificação de JWT -- não é chamada por nenhum cliente autenticado.
// Falha aqui não desfaz a confirmação do pedido (já commitada antes deste
// trigger disparar); refund_status continua "pendente" pra reconciliação
// manual no admin se o Mercado Pago recusar ou a chamada falhar.
Deno.serve(async (request) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { record } = await request.json();
    if (!record?.id) throw new Error("Pedido não informado.");

    const [{ data: order }, { data: transaction }, { data: settings }] = await Promise.all([
      admin
        .from("orders")
        .select("id, total, refund_due, refund_status")
        .eq("id", record.id)
        .single(),
      admin
        .from("payment_transactions")
        .select("gateway, gateway_payment_id, mode, status")
        .eq("order_id", record.id)
        .maybeSingle(),
      admin.from("platform_settings").select("payment_mode").eq("id", true).single(),
    ]);
    if (!order) throw new Error("Pedido não encontrado.");

    const refundAmount = Number(order.refund_due);
    if (order.refund_status !== "pendente" || !(refundAmount > 0)) {
      return Response.json({ ok: true, skipped: true });
    }

    // Homologação (sem gateway) ou pedido sem payment_transactions: registra
    // o mesmo resultado operacionalmente, sem chamar API nenhuma.
    if (settings?.payment_mode === "homologacao" || !transaction) {
      await admin.from("orders").update({ refund_status: "processado" }).eq("id", order.id);
      return Response.json({ ok: true, simulated: true });
    }
    if (transaction.gateway !== "mercado_pago" || !transaction.gateway_payment_id) {
      throw new Error("Pagamento não permite reembolso automático.");
    }
    const accessToken =
      transaction.mode === "sandbox"
        ? Deno.env.get("MERCADOPAGO_TEST_ACCESS_TOKEN")
        : Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!accessToken) throw new Error("Credencial do Mercado Pago não configurada.");

    const response = await fetch(
      `https://api.mercadopago.com/v1/payments/${transaction.gateway_payment_id}/refunds`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ amount: refundAmount }),
      },
    );
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.message ?? "Mercado Pago recusou o reembolso.");

    await Promise.all([
      admin.from("orders").update({ refund_status: "processado" }).eq("id", order.id),
      admin
        .from("payment_transactions")
        .update({ raw_response: payload, updated_at: new Date().toISOString() })
        .eq("order_id", order.id),
    ]);

    return Response.json({ ok: true, refund: payload });
  } catch (error) {
    console.error("process-order-refund error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro no reembolso." },
      { status: 400 },
    );
  }
});
