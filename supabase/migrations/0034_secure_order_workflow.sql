-- Fluxo financeiro e operacional: toda alteracao sensivel de pedido passa por
-- RPCs atomicas. O navegador nao pode escolher valores, prestador ou etapas.

drop policy if exists "cliente cria checkout pendente proprio" on public.orders;
drop policy if exists "pedido pago exige evidÃªncia e valor combinado" on public.orders;

create or replace function public.create_checkout_order(p_proposal_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal public.proposals%rowtype;
  v_request public.service_requests%rowtype;
  v_fee_pct numeric;
  v_price numeric;
  v_fee numeric;
  v_order_id uuid;
begin
  select * into v_proposal from public.proposals where id = p_proposal_id;
  if not found or v_proposal.status <> 'pendente' then raise exception 'Proposta indisponivel.'; end if;
  select * into v_request from public.service_requests where id = v_proposal.request_id for update;
  if not found or v_request.client_id <> auth.uid() or v_request.status <> 'aberto' then
    raise exception 'Solicitacao indisponivel para contratacao.';
  end if;

  select coalesce(override.service_fee_pct, settings.default_service_fee_pct)
    into v_fee_pct
  from public.platform_settings settings
  left join public.provider_fee_overrides override on override.provider_id = v_proposal.provider_id
  where settings.id = true;
  v_fee_pct := coalesce(v_fee_pct, 4.70);

  -- Em faixa, reserva-se o teto aprovado. A diferenca, se houver, fica
  -- registrada como reembolso devido ao concluir o servico.
  v_price := case when v_proposal.pricing_type = 'range' then v_proposal.price_max else v_proposal.price end;
  v_fee := round(v_price * v_fee_pct / 100, 2);

  select id into v_order_id from public.orders
    where proposal_id = v_proposal.id and client_id = auth.uid()
      and status = 'aguardando_pagamento' and payment_status = 'pendente';
  if v_order_id is not null then return v_order_id; end if;

  insert into public.orders (
    request_id, proposal_id, client_id, provider_id, price, platform_fee, total,
    pricing_type, quoted_price_min, quoted_price_max, duration_minutes, final_price,
    status, payment_status
  ) values (
    v_request.id, v_proposal.id, auth.uid(), v_proposal.provider_id, v_price, v_fee, v_price + v_fee,
    v_proposal.pricing_type, v_proposal.price_min, v_proposal.price_max, v_proposal.duration_minutes, v_price,
    'aguardando_pagamento', 'pendente'
  ) returning id into v_order_id;
  return v_order_id;
end;
$$;

grant execute on function public.create_checkout_order(uuid) to authenticated;

alter table public.orders
  add column if not exists refund_due numeric(10, 2) not null default 0 check (refund_due >= 0),
  add column if not exists refund_status text not null default 'nao_aplicavel'
    check (refund_status in ('nao_aplicavel', 'pendente', 'processado')),
  add column if not exists cancellation_reason text;

create or replace function public.transition_order(
  p_order_id uuid,
  p_next_status text,
  p_final_price numeric default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_is_provider boolean;
  v_is_client boolean;
  v_refund numeric := 0;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Pedido nao encontrado.'; end if;
  v_is_provider := v_order.provider_id = auth.uid();
  v_is_client := v_order.client_id = auth.uid();
  if not v_is_provider and not v_is_client then raise exception 'Sem permissao para este pedido.'; end if;

  if p_next_status = 'a_caminho' and v_is_provider and v_order.status = 'aceito' and v_order.payment_status = 'confirmado' then
    null;
  elsif p_next_status = 'executando' and v_is_provider and v_order.status = 'a_caminho' then
    null;
  elsif p_next_status = 'fotos_enviadas' and v_is_provider and v_order.status = 'executando' then
    if p_final_price is null or p_final_price < v_order.quoted_price_min or p_final_price > v_order.quoted_price_max then
      raise exception 'Valor final fora da faixa aprovada.';
    end if;
    if not exists (select 1 from public.order_photos where order_id = v_order.id and kind = 'depois') then
      raise exception 'Envie ao menos uma foto final antes de concluir.';
    end if;
    v_refund := greatest(v_order.price - p_final_price, 0);
  elsif p_next_status = 'concluido' and v_is_client and v_order.status in ('fotos_enviadas', 'aguardando_confirmacao') then
    if not exists (select 1 from public.order_photos where order_id = v_order.id and kind = 'depois') then
      raise exception 'Nao ha fotos finais para confirmar.';
    end if;
  elsif p_next_status = 'em_disputa' and v_is_client and v_order.status in ('aceito', 'a_caminho', 'executando', 'fotos_enviadas', 'aguardando_confirmacao') then
    if coalesce(length(trim(p_note)), 0) < 10 then raise exception 'Descreva o problema com pelo menos 10 caracteres.'; end if;
    insert into public.trust_reports (order_id, reporter_id, reported_user_id, category, description, source)
    values (v_order.id, auth.uid(), v_order.provider_id, 'conduta', trim(p_note), 'manual');
  elsif p_next_status = 'cancelado' and v_is_client and v_order.status = 'aguardando_pagamento' then
    null;
  else
    raise exception 'Transicao de status nao permitida.';
  end if;

  update public.orders set
    status = p_next_status,
    final_price = coalesce(p_final_price, final_price),
    refund_due = case when p_next_status = 'fotos_enviadas' then v_refund else refund_due end,
    refund_status = case when p_next_status = 'fotos_enviadas' and v_refund > 0 then 'pendente' else refund_status end,
    completed_at = case when p_next_status = 'concluido' then now() else completed_at end,
    final_amount_approved_at = case when p_next_status = 'concluido' then now() else final_amount_approved_at end,
    cancellation_reason = case when p_next_status = 'cancelado' then p_note else cancellation_reason end
  where id = v_order.id;

  insert into public.order_status_events (order_id, status, note)
  values (v_order.id, p_next_status, nullif(trim(coalesce(p_note, '')), ''));
  return v_order.id;
end;
$$;

grant execute on function public.transition_order(uuid, text, numeric, text) to authenticated;

-- Evita que a solicitacao mude depois de profissionais terem calculado propostas.
create or replace function public.lock_request_after_proposal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.proposals where request_id = old.id) and (
    new.category_id is distinct from old.category_id or new.description is distinct from old.description
    or new.address_id is distinct from old.address_id or new.urgency is distinct from old.urgency
    or new.availability_start is distinct from old.availability_start or new.availability_end is distinct from old.availability_end
  ) then
    raise exception 'A solicitacao nao pode ser alterada apos receber propostas.';
  end if;
  return new;
end;
$$;
drop trigger if exists on_lock_request_after_proposal on public.service_requests;
create trigger on_lock_request_after_proposal before update on public.service_requests
  for each row execute function public.lock_request_after_proposal();

create or replace function public.lock_request_address_after_proposal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.service_requests request
    where request.address_id = old.id
      and exists (select 1 from public.proposals where request_id = request.id)
  ) then
    raise exception 'O endereco do servico nao pode ser alterado apos receber propostas.';
  end if;
  return new;
