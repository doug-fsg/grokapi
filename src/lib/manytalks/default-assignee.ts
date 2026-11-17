/** Agente ManyTalks padrão para atribuição / filtro de webhooks (todos os bots). */
export function defaultManytalksAssigneeId(): number {
  const raw = process.env.DEFAULT_MANYTALKS_ASSIGNEE_ID?.trim() || "775";
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 775;
}