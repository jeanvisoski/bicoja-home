import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Lock,
  Wallet,
  CreditCard,
  ChevronRight,
  ArrowDown,
  CheckCircle2,
  Camera,
} from "lucide-react";
import { PhoneFrame } from "@/components/bicoja/PhoneFrame";
import { AppHeader } from "@/components/bicoja/AppHeader";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/payment")({
  component: Payment,
  validateSearch: (search: Record<string, unknown>): { orderId?: string } => ({
    orderId: typeof search.orderId === "string" ? search.orderId : undefined,
  }),
  head: () => ({ meta: [{ title: "Pagamento — BICOJÁ" }] }),
});

function useOrder(orderId: string | undefined) {
  return useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, proposal_id, request_id, price, platform_fee, total, status, payment_status")
        .eq("id", orderId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
  });
}

type PaymentSettings = {
  payment_mode: "homologacao" | "sandbox" | "producao";
  payment_gateway: "mercado_pago";
  pix_enabled: boolean;
  card_enabled: boolean;
};

const HOMOLOGATION_SETTINGS: PaymentSettings = {
  payment_mode: "homologacao",
  payment_gateway: "mercado_pago",
  pix_enabled: true,
  card_enabled: true,
};

function usePaymentSettings() {
  return useQuery({
    queryKey: ["payment-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("payment_mode, payment_gateway, pix_enabled, card_enabled")
        .eq("id", true)
        .single();
      // Mantem os testes funcionais enquanto o banco recebe a migration.
      if (error?.code === "42703") return HOMOLOGATION_SETTINGS;
      if (error) throw error;
      return (data as PaymentSettings) ?? HOMOLOGATION_SETTINGS;
    },
  });
}

function Payment() {
  const { orderId } = Route.useSearch();
  const nav = useNavigate();
  const { data: order } = useOrder(orderId);
  const { data: settings } = usePaymentSettings();
  const [paying, setPaying] = useState(false);
  const [method, setMethod] = useState<"pix" | "card">("pix");
  // MVP em validacao: nenhum fluxo deve encaminhar para cobranca real.
  const isHomologation = true;

  async function pay() {
    if (!orderId) return;
    setPaying(true);
    if (isHomologation) {
      const { error } = await supabase.rpc("confirm_order_payment", { p_order_id: orderId });
      setPaying(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      await supabase.from("order_status_events").insert({
        order_id: orderId,
        status: "aceito",
        note: "Pagamento confirmado em homologacao",
      });
      nav({ to: "/tracking", search: { orderId } });
      return;
    }
    const { data, error } = await supabase.functions.invoke("create-mercadopago-checkout", {
      body: { orderId, method },
    });
    setPaying(false);
    if (error || !data?.checkoutUrl) {
      toast.error(error?.message ?? "Nao foi possivel iniciar o checkout.");
      return;
    }
    window.location.assign(data.checkoutUrl as string);
  }

  const pixAvailable = settings?.pix_enabled ?? true;
  const cardAvailable = settings?.card_enabled ?? true;

  return (
    <PhoneFrame>
      <AppHeader title="Pagamento" back right={<Link to="/orders" className="text-xs font-semibold text-primary px-1">Pedidos</Link>} />

      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-32">
        <div className="rounded-3xl bg-hero p-5 text-primary-foreground shadow-float relative overflow-hidden">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest bg-white/15 rounded-full px-2.5 py-1 mb-3">
              <Lock className="h-3 w-3" /> Pagamento protegido
            </div>
            <p className="text-sm opacity-80">Total a pagar</p>
            <p className="text-4xl font-extrabold font-[Manrope] mt-1">
              R$ {order?.total?.toFixed(2) ?? "—"}
            </p>
            <p className="text-xs opacity-80 mt-2">
              Seu dinheiro fica com a BICOJÁ até você confirmar.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl bg-card border border-border divide-y divide-border">
          <Row label="Serviço" value={`R$ ${order?.price?.toFixed(2) ?? "—"}`} />
          <Row
            label="Taxa BICOJÁ"
            value={`R$ ${order?.platform_fee?.toFixed(2) ?? "—"}`}
            hint="Cobre mediação e garantia"
          />
          <Row label="Total" value={`R$ ${order?.total?.toFixed(2) ?? "—"}`} bold />
        </div>

        <div className="mt-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Forma de pagamento
          </p>
          <div className="rounded-2xl bg-card border border-border overflow-hidden">
            <button hidden={!cardAvailable} onClick={() => setMethod("card")} className={`w-full flex items-center gap-3 p-4 border-b border-border ${method === "card" ? "bg-secondary/50" : ""}`}>
              <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-sm">Cartão •••• 4291</p>
                <p className="text-xs text-muted-foreground">Vence em 08/28</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
            <button hidden={!pixAvailable} onClick={() => setMethod("pix")} className={`w-full flex items-center gap-3 p-4 ${method === "pix" ? "bg-secondary/50" : ""}`}>
              <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-sm">Pix</p>
                <p className="text-xs text-muted-foreground">Aprovação instantânea</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 px-1">
            Gateway de pagamento real ainda não integrado — este passo apenas confirma o pedido.
          </p>
        </div>

        <p className="text-[11px] text-primary font-medium mt-1 px-1">
          {isHomologation ? "Homologacao: a aprovacao e simulada." : settings?.payment_mode === "sandbox" ? "Sandbox Mercado Pago: use credenciais e contas de teste." : "Producao: voce sera levado ao checkout Mercado Pago."}
        </p>

        <div className="mt-6 rounded-2xl border border-border bg-trust-soft/40 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-trust mb-4">
            Como funciona a garantia
          </p>
          <Timeline />
        </div>
      </div>

      <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-background via-background to-background/0 pt-8">
        <button
          onClick={pay}
          disabled={!orderId || paying || (!pixAvailable && !cardAvailable)}
          className="w-full h-14 rounded-2xl bg-primary text-primary-foreground text-base font-semibold flex items-center justify-center gap-2 shadow-card active:scale-[0.99] transition-transform disabled:opacity-50"
        >
          <Lock className="h-5 w-5" /> {paying ? "Confirmando..." : "Pagar com proteção"}
        </button>
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

function Timeline() {
  const steps = [
    { icon: Wallet, label: "Pagamento realizado" },
    { icon: CheckCircle2, label: "Prestador executa" },
    { icon: Camera, label: "Fotos enviadas" },
    { icon: CheckCircle2, label: "Cliente confirma" },
    { icon: Wallet, label: "Pagamento liberado" },
  ];
  return (
    <div className="space-y-2">
      {steps.map((s, i) => (
        <div key={i}>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-background border border-border flex items-center justify-center">
              <s.icon className="h-4 w-4 text-trust" />
            </div>
            <p className="text-sm font-medium">{s.label}</p>
          </div>
          {i < steps.length - 1 && (
            <div className="ml-[17px] flex items-center h-4">
              <ArrowDown className="h-3 w-3 text-trust/50" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
