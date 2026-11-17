import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ManifestV1 } from "@/lib/types/manifest";
import {
  asaasProbeFromManifest,
  integrationProbesOk,
  type CapabilityProbe,
} from "./manytalks-capability-probe";

function minimalManifest(overrides: Partial<ManifestV1["asaas"]> = {}): ManifestV1 {
  return {
    tools_policy: {
      create_payment_link: true,
      create_pix_charge: false,
      create_contact: true,
      update_contact: true,
      send_reply: true,
      merge_labels: true,
      move_kanban: true,
      search_contacts: true,
    },
    asaas: {
      environment: "sandbox",
      api_key: "",
      allow_payment_link: true,
      allow_pix_copy: false,
      split_note: "",
      ...overrides,
    },
  } as unknown as ManifestV1;
}

describe("integrationProbesOk", () => {
  it("ignora probes skipped (Asaas sem chave)", () => {
    const probes: CapabilityProbe[] = [
      { id: "profile", name: "Profile", ok: true },
      {
        id: "asaas",
        name: "Asaas",
        ok: true,
        skipped: true,
        detail: "sem API key",
      },
    ];
    assert.equal(integrationProbesOk(probes), true);
  });

  it("falha se probe não-skipped com ok:false", () => {
    const probes: CapabilityProbe[] = [
      { id: "profile", name: "Profile", ok: false, detail: "401" },
    ];
    assert.equal(integrationProbesOk(probes), false);
  });
});

describe("asaasProbeFromManifest", () => {
  it("skipped quando cobrança ligada sem API key", () => {
    const p = asaasProbeFromManifest(minimalManifest());
    assert.equal(p.skipped, true);
    assert.equal(p.ok, true);
    assert.match(p.detail ?? "", /sem API key/i);
  });

  it("não skipped quando há API key", () => {
    const p = asaasProbeFromManifest(minimalManifest({ api_key: "sk_test" }));
    assert.notEqual(p.skipped, true);
    assert.equal(p.ok, true);
  });

  it("skipped cobrança desligada", () => {
    const m = minimalManifest({ allow_payment_link: false, allow_pix_copy: false });
    m.tools_policy.create_payment_link = false;
    const p = asaasProbeFromManifest(m);
    assert.equal(p.skipped, true);
    assert.match(p.detail ?? "", /desligada/i);
  });
});