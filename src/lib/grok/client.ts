export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: unknown[];
};

/** Desativado: a plataforma só faz relay para o webhook de saída do runtime. */
export async function xaiChat(_input: {
  model: string;
  temperature: number;
  messages: ChatMessage[];
  tools: unknown[];
}): Promise<{ content: string | null; tool_calls?: unknown[] }> {
  throw new Error(
    "Chamada xAI desativada. Configure o webhook de saída (PUT /api/library/v1/outbound-webhook).",
  );
}
