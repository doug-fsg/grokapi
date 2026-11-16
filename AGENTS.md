# Agent Instructions

## Comunicação
- Sempre **pt-BR**, direto e conciso
- Após mudanças: 1–2 parágrafos escalabilidade/manutenibilidade + próximos passos se útil

## Package Manager
Use **pnpm**: `pnpm install`, `pnpm dev`, `pnpm worker`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm typecheck`

## File-Scoped Commands
| Task | Command |
|------|---------|
| Typecheck | `pnpm typecheck` |
| Dev | `pnpm dev` (sobe Next + worker); só Next: `pnpm dev:web` |

## Commit Attribution
AI commits MUST include:
```
Co-Authored-By: Composer <noreply@cursor.com>
```
- Commit só se pedido; nunca alterar git config; nunca push sem pedido
- Nunca commitar `.env`, sqlite de dados ou secrets

## Preferências de engenharia
- Soluções simples; sem duplicação; escopo só o pedido
- Arquivos > 200–300 linhas → dividir
- Dados simulados só em testes
- **Não sobrescrever `.env` sem perguntar** (pode *adicionar* chaves vazias se pedido)
- Fullstack **Next.js 15** + **SQLite/Drizzle** + jobs na tabela `jobs` (sem Redis/Postgres no v1)

## UI admin
- **Preferir modal** (`src/components/ui/dialog.tsx`, `ConfirmModal`) para ações secundárias — não empilhar cards/listas de funcionalidades na página
- Confirmações destrutivas: modal, nunca `window.confirm`
- Playbook: botão em `/grokbots` → modal. Varre a **base de conversas** da account (não só Kanban), com filtros de alcance/status/inbox/labels (menos = mais barato). LLM via **OpenCode CLI** (`opencode run` + cascade free); opcional `OPENCODE_BIN` / `OPENCODE_FREE_MODELS`

## Produto (decisões fechadas)
- **Marca:** **ManyTalks Bot** ([BRAND.md](./BRAND.md)); rotas/tabelas internas `grokbots` / `grk_live_…` estáveis
- **1 ManyTalks Bot = 1 `manytalks_account_id`** (UNIQUE); reabrir existente no wizard, não falhar silencioso
- Sucesso: editar no painel → **Publicar** → runtime usa `GET /api/library/v1/manifest` + Bearer `grk_live_…`
- Runtime só: **atender**, **labels (merge)**, **kanban**, **Asaas** (link e/ou PIX); handoff via label/estágio
- Dashboard `/d/[slug]`: **senha sempre obrigatória**
- Biblioteca de pacotes: só operador; knowledge = textarea
- Asaas: chave/subconta **por ManyTalks Bot**; split no Asaas; pós-pagamento A (CRM) e B (mensagem) configuráveis
- UI admin + dashboard: dark/light/system — ver `DESIGN-GROKBOT.md`
- Docs: `PLANO-COMPLETO.md`, `PRODUTO-GROK-MANYTALKS.md`, `LIBRARY-MANIFEST-V1.md`, `API-Manytalks.md`, `BRAND.md`

## ManyTalks (.env — usar essa facilidade)
```
MANYTALKS_BASE=https://app.manytalks.com.br
MANYTALKS_SERVICE_TOKEN=   # PAT admin — accounts via /api/v1/profile, inboxes, runtime
MANYTALKS_PLATFORM_TOKEN=  # opcional; GET /platform/.../accounts = 404 nesta instância
```
- Token efetivo: PAT do bot **ou** `MANYTALKS_SERVICE_TOKEN` (`resolveManytalksToken` / `manytalksTokenFromEnc`)
- Wizard: carregar accounts/inboxes do SERVICE; **não** exigir PAT por bot se o .env estiver ok
- `{conversation_id}` na API = **display_id**
- Labels: GET + merge + POST (API substitui a lista)
- Header: `api_access_token` (Bearer no Platform costuma 401)

## Código-chave
- Manifest: `src/lib/manifest/compile.ts`
- ManyTalks: `src/lib/manytalks/` · Asaas: `src/lib/asaas/` · Grok: `src/lib/grok/`
- Hooks: `src/app/api/hooks/` · Library: `src/app/api/library/v1/manifest`
- Admin ManyTalks Bot (`/grokbots`): CRUD UI (editar/excluir) + wizard 7 passos · lista `/grokbots` com modais
- Playbook (opcional): `src/lib/patterns/` + `POST .../pattern-scan` + webhook `playbook_patterns`
- Logs de solicitações: `/logs` + `src/lib/logs/write.ts` (tools/erros/Asaas, payload redigido)
- Setup: `README.md`

## Asaas
- Tools `create_payment_link` / `create_pix_charge`; amarrar `conversationId` em metadata/externalReference
- Webhook Asaas: config manual no painel Asaas
- Chave Asaas nos secrets do ManyTalks Bot, não no `.env` global

## Modos sob demanda
- **Planejador**: 4–6 perguntas → plano → aprovação → fases
- **Depurador**: hipóteses → logs → evidência → correção → OK para limpar logs
