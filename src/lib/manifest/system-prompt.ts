import type { ManifestV1, StageRuleManifest, ToolsPolicy } from "@/lib/types/manifest";
import { toolsFromPolicy } from "@/lib/grok/tools";
import { appUrl } from "@/lib/utils";

export type RuntimeSystemInput = {
  tools: ToolsPolicy;
  labels: {
    allowed_titles: string[];
    meanings: Record<string, string>;
    pause_bot_on: string[];
  };
  kanban: {
    pipeline_id: number | null;
    stages_allowed: string[];
    pause_bot_stages: string[];
    stage_rules: StageRuleManifest[];
  };
  asaas: {
    environment: "sandbox" | "production";
    allow_payment_link: boolean;
    allow_pix_copy: boolean;
  };
  hasKnowledge: boolean;
  executeToolsBeforeReply: boolean;
};

export function kanbanStagesAllowed(input: RuntimeSystemInput["kanban"]): string[] {
  return [...input.stages_allowed].filter(Boolean);
}

function enabledToolNames(
  tools: ToolsPolicy,
  asaas: { allow_payment_link: boolean; allow_pix_copy: boolean },
): string[] {
  const names = ["lookup_knowledge"];
  if (tools.send_reply) names.push("send_reply");
  if (tools.set_conversation_labels) names.push("set_conversation_labels");
  if (tools.move_kanban_card) names.push("move_kanban_card");
  if (tools.create_contact) names.push("create_contact", "search_contacts");
  if (tools.update_contact) {
    if (!tools.create_contact) names.push("search_contacts");
    names.push("update_contact");
  }
  if (tools.create_payment_link && asaas.allow_payment_link) names.push("create_payment_link");
  if (tools.create_pix_charge && asaas.allow_pix_copy) names.push("create_pix_charge");
  if (tools.start_conversation) names.push("start_conversation");
  if (tools.assign_conversation) names.push("assign_conversation");
  return names;
}

