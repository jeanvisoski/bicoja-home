-- Agendamento de horário real (além da urgência) + flag de desativação de
-- conta pra dar ao admin controle de usuários (soft delete, já que apagar
-- auth.users direto exige service_role/admin API).

alter table public.service_requests add column scheduled_at timestamptz;
alter table public.profiles add column is_active boolean not null default true;

-- Admin edita qualquer profile (nome, telefone, is_provider, is_active — o
-- trigger protect_is_admin_column de 0008 continua travando is_admin à parte).
create policy "admin edita qualquer profile"
  on public.profiles for update
  using (public.is_admin(auth.uid()));

-- Admin gerencia categorias (só existia leitura pública em 0001).
create policy "admin gerencia categorias"
  on public.service_categories for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
