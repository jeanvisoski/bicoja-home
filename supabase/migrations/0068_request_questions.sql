-- Prestador real em teste relatou: o cliente às vezes descreve pouco o
-- serviço, e o valor pode variar muito conforme detalhes que faltam. Um
-- chat 1:1 antes da contratação resolveria, mas com N prestadores
-- interessados o cliente teria que responder a mesma coisa N vezes. Em vez
-- disso: pergunta e resposta PÚBLICAS na solicitação -- qualquer prestador
-- elegível pergunta, o cliente responde uma vez, e a resposta fica visível
-- pra todos os prestadores que virem aquele pedido (mesmo os que ainda não
-- tinham essa dúvida).
create table public.request_questions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  provider_id uuid not null references public.provider_profiles(profile_id) on delete cascade,
  question text not null,
  answer text,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.request_questions enable row level security;

-- Mesma régua de elegibilidade já usada pra permitir enviar proposta:
-- categoria cadastrada e dentro do raio de atendimento.
create policy "prestador elegível pergunta"
  on public.request_questions for insert
  with check (
    provider_id = auth.uid()
    and public.provider_can_service_request_within_radius(request_id, auth.uid())
  );

create policy "cliente e prestadores elegíveis veem as perguntas"
  on public.request_questions for select
  using (
    exists (select 1 from public.service_requests r where r.id = request_id and r.client_id = auth.uid())
    or public.provider_can_service_request_within_radius(request_id, auth.uid())
  );

-- Cliente só pode alterar resposta/data (não pode editar a pergunta do
-- prestador nem trocar quem perguntou).
create policy "cliente responde a pergunta"
  on public.request_questions for update
  using (exists (select 1 from public.service_requests r where r.id = request_id and r.client_id = auth.uid()))
  with check (exists (select 1 from public.service_requests r where r.id = request_id and r.client_id = auth.uid()));
revoke update on public.request_questions from authenticated;
grant update (answer, answered_at) on public.request_questions to authenticated;

create policy "admin gerencia perguntas"
  on public.request_questions for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create or replace function public.notify_request_question_asked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
begin
  select client_id into v_client_id from public.service_requests where id = new.request_id;
  perform public.notify(
    v_client_id, 'pergunta_solicitacao', 'Um prestador tem uma dúvida sobre seu pedido',
    left(new.question, 200),
    '/proposals?requestId=' || new.request_id
  );
  return new;
end;
$$;

create trigger on_request_question_created_notify
  after insert on public.request_questions
  for each row execute function public.notify_request_question_asked();

create or replace function public.notify_request_question_answered()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.answer is not null and old.answer is null then
    perform public.notify(
      new.provider_id, 'pergunta_respondida', 'Sua dúvida foi respondida',
      left(new.answer, 200),
      '/pro/orders?requestId=' || new.request_id
    );
  end if;
  return new;
end;
$$;

create trigger on_request_question_answered_notify
  after update on public.request_questions
  for each row execute function public.notify_request_question_answered();

notify pgrst, 'reload schema';
