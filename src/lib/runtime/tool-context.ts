/** Tools que agem sem conversa aberta (outbound / contatos / conhecimento). */
const CONVERSATION_OPTIONAL = new Set([
  "lookup_knowledge",
  "search_contacts",
  "create_contact",
  "update_contact",
  "start_conversation",
  "create_payment_link",
  "create_pix_charge",
]);

export function toolRequiresConversationId(name: string): boolean {
  return !CONVERSATION_OPTIONAL.has(name);
}