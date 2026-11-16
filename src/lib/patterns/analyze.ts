import {
  chatWithOpenCodeCascade,
  type CascadeAttempt,
  type CascadeProgress,
} from "@/lib/patterns/opencode-cascade";
import type { PlaybookAnalysis, PlaybookFilters } from "@/lib/patterns/filters";
import type { PlaybookStats } from "@/lib/patterns/stats";

export type PatternDraft = {
  tone: string;
  domain: "venda" | "suporte" | "misto" | "indefinido";
  objections: string[];
  openings: string[];
  closes: string[];
  do: string[];
  dont: string[];
  excerpts: string[];
  purchaseSignals: string[];
  agentLines: string[];
  silencePatterns: string[];
  mentalTriggers: string[];
  lengthVsConversion: string;
  timeToSignal: string;
  products: string[];
  agentRanking: string[];
  proposals: string[];
  lostOpportunities: string[];
  languageStyle: string[];
  languageIssues: string[];
  closeBehavior: string[];
  sellerFaults: string[];
};

export type AnalyzeResult = {
  patterns: PatternDraft;
  model: string;
  tried: CascadeAttempt[];
};

function analysisBrief(items: PlaybookAnalysis[]): string {
  if (!items.length) return "Análise geral da amostra.";
  return items
    .map((a) => {
      if (a.kind === "language" && a.intent === "learn") {
        return "LINGUAGEM / APRENDER: descreva como os atendentes se comunicam (tom, vocabulário, ritmo) para o bot copiar. NÃO cace erros. Preencha languageStyle.";
      }
      if (a.kind === "language" && a.intent === "audit") {
        return "LINGUAGEM / FALHAS: procure erros de comunicação (grosseria, frio, jargão, desalinhamento). Preencha languageIssues.";
      }
      if (a.kind === "close_compare" && a.intent === "learn") {
        return "FECHOU×NÃO / APRENDER: entenda o comportamento de quem fecha vs quem não fecha (cliente e fluxo). Não audite o vendedor. Preencha closeBehavior.";
      }
      return "FECHOU×NÃO / FALHAS: procure falhas no vendedor e na abordagem (timing, proposta, pressão, escuta). Preencha sellerFaults.";
    })
    .join("\n");
}

function buildSystem(analyses: PlaybookAnalysis[]): string {
  return `Você analisa uma amostra de conversas reais de atendimento/vendas.
Objetivo desta varredura (obedeça o modo):
${analysisBrief(analyses)}

Há coortes [fechou] e [nao_fechou] quando essa análise está ativa. Inferência é hipótese.
Há MÉTRICAS calculadas — use as faixas, não invente média.

Tarefas-base (só o que couber no objetivo):
- Domínio venda/suporte/misto.
- Se linguagem: style ou issues conforme o modo.
- Se fechou×não: comportamento OU falhas de abordagem conforme o modo.
- Silêncio, gatilhos, produtos, ranking só se ajudarem o objetivo.

Ignore ruído (teste, "oi").
Responda APENAS um JSON válido (sem markdown):
{
  "tone": "tom observado",
  "domain": "venda" | "suporte" | "misto" | "indefinido",
  "objections": [],
  "openings": [],
  "closes": [],
  "do": [],
  "dont": [],
  "excerpts": [],
  "purchaseSignals": [],
  "agentLines": [],
  "silencePatterns": [],
  "mentalTriggers": [],
  "lengthVsConversion": "",
  "timeToSignal": "",
  "products": [],
  "agentRanking": [],
  "proposals": [],
  "lostOpportunities": [],
  "languageStyle": [],
  "languageIssues": [],
  "closeBehavior": [],
  "sellerFaults": []
}
Idioma: pt-BR. Listas vazias se o modo não pedir aquele campo.`;
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      /* fallthrough */
    }
  }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    return JSON.parse(fence[1].trim());
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }
  throw new Error("Resposta sem JSON parseável");
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean).slice(0, 12);
}

function asDomain(v: unknown): PatternDraft["domain"] {
  const s = String(v ?? "").toLowerCase();
  if (s === "venda" || s === "suporte" || s === "misto" || s === "indefinido") return s;
  return "indefinido";
}

export function normalizeDraft(raw: unknown): PatternDraft {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    tone: String(o.tone ?? "").trim() || "Não identificado",
    domain: asDomain(o.domain),
    objections: asStringArray(o.objections),
    openings: asStringArray(o.openings),
    closes: asStringArray(o.closes),
    do: asStringArray(o.do),
    dont: asStringArray(o.dont),
    excerpts: asStringArray(o.excerpts).slice(0, 5),
    purchaseSignals: asStringArray(o.purchaseSignals),
    agentLines: asStringArray(o.agentLines),
    silencePatterns: asStringArray(o.silencePatterns),
    mentalTriggers: asStringArray(o.mentalTriggers),
    lengthVsConversion: String(o.lengthVsConversion ?? "").trim(),
    timeToSignal: String(o.timeToSignal ?? "").trim(),
    products: asStringArray(o.products),
    agentRanking: asStringArray(o.agentRanking),
    proposals: asStringArray(o.proposals),
    lostOpportunities: asStringArray(o.lostOpportunities),
    languageStyle: asStringArray(o.languageStyle),
    languageIssues: asStringArray(o.languageIssues),
    closeBehavior: asStringArray(o.closeBehavior),
    sellerFaults: asStringArray(o.sellerFaults),
  };
}

export async function analyzeWinPatterns(
  corpus: string,
  opts?: {
    filtersLabel?: string;
    filters?: PlaybookFilters;
    stats?: PlaybookStats | null;
    onAttempt?: (p: CascadeProgress) => void | Promise<void>;
  },
): Promise<AnalyzeResult> {
  const label = opts?.filtersLabel?.trim() || "filtros do operador";
  const analyses = opts?.filters?.analyses ?? [];
  const metrics = opts?.stats
    ? `\n\nMÉTRICAS (calculadas; use estas faixas, não invente média):\n${JSON.stringify(opts.stats)}`
    : "";
  const result = await chatWithOpenCodeCascade({
    system: buildSystem(analyses),
    user: `Amostra (filtros: ${label}). Coortes [fechou]/[nao_fechou] se essa análise estiver ativa.${metrics}\n\n${corpus}`,
    temperature: 0.2,
    onAttempt: opts?.onAttempt,
    acceptContent: (content) => {
      try {
        extractJsonObject(content);
        return true;
      } catch {
        return false;
      }
    },
  });
  return {
    patterns: normalizeDraft(extractJsonObject(result.content)),
    model: result.model,
    tried: result.tried,
  };
}
