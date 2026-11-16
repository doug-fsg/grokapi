export type KnowledgeEntry = { title: string; body: string };

export function parseKnowledge(raw: string): KnowledgeEntry[] {
  const text = (raw ?? "").trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text) as { v?: number; items?: KnowledgeEntry[] };
    if (parsed && parsed.v === 1 && Array.isArray(parsed.items)) {
      return parsed.items
        .map((item) => ({
          title: String(item?.title ?? "").trim(),
          body: String(item?.body ?? "").trim(),
        }))
        .filter((item) => item.title || item.body);
    }
  } catch {
    /* texto antigo, um bloco só */
  }
  return [{ title: "Geral", body: text }];
}

export function serializeKnowledge(items: KnowledgeEntry[]): string {
  const clean = items
    .map((item) => ({ title: item.title.trim(), body: item.body.trim() }))
    .filter((item) => item.title || item.body);
  if (!clean.length) return "";
  return JSON.stringify({ v: 1, items: clean });
}

export function searchKnowledge(items: KnowledgeEntry[], query: string) {
  const words = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 1);
  if (!words.length) {
    return items.map((item) => ({ title: item.title, body: item.body }));
  }
  return items
    .map((item) => {
      const title = item.title.toLowerCase();
      const hay = `${title}\n${item.body.toLowerCase()}`;
      const score = words.reduce((sum, word) => {
        if (!hay.includes(word)) return sum;
        return sum + (title.includes(word) ? 3 : 1);
      }, 0);
      return { item, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((row) => ({ title: row.item.title, body: row.item.body }));
}
