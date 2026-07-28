-- Até aqui uma conversa só existia DEPOIS que virava pedido -- um cliente
-- não conseguia tirar uma dúvida com o prestador sobre um orçamento antes de
-- contratar. Esta migration desacopla a conversa do pedido: ela passa a ser
-- identificada por (cliente, prestador, solicitação), e o pedido -- quando
-- existir -- só é mais um dado ligado a ela, não o dono dela.
alter table public.conversations
  add column if not exists client_id uuid references public.profiles(id) on delete cascade,
  add column if not exists provider_id uuid references public.provider_profiles(profile_id) on delete cascade,
  add column if not exists request_id uuid references public.service_requests(id) on delete cascade;

update public.conversations c set
  client_id = o.client_id,
  provider_id = o.provider_id,
  request_id = o.request_id
from public.orders o
where o.id = c.order_id and c.client_id is null;

alter table public.conversations alter column order_id drop not null;
alter table public.conversations alter column client_id set not null;
alter table public.conversations alter column provider_id set not null;
alter table public.conversations alter column request_id set not null;
alter table public.conversations add constraint conversations_client_provider_request_key
  unique (client_id, provider_id, request_id);

drop policy if exists "conversa segue a visibilidade do pedido" on public.conversations;
create policy "participantes veem a conversa"
  on public.conversations for select
  using (client_id = auth.uid() or provider_id = auth.uid());

-- messages: mesma simplificação -- não precisa mais passar pelo pedido pra
-- saber quem participa da conversa.
drop policy if exists "participantes leem as mensagens" on public.messages;
create policy "participantes leem as mensagens"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and (c.client_id = auth.uid() or c.provider_id = auth.uid())
    )
  );

drop policy if exists "participantes enviam mensagens" on public.messages;
create policy "participantes enviam mensagens"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and (c.client_id = auth.uid() or c.provider_id = auth.uid())
    )
  );

drop policy if exists "participantes marcam mensagens como lidas" on public.messages;
create policy "participantes marcam mensagens como lidas"
  on public.messages for update
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and (c.client_id = auth.uid() or c.provider_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and (c.client_id = auth.uid() or c.provider_id = auth.uid())
    )
  );

-- Conversa antes do pedido só é permitida se já existir uma proposta desse
-- prestador nessa solicitação -- evita mensagem entre desconhecidos que
-- nunca tiveram nenhum contato.
create or replace function public.start_provider_conversation(
  p_request_id uuid,
  p_provider_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.service_requests%rowtype;
  v_conversation_id uuid;
begin
  select * into v_request from public.service_requests where id = p_request_id;
  if not found then raise exception 'Solicitação não encontrada.'; end if;
  if auth.uid() not in (v_request.client_id, p_provider_id) then
    raise exception 'Você não participa desta solicitação.';
  end if;
  if not exists (
    select 1 from public.proposals where request_id = p_request_id and provider_id = p_provider_id
  ) then
    raise exception 'Só é possível conversar depois que o prestador enviar uma proposta para esta solicitação.';
  end if;

  select id into v_conversation_id from public.conversations
    where client_id = v_request.client_id and provider_id = p_provider_id and request_id = p_request_id;
  if v_conversation_id is not null then
    return v_conversation_id;
  end if;

  insert into public.conversations (client_id, provider_id, request_id)
  values (v_request.client_id, p_provider_id, p_request_id)
  returning id into v_conversation_id;
  return v_conversation_id;
end;
$$;

grant execute on function public.start_provider_conversation(uuid, uuid) to authenticated;

-- Ao criar o pedido, reaproveita a conversa pré-contratação (se existir) em
-- vez de criar uma segunda -- o histórico de mensagens continua.
create or replace function public.create_order_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_id uuid;
begin
  select id into v_existing_id from public.conversations
    where client_id = new.client_id and provider_id = new.provider_id and request_id = new.request_id;
  if v_existing_id is not null then
    update public.conversations set order_id = new.id where id = v_existing_id and order_id is null;
  else
    insert into public.conversations (order_id, client_id, provider_id, request_id)
    values (new.id, new.client_id, new.provider_id, new.request_id)
    on conflict (order_id) do nothing;
  end if;
  return new;
end;
$$;

-- trust_reports (denúncia de pagamento externo) também precisa funcionar
-- numa conversa que ainda não tem pedido.
alter table public.trust_reports alter column order_id drop not null;
alter table public.trust_reports add column if not exists conversation_id uuid references public.conversations(id) on delete set null;

drop policy if exists "partes do pedido criam denúncias de confiança" on public.trust_reports;
drop policy if exists "partes veem suas denúncias de confiança" on public.trust_reports;

create policy "reporter cria denúncia de confiança"
  on public.trust_reports for insert
  with check (
    reporter_id = auth.uid()
    and (
      (order_id is not null and exists (select 1 from public.orders o where o.id = order_id and (o.client_id = auth.uid() or o.provider_id = auth.uid())))
      or
      (conversation_id is not null and exists (select 1 from public.conversations c where c.id = conversation_id and (c.client_id = auth.uid() or c.provider_id = auth.uid())))
    )
  );

create policy "partes veem suas denúncias de confiança"
  on public.trust_reports for select
  using (
    reporter_id = auth.uid()
    or (order_id is not null and exists (select 1 from public.orders o where o.id = order_id and (o.client_id = auth.uid() or o.provider_id = auth.uid())))
    or (conversation_id is not null and exists (select 1 from public.conversations c where c.id = conversation_id and (c.client_id = auth.uid() or c.provider_id = auth.uid())))
  );

-- Detecção automática de "pagamento por fora" na mensagem: antes só criava
-- a denúncia se a conversa já tivesse um pedido -- agora sempre cria,
-- ligando pelo conversation_id.
create or replace function public.flag_possible_off_platform_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
begin
  if new.body is null or lower(new.body) !~ '(pix.*(fora|direto)|paga.*(por fora|direto)|transfer.{0,20}(direto|fora)|dinheiro.{0,20}(direto|fora))' then
    return new;
  end if;
  select c.order_id into v_order_id from public.conversations c where c.id = new.conversation_id;
  insert into public.trust_reports (order_id, conversation_id, reported_user_id, category, evidence_excerpt, source)
  values (v_order_id, new.conversation_id, new.sender_id, 'pagamento_externo', left(new.body, 500), 'automatico');
  return new;
end;
$$;

notify pgrst, 'reload schema';
