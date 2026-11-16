"use client";

import { Button } from "@/components/ui/button";

export type PatternDraftView = {
  tone: string;
  domain?: string;
  objections: string[];
  openings: string[];
  closes: string[];
  do: string[];
  dont: string[];
  excerpts: string[];
  purchaseSignals?: string[];
  agentLines?: string[];
  silencePatterns?: string[];
  mentalTriggers?: string[];
  lengthVsConversion?: string;
  timeToSignal?: string;
  products?: string[];
  agentRanking?: string[];
  proposals?: string[];
  lostOpportunities?: string[];
  languageStyle?: string[];
  languageIssues?: string[];
  closeBehavior?: string[];
  sellerFaults?: string[];
};

type Sampled = {
  conversations: number;
  messages: number;
  win?: number;
  lose?: number;
};

type Props = {
  draft: PatternDraftView;
  filtersLabel?: string | null;
  modelUsed?: string | null;
  sampled?: Sampled | null;
  sentAt?: string | null;
  busy?: boolean;
  onSend: () => void | Promise<void>;
  onNewScan: () => void;
};

export function PatternScanResults({
  draft,
  filtersLabel,
  modelUsed,
  sampled,
  sentAt,
  busy,
  onSend,
  onNewScan,
}: Props) {
  const domain =
    draft.domain && draft.domain !== "indefinido" ? draft.domain : null;
  const meta = [
    filtersLabel || null,
    domain ? `domínio: ${domain}` : null,
    modelUsed || null,
    sampled
      ? `${sampled.conversations} conversa${sampled.conversations === 1 ? "" : "s"} · ${sampled.messages} msgs`
      : null,
    sampled?.win != null || sampled?.lose != null
      ? `fechou ${sampled?.win ?? 0} · não ${sampled?.lose ?? 0}`
      : null,
    sentAt ? "já enviado ao bot" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-medium text-[var(--grokbott-success)]">Análise pronta</p>
        {meta ? (
          <p className="text-xs text-[var(--grokbott-text-secondary)]">{meta}</p>
        ) : null}
      </div>

      <section className="space-y-1.5 rounded-lg border border-[var(--grokbott-hairline)] bg-[var(--grokbott-surface-3)] p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--grokbott-text-secondary)]">
          Tom
        </h3>
        <p className="text-sm leading-relaxed">{draft.tone || "—"}</p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <ResultList title="Sinais de compra" items={draft.purchaseSignals} />
        <ResultList title="Linha por atendente" items={draft.agentLines} />
        <ResultList title="Silêncio do cliente" items={draft.silencePatterns} />
        <ResultList title="Gatilhos mentais" items={draft.mentalTriggers} />
        <ResultText title="Duração × fechamento" text={draft.lengthVsConversion} />
        <ResultText title="Tempo até sinal (faixas)" text={draft.timeToSignal} />
        <ResultList title="Produtos / facilidade" items={draft.products} />
        <ResultList title="Ranking atendente" items={draft.agentRanking} />
        <ResultList title="Propostas" items={draft.proposals} />
        <ResultList title="Oportunidades perdidas" items={draft.lostOpportunities} />
        <ResultList title="Linguagem (aprender)" items={draft.languageStyle} />
        <ResultList title="Linguagem (falhas)" items={draft.languageIssues} />
        <ResultList title="Comportamento de fechamento" items={draft.closeBehavior} />
        <ResultList title="Falhas da abordagem" items={draft.sellerFaults} accent="warn" />
        <ResultList title="Objeções" items={draft.objections} empty="Nenhuma recorrente" />
        <ResultList title="Aberturas" items={draft.openings} empty="Nenhuma clara" />
        <ResultList title="Fechamentos" items={draft.closes} empty="Nenhum claro" />
        <ResultList title="Faça" items={draft.do} empty="Sem recomendações" accent="ok" />
        <ResultList title="Evite" items={draft.dont} empty="Sem alertas" accent="warn" />
        <ResultList title="Trechos" items={draft.excerpts} empty="Sem trechos" />
      </div>

      <div className="flex flex-wrap gap-2 border-t border-[var(--grokbott-hairline)] pt-3">
        <Button type="button" size="sm" disabled={busy} onClick={() => void onSend()}>
          {busy ? "Enviando…" : sentAt ? "Enviar de novo" : "Enviar ao bot"}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onNewScan}>
          Nova análise
        </Button>
      </div>
    </div>
  );
}

function ResultText({ title, text }: { title: string; text?: string }) {
  return (
    <section className="space-y-1.5 rounded-lg border border-[var(--grokbott-hairline)] p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--grokbott-text-secondary)]">
        {title}
      </h3>
      <p className="text-sm leading-relaxed">
        {text?.trim() || <span className="text-[var(--grokbott-text-tertiary)]">Sem dado</span>}
      </p>
    </section>
  );
}

function ResultList({
  title,
  items,
  empty = "Sem dado",
  accent,
}: {
  title: string;
  items?: string[];
  empty?: string;
  accent?: "ok" | "warn";
}) {
  const list = items ?? [];
  const border =
    accent === "ok"
      ? "border-[var(--grokbott-success)]/25"
      : accent === "warn"
        ? "border-[var(--grokbott-warning)]/25"
        : "border-[var(--grokbott-hairline)]";

  return (
    <section className={`space-y-1.5 rounded-lg border ${border} p-3`}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--grokbott-text-secondary)]">
        {title}
        {list.length ? (
          <span className="ml-1 font-normal normal-case">({list.length})</span>
        ) : null}
      </h3>
      {list.length ? (
        <ul className="space-y-1.5 text-sm leading-snug text-[var(--grokbott-text-secondary)]">
          {list.map((item, i) => (
            <li key={`${title}-${i}`} className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--grokbott-accent-sunset)]" />
              <span className="min-w-0 break-words text-[var(--grokbott-text-primary)]">
                {item}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--grokbott-text-tertiary)]">{empty}</p>
      )}
    </section>
  );
}
