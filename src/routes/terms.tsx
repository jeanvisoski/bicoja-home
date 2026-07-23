import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/bicoja/PhoneFrame";
import { AppHeader } from "@/components/bicoja/AppHeader";
import { CLIENT_TERMS_VERSION } from "@/lib/terms-versions";

export const Route = createFileRoute("/terms")({
  component: Terms,
  head: () => ({ meta: [{ title: "Termos de Uso — BICOJÁ" }] }),
});

function Terms() {
  return (
    <PhoneFrame>
      <AppHeader title="Termos e proteção" back />
      <main className="flex-1 overflow-y-auto px-5 py-5 pb-8 space-y-5 text-sm leading-relaxed">
        <Section title="1. Papel da BICOJÁ">
          <p>
            A BICOJÁ conecta clientes e prestadores e oferece registro do atendimento, comunicação,
            orçamento, suporte e mediação. O serviço contratado é executado pelo prestador
            escolhido.
          </p>
        </Section>
        <Section title="2. Pagamento pela plataforma">
          <p>
            Todo serviço originado pela BICOJÁ deve ser pago pelo fluxo disponibilizado no pedido.
            Pagamentos externos não possuem proteção, mediação, histórico verificável ou cobertura
            da BICOJÁ.
          </p>
          <p className="mt-2">
            O valor final deve respeitar o orçamento aceito. Em faixa de preço, o cliente aprova o
            total final antes da conclusão e da liberação do repasse.
          </p>
        </Section>
        <Section title="3. Regras do prestador">
          <p>
            O prestador não pode solicitar Pix, dinheiro, transferência ou outro pagamento externo
            para serviço iniciado pela BICOJÁ. Tentativas de desvio podem gerar advertência, perda
            de destaque, suspensão ou encerramento da conta. Prestadores também aceitam, em um
            documento próprio, o{" "}
            <Link to="/provider-terms" className="text-primary font-semibold">
              Contrato de Prestação de Serviço Autônomo
            </Link>
            , que detalha a natureza da relação, repasse e responsabilidades.
          </p>
        </Section>
        <Section title="4. Proteção, garantia e mediação">
          <p>
            O cliente deve conferir fotos, valor final e execução antes de confirmar a conclusão.
            Depois da confirmação, o valor do serviço permanece em garantia pelo prazo informado no
            checkout. Dentro desse prazo, o cliente pode abrir uma disputa pelo pedido. A BICOJÁ
            analisa registros, mensagens, fotos e relatos para mediar a solução; reembolsos dependem
            da análise do caso e do meio de pagamento.
          </p>
        </Section>
        <Section title="5. Privacidade">
          <p>
            Dados de contato e endereço são usados somente para viabilizar o atendimento.
            Informações do pedido são compartilhadas com as partes envolvidas e com a equipe de
            suporte quando necessário. Documentos de verificação de prestadores ficam restritos à
            equipe autorizada.
          </p>
        </Section>
        <Section title="6. Denúncias">
          <p>
            É possível denunciar pedido de pagamento externo ou conduta inadequada dentro da
            conversa. Denúncias maliciosas também podem ser analisadas.
          </p>
        </Section>
        <p className="text-xs text-muted-foreground">
          Versão {CLIENT_TERMS_VERSION}. Dúvidas? Consulte a{" "}
          <Link to="/help" className="text-primary font-semibold">
            central de ajuda
          </Link>
          .
        </p>
      </main>
    </PhoneFrame>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-bold text-base mb-1">{title}</h2>
      {children}
    </section>
  );
}
