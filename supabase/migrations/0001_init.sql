-- BICOJÁ — schema inicial do MVP web
-- Convenção: toda tabela de negócio tem RLS habilitada; profiles.id = auth.users.id (1:1).

create extension if not exists "pgcrypto";

-- ============================================================
-- PROFILES
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text,
  phone text,
  avatar_url text,
  is_provider boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles são públicos para leitura básica"
  on public.profiles for select
  using (true);

create policy "usuário edita o próprio profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "usuário cria o próprio profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- ============================================================
-- ENDEREÇOS
-- ============================================================

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  label text,
  street text not null,
  neighborhood text,
  city text not null,
  state text,
  lat double precision,
  lng double precision,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.addresses enable row level security;

create policy "dono vê/edita seus endereços"
  on public.addresses for all
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

-- ============================================================
-- PRESTADORES
-- ============================================================

create table public.provider_profiles (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  headline text,
  bio text,
  specialties text[] not null default '{}',
  city text,
  verification_status text not null default 'pendente'
    check (verification_status in ('pendente', 'em_analise', 'verificado', 'rejeitado')),
  rating_avg numeric(3, 2) not null default 0,
  rating_count integer not null default 0,
  jobs_count integer not null default 0,
  member_since date not null default current_date
);

alter table public.provider_profiles enable row level security;

create policy "perfis de prestador são públicos"
  on public.provider_profiles for select
  using (true);

create policy "prestador edita o próprio perfil"
  on public.provider_profiles for all
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

create table public.provider_portfolio (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles (profile_id) on delete cascade,
  photo_url text not null,
  created_at timestamptz not null default now()
);

alter table public.provider_portfolio enable row level security;

create policy "portfólio é público"
  on public.provider_portfolio for select
  using (true);

create policy "prestador gerencia seu portfólio"
  on public.provider_portfolio for insert
  with check (auth.uid() = provider_id);

create policy "prestador remove do seu portfólio"
  on public.provider_portfolio for delete
  using (auth.uid() = provider_id);

-- ============================================================
-- CATEGORIAS DE SERVIÇO
-- ============================================================

create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  icon text not null,
  sort_order integer not null default 0
);

alter table public.service_categories enable row level security;

create policy "categorias são públicas"
  on public.service_categories for select
  using (true);

insert into public.service_categories (slug, label, icon, sort_order) values
  ('eletricista', 'Eletricista', 'Zap', 1),
  ('encanador', 'Encanador', 'Wrench', 2),
  ('pintor', 'Pintor', 'PaintRoller', 3),
  ('pedreiro', 'Pedreiro', 'Hammer', 4),
  ('jardineiro', 'Jardineiro', 'Sprout', 5),
  ('diarista', 'Diarista', 'Sparkles', 6),
  ('chaveiro', 'Chaveiro', 'Key', 7),
  ('marido_de_aluguel', 'Marido de aluguel', 'Home', 8);

-- ============================================================
-- SOLICITAÇÕES DE SERVIÇO
-- ============================================================

create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  category_id uuid not null references public.service_categories (id),
  description text not null,
  address_id uuid references public.addresses (id),
  urgency text not null check (urgency in ('hoje', 'esta_semana', 'sem_pressa')),
  status text not null default 'aberto'
    check (status in ('aberto', 'em_negociacao', 'contratado', 'cancelado')),
  created_at timestamptz not null default now()
);

alter table public.service_requests enable row level security;

create policy "cliente vê/gerencia as próprias solicitações"
  on public.service_requests for all
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);

create policy "prestadores veem solicitações abertas"
  on public.service_requests for select
  using (
    status = 'aberto'
    and exists (select 1 from public.provider_profiles pp where pp.profile_id = auth.uid())
  );

create table public.request_photos (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests (id) on delete cascade,
  photo_url text not null,
  created_at timestamptz not null default now()
);

alter table public.request_photos enable row level security;

create policy "fotos seguem a visibilidade da solicitação"
  on public.request_photos for select
  using (
    exists (
      select 1 from public.service_requests r
      where r.id = request_id
        and (r.client_id = auth.uid() or r.status = 'aberto')
    )
  );

create policy "cliente anexa fotos na própria solicitação"
  on public.request_photos for insert
  with check (
    exists (select 1 from public.service_requests r where r.id = request_id and r.client_id = auth.uid())
  );

-- ============================================================
-- PROPOSTAS
-- ============================================================

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests (id) on delete cascade,
  provider_id uuid not null references public.provider_profiles (profile_id) on delete cascade,
  price numeric(10, 2) not null,
  eta_minutes integer,
  message text,
  status text not null default 'pendente'
    check (status in ('pendente', 'aceita', 'recusada', 'expirada')),
  created_at timestamptz not null default now(),
  unique (request_id, provider_id)
);

alter table public.proposals enable row level security;

