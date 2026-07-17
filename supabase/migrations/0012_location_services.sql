-- Número da casa, localização/raio do prestador, solicitação direta a um
-- prestador específico, e catálogo de serviços oferecidos pelo prestador.

alter table public.addresses add column number text;

alter table public.provider_profiles
  add column lat double precision,
  add column lng double precision,
  add column service_radius_km integer not null default 30;

alter table public.service_requests
  add column preferred_provider_id uuid references public.provider_profiles (profile_id);

-- ============================================================
-- SERVIÇOS OFERECIDOS PELO PRESTADOR (catálogo próprio)
-- ============================================================

create table public.provider_services (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles (profile_id) on delete cascade,
  category_id uuid not null references public.service_categories (id),
  price_from numeric(10, 2),
  note text,
  created_at timestamptz not null default now(),
  unique (provider_id, category_id)
);

alter table public.provider_services enable row level security;

create policy "serviços de prestador são públicos"
  on public.provider_services for select
  using (true);

create policy "prestador gerencia os próprios serviços"
  on public.provider_services for all
  using (auth.uid() = provider_id)
  with check (auth.uid() = provider_id);
