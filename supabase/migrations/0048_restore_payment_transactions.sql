-- Recupera a estrutura de transações caso a migration inicial de gateway tenha
-- sido aplicada parcialmente. Sem esse registro o checkout cria a preferência
-- no gateway, mas não consegue persistir a referência necessária ao webhook e
-- aos reembolsos.
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

drop policy if exists "cliente ou prestador veem transacao do pedido" on public.payment_transactions;
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

notify pgrst, 'reload schema';