end;
$$;
drop trigger if exists on_lock_request_address_after_proposal on public.addresses;
create trigger on_lock_request_address_after_proposal before update on public.addresses
  for each row execute function public.lock_request_address_after_proposal();

-- O saldo do prestador reflete o valor efetivamente concluido, e nao o teto
-- reservado em orcamentos por faixa.
create or replace function public.handle_order_wallet_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'fotos_enviadas' and old.status is distinct from 'fotos_enviadas' then
    insert into public.wallet_transactions (provider_id, order_id, type, amount, status)
    select new.provider_id, new.id, 'credito_pendente', new.final_price, 'pendente'
    where not exists (select 1 from public.wallet_transactions where order_id = new.id);
  elsif new.status = 'concluido' and old.status is distinct from 'concluido' then
    update public.wallet_transactions
      set type = 'credito_liberado', amount = new.final_price, status = 'disponivel', available_at = now()
      where order_id = new.id and status = 'pendente';
    insert into public.wallet_transactions (provider_id, order_id, type, amount, status, available_at)
      select new.provider_id, new.id, 'credito_liberado', new.final_price, 'disponivel', now()
      where not exists (select 1 from public.wallet_transactions where order_id = new.id);
    update public.provider_profiles set jobs_count = jobs_count + 1 where profile_id = new.provider_id;
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
