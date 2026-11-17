import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCreateContactBody,
  contactIdFromResponse,
  normalizePhoneE164,
  pickContactPatch,
} from "./contacts";

describe("normalizePhoneE164", () => {
  it("remove máscara BR e mantém código país", () => {
    assert.equal(normalizePhoneE164("+55 55 8113-2058"), "+555581132058");
  });

  it("aceita número já em E.164", () => {
    assert.equal(normalizePhoneE164("+555581132058"), "+555581132058");
  });

  it("rejeita string sem dígitos", () => {
    assert.throws(() => normalizePhoneE164("   "), /vazio/);
  });
});

describe("buildCreateContactBody", () => {
  it("envia phone_number em E.164", () => {
    const body = buildCreateContactBody(
      { name: "Manytalks", phone_number: "+55 (55) 8113-2058", inbox_id: 571 },
      null,
    );
    assert.equal(body.phone_number, "+555581132058");
    assert.equal(body.inbox_id, 571);
  });
});

describe("pickContactPatch", () => {
  it("normaliza phone_number no patch", () => {
    const patch = pickContactPatch({ phone_number: "55 99999-8888" });
    assert.equal(patch.phone_number, "+55999998888");
  });
});

describe("contactIdFromResponse", () => {
  it("lê id em payload.contact", () => {
    assert.equal(contactIdFromResponse({ payload: { contact: { id: 42 } } }), 42);
  });

  it("lê id na raiz", () => {
    assert.equal(contactIdFromResponse({ id: 7 }), 7);
  });

  it("retorna null sem id", () => {
    assert.equal(contactIdFromResponse({ payload: {} }), null);
  });
});