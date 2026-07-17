-- Saques operacionais: o saldo e reservado antes do pagamento e so volta a
-- ficar disponivel se a equipe rejeitar a solicitacao.
alter table public.wallet_transactions drop constraint if exists wallet_transactions_status_check;
alter table public.wallet_transactions add constraint wallet_transactions_status_check
  check (status in ('pendente', 'disponivel', 'reservado', 'pago'));

create table if not exists public.provider_payout_destinations (
  provider_id uuid primary key references public.provider_profiles(profile_id) on delete cascade,
  method text not null default 'pix' check (method in ('pix')),
  pix_key text not null,
  pix_key_type text not null check (pix_key_type in ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria')),
  holder_name text not null,
  status text not null default 'pendente' check (status in ('pendente', 'verificado', 'desativado')),
  admin_note text,
  updated_at timestamptz not null default now()
);
alter table public.provider_payout_destinations enable row level security;
create policy "prestador gerencia proprio destino de saque" on public.provider_payout_destinations for all to authenticated
  using (provider_id = auth.uid()) with check (provider_id = auth.uid());
create policy "admin gerencia destinos de saque" on public.provider_payout_destinations for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create or replace function public.protect_payout_destination_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then
    if new.pix_key is distinct from old.pix_key or new.pix_key_type is distinct from old.pix_key_type or new.holder_name is distinct from old.holder_name then
      new.status := 'pendente';
      new.admin_note := null;
    elsif new.status is distinct from old.status then
      raise exception 'Somente a equipe pode validar a chave Pix.';
    end if;
  end if;
  return new;
end;
$$;
create trigger on_protect_payout_destination_status before update on public.provider_payout_destinations
  for each row execute function public.protect_payout_destination_status();

create or replace function public.force_new_payout_destination_pending()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then new.status := 'pendente'; end if;
  return new;
end;
$$;
create trigger on_force_new_payout_destination_pending before insert on public.provider_payout_destinations
  for each row execute function public.force_new_payout_destination_pending();

create table if not exists public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles(profile_id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  destination_snapshot jsonb not null,
  status text not null default 'solicitado' check (status in ('solicitado', 'aprovado', 'pago', 'rejeitado', 'falhou')),
  admin_note text,
  payment_reference text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  paid_at timestamptz
);
alter table public.payout_requests enable row level security;
create policy "prestador ve proprios saques" on public.payout_requests for select to authenticated using (provider_id = auth.uid());
create policy "admin gerencia saques" on public.payout_requests for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create or replace function public.request_provider_payout()
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_destination public.provider_payout_destinations%rowtype;
  v_amount numeric;
  v_request_id uuid;
begin
  select * into v_destination from public.provider_payout_destinations where provider_id = auth.uid() for update;
  if not found or v_destination.status <> 'verificado' then
    raise exception 'Cadastre uma chave Pix validada pela equipe antes de solicitar saque.';
  end if;
  if exists (select 1 from public.payout_requests where provider_id = auth.uid() and status in ('solicitado', 'aprovado')) then
    raise exception 'Ja existe uma solicitacao de saque em analise.';
  end if;
  perform 1 from public.wallet_transactions
    where provider_id = auth.uid() and status = 'disponivel' for update;
  select coalesce(sum(amount), 0) into v_amount from public.wallet_transactions
    where provider_id = auth.uid() and status = 'disponivel';
  if v_amount <= 0 then raise exception 'Nao ha saldo disponivel para saque.'; end if;

  update public.wallet_transactions set status = 'reservado'
    where provider_id = auth.uid() and status = 'disponivel';
  insert into public.payout_requests (provider_id, amount, destination_snapshot)
  values (auth.uid(), v_amount, jsonb_build_object('method', v_destination.method, 'pix_key', v_destination.pix_key, 'pix_key_type', v_destination.pix_key_type, 'holder_name', v_destination.holder_name))
  returning id into v_request_id;
  return v_request_id;
end;
$$;
grant execute on function public.request_provider_payout() to authenticated;

create or replace function public.review_payout_request(p_request_id uuid, p_status text, p_note text default null, p_reference text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_request public.payout_requests%rowtype;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Operacao administrativa.'; end if;
  select * into v_request from public.payout_requests where id = p_request_id for update;
  if not found then raise exception 'Saque nao encontrado.'; end if;
  if p_status not in ('aprovado', 'pago', 'rejeitado', 'falhou') then raise exception 'Status de saque invalido.'; end if;
  if v_request.status not in ('solicitado', 'aprovado') then raise exception 'Este saque ja foi encerrado.'; end if;

  if p_status in ('rejeitado', 'falhou') then
    update public.wallet_transactions set status = 'disponivel' where provider_id = v_request.provider_id and status = 'reservado';
  elsif p_status = 'pago' then
    update public.wallet_transactions set status = 'pago' where provider_id = v_request.provider_id and status = 'reservado';
  end if;
  update public.payout_requests set status = p_status, admin_note = p_note, payment_reference = p_reference,
    reviewed_at = now(), paid_at = case when p_status = 'pago' then now() else paid_at end
  where id = v_request.id;
  return v_request.id;
end;
$$;
grant execute on function public.review_payout_request(uuid, text, text, text) to authenticated;

notify pgrst, 'reload schema';
