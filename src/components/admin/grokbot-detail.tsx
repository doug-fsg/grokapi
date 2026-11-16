"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GrokbotToolbar } from "@/components/admin/grokbot-toolbar";
import { PromptEditor, type ToolsDraft } from "@/components/admin/prompt-editor";
import type { RuntimeSystemInput } from "@/lib/manifest/system-prompt";
import { emptyLabels } from "@/lib/defaults";
import type { GrokbotLabels } from "@/lib/types/manifest";
import { RuntimePanel } from "@/components/admin/runtime-panel";
import { BotGoLiveChecklist } from "@/components/admin/bot-go-live-checklist";
import { KanbanModal } from "@/components/admin/kanban-modal";
import { ConfirmModal } from "@/components/admin/confirm-modal";

type InboxRow = { inboxId: number; inboxName: string | null };
type Detail = {
  bot: {
    id: string;
    name: string;
    enabled: boolean;
    lastError: string | null;
    lastHealthAt: string | null;
    manifestVersion: number;
    manytalksAccountId: number;
  };
  config: {
    knowledge: string;
    toolsPolicyJson: string;
    kanbanJson: string;
  } | null;
  inboxes: InboxRow[];
  dashboard: { slug: string } | null;
  tokens: { prefix: string; createdAt: string }[];
};

const EMPTY_TOOLS: ToolsDraft = {
  send_reply: true,
  set_conversation_labels: true,
  move_kanban_card: false,
  create_payment_link: false,
  create_pix_charge: false,
};

