import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  grokbots,
  grokbotsInboxes,
  grokbotsSecrets,
  patternScans,
} from "@/lib/db/schema";
import { createManytalksClient } from "@/lib/manytalks/client";
import { manytalksTokenFromEnc } from "@/lib/manytalks/token";
import { analyzeWinPatterns, type PatternDraft } from "@/lib/patterns/analyze";
import { assertScanActive } from "@/lib/patterns/cancel";
import {
  defaultPlaybookFilters,
  filtersLabel,
  normalizePlaybookFilters,
  resolveDepthCaps,
  type PlaybookFilters,
} from "@/lib/patterns/filters";
import {
  listConversationsMatching,
  pickDisplayId,
  pickKanbanStage,
} from "@/lib/patterns/listing";
import { buildPlaybookCorpus } from "@/lib/patterns/scan-corpus";
import { computePlaybookStats, type ConvCohort } from "@/lib/patterns/stats";
import {
  computePercent,
  DEPTH_TYPICAL_MINUTES,
  estimateEtaSeconds,
  parseScanProgress,
  type ScanPhase,
  type ScanProgress,
} from "@/lib/patterns/progress";
import { jsonParse, nowIso } from "@/lib/utils";

export type PatternScanRow = {
  id: string;
  status: string;
  filtersLabel: string;
  filters: PlaybookFilters | null;
  draft: PatternDraft | null;
  modelUsed: string | null;
  modelsTried: unknown;
  sampled: {
    conversations: number;
    messages: number;
    win?: number;
    lose?: number;
  } | null;
  progress: ScanProgress | null;
  error: string | null;
  createdAt: string;
  sentAt: string | null;
};

export type PlaybookStatusSummary = {
  status: string;
  sentAt: string | null;
  error: string | null;
  progress: ScanProgress | null;
};

function sampledWithProgress(
  progress: ScanProgress,
  conversations = 0,
  messages = 0,
) {
  return JSON.stringify({
    conversations,
    messages,
    progress,
  });
}

async function writeProgress(
  scanId: string,
  partial: Omit<ScanProgress, "percent" | "etaSeconds" | "label"> & {
    phase: ScanPhase;
    label: string;
    llmFraction?: number;
  },
) {
  const percent = computePercent(partial);
  const progress: ScanProgress = {
    phase: partial.phase,
    label: partial.label,
    percent,
    conversationsTarget: partial.conversationsTarget,
    conversationsListed: partial.conversationsListed,
    conversationsFetched: partial.conversationsFetched,
    messages: partial.messages,
    etaSeconds: estimateEtaSeconds(partial.startedAt, percent, partial.phase),
    startedAt: partial.startedAt,
    typicalMinutes: partial.typicalMinutes,
  };
  await getDb()
    .update(patternScans)
    .set({
      sampledJson: sampledWithProgress(
        progress,
        partial.conversationsListed || partial.conversationsFetched,
        partial.messages,
      ),
    })
    .where(eq(patternScans.id, scanId));
  return progress;
}

/** Último scan por bot — leve, para badge na lista. */
export async function getLatestPlaybookStatusByBot(
  grokbotIds: string[],
): Promise<Record<string, PlaybookStatusSummary>> {
  if (!grokbotIds.length) return {};
  const db = getDb();
  const out: Record<string, PlaybookStatusSummary> = {};
  await Promise.all(
    grokbotIds.map(async (id) => {
      const [row] = await db
        .select({
          status: patternScans.status,
          sentAt: patternScans.sentAt,
          error: patternScans.error,
          sampledJson: patternScans.sampledJson,
        })
        .from(patternScans)
        .where(eq(patternScans.grokbotId, id))
        .orderBy(desc(patternScans.createdAt))
        .limit(1);
      if (row) {
        out[id] = {
          status: row.status,
          sentAt: row.sentAt,
          error: row.error,
          progress: row.sampledJson
            ? parseScanProgress(jsonParse(row.sampledJson, null))
            : null,
        };
      }
    }),
  );
  return out;
}

