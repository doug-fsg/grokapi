"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Bot = { id: string; name: string; manytalksAccountId: number };
type LogRow = {
  id: string;
  grokbotId: string;
  conversationId: string | null;
  kind: string;
  payloadRedacted: string;
  createdAt: string;
  botName: string | null;
  accountId: number | null;
};

export function LogsClient() {
  const searchParams = useSearchParams();
  const [bots, setBots] = useState<Bot[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [grokbotId, setGrokbotId] = useState(() => searchParams.get("grokbotId")?.trim() || "");
  const [kind, setKind] = useState("");
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<LogRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    const fromUrl = searchParams.get("grokbotId")?.trim() || "";
    setGrokbotId(fromUrl);
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (grokbotId) params.set("grokbotId", grokbotId);
      if (kind) params.set("kind", kind);
      if (q.trim()) params.set("q", q.trim());
      params.set("limit", "150");
      const r = await fetch(`/api/admin/logs?${params}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Falha ao carregar logs");
      setLogs(j.logs ?? []);
      setBots(j.bots ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, [grokbotId, kind, q]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Logs</h1>
          <p className="text-sm text-[var(--grokbott-text-secondary)]">
            Tudo que o ManyTalks Bot solicitou: tools, respostas, erros e Asaas (payload redigido).
          </p>
        </div>
        <Button variant="outline" disabled={loading} onClick={() => void load()}>
          Atualizar
        </Button>
      </div>

      <Card className="grid gap-3 md:grid-cols-4">
        <div className="space-y-1">
          <Label>ManyTalks Bot</Label>
          <select
            className="h-9 w-full rounded-md border border-input bg-[var(--grokbott-surface-1)] px-2 text-sm"
            value={grokbotId}
            onChange={(e) => setGrokbotId(e.target.value)}
          >
            <option value="">Todos</option>
            {bots.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} (#{b.manytalksAccountId})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label>Tipo</Label>
          <select
            className="h-9 w-full rounded-md border border-input bg-[var(--grokbott-surface-1)] px-2 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="tools">Tools (solicitações)</option>
            <option value="errors">Erros</option>
            <option value="grok_turn">Turno Grok</option>
            <option value="grok_reply_text">Texto final</option>
            <option value="asaas_payment_confirmed">Asaas pago</option>
          </select>
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label>Busca no payload</Label>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="conversation, tool, estágio…"
            onKeyDown={(e) => {
              if (e.key === "Enter") void load();
            }}
          />
        </div>
      </Card>

      {error && <p className="text-sm text-[var(--grokbott-danger)]">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="overflow-hidden p-0">
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-[var(--grokbott-surface-2)] text-xs text-[var(--grokbott-text-secondary)]">
                <tr>
                  <th className="px-3 py-2 font-medium">Quando</th>
                  <th className="px-3 py-2 font-medium">Bot</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 font-medium">Conversa</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr
                    key={l.id}
                    className={`cursor-pointer border-t border-[var(--grokbott-hairline)] hover:bg-[var(--grokbott-surface-3)] ${
                      selected?.id === l.id ? "bg-[var(--grokbott-surface-3)]" : ""
                    }`}
                    onClick={() => setSelected(l)}
                  >
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                      {l.createdAt.replace("T", " ").slice(0, 19)}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/grokbots/${l.grokbotId}`}
                        className="underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {l.botName ?? l.grokbotId.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-1.5 py-0.5 font-mono text-xs ${
                          l.kind.includes("error")
                            ? "bg-[var(--grokbott-danger)]/20 text-[var(--grokbott-danger)]"
                            : l.kind.startsWith("tool:")
                              ? "bg-[var(--grokbott-accent-dusk)]/20"
                              : "bg-[var(--grokbott-surface-1)]"
                        }`}
                      >
                        {l.kind}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{l.conversationId ?? "—"}</td>
                  </tr>
                ))}
                {!logs.length && !loading && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-8 text-center text-[var(--grokbott-text-secondary)]"
                    >
                      Nenhum log ainda. Quando o bot atender uma conversa, as solicitações aparecem
                      aqui.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="space-y-2">
          <h2 className="font-semibold">Detalhe</h2>
          {!selected ? (
            <p className="text-sm text-[var(--grokbott-text-secondary)]">
              Selecione uma linha para ver o payload.
            </p>
          ) : (
            <>
              <p className="text-xs text-[var(--grokbott-text-secondary)]">
                {selected.kind} · {selected.createdAt}
              </p>
              <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md border border-[var(--grokbott-hairline)] bg-[var(--grokbott-canvas)] p-3 font-mono text-xs">
                {pretty(selected.payloadRedacted)}
              </pre>
              {grokbotId ? (
                <Button size="sm" variant="danger" onClick={() => setConfirmClear(true)}>
                  Limpar logs deste bot
                </Button>
              ) : null}
            </>
          )}
        </Card>
      </div>

      <ConfirmModal
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Limpar logs?"
        description="Apaga todos os logs deste ManyTalks Bot. Não dá para desfazer."
        confirmLabel="Limpar"
        danger
        busy={clearing}
        onConfirm={async () => {
          setClearing(true);
          try {
            await fetch(`/api/admin/logs?grokbotId=${grokbotId}`, { method: "DELETE" });
            setSelected(null);
            setConfirmClear(false);
            void load();
          } finally {
            setClearing(false);
          }
        }}
      />
    </div>
  );
}

function pretty(raw: string) {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
