"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseChecklistAck, type ChecklistAck } from "@/lib/admin/checklist-ack";
import type { CapabilityProbe } from "@/lib/admin/manytalks-capability-probe";
import { parseRoutineCabecalho } from "@/lib/runtime/parse-routine-cabecalho";
import { responsesPathReady } from "@/lib/runtime/in-process-mode";
import { appUrl } from "@/lib/utils";

type Props = {
  grokbotId: string;
  paymentsEnabled: boolean;
  busy?: boolean;
  onMsg: (msg: string) => void;
  onError: (msg: string) => void;
  /** Após salvar relay / webhook — pai pode recarregar. */
  onChanged?: () => void;
};

type OutboundState = {
  url: string | null;
  hasAuthValue: boolean;
};

type TestLine = {
  key: string;
  label: string;
  ok: boolean;
  skipped?: boolean;
  detail?: string;
};

type IntegrationJson = {
  all_ok?: boolean;
  relay?: { ok?: boolean };
  manytalks?: { probes?: CapabilityProbe[] };
  e2e?: { ok?: boolean; steps?: { id: string; ok: boolean; detail?: string }[] };
};

function testLinesFromIntegration(j: IntegrationJson): TestLine[] {
  const lines: TestLine[] = [];
  for (const p of j.manytalks?.probes ?? []) {
    lines.push({
      key: `probe:${p.id}`,
      label: p.name,
      ok: p.ok,
      skipped: p.skipped,
      detail: p.detail,
    });
  }
  for (const s of j.e2e?.steps ?? []) {
    if (s.id === "error" && !s.ok) {
      lines.push({ key: "e2e:error", label: "E2E", ok: false, detail: s.detail });
      continue;
    }
    if (s.id === "error") continue;
    lines.push({ key: `e2e:${s.id}`, label: `E2E — ${s.id}`, ok: s.ok, detail: s.detail });
  }
  return lines;
}

