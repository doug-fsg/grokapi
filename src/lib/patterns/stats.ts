import { isPublicChatMessage } from "@/lib/patterns/corpus";

export const DURATION_BANDS = ["<1h", "1–24h", "1–3d", "3–7d", ">7d"] as const;
export type DurationBand = (typeof DURATION_BANDS)[number];

export type ConvCohort = "fechou" | "nao_fechou" | "amostra" | "inferir";

export type ConvFacts = {
  displayId: string;
  cohort: ConvCohort;
  agent: string;
  durationMs: number | null;
  band: DurationBand | null;
  publicMsgs: number;
  clientMsgs: number;
  agentMsgs: number;
  lastFrom: "cliente" | "agente" | null;
  silentClient: boolean;
};

export type PlaybookStats = {
  n: number;
  win: number;
  lose: number;
  durationBands: Record<DurationBand, { win: number; lose: number; other: number }>;
  longerChats: string;
  timeToClose: string;
  agents: { agent: string; win: number; lose: number; rate: string }[];
  silence: { silent: number; withReply: number; note: string };
};

function msgTimeMs(m: Record<string, unknown>): number | null {
  const t = m.created_at;
  if (typeof t === "number") return t > 1e12 ? t : t * 1000;
  const p = Date.parse(String(t ?? ""));
  return Number.isFinite(p) ? p : null;
}

function bandOf(ms: number): DurationBand {
  const h = ms / 3_600_000;
  if (h < 1) return "<1h";
  if (h < 24) return "1–24h";
  if (h < 72) return "1–3d";
  if (h < 168) return "3–7d";
  return ">7d";
}

export function factsFromMessages(
  msgs: Record<string, unknown>[],
  meta: { displayId: string; cohort: ConvCohort; agent: string },
): ConvFacts {
  const publicMsgs = msgs.filter(isPublicChatMessage);
  const times = publicMsgs.map(msgTimeMs).filter((t): t is number => t != null);
  const durationMs =
    times.length >= 2 ? Math.max(0, Math.max(...times) - Math.min(...times)) : times.length === 1 ? 0 : null;
  let clientMsgs = 0;
  let agentMsgs = 0;
  let lastFrom: ConvFacts["lastFrom"] = null;
  for (const m of publicMsgs) {
    const raw = m.message_type ?? m.type;
    const n = typeof raw === "number" ? raw : Number(raw);
    const type = String(raw ?? "");
    const client = type === "incoming" || type === "0" || n === 0;
    if (client) {
      clientMsgs += 1;
      lastFrom = "cliente";
    } else {
      agentMsgs += 1;
      lastFrom = "agente";
    }
  }
  return {
    displayId: meta.displayId,
    cohort: meta.cohort,
    agent: meta.agent,
    durationMs,
    band: durationMs != null ? bandOf(durationMs) : null,
    publicMsgs: publicMsgs.length,
    clientMsgs,
    agentMsgs,
    lastFrom,
    silentClient: lastFrom === "agente" && clientMsgs > 0,
  };
}

function emptyBands(): PlaybookStats["durationBands"] {
  return {
    "<1h": { win: 0, lose: 0, other: 0 },
    "1–24h": { win: 0, lose: 0, other: 0 },
    "1–3d": { win: 0, lose: 0, other: 0 },
    "3–7d": { win: 0, lose: 0, other: 0 },
    ">7d": { win: 0, lose: 0, other: 0 },
  };
}

function pct(win: number, lose: number): string {
  const t = win + lose;
  if (!t) return "n/d";
  return `${Math.round((win / t) * 100)}% (${win}/${t})`;
}

export function computePlaybookStats(facts: ConvFacts[]): PlaybookStats {
  const durationBands = emptyBands();
  const byAgent = new Map<string, { win: number; lose: number }>();
  let win = 0;
  let lose = 0;
  let silent = 0;
  let withReply = 0;

  for (const f of facts) {
    if (f.cohort === "fechou") win += 1;
    else if (f.cohort === "nao_fechou") lose += 1;
    if (f.band) {
      const slot = durationBands[f.band];
      if (f.cohort === "fechou") slot.win += 1;
      else if (f.cohort === "nao_fechou") slot.lose += 1;
      else slot.other += 1;
    }
    const ag = byAgent.get(f.agent) ?? { win: 0, lose: 0 };
    if (f.cohort === "fechou") ag.win += 1;
    if (f.cohort === "nao_fechou") ag.lose += 1;
    byAgent.set(f.agent, ag);
    if (f.silentClient) silent += 1;
    else if (f.clientMsgs > 0) withReply += 1;
  }

  const longerChats = DURATION_BANDS.map((b) => {
    const s = durationBands[b];
    return `${b}: fechou ${s.win} / não ${s.lose}`;
  }).join("; ");

  const timeToClose = `Faixas até o último msg (não use média): ${DURATION_BANDS.filter((b) => durationBands[b].win).map((b) => `${b}→${durationBands[b].win} fecharam`).join(", ") || "nenhum fechamento na amostra"}`;

  const agents = [...byAgent.entries()]
    .map(([agent, v]) => ({
      agent,
      win: v.win,
      lose: v.lose,
      rate: pct(v.win, v.lose),
    }))
    .sort((a, b) => b.win - a.win || a.lose - b.lose)
    .slice(0, 12);

  return {
    n: facts.length,
    win,
    lose,
    durationBands,
    longerChats,
    timeToClose,
    agents,
    silence: {
      silent,
      withReply,
      note: `${silent} conversas em que o cliente parou de responder após o agente; ${withReply} com resposta do cliente.`,
    },
  };
}

export function formatFactsHeader(f: ConvFacts, contactName: string): string {
  const dur =
    f.durationMs == null
      ? "duração n/d"
      : f.durationMs < 3_600_000
        ? `${Math.round(f.durationMs / 60_000)} min`
        : `${Math.round(f.durationMs / 3_600_000)} h`;
  return `### [${f.cohort}] ${contactName} (conv ${f.displayId}) | agente: ${f.agent} | ${dur} (${f.band ?? "?"}) | ${f.publicMsgs} msgs`;
}
