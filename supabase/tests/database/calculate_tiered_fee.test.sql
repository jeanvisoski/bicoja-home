-- Testa a matemática da taxa degressiva (0061_tiered_platform_fee.sql) --
-- é o cálculo de dinheiro mais repetido do app (roda em todo checkout e em
-- todo acréscimo de valor), então é o teste de maior valor por linha escrita.
--
-- Rodar: supabase test db  (precisa do Docker Desktop rodando)
begin;
select plan(9);

-- Dentro da primeira faixa (0-300 @ 10%).
select is(
  public.calculate_tiered_fee(200),
  20.00::numeric,
  'R$200 fica inteiro na faixa de 10% -> taxa R$20'
);

-- Exatamente na borda entre a 1ª e a 2ª faixa.
select is(
  public.calculate_tiered_fee(300),
  30.00::numeric,
  'R$300 (borda) cobra só a 1ª faixa -> taxa R$30'
);

-- Cruza duas faixas (0-300 @ 10% + 300-1000 @ 8%).
select is(
  public.calculate_tiered_fee(500),
  round(300 * 0.10 + 200 * 0.08, 2),
  'R$500 cruza a 1ª e a 2ª faixa'
);

-- Caso de referência documentado na própria migration 0061: R$2.900 deve
-- cair de R$296 (8% linear) para R$200 com as faixas degressivas.
select is(
  public.calculate_tiered_fee(2900),
  200.00::numeric,
  'R$2.900 -> R$200 de taxa (caso de referência da migration 0061)'
);

-- Exatamente na borda entre a 3ª e a 4ª faixa (última tem max_amount null).
select is(
  public.calculate_tiered_fee(3000),
  round(300 * 0.10 + 700 * 0.08 + 2000 * 0.06, 2),
  'R$3.000 (borda) não entra na última faixa (4%)'
);

-- Acima da borda: agora sim entra na última faixa (sem teto).
select is(
  public.calculate_tiered_fee(3100),
  round(300 * 0.10 + 700 * 0.08 + 2000 * 0.06 + 100 * 0.04, 2),
  'R$3.100 usa as 4 faixas, incluindo a parte sem teto'
);

-- Valores inválidos retornam 0, nunca erro nem negativo.
select is(public.calculate_tiered_fee(0), 0::numeric, 'valor zero -> taxa zero');
select is(public.calculate_tiered_fee(-50), 0::numeric, 'valor negativo -> taxa zero (não quebra)');
select is(public.calculate_tiered_fee(null), 0::numeric, 'valor nulo -> taxa zero (não quebra)');

select * from finish();
rollback;
