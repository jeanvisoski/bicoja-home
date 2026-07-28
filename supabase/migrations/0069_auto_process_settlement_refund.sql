-- Orçamento em faixa (ex.: R$ 100 a R$ 400): o cliente é cobrado o teto no
-- checkout, o prestador informa o valor real ao concluir, e o sistema já
-- calculava a diferença como reembolso devido -- mas nada processava esse
-- reembolso de fato: ficava "pendente" até um admin entrar no painel e
-- apertar manualmente. Isso vira gargalo em toda faixa de preço, que é a
-- regra pra esse tipo de serviço, não a exceção.
--
-- Dispara a Edge Function process-order-refund quando o cliente confirma a
-- conclusão do pedido (mesmo padrão de pg_net já usado pra push
-- notifications em 0059) -- processa o reembolso automaticamente no
-- Mercado Pago assim que o valor final é aprovado. Se falhar (API fora do
-- ar, etc.), refund_status continua "pendente" e o botão manual do admin
-- (Pedidos > Reembolsar) segue funcionando como reserva.
create or replace function public.process_order_settlement_refund()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'concluido'
    and old.status is distinct from new.status
    and new.refund_status = 'pendente'
    and coalesce(new.refund_due, 0) > 0
  then
    perform net.http_post(
      url := 'https://opuzucjcnepjqoackxsy.supabase.co/functions/v1/process-order-refund',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object('record', to_jsonb(new))
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_order_completed_process_refund on public.orders;
create trigger on_order_completed_process_refund
  after update on public.orders
  for each row execute function public.process_order_settlement_refund();

notify pgrst, 'reload schema';
