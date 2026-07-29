import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Lock, CreditCard, Wallet, ChevronRight, AlertTriangle, Check, X } from "lucide-react";
import { PhoneFrame } from "@/components/bicoja/PhoneFrame";
import { AppHeader } from "@/components/bicoja/AppHeader";
import { supabase } from "@/lib/supabase";
import { openExternalCheckout } from "@/lib/native";

export const Route = createFileRoute("/extra-charge")({
  component: ExtraCharge,
  validateSearch: (search: Record<string, unknown>): { chargeId?: string } => ({
    chargeId: typeof search.chargeId === "string" ? search.chargeId : undefined,
  }),
  head: () => ({ meta: [{ title: "Acréscimo de valor — BICOJÁ" }] }),
});

async function describeCheckoutError(error: unknown): Promise<string> {
  const context = (error as { context?: unknown })?.context;
  if (context instanceof Response) {
    try {
      const body = await context.clone().json();
      if (typeof body?.error === "string") return body.error;
    } catch {
      // resposta sem corpo JSON -- cai no fallback abaixo.
    }
  }
  return error instanceof Error ? error.message : "Nao foi possivel iniciar o checkout.";
}

type ExtraChargeDetail = {
  id: string;
  order_id: string;
  amount: number;
  platform_fee: number;
  total: number;
  reason: string;
  status: "solicitado" | "aprovado" | "recusado" | "pago" | "cancelado";
  provider_profiles: { profiles: { full_name: string | null } | null } | null;
};

