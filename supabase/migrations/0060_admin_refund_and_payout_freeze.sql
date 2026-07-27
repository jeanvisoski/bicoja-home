-- Reembolso direto pelo admin, sem precisar que o cliente abra uma disputa
-- primeiro. Reaproveita a mesma trilha do reembolso de disputa: marca
-- refund_status = 'pendente' e a Edge Function mercadopago-refund (chamada
-- pelo admin depois) processa o estorno de verdade no Mercado Pago.
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

  -- Se o saldo do prestador pra este pedido ja saiu da garantia (liberado,
  -- reservado pra saque ou ja pago), reembolso automatico deixaria a conta
  -- inconsistente -- exige reconciliacao manual em vez de mexer sozinho.
  select * into v_wallet from public.wallet_transactions
    where order_id = p_order_id order by created_at desc limit 1 for update;
  if found and v_wallet.status not in ('pendente', 'em_garantia', 'congelado') then
    raise exception 'O saldo deste pedido ja foi liberado ou sacado pelo prestador -- fale com o financeiro antes de reembolsar.';
  end if;

  if found then
    if v_full then
      update public.wallet_transactions set status = 'reembolsado' where id = v_wallet.id;
    else
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

grant execute on function public.admin_refund_order(uuid, numeric, text) to authenticated;

-- Congela o saldo de UM prestador (nao consegue solicitar saque) sem
-- suspender a conta -- ele continua recebendo e executando pedidos
-- normalmente, so fica impedido de sacar ate ser liberado.
alter table public.provider_profiles add column if not exists payouts_frozen boolean not null default false;

create or replace function public.admin_set_payouts_frozen(
  p_provider_id uuid,
  p_frozen boolean,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'Operacao administrativa.'; end if;
  update public.provider_profiles set payouts_frozen = p_frozen where profile_id = p_provider_id;
  perform public.record_operational_audit(
    'provider',
    p_provider_id,
    case when p_frozen then 'payouts_frozen' else 'payouts_unfrozen' end,
    jsonb_build_object('note', p_note)
  );
end;
$$;

grant execute on function public.admin_set_payouts_frozen(uuid, boolean, text) to authenticated;

create or replace function public.request_provider_payout()
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_destination public.provider_payout_destinations%rowtype;
  v_amount numeric;
  v_request_id uuid;
  v_frozen boolean;
begin
  perform public.release_due_guarantee_wallet_transactions();
  if not exists (select 1 from public.provider_profiles where profile_id = auth.uid() and verification_status = 'verificado' and is_suspended = false) then
    raise exception 'Conclua a verificacao da conta para solicitar saque.';
  end if;
  select payouts_frozen into v_frozen from public.provider_profiles where profile_id = auth.uid();
  if coalesce(v_frozen, false) then
    raise exception 'Seus saques estao temporariamente bloqueados pela equipe BICOJA. Entre em contato com o suporte.';
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