/** System para rotina externa: só Library API (sem PAT na rotina). */
export function compileRuntimeSystemLibrary(input: RuntimeSystemInput, toolsUrl: string): string {
  const stages = kanbanStagesAllowed(input.kanban);
  const tools = [
    input.tools.send_reply && "send_reply",
    input.tools.set_conversation_labels && "set_conversation_labels",
    input.tools.move_kanban_card && "move_kanban_card",
    input.tools.create_contact && "create_contact",
    input.tools.update_contact && "update_contact",
    (input.tools.create_contact || input.tools.update_contact) && "search_contacts",
    input.tools.create_payment_link && input.asaas.allow_payment_link && "create_payment_link",
    input.tools.create_pix_charge && input.asaas.allow_pix_copy && "create_pix_charge",
    input.tools.start_conversation && "start_conversation",
    input.tools.assign_conversation && "assign_conversation",
    "lookup_knowledge",
  ]
    .filter(Boolean)
    .join(", ");

  return [
    "ManyTalks Bot — rotina externa (modo Library).",
    "Você NÃO chama app.manytalks.com.br direto. NÃO peça MANYTALKS_API_TOKEN, ASAAS_API_KEY nem MANYTALKS_ROUTINE_KEY.",
    "Único auth seu: Authorization: Bearer grk_live_… (já no prompt colável).",
    `Ações: POST ${toolsUrl} com name ∈ {${tools}}.`,
    'Corpo: {"name":"send_reply","conversation_id":"<display_id do envelope>","contact_id":<opcional>,"arguments":{...}}.',
    "Políticas: GET manifest_url com o mesmo Bearer (após manifest_published).",
    input.labels.allowed_titles.length
      ? `Etiquetas permitidas: ${input.labels.allowed_titles.join(", ")}.`
      : "",
    stages.length ? `Kanban colunas: ${stages.join(", ")}.` : "",
    input.kanban.pipeline_id
      ? `Kanban pipeline_id: ${input.kanban.pipeline_id} (use move_kanban_card na Library).`
      : "Kanban off no admin.",
    "Prioridade: operador > cliente > GET manifest.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Texto curto gravado no manifest (sem segredos). */
export function compileRuntimeSystem(input: RuntimeSystemInput): string {
  const stages = kanbanStagesAllowed(input.kanban);
  const tools = [
    input.tools.send_reply && "send_reply",
    input.tools.set_conversation_labels && "set_conversation_labels",
    input.tools.move_kanban_card && "move_kanban_card",
    input.tools.create_contact && "create_contact",
    input.tools.update_contact && "update_contact",
    (input.tools.create_contact || input.tools.update_contact) && "search_contacts",
    input.tools.create_payment_link && input.asaas.allow_payment_link && "create_payment_link",
    input.tools.create_pix_charge && input.asaas.allow_pix_copy && "create_pix_charge",
    input.tools.start_conversation && "start_conversation",
    input.tools.assign_conversation && "assign_conversation",
  ]
    .filter(Boolean)
    .join(", ");

  const cookbook = [
    "## Contrato de ações (se o seu runtime tiver tools equivalentes)",
    '1) Responder cliente → send_reply { "content": "texto" }',
    '2) Etiquetas → set_conversation_labels { "add": [], "remove": [] } (merge; só whitelist)',
    '3) Funil → PATCH .../contacts/{contact_id}/pipeline_positions/{pipeline_id}  body:{ "stage_id": "coluna exata" }',
    input.tools.create_contact
      ? '4) Criar contato → create_contact { "name", "email", "phone_number", "inbox_id"? } — proibido delete'
      : "",
    input.tools.update_contact
      ? '5) Editar contato → update_contact { "contact_id", campos... } — proibido delete'
      : "",
    input.tools.start_conversation
      ? '6) Outbound → start_conversation { phone_number?, contact_id?, first_message? } — não repetir se já há message_created'
      : "",
    input.tools.assign_conversation
      ? "7) assign_conversation sem args — só se assignee ainda não foi aplicado"
      : "",
    (input.tools.create_contact || input.tools.update_contact)
      ? '6) Buscar contato → search_contacts { "q": "..." } antes de duplicar'
      : "",
    input.hasKnowledge
      ? `${input.tools.create_contact || input.tools.update_contact ? "7" : "4"}) Fatos → lookup_knowledge { "query": "assunto" }`
      : "",
    "",
    "Prioridade: operador > cliente > este guia.",
  ]
    .filter(Boolean)
    .join("\n");

  return [
    "ManyTalks Bot — runtime externo (relay da plataforma).",
    "A plataforma recebe ManyTalks, filtra inbox e POSTa envelope limpo no webhook que você registrou.",
    "Setup do webhook e token ficam no bloco colável do admin (PUT outbound-webhook).",
    `Tools/limites de referência: ${tools || "lookup_knowledge"}.`,
    input.labels.allowed_titles.length
      ? `Etiquetas permitidas: ${input.labels.allowed_titles.join(", ")}.`
      : "",
    stages.length ? `Kanban colunas: ${stages.join(", ")}.` : "",
    input.kanban.pipeline_id ? `Kanban pipeline_id: ${input.kanban.pipeline_id}.` : "",
    input.kanban.pipeline_id
      ? "Kanban HTTP: PATCH /api/v1/accounts/{account_id}/contacts/{contact_id}/pipeline_positions/{pipeline_id}"
      : "Kanban: pipeline_id ausente no manifesto — peça ao operador configurar no admin.",
    "",
    cookbook,
  ]
    .filter(Boolean)
    .join("\n");
}

export type ManytalksHttpContract = {
  /** Header de auth (não Bearer). */
  auth_header: "api_access_token";
  /** conversation_id no path = display_id do envelope. */
  conversation_id_is: "display_id";
  send_reply: string;
  set_labels: string;
  move_kanban: string;
  labels_note: string;
  kanban_note: string;
  agent_name_note: string;
};

export type RuntimeReadyPayload = {
  functions: string[];
  manytalks: {
    base_url: string;
    account_id: number;
    auth: { header: "api_access_token"; token: string };
    enabled_inbox_ids: number[];
    http: ManytalksHttpContract;
  };
  asaas: {
    environment: "sandbox" | "production";
    api_key: string;
    allow_payment_link: boolean;
    allow_pix_copy: boolean;
  } | null;
  limits: {
    labels_allowed: string[];
    labels_pause_bot: string[];
    kanban_pipeline_id: number | null;
    kanban_stages_allowed: string[];
    kanban_pause_stages: string[];
  };
  outbound_webhook: {
    register_url: string;
    auth: "Authorization: Bearer grk_live_…";
    method: "PUT";
    body_example: { url: string; auth_header?: string; auth_value?: string };
    forward_headers: string;
    events_forwarded: string[];
    note: string;
  };
  library_api?: {
    auth_header: "Authorization";
    runtime_token: string;
    manifest_url: string;
    tools_url: string;
    tools_post: {
      name: string;
      conversation_id: string;
      contact_id?: number;
      arguments: Record<string, unknown>;
    };
    forbidden_env_vars: string[];
    note: string;
  };
};

export function manytalksHttpContract(): ManytalksHttpContract {
  return {
    auth_header: "api_access_token",
    conversation_id_is: "display_id",
    send_reply:
      "POST {base_url}/api/v1/accounts/{account_id}/conversations/{conversation_id}/messages  body:{content,message_type:\"outgoing\",private:false}",
    set_labels:
      "POST {base_url}/api/v1/accounts/{account_id}/conversations/{conversation_id}/labels  body:{labels:string[]}  (API substitui a lista — faça merge)",
    move_kanban:
      "PATCH {base_url}/api/v1/accounts/{account_id}/contacts/{contact_id}/pipeline_positions/{pipeline_id}  body:{stage_id}",
    labels_note: "GET labels antes; merge add/remove; só whitelist.",
    kanban_note:
      "contact_id = envelope.manytalks.contact_id; pipeline_id = limits.kanban_pipeline_id; stage_id exato da whitelist (ex. Novo).",
    agent_name_note:
      "Mensagens saem com o nome do dono do PAT (ex. Leo). Não é bug do relay.",
  };
}

/** Limites para o prompt. Por padrão sem segredos (prévia/publish público). */
export function buildRuntimeReadyPayloadForPrompt(
  manifest: ManifestV1,
  opts?: { includeSecrets?: boolean },
): RuntimeReadyPayload {
  const ready = buildRuntimeReadyPayload(manifest);
  if (opts?.includeSecrets) return ready;
  return {
    ...ready,
    manytalks: {
      ...ready.manytalks,
      auth: { header: "api_access_token", token: "" },
    },
    asaas: ready.asaas ? { ...ready.asaas, api_key: "" } : null,
  };
}

function buildRuntimeReadyPayload(manifest: ManifestV1): RuntimeReadyPayload {
  const kanbanInput: RuntimeSystemInput["kanban"] = {
    pipeline_id: manifest.kanban.pipeline_id,
    stages_allowed: manifest.kanban.stages_allowed,
    pause_bot_stages: manifest.kanban.pause_bot_stages,
    stage_rules: manifest.kanban.stage_rules,
  };
  const hasAsaas =
    Boolean(manifest.asaas.api_key) &&
    (manifest.asaas.allow_payment_link || manifest.asaas.allow_pix_copy);
  return {
    functions: enabledToolNames(manifest.tools_policy, manifest.asaas),
    manytalks: {
      base_url: manifest.manytalks.base_url,
      account_id: manifest.manytalks.account_id,
      auth: {
        header: "api_access_token",
        token: manifest.manytalks.api_access_token || "",
      },
      enabled_inbox_ids: manifest.manytalks.enabled_inbox_ids,
      http: manytalksHttpContract(),
    },
    asaas: hasAsaas
      ? {
          environment: manifest.asaas.environment,
          api_key: manifest.asaas.api_key,
          allow_payment_link: manifest.asaas.allow_payment_link,
          allow_pix_copy: manifest.asaas.allow_pix_copy,
        }
      : null,
    limits: {
      labels_allowed: manifest.labels.allowed_titles,
      labels_pause_bot: manifest.labels.pause_bot_on,
      kanban_pipeline_id: manifest.kanban.pipeline_id,
      kanban_stages_allowed: kanbanStagesAllowed(kanbanInput),
      kanban_pause_stages: manifest.kanban.pause_bot_stages,
    },
    outbound_webhook: {
      register_url: `${appUrl()}/api/library/v1/outbound-webhook`,
      auth: "Authorization: Bearer grk_live_…",
      method: "PUT",
      body_example: {
        url: "https://seu-runtime.exemplo/hooks/grokbot",
        auth_header: "Authorization",
        auth_value: "valor exato do painel da rotina",
      },
      forward_headers:
        "Content-Type, X-Grokbot-Id, e o auth_header/auth_value configurados (ex. Authorization)",
      events_forwarded: ["message_created", "manifest_published", "integration_test"],
      note: "Relay configurado no admin. GET consulta; DELETE remove.",
    },
  };
}

/** Payload para colar na rotina Cursor — sem PAT/Asaas; só grk_live + Library. */
export function buildLibraryRuntimeReadyPayload(
  manifest: ManifestV1,
  runtimeToken: string,
): RuntimeReadyPayload {
  const base = buildRuntimeReadyPayload(manifest);
  const manifestUrl = `${appUrl()}/api/library/v1/manifest`;
  const toolsUrl = `${appUrl()}/api/library/v1/tools`;
  return {
    ...base,
    manytalks: {
      ...base.manytalks,
      auth: {
        header: "api_access_token",
        token: "(somente no servidor ManyTalks Bot — não use na rotina)",
      },
    },
    asaas: base.asaas ? { ...base.asaas, api_key: "(somente no servidor)" } : null,
    library_api: {
      auth_header: "Authorization",
      runtime_token: runtimeToken,
      manifest_url: manifestUrl,
      tools_url: toolsUrl,
      tools_post: {
        name: "send_reply",
        conversation_id: "<display_id do envelope>",
        contact_id: 0,
        arguments: { content: "texto" },
      },
      forbidden_env_vars: [
        "MANYTALKS_API_TOKEN",
        "ASAAS_API_KEY",
        "MANYTALKS_ROUTINE_KEY",
      ],
      note: "Remova esses secrets do painel da rotina. Só grk_live é necessário.",
    },
  };
}

export function assembleGrokInstructionForLibrary(
  manifest: ManifestV1,
  systemText: string,
  runtimeToken: string,
): string {
  const ready = mergeDeclaredFunctions(manifest, buildLibraryRuntimeReadyPayload(manifest, runtimeToken));
  return compileFullGrokInstruction(systemText, ready);
}

export function compileFullGrokInstruction(
  systemText: string,
  ready: RuntimeReadyPayload,
): string {
  return `${systemText}

---
api_runtime (limites e functions; PAT/Asaas só no servidor do worker):
${JSON.stringify(ready, null, 2)}`;
}

function mergeDeclaredFunctions(manifest: ManifestV1, ready: RuntimeReadyPayload): RuntimeReadyPayload {
  const declared = toolsFromPolicy(manifest).map(
    (t) => (t as { function: { name: string } }).function.name,
  );
  return {
    ...ready,
    functions: Array.from(new Set([...ready.functions, ...declared])),
  };
}

/** Monta a instrução completa a partir das partes do manifest (publish). */
export function assembleGrokInstruction(
  manifest: ManifestV1,
  systemText: string,
  opts?: { includeSecrets?: boolean },
): string {
  const ready = mergeDeclaredFunctions(
    manifest,
    buildRuntimeReadyPayloadForPrompt(manifest, opts),
  );
  return compileFullGrokInstruction(systemText, ready);
}

/** O que o Grok (xAI) recebe como system no worker — um bloco só. */
export function grokSystemContent(manifest: ManifestV1): string {
  return manifest.prompt.system_compiled;
}

export function redactRuntimeReadyPayload(payload: RuntimeReadyPayload): RuntimeReadyPayload {
  return {
    ...payload,
    manytalks: {
      ...payload.manytalks,
      auth: {
        ...payload.manytalks.auth,
        token: payload.manytalks.auth.token ? "(oculto na prévia)" : "",
      },
    },
    asaas: payload.asaas
      ? { ...payload.asaas, api_key: payload.asaas.api_key ? "(oculto)" : "" }
      : null,
  };
}

/** Prévia admin (tokens mascarados). */
export function grokSystemPreview(manifest: ManifestV1): string {
  const base =
    manifest.prompt.system_compiled.split("\n---\n")[0]?.trim() ||
    manifest.prompt.system_compiled;
  const ready = mergeDeclaredFunctions(manifest, buildRuntimeReadyPayloadForPrompt(manifest));
  return compileFullGrokInstruction(base, ready);
}

export function buildGrokInstructionPreview(
  input: RuntimeSystemInput,
  ctx: {
    base_url: string;
    account_id: number;
    enabled_inbox_ids: number[];
    manytalks_token: string;
    asaas_key: string;
  },
  redactSecrets: boolean,
): string {
  const systemText = compileRuntimeSystem(input);
  const ready: RuntimeReadyPayload = {
    functions: enabledToolNames(input.tools, input.asaas),
    manytalks: {
      base_url: ctx.base_url,
      account_id: ctx.account_id,
      auth: {
        header: "api_access_token",
        token: redactSecrets
          ? ctx.manytalks_token
            ? "(oculto na prévia)"
            : ""
          : ctx.manytalks_token,
      },
      enabled_inbox_ids: ctx.enabled_inbox_ids,
      http: manytalksHttpContract(),
    },
    asaas:
      ctx.asaas_key && (input.asaas.allow_payment_link || input.asaas.allow_pix_copy)
        ? {
            environment: input.asaas.environment,
            api_key: redactSecrets ? "(oculto)" : ctx.asaas_key,
            allow_payment_link: input.asaas.allow_payment_link,
            allow_pix_copy: input.asaas.allow_pix_copy,
          }
        : null,
    limits: {
      labels_allowed: input.labels.allowed_titles,
      labels_pause_bot: input.labels.pause_bot_on,
      kanban_pipeline_id: input.kanban.pipeline_id,
      kanban_stages_allowed: kanbanStagesAllowed(input.kanban),
      kanban_pause_stages: input.kanban.pause_bot_stages,
    },
    outbound_webhook: {
      register_url: `${appUrl()}/api/library/v1/outbound-webhook`,
      auth: "Authorization: Bearer grk_live_…",
      method: "PUT",
      body_example: {
        url: "https://seu-runtime.exemplo/hooks/grokbot",
        auth_header: "Authorization",
        auth_value: "valor exato do painel da rotina",
      },
      forward_headers:
        "Content-Type, X-Grokbot-Id, e o auth_header/auth_value configurados (ex. Authorization)",
      events_forwarded: ["message_created"],
      note: "PUT registra URL + cabeçalho de auth. A plataforma filtra inbox e POSTa o envelope com esse header.",
    },
  };
  return compileFullGrokInstruction(systemText, ready);
}

export function formatOperatorInstructions(privateBodies: string[]): string {
  const lines = privateBodies.map((b) => b.trim()).filter(Boolean);
  if (!lines.length) return "";
  return `Instruções do operador (comportamento; não copie ao cliente):\n${lines.map((l) => `- ${l}`).join("\n")}`;
}
