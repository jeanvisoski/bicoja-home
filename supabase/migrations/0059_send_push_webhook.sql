-- Cria o Database Webhook direto por SQL (equivalente a fazer isso no
-- dashboard em Database > Webhooks), pra não depender de um passo manual
-- fora do código. supabase_functions.http_request já injeta os headers de
-- autorização necessários pra chamar a Edge Function -- não precisa (e não
-- deve) embutir nenhuma chave aqui.
create trigger "send_push_on_notification"
after insert on public.notifications
for each row
execute function supabase_functions.http_request(
  'https://opuzucjcnepjqoackxsy.supabase.co/functions/v1/send-push',
  'POST',
  '{"Content-type":"application/json"}',
  '{}',
  '5000'
);
