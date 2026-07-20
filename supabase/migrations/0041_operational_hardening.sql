-- Controles de operacao para a fase de testes assistidos.
create table if not exists public.operational_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.operational_audit_events enable row level security;
create policy "admin le auditoria operacional" on public.operational_audit_events for select using (public.is_admin(auth.uid()));

create or replace function public.record_operational_audit(p_entity_type text, p_entity_id uuid, p_action text, p_details jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Operacao administrativa.'; end if;
  insert into public.operational_audit_events(actor_id, entity_type, entity_id, action, details)
  values (auth.uid(), p_entity_type, p_entity_id, p_action, coalesce(p_details, '{}'::jsonb)) returning id into v_id;
  return v_id;
end; $$;
grant execute on function public.record_operational_audit(text, uuid, text, jsonb) to authenticated;

-- Confirma automaticamente pedidos com fotos finais quando o cliente nao se
-- manifesta no prazo configurado. O trigger de carteira cria a garantia.
create or replace function public.complete_due_orders()
returns integer language plpgsql security definer set search_path = public as $$
declare v_hours integer; v_count integer;
begin
  select auto_completion_hours into v_hours from public.platform_settings where id = true;
  with due as (
    select o.id from public.orders o
    join lateral (
      select created_at from public.order_status_events e
      where e.order_id = o.id and e.status in ('fotos_enviadas', 'aguardando_confirmacao')
      order by created_at desc limit 1
    ) last_event on true
    where o.status in ('fotos_enviadas', 'aguardando_confirmacao')
      and last_event.created_at <= now() - make_interval(hours => coalesce(v_hours, 48))
      and exists (select 1 from public.order_photos p where p.order_id = o.id and p.kind = 'depois')
    for update of o
  ), changed as (
    update public.orders set status = 'concluido', completed_at = now(), final_amount_approved_at = now()
    where id in (select id from due) returning id
  )
  insert into public.order_status_events(order_id, status, note)
  select id, 'concluido', 'Conclusao automatica apos prazo de revisao do cliente' from changed;
  get diagnostics v_count = row_count;
  return v_count;
end; $$;
grant execute on function public.complete_due_orders() to authenticated;

-- Saque exige identidade verificada e conta profissional ativa.
create or replace function public.request_provider_payout()
returns uuid language plpgsql security definer set search_path = public as $$
declare v_destination public.provider_payout_destinations%rowtype; v_amount numeric; v_request_id uuid;
begin
  perform public.release_due_guarantee_wallet_transactions();
  if not exists (select 1 from public.provider_profiles where profile_id = auth.uid() and verification_status = 'verificado' and is_suspended = false) then
    raise exception 'Conclua a verificacao da conta para solicitar saque.';
  end if;
  select * into v_destination from public.provider_payout_destinations where provider_id = auth.uid() for update;
  if not found or v_destination.status <> 'verificado' then raise exception 'Cadastre uma chave Pix validada pela equipe antes de solicitar saque.'; end if;
  if exists (select 1 from public.payout_requests where provider_id = auth.uid() and status in ('solicitado', 'aprovado')) then raise exception 'Ja existe uma solicitacao de saque em analise.'; end if;
  perform 1 from public.wallet_transactions where provider_id = auth.uid() and status = 'disponivel' for update;
  select coalesce(sum(amount), 0) into v_amount from public.wallet_transactions where provider_id = auth.uid() and status = 'disponivel';
  if v_amount <= 0 then raise exception 'Nao ha saldo disponivel para saque.'; end if;
  update public.wallet_transactions set status = 'reservado' where provider_id = auth.uid() and status = 'disponivel';
  insert into public.payout_requests(provider_id, amount, destination_snapshot)
  values (auth.uid(), v_amount, jsonb_build_object('method', v_destination.method, 'pix_key', v_destination.pix_key, 'pix_key_type', v_destination.pix_key_type, 'holder_name', v_destination.holder_name)) returning id into v_request_id;
  return v_request_id;
end; $$;

notify pgrst, 'reload schema';
