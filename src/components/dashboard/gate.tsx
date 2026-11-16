"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/brand/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export function DashboardGate({ slug }: { slug: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="dash-shell relative flex min-h-screen flex-col">
      <div className="absolute right-5 top-5 z-10">
        <ThemeToggle />
      </div>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-16 sm:px-6 lg:grid lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-8">
        <div className="mb-10 lg:mb-0">
          <BrandMark size="lg" glow />
          <h1 className="mt-8 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            O progresso da sua IA, em um só lugar.
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-[var(--grokbott-text-secondary)]">
            Atendimentos, cobranças e o que já entrou no caixa — sem planilha e sem pedir relatório
            ao time.
          </p>
        </div>

        <form
          className="w-full max-w-md space-y-5 rounded-2xl border border-border bg-[var(--grokbott-surface-2)]/90 p-7 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.55)] backdrop-blur"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const res = await fetch(`/api/d/${slug}/login`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ password }),
            });
            setBusy(false);
            if (!res.ok) {
              setError("Senha inválida.");
              return;
            }
            router.refresh();
          }}
        >
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight">Entrar no painel</h2>
            <p className="mt-1 text-sm text-[var(--grokbott-text-secondary)]">
              Use a senha que o operador compartilhou com você.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dash-pass">Senha</Label>
            <Input
              id="dash-pass"
              type="password"
              value={password}
              autoFocus
              onChange={(e) => setPassword(e.target.value)}
              className="h-11"
            />
          </div>
          {error ? <p className="text-sm text-[var(--grokbott-danger)]">{error}</p> : null}
          <Button className="h-11 w-full" disabled={busy || !password}>
            {busy ? "Abrindo…" : "Ver desempenho"}
          </Button>
        </form>
      </div>
    </div>
  );
}
