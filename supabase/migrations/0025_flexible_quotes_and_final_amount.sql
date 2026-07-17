-- Orçamento pode ser fechado ou uma faixa. O total final é informado pelo
-- prestador na conclusão e precisa respeitar a faixa previamente aceita.
alter table public.proposals
  add column if not exists pricing_type text not null default 'fixed'
    check (pricing_type in ('fixed', 'range')),
  add column if not exists price_min numeric(10, 2),
  add column if not exists price_max numeric(10, 2),
  add column if not exists duration_minutes integer;

update public.proposals
set price_min = coalesce(price_min, price),
    price_max = coalesce(price_max, price)
where price_min is null or price_max is null;

alter table public.proposals
  alter column price_min set not null,
  alter column price_max set not null;

alter table public.proposals
  add constraint proposals_price_range_valid
  check (price_min >= 0 and price_max >= price_min and (pricing_type = 'range' or price_min = price_max));

alter table public.orders
  add column if not exists pricing_type text not null default 'fixed'
    check (pricing_type in ('fixed', 'range')),
  add column if not exists quoted_price_min numeric(10, 2),
  add column if not exists quoted_price_max numeric(10, 2),
  add column if not exists duration_minutes integer,
  add column if not exists final_price numeric(10, 2);

update public.orders
set quoted_price_min = coalesce(quoted_price_min, price),
    quoted_price_max = coalesce(quoted_price_max, price),
    final_price = coalesce(final_price, price)
where quoted_price_min is null or quoted_price_max is null or final_price is null;

alter table public.orders
  alter column quoted_price_min set not null,
  alter column quoted_price_max set not null,
  alter column final_price set not null;

alter table public.orders
  add constraint orders_quoted_range_valid
  check (quoted_price_min >= 0 and quoted_price_max >= quoted_price_min),
  add constraint orders_final_price_within_quote
  check (final_price >= quoted_price_min and final_price <= quoted_price_max);

-- A etapa final exige fotos e o valor final dentro do que o cliente aceitou.
drop policy if exists "etapas do pedido exigem evidência para conclusão" on public.orders;
create policy "etapas do pedido exigem evidência e valor combinado"
  on public.orders for update
  using (auth.uid() = client_id or auth.uid() = provider_id)
  with check (
    (
      provider_id = auth.uid()
      and (
        status in ('a_caminho', 'executando', 'aguardando_confirmacao')
        or (
          status = 'fotos_enviadas'
          and price = final_price
          and exists (
            select 1 from public.order_photos photo
            where photo.order_id = orders.id and photo.kind = 'depois'
          )
        )
      )
    )
    or (
      client_id = auth.uid()
      and (
        status in ('aceito', 'em_disputa', 'cancelado')
        or (
          status = 'concluido'
          and exists (
            select 1 from public.order_photos photo
            where photo.order_id = orders.id and photo.kind = 'depois'
          )
        )
      )
    )
  );
