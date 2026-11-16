import { manytalksBase, manytalksPlatformToken } from "@/lib/env";

export type PlatformAccount = {
  id: number;
  name: string;
  locale?: string | null;
  status?: string | null;
};

async function platformFetch<T>(method: string, path: string): Promise<T> {
  const token = manytalksPlatformToken();
  if (!token) {
    throw new Error("MANYTALKS_PLATFORM_TOKEN não configurado no .env.");
  }
  const url = `${manytalksBase()}/platform/api/v1${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      api_access_token: token,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const msg =
      (json as { error?: string; message?: string } | null)?.error ||
      (json as { message?: string } | null)?.message ||
      text ||
      res.statusText;
    throw new Error(`ManyTalks Platform ${res.status}: ${msg}`);
  }
  return json as T;
}

function normalizeAccounts(raw: unknown): PlatformAccount[] {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { payload?: unknown[] })?.payload)
      ? (raw as { payload: unknown[] }).payload
      : [];
  return list
    .map((item): PlatformAccount | null => {
      const row = item as Record<string, unknown>;
      const id = Number(row.id);
      if (!Number.isFinite(id)) return null;
      const acc: PlatformAccount = {
        id,
        name: String(row.name ?? row.company_name ?? `Account ${id}`),
      };
      if (row.locale != null) acc.locale = String(row.locale);
      if (row.status != null) acc.status = String(row.status);
      return acc;
    })
    .filter((x): x is PlatformAccount => x !== null);
}

export async function listPlatformAccounts(): Promise<PlatformAccount[]> {
  const data = await platformFetch<unknown>("GET", "/accounts");
  return normalizeAccounts(data);
}
