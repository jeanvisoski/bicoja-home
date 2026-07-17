-- A migration 0001 criou RLS de SELECT para conversations mas esqueceu o INSERT,
-- então a criação automática de conversa ao aceitar uma proposta (proposals.tsx)
-- ficava bloqueada por padrão do RLS.

create policy "cliente ou prestador cria a conversa do próprio pedido"
  on public.conversations for insert
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_id and (o.client_id = auth.uid() or o.provider_id = auth.uid())
    )
  );
