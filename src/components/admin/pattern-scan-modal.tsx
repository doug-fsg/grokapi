"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { LabelPicker } from "@/components/admin/label-picker";
import { PatternScanAnalyses } from "@/components/admin/pattern-scan-analyses";
import {
  PatternScanResults,
  type PatternDraftView,
} from "@/components/admin/pattern-scan-results";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  COHORT_SIZE_OPTIONS,
  defaultPlaybookFilters,
  type PlaybookDepth,
  type PlaybookFilters,
  type PlaybookOutcomeSource,
  type PlaybookStatus,
} from "@/lib/patterns/filters";
import { formatEta, type ScanProgress } from "@/lib/patterns/progress";

type ScanView = {
  id: string;
  status: string;
  filtersLabel: string;
  draft: PatternDraftView | null;
  modelUsed: string | null;
  sampled: { conversations: number; messages: number; win?: number; lose?: number } | null;
  progress: ScanProgress | null;
  error: string | null;
  sentAt: string | null;
  createdAt?: string;
};

type HistoryItem = {
  id: string;
  status: string;
  filtersLabel: string;
  createdAt: string;
  sentAt: string | null;
  error: string | null;
  sampled: ScanView["sampled"];
  modelUsed: string | null;
  hasDraft: boolean;
};

type Inbox = { id: number; name: string | null };
type View = "setup" | "history" | "result";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grokbotId: string;
  botName: string;
};

const selectCls =
  "h-9 w-full rounded-md border border-input bg-[var(--grokbott-surface-1)] px-2 text-sm";

