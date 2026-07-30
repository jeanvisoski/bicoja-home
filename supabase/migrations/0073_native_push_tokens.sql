-- Tokens de push nativo (Firebase Cloud Messaging), separados de
-- push_subscriptions (Web Push/VAPID). Web Push não é confiável pra entrega
-- em segundo plano dentro do app empacotado pela Play Store -- é por isso
-- que a notificação "parou de funcionar" depois de gerar o .aab: o app
-- sempre dependeu só de Web Push, que funciona bem no navegador/PWA mas não
-- dentro do WebView nativo. Esta tabela guarda o token do dispositivo
-- registrado via @capacitor/push-notifications, que o send-push usa pra
-- mandar pela FCM de verdade.
create table public.native_push_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('android', 'ios')),
  token text not null unique,
  created_at timestamptz not null default now()
);

alter table public.native_push_tokens enable row level security;

create policy "dono gerencia os proprios tokens de push nativo"
  on public.native_push_tokens for all
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

-- A Edge Function send-push roda com a service role, mesma justificativa de
-- push_subscriptions em 0058 -- não precisa de policy adicional pra ela.

notify pgrst, 'reload schema';
