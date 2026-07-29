-- Acréscimo de valor durante a execução. Hoje o valor final de um pedido é
-- travado dentro da faixa que o cliente aceitou (ver transition_order em
-- 0034/0040) -- se o serviço custar mais do que o combinado (ex.: precisou
-- de mais material), não existe caminho legítimo pra cobrar a diferença
-- dentro do app, o que empurra pro combinado por fora. Esta migration cria
-- uma válvula: o prestador solicita um acréscimo com motivo, o cliente
-- aprova ou recusa, e se aprovar paga pelo mesmo checkout Mercado Pago --
-- com a mesma taxa BICOJÁ aplicada, pra não virar um jeito de driblar a taxa
-- combinando "por fora" um valor inicial baixo mais um acréscimo depois.
create table public.order_extra_charges (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider_id uuid not null references public.provider_profiles(profile_id),
  client_id uuid not null references public.profiles(id),
  amount numeric(10, 2) not null check (amount > 0),
  platform_fee numeric(10, 2) not null default 0 check (platform_fee >= 0),
  total numeric(10, 2) not null check (total > 0),
  reason text not null,
  status text not null default 'solicitado'
    check (status in ('solicitado', 'aprovado', 'recusado', 'pago', 'cancelado')),
  client_note text,
  payment_mode text,
  payment_method text,
  gateway_preference_id text,
  gateway_payment_id text,
  checkout_url text,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  paid_at timestamptz
);

alter table public.order_extra_charges enable row level security;

create policy "cliente ou prestador veem os proprios acrescimos"
  on public.order_extra_charges for select to authenticated
  using (provider_id = auth.uid() or client_id = auth.uid() or public.is_admin(auth.uid()));

