-- Registro auditavel de aceite de termos: guarda qual VERSAO do texto foi
-- aceita, nao so a data. profiles.terms_accepted_at/provider_terms_accepted_at
-- continuam existindo (compatibilidade com o que ja le esses campos), mas
-- esta tabela e a fonte de verdade para prova de consentimento -- registro
-- append-only, nunca sobrescrito quando o texto mudar de versao.
create table public.terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  document text not null check (document in ('cliente', 'prestador')),
  version text not null,
  accepted_at timestamptz not null default now()
);

alter table public.terms_acceptances enable row level security;

create policy "usuario ve seus proprios aceites de termos"
  on public.terms_acceptances for select
  using (profile_id = auth.uid());

create policy "usuario registra seu proprio aceite de termos"
  on public.terms_acceptances for insert
  with check (profile_id = auth.uid());

create policy "admin ve todos os aceites de termos"
  on public.terms_acceptances for select
  using (public.is_admin(auth.uid()));

notify pgrst, 'reload schema';
