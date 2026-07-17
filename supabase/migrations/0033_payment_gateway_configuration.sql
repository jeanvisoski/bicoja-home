-- Configuracao publica do checkout. Credenciais do gateway nunca ficam aqui:
-- elas devem ser cadastradas somente como secrets das Edge Functions.
alter table public.platform_settings
  add column if not exists payment_mode text not null default 'homologacao'
    check (payment_mode in ('homologacao', 'sandbox', 'producao')),
  add column if not exists payment_gateway text not null default 'mercado_pago'
    check (payment_gateway in ('mercado_pago')),
  add column if not exists pix_enabled boolean not null default true,
  add column if not exists card_enabled boolean not null default true,
  add column if not exists app_url text;

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  gateway text not null check (gateway in ('mercado_pago')),
  mode text not null check (mode in ('sandbox', 'producao')),
  method text,
  status text not null default 'created'
    check (status in ('created', 'pending', 'approved', 'rejected', 'cancelled', 'refunded')),
  gateway_preference_id text,
  gateway_payment_id text,
  checkout_url text,
  raw_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payment_transactions enable row level security;

create policy "cliente ou prestador veem transacao do pedido"
  on public.payment_transactions for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = payment_transactions.order_id
        and (o.client_id = auth.uid() or o.provider_id = auth.uid())
    )
    or public.is_admin(auth.uid())
  );

-- O cliente so pode simular a aprovacao quando o admin tiver escolhido
-- explicitamente o modo de homologacao.
create or replace function public.confirm_order_payment(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode text;
  v_order public.orders%rowtype;
begin
  select payment_mode into v_mode from public.platform_settings where id = true;
  if coalesce(v_mode, 'homologacao') <> 'homologacao' then
    raise exception 'A confirmacao simulada esta desativada. Conclua o pagamento pelo gateway.';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Pedido nao encontrado.'; end if;
  if v_order.client_id <> auth.uid() then raise exception 'Voce nao pode confirmar este pagamento.'; end if;
  if v_order.status <> 'aguardando_pagamento' or v_order.payment_status <> 'pendente' then
    raise exception 'Este checkout ja foi processado ou nao esta mais disponivel.';
  end if;

  perform 1 from public.service_requests where id = v_order.request_id and status = 'aberto' for update;
  if not found then raise exception 'Esta solicitacao ja foi contratada por outro prestador.'; end if;

  update public.orders set status = 'aceito', payment_status = 'confirmado' where id = v_order.id;
  update public.orders set status = 'cancelado', payment_status = 'cancelado'
    where request_id = v_order.request_id and id <> v_order.id
      and status = 'aguardando_pagamento' and payment_status = 'pendente';
  update public.proposals set status = case when id = v_order.proposal_id then 'aceita' else 'recusada' end
    where request_id = v_order.request_id and status = 'pendente';
  update public.service_requests set status = 'contratado' where id = v_order.request_id;
  return v_order.id;
end;
$$;

grant execute on function public.confirm_order_payment(uuid) to authenticated;

-- Esta funcao e chamada apenas pela Edge Function apos confirmar o pagamento
-- diretamente com o gateway. Nao fica disponivel ao navegador.
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
  if v_order.status = 'aceito' and v_order.payment_status = 'confirmado' then return v_order.id; end if;
  if v_order.status <> 'aguardando_pagamento' or v_order.payment_status <> 'pendente' then
    raise exception 'Este checkout ja foi processado ou nao esta mais disponivel.';
  end if;

  perform 1 from public.service_requests where id = v_order.request_id and status = 'aberto' for update;
  if not found then raise exception 'Esta solicitacao ja foi contratada por outro prestador.'; end if;

  update public.orders set status = 'aceito', payment_status = 'confirmado' where id = v_order.id;
  update public.orders set status = 'cancelado', payment_status = 'cancelado'
    where request_id = v_order.request_id and id <> v_order.id
      and status = 'aguardando_pagamento' and payment_status = 'pendente';
  update public.proposals set status = case when id = v_order.proposal_id then 'aceita' else 'recusada' end
    where request_id = v_order.request_id and status = 'pendente';
  update public.service_requests set status = 'contratado' where id = v_order.request_id;
  update public.payment_transactions set status = 'approved', gateway_payment_id = p_gateway_payment_id, updated_at = now()
    where order_id = v_order.id;
  return v_order.id;
end;
$$;

revoke all on function public.confirm_gateway_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.confirm_gateway_payment(uuid, text) to service_role;
notify pgrst, 'reload schema';
