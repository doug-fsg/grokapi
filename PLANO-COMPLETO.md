# Plano completo — GrokBot Platform (biblioteca como cérebro)

**Decisões fixas deste plano**

| Decisão | Escolha | Motivo |
|---------|---------|--------|
| Arquitetura | **Fullstack único** | Um deploy, um schema, manutenção simples |
| Stack | **Next.js 15** (App Router) | UI admin + dashboard + API Library + webhooks no mesmo projeto |
| Banco | **SQLite** (WAL) via **Drizzle ORM** | Zero ops de Postgres no início; arquivo versionável em dev |
| Escala futura | Migrar mesmo schema para **Turso/libSQL** | SQLite distribuído sem reescrever app |
| Fila | **Jobs em SQLite** (`jobs` table + worker loop) | Evita Redis no v1; suficiente até volume alto |
| xAI | Chave **global** no servidor | Você paga; rate limit por `grokbot_id` |

**Critério de sucesso (sua definição):**

> Existe uma **Biblioteca** com **URL + token**. Qualquer runtime GrokBot só precisa disso (e da URL pública de webhooks). Ao chamar a biblioteca, recebe **manifesto completo** — prompt, knowledge, inboxes, ManyTalks, Asaas, kanban, regras, tools, pós-pagamento. **Você edita um único sistema**; publica; o runtime atualiza; o **Grok se vira** com ManyTalks/Asaas.

Documentos complementares: [PRODUTO](./PRODUTO-GROK-MANYTALKS.md) · [DESIGN](./DESIGN-GROKBOT.md) · [API ManyTalks](./API-Manytalks.md) · [Conector/tools](./PLANO-GROK-MANYTALKS.md)

---

## 1. Visão: control plane vs runtime

```text
┌─────────────────────────────────────────────────────────────┐
│  GROKKBOT CONTROL PLANE (1 app Next.js + SQLite)            │
│  • Admin: biblioteca, pacotes, GrokBots, wizard             │
│  • Library API ←────────────── URL + TOKEN                  │
│  • Dashboard /d/[slug] (senha cliente)                      │
│  • Webhook ingress: POST /hooks/manytalks                   │
│                         POST /hooks/asaas                     │
└──────────────────────────────┬──────────────────────────────┘
                               │
         Você edita aqui ────────┘
                               │
              Runtime faz: GET manifest (Bearer)
                       → cache ETag
                       → webhook → Grok → ManyTalks/Asaas
```

**Escala:** dezenas/centenas de accounts ManyTalks = **N registros na biblioteca**, **1** (ou poucos) deploys do mesmo binário. Cada GrokBot = `runtime_token` + manifest versionado.

**Opcional fase 2:** worker separado (mesmo código, só rotas de hook) em outra região — ainda só `LIBRARY_URL` + `RUNTIME_TOKEN` no `.env`.

---

## 2. Biblioteca — produto central

### 2.1 Contrato HTTP

| Item | Valor |
|------|--------|
| Base | `https://{seu-dominio}/api/library/v1` |
| Auth | `Authorization: Bearer {runtime_token}` |
| Token | Gerado no admin por GrokBot; revogável; rotação sem downtime (dois tokens ativos 24h) |

| Método | Rota | Uso |
|--------|------|-----|
| `GET` | `/manifest` | **Bootstrap completo** do bot (ver §2.3) |
| `GET` | `/manifest` + `If-None-Match` | Cache 304 quando não publicou mudança |
| `HEAD` | `/manifest` | Health do runtime |
| `POST` | `/events` | (opcional) runtime reporta erro/métrica para dashboard |

**Admin (sessão operador, não runtime token):**

| Método | Rota |
|--------|------|
| `POST` | `/admin/grokbots/:id/publish` → incrementa `manifest_version`, novo ETag |
| `GET` | `/admin/grokbots/:id/manifest/preview` |

### 2.3 Manifesto (`ManifestV1`) — tudo que o Grok precisa

Schema versionado; o runtime **só** aceita `schema_version` suportada.

