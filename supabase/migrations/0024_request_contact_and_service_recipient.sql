-- Contato operacional do pedido: pode ser o cliente ou outra pessoa no local.
alter table public.service_requests add column if not exists contact_name text;
alter table public.service_requests add column if not exists contact_phone text;
alter table public.service_requests add column if not exists attendee_name text;
