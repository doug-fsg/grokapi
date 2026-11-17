import type { ManifestV1 } from "@/lib/types/manifest";
import { integrationTestLocalTarget } from "@/lib/admin/integration-test-local";
import { createManytalksClient, unwrapList } from "@/lib/manytalks/client";
import {
  buildCreateContactBody,
  contactIdFromResponse,
  normalizePhoneE164,
} from "@/lib/manytalks/contacts";
import { unwrapLabelTitles } from "@/lib/manytalks/labels";
import { ensureConversationOpen } from "@/lib/manytalks/conversation-lifecycle";
import {
  buildKanbanPipelineCreateBody,
  buildKanbanPipelinePatchStages,
} from "@/lib/manytalks/kanban-pipeline";
import { pipelineStagesFromAttributeValues } from "@/lib/manytalks/pipeline-stages";

export type E2eStep = { id: string; ok: boolean; detail?: string };

const FALLBACK_PIPELINE_NAME = "ManyTalksBot";
const FALLBACK_STAGE_A = "Novo";
const FALLBACK_STAGE_B = "Qualificado";
const LABEL_TITLE = "teste_api";

function digitsOnly(s: string) {
  return s.replace(/\D/g, "");
}

function pickTargetInbox(manifest: ManifestV1, inboxOverride?: number): number {
  const target = inboxOverride ?? integrationTestLocalTarget().inboxId;
  const enabled = manifest.manytalks.enabled_inbox_ids ?? [];
  if (enabled.includes(target)) return target;
  if (enabled[0] != null) return enabled[0]!;
  throw new Error("Nenhuma inbox habilitada no bot.");
}

async function upsertContact(
  client: ReturnType<typeof createManytalksClient>,
  manifest: ManifestV1,
  name: string,
  phone: string,
  inboxId: number,
): Promise<number> {
  const q = digitsOnly(phone).slice(-8) || phone;
  const search = unwrapList<Record<string, unknown>>(
    (await client.searchContacts(q)) as never,
  );
  const match =
    search.find((c) => {
      const p = digitsOnly(String(c.phone_number ?? ""));
      return p.includes(digitsOnly(phone).slice(-8));
    }) ?? search[0];

  const e164 = normalizePhoneE164(phone);
  if (match?.id != null) {
    const id = Number(match.id);
    await client.updateContact(id, { name, phone_number: e164 });
    return id;
  }

  const body = buildCreateContactBody(
    { name, phone_number: e164, inbox_id: inboxId },
    inboxId,
  );
  const raw = await client.createContact(body);
  const newId = contactIdFromResponse(raw);
  if (!newId) throw new Error("create_contact sem id na resposta");
  return newId;
}

async function ensureAccountLabel(client: ReturnType<typeof createManytalksClient>, title: string) {
  const raw = await client.listAccountLabels();
  const titles = unwrapLabelTitles(raw);
  if (!titles.includes(title)) {
    try {
      await client.createLabel(title);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/422|already|exist/i.test(msg)) throw err;
    }
  }
}

async function pipelineRowById(
  client: ReturnType<typeof createManytalksClient>,
  pipelineId: number,
) {
  const raw = await client.listPipelines();
  const list = unwrapList<{
    id?: number;
    attribute_display_name?: string;
    attribute_values?: unknown;
    is_kanban?: boolean;
  }>(raw as never);
  return list.find((p) => p.id === pipelineId);
}

async function ensurePipelineColumns(
  client: ReturnType<typeof createManytalksClient>,
  pipelineId: number,
  columnNames: string[],
): Promise<string[]> {
  const row = await pipelineRowById(client, pipelineId);
  let stages = pipelineStagesFromAttributeValues(row?.attribute_values);
  if (stages.length >= 2) return stages;
  if (columnNames.length < 2) {
    throw new Error("Defina ao menos 2 colunas para reparar o funil.");
  }
  await client.updatePipeline(
    pipelineId,
    buildKanbanPipelinePatchStages(columnNames.map((name) => ({ name }))),
  );
  const refreshed = await pipelineRowById(client, pipelineId);
  stages = pipelineStagesFromAttributeValues(refreshed?.attribute_values);
  if (stages.length < 2) {
    throw new Error(`Pipeline #${pipelineId} continua sem colunas após PATCH.`);
  }
  return stages;
}

