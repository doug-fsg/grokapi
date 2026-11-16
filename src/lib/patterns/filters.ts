export type PlaybookDepth = "rapido" | "medio" | "profundo";
export type PlaybookStatus = "resolved" | "all" | "open";
export type PlaybookOutcomeSource = "auto" | "label" | "kanban";
export type PlaybookAnalysisKind = "close_compare" | "language";
export type PlaybookAnalysisIntent = "learn" | "audit";

export type PlaybookAnalysis = {
  kind: PlaybookAnalysisKind;
  intent: PlaybookAnalysisIntent;
};

export const ANALYSIS_KIND_OPTIONS: {
  kind: PlaybookAnalysisKind;
  label: string;
  hint: string;
}[] = [
  {
    kind: "close_compare",
    label: "Fechou × não fechou",
    hint: "Comportamento de quem converte vs quem não converte",
  },
  {
    kind: "language",
    label: "Linguagem dos atendentes",
    hint: "Como falam com o cliente",
  },
];

export type PlaybookFilters = {
  depth: PlaybookDepth;
  status: PlaybookStatus;
  /** null = todas as inboxes do bot */
  inboxId: number | null;
  /** títulos de etiqueta (amostra simples) */
  labels: string[];
  /**
   * Override do teto de conversas (ex.: teste com 1).
   * null = usa DEPTH_CAPS[depth].
   */
  maxConversations: number | null;
  analyses: PlaybookAnalysis[];
  /** Derivado: true se close_compare está nas análises */
  compareCohorts: boolean;
  whatsappOnly: boolean;
  cohortSize: number;
  outcomeSource: PlaybookOutcomeSource;
  winLabels: string[];
  loseLabels: string[];
  winStages: string[];
  loseStages: string[];
};

export type DepthCaps = {
  maxConversations: number;
  maxMsgsPerConv: number;
  maxCorpusChars: number;
};

export const DEPTH_CAPS: Record<PlaybookDepth, DepthCaps> = {
  rapido: { maxConversations: 8, maxMsgsPerConv: 20, maxCorpusChars: 12_000 },
  medio: { maxConversations: 20, maxMsgsPerConv: 40, maxCorpusChars: 28_000 },
  profundo: { maxConversations: 40, maxMsgsPerConv: 60, maxCorpusChars: 45_000 },
};

export const COHORT_SIZE_OPTIONS = [5, 10, 15, 20, 30, 40] as const;
export const COHORT_SIZE_MIN = 1;
export const COHORT_SIZE_MAX = 40;

function parseLabelList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x).trim()).filter(Boolean).slice(0, 8);
  }
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 8);
  }
  return [];
}

export function defaultPlaybookFilters(): PlaybookFilters {
  return {
    depth: "medio",
    status: "resolved",
    inboxId: null,
    labels: [],
    maxConversations: null,
    analyses: [{ kind: "close_compare", intent: "learn" }],
    compareCohorts: true,
    whatsappOnly: false,
    cohortSize: 20,
    outcomeSource: "auto",
    winLabels: [],
    loseLabels: [],
    winStages: [],
    loseStages: [],
  };
}

export function resolveDepthCaps(filters: PlaybookFilters): DepthCaps {
  const base = DEPTH_CAPS[filters.depth];
  if (filters.maxConversations == null) return base;
  const n = Math.max(1, Math.min(40, Math.floor(filters.maxConversations)));
  return { ...base, maxConversations: n };
}

