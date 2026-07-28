import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, Wallet } from "lucide-react";
import { PhoneFrame } from "@/components/bicoja/PhoneFrame";
import { AppHeader } from "@/components/bicoja/AppHeader";
import { BottomNav } from "@/components/bicoja/BottomNav";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/payments")({
  component: PaymentsPage,
  head: () => ({ meta: [{ title: "Pagamentos — BICOJÁ" }] }),
});

type PaymentMode = "homologacao" | "sandbox" | "producao";

function usePaymentMode() {
  return useQuery({
    queryKey: ["payment-settings", "mode"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("payment_mode")
        .eq("id", true)
        .single();
      // Mantem a tela funcional enquanto o banco recebe a migration de pagamento.
      if (error?.code === "42703") return "homologacao" as PaymentMode;
      if (error) throw error;
      return (data?.payment_mode as PaymentMode) ?? "homologacao";
    },
  });
}

const STATUS_COPY: Record<PaymentMode, { title: string; body: string }> = {
  homologacao: {
    title: "Ainda em fase de testes internos",
    body: "Nesta fase, o pagamento na tela de checkout é simulado — nenhuma cobrança real acontece. Cartões e Pix reais serão integrados antes do lançamento oficial.",
  },
  sandbox: {
    title: "Ambiente de testes Mercado Pago",
    body: "O checkout já passa pelo Mercado Pago em modo sandbox — use uma conta compradora de teste. Ainda não é dinheiro real.",
  },
  producao: {
    title: "Pagamento real via Mercado Pago",
    body: "Cartão e Pix são processados de verdade pelo Mercado Pago no momento do checkout. A BICOJÁ não armazena dados de cartão.",
  },
};

function PaymentsPage() {
  const { data: mode } = usePaymentMode();
  const copy = STATUS_COPY[mode ?? "homologacao"];
  return (
    <PhoneFrame>
      <AppHeader title="Pagamentos" back="/profile" />
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="rounded-2xl bg-trust-soft/50 border border-trust/20 p-4 mb-4">
          <p className="text-sm font-semibold mb-1">{copy.title}</p>
          <p className="text-xs text-muted-foreground">{copy.body}</p>
        </div>
        <div className="rounded-2xl bg-card border border-border divide-y divide-border overflow-hidden">
          <div className="flex items-center gap-3 p-4 opacity-50">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm">Nenhum cartão cadastrado</p>
          </div>
          <div className="flex items-center gap-3 p-4 opacity-50">
            <Wallet className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm">Pix não configurado</p>
          </div>
        </div>
      </div>
      <BottomNav variant="client" />
    </PhoneFrame>
  );
}
