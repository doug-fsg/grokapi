import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertManifestMatchesLocalTarget,
  integrationTestLocalTarget,
} from "./integration-test-local";

describe("integrationTestLocalTarget", () => {
  it("defaults account 41 e inbox 571", () => {
    const prevA = process.env.INTEGRATION_TEST_ACCOUNT_ID;
    const prevI = process.env.INTEGRATION_TEST_INBOX_ID;
    const prevG = process.env.INTEGRATION_TEST_GROKBOT_ID;
    delete process.env.INTEGRATION_TEST_ACCOUNT_ID;
    delete process.env.INTEGRATION_TEST_INBOX_ID;
    delete process.env.INTEGRATION_TEST_GROKBOT_ID;
    try {
      const t = integrationTestLocalTarget();
      assert.equal(t.accountId, 41);
      assert.equal(t.inboxId, 571);
      assert.equal(t.grokbotId, null);
    } finally {
      if (prevA !== undefined) process.env.INTEGRATION_TEST_ACCOUNT_ID = prevA;
      else delete process.env.INTEGRATION_TEST_ACCOUNT_ID;
      if (prevI !== undefined) process.env.INTEGRATION_TEST_INBOX_ID = prevI;
      else delete process.env.INTEGRATION_TEST_INBOX_ID;
      if (prevG !== undefined) process.env.INTEGRATION_TEST_GROKBOT_ID = prevG;
      else delete process.env.INTEGRATION_TEST_GROKBOT_ID;
    }
  });
});

describe("assertManifestMatchesLocalTarget", () => {
  it("aceita account e inbox corretos", () => {
    assert.doesNotThrow(() =>
      assertManifestMatchesLocalTarget(
        { manytalks: { account_id: 41, enabled_inbox_ids: [571, 999] } },
        { accountId: 41, inboxId: 571, grokbotId: null },
      ),
    );
  });

  it("rejeita inbox fora do bot", () => {
    assert.throws(
      () =>
        assertManifestMatchesLocalTarget(
          { manytalks: { account_id: 41, enabled_inbox_ids: [100] } },
          { accountId: 41, inboxId: 571, grokbotId: null },
        ),
      /571/,
    );
  });
});