export function normalizePlaybookFilters(raw: unknown): PlaybookFilters {
  const d = defaultPlaybookFilters();
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  const depth = String(o.depth ?? d.depth) as PlaybookDepth;
  const status = String(o.status ?? d.status) as PlaybookStatus;
  const maxRaw = o.maxConversations;
  const maxConversations =
    maxRaw === null || maxRaw === undefined || maxRaw === ""
      ? null
      : Math.max(1, Math.min(40, Math.floor(Number(maxRaw)) || 1));
  const analyses = parseAnalyses(o.analyses, o.compareCohorts, d.analyses);
  return {
    depth: depth in DEPTH_CAPS ? depth : d.depth,
    status: (["resolved", "all", "open"] as const).includes(status as PlaybookStatus)
      ? (status as PlaybookStatus)
      : d.status,
    inboxId:
      o.inboxId === null || o.inboxId === undefined || o.inboxId === ""
        ? null
        : Number(o.inboxId) || null,
    labels: parseLabelList(o.labels),
    maxConversations,
    analyses,
    compareCohorts: analyses.some((a) => a.kind === "close_compare"),
    whatsappOnly: o.whatsappOnly === undefined ? d.whatsappOnly : Boolean(o.whatsappOnly),
    outcomeSource: (["auto", "label", "kanban"] as const).includes(
      String(o.outcomeSource) as PlaybookOutcomeSource,
    )
      ? (o.outcomeSource as PlaybookOutcomeSource)
      : d.outcomeSource,
    cohortSize: Math.max(
      COHORT_SIZE_MIN,
      Math.min(COHORT_SIZE_MAX, Math.floor(Number(o.cohortSize) || d.cohortSize)),
    ),
    winLabels: parseLabelList(o.winLabels),
    loseLabels: parseLabelList(o.loseLabels),
    winStages: parseLabelList(o.winStages),
    loseStages: parseLabelList(o.loseStages),
  };
}

export function filtersLabel(f: PlaybookFilters): string {
  const parts: string[] = [f.depth, f.status];
  if (f.inboxId != null) parts.push(`inbox:${f.inboxId}`);
  if (f.analyses.length) {
    parts.push(
      `an:${f.analyses.map((a) => `${a.kind}:${a.intent}`).join("+")}`,
    );
  }
  if (f.compareCohorts) {
    parts.push("cohorts");
    if (f.whatsappOnly) parts.push("canal:whatsapp");
    parts.push(`n:${f.cohortSize}+${f.cohortSize}`);
    parts.push(`src:${f.outcomeSource}`);
    if (f.outcomeSource === "label") {
      if (f.winLabels.length) parts.push(`ok:${f.winLabels.join("+")}`);
      if (f.loseLabels.length) parts.push(`no:${f.loseLabels.join("+")}`);
    } else if (f.outcomeSource === "kanban") {
      if (f.winStages.length) parts.push(`ok:${f.winStages.join("+")}`);
      if (f.loseStages.length) parts.push(`no:${f.loseStages.join("+")}`);
    } else {
      parts.push("ia");
    }
  } else {
    if (f.labels.length) parts.push(`labels:${f.labels.join("+")}`);
    if (f.maxConversations != null) parts.push(`n:${f.maxConversations}`);
  }
  return parts.join("|");
}

function parseAnalyses(
  raw: unknown,
  compareCohortsLegacy: unknown,
  fallback: PlaybookAnalysis[],
): PlaybookAnalysis[] {
  const allowedKind = new Set<PlaybookAnalysisKind>(["close_compare", "language"]);
  const allowedIntent = new Set<PlaybookAnalysisIntent>(["learn", "audit"]);
  if (Array.isArray(raw) && raw.length) {
    const out: PlaybookAnalysis[] = [];
    const seen = new Set<PlaybookAnalysisKind>();
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const kind = String(o.kind) as PlaybookAnalysisKind;
      const intent = String(o.intent ?? "learn") as PlaybookAnalysisIntent;
      if (!allowedKind.has(kind) || seen.has(kind)) continue;
      seen.add(kind);
      out.push({
        kind,
        intent: allowedIntent.has(intent) ? intent : "learn",
      });
    }
    if (out.length) return out;
  }
  if (compareCohortsLegacy === false) {
    return [{ kind: "language", intent: "learn" }];
  }
  return fallback;
}

export function hasAnalysis(f: PlaybookFilters, kind: PlaybookAnalysisKind): boolean {
  return f.analyses.some((a) => a.kind === kind);
}

export function analysisIntent(
  f: PlaybookFilters,
  kind: PlaybookAnalysisKind,
): PlaybookAnalysisIntent {
  return f.analyses.find((a) => a.kind === kind)?.intent ?? "learn";
}

export function assertPlaybookFilters(f: PlaybookFilters): string | null {
  if (!f.analyses.length) return "Selecione ao menos um tipo de análise.";
  if (!f.compareCohorts) return null;
  if (f.outcomeSource === "label" && !f.winLabels.length && !f.loseLabels.length) {
    return "Escolha ao menos uma etiqueta de fechou ou de não fechou.";
  }
  if (f.outcomeSource === "kanban" && !f.winStages.length && !f.loseStages.length) {
    return "Escolha ao menos uma etapa do kanban de fechou ou de não fechou.";
  }
  return null;
}
