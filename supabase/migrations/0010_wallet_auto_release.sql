-- Libera automaticamente wallet_transactions que estão 'pendente' e já
-- passaram do available_at (ex.: os 50% que ficam presos por 24h depois da
-- avaliação — trigger em 0003 cria esse registro mas nada promovia sozinho).

create extension if not exists pg_cron with schema cron;

create or replace function public.release_pending_wallet_transactions()
returns void
language sql
security definer
set search_path = public
as $$
  update public.wallet_transactions
  set status = 'disponivel'
  where status = 'pendente' and available_at is not null and available_at <= now();
$$;

do $$
begin
  perform cron.unschedule('release-wallet-transactions');
exception when others then
  null;
end $$;

select cron.schedule(
  'release-wallet-transactions',
  '0 * * * *',
  $$select public.release_pending_wallet_transactions();$$
);
