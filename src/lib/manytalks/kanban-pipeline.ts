const DEFAULT_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ec4899", "#8B5CF6"];

export type KanbanStageInput = { name: string; color?: string };

function slugAttributeKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 80);
}

export function kanbanStagesPayload(stages: KanbanStageInput[]): { name: string; color: string }[] {
  return stages
    .map((s) => String(s.name ?? "").trim())
    .filter(Boolean)
    .map((name, i) => ({
      name,
      color: stages[i]?.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]!,
    }));
}

/** Formato aceito pela API ManyTalks ao criar/atualizar colunas do funil. */
export function buildKanbanAttributeValuesObject(stages: KanbanStageInput[]) {
  const list = kanbanStagesPayload(stages);
  if (!list.length) throw new Error("Informe ao menos uma coluna do funil.");
  const stageMap: Record<string, { color: string }> = {};
  for (const s of list) {
    stageMap[s.name] = { color: s.color };
  }
  return {
    stages: stageMap,
    stage_order: list.map((s) => s.name),
    ownership_mode: "linked" as const,
    permissions: {} as Record<string, unknown>,
  };
}

export function buildKanbanPipelineCreateBody(input: {
  name: string;
  key?: string;
  stages: KanbanStageInput[];
}) {
  return {
    custom_attribute_definition: {
      attribute_display_name: input.name.trim(),
      attribute_key: input.key?.trim() || slugAttributeKey(input.name),
      attribute_display_type: "list",
      attribute_model: "contact_attribute",
      is_kanban: true,
      attribute_values: buildKanbanAttributeValuesObject(input.stages),
    },
  };
}

export function buildKanbanPipelinePatchStages(stages: KanbanStageInput[]) {
  return {
    custom_attribute_definition: {
      attribute_values: buildKanbanAttributeValuesObject(stages),
    },
  };
}