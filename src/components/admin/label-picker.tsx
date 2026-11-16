"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";

type Props = {
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  max?: number;
  emptyHint?: string;
};

/** Multi-select com busca — escala melhor que checkbox list (dezenas de opções). */
export function LabelPicker({
  options,
  value,
  onChange,
  disabled,
  max = 8,
  emptyHint = "Nenhuma etiqueta disponível.",
}: Props) {
  const [query, setQuery] = useState("");

  const selected = useMemo(() => new Set(value), [value]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = options.filter((t) => !selected.has(t));
    if (!q) return pool.slice(0, 12);
    return pool.filter((t) => t.toLowerCase().includes(q)).slice(0, 12);
  }, [options, query, selected]);

  function add(title: string) {
    if (disabled || selected.has(title) || value.length >= max) return;
    onChange([...value, title]);
    setQuery("");
  }

  function remove(title: string) {
    if (disabled) return;
    onChange(value.filter((t) => t !== title));
  }

  if (!options.length) {
    return <p className="text-xs text-[var(--grokbott-text-secondary)]">{emptyHint}</p>;
  }

  return (
    <div className="space-y-2">
      {value.length ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((title) => (
            <button
              key={title}
              type="button"
              disabled={disabled}
              onClick={() => remove(title)}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--grokbott-hairline)] bg-[var(--grokbott-surface-2)] px-2 py-0.5 text-xs disabled:opacity-50"
              title="Remover"
            >
              {title}
              <span aria-hidden className="text-[var(--grokbott-text-secondary)]">
                ×
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={disabled || value.length >= max}
        placeholder={
          value.length >= max
            ? `Máximo de ${max} etiquetas`
            : `Buscar entre ${options.length} etiquetas…`
        }
        autoComplete="off"
      />

      {!disabled && value.length < max && (query.trim() || filtered.length) ? (
        <ul className="max-h-40 overflow-y-auto rounded-md border border-[var(--grokbott-hairline)]">
          {filtered.length ? (
            filtered.map((title) => (
              <li key={title}>
                <button
                  type="button"
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-[var(--grokbott-surface-2)]"
                  onClick={() => add(title)}
                >
                  {title}
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-xs text-[var(--grokbott-text-secondary)]">
              Nenhuma etiqueta com “{query.trim()}”.
            </li>
          )}
        </ul>
      ) : null}

      <p className="text-xs text-[var(--grokbott-text-secondary)]">
        {value.length}/{max} selecionadas
        {query.trim() ? "" : " · digite para filtrar"}
      </p>
    </div>
  );
}
