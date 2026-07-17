-- Notificações in-app. Inseridas só por triggers (security definer), nunca
-- diretamente pelo cliente — por isso não existe policy de INSERT pra role
-- authenticated, só SELECT/UPDATE do dono.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "dono vê as próprias notificações"
  on public.notifications for select
  using (auth.uid() = profile_id);

create policy "dono marca como lida"
  on public.notifications for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

create or replace function public.notify(
  p_profile_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_link text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (profile_id, type, title, body, link)
  values (p_profile_id, p_type, p_title, p_body, p_link);
end;
$$;

-- Nova proposta -> avisa o cliente da solicitação.
create or replace function public.handle_new_proposal_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_category text;
begin
  select r.client_id, c.label into v_client_id, v_category
  from public.service_requests r
  join public.service_categories c on c.id = r.category_id
  where r.id = new.request_id;

  perform public.notify(
    v_client_id,
    'nova_proposta',
    'Nova proposta recebida',
    'Você recebeu uma proposta para ' || coalesce(v_category, 'seu serviço') || '.',
    '/proposals?requestId=' || new.request_id
  );
  return new;
end;
$$;

create trigger on_proposal_created_notify
  after insert on public.proposals
  for each row execute function public.handle_new_proposal_notify();

-- Pedido criado (proposta aceita) -> avisa o prestador contratado.
create or replace function public.handle_new_order_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify(
    new.provider_id,
    'contratado',
    'Você foi contratado!',
    'Um cliente aceitou sua proposta.',
    '/pro/orders?orderId=' || new.id
  );
  return new;
end;
$$;

create trigger on_order_created_notify
  after insert on public.orders
  for each row execute function public.handle_new_order_notify();

-- Mudança de status do pedido -> avisa a outra parte (quem não causou a mudança).
create or replace function public.handle_order_status_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_provider_id uuid;
  v_target uuid;
  v_title text;
  v_body text;
  v_link text;
begin
  select client_id, provider_id into v_client_id, v_provider_id
  from public.orders where id = new.order_id;

  if new.status = 'a_caminho' then
    v_target := v_provider_id;
    v_title := 'Pagamento confirmado';
    v_body := 'O cliente confirmou o pagamento — pode ir para o serviço!';
    v_link := '/pro/orders?orderId=' || new.order_id;
  elsif new.status = 'executando' then
    v_target := v_client_id;
    v_title := 'Serviço iniciado';
    v_body := 'O prestador iniciou o serviço.';
    v_link := '/tracking?orderId=' || new.order_id;
  elsif new.status = 'fotos_enviadas' then
    v_target := v_client_id;
    v_title := 'Serviço concluído pelo prestador';
    v_body := 'Confira as fotos e confirme a conclusão.';
    v_link := '/confirm?orderId=' || new.order_id;
  elsif new.status = 'concluido' then
    v_target := v_provider_id;
    v_title := 'Pagamento liberado';
    v_body := 'O cliente confirmou a conclusão do serviço.';
    v_link := '/pro';
  elsif new.status = 'em_disputa' then
    v_target := v_provider_id;
    v_title := 'Problema reportado';
    v_body := 'O cliente reportou um problema neste pedido.';
    v_link := '/pro/orders?orderId=' || new.order_id;
  else
    return new;
  end if;

  perform public.notify(v_target, new.status, v_title, v_body, v_link);
  return new;
end;
$$;

create trigger on_order_status_notify
  after insert on public.order_status_events
  for each row execute function public.handle_order_status_notify();

-- Nova mensagem -> avisa quem não enviou.
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

  perform public.notify(v_target, 'mensagem', 'Nova mensagem', new.body, '/messages');
  return new;
end;
$$;

create trigger on_message_created_notify
  after insert on public.messages
  for each row execute function public.handle_new_message_notify();

-- Nova avaliação -> avisa o prestador.
create or replace function public.handle_new_rating_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify(
    new.provider_id,
    'avaliacao',
    'Você recebeu uma avaliação',
    new.stars || ' estrela(s)' || coalesce(' — ' || new.comment, ''),
    '/pro/profile'
  );
  return new;
end;
$$;

create trigger on_rating_created_notify
  after insert on public.ratings
  for each row execute function public.handle_new_rating_notify();
