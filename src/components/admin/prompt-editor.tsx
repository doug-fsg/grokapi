"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KnowledgeBase } from "@/components/admin/knowledge-base";
import { LabelsConfigCard } from "@/components/admin/labels-config-card";
import { parseKnowledge } from "@/lib/knowledge/entries";
import {
  buildGrokInstructionPreview,
  type RuntimeSystemInput,
} from "@/lib/manifest/system-prompt";

export type ToolsDraft = {
  send_reply: boolean;
  set_conversation_labels: boolean;
  move_kanban_card: boolean;
  create_contact: boolean;
  update_contact: boolean;
  create_payment_link: boolean;
  create_pix_charge: boolean;
  start_conversation: boolean;
  assign_conversation: boolean;
};

const TOOLS: { key: keyof ToolsDraft; label: string; hint: string }[] = [
  { key: "send_reply", label: "Responder a mensagem", hint: "Envia o texto no ManyTalks" },
  { key: "set_conversation_labels", label: "Aplicar etiquetas", hint: "Marca a conversa" },
  { key: "move_kanban_card", label: "Mover no funil", hint: "Só com funil ligado" },
  { key: "create_contact", label: "Criar contato", hint: "Nunca exclui" },
  { key: "update_contact", label: "Editar contato", hint: "PATCH — nunca exclui" },
  { key: "create_payment_link", label: "Link de pagamento", hint: "Asaas" },
  { key: "create_pix_charge", label: "PIX copia e cola", hint: "Asaas" },
  {
    key: "start_conversation",
    label: "Iniciar conversa (pacote)",
    hint: "Contato + abrir + 1ª msg no servidor",
  },
  {
    key: "assign_conversation",
    label: "Atribuir conversa",
    hint: "Atribui a conversa ao usuário padrão",
  },
];

type Props = {
  grokbotId: string;
  runtimeDraft: RuntimeSystemInput;
  setLabels: (labels: RuntimeSystemInput["labels"]) => void;
  knowledge: string;
  setKnowledge: (v: string) => void;
  tools: ToolsDraft;
  setTools: (v: ToolsDraft) => void;
  kanbanStages: string[];
  pauseBotStages: string[];
  pipelineId: number | "";
  manytalks: {
    base_url: string;
    account_id: number;
    enabled_inbox_ids: number[];
  };
  onRuntimeToken?: (token: string) => void;
};

export function PromptEditor({
  grokbotId,
  runtimeDraft,
  setLabels,
  knowledge,
  setKnowledge,
  tools,
  setTools,
  kanbanStages,
  pauseBotStages,
  pipelineId,
  manytalks,
  onRuntimeToken,
}: Props) {
  const [copyMsg, setCopyMsg] = useState("");
  const [copyBusy, setCopyBusy] = useState(false);

  const draft: RuntimeSystemInput = {
    ...runtimeDraft,
    tools,
    hasKnowledge: parseKnowledge(knowledge).length > 0,
    kanban: {
      ...runtimeDraft.kanban,
      pipeline_id: pipelineId === "" ? null : pipelineId,
      stages_allowed: kanbanStages,
      pause_bot_stages: pauseBotStages,
      stage_rules: [],
    },
  };

  const instruction = useMemo(
    () =>
      buildGrokInstructionPreview(
        draft,
        {
          base_url: manytalks.base_url,
          account_id: manytalks.account_id,
          enabled_inbox_ids: manytalks.enabled_inbox_ids,
          manytalks_token: "",
          asaas_key: "",
        },
        true,
      ),
    [draft, manytalks],
  );

  async function copyForGrok() {
    setCopyMsg("");
    setCopyBusy(true);
    try {
      const r = await fetch(`/api/admin/grokbots/${grokbotId}/grok-instruction`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Falha");
      await navigator.clipboard.writeText(String(j.instruction ?? ""));
      if (typeof j.runtime_token === "string" && j.runtime_token) {
        onRuntimeToken?.(j.runtime_token);
      }
      setCopyMsg(
        "Prompt copiado (modo Library). Na rotina: só GROKBOT_RUNTIME_TOKEN — remova MANYTALKS_API_TOKEN.",
      );
    } catch (err) {
      setCopyMsg(err instanceof Error ? err.message : "Falha ao copiar");
    } finally {
      setCopyBusy(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="space-y-4">
        <Card className="space-y-3">
          <h2 className="font-semibold">Knowledge (horários, preços, políticas)</h2>
          <p className="text-sm text-[var(--grokbott-text-secondary)]">
            Fatos oficiais — só via{" "}
            <code className="font-mono text-xs">lookup_knowledge</code>. Tom e roteiro: chat
            privado na conversa.
          </p>
          <KnowledgeBase value={knowledge} onChange={setKnowledge} />
        </Card>

        <LabelsConfigCard
          grokbotId={grokbotId}
          labels={runtimeDraft.labels}
          onChange={setLabels}
        />

        <Card className="space-y-3">
          <div className="space-y-1">
            <h2 className="font-semibold">Tools policy</h2>
            <p className="text-sm text-[var(--grokbott-text-secondary)]">
              Liga ou desliga cada function call disponível ao modelo.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {TOOLS.map((t) => (
              <label
                key={t.key}
                className="flex items-start gap-2 rounded-md border border-[var(--grokbott-hairline)] p-2 text-sm"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={tools[t.key]}
                  onChange={(e) => setTools({ ...tools, [t.key]: e.target.checked })}
                />
                <span>
                  <span className="font-medium">{t.label}</span>
                  <span className="block text-xs text-[var(--grokbott-text-secondary)]">
                    {t.hint}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </Card>
      </div>

      <Card className="space-y-2 xl:sticky xl:top-4 xl:self-start">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Instrução ao Grok (system)</h2>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={copyBusy}
            onClick={() => void copyForGrok()}
          >
            {copyBusy ? "Gerando…" : "Copiar prompt único (com token)"}
          </Button>
        </div>
        <p className="text-sm text-[var(--grokbott-text-secondary)]">
          Cole no ManyTalks Bot. Depois: Runtime → POST para / chave / cabeçalho.
        </p>
        {copyMsg ? <p className="text-xs text-[var(--grokbott-success)]">{copyMsg}</p> : null}
        <pre className="max-h-[640px] overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--grokbott-surface-1)] p-3 font-sans text-sm leading-relaxed">
          {instruction}
        </pre>
      </Card>
    </div>
  );
}
