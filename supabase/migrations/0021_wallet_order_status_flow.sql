-- A carteira deve refletir o andamento do pedido, não depender de uma avaliação
-- opcional do cliente. Fotos finais criam "a liberar"; confirmação libera o saldo.
drop trigger if exists on_rating_release_payment on public.ratings;

create or replace function public.handle_new_rating_update_provider()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.provider_profiles
  set
    rating_count = rating_count + 1,
    rating_avg = round(((rating_avg * rating_count) + new.stars) / (rating_count + 1), 2)
  where profile_id = new.provider_id;
  return new;
end;
$$;

create trigger on_rating_update_provider
  after insert on public.ratings
  for each row execute function public.handle_new_rating_update_provider();

create or replace function public.handle_order_wallet_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'fotos_enviadas' and old.status is distinct from 'fotos_enviadas' then
    insert into public.wallet_transactions (provider_id, order_id, type, amount, status)
    select new.provider_id, new.id, 'credito_pendente', new.price, 'pendente'
    where not exists (
      select 1 from public.wallet_transactions where order_id = new.id
    );
  elsif new.status = 'concluido' and old.status is distinct from 'concluido' then
    update public.wallet_transactions
    set type = 'credito_liberado', status = 'disponivel', available_at = now()
    where order_id = new.id and status = 'pendente';

    insert into public.wallet_transactions (provider_id, order_id, type, amount, status, available_at)
    select new.provider_id, new.id, 'credito_liberado', new.price, 'disponivel', now()
    where not exists (
      select 1 from public.wallet_transactions where order_id = new.id
    );

    update public.provider_profiles
    set jobs_count = jobs_count + 1
    where profile_id = new.provider_id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_order_wallet_status on public.orders;
create trigger on_order_wallet_status
  after update of status on public.orders
  for each row execute function public.handle_order_wallet_status();

-- Recupera pedidos já concluídos e serviços que já aguardavam confirmação.
insert into public.wallet_transactions (provider_id, order_id, type, amount, status, available_at)
select o.provider_id, o.id,
  case when o.status = 'concluido' then 'credito_liberado' else 'credito_pendente' end,
  o.price,
  case when o.status = 'concluido' then 'disponivel' else 'pendente' end,
  case when o.status = 'concluido' then now() else null end
from public.orders o
where o.status in ('fotos_enviadas', 'aguardando_confirmacao', 'concluido')
  and not exists (select 1 from public.wallet_transactions w where w.order_id = o.id);
