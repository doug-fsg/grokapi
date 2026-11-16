# Produção (1 VPS)

SQLite em um único servidor. **HTTPS** na frente (Nginx/Caddy). Worker sempre ligado.

## 1. Servidor

- Ubuntu 22.04+, Node 20+, `pnpm`, `git`
- Opcional: `pm2`, Caddy ou Nginx

```bash
curl -fsSL https://get.pnpm.io/install.sh | sh -
# Node 20 via nvm ou nodesource
npm i -g pm2
```

## 2. App

```bash
git clone https://github.com/doug-fsg/grokapi.git
cd grokapi
pnpm install
cp .env.example .env
nano .env
```

Preencha (obrigatório em produção):

| Variável | Nota |
|----------|------|
| `NODE_ENV=production` | PM2 já define |
| `NEXT_PUBLIC_APP_URL` | `https://seu-dominio` (HTTPS) |
| `SESSION_SECRET` | 16+ chars aleatórios |
| `MASTER_ENCRYPTION_KEY` | 16+ chars; **não troque** depois sem reconfigurar secrets |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | senha 12+ chars, não `admin1234` |
| `MANYTALKS_SERVICE_TOKEN` | PAT ManyTalks |
| `DATABASE_URL` | `file:./data/grokbott.sqlite` |

```bash
pnpm db:migrate
NODE_ENV=production pnpm db:seed
pnpm build
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup
```

Health: `https://seu-dominio/api/health` → `{ "ok": true }`.

## 3. Reverse proxy (Caddy exemplo)

```
seu-dominio.com {
  reverse_proxy 127.0.0.1:3000
}
```

## 4. Backup diário

```bash
crontab -e
# 03:15 UTC
15 3 * * * cd /opt/grokapi && pnpm db:backup
```

Copia para `data/backups/`. Guarde fora da VPS (rsync/S3).

## 5. Atualizar

```bash
cd grokapi
git pull
pnpm install
pnpm db:migrate
pnpm build
pm2 restart all
```

## 6. Webhooks

- ManyTalks: `https://seu-dominio/api/hooks/manytalks`
- Asaas: `https://seu-dominio/api/hooks/asaas/{grokbotId}`

Playbook (OpenCode CLI) é opcional na VPS. Sem CLI, o resto do produto funciona.

## Não fazer

- Commitar `.env` ou o `.sqlite`
- Rodar várias réplicas apontando para o mesmo arquivo SQLite
- Usar Vercel/serverless com este worker + SQLite local
