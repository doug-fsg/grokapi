import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultConversationRules } from "@/lib/defaults";
import { decideRelayByAssignee, normalizeConversationRules } from "./relay-assignee-filter";

describe("decideRelayByAssignee", () => {
  it("defaults: não atribuída e atribuída a mim", () => {
    const rules = { ...defaultConversationRules, default_assignee_id: 42 };
    assert.equal(decideRelayByAssignee(rules, null).relay, true);
    assert.equal(decideRelayByAssignee(rules, 42).relay, true);
    assert.equal(decideRelayByAssignee(rules, 99).relay, false);
  });

  it("só não atribuída", () => {
    const rules = {
      ...defaultConversationRules,
      default_assignee_id: 42,
      relay_when_unassigned: true,
      relay_when_assigned_to_me: false,
    };
    assert.equal(decideRelayByAssignee(rules, null).relay, true);
    assert.equal(decideRelayByAssignee(rules, 42).relay, false);
  });
});

describe("normalizeConversationRules", () => {
  it("only_when_unassigned legado", () => {
    const n = normalizeConversationRules({
      ...defaultConversationRules,
      only_when_unassigned: true,
    } as never);
    assert.equal(n.relay_when_unassigned, true);
    assert.equal(n.relay_when_assigned_to_me, false);
  });
});