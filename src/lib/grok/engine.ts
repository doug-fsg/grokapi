import type { ManifestV1 } from "@/lib/types/manifest";

/** Desativado — o handler ManyTalks só faz forward outbound. */
export async function runGrokTurn(_input: {
  manifest: ManifestV1;
  conversationId: string | number;
  contactId?: number;
  history: { role: "user" | "assistant"; content: string }[];
  extraContext: string;
  operatorInstructions?: string;
}) {
  throw new Error(
    "runGrokTurn desativado. Use o relay: webhook de saída do runtime externo.",
  );
}
