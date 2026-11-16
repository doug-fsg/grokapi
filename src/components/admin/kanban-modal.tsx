"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { KanbanStep } from "@/components/wizard/kanban-step";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grokbotId: string;
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  pipelineId: number | "";
  setPipelineId: (id: number | "") => void;
  stages: string[];
  setStages: (stages: string[]) => void;
  pauseStages: string[];
  setPauseStages: (stages: string[]) => void;
  objetivoStageId: string | null;
  setObjetivoStageId: (stage: string | null) => void;
  onError: (msg: string) => void;
  onMsg: (msg: string) => void;
  busy?: boolean;
  onSave: () => void | Promise<void>;
};

export function KanbanModal({
  open,
  onOpenChange,
  grokbotId,
  enabled,
  setEnabled,
  pipelineId,
  setPipelineId,
  stages,
  setStages,
  pauseStages,
  setPauseStages,
  objetivoStageId,
  setObjetivoStageId,
  onError,
  onMsg,
  busy,
  onSave,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Funil</DialogTitle>
          <DialogDescription>
            Opcional. Sem funil o bot só conversa e aplica etiquetas.
          </DialogDescription>
        </DialogHeader>

        <KanbanStep
          grokbotId={grokbotId}
          enabled={enabled}
          setEnabled={setEnabled}
          pipelineId={pipelineId}
          setPipelineId={setPipelineId}
          stages={stages}
          setStages={setStages}
          pauseStages={pauseStages}
          setPauseStages={setPauseStages}
          objetivoStageId={objetivoStageId}
          setObjetivoStageId={setObjetivoStageId}
          onError={onError}
          onMsg={onMsg}
          hideTitle
        />

        <DialogFooter>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy || (enabled && pipelineId === "")}
            onClick={() => void onSave()}
          >
            {busy ? "Salvando…" : "Salvar e publicar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
