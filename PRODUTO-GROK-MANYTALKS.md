# Produto — ManyTalks Bot (ManyTalks + Biblioteca + Asaas + Dashboard)

**Marca:** [BRAND.md](./BRAND.md). Nome de produto: **ManyTalks Bot** (unidade = 1 `manytalks_account_id`).

**Público do documento:** decisões de produto, usabilidade e escopo — base para o painel admin e para a implementação.

**Documentos relacionados:**

- [API-Manytalks.md](./API-Manytalks.md) — contrato HTTP ManyTalks  
- [PLANO-GROK-MANYTALKS.md](./PLANO-GROK-MANYTALKS.md) — conector, tools, webhooks, fases técnicas  

**Atualizado:** 2025-11-13  

---

## 1. Visão

Plataforma **operada só por você** com:

| Módulo | Função |
|--------|--------|
| **Biblioteca (API)** | **URL + token** → manifesto completo para o runtime; única fonte de verdade após *Publicar* |
| **Pacotes (templates)** | Reutilizáveis; compilados no manifest |
| **Painel admin** | Edita tudo; você **não redeploya** para mudar comportamento |
| **Runtime (fullstack)** | Webhooks + Grok + ManyTalks/Asaas; lê manifest |
| **Dashboard de vendas** | Por conta, **sempre com senha** |
| **xAI** | Uma conta sua; custo centralizado |

Arquitetura e stack: [PLANO-COMPLETO.md](./PLANO-COMPLETO.md) (Next.js + SQLite).

Clientes finais **não** acessam biblioteca nem admin. Atendentes continuam no **ManyTalks**.

---

## 2. Personas

| Persona | Acesso |
|---------|--------|
| **Você (operador)** | Painel completo, biblioteca, todos os GrokBots |
| **Cliente do ManyTalks** | Só dashboard de vendas (link + **senha obrigatória**) |
| **Contato final** | Conversa no canal (WhatsApp etc.) |

---

## 3. GrokBot (unidade de negócio)

- **1 GrokBot = 1 `manytalks_account_id`**  
- **1 bot por account** (várias inboxes, mesmo prompt/regras)  
- **Knowledge:** apenas campo de texto no onboarding  
- **Token ManyTalks:** você gera e cadastra no wizard  

### Ações que o Grok pode disparar (via conector)

1. Atender (mensagem `outgoing`)  
2. Etiquetas (merge)  
3. Kanban (`PATCH pipeline_positions`)  
4. **Asaas** — cobrança conforme modo configurado (ver §7)  

Demais APIs ManyTalks fora de escopo (assignee, status, etc.), salvo automações **determinísticas** pós-pagamento (§8).

---

## 4. Biblioteca (só você)

Pacotes versionados (`pré-vendas-v1`, `suporte-v1`, …). Conteúdo típico:

- Bloco de system prompt base  
- Whitelist e significado de etiquetas  
- Playbook kanban sugerido (importado para matriz no GrokBot)  
- Defaults Asaas (modos, textos, pós-pagamento)  
- Checklist ManyTalks (Capitão off, webhook, etiquetas a criar)  

**Fluxo:** novo GrokBot → escolhe pacote → ajusta knowledge + credenciais + overrides.

---

## 5. Painel admin — wizard (onboarding)

| # | Passo |
|---|--------|
| 1 | Identidade (nome interno, `account_id`) |
| 2 | ManyTalks (token, teste conexão, multiselect inboxes) |
| 3 | Pacote (biblioteca) |
| 4 | Knowledge (textarea) |
| 5 | **Kanban** — listar / **criar pipeline** (MVP) + **matriz de regras de estágio** |
| 6 | **Asaas** — conta/credenciais do cliente + split (§7) + modos cobrança + pós-pagamento (§8) |
| 7 | **Dashboard** — senha + gerar link; webhook ManyTalks/Asaas; ativar |

### Telas permanentes

- Lista GrokBots (saúde, último erro, toggles)  
- Detalhe GrokBot (editar tudo, logs, copiar link dashboard)  
- Biblioteca CRUD + duplicar/versionar  

---

## 6. Kanban (MVP must-have)

### Listar e escolher

- `GET custom_attribute_definitions?attribute_model=contact_attribute` → pipelines `is_kanban`  
- Seleção do pipeline principal do GrokBot  

### Criar pipeline no painel

- Formulário: nome, colunas (nome, cor), ordem  
- `POST custom_attribute_definitions` (conforme [API-Manytalks.md](./API-Manytalks.md) §7.2)  
- Se **403:** instrução clara (permissão CRM / criar no ManyTalks)  

### Matriz de regras de estágio (controle)

Por GrokBot, tabela editável:

| Campo | Descrição |
|-------|-----------|
| Nome interno | Referência sua |
| Condição | Descrição que entra no system + validação lógica |
| `stage_id` destino | Dropdown das colunas do pipeline |
| Etiquetas opcionais | Ao mover |
| Prioridade | Ordem de avaliação |
| Ativa | Sim/não |

Conector:

- Injeta regras no system do Grok  
- `move_kanban_card` só aceita destinos presentes na matriz + whitelist  
- Webhook `contact_kanban_stage_changed` pode pausar bot em estágios finais  

---

## 7. Asaas — conta por GrokBot + split

### Modelo acordado

