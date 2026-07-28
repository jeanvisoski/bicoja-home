-- admin_refund_order já cobre o caso de reembolso "de verdade" (com estorno
-- no Mercado Pago), mas ele se recusa a mexer numa movimentação que já
-- passou de 'em_garantia' pra 'disponivel' -- proposital pra dinheiro real,
-- mas isso deixa o admin sem saída quando o saldo é de um pedido de TESTE
-- (homologação/sandbox) que nunca vai ter dinheiro real por trás. Esta
-- função dá ao admin um jeito de zerar/estornar qualquer movimentação da
-- carteira manualmente, com motivo obrigatório e trilha de auditoria,
-- exceto o que já foi efetivamente pago (isso não se desfaz por aqui).
create or replace function public.admin_void_wallet_transaction(
  p_wallet_transaction_id uuid,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.wallet_transactions%rowtype;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Operacao administrativa.'; end if;
  if coalesce(length(trim(p_note)), 0) < 10 then
    raise exception 'Descreva o motivo do estorno com pelo menos 10 caracteres.';
  end if;

  select * into v_wallet from public.wallet_transactions where id = p_wallet_transaction_id for update;
  if not found then raise exception 'Movimentação não encontrada.'; end if;
  if v_wallet.status in ('pago', 'reembolsado') then
    raise exception 'Esta movimentação já está paga ou estornada e não pode ser alterada por aqui.';
  end if;

  update public.wallet_transactions set status = 'reembolsado' where id = p_wallet_transaction_id;

  perform public.record_operational_audit(
    'wallet_transaction',
    p_wallet_transaction_id,
    'admin_void',
    jsonb_build_object(
      'note', p_note,
      'previous_status', v_wallet.status,
      'amount', v_wallet.amount,
      'provider_id', v_wallet.provider_id,
      'order_id', v_wallet.order_id
    )
  );
end;
$$;

grant execute on function public.admin_void_wallet_transaction(uuid, text) to authenticated;

notify pgrst, 'reload schema';
