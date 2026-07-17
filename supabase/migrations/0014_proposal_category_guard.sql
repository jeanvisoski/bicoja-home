-- Um prestador só pode se candidatar a pedidos de categorias que cadastrou
-- no próprio catálogo de serviços. A regra também protege chamadas diretas à API.

drop policy if exists "prestador cria proposta para solicitação aberta" on public.proposals;

create policy "prestador cria proposta na própria categoria"
  on public.proposals for insert
  with check (
    provider_id = auth.uid()
    and exists (
      select 1
      from public.service_requests request
      join public.provider_services service
        on service.category_id = request.category_id
      where request.id = request_id
        and request.status = 'aberto'
        and service.provider_id = auth.uid()
    )
  );
