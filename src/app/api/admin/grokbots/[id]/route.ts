import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  grokbots,
  grokbotsConfig,
  grokbotsInboxes,
  grokbotsRuntimeTokens,
  stageRules,
  dashboards,
} from "@/lib/db/schema";
import { adminGuard, fail } from "@/lib/admin/http";
import { deleteManytalksWebhook } from "@/lib/admin/register-manytalks-webhook";
import { mergeChecklistAck, type ChecklistAck } from "@/lib/admin/checklist-ack";
import { normalizeOutboundAuth } from "@/lib/runtime/outbound-forward";
import { nowIso } from "@/lib/utils";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error } = await adminGuard();
  if (error) return error;
  const { id } = await ctx.params;
  const db = getDb();
  const [bot] = await db.select().from(grokbots).where(eq(grokbots.id, id)).limit(1);
  if (!bot) return fail("Não encontrado.", 404);
  const [config] = await db
    .select()
    .from(grokbotsConfig)
    .where(eq(grokbotsConfig.grokbotId, id))
    .limit(1);
  const inboxes = await db.select().from(grokbotsInboxes).where(eq(grokbotsInboxes.grokbotId, id));
  const rules = await db.select().from(stageRules).where(eq(stageRules.grokbotId, id));
  const tokens = await db
    .select()
    .from(grokbotsRuntimeTokens)
    .where(eq(grokbotsRuntimeTokens.grokbotId, id));
  const [dash] = await db.select().from(dashboards).where(eq(dashboards.grokbotId, id)).limit(1);
  return NextResponse.json({
    bot,
    config,
    inboxes,
    rules,
    tokens: tokens.map((t) => ({
      id: t.id,
      prefix: t.tokenPrefix,
      label: t.label,
      revokedAt: t.revokedAt,
      createdAt: t.createdAt,
    })),
    dashboard: dash ? { slug: dash.slug } : null,
  });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error } = await adminGuard();
  if (error) return error;
  const { id } = await ctx.params;
  const body = (await req.json()) as Record<string, unknown>;
  const db = getDb();
  await db
    .update(grokbots)
    .set({
      updatedAt: nowIso(),
      ...(typeof body.name === "string" ? { name: body.name } : {}),
      ...(typeof body.enabled === "boolean" ? { enabled: body.enabled } : {}),
      ...(body.manytalksAccountId != null
        ? { manytalksAccountId: Number(body.manytalksAccountId) }
        : {}),
    })
    .where(eq(grokbots.id, id));
  const cfg: Partial<typeof grokbotsConfig.$inferInsert> = {};
  if (typeof body.knowledge === "string") cfg.knowledge = body.knowledge;
  if (typeof body.xaiModel === "string") cfg.xaiModel = body.xaiModel;
  if (body.toolsPolicy) cfg.toolsPolicyJson = JSON.stringify(body.toolsPolicy);
  if (body.labels) cfg.labelsJson = JSON.stringify(body.labels);
  if (body.kanban) cfg.kanbanJson = JSON.stringify(body.kanban);
  if (body.asaas) cfg.asaasJson = JSON.stringify(body.asaas);
  if (body.postPayment) cfg.postPaymentJson = JSON.stringify(body.postPayment);
  if (body.conversationRules) cfg.conversationRulesJson = JSON.stringify(body.conversationRules);
  if (body.checklistAck && typeof body.checklistAck === "object") {
    const [curCfg] = await db
      .select({ checklistAckJson: grokbotsConfig.checklistAckJson })
      .from(grokbotsConfig)
      .where(eq(grokbotsConfig.grokbotId, id))
      .limit(1);
    cfg.checklistAckJson = JSON.stringify(
      mergeChecklistAck(curCfg?.checklistAckJson, body.checklistAck as Partial<ChecklistAck>),
    );
  }
  const touchedOutbound =
    typeof body.outboundWebhookUrl === "string" ||
    typeof body.outboundWebhookSecret === "string" ||
    typeof body.outboundWebhookAuthHeader === "string" ||
    body.clearOutboundWebhook === true;

  if (typeof body.outboundWebhookUrl === "string") {
    const url = body.outboundWebhookUrl.trim();
    cfg.outboundWebhookUrl = url || null;
    cfg.outboundWebhookConfiguredAt = url ? nowIso() : null;
    if (!url) {
      cfg.outboundWebhookSecret = null;
      cfg.outboundWebhookAuthHeader = null;
    }
  }
  if (typeof body.outboundWebhookSecret === "string") {
    cfg.outboundWebhookSecret = body.outboundWebhookSecret.trim() || null;
  }
  if (typeof body.outboundWebhookAuthHeader === "string") {
    cfg.outboundWebhookAuthHeader = body.outboundWebhookAuthHeader.trim() || null;
  }
  if (body.clearOutboundWebhook === true) {
    cfg.outboundWebhookUrl = null;
    cfg.outboundWebhookSecret = null;
    cfg.outboundWebhookAuthHeader = null;
    cfg.outboundWebhookConfiguredAt = null;
  }

  // Normaliza Authorization: Bearer … colado no campo errado
  if (
    touchedOutbound &&
    body.clearOutboundWebhook !== true &&
    (cfg.outboundWebhookAuthHeader !== undefined || cfg.outboundWebhookSecret !== undefined)
  ) {
    const [cur] = await db
      .select({
        h: grokbotsConfig.outboundWebhookAuthHeader,
        v: grokbotsConfig.outboundWebhookSecret,
      })
      .from(grokbotsConfig)
      .where(eq(grokbotsConfig.grokbotId, id))
      .limit(1);
    const norm = normalizeOutboundAuth(
      cfg.outboundWebhookAuthHeader !== undefined ? cfg.outboundWebhookAuthHeader : cur?.h,
      cfg.outboundWebhookSecret !== undefined ? cfg.outboundWebhookSecret : cur?.v,
    );
    cfg.outboundWebhookAuthHeader = norm.authHeader;
    if (cfg.outboundWebhookSecret !== undefined || norm.authValue) {
      cfg.outboundWebhookSecret = norm.authValue;
    }
  }

  if (Object.keys(cfg).length) {
    await db.update(grokbotsConfig).set(cfg).where(eq(grokbotsConfig.grokbotId, id));
  }
  if (touchedOutbound) {
    await db
      .update(grokbots)
      .set({ lastError: null, updatedAt: nowIso() })
      .where(eq(grokbots.id, id));
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error } = await adminGuard();
  if (error) return error;
  const { id } = await ctx.params;
  const db = getDb();
  const [bot] = await db.select().from(grokbots).where(eq(grokbots.id, id)).limit(1);
  if (!bot) return fail("Não encontrado.", 404);

  const manytalksWebhook = await deleteManytalksWebhook(id);
  await db.delete(grokbots).where(eq(grokbots.id, id));
  return NextResponse.json({ ok: true, manytalksWebhook });
}
