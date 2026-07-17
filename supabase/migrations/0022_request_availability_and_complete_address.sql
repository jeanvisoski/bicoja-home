-- Janela de disponibilidade do cliente e endereço completo do local de serviço.
alter table public.addresses add column if not exists cep text;
alter table public.service_requests add column if not exists availability_start date;
alter table public.service_requests add column if not exists availability_end date;

alter table public.service_requests
  add constraint service_requests_availability_range_check
  check (availability_start is null or availability_end is null or availability_end >= availability_start) not valid;
fizem