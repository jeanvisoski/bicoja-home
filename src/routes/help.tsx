import { createFileRoute } from "@tanstack/react-router";
import { HelpCircle } from "lucide-react";
import { PhoneFrame } from "@/components/bicoja/PhoneFrame";
import { AppHeader } from "@/components/bicoja/AppHeader";

export const Route = createFileRoute("/help")({
  component: HelpPage,
  head: () => ({ meta: [{ title: "Central de ajuda — BICOJÁ" }] }),
});

const FAQ = [
  {
    q: "Como funciona o pagamento protegido?",
    a: "O valor do serviço fica retido pela BICOJÁ até você confirmar que o serviço foi concluído. Só depois disso o prestador recebe.",
  },
  {
    q: "O que acontece se eu tiver um problema com o serviço?",
    a: 'Na tela de conclusão do pedido, use "Reportar problema" para explicar o que aconteceu. Nossa equipe media a situação antes de liberar o pagamento.',
  },
  {
    q: "Como me tornar um prestador?",
    a: 'Contas de cliente e de prestador são separadas. Saia da sua conta atual, toque em "Ainda não tem conta? Criar conta" e escolha "Quero oferecer serviços". Prestadores passam por uma verificação antes de aparecerem em destaque.',
  },
  {
    q: "Como funciona a avaliação?",
    a: "Depois de confirmar a conclusão do serviço, você avalia o prestador com estrelas e um comentário — isso ajuda outros clientes e libera o pagamento.",
  },
];

function HelpPage() {
  return (
    <PhoneFrame>
      <AppHeader title="Central de ajuda" back="/profile" />
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {FAQ.map((item) => (
          <div key={item.q} className="rounded-2xl bg-card border border-border p-4">
            <div className="flex items-start gap-2 mb-1">
              <HelpCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-sm font-semibold">{item.q}</p>
            </div>
            <p className="text-sm text-muted-foreground pl-6">{item.a}</p>
          </div>
        ))}
        <p className="text-xs text-muted-foreground text-center pt-4">
          Não encontrou o que precisava? Canal de suporte direto ainda não está configurado neste
          MVP.
        </p>
      </div>
    </PhoneFrame>
  );
}
