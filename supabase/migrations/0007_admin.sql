-- Suporte a um portal admin separado (bicoja-admin), mesmo projeto Supabase.
-- Admin é sinalizado por profiles.is_admin — não existe cadastro de admin
-- pela UI, precisa ser setado manualmente no banco (update direto no Supabase
-- Studio) pra primeira conta.

alter table public.profiles add column is_admin boolean not null default false;

-- Helper pra não repetir o subselect em toda policy.
create or replace function public.is_admin(p_uid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = p_uid), false);
$$;

create policy "admin vê todas as solicitações"
  on public.service_requests for select
  using (public.is_admin(auth.uid()));

create policy "admin vê todos os pedidos"
  on public.orders for select
  using (public.is_admin(auth.uid()));

create policy "admin atualiza pedidos (mediação de disputa)"
  on public.orders for update
  using (public.is_admin(auth.uid()));

create policy "admin vê todos os eventos de status"
  on public.order_status_events for select
  using (public.is_admin(auth.uid()));

create policy "admin registra eventos de status (mediação)"
  on public.order_status_events for insert
  with check (public.is_admin(auth.uid()));

create policy "admin vê todas as carteiras"
  on public.wallet_transactions for select
  using (public.is_admin(auth.uid()));

create policy "admin aprova/rejeita prestadores"
  on public.provider_profiles for update
  using (public.is_admin(auth.uid()));
