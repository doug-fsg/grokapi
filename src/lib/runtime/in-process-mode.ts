import type { ConversationRules } from "@/lib/types/manifest";

/** Runtime nesta instância: só relay (Grok externo). In-process xAI desligado. */
export function shouldRunInProcess(
  _outboundConfigured: boolean,
  _rules: ConversationRules,
  _xaiAvailable = false,
): boolean {
  return false;
}

export function shouldRelayOnly(outboundConfigured: boolean): boolean {
  return outboundConfigured;
}

export function responsesPathReady(
  relayConfigured: boolean,
  relayAuthorized: boolean,
): boolean {
  return relayConfigured && relayAuthorized;
}