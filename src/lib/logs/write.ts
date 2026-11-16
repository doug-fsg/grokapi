import { getDb } from "@/lib/db";
import { actionLogs } from "@/lib/db/schema";
import { nowIso } from "@/lib/utils";

const SENSITIVE = /token|api_key|password|secret|authorization|bearer/i;

function redactValue(key: string, value: unknown): unknown {
  if (SENSITIVE.test(key)) return "[redacted]";
  if (typeof value === "string" && value.length > 400) {
    return `${value.slice(0, 400)}…`;
  }
  if (Array.isArray(value)) return value.slice(0, 20).map((v, i) => redactValue(String(i), v));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactValue(k, v);
    }
    return out;
  }
  return value;
}

export function redactPayload(payload: unknown): string {
  try {
    return JSON.stringify(redactValue("root", payload));
  } catch {
    return JSON.stringify({ note: "payload não serializável" });
  }
}

export async function writeActionLog(input: {
  grokbotId: string;
  conversationId?: string | number | null;
  kind: string;
  payload: unknown;
}) {
  const db = getDb();
  await db.insert(actionLogs).values({
    id: crypto.randomUUID(),
    grokbotId: input.grokbotId,
    conversationId:
      input.conversationId != null && input.conversationId !== ""
        ? String(input.conversationId)
        : null,
    kind: input.kind,
    payloadRedacted: redactPayload(input.payload),
    createdAt: nowIso(),
  });
}
