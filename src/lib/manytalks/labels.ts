import { unwrapList } from "@/lib/manytalks/client";

/** Extrai títulos de GET /labels (payload array ou payload.labels). */
export function unwrapLabelTitles(raw: unknown): string[] {
  let rows: Record<string, unknown>[] = [];

  if (Array.isArray(raw)) {
    rows = raw as Record<string, unknown>[];
  } else if (raw && typeof raw === "object") {
    const o = raw as { payload?: unknown; data?: unknown; labels?: unknown };
    if (Array.isArray(o.payload)) {
      rows = o.payload as Record<string, unknown>[];
    } else if (
      o.payload &&
      typeof o.payload === "object" &&
      Array.isArray((o.payload as { labels?: unknown }).labels)
    ) {
      rows = (o.payload as { labels: Record<string, unknown>[] }).labels;
    } else if (Array.isArray(o.data)) {
      rows = o.data as Record<string, unknown>[];
    } else if (Array.isArray(o.labels)) {
      rows = o.labels as Record<string, unknown>[];
    } else {
      rows = unwrapList<Record<string, unknown>>(
        raw as { payload?: Record<string, unknown>[] },
      );
    }
  }

  const titles = rows
    .map((row) => String(row.title ?? row.name ?? "").trim())
    .filter(Boolean);
  return Array.from(new Set(titles)).sort((a, b) => a.localeCompare(b, "pt-BR"));
}
