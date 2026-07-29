-- Testa a válvula de acréscimo de valor (0070_order_extra_charges.sql) e o
-- travamento de preço final (0034/0040 transition_order) que motivou ela --
-- são as duas regras que mais afetam o dinheiro real de cada pedido.
--
-- Rodar: supabase test db  (precisa do Docker Desktop rodando)
--
-- Simula o usuário logado via request.jwt.claims, que é como auth.uid()
-- resolve de verdade em produção (via PostgREST). Se este arquivo falhar
-- logo no set_auth abaixo, o mais provável é a versão local do Postgres
-- definir auth.uid() de um jeito ligeiramente diferente -- confirmar com
-- `select auth.uid()` depois de rodar o set_config manualmente.
begin;
select plan(10);

create schema if not exists tests;

create or replace function tests.set_auth(p_user_id uuid) returns void as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$ language plpgsql;

create or replace function tests.clear_auth() returns void as $$
begin
  perform set_config('request.jwt.claims', '', true);
  reset role;
end;
$$ language plpgsql;

-- Fixture: um cliente e um prestador reais (o trigger 0002 cria os profiles
-- automaticamente a partir do insert em auth.users).
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'cliente.teste@bicoja.test', crypt('senha-teste', gen_salt('bf')),
   now(), now(), now(), '{}', '{}'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'prestador.teste@bicoja.test', crypt('senha-teste', gen_salt('bf')),
   now(), now(), now(), '{}', '{}');

insert into public.provider_profiles (profile_id, verification_status)
values ('22222222-2222-2222-2222-222222222222', 'verificado');

insert into public.addresses (id, profile_id, street, city)
values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Rua Teste, 123', 'Sao Paulo');

insert into public.service_requests (id, client_id, category_id, description, address_id, urgency, status)
select '44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111',
       id, 'Vazamento na cozinha', '33333333-3333-3333-3333-333333333333', 'hoje', 'aberto'
from public.service_categories where slug = 'encanador';

-- Orçamento fechado de R$300 -- sem faixa, sem margem nenhuma pra reajuste.
insert into public.proposals (id, request_id, provider_id, price, pricing_type, price_min, price_max, status)
values ('55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444',
        '22222222-2222-2222-2222-222222222222', 300, 'fixed', 300, 300, 'pendente');

select tests.set_auth('11111111-1111-1111-1111-111111111111');
select public.create_checkout_order('55555555-5555-5555-5555-555555555555') as order_id \gset
select public.confirm_order_payment(:'order_id') as _ \gset

select is(
  (select status from public.orders where id = :'order_id'),
  'aceito',
  'checkout + confirmação simulada deixam o pedido aceito'
);

-- Prestador avança o pedido até "executando".
select tests.set_auth('22222222-2222-2222-2222-222222222222');
select public.transition_order(:'order_id', 'a_caminho') as _ \gset
select public.transition_order(:'order_id', 'executando') as _ \gset

select is(
  (select status from public.orders where id = :'order_id'),
  'executando',
  'prestador avança o pedido pra executando'
);

-- Orçamento fechado: pedir acréscimo tem que funcionar (é exatamente o caso
-- que faltava antes da 0070 -- sem isso não havia como cobrar a mais).
select lives_ok(
  $$select public.request_order_extra_charge('44444444-4444-4444-4444-444444444444'::uuid, 50, 'Precisou de mais 2 metros de cano.')$$,
  'prestador consegue solicitar acréscimo com pedido em execução'
);

select throws_ok(
  $$select public.request_order_extra_charge('44444444-4444-4444-4444-444444444444'::uuid, 50, 'motivo curto')$$,
  'Ja existe um acrescimo em aberto para este pedido.',
  'não deixa abrir um segundo acréscimo enquanto o primeiro está pendente'
);

-- Guarda de valor e motivo (usando o pedido de outra fixture seria mais
-- isolado, mas o guard de "já existe em aberto" acima já bloqueia repetição
-- no mesmo pedido -- então testamos os guards de entrada isoladamente numa
-- solicitação nova).
insert into public.service_requests (id, client_id, category_id, description, address_id, urgency, status)
select '66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111',
       id, 'Outro serviço', '33333333-3333-3333-3333-333333333333', 'hoje', 'aberto'
from public.service_categories where slug = 'encanador';
insert into public.proposals (id, request_id, provider_id, price, pricing_type, price_min, price_max, status)
values ('77777777-7777-7777-7777-777777777777', '66666666-6666-6666-6666-666666666666',
        '22222222-2222-2222-2222-222222222222', 300, 'fixed', 300, 300, 'pendente');
select tests.set_auth('11111111-1111-1111-1111-111111111111');
select public.create_checkout_order('77777777-7777-7777-7777-777777777777') as order_id2 \gset
select public.confirm_order_payment(:'order_id2') as _ \gset
select tests.set_auth('22222222-2222-2222-2222-222222222222');
select public.transition_order(:'order_id2', 'a_caminho') as _ \gset
select public.transition_order(:'order_id2', 'executando') as _ \gset

select throws_ok(
  $$select public.request_order_extra_charge('66666666-6666-6666-6666-666666666666'::uuid, 0, 'valor invalido aqui')$$,
  'Informe um valor valido para o acrescimo.',
  'rejeita acréscimo com valor zero/negativo'
);

select throws_ok(
  $$select public.request_order_extra_charge('66666666-6666-6666-6666-666666666666'::uuid, 50, 'curto')$$,
  'Explique o motivo do acrescimo com pelo menos 10 caracteres.',
  'rejeita motivo com menos de 10 caracteres'
);

-- Confirma que a taxa do acréscimo usa a mesma faixa degressiva do checkout
-- normal (R$50 fica inteiro na 1ª faixa -> 10% -> R$5).
select public.request_order_extra_charge('66666666-6666-6666-6666-666666666666'::uuid, 50, 'Precisou de mais material.') as charge_id \gset
select is(
  (select platform_fee from public.order_extra_charges where id = :'charge_id'),
  5.00::numeric,
  'acréscimo de R$50 usa a mesma faixa de 10% do checkout normal'
);

-- Cliente recusa -- prestador não pode responder o próprio pedido de novo.
select tests.set_auth('11111111-1111-1111-1111-111111111111');
select public.respond_order_extra_charge(:'charge_id', false, 'não concordo com o valor') as _ \gset
select is(
  (select status from public.order_extra_charges where id = :'charge_id'),
  'recusado',
  'cliente recusa o acréscimo'
);

select throws_ok(
  $$select public.respond_order_extra_charge(:'charge_id', true, null)$$,
  'Este acrescimo ja foi respondido.',
  'não deixa responder de novo um acréscimo já decidido'
);

-- transition_order continua travando o valor final fora da faixa aceita
-- (orçamento fechado = sem margem nenhuma) -- é a regra que a válvula de
-- acréscimo existe pra contornar de um jeito legítimo, não pra remover.
select tests.set_auth('22222222-2222-2222-2222-222222222222');
select throws_ok(
  $$select public.transition_order(:'order_id2', 'fotos_enviadas', 350, 'tentando cobrar direto, sem passar pelo acréscimo')$$,
  'Valor final fora da faixa aprovada.',
  'transition_order continua rejeitando valor final fora da faixa mesmo com acréscimo existindo em paralelo'
);

select * from finish();
rollback;