async function resolvePipeline(
  client: ReturnType<typeof createManytalksClient>,
  manifest: ManifestV1,
): Promise<{ id: number; stages: [string, string] }> {
  const raw = await client.listPipelines();
  const list = unwrapList<{
    id?: number;
    attribute_display_name?: string;
    attribute_values?: unknown;
    is_kanban?: boolean;
  }>(raw as never).filter((p) => p.is_kanban !== false);

  const manifestStages = (manifest.kanban.stages_allowed ?? []).filter(Boolean);
  const fallbackColumns = manifestStages.length >= 2 ? manifestStages : [FALLBACK_STAGE_A, FALLBACK_STAGE_B];

  const configuredId = manifest.kanban.pipeline_id;
  let row = configuredId ? list.find((p) => p.id === configuredId) : undefined;

  if (!row) {
    row = list.find((p) => p.attribute_display_name === FALLBACK_PIPELINE_NAME);
  }

  if (!row?.id) {
    const created = await client.createPipeline(
      buildKanbanPipelineCreateBody({
        name: FALLBACK_PIPELINE_NAME,
        key: "manytalksbot_e2e",
        stages: fallbackColumns.map((name) => ({ name })),
      }),
    );
    const id = Number(
      (created as { payload?: { id?: number } })?.payload?.id ??
        (created as { id?: number }).id,
    );
    if (!Number.isFinite(id)) throw new Error("Pipeline criado sem id");
    const stages = await ensurePipelineColumns(client, id, fallbackColumns);
    return { id, stages: [stages[0]!, stages[1]!] };
  }

  const stages = await ensurePipelineColumns(client, row.id, fallbackColumns);
  return { id: row.id, stages: [stages[0]!, stages[1]!] };
}

async function mergeConversationLabel(
  client: ReturnType<typeof createManytalksClient>,
  displayId: string,
  title: string,
): Promise<string[]> {
  const curRaw = await client.getLabels(displayId);
  const cur = unwrapList<string>(curRaw as never);
  const next = Array.from(new Set([...cur, title]));
  await client.setLabels(displayId, next);
  const verifyRaw = await client.getLabels(displayId);
  const verify = unwrapList<string>(verifyRaw as never);
  if (!verify.includes(title)) {
    throw new Error(`etiqueta ${title} não apareceu na conversa ${displayId}`);
  }
  return verify;
}

/**
 * Roteiro E2E ManyTalks: contato, conversa aberta na inbox, etiqueta na conversa, kanban, mensagem.
 */
export async function runManytalksE2eSmoke(
  manifest: ManifestV1,
  opts?: { phone?: string; contactName?: string; message?: string; inboxId?: number },
): Promise<{ ok: boolean; steps: E2eStep[] }> {
  const client = createManytalksClient({
    base: manifest.manytalks.base_url,
    accountId: manifest.manytalks.account_id,
    token: manifest.manytalks.api_access_token,
  });
  const phone = normalizePhoneE164(opts?.phone ?? "+555581132058");
  const name = opts?.contactName ?? "Manytalks";
  const finalMessage = opts?.message ?? "Teste E2E ManyTalks Bot finalizado.";
  const inboxId = pickTargetInbox(manifest, opts?.inboxId);
  const steps: E2eStep[] = [];

  try {
    const contactId = await upsertContact(client, manifest, name, phone, inboxId);
    steps.push({
      id: "contact",
      ok: true,
      detail: `contato #${contactId} (${name}, ${phone})`,
    });

    await ensureAccountLabel(client, LABEL_TITLE);

    const { displayId, created } = await ensureConversationOpen(
      client,
      contactId,
      inboxId,
      finalMessage,
    );
    steps.push({
      id: "conversation",
      ok: true,
      detail: `inbox ${inboxId} · conversa ${displayId} (${created ? "criada" : "reaberta open"})`,
    });

    const labels = await mergeConversationLabel(client, displayId, LABEL_TITLE);
    steps.push({
      id: "label",
      ok: true,
      detail: `etiqueta ${LABEL_TITLE} na conversa: ${labels.join(", ")}`,
    });

    const pipe = await resolvePipeline(client, manifest);
    await client.moveKanban(contactId, pipe.id, {
      stage_id: pipe.stages[0],
      position: 0,
      metadata: { primary_conversation_id: Number(displayId) || displayId },
    });
    await client.moveKanban(contactId, pipe.id, {
      stage_id: pipe.stages[1],
      position: 0,
      metadata: { primary_conversation_id: Number(displayId) || displayId },
    });
    steps.push({
      id: "kanban",
      ok: true,
      detail: `pipeline #${pipe.id}: ${pipe.stages[0]} → ${pipe.stages[1]} (conv ${displayId})`,
    });

    steps.push({
      id: "message",
      ok: true,
      detail: `mensagem enviada na conversa ${displayId}`,
    });

    return { ok: true, steps };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    steps.push({ id: "error", ok: false, detail });
    return { ok: false, steps };
  }
}