import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { manifestNotModified } from "./etag";
import type { ManifestV1 } from "@/lib/types/manifest";

const baseManifest = {
  etag: 'W/"abc123def4567890"',
} as ManifestV1;

describe("manifestNotModified", () => {
  it("retorna true quando If-None-Match bate o etag", () => {
    const req = new Request("http://local", {
      headers: { "if-none-match": baseManifest.etag },
    });
    assert.equal(manifestNotModified(req, baseManifest), true);
  });

  it("retorna false quando etag diverge", () => {
    const req = new Request("http://local", {
      headers: { "if-none-match": 'W/"outro"' },
    });
    assert.equal(manifestNotModified(req, baseManifest), false);
  });
});