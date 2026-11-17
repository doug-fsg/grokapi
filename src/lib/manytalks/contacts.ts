/** ManyTalks exige E.164: só dígitos com prefixo + (ex. +555581132058). */
export function normalizePhoneE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) {
    throw new Error("phone_number inválido (vazio)");
  }
  return `+${digits}`;
}

/** Extrai id de respostas ManyTalks/Chatwoot (vários formatos). */
export function contactIdFromResponse(data: unknown): number | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const payload = o.payload;
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    const contact = p.contact ?? p;
    if (contact && typeof contact === "object") {
      const id = (contact as { id?: unknown }).id;
      if (typeof id === "number") return id;
    }
    const id = (p as { id?: unknown }).id;
    if (typeof id === "number") return id;
  }
  const id = o.id;
  if (typeof id === "number") return id;
  return null;
}

export function pickContactPatch(args: Record<string, unknown>) {
  const allowed = [
    "name",
    "email",
    "phone_number",
    "identifier",
    "custom_attributes",
    "additional_attributes",
  ] as const;
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (args[key] === undefined) continue;
    if (key === "phone_number") {
      patch.phone_number = normalizePhoneE164(String(args.phone_number));
    } else {
      patch[key] = args[key];
    }
  }
  return patch;
}

export function buildCreateContactBody(
  args: Record<string, unknown>,
  fallbackInboxId: number | null,
) {
  const inboxRaw = args.inbox_id ?? fallbackInboxId;
  const inbox_id = Number(inboxRaw);
  if (!Number.isFinite(inbox_id)) {
    throw new Error("create_contact exige inbox_id (ou configure inboxes no bot).");
  }
  const name = args.name != null ? String(args.name).trim() : "";
  const email = args.email != null ? String(args.email).trim() : "";
  const phoneRaw = args.phone_number != null ? String(args.phone_number).trim() : "";
  if (!name && !email && !phoneRaw) {
    throw new Error("create_contact: informe ao menos name, email ou phone_number.");
  }
  const body: Record<string, unknown> = { inbox_id };
  if (name) body.name = name;
  if (email) body.email = email;
  if (phoneRaw) body.phone_number = normalizePhoneE164(phoneRaw);
  if (args.identifier != null && String(args.identifier).trim()) {
    body.identifier = String(args.identifier).trim();
  }
  if (args.custom_attributes && typeof args.custom_attributes === "object") {
    body.custom_attributes = args.custom_attributes;
  }
  return body;
}