create or replace function public.request_order_extra_charge(
  p_order_id uuid,
  p_amount numeric,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_override_pct numeric;
  v_settings_pct numeric;
  v_fee numeric;
  v_charge_id uuid;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.provider_id <> auth.uid() then
    raise exception 'Pedido nao encontrado.';
  end if;
  if v_order.status not in ('a_caminho', 'executando') then
    raise exception 'So e possivel solicitar acrescimo com o servico em andamento.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Informe um valor valido para o acrescimo.';
  end if;
  if coalesce(length(trim(p_reason)), 0) < 10 then
    raise exception 'Explique o motivo do acrescimo com pelo menos 10 caracteres.';
  end if;
  if exists (
    select 1 from public.order_extra_charges
    where order_id = p_order_id and status in ('solicitado', 'aprovado')
  ) then
    raise exception 'Ja existe um acrescimo em aberto para este pedido.';
  end if;

  select overrides.service_fee_pct into v_override_pct
    from public.provider_fee_overrides overrides
    where overrides.provider_id = v_order.provider_id;
  select coalesce(customer_protection_fee_pct, default_service_fee_pct)
    into v_settings_pct from public.platform_settings where id = true;
  v_settings_pct := coalesce(v_settings_pct, 8);

  if v_override_pct is not null then
    v_fee := round(p_amount * v_override_pct / 100, 2);
  else
    v_fee := coalesce(public.calculate_tiered_fee(p_amount), round(p_amount * v_settings_pct / 100, 2));
  end if;

  insert into public.order_extra_charges (order_id, provider_id, client_id, amount, platform_fee, total, reason)
  values (p_order_id, v_order.provider_id, v_order.client_id, p_amount, v_fee, p_amount + v_fee, trim(p_reason))
  returning id into v_charge_id;

  perform public.notify(
    v_order.client_id,
    'acrescimo_solicitado',
    'O prestador pediu um acréscimo no valor',
    'R$ ' || to_char(p_amount, 'FM999999990.00') || ' a mais — motivo: ' || trim(p_reason),
    '/extra-charge?chargeId=' || v_charge_id
  );

  return v_charge_id;
end;
$$;
grant execute on function public.request_order_extra_charge(uuid, numeric, text) to authenticated;

create or replace function public.respond_order_extra_charge(
  p_charge_id uuid,
  p_approve boolean,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_charge public.order_extra_charges%rowtype;
begin
  select * into v_charge from public.order_extra_charges where id = p_charge_id for update;
  if not found or v_charge.client_id <> auth.uid() then
    raise exception 'Acrescimo nao encontrado.';
  end if;
  if v_charge.status <> 'solicitado' then
    raise exception 'Este acrescimo ja foi respondido.';
  end if;

  update public.order_extra_charges
    set status = case when p_approve then 'aprovado' else 'recusado' end,
        client_note = p_note,
        decided_at = now()
    where id = p_charge_id;

  perform public.notify(
    v_charge.provider_id,
    case when p_approve then 'acrescimo_aprovado' else 'acrescimo_recusado' end,
    case when p_approve then 'Cliente aprovou o acréscimo' else 'Cliente recusou o acréscimo' end,
    case when p_approve then 'O cliente vai pagar o valor extra pelo app.' else coalesce(p_note, 'Sem motivo informado.') end,
    '/pro/orders?orderId=' || v_charge.order_id
  );

  return p_charge_id;
end;
$$;
grant execute on function public.respond_order_extra_charge(uuid, boolean, text) to authenticated;

-- Espelha confirm_gateway_payment (0042/0049): só o gateway (service role,
-- via webhook) confirma o pagamento de verdade.
create or replace function public.confirm_extra_charge_gateway_payment(
  p_charge_id uuid,
  p_gateway_payment_id text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_charge public.order_extra_charges%rowtype;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Operacao restrita ao gateway.';
  end if;
  select * into v_charge from public.order_extra_charges where id = p_charge_id for update;
  if not found then raise exception 'Acrescimo nao encontrado.'; end if;
  if v_charge.status = 'pago' then return v_charge.id; end if;
  if v_charge.status <> 'aprovado' then
    raise exception 'Este acrescimo nao esta aprovado para pagamento.';
  end if;

  update public.order_extra_charges
    set status = 'pago', paid_at = now(), gateway_payment_id = p_gateway_payment_id
    where id = p_charge_id;

  perform public.notify(
    v_charge.provider_id,
    'acrescimo_pago',
    'Acréscimo pago pelo cliente',
    'R$ ' || to_char(v_charge.amount, 'FM999999990.00') || ' entram na garantia junto com o restante do pedido.',
    '/pro/orders?orderId=' || v_charge.order_id
  );

  return v_charge.id;
end;
$$;
revoke all on function public.confirm_extra_charge_gateway_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.confirm_extra_charge_gateway_payment(uuid, text) to service_role;

-- Homologação: mesmo espírito do confirm_order_payment (0042) -- só funciona
-- fora de sandbox/produção, e só o próprio cliente confirma.
create or replace function public.simulate_extra_charge_payment(p_charge_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode text;
  v_charge public.order_extra_charges%rowtype;
begin
  select payment_mode into v_mode from public.platform_settings where id = true;
  if coalesce(v_mode, 'homologacao') <> 'homologacao' then
    raise exception 'A confirmacao simulada esta desativada. Conclua o pagamento pelo gateway.';
  end if;
  select * into v_charge from public.order_extra_charges where id = p_charge_id for update;
  if not found or v_charge.client_id <> auth.uid() then raise exception 'Acrescimo nao encontrado.'; end if;
  if v_charge.status <> 'aprovado' then raise exception 'Este acrescimo nao esta aprovado para pagamento.'; end if;

  update public.order_extra_charges set status = 'pago', paid_at = now() where id = p_charge_id;
  perform public.notify(
    v_charge.provider_id, 'acrescimo_pago', 'Acréscimo pago pelo cliente (homologação)',
    'R$ ' || to_char(v_charge.amount, 'FM999999990.00') || ' confirmados em homologação.',
    '/pro/orders?orderId=' || v_charge.order_id
  );
  return v_charge.id;
end;
$$;
grant execute on function public.simulate_extra_charge_payment(uuid) to authenticated;

-- A carteira do prestador ganha uma linha por acréscimo pago, distinta da
-- linha do serviço principal (extra_charge_id null = serviço principal).
alter table public.wallet_transactions
  add column if not exists extra_charge_id uuid references public.order_extra_charges(id);

create or replace function public.handle_order_wallet_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days integer;
  v_until timestamptz;
begin
  if new.status = 'fotos_enviadas' and old.status is distinct from 'fotos_enviadas' then
    insert into public.wallet_transactions (provider_id, order_id, type, amount, status)
    select new.provider_id, new.id, 'credito_pendente', new.final_price, 'pendente'
    where not exists (
      select 1 from public.wallet_transactions where order_id = new.id and extra_charge_id is null
    );
  elsif new.status = 'concluido' and old.status is distinct from 'concluido' then
    select provider_guarantee_days into v_days from public.platform_settings where id = true;
    v_until := now() + make_interval(days => coalesce(v_days, 7));

    update public.wallet_transactions
      set type = 'credito_pendente', amount = new.final_price, status = 'em_garantia', available_at = v_until
      where order_id = new.id and extra_charge_id is null and status in ('pendente', 'congelado');
    insert into public.wallet_transactions (provider_id, order_id, type, amount, status, available_at)
      select new.provider_id, new.id, 'credito_pendente', new.final_price, 'em_garantia', v_until
      where not exists (
        select 1 from public.wallet_transactions where order_id = new.id and extra_charge_id is null
      );

    -- Acréscimos já pagos entram na mesma janela de garantia do pedido.
    insert into public.wallet_transactions (provider_id, order_id, extra_charge_id, type, amount, status, available_at)
      select new.provider_id, new.id, ec.id, 'credito_pendente', ec.amount, 'em_garantia', v_until
      from public.order_extra_charges ec
      where ec.order_id = new.id and ec.status = 'pago'
        and not exists (select 1 from public.wallet_transactions wt where wt.extra_charge_id = ec.id);

    update public.orders set guarantee_until = v_until, guarantee_status = 'em_garantia', client_confirmation_at = now() where id = new.id;
    update public.provider_profiles set jobs_count = jobs_count + 1 where profile_id = new.provider_id;
  elsif new.status = 'em_disputa' and old.status is distinct from 'em_disputa' then
    update public.wallet_transactions set status = 'congelado' where order_id = new.id and status in ('pendente', 'em_garantia');
    update public.orders set guarantee_status = 'congelada' where id = new.id;
  end if;
  return new;
end;
$$;

-- admin_refund_order (0060) assumia uma única linha de carteira por pedido.
-- Com acréscimo isso deixou de ser verdade -- reescrita pra tratar todas as
-- linhas do pedido no reembolso total, e mantém o reembolso parcial restrito
-- ao valor original do serviço (linha sem extra_charge_id); se o pedido tiver
-- acréscimo pago, ele fica intocado e precisa de reconciliação manual.
create or replace function public.admin_refund_order(
  p_order_id uuid,
  p_refund_amount numeric default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_wallet public.wallet_transactions%rowtype;
  v_amount numeric;
  v_full boolean;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Operacao administrativa.'; end if;
  if coalesce(length(trim(p_note)), 0) < 10 then
    raise exception 'Descreva o motivo do reembolso com pelo menos 10 caracteres.';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Pedido nao encontrado.'; end if;
  if v_order.payment_status <> 'confirmado' then
    raise exception 'Este pedido nao teve pagamento confirmado.';
  end if;
  if v_order.refund_status = 'processado' then
    raise exception 'Este pedido ja foi reembolsado.';
  end if;

  v_amount := coalesce(p_refund_amount, v_order.total);
  if v_amount <= 0 or v_amount > v_order.total then
    raise exception 'Valor de reembolso invalido.';
  end if;
  v_full := v_amount >= v_order.total;

  if exists (
    select 1 from public.wallet_transactions
    where order_id = p_order_id and status not in ('pendente', 'em_garantia', 'congelado')
  ) then
    raise exception 'O saldo deste pedido ja foi liberado ou sacado pelo prestador -- fale com o financeiro antes de reembolsar.';
  end if;

  if v_full then
    update public.wallet_transactions set status = 'reembolsado'
      where order_id = p_order_id and status in ('pendente', 'em_garantia', 'congelado');
  else
    select * into v_wallet from public.wallet_transactions
      where order_id = p_order_id and extra_charge_id is null
      order by created_at desc limit 1 for update;
    if found then
      update public.wallet_transactions set amount = greatest(v_wallet.amount - v_amount, 0) where id = v_wallet.id;
    end if;
  end if;

  update public.orders set
    refund_due = v_amount,
    refund_status = 'pendente',
    status = case when v_full then 'cancelado' else status end,
    cancellation_reason = case when v_full then p_note else cancellation_reason end
  where id = p_order_id;

  insert into public.order_status_events (order_id, status, note)
  values (p_order_id, case when v_full then 'cancelado' else v_order.status end, concat('[Admin - reembolso] ', p_note));

  return p_order_id;
end;
$$;

-- resolve_protection_dispute (0040): liberar/reembolso_total já cobrem todas
-- as linhas do pedido (update sem limit). Só o reembolso_parcial precisava
-- de ajuste -- fica restrito à linha do serviço principal, mesma ressalva
-- do admin_refund_order acima sobre acréscimo pago em pedido disputado.
create or replace function public.resolve_protection_dispute(p_order_id uuid, p_resolution text, p_refund_amount numeric default 0, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_order public.orders%rowtype; v_refund numeric := greatest(coalesce(p_refund_amount, 0), 0);
begin
  if not public.is_admin(auth.uid()) then raise exception 'Operacao administrativa.'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.status <> 'em_disputa' then raise exception 'Disputa nao encontrada.'; end if;
  if p_resolution not in ('liberar', 'reembolso_parcial', 'reembolso_total') then raise exception 'Resolucao invalida.'; end if;
  if p_resolution = 'liberar' then
    update public.wallet_transactions set status = 'disponivel', type = 'credito_liberado', available_at = now() where order_id = v_order.id and status = 'congelado';
    update public.orders set status = 'concluido', guarantee_status = 'liberada' where id = v_order.id;
  elsif p_resolution = 'reembolso_parcial' then
    if v_refund <= 0 or v_refund >= v_order.final_price then raise exception 'Informe um reembolso parcial valido.'; end if;
    update public.wallet_transactions set amount = v_order.final_price - v_refund, status = 'disponivel', type = 'credito_liberado', available_at = now()
      where order_id = v_order.id and extra_charge_id is null and status = 'congelado';
    update public.orders set status = 'concluido', guarantee_status = 'reembolsada', refund_due = v_refund, refund_status = 'pendente' where id = v_order.id;
  else
    update public.wallet_transactions set status = 'reembolsado' where order_id = v_order.id and status = 'congelado';
    update public.orders set status = 'cancelado', guarantee_status = 'reembolsada', refund_due = v_order.total, refund_status = 'pendente' where id = v_order.id;
  end if;
  insert into public.order_status_events(order_id, status, note) values (v_order.id, (select status from public.orders where id=v_order.id), concat('[Admin - protecao] ', coalesce(p_note, p_resolution)));
  return v_order.id;
end; $$;

notify pgrst, 'reload schema';
