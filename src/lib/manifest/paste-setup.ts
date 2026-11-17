import type { ManifestV1 } from "@/lib/types/manifest";
import { toolsFromPolicy } from "@/lib/grok/tools";
import { kanbanStagesAllowed } from "@/lib/manifest/system-prompt";
import { appUrl } from "@/lib/utils";

function enabledTools(m: ManifestV1): string[] {
  return toolsFromPolicy(m).map((t) => (t as { function: { name: string } }).function.name);
}

/** Prompt curto para chat novo do Grok — sem setup de relay/Cursor nem API ManyTalks direta. */
export function buildPasteableGrokBotSetup(input: {
  manifest: ManifestV1;
  runtimeToken: string;
}): string {
  const base = appUrl();
  const manifestUrl = `${base}/api/library/v1/manifest`;
  const toolsUrl = `${base}/api/library/v1/tools`;
  const token = input.runtimeToken;
  const m = input.manifest;
  const tools = enabledTools(m);
  const inboxes = m.manytalks.enabled_inbox_ids.join(", ");
  const labels =
    m.labels.allowed_titles.length > 0 ? m.labels.allowed_titles.join(", ") : "ver GET /manifest";
  const stages = kanbanStagesAllowed({
    pipeline_id: m.kanban.pipeline_id,
    stages_allowed: m.kanban.stages_allowed,
    pause_bot_stages: m.kanban.pause_bot_stages,
    stage_rules: m.kanban.stage_rules,
  });
  const knowledgeNote =
    (m.prompt.knowledge_entries?.length ?? 0) > 0 || m.prompt.knowledge.trim()
      ? "Knowledge completa em GET /manifest."
      : "Sem knowledge cadastrada.";

  const runtimeJson = {
    grokbot_id: m.grokbot.id,
    account_id: m.manytalks.account_id,
    inboxes: m.manytalks.enabled_inbox_ids,
    auth: `Bearer ${token}`,
    manifest_url: manifestUrl,
    tools_url: toolsUrl,
    tools_enabled: tools,
    webhook_events: ["message_created", "manifest_published", "integration_test"],
    conversation_id: "display_id no envelope (não é o id interno)",
    limits: {
      labels_allowed: m.labels.allowed_titles,
      labels_pause_bot: m.labels.pause_bot_on,
      kanban_pipeline_id: m.kanban.pipeline_id,
      kanban_stages_allowed: stages,
    },
  };

  return `# ${m.grokbot.name} — atendimento ManyTalks (conta ${m.manytalks.account_id})

Você atende conversas da inbox **${inboxes}**. O operador já configurou relay e publicou o manifest — **não peça** tokens, chaves ou PAT ao operador.

## Sua API (única)
Todas as chamadas: header \`Authorization: Bearer ${token}\`

1. **GET** \`${manifestUrl}\` — prompt, knowledge, regras (${knowledgeNote})
2. **POST** \`${toolsUrl}\` — executar ação no ManyTalks/Asaas (o servidor guarda credenciais)

Corpo do POST /tools:
\`\`\`json
{"name":"send_reply","conversation_id":"<do envelope>","contact_id":null,"arguments":{"content":"..."}}
\`\`\`

Tools ativas: ${tools.join(", ")}.
Contatos: pode criar/editar (search_contacts, create_contact, update_contact). **Nunca** excluir contato.
Para falar com alguém sem conversa aberta: **start_conversation** (1 chamada — servidor cria/abre/atribui). Na rotina normal (cliente escreveu), use só **send_reply** — o servidor já pode ter atribuído você (campo manytalks.auto_assigned no envelope).

## Quando chegar POST no seu webhook
| event | ação |
|-------|------|
| message_created | GET /manifest se ainda não carregou nesta sessão; responda com POST /tools |
| manifest_published | GET /manifest de novo |
| integration_test | Responda no chat: só **✅** se \`ok:true\`, ou **❌** + passo falho. Asaas sem chave não conta como falha (\`probes\` skipped). Não use tools |

Envelope útil: \`manytalks.conversation_id\`, \`manytalks.content\`, \`manytalks.contact_id\`, \`labels\`.

Etiquetas (whitelist): ${labels}. Não chame app.manytalks.com.br direto.

## Runtime
\`\`\`json
${JSON.stringify(runtimeJson, null, 2)}
\`\`\`
`;
}