-- Janela de atendimento: data(s) e horário(s) ficam registrados separadamente.
alter table public.service_requests
  add column if not exists availability_start_time time,
  add column if not exists availability_end_time time;
