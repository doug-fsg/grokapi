# ManyTalks Bot

Control plane + runtime fullstack (Next.js 15 + SQLite). A **Biblioteca** entrega o manifesto completo com URL + token.

Marca: [BRAND.md](./BRAND.md). Rotas internas `/grokbots` e tokens `grk_live_…` permanecem por compatibilidade.

## Como rodar

```bash
pnpm i
copy .env.example .env
```

Preencha no `.env`:

- `MASTER_ENCRYPTION_KEY` — 32+ caracteres (AES-256-GCM)
- `SESSION_SECRET`
- `ADMIN_EMAIL` / `ADMIN_PASSWORD`
- `NEXT_PUBLIC_APP_URL=http://localhost:3000`
- `MANYTALKS_BASE` — ex. `https://app.manytalks.com.br`
- `MANYTALKS_SERVICE_TOKEN` — **obrigatório**: PAT do admin (accounts via profile, inboxes, runtime)
- `MANYTALKS_PLATFORM_TOKEN` — opcional (Platform App)

Com o SERVICE_TOKEN no `.env`, o wizard carrega **accounts e inboxes sozinho**. Você só escolhe quais inboxes o bot atende e publica. Reinicie o `pnpm dev` após editar o `.env`.

```bash
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Em outro terminal (fila SQLite):

```bash
pnpm worker
```

O seed cria os pacotes `atendimento-geral-v1`, `pre-vendas-asaas-v1`, `suporte-v1` e o operador admin se a tabela estiver vazia.

## Rotas principais

| Rota | Função |
|------|--------|
| `/login` | Login admin |
| `/` | Visão geral |
| `/grokbots` `/grokbots/new` `/grokbots/[id]` | CRUD + wizard 7 passos |
| `/library` | Pacotes JSON |
| `/settings` | Aparência + chaves de servidor |
| `/d/[slug]` | Dashboard cliente (senha obrigatória) |
| `GET /api/library/v1/manifest` | ManifestV1 (`Authorization: Bearer grk_live_…`) |
| `POST /api/hooks/manytalks` | Webhook ManyTalks |
| `POST /api/hooks/asaas/[grokbotId]` | Webhook Asaas |

Scripts: `dev`, `db:generate`, `db:migrate`, `db:seed`, `worker`, `typecheck`.

O SQLite fica em `data/grokbott.sqlite` (gitignored).
