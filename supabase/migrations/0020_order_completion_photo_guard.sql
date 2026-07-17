-- A conclusão depende de fotos finais: o prestador não pode enviar a etapa sem
-- evidência e o cliente só pode confirmar depois que elas existirem.
drop policy if exists "cada parte atualiza somente as etapas permitidas" on public.orders;

create policy "etapas do pedido exigem evidência para conclusão"
  on public.orders for update
  using (auth.uid() = client_id or auth.uid() = provider_id)
  with check (
    (
      provider_id = auth.uid()
      and (
        status in ('a_caminho', 'executando', 'aguardando_confirmacao')
        or (
          status = 'fotos_enviadas'
          and exists (
            select 1 from public.order_photos photo
            where photo.order_id = orders.id and photo.kind = 'depois'
          )
        )
      )
    )
    or (
      client_id = auth.uid()
      and (
        status in ('aceito', 'em_disputa', 'cancelado')
        or (
          status = 'concluido'
          and exists (
            select 1 from public.order_photos photo
            where photo.order_id = orders.id and photo.kind = 'depois'
          )
        )
      )
    )
  );
