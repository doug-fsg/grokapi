import type { PlaybookDepth } from "@/lib/patterns/filters";

export type ScanPhase = "queued" | "listing" | "messages" | "llm" | "done";

export type ScanProgress = {
  phase: ScanPhase;
  label: string;
  percent: number;
  conversationsTarget: number;
  conversationsListed: number;
  conversationsFetched: number;
  messages: number;
  etaSeconds: number | null;
  startedAt: string;
  typicalMinutes: string;
};

export const DEPTH_TYPICAL_MINUTES: Record<PlaybookDepth, string> = {
  rapido: "1–3 min",
  medio: "1–4 min",
  profundo: "2–5 min",
};

const PHASE_WEIGHT = {
  listing: 15,
  messages: 55,
  llm: 30,
} as const;

export function computePercent(input: {
  phase: ScanPhase;
  conversationsTarget: number;
  conversationsListed: number;
  conversationsFetched: number;
  /** 0–1 progresso dentro da fase IA (cascade de modelos). */
  llmFraction?: number;
}): number {
  const target = Math.max(1, input.conversationsTarget);
  if (input.phase === "queued") return 2;
  if (input.phase === "listing") {
    const listed = Math.min(1, input.conversationsListed / target);
    return Math.round(listed * PHASE_WEIGHT.listing);
  }
  if (input.phase === "messages") {
    const fetched = Math.min(1, input.conversationsFetched / target);
    return Math.round(PHASE_WEIGHT.listing + fetched * PHASE_WEIGHT.messages);
  }
  if (input.phase === "llm") {
    const frac = Math.max(0, Math.min(1, input.llmFraction ?? 0));
    return Math.round(
      PHASE_WEIGHT.listing + PHASE_WEIGHT.messages + 2 + frac * (PHASE_WEIGHT.llm - 2),
    );
  }
  return 100;
}

export function estimateEtaSeconds(
  startedAt: string,
  percent: number,
  phase: ScanPhase,
): number | null {
  if (phase === "llm") return null; // IA: faixa tipica no label
  if (percent < 8) return null;
  const started = Date.parse(startedAt);
  if (!Number.isFinite(started)) return null;
  const elapsed = (Date.now() - started) / 1000;
  if (elapsed < 3) return null;
  const remaining = (elapsed * (100 - percent)) / percent;
  if (!Number.isFinite(remaining) || remaining < 0) return null;
  return Math.round(Math.min(remaining, 60 * 30));
}

export function formatEta(progress: ScanProgress): string {
  if (progress.phase === "llm") {
    return `em geral ${progress.typicalMinutes}`;
  }
  if (progress.etaSeconds == null) return `em geral ${progress.typicalMinutes}`;
  if (progress.etaSeconds < 45) return `~${progress.etaSeconds}s restantes`;
  const mins = Math.max(1, Math.round(progress.etaSeconds / 60));
  return `~${mins} min restantes`;
}

export function formatProgressShort(progress: ScanProgress): string {
  if (progress.phase === "queued") return "Na fila…";
  if (progress.phase === "listing") {
    return `${progress.percent}% · listando`;
  }
  if (progress.phase === "messages") {
    return `${progress.conversationsFetched}/${progress.conversationsTarget} · ${progress.percent}%`;
  }
  if (progress.phase === "llm") return `${progress.percent}% · extraindo`;
  return "Pronto";
}

export function parseScanProgress(raw: unknown): ScanProgress | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const progress = (o.progress && typeof o.progress === "object" ? o.progress : o) as Record<
    string,
    unknown
  >;
  const phase = String(progress.phase ?? "");
  if (!["queued", "listing", "messages", "llm", "done"].includes(phase)) return null;
  return {
    phase: phase as ScanPhase,
    label: String(progress.label ?? ""),
    percent: Math.max(0, Math.min(100, Number(progress.percent) || 0)),
    conversationsTarget: Number(progress.conversationsTarget) || 0,
    conversationsListed: Number(progress.conversationsListed) || 0,
    conversationsFetched: Number(progress.conversationsFetched) || 0,
    messages: Number(progress.messages) || 0,
    etaSeconds:
      progress.etaSeconds == null || progress.etaSeconds === ""
        ? null
        : Number(progress.etaSeconds),
    startedAt: String(progress.startedAt ?? ""),
    typicalMinutes: String(progress.typicalMinutes ?? "2–5 min"),
  };
}
