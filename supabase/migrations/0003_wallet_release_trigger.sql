-- Ao cliente avaliar um pedido concluído, credita a carteira do prestador.
-- Simplificação do MVP: 50% liberado na hora, 50% marcado como pendente com
-- available_at em +24h (ainda falta um job agendado que efetivamente promova
-- esse segundo lote de 'pendente' para 'disponivel' quando o prazo vencer —
-- por enquanto o valor fica visível como "a liberar" indefinidamente).

create or replace function public.handle_rating_release_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  order_total numeric(10, 2);
  order_price numeric(10, 2);
  half numeric(10, 2);
begin
  select price into order_price from public.orders where id = new.order_id;
  half := round(order_price / 2, 2);

  insert into public.wallet_transactions (provider_id, order_id, type, amount, status, available_at)
  values
    (new.provider_id, new.order_id, 'credito_liberado', half, 'disponivel', now()),
    (new.provider_id, new.order_id, 'credito_pendente', order_price - half, 'pendente', now() + interval '24 hours');

  update public.provider_profiles
  set
    jobs_count = jobs_count + 1,
    rating_count = rating_count + 1,
    rating_avg = round(((rating_avg * rating_count) + new.stars) / (rating_count + 1), 2)
  where profile_id = new.provider_id;

  return new;
end;
$$;

create trigger on_rating_release_payment
  after insert on public.ratings
  for each row execute function public.handle_rating_release_payment();
