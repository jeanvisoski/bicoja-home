-- service_requests.preferred_provider_id não tinha regra de ON DELETE,
-- então excluir QUALQUER prestador que algum cliente já tenha marcado como
-- preferido falhava com violação de FK (a solicitação do cliente continua
-- existindo, só a preferência por aquele prestador específico deixa de
-- fazer sentido e vira nula).
alter table public.service_requests
  drop constraint if exists service_requests_preferred_provider_id_fkey;

alter table public.service_requests
  add constraint service_requests_preferred_provider_id_fkey
  foreign key (preferred_provider_id) references public.provider_profiles(profile_id) on delete set null;
