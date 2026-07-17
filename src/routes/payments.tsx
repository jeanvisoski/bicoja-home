import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, Wallet } from "lucide-react";
import { PhoneFrame } from "@/components/bicoja/PhoneFrame";
import { AppHeader } from "@/components/bicoja/AppHeader";

export const Route = createFileRoute("/payments")({
  component: PaymentsPage,
  head: () => ({ meta: [{ title: "Pagamentos — BICOJÁ" }] }),
});

function PaymentsPage() {
  return (
    <PhoneFrame>
      <AppHeader title="Pagamentos" back="/profile" />
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="rounded-2xl bg-trust-soft/50 border border-trust/20 p-4 mb-4">
          <p className="text-sm font-semibold mb-1">Ainda em fase de testes</p>
          <p className="text-xs text-muted-foreground">
            Neste MVP, o pagamento na tela de checkout é simulado — nenhuma cobrança real acontece.
            Cartões e Pix reais serão integrados antes do lançamento oficial.
          </p>
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
    </PhoneFrame>
  );
}
