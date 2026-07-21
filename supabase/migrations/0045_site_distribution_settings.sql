-- Configura os links oficiais que o site institucional pode publicar.
alter table public.platform_settings
  add column if not exists app_store_url text,
  add column if not exists google_play_url text;

comment on column public.platform_settings.app_store_url is 'Link publico do aplicativo na Apple App Store.';
comment on column public.platform_settings.google_play_url is 'Link publico do aplicativo na Google Play Store.';
