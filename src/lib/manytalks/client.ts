type MtClient = {
  base: string;
  accountId: number;
  token: string;
};

async function mtFetch<T>(
  client: MtClient,
  method: string,
  path: string,
  body?: unknown,
  timeoutMs = 60_000,
): Promise<T> {
  const url = `${client.base}/api/v1/accounts/${client.accountId}${path}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        api_access_token: client.token,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`ManyTalks timeout após ${Math.round(timeoutMs / 1000)}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`ManyTalks ${res.status}: ${formatManytalksError(json, text, res.statusText)}`);
  }
  return json as T;
}

function formatManytalksError(json: unknown, text: string, statusText: string) {
  if (json && typeof json === "object") {
    const o = json as Record<string, unknown>;
    if (typeof o.error === "string" && o.error.trim()) return o.error;
    if (typeof o.message === "string" && o.message.trim()) return o.message;
    if (Array.isArray(o.message)) return o.message.map(String).join("; ");
    if (o.errors != null) {
      try {
        return typeof o.errors === "string" ? o.errors : JSON.stringify(o.errors);
      } catch {
        /* ignore */
      }
    }
  }
  const trimmed = (text || "").trim();
  if (trimmed) return trimmed.slice(0, 400);
  return statusText || "erro desconhecido";
}

export function createManytalksClient(opts: MtClient) {
  return {
    profile() {
      return mtFetch(opts, "GET", "/profile").catch(() =>
        mtFetch(opts, "GET", "/inboxes"),
      );
    },
    listInboxes() {
      return mtFetch<{ payload?: unknown[] } | unknown[]>(opts, "GET", "/inboxes");
    },
    listPipelines() {
      return mtFetch<unknown[]>(
        opts,
        "GET",
        "/custom_attribute_definitions?attribute_model=contact_attribute",
      );
    },
    createPipeline(body: unknown) {
      return mtFetch(opts, "POST", "/custom_attribute_definitions", body);
    },
    getConversation(displayId: string | number) {
      return mtFetch<Record<string, unknown>>(opts, "GET", `/conversations/${displayId}`);
    },
    listConversations(query: {
      status?: string;
      inboxId?: number | null;
      labels?: string[];
      page?: number;
    }) {
      const params = new URLSearchParams();
      params.set("status", query.status ?? "all");
      params.set("page", String(query.page ?? 1));
      if (query.inboxId != null && Number.isFinite(query.inboxId)) {
        params.set("inbox_id", String(query.inboxId));
      }
      for (const label of query.labels ?? []) {
        params.append("labels[]", label);
      }
      return mtFetch<{ data?: unknown[]; payload?: unknown[] } | unknown[]>(
        opts,
        "GET",
        `/conversations?${params.toString()}`,
      );
    },
    getMessages(displayId: string | number, query?: { before?: number }) {
      const params = new URLSearchParams();
      if (query?.before != null && Number.isFinite(query.before)) {
        params.set("before", String(query.before));
      }
      const qs = params.toString();
      return mtFetch<{ payload?: unknown[] } | unknown[]>(
        opts,
        "GET",
        `/conversations/${displayId}/messages${qs ? `?${qs}` : ""}`,
      );
    },
    sendMessage(displayId: string | number, content: string) {
      return mtFetch(opts, "POST", `/conversations/${displayId}/messages`, {
        content,
        message_type: "outgoing",
        private: false,
        content_type: "text",
      });
    },
    getLabels(displayId: string | number) {
      return mtFetch<{ payload?: string[] } | string[]>(
        opts,
        "GET",
        `/conversations/${displayId}/labels`,
      );
    },
    /** Etiquetas da account (não da conversa). */
    listAccountLabels() {
      return mtFetch<{ payload?: unknown[] } | unknown[]>(opts, "GET", "/labels");
    },
    setLabels(displayId: string | number, labels: string[]) {
      return mtFetch(opts, "POST", `/conversations/${displayId}/labels`, {
        labels,
      });
    },
    getContact(contactId: number) {
      return mtFetch<Record<string, unknown>>(opts, "GET", `/contacts/${contactId}`);
    },
    filterContacts(payload: unknown[], page = 1, perPage = 50) {
      return mtFetch<{ payload?: unknown[] } | unknown[]>(
        opts,
        "POST",
        `/contacts/filter?page=${page}&per_page=${perPage}`,
        { payload },
      );
    },
    listContactConversations(contactId: number) {
      return mtFetch<{ payload?: unknown[] } | unknown[]>(
        opts,
        "GET",
        `/contacts/${contactId}/conversations`,
      );
    },
    moveKanban(
      contactId: number,
      pipelineId: number,
      body: { stage_id: string; position?: number; deal_value?: number; metadata?: unknown },
    ) {
      return mtFetch(
        opts,
        "PATCH",
        `/contacts/${contactId}/pipeline_positions/${pipelineId}`,
        body,
      );
    },
    listWebhooks() {
      return mtFetch<unknown>(opts, "GET", "/webhooks");
    },
    createWebhook(url: string, subscriptions: string[]) {
      return mtFetch(opts, "POST", "/webhooks", {
        webhook: { url, subscriptions },
      });
    },
    updateWebhook(id: number, url: string, subscriptions: string[]) {
      return mtFetch(opts, "PUT", `/webhooks/${id}`, {
        webhook: { url, subscriptions },
      });
    },
    deleteWebhook(id: number) {
      return mtFetch(opts, "DELETE", `/webhooks/${id}`);
    },
  };
}

export function unwrapList<T>(
  data: { payload?: T[] | { webhooks?: T[] }; data?: T[] } | T[] | null | undefined,
): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.payload)) return data.payload;
  if (
    data.payload &&
    typeof data.payload === "object" &&
    Array.isArray((data.payload as { webhooks?: T[] }).webhooks)
  ) {
    return (data.payload as { webhooks: T[] }).webhooks;
  }
  if (Array.isArray(data.data)) return data.data;
  return [];
}

/** ManyTalks: GET /webhooks → { payload: { webhooks: [...] } } */
export function unwrapWebhooks(data: unknown): unknown[] {
  return unwrapList(data as { payload?: unknown[] | { webhooks?: unknown[] } });
}
