-- Mediação de disputa mais estruturada. Hoje o cliente só tinha um campo de
-- texto livre (mín. 10 caracteres) e o admin só via "liberar" ou "reembolso
-- total" na tela (mesmo o reembolso parcial já existindo em
-- resolve_protection_dispute desde 0040, nunca foi exposto na UI). Isso
-- adiciona: categoria estruturada (facilita triagem e métricas), um SLA
-- configurável mostrado ao cliente, e expõe o reembolso parcial no admin.

alter table public.trust_reports drop constraint if exists trust_reports_category_check;
alter table public.trust_reports add constraint trust_reports_category_check
  check (category in (
    'pagamento_externo', 'conduta', 'fraude', 'outro',
    'servico_incompleto', 'servico_com_defeito', 'dano_material',
    'atraso_grave', 'cobranca_indevida'
  ));

alter table public.platform_settings
  add column if not exists dispute_response_hours integer not null default 48
    check (dispute_response_hours between 1 and 336);

-- Mesma lógica de 0040, só trocando a categoria fixa 'conduta' por um
-- parâmetro novo (com default 'outro' pra não quebrar chamadas antigas).
--
-- Importante: mudar a assinatura (5º parâmetro novo) faz o Postgres tratar
-- isso como uma função DIFERENTE em vez de substituir a antiga -- "create or
-- replace" só troca no lugar quando os tipos de parâmetro batem exatamente.
-- Sem o drop abaixo, ficariam duas versões de transition_order (4 e 5
-- argumentos) e toda chamada existente com 4 argumentos passaria a falhar
-- com "function is not unique".
drop function if exists public.transition_order(uuid, text, numeric, text);

create or replace function public.transition_order(
  p_order_id uuid,
  p_next_status text,
  p_final_price numeric default null,
  p_note text default null,
  p_dispute_category text default 'outro'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_is_provider boolean;
  v_is_client boolean;
  v_refund numeric := 0;
  v_category text;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Pedido nao encontrado.'; end if;
  v_is_provider := v_order.provider_id = auth.uid();
  v_is_client := v_order.client_id = auth.uid();
  if not v_is_provider and not v_is_client then raise exception 'Sem permissao para este pedido.'; end if;

  if p_next_status = 'a_caminho' and v_is_provider and v_order.status = 'aceito' and v_order.payment_status = 'confirmado' then
    null;
  elsif p_next_status = 'executando' and v_is_provider and v_order.status = 'a_caminho' then
    null;
  elsif p_next_status = 'fotos_enviadas' and v_is_provider and v_order.status = 'executando' then
    if p_final_price is null or p_final_price < v_order.quoted_price_min or p_final_price > v_order.quoted_price_max then
      raise exception 'Valor final fora da faixa aprovada.';
    end if;
    if not exists (select 1 from public.order_photos where order_id = v_order.id and kind = 'depois') then
      raise exception 'Envie ao menos uma foto final antes de concluir.';
    end if;
    v_refund := greatest(v_order.price - p_final_price, 0);
  elsif p_next_status = 'concluido' and v_is_client and v_order.status in ('fotos_enviadas', 'aguardando_confirmacao') then
    if not exists (select 1 from public.order_photos where order_id = v_order.id and kind = 'depois') then
      raise exception 'Nao ha fotos finais para confirmar.';
    end if;
  elsif p_next_status = 'em_disputa' and v_is_client and (v_order.status in ('aceito', 'a_caminho', 'executando', 'fotos_enviadas', 'aguardando_confirmacao') or (v_order.status = 'concluido' and v_order.guarantee_until > now())) then
    if coalesce(length(trim(p_note)), 0) < 10 then raise exception 'Descreva o problema com pelo menos 10 caracteres.'; end if;
    v_category := case
      when p_dispute_category in (
        'pagamento_externo', 'conduta', 'fraude', 'outro', 'servico_incompleto',
        'servico_com_defeito', 'dano_material', 'atraso_grave', 'cobranca_indevida'
      ) then p_dispute_category
      else 'outro'
    end;
    insert into public.trust_reports (order_id, reporter_id, reported_user_id, category, description, source)
    values (v_order.id, auth.uid(), v_order.provider_id, v_category, trim(p_note), 'manual');
  elsif p_next_status = 'cancelado' and v_is_client and v_order.status = 'aguardando_pagamento' then
    null;
  else
    raise exception 'Transicao de status nao permitida.';
  end if;

  update public.orders set
    status = p_next_status,
    final_price = coalesce(p_final_price, final_price),
    refund_due = case when p_next_status = 'fotos_enviadas' then v_refund else refund_due end,
    refund_status = case when p_next_status = 'fotos_enviadas' and v_refund > 0 then 'pendente' else refund_status end,
    completed_at = case when p_next_status = 'concluido' then now() else completed_at end,
    final_amount_approved_at = case when p_next_status = 'concluido' then now() else final_amount_approved_at end,
    cancellation_reason = case when p_next_status = 'cancelado' then p_note else cancellation_reason end
  where id = v_order.id;

  insert into public.order_status_events (order_id, status, note)
  values (v_order.id, p_next_status, nullif(trim(coalesce(p_note, '')), ''));
  return v_order.id;
end;
$$;

notify pgrst, 'reload schema';
