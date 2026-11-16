"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  grokbotId: string;
  name: string;
  onName: (name: string) => void;
  accountId: number;
  manifestVersion: number;
  enabled: boolean;
  dashboardSlug: string | null;
  busy: boolean;
  onSave: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onMsg: (msg: string) => void;
  onError: (msg: string) => void;
  onSlug: (slug: string) => void;
};

export function GrokbotToolbar({
  grokbotId,
  name,
  onName,
  accountId,
  manifestVersion,
  enabled,
  dashboardSlug,
  busy,
  onSave,
  onToggle,
  onDelete,
  onMsg,
  onError,
  onSlug,
}: Props) {
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const nameRef = useRef<HTMLInputElement>(null);

  const [passOpen, setPassOpen] = useState(false);
  const [password, setPassword] = useState<string | null>(null);
  const [recoverable, setRecoverable] = useState<boolean | null>(null);
  const [shown, setShown] = useState(false);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [working, setWorking] = useState(false);

  const dashHref = dashboardSlug ? `/d/${dashboardSlug}` : null;

  useEffect(() => {
    if (!renaming) setDraftName(name);
  }, [name, renaming]);

  useEffect(() => {
    if (renaming) nameRef.current?.select();
  }, [renaming]);

  function commitName() {
    const next = draftName.trim() || name;
    onName(next);
    setDraftName(next);
    setRenaming(false);
  }

  async function loadPassword(startEdit = false) {
    setWorking(true);
    onError("");
    try {
      if (dashboardSlug) {
        const r = await fetch(`/api/admin/grokbots/${grokbotId}/dashboard?reveal=1`);
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Falha ao ler a senha");
        setRecoverable(Boolean(j.recoverable));
        setPassword(typeof j.password === "string" ? j.password : null);
      } else {
        setRecoverable(false);
        setPassword(null);
        startEdit = true;
      }
      setShown(false);
      setEditing(startEdit);
      setDraft("");
      setPassOpen(true);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Falha ao ler a senha");
    } finally {
      setWorking(false);
    }
  }

  async function savePassword() {
    if (draft.trim().length < 6) {
      onError("A senha do dashboard precisa ter no mínimo 6 caracteres.");
      return;
    }
    setWorking(true);
    onError("");
    try {
      const r = await fetch(`/api/admin/grokbots/${grokbotId}/dashboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: draft }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Falha ao salvar a senha");
      setPassword(j.password ?? draft);
      setRecoverable(true);
      setShown(true);
      setDraft("");
      setEditing(false);
      onSlug(j.slug);
      onMsg("Senha do dashboard atualizada.");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Falha ao salvar a senha");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-3 border-b border-border pb-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 text-sm">
          <Link
            href="/grokbots"
            className="shrink-0 text-[var(--grokbott-link)] underline-offset-4 hover:underline"
          >
            ← ManyTalks Bots
          </Link>
          <span className="text-[var(--grokbott-text-tertiary)]">/</span>
          {renaming ? (
            <Input
              ref={nameRef}
              value={draftName}
              className="h-8 max-w-xs"
              aria-label="Nome do bot"
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitName();
                }
                if (e.key === "Escape") {
                  setDraftName(name);
                  setRenaming(false);
                }
              }}
            />
          ) : (
            <button
              type="button"
              className="truncate font-medium hover:underline"
              title="Clique para renomear"
              onClick={() => setRenaming(true)}
            >
              {name || "Sem nome"}
            </button>
          )}
        </div>
        <p className="text-xs text-[var(--grokbott-text-secondary)]">
          Account {accountId} · v{manifestVersion} ·{" "}
          <span className={enabled ? "text-[var(--grokbott-success)]" : "text-[var(--grokbott-warning)]"}>
            {enabled ? "ativo" : "pausado"}
          </span>
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <Button type="button" size="sm" className="h-7 px-2.5 text-xs" disabled={busy} onClick={onSave}>
          {busy ? "Salvando…" : "Salvar"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2.5 text-xs"
          disabled={busy}
          onClick={onToggle}
        >
          {enabled ? "Pausar" : "Ativar"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="danger"
          className="h-7 px-2.5 text-xs"
          disabled={busy}
          onClick={onDelete}
        >
          Excluir
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2.5 text-xs"
              disabled={busy || working}
            >
              Dashboard
              <ChevronDown className="h-3 w-3 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {dashHref ? (
              <DropdownMenuItem
                onSelect={() => {
                  window.open(dashHref, "_blank", "noopener,noreferrer");
                }}
              >
                Abrir painel
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem disabled>Abrir painel</DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={working}
              onSelect={() => {
                void loadPassword(false);
              }}
            >
              Ver senha
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={working}
              onSelect={() => {
                void loadPassword(true);
              }}
            >
              Editar senha
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {passOpen && (
        <div className="space-y-2 rounded-md border border-border bg-[var(--grokbott-surface-1)] p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-[var(--grokbott-text-secondary)]">
              Senha do dashboard
            </p>
            <button
              type="button"
              className="text-xs text-[var(--grokbott-text-secondary)] hover:text-[var(--grokbott-text-primary)]"
              onClick={() => {
                setPassOpen(false);
                setEditing(false);
              }}
            >
              Fechar
            </button>
          </div>

          {!editing ? (
            recoverable && password ? (
              <div className="flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded-md border border-border bg-[var(--grokbott-surface-2)] px-2 py-1.5 font-mono text-xs">
                  {shown ? password : "••••••••"}
                </code>
                <button
                  type="button"
                  className="text-xs text-[var(--grokbott-text-secondary)] hover:text-[var(--grokbott-text-primary)]"
                  onClick={() => setShown((v) => !v)}
                >
                  {shown ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            ) : (
              <p className="text-xs text-[var(--grokbott-text-secondary)]">
                Senha antiga não recuperável. Escolha Editar senha no menu Dashboard.
              </p>
            )
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[12rem] flex-1 space-y-1">
                <Label htmlFor="dash-password-new" className="text-xs">
                  Nova senha
                </Label>
                <Input
                  id="dash-password-new"
                  type="text"
                  value={draft}
                  autoComplete="off"
                  placeholder="Mínimo 6 caracteres"
                  className="h-9"
                  onChange={(e) => setDraft(e.target.value)}
                />
              </div>
              <Button type="button" size="sm" disabled={working} onClick={() => void savePassword()}>
                {working ? "…" : "Salvar senha"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