- **Uma conta Asaas (subconta / wallet) por GrokBot (cliente)** — não uma chave global sua para todos.  
- **Split de pagamento** configurado **no Asaas** conforme acordo comercial da reunião; o Asaas **executa o split** na liquidação — o conector **não recalcula** percentuais, só usa a API com a conta/cobrança correta.  

### Onboarding Asaas (wizard)

| Campo | Uso |
|-------|-----|
| Ambiente | Sandbox / produção |
| `api_key` (ou credencial da subconta) | Criptografada em repouso |
| Referência interna | ID subconta / wallet se aplicável |
| **Split** | Campo informativo + link “configurado no painel Asaas” **ou** IDs de split/regra que a API exija na criação da cobrança (preencher quando o contrato técnico Asaas estiver fechado) |
| Teste | Cobrança simbólica sandbox |

**Utilidade:** cada cliente vê seus recebíveis; sua parte vem do split Asaas, não de conciliação manual no GrokBot.

### Modos de cobrança (configurável por GrokBot)

| Modo | Cliente recebe | Quando usar |
|------|----------------|-------------|
| **Link de pagamento** | URL checkout (PIX + boleto + cartão) | Padrão omnichannel |
| **PIX copia e cola** | Código / instrução na mensagem | Conversas onde link é ruim |

Wizard: checkboxes “Permitir link” / “Permitir PIX copia e cola” (pelo menos um ativo).

Tools (conector):

- `create_payment_link` (ou equivalente API Asaas)  
- `create_pix_charge` (payload copia e cola)  

Regra: Grok só chama após confirmação explícita de valor/produto; modos desligados não são oferecidos no prompt.

### Webhook Asaas

- Endpoint por GrokBot ou global com roteamento por `customer`/metadata  
- Eventos: pago, vencido, cancelado  
- Persistir em `payment_events` para dashboard  

---

## 8. Pós-pagamento (configurável no onboarding)

Duas opções **independentes** (ligar/desligar cada uma):

| Opção | Comportamento |
|-------|----------------|
| **A — CRM** | Atualizar etiquetas + mover estágio kanban (valores configuráveis) |
| **B — Mensagem** | `POST` mensagem automática ManyTalks com template (`{{nome}}`, `{{valor}}`, …) |

Executado pelo **conector** no webhook Asaas — não pelo LLM.

---

## 9. Dashboard de vendas (por GrokBot)

### Política de acesso (decisão fechada)

- **Não há modo público anônimo** com dados de clientes.  
- **Senha sempre obrigatória** para acessar qualquer informação que identifique ou detalhe clientes/leads.  
- URL pode ser “não listada” (slug UUID) mas **sem senha = sem acesso** (tela só de login).  

### O que exibe (com login)

- Resumo financeiro do período (Asaas: criado vs pago, ticket médio)  
- Funil por estágio (kanban do GrokBot)  
- Pagamentos e conversões  
- Atividade do bot (cobranças geradas)  
- Lista agregada ou detalhada conforme permissão futura — **detalhe com nome de contato só após autenticação**  

### Onboarding dashboard

- Definir senha (mínimo, rotação opcional “gerar nova senha”)  
- Copiar link `/d/{slug}`  
- Opcional: regenerar slug (invalida link antigo)  

### Segurança

- `noindex`, rate limit, senha com hash forte  
- Sessão com cookie após login (ex.: 7–30 dias)  
- Logs de acesso ao dashboard  

---

## 10. O que fornecer ao Grok (resumo)

| Origem | Conteúdo |
|--------|----------|
| Pacote + knowledge | System prompt e políticas |
| Matriz kanban | Regras de estágio estruturadas |
| Modos Asaas | O que o bot pode oferecer |
| Por mensagem | Histórico + contexto conversa/contato/kanban |

**Não** enviar ao Grok: tokens ManyTalks, API key Asaas, senha do dashboard.

---

## 11. Arquitetura lógica

```text
ManyTalks ──webhook──► Conector ◄──webhook── Asaas
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
           xAI Grok    PostgreSQL    Painel admin
                           │
                           └──► Dashboard (/d/{slug} + senha)
```

- **Biblioteca** e configs em DB  
- **Eventos** (mensagens, cobranças, pagamentos, movimentos kanban) alimentam o dashboard  

---

## 12. Entrega

Escopo **integral** em uma release — ver [PLANO-COMPLETO.md](./PLANO-COMPLETO.md) (checklist UAT, módulos M1–M8, sem releases parciais).

---

## 13. Pendências técnicas Asaas (fechar com doc oficial)

1. Campos exatos na API para **split** na criação de cobrança vs split só no painel da subconta.  
2. Webhook por subconta vs conta master.  
3. Sandbox espelhando split.  

Registrar aqui quando a reunião virar contrato de campos no wizard (IDs de split, percentuais fixos, etc.).

---

## 14. Defaults aceitos

| Tópico | Default |
|--------|---------|
| Dashboard público sem senha | **Removido** — só link + senha |
| Regenerar slug dashboard | Invalida link anterior |
| xAI | Chave global no servidor |
| Multi-marca | 1 bot / 1 account ManyTalks |

---

*Este documento prevalece sobre rascunhos de chat para produto, usabilidade e segurança do dashboard. O [PLANO-GROK-MANYTALKS.md](./PLANO-GROK-MANYTALKS.md) deve ganhar anexo Asaas + dashboard na fase de implementação.*
