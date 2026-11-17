import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pipelineStagesFromAttributeValues } from "./pipeline-stages";

describe("pipelineStagesFromAttributeValues", () => {
  it("lê array na raiz (formato ManyTalks)", () => {
    assert.deepEqual(
      pipelineStagesFromAttributeValues([
        { name: "Novo", color: "#6366f1" },
        { name: "Ganho", color: "#22c55e" },
      ]),
      ["Novo", "Ganho"],
    );
  });

  it("prefere stage_order", () => {
    assert.deepEqual(
      pipelineStagesFromAttributeValues({
        stage_order: ["Novo", "Ganho"],
        stages: { Legado: { color: "#000" } },
      }),
      ["Novo", "Ganho"],
    );
  });

  it("lê array com name", () => {
    assert.deepEqual(
      pipelineStagesFromAttributeValues({
        stages: [{ name: "A" }, { name: "B" }],
      }),
      ["A", "B"],
    );
  });

  it("lê map de stages", () => {
    assert.deepEqual(
      pipelineStagesFromAttributeValues({
        stages: { Proposta: { color: "#f00" }, Fechado: { color: "#0f0" } },
      }),
      ["Proposta", "Fechado"],
    );
  });
});