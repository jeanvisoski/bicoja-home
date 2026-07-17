-- Base operacional para proteção contra desvio de pagamento e aceite dos termos.
alter table public.profiles
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists provider_terms_accepted_at timestamptz;

alter table public.provider_profiles
  add column if not exists is_suspended boolean not null default false;

alter table public.orders
  add column if not exists final_amount_approved_at timestamptz;

create table if not exists public.trust_reports (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  reporter_id uuid references public.profiles(id) on delete set null,
  reported_user_id uuid references public.profiles(id) on delete set null,
  category text not null check (category in ('pagamento_externo', 'conduta', 'fraude', 'outro')),
  description text,
  evidence_excerpt text,
  source text not null default 'manual' check (source in ('manual', 'automatico')),
  status text not null default 'aberto' check (status in ('aberto', 'em_analise', 'resolvido', 'arquivado')),
  admin_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
alter table public.trust_reports enable row level security;

create policy "partes do pedido criam denúncias de confiança"
  on public.trust_reports for insert
  with check (
    reporter_id = auth.uid()
    and exists (select 1 from public.orders o where o.id = order_id and (o.client_id = auth.uid() or o.provider_id = auth.uid()))
  );
create policy "partes veem suas denúncias de confiança"
  on public.trust_reports for select
  using (reporter_id = auth.uid() or exists (select 1 from public.orders o where o.id = order_id and (o.client_id = auth.uid() or o.provider_id = auth.uid())));
create policy "admin gerencia denúncias de confiança"
  on public.trust_reports for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "prestador cria proposta na própria categoria" on public.proposals;
create policy "prestador ativo cria proposta na própria categoria"
  on public.proposals for insert
  with check (
    provider_id = auth.uid()
    and exists (
      select 1 from public.service_requests request
      join public.provider_services service on service.category_id = request.category_id
      join public.provider_profiles provider on provider.profile_id = service.provider_id
      where request.id = request_id and request.status = 'aberto'
        and service.provider_id = auth.uid() and provider.is_suspended = false
    )
  );

-- Sinaliza para revisão mensagens que indicam tentativa de desviar o pagamento.
-- Não pune automaticamente: a equipe administrativa decide após analisar o contexto.
create or replace function public.flag_possible_off_platform_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
begin
  if lower(new.body) !~ '(pix.*(fora|direto)|paga.*(por fora|direto)|transfer.{0,20}(direto|fora)|dinheiro.{0,20}(direto|fora))' then
    return new;
  end if;
  select c.order_id into v_order_id from public.conversations c where c.id = new.conversation_id;
  if v_order_id is not null then
    insert into public.trust_reports (order_id, reported_user_id, category, evidence_excerpt, source)
    values (v_order_id, new.sender_id, 'pagamento_externo', left(new.body, 500), 'automatico');
  end if;
  return new;
end;
$$;
drop trigger if exists on_message_flag_external_payment on public.messages;
create trigger on_message_flag_external_payment
  after insert on public.messages
  for each row execute function public.flag_possible_off_platform_payment();
