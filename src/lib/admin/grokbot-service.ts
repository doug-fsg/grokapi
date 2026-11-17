import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  dashboards,
  grokbots,
  grokbotsConfig,
  grokbotsInboxes,
  grokbotsRuntimeTokens,
  grokbotsSecrets,
} from "@/lib/db/schema";
import { encryptSecret, generateRuntimeToken, hashToken } from "@/lib/crypto";
import { hashPassword } from "@/lib/auth/password";
import { nowIso } from "@/lib/utils";
import {
  defaultConversationRules,
  defaultToolsPolicy,
  emptyAsaas,
  emptyKanban,
  emptyLabels,
  emptyPostPayment,
} from "@/lib/defaults";
import { manytalksBase } from "@/lib/env";

export async function createGrokbot(input: { name: string; manytalksAccountId: number }) {
  const db = getDb();
  const ts = nowIso();
  const [existing] = await db
    .select()
    .from(grokbots)
    .where(eq(grokbots.manytalksAccountId, input.manytalksAccountId))
    .limit(1);
  if (existing) {
    await db
      .update(grokbots)
      .set({ name: input.name || existing.name, updatedAt: ts })
      .where(eq(grokbots.id, existing.id));
    return { id: existing.id, runtimeToken: "", existing: true as const };
  }
  const id = crypto.randomUUID();
  await db.insert(grokbots).values({
    id,
    name: input.name,
    enabled: false,
    manytalksAccountId: input.manytalksAccountId,
    manytalksBase: manytalksBase(),
    manifestVersion: 0,
    createdAt: ts,
    updatedAt: ts,
  });
  await db.insert(grokbotsConfig).values({
    grokbotId: id,
    knowledge: "",
    toolsPolicyJson: JSON.stringify(defaultToolsPolicy),
    labelsJson: JSON.stringify(emptyLabels()),
    kanbanJson: JSON.stringify(emptyKanban()),
    asaasJson: JSON.stringify(emptyAsaas()),
    postPaymentJson: JSON.stringify(emptyPostPayment()),
    conversationRulesJson: JSON.stringify(defaultConversationRules),
    checklistAckJson: JSON.stringify({
      capitao_off_inboxes: true,
      manytalks_webhook_ok: false,
      manytalks_webhook_at: null,
      asaas_webhook_ack: false,
    }),
  });
  await db.insert(grokbotsSecrets).values({ grokbotId: id });
  const token = generateRuntimeToken();
  await db.insert(grokbotsRuntimeTokens).values({
    id: crypto.randomUUID(),
    grokbotId: id,
    tokenHash: hashToken(token),
    tokenPrefix: token.slice(0, 16),
    label: "default",
    createdAt: ts,
  });
  return { id, runtimeToken: token, existing: false as const };
}

export async function saveSecrets(
  grokbotId: string,
  secrets: { manytalksToken?: string; asaasApiKey?: string },
) {
  const db = getDb();
  const patch: { manytalksTokenEnc?: string; asaasApiKeyEnc?: string } = {};
  if (secrets.manytalksToken) {
    patch.manytalksTokenEnc = encryptSecret(secrets.manytalksToken);
  }
  if (secrets.asaasApiKey) {
    patch.asaasApiKeyEnc = encryptSecret(secrets.asaasApiKey);
  }
  if (Object.keys(patch).length) {
    await db.update(grokbotsSecrets).set(patch).where(eq(grokbotsSecrets.grokbotId, grokbotId));
  }
}

export async function replaceInboxes(
  grokbotId: string,
  inboxes: { inboxId: number; inboxName?: string }[],
) {
  const db = getDb();
  await db.delete(grokbotsInboxes).where(eq(grokbotsInboxes.grokbotId, grokbotId));
  for (const inbox of inboxes) {
    await db.insert(grokbotsInboxes).values({
      id: crypto.randomUUID(),
      grokbotId,
      inboxId: inbox.inboxId,
      inboxName: inbox.inboxName ?? null,
    });
  }
}

export async function upsertDashboard(grokbotId: string, password: string, slug?: string) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(dashboards)
    .where(eq(dashboards.grokbotId, grokbotId))
    .limit(1);
  const passwordHash = await hashPassword(password);
  const passwordEnc = encryptSecret(password);
  if (existing) {
    await db
      .update(dashboards)
      .set({ passwordHash, passwordEnc, slug: slug ?? existing.slug })
      .where(eq(dashboards.grokbotId, grokbotId));
    return existing.slug;
  }
  const nextSlug = slug ?? crypto.randomUUID();
  await db.insert(dashboards).values({
    grokbotId,
    slug: nextSlug,
    passwordHash,
    passwordEnc,
    createdAt: nowIso(),
  });
  return nextSlug;
}

export async function rotateRuntimeToken(grokbotId: string) {
  const db = getDb();
  const token = generateRuntimeToken();
  await db.insert(grokbotsRuntimeTokens).values({
    id: crypto.randomUUID(),
    grokbotId,
    tokenHash: hashToken(token),
    tokenPrefix: token.slice(0, 16),
    label: "rotated",
    createdAt: nowIso(),
  });
  const { pruneRuntimeTokens } = await import("@/lib/library/runtime-token-grace");
  await pruneRuntimeTokens(grokbotId);
  return token;
}
