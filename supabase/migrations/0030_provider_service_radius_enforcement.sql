-- O raio de atendimento é uma regra de segurança: prestador só pode enviar
-- proposta quando endereço do pedido e localização do prestador existirem e
-- a distância em linha reta estiver dentro do raio configurado.
drop policy if exists "prestador ativo cria proposta na própria categoria" on public.proposals;
create policy "prestador ativo cria proposta dentro do raio"
  on public.proposals for insert
  with check (
    provider_id = auth.uid()
    and exists (
      select 1
      from public.service_requests request
      join public.addresses address on address.id = request.address_id
      join public.provider_services service on service.category_id = request.category_id
      join public.provider_profiles provider on provider.profile_id = service.provider_id
      where request.id = request_id
        and request.status = 'aberto'
        and service.provider_id = auth.uid()
        and provider.is_suspended = false
        and provider.lat is not null and provider.lng is not null
        and address.lat is not null and address.lng is not null
        and 6371 * 2 * asin(sqrt(
          power(sin(radians(address.lat - provider.lat) / 2), 2)
          + cos(radians(provider.lat)) * cos(radians(address.lat))
            * power(sin(radians(address.lng - provider.lng) / 2), 2)
        )) <= provider.service_radius_km
    )
  );
