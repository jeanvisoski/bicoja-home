# Teste no Android e deploy gratuito

## Para testar agora

O BICOJA e uma PWA: nao e necessario gerar APK nesta fase. Depois de publicado
em HTTPS, abra a URL no Chrome do Android e use **Adicionar a tela inicial**.
Ele aparece como BICOJA no celular e abre em tela cheia, como app.

O painel administrativo continua sendo web e deve ser aberto no navegador do
computador ou celular por uma URL separada.

## Hospedagem recomendada

- **App BICOJA**: Cloudflare Workers, pois este projeto tem SSR Nitro.
- **Admin BICOJA**: Cloudflare Pages, pois e um Vite estatico.
- **Banco, autenticao, fotos e Edge Functions**: Supabase.

Cloudflare possui integracao direta com GitHub: cada push na `main` gera build e
deploy automaticamente. A integracao oficial tambem cria previews para pull
requests.

## Repositorios e pipeline

Mantenha dois repositorios privados no GitHub:

1. `bicoja-home` para o app principal.
2. `bicoja-admin` para o portal administrativo.

Os dois projetos ja possuem workflow em `.github/workflows/ci.yml`, que executa
o build em todo push e pull request. No Cloudflare, conecte cada repositorio em
Workers & Pages para o deploy automatico.

### App principal

- Build command: `npm ci && npm run build`
- Deploy command: `npx nitro deploy --prebuilt`
- Variaveis de build: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`

### Portal admin

- Build command: `npm ci && npm run build`
- Output directory: `dist`
- Variaveis de build: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`

Antes do primeiro teste remoto, aplique todas as migrations pendentes no Supabase
e publique as Edge Functions de pagamento. Para novas fotos, aplique tambem
`0037_bicoja_storage_branding.sql`.

## APK nativo

Um APK nao exige hospedagem apenas se o telefone conseguir acessar o backend e
voce aceitar um build preso ao conteudo web empacotado. Para autenticacao,
mensagens, banco, mapas e pagamento, o app ainda precisa da internet e do
Supabase. Por isso, a PWA hospedada e a opcao mais rapida para voces testarem.

Quando a UX estiver validada, o mesmo front pode receber Capacitor para gerar
APK/AAB e publicar na Play Store.
