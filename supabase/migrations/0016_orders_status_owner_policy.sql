-- O status "a_caminho" deve ser informado pelo prestador, nunca pelo pagamento
-- nem pelo cliente. Restringe os avanços de cada lado do pedido.

drop policy if exists "cliente e prestador atualizam o andamento" on public.orders;

create policy "cada parte atualiza somente as etapas permitidas"
  on public.orders for update
  using (auth.uid() = client_id or auth.uid() = provider_id)
  with check (
    (provider_id = auth.uid() and status in (
      'a_caminho', 'executando', 'fotos_enviadas', 'aguardando_confirmacao'
    ))
    or (client_id = auth.uid() and status in (
      'aceito', 'concluido', 'em_disputa', 'cancelado'
    ))
  );
