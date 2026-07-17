# Deploy — BICOJÁ (web)

## Por que Cloudflare

O template do Lovable (`@lovable.dev/vite-tanstack-config`) já vem configurado com o
preset Nitro `cloudflare-module` (ver `vite.config.ts` e a saída de `npm run build`,
que gera `.output/server/wrangler.json`). `npm run build` já foi testado nesta sessão
e completa sem erros — é só publicar.

Free tier da Cloudflare cobre bem um MVP: Workers free (100k requisições/dia) +
domínio `*.workers.dev` grátis, sem cartão de crédito.

## Ponto crítico: variáveis de ambiente são de build, não de runtime

`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (ver `.env.example`) são lidas via
`import.meta.env` e o Vite as substitui pelo valor literal **no momento do build** —
não adianta configurar variável de ambiente só no Worker depois de publicado, ela
precisa estar presente quando `npm run build` roda.

## Opção recomendada: Cloudflare Workers Builds (deploy automático a cada push)

1. Criar conta gratuita em https://dash.cloudflare.com (ação do Jean — não posso
   criar conta por você).
2. No dashboard: Workers & Pages → Create → conectar o repositório GitHub
   `jeanvisoski/bicoja-home`.
3. Configurar o build:
   - Build command: `npm install && npm run build`
   - Deploy command: `npx wrangler deploy`
   - Root directory: `/`
4. Em Settings → Environment Variables (Production e Preview), adicionar:
   - `VITE_SUPABASE_URL` = `https://opuzucjcnepjqoackxsy.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = a publishable key
5. Cada push na branch conectada (a que o Lovable sincroniza) publica sozinho.

## Alternativa: deploy manual via CLI (um clique, sem CI)

Requer autenticar o Wrangler nesta máquina antes (uma vez só):

```
npx wrangler login
```

Isso abre o navegador para login na Cloudflare — é uma ação sua, eu não tenho como
fazer esse OAuth por você. Depois de autenticado, com `.env.local` preenchido:

```
npm run build
npx nitro deploy --prebuilt
```

## Pendências depois do primeiro deploy

- Trocar o subdomínio auto-gerado (`bicoja-home.workers.dev`) por
  um domínio próprio, se/quando fizer sentido — Cloudflare permite domínio próprio
  de graça, só falta ter o domínio registrado.
- Repetir esse processo (ou usar CI) sempre que quiser atualizar produção; por
  enquanto não há pipeline de CI configurado, é manual.
