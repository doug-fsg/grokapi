import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadPublishedManifest } from "./load-published";

describe("loadPublishedManifest", () => {
  it("retorna null para bot inexistente", async () => {
    const m = await loadPublishedManifest("00000000-0000-0000-0000-000000000000");
    assert.equal(m, null);
  });
});