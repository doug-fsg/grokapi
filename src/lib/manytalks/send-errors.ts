export type ManytalksSendErrorCode = "template_required" | "session_closed" | "api_error";

export type ManytalksSendError = {
  code: ManytalksSendErrorCode;
  message: string;
  hint?: string;
};

const TEMPLATE_HINT =
  "WhatsApp: fora da janela de 24h — use modelo aprovado ou aguarde mensagem do cliente.";
const SESSION_HINT = "Sessão WhatsApp indisponível ou conversa fechada — reabra ou use template.";

export function parseManytalksSendError(message: string): ManytalksSendError {
  const low = message.toLowerCase();
  if (
    /template|modelo|24\s*h|24h|session.?message|hsm|fora da janela|re-engagement|message template/i.test(
      low,
    )
  ) {
    return { code: "template_required", message, hint: TEMPLATE_HINT };
  }
  if (/session|janela.*fech|expir|inactive|not.*open/i.test(low)) {
    return { code: "session_closed", message, hint: SESSION_HINT };
  }
  return { code: "api_error", message };
}

export class ManytalksSendErrorException extends Error {
  readonly structured: ManytalksSendError;

  constructor(structured: ManytalksSendError) {
    super(structured.message);
    this.name = "ManytalksSendError";
    this.structured = structured;
  }
}