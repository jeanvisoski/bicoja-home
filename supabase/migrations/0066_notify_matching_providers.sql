-- Hoje o prestador só descobre uma solicitação nova na própria categoria se
-- abrir o painel manualmente -- não existe nenhum aviso. Este gatilho avisa
-- (e, com push ativado, notifica no aparelho) todo prestador que já poderia
-- de fato enviar proposta pra essa solicitação: mesma categoria cadastrada,
-- dentro do raio de atendimento, não suspenso, e respeitando "prestador
-- preferido" (se o cliente marcou um, só ele é avisado). Usa a mesma
-- fórmula de distância de provider_can_service_request_within_radius, só
-- que pra todos os prestadores elegíveis de uma vez, não só o da sessão.
create or replace function public.notify_matching_providers_new_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category_label text;
  v_address public.addresses%rowtype;
begin
  if new.status <> 'aberto' then
    return new;
  end if;

  select * into v_address from public.addresses where id = new.address_id;
  if v_address.lat is null or v_address.lng is null then
    return new;
  end if;

  select label into v_category_label from public.service_categories where id = new.category_id;

  perform public.notify(
    provider.profile_id,
    'nova_solicitacao',
    coalesce(v_category_label, 'Novo serviço') || ' perto de você',
    left(new.description, 200),
    '/pro'
  )
  from public.provider_profiles provider
  join public.provider_services service
    on service.provider_id = provider.profile_id and service.category_id = new.category_id
  where new.client_id <> provider.profile_id
    and (new.preferred_provider_id is null or new.preferred_provider_id = provider.profile_id)
    and provider.is_suspended = false
    and provider.lat is not null and provider.lng is not null
    and 6371 * 2 * asin(sqrt(
      power(sin(radians(v_address.lat - provider.lat) / 2), 2)
      + cos(radians(provider.lat)) * cos(radians(v_address.lat)) * power(sin(radians(v_address.lng - provider.lng) / 2), 2)
    )) <= provider.service_radius_km;

  return new;
end;
$$;

drop trigger if exists on_new_request_notify_providers on public.service_requests;
create trigger on_new_request_notify_providers
  after insert on public.service_requests
  for each row execute function public.notify_matching_providers_new_request();

notify pgrst, 'reload schema';
