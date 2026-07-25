-- Assinaturas de push do navegador/PWA. Cada dispositivo em que o usuário
-- ativa notificações gera uma assinatura própria (endpoint único do
-- navegador) -- por isso a chave é o endpoint, não o profile_id: a mesma
-- conta pode ter várias assinaturas (celular, desktop etc).
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "dono gerencia as próprias assinaturas de push"
  on public.push_subscriptions for all
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

-- A Edge Function send-push roda com a service role (chamada pelo Database
-- Webhook desta tabela), então não precisa de policy adicional pra ela.

notify pgrst, 'reload schema';
