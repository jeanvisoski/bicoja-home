# Prontidao para producao — BICOJA

## Antes de liberar usuarios reais

- Execute as migrations `0040_customer_protection_guarantee.sql` e `0041_operational_hardening.sql` no SQL Editor do Supabase.
- Cadastre e publique as Edge Functions de checkout, webhook e reembolso.
- Configure os secrets `MERCADOPAGO_TEST_ACCESS_TOKEN` e `MERCADOPAGO_ACCESS_TOKEN` no Supabase; nunca no frontend.
- Mantenha `Homologacao` ate concluir todos os cenarios abaixo. Depois use `Sandbox`; somente entao habilite `Producao`.
- Verifique se ha pelo menos um administrador e se os prestadores enviam documento e chave Pix antes de solicitar saque.

## Roteiro de teste ponta a ponta

1. Cliente cria pedido com endereco, contato e periodo de disponibilidade.
2. Dois prestadores elegiveis enviam propostas; cliente escolhe uma e paga.
3. Confirme que a proposta escolhida fica aceita e as demais recusadas.
4. Prestador muda o status para a caminho, executando e envia ao menos uma foto final.
5. Cliente confirma: o saldo deve aparecer como `em_garantia`, nunca como disponivel.
6. Abra uma disputa: saldo deve ficar `congelado`; no admin, teste liberar e reembolso integral.
7. Deixe vencer os prazos configurados e abra Pedidos/Carteira para validar conclusao e liberacao automatica.
8. Valide que um prestador pendente/rejeitado nao consegue sacar; aprove documento e chave Pix e repita.

## Limites do MVP que exigem configuracao externa

- Repasse automatico para o prestador requer conta marketplace/split aprovada no provedor de pagamentos. Ate isso, o admin registra e paga os saques por Pix.
- O reembolso automatico usa a transacao Mercado Pago registrada pelo checkout. A Edge Function deve estar publicada e os tokens devem estar configurados.
- Para rodar tarefas sem nenhuma visita ao app, configure um agendador externo autenticado que invoque `complete_due_orders()` e `release_due_guarantee_wallet_transactions()` a cada hora.

## Operacao e seguranca

- Revise diariamente disputas, denuncias, documentos pendentes, saques e reembolsos.
- Guarde os comprovantes de Pix no campo de referencia do saque e mantenha acesso ao Supabase restrito a administradores.
- Antes da comercializacao, submeta Termos, Privacidade, politica de cancelamento/reembolso e modelo de garantia a revisao juridica brasileira. O texto do app e operacional, nao parecer juridico.
- Configure monitoramento de erros do Worker/Cloudflare e alertas de falha de webhook no painel do Mercado Pago.
