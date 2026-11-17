"use client";

import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  CreditCard,
  MessageSquare,
  Sparkles,
  Wallet,
} from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";
import { ThemeToggle } from "@/components/theme/theme-toggle";

type Kpis = {
  messagesHandled: number;
  messagesForwarded?: number;
  kanbanMoves?: number;
  chargesCreated: number;
  paidCount: number;
  paidAmount: number;
  ticketMedio: number;
  recentEvents: { id: string; type: string; createdAt: string }[];
  payments: { id: string; status: string | null; amount: string | null }[];
};

const BRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function DashboardView({ name, kpis }: { name: string; kpis: Kpis }) {
  const month = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const conversion =
    kpis.messagesHandled > 0
      ? Math.round((kpis.paidCount / kpis.messagesHandled) * 100)
      : 0;
  const kanban = kpis.kanbanMoves ?? 0;
  const maxFunnel = Math.max(kpis.messagesHandled, kanban, kpis.chargesCreated, kpis.paidCount, 1);

  return (
    <div className="dash-shell min-h-screen">
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <BrandMark size="sm" lede="Desempenho" />
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--grokbott-success)]/30 bg-[var(--grokbott-success)]/10 px-2.5 py-1 text-xs text-[var(--grokbott-success)]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--grokbott-success)]" />
              IA em operação
            </span>
            <ThemeToggle />
          </div>
        </header>

        <section className="mt-10 grid gap-8 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
          <div>
            <p className="text-sm capitalize text-[var(--grokbott-text-secondary)]">{month}</p>
            <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              {name}
            </h1>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-[var(--grokbott-text-secondary)]">
              Resultados do assistente: atendimentos, cobranças e o que já entrou no caixa.
            </p>
          </div>
          <div className="dash-hero-card relative overflow-hidden rounded-2xl border border-border p-6 sm:p-8">
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[var(--grokbott-accent-sunset)]/20 blur-3xl" />
            <p className="relative text-xs font-medium uppercase tracking-[0.14em] text-[var(--grokbott-text-secondary)]">
              Recebido
            </p>
            <p className="relative mt-3 font-display text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
              <CountUp value={kpis.paidAmount} format={BRL} />
            </p>
            <div className="relative mt-4 flex flex-wrap gap-4 text-sm text-[var(--grokbott-text-secondary)]">
              <span>
                Ticket médio{" "}
                <strong className="text-[var(--grokbott-text-primary)]">{BRL(kpis.ticketMedio)}</strong>
              </span>
              <span>
                Conversão{" "}
                <strong className="text-[var(--grokbott-accent-sunset)]">{conversion}%</strong>
              </span>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          <Metric
            icon={MessageSquare}
            label="Atendimentos"
            value={kpis.messagesHandled}
            hint="Mensagens tratadas pela IA"
          />
          <Metric
            icon={CreditCard}
            label="Cobranças"
            value={kpis.chargesCreated}
            hint="Links e PIX gerados"
          />
          <Metric
            icon={Wallet}
            label="Pagamentos confirmados"
            value={kpis.paidCount}
            hint="Status recebido / pago"
            accent
          />
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-5">
          <div className="rounded-2xl border border-border bg-[var(--grokbott-surface-2)] p-6 lg:col-span-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--grokbott-accent-sunset)]" />
              <h2 className="font-display text-lg font-semibold">Funil da IA</h2>
            </div>
            <p className="mt-1 text-sm text-[var(--grokbott-text-secondary)]">
              Do primeiro contato ao pagamento confirmado.
            </p>
            <div className="mt-6 space-y-5">
              <FunnelRow
                label="Atendeu"
                value={kpis.messagesHandled}
                max={maxFunnel}
                tone="muted"
              />
              {kanban > 0 && (
                <FunnelRow label="Funil (kanban)" value={kanban} max={maxFunnel} tone="mid" />
              )}
              <FunnelRow
                label="Cobrou"
                value={kpis.chargesCreated}
                max={maxFunnel}
                tone="mid"
              />
              <FunnelRow
                label="Recebeu"
                value={kpis.paidCount}
                max={maxFunnel}
                tone="hot"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-[var(--grokbott-surface-2)] p-6 lg:col-span-2">
            <h2 className="font-display text-lg font-semibold">Em uma frase</h2>
            <p className="mt-4 text-sm leading-7 text-[var(--grokbott-text-secondary)]">
              {kpis.messagesHandled === 0 && kpis.paidCount === 0 ? (
                <>
                  O painel já está pronto. Assim que a IA atender e gerar cobranças, os números
                  sobem aqui em tempo quase real.
                </>
              ) : (
                <>
                  A IA atendeu{" "}
                  <strong className="text-[var(--grokbott-text-primary)]">
                    {kpis.messagesHandled}
                  </strong>{" "}
                  conversas, gerou{" "}
                  <strong className="text-[var(--grokbott-text-primary)]">
                    {kpis.chargesCreated}
                  </strong>{" "}
                  cobranças e confirmou{" "}
                  <strong className="text-[var(--grokbott-accent-sunset)]">{kpis.paidCount}</strong>{" "}
                  pagamentos —{" "}
                  <strong className="text-[var(--grokbott-text-primary)]">
                    {BRL(kpis.paidAmount)}
                  </strong>{" "}
                  no total.
                </>
              )}
            </p>
            <div className="mt-6 rounded-xl border border-[var(--grokbott-accent-sunset)]/25 bg-[var(--grokbott-accent-sunset)]/10 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-[var(--grokbott-accent-sunset)]">
                Destaque
              </p>
              <p className="mt-2 font-display text-2xl font-semibold tabular-nums">
                {BRL(kpis.ticketMedio)}
              </p>
              <p className="mt-1 text-xs text-[var(--grokbott-text-secondary)]">Ticket médio pago</p>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-[var(--grokbott-surface-2)] p-6">
            <h2 className="font-display text-lg font-semibold">Atividade recente</h2>
            <ul className="mt-4 space-y-0">
              {kpis.recentEvents.length ? (
                kpis.recentEvents.slice(0, 8).map((e) => (
                  <li
                    key={e.id}
                    className="flex items-start justify-between gap-3 border-t border-border py-3 first:border-t-0 first:pt-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{labelEvent(e.type)}</p>
                      <p className="mt-0.5 font-mono text-xs text-[var(--grokbott-text-tertiary)]">
                        {e.type}
                      </p>
                    </div>
                    <time className="shrink-0 text-xs text-[var(--grokbott-text-secondary)]">
                      {formatWhen(e.createdAt)}
                    </time>
                  </li>
                ))
              ) : (
                <li className="py-8 text-sm text-[var(--grokbott-text-secondary)]">
                  Ainda sem eventos. A primeira mensagem aparece aqui.
                </li>
              )}
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-[var(--grokbott-surface-2)] p-6">
            <h2 className="font-display text-lg font-semibold">Últimos pagamentos</h2>
            <ul className="mt-4 space-y-0">
              {kpis.payments.length ? (
                kpis.payments.slice(0, 8).map((p) => {
                  const paid = /RECEIVED|CONFIRMED|PAID/i.test(p.status ?? "");
                  return (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-3 border-t border-border py-3 first:border-t-0 first:pt-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs text-[var(--grokbott-text-secondary)]">
                          {p.id.slice(0, 12)}…
                        </p>
                        <p
                          className={`mt-1 text-xs ${
                            paid
                              ? "text-[var(--grokbott-success)]"
                              : "text-[var(--grokbott-text-secondary)]"
                          }`}
                        >
                          {p.status ?? "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-sm font-semibold tabular-nums">
                        {BRL(Number(p.amount ?? 0))}
                        {paid ? <ArrowUpRight className="h-3.5 w-3.5 text-[var(--grokbott-success)]" /> : null}
                      </div>
                    </li>
                  );
                })
              ) : (
                <li className="py-8 text-sm text-[var(--grokbott-text-secondary)]">
                  Nenhuma cobrança registrada ainda.
                </li>
              )}
            </ul>
          </div>
        </section>

        <footer className="mt-12 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-6 text-xs text-[var(--grokbott-text-tertiary)]">
          <span>Powered by ManyTalks Bot</span>
          <span>Dados atualizados a cada visita</span>
        </footer>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: typeof MessageSquare;
  label: string;
  value: number;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-[var(--grokbott-surface-2)] p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--grokbott-text-secondary)]">{label}</p>
        <Icon
          className={`h-4 w-4 ${accent ? "text-[var(--grokbott-accent-sunset)]" : "text-[var(--grokbott-text-tertiary)]"}`}
        />
      </div>
      <p
        className={`mt-3 font-display text-3xl font-semibold tabular-nums tracking-tight ${
          accent ? "text-[var(--grokbott-accent-sunset)]" : ""
        }`}
      >
        <CountUp value={value} />
      </p>
      <p className="mt-2 text-xs text-[var(--grokbott-text-tertiary)]">{hint}</p>
    </div>
  );
}

