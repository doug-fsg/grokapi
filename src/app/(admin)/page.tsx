"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";

type Overview = {
  grokbots: { id: string; name: string; enabled: boolean; lastError: string | null }[];
  errors24h: { id: string; name: string; lastError: string | null }[];
  publications: { grokbotId: string; version: number; publishedAt: string }[];
};

export default function OverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  useEffect(() => {
    fetch("/api/admin/overview")
      .then((r) => r.json())
      .then(setData);
  }, []);

  const bots = data?.grokbots ?? [];
  const active = bots.filter((b) => b.enabled).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Visão geral"
        lede="Bots nesta instalação, falhas das últimas 24h e manifestos publicados."
      />
      <section className="grid overflow-hidden rounded-md border border-border sm:grid-cols-3">
        <Metric label="ManyTalks Bots" value={data ? String(bots.length) : "—"} hint={`${active} ativos`} />
        <Metric
          label="Erros em 24h"
          value={data ? String(data.errors24h.length) : "—"}
          tone={data && data.errors24h.length > 0 ? "danger" : "default"}
        />
        <Metric
          label="Publicações"
          value={data ? String(data.publications.length) : "—"}
        />
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="p-0">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-display text-lg font-semibold">Contas</h2>
          </div>
          <ul>
            {bots.map((b) => (
              <li key={b.id} className="border-b border-border last:border-0">
                <Link
                  href={`/grokbots/${b.id}`}
                  className="flex min-h-12 items-center justify-between gap-3 px-5 text-sm hover:bg-[var(--grokbott-surface-3)]"
                >
                  <span className="truncate font-medium">{b.name}</span>
                  <span
                    className={
                      b.enabled
                        ? "text-[var(--grokbott-success)]"
                        : "text-[var(--grokbott-text-secondary)]"
                    }
                  >
                    {b.enabled ? "Ativo" : "Pausado"}
                  </span>
                </Link>
              </li>
            ))}
            {data && !bots.length && (
              <li className="px-5 py-8 text-sm text-[var(--grokbott-text-secondary)]">
                Nenhum ManyTalks Bot ainda.{" "}
                <Link href="/grokbots/new" className="text-[var(--grokbott-link)] underline">
                  Criar o primeiro
                </Link>
              </li>
            )}
          </ul>
        </Card>
        <Card className="p-0">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-display text-lg font-semibold">Falhas recentes</h2>
          </div>
          <ul>
            {(data?.errors24h ?? []).map((b) => (
              <li key={b.id} className="border-b border-border px-5 py-3 last:border-0">
                <Link href={`/grokbots/${b.id}`} className="text-sm font-medium hover:underline">
                  {b.name}
                </Link>
                {b.lastError ? (
                  <p className="mt-1 text-xs text-[var(--grokbott-danger)]">{b.lastError}</p>
                ) : null}
              </li>
            ))}
            {data && !data.errors24h.length && (
              <li className="px-5 py-8 text-sm text-[var(--grokbott-text-secondary)]">
                Nenhuma falha nas últimas 24 horas.
              </li>
            )}
          </ul>
        </Card>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "danger";
}) {
  return (
    <div className="border-b border-border bg-[var(--grokbott-surface-2)] px-5 py-5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <div className="text-xs text-[var(--grokbott-text-secondary)]">{label}</div>
      <div
        className={`mt-2 font-display text-4xl font-semibold tabular-nums tracking-tight ${
          tone === "danger" ? "text-[var(--grokbott-danger)]" : ""
        }`}
      >
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-[var(--grokbott-text-tertiary)]">{hint}</div> : null}
    </div>
  );
}
