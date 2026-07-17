-- O endereço é um dado salvo do cliente. Uma solicitação pode continuar
-- existindo após ele removê-lo da agenda; nesse caso apenas removemos o vínculo.
alter table public.service_requests
  drop constraint if exists service_requests_address_id_fkey;

alter table public.service_requests
  add constraint service_requests_address_id_fkey
  foreign key (address_id) references public.addresses(id) on delete set null;
