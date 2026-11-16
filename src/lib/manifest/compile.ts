import { eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { getDb } from "@/lib/db";
import {
  dashboards,
  grokbots,
  grokbotsConfig,
  grokbotsInboxes,
  grokbotsSecrets,
  stageRules,
} from "@/lib/db/schema";
import { decryptSecret } from "@/lib/crypto";
import { manytalksBase, resolveManytalksToken } from "@/lib/env";
import { jsonParse } from "@/lib/utils";
import type {
  GrokbotLabels,
  ManifestV1,
  StageRuleManifest,
  ToolsPolicy,
} from "@/lib/types/manifest";
import {
  defaultConversationRules,
  defaultToolsPolicy,
  emptyAsaas,
  emptyKanban,
  emptyLabels,
  emptyPostPayment,
} from "@/lib/defaults";
import { parseKnowledge } from "@/lib/knowledge/entries";
import {
  assembleGrokInstruction,
  compileRuntimeSystem,
  type RuntimeSystemInput,
} from "@/lib/manifest/system-prompt";

export async function loadGrokbotBundle(grokbotId: string) {
  const db = getDb();
  const [bot] = await db.select().from(grokbots).where(eq(grokbots.id, grokbotId)).limit(1);
  if (!bot) return null;
  const [config] = await db
    .select()
    .from(grokbotsConfig)
    .where(eq(grokbotsConfig.grokbotId, grokbotId))
    .limit(1);
  const [secrets] = await db
    .select()
    .from(grokbotsSecrets)
    .where(eq(grokbotsSecrets.grokbotId, grokbotId))
    .limit(1);
  const inboxes = await db
    .select()
    .from(grokbotsInboxes)
    .where(eq(grokbotsInboxes.grokbotId, grokbotId));
  const rules = await db
    .select()
    .from(stageRules)
    .where(eq(stageRules.grokbotId, grokbotId));
  const [dash] = await db
    .select()
    .from(dashboards)
    .where(eq(dashboards.grokbotId, grokbotId))
    .limit(1);
  return { bot, config, secrets, inboxes, rules, dash };
}

function compileSystem(
  knowledge: string,
  tools: ToolsPolicy,
  labels: GrokbotLabels,
  kanbanForPrompt: RuntimeSystemInput["kanban"],
  asaas: RuntimeSystemInput["asaas"],
  executeToolsBeforeReply: boolean,
) {
  return compileRuntimeSystem({
    tools,
    labels,
    kanban: kanbanForPrompt,
    asaas,
    hasKnowledge: parseKnowledge(knowledge).length > 0,
    executeToolsBeforeReply,
  });
}

export async function compileManifest(
  grokbotId: string,
  opts: { includeSecrets: boolean },
): Promise<ManifestV1 | null> {
  const bundle = await loadGrokbotBundle(grokbotId);
  if (!bundle?.config) return null;
  const { bot, config, secrets, inboxes, rules, dash } = bundle;
  const tools = jsonParse(config.toolsPolicyJson, defaultToolsPolicy);
  const labels = jsonParse(config.labelsJson, emptyLabels());
  const kanbanCfg = jsonParse(config.kanbanJson, emptyKanban());
  const asaasCfg = jsonParse(config.asaasJson, emptyAsaas());
  const post = jsonParse(config.postPaymentJson, emptyPostPayment());
  const conv = jsonParse(config.conversationRulesJson, defaultConversationRules);
  const checklist = jsonParse(config.checklistAckJson, {
    capitao_off_inboxes: true,
    manytalks_webhook_ok: false,
    manytalks_webhook_at: null,
    asaas_webhook_ack: false,
  });
  const stageRulesManifest: StageRuleManifest[] = rules.map((r) => ({
    name: r.name,
    condition: r.condition,
    target_stage_id: r.targetStageId,
    add_labels: jsonParse<string[]>(r.addLabelsJson, []),
    priority: r.priority,
    active: r.active,
  }));
  const kanbanForPrompt: RuntimeSystemInput["kanban"] = {
    pipeline_id: kanbanCfg.pipeline_id ?? null,
    stages_allowed: kanbanCfg.stages_allowed ?? [],
    pause_bot_stages: kanbanCfg.pause_bot_stages ?? [],
    stage_rules: stageRulesManifest,
  };
  const asaasForPrompt: RuntimeSystemInput["asaas"] = {
    environment: asaasCfg.environment ?? "sandbox",
    allow_payment_link: asaasCfg.allow_payment_link ?? tools.create_payment_link,
    allow_pix_copy: asaasCfg.allow_pix_copy ?? tools.create_pix_charge,
  };
  const systemText = compileSystem(
    config.knowledge,
    tools,
    labels,
    kanbanForPrompt,
    asaasForPrompt,
    conv.execute_tools_before_reply ?? true,
  );
  const botMt = secrets?.manytalksTokenEnc
    ? decryptSecret(secrets.manytalksTokenEnc)
    : "";
  const mtToken = opts.includeSecrets ? resolveManytalksToken(botMt) : "";
  const asaasKey = opts.includeSecrets ? decryptSecret(secrets?.asaasApiKeyEnc) : "";
  const body: Omit<ManifestV1, "etag"> = {
    schema_version: "1.0",
    manifest_version: bot.manifestVersion,
    grokbot: { id: bot.id, name: bot.name, enabled: bot.enabled },
    manytalks: {
      base_url: bot.manytalksBase || manytalksBase(),
      account_id: bot.manytalksAccountId,
      api_access_token: mtToken,
      enabled_inbox_ids: inboxes.map((i) => i.inboxId),
      webhook_subscriptions: [
        "message_created",
        "conversation_status_changed",
        "contact_kanban_stage_changed",
      ],
    },
    xai: {
      model: config.xaiModel,
      temperature: Number(config.xaiTemperature) || 0.4,
      max_history_messages: config.maxHistoryMessages,
    },
    prompt: {
      system_compiled: systemText,
      knowledge: config.knowledge,
      knowledge_entries: parseKnowledge(config.knowledge),
    },
    tools_policy: tools,
    labels,
    kanban: {
      pipeline_id: kanbanCfg.pipeline_id ?? null,
      stages_allowed: kanbanCfg.stages_allowed ?? [],
      pause_bot_stages: kanbanCfg.pause_bot_stages ?? [],
      stage_rules: stageRulesManifest,
    },
    asaas: {
      environment: asaasCfg.environment ?? "sandbox",
      api_key: asaasKey,
      allow_payment_link: asaasCfg.allow_payment_link ?? tools.create_payment_link,
      allow_pix_copy: asaasCfg.allow_pix_copy ?? tools.create_pix_charge,
      split_note: asaasCfg.split_note ?? "",
    },
    post_payment: post,
    conversation_rules: conv,
    dashboard: {
      slug: dash?.slug ?? null,
      has_password: Boolean(dash?.passwordHash),
    },
    checklist_ack: checklist,
  };
  const manifestDraft = { ...body, etag: "" } as ManifestV1;
  body.prompt.system_compiled = assembleGrokInstruction(manifestDraft, systemText);
  const etag = `W/"${createHash("sha256").update(JSON.stringify(body)).digest("hex").slice(0, 16)}"`;
  return { ...body, etag };
}
