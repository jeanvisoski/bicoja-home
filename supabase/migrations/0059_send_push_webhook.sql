-- Dispara a Edge Function send-push a cada notificação criada, sem depender
-- de configurar isso manualmente pelo dashboard (Database Webhooks). Usa
-- pg_net direto -- mais portável que supabase_functions.http_request, que
-- só existe em projetos onde algum webhook já foi criado pela UI.
--
-- A função send-push está deployada com --no-verify-jwt: só é chamada por
-- este trigger interno do próprio banco, então não precisa (e não deve)
-- levar nenhuma chave de serviço embutida aqui na migration.
create extension if not exists pg_net;

create or replace function public.send_push_on_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://opuzucjcnepjqoackxsy.supabase.co/functions/v1/send-push',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('record', to_jsonb(new))
  );
  return new;
end;
$$;

drop trigger if exists on_notification_send_push on public.notifications;
create trigger on_notification_send_push
  after insert on public.notifications
  for each row execute function public.send_push_on_notification();

notify pgrst, 'reload schema';
