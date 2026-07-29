# Modelo financeiro do piloto BicoJá

## Decisão atual

No piloto, o BicoJá recebe o pagamento pelo Checkout Pro do Mercado Pago e controla o valor do prestador na carteira interna. O repasse ao prestador é feito por Pix **manual**, pela equipe administrativa, depois do período de garantia configurado no portal.

Não há Split de Pagamentos ativo nesta fase e o Mercado Pago não transfere automaticamente valores para os prestadores.

## Jornada do dinheiro

1. O cliente paga dentro do aplicativo; o pedido só avança após a confirmação de pagamento.
2. Quando o serviço é concluído, a remuneração do prestador entra como `em garantia`.
3. Durante o prazo de garantia, o cliente pode abrir uma disputa e a equipe pode reembolsar ou congelar o saldo.
4. Ao terminar a garantia sem bloqueio, o crédito fica disponível para saque.
5. O prestador solicita o saque com uma chave Pix previamente validada.
6. Um administrador aprova, realiza o Pix fora da plataforma e registra a observação e o ID E2E/comprovante antes de marcar como pago.

## Rotina operacional obrigatória

- Nunca pagar solicitações de sandbox, homologação ou pedidos sem pagamento real confirmado.
- Conferir prestador, valor, chave Pix validada e eventuais disputas antes da aprovação.
- Registrar uma observação em qualquer decisão de saque.
- Para pagamentos, registrar o identificador Pix E2E ou identificador do comprovante.
- Usar a tela de Pedidos para reembolso de pagamentos reais; não "estornar" a carteira como atalho para um reembolso ao cliente.
- Manter a conta de recebimento do Mercado Pago separada da conta operacional de Pix e conciliar os valores diariamente.

## Limites do piloto

O painel registra o repasse, mas não envia Pix automaticamente. Por isso, o crescimento deve acompanhar uma rotina financeira diária, conciliação e controle de comprovantes. Antes de aumentar volume ou ampliar regiões, definir responsáveis, prazo de revisão e uma reserva de caixa para reembolsos.

## Evolução posterior: Mercado Pago Split

O Split 1:1 deve ser considerado após validar demanda, disputas e operação do piloto. Ele exigirá que cada prestador conecte sua conta Mercado Pago via OAuth e esteja elegível para receber. Nessa migração, é necessário redesenhar a garantia: uma vez que a parcela do prestador é transferida automaticamente, um reembolso pode depender do saldo dele e não oferece a mesma retenção operacional que existe hoje.

Até essa decisão, a configuração OAuth do aplicativo Mercado Pago deve permanecer sem URL de redirecionamento de produção e sem ser apresentada aos prestadores.
