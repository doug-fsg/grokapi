"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Props = {
  grokbotId: string;
  dashboardSlug: string | null;
  token: string;
  onToken: (token: string) => void;
  onMsg: (msg: string) => void;
  onError: (msg: string) => void;
  busy?: boolean;
};

export { parseRoutineCabecalho } from "@/lib/runtime/parse-routine-cabecalho";

export function RuntimePanel({
  grokbotId,
  dashboardSlug,
  token,
  onToken,
  onMsg,
  onError,
  busy,
}: Props) {
  const [copied, setCopied] = useState("");
  const [working, setWorking] = useState(false);
  const [origin, setOrigin] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const manifestUrl = `${origin}/api/library/v1/manifest`;
  const manytalksHook = `${origin}/api/hooks/manytalks`;
  const asaasHook = `${origin}/api/hooks/asaas/${grokbotId}`;
  const outboundRegister = `${origin}/api/library/v1/outbound-webhook`;
  const dashUrl = dashboardSlug ? `${origin}/d/${dashboardSlug}` : null;

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      onError("Não foi possível copiar.");
    }
  }

  return (
    <Card className="space-y-3">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div>
          <h2 className="font-semibold">Avançado</h2>
          <p className="text-sm text-[var(--grokbott-text-secondary)]">
            Token runtime e URLs técnicas
          </p>
        </div>
        <span className="text-xs text-[var(--grokbott-text-secondary)]">
          {open ? "Ocultar" : "Mostrar"}
        </span>
      </button>

      {open ? (
        <div className="space-y-3 border-t border-[var(--grokbott-hairline)] pt-3">
          <div className="space-y-2">
            <p className="text-sm font-medium">Token runtime</p>
            {token ? (
              <div className="flex flex-wrap items-center gap-2">
                <code className="max-w-full break-all rounded-md bg-[var(--grokbott-surface-1)] px-2 py-1 text-xs">
                  {token}
                </code>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void copy("token", token)}
                >
                  {copied === "token" ? "Copiado" : "Copiar"}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-[var(--grokbott-text-secondary)]">
                Gere um token se precisar colar no runtime externo.
              </p>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || working}
              onClick={async () => {
                setWorking(true);
                onError("");
                try {
                  const j = await fetch(`/api/admin/grokbots/${grokbotId}/token`, {
                    method: "POST",
                  }).then((r) => r.json());
                  if (j.error) throw new Error(j.error);
                  onToken(j.runtime_token);
                  onMsg("Token gerado.");
                } catch (err) {
                  onError(err instanceof Error ? err.message : "Falha no token");
                } finally {
                  setWorking(false);
                }
              }}
            >
              {working ? "Gerando…" : "Rotacionar token"}
            </Button>
          </div>

          <div className="grid gap-3">
            <ConnRow
              title="Manifest"
              value={manifestUrl}
              copied={copied === "manifest"}
              onCopy={() => void copy("manifest", manifestUrl)}
            />
            <ConnRow
              title="ManyTalks in"
              value={manytalksHook}
              copied={copied === "mt"}
              onCopy={() => void copy("mt", manytalksHook)}
            />
            <ConnRow
              title="Outbound register"
              value={outboundRegister}
              copied={copied === "outreg"}
              onCopy={() => void copy("outreg", outboundRegister)}
            />
            <ConnRow
              title="Asaas"
              value={asaasHook}
              copied={copied === "asaas"}
              onCopy={() => void copy("asaas", asaasHook)}
            />
            {dashUrl ? (
              <ConnRow
                title="Dashboard"
                value={dashUrl}
                copied={copied === "dash"}
                onCopy={() => void copy("dash", dashUrl)}
              />
            ) : (
              <p className="text-sm text-[var(--grokbott-text-secondary)]">
                Dashboard: defina a senha no topo.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function ConnRow({
  title,
  value,
  copied,
  onCopy,
}: {
  title: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-lg border border-[var(--grokbott-hairline)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        <Button type="button" size="sm" variant="outline" onClick={onCopy}>
          {copied ? "Copiado" : "Copiar"}
        </Button>
      </div>
      <code className="mt-1 block break-all font-mono text-xs text-[var(--grokbott-text-secondary)]">
        {value}
      </code>
    </div>
  );
}
