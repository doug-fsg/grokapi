import { eq } from "drizzle-orm";
import { after, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  grokbots,
  grokbotsConfig,
  grokbotsInboxes,
  grokbotsSecrets,
  patternScans,
} from "@/lib/db/schema";
import { adminGuard, fail } from "@/lib/admin/http";
import { enqueueJob } from "@/lib/jobs/queue";
import { drainJobs } from "@/lib/jobs/process";
import { createManytalksClient } from "@/lib/manytalks/client";
import { unwrapLabelTitles } from "@/lib/manytalks/labels";
import { manytalksTokenFromEnc } from "@/lib/manytalks/token";
import {
  assertPlaybookFilters,
  defaultPlaybookFilters,
  filtersLabel,
  normalizePlaybookFilters,
  resolveDepthCaps,
} from "@/lib/patterns/filters";
import { DEPTH_TYPICAL_MINUTES } from "@/lib/patterns/progress";
import { isOpenCodeCliReady } from "@/lib/patterns/opencode-cascade";
import { cancelPatternScans } from "@/lib/patterns/cancel";
import { getLatestPatternScan, getPatternScanById, listPatternScans } from "@/lib/patterns/scan";
import { jsonParse, nowIso } from "@/lib/utils";
import { emptyKanban } from "@/lib/defaults";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error } = await adminGuard();
  if (error) return error;
  const { id } = await ctx.params;
  const [bot] = await getDb().select().from(grokbots).where(eq(grokbots.id, id)).limit(1);
  if (!bot) return fail("Não encontrado.", 404);
  const inboxes = await getDb()
    .select({
      id: grokbotsInboxes.inboxId,
      name: grokbotsInboxes.inboxName,
    })
    .from(grokbotsInboxes)
    .where(eq(grokbotsInboxes.grokbotId, id));
  const scanId = new URL(req.url).searchParams.get("scanId");
  const selected = scanId ? await getPatternScanById(id, scanId) : null;
  const latest = await getLatestPatternScan(id);
  const history = await listPatternScans(id, 40);
  const [cfg] = await getDb()
    .select({ kanbanJson: grokbotsConfig.kanbanJson })
    .from(grokbotsConfig)
    .where(eq(grokbotsConfig.grokbotId, id))
    .limit(1);
  const kanban = jsonParse(cfg?.kanbanJson, emptyKanban());
  const kanbanStages = Array.isArray(kanban.stages_allowed) ? kanban.stages_allowed : [];
  const opencodeConfigured = await isOpenCodeCliReady();

  let accountLabels: string[] = [];
  try {
    const [secrets] = await getDb()
      .select()
      .from(grokbotsSecrets)
      .where(eq(grokbotsSecrets.grokbotId, id))
      .limit(1);
    const token = manytalksTokenFromEnc(secrets?.manytalksTokenEnc);
    if (token) {
      const client = createManytalksClient({
        base: bot.manytalksBase,
        accountId: bot.manytalksAccountId,
        token,
      });
      accountLabels = unwrapLabelTitles(await client.listAccountLabels());
    }
  } catch {
    accountLabels = [];
  }

  return NextResponse.json({
    opencode_configured: opencodeConfigured,
    inboxes,
    labels: accountLabels,
    kanban_stages: kanbanStages,
    default_filters: defaultPlaybookFilters(),
    latest,
    selected,
    history: history.map((h) => ({
      id: h.id,
      status: h.status,
      filtersLabel: h.filtersLabel,
      createdAt: h.createdAt,
      sentAt: h.sentAt,
      error: h.error,
      sampled: h.sampled,
      modelUsed: h.modelUsed,
      hasDraft: Boolean(h.draft),
    })),
  });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error } = await adminGuard();
  if (error) return error;
  const { id } = await ctx.params;
  const [bot] = await getDb().select().from(grokbots).where(eq(grokbots.id, id)).limit(1);
  if (!bot) return fail("Não encontrado.", 404);
  if (!(await isOpenCodeCliReady())) {
    return fail(
      "OpenCode CLI não encontrado. Instale: npm i -g @opencode/cli e rode opencode auth login.",
      400,
    );
  }

  const body = (await req.json().catch(() => ({}))) as { filters?: unknown };
  const filters = normalizePlaybookFilters(body.filters ?? defaultPlaybookFilters());
  const filterErr = assertPlaybookFilters(filters);
  if (filterErr) return fail(filterErr, 400);

  // Libera fila: cancela scans/jobs ativos anteriores deste bot.
  await cancelPatternScans({
    grokbotId: id,
    reason: "Substituído por nova análise",
  });

  const scanId = crypto.randomUUID();
  const at = nowIso();
  const caps = resolveDepthCaps(filters);
  const typicalMinutes = DEPTH_TYPICAL_MINUTES[filters.depth];
  await getDb().insert(patternScans).values({
    id: scanId,
    grokbotId: id,
    status: "pending",
    objetivoStageId: filtersLabel(filters),
    filtersJson: JSON.stringify(filters),
    sampledJson: JSON.stringify({
      conversations: 0,
      messages: 0,
      progress: {
        phase: "queued",
        label: filters.compareCohorts
          ? `Na fila · até ${filters.cohortSize} fechou + ${filters.cohortSize} não · ${typicalMinutes}`
          : `Na fila · amostra até ${caps.maxConversations} conversas · em geral ${typicalMinutes}`,
        percent: 2,
        conversationsTarget: caps.maxConversations,
        conversationsListed: 0,
        conversationsFetched: 0,
        messages: 0,
        etaSeconds: null,
        startedAt: at,
        typicalMinutes,
      },
    }),
    createdAt: at,
  });

  await enqueueJob("scan_win_patterns", { grokbotId: id, scanId, filters });
  // Preferível: `pnpm worker` em outro terminal. after() tenta processar nesta request.
  after(() => {
    void drainJobs(2);
  });

  return NextResponse.json({
    ok: true,
    scan_id: scanId,
    status: "pending",
    filters,
    message: "Varredura enfileirada.",
  });
}
