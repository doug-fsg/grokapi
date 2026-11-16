# Produção (1 VPS)

SQLite em um único servidor. **HTTPS** na frente (Nginx/Caddy). Web + worker via **systemd**.

## 1. Servidor

- Ubuntu 22.04+, Node 20+ (binário em `/usr/bin/node`), `pnpm`, `git`
- Reverse proxy: Caddy ou Nginx

```bash
curl -fsSL https://get.pnpm.io/install.sh | sh -
# Node 20 via nvm ou nodesource — garanta `which node` → /usr/bin/node
# (se Node estiver só no nvm, ajuste ExecStart nos .service ou use symlink)
```

Usuário do serviço (recomendado):

```bash
sudo useradd --system --home /opt/grokapi --shell /usr/sbin/nologin manytalks
sudo mkdir -p /opt/grokapi
sudo chown manytalks:manytalks /opt/grokapi
```

## 2. App

```bash
sudo -u manytalks -H bash
cd /opt/grokapi
git clone https://github.com/doug-fsg/grokapi.git .
pnpm install
cp .env.example .env
nano .env
```

Preencha (obrigatório em produção):

| Variável | Nota |
|----------|------|
| `NODE_ENV=production` | também nos units |
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
exit
```

## 3. systemd

Units em `deploy/`. Se o app não estiver em `/opt/grokapi`, edite `WorkingDirectory` (e `EnvironmentFile`) nos dois arquivos.

```bash
sudo cp /opt/grokapi/deploy/manytalks-web.service /etc/systemd/system/
sudo cp /opt/grokapi/deploy/manytalks-worker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now manytalks-web manytalks-worker
sudo systemctl status manytalks-web manytalks-worker
```

Logs:

```bash
journalctl -u manytalks-web -f
journalctl -u manytalks-worker -f
```

Health: `https://seu-dominio/api/health` → `{ "ok": true }`.

## 4. Reverse proxy (Caddy exemplo)

```
seu-dominio.com {
  reverse_proxy 127.0.0.1:3000
}
```

## 5. Backup diário

```bash
sudo crontab -e -u manytalks
# 03:15 UTC
15 3 * * * cd /opt/grokapi && /home/manytalks/.local/share/pnpm/pnpm db:backup
```

(Ajuste o path do `pnpm` com `which pnpm` no user `manytalks`.)

Copia para `data/backups/`. Guarde fora da VPS (rsync/S3).

## 6. Atualizar

```bash
sudo systemctl stop manytalks-web manytalks-worker
sudo -u manytalks -H bash -c 'cd /opt/grokapi && git pull && pnpm install && pnpm db:migrate && pnpm build'
sudo systemctl start manytalks-web manytalks-worker
sudo systemctl status manytalks-web manytalks-worker
```

Só reiniciar (sem rebuild):

```bash
sudo systemctl restart manytalks-web manytalks-worker
```

## 7. Webhooks

- ManyTalks: `https://seu-dominio/api/hooks/manytalks`
- Asaas: `https://seu-dominio/api/hooks/asaas/{grokbotId}`

Playbook (OpenCode CLI) é opcional na VPS. Sem CLI, o resto do produto funciona.

## Não fazer

- Commitar `.env` ou o `.sqlite`
- Rodar várias réplicas apontando para o mesmo arquivo SQLite
- Usar Vercel/serverless com este worker + SQLite local
