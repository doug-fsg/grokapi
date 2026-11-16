"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { GrokbotLabels } from "@/lib/types/manifest";

type Props = {
  grokbotId: string;
  labels: GrokbotLabels;
  onChange: (next: GrokbotLabels) => void;
};

export function LabelsConfigCard({ grokbotId, labels, onChange }: Props) {
  const [available, setAvailable] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const labelsRef = useRef(labels);
  const onChangeRef = useRef(onChange);
  labelsRef.current = labels;
  onChangeRef.current = onChange;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`/api/admin/grokbots/${grokbotId}/labels`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Falha ao listar etiquetas");
      const list = Array.isArray(j.labels) ? (j.labels as string[]) : [];
      setAvailable(list);
      // Tira da whitelist o que não existe na account (ex.: defaults antigos).
      if (list.length) {
        const cur = labelsRef.current;
        const keep = new Set(list);
        const nextTitles = cur.allowed_titles.filter((t) => keep.has(t));
        if (nextTitles.length !== cur.allowed_titles.length) {
          const meanings: Record<string, string> = {};
          for (const t of nextTitles) {
            if (cur.meanings[t] != null) meanings[t] = cur.meanings[t];
          }
          onChangeRef.current({
            allowed_titles: nextTitles,
            meanings,
            pause_bot_on: cur.pause_bot_on.filter((t) => keep.has(t)),
          });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao listar etiquetas");
    } finally {
      setLoading(false);
    }
  }, [grokbotId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => new Set(labels.allowed_titles.map((t) => t.trim()).filter(Boolean)),
    [labels.allowed_titles],
  );

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return available;
    return available.filter((t) => t.toLowerCase().includes(q));
  }, [available, filter]);

  const orphans = useMemo(
    () => labels.allowed_titles.filter((t) => t && !available.includes(t)),
    [labels.allowed_titles, available],
  );

  function toggleTitle(title: string, on: boolean) {
    if (on) {
      if (selected.has(title)) return;
      onChange({
        ...labels,
        allowed_titles: [...labels.allowed_titles, title],
        meanings: { ...labels.meanings, [title]: labels.meanings[title] ?? "" },
      });
      return;
    }
    const { [title]: _, ...meanings } = labels.meanings;
    onChange({
      allowed_titles: labels.allowed_titles.filter((x) => x !== title),
      meanings,
      pause_bot_on: labels.pause_bot_on.filter((x) => x !== title),
    });
  }

  function updateMeaning(title: string, value: string) {
    onChange({
      ...labels,
      meanings: { ...labels.meanings, [title]: value },
    });
  }

  function togglePause(title: string, on: boolean) {
    const pause = on
      ? [...new Set([...labels.pause_bot_on, title])]
      : labels.pause_bot_on.filter((x) => x !== title);
    onChange({ ...labels, pause_bot_on: pause });
  }

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <h2 className="font-semibold">Etiquetas</h2>
          <p className="text-sm text-[var(--grokbott-text-secondary)]">
            Escolha etiquetas que já existem no ManyTalks. O bot só pode aplicar essas.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading}
          onClick={() => void load()}
        >
          {loading ? "Carregando…" : "Atualizar"}
        </Button>
      </div>

      {error && <p className="text-sm text-[var(--grokbott-danger)]">{error}</p>}

      <Input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filtrar etiquetas…"
        autoComplete="off"
        disabled={loading && !available.length}
      />

      {!available.length && !loading && !error ? (
        <p className="text-sm text-[var(--grokbott-text-secondary)]">
          Nenhuma etiqueta na account. Crie no ManyTalks e clique em Atualizar.
        </p>
      ) : null}

      {!!filtered.length && (
        <ul className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-[var(--grokbott-hairline)] p-2">
          {filtered.map((t) => {
            const on = selected.has(t);
            return (
              <li key={t}>
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[var(--grokbott-surface-3)]">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => toggleTitle(t, e.target.checked)}
                  />
                  <span className="font-mono text-xs">{t}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {!!labels.allowed_titles.length && (
        <div className="space-y-2 border-t border-[var(--grokbott-hairline)] pt-3">
          <p className="text-xs font-medium text-[var(--grokbott-text-secondary)]">
            Selecionadas ({labels.allowed_titles.length})
          </p>
          <ul className="space-y-2 text-sm">
            {labels.allowed_titles.map((t) => (
              <li
                key={t}
                className="space-y-1 rounded-md border border-[var(--grokbott-hairline)] p-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs">{t}</span>
                  <button
                    type="button"
                    className="text-xs text-[var(--grokbott-danger)]"
                    onClick={() => toggleTitle(t, false)}
                  >
                    remover
                  </button>
                </div>
                {!available.includes(t) && available.length > 0 ? (
                  <p className="text-xs text-[var(--grokbott-warning)]">
                    Não encontrada agora no ManyTalks — confira o título.
                  </p>
                ) : null}
                <Input
                  value={labels.meanings[t] ?? ""}
                  onChange={(e) => updateMeaning(t, e.target.value)}
                  placeholder="Quando usar (guia pro bot)"
                />
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={labels.pause_bot_on.includes(t)}
                    onChange={(e) => togglePause(t, e.target.checked)}
                  />
                  Pausa o bot ao aplicar
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {orphans.length > 0 && available.length > 0 ? (
        <p className="text-xs text-[var(--grokbott-text-secondary)]">
          {orphans.length} etiqueta(s) salva(s) não aparecem na lista atual do ManyTalks.
        </p>
      ) : null}
    </Card>
  );
}
