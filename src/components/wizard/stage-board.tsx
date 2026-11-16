"use client";

export function StageBoard({
  stages,
  onRemove,
}: {
  stages: string[];
  onRemove: (name: string) => void;
}) {
  if (!stages.length) {
    return (
      <p className="text-sm text-[var(--grokbott-text-secondary)]">Nenhuma coluna ainda.</p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {stages.map((s, i) => (
        <div key={s} className="flex items-center gap-1">
          {i > 0 && (
            <span className="px-0.5 text-xs text-[var(--grokbott-text-secondary)]">→</span>
          )}
          <span className="inline-flex items-center gap-1 rounded-md bg-[var(--grokbott-surface-3)] px-2 py-1 text-sm">
            {s}
            <button
              type="button"
              className="text-[var(--grokbott-text-secondary)] hover:text-[var(--grokbott-danger)]"
              aria-label={`Remover ${s}`}
              onClick={() => onRemove(s)}
            >
              ×
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}