```json
{
  "schema_version": "1.0",
  "manifest_version": 42,
  "etag": "W/\"a1b2c3\"",
  "grokbot": {
    "id": "uuid",
    "name": "Cliente X",
    "enabled": true
  },
  "manytalks": {
    "base_url": "https://app.manytalks.com.br",
    "account_id": 42,
    "api_access_token": "•••",
    "enabled_inbox_ids": [3, 7],
    "webhook_subscriptions": ["message_created", "conversation_status_changed", "contact_kanban_stage_changed"]
  },
  "xai": {
    "model": "grok-2-latest",
    "temperature": 0.4,
    "max_history_messages": 30
  },
  "prompt": {
    "package_slug": "pre-vendas-asaas-v1",
    "system_compiled": "string final já interpolada",
    "knowledge": "textarea do cliente"
  },
  "tools_policy": {
    "send_reply": true,
    "set_conversation_labels": true,
    "move_kanban_card": true,
    "create_payment_link": true,
    "create_pix_charge": false
  },
  "labels": {
    "allowed_titles": ["lead", "escalar-humano", "pago"],
    "meanings": { "escalar-humano": "Pausa o bot" },
    "pause_bot_on": ["escalar-humano"]
  },
  "kanban": {
    "pipeline_id": 55,
    "stages_allowed": ["Novo", "Qualificado", "Proposta"],
    "pause_bot_stages": ["Fechado", "Perdido"],
    "stage_rules": [
      {
        "name": "qualificado",
        "condition": "Cliente descreveu necessidade e orçamento",
        "target_stage_id": "Qualificado",
        "add_labels": ["quente"],
        "priority": 10,
        "active": true
      }
    ]
  },
  "asaas": {
    "environment": "sandbox",
    "api_key": "•••",
    "allow_payment_link": true,
    "allow_pix_copy": true,
    "split_note": "Split configurado no painel Asaas da subconta"
  },
  "post_payment": {
    "crm_enabled": true,
    "labels_on_paid": ["pago"],
    "kanban_stage_on_paid": "Ganho",
    "message_enabled": true,
    "message_template": "Recebemos, {{nome}}! Próximo passo: ..."
  },
  "conversation_rules": {
    "statuses": ["open", "pending"],
    "only_incoming": true,
    "only_when_unassigned": false,
    "ignore_private": true,
    "execute_tools_before_reply": true
  },
  "dashboard": {
    "slug": "uuid",
    "has_password": true
  },
  "checklist_ack": {
    "capitao_off_inboxes": false
  }
}
```

**Compilação:** ao `publish`, o servidor:

1. Mescla **pacote da biblioteca** + overrides do GrokBot + knowledge.  
2. Injeta `stage_rules`, labels, política Asaas no `system_compiled`.  
3. Cifra tokens em repouso no SQLite; no manifest só descriptografa **para runtime autenticado** (TLS obrigatório).

**O Grok não recebe o manifest bruto** — o runtime monta `messages[]` + tools a partir dele.

### 2.4 Pacotes da biblioteca (templates internos)

Tabela `library_packages` — você edita no admin; ao criar GrokBot, **aplica** pacote e pode desviar campos.

Pacotes seed:

| Slug | Uso |
|------|-----|
| `atendimento-geral-v1` | Só atender + labels leves |
| `pre-vendas-asaas-v1` | Funil + cobrança + pós-pagamento defaults |
| `suporte-v1` | Sem kanban move |

**Fluxo desejado:** mudar pacote → republicar → todos os GrokBots **pinned** naquela versão ou “seguir latest” (configurável).

### 2.5 O que o operador cola no “GrokBot leve” (escala)

Mínimo em qualquer servidor/worker:

```env
LIBRARY_URL=https://app.grokbott.com.br/api/library/v1
GROKBOT_RUNTIME_TOKEN=grk_live_...
PUBLIC_WEBHOOK_BASE=https://app.grokbott.com.br
```

No modelo **fullstack único**, isso é o **mesmo** `.env` do Next — não há segundo sistema. Escala horizontal = réplicas Next + **SQLite em Turso** ou volume compartilhado (ver §10).

---

## 3. Fluxo operacional (você)

```text
1. Admin → Biblioteca: editar pacote (se necessário)
2. Admin → Novo GrokBot (wizard) ou editar existente
3. Admin → Publicar manifest
4. Admin → Registrar webhooks ManyTalks (botão) apontando para /hooks/manytalks
5. Admin → Copiar runtime token (documentação para réplica futura)
6. Cliente → dashboard /d/{slug} + senha
```

**Mudança de negócio:** editar knowledge / regras / inboxes → **Publicar** → próximo webhook usa manifest novo (cache ≤ 60s ou invalidação por ETag).

---

## 4. Runtime — webhook → Grok → ações

### 4.1 ManyTalks `message_created`

```text
POST /hooks/manytalks
  → extrair account_id + inbox_id + conversation display_id + message id
  → resolver grokbot_id (tabela por manytalks_account_id)
  → GET /manifest (cache memória 60s, ETag)
  → se !enabled ou inbox ∉ lista → 204
  → idempotência: processed_messages
  → GET ManyTalks: conversa, mensagens, contato, labels
  → montar chat xAI + tool definitions from tools_policy
  → loop tool calls (máx 5)
  → registrar action_logs + domain_events
  → job enqueue dashboard aggregation
```

