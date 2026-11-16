"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import {
  ANALYSIS_KIND_OPTIONS,
  type PlaybookAnalysis,
  type PlaybookAnalysisIntent,
  type PlaybookAnalysisKind,
} from "@/lib/patterns/filters";

type Props = {
  value: PlaybookAnalysis[];
  disabled?: boolean;
  onChange: (next: PlaybookAnalysis[]) => void;
};

export function PatternScanAnalyses({ value, disabled, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const selected = new Set(value.map((a) => a.kind));
  const summary =
    value.length === 0
      ? "Nenhum tipo selecionado"
      : value
          .map((a) => {
            const meta = ANALYSIS_KIND_OPTIONS.find((o) => o.kind === a.kind);
            const mode = a.intent === "audit" ? "falhas" : "aprender";
            return `${meta?.label ?? a.kind} (${mode})`;
          })
          .join(", ");

  function toggle(kind: PlaybookAnalysisKind) {
    if (disabled) return;
    if (selected.has(kind)) {
      onChange(value.filter((a) => a.kind !== kind));
      return;
    }
    onChange([...value, { kind, intent: "learn" }]);
  }

  function setIntent(kind: PlaybookAnalysisKind, intent: PlaybookAnalysisIntent) {
    if (disabled) return;
    onChange(value.map((a) => (a.kind === kind ? { ...a, intent } : a)));
  }

  return (
    <div className="space-y-2">
      <Label>Tipos de análise</Label>
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          className="h-9 w-full rounded-md border border-input bg-[var(--grokbott-surface-1)] px-2 text-left text-sm disabled:opacity-50"
        >
          <span className="line-clamp-1">{summary}</span>
        </button>
        {open ? (
          <div className="absolute z-20 mt-1 w-full space-y-2 rounded-md border border-[var(--grokbott-hairline)] bg-[var(--grokbott-surface-2)] p-2 shadow-md">
            {ANALYSIS_KIND_OPTIONS.map((opt) => {
              const current = value.find((a) => a.kind === opt.kind);
              const on = Boolean(current);
              return (
                <div key={opt.kind} className="space-y-1 rounded-md border border-[var(--grokbott-hairline)] p-2">
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={on}
                      disabled={disabled}
                      onChange={() => toggle(opt.kind)}
                    />
                    <span>
                      {opt.label}
                      <span className="block text-xs text-[var(--grokbott-text-secondary)]">
                        {opt.hint}
                      </span>
                    </span>
                  </label>
                  {on ? (
                    <select
                      className="h-8 w-full rounded-md border border-input bg-[var(--grokbott-surface-1)] px-2 text-xs"
                      value={current?.intent ?? "learn"}
                      disabled={disabled}
                      onChange={(e) =>
                        setIntent(opt.kind, e.target.value as PlaybookAnalysisIntent)
                      }
                    >
                      {opt.kind === "language" ? (
                        <>
                          <option value="learn">Aprender como se comunicar</option>
                          <option value="audit">Procurar erros de linguagem</option>
                        </>
                      ) : (
                        <>
                          <option value="learn">Entender quem fecha × quem não fecha</option>
                          <option value="audit">Procurar falhas no vendedor/abordagem</option>
                        </>
                      )}
                    </select>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
