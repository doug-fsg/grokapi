"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { appUrl } from "@/lib/utils";
import { KanbanStep } from "@/components/wizard/kanban-step";
import { KnowledgeBase } from "@/components/admin/knowledge-base";

const STEPS = [
  "Identidade",
  "Inboxes",
  "Base",
  "Funil",
  "Asaas",
  "Dashboard",
];

type Inbox = { id: number; name: string };
type MtAccount = { id: number; name: string };
type MtStatus = {
  base: string;
  platformConfigured: boolean;
  serviceConfigured: boolean;
  profile?: { name: string | null; email: string | null; role: string | null } | null;
  accountsCount?: number;
  profileError?: string;
};

export function WizardForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [id, setId] = useState("");
  const [runtimeToken, setRuntimeToken] = useState("");
  const [name, setName] = useState("");
  const [accountId, setAccountId] = useState("");
  const [mtToken, setMtToken] = useState("");
  const [mtStatus, setMtStatus] = useState<MtStatus | null>(null);
  const [accounts, setAccounts] = useState<MtAccount[]>([]);
  const [inboxes, setInboxes] = useState<Inbox[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [knowledge, setKnowledge] = useState("");
  const [kanbanEnabled, setKanbanEnabled] = useState(false);
  const [pipelineId, setPipelineId] = useState<number | "">("");
  const [stages, setStages] = useState<string[]>([]);
  const [pauseStages, setPauseStages] = useState<string[]>([]);
  const [objetivoStageId, setObjetivoStageId] = useState<string | null>(null);
  const [asaasEnv, setAsaasEnv] = useState("sandbox");
  const [asaasKey, setAsaasKey] = useState("");
  const [allowLink, setAllowLink] = useState(true);
  const [allowPix, setAllowPix] = useState(false);
  const [postCrm, setPostCrm] = useState(true);
  const [postMsg, setPostMsg] = useState(true);
  const [postTpl, setPostTpl] = useState("Recebemos, {{nome}}! Valor {{valor}}.");
  const [dashPass, setDashPass] = useState("");
  const [dashUrl, setDashUrl] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [published, setPublished] = useState(false);

  async function json(url: string, init?: RequestInit) {
    const res = await fetch(url, init);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? res.statusText);
    return data;
  }

  async function loadAccounts() {
    const data = await json("/api/admin/manytalks/accounts");
    const list = (data.accounts ?? []) as MtAccount[];
    setAccounts(list);
    if (list.length === 1) {
      setAccountId(String(list[0].id));
      if (!name.trim()) setName(list[0].name);
    }
    return list;
  }

  async function loadInboxes(accId: string) {
    const data = await json(`/api/admin/manytalks/inboxes?accountId=${accId}`);
    const list = (data.inboxes ?? []) as Inbox[];
    setInboxes(list);
    return list;
  }

  useEffect(() => {
    void (async () => {
      try {
        const status = (await json("/api/admin/manytalks/status")) as MtStatus;
        setMtStatus(status);
        if (status.serviceConfigured || status.platformConfigured) {
          await loadAccounts();
        }
      } catch {
        /* bootstrap opcional */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (step !== 1 || !accountId || !mtStatus?.serviceConfigured) return;
    void (async () => {
      setError("");
      try {
        await loadInboxes(accountId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao listar inboxes.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, accountId, mtStatus?.serviceConfigured]);

  async function next() {
    if (busy || published) return;
    setError("");
    setMsg("");
    setBusy(true);
    try {
      if (step === 0) {
        if (!name.trim()) throw new Error("Informe o nome interno do ManyTalks Bot.");
        if (!accountId) throw new Error("Selecione a account ManyTalks.");
        const created = await json("/api/admin/grokbots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, manytalksAccountId: Number(accountId) }),
        });
        setId(created.id);
        if (created.runtimeToken) setRuntimeToken(created.runtimeToken);
        if (created.existing) {
          setMsg(
            "Já existe ManyTalks Bot para esta account — reabrindo a configuração (1 bot por account).",
          );
        }
      }
      if (step === 1 && id) {
        if (mtToken.trim()) {
          await json(`/api/admin/grokbots/${id}/secrets`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ manytalksToken: mtToken }),
          });
        } else if (!mtStatus?.serviceConfigured) {
          throw new Error(
            "Falta o token ManyTalks. Configure em Configurações ou cole um PAT abaixo.",
          );
        }
        if (!selected.length) {
          throw new Error("Selecione ao menos uma inbox.");
        }
        await json(`/api/admin/grokbots/${id}/inboxes`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inboxes: selected.map((inboxId) => ({
              inboxId,
              inboxName: inboxes.find((i) => i.id === inboxId)?.name,
            })),
          }),
        });
      }
      if (step === 2) {
        await json(`/api/admin/grokbots/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ knowledge }),
        });
      }
      if (step === 3) {
        if (kanbanEnabled) {
          if (!pipelineId) throw new Error("Selecione ou crie um funil, ou desligue o funil.");
          if (!stages.length) throw new Error("Defina ao menos uma coluna do funil.");
        }
        await json(`/api/admin/grokbots/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kanban: kanbanEnabled
              ? {
                  pipeline_id: pipelineId || null,
                  stages_allowed: stages,
                  pause_bot_stages: pauseStages,
                  objetivo_stage_id: objetivoStageId,
                }
              : {
                  pipeline_id: null,
                  stages_allowed: [],
                  pause_bot_stages: [],
                  objetivo_stage_id: null,
                },
            toolsPolicy: {
              send_reply: true,
              set_conversation_labels: true,
              move_kanban_card: Boolean(kanbanEnabled && pipelineId),
              create_payment_link: allowLink,
              create_pix_charge: allowPix,
            },
          }),
        });
      }
      if (step === 4) {
        if (asaasKey) {
          await json(`/api/admin/grokbots/${id}/secrets`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ asaasApiKey: asaasKey }),
          });
        }
        await json(`/api/admin/grokbots/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            asaas: {
              environment: asaasEnv,
              allow_payment_link: allowLink,
              allow_pix_copy: allowPix,
              split_note: "Split configurado no painel Asaas da subconta",
            },
            postPayment: {
              crm_enabled: postCrm,
              labels_on_paid: ["pago"],
              kanban_stage_on_paid: "Ganho",
              message_enabled: postMsg,
              message_template: postTpl,
            },
            toolsPolicy: {
              send_reply: true,
              set_conversation_labels: true,
              move_kanban_card: Boolean(kanbanEnabled && pipelineId),
              create_payment_link: allowLink,
              create_pix_charge: allowPix,
            },
          }),
        });
      }
      if (step === 5) {
        if (!id) throw new Error("ManyTalks Bot ainda não foi criado. Volte ao passo 1.");
        if (dashPass.trim().length < 6) {
          throw new Error("A senha do dashboard precisa ter no mínimo 6 caracteres.");
        }
        const dash = await json(`/api/admin/grokbots/${id}/dashboard`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: dashPass }),
        });
        setDashUrl(dash.url);
        await json(`/api/admin/grokbots/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            enabled: false,
            checklistAck: {
              capitao_off_inboxes: true,
              manytalks_webhook_ok: false,
              asaas_webhook_ack: false,
            },
          }),
        });
        await json(`/api/admin/grokbots/${id}/publish`, { method: "POST" });
        try {
          await json(`/api/admin/grokbots/${id}/webhook`, { method: "POST" });
        } catch {
          /* checklist no detalhe cobre reconectar */
        }
        setPublished(true);
        setMsg("ManyTalks Bot criado e publicado (pausado — ative no painel quando estiver pronto).");
        router.push(`/grokbots/${id}`);
        router.refresh();
        return;
      }
      setStep((s) => Math.min(s + 1, 5));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mx-auto max-w-[720px] space-y-6">
      <div>
        <p className="font-mono text-xs text-[var(--grokbott-text-secondary)]">
          Passo {step + 1} de {STEPS.length}
        </p>
        <h2 className="mt-1 font-display text-xl font-semibold tracking-tight">{STEPS[step]}</h2>
        <div className="mt-4 flex gap-1" aria-hidden>
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={`h-0.5 flex-1 ${
                i <= step ? "bg-[var(--grokbott-accent-sunset)]" : "bg-[var(--grokbott-hairline)]"
              }`}
            />
          ))}
        </div>
      </div>
      {step === 0 && (
        <div className="space-y-3">
          {mtStatus?.serviceConfigured && mtStatus.profile && (
            <p className="rounded-md border border-[var(--grokbott-hairline)] bg-[var(--grokbott-surface-3)] p-3 text-sm">
              Conectado como <strong>{mtStatus.profile.email ?? mtStatus.profile.name}</strong> (
              {mtStatus.profile.role}) · {mtStatus.accountsCount ?? accounts.length} account(s)
            </p>
          )}
          {!mtStatus?.serviceConfigured && (
            <p className="text-sm text-[var(--grokbott-danger)]">
              Configure <code className="font-mono">MANYTALKS_SERVICE_TOKEN</code> no .env e
              reinicie o servidor.
            </p>
          )}
          <Label>Nome interno do ManyTalks Bot</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Comercial — clínica XYZ"
          />
          <Label>Account ManyTalks</Label>
          {accounts.length > 0 ? (
            <select
              className="h-9 w-full rounded-md border border-input bg-[var(--grokbott-surface-1)] px-2 text-sm"
              value={accountId}
              onChange={(e) => {
                setAccountId(e.target.value);
                const acc = accounts.find((a) => String(a.id) === e.target.value);
                if (acc && !name.trim()) setName(acc.name);
              }}
            >
              <option value="">Selecione…</option>
              {accounts.map((a) => (
                <option key={a.id} value={String(a.id)}>
                  {a.name} (#{a.id})
                </option>
              ))}
            </select>
          ) : (
            <Input
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder="ID numérico (ex.: 41)"
            />
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={async () => {
              setError("");
              try {
                await loadAccounts();
                setMsg("Accounts atualizadas.");
              } catch (err) {
                setError(err instanceof Error ? err.message : "Falha");
              }
            }}
          >
            Atualizar accounts
          </Button>
        </div>
      )}
      {step === 1 && (
        <div className="space-y-3">
          <p className="rounded-md border border-[var(--grokbott-hairline)] bg-[var(--grokbott-surface-3)] p-3 text-sm">
            Account <strong>#{accountId}</strong>. Marque as inboxes que o bot atende.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                setError("");
                try {
                  await loadInboxes(accountId);
                  setMsg("Inboxes atualizadas.");
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Falha");
                }
              }}
            >
              Recarregar inboxes
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelected(inboxes.map((i) => i.id))}
            >
              Selecionar todas
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelected([])}>
              Limpar
            </Button>
          </div>
          {inboxes.length === 0 && (
            <p className="text-sm text-[var(--grokbott-text-secondary)]">Carregando inboxes…</p>
          )}
          {inboxes.map((i) => (
            <label key={i.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(i.id)}
                onChange={(e) =>
                  setSelected((cur) =>
                    e.target.checked ? [...cur, i.id] : cur.filter((x) => x !== i.id),
                  )
                }
              />
              {i.name} ({i.id})
            </label>
          ))}
          {!mtStatus?.serviceConfigured && (
            <>
              <Label>PAT ManyTalks (se não houver SERVICE_TOKEN)</Label>
              <Input value={mtToken} onChange={(e) => setMtToken(e.target.value)} type="password" />
            </>
          )}
        </div>
      )}
      {step === 2 && (
        <div className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Base do bot</h2>
            <p className="text-sm text-[var(--grokbott-text-secondary)]">
              Assuntos oficiais (horários, preços). Consultados via{" "}
              <code className="font-mono text-xs">lookup_knowledge</code>, não colados
              no system prompt.
            </p>
          </div>
          <KnowledgeBase value={knowledge} onChange={setKnowledge} />
        </div>
      )}
      {step === 3 && id && (
        <KanbanStep
          grokbotId={id}
          enabled={kanbanEnabled}
          setEnabled={setKanbanEnabled}
          pipelineId={pipelineId}
          setPipelineId={setPipelineId}
          stages={stages}
          setStages={setStages}
          pauseStages={pauseStages}
          setPauseStages={setPauseStages}
          objetivoStageId={objetivoStageId}
          setObjetivoStageId={setObjetivoStageId}
          onError={setError}
          onMsg={setMsg}
        />
      )}
      {step === 4 && (
        <div className="space-y-3">
          <Label>Ambiente</Label>
          <select
            className="h-9 w-full rounded-md border border-input bg-[var(--grokbott-surface-1)]"
            value={asaasEnv}
            onChange={(e) => setAsaasEnv(e.target.value)}
          >
            <option value="sandbox">Sandbox</option>
            <option value="production">Produção</option>
          </select>
          <Label>API key da subconta</Label>
          <Input type="password" value={asaasKey} onChange={(e) => setAsaasKey(e.target.value)} />
          <label className="flex gap-2 text-sm">
            <input type="checkbox" checked={allowLink} onChange={(e) => setAllowLink(e.target.checked)} />
            Permitir link
          </label>
          <label className="flex gap-2 text-sm">
            <input type="checkbox" checked={allowPix} onChange={(e) => setAllowPix(e.target.checked)} />
            Permitir PIX copia e cola
          </label>
          <label className="flex gap-2 text-sm">
            <input type="checkbox" checked={postCrm} onChange={(e) => setPostCrm(e.target.checked)} />
            Pós-pagamento: labels + kanban
          </label>
          <label className="flex gap-2 text-sm">
            <input type="checkbox" checked={postMsg} onChange={(e) => setPostMsg(e.target.checked)} />
            Pós-pagamento: mensagem
          </label>
          <Textarea value={postTpl} onChange={(e) => setPostTpl(e.target.value)} />
        </div>
      )}
      {step === 5 && (
        <div className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Senha do dashboard</h2>
            <p className="text-sm text-[var(--grokbott-text-secondary)]">
              Mínimo 6 caracteres. O cliente usa em /d/… para ver métricas.
            </p>
          </div>
          <Input
            type="password"
            value={dashPass}
            onChange={(e) => setDashPass(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            disabled={busy || published}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void next();
              }
            }}
          />
          {published && dashUrl && (
            <div className="space-y-2 rounded-lg border border-[var(--grokbott-hairline)] bg-[var(--grokbott-surface-3)] p-3">
              <p className="text-sm font-medium text-[var(--grokbott-success)]">
                Publicado e ativado. Redirecionando…
              </p>
              <div className="space-y-1 font-mono text-xs">
                <p>Dashboard: {dashUrl}</p>
                {runtimeToken && <p>Runtime token: {runtimeToken}</p>}
                <p>Webhook ManyTalks: /api/hooks/manytalks</p>
                <p>Webhook Asaas: /api/hooks/asaas/{id}</p>
              </div>
            </div>
          )}
        </div>
      )}
      {error && (
        <p className="rounded-md border border-[var(--grokbott-danger)]/40 bg-[var(--grokbott-danger)]/10 p-3 text-sm text-[var(--grokbott-danger)]">
          {error}
        </p>
      )}
      {msg && !published && (
        <p className="text-sm text-[var(--grokbott-success)]">{msg}</p>
      )}
      <div className="flex justify-between">
        <Button
          type="button"
          variant="outline"
          disabled={step === 0 || busy || published}
          onClick={() => setStep((s) => s - 1)}
        >
          Voltar
        </Button>
        <div className="flex gap-2">
          {id && (
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => router.push(`/grokbots/${id}`)}
            >
              Ir ao ManyTalks Bot
            </Button>
          )}
          <Button type="button" disabled={busy || published} onClick={() => void next()}>
            {busy
              ? step === 5
                ? "Publicando…"
                : "Salvando…"
              : published
                ? "Publicado"
                : step === 5
                  ? "Publicar e ativar"
                  : "Continuar"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
