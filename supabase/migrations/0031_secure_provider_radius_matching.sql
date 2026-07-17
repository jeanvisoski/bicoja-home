-- A localização completa do cliente continua privada antes da contratação.
-- Estas funções calculam somente a elegibilidade e a distância do prestador.
create or replace function public.provider_can_service_request_within_radius(p_request_id uuid, p_provider_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select p_provider_id = auth.uid() and exists (
    select 1
    from public.service_requests request
    join public.addresses address on address.id = request.address_id
    join public.provider_profiles provider on provider.profile_id = p_provider_id
    join public.provider_services service on service.provider_id = p_provider_id and service.category_id = request.category_id
    where request.id = p_request_id
      and request.status = 'aberto'
      and (request.preferred_provider_id is null or request.preferred_provider_id = p_provider_id)
      and provider.is_suspended = false
      and provider.lat is not null and provider.lng is not null
      and address.lat is not null and address.lng is not null
      and 6371 * 2 * asin(sqrt(
        power(sin(radians(address.lat - provider.lat) / 2), 2)
        + cos(radians(provider.lat)) * cos(radians(address.lat)) * power(sin(radians(address.lng - provider.lng) / 2), 2)
      )) <= provider.service_radius_km
  );
$$;

create or replace function public.get_provider_open_request_distances()
returns table (request_id uuid, distance_km numeric)
language sql
security definer
stable
set search_path = public
as $$
  select request.id,
    round((6371 * 2 * asin(sqrt(
      power(sin(radians(address.lat - provider.lat) / 2), 2)
      + cos(radians(provider.lat)) * cos(radians(address.lat)) * power(sin(radians(address.lng - provider.lng) / 2), 2)
    )))::numeric, 1)
  from public.service_requests request
  join public.addresses address on address.id = request.address_id
  join public.provider_profiles provider on provider.profile_id = auth.uid()
  join public.provider_services service on service.provider_id = provider.profile_id and service.category_id = request.category_id
  where request.status = 'aberto'
    and (request.preferred_provider_id is null or request.preferred_provider_id = provider.profile_id)
    and provider.is_suspended = false
    and provider.lat is not null and provider.lng is not null
    and address.lat is not null and address.lng is not null
    and 6371 * 2 * asin(sqrt(
      power(sin(radians(address.lat - provider.lat) / 2), 2)
      + cos(radians(provider.lat)) * cos(radians(address.lat)) * power(sin(radians(address.lng - provider.lng) / 2), 2)
    )) <= provider.service_radius_km;
$$;

grant execute on function public.get_provider_open_request_distances() to authenticated;

drop policy if exists "prestador ativo cria proposta dentro do raio" on public.proposals;
create policy "prestador ativo cria proposta dentro do raio"
  on public.proposals for insert
  with check (
    provider_id = auth.uid()
    and mesmo public.provider_can_service_request_within_radius(request_id, auth.uid())
  );
