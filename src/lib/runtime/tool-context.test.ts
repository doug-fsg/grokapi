import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toolRequiresConversationId } from "./tool-context";

describe("toolRequiresConversationId", () => {
  it("outbound e contatos não exigem conversa", () => {
    assert.equal(toolRequiresConversationId("start_conversation"), false);
    assert.equal(toolRequiresConversationId("create_contact"), false);
    assert.equal(toolRequiresConversationId("search_contacts"), false);
    assert.equal(toolRequiresConversationId("lookup_knowledge"), false);
  });

  it("reply e CRM exigem conversa", () => {
    assert.equal(toolRequiresConversationId("send_reply"), true);
    assert.equal(toolRequiresConversationId("assign_conversation"), true);
  });
});