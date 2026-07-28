-- O chat (e as notificações do navegador) dependiam de postgres_changes,
-- mas nenhuma tabela nunca foi de fato adicionada à publicação
-- supabase_realtime -- então as duas ficavam só em polling/silenciosas sem
-- ninguém perceber, já que o código parecia certo.
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;

-- Suporte a foto anexada na conversa: mensagem passa a poder ter só texto,
-- só foto, ou os dois -- nunca os dois vazios.
alter table public.messages add column if not exists attachment_url text;
alter table public.messages alter column body drop not null;
alter table public.messages add constraint messages_body_or_attachment_check
  check (body is not null or attachment_url is not null);

-- Mensagem só com foto (body nulo) ficava com a notificação em branco.
create or replace function public.handle_new_message_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_provider_id uuid;
  v_target uuid;
begin
  select o.client_id, o.provider_id into v_client_id, v_provider_id
  from public.conversations c
  join public.orders o on o.id = c.order_id
  where c.id = new.conversation_id;

  if new.sender_id = v_client_id then
    v_target := v_provider_id;
  else
    v_target := v_client_id;
  end if;

  perform public.notify(
    v_target,
    'mensagem',
    'Nova mensagem',
    coalesce(new.body, case when new.attachment_url is not null then '📷 Foto' else null end),
    '/messages'
  );
  return new;
end;
$$;
