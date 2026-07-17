# Pagamentos do MVP

O checkout usa Mercado Pago. A integracao nao tem mensalidade obrigatoria, mas
pagamentos reais possuem as taxas comerciais do gateway. O app possui tres modos,
controlados pelo portal administrativo em **Configuracoes**:

- **Homologacao**: aprova localmente o pagamento, sem gateway e sem cobranca.
- **Sandbox**: abre o checkout de testes do Mercado Pago; use contas, Pix e cartoes
  de teste do Mercado Pago.
- **Producao**: abre o checkout real e so contrata o prestador apos a notificacao
  do Mercado Pago confirmar o pagamento.

## Publicacao inicial

1. Execute no SQL Editor a migration
   `supabase/migrations/0033_payment_gateway_configuration.sql`.
2. Crie uma aplicacao no Mercado Pago Developers e obtenha as credenciais de teste
   e de producao. Nao coloque tokens no frontend, no `.env` publico, nem no banco.
3. Com a CLI do Supabase vinculada ao projeto, cadastre os secrets:

```bash
supabase secrets set MERCADOPAGO_TEST_ACCESS_TOKEN="seu_token_de_teste"
supabase secrets set MERCADOPAGO_ACCESS_TOKEN="seu_token_de_producao"
```

4. Publique as Edge Functions:

```bash
supabase functions deploy create-mercadopago-checkout
supabase functions deploy mercadopago-webhook --no-verify-jwt
```

5. No painel administrativo, mantenha **Homologacao** para validar o fluxo atual.
   Quando quiser testar o checkout realista, escolha **Sandbox** e marque apenas
   Pix ou apenas Cartao. Para cobrar de verdade, ative **Producao**.

O webhook consulta o pagamento diretamente no Mercado Pago antes de confirmar o
pedido. Somente entao a proposta vencedora e aceita e todas as outras sao recusadas.
