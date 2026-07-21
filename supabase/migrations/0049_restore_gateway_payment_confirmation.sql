-- Recupera a confirmação do pedido após a aprovação no gateway. Em alguns
-- ambientes a migração original do checkout foi aplicada parcialmente: o
-- webhook registra a transação, mas não encontra esta RPC para confirmar o
-- pedido e selecionar a proposta vencedora.
create or replace function public.confirm_gateway_payment(
  p_order_id uuid,
  p_gateway_payment_id text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Operacao restrita ao gateway.';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Pedido nao encontrado.'; end if;
  if v_order.status = 'aceito' and v_order.payment_status = 'confirmado' then
    return v_order.id;
  end if;
  if v_order.status <> 'aguardando_pagamento' or v_order.payment_status <> 'pendente' then
    raise exception 'Este checkout ja foi processado ou nao esta mais disponivel.';
  end if;

  perform 1 from public.service_requests
    where id = v_order.request_id and status = 'aberto'
    for update;
  if not found then
    raise exception 'Esta solicitacao ja foi contratada por outro prestador.';
  end if;

  update public.orders
    set status = 'aceito', payment_status = 'confirmado'
    where id = v_order.id;
  update public.orders
    set status = 'cancelado', payment_status = 'cancelado'
    where request_id = v_order.request_id
      and id <> v_order.id
      and status = 'aguardando_pagamento'
      and payment_status = 'pendente';
  update public.proposals
    set status = case when id = v_order.proposal_id then 'aceita' else 'recusada' end
    where request_id = v_order.request_id and status = 'pendente';
  update public.service_requests
    set status = 'contratado'
    where id = v_order.request_id;
  update public.payment_transactions
    set status = 'approved', gateway_payment_id = p_gateway_payment_id, updated_at = now()
    where order_id = v_order.id;
  return v_order.id;
end;
$$;

revoke all on function public.confirm_gateway_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.confirm_gateway_payment(uuid, text) to service_role;
notify pgrst, 'reload schema';
