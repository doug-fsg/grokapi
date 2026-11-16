"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StageBoard } from "@/components/wizard/stage-board";

export type Pipeline = {
  id: number;
  attribute_display_name?: string;
  attribute_values?: { stage_order?: string[] };
};

type Props = {
  grokbotId: string;
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  pipelineId: number | "";
  setPipelineId: (id: number | "") => void;
  stages: string[];
  setStages: (stages: string[]) => void;
  pauseStages: string[];
  setPauseStages: (stages: string[]) => void;
  objetivoStageId?: string | null;
  setObjetivoStageId?: (stage: string | null) => void;
  onError: (msg: string) => void;
  onMsg: (msg: string) => void;
  /** Esconde título externo (ex.: já há DialogTitle). */
  hideTitle?: boolean;
};

const DEFAULT_STAGES = ["Novo", "Qualificado", "Proposta", "Ganho"];

export function KanbanStep({
  grokbotId,
  enabled,
  setEnabled,
  pipelineId,
  setPipelineId,
  stages,
  setStages,
  pauseStages,
  setPauseStages,
  objetivoStageId = null,
  setObjetivoStageId,
  onError,
  onMsg,
  hideTitle,
}: Props) {
  const [pauseDraft, setPauseDraft] = useState("");
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [mode, setMode] = useState<"existing" | "create">("existing");
  const [pipeQuery, setPipeQuery] = useState("");
  const [newPipe, setNewPipe] = useState("Vendas");
  const [stageDraft, setStageDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const selectedPipeline = useMemo(
    () => pipelines.find((p) => p.id === pipelineId) ?? null,
    [pipelines, pipelineId],
  );

  const pipeMatches = useMemo(() => {
    const q = pipeQuery.trim().toLowerCase();
    if (!q) return pipelines;
    return pipelines.filter((p) => {
      const name = (p.attribute_display_name ?? "").toLowerCase();
      return name.includes(q) || String(p.id).includes(q);
    });
  }, [pipelines, pipeQuery]);

  const selectOptions = useMemo(() => {
    if (pipelineId === "") return pipeMatches;
    if (pipeMatches.some((p) => p.id === pipelineId)) return pipeMatches;
    const selected = pipelines.find((p) => p.id === pipelineId);
    return selected ? [selected, ...pipeMatches] : pipeMatches;
  }, [pipeMatches, pipelines, pipelineId]);

  async function loadPipelines() {
    setLoading(true);
    onError("");
    try {
      const res = await fetch(`/api/admin/grokbots/${grokbotId}/kanban`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao listar funis");
      const list = (data.pipelines ?? []) as Pipeline[];
      setPipelines(list);
      setMode(list.length ? "existing" : "create");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Falha ao listar funis");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (grokbotId && enabled) void loadPipelines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grokbotId, enabled]);

  function turnOff() {
    setEnabled(false);
    setPipelineId("");
    setStages([]);
    setPauseStages([]);
    setObjetivoStageId?.(null);
    onError("");
  }

  function turnOn() {
    setEnabled(true);
    if (!stages.length) setStages([...DEFAULT_STAGES]);
    if (!pauseStages.length) setPauseStages(["Ganho", "Perdido", "Fechado"]);
    onError("");
  }

  function selectPipeline(p: Pipeline) {
    setPipelineId(p.id);
    setMode("existing");
    const fromPipe = p.attribute_values?.stage_order?.filter(Boolean);
    if (fromPipe?.length) setStages(fromPipe.map(String));
  }

  function addStage() {
    const name = stageDraft.trim();
    if (!name) return;
    if (stages.includes(name)) {
      onError(`A coluna "${name}" já existe.`);
      return;
    }
    setStages([...stages, name]);
    setStageDraft("");
    onError("");
  }

  function removeStage(name: string) {
    setStages(stages.filter((s) => s !== name));
    setPauseStages(pauseStages.filter((s) => s !== name));
    if (objetivoStageId === name) setObjetivoStageId?.(null);
  }

  function addPauseStage() {
    const name = pauseDraft.trim();
    if (!name) return;
    if (pauseStages.includes(name)) {
      onError(`"${name}" já está na lista de pausa.`);
      return;
    }
    setPauseStages([...pauseStages, name]);
    setPauseDraft("");
    onError("");
  }

  async function createPipeline() {
    if (!newPipe.trim()) {
      onError("Informe o nome do funil.");
      return;
    }
    if (!stages.length) {
      onError("Adicione ao menos uma coluna.");
      return;
    }
    setCreating(true);
    onError("");
    try {
      const res = await fetch(`/api/admin/grokbots/${grokbotId}/kanban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newPipe.trim(),
          stages: stages.map((s) => ({ name: s })),
        }),
      });
      const created = await res.json();
      if (!res.ok) throw new Error(created.error ?? "Falha ao criar funil");
      const createdId =
        created.pipeline?.id ?? created.pipeline?.custom_attribute_definition?.id;
      if (createdId) setPipelineId(Number(createdId));
      onMsg("Funil criado no ManyTalks.");
      await loadPipelines();
      setMode("existing");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Falha ao criar funil");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {!hideTitle ? (
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Funil (opcional)</h2>
            <p className="text-sm text-[var(--grokbott-text-secondary)]">
              Sem funil o bot só conversa e aplica etiquetas. Ligue se quiser mover cards no
              Kanban.
            </p>
          </div>
        ) : (
          <p className="text-sm text-[var(--grokbott-text-secondary)]">Usar Kanban neste bot</p>
        )}
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={enabled}
            onChange={(e) => (e.target.checked ? turnOn() : turnOff())}
          />
          Usar funil
        </label>
      </div>

      {!enabled ? (
        <div className="rounded-lg border border-dashed border-[var(--grokbott-hairline)] bg-[var(--grokbott-surface-3)] p-4 text-sm text-[var(--grokbott-text-secondary)]">
          Funil desligado. Você pode ativar depois, sem republicar o wizard do zero.
        </div>
      ) : (
        <div className="space-y-5 rounded-lg border border-[var(--grokbott-hairline)] p-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={mode === "existing" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("existing")}
            >
              Escolher existente
            </Button>
            <Button
              type="button"
              variant={mode === "create" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("create")}
            >
              Criar novo
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={loading}
              onClick={() => void loadPipelines()}
            >
              {loading ? "Carregando…" : "Atualizar"}
            </Button>
          </div>

          {mode === "existing" && (
            <div className="space-y-3">
              {!pipelines.length && !loading && (
                <p className="text-sm text-[var(--grokbott-text-secondary)]">
                  Nenhum funil na account. Crie um novo ou desligue o funil.
                </p>
              )}

              {!!pipelines.length && (
                <>
                  <div className="space-y-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <Label>Buscar</Label>
                      <span className="text-xs text-[var(--grokbott-text-secondary)]">
                        {pipeMatches.length}/{pipelines.length}
                      </span>
                    </div>
                    <Input
                      value={pipeQuery}
                      onChange={(e) => setPipeQuery(e.target.value)}
                      placeholder="Nome ou #id…"
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Funil</Label>
                    <select
                      className="h-9 w-full rounded-md border border-input bg-[var(--grokbott-surface-1)] px-2 text-sm"
                      value={pipelineId === "" ? "" : String(pipelineId)}
                      onChange={(e) => {
                        const id = Number(e.target.value);
                        const p = pipelines.find((x) => x.id === id);
                        if (p) selectPipeline(p);
                        else setPipelineId("");
                      }}
                    >
                      <option value="">Selecione…</option>
                      {selectOptions.map((p) => (
                        <option key={p.id} value={String(p.id)}>
                          {p.attribute_display_name ?? `Funil #${p.id}`} (#{p.id})
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {selectedPipeline && (
                <div className="rounded-md bg-[var(--grokbott-surface-3)] p-3">
                  <p className="text-sm font-medium">
                    {selectedPipeline.attribute_display_name ?? `Funil #${selectedPipeline.id}`}
                  </p>
                  {(selectedPipeline.attribute_values?.stage_order?.length ?? 0) > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {selectedPipeline.attribute_values!.stage_order!.map((c) => (
                        <span
                          key={c}
                          className="rounded-md bg-[var(--grokbott-surface-1)] px-2 py-0.5 text-xs"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {mode === "create" && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Nome do funil</Label>
                <Input value={newPipe} onChange={(e) => setNewPipe(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Colunas</Label>
                <StageBoard stages={stages} onRemove={removeStage} />
                <div className="flex gap-2">
                  <Input
                    value={stageDraft}
                    onChange={(e) => setStageDraft(e.target.value)}
                    placeholder="Nova coluna"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addStage();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={addStage}>
                    Adicionar
                  </Button>
                </div>
              </div>
              <Button type="button" disabled={creating} onClick={() => void createPipeline()}>
                {creating ? "Criando…" : "Criar no ManyTalks"}
              </Button>
            </div>
          )}

          {pipelineId !== "" && mode === "existing" && (
            <div className="space-y-2 border-t border-[var(--grokbott-hairline)] pt-4">
              <Label>Colunas que o bot pode usar</Label>
              <StageBoard stages={stages} onRemove={removeStage} />
              <div className="flex gap-2">
                <Input
                  value={stageDraft}
                  onChange={(e) => setStageDraft(e.target.value)}
                  placeholder="Incluir coluna"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addStage();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addStage}>
                  Adicionar
                </Button>
              </div>
            </div>
          )}

          {pipelineId !== "" && (
            <div className="space-y-2 border-t border-[var(--grokbott-hairline)] pt-4">
              <div className="space-y-1">
                <Label>Pausar bot nestas colunas</Label>
                <p className="text-xs text-[var(--grokbott-text-secondary)]">
                  Ex.: Ganho / Perdido — o bot para de responder na conversa.
                </p>
              </div>
              <StageBoard
                stages={pauseStages}
                onRemove={(n) => setPauseStages(pauseStages.filter((s) => s !== n))}
              />
              <div className="flex flex-wrap gap-2">
                <Input
                  className="min-w-[12rem] flex-1"
                  value={pauseDraft}
                  onChange={(e) => setPauseDraft(e.target.value)}
                  placeholder="Ex.: Ganho"
                  list="kanban-pause-suggest"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addPauseStage();
                    }
                  }}
                />
                <datalist id="kanban-pause-suggest">
                  {stages.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
                <Button type="button" variant="outline" onClick={addPauseStage}>
                  Adicionar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
