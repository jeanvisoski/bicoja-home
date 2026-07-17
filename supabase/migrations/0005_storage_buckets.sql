-- Bucket público para fotos de solicitações e de execução de pedidos.
-- Público pra leitura (as fotos aparecem nas telas do cliente/prestador sem
-- precisar de signed URL); upload restrito ao dono da pasta (primeiro
-- segmento do path = auth.uid()).

insert into storage.buckets (id, name, public)
values ('confia-photos', 'confia-photos', true)
on conflict (id) do nothing;

create policy "leitura pública das fotos da BICOJÁ"
  on storage.objects for select
  using (bucket_id = 'confia-photos');

create policy "usuário autenticado sobe fotos na própria pasta"
  on storage.objects for insert
  with check (
    bucket_id = 'confia-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
