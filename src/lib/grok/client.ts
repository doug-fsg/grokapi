import { xaiApiKey } from "@/lib/env";

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: unknown[];
};

type ToolCall = {
  id: string;
  function: { name: string; arguments: string };
};

export async function xaiChat(input: {
  model: string;
  temperature: number;
  messages: ChatMessage[];
  tools: unknown[];
}): Promise<{ content: string | null; tool_calls?: ToolCall[] }> {
  const key = xaiApiKey();
  if (!key) {
    throw new Error(
      "XAI_API_KEY não configurada. Use relay (webhook de saída) ou configure a chave no servidor.",
    );
  }
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      temperature: input.temperature,
      messages: input.messages,
      tools: input.tools.length ? input.tools : undefined,
    }),
  });
  const json = (await res.json()) as {
    error?: { message?: string };
    choices?: {
      message?: {
        content?: string | null;
        tool_calls?: ToolCall[];
      };
    }[];
  };
  if (!res.ok) {
    throw new Error(`xAI ${res.status}: ${json.error?.message ?? "falha"}`);
  }
  const message = json.choices?.[0]?.message;
  return {
    content: message?.content ?? null,
    tool_calls: message?.tool_calls,
  };
}