function mapScanRow(row: typeof patternScans.$inferSelect): PatternScanRow {
  const filters = row.filtersJson
    ? normalizePlaybookFilters(jsonParse(row.filtersJson, defaultPlaybookFilters()))
    : null;
  const sampledRaw = row.sampledJson
    ? jsonParse<Record<string, unknown>>(row.sampledJson, {})
    : null;
  return {
    id: row.id,
    status: row.status,
    filtersLabel: row.objetivoStageId,
    filters,
    draft: row.draftJson ? jsonParse<PatternDraft | null>(row.draftJson, null) : null,
    modelUsed: row.modelUsed,
    modelsTried: row.modelsTriedJson ? jsonParse(row.modelsTriedJson, []) : [],
    sampled: sampledRaw
      ? {
          conversations: Number(sampledRaw.conversations ?? sampledRaw.contacts ?? 0),
          messages: Number(sampledRaw.messages ?? 0),
          win: sampledRaw.win != null ? Number(sampledRaw.win) : undefined,
          lose: sampledRaw.lose != null ? Number(sampledRaw.lose) : undefined,
        }
      : null,
    progress: sampledRaw ? parseScanProgress(sampledRaw) : null,
    error: row.error,
    createdAt: row.createdAt,
    sentAt: row.sentAt,
  };
}

export async function getLatestPatternScan(grokbotId: string): Promise<PatternScanRow | null> {
  const [row] = await getDb()
    .select()
    .from(patternScans)
    .where(eq(patternScans.grokbotId, grokbotId))
    .orderBy(desc(patternScans.createdAt))
    .limit(1);
  return row ? mapScanRow(row) : null;
}

export async function getPatternScanById(
  grokbotId: string,
  scanId: string,
): Promise<PatternScanRow | null> {
  const [row] = await getDb()
    .select()
    .from(patternScans)
    .where(and(eq(patternScans.id, scanId), eq(patternScans.grokbotId, grokbotId)))
    .limit(1);
  return row ? mapScanRow(row) : null;
}

export async function listPatternScans(grokbotId: string, limit = 40): Promise<PatternScanRow[]> {
  const rows = await getDb()
    .select()
    .from(patternScans)
    .where(eq(patternScans.grokbotId, grokbotId))
    .orderBy(desc(patternScans.createdAt))
    .limit(limit);
  return rows.map(mapScanRow);
}

