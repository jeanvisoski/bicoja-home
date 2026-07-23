-- Ate agora so o cliente informava uma janela de disponibilidade
-- (service_requests.availability_start/end + availability_start_time/end_time),
-- mas o prestador nao tinha como reservar/confirmar uma data e horario reais
-- ao enviar o orcamento -- nem "proposals" nem "orders" tinham coluna de
-- agendamento. Isso adiciona as colunas e propaga o agendamento da proposta
-- vencedora para o pedido, exatamente como ja acontece com preco/duracao.
alter table public.proposals
  add column if not exists scheduled_date date,
  add column if not exists scheduled_start_time time,
  add column if not exists scheduled_end_time time;

alter table public.orders
  add column if not exists scheduled_date date,
  add column if not exists scheduled_start_time time,
  add column if not exists scheduled_end_time time;

create or replace function public.create_checkout_order(p_proposal_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_proposal public.proposals%rowtype; v_request public.service_requests%rowtype;
  v_fee_pct numeric; v_fee_min numeric; v_price numeric; v_fee numeric; v_order_id uuid;
begin
  select * into v_proposal from public.proposals where id = p_proposal_id;
  if not found or v_proposal.status <> 'pendente' then raise exception 'Proposta indisponivel.'; end if;
  select * into v_request from public.service_requests where id = v_proposal.request_id for update;
  if not found or v_request.client_id <> auth.uid() or v_request.status <> 'aberto' then raise exception 'Solicitacao indisponivel para contratacao.'; end if;
  select coalesce(overrides.service_fee_pct, settings.customer_protection_fee_pct, settings.default_service_fee_pct), settings.customer_protection_fee_min
    into v_fee_pct, v_fee_min from public.platform_settings settings
    left join public.provider_fee_overrides overrides on overrides.provider_id = v_proposal.provider_id where settings.id = true;
  v_fee_pct := coalesce(v_fee_pct, 8); v_fee_min := coalesce(v_fee_min, 0);
  v_price := case when v_proposal.pricing_type = 'range' then v_proposal.price_max else v_proposal.price end;
  v_fee := greatest(round(v_price * v_fee_pct / 100, 2), v_fee_min);
  select id into v_order_id from public.orders where proposal_id = v_proposal.id and client_id = auth.uid() and status = 'aguardando_pagamento' and payment_status = 'pendente';
  if v_order_id is not null then return v_order_id; end if;
  insert into public.orders (request_id, proposal_id, client_id, provider_id, price, platform_fee, customer_protection_fee, total, pricing_type, quoted_price_min, quoted_price_max, duration_minutes, final_price, scheduled_date, scheduled_start_time, scheduled_end_time, status, payment_status)
  values (v_request.id, v_proposal.id, auth.uid(), v_proposal.provider_id, v_price, v_fee, v_fee, v_price + v_fee, v_proposal.pricing_type, v_proposal.price_min, v_proposal.price_max, v_proposal.duration_minutes, v_price, v_proposal.scheduled_date, v_proposal.scheduled_start_time, v_proposal.scheduled_end_time, 'aguardando_pagamento', 'pendente') returning id into v_order_id;
  return v_order_id;
end; $$;

notify pgrst, 'reload schema';
