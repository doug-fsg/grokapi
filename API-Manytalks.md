# API ManyTalks / Chatwoot — Guia de integração para clientes

**Versão do documento:** gerada em 2025-11-13 a partir do código em produção (`https://app.manytalks.com.br`)  
**Formato:** JSON (`Content-Type: application/json`)  
**Referência interativa:** [https://app.manytalks.com.br/swagger](https://app.manytalks.com.br/swagger)

---

## 1. Visão geral

Esta instância é baseada no **Chatwoot**, com extensões proprietárias (Kanban/CRM, workflows, Capitão, etc.). Para integrações de clientes, o fluxo típico é:

1. Autenticar com **Personal Access Token** do agente ou administrador da conta.
2. Usar rotas ` /api/v1/accounts/{account_id}/... `.
3. Opcionalmente configurar **webhooks** na conta para receber eventos em tempo real.
4. Para widgets/canais públicos, usar a **API pública** ` /public/api/v1/... `.

Variáveis usadas neste guia:

| Variável | Descrição |
|----------|-----------|
| `{base}` | `https://app.manytalks.com.br` |
| `{account_id}` | ID numérico da conta (visível na URL do painel: `/app/accounts/...`) |
| `{conversation_id}` | **display_id** da conversa (não confundir com o ID interno do banco) |
| `{contact_id}` | ID do contato |
| `{pipeline_id}` | ID do pipeline Kanban (= `custom_attribute_definition.id` com `is_kanban: true`) |

---

## 2. Autenticação

### 2.1 Token de usuário (recomendado para integrações)

Gere em: **Perfil → Access Token**.

Envie em **todas** as requisições autenticadas:

```http
api_access_token: SEU_TOKEN
```

Alternativas aceitas:

```http
Api-Access-Token: SEU_TOKEN
Authorization: Bearer SEU_TOKEN
```

### 2.2 Agent Bot

Bots possuem token próprio e acesso **limitado** a alguns endpoints (mensagens, toggle de status, assignment, etc.). Integrações completas (Kanban, etiquetas da conta, relatórios) exigem token de **usuário**.

### 2.3 Platform API

Rotas em `/platform/api/v1/...` usam token de **Platform App** (provisionamento de contas/usuários). Uso típico de parceiros, não de integrações por conta.

### 2.4 Login via API (sessão)

Rotas Devise Token Auth em `/auth/...` (sign_in, validação de token). Para automações server-to-server, prefira **api_access_token** estático.

---

## 3. Códigos de resposta e erros

| HTTP | Significado |
|------|-------------|
| 200 / 204 | Sucesso |
| 401 | Token inválido ou ausente |
| 403 | Sem permissão (comum em Kanban para editores) |
| 404 | Recurso não encontrado |
| 422 | Validação / parâmetros inválidos |

Corpo de erro típico: `{ "error": "mensagem" }` ou `{ "message": "..." }`.

---

## 4. Conversas

Prefixo: `{base}/api/v1/accounts/{account_id}/conversations`

> **Importante:** em URLs de conversa, `:id` é o **display_id** (`conversation.display_id`), exposto no JSON como `id`.

### 4.1 Listar conversas

`GET /conversations`

**Query (principais):**

| Parâmetro | Valores | Padrão |
|-----------|---------|--------|
| `status` | `open`, `resolved`, `pending`, `snoozed`, `all` | `open` |
| `assignee_type` | `me`, `unassigned`, `all`, `assigned` | `all` |
| `inbox_id` | inteiro | — |
| `team_id` | inteiro | — |
| `labels`[] | título da etiqueta | — |
| `q` | texto nas mensagens | — |
| `page` | inteiro | `1` |

**Exemplo:**

```bash
curl -s -G "{base}/api/v1/accounts/{account_id}/conversations" \
  -H "api_access_token: $TOKEN" \
  --data-urlencode "status=open" \
  --data-urlencode "page=1"
```

### 4.2 Metadados (contagem)

`GET /conversations/meta` — mesmos filtros de listagem; retorna contadores sem lista completa.

### 4.3 Busca

`GET /conversations/search` — busca com paginação.

### 4.4 Filtro avançado

`POST /conversations/filter?page=1`

```json
{
  "payload": [
    {
      "attribute_key": "status",
      "filter_operator": "equal_to",
      "values": ["open"],
      "query_operator": "AND"
    }
  ]
}
```

Operadores comuns: `equal_to`, `not_equal_to`, `contains`, `does_not_contain`, `is_present`, `is_not_present`, `is_greater_than`, `is_less_than` (conforme atributo).

### 4.5 Detalhe

`GET /conversations/{conversation_id}`

Campos úteis no payload: `status`, `inbox_id`, `labels` (array de strings), `custom_attributes`, `meta.assignee`, `priority`, `unread_count`, `capitao_enabled`, etc.

### 4.6 Criar conversa

`POST /conversations`

```json
{
  "source_id": "identificador-unico-do-contato-no-canal",
  "inbox_id": 1,
  "contact_id": 123,
  "message": {
    "content": "Olá!"
  }
}
```

Para inbox API, `source_id` + `inbox_id` são obrigatórios. Consulte o [wiki Chatwoot](https://github.com/chatwoot/chatwoot/wiki/Building-on-Top-of-Chatwoot:-Importing-Existing-Contacts-and-Creating-Conversations).

### 4.7 Atualizar

`PATCH /conversations/{conversation_id}`

```json
{ "priority": "urgent" }
```

### 4.8 Alterar status

`POST /conversations/{conversation_id}/toggle_status`

```json
{ "status": "resolved" }
```

Valores: `open`, `resolved`, `pending`. Opcional: `snoozed_until` (datetime) ao definir status.

Alternativa sem body: `POST` alterna entre estados (comportamento legado).

### 4.9 Prioridade

`POST /conversations/{conversation_id}/toggle_priority`

```json
{ "priority": "high" }
```

Valores típicos: `urgent`, `high`, `medium`, `low`, `null`.

### 4.10 Atributos customizados da conversa

`POST /conversations/{conversation_id}/custom_attributes`

```json
{
  "custom_attributes": {
    "pedido_id": "12345"
  }
}
```

### 4.11 Atribuição (agente / time)

`POST /conversations/{conversation_id}/assignments`

```json
{ "assignee_id": 42 }
```

ou

```json
{ "team_id": 3 }
```

`assignee_id` nulo remove o agente.

### 4.12 Outras ações de membro

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `.../mute` | Silenciar |
| POST | `.../unmute` | Dessilenciar |
| POST | `.../unread` | Marcar como não lida |
| POST | `.../update_last_seen` | Atualizar última visualização |
| POST | `.../transcript` | Enviar transcrição por e-mail (`email` no body) |
| GET | `.../attachments` | Listar anexos |

### 4.13 Workflows na conversa (extensão)

| Método | Rota |
|--------|------|
| GET | `.../workflow_enrollments/active` |
| POST | `.../workflow_enrollments` |
| POST | `.../workflow_enrollments/:id/pause` |
| POST | `.../workflow_enrollments/:id/resume` |
| POST | `.../workflow_enrollments/:id/cancel` |
| POST | `.../workflow_enrollments/:id/jump` |
| POST | `.../workflow_enrollments/:id/rebind` |

---

## 5. Mensagens

### 5.1 Listar

`GET /api/v1/accounts/{account_id}/conversations/{conversation_id}/messages`

Query: `before` (id mensagem), `after`, etc., para paginação.

### 5.2 Enviar mensagem

`POST .../messages`

```json
{
  "content": "Texto da resposta",
  "message_type": "outgoing",
  "private": false,
  "content_type": "text",
  "content_attributes": {},
  "template_params": {
    "name": "nome_template_whatsapp",
    "category": "UTILITY",
    "language": "pt_BR",
    "processed_params": { "1": "valor" }
  }
}
```

| Campo | Notas |
|-------|--------|
| `private: true` | Nota interna (não vai ao cliente) |
| `template_params` | Obrigatório para templates WhatsApp aprovados |

### 5.3 Outras ações

| Método | Rota | Uso |
|--------|------|-----|
| DELETE | `.../messages/:id` | Apagar (substitui conteúdo por mensagem deletada) |
| POST | `.../messages/:id/retry` | Reenviar |
| POST | `.../messages/:id/translate` | `target_language` |
| POST | `.../messages/:id/forward` | Encaminhar (`contacts` no body) |

---

## 6. Etiquetas (Labels)

Etiquetas são strings (títulos). O endpoint de **criar/substituir** na conversa **sobrescreve** a lista inteira.

### 6.1 Gerenciar etiquetas da conta

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/labels` | Listar |
| GET | `/labels/:id` | Detalhe |
| POST | `/labels` | Criar |
| PATCH | `/labels/:id` | Atualizar |
| DELETE | `/labels/:id` | Excluir |

**Criar etiqueta:**

```json
{
  "label": {
    "title": "vip",
    "description": "Cliente VIP",
    "color": "#1f93ff",
    "show_on_sidebar": true,
    "label_group_id": null
  }
}
```

### 6.2 Grupos de etiquetas

`GET|POST|PATCH|DELETE /label_groups`

### 6.3 Etiquetas da conversa

| Método | Rota | Body |
|--------|------|------|
| GET | `/conversations/{conversation_id}/labels` | — |
| POST | `/conversations/{conversation_id}/labels` | `{ "labels": ["vip", "cobrança"] }` |

**Exemplo — definir etiquetas:**

```bash
curl -s -X POST "{base}/api/v1/accounts/{account_id}/conversations/{conversation_id}/labels" \
  -H "api_access_token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"labels":["comercial","quente"]}'
```

Resposta: `{ "payload": ["comercial", "quente"] }`

### 6.4 Etiquetas do contato

| Método | Rota |
|--------|------|
| GET | `/contacts/{contact_id}/labels` |
| POST | `/contacts/{contact_id}/labels` |

Mesmo contrato: `{ "labels": ["..."] }` substitui todas as etiquetas do contato.

---

## 7. Kanban (CRM / Pipelines)

O Kanban usa:

- **Pipeline** → `custom_attribute_definition` com `is_kanban: true` e `attribute_model: contact_attribute`.
- **Posição do card** → tabela `contact_pipeline_positions` (exposta como `pipeline_positions` no JSON do contato).
- **`stage_id`** → nome da coluna (string), igual ao definido em `attribute_values.stages`.

### 7.1 Listar pipelines

`GET /custom_attribute_definitions?attribute_model=contact_attribute`

Filtrar no cliente por `is_kanban === true`.

**Exemplo de pipeline:**

```json
{
  "id": 55,
  "attribute_key": "vendas_pipeline",
  "attribute_display_name": "Vendas",
  "is_kanban": true,
  "ownership_mode": "linked",
  "attribute_values": {
    "stages": {
      "Novo": { "color": "#ff0000" },
      "Proposta": { "color": "#00aa00" }
    },
    "stage_order": ["Novo", "Proposta", "Fechado"],
    "permissions": {}
  }
}
```

`pipeline_id` para as rotas abaixo = `id` deste registro.

### 7.2 CRUD de pipeline (admin / `crm_manage`)

| Método | Rota |
|--------|------|
| POST | `/custom_attribute_definitions` |
| PATCH | `/custom_attribute_definitions/:id` |
| DELETE | `/custom_attribute_definitions/:id` |

Body (criação Kanban simplificada):

```json
{
  "custom_attribute_definition": {
    "attribute_display_name": "Vendas",
    "attribute_key": "vendas_pipeline",
    "attribute_display_type": "list",
    "attribute_model": "contact_attribute",
    "is_kanban": true,
    "attribute_values": {
      "stages": [
        { "name": "Novo", "color": "#6366f1" },
        { "name": "Ganho", "color": "#22c55e" }
      ],
      "ownership_mode": "linked"
    }
  }
}
```

### 7.3 Mover card / atualizar posição

`PATCH /contacts/{contact_id}/pipeline_positions/{pipeline_id}`

```json
{
  "stage_id": "Proposta",
  "position": 0,
  "entered_at": "2025-11-13T15:00:00Z",
  "deal_value": 1500.50,
  "assignee_id": 7,
  "metadata": {
    "primary_conversation_id": 120,
    "win_lost": {
      "status": "won",
      "date": "2025-11-13T18:00:00Z",
      "reason": "Contrato assinado"
    }
  }
}
```

| Campo | Descrição |
|-------|-----------|
| `stage_id` | Nome da coluna |
| `position` | Ordem vertical na coluna (0 = topo) |
| `deal_value` | Valor do negócio |
| `assignee_id` | Responsável pelo card (permissão necessária) |
| `metadata.win_lost.status` | `won`, `lost` ou remova para reabrir |
| `metadata.primary_conversation_id` | Conversa principal vinculada |

**Resposta (exemplo):**

```json
{
  "pipeline_id": 55,
  "stage_id": "Proposta",
  "position": 0,
  "deal_value": 1500.5,
  "metadata": {},
  "assignee": { "id": 7, "name": "Maria" }
}
```

### 7.4 Remover do pipeline

`DELETE /contacts/{contact_id}/pipeline_positions/{pipeline_id}`

### 7.5 Reordenar vários cards

`POST /contacts/pipeline_positions/reorder`

```json
{
  "pipeline_id": 55,
  "positions": [
    {
      "contact_id": 10,
      "stage_id": "Novo",
      "position": 0,
      "deal_value": 100
    },
    {
      "contact_id": 11,
      "stage_id": "Proposta",
      "position": 1
    }
  ]
}
```

Retorno: `204` sem corpo.

### 7.6 Estatísticas

| Método | Rota | Retorno |
|--------|------|---------|
| GET | `/contacts/pipeline_positions/{pipeline_id}/stats` | Totais por `stage_id` |
| GET | `/contacts/pipeline_positions/{pipeline_id}/dashboard_stats` | KPIs (ganhos, perdas, ticket médio, etc.) |

### 7.7 Listar cards do Kanban (filtro de contatos)

`POST /contacts/filter?page=1&per_page=100`

O payload **deve** incluir o atributo do pipeline com `is_present` para ativar os JOINs do Kanban:

```json
{
  "payload": [
    {
      "attribute_key": "vendas_pipeline",
      "filter_operator": "is_present",
      "values": [],
      "query_operator": "AND"
    },
    {
      "attribute_key": "_pipeline_stage_id",
      "filter_operator": "equal_to",
      "values": ["Proposta", "Novo"],
      "query_operator": "AND"
    }
  ]
}
```

**Chaves especiais de filtro (`_pipeline_*`):**

| attribute_key | Operadores | values |
|---------------|------------|--------|
| `_pipeline_stage_id` | `equal_to` | nomes das colunas |
| `_pipeline_entered_at` | `is_greater_than` / `is_less_than` | data `YYYY-MM-DD` (fuso America/Sao_Paulo) |
| `_pipeline_created_at` | idem | data |
| `_pipeline_win_lost_at` | idem | data |
| `_pipeline_stale_days` | `is_greater_than` | número de dias na etapa |
| `_pipeline_deal_value` | `is_greater_than` / `is_less_than` | número |
| `_pipeline_deal_presence` | `equal_to` | `with` ou `without` |
| `_pipeline_assignee_id` | `equal_to` | IDs de agentes |
| `_pipeline_win_lost` | `equal_to` | `won`, `lost`, `open` |
| `_conversation_assignee_id` | `equal_to` | agente em conversa aberta/pending |
| `_labels` | `equal_to` | títulos de etiquetas (contato **ou** conversas) |

**Visibilidade:** agentes não administradores enxergam apenas cards próprios ou sem responsável, salvo permissão `admin`/`supervisor` no pipeline.

Cada contato retornado inclui `pipeline_positions[]` com `stage_id`, `deal_value`, `metadata`, `assignee`.

### 7.8 Permissões no Kanban

Níveis por usuário no pipeline: `admin` (supervisor), `editor`, `viewer`, `none`. Respostas `403` comuns ao mover card de outro responsável sem permissão.

---

## 8. Contatos (resumo para integrações)

| Método | Rota | Uso |
|--------|------|-----|
| GET | `/contacts` | Listagem paginada |
| GET | `/contacts/search?q=` | Busca |
| POST | `/contacts/filter` | Filtro avançado / Kanban |
| GET | `/contacts/:id` | Detalhe |
| POST | `/contacts` | Criar |
| PATCH | `/contacts/:id` | Atualizar |
| DELETE | `/contacts/:id` | Excluir |
| GET | `/contacts/:id/conversations` | Conversas do contato |

---

## 9. Webhooks

### 9.1 Configurar

`POST /api/v1/accounts/{account_id}/webhooks`

```json
{
  "webhook": {
    "url": "https://sua-api.exemplo/hooks/chatwoot",
    "subscriptions": [
      "conversation_created",
      "conversation_updated",
      "conversation_status_changed",
      "message_created",
      "message_updated",
      "contact_created",
      "contact_updated",
      "contact_kanban_stage_changed"
    ]
  }
}
```

### 9.2 Eventos disponíveis

- `conversation_created`, `conversation_updated`, `conversation_status_changed`
- `message_created`, `message_updated`
- `contact_created`, `contact_updated`
- `contact_kanban_stage_changed` — **movimentação no Kanban**
- `webwidget_triggered`, `inbox_created`, `inbox_updated`, `form_submitted`

Inclua `contact_kanban_stage_changed` explicitamente (não vem em todos os padrões legados).

**Payload `contact_kanban_stage_changed` (resumo):**

```json
{
  "event": "contact_kanban_stage_changed",
  "contact": { },
  "pipeline": { "id": 55, "name": "Vendas" },
  "pipeline_position": {
    "stage_id": "Proposta",
    "previous_stage_id": "Novo",
    "position": 0,
    "assignee_id": 7,
    "deal_value": 1500
  }
}
```

Webhooks por **inbox** usam subset de eventos de conversa/mensagem.

---

## 10. API pública (contatos finais / widget)

Base: `{base}/public/api/v1/inboxes/{inbox_identifier}/...`

| Recurso | Rotas |
|---------|-------|
| Contatos | `POST|GET|PATCH contacts` |
| Conversas | `GET|POST contacts/:id/conversations` |
| Mensagens | CRUD em `.../conversations/:id/messages` |

Autenticação: identificador do inbox na URL + `source_id` do contato (conforme canal).

---

## 11. API Platform (provisionamento)

Base: `{base}/platform/api/v1/`

Contas, usuários, agent bots, membership — token de Platform App. Não usar para automação dentro de uma conta cliente.

---

## 12. Relatórios (API v2)

`GET {base}/api/v2/accounts/{account_id}/reports/summary`  
Outros: `conversations`, `labels`, `agents`, `inboxes`, `teams`, `conversation_traffic`, métricas de bot e workflows.

---

## 13. Boas práticas

1. Use **idempotência** em `source_id` ao criar conversas em inbox API.
2. Etiquetas: leia antes de escrever se precisar **adicionar** sem remover as existentes (a API substitui a lista).
3. Kanban: prefira `PATCH pipeline_positions` em vez de alterar `custom_attributes` legados no contato.
4. Paginação: `page` + `per_page` (contatos Kanban até **200** por página).
5. Testes: use uma conta sandbox e valide payloads no Swagger.
6. Nunca exponha o `api_access_token` no front-end público.

---

## Anexo A — Catálogo de rotas `/api/*` (extraído do Rails)

Gerado automaticamente em 2025-11-13. Formato: `verbo URI → controller#action`.

```
POST     /api/v1/accounts/:account_id/agents(.:format)                                                               api/v1/accounts/agents#create {:format=>"json"}
                                                            PUT      /api/v1/accounts/:account_id/agents/:id(.:format)                                                           api/v1/accounts/agents#update {:format=>"json"}
                                                            DELETE   /api/v1/accounts/:account_id/agents/:id(.:format)                                                           api/v1/accounts/agents#destroy {:format=>"json"}
                                                            POST     /api/v1/accounts/:account_id/announcements(.:format)                                                        api/v1/accounts/announcements#create {:format=>"json"}
                                                            PUT      /api/v1/accounts/:account_id/announcements/:id(.:format)                                                    api/v1/accounts/announcements#update {:format=>"json"}
                                                            DELETE   /api/v1/accounts/:account_id/announcements/:id(.:format)                                                    api/v1/accounts/announcements#destroy {:format=>"json"}
                                                            POST     /api/v1/accounts/:account_id/agent_bots(.:format)                                                           api/v1/accounts/agent_bots#create {:format=>"json"}
                                                            PATCH    /api/v1/accounts/:account_id/agent_bots/:id(.:format)                                                       api/v1/accounts/agent_bots#update {:format=>"json"}
                                                            PUT      /api/v1/accounts/:account_id/agent_bots/:id(.:format)                                                       api/v1/accounts/agent_bots#update {:format=>"json"}
                                                            DELETE   /api/v1/accounts/:account_id/agent_bots/:id(.:format)                                                       api/v1/accounts/agent_bots#destroy {:format=>"json"}
                                                            GET      /api/v1/accounts/:account_id/callbacks/register_facebook_page(.:format)                                     api/v1/accounts/callbacks#register_facebook_page {:format=>"json"}
                                                            POST     /api/v1/accounts/:account_id/canned_responses(.:format)                                                     api/v1/accounts/canned_responses#create {:format=>"json"}
                                                            PUT      /api/v1/accounts/:account_id/canned_responses/:id(.:format)                                                 api/v1/accounts/canned_responses#update {:format=>"json"}
                                                            DELETE   /api/v1/accounts/:account_id/canned_responses/:id(.:format)                                                 api/v1/accounts/canned_responses#destroy {:format=>"json"}
                                                            POST     /api/v1/accounts/:account_id/automation_rules(.:format)                                                     api/v1/accounts/automation_rules#create {:format=>"json"}
                                                            PATCH    /api/v1/accounts/:account_id/automation_rules/:id(.:format)                                                 api/v1/accounts/automation_rules#update {:format=>"json"}
                                                            PUT      /api/v1/accounts/:account_id/automation_rules/:id(.:format)                                                 api/v1/accounts/automation_rules#update {:format=>"json"}
                                                            DELETE   /api/v1/accounts/:account_id/automation_rules/:id(.:format)                                                 api/v1/accounts/automation_rules#destroy {:format=>"json"}
                                                            POST     /api/v1/accounts/:account_id/workflows(.:format)                                                            api/v1/accounts/workflows#create {:format=>"json"}
                                                            PATCH    /api/v1/accounts/:account_id/workflows/:id(.:format)                                                        api/v1/accounts/workflows#update {:format=>"json"}
                                                            PUT      /api/v1/accounts/:account_id/workflows/:id(.:format)                                                        api/v1/accounts/workflows#update {:format=>"json"}
                                                            DELETE   /api/v1/accounts/:account_id/workflows/:id(.:format)                                                        api/v1/accounts/workflows#destroy {:format=>"json"}
                                                            POST     /api/v1/accounts/:account_id/workflow_schedules(.:format)                                                   api/v1/accounts/workflow_schedules#create {:format=>"json"}
                                                            PATCH    /api/v1/accounts/:account_id/workflow_schedules/:id(.:format)                                               api/v1/accounts/workflow_schedules#update {:format=>"json"}
                                                            PUT      /api/v1/accounts/:account_id/workflow_schedules/:id(.:format)                                               api/v1/accounts/workflow_schedules#update {:format=>"json"}
                                                            DELETE   /api/v1/accounts/:account_id/workflow_schedules/:id(.:format)                                               api/v1/accounts/workflow_schedules#destroy {:format=>"json"}
                                                            POST     /api/v1/accounts/:account_id/macros(.:format)                                                               api/v1/accounts/macros#create {:format=>"json"}
                                                            PATCH    /api/v1/accounts/:account_id/macros/:id(.:format)                                                           api/v1/accounts/macros#update {:format=>"json"}
                                                            PUT      /api/v1/accounts/:account_id/macros/:id(.:format)                                                           api/v1/accounts/macros#update {:format=>"json"}
                                                            DELETE   /api/v1/accounts/:account_id/macros/:id(.:format)                                                           api/v1/accounts/macros#destroy {:format=>"json"}
                                                            POST     /api/v1/accounts/:account_id/ai_attendant_configs(.:format)                                                 api/v1/accounts/ai_attendant_configs#create {:format=>"json"}
                                                            PATCH    /api/v1/accounts/:account_id/ai_attendant_configs/:id(.:format)                                             api/v1/accounts/ai_attendant_configs#update {:format=>"json"}
                                                            PUT      /api/v1/accounts/:account_id/ai_attendant_configs/:id(.:format)                                             api/v1/accounts/ai_attendant_configs#update {:format=>"json"}
                                                            DELETE   /api/v1/accounts/:account_id/ai_attendant_configs/:id(.:format)                                             api/v1/accounts/ai_attendant_configs#destroy {:format=>"json"}
                                                            POST     /api/v1/accounts/:account_id/sla_policies(.:format)                                                         api/v1/accounts/sla_policies#create {:format=>"json"}
                                                            PATCH    /api/v1/accounts/:account_id/sla_policies/:id(.:format)                                                     api/v1/accounts/sla_policies#update {:format=>"json"}
                                                            PUT      /api/v1/accounts/:account_id/sla_policies/:id(.:format)                                                     api/v1/accounts/sla_policies#update {:format=>"json"}
                                                            DELETE   /api/v1/accounts/:account_id/sla_policies/:id(.:format)                                                     api/v1/accounts/sla_policies#destroy {:format=>"json"}
                                                            POST     /api/v1/accounts/:account_id/custom_roles(.:format)                                                         api/v1/accounts/custom_roles#create {:format=>"json"}
                                                            PATCH    /api/v1/accounts/:account_id/custom_roles/:id(.:format)                                                     api/v1/accounts/custom_roles#update {:format=>"json"}
                                                            PUT      /api/v1/accounts/:account_id/custom_roles/:id(.:format)                                                     api/v1/accounts/custom_roles#update {:format=>"json"}
                                                            DELETE   /api/v1/accounts/:account_id/custom_roles/:id(.:format)                                                     api/v1/accounts/custom_roles#destroy {:format=>"json"}
                                                            POST     /api/v1/accounts/:account_id/campaigns(.:format)                                                            api/v1/accounts/campaigns#create {:format=>"json"}
                                                            PATCH    /api/v1/accounts/:account_id/campaigns/:id(.:format)                                                        api/v1/accounts/campaigns#update {:format=>"json"}
                                                            PUT      /api/v1/accounts/:account_id/campaigns/:id(.:format)                                                        api/v1/accounts/campaigns#update {:format=>"json"}
                                                            DELETE   /api/v1/accounts/:account_id/campaigns/:id(.:format)                                                        api/v1/accounts/campaigns#destroy {:format=>"json"}
                                                            POST     /api/v1/accounts/:account_id/dashboard_apps(.:format)                                                       api/v1/accounts/dashboard_apps#create {:format=>"json"}
                                                            PATCH    /api/v1/accounts/:account_id/dashboard_apps/:id(.:format)                                                   api/v1/accounts/dashboard_apps#update {:format=>"json"}
                                                            PUT      /api/v1/accounts/:account_id/dashboard_apps/:id(.:format)                                                   api/v1/accounts/dashboard_apps#update {:format=>"json"}
                                                            DELETE   /api/v1/accounts/:account_id/dashboard_apps/:id(.:format)                                                   api/v1/accounts/dashboard_apps#destroy {:format=>"json"}
                                                            POST     /api/v1/accounts/:account_id/channels/notifica_me_channel(.:format)                                         api/v1/accounts/channels/notifica_me_channels#create {:format=>"json"}
                                                            POST     /api/v1/accounts/:account_id/conversations/:conversation_id/messages(.:format)                              api/v1/accounts/conversations/messages#create {:format=>"json"}
                                                            POST     /api/v1/accounts/:account_id/conversations/:conversation_id/labels(.:format)                                api/v1/accounts/conversations/labels#create {:format=>"json"}
                                                            PATCH    /api/v1/accounts/:account_id/conversations/:conversation_id/participants(.:format)                          api/v1/accounts/conversations/participants#update {:format=>"json"}
                                                            PUT      /api/v1/accounts/:account_id/conversations/:conversation_id/participants(.:format)                          api/v1/accounts/conversations/participants#update {:format=>"json"}
                                                            DELETE   /api/v1/accounts/:account_id/conversations/:conversation_id/participants(.:format)                          api/v1/accounts/conversations/participants#destroy {:format=>"json"}
                                                            POST     /api/v1/accounts/:account_id/conversations/:conversation_id/participants(.:format)                          api/v1/accounts/conversations/participants#create {:format=>"json"}
                                                            PATCH    /api/v1/accounts/:account_id/conversations/:conversation_id/draft_messages(.:format)                        api/v1/accounts/conversations/draft_messages#update {:format=>"json"}
                                                            PUT      /api/v1/accounts/:account_id/conversations/:conversation_id/draft_messages(.:format)                        api/v1/accounts/conversations/draft_messages#update {:format=>"json"}
                                                            DELETE   /api/v1/accounts/:account_id/conversations/:conversation_id/draft_messages(.:format)                        api/v1/accounts/conversations/draft_messages#destroy {:format=>"json"}
                                                            POST     /api/v1/accounts/:account_id/conversations(.:format)                                                        api/v1/accounts/conversations#create {:format=>"json"}
                                                            PATCH    /api/v1/accounts/:account_id/conversations/:id(.:format)                                                    api/v1/accounts/conversations#update {:format=>"json"}
                                                            PUT      /api/v1/accounts/:account_id/conversations/:id(.:format)                                                    api/v1/accounts/conversations#update {:format=>"json"}
                                                            POST     /api/v1/accounts/:account_id/activities(.:format)                                                           api/v1/accounts/activities#create {:format=>"json"}
                                                            PATCH    /api/v1/accounts/:account_id/activities/:id(.:format)                                                       api/v1/accounts/activities#update {:format=>"json"}
                                                            PUT      /api/v1/accounts/:account_id/activities/:id(.:format)                                                       api/v1/accounts/activities#update {:format=>"json"}
                                                            DELETE   /api/v1/accounts/:account_id/activities/:id(.:format)                                                       api/v1/accounts/activities#destroy {:format=>"json"}
                                                            POST     /api/v1/accounts/:account_id/contacts/:contact_id/labels(.:format)                                          api/v1/accounts/contacts/labels#create {:format=>"json"}
                                                            POST     /api/v1/accounts/:account_id/contacts/:contact_id/notes(.:format)                                           api/v1/accounts/contacts/notes#create {:format=>"json"}
                                                            PATCH    /api/v1/accounts/:account_id/contacts/:contact_id/notes/:id(.:format)                                       api/v1/accounts/contacts/notes#update {:format=>"json"}
                                                            PUT      /api/v1/accounts/:account_id/contacts/:contact_id/notes/:id(.:format)                                       api/v1/accounts/contacts/notes#update {:format=>"json"}
                                                            DELETE   /api/v1/accounts/:account_id/contacts/:contact_id/notes/:id(.:format)                                       api/v1/accounts/contacts/notes#destroy {:format=>"json"}
                                                            DELETE   /api/v1/accounts/:account_id/contacts/:contact_id/contact_attribute_files(.:format)                         api/v1/accounts/contacts/contact_attribute_files#destroy {:format=>"json"}
                                                            PATCH    /api/v1/accounts/:account_id/contacts/:contact_id/pipeline_positions/:pipeline_id(.:format)                 api/v1/accounts/contacts/pipeline_positions#update {:format=>"json"}
                                                            DELETE   /api/v1/accounts/:account_id/contacts/:contact_id/pipeline_positions/:pipeline_id(.:format)                 api/v1/accounts/contacts/pipeline_positions#destroy {:format=>"json"}
                                                            POST     /api/v1/accounts/:account_id/contacts(.:format)                                                             api/v1/accounts/contacts#create {:format=>"json"}
                                                            PATCH    /api/v1/accounts/:account_id/contacts/:id(.:format)                                                         api/v1/accounts/contacts#update {:format=>"json"}
                                                            PUT      /api/v1/accounts/:account_id/contacts/:id(.:format)                                                         api/v1/accounts/contacts#update {:format=>"json"}
                                                            DELETE   /api/v1/accounts/:account_id/contacts/:id(.:format)                                                         api/v1/accounts/contacts#destroy {:format=>"json"}
                                                            GET      /api/v1/accounts/:account_id/contacts/pipeline_positions/:pipeline_id/stats(.:format)                       api/v1/accounts/contacts/pipeline_positions#stats {:format=>"json"}
                                                            GET      /api/v1/accounts/:account_id/contacts/pipeline_positions/:pipeline_id/dashboard_stats(.:format)             api/v1/accounts/contacts/pipeline_positions#dashboard_stats {:format=>"json"}
                                                            POST     /api/v1/accounts/:account_id/custom_attribute_definitions(.:format)                                         api/v1/accounts/custom_attribute_definitions#create {:format=>"json"}
                                                            PATCH    /api/v1/accounts/:account_id/custom_attribute_definitions/:id(.:format)                                     api/v1/accounts/custom_attribute_definitions#update {:format=>"json"}
                                                            PUT      /api/v1/accounts/:account_id/custom_attribute_definitions/:id(.:format)                                     api/v1/accounts/custom_attribute_definitions#update {:format=>"json"}
                                                            DELETE   /api/v1/accounts/:account_id/custom_attribute_definitions/:id(.:format)                                     api/v1/accounts/custom_attribute_definitions#destroy {:format=>"json"}
                                                            POST     /api/v1/accounts/:account_id/custom_filters(.:format)                                                       api/v1/accounts/custom_filters#create {:format=>"json"}
                                                            PATCH    /api/v1/accounts/:account_id/custom_filters/:id(.:format)                                                   api/v1/accounts/custom_filters#update {:format=>"json"}
                                                            PUT      /api/v1/accounts/:account_id/custom_filters/:id(.:format)                                                   api/v1/accounts/custom_filters#update {:format=>"json"}
                                                            DELETE   /api/v1/accounts/:account_id/custom_filters/:id(.:format)                                                   api/v1/accounts/custom_filters#destroy {:format=>"json"}
                                                            POST     /api/v1/accounts/:account_id/inboxes/:inbox_id/csat_template(.:format)                                      api/v1/accounts/inbox_csat_templates#create {:format=>"json"}
                                                            POST     /api/v1/accounts/:account_id/inboxes(.:format)                                                              api/v1/accounts/inboxes#create {:format=>"json"}
                                                            PATCH    /api/v1/accounts/:account_id/inboxes/:id(.:format)                                                          api/v1/accounts/inboxes#update {:format=>"json"}
                                                            PUT      /api/v1/accounts/:account_id/inboxes/:id(.:format)                                                          api/v1/accounts/inboxes#update {:format=>"json"}
                                                            DELETE   /api/v1/accounts/:account_id/inboxes/:id(.:format)                                                          api/v1/accounts/inboxes#destroy {:format=>"json"}
                                                            PATCH    /api/v1/accounts/:account_id/inbox_members(.:format)                                                        api/v1/accounts/inbox_members#update {:format=>"json"}
                                                            POST     /api/v1/accounts/:account_id/inbox_members(.:format)                                                        api/v1/accounts/inbox_members#create {:format=>"json"}
                                                            POST     /api/v1/accounts/:account_id/labels(.:format)                                                               api/v1/accounts/labels#create {:format=>"json"}
                                                            PATCH    /api/v1/accounts/:account_id/labels/:id(.:format)                                                           api/v1/accounts/labels#update {:format=>"json"}
                                                            PUT      /api/v1/accounts/:account_id/labels/:id(.:format)                                                           api/v1/accounts/labels#update {:format=>"json"}
                                                            DELETE   /api/v1/accounts/:account_id/labels/:id(.:format)                                                           api/v1/accounts/labels#destroy {:format=>"json"}
                                                            POST     /api/v1/accounts/:account_id/label_groups(.:format)                                                         api/v1/accounts/label_groups#create {:format=>"json"}
                                                            PATCH    /api/v1/accounts/:account_id/label_groups/:id(.:format)                                                     api/v1/accounts/label_groups#update {:format=>"json"}
                                                            PUT      /api/v1/accounts/:account_id/label_groups/:id(.:format)                                                     api/v1/accounts/label_groups#update {:format=>"json"}
                                                            DELETE   /api/v1/accounts/:account_id/label_groups/:id(.:format)                                                     api/v1/accounts/label_groups#destroy {:format=>"json"}
                                                            PUT      /api/v1/accounts/:account_id/notifications/:id(.:format)                                                    api/v1/accounts/notifications#update {:format=>"json"}
                                                            DELETE   /api/v1/accounts/:account_id/notifications/:id(.:format)                                                    api/v1/accounts/notifications#destroy {:format=>"json"}
                                                            PATCH    /api/v1/accounts/:account_id/notification_settings(.:format)                                                api/v1/accounts/notification_settings#update {:format=>"json"}
                                                            PUT      /api/v1/accounts/:account_id/notification_settings(.:format)                                                api/v1/accounts/notification_settings#update {:format=>"json"}
                                                            PATCH    /api/v1/accounts/:account_id/teams/:team_id/team_members(.:format)                                          api/v1/accounts/team_members#update {:format=>"json"}
                                                            GET      /api/v1/accounts/:account_id/teams/:team_id/team_members(.:format)                                          api/v1/accounts/team_members#index {:format=>"json"}
                                                            POST     /api/v1/accounts/:account_id/teams/:team_id/team_members(.:format)                                          api/v1/accounts/team_members#create {:format=>"json"}
                                                            POST     /api/v1/accounts/:account_id/teams(.:format)                                                                api/v1/accounts/teams#create {:format=>"json"}
                                                            PATCH    /api/v1/accounts/:account_id/teams/:id(.:format)                                                            api/v1/accounts/teams#update {:format=>"json"}
                                                            PUT      /api/v1/accounts/:account_id/teams/:id(.:format)                                                            api/v1/accounts/teams#update {:format=>"json"}
                                                            DELETE   /api/v1/accounts/:account_id/teams/:id(.:format)                                                            api/v1/accounts/teams#destroy {:format=>"json"}
                                                            POST     /api/v1/accounts/:account_id/webhooks(.:format)                                                             api/v1/accounts/webhooks#create {:format=>"json"}
                                                            PUT      /api/v1/accounts/:account_id/webhooks/:id(.:format)                                                         api/v1/accounts/webhooks#update {:format=>"json"}
                                                            DELETE   /api/v1/accounts/:account_id/webhooks/:id(.:format)                                                         api/v1/accounts/webhooks#destroy {:format=>"json"}
                                                            PATCH    /api/v1/accounts/:account_id/integrations/hooks/:id(.:format)                                               api/v1/accounts/integrations/hooks#update {:format=>"json"}
                                                            PUT      /api/v1/accounts/:account_id/integrations/hooks/:id(.:format)                                               api/v1/accounts/integrations/hooks#update {:format=>"json"}
                                                            DELETE   /api/v1/accounts/:account_id/integrations/hooks/:id(.:format)                                               api/v1/accounts/integrations/hooks#destroy {:format=>"json"}
                                                            PUT      /api/v1/accounts/:account_id/integrations/slack(.:format)                                                   api/v1/accounts/integrations/slack#update {:format=>"json"}
                                                            DELETE   /api/v1/accounts/:account_id/integrations/slack(.:format)                                                   api/v1/accounts/integrations/slack#destroy {:format=>"json"}
                                                            POST     /api/v1/accounts/:account_id/integrations/slack(.:format)                                                   api/v1/accounts/integrations/slack#create {:format=>"json"}
                                                            PUT      /api/v1/accounts/:account_id/working_hours/:id(.:format)                                                    api/v1/accounts/working_hours#update {:format=>"json"}
                                                            POST     /api/v1/accounts/:account_id/portals/:portal_id/categories(.:format)                                        api/v1/accounts/categories#create {:format=>"json"}
                                                            PATCH    /api/v1/accounts/:account_id/portals/:portal_id/categories/:id(.:format)                                    api/v1/accounts/categories#update {:format=>"json"}
                                                            PUT      /api/v1/accounts/:account_id/portals/:portal_id/categories/:id(.:format)                                    api/v1/accounts/categories#update {:format=>"json"}
                                                            DELETE   /api/v1/accounts/:account_id/portals/:portal_id/categories/:id(.:format)                                    api/v1/accounts/categories#destroy {:format=>"json"}
                                                            POST     /api/v1/accounts/:account_id/portals/:portal_id/articles(.:format)                                          api/v1/accounts/articles#create {:format=>"json"}
                                                            PATCH    /api/v1/accounts/:account_id/portals/:portal_id/articles/:id(.:format)                                      api/v1/accounts/articles#update {:format=>"json"}
                                                            PUT      /api/v1/accounts/:account_id/portals/:portal_id/articles/:id(.:format)                                      api/v1/accounts/articles#update {:format=>"json"}
                                                            DELETE   /api/v1/accounts/:account_id/portals/:portal_id/articles/:id(.:format)                                      api/v1/accounts/articles#destroy {:format=>"json"}
                                                            POST     /api/v1/accounts/:account_id/portals(.:format)                                                              api/v1/accounts/portals#create {:format=>"json"}
                                                            PATCH    /api/v1/accounts/:account_id/portals/:id(.:format)                                                          api/v1/accounts/portals#update {:format=>"json"}
                                                            PUT      /api/v1/accounts/:account_id/portals/:id(.:format)                                                          api/v1/accounts/portals#update {:format=>"json"}
                                                            DELETE   /api/v1/accounts/:account_id/portals/:id(.:format)                                                          api/v1/accounts/portals#destroy {:format=>"json"}
                                                            PATCH    /api/v1/accounts/:id(.:format)                                                                              api/v1/accounts#update {:format=>"json"}
                                                            PUT      /api/v1/accounts/:id(.:format)                                                                              api/v1/accounts#update {:format=>"json"}
                                                            POST     /api/v1/announcements(.:format)                                                                             api/v1/announcements#create {:format=>"json"}
                                                            PUT      /api/v1/announcements/:id(.:format)                                                                         api/v1/announcements#update {:format=>"json"}
                                                            DELETE   /api/v1/announcements/:id(.:format)                                                                         api/v1/announcements#destroy {:format=>"json"}
                                                            PATCH    /api/v1/profile(.:format)                                                                                   api/v1/profiles#update {:format=>"json"}
                                                            PUT      /api/v1/profile(.:format)                                                                                   api/v1/profiles#update {:format=>"json"}
                                                            POST     /api/v1/notification_subscriptions(.:format)                                                                api/v1/notification_subscriptions#create {:format=>"json"}
                                                            POST     /api/v1/widget/messages(.:format)                                                                           api/v1/widget/messages#create {:format=>"json"}
                                                            PUT      /api/v1/widget/messages/:id(.:format)                                                                       api/v1/widget/messages#update {:format=>"json"}
                                                            POST     /api/v1/widget/conversations(.:format)                                                                      api/v1/widget/conversations#create {:format=>"json"}
                                                            PATCH    /api/v1/widget/contact(.:format)                                                                            api/v1/widget/contacts#update {:format=>"json"}
                                                            PUT      /api/v1/widget/contact(.:format)                                                                            api/v1/widget/contacts#update {:format=>"json"}
                                                            POST     /enterprise/api/v1/accounts(.:format)                                                                       enterprise/api/v1/accounts#create {:format=>"json"}
                                                            PATCH    /enterprise/api/v1/accounts/:id(.:format)                                                                   enterprise/api/v1/accounts#update {:format=>"json"}
                                                            PUT      /enterprise/api/v1/accounts/:id(.:format)                                                                   enterprise/api/v1/accounts#update {:format=>"json"}
                                                            DELETE   /enterprise/api/v1/accounts/:id(.:format)                                                                   enterprise/api/v1/accounts#destroy {:format=>"json"}
                                                            PATCH    /platform/api/v1/users/:id(.:format)                                                                        platform/api/v1/users#update {:format=>"json"}
                                                            PUT      /platform/api/v1/users/:id(.:format)                                                                        platform/api/v1/users#update {:format=>"json"}
                                                            DELETE   /platform/api/v1/users/:id(.:format)                                                                        platform/api/v1/users#destroy {:format=>"json"}
                                                            POST     /platform/api/v1/agent_bots(.:format)                                                                       platform/api/v1/agent_bots#create {:format=>"json"}
                                                            PATCH    /platform/api/v1/agent_bots/:id(.:format)                                                                   platform/api/v1/agent_bots#update {:format=>"json"}
                                                            PUT      /platform/api/v1/agent_bots/:id(.:format)                                                                   platform/api/v1/agent_bots#update {:format=>"json"}
                                                            DELETE   /platform/api/v1/agent_bots/:id(.:format)                                                                   platform/api/v1/agent_bots#destroy {:format=>"json"}
                                                            GET      /platform/api/v1/accounts/:account_id/account_users(.:format)                                               platform/api/v1/account_users#index {:format=>"json"}
                                                            POST     /platform/api/v1/accounts/:account_id/account_users(.:format)                                               platform/api/v1/account_users#create {:format=>"json"}
                                                            PATCH    /platform/api/v1/accounts/:id(.:format)                                                                     platform/api/v1/accounts#update {:format=>"json"}
                                                            PUT      /platform/api/v1/accounts/:id(.:format)                                                                     platform/api/v1/accounts#update {:format=>"json"}
                                                            DELETE   /platform/api/v1/accounts/:id(.:format)                                                                     platform/api/v1/accounts#destroy {:format=>"json"}
                                                            POST     /public/api/v1/inboxes/:inbox_id/contacts/:contact_id/conversations/:conversation_id/messages(.:format)     public/api/v1/inboxes/messages#create {:format=>"json"}
                                                            PUT      /public/api/v1/inboxes/:inbox_id/contacts/:contact_id/conversations/:conversation_id/messages/:id(.:format) public/api/v1/inboxes/messages#update {:format=>"json"}
                                                            POST     /public/api/v1/inboxes/:inbox_id/contacts/:contact_id/conversations(.:format)                               public/api/v1/inboxes/conversations#create {:format=>"json"}
                                                            PATCH    /public/api/v1/inboxes/:inbox_id/contacts/:id(.:format)                                                     public/api/v1/inboxes/contacts#update {:format=>"json"}
                                                            PUT      /public/api/v1/inboxes/:inbox_id/contacts/:id(.:format)                                                     public/api/v1/inboxes/contacts#update {:format=>"json"}
                                                            POST     /public/api/v1/inboxes(.:format)                                                                            public/api/v1/inboxes#create {:format=>"json"}
                                                            PATCH    /public/api/v1/inboxes/:id(.:format)                                                                        public/api/v1/inboxes#update {:format=>"json"}
                                                            PUT      /public/api/v1/inboxes/:id(.:format)                                                                        public/api/v1/inboxes#update {:format=>"json"}
                                                            DELETE   /public/api/v1/inboxes/:id(.:format)                                                                        public/api/v1/inboxes#destroy {:format=>"json"}
                                                            PATCH    /public/api/v1/csat_survey/:id(.:format)                                                                    public/api/v1/csat_survey#update {:format=>"json"}
                                                            PUT      /public/api/v1/csat_survey/:id(.:format)                                                                    public/api/v1/csat_survey#update {:format=>"json"}
                                                            GET      /hc/:slug(.:format)                                                                                         public/api/v1/portals#show
                                                            GET      /hc/:slug/sitemap.xml(.:format)                                                                             public/api/v1/portals#sitemap
                                                            GET      /hc/:slug/:locale(.:format)                                                                                 public/api/v1/portals#show
                                                            GET      /hc/:slug/:locale/articles(.:format)                                                                        public/api/v1/portals/articles#index
                                                            GET      /hc/:slug/:locale/categories(.:format)                                                                      public/api/v1/portals/categories#index
                                                            GET      /hc/:slug/:locale/categories/:category_slug(.:format)                                                       public/api/v1/portals/categories#show
                                                            GET      /hc/:slug/:locale/categories/:category_slug/articles(.:format)                                              public/api/v1/portals/articles#index
                                                            GET      /hc/:slug/articles/:article_slug(.:format)                                                                  public/api/v1/portals/articles#show
                                                            POST     /api/v1/accounts/:account_id/account_forms(.:format)                                                        api/v1/accounts/account_forms#create {:format=>"json"}
                                                            PATCH    /api/v1/accounts/:account_id/account_forms/:id(.:format)                                                    api/v1/accounts/account_forms#update {:format=>"json"}
                                                            PUT      /api/v1/accounts/:account_id/account_forms/:id(.:format)                                                    api/v1/accounts/account_forms#update {:format=>"json"}
                                                            DELETE   /api/v1/accounts/:account_id/account_forms/:id(.:format)                                                    api/v1/accounts/account_forms#destroy {:format=>"json"}
                                                            POST     /public/api/v1/account_forms/:account_id/:slug/submit(.:format)                                             public/api/v1/account_forms#submit {:format=>"json"}
```

---

## Anexo B — Extensões desta instalação (além do Chatwoot OSS)

Recursos adicionais expostos na API v1 da conta:

- **Workflows** (`/workflows`, `/workflow_schedules`, matrículas na conversa)
- **Automações** (`/automation_rules`)
- **Campanhas** (`/campaigns` com pause/resume/stop)
- **AI / Capitão** (`/ai_attendant_configs`, `toggle_capitao` na conversa)
- **Atividades** (`/activities`)
- **Formulários** (filtro `account_form_id` em contatos)

Consulte o Swagger ou o Anexo A para URIs exatas.

---

*Documento gerado no servidor Chatwoot. Para dúvidas de contrato de payload, priorize o Swagger em https://app.manytalks.com.br/swagger e este arquivo para Kanban/etiquetas.*
