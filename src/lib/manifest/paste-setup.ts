import type { ManifestV1 } from "@/lib/types/manifest";
import { appUrl } from "@/lib/utils";
import { assembleGrokInstruction, compileRuntimeSystem } from "@/lib/manifest/system-prompt";

/**
 * Prompt único colável: arquitetura + limites + token grk_live + passos de webhook.
 * Gerado só no admin (nunca grava o token no snapshot publicado).
 */
export function buildPasteableGrokBotSetup(input: {
  manifest: ManifestV1;
  runtimeToken: string;
}): string {
  const base = appUrl();
  const registerUrl = `${base}/api/library/v1/outbound-webhook`;
  const manifestUrl = `${base}/api/library/v1/manifest`;
  const token = input.runtimeToken;
  const m = input.manifest;
  const inboxes = m.manytalks.enabled_inbox_ids.join(", ") || "(nenhuma)";
  const labels = m.labels.allowed_titles.join(", ") || "(nenhuma)";
  const stages = m.kanban.stages_allowed.join(", ") || "(nenhuma)";
  const pauseLabels = m.labels.pause_bot_on.join(", ") || "(nenhuma)";
  const pauseStages = m.kanban.pause_bot_stages.join(", ") || "(nenhuma)";

  const systemCore = assembleGrokInstruction(
    m,
    compileRuntimeSystem({
      tools: m.tools_policy,
      labels: m.labels,
      kanban: {
        pipeline_id: m.kanban.pipeline_id,
        stages_allowed: m.kanban.stages_allowed,
        pause_bot_stages: m.kanban.pause_bot_stages,
        stage_rules: m.kanban.stage_rules,
      },
      asaas: {
        environment: m.asaas.environment,
        allow_payment_link: m.asaas.allow_payment_link,
        allow_pix_copy: m.asaas.allow_pix_copy,
      },
      hasKnowledge: (m.prompt.knowledge_entries?.length ?? 0) > 0,
      executeToolsBeforeReply: m.conversation_rules.execute_tools_before_reply,
    }),
  );

  return `# ManyTalks Bot — configuração em um único prompt
ManyTalks Bot: ${m.grokbot.name} (${m.grokbot.id})
Account ManyTalks: ${m.manytalks.account_id}
Inboxes liberadas: ${inboxes}
Etiquetas: ${labels}
Kanban colunas: ${stages} | pipeline_id: ${m.kanban.pipeline_id ?? "null"}
Pausar bot em etiquetas: ${pauseLabels}
Pausar bot em estágios: ${pauseStages}

## Como funciona (leia antes de agir)
1. ManyTalks já envia message_created para a plataforma (${base}/api/hooks/manytalks).
2. A plataforma filtra account + inbox + regras e POSTa um envelope limpo no SEU webhook.
3. Você NÃO registra webhook no ManyTalks. Você cria um endpoint HTTPS e registra a URL na plataforma.
4. Sem o PUT de registro, nenhuma mensagem chega. Não peça grk_live_ ao operador — o token já está abaixo.

## Setup obrigatório (faça agora, nesta ordem)
A) Crie/use a rotina HTTPS que aceite POST JSON do envelope (seção abaixo).
B) No painel da rotina, copie: URL do webhook + nome do cabeçalho Authorization + valor da chave.
   Você NÃO enxerga esses valores — o operador/dev cola no PUT (não peça a chave no chat).
C) Registre na plataforma (operador ou você, se tiver os valores):

PUT ${registerUrl}
Authorization: Bearer ${token}
Content-Type: application/json

{
  "url": "URL_DO_PAINEL",
  "auth_header": "Authorization",
  "auth_value": "VALOR_EXATO_DO_PAINEL"
}

Notas: auth_header = nome exato do cabeçalho do painel (quase sempre Authorization).
auth_value = valor completo (ex. Bearer …). Campo legado "secret" ainda é aceito como alias de auth_value.
D) Se a resposta tiver "configured": true, avise: "Relay ativo."
E) Confirme com GET (mesmo Authorization):

GET ${registerUrl}
Authorization: Bearer ${token}

## Token e URLs (já preenchidos — use estes valores)
runtime_token: ${token}
manifest_url: ${manifestUrl}
outbound_register_url: ${registerUrl}
Nota: este token foi gerado ao copiar o prompt; trate como segredo. Se já vazou no chat, peça ao operador rotacionar.

## Envelope que a plataforma envia no seu webhook (POST)
Headers sempre: Content-Type: application/json, X-Grokbot-Id: ${m.grokbot.id}
Se auth_header + auth_value foram salvos no PUT, a plataforma também envia esse cabeçalho exato
(ex. Authorization: <auth_value>) — não usa X-Grokbot-Forward-Secret.

{
  "schema_version": "1.0",
  "event": "message_created",
  "grokbot_id": "${m.grokbot.id}",
  "manytalks": {
    "account_id": ${m.manytalks.account_id},
    "conversation_id": "...",
    "inbox_id": ${m.manytalks.enabled_inbox_ids[0] ?? 0},
    "contact_id": null,
    "contact_name": null,
    "status": "open",
    "message_id": "...",
    "from": "client",
    "content": "texto do cliente"
  },
  "labels": [],
  "received_at": "ISO-8601"
}

Filtros que a plataforma já aplica: só inboxes ${inboxes}; tipicamente só incoming público.
No seu lado: ignore se labels tiver ${pauseLabels || "(nenhuma de pausa)"}; ignore estágios ${pauseStages || "Ganho/Perdido/Fechado"} se souber a coluna.

## Depois do relay ativo — o que fazer com cada mensagem
- Responder / etiquetas / kanban via HTTP ManyTalks (api_runtime.manytalks.http).
- Kanban: PATCH {base}/api/v1/accounts/{account_id}/contacts/{contact_id}/pipeline_positions/{pipeline_id}
  body: {"stage_id":"Novo"} — contact_id no envelope; pipeline_id=${m.kanban.pipeline_id ?? "null"}; colunas: ${stages}.
- Evento opcional playbook_patterns no webhook: padrões (tom, venda vs suporte, gatilhos, silêncio, ranking de atendente) aprovados pelo operador.
- Mensagens saem com o nome do dono do PAT (esperado).

---
${systemCore}
`;
}
