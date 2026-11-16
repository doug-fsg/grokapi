"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/brand/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  return (
    <div className="hero-brand flex min-h-screen flex-col items-center justify-center p-6">
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>
      <form
        className="w-full max-w-sm space-y-4 rounded-md border border-border bg-[var(--grokbott-surface-2)] p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
          if (!res.ok) {
            const j = await res.json();
            setError(j.error ?? "Falha no login.");
            return;
          }
          router.push("/");
        }}
      >
        <BrandMark size="lg" glow lede="Painel do operador" />
        <div className="space-y-1">
          <Label>E-mail</Label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </div>
        <div className="space-y-1">
          <Label>Senha</Label>
          <Input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
        </div>
        {error && <p className="text-sm text-[var(--grokbott-danger)]">{error}</p>}
        <Button className="w-full" type="submit">
          Entrar no painel
        </Button>
      </form>
    </div>
  );
}
