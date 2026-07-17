-- A criação do checkout não contrata o prestador. Apenas pagamento confirmado
-- transforma a proposta em aceita e permite iniciar o serviço.
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (status in (
  'aguardando_pagamento', 'aceito', 'a_caminho', 'executando', 'fotos_enviadas',
  'aguardando_confirmacao', 'concluido', 'em_disputa', 'cancelado'
));

-- Pedidos históricos já eram pagamentos confirmados pelo fluxo anterior.
alter table public.orders add column if not exists payment_status text not null default 'confirmado'
  check (payment_status in ('pendente', 'confirmado', 'cancelado', 'reembolsado'));

-- O cliente só pode confirmar o checkout próprio; prestador só avança pedido pago.
drop policy if exists "etapas do pedido exigem evidência e valor combinado" on public.orders;
create policy "pedido pago exige evidência e valor combinado"
  on public.orders for update
  using (auth.uid() = client_id or auth.uid() = provider_id)
  with check (
    (
      client_id = auth.uid()
      and (
        (status = 'aceito' and payment_status = 'confirmado')
        or status in ('em_disputa', 'cancelado')
        or (status = 'concluido' and exists (select 1 from public.order_photos photo where photo.order_id = orders.id and photo.kind = 'depois'))
      )
    )
    or (
      provider_id = auth.uid() and payment_status = 'confirmado'
      and (
        status in ('a_caminho', 'executando', 'aguardando_confirmacao')
        or (status = 'fotos_enviadas' and price = final_price and exists (select 1 from public.order_photos photo where photo.order_id = orders.id and photo.kind = 'depois'))
      )
    )
  );