Tools: conforme [PLANO-GROK-MANYTALKS.md](./PLANO-GROK-MANYTALKS.md) + Asaas.

### 4.2 Asaas webhook

```text
POST /hooks/asaas/{grokbot_id}
  → GET manifest
  → post_payment determinístico (CRM A / mensagem B)
  → payment_events + domain_events
```

### 4.3 Jobs (SQLite)

| `job_type` | Trigger |
|------------|---------|
| `process_manytalks_webhook` | após ingress |
| `aggregate_dashboard_daily` | cron / após pagamento |
| `retry_failed_action` | backoff |

Worker: `pnpm worker` — loop `SELECT ... FROM jobs WHERE status=pending` (same codebase).

---

## 5. Escopo funcional completo (entrega única v1.0.0)

| # | Feature | Incluído |
|---|---------|----------|
| 1 | Library API manifest URL+token | Sim |
| 2 | Admin auth + wizard 7 passos | Sim |
| 3 | Biblioteca CRUD + versionar pacotes | Sim |
| 4 | GrokBot CRUD + publish + rotação token | Sim |
| 5 | ManyTalks test + inboxes + webhook register | Sim |
| 6 | Kanban list/create pipeline + matriz regras | Sim |
| 7 | Asaas link + PIX toggles, subconta/chave, pós-pagamento A/B | Sim |
| 8 | Dashboard senha obrigatória + KPIs | Sim |
| 9 | Tema dark/light/system | Sim |
| 10 | Logs por grokbot + health | Sim |

---

## 6. Estrutura do repositório

```text
c:\API Grok\
├── src/
│   ├── app/
│   │   ├── (admin)/           # layout sidebar
│   │   │   ├── grokbots/
│   │   │   ├── library/
│   │   │   └── settings/
│   │   ├── (auth)/login/
│   │   ├── d/[slug]/          # dashboard cliente
│   │   ├── api/
│   │   │   ├── library/v1/    # manifest ← TOKEN
│   │   │   ├── admin/         # CRUD (sessão)
│   │   │   └── hooks/         # manytalks, asaas
│   ├── lib/
│   │   ├── db/                # drizzle + sqlite
│   │   ├── manifest/          # compile + etag
│   │   ├── manytalks/
│   │   ├── asaas/
│   │   ├── grok/              # xAI client + tools
│   │   ├── crypto/
│   │   └── jobs/
│   └── components/            # shadcn
├── drizzle/
├── packages/brand/            # tokens.css, tokens-light.css
├── data/
│   └── grokbott.sqlite        # gitignored (dev)
├── scripts/worker.ts
├── docs/                      # *.md existentes
├── docker-compose.yml         # opcional: single container
└── package.json
```

---

## 7. SQLite — schema (Drizzle)

| Tabela | Papel |
|--------|-------|
| `operators` | login admin |
| `library_packages` | templates versionados `payload_json` |
| `grokbots` | registro lógico |
| `grokbots_config` | knowledge, flags, package_id, fk pipeline, asaas json |
| `grokbots_secrets` | tokens cifrados (manytalks, asaas) |
| `grokbots_inboxes` | inbox_id |
| `grokbots_runtime_tokens` | hash do bearer, label, expires |
| `grokbots_manifest_snapshots` | version, etag, compiled_json (auditoria) |
| `stage_rules` | matriz kanban |
| `processed_messages` | idempotência |
| `conversation_states` | pause, last_id |
| `action_logs` | debug |
| `domain_events` | analytics |
| `payment_events` | Asaas |
| `dashboards` | slug, password_hash |
| `dashboard_daily_stats` | agregados |
| `jobs` | fila |

Índices: `(manytalks_account_id)`, `(grokbot_id, message_id)` unique.

**WAL mode:** `PRAGMA journal_mode=WAL;` na conexão.

---

## 8. Painel admin — rotas

| Rota | Função |
|------|--------|
| `/` | Overview: GrokBots, erros 24h, publicações recentes |
| `/grokbots` | Lista |
| `/grokbots/new` | Wizard |
| `/grokbots/[id]` | Abas + **Publicar manifest** + **Copiar URL/token runtime** |
| `/library` | Pacotes |
| `/library/[id]` | Editor |
| `/settings` | XAI key, `MASTER_ENCRYPTION_KEY`, aparência |
| Wizard passo 7 | Mostra: `LIBRARY_URL`, `GROKBOT_RUNTIME_TOKEN`, webhook URLs |

---

