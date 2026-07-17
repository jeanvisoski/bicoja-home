-- Politica transitÃ³ria para a sequÃªncia inicial de migrations. A migration
-- 0034 remove esta permissÃ£o ampla e passa a criar checkout somente por RPC.
create policy "cliente cria checkout pendente proprio"
  on public.orders for insert to authenticated
  with check (
    client_id = auth.uid()
  );
