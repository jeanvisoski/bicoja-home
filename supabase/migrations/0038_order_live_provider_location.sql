-- Localização temporária do prestador durante o deslocamento.
-- Nunca é pública: somente o prestador e o cliente do pedido podem consultá-la.

create table public.order_provider_locations (
  order_id uuid primary key references public.orders(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  accuracy_meters numeric(10, 2),
  updated_at timestamptz not null default now()
);

create index order_provider_locations_updated_at_idx
  on public.order_provider_locations (updated_at desc);

alter table public.order_provider_locations enable row level security;

create policy "partes do pedido veem localização em tempo real"
  on public.order_provider_locations for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and auth.uid() in (o.client_id, o.provider_id)
    )
  );

create policy "prestador registra sua localização do pedido"
  on public.order_provider_locations for insert
  with check (
    auth.uid() = provider_id
    and exists (
      select 1 from public.orders o
      where o.id = order_id
        and o.provider_id = auth.uid()
        and o.status in ('aceito', 'a_caminho')
    )
  );

create policy "prestador atualiza sua localização do pedido"
  on public.order_provider_locations for update
  using (
    auth.uid() = provider_id
    and exists (
      select 1 from public.orders o
      where o.id = order_id
        and o.provider_id = auth.uid()
        and o.status = 'a_caminho'
    )
  )
  with check (auth.uid() = provider_id);

create policy "prestador remove localização ao encerrar deslocamento"
  on public.order_provider_locations for delete
  using (auth.uid() = provider_id);

-- Atualiza o timestamp de cada posição recebida.
create or replace function public.touch_order_provider_location()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger order_provider_locations_touch_updated_at
before update on public.order_provider_locations
for each row execute function public.touch_order_provider_location();
