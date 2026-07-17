-- migration 0001 só deixava o PRESTADOR inserir order_photos. Mas ao aceitar
-- uma proposta, o CLIENTE copia as fotos da solicitação pra order_photos
-- (kind='antes') — precisa de uma policy própria pra esse caso.

create policy "cliente anexa fotos de antes ao contratar"
  on public.order_photos for insert
  with check (
    kind = 'antes'
    and exists (select 1 from public.orders o where o.id = order_id and o.client_id = auth.uid())
  );