export function GrokbotDetail({ id }: { id: string }) {
  const router = useRouter();
  const [data, setData] = useState<Detail | null>(null);
  const [name, setName] = useState("");
  const [knowledge, setKnowledge] = useState("");
  const [tools, setTools] = useState<ToolsDraft>(EMPTY_TOOLS);
  const [kanbanEnabled, setKanbanEnabled] = useState(false);
  const [pipelineId, setPipelineId] = useState<number | "">("");
  const [stages, setStages] = useState<string[]>([]);
  const [pauseStages, setPauseStages] = useState<string[]>([]);
  const [objetivoStageId, setObjetivoStageId] = useState<string | null>(null);
  const [labels, setLabels] = useState<GrokbotLabels>(emptyLabels());
  const [runtimeDraft, setRuntimeDraft] = useState<RuntimeSystemInput | null>(null);
  const [manytalksCtx, setManytalksCtx] = useState<{
    base_url: string;
    account_id: number;
    enabled_inbox_ids: number[];
  } | null>(null);
  const [available, setAvailable] = useState<{ id: number; name: string }[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [kanbanOpen, setKanbanOpen] = useState(false);

  const load = async () => {
    const r = await fetch(`/api/admin/grokbots/${id}`);
    const j = await r.json();
    if (!r.ok) throw new Error(j.error ?? "Falha ao carregar");
    setData(j);
    setName(j.bot?.name ?? "");
    setKnowledge(j.config?.knowledge ?? "");
    setSelected((j.inboxes ?? []).map((i: InboxRow) => i.inboxId));
    const policy = parseJson<Partial<ToolsDraft>>(j.config?.toolsPolicyJson, {});
    setTools({ ...EMPTY_TOOLS, ...policy });
    const kanban = parseJson<{
      pipeline_id?: number | null;
      stages_allowed?: string[];
      pause_bot_stages?: string[];
      objetivo_stage_id?: string | null;
    }>(j.config?.kanbanJson, {});
    const pipe = kanban.pipeline_id ?? "";
    setPipelineId(pipe === null || pipe === undefined ? "" : pipe);
    setKanbanEnabled(Boolean(kanban.pipeline_id));
    setStages((kanban.stages_allowed ?? []).filter(Boolean));
    setPauseStages((kanban.pause_bot_stages ?? []).filter(Boolean));
    setObjetivoStageId(kanban.objetivo_stage_id?.trim() || null);
    const preview = await fetch(`/api/admin/grokbots/${id}/manifest/preview`).then((r) =>
      r.json(),
    );
    const loadedLabels = (preview?.labels as GrokbotLabels | undefined) ?? emptyLabels();
    setLabels(loadedLabels);
    if (preview?.tools_policy && preview?.labels && preview?.kanban && preview?.asaas) {
      setRuntimeDraft({
        tools: preview.tools_policy as ToolsDraft,
        labels: loadedLabels,
        kanban: {
          pipeline_id: preview.kanban.pipeline_id ?? null,
          stages_allowed: preview.kanban.stages_allowed ?? [],
          pause_bot_stages: preview.kanban.pause_bot_stages ?? [],
          stage_rules: [],
        },
        asaas: {
          environment: preview.asaas.environment ?? "sandbox",
          allow_payment_link: Boolean(preview.asaas.allow_payment_link),
          allow_pix_copy: Boolean(preview.asaas.allow_pix_copy),
        },
        hasKnowledge: Boolean(preview.prompt?.knowledge_entries?.length),
        executeToolsBeforeReply:
          preview.conversation_rules?.execute_tools_before_reply ?? true,
      });
    }
    if (preview?.manytalks) {
      setManytalksCtx({
        base_url: String(preview.manytalks.base_url ?? ""),
        account_id: Number(preview.manytalks.account_id ?? 0),
        enabled_inbox_ids: (preview.manytalks.enabled_inbox_ids as number[]) ?? [],
      });
    }
  };

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : "Erro"));
  }, [id]);

  async function persistDraft() {
    const saved = await fetch(`/api/admin/grokbots/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        knowledge,
        toolsPolicy: {
          ...tools,
          move_kanban_card: Boolean(kanbanEnabled && pipelineId !== ""),
        },
        labels,
        kanban: kanbanEnabled
          ? {
              pipeline_id: pipelineId === "" ? null : pipelineId,
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
      }),
    }).then((r) => r.json().then((j) => ({ ok: r.ok, j })));
    if (!saved.ok) throw new Error(saved.j.error ?? "Falha ao salvar");
  }

  async function save() {
    setBusy(true);
    setError("");
    setMsg("");
    try {
      await persistDraft();
      const pub = await fetch(`/api/admin/grokbots/${id}/publish`, { method: "POST" });
      const j = await pub.json();
      if (!pub.ok) throw new Error(j.error ?? "Falha ao publicar");
      setMsg("Salvo e publicado.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  async function saveInboxes() {
    setBusy(true);
    setError("");
    setMsg("");
    try {
      const r = await fetch(`/api/admin/grokbots/${id}/inboxes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inboxes: selected.map((inboxId) => ({
            inboxId,
            inboxName: available.find((a) => a.id === inboxId)?.name
              ?? data?.inboxes.find((i) => i.inboxId === inboxId)?.inboxName
              ?? null,
          })),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Falha ao salvar inboxes");
      const pub = await fetch(`/api/admin/grokbots/${id}/publish`, { method: "POST" });
      const published = await pub.json();
      if (!pub.ok) throw new Error(published.error ?? "Falha ao publicar");
      setMsg("Inboxes salvas e manifesto publicado.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  async function togglePause(currentlyEnabled: boolean) {
    setBusy(true);
    setError("");
    setMsg("");
    try {
      const next = !currentlyEnabled;
      const r = await fetch(`/api/admin/grokbots/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Falha ao pausar");
      setMsg(
        next
          ? "Bot ativo: webhooks e API de manifest ligados."
          : "Bot pausado: webhooks e manifest retornam 403.",
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  async function removeBot() {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/grokbots/${id}`, { method: "DELETE" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Falha ao excluir");
      setConfirmDelete(false);
      router.push("/grokbots");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
      setBusy(false);
    }
  }

  if (!data?.bot) {
    return <p className="text-sm text-[var(--grokbott-text-secondary)]">Carregando…</p>;
  }
  const b = data.bot;

  return (
    <div className="space-y-4">
      <GrokbotToolbar
        grokbotId={id}
        name={name}
        onName={setName}
        accountId={b.manytalksAccountId}
        manifestVersion={b.manifestVersion}
        enabled={b.enabled}
        dashboardSlug={data.dashboard?.slug ?? null}
        busy={busy}
        onSave={() => void save()}
        onToggle={() => void togglePause(b.enabled)}
        onDelete={() => setConfirmDelete(true)}
        onMsg={setMsg}
        onError={setError}
        onSlug={(slug) =>
          setData((cur) => (cur ? { ...cur, dashboard: { slug } } : cur))
        }
      />

      <ConfirmModal
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Excluir ${b.name}?`}
        description="Apaga config, tokens, logs e dashboard. Não dá para desfazer."
        confirmLabel="Excluir"
        danger
        busy={busy}
        onConfirm={removeBot}
      />

      {!b.enabled && (
        <Card className="border-[var(--grokbott-warning)] text-sm">
          Pausado: webhooks ManyTalks/Asaas e API de manifest ignorados (403).
        </Card>
      )}
      {b.lastError && (
        <Card className="border-[var(--grokbott-danger)] text-sm">{b.lastError}</Card>
      )}
      {error && <p className="text-sm text-[var(--grokbott-danger)]">{error}</p>}
      {msg && <p className="text-sm text-[var(--grokbott-success)]">{msg}</p>}

      <BotGoLiveChecklist
        grokbotId={id}
        paymentsEnabled={Boolean(tools.create_payment_link || tools.create_pix_charge)}
        busy={busy}
        onMsg={setMsg}
        onError={setError}
      />

      {runtimeDraft && manytalksCtx && (
        <PromptEditor
          grokbotId={id}
          runtimeDraft={{ ...runtimeDraft, labels }}
          setLabels={(next) => {
            setLabels(next);
            setRuntimeDraft((cur) => (cur ? { ...cur, labels: next } : cur));
          }}
          knowledge={knowledge}
          setKnowledge={setKnowledge}
          tools={tools}
          setTools={setTools}
          kanbanStages={stages}
          pauseBotStages={pauseStages}
          pipelineId={pipelineId}
          manytalks={manytalksCtx}
          onRuntimeToken={setToken}
        />
      )}

      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="space-y-1">
          <h2 className="font-display text-lg font-semibold">Funil</h2>
          <p className="text-sm text-[var(--grokbott-text-secondary)]">
            {kanbanEnabled && pipelineId !== ""
              ? `Ligado · pipeline #${pipelineId}${stages.length ? ` · ${stages.length} colunas` : ""}`
              : "Desligado — o bot não move cards no Kanban"}
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => setKanbanOpen(true)}>
          Configurar
        </Button>
      </Card>

      <KanbanModal
        open={kanbanOpen}
        onOpenChange={setKanbanOpen}
        grokbotId={id}
        enabled={kanbanEnabled}
        setEnabled={(next) => {
          setKanbanEnabled(next);
          setTools((cur) => ({
            ...cur,
            move_kanban_card: next && pipelineId !== "",
          }));
        }}
        pipelineId={pipelineId}
        setPipelineId={(next) => {
          setPipelineId(next);
          setTools((cur) => ({
            ...cur,
            move_kanban_card: kanbanEnabled && next !== "",
          }));
        }}
        stages={stages}
        setStages={setStages}
        pauseStages={pauseStages}
        setPauseStages={setPauseStages}
        objetivoStageId={objetivoStageId}
        setObjetivoStageId={setObjetivoStageId}
        onError={setError}
        onMsg={setMsg}
        busy={busy}
        onSave={async () => {
          await save();
          setKanbanOpen(false);
        }}
      />

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">Inboxes</h2>
          <Button
            size="sm"
            className="h-10"
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setError("");
              try {
                const j = await fetch(
                  `/api/admin/manytalks/inboxes?accountId=${b.manytalksAccountId}`,
                ).then((r) => r.json());
                if (j.error) throw new Error(j.error);
                setAvailable(j.inboxes ?? []);
                setMsg("Inboxes atualizadas do ManyTalks.");
              } catch (err) {
                setError(err instanceof Error ? err.message : "Falha");
              }
            }}
          >
            Carregar do ManyTalks
          </Button>
        </div>
        <p className="text-xs text-[var(--grokbott-text-secondary)]">
          Atuais:{" "}
          {data.inboxes.length
            ? data.inboxes.map((i) => `${i.inboxName ?? "?"} (${i.inboxId})`).join(", ")
            : "nenhuma"}
        </p>
        {(available.length ? available : data.inboxes.map((i) => ({
          id: i.inboxId,
          name: i.inboxName ?? String(i.inboxId),
        }))).map((i) => (
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
        <Button size="sm" className="h-10" disabled={busy || !selected.length} onClick={() => void saveInboxes()}>
          Salvar inboxes
        </Button>
      </Card>

      <RuntimePanel
        grokbotId={id}
        dashboardSlug={data.dashboard?.slug ?? null}
        token={token}
        onToken={setToken}
        onMsg={setMsg}
        onError={setError}
        busy={busy}
      />

      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="space-y-1">
          <h2 className="font-semibold">Logs</h2>
          <p className="text-xs text-[var(--grokbott-text-secondary)]">
            Health: {b.lastHealthAt ?? "—"} · filtre por este bot em Logs
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" asChild>
          <Link href={`/logs?grokbotId=${id}`}>Abrir Logs</Link>
        </Button>
      </Card>
    </div>
  );
}

function parseJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