export function PatternScanModal({ open, onOpenChange, grokbotId, botName }: Props) {
  const [filters, setFilters] = useState<PlaybookFilters>(defaultPlaybookFilters());
  const [inboxes, setInboxes] = useState<Inbox[]>([]);
  const [accountLabels, setAccountLabels] = useState<string[]>([]);
  const [kanbanStages, setKanbanStages] = useState<string[]>([]);
  const [latest, setLatest] = useState<ScanView | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [viewing, setViewing] = useState<ScanView | null>(null);
  const [opencodeOk, setOpencodeOk] = useState(false);
  const [working, setWorking] = useState<"scan" | "send" | "cancel" | null>(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("setup");
  const [ownScanId, setOwnScanId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/grokbots/${grokbotId}/pattern-scan`);
    const j = await r.json();
    if (!r.ok) {
      setError(j.error ?? "Falha ao carregar");
      return;
    }
    setOpencodeOk(Boolean(j.opencode_configured));
    setInboxes((j.inboxes as Inbox[]) ?? []);
    setAccountLabels(Array.isArray(j.labels) ? (j.labels as string[]) : []);
    setKanbanStages(Array.isArray(j.kanban_stages) ? (j.kanban_stages as string[]) : []);
    setLatest((j.latest as ScanView) ?? null);
    setHistory(Array.isArray(j.history) ? (j.history as HistoryItem[]) : []);
  }, [grokbotId]);

  useEffect(() => {
    if (!open) return;
    setMsg("");
    setError("");
    setView("setup");
    setViewing(null);
    setOwnScanId(null);
    setFilters(defaultPlaybookFilters());
    void load();
  }, [open, load]);

  const scanning = latest?.status === "pending" || latest?.status === "running";

  useEffect(() => {
    if (!open || !scanning) return;
    const t = setInterval(() => void load(), 1500);
    return () => clearInterval(t);
  }, [open, scanning, load]);

  useEffect(() => {
    if (!ownScanId || !latest) return;
    if (latest.id === ownScanId && latest.status === "ready" && latest.draft) {
      setViewing(latest);
      setView("result");
    }
  }, [ownScanId, latest]);

  const progress = scanning ? latest?.progress : null;

  function patchFilters(partial: Partial<PlaybookFilters>) {
    setFilters((cur) => {
      const next = { ...cur, ...partial };
      if (partial.analyses) {
        next.compareCohorts = partial.analyses.some((a) => a.kind === "close_compare");
      }
      return next;
    });
  }

  async function startScan() {
    setWorking("scan");
    setError("");
    setMsg("");
    try {
      const r = await fetch(`/api/admin/grokbots/${grokbotId}/pattern-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters: { ...filters } }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Falha");
      setOwnScanId(typeof j.scan_id === "string" ? j.scan_id : null);
      setMsg("Analisando…");
      setView("setup");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
    } finally {
      setWorking(null);
    }
  }

  async function sendToBot() {
    const scanId = viewing?.id;
    if (!scanId) return;
    setWorking("send");
    setError("");
    setMsg("");
    try {
      const r = await fetch(`/api/admin/grokbots/${grokbotId}/pattern-scan/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanId }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Falha");
      setMsg("Enviado ao bot.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
    } finally {
      setWorking(null);
    }
  }

  async function openHistoryItem(id: string) {
    const r = await fetch(`/api/admin/grokbots/${grokbotId}/pattern-scan?scanId=${id}`);
    const j = await r.json();
    if (!r.ok) {
      setError(j.error ?? "Falha ao abrir análise");
      return;
    }
    const scan = j.selected as ScanView | null;
    if (scan?.draft && scan.status === "ready") {
      setViewing(scan);
      setView("result");
    } else {
      setError(scan?.error || "Essa análise ainda não tem resultado.");
    }
  }

  const source = filters.outcomeSource;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <DialogTitle>Playbook — {botName}</DialogTitle>
              <DialogDescription>
                Nova análise na inbox. Histórico à parte — não abre o resultado antigo.
              </DialogDescription>
            </div>
            {view !== "history" ? (
              <Button type="button" size="sm" variant="outline" onClick={() => setView("history")}>
                Ver análises
              </Button>
            ) : (
              <Button type="button" size="sm" variant="outline" onClick={() => setView("setup")}>
                Nova análise
              </Button>
            )}
          </div>
        </DialogHeader>

        {view === "history" ? (
          <HistoryList items={history} onOpen={(id) => void openHistoryItem(id)} />
        ) : view === "result" && viewing?.draft ? (
          <PatternScanResults
            draft={viewing.draft}
            filtersLabel={viewing.filtersLabel}
            modelUsed={viewing.modelUsed}
            sampled={viewing.sampled}
            sentAt={viewing.sentAt}
            busy={working === "send"}
            onSend={sendToBot}
            onNewScan={() => {
              setView("setup");
              setViewing(null);
              setMsg("");
            }}
          />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-3">
                <Field label="Alcance" htmlFor="pb-depth">
                  <select
                    id="pb-depth"
                    className={selectCls}
                    value={filters.depth}
                    disabled={scanning}
                    onChange={(e) => patchFilters({ depth: e.target.value as PlaybookDepth })}
                  >
                    <option value="rapido">Rápido</option>
                    <option value="medio">Médio</option>
                    <option value="profundo">Profundo</option>
                  </select>
                </Field>
                <Field label="Status" htmlFor="pb-status">
                  <select
                    id="pb-status"
                    className={selectCls}
                    value={filters.status}
                    disabled={scanning}
                    onChange={(e) => patchFilters({ status: e.target.value as PlaybookStatus })}
                  >
                    <option value="resolved">Resolvidas</option>
                    <option value="all">Todas</option>
                    <option value="open">Abertas</option>
                  </select>
                </Field>
                <Field label="Inbox" htmlFor="pb-inbox">
                  <select
                    id="pb-inbox"
                    className={selectCls}
                    value={filters.inboxId ?? ""}
                    disabled={scanning}
                    onChange={(e) =>
                      patchFilters({ inboxId: e.target.value ? Number(e.target.value) : null })
                    }
                  >
                    <option value="">Todas do bot</option>
                    {inboxes.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name ?? `Inbox ${i.id}`}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid gap-3">
                <PatternScanAnalyses
                  value={filters.analyses}
                  disabled={scanning}
                  onChange={(analyses) => patchFilters({ analyses })}
                />

                {filters.compareCohorts ? (
                  <>
                    <Field label="Como classificar" htmlFor="pb-src">
                      <select
                        id="pb-src"
                        className={selectCls}
                        value={source}
                        disabled={scanning}
                        onChange={(e) =>
                          patchFilters({
                            outcomeSource: e.target.value as PlaybookOutcomeSource,
                          })
                        }
                      >
                        <option value="auto">Automático (IA lê a conversa)</option>
                        <option value="label">Etiqueta</option>
                        <option value="kanban">Etapa do kanban</option>
                      </select>
                    </Field>
                    {source === "auto" ? (
                      <p className="text-xs text-[var(--grokbott-text-secondary)]">
                        A IA lê o chat (suporte vs comercial, proposta, oportunidade perdida).
                      </p>
                    ) : null}
                    <Field label="Conversas por lado" htmlFor="pb-cohort">
                      <select
                        id="pb-cohort"
                        className={selectCls}
                        value={filters.cohortSize}
                        disabled={scanning}
                        onChange={(e) => patchFilters({ cohortSize: Number(e.target.value) })}
                      >
                        {COHORT_SIZE_OPTIONS.map((n) => (
                          <option key={n} value={n}>
                            {n} + {n}
                          </option>
                        ))}
                      </select>
                    </Field>
                    {source === "label" ? (
                      <>
                        <div className="space-y-1">
                          <Label>Etiqueta fechou</Label>
                          <LabelPicker
                            options={accountLabels}
                            value={filters.winLabels}
                            disabled={scanning}
                            max={8}
                            emptyHint="Obrigatório ao menos um lado."
                            onChange={(winLabels) => patchFilters({ winLabels })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Etiqueta não fechou</Label>
                          <LabelPicker
                            options={accountLabels}
                            value={filters.loseLabels}
                            disabled={scanning}
                            max={8}
                            emptyHint="Obrigatório ao menos um lado."
                            onChange={(loseLabels) => patchFilters({ loseLabels })}
                          />
                        </div>
                      </>
                    ) : null}
                    {source === "kanban" ? (
                      <>
                        <StageSelect
                          label="Etapa fechou"
                          stages={kanbanStages}
                          value={filters.winStages[0] ?? ""}
                          disabled={scanning}
                          onChange={(v) => patchFilters({ winStages: v ? [v] : [] })}
                        />
                        <StageSelect
                          label="Etapa não fechou"
                          stages={kanbanStages}
                          value={filters.loseStages[0] ?? ""}
                          disabled={scanning}
                          onChange={(v) => patchFilters({ loseStages: v ? [v] : [] })}
                        />
                      </>
                    ) : null}
                  </>
                ) : (
                  <div className="space-y-1">
                    <Label>Etiquetas (opcional)</Label>
                    <LabelPicker
                      options={accountLabels}
                      value={filters.labels}
                      disabled={scanning}
                      max={8}
                      emptyHint="Nenhuma etiqueta na account."
                      onChange={(labels) => patchFilters({ labels })}
                    />
                  </div>
                )}
              </div>
            </div>

            {progress ? (
              <div className="space-y-2 rounded-md border border-[var(--grokbott-hairline)] p-3">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{progress.percent}%</span>
                  <span className="text-xs text-[var(--grokbott-text-secondary)]">
                    {formatEta(progress)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--grokbott-surface-2)]">
                  <div
                    className="h-full bg-[var(--grokbott-accent-sunset)] transition-[width] duration-500"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
                <p className="text-sm text-[var(--grokbott-text-secondary)]">{progress.label}</p>
              </div>
            ) : null}

            {!opencodeOk ? (
              <p className="text-sm text-[var(--grokbott-text-secondary)]">
                Instale o OpenCode CLI e rode <code className="text-xs">opencode auth login</code>.
              </p>
            ) : null}

            <DialogFooter>
              {scanning ? (
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  disabled={working !== null}
                  onClick={async () => {
                    setWorking("cancel");
                    try {
                      const r = await fetch(
                        `/api/admin/grokbots/${grokbotId}/pattern-scan/cancel`,
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ scanId: latest?.id }),
                        },
                      );
                      const j = await r.json();
                      if (!r.ok) throw new Error(j.error ?? "Falha ao cancelar");
                      setMsg("Análise cancelada.");
                      await load();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Falha ao cancelar");
                    } finally {
                      setWorking(null);
                    }
                  }}
                >
                  {working === "cancel" ? "Cancelando…" : "Cancelar"}
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={working !== null || !opencodeOk}
                  onClick={() => void startScan()}
                >
                  {working === "scan" ? "Iniciando…" : "Analisar"}
                </Button>
              )}
            </DialogFooter>
          </>
        )}

        {error ? <p className="text-sm text-[var(--grokbott-danger)]">{error}</p> : null}
        {msg && view !== "history" ? (
          <p className="text-sm text-[var(--grokbott-success)]">{msg}</p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function StageSelect({
  label,
  stages,
  value,
  disabled,
  onChange,
}: {
  label: string;
  stages: string[];
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <select
        className={selectCls}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">—</option>
        {stages.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      {!stages.length ? (
        <p className="text-xs text-[var(--grokbott-text-secondary)]">
          Nenhuma etapa no kanban deste bot.
        </p>
      ) : null}
    </div>
  );
}

function HistoryList({
  items,
  onOpen,
}: {
  items: HistoryItem[];
  onOpen: (id: string) => void;
}) {
  if (!items.length) {
    return <p className="text-sm text-[var(--grokbott-text-secondary)]">Nenhuma análise ainda.</p>;
  }
  return (
    <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            className="w-full rounded-md border border-[var(--grokbott-hairline)] px-3 py-2 text-left text-sm hover:bg-[var(--grokbott-surface-3)]"
            onClick={() => onOpen(item.id)}
          >
            <span className="font-medium">{item.status}</span>
            <span className="text-[var(--grokbott-text-secondary)]">
              {" "}
              · {new Date(item.createdAt).toLocaleString("pt-BR")}
            </span>
            <span className="block truncate text-xs text-[var(--grokbott-text-secondary)]">
              {item.filtersLabel}
              {item.sampled
                ? ` · ${item.sampled.conversations} convs`
                : null}
              {item.sentAt ? " · enviado" : null}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