function FunnelRow({
  label,
  value,
  max,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  tone: "muted" | "mid" | "hot";
}) {
  const pct = Math.max(8, Math.round((value / max) * 100));
  const barColor =
    tone === "hot"
      ? "var(--grokbott-accent-sunset)"
      : tone === "mid"
        ? "color-mix(in srgb, var(--grokbott-accent-sunset) 55%, var(--grokbott-surface-3))"
        : "var(--grokbott-surface-3)";
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-sm text-[var(--grokbott-text-secondary)]">{label}</span>
        <span className="font-display text-lg font-semibold tabular-nums">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--grokbott-surface-1)]">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
    </div>
  );
}

function CountUp({
  value,
  format,
}: {
  value: number;
  format?: (n: number) => string;
}) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || value === 0) {
      setN(value);
      return;
    }
    const start = performance.now();
    const dur = 900;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(value * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  if (format) return <>{format(n)}</>;
  return <>{Math.round(n).toLocaleString("pt-BR")}</>;
}

function labelEvent(type: string) {
  if (type === "message_handled") return "Conversa atendida";
  if (type.startsWith("asaas.")) return "Evento Asaas";
  if (type.includes("payment")) return "Pagamento";
  if (type.includes("label")) return "Etiqueta aplicada";
  if (type.includes("kanban")) return "Movido no funil";
  return "Atividade do bot";
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
