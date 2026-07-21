create table if not exists public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text not null default 'site_institucional',
  created_at timestamptz not null default now(),
  constraint waitlist_signups_email_unique unique (email),
  constraint waitlist_signups_email_format check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);
alter table public.waitlist_signups enable row level security;
create policy "admin le lista de espera" on public.waitlist_signups for select using (public.is_admin(auth.uid()));
notify pgrst, 'reload schema';
