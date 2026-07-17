-- Taxa padrão da plataforma e exceções por prestador, administradas somente
-- pelo portal administrativo. A taxa é aplicada ao criar o pedido.
create table if not exists public.platform_settings (
  id boolean primary key default true check (id),
  default_service_fee_pct numeric(5, 2) not null default 4.70
    check (default_service_fee_pct >= 0 and default_service_fee_pct <= 100),
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (id, default_service_fee_pct)
values (true, 4.70)
on conflict (id) do nothing;

create table if not exists public.provider_fee_overrides (
  provider_id uuid primary key references public.provider_profiles(profile_id) on delete cascade,
  service_fee_pct numeric(5, 2) not null check (service_fee_pct >= 0 and service_fee_pct <= 100),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

alter table public.platform_settings enable row level security;
alter table public.provider_fee_overrides enable row level security;

create policy "usuários autenticados veem taxa padrão"
  on public.platform_settings for select to authenticated using (true);
create policy "admins gerenciam taxa padrão"
  on public.platform_settings for update
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy "usuários autenticados veem taxas de prestador"
  on public.provider_fee_overrides for select to authenticated using (true);
create policy "admins gerenciam taxas por prestador"
  on public.provider_fee_overrides for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