export async function runPatternScan(
  grokbotId: string,
  scanId: string,
  filtersInput?: unknown,
) {
  const db = getDb();
  const [bot] = await db.select().from(grokbots).where(eq(grokbots.id, grokbotId)).limit(1);
  const [secrets] = await db
    .select()
    .from(grokbotsSecrets)
    .where(eq(grokbotsSecrets.grokbotId, grokbotId))
    .limit(1);
  const [scan] = await db
    .select()
    .from(patternScans)
    .where(eq(patternScans.id, scanId))
    .limit(1);

  if (!bot) throw new Error("GrokBot não encontrado");

  const filters = normalizePlaybookFilters(
    filtersInput ?? (scan?.filtersJson ? jsonParse(scan.filtersJson, null) : null),
  );
  const caps = resolveDepthCaps(filters);
  const typicalMinutes = DEPTH_TYPICAL_MINUTES[filters.depth];
  const startedAt = nowIso();

  const token = manytalksTokenFromEnc(secrets?.manytalksTokenEnc);
  if (!token) throw new Error("Token ManyTalks ausente (MANYTALKS_SERVICE_TOKEN ou PAT do bot).");

  console.log(
    `[pattern-scan] run start scan=${scanId.slice(0, 8)}… account=${bot.manytalksAccountId} depth=${filters.depth} caps=${JSON.stringify(caps)}`,
  );

  await db
    .update(patternScans)
    .set({
      status: "running",
      error: null,
      filtersJson: JSON.stringify(filters),
      objetivoStageId: filtersLabel(filters),
    })
    .where(eq(patternScans.id, scanId));

  const client = createManytalksClient({
    base: bot.manytalksBase,
    accountId: bot.manytalksAccountId,
    token,
  });

  const botInboxes = await db
    .select({ inboxId: grokbotsInboxes.inboxId })
    .from(grokbotsInboxes)
    .where(eq(grokbotsInboxes.grokbotId, grokbotId));
  const allowedInboxIds = new Set(botInboxes.map((i) => i.inboxId));

  const resolvedInboxBug =
    filters.status === "resolved" && filters.inboxId != null;
  const cohortSize = filters.compareCohorts ? filters.cohortSize : caps.maxConversations;
  const listTarget = filters.compareCohorts ? cohortSize * 2 : caps.maxConversations;

  await writeProgress(scanId, {
    phase: "listing",
    label: filters.compareCohorts
      ? `Listando: até ${cohortSize} fechou + ${cohortSize} não fechou`
      : `Listando conversas (até ${caps.maxConversations})`,
    conversationsTarget: listTarget,
    conversationsListed: 0,
    conversationsFetched: 0,
    messages: 0,
    startedAt,
    typicalMinutes,
  });

  type TaggedConv = { conv: Record<string, unknown>; cohort: ConvCohort };
  const tagged: TaggedConv[] = [];

  const listOpts = {
    client,
    status: filters.status,
    inboxId: filters.inboxId,
    allowedInboxIds,
    whatsappOnly: filters.whatsappOnly,
    resolvedInboxBug,
    shouldAbort: () => assertScanActive(scanId),
  };

  if (filters.compareCohorts) {
    const seen = new Set<string>();
    const source = filters.outcomeSource;

    const pushPool = async (label: string, max: number, cohort: ConvCohort, labels: string[]) => {
      const batch = await listConversationsMatching({
        ...listOpts,
        labels,
        max,
        onPage: async (page, listed) => {
          await writeProgress(scanId, {
            phase: "listing",
            label: `${label} · p.${page} · ${listed}`,
            conversationsTarget: listTarget,
            conversationsListed: seen.size + listed,
            conversationsFetched: 0,
            messages: 0,
            startedAt,
            typicalMinutes,
          });
        },
      });
      for (const conv of batch) {
        const id = pickDisplayId(conv);
        if (id && seen.has(id)) continue;
        if (id) seen.add(id);
        tagged.push({ conv, cohort });
      }
    };

    if (source === "label") {
      if (filters.winLabels.length) {
        await pushPool("Etiqueta fechou", cohortSize, "fechou", filters.winLabels);
      }
      if (filters.loseLabels.length) {
        await pushPool("Etiqueta não fechou", cohortSize, "nao_fechou", filters.loseLabels);
      }
    } else if (source === "kanban") {
      const pool = await listConversationsMatching({
        ...listOpts,
        labels: [],
        max: Math.min(80, cohortSize * 4),
        onPage: async (page, listed) => {
          await writeProgress(scanId, {
            phase: "listing",
            label: `Kanban · p.${page} · ${listed}`,
            conversationsTarget: listTarget,
            conversationsListed: listed,
            conversationsFetched: 0,
            messages: 0,
            startedAt,
            typicalMinutes,
          });
        },
      });
      const winSet = new Set(filters.winStages.map((s) => s.toLowerCase()));
      const loseSet = new Set(filters.loseStages.map((s) => s.toLowerCase()));
      for (const conv of pool) {
        const id = pickDisplayId(conv);
        if (id && seen.has(id)) continue;
        const stage = (pickKanbanStage(conv) ?? "").toLowerCase();
        if (stage && winSet.has(stage)) {
          if (id) seen.add(id);
          tagged.push({ conv, cohort: "fechou" });
        } else if (stage && loseSet.has(stage)) {
          if (id) seen.add(id);
          tagged.push({ conv, cohort: "nao_fechou" });
        }
      }
    } else {
      await pushPool("IA · amostra", cohortSize * 3, "inferir", []);
    }
  } else {
    const conversations = await listConversationsMatching({
      ...listOpts,
      labels: filters.labels,
      max: caps.maxConversations,
      onPage: async (page, listed) => {
        await writeProgress(scanId, {
          phase: "listing",
          label: `Listando conversas · página ${page} · ${listed}/${caps.maxConversations}`,
          conversationsTarget: listTarget,
          conversationsListed: listed,
          conversationsFetched: 0,
          messages: 0,
          startedAt,
          typicalMinutes,
        });
      },
    });
    for (const conv of conversations) tagged.push({ conv, cohort: "amostra" });
  }

  if (!tagged.length) {
    throw new Error(
      filters.compareCohorts
        ? "Nenhuma conversa encontrada para comparar fechou / não fechou (confira inbox e filtros)."
        : "Nenhuma conversa encontrada com esses filtros.",
    );
  }

  const target = tagged.length;
  await writeProgress(scanId, {
    phase: "messages",
    label: `Lendo mensagens 0/${target}`,
    conversationsTarget: target,
    conversationsListed: target,
    conversationsFetched: 0,
    messages: 0,
    startedAt,
    typicalMinutes,
  });

  const built = await buildPlaybookCorpus({
    scanId,
    client,
    tagged,
    filters,
    caps,
    maxWin: filters.compareCohorts ? cohortSize : undefined,
    maxLose: filters.compareCohorts ? cohortSize : undefined,
    onProgress: async (fetchedNow, messagesNow) => {
      await writeProgress(scanId, {
        phase: "messages",
        label: `Lendo mensagens ${fetchedNow}/${target}`,
        conversationsTarget: target,
        conversationsListed: target,
        conversationsFetched: fetchedNow,
        messages: messagesNow,
        startedAt,
        typicalMinutes,
      });
    },
  });
  const { corpus, facts, fetched, messageCount } = built;

  const label = filtersLabel(filters);
  await assertScanActive(scanId);
  console.log(
    `[pattern-scan] corpus pronto conv=${fetched}/${target} msgs=${messageCount} chars=${corpus.length} filters=${label}`,
  );
  await writeProgress(scanId, {
    phase: "llm",
    label: `Extraindo padrões das conversas…`,
    conversationsTarget: target,
    conversationsListed: target,
    conversationsFetched: fetched,
    messages: messageCount,
    startedAt,
    typicalMinutes,
    llmFraction: 0,
  });

  const stats = computePlaybookStats(facts);
  const analyzed = await analyzeWinPatterns(corpus, {
    filtersLabel: label,
    filters,
    stats,
    onAttempt: async (attempt) => {
      await assertScanActive(scanId);
      const llmFraction =
        attempt.phase === "done"
          ? 1
          : (attempt.index - (attempt.phase === "start" ? 1 : 0)) /
            Math.max(1, attempt.total);
      const tryLabel =
        attempt.phase === "done"
          ? "Padrões extraídos"
          : `Extraindo padrões · tentativa ${attempt.index}/${attempt.total}`;
      console.log(
        `[pattern-scan] UI ${tryLabel} model=${attempt.model} phase=${attempt.phase}`,
      );
      await writeProgress(scanId, {
        phase: "llm",
        label: tryLabel,
        conversationsTarget: target,
        conversationsListed: target,
        conversationsFetched: fetched,
        messages: messageCount,
        startedAt,
        typicalMinutes,
        llmFraction,
      });
    },
  });
  console.log(
    `[pattern-scan] LLM OK model=${analyzed.model} tried=${analyzed.tried.length}`,
  );
  await assertScanActive(scanId);
  const sampled = {
    conversations: built.blocks,
    messages: messageCount,
    win: stats.win,
    lose: stats.lose,
    stats,
    progress: {
      phase: "done" as const,
      label: "Concluído",
      percent: 100,
      conversationsTarget: target,
      conversationsListed: target,
      conversationsFetched: fetched,
      messages: messageCount,
      etaSeconds: 0,
      startedAt,
      typicalMinutes,
    },
  };

  // Só grava ready se ainda estiver ativo — evita race cancel→ready.
  await db
    .update(patternScans)
    .set({
      status: "ready",
      draftJson: JSON.stringify(analyzed.patterns),
      modelUsed: analyzed.model,
      modelsTriedJson: JSON.stringify(analyzed.tried),
      sampledJson: JSON.stringify(sampled),
      error: null,
    })
    .where(
      and(
        eq(patternScans.id, scanId),
        inArray(patternScans.status, ["pending", "running"]),
      ),
    );

  return { patterns: analyzed.patterns, model: analyzed.model, sampled, filters };
}

export async function markPatternScanFailed(scanId: string, error: string) {
  const db = getDb();
  const [row] = await db
    .select({ status: patternScans.status })
    .from(patternScans)
    .where(eq(patternScans.id, scanId))
    .limit(1);
  if (row?.status === "cancelled") return;
  await db
    .update(patternScans)
    .set({ status: "error", error: error.slice(0, 500) })
    .where(eq(patternScans.id, scanId));
}
