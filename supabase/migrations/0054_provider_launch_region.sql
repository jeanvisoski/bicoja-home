-- Ate agora a checagem de regiao de lancamento (0047) so valia pra
-- solicitacao do cliente -- um prestador de qualquer cidade podia se
-- cadastrar normalmente, mesmo fora das regioes ativas. Aplica a mesma
-- checagem (is_service_area_active, ja existente) tambem no cadastro/edicao
-- de endereco do prestador.
create or replace function public.validate_provider_service_area()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_service_area_active(new.city, new.state) then
    raise exception 'A BICOJA ainda nao atende % / % nesta fase de lancamento.', new.city, new.state;
  end if;
  return new;
end; $$;

drop trigger if exists on_provider_profile_service_area on public.provider_profiles;
create trigger on_provider_profile_service_area
  before insert or update of city, state on public.provider_profiles
  for each row execute function public.validate_provider_service_area();

notify pgrst, 'reload schema';