function useCharge(chargeId: string | undefined) {
  return useQuery({
    queryKey: ["extra-charge", chargeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_extra_charges")
        .select(
          "id, order_id, amount, platform_fee, total, reason, status, provider_profiles(profiles(full_name))",
        )
        .eq("id", chargeId)
        .returns<ExtraChargeDetail[]>()
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!chargeId,
    refetchInterval: 5_000,
  });
}

type PaymentSettings = {
  payment_mode: "homologacao" | "sandbox" | "producao";
  pix_enabled: boolean;
  card_enabled: boolean;
};

function usePaymentSettings() {
  return useQuery({
    queryKey: ["payment-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("payment_mode, pix_enabled, card_enabled")
        .eq("id", true)
        .single();
      if (error?.code === "42703")
        return {
          payment_mode: "homologacao",
          pix_enabled: true,
          card_enabled: true,
        } as PaymentSettings;
      if (error) throw error;
      return data as PaymentSettings;
    },
  });
}

function ExtraCharge() {
  const { chargeId } = Route.useSearch();
  const nav = useNavigate();
  const queryClient = useQueryClient();
  const { data: charge } = useCharge(chargeId);
  const { data: settings } = usePaymentSettings();
  const [method, setMethod] = useState<"pix" | "card">("card");
  const [busy, setBusy] = useState(false);

  const paymentMode = settings?.payment_mode ?? "homologacao";
  const isHomologation = paymentMode === "homologacao";
  const providerName = charge?.provider_profiles?.profiles?.full_name ?? "Prestador";

  async function respond(approve: boolean) {
    if (!chargeId) return;
    let note: string | null = null;
    if (!approve) {
      note = window.prompt("Por que você está recusando este acréscimo? (opcional)");
    }
    setBusy(true);
    const { error } = await supabase.rpc("respond_order_extra_charge", {
      p_charge_id: chargeId,
      p_approve: approve,
      p_note: note,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["extra-charge", chargeId] });
    if (!approve) {
      toast.success("Acréscimo recusado.");
      nav({ to: "/orders" });
    }
  }

  async function pay() {
    if (!chargeId) return;
    setBusy(true);
    if (isHomologation) {
      const { error } = await supabase.rpc("simulate_extra_charge_payment", {
        p_charge_id: chargeId,
      });
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Acréscimo pago (homologação).");
      queryClient.invalidateQueries({ queryKey: ["extra-charge", chargeId] });
      return;
    }
    const { data, error } = await supabase.functions.invoke(
      "create-mercadopago-extra-charge-checkout",
      {
        body: { chargeId, method },
      },
    );
    setBusy(false);
    if (error || !data?.checkoutUrl) {
      toast.error(await describeCheckoutError(error));
      return;
    }
    await openExternalCheckout(data.checkoutUrl as string);
  }

  if (!charge) {
    return (
      <PhoneFrame>
        <AppHeader title="Acréscimo de valor" back />
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Carregando...
        </div>
      </PhoneFrame>
    );
  }

  if (charge.status === "pago") {
    return (
      <PhoneFrame>
        <AppHeader title="Acréscimo de valor" back />
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
          <div className="h-14 w-14 rounded-full bg-trust-soft flex items-center justify-center">
            <Check className="h-7 w-7 text-trust" />
          </div>
          <p className="font-semibold">Acréscimo pago</p>
          <p className="text-sm text-muted-foreground">
            R$ {Number(charge.total).toFixed(2)} entram na garantia BICOJÁ junto com o restante do
            pedido.
          </p>
        </div>
      </PhoneFrame>
    );
  }

  if (charge.status === "recusado" || charge.status === "cancelado") {
    return (
      <PhoneFrame>
        <AppHeader title="Acréscimo de valor" back />
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
          <div className="h-14 w-14 rounded-full bg-secondary flex items-center justify-center">
            <X className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="font-semibold">
            {charge.status === "recusado" ? "Você recusou este acréscimo" : "Acréscimo cancelado"}
          </p>
        </div>
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame>
      <AppHeader title="Acréscimo de valor" back />
      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-32">
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900">
            {providerName} pediu um valor a mais para concluir seu serviço. Leia o motivo, e decida
            aprovar ou recusar — nada é cobrado sem sua aprovação.
          </p>
        </div>

        <div className="mt-4 rounded-2xl bg-card border border-border p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">
            Motivo informado pelo prestador
          </p>
          <p className="text-sm">{charge.reason}</p>
        </div>

        <div className="mt-4 rounded-2xl bg-card border border-border divide-y divide-border">
          <Row label="Acréscimo" value={`R$ ${Number(charge.amount).toFixed(2)}`} />
          <Row
            label="Taxa BICOJÁ"
            value={`R$ ${Number(charge.platform_fee).toFixed(2)}`}
            hint="Mesma proteção do pedido original"
          />
          <Row label="Total" value={`R$ ${Number(charge.total).toFixed(2)}`} bold />
        </div>

        {charge.status === "aprovado" && (
          <div className="mt-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Forma de pagamento
            </p>
            <div className="rounded-2xl bg-card border border-border overflow-hidden">
              <button
                hidden={!(settings?.card_enabled ?? true)}
                onClick={() => setMethod("card")}
                className={`w-full flex items-center gap-3 p-4 border-b border-border ${method === "card" ? "bg-secondary/50" : ""}`}
              >
                <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-sm">Cartão de crédito</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
              <button
                hidden={!(settings?.pix_enabled ?? true)}
                onClick={() => setMethod("pix")}
                className={`w-full flex items-center gap-3 p-4 ${method === "pix" ? "bg-secondary/50" : ""}`}
              >
                <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-sm">Pix</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-background via-background to-background/0 pt-8 space-y-2">
        {charge.status === "solicitado" && (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => respond(false)}
              disabled={busy}
              className="h-14 rounded-2xl border border-border font-semibold disabled:opacity-50"
            >
              Recusar
            </button>
            <button
              onClick={() => respond(true)}
              disabled={busy}
              className="h-14 rounded-2xl bg-primary text-primary-foreground font-semibold disabled:opacity-50"
            >
              Aprovar
            </button>
          </div>
        )}
        {charge.status === "aprovado" && (
          <button
            onClick={pay}
            disabled={busy}
            className="w-full h-14 rounded-2xl bg-primary text-primary-foreground text-base font-semibold flex items-center justify-center gap-2 shadow-card disabled:opacity-50"
          >
            <Lock className="h-5 w-5" /> {busy ? "Confirmando..." : "Pagar acréscimo com proteção"}
          </button>
        )}
      </div>
    </PhoneFrame>
  );
}

function Row({
  label,
  value,
  hint,
  bold,
}: {
  label: string;
  value: string;
  hint?: string;
  bold?: boolean;
}) {
  return (
    <div className="p-4 flex items-center justify-between">
      <div>
        <p className={bold ? "text-base font-bold" : "text-sm"}>{label}</p>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      <p className={bold ? "text-lg font-extrabold font-[Manrope]" : "text-sm font-semibold"}>
        {value}
      </p>
    </div>
  );
}
