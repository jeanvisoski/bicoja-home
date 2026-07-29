-- O repasse do piloto e manual, mas cada decisao precisa ser rastreavel.
-- Esta camada impede que um saque seja marcado como pago sem evidencias
-- operacionais e registra quem tomou a decisao.

alter table public.payout_requests
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;

create or replace function public.review_payout_request(
  p_request_id uuid,
  p_status text,
  p_note text default null,
  p_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.payout_requests%rowtype;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_reference text := nullif(trim(coalesce(p_reference, '')), '');
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Operacao administrativa.';
  end if;

  select * into v_request
  from public.payout_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Saque nao encontrado.';
  end if;

  if v_request.status = 'solicitado' and p_status not in ('aprovado', 'rejeitado', 'falhou') then
    raise exception 'A solicitacao precisa ser aprovada ou recusada antes do pagamento.';
  end if;
  if v_request.status = 'aprovado' and p_status not in ('pago', 'rejeitado', 'falhou') then
    raise exception 'Aprovacao ja registrada. Informe o pagamento ou a falha.';
  end if;
  if v_request.status not in ('solicitado', 'aprovado') then
    raise exception 'Este saque ja foi encerrado.';
  end if;

  if coalesce(length(v_note), 0) < 10 then
    raise exception 'Registre uma observacao com pelo menos 10 caracteres.';
  end if;
  if p_status = 'pago' and coalesce(length(v_reference), 0) < 6 then
    raise exception 'Informe o identificador da transferencia Pix ou comprovante.';
  end if;

  if p_status in ('rejeitado', 'falhou') then
    update public.wallet_transactions
      set status = 'disponivel'
      where provider_id = v_request.provider_id and status = 'reservado';
  elsif p_status = 'pago' then
    update public.wallet_transactions
      set status = 'pago'
      where provider_id = v_request.provider_id and status = 'reservado';
  end if;

  update public.payout_requests
  set
    status = p_status,
    admin_note = v_note,
    payment_reference = case when p_status = 'pago' then v_reference else payment_reference end,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    paid_at = case when p_status = 'pago' then now() else paid_at end
  where id = v_request.id;

  perform public.record_operational_audit(
    'payout_request',
    v_request.id,
    concat('payout_', p_status),
    jsonb_build_object(
      'provider_id', v_request.provider_id,
      'amount', v_request.amount,
      'note', v_note,
      'payment_reference', case when p_status = 'pago' then v_reference else null end
    )
  );

  return v_request.id;
end;
$$;

grant execute on function public.review_payout_request(uuid, text, text, text) to authenticated;

notify pgrst, 'reload schema';
