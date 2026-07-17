# Arquitetura — BICOJÁ (web)

## Stack

- **Front/SSR**: TanStack Start (React 19 + TanStack Router) — gerado pelo Lovable, mantido como base.
- **Estilo**: Tailwind CSS v4 + shadcn/ui (Radix).
- **Backend**: Supabase (Postgres + Auth + Storage + Realtime), projeto próprio da sociedade — free tier.
- **Pagamento**: a definir (Mercado Pago é o candidato natural pelo histórico do app mobile), fora do MVP inicial.
- **Deploy**: hospedagem free tier compatível com SSR (Vercel/Netlify/Cloudflare Pages) — ver `docs/DEPLOY.md` quando existir.

## Estado em 2026-07-16

Todas as telas existentes (`src/routes/*`) são protótipo visual com dados mockados no
componente — nenhuma chamada real a backend. O trabalho de "produtizar" é: manter as
telas e a UX como estão, trocar os dados hardcoded por dados reais do Supabase.

## Modelo de dados

Ver `supabase/migrations/0001_init.sql` para o schema completo com RLS. Resumo:

- `profiles` — 1:1 com `auth.users`. Um único usuário pode ser cliente e, opcionalmente,
  também prestador (`is_provider` + linha em `provider_profiles`) — mesma decisão de
  produto usada no app mobile antigo: **não existem dois tipos de conta**, existem dois
  papéis no mesmo usuário.
- `addresses` — endereços do cliente.
- `provider_profiles` / `provider_portfolio` — dados de prestador: especialidades,
  verificação, portfólio, métricas (rating, jobs).
- `service_categories` — categorias fixas (eletricista, encanador, pintor, pedreiro,
  jardineiro, diarista, chaveiro, marido de aluguel).
- `service_requests` / `request_photos` — pedido do cliente (categoria, descrição,
  fotos, endereço, urgência).
- `proposals` — orçamentos que prestadores enviam para uma solicitação aberta.
- `orders` / `order_status_events` / `order_photos` — contrato firmado a partir de uma
  proposta aceita; timeline de status (aceito → a caminho → executando → fotos enviadas
  → aguardando confirmação → concluído); fotos de antes/depois.
- `conversations` / `messages` — chat 1:1 por pedido.
- `ratings` — avaliação do cliente ao final (estrelas + 3 perguntas sim/não + comentário),
  gatilho para liberar o pagamento retido.
- `wallet_transactions` — extrato do prestador (crédito pendente, liberado, saque).
  Regra: o crédito é liberado em duas parcelas (50% em 24h, 50% após confirmação do
  cliente) — comportamento visto em `src/routes/pro.orders.tsx`, fase "recebimento".

## Por que reaproveitar o modelo do app mobile

O app mobile Expo (`confia-mobile-mvp`, descontinuado em 2026-07-16 — ver memória
`project_confia_web_pivot`) já validou esse fluxo de produto ponta a ponta em protótipo
clicável. O schema aqui é uma tradução direta daquele aprendizado para o novo front,
não um redesenho do zero.

## Regras de segurança (RLS)

- Nenhuma tabela de negócio é acessível sem policy explícita.
- Cálculo de taxa da plataforma e movimentação de `wallet_transactions` deve rodar em
  função de servidor (service_role / server function do TanStack Start), nunca inserida
  diretamente pelo cliente — evita prestador manipular o próprio saldo.
- `service_requests` abertas são visíveis a qualquer prestador verificado (para poder
  enviar proposta); depois de `contratado`, só cliente e prestador do pedido enxergam.

## Pendências de infraestrutura

1. Criar o projeto Supabase da empresa (conta/organização separada da pessoal do Jean)
   e aplicar `supabase/migrations/0001_init.sql`.
2. Preencher `.env.local` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (nunca a
   `service_role` no front).
3. Definir hospedagem gratuita para o deploy de produção.
