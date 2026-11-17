import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { grokbots, grokbotsConfig, grokbotsSecrets } from "@/lib/db/schema";
import { createManytalksClient, unwrapWebhooks } from "@/lib/manytalks/client";
import { manytalksTokenFromEnc } from "@/lib/manytalks/token";
import { appUrl, nowIso } from "@/lib/utils";
import { markManytalksWebhookOk } from "@/lib/admin/checklist-ack";

const WEBHOOK_SUBSCRIPTIONS = [
  "message_created",
  "conversation_status_changed",
  "contact_kanban_stage_changed",
] as const;

function webhookIdOf(row: unknown): number | null {
  if (!row || typeof row !== "object") return null;
  const id = (row as { id?: unknown }).id;
  const n = typeof id === "number" ? id : Number(id);
  return Number.isFinite(n) ? n : null;
}

function webhookUrlOf(row: unknown): string {
  if (!row || typeof row !== "object") return "";
  const url = (row as { url?: unknown }).url;
  return typeof url === "string" ? url.trim() : "";
}

/** Compara URLs ignorando barra final e case do host. */
export function sameWebhookUrl(a: string, b: string) {
  const norm = (raw: string) => {
    try {
      const u = new URL(raw.trim());
      u.hash = "";
      const path = u.pathname.replace(/\/+$/, "") || "/";
      return `${u.protocol}//${u.host.toLowerCase()}${path}${u.search}`;
    } catch {
      return raw.trim().replace(/\/+$/, "").toLowerCase();
    }
  };
  return norm(a) === norm(b);
}

function findWebhookByUrl(rows: unknown[], url: string) {
  return rows.find((row) => sameWebhookUrl(webhookUrlOf(row), url)) ?? null;
}

async function ensureWebhook(
  client: ReturnType<typeof createManytalksClient>,
  url: string,
): Promise<{ webhook: unknown; alreadyExisted: boolean }> {
  const subscriptions = [...WEBHOOK_SUBSCRIPTIONS];

  // 1) Consulta primeiro — se já está no ManyTalks, só confirma (sem erro).
  try {
    const existing = unwrapWebhooks(await client.listWebhooks());
    const match = findWebhookByUrl(existing, url);
    if (match) {
      // Já cadastrado: não recria (evita 422 Url has already been taken).
      return { webhook: match, alreadyExisted: true };
    }
  } catch {
    /* sem listagem — tenta create abaixo */
  }

  // 2) Não achou → cria.
  try {
    const created = await client.createWebhook(url, subscriptions);
    return { webhook: created, alreadyExisted: false };
  } catch (createErr) {
    const createMsg = createErr instanceof Error ? createErr.message : String(createErr);
    // 3) Create falhou (ex.: já existe) → lista de novo e aceita se a URL estiver lá.
    try {
      const existing = unwrapWebhooks(await client.listWebhooks());
      const match = findWebhookByUrl(existing, url);
      if (match) return { webhook: match, alreadyExisted: true };
    } catch {
      /* ignore */
    }
    throw new Error(createMsg);
  }
}

export async function registerManytalksWebhook(grokbotId: string) {
  const db = getDb();
  const [bot] = await db.select().from(grokbots).where(eq(grokbots.id, grokbotId)).limit(1);
  if (!bot) throw new Error("ManyTalks Bot não encontrado.");

  const [secrets] = await db
    .select()
    .from(grokbotsSecrets)
    .where(eq(grokbotsSecrets.grokbotId, grokbotId))
    .limit(1);
  const token = manytalksTokenFromEnc(secrets?.manytalksTokenEnc);
  if (!token) {
    throw new Error(
      "Token ManyTalks ausente. Configure MANYTALKS_SERVICE_TOKEN no .env ou cole um PAT no wizard.",
    );
  }

  const url = `${appUrl()}/api/hooks/manytalks`;
  if (!/^https:\/\//i.test(url)) {
    throw new Error(
      `URL pública inválida (${url}). Defina NEXT_PUBLIC_APP_URL com https:// acessível pelo ManyTalks.`,
    );
  }

  const client = createManytalksClient({
    base: bot.manytalksBase,
    accountId: bot.manytalksAccountId,
    token,
  });

  let result: { webhook: unknown; alreadyExisted: boolean };
  try {
    result = await ensureWebhook(client, url);
  } catch (err) {
    const base = err instanceof Error ? err.message : "Falha ao registrar webhook.";
    throw new Error(
      `${base} — confira se o PAT tem permissão de webhooks e se ${url} é alcançável pelo ManyTalks.`,
    );
  }

  const [config] = await db
    .select({ checklistAckJson: grokbotsConfig.checklistAckJson })
    .from(grokbotsConfig)
    .where(eq(grokbotsConfig.grokbotId, grokbotId))
    .limit(1);

  const next = markManytalksWebhookOk(config?.checklistAckJson);
  await db
    .update(grokbotsConfig)
    .set({ checklistAckJson: JSON.stringify(next) })
    .where(eq(grokbotsConfig.grokbotId, grokbotId));
  await db
    .update(grokbots)
    .set({ lastError: null, updatedAt: nowIso() })
    .where(eq(grokbots.id, grokbotId));

  return {
    webhook: result.webhook,
    url,
    checklist: next,
    alreadyExisted: result.alreadyExisted,
  };
}

export type ManytalksWebhookCleanup =
  | { status: "deleted"; webhookId: number }
  | { status: "not_found" }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

/** Remove na account ManyTalks o webhook apontando para este app (mesma URL do register). */
export async function deleteManytalksWebhook(grokbotId: string): Promise<ManytalksWebhookCleanup> {
  const db = getDb();
  const [bot] = await db.select().from(grokbots).where(eq(grokbots.id, grokbotId)).limit(1);
  if (!bot) return { status: "skipped", reason: "bot não encontrado" };

  const [secrets] = await db
    .select()
    .from(grokbotsSecrets)
    .where(eq(grokbotsSecrets.grokbotId, grokbotId))
    .limit(1);
  const token = manytalksTokenFromEnc(secrets?.manytalksTokenEnc);
  if (!token) {
    return { status: "skipped", reason: "token ManyTalks ausente" };
  }

  const url = `${appUrl()}/api/hooks/manytalks`;
  const client = createManytalksClient({
    base: bot.manytalksBase,
    accountId: bot.manytalksAccountId,
    token,
  });

  try {
    const existing = unwrapWebhooks(await client.listWebhooks());
    const match = findWebhookByUrl(existing, url);
    if (!match) return { status: "not_found" };

    const webhookId = webhookIdOf(match);
    if (webhookId == null) {
      return { status: "failed", error: "webhook encontrado sem id válido" };
    }

    await client.deleteWebhook(webhookId);
    return { status: "deleted", webhookId };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Falha ao remover webhook ManyTalks.";
    return { status: "failed", error };
  }
}
