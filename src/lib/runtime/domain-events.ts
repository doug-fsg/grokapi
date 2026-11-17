import { getDb } from "@/lib/db";
import { domainEvents } from "@/lib/db/schema";
import { nowIso } from "@/lib/utils";

export async function emitDomainEvent(
  grokbotId: string,
  type: string,
  payload: Record<string, unknown>,
) {
  await getDb().insert(domainEvents).values({
    id: crypto.randomUUID(),
    grokbotId,
    type,
    payloadJson: JSON.stringify(payload),
    createdAt: nowIso(),
  });
}