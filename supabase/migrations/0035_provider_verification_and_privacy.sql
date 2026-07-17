-- Documentos privados para verificacao manual de prestadores.
insert into storage.buckets (id, name, public)
values ('provider-documents', 'provider-documents', false)
on conflict (id) do nothing;

create table if not exists public.provider_verification_documents (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles(profile_id) on delete cascade,
  document_type text not null check (document_type in ('identidade', 'comprovante_endereco', 'certificado', 'outro')),
  storage_path text not null,
  status text not null default 'enviado' check (status in ('enviado', 'aprovado', 'rejeitado')),
  admin_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
alter table public.provider_verification_documents enable row level security;
create policy "prestador envia e ve os proprios documentos" on public.provider_verification_documents for select to authenticated using (provider_id = auth.uid());
create policy "prestador envia documentos" on public.provider_verification_documents for insert to authenticated with check (provider_id = auth.uid());
create policy "admin gerencia documentos de verificacao" on public.provider_verification_documents for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy "prestador envia arquivo proprio de verificacao" on storage.objects for insert to authenticated
  with check (bucket_id = 'provider-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "prestador le arquivo proprio de verificacao" on storage.objects for select to authenticated
  using (bucket_id = 'provider-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "admin le documentos privados" on storage.objects for select to authenticated
  using (bucket_id = 'provider-documents' and public.is_admin(auth.uid()));

-- O proprio prestador nunca pode se autoaprovar ou remover uma suspensao por API.
create or replace function public.protect_provider_review_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) and (
    new.verification_status is distinct from old.verification_status
    or new.is_suspended is distinct from old.is_suspended
  ) then
    raise exception 'Somente a equipe BICOJA pode alterar a verificacao ou suspensao.';
  end if;
  return new;
end;
$$;
drop trigger if exists on_protect_provider_review_fields on public.provider_profiles;
create trigger on_protect_provider_review_fields before update on public.provider_profiles
  for each row execute function public.protect_provider_review_fields();

notify pgrst, 'reload schema';
