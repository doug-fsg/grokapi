import { assertScanActive } from "@/lib/patterns/cancel";
import { loadRecentPublicMessages, messageLine } from "@/lib/patterns/corpus";
import type { DepthCaps, PlaybookFilters } from "@/lib/patterns/filters";
import {
  pickAssigneeName,
  pickContactName,
  pickDisplayId,
} from "@/lib/patterns/listing";
import { classifyOutcomeFromLines } from "@/lib/patterns/outcome";
import {
  factsFromMessages,
  formatFactsHeader,
  type ConvCohort,
  type ConvFacts,
} from "@/lib/patterns/stats";

type MessagesClient = {
  getMessages(
    displayId: string | number,
    query?: { before?: number },
  ): Promise<unknown>;
};

export async function buildPlaybookCorpus(opts: {
  scanId: string;
  client: MessagesClient;
  tagged: { conv: Record<string, unknown>; cohort: ConvCohort }[];
  filters: PlaybookFilters;
  caps: DepthCaps;
  onProgress: (fetched: number, messages: number) => Promise<void>;
  maxWin?: number;
  maxLose?: number;
}): Promise<{ corpus: string; facts: ConvFacts[]; fetched: number; messageCount: number; blocks: number }> {
  const { scanId, client, tagged, filters, caps, onProgress } = opts;
  const maxWin = opts.maxWin ?? Infinity;
  const maxLose = opts.maxLose ?? Infinity;
  const blocks: string[] = [];
  const facts: ConvFacts[] = [];
  let messageCount = 0;
  let fetched = 0;
  let winKept = 0;
  let loseKept = 0;
  const msgPages = filters.depth === "rapido" ? 2 : filters.depth === "medio" ? 3 : 5;

  for (const { conv, cohort: seed } of tagged) {
    await assertScanActive(scanId);
    const displayId = pickDisplayId(conv);
    if (!displayId) {
      fetched += 1;
      continue;
    }
    let msgs: Record<string, unknown>[] = [];
    try {
      msgs = await loadRecentPublicMessages(client, displayId, caps.maxMsgsPerConv, msgPages);
    } catch {
      fetched += 1;
      await onProgress(fetched, messageCount);
      continue;
    }
    const lines = msgs.map(messageLine).filter(Boolean) as string[];
    fetched += 1;
    if (!lines.length) {
      await onProgress(fetched, messageCount);
      continue;
    }

    let cohort: ConvCohort = seed;
    let inferNote = "";
    if (seed === "inferir") {
      const fact0 = factsFromMessages(msgs, {
        displayId,
        cohort: "amostra",
        agent: pickAssigneeName(conv),
      });
      const inferred = classifyOutcomeFromLines(lines, {
        status: String(conv.status ?? ""),
        lastFrom: fact0.lastFrom,
        auto: filters.outcomeSource === "auto",
      });
      if (inferred.outcome === "indefinido") {
        await onProgress(fetched, messageCount);
        continue;
      }
      cohort = inferred.outcome;
      inferNote = ` | ${inferred.how}`;
    }
    if (cohort === "fechou") {
      if (winKept >= maxWin) {
        await onProgress(fetched, messageCount);
        continue;
      }
      winKept += 1;
    }
    if (cohort === "nao_fechou") {
      if (loseKept >= maxLose) {
        await onProgress(fetched, messageCount);
        continue;
      }
      loseKept += 1;
    }

    messageCount += lines.length;
    const fact = factsFromMessages(msgs, {
      displayId,
      cohort,
      agent: pickAssigneeName(conv),
    });
    facts.push(fact);
    blocks.push(
      `${formatFactsHeader(fact, pickContactName(conv, displayId))}${inferNote}\n${lines.join("\n")}`,
    );
    await onProgress(fetched, messageCount);
    if (blocks.join("\n\n").length >= caps.maxCorpusChars) break;
    if (winKept >= maxWin && loseKept >= maxLose) break;
  }

  let corpus = blocks.join("\n\n");
  if (!corpus.trim()) {
    throw new Error("Conversas sem mensagens públicas (cliente/agente) para analisar.");
  }
  if (corpus.length > caps.maxCorpusChars) corpus = corpus.slice(0, caps.maxCorpusChars);
  return { corpus, facts, fetched, messageCount, blocks: blocks.length };
}