create policy "cliente da solicitação vê as propostas"
  on public.proposals for select
  using (
    exists (select 1 from public.service_requests r where r.id = request_id and r.client_id = auth.uid())
    or provider_id = auth.uid()
  );

create policy "prestador cria proposta para solicitação aberta"
  on public.proposals for insert
  with check (
    provider_id = auth.uid()
    and exists (select 1 from public.service_requests r where r.id = request_id and r.status = 'aberto')
  );

create policy "cliente aceita/recusa, prestador atualiza a própria proposta"
  on public.proposals for update
  using (
    provider_id = auth.uid()
    or exists (select 1 from public.service_requests r where r.id = request_id and r.client_id = auth.uid())
  );

-- ============================================================
-- PEDIDOS (contrato firmado a partir de uma proposta aceita)
-- ============================================================

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests (id),
  proposal_id uuid not null references public.proposals (id),
  client_id uuid not null references public.profiles (id),
  provider_id uuid not null references public.provider_profiles (profile_id),
  price numeric(10, 2) not null,
  platform_fee numeric(10, 2) not null,
  total numeric(10, 2) not null,
  status text not null default 'aceito' check (status in (
    'aceito', 'a_caminho', 'executando', 'fotos_enviadas',
    'aguardando_confirmacao', 'concluido', 'em_disputa', 'cancelado'
  )),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.orders enable row level security;

create policy "cliente e prestador do pedido têm acesso"
  on public.orders for select
  using (auth.uid() = client_id or auth.uid() = provider_id);

create policy "cliente e prestador atualizam o andamento"
  on public.orders for update
  using (auth.uid() = client_id or auth.uid() = provider_id);

create table public.order_status_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  status text not null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.order_status_events enable row level security;

create policy "eventos seguem a visibilidade do pedido"
  on public.order_status_events for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and (o.client_id = auth.uid() or o.provider_id = auth.uid())
    )
  );

create policy "cliente/prestador registram eventos do próprio pedido"
  on public.order_status_events for insert
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_id and (o.client_id = auth.uid() or o.provider_id = auth.uid())
    )
  );

create table public.order_photos (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  kind text not null check (kind in ('antes', 'depois')),
  photo_url text not null,
  created_at timestamptz not null default now()
);

alter table public.order_photos enable row level security;

create policy "fotos do pedido seguem a visibilidade do pedido"
  on public.order_photos for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and (o.client_id = auth.uid() or o.provider_id = auth.uid())
    )
  );

create policy "prestador anexa fotos do serviço"
  on public.order_photos for insert
  with check (
    exists (select 1 from public.orders o where o.id = order_id and o.provider_id = auth.uid())
  );

-- ============================================================
-- MENSAGENS
-- ============================================================

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.conversations enable row level security;

create policy "conversa segue a visibilidade do pedido"
  on public.conversations for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and (o.client_id = auth.uid() or o.provider_id = auth.uid())
    )
  );

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id),
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

alter table public.messages enable row level security;

create policy "participantes leem as mensagens"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations c
      join public.orders o on o.id = c.order_id
      where c.id = conversation_id and (o.client_id = auth.uid() or o.provider_id = auth.uid())
    )
  );

create policy "participantes enviam mensagens"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      join public.orders o on o.id = c.order_id
      where c.id = conversation_id and (o.client_id = auth.uid() or o.provider_id = auth.uid())
    )
  );

-- ============================================================
-- AVALIAÇÕES
-- ============================================================

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  client_id uuid not null references public.profiles (id),
  provider_id uuid not null references public.provider_profiles (profile_id),
  stars integer not null check (stars between 1 and 5),
  pontual boolean,
  resolveria_novamente boolean,
  recomenda boolean,
  comment text,
  created_at timestamptz not null default now()
);

alter table public.ratings enable row level security;

create policy "avaliações são públicas para leitura"
  on public.ratings for select
  using (true);

create policy "cliente avalia o próprio pedido concluído"
  on public.ratings for insert
  with check (
    client_id = auth.uid()
    and exists (
      select 1 from public.orders o
      where o.id = order_id and o.client_id = auth.uid() and o.status = 'concluido'
    )
  );

-- ============================================================
-- CARTEIRA DO PRESTADOR
-- ============================================================

create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles (profile_id) on delete cascade,
  order_id uuid references public.orders (id),
  type text not null check (type in ('credito_pendente', 'credito_liberado', 'saque')),
  amount numeric(10, 2) not null,
  status text not null default 'pendente' check (status in ('pendente', 'disponivel', 'pago')),
  available_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.wallet_transactions enable row level security;

create policy "prestador vê a própria carteira"
  on public.wallet_transactions for select
  using (auth.uid() = provider_id);

-- Nota: inserts/updates de wallet_transactions e o cálculo de taxa/liberação
-- devem rodar via função/trigger de servidor (service_role), não direto do
-- cliente — evita o prestador manipular o próprio saldo.
