-- Portfólio público do prestador: fotos de pedidos são privadas por padrão
-- (ficam dentro da casa do cliente). O prestador escolhe manualmente quais
-- fotos de serviços já feitos quer exibir no perfil público -- nunca expõe
-- tudo automaticamente.
alter table public.order_photos add column if not exists is_portfolio boolean not null default false;

create policy "fotos marcadas como portfólio são públicas"
  on public.order_photos for select
  using (is_portfolio = true);

-- Só o prestador do pedido pode marcar/desmarcar suas próprias fotos, e só
-- a coluna is_portfolio -- não pode reescrever kind/photo_url/order_id por
-- essa via.
create policy "prestador escolhe fotos do próprio pedido pro portfólio"
  on public.order_photos for update
  using (exists (select 1 from public.orders o where o.id = order_id and o.provider_id = auth.uid()))
  with check (exists (select 1 from public.orders o where o.id = order_id and o.provider_id = auth.uid()));

revoke update on public.order_photos from authenticated;
grant update (is_portfolio) on public.order_photos to authenticated;

notify pgrst, 'reload schema';