function integrationUserMessage(j: IntegrationJson) {
  if (j.all_ok) {
    return "Salvo. E2E ManyTalks OK — o Grok deve responder ✅ no chat dele.";
  }
  if (j.relay?.ok === false) {
    return "Salvo. ManyTalks testado, mas o webhook do Grok não respondeu — verifique URL/chave.";
  }
  return "Salvo com falhas no E2E — veja abaixo. O Grok deve responder ❌ no chat.";
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${
        ok ? "bg-[var(--grokbott-success)]" : "bg-[var(--grokbott-warning)]"
      }`}
      aria-hidden
    />
  );
}

export function BotGoLiveChecklist({
  grokbotId,
  paymentsEnabled,
  busy,
  onMsg,
  onError,
  onChanged,
}: Props) {
  const [checklist, setChecklist] = useState<ChecklistAck>(parseChecklistAck(null));
  const [outbound, setOutbound] = useState<OutboundState>({ url: null, hasAuthValue: false });
  const [urlDraft, setUrlDraft] = useState("");
  const [keyDraft, setKeyDraft] = useState("");
  const [headerDraft, setHeaderDraft] = useState("Authorization");
  const [working, setWorking] = useState<"webhook" | "relay" | "asaas" | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [autoTried, setAutoTried] = useState(false);
  const [showHeader, setShowHeader] = useState(false);
  const [webhookError, setWebhookError] = useState("");
  const [published, setPublished] = useState(false);
  const [testLines, setTestLines] = useState<TestLine[] | null>(null);
  const [relayEditing, setRelayEditing] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : appUrl();
  const manytalksHook = `${origin}/api/hooks/manytalks`;
  const asaasHook = `${origin}/api/hooks/asaas/${grokbotId}`;

  const relayConfigured = Boolean(outbound.url?.trim());
  const relayAuthorized = Boolean(outbound.url?.trim() && outbound.hasAuthValue);
  const relayOk = relayAuthorized;
  const responsesOk = responsesPathReady(relayConfigured, outbound.hasAuthValue);
  const manytalksOk = checklist.manytalks_webhook_ok;
  const asaasOk = !paymentsEnabled || checklist.asaas_webhook_ack;
  const ready = manytalksOk && published && responsesOk && asaasOk;

  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/grokbots/${grokbotId}`);
    const j = await r.json();
    if (!r.ok) throw new Error(j.error ?? "Falha ao carregar status");
    const next = parseChecklistAck(j.config?.checklistAckJson);
    setChecklist(next);
    const url = (j.config?.outboundWebhookUrl as string | null) ?? null;
    const secret = (j.config?.outboundWebhookSecret as string | null) ?? null;
    const authHeader = (j.config?.outboundWebhookAuthHeader as string | null) ?? null;
    setOutbound({ url, hasAuthValue: Boolean((secret ?? "").trim()) });
    setUrlDraft(url ?? "");
    setHeaderDraft(authHeader?.trim() || "Authorization");
    setKeyDraft("");
    setPublished(Number(j.bot?.manifestVersion ?? 0) > 0);
    setLoaded(true);
    return next;
  }, [grokbotId]);

  useEffect(() => {
    void load().catch((err) => onError(err instanceof Error ? err.message : "Erro"));
  }, [load, onError]);

  useEffect(() => {
    if (!loaded || autoTried || checklist.manytalks_webhook_ok) return;
    setAutoTried(true);
    void (async () => {
      setWorking("webhook");
      setWebhookError("");
      try {
        const r = await fetch(`/api/admin/grokbots/${grokbotId}/webhook`, { method: "POST" });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Falha no webhook");
        setChecklist(parseChecklistAck(JSON.stringify(j.checklist ?? { manytalks_webhook_ok: true })));
        onMsg(
          j.alreadyExisted
            ? "Webhook já existia no ManyTalks — marcado como conectado."
            : "Webhook ManyTalks conectado.",
        );
        onChanged?.();
      } catch (err) {
        setWebhookError(err instanceof Error ? err.message : "Falha no webhook");
      } finally {
        setWorking(null);
      }
    })();
  }, [
    loaded,
    autoTried,
    checklist.manytalks_webhook_ok,
    grokbotId,
    onMsg,
    onChanged,
  ]);

  const pendingLabel = useMemo(() => {
    const missing: string[] = [];
    if (!manytalksOk) missing.push("ManyTalks");
    if (!published) missing.push("publicar manifest");
    if (!responsesOk) missing.push("respostas");
    if (!asaasOk) missing.push("Asaas");
    return missing.join(" · ");
  }, [manytalksOk, published, responsesOk, asaasOk]);

  async function connectManytalks() {
    setWorking("webhook");
    onError("");
    setWebhookError("");
    try {
      const r = await fetch(`/api/admin/grokbots/${grokbotId}/webhook`, { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Falha no webhook");
      setChecklist(parseChecklistAck(JSON.stringify(j.checklist)));
      onMsg(
        j.alreadyExisted
          ? "Webhook já existia no ManyTalks — marcado como conectado."
          : "ManyTalks conectado.",
      );
      onChanged?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha no webhook";
      setWebhookError(message);
      onError(message);
    } finally {
      setWorking(null);
    }
  }

  async function ackManytalksManual() {
    setWorking("webhook");
    onError("");
    try {
      const r = await fetch(`/api/admin/grokbots/${grokbotId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checklistAck: {
            manytalks_webhook_ok: true,
            manytalks_webhook_at: new Date().toISOString(),
          },
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Falha");
      setChecklist((cur) => ({
        ...cur,
        manytalks_webhook_ok: true,
        manytalks_webhook_at: new Date().toISOString(),
      }));
      setWebhookError("");
      onMsg("ManyTalks marcado como configurado.");
      onChanged?.();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Falha");
    } finally {
      setWorking(null);
    }
  }

  async function copyManytalksHook() {
    try {
      await navigator.clipboard.writeText(manytalksHook);
      onMsg("URL ManyTalks copiada.");
    } catch {
      onError("Não foi possível copiar.");
    }
  }

  async function runIntegrationTest() {
    setWorking("relay");
    onError("");
    try {
      const r = await fetch(`/api/admin/grokbots/${grokbotId}/relay-test`, { method: "POST" });
      const j = (await r.json()) as IntegrationJson & { error?: string };
      if (!r.ok && !j.e2e) throw new Error(j.error ?? "Falha no teste");
      setTestLines(testLinesFromIntegration(j));
      onMsg(integrationUserMessage(j));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Falha");
    } finally {
      setWorking(null);
    }
  }

  async function saveRelay() {
    if (!urlDraft.trim()) {
      onError("Informe a URL do webhook de respostas.");
      return;
    }
    setWorking("relay");
    onError("");
    try {
      const parsed = parseRoutineCabecalho(headerDraft);
      const payload: Record<string, string | null> = {
        outboundWebhookUrl: urlDraft.trim(),
        outboundWebhookAuthHeader: parsed.header,
      };
      const value = keyDraft.trim() || parsed.valueFromHeader;
      if (value) payload.outboundWebhookSecret = value;
      else if (!outbound.hasAuthValue) {
        throw new Error("Informe a chave do webhook.");
      }

      const r = await fetch(`/api/admin/grokbots/${grokbotId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Falha ao salvar");
      const it = j.integration_test as IntegrationJson | null | undefined;
      if (it) {
        setTestLines(testLinesFromIntegration(it));
        onMsg(integrationUserMessage(it));
      } else {
        onMsg("Respostas conectadas.");
      }
      await load();
      setRelayEditing(false);
      onChanged?.();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Falha");
    } finally {
      setWorking(null);
    }
  }

  function startRelayEdit() {
    setUrlDraft(outbound.url ?? "");
    setKeyDraft("");
    setRelayEditing(true);
    setShowHeader(false);
  }

  function cancelRelayEdit() {
    setUrlDraft(outbound.url ?? "");
    setKeyDraft("");
    setRelayEditing(false);
  }

  async function ackAsaas() {
    setWorking("asaas");
    onError("");
    try {
      const r = await fetch(`/api/admin/grokbots/${grokbotId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklistAck: { asaas_webhook_ack: true } }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Falha");
      setChecklist((cur) => ({ ...cur, asaas_webhook_ack: true }));
      onMsg("Asaas marcado como configurado.");
      onChanged?.();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Falha");
    } finally {
      setWorking(null);
    }
  }

  async function copyAsaas() {
    try {
      await navigator.clipboard.writeText(asaasHook);
      onMsg("URL Asaas copiada.");
    } catch {
      onError("Não foi possível copiar.");
    }
  }

  return (
    <Card className="space-y-4 border-[var(--grokbott-hairline)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="font-display text-lg font-semibold tracking-tight">Ligar o bot</h2>
          <p className="text-sm text-[var(--grokbott-text-secondary)]">
            {ready
              ? "Pronto pra atender. Novas mensagens nas inboxes entram no fluxo."
              : `Quase pronto — falta: ${pendingLabel || "…"}`}
          </p>
        </div>
        <span
          className={`rounded-md px-2.5 py-1 text-xs font-medium ${
            ready
              ? "bg-[var(--grokbott-success)]/15 text-[var(--grokbott-success)]"
              : "bg-[var(--grokbott-warning)]/15 text-[var(--grokbott-warning)]"
          }`}
        >
          {ready ? "Pronto pra atender" : "Quase pronto"}
        </span>
      </div>

      <ol className="space-y-4">
        <li className="flex gap-3">
          <StatusDot ok={manytalksOk} />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">1. Conectar ManyTalks</p>
                <p className="text-xs text-[var(--grokbott-text-secondary)]">
                  Registra o webhook para receber mensagens.
                </p>
              </div>
              {manytalksOk ? (
                <span className="text-xs text-[var(--grokbott-success)]">Conectado</span>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={busy || working !== null}
                  onClick={() => void connectManytalks()}
                >
                  {working === "webhook" ? "Conectando…" : "Conectar"}
                </Button>
              )}
            </div>
            {!manytalksOk && (
              <div className="space-y-2">
                <code className="block break-all rounded-md bg-[var(--grokbott-surface-1)] px-2 py-1.5 font-mono text-xs">
                  {manytalksHook}
                </code>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy || working !== null}
                    onClick={() => void copyManytalksHook()}
                  >
                    Copiar URL
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy || working !== null}
                    onClick={() => void ackManytalksManual()}
                  >
                    Já configurei no ManyTalks
                  </Button>
                </div>
                {webhookError && (
                  <p className="text-xs text-[var(--grokbott-danger)]">{webhookError}</p>
                )}
              </div>
            )}
          </div>
        </li>

        <li className="flex gap-3">
          <StatusDot ok={responsesOk} />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">2. Grok (webhook de respostas)</p>
                <p className="text-xs text-[var(--grokbott-text-secondary)]">
                  {relayOk && !relayEditing
                    ? "Relay conectado. Use Testar integração ou Alterar URL/chave."
                    : "Informe URL e chave da rotina. Ao salvar, rodamos o teste no ManyTalks."}
                </p>
              </div>
              {relayOk && !relayEditing ? (
                <span className="text-xs text-[var(--grokbott-success)]">Conectado</span>
              ) : null}
            </div>

            {relayOk && !relayEditing ? (
              <div className="space-y-2">
                <code className="block break-all rounded-md bg-[var(--grokbott-surface-1)] px-2 py-1.5 font-mono text-xs">
                  {outbound.url}
                </code>
                <p className="text-xs text-[var(--grokbott-text-secondary)]">Chave salva no servidor.</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy || working !== null}
                    onClick={() => void runIntegrationTest()}
                  >
                    {working === "relay" ? "Testando…" : "Testar integração"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy || working !== null}
                    onClick={startRelayEdit}
                  >
                    Alterar
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-2">
                  <div className="space-y-1">
                    <Label htmlFor={`go-live-url-${grokbotId}`}>URL do webhook</Label>
                    <Input
                      id={`go-live-url-${grokbotId}`}
                      value={urlDraft}
                      onChange={(e) => setUrlDraft(e.target.value)}
                      placeholder="https://…"
                      autoComplete="off"
                      disabled={busy || working !== null}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`go-live-key-${grokbotId}`}>Chave</Label>
                    <Input
                      id={`go-live-key-${grokbotId}`}
                      type="password"
                      value={keyDraft}
                      onChange={(e) => setKeyDraft(e.target.value)}
                      placeholder={outbound.hasAuthValue ? "Nova chave (opcional se manter)" : "crsr_…"}
                      autoComplete="off"
                      disabled={busy || working !== null}
                    />
                  </div>
                  <button
                    type="button"
                    className="w-fit text-xs text-[var(--grokbott-text-secondary)] underline-offset-2 hover:underline"
                    onClick={() => setShowHeader((v) => !v)}
                  >
                    {showHeader ? "Ocultar cabeçalho" : "Cabeçalho (raro)"}
                  </button>
                  {showHeader ? (
                    <div className="space-y-1">
                      <Label htmlFor={`go-live-header-${grokbotId}`}>Cabeçalho</Label>
                      <Input
                        id={`go-live-header-${grokbotId}`}
                        value={headerDraft}
                        onChange={(e) => setHeaderDraft(e.target.value)}
                        placeholder="Authorization"
                        autoComplete="off"
                        disabled={busy || working !== null}
                      />
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy || working !== null || !urlDraft.trim()}
                    onClick={() => void saveRelay()}
                  >
                    {working === "relay" ? "Salvando e testando…" : "Salvar e testar"}
                  </Button>
                  {relayOk && relayEditing ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy || working !== null}
                      onClick={cancelRelayEdit}
                    >
                      Cancelar
                    </Button>
                  ) : null}
                </div>
              </>
            )}
            {testLines?.length ? (
              <ul className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-[var(--grokbott-hairline)] p-2 text-xs">
                {testLines.map((p) => (
                  <li key={p.key} className="flex gap-2">
                    <span
                      className={
                        p.skipped
                          ? "text-[var(--grokbott-text-secondary)]"
                          : p.ok
                            ? "text-[var(--grokbott-success)]"
                            : "text-[var(--grokbott-danger)]"
                      }
                    >
                      {p.skipped ? "—" : p.ok ? "✓" : "✗"}
                    </span>
                    <span>
                      {p.label}
                      {p.detail ? ` — ${p.detail}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </li>

        <li className="flex gap-3">
          <StatusDot ok={published} />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-medium">3. Manifest publicado</p>
            <p className="text-xs text-[var(--grokbott-text-secondary)]">
              Webhooks só usam configuração após Publicar no topo do bot.
            </p>
            {published ? (
              <span className="text-xs text-[var(--grokbott-success)]">Publicado</span>
            ) : (
              <span className="text-xs text-[var(--grokbott-warning)]">Ainda não publicou</span>
            )}
          </div>
        </li>

        {paymentsEnabled && (
          <li className="flex gap-3">
            <StatusDot ok={asaasOk} />
            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <p className="text-sm font-medium">4. Webhook Asaas</p>
                <p className="text-xs text-[var(--grokbott-text-secondary)]">
                  No painel Asaas, cadastre esta URL e marque aqui quando terminar.
                </p>
              </div>
              <code className="block break-all rounded-md bg-[var(--grokbott-surface-1)] px-2 py-1.5 font-mono text-xs">
                {asaasHook}
              </code>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy || working !== null}
                  onClick={() => void copyAsaas()}
                >
                  Copiar URL
                </Button>
                {!asaasOk && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy || working !== null}
                    onClick={() => void ackAsaas()}
                  >
                    {working === "asaas" ? "…" : "Já configurei no Asaas"}
                  </Button>
                )}
                {asaasOk && (
                  <span className="self-center text-xs text-[var(--grokbott-success)]">
                    Configurado
                  </span>
                )}
              </div>
            </div>
          </li>
        )}
      </ol>
    </Card>
  );
}
