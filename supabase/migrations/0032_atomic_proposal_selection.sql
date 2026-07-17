-- A confirmação do checkout escolhe exatamente um prestador. A operação é
-- atômica para impedir que dois prestadores sejam contratados para o mesmo pedido.
create or replace function public.confirm_order_payment(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Pedido não encontrado.';
  end if;
  if v_order.client_id <> auth.uid() then
    raise exception 'Você não pode confirmar este pagamento.';
  end if;
  if v_order.status <> 'aguardando_pagamento' or v_order.payment_status <> 'pendente' then
    raise exception 'Este checkout já foi processado ou não está mais disponível.';
  end if;

  perform 1 from public.service_requests where id = v_order.request_id and status = 'aberto' for update;
  if not found then
    raise exception 'Esta solicitação já foi contratada por outro prestador.';
  end if;

  update public.orders
  set status = 'aceito', payment_status = 'confirmado'
  where id = v_order.id;

  -- Outros checkouts abandonados para esta mesma solicitaÃ§Ã£o nÃ£o podem
  -- permanecer utilizÃ¡veis depois que uma proposta foi contratada.
  update public.orders
  set status = 'cancelado', payment_status = 'cancelado'
  where request_id = v_order.request_id
    and id <> v_order.id
    and status = 'aguardando_pagamento'
    and payment_status = 'pendente';

  update public.proposals
  set status = case when id = v_order.proposal_id then 'aceita' else 'recusada' end
  where request_id = v_order.request_id and status = 'pendente';

  update public.service_requests set status = 'contratado' where id = v_order.request_id;
  return v_order.id;
end;
$$;

grant execute on function public.confirm_order_payment(uuid) to authenticated;

-- Garante que o endpoint RPC do PostgREST enxergue a funÃ§Ã£o imediatamente.
notify pgrst, 'reload schema';
