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
  if (tools.create_payment_link && asaas.allow_payment_link) names.push("create_payment_link");
  if (tools.create_pix_charge && asaas.allow_pix_copy) names.push("create_pix_charge");
  return names;
}

/** Texto curto gravado no manifest (sem segredos). */
export function compileRuntimeSystem(input: RuntimeSystemInput): string {
  const stages = kanbanStagesAllowed(input.kanban);
  const tools = [
    input.tools.send_reply && "send_reply",
    input.tools.set_conversation_labels && "set_conversation_labels",
    input.tools.move_kanban_card && "move_kanban_card",
    input.tools.create_payment_link && input.asaas.allow_payment_link && "create_payment_link",
    input.tools.create_pix_charge && input.asaas.allow_pix_copy && "create_pix_charge",
  ]
    .filter(Boolean)
    .join(", ");

  const cookbook = [
    "## Contrato de ações (se o seu runtime tiver tools equivalentes)",
    '1) Responder cliente → send_reply { "content": "texto" }',
    '2) Etiquetas → set_conversation_labels { "add": [], "remove": [] } (merge; só whitelist)',
    '3) Funil → PATCH .../contacts/{contact_id}/pipeline_positions/{pipeline_id}  body:{ "stage_id": "coluna exata" }',
    input.hasKnowledge ? '4) Fatos → lookup_knowledge { "query": "assunto" }' : "",
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

/** Limites para o prompt (sem segredos — o worker lê token do manifest em memória). */
export function buildRuntimeReadyPayloadForPrompt(manifest: ManifestV1): RuntimeReadyPayload {
  const ready = buildRuntimeReadyPayload(manifest);
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
      events_forwarded: ["message_created"],
      note: "PUT registra URL + cabeçalho de auth. A plataforma filtra inbox e POSTa o envelope com esse header. GET consulta; DELETE remove.",
    },
  };
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
export function assembleGrokInstruction(manifest: ManifestV1, systemText: string): string {
  const ready = mergeDeclaredFunctions(manifest, buildRuntimeReadyPayloadForPrompt(manifest));
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