## 9. Dashboard cliente

- `/d/[slug]` — login obrigatório antes de qualquer KPI  
- Agregação a partir de `domain_events`  
- Sem acesso à Library API (token runtime não exposto no browser)

---

## 10. Deploy e escala com SQLite

| Estágio | Setup |
|---------|--------|
| **Dev** | `data/grokbott.sqlite` local |
| **Produção v1** | 1 VPS, SQLite em volume persistente, backup diário arquivo `.sqlite` |
| **Escala** | Turso/libSQL: trocar `DATABASE_URL`; Drizzle schema idêntico |
| **Réplicas** | Somente com Turso ou Postgres migrado — até lá, vertical scale + job worker único |

Limites realistas SQLite single-writer: milhares de webhooks/dia OK; monitorar tamanho do arquivo e `busy_timeout`.

---

## 11. Segurança

| Item | Medida |
|------|--------|
| `runtime_token` | prefixo `grk_live_`, 32+ bytes random, só hash no DB |
| Manifest | HTTPS only; rate limit por token |
| Admin | bcrypt + session httpOnly |
| Secrets manifest | AES-256-GCM, chave `MASTER_ENCRYPTION_KEY` |
| Dashboard | senha obrigatória, argon2 |
| xAI key | só env servidor, nunca no manifest para browser |

---

## 12. Design

Implementar [DESIGN-GROKBOT.md](./DESIGN-GROKBOT.md): `packages/brand/tokens.css` + `data-grokbott-theme` + shadcn.

---

## 13. Testes — definição de pronto (v1.0.0)

| # | Teste |
|---|--------|
| 1 | `curl -H "Authorization: Bearer $TOKEN" $LIBRARY_URL/manifest` retorna ManifestV1 completo |
| 2 | Publicar manifest altera ETag; runtime recebe 304 com cache |
| 3 | Webhook simulado → resposta ManyTalks |
| 4 | Labels merge |
| 5 | Kanban move respeitando matriz |
| 6 | Criar pipeline no painel |
| 7 | Asaas link e PIX conforme toggles |
| 8 | Pós-pagamento A e B |
| 9 | Dashboard sem senha = sem dados |
| 10 | Editar knowledge → publish → nova resposta reflete mudança **sem redeploy** |
| 11 | Dark/light/system |

**Teste de sucesso (sua meta):** apagar `.env` local exceto `LIBRARY_URL` + `GROKBOT_RUNTIME_TOKEN` + keys globais; subir runtime limpo; bot funciona após publish no admin.

---

## 14. Ordem de implementação (uma release)

| Semana | Entregável |
|--------|------------|
| 1 | Next scaffold, SQLite+Drizzle, auth admin, tokens brand |
| 2 | **Library manifest compile + publish + API GET** |
| 3 | ManyTalks SDK + webhooks + idempotência |
| 4 | Grok engine + tools (reply, labels, kanban) |
| 5 | Wizard + GrokBot CRUD + inboxes + webhook register |
| 6 | Kanban UI create pipeline + stage_rules |
| 7 | Asaas + hooks + post_payment |
| 8 | Dashboard + aggregation jobs |
| 9 | Biblioteca UI + 3 pacotes seed |
| 10 | UAT §13 + hardening + docker + backup script |

---

## 15. Variáveis de ambiente (produção)

```env
DATABASE_URL=file:./data/grokbott.sqlite
MASTER_ENCRYPTION_KEY=
XAI_API_KEY=
SESSION_SECRET=
NEXT_PUBLIC_APP_URL=https://app.grokbott.com.br
# Runtime (mesmo app; documentado para réplicas futuras):
# LIBRARY_URL=${NEXT_PUBLIC_APP_URL}/api/library/v1
# GROKBOT_RUNTIME_TOKEN=...  (um por bot na doc; global master opcional)
```

---

## 16. Documentação para você (pós-deploy)

Página admin **“Como escalar”**:

1. Crie GrokBot no painel.  
2. **Publicar**.  
3. Copie **Library URL** + **Runtime token**.  
4. Aponte webhooks ManyTalks/Asaas para `PUBLIC_WEBHOOK_BASE`.  
5. Qualquer instância nova só precisa dessas variáveis — **editar negócio só no painel**.

---

## 17. Próxima ação (autônoma)

Iniciar scaffold em `c:\API Grok`: `package.json`, Drizzle schema, rota `GET /api/library/v1/manifest`, login admin mínimo, tokens CSS — conforme este plano.

---

*Plano integral: fullstack Next.js + SQLite, biblioteca URL+token como única fonte de verdade operacional, release v1.0.0 sem MVP parcial.*
