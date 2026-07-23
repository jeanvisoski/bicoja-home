import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/bicoja/PhoneFrame";
import { AppHeader } from "@/components/bicoja/AppHeader";
import { PROVIDER_TERMS_VERSION } from "@/lib/terms-versions";

export const Route = createFileRoute("/provider-terms")({
  component: ProviderTerms,
  head: () => ({ meta: [{ title: "Contrato do Prestador — BICOJÁ" }] }),
});

function ProviderTerms() {
  return (
    <PhoneFrame>
      <AppHeader title="Contrato de prestação" back />
      <main className="flex-1 overflow-y-auto px-5 py-5 pb-8 space-y-5 text-sm leading-relaxed">
        <Section title="1. Natureza da relação">
          <p>
            Você presta serviços de forma <strong>autônoma e independente</strong>. Não há vínculo
            empregatício, subordinação, exclusividade ou horário fixo entre você e a BICOJÁ. Você
            decide livremente quais pedidos aceitar ou recusar, define o valor de cada orçamento
            dentro do que o cliente solicitou, e pode atender clientes fora da plataforma ou por
            outros aplicativos.
          </p>
        </Section>
        <Section title="2. Responsabilidade fiscal e previdenciária">
          <p>
            Você é responsável por emitir nota fiscal quando aplicável, por seu enquadramento como
            MEI/autônomo, e pelo recolhimento de tributos e contribuição previdenciária (INSS). A
            BICOJÁ não retém, não recolhe e não é responsável por encargos trabalhistas ou
            previdenciários referentes ao seu trabalho.
          </p>
        </Section>
        <Section title="3. Como funciona o pagamento">
          <p>
            Você recebe o <strong>valor integral</strong> do serviço acordado com o cliente. A taxa
            de proteção ao cliente (configurada hoje pela BICOJÁ, sujeita a alteração) é cobrada do
            cliente <strong>além do</strong> valor do serviço — ela não é descontada do seu repasse.
            O valor fica retido durante o prazo de garantia informado no checkout antes de poder ser
            sacado (veja a seção 6).
          </p>
        </Section>
        <Section title="4. Verificação e regras de conduta">
          <p>
            Antes de solicitar saque, você precisa enviar documento de identidade para análise e
            cadastrar uma chave Pix validada pela equipe. Você não pode solicitar Pix, dinheiro,
            transferência ou qualquer pagamento fora do fluxo da BICOJÁ para um serviço originado
            pela plataforma. Violação dessa regra, fraude ou conduta inadequada pode gerar
            advertência, perda de destaque, suspensão ou encerramento da sua conta.
          </p>
        </Section>
        <Section title="5. Execução e evidências">
          <p>
            Ao concluir o serviço, você deve enviar fotos do resultado e confirmar o valor final
            dentro da faixa aprovada pelo cliente. Essas fotos e o histórico de mensagens podem ser
            usados como prova em caso de disputa ou denúncia.
          </p>
        </Section>
        <Section title="6. Garantia e disputa">
          <p>
            Depois que o cliente confirma a conclusão, o valor permanece retido pelo prazo de
            garantia informado no checkout. Nesse período, o cliente pode abrir uma disputa. A
            BICOJÁ analisa registros, mensagens, fotos e relatos das duas partes para decidir entre
            liberar o valor a você, ou reembolsar o cliente total ou parcialmente.
          </p>
        </Section>
        <Section title="7. Responsabilidade civil">
          <p>
            Você é responsável pelos danos que causar na execução do serviço perante o cliente. A
            BICOJÁ atua como intermediadora e mediadora — ela não executa o serviço contratado nem
            substitui você na relação com o cliente. Recomendamos que você avalie a contratação de
            seguro próprio adequado à sua atividade.
          </p>
        </Section>
        <Section title="8. Suspensão e encerramento">
          <p>
            Sua conta pode ser suspensa ou encerrada em caso de violação deste contrato, denúncia
            procedente ou fraude, com o saldo já disponível preservado para saque conforme as regras
            vigentes na data do encerramento.
          </p>
        </Section>
        <Section title="9. Atualizações deste contrato">
          <p>
            A BICOJÁ pode atualizar este contrato. Mudanças relevantes são avisadas no app, e o uso
            continuado da plataforma depois do aviso implica aceite da nova versão.
          </p>
        </Section>
        <p className="text-xs text-muted-foreground">
          Versão {PROVIDER_TERMS_VERSION}. Dúvidas? Consulte a{" "}
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
