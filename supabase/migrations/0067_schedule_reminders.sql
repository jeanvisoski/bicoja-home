-- pg_cron constava em migrations antigas (0010, 0040) mas nunca tinha sido
-- de fato habilitado neste projeto -- create extension falhava
-- silenciosamente (precisa ser ativado a nível de infraestrutura, não só
-- por SQL solto). Corrigido: já validado que "create extension" agora
-- funciona de verdade.
create extension if not exists pg_cron with schema cron;

-- Evita mandar o mesmo lembrete mais de uma vez (o job roda a cada 5 min).
create table if not exists public.order_reminders_sent (
  order_id uuid not null references public.orders(id) on delete cascade,
  kind text not null check (kind in ('dia', '30min')),
  sent_at timestamptz not null default now(),
  primary key (order_id, kind)
);

alter table public.order_reminders_sent enable row level security;
create policy "admin vê lembretes enviados"
  on public.order_reminders_sent for select
  using (public.is_admin(auth.uid()));

-- Lembrete "hoje tem serviço" (uma vez, na primeira janela das 7h do dia
-- agendado) e "faltam 30 minutos" (uma vez, quando entra na janela).
-- scheduled_date/scheduled_start_time são horário local (não têm fuso
-- gravado) -- interpretados como America/Sao_Paulo, único fuso onde a
-- BICOJÁ atende hoje.
create or replace function public.send_schedule_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_scheduled_at timestamptz;
  v_now_local timestamp;
begin
  v_now_local := now() at time zone 'America/Sao_Paulo';

  for v_order in
    select o.id, o.client_id, o.provider_id, o.scheduled_date, o.scheduled_start_time,
      sc.label as category_label
    from public.orders o
    left join public.service_requests sr on sr.id = o.request_id
    left join public.service_categories sc on sc.id = sr.category_id
    where o.status = 'aceito'
      and o.scheduled_date is not null
      and o.scheduled_start_time is not null
  loop
    v_scheduled_at := (v_order.scheduled_date + v_order.scheduled_start_time) at time zone 'America/Sao_Paulo';

    if v_scheduled_at > now()
      and v_order.scheduled_date = v_now_local::date
      and extract(hour from v_now_local) = 7
      and not exists (
        select 1 from public.order_reminders_sent where order_id = v_order.id and kind = 'dia'
      )
    then
      perform public.notify(
        v_order.client_id, 'lembrete_agendamento', 'Serviço agendado para hoje',
        coalesce(v_order.category_label, 'Seu serviço') || ' está agendado para hoje às ' || to_char(v_order.scheduled_start_time, 'HH24:MI') || '.',
        '/tracking?orderId=' || v_order.id
      );
      perform public.notify(
        v_order.provider_id, 'lembrete_agendamento', 'Serviço agendado para hoje',
        coalesce(v_order.category_label, 'Um serviço') || ' está agendado para hoje às ' || to_char(v_order.scheduled_start_time, 'HH24:MI') || '.',
        '/pro/orders?orderId=' || v_order.id
      );
      insert into public.order_reminders_sent (order_id, kind) values (v_order.id, 'dia') on conflict do nothing;
    end if;

    if v_scheduled_at > now()
      and v_scheduled_at <= now() + interval '30 minutes'
      and not exists (
        select 1 from public.order_reminders_sent where order_id = v_order.id and kind = '30min'
      )
    then
      perform public.notify(
        v_order.client_id, 'lembrete_agendamento', 'Serviço em 30 minutos',
        coalesce(v_order.category_label, 'Seu serviço') || ' começa às ' || to_char(v_order.scheduled_start_time, 'HH24:MI') || '.',
        '/tracking?orderId=' || v_order.id
      );
      perform public.notify(
        v_order.provider_id, 'lembrete_agendamento', 'Serviço em 30 minutos',
        coalesce(v_order.category_label, 'Um serviço') || ' começa às ' || to_char(v_order.scheduled_start_time, 'HH24:MI') || '.',
        '/pro/orders?orderId=' || v_order.id
      );
      insert into public.order_reminders_sent (order_id, kind) values (v_order.id, '30min') on conflict do nothing;
    end if;
  end loop;
end;
$$;

do $$
begin
  perform cron.unschedule('send-schedule-reminders');
exception when others then
  null;
end $$;

select cron.schedule(
  'send-schedule-reminders',
  '*/5 * * * *',
  $$select public.send_schedule_reminders();$$
);

notify pgrst, 'reload schema';
