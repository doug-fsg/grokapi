export type AsaasEnv = "sandbox" | "production";

function asaasBase(env: AsaasEnv) {
  return env === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";
}

async function asaasFetch<T>(
  env: AsaasEnv,
  apiKey: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${asaasBase(env)}${path}`, {
    method,
    headers: {
      access_token: apiKey,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const err = json as { errors?: { description?: string }[]; message?: string } | null;
    const msg =
      err?.errors?.[0]?.description || err?.message || text || res.statusText;
    throw new Error(`Asaas ${res.status}: ${msg}`);
  }
  return json as T;
}

export function createAsaasClient(env: AsaasEnv, apiKey: string) {
  return {
    ping() {
      return asaasFetch(env, apiKey, "GET", "/finance/balance");
    },
    createPaymentLink(input: {
      name: string;
      value: number;
      description?: string;
      billingTypes?: string[];
    }) {
      return asaasFetch<{ url?: string; id?: string }>(env, apiKey, "POST", "/paymentLinks", {
        name: input.name,
        value: input.value,
        description: input.description,
        billingTypes: input.billingTypes ?? ["PIX", "BOLETO", "CREDIT_CARD"],
        chargeType: "DETACHED",
      });
    },
    createPixCharge(input: {
      customerName: string;
      customerCpfCnpj?: string;
      value: number;
      description?: string;
      dueDate?: string;
    }) {
      return asaasFetch<{ id: string }>(env, apiKey, "POST", "/payments", {
        customer: undefined,
        billingType: "PIX",
        value: input.value,
        dueDate: input.dueDate ?? new Date().toISOString().slice(0, 10),
        description: input.description,
        externalReference: input.customerName,
      });
    },
    getPixQr(paymentId: string) {
      return asaasFetch<{ payload?: string; encodedImage?: string }>(
        env,
        apiKey,
        "GET",
        `/payments/${paymentId}/pixQrCode`,
      );
    },
    ensureCustomer(input: { name: string; cpfCnpj?: string; email?: string }) {
      return asaasFetch<{ id: string }>(env, apiKey, "POST", "/customers", {
        name: input.name,
        cpfCnpj: input.cpfCnpj ?? "00000000000",
        email: input.email,
      });
    },
  };
}

export async function createPixWithCustomer(
  env: AsaasEnv,
  apiKey: string,
  input: { name: string; value: number; description?: string; cpfCnpj?: string },
) {
  const client = createAsaasClient(env, apiKey);
  const customer = await client.ensureCustomer({
    name: input.name,
    cpfCnpj: input.cpfCnpj,
  });
  const payment = await asaasFetch<{ id: string }>(env, apiKey, "POST", "/payments", {
    customer: customer.id,
    billingType: "PIX",
    value: input.value,
    dueDate: new Date().toISOString().slice(0, 10),
    description: input.description,
  });
  const qr = await client.getPixQr(payment.id);
  return { paymentId: payment.id, pixCopyPaste: qr.payload ?? "", qrImage: qr.encodedImage };
}
