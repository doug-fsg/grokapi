import { manytalksBase, manytalksServiceToken } from "@/lib/env";
import { unwrapList } from "@/lib/manytalks/client";

export type ServiceAccount = {
  id: number;
  name: string;
  role?: string | null;
};

export type ServiceProfile = {
  name: string | null;
  email: string | null;
  role: string | null;
  accounts: ServiceAccount[];
};

async function serviceFetch<T>(path: string): Promise<T> {
  const token = manytalksServiceToken();
  if (!token) {
    throw new Error("MANYTALKS_SERVICE_TOKEN não configurado no .env.");
  }
  const url = `${manytalksBase()}${path}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      api_access_token: token,
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
    throw new Error(`ManyTalks ${res.status}: ${msg}`);
  }
  return json as T;
}

export async function getServiceProfile(): Promise<ServiceProfile> {
  const data = await serviceFetch<Record<string, unknown>>("/api/v1/profile");
  const accountsRaw = Array.isArray(data.accounts) ? data.accounts : [];
  const accounts: ServiceAccount[] = accountsRaw
    .map((item): ServiceAccount | null => {
      const row = item as Record<string, unknown>;
      const id = Number(row.id);
      if (!Number.isFinite(id)) return null;
      const acc: ServiceAccount = {
        id,
        name: String(row.name ?? `Account ${id}`),
      };
      if (row.role != null) acc.role = String(row.role);
      return acc;
    })
    .filter((x): x is ServiceAccount => x !== null);
  return {
    name: data.name != null ? String(data.name) : null,
    email: data.email != null ? String(data.email) : null,
    role: data.role != null ? String(data.role) : null,
    accounts,
  };
}

export async function listServiceInboxes(accountId: number) {
  const raw = await serviceFetch<{ payload?: unknown[] } | unknown[]>(
    `/api/v1/accounts/${accountId}/inboxes`,
  );
  return unwrapList<Record<string, unknown>>(
    raw as Record<string, unknown>[] | { payload?: Record<string, unknown>[] },
  ).map((i) => ({
    id: Number(i.id),
    name: String(i.name ?? i.id),
  }));
}
