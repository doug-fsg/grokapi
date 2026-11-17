import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildKanbanPipelineCreateBody } from "./kanban-pipeline";

describe("buildKanbanPipelineCreateBody", () => {
  it("envia stages map + stage_order", () => {
    const body = buildKanbanPipelineCreateBody({
      name: "Vendas",
      stages: [{ name: "Novo" }, { name: "Ganho" }],
    });
    const def = body.custom_attribute_definition;
    const av = def.attribute_values as {
      stages: Record<string, { color: string }>;
      stage_order: string[];
    };
    assert.equal(def.is_kanban, true);
    assert.deepEqual(av.stage_order, ["Novo", "Ganho"]);
    assert.ok(av.stages.Novo?.color);
    assert.ok(av.stages.Ganho?.color);
  });
});