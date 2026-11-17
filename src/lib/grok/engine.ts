import { xaiChat, type ChatMessage } from "./client";
import { toolsFromPolicy } from "./tools";
import { executeTool } from "@/lib/runtime/tool-exec";
import { writeActionLog } from "@/lib/logs/write";
import { formatOperatorInstructions } from "@/lib/manifest/system-prompt";
import type { ManifestV1 } from "@/lib/types/manifest";

export async function runGrokTurn(input: {
  manifest: ManifestV1;
  conversationId: string | number;
  contactId?: number;
  history: { role: "user" | "assistant"; content: string }[];
  extraContext: string;
  operatorInstructions?: string;
}) {
  const tools = toolsFromPolicy(input.manifest);
  const messages: ChatMessage[] = [
    { role: "system", content: input.manifest.prompt.system_compiled },
    { role: "system", content: input.extraContext },
  ];
  const op = (input.operatorInstructions ?? "").trim();
  if (op) messages.push({ role: "system", content: op });
  messages.push(...input.history.map((m) => ({ role: m.role, content: m.content })));

  const executed: { name: string; result: unknown }[] = [];
  for (let i = 0; i < 5; i++) {
    const msg = await xaiChat({
      model: input.manifest.xai.model,
      temperature: input.manifest.xai.temperature,
      messages,
      tools,
    });
    if (!msg.tool_calls?.length) {
      if (msg.content) {
        await writeActionLog({
          grokbotId: input.manifest.grokbot.id,
          conversationId: input.conversationId,
          kind: "grok_reply_text",
          payload: { content_preview: msg.content.slice(0, 400), length: msg.content.length },
        });
      }
      return { content: msg.content ?? "", executed };
    }
    messages.push({
      role: "assistant",
      content: msg.content ?? null,
      tool_calls: msg.tool_calls,
    });
    for (const call of msg.tool_calls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        args = {};
      }
      let result: unknown;
      let ok = true;
      try {
        result = await executeTool(
          input.manifest,
          { conversationId: input.conversationId, contactId: input.contactId },
          call.function.name,
          args,
        );
      } catch (err) {
        ok = false;
        result = { error: err instanceof Error ? err.message : String(err) };
      }
      executed.push({ name: call.function.name, result });
      await writeActionLog({
        grokbotId: input.manifest.grokbot.id,
        conversationId: input.conversationId,
        kind: ok ? `tool:${call.function.name}` : `tool_error:${call.function.name}`,
        payload: { args, result, ok },
      });
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }
  return { content: "", executed };
}

export function operatorInstructionsFromPrivate(privateBodies: string[]) {
  return formatOperatorInstructions(privateBodies);
}