import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/bicoja/PhoneFrame";
import { AppHeader } from "@/components/bicoja/AppHeader";

export const Route = createFileRoute("/privacy")({
  component: Privacy,
  head: () => ({ meta: [{ title: "Política de Privacidade — BICOJÁ" }] }),
});

const LAST_UPDATED = "2026-07-29";

function Privacy() {
  return (
    <PhoneFrame>
      <AppHeader title="Política de Privacidade" back />
      <main className="flex-1 overflow-y-auto px-5 py-5 pb-8 space-y-5 text-sm leading-relaxed">
        <p className="text-xs text-muted-foreground">
          Última atualização: {LAST_UPDATED}. Este documento descreve o tratamento de dados pessoais
          na BICOJÁ, em linha com a Lei Geral de Proteção de Dados (LGPD).
        </p>

        <Section title="1. Quais dados coletamos">
          <p>
            Nome, e-mail, telefone, foto de perfil e endereços que você cadastra; descrição, fotos e
            localização do serviço solicitado; mensagens trocadas com a outra parte do pedido; e, se
            você é prestador, documento de identidade, selfie e comprovantes enviados para
            verificação.
          </p>
        </Section>

        <Section title="2. Por que coletamos">
          <p>
            Para viabilizar o cadastro, o orçamento, a execução do serviço, a comunicação entre
            cliente e prestador, o pagamento e a garantia BICOJÁ, e para verificar a identidade de
            quem presta serviço (essencial pra segurança de quem abre a porta de casa). A base legal
            é a execução do contrato entre você e a BICOJÁ (LGPD, art. 7º, V).
          </p>
        </Section>

        <Section title="3. Com quem compartilhamos">
          <p>
            Com a outra parte do pedido (nome, foto, avaliação e o necessário pra execução do
            serviço); com o Mercado Pago, para processar pagamentos e reembolsos; e com o Supabase,
            provedor de hospedagem e banco de dados que processa dados em nosso nome sob contrato.
            Documentos de verificação de prestador ficam restritos à equipe autorizada da BICOJÁ.
            Não vendemos dados pessoais a terceiros.
          </p>
        </Section>

        <Section title="4. Cookies e rastreamento">
          <p>
            Hoje a BICOJÁ não usa cookies de publicidade ou analytics de terceiros. Usamos apenas
            cookies e armazenamento local estritamente necessários para manter sua sessão logada
            (via Supabase Auth) — sem eles o app não funciona, e por isso não pedimos consentimento
            para esse uso específico. Se no futuro adicionarmos analytics ou publicidade, este aviso
            será atualizado e, quando exigido, pediremos seu consentimento antes.
          </p>
        </Section>

        <Section title="5. Onde seus dados ficam">
          <p>
            Seus dados são armazenados em servidores do Supabase, que podem estar localizados fora
            do Brasil. Ao usar a BICOJÁ, você concorda com essa transferência internacional,
            necessária para a operação do serviço.
          </p>
        </Section>

        <Section title="6. Por quanto tempo guardamos">
          <p>
            Enquanto sua conta estiver ativa. Dados de pedidos e pagamentos podem ser mantidos além
            da exclusão da conta, de forma anonimizada, quando exigido por obrigação legal, fiscal
            ou para prevenção a fraude.
          </p>
        </Section>

        <Section title="7. Seus direitos">
          <p>
            Você pode, a qualquer momento: acessar e baixar uma cópia dos seus dados (
            <Link to="/security" className="text-primary font-semibold">
              tela de Segurança e privacidade
            </Link>
            ), corrigir informações do perfil, e excluir sua conta e seus dados pessoais (mesma
            tela). Para outras solicitações relacionadas aos seus dados, fale com a{" "}
            <Link to="/help" className="text-primary font-semibold">
              central de ajuda
            </Link>
            .
          </p>
        </Section>

        <p className="text-xs text-muted-foreground">
          Este documento ainda deve passar por revisão jurídica antes da publicação comercial dos
          aplicativos. Ver também os{" "}
          <Link to="/terms" className="text-primary font-semibold">
            Termos de Uso
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
