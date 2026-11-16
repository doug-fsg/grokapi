"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { PatternScanModal } from "@/components/admin/pattern-scan-modal";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  formatProgressShort,
  type ScanProgress,
} from "@/lib/patterns/progress";

type PlaybookStatus = {
  status: string;
  sentAt: string | null;
  error: string | null;
  progress?: ScanProgress | null;
} | null;

type Bot = {
  id: string;
  name: string;
  enabled: boolean;
  lastError: string | null;
  lastHealthAt: string | null;
  manytalksAccountId: number;
  playbook?: PlaybookStatus;
};

function playbookButtonLabel(pb: PlaybookStatus): string {
  if (!pb) return "Playbook";
  if (pb.status === "pending" || pb.status === "running") {
    return pb.progress ? formatProgressShort(pb.progress) : "Analisando…";
  }
  if (pb.status === "ready" && !pb.sentAt) return "Playbook · pronto";
  if (pb.status === "error") return "Playbook · falhou";
  if (pb.status === "cancelled") return "Playbook";
  return "Playbook";
}

function isPlaybookBusy(pb: PlaybookStatus): boolean {
  return pb?.status === "pending" || pb?.status === "running";
}

export default function GrokBotsPage() {
  const router = useRouter();
  const [bots, setBots] = useState<Bot[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [patternsBot, setPatternsBot] = useState<Bot | null>(null);
  const [deleteBot, setDeleteBot] = useState<Bot | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    const j = await fetch("/api/admin/grokbots").then((r) => r.json());
    setBots(j.grokbots ?? []);
    setReady(true);
  }

  useEffect(() => {
    void load();
  }, []);

  const anyAnalyzing = bots.some((b) => isPlaybookBusy(b.playbook ?? null));

  useEffect(() => {
    if (!anyAnalyzing) return;
    const t = setInterval(() => void load(), 1500);
    return () => clearInterval(t);
  }, [anyAnalyzing]);

  async function confirmDelete() {
    if (!deleteBot) return;
    setDeleting(true);
    setError("");
    try {
      const r = await fetch(`/api/admin/grokbots/${deleteBot.id}`, { method: "DELETE" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Falha ao excluir");
      setDeleteBot(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao excluir");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="ManyTalks Bots"
        lede="Um bot por account ManyTalks."
        action={
          <Button asChild>
            <Link href="/grokbots/new">Criar ManyTalks Bot</Link>
          </Button>
        }
      />
      {error ? <p className="text-sm text-[var(--grokbott-danger)]">{error}</p> : null}
      {anyAnalyzing ? (
        <p className="text-sm text-[var(--grokbott-text-secondary)]">
          Playbook em segundo plano — o botão mostra % e etapa (minutos, não horas: amostra
          limitada).
        </p>
      ) : null}
      <Card className="overflow-hidden p-0">
        {bots.map((b) => {
          const pb = b.playbook ?? null;
          const busy = isPlaybookBusy(pb);
          return (
            <div
              key={b.id}
              className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4 last:border-0"
            >
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => router.push(`/grokbots/${b.id}`)}
              >
                <div className="flex items-center gap-2 font-medium">
                  <span
                    className={
                      b.enabled
                        ? "inline-block h-2 w-2 rounded-full bg-[var(--grokbott-success)]"
                        : "inline-block h-2 w-2 rounded-full bg-[var(--grokbott-warning)]"
                    }
                  />
                  {b.name}
                </div>
                <div className="mt-1 text-xs text-[var(--grokbott-text-secondary)]">
                  Account {b.manytalksAccountId}
                  {b.lastError ? (
                    <span className="text-[var(--grokbott-danger)]"> · {b.lastError}</span>
                  ) : null}
                </div>
              </button>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  aria-busy={busy}
                  onClick={() => setPatternsBot(b)}
                >
                  {playbookButtonLabel(pb)}
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/grokbots/${b.id}`}>Abrir</Link>
                </Button>
                <Button size="sm" variant="danger" onClick={() => setDeleteBot(b)}>
                  Excluir
                </Button>
              </div>
            </div>
          );
        })}
        {ready && !bots.length ? (
          <p className="px-5 py-10 text-sm text-[var(--grokbott-text-secondary)]">
            Nenhum ManyTalks Bot nesta instalação.
          </p>
        ) : null}
      </Card>

      {patternsBot ? (
        <PatternScanModal
          open={Boolean(patternsBot)}
          onOpenChange={(open) => {
            if (!open) {
              setPatternsBot(null);
              void load();
            }
          }}
          grokbotId={patternsBot.id}
          botName={patternsBot.name}
        />
      ) : null}

      <ConfirmModal
        open={Boolean(deleteBot)}
        onOpenChange={(open) => {
          if (!open) setDeleteBot(null);
        }}
        title={deleteBot ? `Excluir ${deleteBot.name}?` : "Excluir"}
        description={
          deleteBot
            ? `Account ${deleteBot.manytalksAccountId}. Não dá para desfazer.`
            : ""
        }
        confirmLabel="Excluir"
        danger
        busy={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
