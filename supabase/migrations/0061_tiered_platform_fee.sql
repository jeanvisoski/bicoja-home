-- Taxa degressiva por faixas (estilo "imposto progressivo"): cada faixa só
-- se aplica à parte do valor do orçamento dentro dela, não ao valor todo.
-- Evita o paradoxo de um orçamento levemente maior pagar uma taxa menor por
-- cair "para baixo" numa faixa mais barata.
create table if not exists public.fee_tiers (
  id uuid primary key default gen_random_uuid(),
  min_amount numeric(10, 2) not null,
  max_amount numeric(10, 2),
  fee_pct numeric(5, 2) not null check (fee_pct >= 0 and fee_pct <= 100),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  constraint fee_tiers_range_check check (max_amount is null or max_amount > min_amount)
);

alter table public.fee_tiers enable row level security;

create policy "usuários autenticados veem faixas de taxa"
  on public.fee_tiers for select to authenticated using (true);
create policy "admins gerenciam faixas de taxa"
  on public.fee_tiers for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Faixas padrão iniciais -- ajustáveis pelo admin em Configurações.
-- Referência: um orçamento de R$ 2.900 passa de R$ 296 (8% linear) para
-- R$ 200 (~6,9% efetivo) com esta tabela.
insert into public.fee_tiers (min_amount, max_amount, fee_pct)
values
  (0, 300, 10),
  (300, 1000, 8),
  (1000, 3000, 6),
  (3000, null, 4)
on conflict do nothing;

create or replace function public.calculate_tiered_fee(p_amount numeric)
returns numeric
language plpgsql
stable
set search_path = public
as $$
declare
  v_tier record;
  v_fee numeric := 0;
  v_portion numeric;
  v_has_tiers boolean := false;
begin
  if p_amount is null or p_amount <= 0 then
    return 0;
  end if;

  for v_tier in select min_amount, max_amount, fee_pct from public.fee_tiers order by min_amount loop
    v_has_tiers := true;
    exit when p_amount <= v_tier.min_amount;
    v_portion := least(p_amount, coalesce(v_tier.max_amount, p_amount)) - v_tier.min_amount;
    if v_portion > 0 then
      v_fee := v_fee + round(v_portion * v_tier.fee_pct / 100, 2);
    end if;
  end loop;

  if not v_has_tiers then
    return null;
  end if;
  return v_fee;
end;
$$;

-- Recria create_checkout_order (0053) só trocando o cálculo da taxa: taxa
-- personalizada por prestador (provider_fee_overrides) continua um
-- percentual fixo -- é uma decisão manual do admin pra aquele prestador
-- específico. Sem override, usa as faixas degressivas; só cai pro
-- percentual linear das configurações se a tabela de faixas estiver vazia.
create or replace function public.create_checkout_order(p_proposal_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal public.proposals%rowtype;
  v_request public.service_requests%rowtype;
  v_override_pct numeric;
  v_settings_pct numeric;
  v_fee_min numeric;
  v_price numeric;
  v_fee numeric;
  v_order_id uuid;
begin
  select * into v_proposal from public.proposals where id = p_proposal_id;
  if not found or v_proposal.status <> 'pendente' then
    raise exception 'Proposta indisponível.';
  end if;

  select * into v_request from public.service_requests where id = v_proposal.request_id for update;
  if not found or v_request.client_id <> auth.uid() or v_request.status <> 'aberto' then
    raise exception 'Solicitação indisponível para contratação.';
  end if;

  select overrides.service_fee_pct into v_override_pct
    from public.provider_fee_overrides overrides
    where overrides.provider_id = v_proposal.provider_id;

  select coalesce(customer_protection_fee_pct, default_service_fee_pct), customer_protection_fee_min
    into v_settings_pct, v_fee_min
    from public.platform_settings where id = true;
  v_settings_pct := coalesce(v_settings_pct, 8);
  v_fee_min := coalesce(v_fee_min, 0);

  v_price := case when v_proposal.pricing_type = 'range' then v_proposal.price_max else v_proposal.price end;

  if v_override_pct is not null then
    v_fee := round(v_price * v_override_pct / 100, 2);
  else
    v_fee := coalesce(public.calculate_tiered_fee(v_price), round(v_price * v_settings_pct / 100, 2));
  end if;
  v_fee := greatest(v_fee, v_fee_min);

  select id into v_order_id
    from public.orders
    where proposal_id = v_proposal.id
      and client_id = auth.uid()
      and status = 'aguardando_pagamento'
      and payment_status = 'pendente';
  if v_order_id is not null then
    return v_order_id;
  end if;

  insert into public.orders (
    request_id, proposal_id, client_id, provider_id, price, platform_fee, customer_protection_fee, total,
    pricing_type, quoted_price_min, quoted_price_max, duration_minutes, final_price,
    scheduled_date, scheduled_start_time, scheduled_end_time, status, payment_status
  )
  values (
    v_request.id, v_proposal.id, auth.uid(), v_proposal.provider_id, v_price, v_fee, v_fee, v_price + v_fee,
    v_proposal.pricing_type, v_proposal.price_min, v_proposal.price_max, v_proposal.duration_minutes, v_price,
    v_proposal.scheduled_date, v_proposal.scheduled_start_time, v_proposal.scheduled_end_time,
    'aguardando_pagamento', 'pendente'
  )
  returning id into v_order_id;

  return v_order_id;
end;
$$;

notify pgrst, 'reload schema';
