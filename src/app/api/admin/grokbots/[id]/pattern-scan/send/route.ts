import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { grokbots, patternScans } from "@/lib/db/schema";
import { adminGuard, fail } from "@/lib/admin/http";
import {
  forwardToOutboundWebhook,
  getOutboundWebhook,
} from "@/lib/runtime/outbound-forward";
import { getLatestPatternScan, getPatternScanById } from "@/lib/patterns/scan";
import { nowIso } from "@/lib/utils";
import type { PatternDraft } from "@/lib/patterns/analyze";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error } = await adminGuard();
  if (error) return error;
  const { id } = await ctx.params;
  const [bot] = await getDb().select().from(grokbots).where(eq(grokbots.id, id)).limit(1);
  if (!bot) return fail("Não encontrado.", 404);

  const body = (await req.json().catch(() => ({}))) as { scanId?: string };
  const latest = body.scanId
    ? await getPatternScanById(id, body.scanId)
    : await getLatestPatternScan(id);
  if (!latest || latest.status !== "ready" || !latest.draft) {
    return fail("Nenhum rascunho pronto para enviar. Rode Analisar antes.", 400);
  }

  const outbound = await getOutboundWebhook(id);
  if (!outbound?.url) {
    return fail("Configure o webhook de saída (Runtime) antes de enviar.", 400);
  }

  const draft = latest.draft as PatternDraft;
  const envelope = {
    schema_version: "1.0" as const,
    event: "playbook_patterns",
    grokbot_id: id,
    filters: latest.filters,
    filters_label: latest.filtersLabel,
    model_used: latest.modelUsed,
    patterns: draft,
    sampled: latest.sampled ?? { conversations: 0, messages: 0 },
    received_at: nowIso(),
  };

  const fwd = await forwardToOutboundWebhook({
    grokbotId: id,
    url: outbound.url,
    authHeader: outbound.authHeader,
    authValue: outbound.authValue,
    envelope,
  });

  if (!fwd.ok) {
    return fail(fwd.error ?? `Falha no webhook (HTTP ${fwd.status})`, 502);
  }

  await getDb()
    .update(patternScans)
    .set({ sentAt: nowIso() })
    .where(eq(patternScans.id, latest.id));

  return NextResponse.json({
    ok: true,
    status: fwd.status,
    scan_id: latest.id,
    event: "playbook_patterns",
    message: "Playbook enviado ao GrokBot via webhook.",
  });
}
