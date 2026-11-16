/** Aceita "Authorization" ou "Authorization: Bearer …" colado do painel. */
export function parseRoutineCabecalho(raw: string): {
  header: string;
  valueFromHeader: string | null;
} {
  const t = raw.trim();
  const colon = t.indexOf(":");
  if (colon <= 0) return { header: t || "Authorization", valueFromHeader: null };
  return {
    header: t.slice(0, colon).trim() || "Authorization",
    valueFromHeader: t.slice(colon + 1).trim() || null,
  };
}
