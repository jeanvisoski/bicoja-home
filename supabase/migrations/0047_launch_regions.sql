-- Controla a abertura gradual da BICOJÁ por cidade. O bloqueio é aplicado no
-- banco para não poder ser contornado por uma chamada direta do aplicativo.
alter table public.platform_settings
  add column if not exists launch_regions_enabled boolean not null default false,
  add column if not exists active_service_regions jsonb not null default '[]'::jsonb
    check (jsonb_typeof(active_service_regions) = 'array');

comment on column public.platform_settings.launch_regions_enabled is
  'Quando ativo, novos pedidos só podem ser criados nas cidades configuradas.';
comment on column public.platform_settings.active_service_regions is
  'Lista de áreas de lançamento no formato [{"city":"Erechim","state":"RS"}].';

create or replace function public.is_service_area_active(p_city text, p_state text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_enabled boolean;
  v_regions jsonb;
begin
  select launch_regions_enabled, active_service_regions
    into v_enabled, v_regions
  from public.platform_settings
  where id = true;

  -- Enquanto a expansão regional estiver desligada, mantém o comportamento
  -- atual e não interrompe a operação existente.
  if not coalesce(v_enabled, false) then return true; end if;
  if nullif(trim(coalesce(p_city, '')), '') is null
     or nullif(trim(coalesce(p_state, '')), '') is null then return false; end if;

  return exists (
    select 1
    from jsonb_to_recordset(coalesce(v_regions, '[]'::jsonb)) as region(city text, state text)
    where lower(trim(region.city)) = lower(trim(p_city))
      and lower(trim(region.state)) = lower(trim(p_state))
  );
end;
$$;

create or replace function public.validate_service_request_service_area()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_city text;
  v_state text;
begin
  select city, state into v_city, v_state
  from public.addresses
  where id = new.address_id;

  if not public.is_service_area_active(v_city, v_state) then
    raise exception 'A BICOJÁ ainda não atende %/% nesta fase de lançamento.',
      coalesce(v_city, 'esta cidade'), coalesce(v_state, '');
  end if;
  return new;
end;
$$;

drop trigger if exists validate_service_request_service_area on public.service_requests;
create trigger validate_service_request_service_area
  before insert or update of address_id on public.service_requests
  for each row execute function public.validate_service_request_service_area();

notify pgrst, 'reload schema';
