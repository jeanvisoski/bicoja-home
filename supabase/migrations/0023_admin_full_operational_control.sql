-- Cobertura administrativa das entidades adicionadas após o portal inicial.
create policy "admin gerencia solicitações" on public.service_requests for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "admin gerencia propostas" on public.proposals for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "admin vê endereços" on public.addresses for select
  using (public.is_admin(auth.uid()));
create policy "admin gerencia serviços de prestador" on public.provider_services for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "admin vê fotos das solicitações" on public.request_photos for select
  using (public.is_admin(auth.uid()));
create policy "admin vê fotos dos pedidos" on public.order_photos for select
  using (public.is_admin(auth.uid()));
create policy "admin gerencia carteira" on public.wallet_transactions for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
