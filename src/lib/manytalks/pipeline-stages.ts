/** Colunas do Kanban a partir de `attribute_values` (array na raiz, stage_order ou map). */
export function pipelineStagesFromAttributeValues(attributeValues: unknown): string[] {
  if (Array.isArray(attributeValues)) {
    return attributeValues
      .map((s) => {
        if (typeof s === "string") return s.trim();
        if (s && typeof s === "object" && "name" in s) {
          return String((s as { name?: unknown }).name ?? "").trim();
        }
        return "";
      })
      .filter(Boolean);
  }
  if (!attributeValues || typeof attributeValues !== "object") return [];
  const av = attributeValues as Record<string, unknown>;
  if (Array.isArray(av.stage_order) && av.stage_order.length) {
    return av.stage_order.map(String).filter(Boolean);
  }
  const stages = av.stages;
  if (Array.isArray(stages)) {
    return stages
      .map((s) => {
        if (typeof s === "string") return s.trim();
        if (s && typeof s === "object" && "name" in s) {
          return String((s as { name?: unknown }).name ?? "").trim();
        }
        return "";
      })
      .filter(Boolean);
  }
  if (stages && typeof stages === "object") {
    return Object.keys(stages as object).filter(Boolean);
  }
  return [];
}