import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { PhoneFrame } from "@/components/bicoja/PhoneFrame";
import { AppHeader } from "@/components/bicoja/AppHeader";

export const Route = createFileRoute("/terms")({
  component: Terms,
  head: () => ({ meta: [{ title: "Termos de Uso — BICOJÁ" }] }),
});

function Terms() {
  return (
    <PhoneFrame>
      <AppHeader title="Termos e proteção" back />
      <main className="flex-1 overflow-y-auto px-5 py-5 pb-8 space-y-5 text-sm leading-relaxed">
        <div className="rounded-2xl bg-trust-soft/50 border border-trust/20 p-4 flex gap-3"><ShieldCheck className="h-5 w-5 text-trust shrink-0" /><p><strong>Versão de operação inicial.</strong> Este texto deve passar por revisão jurídica antes da publicação comercial da BICOJÁ.</p></div>
        <Section title="1. Papel da BICOJÁ"><p>A BICOJÁ conecta clientes e prestadores e oferece registro do atendimento, comunicação, orçamento, suporte e mediação. O serviço contratado é executado pelo prestador escolhido.</p></Section>
        <Section title="2. Pagamento pela plataforma"><p>Todo serviço originado pela BICOJÁ deve ser pago pelo fluxo disponibilizado no pedido. Pagamentos externos não possuem proteção, mediação, histórico verificável ou cobertura da BICOJÁ.</p><p className="mt-2">O valor final deve respeitar o orçamento aceito. Em faixa de preço, o cliente aprova o total final antes da conclusão e da liberação do repasse.</p></Section>
        <Section title="3. Regras do prestador"><p>O prestador não pode solicitar Pix, dinheiro, transferência ou outro pagamento externo para serviço iniciado pela BICOJÁ. Tentativas de desvio podem gerar advertência, perda de destaque, suspensão ou encerramento da conta.</p></Section>
        <Section title="4. Proteção e mediação"><p>O cliente deve conferir fotos, valor final e execução antes de confirmar a conclusão. Havendo problema, pode abrir uma disputa pelo pedido. A BICOJÁ analisa registros, mensagens, fotos e relatos para mediar a solução.</p></Section>
        <Section title="5. Privacidade"><p>Dados de contato e endereço são usados somente para viabilizar o atendimento. Informações do pedido são compartilhadas com as partes envolvidas e com a equipe de suporte quando necessário.</p></Section>
        <Section title="6. Denúncias"><p>É possível denunciar pedido de pagamento externo ou conduta inadequada dentro da conversa. Denúncias maliciosas também podem ser analisadas.</p></Section>
        <p className="text-xs text-muted-foreground">Atualizado em 17/07/2026. Dúvidas? Consulte a <Link to="/help" className="text-primary font-semibold">central de ajuda</Link>.</p>
      </main>
    </PhoneFrame>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section><h2 className="font-bold text-base mb-1">{title}</h2>{children}</section>; }
